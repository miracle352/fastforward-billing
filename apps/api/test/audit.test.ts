import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { RunStore, StoreError } from '../src/store.js';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config.js';
import { createReadinessReader } from '../src/readiness.js';
import { executeRun, reconcileStoppedRun, allocationUncertain, type Resource } from '../src/worker.js';
import { CreateOSProvider, StripeBillingProvider, GroqCodeProvider, ProviderError } from '../src/providers/index.js';
import type { ReadinessRecord, ProviderReadinessRecord } from '@fastforward/contracts';
import type { Sandbox } from '@nodeops-createos/sandbox';

const ready:ReadinessRecord={ready:true,providers:[],blockers:[],testMode:true,activeRunId:null};
const config=()=>loadConfig({STRIPE_SECRET_KEY:'sk_test_synthetic123',STRIPE_READONLY_KEY:'rk_test_synthetic123',
  STRIPE_READONLY_CONFIRMED:'true',CREATEOS_SANDBOX_API_KEY:'synthetic-sandbox-key',GROQ_API_KEY:'synthetic-groq-key',
  MAX_MODEL_CALLS_PER_RUN:'3',MODEL_MAX_OUTPUT_TOKENS:'3000',MAX_RUNS_PER_DAY:'6',RUN_TIMEOUT_SECONDS:'30'});
const isCode=(code:string)=>(error:unknown)=>error instanceof StoreError&&error.code===code;

test('owner-scoped request keys survive restart and replay completed jobs even when readiness and allowance fail',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-idempotency-'));const path=join(dir,'store.sqlite');let store=new RunStore(path);
 let app=await createServer({store,readiness:()=>ready,globalDailyLimit:1});
 try{
  const establish=await app.inject('/api/session');const visitor=establish.cookies[0].value;
  const headers={cookie:`ff_visitor=${visitor}`,'x-csrf-token':establish.json().csrfToken,'idempotency-key':'deliberate-start-0001'};
  const simultaneous=await Promise.all(Array.from({length:3},()=>app.inject({method:'POST',url:'/api/runs',headers,payload:{scenarios:['healthy_renewal','trial_payment_failure']}})));
  assert.ok(simultaneous.every(response=>response.statusCode===202));
  assert.equal(new Set(simultaneous.map(response=>response.json().run.id)).size,1);
  const first=simultaneous[0];
  assert.equal(first.statusCode,202);const id=first.json().run.id;
  const duplicate=await app.inject({method:'POST',url:'/api/runs',headers,payload:{scenarios:['trial_payment_failure','healthy_renewal']}});
  assert.equal(duplicate.statusCode,202);assert.equal(duplicate.json().run.id,id);
  assert.equal(store.listRuns(visitor).length,1);
  const other=store.createSession();assert.equal(store.getRunForRequest(other.id,'deliberate-start-0001',['healthy_renewal','trial_payment_failure']),null);
  assert.equal((await app.inject({method:'POST',url:'/api/runs',headers,payload:{scenarios:['healthy_renewal']}})).statusCode,409);
  assert.equal((await app.inject({method:'POST',url:'/api/runs',headers:{...headers,'idempotency-key':'bad key'},payload:{}})).statusCode,400);
  store.requestCancel(visitor,id);await app.close();store.close();store=new RunStore(path);
  app=await createServer({store,readiness:()=>({...ready,ready:false,blockers:['Provider unavailable']}),globalDailyLimit:0});
  const replay=await app.inject({method:'POST',url:'/api/runs',headers,payload:{scenarios:['healthy_renewal','trial_payment_failure']}});
  assert.equal(replay.statusCode,202);assert.equal(replay.json().run.id,id);assert.equal(replay.json().run.status,'cancelled');
  assert.equal(store.getEvents(id).filter(e=>e.message.startsWith('Test queued')).length,1);
  assert.equal((await app.inject({method:'POST',url:'/api/runs',headers:{...headers,'idempotency-key':'different-start-0002'},payload:{}})).statusCode,503);
 }finally{await app.close();store.close();rmSync(dir,{recursive:true,force:true});}
});

test('queued cancellation is terminal, owned, repeatable and never reaches a worker',async()=>{
 const store=new RunStore(':memory:');const app=await createServer({store,readiness:()=>ready});
 try{
  const session=await app.inject('/api/session');const cookie=`ff_visitor=${session.cookies[0].value}`;
  const headers={cookie,'x-csrf-token':session.json().csrfToken};
  const other=await app.inject('/api/session');const otherHeaders={cookie:`ff_visitor=${other.cookies[0].value}`,'x-csrf-token':other.json().csrfToken};
  const created=await app.inject({method:'POST',url:'/api/runs',headers,payload:{}});const id=created.json().run.id;
  assert.equal((await app.inject({method:'POST',url:`/api/runs/${id}/cancel`,headers:otherHeaders})).statusCode,404);
  for(let i=0;i<2;i++)assert.equal((await app.inject({method:'POST',url:`/api/runs/${id}/cancel`,headers})).json().run.status,'cancelled');
  assert.equal(store.claimNext('never-executes'),null);assert.equal(store.getEvents(id).filter(e=>e.kind==='cleanup').length,1);
 }finally{await app.close();store.close();}
});

