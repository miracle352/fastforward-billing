import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialValues, redactDiagnosticText, safeDiagnosticSummary } from '../src/privacy.js';
import { boundedText } from '../src/providers/common.js';
import { loadConfig } from '../src/config.js';

test('nested credential containers never become diagnostic values and their leaves are redacted',()=>{
 const token='skp_synthetic-provider-credential_123';
 const environment={FASTFORWARD_RUNTIME_CREDENTIALS:JSON.stringify({bearer:{access_token:token}}),
  CARRY_CREATEOS_FREE_CREDENTIALS:JSON.stringify({bearer:{access_token:token}}),
  STRIPE_SECRET_KEY:'sk_test_synthetic123',MAX_MODEL_CALLS_PER_RUN:'3',MODEL_MAX_OUTPUT_TOKENS:token};
 const summary=safeDiagnosticSummary(environment);const serialized=JSON.stringify(summary);
 assert.doesNotMatch(serialized,/skp_|sk_test_|bearer|access_token/);assert.equal(summary.sharedRuntimeCredential,true);
 assert.equal(summary.budget.maxOutputTokens,null);assert.ok(credentialValues(environment).includes(token));
 const output=redactDiagnosticText(`Header Bearer ${token}, raw ${token}, container ${environment.FASTFORWARD_RUNTIME_CREDENTIALS}`,environment);
 assert.doesNotMatch(output,/synthetic-provider|access_token.*skp_/);assert.match(output,/REDACTED/);
 assert.doesNotMatch(boundedText('skp_synthetic_unknown-key_123 whsec_synthetic gsk_synthetic'),/synthetic/);
});

test('invalid configuration errors name fields without echoing credential-bearing input',()=>{
 const value='synthetic-private-value-do-not-print';
 assert.throws(()=>loadConfig({CREATEOS_SANDBOX_BASE_URL:`http://user:${value}@example.test`,PORT:value}),error=>{
  assert.ok(error instanceof Error);assert.doesNotMatch(error.message,new RegExp(value));assert.match(error.message,/PORT|CREATEOS_SANDBOX_BASE_URL/);return true;
 });
});

test('malformed URLs and provider status fields cannot smuggle private input into errors',async()=>{
 const value='synthetic-private-value-do-not-print';
 assert.throws(()=>loadConfig({CREATEOS_SANDBOX_BASE_URL:value}),error=>error instanceof Error&&!error.message.includes(value));
 const {safeProviderError}=await import('../src/providers/common.js');
 const error=safeProviderError('createos',{status:value,message:value,headers:{authorization:value}});
 assert.equal(error.code,'REQUEST_FAILED');assert.doesNotMatch(error.message,new RegExp(value));
});

test('database credentials are redacted in configured and unexpected connection URLs',()=>{
 const url='postgresql://synthetic-user:synthetic-password@synthetic.neon.tech/database?sslmode=require';
 assert.ok(credentialValues({DATABASE_URL:url}).includes(url));
 assert.ok(credentialValues({FASTFORWARD_DATA_CONNECTION_STRING:url}).includes(url));
 assert.equal(redactDiagnosticText(url,{FASTFORWARD_DATA_CONNECTION_STRING:url}),'[REDACTED]');
 assert.doesNotMatch(redactDiagnosticText(url,{DATABASE_URL:url}),/synthetic/);
 assert.doesNotMatch(redactDiagnosticText(url,{}),/synthetic-password/);
});
