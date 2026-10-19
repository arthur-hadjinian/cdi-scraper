const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const read=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8'));}catch{return fallback;}};
function snapshot(){
 const state=read('scan-plan/cap-expansion-validation-state.json',null);
 const plan=read('scan-plan/approved-expansion-plan.json',{initial:[],candidates:[]});
 const research=read('scan-plan/cap-midpoint-research-plan.json',{});
 const basemap=read('scan-plan/map-data.json',{});
 const db=new DatabaseSync(path.join(__dirname,'data/agents.db'),{readOnly:true});
 try{
  const searches=db.prepare('SELECT zip,city,latitude,longitude,status,pages_done,agents_seen FROM searches').all();
  const yields=new Map(db.prepare('SELECT first_zip,count(*) n FROM agents GROUP BY first_zip').all().map(p=>[p.first_zip,p.n]));
  const links=db.prepare('SELECT child_id,parent_id,depth FROM collection_expansion').all();
  const byId=new Map(searches.map(p=>[p.zip,p]));
  const logs=fs.readFileSync(path.join(__dirname,'logs/location-checks.jsonl'),'utf8').trim().split(/\r?\n/);
  for(const line of logs){try{const p=JSON.parse(line);const row=byId.get(p.zip);if(row&&p.status==='OK'&&Number.isFinite(p.latitude)){row.latitude=p.latitude;row.longitude=p.longitude;row.live_center_verified=true;}}catch{}}
  const results=new Map((state?.results||[]).map(p=>[p.id,p]));
  const pool=new Map([...(state?.initial_candidates||[]),...(research.candidates||[])].map(p=>[p.id,p]));
  for(const result of results.values())if(!pool.has(result.id))pool.set(result.id,{id:result.id,input:result.input});
  const rows=[...pool.values()].map(p=>{
   const r=results.get(p.id);const id='midpoint:'+p.id;const task=byId.get(id);const link=links.find(l=>l.child_id===id);
   return {id,input:p.input,decision:r?.decision||'waiting',status:task?.status||null,parent:link?.parent_id||null,parent_city:byId.get(link?.parent_id)?.city||null,depth:link?.depth||null,new_agents:yields.get(id)||0,records:task?.agents_seen||0,formatted:r?.evidence?.formatted||null,latitude:r?.evidence?.latitude,longitude:r?.evidence?.longitude,checked_at:r?.checked_at||null};
  });
  const midpointTasks=links.filter(p=>p.child_id.startsWith('midpoint:')).map(p=>({...p,...byId.get(p.child_id),new_agents:yields.get(p.child_id)||0}));
  const initialKeys=new Set((state?.initial_candidates||[]).map(p=>p.id));
  const initialChecked=(state?.results||[]).filter(p=>initialKeys.has(p.id)).length;
  return {checked_at:new Date().toISOString(),status:state?.status||'waiting',phase:state?.phase||'waiting',error:state?.error||null,
   initial_total:initialKeys.size||65,initial_checked:initialChecked,verified:(state?.results||[]).filter(p=>p.decision==='verified_published').length,
   parent_checked:state?.parents?.length||0,parent_total:state?.parent_total??research.capped_centers_needing_coordinate_verification??268,
   refreshed_checked:(state?.results||[]).length-initialChecked,queued:midpointTasks.length,finished:midpointTasks.filter(p=>['complete','truncated'].includes(p.status)).length,
   active:midpointTasks.filter(p=>p.status==='in_progress').length,errors:midpointTasks.filter(p=>p.status==='error').length,
   recovered_agents:midpointTasks.reduce((n,p)=>n+p.new_agents,0),total_agents:db.prepare('SELECT count(*) n FROM agents').get().n,
   capped_total:searches.filter(p=>p.status==='truncated').length,rows,
   map:{origin:basemap.origin,counties:basemap.counties,cities:basemap.cities,caps:searches.filter(p=>p.status==='truncated'),new_centers:midpointTasks,initial:plan.initial.map(p=>({...p,...byId.get(p.id)}))}};
 }finally{db.close();}
}
module.exports={snapshot};
