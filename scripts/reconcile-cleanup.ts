import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {z} from 'zod';
import {loadConfig} from '../apps/api/src/config.js';
import {openStore,type Store} from '../apps/api/src/storage.js';
import {CreateOSProvider,StripeBillingProvider} from '../apps/api/src/providers/index.js';
import {readRecoveryObject,reconcileReceipt,reconcileStoppedRun} from '../apps/api/src/reconciliation.js';

let store:Store|undefined;
try{
 const {values}=parseArgs({options:{apply:{type:'boolean',default:false},receipt:{type:'string'}},strict:true,allowPositionals:false});const apply=values.apply;
 const config=loadConfig();store=await openStore(config);
 if(await store.getActiveRun())throw Error('An active worker retains control');
 if(!values.receipt){if(apply)throw Error('A private receipt is required');console.log(JSON.stringify({mode:'inspect',cleanupPending:(await store.getCleanupPending()).length,mutations:0,providerCalls:0}));}
 else{
  const receipt=z.object({runId:z.string().uuid(),kind:z.enum(['sandbox','webhook','clock','product','price','customer','subscription']),id:z.string().min(1).max(200)}).strict().parse(JSON.parse(readFileSync(values.receipt,'utf8')));
  const stripe=new StripeBillingProvider(config.stripe);const createos=new CreateOSProvider(config.createos);const current=store;
  const result=await reconcileReceipt(store,receipt.runId,receipt,{apply,read:(kind,id)=>readRecoveryObject(kind,id,stripe,createos),cleanup:run=>reconcileStoppedRun(current,run,stripe,createos)});
  console.log(JSON.stringify({mode:apply?'apply':'inspect',...result}));if(apply&&!result.cleanupConfirmed)process.exitCode=1;
 }
}catch{console.error(JSON.stringify({reconciliationFailed:true,cleanupGatePreserved:true,privateDetailsSuppressed:true}));process.exitCode=1;}
finally{await store?.close();}
