import { readFileSync, writeFileSync } from 'node:fs';
import { openDb, syncGrid, nextSearches, agentCount } from '../src/db.js';
import { buildGrid, milesBetween } from '../src/grid.js';
import { locationReference } from '../src/location-check.js';

const plan=JSON.parse(readFileSync('scan-plan/full-scan-plan.json','utf8'));
if(plan.ready.length!==163 || new Set(plan.ready.map((p:any)=>p.zip)).size!==163) throw new Error('Expected 163 unique planned centers');
const db=openDb();
const baseline=agentCount(db);
const origin=locationReference('91506');
const batch='phase-two-20261014';
db.exec('BEGIN');
try {
  for(const p of plan.ready){
    const distance=milesBetween(origin,p);
    if(distance>50 || !Number.isFinite(distance))throw new Error(`Outside radius: ${p.zip}`);
    db.prepare("INSERT INTO searches(zip,city,latitude,longitude,distance_miles,status,updated_at) VALUES(?,?,?,?,?,'pending',?) ON CONFLICT(zip) DO NOTHING").run(p.zip,p.city,p.latitude,p.longitude,distance,new Date().toISOString());
    db.prepare('INSERT INTO planned_searches(zip,batch,rank,queued_at) VALUES(?,?,?,?) ON CONFLICT(zip) DO NOTHING').run(p.zip,batch,p.rank,new Date().toISOString());
  }
  // Exercise the same startup sync while the transaction is still reversible.
  const count=db.prepare('SELECT count(*) n FROM planned_searches WHERE batch=?').get(batch) as any;
  if(count.n!==163 || agentCount(db)!==baseline)throw new Error('Queue integrity check failed');
  db.exec('COMMIT');
} catch(error){db.exec('ROLLBACK');throw error;}
syncGrid(db,buildGrid('91506',50,4));
const queue=nextSearches(db);
if(queue.length!==163)throw new Error(`Expected 163 unfinished searches, found ${queue.length}`);
const manifest={batch,started_at:new Date().toISOString(),starting_unique_agents:baseline,centers:163,first_zip:queue[0].zip,settings:'Existing ROUND-2-ENGLISH/config.json and supervisor retries unchanged'};
writeFileSync('scan-plan/phase-two-run.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest));
db.close();
