import type {RunRecord} from '@fastforward/contracts';
import {sandboxNameForRun, type CreateOSProvider, type StripeBillingProvider} from './providers/index.js';
import {StoreError} from './store.js';
import type {Store as RunStore} from './storage.js';
import {type Resource, type AllocationIntent, reconcileStoppedRun} from './worker.js';

export type RecoveryObject = {id:string; created:number; livemode?:boolean; name?:string|null;
  metadata?:Record<string,string>; parentId?:string; url?:string|null};
/** Positive attribution only. A missing object or list result is never proof of an empty allocation. */
export function belongsToRun(run:RunRecord,kind:Resource['kind'],object:RecoveryObject,resources:Resource[]):boolean {
  const created=object.created*1000;
  if(!Number.isFinite(created)||created<Date.parse(run.createdAt)-60_000||created>Date.parse(run.updatedAt)+60_000)return false;
  if(kind==='sandbox')return object.name===sandboxNameForRun(run.id);
  if(object.livemode!==false)return false;
  if(kind==='webhook')return object.metadata?.fastforward==='true'&&object.metadata.operation_id===run.id&&
    !!run.previewUrl&&object.url===new URL('/webhook',run.previewUrl).toString();
  const scopes=[{id:`${run.id}-b`,phase:'baseline'},...Array.from({length:3},(_,i)=>({id:`${run.id}-v${i+1}`,phase:'verification'}))];
  if(kind==='clock')return scopes.some(scope=>run.scenarios.some(s=>object.name===`ff-${scope.id}-${scope.phase}-${s}`));
  if(!scopes.some(scope=>object.metadata?.run_id===scope.id&&object.metadata.phase===scope.phase)||object.metadata?.fastforward!=='true')return false;
  const parent=kind==='price'?'product':kind==='customer'?'clock':kind==='subscription'?'customer':null;
  return !parent||resources.some(r=>r.kind===parent&&r.id===object.parentId);
}

export async function readRecoveryObject(kind:Resource['kind'],id:string,stripe:StripeBillingProvider,createos:CreateOSProvider):Promise<RecoveryObject>{
  if(kind==='sandbox'){
    const box=await createos.reconnect(id);return{id:box.id,name:box.name,created:Date.parse(box.data.created_at)/1000};
  }
  const objectId=(v:string|{id:string}|null|undefined)=>typeof v==='string'?v:v?.id;
  if(kind==='product')return await stripe.controller.products.retrieve(id);
  if(kind==='price'){const x=await stripe.controller.prices.retrieve(id);return{...x,parentId:objectId(x.product)};}
  if(kind==='customer'){const x=await stripe.controller.customers.retrieve(id);if(x.deleted)throw new Error('Deleted customer requires separate proof');return{...x,parentId:objectId(x.test_clock)};}
  if(kind==='subscription'){const x=await stripe.controller.subscriptions.retrieve(id);return{...x,parentId:objectId(x.customer)};}
  if(kind==='webhook'){const x=await stripe.controller.webhookEndpoints.retrieve(id);return{...x,metadata:x.metadata??undefined};}
  if(kind==='clock'){const x=await stripe.controller.testHelpers.testClocks.retrieve(id);return{id:x.id,name:x.name??undefined,created:x.created,livemode:x.livemode};}
  throw new Error('A process is reconciled by destruction of its tracked parent sandbox.');
}

export async function reconcileReceipt(store:RunStore,runId:string,receipt:Resource,options:{
  apply:boolean;read:(kind:Resource['kind'],id:string)=>Promise<RecoveryObject>;
  cleanup:(run:RunRecord)=>Promise<boolean>;
}):Promise<{attributed:true;applied:boolean;cleanupConfirmed:boolean}>{
  const run=(await store.getRun(runId));const intent=(await store.getMetadata<AllocationIntent>(runId,'allocation_pending'));
  const resources=(await store.getMetadata<Resource[]>(runId,'resources'));
  if(!run||!['interrupted','blocked','failed','cancelled','passed'].includes(run.status)||(await store.getMetadata(runId,'cleanup_pending'))!==true||
    !intent||intent.kind!==receipt.kind||!resources||resources.length!==intent.index)
    throw new StoreError('RECOVERY_NOT_READY','A stopped job with an unresolved allocation is required.');
  const observed=await options.read(receipt.kind,receipt.id);
  if(observed.id!==receipt.id||!belongsToRun(run,receipt.kind,observed,resources))
    throw new StoreError('RECOVERY_OWNERSHIP','Provider evidence did not attribute this allocation to the stopped job.');
  if(!options.apply)return{attributed:true,applied:false,cleanupConfirmed:false};
  (await store.recordRecoveredResource(runId,intent,receipt));
  return{attributed:true,applied:true,cleanupConfirmed:await options.cleanup((await store.getRun(runId))!)};
}
export {reconcileStoppedRun};
