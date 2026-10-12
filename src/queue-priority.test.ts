import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { nextSearches } from './db.js';

test('resume interrupted ZIP, prioritize untouched ZIPs, retain errors, skip finished ZIPs', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE searches (zip TEXT, city TEXT, latitude REAL, longitude REAL, distance_miles REAL, status TEXT, total_reported INTEGER, pages_done INTEGER, agents_seen INTEGER, error TEXT)');
    const add = db.prepare('INSERT INTO searches(zip,status,distance_miles) VALUES(?,?,?)');
    add.run('interrupted', 'in_progress', 20);
    add.run('untouched-near', 'pending', 10);
    add.run('untouched-far', 'pending', 30);
    add.run('failed-near', 'error', 1);
    add.run('finished', 'complete', 0);
    add.run('capped', 'truncated', 0);
    assert.deepEqual(nextSearches(db).map(x => x.zip), ['interrupted', 'untouched-near', 'untouched-far', 'failed-near']);
    assert.deepEqual(nextSearches(db, 2).map(x => x.zip), ['interrupted', 'untouched-near']);
  } finally { db.close(); }
});
