import type { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { buildGrid, milesBetween, type GridPoint } from './grid.js';

export type AdaptivePolicy = { enabled:boolean; batch:string; maxAdditional:number; maxDepth:number; maxNearbyMiles:number; minSpacingMiles:number };
type Center = {zip:string;latitude:number;longitude:number;status:string;new_agents:number;records:number};
export function adaptiveTables(db:DatabaseSync):void {
  db.exec(`CREATE TABLE IF NOT EXISTS adaptive_recovery (
    child_zip TEXT PRIMARY KEY,parent_zip TEXT NOT NULL,depth INTEGER NOT NULL,score REAL NOT NULL,created_at TEXT NOT NULL
  ); CREATE TABLE IF NOT EXISTS adaptive_decisions (
    parent_zip TEXT PRIMARY KEY,outcome TEXT NOT NULL,child_zip TEXT,created_at TEXT NOT NULL
  );`);
}
export function selectAdaptiveCenter(parent:Center,candidates:GridPoint[],known:Center[],policy:AdaptivePolicy):{point:GridPoint;score:number}|undefined {
  const reserved=new Set(known.map(p=>p.zip));
  return candidates.filter(p=>!reserved.has(p.zip) && milesBetween(parent,p)>=policy.minSpacingMiles && milesBetween(parent,p)<=policy.maxNearbyMiles)
    .map(point=>{
      const nearest=Math.min(...known.map(p=>milesBetween(point,p)));
      const neighborhood=known.filter(p=>['complete','truncated'].includes(p.status)&&milesBetween(point,p)<=policy.maxNearbyMiles);
      const yieldScore=neighborhood.reduce((sum,p)=>sum+p.new_agents/(1+milesBetween(point,p)**2),0);
      const overlap=neighborhood.filter(p=>milesBetween(point,p)<2).length;
      return {point,nearest,score:(1+yieldScore)*(0.5+Math.min(nearest,3)/3)/(1+overlap)};
    }).filter(p=>p.nearest>=policy.minSpacingMiles)
    .sort((a,b)=>b.score-a.score||a.point.zip.localeCompare(b.point.zip))[0];
}
export function queueAdaptiveRecovery(db:DatabaseSync,originZip:string,radius:number):number {
  const configPath='scan-plan/adaptive-recovery-settings.json';
  if(!existsSync(configPath))return 0;
  const policy=JSON.parse(readFileSync(configPath,'utf8')) as AdaptivePolicy;
  if(!policy.enabled)return 0;
  if(!Number.isInteger(policy.maxAdditional)||policy.maxAdditional<1||policy.maxAdditional>200||!Number.isInteger(policy.maxDepth)||policy.maxDepth<1||policy.maxDepth>5||!(policy.maxNearbyMiles>0&&policy.maxNearbyMiles<=7.5)||!(policy.minSpacingMiles>=0.75))throw new Error('Invalid adaptive recovery limits');
  adaptiveTables(db);
  const excluded=new Set(existsSync('scan-plan/removed-coordinate-centers.json')?JSON.parse(readFileSync('scan-plan/removed-coordinate-centers.json','utf8')).map((p:any)=>p.zip):[]);
  const candidates=buildGrid(originZip,radius,0).filter(p=>!excluded.has(p.zip)&&p.distanceMiles<=radius);
  const known=db.prepare(`SELECT s.zip,s.latitude,s.longitude,s.status,
    (SELECT count(*) FROM agents a WHERE a.first_zip=s.zip) AS new_agents,
    (SELECT count(*) FROM agent_zips a WHERE a.zip=s.zip) AS records
    FROM searches s`).all() as Center[];
  // Use the actual submitted, validated centers when available.
  if(existsSync('logs/location-checks.jsonl'))for(const line of readFileSync('logs/location-checks.jsonl','utf8').trim().split(/\r?\n/)){
    if(!line)continue;try{const p=JSON.parse(line);const row=known.find(r=>r.zip===p.zip);if(row&&p.status==='OK'&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)){row.latitude=p.latitude;row.longitude=p.longitude;}}catch{/* An incomplete last log line must not stop collection. */}
  }
  const parents=db.prepare(`SELECT s.zip FROM searches s JOIN planned_searches p ON p.zip=s.zip
    WHERE p.batch=? AND s.status='truncated' AND NOT EXISTS(SELECT 1 FROM adaptive_decisions a WHERE a.parent_zip=s.zip)
    ORDER BY s.updated_at,s.zip`).all(policy.batch) as {zip:string}[];
  let added=0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const {zip} of parents){
      let outcome='no_unused_nearby_center';let child:string|null=null;
      const parent=known.find(p=>p.zip===zip)!;
      const source=db.prepare('SELECT depth FROM adaptive_recovery WHERE child_zip=?').get(zip) as {depth:number}|undefined;
      const depth=(source?.depth||0)+1;
      const total=(db.prepare('SELECT count(*) n FROM adaptive_recovery').get() as {n:number}).n;
      if(total>=policy.maxAdditional){outcome='additional_center_limit';}
      else if(depth>policy.maxDepth){outcome='depth_limit';}
      else if(!(parent.new_agents>=10 || (parent.records>0&&parent.new_agents/parent.records>=0.05))){outcome='low_unique_yield';}
      else {
        const option=selectAdaptiveCenter(parent,candidates,known,policy);
        if(option){
          const p=option.point;const stamp=new Date().toISOString();
          const rank=(db.prepare('SELECT COALESCE(MAX(rank),0)+1 n FROM planned_searches').get() as {n:number}).n;
          db.prepare("INSERT INTO searches(zip,city,latitude,longitude,distance_miles,status,updated_at) VALUES(?,?,?,?,?,'pending',?)").run(p.zip,p.city,p.latitude,p.longitude,p.distanceMiles,stamp);
          db.prepare('INSERT INTO planned_searches(zip,batch,rank,queued_at) VALUES(?,?,?,?)').run(p.zip,policy.batch,rank,stamp);
          db.prepare('INSERT INTO adaptive_recovery VALUES(?,?,?,?,?)').run(p.zip,zip,depth,option.score,stamp);
          known.push({...p,status:'pending',new_agents:0,records:0});child=p.zip;outcome='queued';added++;
        }
      }
      db.prepare('INSERT INTO adaptive_decisions VALUES(?,?,?,?)').run(zip,outcome,child,new Date().toISOString());
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  if(parents.length)appendFileSync('logs/adaptive-recovery.log',JSON.stringify({checked_at:new Date().toISOString(),capped_centers_assessed:parents.length,added})+'\n');
  return added;
}
