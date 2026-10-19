import type { DatabaseSync } from 'node:sqlite';
import { existsSync,readFileSync } from 'node:fs';
import { milesBetween } from './grid.js';
export type ExpansionCenter={id:string;input:string;city:string;latitude:number;longitude:number;distanceMiles:number;kind:string;sourceZip:string|null};
export type ExpansionPlan={enabled:boolean;approved_by_user_at?:string;batch:string;initial:ExpansionCenter[];candidates:ExpansionCenter[];maxAdditional:number;maxPerParent:number;maxDepth:number;minSpacingMiles:number;maxNearbyMiles:number};
export function approvedExpansionPlan():ExpansionPlan|null {
  const file='scan-plan/approved-expansion-plan.json';
  if(!existsSync(file))return null;
  const plan=JSON.parse(readFileSync(file,'utf8')) as ExpansionPlan;
  if(!plan.enabled || !plan.approved_by_user_at)return null;
  if(plan.maxAdditional>100||plan.maxAdditional<1||plan.maxDepth>3||plan.maxPerParent>3||plan.minSpacingMiles<.75||plan.maxNearbyMiles>5)throw new Error('Expansion plan exceeds reviewed limits');
  return plan;
}
export function expansionReference(id:string):ExpansionCenter|undefined {
  const plan=approvedExpansionPlan();return plan?[...plan.initial,...plan.candidates].find(p=>p.id===id):undefined;
}
export function queueCollectionExpansion(db:DatabaseSync,plan=approvedExpansionPlan()):number {
  if(!plan?.enabled||!plan.approved_by_user_at)return 0;
  db.exec(`CREATE TABLE IF NOT EXISTS collection_expansion (
    child_id TEXT PRIMARY KEY,parent_id TEXT,depth INTEGER NOT NULL,created_at TEXT NOT NULL
  ); CREATE TABLE IF NOT EXISTS search_sources (
    search_id TEXT PRIMARY KEY, source_zip TEXT, query_input TEXT NOT NULL
  )`);
  const existing=db.prepare(`SELECT s.zip,s.latitude,s.longitude,s.status,
    COALESCE(a.n,0) new_agents,COALESCE(z.n,0) records FROM searches s
    LEFT JOIN (SELECT first_zip,count(*) n FROM agents GROUP BY first_zip) a ON a.first_zip=s.zip
    LEFT JOIN (SELECT zip,count(*) n FROM agent_zips GROUP BY zip) z ON z.zip=s.zip`).all() as any[];
  // Every plan has been verified before approval; existing live centers win over references.
  if(existsSync('logs/location-checks.jsonl'))for(const line of readFileSync('logs/location-checks.jsonl','utf8').trim().split(/\r?\n/)){try{const p=JSON.parse(line);const old=existing.find(r=>r.zip===p.zip);if(old&&p.status==='OK'&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)){old.latitude=p.latitude;old.longitude=p.longitude;}}catch{}}
  let added=0;
  db.exec('BEGIN IMMEDIATE');
  try{
    const enqueue=(p:ExpansionCenter,parent:string|null,depth:number)=>{
      if(!Number.isFinite(p.distanceMiles)||p.distanceMiles>50||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude))throw new Error(`Invalid approved center ${p.id}`);
      const stamp=new Date().toISOString();const rank=(db.prepare('SELECT COALESCE(MAX(rank),0)+1 n FROM planned_searches').get() as any).n;
      db.prepare("INSERT INTO searches(zip,city,latitude,longitude,distance_miles,status,updated_at) VALUES(?,?,?,?,?,'pending',?)").run(p.id,p.city,p.latitude,p.longitude,p.distanceMiles,stamp);
      db.prepare('INSERT INTO planned_searches(zip,batch,rank,queued_at) VALUES(?,?,?,?)').run(p.id,plan.batch,rank,stamp);
      db.prepare('INSERT INTO collection_expansion VALUES(?,?,?,?)').run(p.id,parent,depth,stamp);
      db.prepare('INSERT INTO search_sources VALUES(?,?,?)').run(p.id,p.sourceZip,p.input);
      existing.push({...p,zip:p.id,status:'pending',new_agents:0,records:0});added++;
    };
    for(const p of plan.initial)if(!existing.some(s=>s.zip===p.id))enqueue(p,null,0);
    // Reassess every capped parent, including original-phase parents and prior siblings.
    const parents=existing.filter(p=>p.status==='truncated'&&(p.new_agents>=10||(p.records>0&&p.new_agents/p.records>=.05)))
      .sort((a,b)=>b.new_agents-a.new_agents||a.zip.localeCompare(b.zip));
    for(const parent of parents){
      const total=(db.prepare('SELECT count(*) n FROM collection_expansion WHERE parent_id IS NOT NULL').get() as any).n;
      if(total>=plan.maxAdditional)break;
      const siblings=(db.prepare('SELECT count(*) n FROM collection_expansion WHERE parent_id=?').get(parent.zip) as any).n;
      const oldSiblings=(db.prepare('SELECT count(*) n FROM adaptive_recovery WHERE parent_zip=?').get(parent.zip) as any).n;
      if(siblings+oldSiblings>=plan.maxPerParent)continue;
      const unfinished=db.prepare(`SELECT 1 FROM collection_expansion c JOIN searches s ON s.zip=c.child_id WHERE c.parent_id=? AND s.status IN ('pending','in_progress','error')`).get(parent.zip);
      if(unfinished)continue;
      const recent=db.prepare(`SELECT s.zip,(SELECT count(*) FROM agents a WHERE a.first_zip=s.zip) new_agents,(SELECT count(*) FROM agent_zips a WHERE a.zip=s.zip) records
        FROM collection_expansion c JOIN searches s ON s.zip=c.child_id WHERE c.parent_id=? ORDER BY c.created_at DESC LIMIT 1`).get(parent.zip) as any;
      if(recent&&!(recent.new_agents>=10||(recent.records>0&&recent.new_agents/recent.records>=.05)))continue;
      const own=db.prepare('SELECT depth FROM collection_expansion WHERE child_id=?').get(parent.zip) as any;
      const prior=db.prepare('SELECT depth FROM adaptive_recovery WHERE child_zip=?').get(parent.zip) as any;
      const depth=(own?.depth??prior?.depth??0)+1;if(depth>plan.maxDepth)continue;
      const options=plan.candidates.filter(p=>!existing.some(s=>s.zip===p.id)&&milesBetween(parent,p)<=plan.maxNearbyMiles)
        .map(p=>{
          const spacing=Math.min(...existing.map(s=>milesBetween(s,p)));
          const nearby=existing.filter(s=>s.status==='truncated'&&milesBetween(s,p)<=5);
          let midpointWeight=0;
          for(let i=0;i<nearby.length;i++)for(let j=i+1;j<nearby.length;j++){
            const a=nearby[i],b=nearby[j],separation=milesBetween(a,b);
            if(separation<1.5||separation>8)continue;
            const d=milesBetween(p,{latitude:(a.latitude+b.latitude)/2,longitude:(a.longitude+b.longitude)/2});
            if(d<=2)midpointWeight+=(1+Math.sqrt(a.new_agents+b.new_agents))/(1+d*d);
          }
          return {p,spacing,score:(1+midpointWeight)*Math.min(spacing,3)};
        })
        .filter(p=>p.spacing>=plan.minSpacingMiles).sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id));
      if(options[0])enqueue(options[0].p,parent.zip,depth);
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return added;
}
