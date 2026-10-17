import Stripe from 'stripe';
import type { ReadinessRecord, ProviderReadinessRecord } from '@fastforward/contracts';
import type { Config } from './config.js';
import type {Store as RunStore} from './storage.js';

async function probes(config: Config): Promise<ProviderReadinessRecord[]> {
  const check = async (id: ProviderReadinessRecord['id'], key: string, work: () => Promise<string>): Promise<ProviderReadinessRecord> => {
    if (!key) return {id,status:'unconfigured',message:`${id === 'stripe_readonly' ? 'Restricted Stripe test' : id} credential needs setup.`,checkedAt:null};
    try {return {id,status:'ready',message:await work(),checkedAt:new Date().toISOString()};}
    catch {return {id,status:'error',message:`${id} access could not be confirmed. Check the local credential, account and network.`,checkedAt:new Date().toISOString()};}
  };
  return Promise.all([
    check('stripe',config.stripe.controllerKey,async()=>{
      const result=await new Stripe(config.stripe.controllerKey,{timeout:12000,maxNetworkRetries:0}).subscriptions.list({limit:1});
      if(result.data.some(s=>s.livemode)) throw new Error('Live data rejected');
      return 'Stripe test subscription reads confirmed.';
    }),
    check('stripe_readonly',config.stripe.readonlyKey,async()=>{
      const result=await new Stripe(config.stripe.readonlyKey,{timeout:12000,maxNetworkRetries:0}).subscriptions.list({limit:1});
      if(result.data.some(s=>s.livemode)) throw new Error('Live data rejected');
      return 'Restricted test-key reads confirmed. Permission configuration requires operator confirmation.';
    }),
    check('createos',config.createos.apiKey,async()=>{
      const response=await fetch(new URL('/v1/whoami',config.createos.baseUrl),{
        headers:{'X-Api-Key':config.createos.apiKey},signal:AbortSignal.timeout(12000),redirect:'error',
      });
      if(!response.ok)throw new Error('Sandbox identity check refused');
      const payload=await response.json() as {data?:{user_id?:unknown};user_id?:unknown};
      if(typeof (payload.data??payload).user_id!=='string')throw new Error('Sandbox identity not observed');
      return 'CreateOS EU account access confirmed. No sandbox was created by this check.';
    }),
    check('groq',config.groq.apiKey,async()=>{
      const result=await fetch('https://api.groq.com/openai/v1/models',{headers:{Authorization:`Bearer ${config.groq.apiKey}`},signal:AbortSignal.timeout(12000)});
      if(!result.ok) throw new Error('Model access denied');
      const catalogue=await result.json() as {data?:Array<{id?:string;active?:boolean}>};
      if(!catalogue.data?.some(model=>model.id===config.groq.model && model.active!==false)) throw new Error('Model unavailable');
      return 'Configured Groq model is visible. No generation or API credit verification performed.';
    }),
  ]);
}
/** Failed probes retry after 15 s; successful probes cache for 5 min. Configurations never share credentials/cache. */
export function createReadinessReader(probe: (config:Config)=>Promise<ProviderReadinessRecord[]>, clock:()=>number=Date.now) {
  const caches=new WeakMap<Config,{at:number; providers:ProviderReadinessRecord[]|null; pending?:Promise<ProviderReadinessRecord[]>}>();
  return async (config:Config,store:RunStore,force=false):Promise<ReadinessRecord> => {
    let entry=caches.get(config); if(!entry){entry={at:0,providers:null};caches.set(config,entry);}
    const ttl=entry.providers?.every(p=>p.status==='ready')?300000:15000;
    if(force||!entry.providers||clock()-entry.at>=ttl){
      entry.pending??=probe(config).then(providers=>{entry!.providers=providers;entry!.at=clock();return providers;}).finally(()=>{entry!.pending=undefined;});
      await entry.pending;
    }
    const providers=entry.providers!;
    const blockers=providers.filter(p=>p.status!=='ready').map(p=>p.message);
    if(!config.server.acceptNewRuns)blockers.push('New runs are paused by the operator.');
    if(!config.stripe.readonlyConfirmed)blockers.push('Configure and confirm a read-only restricted Stripe test key for the generated application.');
    if(config.groq.maxCalls<1||config.groq.maxOutputTokens<128||config.server.globalDailyLimit<1)blockers.push('The operator must configure model-call, output-token and daily-run budgets before execution.');
    if((await store.getCleanupPending()).length)blockers.push('A previous run has resources awaiting confirmed cleanup.');
    return {ready:!blockers.length,providers,blockers,testMode:true,activeRunId:(await store.getActiveRun())?.id??null};
  };
}
export const getReadiness=createReadinessReader(probes);
