import argparse
import contextlib
import io
import json
from pathlib import Path
import uuid
import unittest
import linkedin_queue as q

class QueueTests(unittest.TestCase):
    def setUp(self):
        root = Path('outputs/linkedin-pilot/test-tmp').resolve()
        root.mkdir(parents=True, exist_ok=True)
        self.job = root / ('test-' + uuid.uuid4().hex)
        self.job.mkdir()
        self.db = q.connect(self.job)
        with self.db:
            self.db.executemany('INSERT INTO people VALUES (?,?,?,?)', [('001',1,2,'{}'),('002',2,3,'{}')])

    def tearDown(self):
        self.db.close()
        for child in self.job.iterdir():
            child.unlink()
        self.job.rmdir()

    def record(self, records, replace=False):
        file = self.job/'incoming.json'
        file.write_text(json.dumps(records))
        with contextlib.redirect_stdout(io.StringIO()):
            q.record(argparse.Namespace(input=str(file),replace=replace),self.db)

    def result(self, key='001'):
        return {'license':key,'status':'Not found','linkedin_url':'','candidate_url':'',
                'evidence':'No corroborated profile in two searches.','queries':['test'],
                'checked_on':'2026-10-10','sources':[]}

    def test_atomic_validation_prevents_partial_save(self):
        with self.assertRaises(ValueError):
            self.record([self.result(),self.result('unknown')])
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM results').fetchone()[0],0)

    def test_resume_skips_completed_and_prevents_overwrite(self):
        self.record([self.result()])
        with self.assertRaises(ValueError):
            self.record([self.result()])
        target=self.job/'next.json'
        q.next_rows(argparse.Namespace(limit=50,output=target),self.db)
        self.assertEqual([r['ordinal'] for r in json.loads(target.read_text())],[2])

    def test_uncertain_urls_cannot_be_exported_as_strong(self):
        bad=self.result(); bad.update(status='Possible match',linkedin_url='https://www.linkedin.com/in/test',candidate_url='https://www.linkedin.com/in/test')
        with self.assertRaises(ValueError): self.record([bad])
        bad.update(status='Strong match',candidate_url='',linkedin_url='https://www.linkedin.com/company/test',sources=['https://example.com'])
        with self.assertRaises(ValueError): self.record([bad])
        self.assertFalse(q.valid_url('https://linkedin.com.evil.example/in/test',True))

if __name__=='__main__': unittest.main()
