import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStripeTestKey, isAdvancedObservation, type StripeFixture, type StripeObservation } from '../src/providers/stripe.js';
import { assertRestrictedEgress, sandboxNameForRun } from '../src/providers/createos.js';
import { GroqCodeProvider } from '../src/providers/groq.js';
import { safeProviderError, boundedText } from '../src/providers/common.js';

test('controller and generated app cannot accept live or interchangeable Stripe credentials', () => {
  assert.doesNotThrow(() => assertStripeTestKey('sk_test_example123', 'controller'));
  assert.doesNotThrow(() => assertStripeTestKey('rk_test_example123', 'readonly'));
  for (const key of ['sk_live_example123','rk_live_example123','rk_test_example123',''])
    assert.throws(() => assertStripeTestKey(key, 'controller'));
  for (const key of ['sk_test_example123','sk_live_example123','rk_live_example123',''])
    assert.throws(() => assertStripeTestKey(key, 'readonly'));
});

test('open networking is rejected before a generated-code sandbox can be created', () => {
  for (const rules of [[],['*'],['0.0.0.0/0'],['::/0'],['example.org:443']])
    assert.throws(() => assertRestrictedEgress(rules));
  assert.doesNotThrow(() => assertRestrictedEgress(['api.stripe.com:443']));
});

test('UUID run names satisfy the observed regional sandbox naming limit', () => {
  const name = sandboxNameForRun('454d8eca-69eb-4e34-9f6a-0edf99502191');
  assert.ok(name.length <= 22);
  assert.match(name, /^[a-z0-9-]+$/);
  assert.notEqual(name, sandboxNameForRun('145d8eca-69eb-4e34-9f6a-0edf99502191'));
  assert.throws(() => sandboxNameForRun(''));
});

test('healthy renewal requires a newly paid invoice rather than the initial successful charge', () => {
  const fixture: StripeFixture = {scenario:'healthy_renewal',clockId:'clock_sample',customerId:'cus_sample',
    subscriptionId:'sub_sample',initialStatus:'active',initialInvoiceId:'in_initial',initialTime:100,periodEnd:200};
  const observed: StripeObservation = {scenario:'healthy_renewal',clockId:'clock_sample',customerId:'cus_sample',
    subscriptionId:'sub_sample',status:'active',invoiceId:'in_initial',invoiceStatus:'paid',invoicePaid:true,
    amountDue:1900,amountPaid:1900,clockTime:300};
  assert.equal(isAdvancedObservation(fixture,observed),false);
  assert.equal(isAdvancedObservation(fixture,{...observed,invoiceId:'in_renewal'}),true);
  assert.equal(isAdvancedObservation(fixture,{...observed,invoiceId:'in_renewal',invoicePaid:false}),false);
  assert.equal(isAdvancedObservation(fixture,{...observed,invoiceId:'in_renewal',clockTime:200}),false);
  assert.equal(isAdvancedObservation(fixture,{...observed,invoiceId:'in_renewal',customerId:'cus_other'}),false);
});

test('provider errors do not forward raw errors containing credentials', () => {
  const error = safeProviderError('stripe', { statusCode: 401, message: 'sk_test_secretvalue', request: { Authorization: 'secret' } });
  assert.equal(error.code, 'HTTP_401');
  assert.doesNotMatch(error.message, /secret/);
});

test('untrusted execution logs redact Stripe/model/signing credentials', () => {
  const log = boundedText('rk_test_example123 whsec_signing123 gsk_model123 harmless sub_123');
  assert.doesNotMatch(log, /example123|signing123|model123/);
  assert.match(log, /harmless sub_123/);
});

test('model attempts consume the budget even after an HTTP failure and do not silently retry', async () => {
  let requests = 0;
  const fakeFetch = async () => { requests++; return new Response('provider secret body', { status: 429 }); };
  const provider = new GroqCodeProvider({ apiKey: 'not-a-real-key', model: 'test-model', maxCalls: 1,
    maxOutputTokens: 512, timeoutMs: 5000 }, fakeFetch as typeof fetch);
  const input = { source: 'def handle(): pass', contract: 'Repair only this function.', failures: ['Access mismatch.'] };
  await assert.rejects(provider.generateRepair(input), /HTTP 429/);
  await assert.rejects(provider.generateRepair(input), /exhausted/);
  assert.equal(requests, 1);
  assert.equal(provider.callsUsed, 1);
});

test('model visibility probe lists the catalogue and supports slash-containing model IDs without a generation call', async () => {
  const requests: string[] = [];
  const fakeFetch = async (input: string | URL | Request) => {
    requests.push(String(input));
    return Response.json({data:[{id:'openai/gpt-oss-120b',active:true},{id:'other-model',active:true}]});
  };
  const provider = new GroqCodeProvider({ apiKey: 'not-a-real-key', model: 'openai/gpt-oss-120b', maxCalls: 1,
    maxOutputTokens: 512, timeoutMs: 5000 }, fakeFetch as typeof fetch);
  assert.deepEqual(await provider.probe(), {model:'openai/gpt-oss-120b',available:true,billableCallMade:false});
  assert.deepEqual(requests,['https://api.groq.com/openai/v1/models']);
  assert.equal(provider.callsUsed,0);
});

test('model visibility probe refuses missing or inactive configured models', async () => {
  const fakeFetch = async () => Response.json({data:[{id:'configured/model',active:false}]});
  const provider = new GroqCodeProvider({ apiKey:'not-a-real-key',model:'configured/model',maxCalls:1,
    maxOutputTokens:512,timeoutMs:5000 },fakeFetch as typeof fetch);
  await assert.rejects(provider.probe(),/unavailable/);
  assert.equal(provider.callsUsed,0);
});

test('truncated model source is never returned for execution', async () => {
  const fakeFetch = async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{"source":"partial' } }] });
  const provider = new GroqCodeProvider({ apiKey: 'not-a-real-key', model: 'test-model', maxCalls: 1,
    maxOutputTokens: 512, timeoutMs: 5000 }, fakeFetch as typeof fetch);
  await assert.rejects(provider.generateRepair({ source: 'pass', contract: 'contract', failures: [] }), /token limit/);
});

test('valid generated source returns provider usage rather than a success verdict', async () => {
  const fakeFetch = async () => Response.json({ choices: [{ finish_reason: 'stop', message: {
    content: JSON.stringify({ source: 'def allowed(status):\n    return status == "active"\n', explanation: 'Uses declared subscription state.' }) } }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } });
  const provider = new GroqCodeProvider({ apiKey: 'not-a-real-key', model: 'test-model', maxCalls: 3,
    maxOutputTokens: 512, timeoutMs: 5000 }, fakeFetch as typeof fetch);
  const result = await provider.generateRepair({ source: 'pass', contract: 'contract', failures: [] });
  assert.equal(result.call, 1); assert.equal(result.usage.totalTokens, 30);
  assert.equal('passed' in result, false); assert.equal('verified' in result, false);
});
