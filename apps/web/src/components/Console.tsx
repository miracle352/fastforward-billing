import { forwardRef } from 'react';
import { ArrowRight, CircleCheck, CircleX, LoaderCircle, RefreshCw, ShieldCheck, TriangleAlert, UserCheck, UserX, WifiOff } from 'lucide-react';
import type { ProviderReadinessRecord, Scenario } from '@fastforward/contracts';
import type { Fastforward } from '../api/useFastforward';
import type { ApiError } from '../api/client';
import { SCENARIOS, isTerminal } from '../lib/status';

/** The services a test needs, in words anyone can follow. Order is the order they are used. */
const SERVICES: { id: ProviderReadinessRecord['id']; name: string }[] = [
  { id: 'stripe', name: 'Stripe test customers' },
  { id: 'stripe_readonly', name: 'Read-only Stripe check' },
  { id: 'createos', name: 'Private sandbox (CreateOS)' },
  { id: 'groq', name: 'Repair writer (AI model)' },
];

const SCENARIO_ICONS: Record<Scenario, typeof UserX> = { healthy_renewal: UserCheck, trial_payment_failure: UserX };

function startProblem(error: ApiError): string {
  switch (error.code) {
    case 'BUSY': return 'Someone else is running a test right now. Tests run one at a time, so please try again in a couple of minutes.';
    case 'CLEANUP_PENDING': return 'The previous test is still tidying up. Please try again in a few minutes.';
    case 'OWNER_LIMIT': return 'You’ve used today’s tests. Your saved results are still below.';
    case 'GLOBAL_LIMIT': return 'Today’s demo tests have all been used. Saved results are still below.';
    case 'SETUP_NEEDED': return 'The server isn’t accepting new tests right now, so nothing was started.';
    case 'ADMISSION_PAUSED': return 'New tests are paused right now, so nothing was started. Saved results stay available.';
    case 'INPUT_INVALID': return 'Choose at least one thing to test.';
    case 'CSRF_INVALID': return 'Your session expired. Please refresh the page and try again. Nothing was started.';
    case 'ORIGIN_INVALID': return 'Tests can only be started from Fastforward’s own address. Nothing was started.';
    default: return error.message;
  }
}

type Props = { ff: Fastforward; scenarios: Scenario[]; onScenarios: (next: Scenario[]) => void; onStart: () => void };

export const Console = forwardRef<HTMLButtonElement, Props>(function Console({ ff, scenarios, onScenarios, onStart }, buttonRef) {
  const { connection, readiness, run, starting, startError, startOutcome } = ff;
  const running = run !== null && !isTerminal(run.status);
  const ready = connection === 'online' && readiness?.ready === true;
  const disabled = !ready || running || starting || scenarios.length === 0;

  const toggle = (id: Scenario) =>
    onScenarios(scenarios.includes(id) ? scenarios.filter(item => item !== id) : ([...scenarios, id].sort() as Scenario[]));

  let label = 'Test my billing';
  if (startOutcome === 'checking') label = 'Checking whether it started…';
  else if (starting) label = 'Starting…';
  else if (running) label = 'Your test is running';

  return (
    <div className="app__side">
      <div className="step">
        <div className="step__head"><span className="step__num">1</span><h3 className="step__title">Choose what to test</h3></div>
        <fieldset className="scenarios" disabled={running || starting}>
          <legend className="visually-hidden">What to test</legend>
          {(Object.keys(SCENARIOS) as Scenario[]).map(id => {
            const Icon = SCENARIO_ICONS[id];
            return (
              <label key={id} className="scenario">
                <input type="checkbox" checked={scenarios.includes(id)} onChange={() => toggle(id)} />
                <span className="scenario__icon" aria-hidden="true"><Icon size={22} /></span>
                <span>
                  <span className="scenario__label">{SCENARIOS[id].label}</span>
                  <span className="scenario__line">{SCENARIOS[id].line}</span>
                </span>
                <span className="check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </label>
            );
          })}
          {scenarios.length === 0 && <p className="muted" role="status">Choose at least one.</p>}
        </fieldset>
      </div>

      <div className="step">
        <div className="step__head"><span className="step__num">2</span><h3 className="step__title">Start the test</h3></div>
        <Services ff={ff} />
        <div className="start-row">
          <button ref={buttonRef} type="button" className="btn btn--lg" disabled={disabled} aria-describedby="readiness-line" onClick={onStart}>
            {(starting || startOutcome === 'checking') && <LoaderCircle className="spin" aria-hidden="true" size={20} />}
            <span>{label}</span>
            {!starting && !running && <ArrowRight aria-hidden="true" size={20} className="arrow" />}
          </button>
          {running && <a className="link-btn" href="#run">Follow your test below</a>}
          <p className="reassure"><ShieldCheck size={18} aria-hidden="true" />Runs on our demo subscription app with Stripe test customers and simulated dates. No real money moves.</p>
        </div>

        {startOutcome === 'recovered' && (
          <div className="notice notice--good" role="status"><CircleCheck aria-hidden="true" size={20} />
            <div><p>Your test did start. The reply got lost on the way back, so we found it in your history.</p></div></div>
        )}
        {startError && (startOutcome === 'not-found' || startOutcome === 'unknown') && (
          <div className="notice notice--warn" role="alert"><TriangleAlert aria-hidden="true" size={20} />
            <div>{startOutcome === 'not-found'
              ? <p>The connection dropped before we heard back. No new test appears in your history, so it’s safe to try again.</p>
              : <p>The connection dropped before we heard back and we couldn’t check your history yet. A test may have started, so please reload the page before trying again.</p>}</div></div>
        )}
        {startError && !startOutcome && (
          <div className="notice notice--bad" role="alert"><TriangleAlert aria-hidden="true" size={20} />
            <div>
              <p>{startProblem(startError)}</p>
              {startError.blockers.length > 0 && (
                <ul className="notice__list notice__list--open">{startError.blockers.map(item => <li key={item}>{item}</li>)}</ul>
              )}
            </div></div>
        )}
      </div>
    </div>
  );
});

