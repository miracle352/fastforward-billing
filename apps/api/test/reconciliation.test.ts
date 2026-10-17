import test from 'node:test';
import assert from 'node:assert/strict';
import {RunStore} from '../src/store.js';
import {belongsToRun,reconcileReceipt} from '../src/reconciliation.js';
import {sandboxNameForRun} from '../src/providers/index.js';

function stopped(){
 const store=new RunStore(':memory:');const session=store.createSession();const run=store.createRun(session.id,['healthy_renewal']);const claim=store.claimNext('worker')!;
 store.setMetadata(run.id,'resources',[],claim.lease);store.setMetadata(run.id,'allocation_pending',{kind:'sandbox',index:0},claim.lease);
 store.setMetadata(run.id,'cleanup_pending',true,claim.lease);store.finishRun(run.id,claim.lease,'interrupted');
 return{store,run:store.getRun(run.id)!,receipt:{kind:'sandbox' as const,id:'sandbox-proof'}};
}
test('recovery attribution requires exact scope, test mode, parent, scenario and creation window',()=>{
 const{store,run}=stopped();try{
 const base={id:'product-proof',created:Date.now()/1000,livemode:false,metadata:{fastforward:'true',run_id:`${run.id}-b`,phase:'baseline'}};
 assert.equal(belongsToRun(run,'product',base,[]),true);
 assert.equal(belongsToRun(run,'product',{...base,livemode:true},[]),false);
 assert.equal(belongsToRun(run,'product',{...base,metadata:{...base.metadata,run_id:'different-run'}},[]),false);
 assert.equal(belongsToRun(run,'product',{...base,created:0},[]),false);
 assert.equal(belongsToRun(run,'price',{...base,parentId:'other'},[{kind:'product',id:'owned'}]),false);
 assert.equal(belongsToRun(run,'price',{...base,parentId:'owned'},[{kind:'product',id:'owned'}]),true);
 assert.equal(belongsToRun(run,'clock',{...base,name:`ff-${run.id}-b-baseline-trial_payment_failure`},[]),false);
 assert.equal(belongsToRun(run,'clock',{...base,name:`ff-${run.id}-b-baseline-healthy_renewal`},[]),true);
 }finally{store.close();}
});
test('operator inspection cannot mutate; verified application still requires cleanup proof',async()=>{
 const{store,run,receipt}=stopped();try{
 const read=async()=>({id:receipt.id,name:sandboxNameForRun(run.id),created:Date.now()/1000});let cleaned=0;
 const cleanup=async()=>{cleaned++;const saved=store.getMetadata<Array<{kind:string;id:string;cleaned?:boolean}>>(run.id,'resources')!;assert.equal(saved[0].id,receipt.id);assert.equal(store.getCleanupPending().length,1);saved[0].cleaned=true;store.confirmCleanup(run.id,saved);return true;};
 assert.deepEqual(await reconcileReceipt(store,run.id,receipt,{apply:false,read,cleanup}),{attributed:true,applied:false,cleanupConfirmed:false});
 assert.deepEqual(store.getMetadata(run.id,'resources'),[]);assert.equal(cleaned,0);
 assert.equal((await reconcileReceipt(store,run.id,receipt,{apply:true,read,cleanup})).cleanupConfirmed,true);
 assert.equal(cleaned,1);assert.equal(store.getCleanupPending().length,0);assert.equal(store.getRun(run.id)?.status,'interrupted');
 }finally{store.close();}
});
test('missing and cross-run receipts cannot clear a pending allocation',async()=>{
 const{store,run,receipt}=stopped();try{
 const cleanup=async()=>{throw Error('Must not clean foreign resources');};
 await assert.rejects(reconcileReceipt(store,run.id,receipt,{apply:true,read:async()=>{throw Error('not found');},cleanup}));
 await assert.rejects(reconcileReceipt(store,run.id,receipt,{apply:true,read:async()=>({id:receipt.id,created:Date.now()/1000,name:'other-run'}),cleanup}));
 assert.equal(store.getCleanupPending().length,1);assert.deepEqual(store.getMetadata(run.id,'resources'),[]);
 }finally{store.close();}
});
test('racing recovery receipts are fenced and never trigger duplicate cleanup',async()=>{
 const{store,run,receipt}=stopped();try{
 await assert.rejects(reconcileReceipt(store,run.id,receipt,{apply:true,read:async()=>{
 store.recordRecoveredResource(run.id,{kind:'sandbox',index:0},receipt);
 return{id:receipt.id,created:Date.now()/1000,name:sandboxNameForRun(run.id)};
 },cleanup:async()=>{throw Error('Stale recovery must not clean');}}),error=>(error as {code?:string}).code==='RECOVERY_CONFLICT');
 assert.equal(store.getCleanupPending().length,1);assert.equal(store.getMetadata<unknown[]>(run.id,'resources')?.length,1);
 }finally{store.close();}
});