test('cancellation survives lease expiry; failed cleanup blocks new jobs until recovery persists proof',async()=>{
 const store=new RunStore(':memory:');
 try{
  const owner=store.createSession();const run=store.createRun(owner.id,['healthy_renewal']);const claim=store.claimNext('dead-worker',100)!;
  const resources:Resource[]=[{kind:'clock',id:'clock-test'}];store.setMetadata(run.id,'resources',resources,claim.lease);
  store.requestCancel(owner.id,run.id);store.setMetadata(run.id,'cleanup_pending',true,claim.lease);
  assert.throws(()=>store.completeCancellation(run.id,claim.lease),isCode('CLEANUP_PENDING'));
  assert.equal(await reconcileStoppedRun(store,store.getRun(run.id)!,{} as StripeBillingProvider,{} as CreateOSProvider),false);
  await delay(125);store.recoverExpiredLeases();
  let unavailable=true;
  const stripe={controller:{testHelpers:{testClocks:{del:async()=>{if(unavailable)throw Error('offline');return{deleted:true};}}}}} as unknown as StripeBillingProvider;
  assert.equal(await reconcileStoppedRun(store,store.getRun(run.id)!,stripe,{} as CreateOSProvider),false);
  assert.throws(()=>store.createRun(owner.id,['healthy_renewal']),isCode('CLEANUP_PENDING'));
  assert.throws(()=>store.renewLease(run.id,claim.lease),isCode('LEASE_LOST'));
  unavailable=false;assert.equal(await reconcileStoppedRun(store,store.getRun(run.id)!,stripe,{} as CreateOSProvider),true);
  assert.equal(store.getRun(run.id)?.status,'cancelled');assert.equal(store.getCleanupPending().length,0);
  assert.equal(store.getMetadata<Resource[]>(run.id,'resources')?.[0].cleaned,true);
  assert.ok(store.createRun(owner.id,['healthy_renewal']));
 }finally{store.close();}
});

test('unknown provider allocation and legacy missing metadata never reopen the spending gate',async()=>{
 const store=new RunStore(':memory:');
 try{
  const owner=store.createSession();const run=store.createRun(owner.id,['healthy_renewal']);const claim=store.claimNext('worker',100)!;
  store.setMetadata(run.id,'resources',[],claim.lease);store.setMetadata(run.id,'allocation_pending',{kind:'webhook',index:0},claim.lease);
  await delay(125);store.recoverExpiredLeases();
  assert.equal(await reconcileStoppedRun(store,store.getRun(run.id)!,{} as StripeBillingProvider,{} as CreateOSProvider),false);
  assert.throws(()=>store.confirmCleanup(run.id,[]),isCode('ALLOCATION_UNCERTAIN'));
  assert.throws(()=>store.createRun(owner.id,['healthy_renewal']),isCode('CLEANUP_PENDING'));
  assert.equal(allocationUncertain([{kind:'webhook',id:'known',cleaned:true}],{kind:'webhook',index:0}),false);
  assert.equal(allocationUncertain([{kind:'sandbox',id:'destroyed',cleaned:true}],{kind:'process',index:1}),false);
  assert.equal(allocationUncertain([],{kind:'sandbox',index:0}),true);
 }finally{store.close();}
 const legacy=new RunStore(':memory:');try{
  const owner=legacy.createSession();const run=legacy.createRun(owner.id,['healthy_renewal']);legacy.claimNext('legacy',1);await delay(5);legacy.recoverExpiredLeases();
  assert.equal(await reconcileStoppedRun(legacy,legacy.getRun(run.id)!,{} as StripeBillingProvider,{} as CreateOSProvider),false);
  assert.equal(legacy.getCleanupPending().length,1);
 }finally{legacy.close();}
});

test('provider transport ambiguity interrupts safely; definite sandbox rejection blocks without false success',async()=>{
 const generation=mock.method(GroqCodeProvider.prototype,'generateRepair',async()=>{throw Error('Generation must not happen');});
 try{
  for(const code of ['REQUEST_FAILED','HTTP_400']){
   const store=new RunStore(':memory:');const creation=mock.method(CreateOSProvider.prototype,'createRunSandbox',async()=>{throw new ProviderError('createos',code,'Synthetic provider failure');});
   try{
    const owner=store.createSession();const run=store.createRun(owner.id,['healthy_renewal']);const claim=store.claimNext('worker')!;
    await executeRun(config(),store,claim);
    assert.equal(store.getRun(run.id)?.status,code==='REQUEST_FAILED'?'interrupted':'blocked');
    assert.equal(store.getCleanupPending().length,code==='REQUEST_FAILED'?1:0);
    assert.equal(store.getEvents(run.id).some(e=>e.message==='Supported checks passed'),false);
    assert.deepEqual(store.getEvents(run.id).find(e=>e.kind==='status'&&e.data?.status==='provisioning')?.data,{status:'provisioning'});
   }finally{creation.mock.restore();store.close();}
  }
  assert.equal(generation.mock.callCount(),0);
 }finally{generation.mock.restore();}
});

