import type { CheckRecord, ReadinessRecord, RunEventRecord, RunRecord, Scenario } from '@fastforward/contracts';
import { App } from '../App';
import type { Fastforward } from '../api/useFastforward';
import { ApiError } from '../api/client';

/**
 * DEVELOPMENT-ONLY design preview. Loaded only when import.meta.env.DEV and ?preview=<state>.
 * Every screen shows a persistent "Design preview · Not connected" banner. These shapes exist
 * to inspect layouts; they are not results and are never used by the connected app.
 */

const T0 = Date.parse('2026-10-17T21:00:00Z');
const at = (s: number) => new Date(T0 + s * 1000).toISOString();
const SCENARIOS: Scenario[] = ['healthy_renewal', 'trial_payment_failure'];

const readyProviders: ReadinessRecord['providers'] = [
  { id: 'stripe', status: 'ready', message: 'Preview text: provider check message.', checkedAt: at(0) },
  { id: 'stripe_readonly', status: 'ready', message: 'Preview text: provider check message.', checkedAt: at(0) },
  { id: 'createos', status: 'ready', message: 'Preview text: provider check message.', checkedAt: at(0) },
  { id: 'groq', status: 'ready', message: 'Preview text: provider check message.', checkedAt: at(0) },
];

function check(id: string, scenario: Scenario, checkpoint: string, expected: boolean, observed: boolean | null, stripe: string | null): CheckRecord {
  const customer = scenario === 'healthy_renewal' ? 'Maya' : 'Leo';
  const verdict = observed === null ? 'pending' : observed === expected ? 'passed' : 'failed';
  return { id, scenario, customer, checkpoint, expectedAccess: expected, observedAccess: observed, stripeStatus: stripe, verdict,
    message: verdict === 'failed' ? 'Preview: access did not match the declared policy.' : 'Preview: access matched the declared policy.', stripeObjectIds: [] };
}
function boundary(id: string, checkpoint: string): CheckRecord {
  return { id, scenario: 'healthy_renewal', customer: 'Access boundary', checkpoint, expectedAccess: false, observedAccess: false,
    stripeStatus: null, verdict: 'passed', message: 'Preview: request was refused as expected.', stripeObjectIds: [] };
}

const baseline: CheckRecord[] = [
  check('baseline-0-1-healthy_renewal-initial', 'healthy_renewal', 'baseline: initial subscription access', true, true, 'active'),
  check('baseline-0-1-trial_payment_failure-initial', 'trial_payment_failure', 'baseline: initial subscription access', true, true, 'trialing'),
  check('baseline-0-1-healthy_renewal-transition', 'healthy_renewal', 'baseline: after billing transition', true, true, 'active'),
  check('baseline-0-1-trial_payment_failure-transition', 'trial_payment_failure', 'baseline: after billing transition', false, true, 'past_due'),
  boundary('baseline-0-1-anonymous', 'baseline: unauthenticated report'),
];
const verification = (ok: boolean): CheckRecord[] => [
  check('verification-1-2-healthy_renewal-initial', 'healthy_renewal', 'verification: initial subscription access', true, true, 'active'),
  check('verification-1-2-trial_payment_failure-initial', 'trial_payment_failure', 'verification: initial subscription access', true, true, 'trialing'),
  check('verification-1-2-healthy_renewal-transition', 'healthy_renewal', 'verification: after billing transition', true, ok ? true : false, 'active'),
  check('verification-1-2-trial_payment_failure-transition', 'trial_payment_failure', 'verification: after billing transition', false, false, 'past_due'),
  boundary('verification-1-2-anonymous', 'verification: unauthenticated report'),
];

function events(upTo: number): RunEventRecord[] {
  const all: Omit<RunEventRecord, 'runId'>[] = [
    { id: 1, createdAt: at(1), kind: 'status', message: 'Preparing real test environments', data: { status: 'provisioning' } },
    { id: 2, createdAt: at(40), kind: 'observation', message: 'Preview: sample application observed.', data: null },
    { id: 3, createdAt: at(41), kind: 'status', message: 'Checking the original subscription integration', data: { status: 'baseline' } },
    { id: 4, createdAt: at(120), kind: 'check', message: 'Leo: Preview: access did not match the declared policy.', data: { verdict: 'failed' } },
    { id: 5, createdAt: at(121), kind: 'observation', message: 'Preview: Stripe records and report endpoints observed.', data: { phase: 'baseline', observations: [
      { scenario: 'healthy_renewal', status: 'active', clockTime: 1795000000 }, { scenario: 'trial_payment_failure', status: 'past_due', clockTime: 1795000000 }] } },
    { id: 6, createdAt: at(122), kind: 'status', message: 'Writing a repair from observed failures', data: { status: 'repairing' } },
    { id: 7, createdAt: at(140), kind: 'model', message: 'Preview: a new handler was returned; success not assumed.', data: { attempt: 1 } },
    { id: 8, createdAt: at(150), kind: 'execution', message: 'Preview: sandbox validator executed.', data: { attempt: 1, exitCode: 0 } },
    { id: 9, createdAt: at(151), kind: 'status', message: 'Testing the generated repair with fresh Stripe customers', data: { status: 'verifying' } },
    { id: 10, createdAt: at(230), kind: 'observation', message: 'Preview: Stripe records and report endpoints observed.', data: { phase: 'verification', observations: [
      { scenario: 'healthy_renewal', status: 'active', clockTime: 1797600000 }, { scenario: 'trial_payment_failure', status: 'past_due', clockTime: 1797600000 }] } },
    { id: 11, createdAt: at(240), kind: 'cleanup', message: 'Preview: cleanup confirmed.', data: null },
  ];
  return all.slice(0, upTo).map(item => ({ ...item, runId: 'preview-run' }));
}

