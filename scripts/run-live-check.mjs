import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const origin='http://127.0.0.1:3000';
const request=async(path,options={},timeoutMs=20000)=>fetch(new URL(path,origin),{...options,signal:AbortSignal.timeout(timeoutMs)});
mkdirSync('.local',{recursive:true});
let runId;
try {
 const readiness=await (await request('/api/readiness',{},45000)).json();assert.equal(readiness.ready,true,'Real providers are not ready');
 const sessionResponse=await request('/api/session');const session=await sessionResponse.json();
 const cookie=sessionResponse.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'Fresh private visitor session missing');
 writeFileSync('.local/recheck-session.json',JSON.stringify({cookie,csrfToken:session.csrfToken}));
 const headers={Cookie:cookie,'X-CSRF-Token':session.csrfToken,Origin:'http://localhost:5173','Content-Type':'application/json'};
 const started=await request('/api/runs',{method:'POST',headers,body:JSON.stringify({scenarios:['healthy_renewal','trial_payment_failure']})});
 const body=await started.json();if(started.status!==202)throw Error(`Start refused HTTP ${started.status}; no retry attempted`);
 runId=body.run.id;writeFileSync('.local/recheck-run.json',JSON.stringify({id:runId}));
 const duplicate=await request('/api/runs',{method:'POST',headers,body:JSON.stringify({scenarios:['healthy_renewal']})});
 assert.equal(duplicate.status,409,'Concurrent job should be refused');
 let run=body.run;let previous='';const deadline=Date.now()+720000;
 while(!['passed','failed','blocked','cancelled','interrupted'].includes(run.status)){
  if(Date.now()>deadline)throw Error('Controller observation deadline reached; job remains independently tracked');
  if(`${run.status}:${run.attempt}`!==previous){previous=`${run.status}:${run.attempt}`;console.log(JSON.stringify({status:run.status,attempt:run.attempt}));}
  await delay(2000);const response=await request(`/api/runs/${runId}`,{headers:{Cookie:cookie}});assert.equal(response.status,200);run=(await response.json()).run;
 }
 const events=[];let cursor=0;while(true){const page=await (await request(`/api/runs/${runId}/events?after=${cursor}`,{headers:{Cookie:cookie}})).json();events.push(...page.events);if(page.events.length<200)break;cursor=page.nextCursor;}
 writeFileSync('.local/recheck-full-result.json',JSON.stringify({run,events},null,2));
 const downloads=[];
 for(const artifact of run.artifacts){const response=await request(artifact.downloadUrl,{headers:{Cookie:cookie}});const content=await response.text();const matches=response.ok&&createHash('sha256').update(content).digest('hex')===artifact.sha256;assert.equal(matches,true);const anonymous=await request(artifact.downloadUrl);assert.equal(anonymous.status,401);downloads.push({kind:artifact.kind,name:artifact.name,sha256:artifact.sha256,matched:true,anonymousDenied:true});}
 const otherSession=await request('/api/session');const otherCookie=otherSession.headers.get('set-cookie')?.split(';')[0];assert.ok(otherCookie);
 const other=await request(`/api/runs/${runId}`,{headers:{Cookie:otherCookie}});assert.equal(other.status,404);
 const phases=['baseline','verification'].map(phase=>({phase,invoiceIdentity:run.scenarios.map(scenario=>{
  const initial=run.checks.find(c=>c.scenario===scenario&&c.checkpoint===`${phase}: initial subscription access`);
  const transition=run.checks.find(c=>c.scenario===scenario&&c.checkpoint===`${phase}: after billing transition`);
  const invoice=c=>c?.stripeObjectIds.find(id=>id.startsWith('in_'));
  return {scenario,initialInvoiceObserved:!!invoice(initial),transitionInvoiceObserved:!!invoice(transition),invoiceChanged:!!invoice(initial)&&!!invoice(transition)&&invoice(initial)!==invoice(transition)};
 })}));
 const baselineIds=new Set(run.checks.filter(c=>c.checkpoint.startsWith('baseline:')).flatMap(c=>c.stripeObjectIds));
 const verification=run.checks.filter(c=>c.checkpoint.startsWith('verification:'));
 const verifiedIds=verification.flatMap(c=>c.stripeObjectIds);
 const models=events.filter(e=>e.kind==='model');
 const proof={checkedAt:new Date().toISOString(),scope:'Actual local trusted controller, real signed Stripe TEST webhooks and CreateOS execution; not hosted or production certification.',status:run.status,createdAt:run.createdAt,updatedAt:run.updatedAt,attempt:run.attempt,summary:run.summary,error:run.error,
  budgets:{modelCallsMaximum:3,outputTokensPerCallMaximum:3000,runTimeoutSeconds:600,oneActiveJob:true,duplicateStartDenied:duplicate.status},
  modelCalls:models.length,reportedTotalTokens:models.reduce((n,e)=>n+Number(e.data?.usage?.totalTokens||0),0),
  groqAllowances:models.map(e=>({checkedAt:e.createdAt,rateLimits:e.data?.rateLimits??{}})),
  baselineMismatchObserved:run.checks.some(c=>c.checkpoint.startsWith('baseline:')&&c.verdict==='failed'),
  verificationChecks:verification.map(({scenario,checkpoint,expectedAccess,observedAccess,stripeStatus,verdict,message})=>({scenario,checkpoint,expectedAccess,observedAccess,stripeStatus,verdict,message})),
  signedEventCounts:events.filter(e=>e.kind==='observation'&&e.data?.signedEventCount).map(e=>({phase:e.data.phase,count:e.data.signedEventCount})),
  billingTransitions:events.filter(e=>e.kind==='observation'&&e.data?.observations).map(e=>({phase:e.data.phase,observations:e.data.observations.map(o=>({scenario:o.scenario,status:o.status,invoiceStatus:o.invoiceStatus,invoicePaid:o.invoicePaid,amountDue:o.amountDue,amountPaid:o.amountPaid,simulatedClockTime:o.clockTime}))})),
  invoiceIdentity:phases,freshStripeObjectsObserved:verifiedIds.length>0&&verifiedIds.every(id=>!baselineIds.has(id)),
  validation:events.filter(e=>e.kind==='execution').map(e=>({attempt:e.data.attempt,exitCode:e.data.exitCode})),
  cleanupConfirmed:events.some(e=>e.kind==='cleanup'&&e.message==='Tracked test clocks, webhook endpoint and sandbox cleanup confirmed.'),artifacts:downloads,otherVisitorDenied:true};
 const publicText=JSON.stringify(proof,null,2)+'\n';
 if(/\b(?:cus|sub|clock|we|in)_[A-Za-z0-9]+\b|\bsb-[a-z0-9]+\b|(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+|gsk_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/.test(publicText))throw Error('Public receipt redaction refused');
 for(const [name,value]of Object.entries(process.env))if(/KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL/i.test(name)&&value?.length>11&&publicText.includes(value))throw Error('Private value detected; public receipt refused');
 mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/2026-10-17-bounded-recheck.json',publicText);
 console.log(JSON.stringify({status:run.status,modelCalls:proof.modelCalls,reportedTotalTokens:proof.reportedTotalTokens,verificationChecks:verification.length,verificationPassed:verification.every(c=>c.verdict==='passed'),freshObjects:proof.freshStripeObjectsObserved,invoiceIdentity:phases,cleanupConfirmed:proof.cleanupConfirmed,artifacts:downloads.length,groqAllowances:proof.groqAllowances}));
 assert.equal(run.status,'passed','Actual repair did not pass; see saved redacted evidence');assert.equal(verification.length,7);assert.ok(verification.every(c=>c.verdict==='passed'));assert.equal(proof.cleanupConfirmed,true);
 assert.ok(proof.baselineMismatchObserved);assert.ok(models.length>=1&&models.length<=3);assert.ok(['baseline','verification'].every(phase=>proof.signedEventCounts.some(e=>e.phase===phase&&e.count>0)));
 assert.ok(proof.freshStripeObjectsObserved);assert.ok(phases.every(p=>p.invoiceIdentity.every(i=>i.invoiceChanged)));
} catch(error) {
 console.error(JSON.stringify({operation:'bounded-real-recheck',failed:true,message:error instanceof assert.AssertionError?'An observed verification condition did not pass.':'The bounded verification could not complete; inspect the private saved checkpoint.',privateRunTracked:!!runId}));process.exitCode=1;
}
