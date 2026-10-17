import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDenied, evaluateReport, failedChecks } from '../src/evaluator.js';
import type { StripeObservation } from '../src/providers/stripe.js';

const observation: StripeObservation = { scenario: 'healthy_renewal', clockId: 'clock_fixture', customerId: 'cus_fixture',
  subscriptionId: 'sub_fixture', status: 'active', invoiceId: 'in_fixture', invoiceStatus: 'paid', invoicePaid: true,
  amountDue: 1900, amountPaid: 1900, clockTime: 1000 };
const person = { customerId: 'cus_fixture', report: 'private fixture report', token: 'not-a-provider-secret', scenario: 'healthy_renewal' as const };

test('an allowed customer must receive the exact owned report, not merely HTTP 200', () => {
  const base = { id: 'owned', checkpoint: 'verification', person, observation };
  assert.equal(evaluateReport({ ...base, response: { status: 200, body: { customerId: person.customerId, report: person.report } } }).verdict, 'passed');
  assert.equal(evaluateReport({ ...base, response: { status: 200, body: { customerId: 'another-customer', report: person.report } } }).verdict, 'failed');
  assert.equal(evaluateReport({ ...base, response: { status: 200, body: { customerId: person.customerId, report: 'another report' } } }).verdict, 'failed');
  assert.equal(evaluateReport({ ...base, response: { status: 403, body: {} } }).verdict, 'failed');
});

test('the declared zero-grace policy uses independently supplied Stripe state', () => {
  const base = { id: 'denied', checkpoint: 'verification', person, observation: { ...observation, status: 'past_due' } };
  const denied = evaluateReport({ ...base, response: { status: 403, body: { error: 'Denied' } } });
  assert.equal(denied.verdict, 'passed');
  assert.equal(denied.expectedAccess, false);
  assert.equal(evaluateReport({ ...base, response: { status: 200, body: { customerId: person.customerId, report: person.report } } }).verdict, 'failed');
  assert.equal(evaluateReport({ ...base, response: { status: 500, body: {} } }).verdict, 'failed');
  assert.equal(failedChecks([denied]).length, 0);
});

test('authentication failures and cross-customer denials require the precise expected status', () => {
  const base = { id: 'anonymous', checkpoint: 'unauthenticated', scenario: 'healthy_renewal' as const, expectedStatus: 401 as const };
  assert.equal(evaluateDenied({ ...base, response: { status: 401, body: {} } }).verdict, 'passed');
  assert.equal(evaluateDenied({ ...base, response: { status: 403, body: {} } }).verdict, 'failed');
  assert.equal(evaluateDenied({ ...base, response: { status: 500, body: {} } }).verdict, 'failed');
  assert.equal(evaluateDenied({ ...base, response: { status: 200, body: {} } }).verdict, 'failed');
});
