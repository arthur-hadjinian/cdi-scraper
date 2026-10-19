import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import {queueCollectionExpansion} from '../src/collection-expansion.js';
const source=new DatabaseSync('data/agents.db',{readOnly:true});
const memory=new DatabaseSync(':memory:');
memory.exec(`CREATE TABLE searches(zip TEXT PRIMARY KEY,city TEXT,latitude REAL,longitude REAL,distance_miles REAL,status TEXT,updated_at TEXT);
CREATE TABLE planned_searches(zip TEXT PRIMARY KEY,batch TEXT,rank INTEGER,queued_at TEXT);
CREATE TABLE agents(license_number TEXT PRIMARY KEY,first_zip TEXT);
CREATE TABLE agent_zips(license_number TEXT,zip TEXT);
CREATE TABLE adaptive_recovery(child_zip TEXT PRIMARY KEY,parent_zip TEXT,depth INTEGER);`);
const selections=[['searches','zip,city,latitude,longitude,distance_miles,status,updated_at'],['planned_searches','zip,batch,rank,queued_at'],['agents','license_number,first_zip'],['agent_zips','license_number,zip'],['adaptive_recovery','child_zip,parent_zip,depth']];
memory.exec('BEGIN');
for(const [table,columns] of selections){const fields=columns.split(',');const insert=memory.prepare(`INSERT INTO ${table}(${columns}) VALUES(${fields.map(()=>'?').join(',')})`);for(const row of source.prepare(`SELECT ${columns} FROM ${table}`).all())insert.run(...fields.map(k=>row[k]));}
memory.exec('COMMIT');
const plan=JSON.parse(readFileSync('scan-plan/expansion-plan-preview.json','utf8'));
const simulated={...plan,enabled:true,approved_by_user_at:'SIMULATION ONLY - NOT USER APPROVAL'};
const added=queueCollectionExpansion(memory,simulated);
const report={checked_at:new Date().toISOString(),mode:'In-memory simulation only; source database opened read-only',proposed_added:added,proposed_tasks:memory.prepare('SELECT child_id,parent_id,depth FROM collection_expansion').all(),original_pending:source.prepare("SELECT count(*) n FROM searches WHERE status IN ('pending','error','in_progress')").get(),original_agents:source.prepare('SELECT count(*) n FROM agents').get()};
writeFileSync('scan-plan/expansion-simulation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));source.close();memory.close();