function Services({ ff }: { ff: Fastforward }) {
  const { connection, readiness, readinessError, checkingReadiness, refreshReadiness, retryConnection, run } = ff;
  const running = run !== null && !isTerminal(run.status);

  if (connection === 'offline') {
    return (
      <div id="readiness-line" className="notice notice--bad"><WifiOff size={20} aria-hidden="true" />
        <div><p>We can’t reach the Fastforward server right now, so a test can’t start. We’ll keep trying.</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={retryConnection}>Try again now</button></div></div>
    );
  }

  const byId = new Map(readiness?.providers.map(item => [item.id, item]) ?? []);
  const anyDown = readiness ? !readiness.ready : false;
  const providersDown = readiness ? readiness.providers.some(item => item.status !== 'ready') : false;
  return (
    <div className="services" id="readiness-line" aria-live="polite">
      {SERVICES.map(service => {
        const status = byId.get(service.id);
        const state = !readiness ? 'checking' : status?.status === 'ready' ? 'ready' : 'down';
        return (
          <div key={service.id} className={`service is-${state}`}>
            <span className="service__dot" aria-hidden="true">
              {state === 'checking' ? <LoaderCircle size={18} className="spin" /> : state === 'ready' ? <CircleCheck size={18} /> : <CircleX size={18} />}
            </span>
            <span>{service.name}</span>
            <span className="service__state">{state === 'checking' ? 'Checking…' : state === 'ready' ? 'Ready' : 'Not ready'}</span>
            {state === 'down' && status?.message && <span className="service__msg">{status.message}</span>}
          </div>
        );
      })}
      {connection === 'connecting' && <p className="muted">Connecting…</p>}
      {running && <p className="muted">Tests run one at a time. Yours is in progress.</p>}
      {(anyDown || (!readiness && readinessError)) && (
        <div className="notice notice--warn notice--prominent" id="test-blocker" tabIndex={-1} role="status"><TriangleAlert size={22} aria-hidden="true" />
          <div>
            <p className="notice__title">{!readiness ? 'We couldn’t confirm the test can start.'
              : providersDown ? 'A test can’t start: a service above isn’t ready.'
              : 'New tests are paused right now.'}</p>
            {readiness && readiness.blockers.length > 0 && (
              <ul className="notice__list notice__list--open">{readiness.blockers.map(item => <li key={item}>{item}</li>)}</ul>
            )}
            {!readiness && readinessError && <p>{readinessError.message}</p>}
            <p className="muted">{providersDown ? 'Nothing was started, and we won’t show a pretend result.' : 'All services are working; the server simply isn’t accepting new tests at the moment. Saved results stay available. Please check again shortly.'}</p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={refreshReadiness} disabled={checkingReadiness}>
              <RefreshCw size={16} aria-hidden="true" className={checkingReadiness ? 'spin' : undefined} />{checkingReadiness ? 'Checking…' : 'Check again'}
            </button>
          </div></div>
      )}
    </div>
  );
}
