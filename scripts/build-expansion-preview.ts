import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {milesBetween} from '../src/grid.js';
const root='ROUND-2-ENGLISH/scan-plan';
const geocodes=JSON.parse(readFileSync(root+'/expansion-location-verification.json','utf8'));
const db=new DatabaseSync('ROUND-2-ENGLISH/data/agents.db',{readOnly:true});
const origin=createRequire(import.meta.url)('zipcodes').lookup('91506');
const known=db.prepare("SELECT zip,city,latitude,longitude FROM searches WHERE status IN ('complete','truncated')").all() as any[];
const checks=readFileSync('ROUND-2-ENGLISH/logs/location-checks.jsonl','utf8').trim().split(/\r?\n/).map(l=>JSON.parse(l));
for(const p of checks){const row=known.find(k=>k.zip===p.zip);if(row&&p.status==='OK'&&Number.isFinite(p.latitude)){row.latitude=p.latitude;row.longitude=p.longitude;}}
const candidates:any[]=[];const initial:any[]=[];const held:any[]=[];
for(const request of geocodes.results){
  const e=request.evidence;let reason='';
  const distance=milesBetween(origin,e);
  if(e.status!=='OK'||e.country!=='US'||e.state!=='CA'||!Number.isFinite(distance))reason='No verified California center';
  else if(request.kind!=='alternate_city'&&e.postal!==request.key)reason='Geocoder did not identify the requested ZIP';
  else if(distance>50)reason='Actual geocoded center outside the 50-mile radius';
  const nearest=Number.isFinite(distance)?known.map(p=>({p,d:milesBetween(p,e)})).sort((a,b)=>a.d-b.d)[0]:undefined;
  if(!reason&&nearest!.d<.75)reason='Less than 0.75 miles from an already searched center';
  const duplicate=[...initial,...candidates].find(p=>milesBetween(p,e)<.75);
  if(!reason&&duplicate)reason='Duplicates another proposed center within 0.75 miles';
  if(reason){held.push({key:request.key,input:request.input,reason,evidence:e,nearest_miles:nearest?.d});continue;}
  const center={id:'expansion:'+request.key,input:request.input,city:e.formatted,latitude:e.latitude,longitude:e.longitude,distanceMiles:distance,kind:request.kind,sourceZip:e.postal||null,nearest_searched_miles:nearest!.d,verified_at:request.checked_at};
  // Resolve omitted/gap areas first; additional verified positions are a finite recovery pool.
  if(request.kind==='omitted_zip'||request.kind==='alternate_city')initial.push(center);else candidates.push(center);
}
const plan={enabled:false,approved_by_user_at:null,batch:'region-expansion-preview-20261016',initial,candidates,maxAdditional:100,maxPerParent:3,maxDepth:3,minSpacingMiles:.75,maxNearbyMiles:5,
 held,notes:['PREVIEW ONLY: no searches queued and no recurring task created.','The runtime reads only approved-expansion-plan.json, which does not exist before approval.','Three sibling follow-ups maximum per parent counting existing adaptive siblings; productive parents from all phases eligible.','Initial gap probes are separate from the bounded follow-up pool.','Candidate pool is finite and contains only newly verified centers, not every unverified postal ZIP.','Read-only geocoder checks verify locations; they do not establish that each probe will produce agents.']};
writeFileSync(root+'/expansion-plan-preview.json',JSON.stringify(plan,null,2));
console.log(JSON.stringify({initial:initial.map(p=>({id:p.id,input:p.input,nearest:p.nearest_searched_miles})),candidates:candidates.map(p=>({id:p.id,input:p.input,nearest:p.nearest_searched_miles})),held:held.map(p=>({input:p.input,reason:p.reason}))}));db.close();
