import type { RunEventRecord, RunRecord, Scenario } from '@fastforward/contracts';
import { Activity } from 'lucide-react';
import { LaneInstrument, type Orientation } from './LaneInstrument';
import { buildLanes, plannedColumns, type LaneColumn } from '../lib/lanes';
import { SCENARIOS, STATUS_COPY, formatDateTime, isTerminal } from '../lib/status';

/** Keep the chart legible: the original app plus the most recent repair attempt. */
function visibleColumns(columns: LaneColumn[]): { shown: LaneColumn[]; hidden: number } {
  const groups = [...new Set(columns.map(column => column.group))];
  if (groups.length <= 2) return { shown: columns, hidden: 0 };
  const keep = new Set([groups[0], groups[groups.length - 1]]);
  return { shown: columns.filter(column => keep.has(column.group)), hidden: groups.length - 2 };
}

/** Step 3: the visitor's own results. Before a test, only the outline of what will be checked. */
export function Stage({ run, events, scenarios, orientation }: { run: RunRecord | null; events: RunEventRecord[]; scenarios: Scenario[]; orientation: Orientation }) {
  const lanes = run
    ? buildLanes(run, events)
    : scenarios.map(scenario => ({ scenario, customer: SCENARIOS[scenario].customer, columns: plannedColumns(scenario) }));
  const live = run !== null && !isTerminal(run.status);
  const tone = run ? STATUS_COPY[run.status].tone : 'neutral';

  return (
    <section className="app__main live" aria-labelledby="live-title">
      <div className="live__head">
        <div className="step__head">
          <span className="step__num">3</span>
          <h3 id="live-title" className="step__title">{run ? (live ? 'Watch it happen' : 'Your results') : 'Watch the results'}</h3>
        </div>
        {run && (
          <span className={`chip ${tone === 'good' ? 'chip--go' : tone === 'bad' ? 'chip--bad' : tone === 'warn' ? 'chip--wait' : ''}`}>
            {live && <span className="dot pulse" aria-hidden="true" />}{STATUS_COPY[run.status].title}
          </span>
        )}
      </div>
      {!run && (
        <p className="live__empty">
          <span><Activity size={18} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8 }} />Nothing has run yet.</span>
          <span>Each line below is one customer. The top track is what Stripe says; the bottom track is what the app does. Green means they agree, red means they don’t.</span>
        </p>
      )}
      {run && <p className="live__note">Started {formatDateTime(run.createdAt)}. Only what the server actually saw is drawn.</p>}
      {lanes.map(lane => {
        const { shown, hidden } = visibleColumns(lane.columns);
        return (
          <figure key={lane.scenario} className="live__lane">
            <figcaption className="live__who">{lane.customer} <span>· {SCENARIOS[lane.scenario].label}</span></figcaption>
            <LaneInstrument
              columns={shown}
              orientation={orientation}
              title={`${lane.customer}, ${SCENARIOS[lane.scenario].label}: what Stripe says compared with what the app did`}
            />
            {hidden > 0 && <p className="live__note">{hidden} earlier repair attempt{hidden > 1 ? 's are' : ' is'} listed with the checks below.</p>}
          </figure>
        );
      })}
      <ul className="legend" aria-label="Legend">
        <li><i className="is-agree" aria-hidden="true" />They agree</li>
        <li><i className="is-mismatch" aria-hidden="true" />They disagree</li>
        <li><i className="is-pending" aria-hidden="true" />Not checked yet</li>
      </ul>
    </section>
  );
}
