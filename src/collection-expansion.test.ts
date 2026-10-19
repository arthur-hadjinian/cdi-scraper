import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {queueCollectionExpansion,type ExpansionPlan,type ExpansionCenter} from './collection-expansion.js';
import {allAgents} from './db.js';
const center=(id:string,longitude:number):ExpansionCenter=>({id,input:'Burbank, CA',city:'Burbank',latitude:34.17,longitude,distanceMiles:2,kind:'test',sourceZip:'91506'});
test('CSV source ZIPs preserve postal codes instead of alternate-center task IDs',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec(`CREATE TABLE agents(license_number TEXT,name TEXT,address TEXT,phone TEXT,individual_id TEXT,license_url TEXT,directions_url TEXT,raw_text TEXT);
      CREATE TABLE agent_zips(license_number TEXT,zip TEXT);
      CREATE TABLE search_sources(search_id TEXT,source_zip TEXT,query_input TEXT);
      INSERT INTO agents VALUES('test','Test Name','','','','','','');
      INSERT INTO agent_zips VALUES('test','expansion:zip'),('test','expansion:city'),('test','91506');
      INSERT INTO search_sources VALUES('expansion:zip','90095','90095, CA'),('expansion:city',NULL,'Acton, CA');`);
    assert.equal(allAgents(db)[0].source_zips,'90095 91506');
  }finally{db.close();}
});
test('disabled/unapproved expansion cannot write even when called',()=>{
  const db=new DatabaseSync(':memory:');
  const plan={enabled:false,initial:[],candidates:[]} as any;
  assert.equal(queueCollectionExpansion(db,plan),0);
  plan.enabled=true;assert.equal(queueCollectionExpansion(db,plan),0);
  assert.equal((db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table'").get() as any).n,0);
  db.close();
});
test('approved expansion revisits original capped parents, allows productive siblings and deduplicates coordinates',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec(`CREATE TABLE searches(zip TEXT PRIMARY KEY,city TEXT,latitude REAL,longitude REAL,distance_miles REAL,status TEXT,updated_at TEXT);
      CREATE TABLE planned_searches(zip TEXT PRIMARY KEY,batch TEXT,rank INTEGER,queued_at TEXT);
      CREATE TABLE agents(license_number TEXT PRIMARY KEY,first_zip TEXT);
      CREATE TABLE agent_zips(license_number TEXT,zip TEXT);
      CREATE TABLE adaptive_recovery(child_zip TEXT PRIMARY KEY,parent_zip TEXT,depth INTEGER);`);
    db.prepare('INSERT INTO searches VALUES(?,?,?,?,?,?,?)').run('old-parent','Burbank',34.17,-118.32,0,'truncated','old');
    for(let i=0;i<20;i++){db.prepare('INSERT INTO agents VALUES(?,?)').run('old-'+i,'old-parent');db.prepare('INSERT INTO agent_zips VALUES(?,?)').run('old-'+i,'old-parent');}
    const plan:ExpansionPlan={enabled:true,approved_by_user_at:'test',batch:'test',initial:[],candidates:[center('child-a',-118.30),center('alias-a',-118.30),center('child-b',-118.28)],maxAdditional:3,maxPerParent:2,maxDepth:3,minSpacingMiles:.75,maxNearbyMiles:5};
    assert.equal(queueCollectionExpansion(db,plan),1,'original parent need not belong to phase two');
    assert.equal(queueCollectionExpansion(db,plan),0,'wait for first sibling to finish');
    const child=(db.prepare('SELECT child_id FROM collection_expansion').get() as any).child_id;
    db.prepare("UPDATE searches SET status='truncated' WHERE zip=?").run(child);
    for(let i=0;i<15;i++){db.prepare('INSERT INTO agents VALUES(?,?)').run('new-'+i,child);db.prepare('INSERT INTO agent_zips VALUES(?,?)').run('new-'+i,child);}
    assert.equal(queueCollectionExpansion(db,plan),1,'productive result permits second sibling');
    const ids=db.prepare('SELECT child_id FROM collection_expansion').all() as any[];
    assert.equal(ids.length,2);
    assert(!ids.some(p=>p.child_id==='child-a')||!ids.some(p=>p.child_id==='alias-a'),'same coordinates must not be searched twice');
    assert.equal(queueCollectionExpansion(db,plan),0,'no extra unreserved center remains');
    assert.equal((db.prepare("SELECT status FROM searches WHERE zip='old-parent'").get() as any).status,'truncated');
  }finally{db.close();}
});
