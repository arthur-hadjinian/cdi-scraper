import { DatabaseSync } from 'node:sqlite';
import { readFileSync,writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { milesBetween,buildGrid } from '../src/grid.js';
const z=createRequire(import.meta.url)('zipcodes');
const root='ROUND-2-ENGLISH';
const db=new DatabaseSync(root+'/data/agents.db',{readOnly:true});
const origin=z.lookup('91506');
const searches=db.prepare(`SELECT s.*,(SELECT count(*) FROM agents a WHERE a.first_zip=s.zip) new_agents FROM searches s`).all() as any[];
const known=new Set(searches.map(p=>p.zip));
const verified=new Map<string,any>();
for(const line of readFileSync(root+'/logs/location-checks.jsonl','utf8').trim().split(/\r?\n/)){try{const p=JSON.parse(line);if(p.status==='OK'&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude))verified.set(p.zip,p);}catch{}}
for(const p of searches){const v=verified.get(p.zip);if(v){p.latitude=v.latitude;p.longitude=v.longitude;}p.verified=!!v;}
const terminal=searches.filter(p=>['complete','truncated'].includes(p.status));
const nearest=(point:any,centers=terminal)=>centers.map(p=>({zip:p.zip,city:p.city,status:p.status,verified:p.verified,distance:milesBetween(p,point)})).sort((a,b)=>a.distance-b.distance)[0];
const removed=JSON.parse(readFileSync(root+'/scan-plan/removed-coordinate-centers.json','utf8'));
const removedKeys=new Set(removed.map((p:any)=>p.zip));
const all=buildGrid('91506',50,0).filter(p=>p.distanceMiles<=50);
const unused=all.filter(p=>!known.has(p.zip)).map(p=>({...p,removed:removedKeys.has(p.zip),nearest:nearest(p),capped_neighbors:terminal.filter(c=>c.status==='truncated'&&milesBetween(c,p)<=5).length}));
const census=readFileSync(root+'/scan-plan/census-zcta/2020_Gaz_zcta_national.txt','utf8').trim().split(/\r?\n/).slice(1).map(line=>{const r=line.split('\t').map(s=>s.trim());return {zip:r[0],latitude:+r[5],longitude:+r[6]};}).filter(p=>z.lookup(p.zip)?.state==='CA'&&milesBetween(origin,p)<=50).map(p=>({...p,city:z.lookup(p.zip).city,searched:known.has(p.zip),nearest:nearest(p)}));
const caps=terminal.filter(p=>p.status==='truncated');
const decisions=db.prepare(`SELECT d.*,s.new_agents FROM adaptive_decisions d JOIN (SELECT zip,(SELECT count(*) FROM agents a WHERE a.first_zip=s.zip) new_agents FROM searches s) s ON s.zip=d.parent_zip`).all() as any[];
const oldCapsWithoutAdaptive=db.prepare(`SELECT count(*) n FROM searches s WHERE s.status='truncated' AND NOT EXISTS(SELECT 1 FROM planned_searches p WHERE p.zip=s.zip)`).get();
// Point samples on published county land geometry, not an agent/population estimate.
const map=JSON.parse(readFileSync(root+'/scan-plan/map-data.json','utf8'));
function inRing(x:number,y:number,ring:number[][]){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function inPolygon(x:number,y:number,rings:number[][][]){return inRing(x,y,rings[0])&&!rings.slice(1).some(r=>inRing(x,y,r));}
const polygons=map.counties.features.flatMap((f:any)=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);
let land=0,covered=0,verifiedCovered=0;
const gapQuadrants:Record<string,number>={};
for(let north=-50;north<=50;north++)for(let east=-50;east<=50;east++){
  const point={latitude:origin.latitude+north/69,longitude:origin.longitude+east/(69*Math.cos(origin.latitude*Math.PI/180))};
  if(milesBetween(origin,point)>50||!polygons.some((poly:any)=>inPolygon(point.longitude,point.latitude,poly)))continue;
  land++;const closest=nearest(point);if(closest.distance<=5)covered++;else{const quadrant=(north>=0?'north':'south')+(east>=0?'east':'west');gapQuadrants[quadrant]=(gapQuadrants[quadrant]||0)+1;}
  if(terminal.some(p=>p.verified&&milesBetween(p,point)<=5))verifiedCovered++;
}
const report={checked_at:new Date().toISOString(),agents:db.prepare('SELECT count(*) n FROM agents').get(),searches:searches.length,statuses:db.prepare('SELECT status,count(*) n FROM searches GROUP BY status').all(),validated_terminal_centers:terminal.filter(p=>p.verified).length,
  available_zip_reference_centers:all.length,unused_zip_reference_centers:unused.length,unused_removed:unused.filter(p=>p.removed).length,unused_too_close:unused.filter(p=>!p.removed&&p.nearest.distance<.75).length,unused_with_spacing_and_capped_neighbor:unused.filter(p=>!p.removed&&p.nearest.distance>=.75&&p.capped_neighbors>0).length,
  census_centers:census.length,census_not_searched:census.filter(p=>!p.searched),census_outside_search_circles:census.filter(p=>p.nearest.distance>5),
  capped_searches:caps.length,original_caps_not_adaptively_reassessed:oldCapsWithoutAdaptive,
  completed_low_yield_caps:decisions.filter(p=>p.outcome==='low_unique_yield').length,
  remaining_candidates:unused.filter(p=>!p.removed&&p.nearest.distance>=.75).sort((a,b)=>b.nearest.distance-a.nearest.distance),
  coarse_land_circle_sampling:{sample_spacing_miles:1,land_points:land,points_within_any_terminal_search_circle:covered,points_within_validated_terminal_circle:verifiedCovered,gap_quadrants:gapQuadrants,warning:'Approximate land-area point coverage only. Includes mountains; not population coverage or completeness of capped results.'},
  notes:['Skipped centers count as known but not successful geographic coverage.','ZIP/ZCTA centers are geographic proxies; an unsearched ZIP can overlap searched areas.','Adaptive decisions are one-time and permit only one child per parent; limits do not exhaust the candidate pool.']};
writeFileSync(root+'/scan-plan/remaining-coverage-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,remaining_candidates:report.remaining_candidates.slice(0,15)}));db.close();
