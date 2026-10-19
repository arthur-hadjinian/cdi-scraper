const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const folder='ROUND-2-ENGLISH/scan-plan';
const plan=JSON.parse(fs.readFileSync(folder+'/expansion-plan-preview.json','utf8'));
const base=JSON.parse(fs.readFileSync(folder+'/map-data.json','utf8'));
const db=new DatabaseSync('ROUND-2-ENGLISH/data/agents.db',{readOnly:true});
const existing=db.prepare("SELECT zip,city,latitude,longitude,status FROM searches WHERE status IN ('complete','truncated')").all();
for(const line of fs.readFileSync('ROUND-2-ENGLISH/logs/location-checks.jsonl','utf8').trim().split(/\r?\n/)){const p=JSON.parse(line);const old=existing.find(k=>k.zip===p.zip);if(old&&p.status==='OK'){old.latitude=p.latitude;old.longitude=p.longitude;}}
const point=(p,i)=>({zip:p.input.replace(', CA',''),city:p.city,latitude:p.latitude,longitude:p.longitude,rank:i+1});
const data={...base,ready:plan.initial.map(point),review:plan.candidates.map(point),existing,cities:[...base.cities,{name:'Agua Dulce',latitude:34.4963443,longitude:-118.3261969},{name:'Mount Baldy',latitude:34.2363809,longitude:-117.6589752}]};
let template=fs.readFileSync(folder+'/map-fragment-template.html','utf8');
template=template.replaceAll('radius-scan-overview','expansion-scan-preview').replace('Full radius collection plan','Proposed next collection pass')
 .replace('163 ready centers',plan.initial.length+' initial searches · '+plan.candidates.length+' conditional follow-ups')
 .replace('328 already searched',existing.length+' previously searched centers')
 .replace('<span>○ Already searched</span>','<span><span style="color:var(--viz-series-2)">△</span> Conditional follow-up</span><span>○ Already searched</span>')
 .replace('> Ready</span>','> Initial search</span>').replace('Ready to scan','Proposed initial search').replace('Coordinate review needed','Conditional follow-up')
 .replace('50 miles around 91506 · planned centers, not agent locations · historical circle coverage is partly unverified','Awaiting approval · 50 miles around 91506 · centers, not agents · historical coverage partly unverified')
 .replace('__MAP_DATA__',JSON.stringify(data).replace(/</g,'\\u003c'));
const target='C:/Users/arthu/.codex/visualizations/2026/10/08/01a11b12-a155-7a82-8529-0819b88ad799/collection-expansion-preview.html';
fs.writeFileSync(target,template);db.close();console.log(target);
