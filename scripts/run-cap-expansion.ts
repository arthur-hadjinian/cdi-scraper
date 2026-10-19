import {chromium} from 'playwright';
import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openDb} from '../src/db.js';
import {milesBetween} from '../src/grid.js';
import {queueCollectionExpansion} from '../src/collection-expansion.js';
const folder='scan-plan';const checkpoint=folder+'/cap-expansion-validation-state.json';
const origin=createRequire(import.meta.url)('zipcodes').lookup('91506');
const approvalPath=folder+'/approved-expansion-plan.json';
const research=JSON.parse(readFileSync(folder+'/cap-midpoint-research-plan.json','utf8'));
const state:any=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{started_at:new Date().toISOString(),approved_by_user_at:new Date().toISOString(),status:'running',phase:'candidate_validation',initial_candidates:research.candidates,results:[],parents:[],max_candidate_inputs:150,max_new_centers:100};
const save=()=>{state.updated_at=new Date().toISOString();writeFileSync(checkpoint+'.tmp',JSON.stringify(state,null,2));renameSync(checkpoint+'.tmp',checkpoint);};
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const readChecks=()=>{const file='logs/location-checks.jsonl';const latest=new Map<string,any>();if(existsSync(file))for(const line of readFileSync(file,'utf8').trim().split(/\r?\n/)){try{const p=JSON.parse(line);if(p.status==='OK'&&Number.isFinite(p.latitude))latest.set(p.zip,p);}catch{}}return latest;};
function knownCenters(){const db=new DatabaseSync('data/agents.db',{readOnly:true});const rows=db.prepare('SELECT zip,latitude,longitude,status FROM searches').all() as any[];db.close();const latest=readChecks();for(const row of rows){const p=latest.get(row.zip);if(p){row.latitude=p.latitude;row.longitude=p.longitude;}}const plan=JSON.parse(readFileSync(approvalPath,'utf8'));for(const p of [...plan.initial,...plan.candidates])if(!rows.some(r=>r.zip===p.id))rows.push({...p,zip:p.id});return rows;}
async function publish(candidate:any,evidence:any){
  const approved=JSON.parse(readFileSync(approvalPath,'utf8'));
  const id='midpoint:'+candidate.id;
  if([...approved.initial,...approved.candidates].some((p:any)=>p.id===id))return 'already_reserved';
  const offset=milesBetween(candidate,evidence);const distance=milesBetween(origin,evidence);
  if(evidence.status!=='OK'||evidence.country!=='US'||evidence.state!=='CA'||!Number.isFinite(distance))return 'invalid_location';
  if(candidate.kind==='postal_reference'&&evidence.postal!==candidate.zip)return 'postal_mismatch';
  if(!evidence.locality&&!evidence.postal)return 'not_a_specific_location';
  if(distance>50)return 'outside_radius';
  if(offset>5)return 'ambiguous_or_displaced_place';
  const nearest=Math.min(...knownCenters().map(p=>milesBetween(p,evidence)));
  if(nearest<approved.minSpacingMiles)return 'duplicate_or_too_close';
  const newCount=approved.candidates.filter((p:any)=>p.id.startsWith('midpoint:')).length;
  if(newCount>=state.max_new_centers)return 'verified_center_limit';
  const p={id,input:candidate.input,city:evidence.formatted,latitude:evidence.latitude,longitude:evidence.longitude,distanceMiles:distance,kind:'verified_midpoint_candidate',sourceZip:evidence.postal||null,verified_at:new Date().toISOString(),reference_source:candidate.kind,planning_score:candidate.score,example_pair:candidate.example_pair};
  approved.candidates.push(p);approved.broader_expansion_approved_at=state.approved_by_user_at;
  writeFileSync(approvalPath+'.tmp',JSON.stringify(approved,null,2));renameSync(approvalPath+'.tmp',approvalPath);
  // Retry brief database contention without issuing another search request.
  for(let attempt=0;attempt<3;attempt++){
    const db=openDb();try{const added=queueCollectionExpansion(db);state.queued=(state.queued||0)+added;return 'verified_published';}
    catch(error){if(attempt===2)throw error;await sleep(5000);}finally{db.close();}
  }
  return 'verified_published';
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage();
  await page.goto('https://interactive.web.insurance.ca.gov/apex_extprd/f?p=119:1::::::',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>typeof (window as any).google?.maps?.Geocoder==='function',null,{timeout:45000});
  async function locate(input:string):Promise<any>{
    if(existsSync('STOP-SUPERVISOR')||existsSync('STOP-CAP-VALIDATION')){state.status='paused';save();throw new Error('Validation paused by stop marker');}
    let evidence:any;
    for(let attempt=0;attempt<2;attempt++){
      evidence=await page.evaluate(new Function('input',`return new Promise(resolve=>{
        const timer=setTimeout(()=>resolve({status:'LOCAL_TIMEOUT'}),20000);
        const google=window.google;
        new google.maps.Geocoder().geocode({address:input},(values,status)=>{
          clearTimeout(timer);const v=values?.[0];const component=(type)=>v?.address_components?.find((c)=>c.types.includes(type))?.short_name;
          resolve({status,formatted:v?.formatted_address,country:component('country'),state:component('administrative_area_level_1'),postal:component('postal_code'),locality:component('locality')||component('sublocality')||component('neighborhood'),latitude:v?.geometry.location.lat(),longitude:v?.geometry.location.lng()});
        });
      });`) as (input:string)=>Promise<any>,input);
      if(['OVER_QUERY_LIMIT','REQUEST_DENIED'].includes(evidence.status))throw new Error('Geocoder '+evidence.status+'; validation stopped for attention');
      if(!['LOCAL_TIMEOUT','UNKNOWN_ERROR'].includes(evidence.status))break;
      await sleep(10000);
    }
    await sleep(5000);return evidence;
  }
  async function validateCandidates(candidates:any[]){
    for(const candidate of candidates){
      if(state.results.some((r:any)=>r.id===candidate.id))continue;
      if(state.results.length>=state.max_candidate_inputs)break;
      const evidence=await locate(candidate.input);
      const decision=await publish(candidate,evidence);
      state.results.push({id:candidate.id,input:candidate.input,decision,evidence,checked_at:new Date().toISOString()});
      save();console.log(`Candidates ${state.results.length}: ${candidate.input} -> ${decision}`);
    }
  }
  state.status='running';state.phase='candidate_validation';save();await validateCandidates(state.initial_candidates);
  state.phase='legacy_parent_verification';save();
  const db=new DatabaseSync('data/agents.db',{readOnly:true});
  const caps=db.prepare("SELECT zip,latitude,longitude FROM searches WHERE status='truncated'").all() as any[];db.close();
  const actual=readChecks();
  const parents=caps.filter(p=>!actual.has(p.zip)&&/^\d{5}$/.test(p.zip));state.parent_total=parents.length;save();
  for(const parent of parents){
    if(state.parents.some((p:any)=>p.zip===parent.zip))continue;
    const evidence=await locate(parent.zip+', CA');
    const offset=milesBetween(parent,evidence);const distance=milesBetween(origin,evidence);
    const usable=evidence.status==='OK'&&evidence.country==='US'&&evidence.state==='CA'&&evidence.postal===parent.zip&&Number.isFinite(offset)&&offset<=5&&distance<=50;
    state.parents.push({zip:parent.zip,input:parent.zip+', CA',usable,offset_miles:offset,evidence,checked_at:new Date().toISOString(),basis:'Current postal-input verification only; not proof of the historical submitted search center.'});
    writeFileSync(folder+'/cap-parent-geocoder-checks.json',JSON.stringify(state.parents,null,2));save();console.log(`Parents ${state.parents.length}/${state.parent_total}: ${parent.zip} -> ${usable?'usable_current_reference':'unresolved_reference'}`);
  }
  state.phase='refreshed_midpoint_validation';save();
  const replanning=spawnSync(process.execPath,['--experimental-sqlite','--disable-warning=ExperimentalWarning','--import','tsx','scripts/plan-cap-midpoints.ts'],{cwd:path.resolve('..'),encoding:'utf8',timeout:120000});
  if(replanning.status!==0)throw new Error('Midpoint replanning failed: '+replanning.stderr);
  const refreshed=JSON.parse(readFileSync(folder+'/cap-midpoint-research-plan.json','utf8'));
  await validateCandidates(refreshed.candidates);
  state.status='complete';state.phase='complete';state.completed_at=new Date().toISOString();save();
  console.log(JSON.stringify({status:state.status,checked_candidates:state.results.length,verified_candidates:state.results.filter((p:any)=>p.decision==='verified_published').length,checked_legacy_parents:state.parents.length,queued:state.queued||0}));
}catch(error){if(state.status!=='paused')state.status='needs_attention';state.error=String(error);save();console.error(error);process.exitCode=1;}
finally{await browser.close();}
