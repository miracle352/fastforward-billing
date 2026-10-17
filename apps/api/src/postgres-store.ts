import {Pool,type PoolClient} from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {ArtifactRecord,RunRecord,RunEventRecord,Scenario} from '@fastforward/contracts';
import {StoreError,type Lease,type ClaimedRun,type SessionRecord,type EventInput} from './store.js';

const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const now=()=>new Date().toISOString();
const terminal=new Set(['passed','failed','blocked','cancelled','interrupted']);
type Row=Record<string,unknown>;
/** Persistent Postgres implementation. A transaction-scoped lock preserves SQLite's single-writer admission semantics. */
export class PostgresRunStore {
 readonly dbPath='postgres';
 private readonly pool:Pool;
 private readonly context=new AsyncLocalStorage<PoolClient>();
 private constructor(connectionString:string,private readonly namespace:string){
  let url:URL;try{url=new URL(connectionString);}catch{throw Error('A verified Neon database URL is required.');}
  if(!/^fastforward(?:_[a-f0-9]{12})?$/.test(namespace))throw Error('Invalid database namespace.');
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname.endsWith('.neon.tech'))throw Error('A verified Neon database URL is required.');
  for(const option of ['sslmode','sslcert','sslkey','sslrootcert','sslpassword','sslnegotiation'])url.searchParams.delete(option);
  this.pool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},enableChannelBinding:true,max:2,
   connectionTimeoutMillis:12000,query_timeout:15000,statement_timeout:15000,idleTimeoutMillis:10000,allowExitOnIdle:true});
  this.pool.on('error',()=>{/* Provider exceptions must never enter diagnostic output. */});
 }
 static async open(url:string,namespace='fastforward'){
  const store=new PostgresRunStore(url,namespace);
  try{await store.atomic(async()=>{await store.query(`CREATE SCHEMA IF NOT EXISTS "${namespace}"`);await store.query(`
   CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,
    record TEXT NOT NULL,worker_id TEXT,lease_token INTEGER NOT NULL DEFAULT 0,lease_expires TEXT);
   CREATE INDEX IF NOT EXISTS runs_status ON runs(status,created_at);
   CREATE INDEX IF NOT EXISTS runs_owner ON runs(owner_id,created_at);
   CREATE TABLE IF NOT EXISTS run_requests(owner_hash TEXT NOT NULL,key_hash TEXT NOT NULL,input_hash TEXT NOT NULL,
    run_id TEXT NOT NULL REFERENCES runs(id),PRIMARY KEY(owner_hash,key_hash));
   CREATE TABLE IF NOT EXISTS events(id BIGSERIAL PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),
    created_at TEXT NOT NULL,kind TEXT NOT NULL,message TEXT NOT NULL,data TEXT);
   CREATE INDEX IF NOT EXISTS events_run ON events(run_id,id);
   CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),content TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS metadata(run_id TEXT NOT NULL REFERENCES runs(id),key TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(run_id,key));
  `);});return store;}catch{await store.close();throw Error('Persistent database setup failed. Private connection details were suppressed.');}
 }
 async close(){await this.pool.end();}
 private async query(sql:string,values:unknown[]=[]):Promise<Row[]>{const qualified=sql.replace(/\b(sessions|runs|run_requests|events|artifacts|metadata)\b/g,table=>'"'+this.namespace+'"."'+table+'"');return(await(this.context.getStore()??this.pool).query(qualified,values)).rows;}
 private async atomic<T>(action:()=>Promise<T>):Promise<T>{
  if(this.context.getStore())return action();
  const client=await this.pool.connect();
  try{return await this.context.run(client,async()=>{await client.query('BEGIN');try{
   await client.query('SELECT pg_advisory_xact_lock(1179014224)');const value=await action();await client.query('COMMIT');return value;
  }catch(error){await client.query('ROLLBACK');throw error;}});}finally{client.release();}
 }
 private async row(id:string){return(await this.query('SELECT * FROM runs WHERE id=$1',[id]))[0];}
 private parse(row:Row):RunRecord{return JSON.parse(String(row.record));}
 private async write(run:RunRecord){await this.query('UPDATE runs SET status=$1,record=$2 WHERE id=$3',[run.status,JSON.stringify(run),run.id]);}
 private async assertLease(id:string,lease:Lease){
  const row=await this.row(id);
  if(!row||row.worker_id!==lease.workerId||Number(row.lease_token)!==lease.leaseToken||!row.lease_expires||String(row.lease_expires)<=now()||terminal.has(String(row.status)))
   throw new StoreError('LEASE_LOST','This worker no longer owns the job.');return row;
 }
 private async insertEvent(id:string,event:EventInput):Promise<RunEventRecord>{
  const createdAt=now();const rows=await this.query('INSERT INTO events(run_id,created_at,kind,message,data) VALUES($1,$2,$3,$4,$5) RETURNING id',
   [id,createdAt,event.kind,event.message,event.data==null?null:JSON.stringify(event.data)]);
  return{id:Number(rows[0].id),runId:id,createdAt,kind:event.kind,message:event.message,data:event.data??null};
 }
 async createSession():Promise<SessionRecord>{
  const id=randomBytes(32).toString('hex'),csrfToken=randomBytes(32).toString('hex'),expiresAt=new Date(Date.now()+86400000).toISOString();
  await this.query('INSERT INTO sessions(id,csrf,expires_at) VALUES($1,$2,$3)',[hash(id),csrfToken,expiresAt]);return{id,csrfToken,expiresAt};
 }
 async getSession(id:string):Promise<SessionRecord|null>{
  if(!/^[a-f0-9]{64}$/.test(id))return null;const row=(await this.query('SELECT * FROM sessions WHERE id=$1 AND expires_at>$2',[hash(id),now()]))[0];
  return row?{id,csrfToken:String(row.csrf),expiresAt:String(row.expires_at)}:null;
 }
 async listRuns(ownerId:string){return(await this.query('SELECT * FROM runs WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 50',[hash(ownerId)])).map(r=>this.parse(r));}
 async getRun(id:string){const row=await this.row(id);return row?this.parse(row):null;}
 async getRunForOwner(id:string,ownerId:string){const row=await this.row(id);return row?.owner_id===hash(ownerId)?this.parse(row):null;}
 async getActiveRun(){const row=(await this.query("SELECT * FROM runs WHERE status NOT IN ('passed','failed','blocked','cancelled','interrupted') ORDER BY created_at LIMIT 1"))[0];return row?this.parse(row):null;}
 async getRunForRequest(ownerId:string,key:string,scenarios:Scenario[]){
  const row=(await this.query('SELECT * FROM run_requests WHERE owner_hash=$1 AND key_hash=$2',[hash(ownerId),hash(key)]))[0];if(!row)return null;
  if(row.input_hash!==hash(JSON.stringify([...new Set(scenarios)].sort())))throw new StoreError('IDEMPOTENCY_CONFLICT','This request key was already used for different scenarios.');
  return this.getRunForOwner(String(row.run_id),ownerId);
 }
 async createRun(ownerId:string,scenarios:Scenario[],limits:{globalDailyLimit?:number;ownerDailyLimit?:number;idempotencyKey?:string}={}){
  return this.atomic(async()=>{
   if(limits.idempotencyKey){const existing=await this.getRunForRequest(ownerId,limits.idempotencyKey,scenarios);if(existing)return existing;}
   const cutoff=new Date(Date.now()-86400000).toISOString();
   const global=Number((await this.query('SELECT COUNT(*) AS count FROM runs WHERE created_at>$1',[cutoff]))[0].count);
   if(global>=(limits.globalDailyLimit??6))throw new StoreError('GLOBAL_LIMIT','The shared daily demonstration allowance has been used. Saved results remain available.');
   const owned=Number((await this.query('SELECT COUNT(*) AS count FROM runs WHERE created_at>$1 AND owner_id=$2',[cutoff,hash(ownerId)]))[0].count);
   if(owned>=(limits.ownerDailyLimit??2))throw new StoreError('OWNER_LIMIT','Your daily demonstration allowance has been used. Saved results remain available.');
   if((await this.getCleanupPending()).length)throw new StoreError('CLEANUP_PENDING','A previous test environment needs confirmed cleanup before another test can start.');
   if(await this.getActiveRun())throw new StoreError('BUSY','Another test is using the shared sandbox. Please try again after it finishes.');
   const timestamp=now();const run:RunRecord={id:randomUUID(),status:'queued',phase:'Waiting for worker',createdAt:timestamp,updatedAt:timestamp,attempt:0,maxAttempts:3,
    scenarios:[...new Set(scenarios)],checks:[],artifacts:[],summary:null,error:null,sandboxId:null,previewUrl:null,testMode:true,policy:'active_or_trialing_no_grace'};
   await this.query('INSERT INTO runs(id,owner_id,status,created_at,record) VALUES($1,$2,$3,$4,$5)',[run.id,hash(ownerId),run.status,timestamp,JSON.stringify(run)]);
   if(limits.idempotencyKey)await this.query('INSERT INTO run_requests(owner_hash,key_hash,input_hash,run_id) VALUES($1,$2,$3,$4)',[hash(ownerId),hash(limits.idempotencyKey),hash(JSON.stringify([...new Set(scenarios)].sort())),run.id]);
   await this.insertEvent(run.id,{kind:'status',message:'Test queued. No success has been observed yet.',data:{status:'queued'}});return run;
  });
 }
 async getEvents(runId:string,after=0):Promise<RunEventRecord[]>{return(await this.query('SELECT * FROM events WHERE run_id=$1 AND id>$2 ORDER BY id LIMIT 200',[runId,after])).map(row=>({id:Number(row.id),runId:String(row.run_id),createdAt:String(row.created_at),kind:String(row.kind) as RunEventRecord['kind'],message:String(row.message),data:row.data==null?null:JSON.parse(String(row.data))}));}
 async claimNext(workerId:string,leaseMs=60000):Promise<ClaimedRun|null>{return this.atomic(async()=>{
  if((await this.getCleanupPending()).length)return null;const row=(await this.query("SELECT * FROM runs WHERE status='queued' ORDER BY created_at LIMIT 1"))[0];if(!row)return null;
  const run=this.parse(row),leaseToken=Number(row.lease_token)+1;run.status='provisioning';run.phase='Preparing real test environments';run.updatedAt=now();
  await this.query('UPDATE runs SET worker_id=$1,lease_token=$2,lease_expires=$3 WHERE id=$4',[workerId,leaseToken,new Date(Date.now()+leaseMs).toISOString(),run.id]);await this.write(run);
  await this.insertEvent(run.id,{kind:'status',message:run.phase,data:{status:'provisioning'}});return{run,lease:{workerId,leaseToken}};
 });}
 async renewLease(runId:string,lease:Lease,leaseMs=60000){await this.atomic(async()=>{await this.assertLease(runId,lease);await this.query('UPDATE runs SET lease_expires=$1 WHERE id=$2',[new Date(Date.now()+leaseMs).toISOString(),runId]);});}
 async updateRun(runId:string,lease:Lease,patch:Partial<RunRecord>){return this.atomic(async()=>{
  const existing=this.parse(await this.assertLease(runId,lease));if(existing.status==='cancel_requested'&&patch.status&&patch.status!=='cancel_requested')throw new StoreError('CANCEL_REQUESTED','Cancellation is pending; a late result cannot replace it.');
  const updated:RunRecord={...existing,...patch,id:existing.id,createdAt:existing.createdAt,scenarios:existing.scenarios,policy:existing.policy,testMode:true,updatedAt:now()};await this.write(updated);
  if(patch.status&&patch.status!==existing.status)await this.insertEvent(runId,{kind:'status',message:updated.phase,data:{status:updated.status}});return updated;
 });}
 async finishRun(runId:string,lease:Lease,status:'passed'|'failed'|'blocked'|'interrupted',summary?:string,error?:string){return this.updateRun(runId,lease,{status,phase:status==='passed'?'Supported checks passed':'Test stopped',summary:summary??null,error:error??null});}
 async appendEvent(runId:string,event:EventInput,lease:Lease){return this.atomic(async()=>{await this.assertLease(runId,lease);return this.insertEvent(runId,event);});}
 async requestCancel(ownerId:string,runId:string){return this.atomic(async()=>{
  const run=await this.getRunForOwner(runId,ownerId);if(!run)return null;if(terminal.has(run.status)||run.status==='cancel_requested')return run;
  if(run.status!=='queued')await this.query("INSERT INTO metadata(run_id,key,value) VALUES($1,'cancellation_requested','true') ON CONFLICT(run_id,key) DO UPDATE SET value='true'",[runId]);
  run.status=run.status==='queued'?'cancelled':'cancel_requested';run.phase=run.status==='cancelled'?'Cancelled before execution':'Cancellation requested; waiting for cleanup';run.updatedAt=now();await this.write(run);await this.insertEvent(runId,{kind:'cleanup',message:run.phase});return run;
 });}
 async completeCancellation(runId:string,lease:Lease){return this.atomic(async()=>{
  const run=this.parse(await this.assertLease(runId,lease));if(run.status!=='cancel_requested')throw new StoreError('NOT_CANCELLING','No cancellation is pending.');if(await this.getMetadata(runId,'cleanup_pending')===true)throw new StoreError('CLEANUP_PENDING','Cleanup must be reconciled before cancellation is complete.');
  run.status='cancelled';run.phase='Cancelled; worker confirmed cleanup';run.updatedAt=now();await this.write(run);await this.insertEvent(runId,{kind:'cleanup',message:run.phase});return run;
 });}
 async recoverExpiredLeases(){return this.atomic(async()=>{
  const rows=await this.query("SELECT * FROM runs WHERE status NOT IN ('queued','passed','failed','blocked','cancelled','interrupted') AND lease_expires<=$1",[now()]);const runs:RunRecord[]=[];
  for(const row of rows){const run=this.parse(row);run.status='interrupted';run.phase='Worker interrupted; cleanup requires reconciliation';run.error='Worker lease expired. Saved resource identifiers are retained for cleanup; success was not assumed.';run.updatedAt=now();await this.write(run);
   await this.query('UPDATE runs SET lease_token=lease_token+1,worker_id=NULL,lease_expires=NULL WHERE id=$1',[run.id]);await this.query("INSERT INTO metadata(run_id,key,value) VALUES($1,'cleanup_pending','true') ON CONFLICT(run_id,key) DO UPDATE SET value='true'",[run.id]);await this.insertEvent(run.id,{kind:'error',message:run.error});runs.push(run);
  }return runs;
 });}
 async getCleanupPending(){return(await this.query("SELECT r.* FROM runs r JOIN metadata m ON m.run_id=r.id WHERE m.key='cleanup_pending' AND m.value='true'")).map(row=>this.parse(row));}
 async confirmCleanup(runId:string,resources?:Array<{kind:string;id:string;cleaned?:boolean}>){await this.atomic(async()=>{
  const run=await this.getRun(runId);if(!run||!terminal.has(run.status))throw new StoreError('NOT_TERMINAL','Recovery cleanup can only be confirmed for a stopped job.');if(await this.getMetadata(runId,'cleanup_pending')!==true)return;
  const intent=await this.getMetadata<{kind:string;index:number}>(runId,'allocation_pending');
  if(intent&&(!resources||!(resources[intent.index]?.kind===intent.kind||(intent.kind==='process'&&resources.some(r=>r.kind==='sandbox'&&r.cleaned)))))throw new StoreError('ALLOCATION_UNCERTAIN','A provider creation request still requires resource reconciliation.');
  if(resources?.some(r=>!r.cleaned))throw new StoreError('CLEANUP_PENDING','Every tracked resource must be confirmed clean.');
  if(resources)await this.query("INSERT INTO metadata(run_id,key,value) VALUES($1,'resources',$2) ON CONFLICT(run_id,key) DO UPDATE SET value=excluded.value",[runId,JSON.stringify(resources)]);
  await this.query("UPDATE metadata SET value='null' WHERE run_id=$1 AND key='allocation_pending'",[runId]);await this.query("UPDATE metadata SET value='false' WHERE run_id=$1 AND key='cleanup_pending'",[runId]);
  if(await this.getMetadata(runId,'cancellation_requested')===true){run.status='cancelled';run.phase='Cancelled; recovery confirmed cleanup';run.updatedAt=now();await this.write(run);}
  await this.insertEvent(runId,{kind:'cleanup',message:'Trusted recovery worker confirmed previous environment cleanup.',data:{status:run.status}});
 });}
 async recordRecoveredResource(runId:string,expected:{kind:string;index:number},resource:{kind:string;id:string}){await this.atomic(async()=>{
  const run=await this.getRun(runId),intent=await this.getMetadata<{kind:string;index:number}>(runId,'allocation_pending'),resources=await this.getMetadata<Array<{kind:string;id:string;cleaned?:boolean}>>(runId,'resources');
  if(!run||!terminal.has(run.status)||await this.getMetadata(runId,'cleanup_pending')!==true)throw new StoreError('RECOVERY_NOT_STOPPED','Only a stopped cleanup-blocked job may receive a recovery receipt.');
  if(!intent||intent.kind!==expected.kind||intent.index!==expected.index||resource.kind!==intent.kind||!resources||resources.length!==intent.index||resources.some(r=>r.kind===resource.kind&&r.id===resource.id))throw new StoreError('RECOVERY_CONFLICT','Recovery intent changed or the receipt conflicts with retained resources.');
  resources.push({kind:resource.kind,id:resource.id});await this.query("UPDATE metadata SET value=$1 WHERE run_id=$2 AND key='resources'",[JSON.stringify(resources),runId]);await this.insertEvent(runId,{kind:'cleanup',message:'Operator recorded a provider-verified allocation receipt; cleanup remains pending.'});
 });}
 async assertRunLease(runId:string,lease:Lease){await this.assertLease(runId,lease);}
 async setMetadata(runId:string,key:string,value:unknown,lease:Lease){await this.atomic(async()=>{await this.assertLease(runId,lease);await this.query('INSERT INTO metadata(run_id,key,value) VALUES($1,$2,$3) ON CONFLICT(run_id,key) DO UPDATE SET value=excluded.value',[runId,key,JSON.stringify(value)]);});}
 async getMetadata<T=unknown>(runId:string,key:string):Promise<T|null>{const row=(await this.query('SELECT value FROM metadata WHERE run_id=$1 AND key=$2',[runId,key]))[0];return row?JSON.parse(String(row.value)) as T:null;}
 async addArtifact(runId:string,lease:Lease,input:{kind:ArtifactRecord['kind'];name:string;content:string}){return this.atomic(async()=>{
  const run=this.parse(await this.assertLease(runId,lease));if(Buffer.byteLength(input.content)>512000)throw new StoreError('ARTIFACT_TOO_LARGE','Artifact exceeds the bounded storage allowance.');const id=randomUUID();
  const artifact:ArtifactRecord={id,kind:input.kind,name:input.name.replace(/[\r\n"\\/]/g,'_'),sha256:hash(input.content),createdAt:now(),downloadUrl:`/api/runs/${runId}/artifacts/${id}`};await this.query('INSERT INTO artifacts(id,run_id,content) VALUES($1,$2,$3)',[id,runId,input.content]);run.artifacts.push(artifact);run.updatedAt=now();await this.write(run);return artifact;
 });}
 async getArtifactContent(ownerId:string,runId:string,artifactId:string){const run=await this.getRunForOwner(runId,ownerId),artifact=run?.artifacts.find(a=>a.id===artifactId);if(!artifact)return null;const row=(await this.query('SELECT content FROM artifacts WHERE id=$1 AND run_id=$2',[artifactId,runId]))[0];return row?{artifact,content:String(row.content)}:null;}
 /** One-time private migration; never merge into an already used database. */
 async importLegacy(snapshot:Record<string,Row[]>){return this.atomic(async()=>{
  const fields:Record<string,string[]>={sessions:['id','csrf','expires_at'],runs:['id','owner_id','status','created_at','record','worker_id','lease_token','lease_expires'],run_requests:['owner_hash','key_hash','input_hash','run_id'],events:['id','run_id','created_at','kind','message','data'],artifacts:['id','run_id','content'],metadata:['run_id','key','value']};
  for(const table of Object.keys(fields))if(Number((await this.query('SELECT count(*) AS n FROM '+table))[0].n)!==0)throw new StoreError('MIGRATION_NOT_EMPTY','The destination already contains data; migration refused.');
  const counts:Record<string,number>={};
  for(const [table,columns]of Object.entries(fields)){
   const rows=snapshot[table]??[];for(const row of rows)await this.query('INSERT INTO '+table+'('+columns.join(',')+') VALUES('+columns.map((_,i)=>'$'+(i+1)).join(',')+')',columns.map(c=>row[c]??null));counts[table]=rows.length;
  }
  const maximum=Number((await this.query('SELECT COALESCE(MAX(id),0) AS n FROM events'))[0].n);
  await(this.context.getStore()!).query('SELECT setval($1::regclass,$2,$3)',[this.namespace+'.events_id_seq',maximum||1,maximum>0]);return counts;
 });}

}
