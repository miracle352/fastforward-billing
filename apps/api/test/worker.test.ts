import test from 'node:test';
import assert from 'node:assert/strict';
import { assertHandlerEvidence, finalSubscriptionEventsObserved, HandlerExecutionError, type Evidence } from '../src/worker.js';
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
