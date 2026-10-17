import { ArrowRight, LoaderCircle, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react';
import type { ProviderReadinessRecord, Scenario } from '@fastforward/contracts';
import type { Fastforward } from '../api/useFastforward';
import type { ApiError } from '../api/client';
import { SCENARIOS, formatDateTime, isTerminal } from '../lib/status';

const PROVIDER_NAMES: Record<ProviderReadinessRecord['id'], string> = {
  stripe: 'Stripe test mode',
  stripe_readonly: 'Stripe read-only test key',
  createos: 'CreateOS sandbox',
  groq: 'Repair model (Groq)',
};

const PROVIDER_STATUS: Record<ProviderReadinessRecord['status'], string> = {
  ready: 'Ready', unchecked: 'Not checked yet', unconfigured: 'Not connected', error: 'Problem',
};

/** Plain-language copy for a refused start. The server's own message follows it. */
function startProblem(error: ApiError): string {
  if (error.kind === 'network' || error.kind === 'unavailable') return 'The test did not start because this page lost contact with the server. Nothing ran.';
  switch (error.code) {
    case 'BUSY': return 'Another test is using the shared sandbox right now. Try again once it finishes.';
    case 'CLEANUP_PENDING': return 'The previous test environment is still being cleaned up. Try again in a few minutes.';
    case 'OWNER_LIMIT':
    case 'GLOBAL_LIMIT': return 'Today’s demonstration allowance has been used. Saved results stay available below.';
    case 'SETUP_NEEDED': return 'The test services are not all ready, so nothing was started.';
    case 'INPUT_INVALID': return 'Choose at least one scenario.';
    case 'CSRF_INVALID': return 'Your session expired. Refresh the page and try again. Nothing ran.';
    case 'ORIGIN_INVALID': return 'The server only accepts tests started from its own web address, so nothing ran. Open Fastforward from its main address and try again.';
    default: return error.message;
  }
}

type Props = {
  ff: Fastforward;
  scenarios: Scenario[];
  onScenarios: (next: Scenario[]) => void;
  onStart: () => void;
};

export function Console({ ff, scenarios, onScenarios, onStart }: Props) {
  const { connection, readiness, readinessError, run, starting, startError } = ff;
  const running = run !== null && !isTerminal(run.status);
  const ready = connection === 'online' && readiness?.ready === true;
  const disabled = !ready || running || starting || scenarios.length === 0;

  const toggle = (id: Scenario) =>
    onScenarios(scenarios.includes(id) ? scenarios.filter(item => item !== id) : [...scenarios, id].sort() as Scenario[]);

  let buttonLabel = 'Test my billing';
  if (starting) buttonLabel = 'Starting the test…';
  else if (running) buttonLabel = 'Test in progress';

  return (
    <div className="console">
      <fieldset className="scenarios" disabled={running || starting}>
        <legend className="scenarios__legend">Scenarios to run</legend>
        {(Object.keys(SCENARIOS) as Scenario[]).map(id => (
          <label key={id} className="scenario">
            <input type="checkbox" checked={scenarios.includes(id)} onChange={() => toggle(id)} />
            <span className="scenario__box" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="16" height="16"><path d="M3.5 8.5l3 3 6-7" /></svg>
            </span>
            <span className="scenario__text">
              <span className="scenario__label">{SCENARIOS[id].label}</span>
              <span className="scenario__line">{SCENARIOS[id].line}</span>
            </span>
          </label>
        ))}
        {scenarios.length === 0 && <p className="field-note" role="status">Choose at least one scenario.</p>}
      </fieldset>

      <div className="console__action">
        <button type="button" className="btn btn--primary" disabled={disabled} aria-describedby="readiness-line" onClick={onStart}>
          {starting ? <LoaderCircle className="spin" aria-hidden="true" size={20} /> : null}
          <span>{buttonLabel}</span>
          {!starting && !running ? <ArrowRight aria-hidden="true" size={20} className="btn__arrow" /> : null}
        </button>
        {running && <a className="link" href="#evidence">Follow it live</a>}
      </div>

      <ReadinessLine ff={ff} />

      {startError && (
        <div className="notice notice--bad" role="alert">
          <TriangleAlert aria-hidden="true" size={18} />
          <div>
            <p>{startProblem(startError)}</p>
            {startError.blockers.length > 0 && (
              <ul className="notice__list">{startError.blockers.map(item => <li key={item}>{item}</li>)}</ul>
            )}
          </div>
        </div>
      )}

      {readiness && readiness.providers.length > 0 && (
        <details className="details">
          <summary>Connection details</summary>
          <ul className="providers">
            {readiness.providers.map(provider => (
              <li key={provider.id} className={`provider is-${provider.status}`}>
                <span className="provider__name">{PROVIDER_NAMES[provider.id]}</span>
                <span className="provider__status">{PROVIDER_STATUS[provider.status]}</span>
                <span className="provider__message">{provider.message}</span>
                {provider.checkedAt && <span className="provider__time">Checked {formatDateTime(provider.checkedAt)}</span>}
              </li>
            ))}
          </ul>
          <p className="details__note">These checks are run by the server. You never need to enter a key or password here.</p>
        </details>
      )}
      {readinessError && !readiness && <p className="field-note">Readiness could not be checked: {readinessError.message}</p>}
    </div>
  );
}

function ReadinessLine({ ff }: { ff: Fastforward }) {
  const { connection, readiness, run, checkingReadiness, refreshReadiness, retryConnection } = ff;
  const running = run !== null && !isTerminal(run.status);

  if (connection === 'connecting') {
    return <p id="readiness-line" className="status-line"><LoaderCircle className="spin" size={16} aria-hidden="true" /><span>Connecting to the test server…</span></p>;
  }
  if (connection === 'offline') {
    return (
      <div id="readiness-line" className="status-line status-line--bad">
        <WifiOff size={16} aria-hidden="true" />
        <span>This page can’t reach the Fastforward server, so nothing can be tested right now. It will keep trying.</span>
        <button type="button" className="btn btn--quiet btn--small" onClick={retryConnection}>Try now</button>
      </div>
    );
  }
  if (running) {
    return <p id="readiness-line" className="status-line"><span>One test runs at a time. Yours is in progress.</span></p>;
  }
  if (!readiness) {
    return (
      <div id="readiness-line" className="status-line status-line--warn">
        <span>Couldn’t confirm the test services are ready.</span>
        <CheckAgain busy={checkingReadiness} onClick={refreshReadiness} />
      </div>
    );
  }
  if (!readiness.ready) {
    return (
      <div id="readiness-line" className="status-line status-line--warn">
        <TriangleAlert size={16} aria-hidden="true" />
        <div>
          <span>A real test can’t start yet: some services are not ready. Nothing will be pretended.</span>
          {readiness.blockers.length > 0 && (
            <ul className="notice__list">{readiness.blockers.slice(0, 4).map(item => <li key={item}>{item}</li>)}</ul>
          )}
        </div>
        <CheckAgain busy={checkingReadiness} onClick={refreshReadiness} />
      </div>
    );
  }
  return (
    <p id="readiness-line" className="status-line status-line--good">
      <span className="dot" aria-hidden="true" /><span>Ready. Runs real Stripe test subscriptions against the sample app.</span>
    </p>
  );
}

function CheckAgain({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn btn--quiet btn--small" onClick={onClick} disabled={busy}>
      <RefreshCw size={14} aria-hidden="true" className={busy ? 'spin' : undefined} />
      {busy ? 'Checking…' : 'Check again'}
    </button>
  );
}
