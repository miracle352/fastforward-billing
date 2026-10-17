import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {RunStore} from '../src/store.js';
import {PostgresRunStore} from '../src/postgres-store.js';
import {createServer} from '../src/server.js';

test('HTTP admission, sessions, ownership and artifacts await asynchronous storage commits',async()=>{
 const backing=new RunStore(':memory:');
 const remote=new Proxy(backing,{get(target,key){const value=Reflect.get(target,key);return typeof value==='function'?async(...args:unknown[])=>{await delay(1);return Reflect.apply(value,target,args);}:value;}}) as unknown as PostgresRunStore;
 const app=await createServer({store:remote,readiness:()=>({ready:true,providers:[],blockers:[],testMode:true,activeRunId:null})});
 try{
  const session=await app.inject('/api/session');const headers={cookie:`ff_visitor=${session.cookies[0].value}`,'x-csrf-token':session.json().csrfToken,'idempotency-key':'async-admission-0001'};
  const starts=await Promise.all([1,2,3].map(()=>app.inject({method:'POST',url:'/api/runs',headers,payload:{}})));
  assert.ok(starts.every(r=>r.statusCode===202));const id=starts[0].json().run.id;assert.equal(new Set(starts.map(r=>r.json().run.id)).size,1);
  assert.equal((await app.inject({url:'/api/runs',headers})).json().runs.length,1);
  const claim=backing.claimNext('async-test')!;const artifact=backing.addArtifact(id,claim.lease,{kind:'report',name:'private.txt',content:'private-owner-proof'});
  const path=`/api/runs/${id}/artifacts/${artifact.id}`;
  assert.equal((await app.inject({url:path,headers})).body,'private-owner-proof');
  const other=await app.inject('/api/session');assert.equal((await app.inject({url:path,headers:{cookie:`ff_visitor=${other.cookies[0].value}`}})).statusCode,404);
  assert.equal((await app.inject({method:'POST',url:`/api/runs/${id}/cancel`,headers})).json().run.status,'cancel_requested');
 }finally{await app.close();backing.close();}
});
test('invalid Postgres connection configuration cannot echo a database password',async()=>{
 const secret='synthetic-private-password';
 await assert.rejects(PostgresRunStore.open(`postgres://user:${secret}@foreign.example/database`),error=>error instanceof Error&&!error.message.includes(secret));
});

test('maintenance admission preserves saved request replay while preventing new jobs',async()=>{
 const store=new RunStore(':memory:');const session=store.createSession();const run=store.createRun(session.id,['healthy_renewal'],{idempotencyKey:'before-maintenance-01'});
 const app=await createServer({store,acceptNewRuns:false,readiness:()=>({ready:true,providers:[],blockers:[],testMode:true,activeRunId:null})});
 try{
  const headers={cookie:`ff_visitor=${session.id}`,'x-csrf-token':session.csrfToken,'idempotency-key':'before-maintenance-01'};
  const replay=await app.inject({method:'POST',url:'/api/runs',headers,payload:{scenarios:['healthy_renewal']}});assert.equal(replay.statusCode,202);assert.equal(replay.json().run.id,run.id);
  const blocked=await app.inject({method:'POST',url:'/api/runs',headers:{...headers,'idempotency-key':'during-maintenance-02'},payload:{}});assert.equal(blocked.statusCode,503);assert.equal(blocked.json().error.code,'ADMISSION_PAUSED');assert.equal(store.listRuns(session.id).length,1);
 }finally{await app.close();store.close();}
});


test('asynchronous storage and readiness failures never serialize private provider errors',async()=>{
 const backing=new RunStore(':memory:');const secret='synthetic-database-password-do-not-expose';
 const remote=new Proxy(backing,{get(target,key){if(key==='getSession')return async()=>{throw Error('postgresql://operator:'+secret+'@private.neon.tech/db');};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}) as unknown as PostgresRunStore;
 const app=await createServer({store:remote,readiness:async()=>{throw Error('Bearer '+secret);}});
 try{for(const url of ['/api/session','/api/runs','/api/readiness']){const response=await app.inject(url);assert.equal(response.statusCode,500);assert.equal(response.json().error.code,'INTERNAL_ERROR');assert.ok(!response.body.includes(secret));assert.ok(!response.body.includes('private.neon.tech'));}
 const malformed=await app.inject({method:'POST',url:'/api/runs',headers:{'content-type':'application/json'},payload:'{'});assert.equal(malformed.statusCode,400);assert.equal(malformed.json().error.code,'REQUEST_INVALID');
 }finally{await app.close();backing.close();}
});
