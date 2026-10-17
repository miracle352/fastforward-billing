import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Check as CheckIcon, CircleDot, CircleSlash, Code, Download, FileText, LoaderCircle, Octagon, ShieldCheck, TriangleAlert, X,
} from 'lucide-react';
import type { ArtifactRecord, CheckRecord, RunEventRecord, RunRecord } from '@fastforward/contracts';
import type { Fastforward } from '../api/useFastforward';
import { getArtifactText, isAbort } from '../api/client';
import {
  SCENARIOS, STAGES, STATUS_COPY, accessLabel, expectedLabel, formatDateTime, formatTime, isTerminal, stageOf, stripeLabel,
  type RunStatus, type StageId,
} from '../lib/status';

const EASE = [0.22, 1, 0.36, 1] as const;

/** The visitor's own run: status, stages, verdict, checks, activity and files. Server data only. */
export function RunDetails({ ff }: { ff: Fastforward }) {
  const { run, events, feed, runs, selectRun } = ff;
  return (
    <>
      {run && <RunView ff={ff} run={run} events={events} feed={feed} />}
      {runs.length > 1 && (
        <div className="history">
          <label htmlFor="run-history">Your earlier tests</label>
          <select id="run-history" className="select" value={run?.id ?? ''} onChange={event => selectRun(event.target.value)}>
            {runs.map(item => (
              <option key={item.id} value={item.id}>{formatDateTime(item.createdAt)} — {STATUS_COPY[item.status].title}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

function RunView({ ff, run, events, feed }: { ff: Fastforward; run: RunRecord; events: RunEventRecord[]; feed: Fastforward['feed'] }) {
  const status = STATUS_COPY[run.status];
  const terminal = isTerminal(run.status);
  const reached = useMemo(() => {
    const statuses = new Set<RunStatus>([run.status]);
    for (const event of events) {
      const value = event.data?.status;
      if (event.kind === 'status' && typeof value === 'string') statuses.add(value as RunStatus);
    }
    return new Set([...statuses].map(stageOf).filter((id): id is StageId => id !== null));
  }, [events, run.status]);
  const current = stageOf(run.status);

  return (
    <div className="run" id="run">
      <div className="run__head">
        <div>
          <p className={`run__status tone-${status.tone}`}>
            <StatusGlyph status={run.status} />
            <span>{status.title}</span>
          </p>
          {/* Polite announcement of phase changes only; the activity log itself is not live. */}
          <p className="run__phase" aria-live="polite">{run.phase}</p>
          <p className="run__meta">
            {run.scenarios.map(id => SCENARIOS[id].label).join(' and ')} · started {formatDateTime(run.createdAt)}
            {run.attempt > 0 && <> · repair attempt {run.attempt} of {run.maxAttempts}</>}
          </p>
        </div>
        <div className="run__controls">
          <FeedState feed={feed} terminal={terminal} />
          {!terminal && run.status !== 'cancel_requested' && (
            <button type="button" className="btn btn--ghost" onClick={ff.cancel} disabled={ff.cancelling}>
              {ff.cancelling ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Octagon size={16} aria-hidden="true" />}
              {ff.cancelling ? 'Asking to stop…' : 'Stop this test'}
            </button>
          )}
        </div>
      </div>
      {run.status === 'cancel_requested' && (
        <p className="notice notice--warn">Stop requested. The server is cleaning up test customers and the sandbox; this page will say when cleanup is confirmed.</p>
      )}
      {ff.cancelError && <p className="notice notice--bad" role="alert">The stop request did not reach the server: {ff.cancelError.message} The test may still be running.</p>}

      <ol className="stages" data-ui aria-label="Test stages, as reported by the server">
        {STAGES.map(stage => {
          const state = stage.id === current ? 'current' : reached.has(stage.id) ? 'done' : 'todo';
          return (
            <li key={stage.id} className={`is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="tick" aria-hidden="true" />
              <span>{stage.id === 'result' && terminal ? status.title : stage.label}</span>
              <span className="visually-hidden">{state === 'done' ? ' (reached)' : state === 'current' ? ' (current)' : ' (not reached)'}</span>
            </li>
          );
        })}
      </ol>

      {terminal && <Verdict run={run} />}

      <div className="run__grid">
        <Checks run={run} />
        <Activity events={events} />
      </div>

      <Artifacts run={run} />
    </div>
  );
}

function StatusGlyph({ status }: { status: RunStatus }) {
  if (status === 'passed') return <ShieldCheck size={22} aria-hidden="true" />;
  if (status === 'failed' || status === 'blocked') return <TriangleAlert size={22} aria-hidden="true" />;
  if (status === 'cancelled') return <CircleSlash size={22} aria-hidden="true" />;
  if (status === 'interrupted' || status === 'cancel_requested') return <TriangleAlert size={22} aria-hidden="true" />;
  return <LoaderCircle size={22} className="spin" aria-hidden="true" />;
}

function FeedState({ feed, terminal }: { feed: Fastforward['feed']; terminal: boolean }) {
  if (terminal) return <span className="feed">Finished · no longer updating</span>;
  if (feed === 'reconnecting') return <span className="feed feed--warn" role="status">Reconnecting… the test keeps running on the server.</span>;
  return <span className="feed"><span className="dot dot--live" aria-hidden="true" /> Live from the server</span>;
}

function Verdict({ run }: { run: RunRecord }) {
  const reduce = useReducedMotion();
  const checks = run.checks;
  const failed = checks.filter(check => check.verdict === 'failed' || check.verdict === 'error');
  const originalFailures = failed.filter(check => check.checkpoint.startsWith('baseline')).length;
  const laterFailures = failed.length - originalFailures;
  const copy: Record<string, string> = {
    passed: 'The fixed checks passed for the supported sample app and the scenarios you chose. That is the whole claim: it is not a review of any other billing code.',
    failed: 'Fastforward did not get every check to pass within its bounded repair attempts. The failed checks are kept below exactly as they were observed.',
    blocked: 'A required service refused or failed, so the test could not finish. No result was assumed.',
    cancelled: 'You stopped this test and the server confirmed cleanup. No result was assumed.',
    interrupted: 'The test stopped before a result, for example because the worker restarted. No result was assumed.',
  };
  return (
    <motion.div
      className={`verdict verdict--${run.status}`}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <h3 className="verdict__title">{STATUS_COPY[run.status].title}</h3>
      {run.summary && <p className="verdict__summary">{run.summary}</p>}
      <p>{copy[run.status]}</p>
      {run.error && <p className="verdict__error">Reason recorded by the server: {run.error}</p>}
      {checks.length > 0 && (
        <p className="verdict__count">
          {checks.length - failed.length} of {checks.length} recorded checks passed.
          {originalFailures > 0 && <> {originalFailures} failure{originalFailures > 1 ? 's' : ''} came from the original app and {originalFailures > 1 ? 'are' : 'is'} kept as evidence of the bug.</>}
          {laterFailures > 0 && <> {laterFailures} failed after a repair was installed.</>}
        </p>
      )}
    </motion.div>
  );
}

function verdictText(check: CheckRecord) {
  if (check.verdict === 'passed') return 'Pass';
  if (check.verdict === 'failed') return 'Fail';
  if (check.verdict === 'error') return 'Error';
  return 'Waiting';
}

function Checks({ run }: { run: RunRecord }) {
  const groups = useMemo(() => {
    const map = new Map<string, CheckRecord[]>();
    for (const check of run.checks) {
      const phase = check.checkpoint.split(':')[0] ?? 'checks';
      map.set(phase, [...(map.get(phase) ?? []), check]);
    }
    return [...map.entries()];
  }, [run.checks]);

  return (
    <section className="panel" aria-labelledby="checks-title">
      <h3 id="checks-title" className="panel__title">Access checks</h3>
      {groups.length === 0 ? (
        <p className="panel__empty">No checks observed yet. They appear after the first real report request.</p>
      ) : groups.map(([phase, checks]) => (
        <div key={phase} className="checks" data-ui>
          <h4 className="group-title">{phase === 'baseline' ? 'Original app' : phase === 'verification' ? 'Repaired app, fresh customers' : phase}</h4>
          <ul className="checks__list">
            {checks.map(check => (
              <li key={check.id} className={`check-row is-${check.verdict}`}>
                <span className="check__verdict">
                  {check.verdict === 'passed' ? <CheckIcon size={16} aria-hidden="true" /> : check.verdict === 'pending' ? <CircleDot size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                  {verdictText(check)}
                </span>
                <span className="check__who">{check.customer}<span className="check__when"> · {check.checkpoint.split(':').slice(1).join(':').trim() || check.checkpoint}</span></span>
                <dl>
                  <div><dt>Stripe</dt><dd>{check.customer === 'Access boundary' ? 'Not applicable' : stripeLabel(check.stripeStatus)}</dd></div>
                  <div><dt>Expected</dt><dd>{expectedLabel(check.expectedAccess)}</dd></div>
                  <div><dt>Observed</dt><dd>{accessLabel(check.observedAccess)}</dd></div>
                </dl>
                {check.message && <p className="check__message">{check.message}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

const KIND_LABEL: Record<RunEventRecord['kind'], string> = {
  status: 'Step', observation: 'Observed', model: 'Repair written', execution: 'Ran in sandbox',
  check: 'Check', cleanup: 'Cleanup', error: 'Problem',
};

function Activity({ events }: { events: RunEventRecord[] }) {
  const reduce = useReducedMotion();
  return (
    <section className="panel" aria-labelledby="activity-title">
      <h3 id="activity-title" className="panel__title">Activity</h3>
      {events.length === 0 ? (
        <p className="panel__empty">Waiting for the first event from the server.</p>
      ) : (
        <ol className="activity" data-ui tabIndex={0} aria-label="Activity reported by the server, oldest first">
          <AnimatePresence initial={false}>
            {events.map(event => (
              <motion.li
                key={event.id}
                className={`event kind-${event.kind}`}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: EASE }}
              >
                <span className="event__kind">{KIND_LABEL[event.kind]}</span>
                <time className="event__time" dateTime={event.createdAt}>{formatTime(event.createdAt)}</time>
                <p className="event__message">{event.message}</p>
                {event.data && Object.keys(event.data).length > 0 && (
                  <details className="event__data">
                    <summary>Technical record</summary>
                    <pre className="code">{JSON.stringify(event.data, null, 2).slice(0, 6000)}</pre>
                  </details>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}

const ARTIFACT_COPY: Record<ArtifactRecord['kind'], { label: string; icon: typeof FileText }> = {
  source: { label: 'Proposed repair: generated handler source', icon: Code },
  patch: { label: 'The accepted repair, as a patch', icon: FileText },
  execution: { label: 'Sandbox execution record', icon: FileText },
  report: { label: 'Verification report', icon: ShieldCheck },
};

function Artifacts({ run }: { run: RunRecord }) {
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState<string>('');
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const view = async (artifact: ArtifactRecord) => {
    if (open === artifact.id) { setOpen(null); return; }
    setOpen(artifact.id); setState('loading'); setText('');
    try {
      const content = await getArtifactText(artifact.downloadUrl);
      setText(content.length > 60_000 ? `${content.slice(0, 60_000)}\n… (truncated here; download for the full file)` : content);
      setState('idle');
    } catch (caught) {
      if (!isAbort(caught)) setState('error');
    }
  };

  return (
    <section className="panel" aria-labelledby="files-title">
      <h3 id="files-title" className="panel__title">Files from this test</h3>
      {run.artifacts.length === 0 ? (
        <p className="panel__empty">No files yet. Files appear only when the server saves them: the generated source, the patch, the sandbox record and the report.</p>
      ) : (
        <ul className="files" data-ui>
          {run.artifacts.map(artifact => {
            const meta = ARTIFACT_COPY[artifact.kind];
            const Icon = meta.icon;
            return (
              <li key={artifact.id} className="file">
                <Icon size={20} aria-hidden="true" className="file__icon" />
                <span className="file__text">
                  <span className="file__label">{meta.label}</span>
                  <span className="file__name">{artifact.name} · <span title={artifact.sha256}>sha256 {artifact.sha256.slice(0, 12)}…</span></span>
                </span>
                <span className="file__actions">
                  <button type="button" className="btn btn--ghost btn--sm" aria-expanded={open === artifact.id} aria-controls={`artifact-${artifact.id}`} onClick={() => void view(artifact)}>
                    {open === artifact.id ? 'Hide' : 'View'}
                  </button>
                  <a className="btn btn--ghost btn--sm" href={artifact.downloadUrl} download={artifact.name}>
                    <Download size={16} aria-hidden="true" /> Download
                  </a>
                </span>
                {open === artifact.id && (
                  <div id={`artifact-${artifact.id}`} className="file__viewer">
                    {state === 'loading' && <p className="panel__empty">Opening…</p>}
                    {state === 'error' && <p className="notice notice--bad">This file could not be opened. Try the download link.</p>}
                    {state === 'idle' && <pre className="code" tabIndex={0} aria-label={`Contents of ${artifact.name}`}>{text}</pre>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
