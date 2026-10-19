import type { DatabaseSync } from 'node:sqlite';
import { mkdirSync,writeFileSync } from 'node:fs';

export function persistentLocationFailure(message:string):boolean {
  // Temporary service failures and access restrictions must remain retryable/reviewable.
  if(/OVER_QUERY_LIMIT|REQUEST_DENIED|UNKNOWN_ERROR|403|429|captcha|cloudflare|access denied/i.test(message))return false;
  return /Geocoding failed: ZERO_RESULTS|The Geocoding has failed for|Location mismatch: center is|Location mismatch: resolved outside California|Unknown ZIP|Invalid search ZIP/i.test(message);
}
export function skipLocation(db:DatabaseSync,zip:string,reason:string,basis:string):void {
  db.exec(`CREATE TABLE IF NOT EXISTS skipped_locations (
    zip TEXT PRIMARY KEY, city TEXT, reason TEXT NOT NULL, basis TEXT NOT NULL,
    original_search_json TEXT NOT NULL, skipped_at TEXT NOT NULL
  )`);
  const row=db.prepare('SELECT * FROM searches WHERE zip=?').get(zip);
  if(!row)throw new Error(`Cannot archive unknown search ${zip}`);
  const stamp=new Date().toISOString();
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO skipped_locations VALUES(?,?,?,?,?,?) ON CONFLICT(zip) DO NOTHING').run(zip,row.city??'',reason,basis,JSON.stringify(row),stamp);
    db.prepare("UPDATE searches SET status='skipped_location',error=?,updated_at=? WHERE zip=?").run(reason,stamp,zip);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function exportSkippedLocations(db:DatabaseSync):void {
  const rows=db.prepare('SELECT zip,city,reason,basis,original_search_json,skipped_at FROM skipped_locations ORDER BY skipped_at,zip').all();
  mkdirSync('exports',{recursive:true});
  writeFileSync('exports/skipped-locations.json',JSON.stringify(rows.map(row=>({...row,original_search:JSON.parse(String(row.original_search_json)),original_search_json:undefined})),null,2));
}
