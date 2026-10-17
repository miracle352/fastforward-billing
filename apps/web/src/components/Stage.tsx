import type { RunEventRecord, RunRecord } from '@fastforward/contracts';
import { LaneInstrument, type Orientation } from './LaneInstrument';
import { HowItWorks } from './HowItWorks';
import { buildLanes, type LaneColumn } from '../lib/lanes';
import { SCENARIOS, STATUS_COPY, formatDateTime, isTerminal } from '../lib/status';

/**
 * The glass stage beside the headline. Before any test it holds the labelled
 * illustration; once the visitor has a real run, it shows only observed evidence.
 */

/** Keep the instrument legible: the original app plus the most recent repair attempt. */
function visibleColumns(columns: LaneColumn[]): { shown: LaneColumn[]; hidden: number } {
  const groups = [...new Set(columns.map(column => column.group))];
  if (groups.length <= 2) return { shown: columns, hidden: 0 };
  const keep = new Set([groups[0], groups[groups.length - 1]]);
  const shown = columns.filter(column => keep.has(column.group));
  return { shown, hidden: groups.length - 2 };
}

export function Stage({ run, events, orientation }: { run: RunRecord | null; events: RunEventRecord[]; orientation: Orientation }) {
  if (!run) {
    return (
      <section className="stage glass" aria-labelledby="stage-title">
        <header className="stage__head">
          <h2 id="stage-title" className="stage__title">How it works</h2>
          <span className="tag tag--quiet">Illustration · not a live result</span>
        </header>
        <HowItWorks orientation={orientation} />
      </section>
    );
  }

  const lanes = buildLanes(run, events);
  const live = !isTerminal(run.status);
  const status = STATUS_COPY[run.status];
  return (
    <section className="stage glass" aria-labelledby="stage-title">
      <header className="stage__head">
        <h2 id="stage-title" className="stage__title">{live ? 'Live evidence' : 'Recorded evidence'}</h2>
        <span className={`tag tag--${status.tone}`}>{live && <span className="dot" aria-hidden="true" />}{status.title}</span>
      </header>
      <p className="stage__meta">Started {formatDateTime(run.createdAt)} · Only what the server observed is drawn.</p>
      {lanes.map(lane => {
        const { shown, hidden } = visibleColumns(lane.columns);
        return (
          <figure key={lane.scenario} className="stage__lane">
            <figcaption className="stage__caption">
              <span className="stage__who">{lane.customer}</span>
              <span className="stage__what">{SCENARIOS[lane.scenario].label}</span>
            </figcaption>
            <LaneInstrument
              columns={shown}
              orientation={orientation}
              title={`${lane.customer}, ${SCENARIOS[lane.scenario].label}: Stripe billing state compared with observed report access`}
            />
            {hidden > 0 && <p className="stage__note">{hidden} earlier repair attempt{hidden > 1 ? 's are' : ' is'} listed in the evidence below.</p>}
          </figure>
        );
      })}
      <ul className="legend" aria-label="Legend">
        <li><span className="legend__swatch legend__swatch--agree" aria-hidden="true" />Agrees with the policy</li>
        <li><span className="legend__swatch legend__swatch--mismatch" aria-hidden="true" />Mismatch: wrong access</li>
        <li><span className="legend__swatch legend__swatch--pending" aria-hidden="true" />Not observed yet</li>
      </ul>
    </section>
  );
}
