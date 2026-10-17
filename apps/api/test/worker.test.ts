import test from 'node:test';
import assert from 'node:assert/strict';
import { assertHandlerEvidence, finalSubscriptionEventsObserved, HandlerExecutionError, waitForPreviewHealth, type Evidence } from '../src/worker.js';
import { ProviderError } from '../src/providers/common.js';
import type { StripeObservation } from '../src/providers/stripe.js';

const observation:StripeObservation={scenario:'trial_payment_failure',clockId:'clock_new',customerId:'cus_new',subscriptionId:'sub_new',status:'past_due',invoiceId:'in_new',invoiceStatus:'open',invoicePaid:false,amountDue:1900,amountPaid:0,clockTime:12345};
const update=(id:string,status:string)=>({id,type:'customer.subscription.updated',object_id:'sub_new',customer_id:'cus_new',stripe_status:status});
test('fresh-clock verdict waits for the final subscription status, not an intermediate or old event',()=>{
  assert.equal(finalSubscriptionEventsObserved({events:[update('evt_old','past_due'),update('evt_new','active')]},[observation],new Set(['evt_old'])),false);
  assert.equal(finalSubscriptionEventsObserved({events:[update('evt_old','past_due'),update('evt_final','past_due')]},[observation],new Set(['evt_old'])),true);
});
test('only current-fixture runtime failures become repair feedback; provider failures remain blockers',()=>{
  const evidence:Evidence={events:[],errors:[{event_id:'evt_failed',type:'customer.subscription.updated',object_id:'sub_new',run_id:'run-v1',error_type:'TypeError',message:'Incorrect handler operation'}]};
  assert.throws(()=>assertHandlerEvidence(evidence,'run-v1',new Set(['sub_new']),'verification'),HandlerExecutionError);
  assert.doesNotThrow(()=>assertHandlerEvidence(evidence,'run-v2',new Set(['sub_new']),'verification'));
  assert.doesNotThrow(()=>assertHandlerEvidence(evidence,'run-v1',new Set(['sub_other']),'verification'));
  assert.throws(()=>assertHandlerEvidence(evidence,'run-v1',new Set(['sub_new']),'baseline'),ProviderError);
  evidence.errors![0].error_type='HTTPError';
  assert.throws(()=>assertHandlerEvidence(evidence,'run-v1',new Set(['sub_new']),'verification'),ProviderError);
});

test('public preview readiness retries transient transport and gateway failures while retaining HTTPS and redirect rejection',async()=>{
  let attempts=0;
  const fetcher=async(input:string|URL|Request,init?:RequestInit)=>{
    assert.equal(String(input),'https://sample.example/health');
    assert.equal(init?.redirect,'error');
    assert.ok(init?.signal);
    attempts++;
    if(attempts===1) throw new TypeError('fetch failed',{cause:{code:'ECONNREFUSED'}});
    if(attempts===2) return new Response('routing pending',{status:503});
    return Response.json({ready:true,testMode:true});
  };
  await waitForPreviewHealth('https://sample.example',new AbortController().signal,{timeoutMs:1000,intervalMs:1,fetcher:fetcher as typeof fetch});
  assert.equal(attempts,3);
});

test('public preview readiness fails immediately for wrong auth, redirects and invalid successful payloads',async()=>{
  for(const response of [new Response('',{status:401}),new Response('',{status:302}),Response.json({ready:false,testMode:true}),new Response('not JSON',{status:200})]){
    let attempts=0;
    const fetcher=async()=>{attempts++;return response;};
    await assert.rejects(waitForPreviewHealth('https://sample.example',new AbortController().signal,{timeoutMs:1000,intervalMs:1,fetcher:fetcher as typeof fetch}));
    assert.equal(attempts,1);
  }
  let attempts=0;
  const fetcher=async()=>{attempts++;throw new TypeError('fetch failed',{cause:new Error('unexpected redirect')});};
  await assert.rejects(waitForPreviewHealth('https://sample.example',new AbortController().signal,{timeoutMs:1000,intervalMs:1,fetcher:fetcher as typeof fetch}));
  assert.equal(attempts,1);
});

test('public preview readiness stops at its total deadline and respects run cancellation',async()=>{
  const fetcher=async()=>new Response('',{status:502});
  await assert.rejects(waitForPreviewHealth('https://sample.example',new AbortController().signal,{timeoutMs:20,intervalMs:1,fetcher:fetcher as typeof fetch}),
    (error:unknown)=>error instanceof ProviderError && error.code==='PREVIEW_HEALTH_TIMEOUT');
  const cancelled=new AbortController(); cancelled.abort(new Error('Run cancelled'));
  let attempts=0;
  await assert.rejects(waitForPreviewHealth('https://sample.example',cancelled.signal,{timeoutMs:1000,fetcher:(async()=>{attempts++;return Response.json({ready:true,testMode:true});}) as typeof fetch}),/Run cancelled/);
  assert.equal(attempts,0);
});

test('cleanup verifies canceled Stripe records and persists process completion after sandbox destruction', async () => {
  const { cleanupResources } = await import('../src/worker.js');
  const resources: import('../src/worker.js').Resource[] = [
    {kind:'sandbox',id:'sandbox-test'},{kind:'process',id:'process-test'},
    {kind:'clock',id:'clock-test'},{kind:'customer',id:'customer-test'},{kind:'subscription',id:'subscription-test'},
  ];
  const reads: string[] = []; const snapshots: boolean[][] = [];
  let subscriptionStatus: 'canceled' | 'active' = 'canceled';
  const stripe = {controller:{testHelpers:{testClocks:{del:async()=>({deleted:true})}},
    customers:{retrieve:async()=>{reads.push('customer');return{deleted:true};}},
    subscriptions:{retrieve:async()=>{reads.push('subscription');return{status:subscriptionStatus,livemode:false};}},
  }} as unknown as import('../src/providers/stripe.js').StripeBillingProvider;
  const createos = {reconnect:async()=>({}),destroy:async()=>({destroyed:true})} as unknown as import('../src/providers/createos.js').CreateOSProvider;
  assert.deepEqual(await cleanupResources(resources,stripe,createos,{onUpdate:()=>snapshots.push(resources.map(r=>r.cleaned===true))}),[]);
  assert.deepEqual(reads,['customer','subscription']);
  assert.ok(resources.every(r=>r.cleaned));
  assert.ok(snapshots.at(-1)?.every(Boolean),'Final process cleanup must reach durable metadata');
  const retained = [{kind:'subscription' as const,id:'subscription-still-active'}];
  subscriptionStatus = 'active';
  assert.equal((await cleanupResources(retained,stripe,createos)).length,1);
  assert.notEqual((retained[0] as import('../src/worker.js').Resource).cleaned,true);
});
