import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
const db=new DatabaseSync('data/agents.db',{readOnly:true});
const since=new Date(Date.now()-3600000).toISOString();
const tableExists=(name:string)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
const checkpoint='scan-plan/cap-expansion-validation-state.json';
const validation=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):null;
const latest=readdirSync('logs').filter(p=>/^supervised-.*\.log$/.test(p)).sort((a,b)=>statSync('logs/'+b).mtimeMs-statSync('logs/'+a).mtimeMs)[0];
const supervisor=readFileSync('logs/supervisor.log','utf8').trim().split(/\r?\n/).slice(-4);
const report={checked_at:new Date().toISOString(),total:db.prepare('SELECT count(*) n FROM agents').get(),new_last_hour:db.prepare('SELECT count(*) n FROM agents WHERE created_at>=?').get(since),all_searches:db.prepare('SELECT status,count(*) n FROM searches GROUP BY status').all(),current:db.prepare("SELECT zip,city,pages_done,agents_seen,updated_at FROM searches WHERE status='in_progress'").all(),supervisor,recent_log:latest?readFileSync('logs/'+latest,'utf8').trim().split(/\r?\n/).slice(-8):[],
 expansion:tableExists('collection_expansion')?db.prepare('SELECT s.status,count(*) n FROM collection_expansion c JOIN searches s ON s.zip=c.child_id GROUP BY s.status').all():[],
 expansion_unique_additions:tableExists('collection_expansion')?db.prepare('SELECT count(*) n FROM agents WHERE first_zip IN (SELECT child_id FROM collection_expansion)').get():null,
 finished_last_hour:db.prepare("SELECT count(*) n FROM searches WHERE status IN ('complete','truncated') AND updated_at>=?").get(since),
 validation:validation?{status:validation.status,phase:validation.phase,initial_candidates:validation.initial_candidates?.length,checked_candidates:validation.results.length,verified_published:validation.results.filter((p:any)=>p.decision==='verified_published').length,decisions:validation.results.reduce((sum:any,p:any)=>{sum[p.decision]=(sum[p.decision]||0)+1;return sum;},{}),checked_legacy_parents:validation.parents.length,parent_total:validation.parent_total??null,last_updated:validation.updated_at,error:validation.error??null}:null};
console.log(JSON.stringify(report));db.close();