function run(patch: Partial<RunRecord>): RunRecord {
  return {
    id: 'preview-run', status: 'queued', phase: 'Waiting for worker', createdAt: at(0), updatedAt: at(0),
    attempt: 0, maxAttempts: 3, scenarios: SCENARIOS, checks: [], artifacts: [], summary: null, error: null,
    sandboxId: null, previewUrl: null, testMode: true, policy: 'active_or_trialing_no_grace', ...patch,
  };
}

const artifacts: RunRecord['artifacts'] = [
  { id: 'a1', kind: 'source', name: 'billing-attempt-1.py', sha256: '0'.repeat(64), createdAt: at(140), downloadUrl: '/api/runs/preview-run/artifacts/a1' },
  { id: 'a2', kind: 'patch', name: 'billing-repair.patch', sha256: '1'.repeat(64), createdAt: at(235), downloadUrl: '/api/runs/preview-run/artifacts/a2' },
  { id: 'a3', kind: 'report', name: 'verification-report.json', sha256: '2'.repeat(64), createdAt: at(236), downloadUrl: '/api/runs/preview-run/artifacts/a3' },
];

type Shape = { run: RunRecord | null; events: RunEventRecord[]; readiness?: ReadinessRecord | null; connection?: Fastforward['connection']; feed?: Fastforward['feed']; startError?: ApiError | null };

const ready: ReadinessRecord = { ready: true, providers: readyProviders, blockers: [], testMode: true, activeRunId: null };

const SHAPES: Record<string, Shape> = {
  empty: { run: null, events: [] },
  'not-ready': { run: null, events: [], readiness: { ready: false, testMode: true, activeRunId: null, blockers: ['Preview blocker: a provider is not configured.'],
    providers: readyProviders.map((p, i) => i === 2 ? { ...p, status: 'unconfigured' as const } : p) } },
  offline: { run: null, events: [], readiness: null, connection: 'offline' },
  busy: { run: null, events: [], startError: new ApiError('http', 409, 'BUSY', 'Preview message.') },
  baseline: { run: run({ status: 'baseline', phase: 'Checking the original subscription integration' }), events: events(3), feed: 'live' },
  repairing: { run: run({ status: 'repairing', phase: 'Writing a repair from observed failures', attempt: 1, checks: baseline, artifacts: artifacts.slice(0, 1) }), events: events(7), feed: 'live' },
  reconnecting: { run: run({ status: 'verifying', phase: 'Testing the generated repair with fresh Stripe customers', attempt: 1, checks: baseline }), events: events(9), feed: 'reconnecting' },
  'cancel-requested': { run: run({ status: 'cancel_requested', phase: 'Cancellation requested; waiting for cleanup', attempt: 1, checks: baseline }), events: events(7), feed: 'live' },
  passed: { run: run({ status: 'passed', phase: 'Supported checks passed', attempt: 1, checks: [...baseline, ...verification(true)], artifacts,
    summary: 'Preview summary text.' }), events: events(11) },
  failed: { run: run({ status: 'failed', phase: 'Test stopped', attempt: 3, checks: [...baseline, ...verification(false)], artifacts: artifacts.slice(0, 1),
    summary: 'Preview summary text.', error: 'Preview error text.' }), events: events(11) },
  blocked: { run: run({ status: 'blocked', phase: 'Test stopped', error: 'Preview error text.' }), events: events(2) },
  interrupted: { run: run({ status: 'interrupted', phase: 'Worker interrupted; cleanup requires reconciliation', checks: baseline }), events: events(5) },
};

const noop = async () => null;

export function Preview({ state }: { state: string }) {
  const shape = SHAPES[state] ?? SHAPES.empty;
  const ff: Fastforward = {
    connection: shape.connection ?? 'online', connectionError: null, retryConnection: () => {},
    readiness: shape.readiness === undefined ? ready : shape.readiness, readinessError: null, checkingReadiness: false, refreshReadiness: noop,
    runs: shape.run ? [shape.run] : [], run: shape.run, events: shape.events, feed: shape.feed ?? 'idle', selectRun: () => {},
    start: noop, starting: false, startError: shape.startError ?? null, startOutcome: null,
    cancel: async () => {}, cancelling: false, cancelError: null,
  };
  return <App ff={ff} preview={`state “${SHAPES[state] ? state : 'empty'}”`} />;
}
