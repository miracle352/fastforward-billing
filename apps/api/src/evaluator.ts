import type { CheckRecord, Scenario } from '@fastforward/contracts';
import type { StripeObservation } from './providers/stripe.js';

export type ReportObservation = { status: number; body: unknown };
export type ReportPerson = { customerId: string; report: string; token: string; scenario: Scenario };
/** Fixed expectations live in the trusted controller, not in model-authored Python. */
export function evaluateReport(input: {
  id: string; checkpoint: string; person: ReportPerson; observation: StripeObservation;
  response: ReportObservation; expectedAccess?: boolean;
}): CheckRecord {
  const expectedAccess = input.expectedAccess ?? ['active', 'trialing'].includes(input.observation.status);
  const body = input.response.body as { customerId?: unknown; report?: unknown } | null;
  const observedAccess = input.response.status === 200;
  const correct = expectedAccess
    ? observedAccess && body?.customerId === input.person.customerId && body?.report === input.person.report
    : input.response.status === 403;
  return { id: input.id, scenario: input.person.scenario, customer: input.person.scenario === 'healthy_renewal' ? 'Maya' : 'Leo',
    checkpoint: input.checkpoint, expectedAccess, observedAccess, stripeStatus: input.observation.status,
    verdict: correct ? 'passed' : 'failed',
    message: correct ? (expectedAccess ? 'Authenticated customer received only their private report.' : 'Customer without an eligible subscription was denied.')
      : `Expected ${expectedAccess ? 'the correct private report' : 'access denied (403)'}; observed HTTP ${input.response.status}.`,
    stripeObjectIds: [input.observation.customerId, input.observation.subscriptionId, input.observation.clockId, ...(input.observation.invoiceId ? [input.observation.invoiceId] : [])] };
}

export function evaluateDenied(input: { id: string; checkpoint: string; scenario: Scenario; response: ReportObservation; expectedStatus: 401 | 403 }): CheckRecord {
  const correct = input.response.status === input.expectedStatus;
  return { id: input.id, scenario: input.scenario, customer: 'Access boundary', checkpoint: input.checkpoint,
    expectedAccess: false, observedAccess: input.response.status === 200, stripeStatus: null,
    verdict: correct ? 'passed' : 'failed', message: correct ? `Request correctly denied with HTTP ${input.expectedStatus}.`
      : `Expected denial HTTP ${input.expectedStatus}; observed HTTP ${input.response.status}.`, stripeObjectIds: [] };
}

export function failedChecks(checks: CheckRecord[]): string[] {
  return checks.filter(check => check.verdict !== 'passed').map(check => `${check.checkpoint}: ${check.customer}: ${check.message}; Stripe status=${check.stripeStatus ?? 'not applicable'}; expectedAccess=${check.expectedAccess}`);
}
