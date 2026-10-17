import type { RunRecord } from '@fastforward/contracts';

export type RunStatus = RunRecord['status'];

export const TERMINAL: ReadonlySet<RunStatus> = new Set(['passed', 'failed', 'blocked', 'cancelled', 'interrupted']);
export const isTerminal = (status: RunStatus) => TERMINAL.has(status);

/** Discrete stages of a real run, in server order. Used as labelled ticks, never as a percentage. */
export const STAGES = [
  { id: 'prepare', label: 'Preparing', statuses: ['queued', 'provisioning'] },
  { id: 'baseline', label: 'Checking the original app', statuses: ['baseline'] },
  { id: 'repair', label: 'Writing a repair', statuses: ['repairing'] },
  { id: 'verify', label: 'Checking with fresh test customers', statuses: ['verifying'] },
  { id: 'result', label: 'Result', statuses: ['passed', 'failed', 'blocked', 'cancelled', 'interrupted'] },
] as const satisfies ReadonlyArray<{ id: string; label: string; statuses: readonly RunStatus[] }>;

export type StageId = (typeof STAGES)[number]['id'];

export function stageOf(status: RunStatus): StageId | null {
  return STAGES.find(stage => (stage.statuses as readonly RunStatus[]).includes(status))?.id ?? null;
}

/** Plain-English headline for each server status. Never claims more than the status says. */
export const STATUS_COPY: Record<RunStatus, { title: string; tone: 'neutral' | 'live' | 'good' | 'warn' | 'bad' }> = {
  queued: { title: 'Waiting to start', tone: 'live' },
  provisioning: { title: 'Preparing the test environment', tone: 'live' },
  baseline: { title: 'Checking the original app', tone: 'live' },
  repairing: { title: 'Writing a repair', tone: 'live' },
  verifying: { title: 'Checking the repair with fresh test customers', tone: 'live' },
  cancel_requested: { title: 'Stopping — waiting for cleanup to be confirmed', tone: 'warn' },
  passed: { title: 'Supported checks passed', tone: 'good' },
  failed: { title: 'Checks did not all pass', tone: 'bad' },
  blocked: { title: 'A required service stopped the test', tone: 'bad' },
  cancelled: { title: 'Stopped. Cleanup confirmed', tone: 'neutral' },
  interrupted: { title: 'Interrupted before a result', tone: 'warn' },
};

export const SCENARIOS = {
  healthy_renewal: {
    label: 'Healthy renewal',
    line: 'A paying customer renews. They must keep their report.',
    customer: 'Maya',
    after: 'After renewal',
  },
  trial_payment_failure: {
    label: 'Failed trial payment',
    line: 'A trial ends and the card fails. Access must close.',
    customer: 'Leo',
    after: 'After failed payment',
  },
} as const;

/** Stripe subscription statuses, humanised. Unknown values pass through untouched. */
export function stripeLabel(status: string | null): string {
  if (status === null) return 'Not read yet';
  const map: Record<string, string> = {
    active: 'Active', trialing: 'Trialing', past_due: 'Past due', unpaid: 'Unpaid', canceled: 'Canceled',
    incomplete: 'Incomplete', incomplete_expired: 'Expired', paused: 'Paused',
  };
  return map[status] ?? status;
}

export function accessLabel(observed: boolean | null): string {
  if (observed === null) return 'Not observed yet';
  return observed ? 'Report opened' : 'Report blocked';
}

export const expectedLabel = (expected: boolean) => (expected ? 'Should open' : 'Should stay closed');

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Stripe test clock time (unix seconds) → a plain simulated date. */
export function formatClock(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
