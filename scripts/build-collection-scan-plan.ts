import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {milesBetween} from '../src/grid.js';
const zipcodes=createRequire(import.meta.url)('zipcodes');
const root='ROUND-2-ENGLISH';
const out=`${root}/scan-plan`;
mkdirSync(out,{recursive:true});
const center=zipcodes.lookup('91506');
const db=new DatabaseSync(`${root}/data/agents.db`,{readOnly:true});
const searched=db.prepare(`SELECT s.*,(SELECT count(*) FROM agents a WHERE a.first_zip=s.zip) AS first_discovered FROM searches s`).all() as any[];
const known=new Set(searched.map(x=>x.zip));
const checks=readFileSync(`${root}/logs/location-checks.jsonl`,'utf8').trim().split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
const latest=new Map(checks.map(x=>[x.zip,x]));
for(const row of searched){const c=latest.get(row.zip);if(c){row.latitude=c.latitude;row.longitude=c.longitude;}row.center_verified=!!c;}
const census=readFileSync(`${out}/census-zcta/2020_Gaz_zcta_national.txt`,'utf8').trim().split(/\r?\n/).slice(1).map(line=>{
 const r=line.split('\t').map(x=>x.trim());return {zip:r[0],latitude:+r[5],longitude:+r[6]};
}).filter(x=>zipcodes.lookup(x.zip)?.state==='CA'&&milesBetween(center,x)<=50);
const unused=census.filter(x=>!known.has(x.zip));
const manual=unused.filter(x=>milesBetween(x,zipcodes.lookup(x.zip))>5);
const candidates=unused.filter(x=>milesBetween(x,zipcodes.lookup(x.zip))<=5).map(x=>{
 const neighbors=searched.map(s=>({s,d:milesBetween(x,s)}));
 const closest=neighbors.reduce((a,b)=>a.d<b.d?a:b);
 const nearby=neighbors.filter(y=>y.d<=7.5);
 const caps=nearby.filter(y=>y.s.status==='truncated');
 const yieldProxy=caps.reduce((n,y)=>n+Number(y.s.first_discovered)/(1+y.d*y.d),0);
 const countWithin5=neighbors.filter(y=>y.d<=5).length;
 const uncertainty=neighbors.filter(y=>y.d<=5&&!y.s.center_verified).length;
 return {...x,city:zipcodes.lookup(x.zip).city,distance_from_origin:milesBetween(center,x),nearest_searched_zip:closest.s.zip,nearest_searched_miles:closest.d,nearby_capped_centers:caps.length,overlap_count:countWithin5,unverified_overlap_count:uncertainty,yield_proxy:yieldProxy,
   productivity_score:yieldProxy*(0.5+Math.min(closest.d,3)/3),coverage_score:closest.d*20-countWithin5*2+(milesBetween(center,x)>40?5:0)};
});
const selected:any[]=[];
const choose=(field:'coverage_score'|'productivity_score',number:number,reason:string)=>{
 const sorted=[...candidates].sort((a,b)=>b[field]-a[field]||a.zip.localeCompare(b.zip));
 for(const minSpacing of [2,1.25,0.75]) {
   for(const c of sorted){if(number<=0)break;if(selected.some(s=>s.zip===c.zip||milesBetween(s,c)<minSpacing))continue;
     selected.push({...c,rank:selected.length+1,reason});number--;}
   if(number<=0)break;
 }
};
choose('coverage_score',10,'Sparse coverage or boundary gap');
choose('productivity_score',30,'Productive capped-neighborhood overlap');
const summary={prepared_at:new Date().toISOString(),origin_zip:'91506',radius_miles:50,existing_centers:searched.length,verified_existing_centers:latest.size,
 census_area_centers_within_radius:census.length,unused_census_area_centers:unused.length,unused_candidates_with_consistent_references:candidates.length,
 manual_reference_review:manual.length,first_batch:selected.length,current_agents:(db.prepare('SELECT count(*) n FROM agents').get() as any).n,
 batch_mix:{coverage_and_boundary:10,productive_capped_overlap:selected.filter(x=>x.reason.startsWith('Productive')).length},
 limitations:['Census ZCTAs are a geographic proxy, not a current USPS delivery-type certification. Each live center must still pass geocoding checks.',
 'Circle coverage is modeled from validated centers where available and legacy references otherwise. Unvalidated coverage is provisional.',
 'Scores are prioritization heuristics, not predicted agent counts; historical first-discovery yield is affected by search order.',
 'Centers are inside the 50-mile circle. Five-mile searches can also return outside-circle addresses; collection boundaries remain approximate.',
 'This planner does not modify the agent database, create a baseline snapshot, or launch the selected batch.']};
