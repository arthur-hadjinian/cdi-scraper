const fs=require('fs');
const {DatabaseSync}=require('node:sqlite');
const zipcodes=require('zipcodes');
const folder='ROUND-2-ENGLISH/scan-plan';
const plan=JSON.parse(fs.readFileSync(folder+'/phase-two-scan-plan.json','utf8'));
// User authorized removing unresolved coordinate candidates on October 14, 2026.
// Keep an audit record; removal concerns search centers, not producer eligibility.
const removed=plan.manual_reference_review.map(x=>({...x,reason:'Coordinate sources disagree by more than five miles; removed from active plan at user request.',removed_at:'2026-10-14'}));
fs.writeFileSync(folder+'/removed-coordinate-centers.json',JSON.stringify(removed,null,2));
const first=new Map(plan.selected.map(x=>[x.zip,x.rank]));
const ready=[...plan.candidates].sort((a,b)=>(first.get(a.zip)||1000)-(first.get(b.zip)||1000)||b.productivity_score-a.productivity_score).map((x,i)=>({...x,rank:i+1}));
const db=new DatabaseSync('ROUND-2-ENGLISH/data/agents.db',{readOnly:true});
const existing=db.prepare('SELECT zip,city,latitude,longitude,status FROM searches').all();
const latest=new Map(fs.readFileSync('ROUND-2-ENGLISH/logs/location-checks.jsonl','utf8').trim().split(/\r?\n/).filter(Boolean).map(x=>{const a=JSON.parse(x);return[a.zip,a]}));
for(const x of existing){const a=latest.get(x.zip);if(a){x.latitude=a.latitude;x.longitude=a.longitude;}x.verified=!!a;}
const topology=JSON.parse(fs.readFileSync(folder+'/us-counties-topology.json'));
const decoded=topology.arcs.map(arc=>{let x=0,y=0;return arc.map(p=>{x+=p[0];y+=p[1];return [+(x*topology.transform.scale[0]+topology.transform.translate[0]).toFixed(4),+(y*topology.transform.scale[1]+topology.transform.translate[1]).toFixed(4)];});});
const ring=ids=>ids.flatMap((id,i)=>{const a=id<0?[...decoded[~id]].reverse():decoded[id];return i?a.slice(1):a;});
const counties=topology.objects.counties.geometries.filter(g=>['06029','06037','06059','06065','06071','06111'].includes(String(g.id))).map(g=>({type:'Feature',properties:g.properties,geometry:{type:g.type,coordinates:g.type==='Polygon'?g.arcs.map(ring):g.arcs.map(p=>p.map(ring))}}));
const cities=['91506','90012','91201','91101','90802','92701','93030','93010','91355','91764','91730'].map(x=>zipcodes.lookup(x)).map(x=>({name:x.city,latitude:x.latitude,longitude:x.longitude}));
const simplify=x=>({zip:x.zip,city:x.city||zipcodes.lookup(x.zip)?.city||'',latitude:+x.latitude.toFixed(5),longitude:+x.longitude.toFixed(5),rank:x.rank,status:x.status,verified:x.verified,reason:x.reason,nearby_capped:x.nearby_capped_centers,nearest_miles:x.nearest_searched_miles});
const data={prepared_at:new Date().toISOString(),origin:zipcodes.lookup('91506'),ready:ready.map(simplify),review:[],existing:existing.map(simplify),cities,counties:{type:'FeatureCollection',features:counties}};
fs.writeFileSync(folder+'/all-ready-zip-centers.txt',ready.map(x=>x.zip).join('\n')+'\n');
fs.writeFileSync(folder+'/full-scan-plan.json',JSON.stringify({prepared_at:data.prepared_at,ready,reference_review:[],removed_centers:removed,notes:['All 163 consistent-reference centers are included; 40 is no longer a limit.','Eight uncertain-coordinate centers were removed at user request; their surrounding coverage is not proven complete.','No searches are launched by this map builder.']} ,null,2));
fs.writeFileSync(folder+'/map-data.json',JSON.stringify(data));
const target='C:/Users/arthu/.codex/visualizations/2026/10/08/01a11b12-a155-7a82-8529-0819b88ad799/full-radius-scan-map.html';
const template=fs.readFileSync(folder+'/map-fragment-template.html','utf8');
fs.writeFileSync(target,template.replace('__MAP_DATA__',JSON.stringify(data).replace(/</g,'\\u003c')));
console.log(JSON.stringify({ready:ready.length,review:data.review.length,existing:existing.length,fragment_bytes:fs.statSync(target).size,path:target}));
db.close();
