import type { CheckRecord, RunEventRecord, RunRecord, Scenario } from '@fastforward/contracts';
import { SCENARIOS, formatClock } from './status';

/**
 * Turns real run checks into columns for the two-lane instrument.
 * Upper lane: Stripe's recorded subscription status. Lower lane: observed report access.
 * A column only shows an observation when the server returned one; otherwise it is "pending".
 */

export type Agreement = 'agree' | 'mismatch' | 'pending' | 'error';

export type LaneColumn = {
  key: string;
  group: string;        // "Original app" / "Repair attempt 1"
  moment: string;       // "New subscription" / "After failed payment"
  stripeStatus: string | null;
  expected: boolean;
  observed: boolean | null;
  agreement: Agreement;
  clock: string | null; // simulated Stripe test-clock date, when the server reported one
};

export type ScenarioLanes = { scenario: Scenario; customer: string; columns: LaneColumn[] };

const agreementOf = (check: CheckRecord): Agreement => {
  if (check.verdict === 'error') return 'error';
  if (check.verdict === 'pending' || check.observedAccess === null) return 'pending';
  return check.observedAccess === check.expectedAccess ? 'agree' : 'mismatch';
};

/** Expected access under the declared sample policy, before anything is observed. */
const PLANNED: Record<Scenario, [boolean, boolean]> = {
  healthy_renewal: [true, true],
  trial_payment_failure: [true, false],
};

type ClockReading = { phase: string; scenario: string; clockTime: number };

function clockReadings(events: RunEventRecord[]): ClockReading[][] {
  // Each "observed" event with data.observations belongs to one completed phase, in order.
  const phases: ClockReading[][] = [];
  for (const event of events) {
    const data = event.data;
    if (event.kind !== 'observation' || !data || !Array.isArray(data.observations)) continue;
    const phase = typeof data.phase === 'string' ? data.phase : 'unknown';
    phases.push((data.observations as unknown[]).flatMap(item => {
      const value = item as { scenario?: unknown; clockTime?: unknown };
      return typeof value.scenario === 'string' && typeof value.clockTime === 'number'
        ? [{ phase, scenario: value.scenario, clockTime: value.clockTime }] : [];
    }));
  }
  return phases;
}

export function buildLanes(run: RunRecord, events: RunEventRecord[]): ScenarioLanes[] {
  const readings = clockReadings(events);
  return run.scenarios.map(scenario => {
    const copy = SCENARIOS[scenario];
    const checks = run.checks.filter(check => check.scenario === scenario && check.customer !== 'Access boundary');

    // Group checks by phase prefix in the id: "<phase>-<attempt>-<n>-<scenario>-<initial|transition>".
    const groups: { key: string; phase: string; attempt: number; checks: CheckRecord[] }[] = [];
    for (const check of checks) {
      const [phase = 'phase', attemptText = '0', counter = '0'] = check.id.split('-');
      const key = `${phase}-${attemptText}-${counter}`;
      let group = groups.find(item => item.key === key);
      if (!group) { group = { key, phase, attempt: Number(attemptText) || 0, checks: [] }; groups.push(group); }
      group.checks.push(check);
    }

    const columns: LaneColumn[] = [];
    groups.forEach((group, index) => {
      const label = group.phase === 'baseline' ? 'Original app' : `Repair attempt ${group.attempt || index}`;
      const reading = readings[index]?.find(item => item.scenario === scenario) ?? null;
      for (const check of group.checks) {
        const isAfter = check.id.endsWith('-transition');
        columns.push({
          key: check.id, group: label,
          moment: isAfter ? copy.after : 'New subscription',
          stripeStatus: check.stripeStatus, expected: check.expectedAccess, observed: check.observedAccess,
          agreement: agreementOf(check),
          clock: isAfter && reading ? formatClock(reading.clockTime) : null,
        });
      }
    });

    // Before the first observation, show the planned original-app checkpoints as not yet observed.
    if (columns.length === 0) {
      const [first, second] = PLANNED[scenario];
      columns.push(
        { key: `${scenario}-plan-a`, group: 'Original app', moment: 'New subscription', stripeStatus: null, expected: first, observed: null, agreement: 'pending', clock: null },
        { key: `${scenario}-plan-b`, group: 'Original app', moment: copy.after, stripeStatus: null, expected: second, observed: null, agreement: 'pending', clock: null },
      );
    }
    return { scenario, customer: copy.customer, columns };
  });
}

export function boundaryChecks(run: RunRecord): CheckRecord[] {
  return run.checks.filter(check => check.customer === 'Access boundary');
}