writeFileSync(`${out}/phase-two-scan-plan.json`,JSON.stringify({summary,selected,candidates,manual_reference_review:manual,searched},null,2));
writeFileSync(`${out}/first-40-zip-centers.txt`,selected.map(x=>x.zip).join('\n')+'\n');
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const xy=(p:{latitude:number;longitude:number})=>({x:410+(p.longitude-center.longitude)*Math.cos(center.latitude*Math.PI/180)*69.17*6.4,y:430-(p.latitude-center.latitude)*69.0*6.4});
const circle=(p:any,r:number,fill:string,stroke:string,opacity=1)=>{const q=xy(p);return `<circle cx="${q.x.toFixed(2)}" cy="${q.y.toFixed(2)}" r="${r}" fill="${fill}" stroke="${stroke}" opacity="${opacity}"><title>${escape(p.zip+' '+(p.city||'')+' '+(p.status||p.reason||'Unused'))}</title></circle>`;};
const rings=searched.map(p=>circle(p,32,'none',p.center_verified?'#64748b':'#a1a1aa',0.1)).join('');
const points=searched.map(p=>circle(p,2.5,p.status==='truncated'?'#b45309':p.status==='complete'?'#15803d':'#dc2626','none')).join('');
const newPoints=selected.map(p=>circle(p,5,p.reason.startsWith('Sparse')?'#7c3aed':'#2563eb','white')).join('');
const labels=['91506','90012','90802','92701','93030','91355','91101','91764'].map(zip=>{const p=zipcodes.lookup(zip),q=xy(p);return `<text x="${q.x+7}" y="${q.y-7}" font-size="11">${escape(p.city)}</text>`;}).join('');
writeFileSync(`${out}/coverage-map.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 870" role="img" aria-label="50 mile collection scan plan"><rect width="820" height="870" fill="white"/><g font-family="Arial" fill="#111827"><text x="30" y="30" font-size="20">English collection: next 40 search centers</text><text x="30" y="52" font-size="12">50-mile circle around 91506 · modeled search circles · north is up</text><circle cx="410" cy="430" r="320" fill="none" stroke="#111827" stroke-width="2"/>${rings}${points}${newPoints}${labels}<text x="30" y="815" font-size="12">Orange: capped · green: completed · red: unfinished</text><text x="30" y="837" font-size="12">Blue: 30 productive-overlap candidates · purple: 10 coverage candidates</text><text x="30" y="857" font-size="11">Faint circles: existing 5-mile searches; historical coverage is partly unverified.</text></g></svg>`);
writeFileSync(`${out}/README.md`,`# Collection scan plan\n\nPrepared ${summary.prepared_at}. No baseline snapshot or agent-database mutation was made.\n\n${JSON.stringify(summary,null,2)}\n\nThe first batch is prioritized, not a prediction of yield. Verify live locations and collect existing-license-deduplicated results. Track failures and cap statuses. The 8 reference disagreements must be reviewed before being queued.\n`);
console.log(JSON.stringify({summary,first10:selected.slice(0,10).map(x=>({zip:x.zip,city:x.city,reason:x.reason}))}));
db.close();
