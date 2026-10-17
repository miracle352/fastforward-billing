import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {Pool} from 'pg';
import {PostgresRunStore} from '../apps/api/src/postgres-store.js';
import {createServer} from '../apps/api/src/server.js';

// Real database only. Temporary namespace isolates these checks from demonstration history and budgets.
const namespace='fastforward_'+randomBytes(6).toString('hex');const url=process.env.DATABASE_URL;
let a:PostgresRunStore|undefined,b:PostgresRunStore|undefined;
let verified=false;
try{
 if(!url)throw Error('A real database URL is required');
 a=await PostgresRunStore.open(url,namespace);b=await PostgresRunStore.open(url,namespace);
 const visitor=await a.createSession();const other=await b.createSession();
 const starts=await Promise.all([a,b,a].map(store=>store.createRun(visitor.id,['healthy_renewal'],{globalDailyLimit:1,idempotencyKey:'durable-replay-0001'})));
 assert.equal(new Set(starts.map(r=>r.id)).size,1);const id=starts[0].id;
 assert.equal(await b.getRunForOwner(id,other.id),null);
 const claim=await b.claimNext('real-db-test',60000);assert.ok(claim);
 const artifact=await b.addArtifact(id,claim.lease,{kind:'report',name:'db-proof.txt',content:'private persisted proof'});
 await b.setMetadata(id,'resources',[],claim.lease);
 const cancelled=await a.requestCancel(visitor.id,id);assert.equal(cancelled?.status,'cancel_requested');
 await a.close();a=await PostgresRunStore.open(url,namespace);
 assert.equal((await a.getSession(visitor.id))?.csrfToken,visitor.csrfToken);
 assert.equal((await a.getArtifactContent(visitor.id,id,artifact.id))?.content,'private persisted proof');
 assert.equal(await a.getArtifactContent(other.id,id,artifact.id),null);
 await b.completeCancellation(id,claim.lease);
 const replay=await a.createRun(visitor.id,['healthy_renewal'],{globalDailyLimit:0,idempotencyKey:'durable-replay-0001'});assert.equal(replay.id,id);
 const second=await a.createRun(visitor.id,['healthy_renewal'],{globalDailyLimit:3,ownerDailyLimit:3});const lease=await b.claimNext('expired-db-test',30);assert.ok(lease);
 await delay(60);await a.recoverExpiredLeases();await assert.rejects(b.renewLease(second.id,lease.lease));
 await assert.rejects(a.createRun(visitor.id,['healthy_renewal'],{globalDailyLimit:3,ownerDailyLimit:3}));
 await a.confirmCleanup(second.id,[]);assert.equal((await a.getCleanupPending()).length,0);
 const app=await createServer({store:a,secureCookies:true,origin:'https://fastforward.example',readiness:()=>({ready:false,providers:[],blockers:['Database verification only'],testMode:true,activeRunId:null})});
 try{assert.equal((await app.inject('/api/health')).statusCode,200);assert.equal((await app.inject('/api/runs')).statusCode,401);}finally{await app.close();}
 verified=true;
}catch{console.error(JSON.stringify({realPostgresVerification:false,privateDetailsSuppressed:true}));process.exitCode=1;}
finally{
 await a?.close();await b?.close();
 if(url&&(a||b)){const parsed=new URL(url);for(const key of ['sslmode','sslcert','sslkey','sslrootcert','sslpassword','sslnegotiation'])parsed.searchParams.delete(key);
 const cleanup=new Pool({connectionString:parsed.toString(),ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:12000,query_timeout:15000});
 try{if(!/^fastforward_[a-f0-9]{12}$/.test(namespace))throw Error('Invalid cleanup namespace');await cleanup.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);}catch{verified=false;process.exitCode=1;}finally{await cleanup.end();}}
 if(verified)console.log(JSON.stringify({realPostgresVerification:true,concurrentReplay:true,reopenPersistence:true,artifactOwnership:true,cancellation:true,leaseFencing:true,cleanupGate:true,testNamespaceRemoved:true,modelCalls:0,sandboxCreations:0}));
}
