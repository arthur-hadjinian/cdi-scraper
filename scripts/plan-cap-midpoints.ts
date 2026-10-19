import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {milesBetween,buildGrid} from '../src/grid.js';
const root='ROUND-2-ENGLISH';const folder=root+'/scan-plan';
const origin=createRequire(import.meta.url)('zipcodes').lookup('91506');
const db=new DatabaseSync(root+'/data/agents.db',{readOnly:true});
const yieldRows=db.prepare('SELECT first_zip,count(*) n FROM agents GROUP BY first_zip').all() as any[];
const yields=new Map(yieldRows.map(p=>[p.first_zip,p.n]));
const centers=db.prepare('SELECT zip,city,latitude,longitude,status FROM searches').all() as any[];
for(const p of centers){p.new_agents=yields.get(p.zip)||0;p.verified=false;}
for(const line of readFileSync(root+'/logs/location-checks.jsonl','utf8').trim().split(/\r?\n/)){const p=JSON.parse(line);const row=centers.find(c=>c.zip===p.zip);if(row&&p.status==='OK'&&Number.isFinite(p.latitude)){row.latitude=p.latitude;row.longitude=p.longitude;row.verified=true;}}
const historicalVerified=centers.filter(p=>p.status==='truncated'&&p.verified).length;
if(existsSync(folder+'/cap-parent-geocoder-checks.json'))for(const p of JSON.parse(readFileSync(folder+'/cap-parent-geocoder-checks.json','utf8'))){const row=centers.find(c=>c.zip===p.zip);if(row&&!row.verified&&p.usable){row.latitude=p.evidence.latitude;row.longitude=p.evidence.longitude;row.verified=true;row.current_reference_only=true;}}
const reserved=JSON.parse(readFileSync(folder+'/approved-expansion-plan.json','utf8'));
for(const p of [...reserved.initial,...reserved.candidates])if(!centers.some(c=>c.zip===p.id))centers.push({...p,zip:p.id,status:'reserved',new_agents:0,verified:true});
const placeText=readFileSync(folder+'/census-places-ca-2020.txt','utf8').trim().split(/\r?\n/);
const fields=placeText.shift()!.split('\t').map(p=>p.trim());
const places=placeText.map(line=>{const values=line.split('\t').map(s=>s.trim());const p=Object.fromEntries(fields.map((key,i)=>[key,values[i]]));return {id:'place:'+p.GEOID,name:p.NAME.replace(/ (city|CDP|town)$/,''),input:p.NAME.replace(/ (city|CDP|town)$/,'')+', CA',latitude:+p.INTPTLAT,longitude:+p.INTPTLONG,kind:'census_place'};}).filter(p=>milesBetween(origin,p)<=50);
const excluded=new Set(JSON.parse(readFileSync(folder+'/removed-coordinate-centers.json','utf8')).map((p:any)=>p.zip));
const unused=buildGrid('91506',50,0).filter(p=>p.distanceMiles<=50&&!centers.some(c=>c.zip===p.zip)&&!excluded.has(p.zip)).map(p=>({...p,id:'postal:'+p.zip,name:p.city,input:p.zip+', CA',kind:'postal_reference'}));
const caps=centers.filter(p=>p.status==='truncated');
const verifiedCaps=caps.filter(p=>p.verified);
const pairs:any[]=[];
for(let i=0;i<verifiedCaps.length;i++)for(let j=i+1;j<verifiedCaps.length;j++){
  const a=verifiedCaps[i],b=verifiedCaps[j];const distance=milesBetween(a,b);
  if(distance<1.5||distance>8)continue;
  const midpoint={latitude:(a.latitude+b.latitude)/2,longitude:(a.longitude+b.longitude)/2};
  if(milesBetween(origin,midpoint)>50)continue;
  pairs.push({a:a.zip,b:b.zip,...midpoint,weight:1+Math.sqrt(a.new_agents+b.new_agents)});
}
const candidates=[...places,...unused].map(p=>{
  const nearest=centers.map(c=>({id:c.zip,d:milesBetween(c,p)})).sort((a,b)=>a.d-b.d)[0];
  const nearby=pairs.map(pair=>({...pair,d:milesBetween(pair,p)})).filter(pair=>pair.d<=2).sort((a,b)=>a.d-b.d);
  const score=nearby.reduce((n,pair)=>n+pair.weight/(1+pair.d*pair.d),0)*Math.min(nearest.d,3);
  return {...p,nearest_existing_miles:nearest.d,nearest_existing_id:nearest.id,nearby_midpoint_pairs:nearby.length,example_pair:nearby[0]?{a:nearby[0].a,b:nearby[0].b}:null,score};
}).filter(p=>p.nearby_midpoint_pairs>0&&p.nearest_existing_miles>=.75).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
const selected:any[]=[];
for(const p of candidates)if(selected.every(q=>milesBetween(p,q)>=.75))selected.push(p);
const report={prepared_at:new Date().toISOString(),enabled:false,mode:'Research shortlist; candidate inputs need live verification. Broader validation/collection authorized by user October 16, 2026.',capped_centers:caps.length,verified_capped_centers:verifiedCaps.length,historical_submitted_centers_verified:historicalVerified,current_reference_only_centers:verifiedCaps.filter(p=>p.current_reference_only).length,capped_centers_needing_coordinate_verification:caps.length-verifiedCaps.length,overlapping_verified_pairs:pairs.length,california_places_inside_radius:places.length,unused_postal_references:unused.length,ranked_candidate_inputs:candidates.length,spatially_deduplicated_inputs:selected.length,candidates:selected,
  steps:['Validate shortlisted ZIP/city inputs through CDI; reject broad-state, duplicate-center, wrong-location and outside-radius resolutions.','After approval, queue the highest-scoring verified position between capped circles, updating scores after each completed probe.','Use current marginal unique yield for continuation; assess all phases and multiple sides of capped clusters.','Keep finite batches, sibling/depth limits, unique-coordinate deduplication and persistent skipped-location handling.','A midpoint is a planning target only: submit a supported ZIP/city query, never assume arbitrary coordinates or smaller radii are supported.'],source:'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_gaz_place_06.txt'};
writeFileSync(folder+'/cap-midpoint-research-plan.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,candidates:selected.slice(0,8)}));db.close();
