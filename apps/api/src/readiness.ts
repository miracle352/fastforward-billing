import Stripe from 'stripe';
import { createClient } from '@nodeops-createos/sandbox';
import type { ReadinessRecord, ProviderReadinessRecord } from '@fastforward/contracts';
import type { Config } from './config.js';
import type { RunStore } from './store.js';

let cached: { at: number; result: ProviderReadinessRecord[] } | undefined;
let pending: Promise<ProviderReadinessRecord[]> | undefined;
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
      const client=createClient({apiKey:config.createos.apiKey,baseUrl:config.createos.baseUrl,timeoutMs:12000,retry:false});
      await client.whoami();
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
export async function getReadiness(config:Config,store:RunStore,force=false):Promise<ReadinessRecord>{
  if(force || !cached || Date.now()-cached.at>300000){
    pending??=probes(config).then(result=>{cached={at:Date.now(),result};return result;}).finally(()=>{pending=undefined;});
    await pending;
  }
  const providers=cached!.result;
  const blockers=providers.filter(p=>p.status!=='ready').map(p=>p.message);
  if(!config.stripe.readonlyConfirmed) blockers.push('Configure and confirm a read-only restricted Stripe test key for the generated application.');
  if(config.groq.maxCalls<1 || config.groq.maxOutputTokens<128 || config.server.globalDailyLimit<1) blockers.push('The operator must configure model-call, output-token and daily-run budgets before execution.');
  if(store.getCleanupPending().length) blockers.push('A previous run has resources awaiting confirmed cleanup.');
  return {ready:!blockers.length,providers,blockers,testMode:true,activeRunId:store.getActiveRun()?.id??null};
}
