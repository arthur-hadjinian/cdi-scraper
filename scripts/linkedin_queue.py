"""Resumable, chat-operated LinkedIn research queue. Makes no network/API calls."""
import argparse
from collections import Counter
from datetime import date
import hashlib
import json
from pathlib import Path
import sqlite3
from urllib.parse import urlparse

STATUSES = {'Strong match', 'Possible match', 'Not found'}

def connect(job):
    db = sqlite3.connect(job / 'queue.sqlite3')
    db.row_factory = sqlite3.Row
    db.execute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS people (license TEXT PRIMARY KEY, ordinal INTEGER UNIQUE, source_row INTEGER, context TEXT NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS results (license TEXT PRIMARY KEY REFERENCES people(license), payload TEXT NOT NULL)')
    db.execute('PRAGMA foreign_keys=ON')
    return db

def dump(value, path=None):
    text = json.dumps(value, ensure_ascii=False, indent=2)
    if path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(path.suffix + '.tmp')
        temp.write_text(text, encoding='utf-8')
        temp.replace(path)
    else:
        print(text)

def init(args, db):
    import openpyxl  # Read only. Workbook authoring uses artifact-tool.
    source = Path(args.input).resolve()
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    signature = json.dumps([digest, args.sheet, args.status_column, args.status_value])
    previous = db.execute("SELECT value FROM meta WHERE key='signature'").fetchone()
    if previous:
        if previous[0] != signature:
            raise ValueError('Different input or filter. Use a new job directory; saved matches will not be silently reassigned.')
        return status(db)
    w = openpyxl.load_workbook(source, read_only=True, data_only=True)
    values = iter(w[args.sheet].values)
    headers = list(next(values))
    if len(set(headers)) != len(headers):
        raise ValueError('Source headers must be unique.')
    selected, contexts = [], []
    seen = set()
    for source_row, row in enumerate(values, 2):
        item = dict(zip(headers, row))
        if item.get(args.status_column) != args.status_value:
            continue
        license_id = str(item.get('License_Number') or '').strip()
        if not license_id or license_id in seen:
            raise ValueError(f'Missing/duplicate license at source row {source_row}. Resolve before research.')
        seen.add(license_id)
        selected.append(item)
        context = {k: item.get(k) for k in ['Name','License_Number','Business_Address','Business_Phone','Agency_Organizations','Life_Appointed_Insurers','License_URL']}
        contexts.append((license_id, len(selected), source_row, json.dumps(context, ensure_ascii=False)))
    w.close()
    if not selected:
        raise ValueError('No source rows match the requested filter.')
    snapshot = {'input': str(source), 'sha256': digest, 'sheet': args.sheet,
                'filter': {args.status_column: args.status_value}, 'headers': headers, 'rows': selected}
    dump(snapshot, args.job / 'source.json')
    with db:
        db.executemany('INSERT INTO people VALUES (?,?,?,?)', contexts)
        db.execute('INSERT INTO meta VALUES (?,?)', ('signature', signature))
    status(db)

def status(db):
    counts = Counter(json.loads(r[0])['status'] for r in db.execute('SELECT payload FROM results'))
    total = db.execute('SELECT COUNT(*) FROM people').fetchone()[0]
    dump({'total': total, 'researched': sum(counts.values()), 'remaining': total-sum(counts.values()), 'results': dict(counts)})

def next_rows(args, db):
    if args.limit < 1 or args.limit > 200:
        raise ValueError('Use batches of 1 to 200 rows.')
    rows = db.execute('SELECT p.* FROM people p LEFT JOIN results r ON p.license=r.license WHERE r.license IS NULL ORDER BY p.ordinal LIMIT ?', (args.limit,))
    dump([{'ordinal': r['ordinal'], 'source_row': r['source_row'], **json.loads(r['context'])} for r in rows], args.output)

def valid_url(value, profile=False):
    u = urlparse(value)
    if u.scheme not in ('https', 'http') or not u.hostname or u.username or u.password:
        return False
    return not profile or (u.hostname in ('linkedin.com', 'www.linkedin.com') or u.hostname.endswith('.linkedin.com')) and u.path.startswith('/in/') and len(u.path.split('/')[2]) > 0

def record(args, db):
    records = json.loads(Path(args.input).read_text(encoding='utf-8'))
    known = {r[0] for r in db.execute('SELECT license FROM people')}
    existing = {r[0] for r in db.execute('SELECT license FROM results')}
    seen = set()
    for r in records:
        key = r['license']
        if key not in known or key in seen:
            raise ValueError(f'Unknown/duplicate result license: {key}')
        seen.add(key)
        if key in existing and not args.replace:
            raise ValueError(f'Already researched: {key}. Use --replace only for an intentional correction.')
        if r['status'] not in STATUSES or not r.get('evidence') or not r.get('queries'):
            raise ValueError(f'Invalid status, missing evidence or queries: {key}')
        date.fromisoformat(r['checked_on'])
        url, candidate = r.get('linkedin_url',''), r.get('candidate_url','')
        if r['status'] == 'Strong match' and (not url or candidate or not r.get('sources')):
            raise ValueError(f'Strong matches require one profile and supporting sources: {key}')
        if r['status'] != 'Strong match' and url:
            raise ValueError(f'Uncertain profile must stay in candidate_url: {key}')
        if r['status'] == 'Possible match' and not candidate:
            raise ValueError(f'Possible match requires a candidate: {key}')
        if r['status'] == 'Not found' and candidate:
            raise ValueError(f'Not found cannot contain a selected candidate: {key}')
        for value in (url,candidate):
            if value and not valid_url(value, True):
                raise ValueError(f'Not an individual LinkedIn profile: {value}')
        if any(not valid_url(s) for s in r.get('sources', [])):
            raise ValueError(f'Invalid source URL: {key}')
        if any(not isinstance(q,str) or not q.strip() for q in r['queries']):
            raise ValueError(f'Invalid search query: {key}')
    with db:
        db.executemany('INSERT OR REPLACE INTO results VALUES (?,?)', [(r['license'], json.dumps(r, ensure_ascii=False)) for r in records])
    status(db)

def export(args, db):
    snapshot = json.loads((args.job/'source.json').read_text(encoding='utf-8'))
    results = {r['license']:json.loads(r['payload']) for r in db.execute('SELECT * FROM results')}
    ordinals = {r['license']: {'ordinal':r['ordinal'],'source_row':r['source_row']} for r in db.execute('SELECT * FROM people')}
    dump({**snapshot, 'results': results, 'ordinals': ordinals}, args.output or args.job/'export.json')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--job', type=Path, default=Path('outputs/linkedin-pilot'))
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('init')
    p.add_argument('--input', required=True)
    p.add_argument('--sheet', default='Master')
    p.add_argument('--status-column', default='Passed Test')
    p.add_argument('--status-value', default='Yes')
    p = sub.add_parser('next'); p.add_argument('--limit', type=int, default=50); p.add_argument('--output')
    p = sub.add_parser('record'); p.add_argument('--input', required=True); p.add_argument('--replace', action='store_true')
    p = sub.add_parser('export'); p.add_argument('--output')
    sub.add_parser('status')
    args = parser.parse_args()
    args.job.mkdir(parents=True, exist_ok=True)
    with connect(args.job) as db:
        if args.command == 'status': status(db)
        else: {'init':init,'next':next_rows,'record':record,'export':export}[args.command](args,db)

if __name__ == '__main__':
    main()
