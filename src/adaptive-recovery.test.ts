import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { queueAdaptiveRecovery,selectAdaptiveCenter,type AdaptivePolicy } from './adaptive-recovery.js';
import { buildGrid,milesBetween } from './grid.js';

test('adaptive recovery appends unique bounded centers, survives restart, and stops low-yield branches',()=>{
  const previous=process.cwd();const fixture=mkdtempSync(path.join(tmpdir(),'cdi-adaptive-test-'));
  const db=new DatabaseSync(':memory:');
  try {
    process.chdir(fixture);mkdirSync('scan-plan');mkdirSync('logs');
    const policy:AdaptivePolicy={enabled:true,batch:'test',maxAdditional:2,maxDepth:2,maxNearbyMiles:5,minSpacingMiles:.75};
    writeFileSync('scan-plan/adaptive-recovery-settings.json',JSON.stringify(policy));
    db.exec(`CREATE TABLE searches(zip TEXT PRIMARY KEY,city TEXT,latitude REAL,longitude REAL,distance_miles REAL,status TEXT,updated_at TEXT);
      CREATE TABLE planned_searches(zip TEXT PRIMARY KEY,batch TEXT,rank INTEGER,queued_at TEXT);
      CREATE TABLE agents(license_number TEXT PRIMARY KEY,first_zip TEXT);
      CREATE TABLE agent_zips(license_number TEXT,zip TEXT);`);
    const origin=buildGrid('91506',50,0).find(p=>p.zip==='91506')!;
    db.prepare('INSERT INTO searches VALUES(?,?,?,?,?,?,?)').run(origin.zip,origin.city,origin.latitude,origin.longitude,0,'truncated','2026-10-14');
    db.prepare('INSERT INTO planned_searches VALUES(?,?,?,?)').run(origin.zip,'test',163,'2026-10-14');
    function yieldFor(zip:string,n:number){for(let i=0;i<n;i++){const license=zip+'-'+i;db.prepare('INSERT INTO agents VALUES(?,?)').run(license,zip);db.prepare('INSERT INTO agent_zips VALUES(?,?)').run(license,zip);}}
    yieldFor(origin.zip,20);
    const ranked=selectAdaptiveCenter({...origin,status:'truncated',records:20,new_agents:20},buildGrid('91506',50,0),[{...origin,status:'truncated',records:20,new_agents:20}],policy)!;
    writeFileSync('scan-plan/removed-coordinate-centers.json',JSON.stringify([{zip:ranked.point.zip}]));
    assert.equal(queueAdaptiveRecovery(db,'91506',50),1);
    assert.equal(queueAdaptiveRecovery(db,'91506',50),0,'startup must not duplicate a previous cap decision');
    const child=db.prepare('SELECT * FROM adaptive_recovery').get() as any;
    assert.notEqual(child.child_zip,ranked.point.zip,'removed centers stay removed');
    assert.equal((db.prepare('SELECT rank FROM planned_searches WHERE zip=?').get(child.child_zip) as any).rank,164,'append after existing plan');
    const center=db.prepare('SELECT * FROM searches WHERE zip=?').get(child.child_zip) as any;
    assert(milesBetween(origin,center)<=5);
    assert(center.distance_miles<=50);
    db.prepare("UPDATE searches SET status='truncated' WHERE zip=?").run(child.child_zip);
    assert.equal(queueAdaptiveRecovery(db,'91506',50),0,'zero unique additions do not grow a branch');
    assert.equal((db.prepare('SELECT outcome FROM adaptive_decisions WHERE parent_zip=?').get(child.child_zip) as any).outcome,'low_unique_yield');
    assert.equal((db.prepare('SELECT status FROM searches WHERE zip=?').get(origin.zip) as any).status,'truncated','cap is never relabeled complete');
    // Re-open a decision only in this synthetic fixture to test a productive next generation.
    db.prepare('DELETE FROM adaptive_decisions WHERE parent_zip=?').run(child.child_zip);yieldFor(child.child_zip,20);
    assert.equal(queueAdaptiveRecovery(db,'91506',50),1);
    const grandchild=db.prepare('SELECT child_zip FROM adaptive_recovery WHERE parent_zip=?').get(child.child_zip) as any;
    db.prepare("UPDATE searches SET status='truncated' WHERE zip=?").run(grandchild.child_zip);yieldFor(grandchild.child_zip,20);
    assert.equal(queueAdaptiveRecovery(db,'91506',50),0,'global limit bounds recursion');
    policy.maxAdditional=10;writeFileSync('scan-plan/adaptive-recovery-settings.json',JSON.stringify(policy));
    db.prepare('DELETE FROM adaptive_decisions WHERE parent_zip=?').run(grandchild.child_zip);
    assert.equal(queueAdaptiveRecovery(db,'91506',50),0,'depth limit bounds recursion independently');
    assert.equal((db.prepare('SELECT outcome FROM adaptive_decisions WHERE parent_zip=?').get(grandchild.child_zip) as any).outcome,'depth_limit');
  }finally{db.close();process.chdir(previous);rmSync(fixture,{recursive:true,force:true});}
});