test('cancellation arriving after a sandbox receipt prevents generation and confirms sandbox cleanup',async()=>{
 const store=new RunStore(':memory:');const owner=store.createSession();const run=store.createRun(owner.id,['healthy_renewal']);const claim=store.claimNext('worker')!;
 const box={id:'synthetic-sandbox'} as Sandbox;
 const creation=mock.method(CreateOSProvider.prototype,'createRunSandbox',async(...[_id,_env,onCreated]:Parameters<CreateOSProvider['createRunSandbox']>)=>{await onCreated?.({sandboxId:box.id,status:'running',egress:['api.stripe.com:443'],observedAt:new Date().toISOString()});store.requestCancel(owner.id,run.id);return box;});
 const reconnect=mock.method(CreateOSProvider.prototype,'reconnect',async()=>box);
 const destroy=mock.method(CreateOSProvider.prototype,'destroy',async()=>({sandboxId:box.id,destroyed:true as const,observedAt:new Date().toISOString()}));
 const generation=mock.method(GroqCodeProvider.prototype,'generateRepair',async()=>{throw Error('Generation must not happen');});
 try{await executeRun(config(),store,claim);assert.equal(store.getRun(run.id)?.status,'cancelled');assert.equal(destroy.mock.callCount(),1);assert.equal(generation.mock.callCount(),0);assert.equal(store.getCleanupPending().length,0);}
 finally{creation.mock.restore();reconnect.mock.restore();destroy.mock.restore();generation.mock.restore();store.close();}
});

test('readiness failures retry quickly, in-flight checks coalesce and different configurations stay isolated',async()=>{
 let time=0;let calls=0;let healthy=false;
 const probe=async():Promise<ProviderReadinessRecord[]>=>{calls++;return[{id:'createos',status:healthy?'ready':'error',message:'Synthetic readiness result',checkedAt:new Date().toISOString()}];};
 const read=createReadinessReader(probe,()=>time);const store=new RunStore(':memory:');const one=config();const two=config();
 try{
  assert.equal((await read(one,store)).ready,false);time=14999;await read(one,store);assert.equal(calls,1);
  healthy=true;time=15000;assert.equal((await read(one,store)).ready,true);assert.equal(calls,2);
  await read(two,store);assert.equal(calls,3);time=20000;await read(one,store);assert.equal(calls,3);
  await Promise.all([read(one,store,true),read(one,store,true)]);assert.equal(calls,4);
 }finally{store.close();}
});

test('expired lease is checked before a second provider operation, even before heartbeat notices',async()=>{
 const store=new RunStore(':memory:');const owner=store.createSession();const run=store.createRun(owner.id,['healthy_renewal']);const claim=store.claimNext('worker',500)!;
 const box={id:'synthetic-expired-sandbox'} as Sandbox;
 const creation=mock.method(CreateOSProvider.prototype,'createRunSandbox',async(...[_id,_env,onCreated]:Parameters<CreateOSProvider['createRunSandbox']>)=>{
  await onCreated?.({sandboxId:box.id,status:'running',egress:['api.stripe.com:443'],observedAt:new Date().toISOString()});
  await delay(525);store.recoverExpiredLeases();return box;
 });
 const upload=mock.method(CreateOSProvider.prototype,'uploadFiles',async()=>{throw Error('Fenced worker must not upload');});
 const reconnect=mock.method(CreateOSProvider.prototype,'reconnect',async()=>box);
 const destroy=mock.method(CreateOSProvider.prototype,'destroy',async()=>({sandboxId:box.id,destroyed:true as const,observedAt:new Date().toISOString()}));
 try{
  await executeRun(config(),store,claim);assert.equal(upload.mock.callCount(),0);assert.equal(store.getRun(run.id)?.status,'interrupted');
  assert.equal(store.getCleanupPending().length,1);
  assert.equal(await reconcileStoppedRun(store,store.getRun(run.id)!,{} as StripeBillingProvider,new CreateOSProvider(config().createos)),true);
  assert.equal(store.getCleanupPending().length,0);
  assert.throws(()=>store.updateRun(run.id,claim.lease,{status:'passed'}),isCode('LEASE_LOST'));
 }finally{creation.mock.restore();upload.mock.restore();reconnect.mock.restore();destroy.mock.restore();store.close();}
});

test('unexpected readiness exceptions cannot expose credentials or enqueue work',async()=>{
 const store=new RunStore(':memory:');const privateValue='synthetic-secret-never-forward';
 const app=await createServer({store,readiness:async()=>{throw Object.assign(new Error(privateValue),{request:{authorization:privateValue}});}});
 try{
  const session=await app.inject('/api/session');const headers={cookie:`ff_visitor=${session.cookies[0].value}`,'x-csrf-token':session.json().csrfToken};
  const response=await app.inject({method:'POST',url:'/api/runs',headers,payload:{}});
  assert.equal(response.statusCode,500);assert.doesNotMatch(response.body,new RegExp(privateValue));assert.equal(store.getActiveRun(),null);
 }finally{await app.close();store.close();}
});
