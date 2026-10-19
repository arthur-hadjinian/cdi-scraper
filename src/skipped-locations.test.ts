import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { persistentLocationFailure,skipLocation } from './skipped-locations.js';
import { nextSearches,syncGrid } from './db.js';

test('only persistent location failures are skip candidates',()=>{
  assert(persistentLocationFailure('Location mismatch: center is 204.0 miles from intended ZIP'));
  assert(persistentLocationFailure('Site search error: The Geocoding has failed for Far, CA.'));
  assert(persistentLocationFailure('Geocoding failed: ZERO_RESULTS'));
  for(const error of ['Timed out waiting for the next page of agents','Geocoding failed: UNKNOWN_ERROR','Geocoding failed: OVER_QUERY_LIMIT','Geocoding failed: REQUEST_DENIED','HTTP 429','Missing geocoded location evidence','Site search error: AgentLocator unavailable'])assert(!persistentLocationFailure(error),error);
});
test('skip preserves source evidence and saved agents, and stays out of the queue after grid sync',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec(`CREATE TABLE searches(zip TEXT PRIMARY KEY,city TEXT,latitude REAL,longitude REAL,distance_miles REAL,status TEXT,total_reported INTEGER,pages_done INTEGER,agents_seen INTEGER,error TEXT,updated_at TEXT);
      CREATE TABLE planned_searches(zip TEXT PRIMARY KEY,rank INTEGER);
      CREATE TABLE cap_recovery(child_zip TEXT);
      CREATE TABLE agents(license_number TEXT PRIMARY KEY);`);
    db.prepare('INSERT INTO searches VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('90301','Inglewood',34,-118,20,'error',100,20,100,'wrong location','old');
    db.exec("INSERT INTO agents VALUES('saved-license')");
    skipLocation(db,'90301','wrong location','test');
    assert.equal(nextSearches(db).length,0);
    assert.equal((db.prepare('SELECT count(*) n FROM agents').get() as any).n,1);
    const original=JSON.parse(String(db.prepare('SELECT original_search_json FROM skipped_locations').get()!.original_search_json));
    assert.equal(original.status,'error');assert.equal(original.agents_seen,100);
    // Grid upsert updates coordinates without resetting terminal status.
    syncGrid(db,[{zip:'90301',city:'Inglewood',latitude:33.9,longitude:-118,distanceMiles:20}]);
    skipLocation(db,'90301','second reason','test again');
    assert.equal(nextSearches(db).length,0);
    assert.equal(JSON.parse(String(db.prepare('SELECT original_search_json FROM skipped_locations').get()!.original_search_json)).updated_at,'old');
  }finally{db.close();}
});
