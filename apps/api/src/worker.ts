import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { Sandbox } from '@nodeops-createos/sandbox';
import type { CheckRecord, RunRecord } from '@fastforward/contracts';
import type { Config } from './config.js';
import { RunStore, StoreError, type ClaimedRun, type Lease } from './store.js';
import { getReadiness } from './readiness.js';
import { CreateOSProvider, GroqCodeProvider, StripeBillingProvider, ProviderError, boundedText, pollUntil,
  type FixtureResource, type StripeFixtureBundle, type StripeObservation } from './providers/index.js';
import { evaluateDenied, evaluateReport, failedChecks, type ReportObservation, type ReportPerson } from './evaluator.js';

type Resource = { kind: FixtureResource['kind'] | 'sandbox' | 'process'; id: string; cleaned?: boolean };
export type Evidence = {
  events: Array<{ id: string; type: string; object_id: string; customer_id: string | null; stripe_status: string | null }>;
  errors?: Array<{ event_id: string; type: string; object_id: string; run_id: string; error_type: string; message: string }>;
};
export class HandlerExecutionError extends Error {
  constructor(message: string) { super(message); this.name = 'HandlerExecutionError'; }
}
/** Only a trusted, phase-matched handler error may enter the model's retry feedback. */
export function assertHandlerEvidence(value: Evidence, fixtureRunId: string, subscriptionIds: Set<string>, phase: 'baseline' | 'verification') {
  const failures = (value.errors ?? []).filter(error => error.run_id === fixtureRunId && subscriptionIds.has(error.object_id));
  if (!failures.length) return;
  const providerFailure = failures.find(error => ['HTTPError', 'URLError', 'TimeoutError', 'ConnectionError', 'OSError', 'PermissionError'].includes(error.error_type));
  if (providerFailure) throw new ProviderError('stripe', 'APPLICATION_PROVIDER_READ_FAILED', 'The sample application could not complete its authoritative Stripe read. Provider access must be restored before retrying a repair.');
  if (phase === 'baseline') throw new ProviderError('sample', 'BASELINE_HANDLER_FAILED', 'The original fixture handler failed before a valid baseline could be established.');
  throw new HandlerExecutionError(failures.slice(0, 3).map(error => `${error.type}: ${error.error_type}: ${boundedText(error.message, 500)}`).join('\n'));
}
export function finalSubscriptionEventsObserved(value: Evidence, observations: StripeObservation[], beforeEvents: Set<string>): boolean {
  return observations.every(observation => value.events.some(item => !beforeEvents.has(item.id)
    && item.type === 'customer.subscription.updated' && item.object_id === observation.subscriptionId && item.stripe_status === observation.status));
}
const ROOT = '/tmp/fastforward';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const token = () => randomBytes(32).toString('hex');
const isGone = (error: unknown) => (error as { statusCode?: number; code?: string })?.statusCode === 404 ||
  ['HTTP_404', 'resource_missing'].includes(String((error as { code?: string })?.code));

// This validator is authored by the controller and runs ONLY inside CreateOS.
// It is a deliberately narrow Python interface, not a claim of general Python security.
const VALIDATOR = String.raw`import ast, hashlib, json, re, sys
from pathlib import Path
source = Path('/tmp/fastforward/candidate.py').read_text()
tree = ast.parse(source)
nodes = list(ast.walk(tree))
if len(nodes) > 1500: raise ValueError('Handler is too complex')
body = [n for n in tree.body if not (isinstance(n, ast.Expr) and isinstance(n.value, ast.Constant) and isinstance(n.value.value, str))]
if len(body) != 1 or not isinstance(body[0], ast.FunctionDef) or body[0].name != 'handle_event': raise ValueError('Only handle_event may be defined')
fn = body[0]
if [a.arg for a in fn.args.args] != ['event','db','stripe_get'] or fn.args.posonlyargs or fn.args.defaults or fn.args.kwonlyargs or fn.args.vararg or fn.args.kwarg or fn.decorator_list or fn.returns or any(a.annotation for a in fn.args.args): raise ValueError('Keep the supplied interface')
parents = {child: parent for parent in nodes for child in ast.iter_child_nodes(parent)}
reserved = {'event','db','stripe_get','handle_event','int','str','bool','dict','isinstance','len'}
for node in nodes:
    if isinstance(node, (ast.Import, ast.ImportFrom, ast.ClassDef, ast.AsyncFunctionDef, ast.Lambda, ast.While, ast.For, ast.AsyncFor, ast.With, ast.AsyncWith, ast.Global, ast.Nonlocal, ast.Delete, ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp, ast.Await, ast.Yield, ast.YieldFrom)): raise ValueError('Unsupported operation')
    if isinstance(node, ast.FunctionDef) and node is not fn: raise ValueError('Nested functions are forbidden')
    if isinstance(node, ast.Match): raise ValueError('Pattern bindings are forbidden')
    if isinstance(node, ast.Name) and isinstance(node.ctx, (ast.Store, ast.Del)) and node.id in reserved: raise ValueError('Reserved arguments and builtins cannot be rebound')
    if isinstance(node, ast.ExceptHandler) and node.name in reserved: raise ValueError('Reserved arguments and builtins cannot be rebound')
    if isinstance(node, ast.Name) and node.id.startswith('__'): raise ValueError('Private names are forbidden')
    if isinstance(node, ast.Name) and node.id == 'db' and isinstance(node.ctx, ast.Load):
        parent = parents.get(node)
        if not isinstance(parent, ast.Attribute) or parent.attr != 'execute' or parent.value is not node: raise ValueError('The supplied database cannot be aliased or passed elsewhere')
    if isinstance(node, ast.Name) and node.id == 'stripe_get' and isinstance(node.ctx, ast.Load):
        parent = parents.get(node)
        if not isinstance(parent, ast.Call) or parent.func is not node: raise ValueError('The Stripe reader must be called directly')
    if isinstance(node, ast.Attribute) and node.attr not in ('get','execute'): raise ValueError('Only dictionary get and access-table execute are supported')
    if isinstance(node, ast.Attribute) and node.attr == 'execute':
        parent = parents.get(node)
        if not isinstance(parent, ast.Call) or parent.func is not node: raise ValueError('Database execute cannot be aliased or returned')
    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name):
            if node.func.id not in ('stripe_get','int','str','bool','dict','isinstance','len'): raise ValueError('Unsupported function call')
        elif isinstance(node.func, ast.Attribute):
            if node.func.attr == 'execute':
                if not isinstance(node.func.value, ast.Name) or node.func.value.id != 'db': raise ValueError('Only supplied db may execute SQL')
                if not node.args or not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str): raise ValueError('SQL must be an explicit constant string')
                sql = node.args[0].value
                if not re.match(r'^\s*(?:INSERT(?:\s+OR\s+(?:REPLACE|IGNORE))?\s+INTO|UPDATE)\s+access\b', sql, re.I) or re.search(r';|--|/\*|\b(?:DROP|ALTER|DELETE|CREATE|ATTACH|PRAGMA|SELECT|FROM|UNION|JOIN)\b', sql, re.I): raise ValueError('SQL may only write the access table')
            elif node.func.attr != 'get': raise ValueError('Unsupported method')
        else: raise ValueError('Indirect calls are forbidden')
compile(tree, 'billing.py', 'exec')
print(json.dumps({'accepted': True, 'sha256': hashlib.sha256(source.encode()).hexdigest()}))
`;

async function http(url: string, path: string, signal: AbortSignal, init: RequestInit = {}): Promise<ReportObservation> {
  signal.throwIfAborted();
  const response = await fetch(new URL(path, url), { ...init, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) });
  const raw = await response.text();
  if (raw.length > 128_000) throw new Error('Sample application response exceeded the bounded size.');
  let body: unknown = null; try { body = JSON.parse(raw); } catch { /* Invalid data fails the fixed evaluator. */ }
  return { status: response.status, body };
}
async function controlled(url: string, path: string, controlToken: string, signal: AbortSignal, body?: unknown) {
  const result = await http(url, path, signal, { method: body === undefined ? 'GET' : 'POST', headers: {
    'X-Control-Token': controlToken, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (result.status !== 200) throw new Error(`Trusted sample setup or evidence request failed (HTTP ${result.status}).`);
  return result.body;
}

async function cleanupResources(resources: Resource[], stripe: StripeBillingProvider, createos: CreateOSProvider,
  options: { fixturesOnly?: boolean; onUpdate?: () => void } = {}): Promise<string[]> {
  const failures: string[] = [];
  // Clock deletion removes its associated test customers/subscriptions. Archive price/product explicitly.
  const order = ['webhook', 'clock', 'price', 'product', 'sandbox', 'process', 'customer', 'subscription'];
  for (const kind of order) for (const resource of resources.filter(item => item.kind === kind && !item.cleaned)) {
    if (options.fixturesOnly && ['webhook', 'sandbox', 'process'].includes(kind)) continue;
    if (['customer', 'subscription'].includes(kind)) {
      if (resources.filter(item => item.kind === 'clock').every(item => item.cleaned)) resource.cleaned = true;
      continue;
    }
    if (kind === 'process') {
      if (resources.filter(item => item.kind === 'sandbox').every(item => item.cleaned)) resource.cleaned = true;
      continue;
    }
    try {
      if (kind === 'webhook') await stripe.deleteWebhook(resource.id);
      else if (kind === 'clock') await stripe.controller.testHelpers.testClocks.del(resource.id);
      else if (kind === 'price') await stripe.controller.prices.update(resource.id, { active: false });
      else if (kind === 'product') await stripe.controller.products.update(resource.id, { active: false });
      else if (kind === 'sandbox') await createos.destroy(await createos.reconnect(resource.id));
      resource.cleaned = true;
    } catch (error) { if (isGone(error)) resource.cleaned = true; else failures.push(`${kind} cleanup not confirmed: ${resource.id}`); }
    options.onUpdate?.();
  }
  return failures;
}

export async function executeRun(config: Config, store: RunStore, claimed: ClaimedRun, shutdown?: AbortSignal): Promise<void> {
  const { run, lease } = claimed;
  const abort = new AbortController();
  const signal = shutdown ? AbortSignal.any([abort.signal, shutdown, AbortSignal.timeout(config.runTimeoutMs)])
    : AbortSignal.any([abort.signal, AbortSignal.timeout(config.runTimeoutMs)]);
  const stripe = new StripeBillingProvider(config.stripe);
  const createos = new CreateOSProvider(config.createos);
  const groq = new GroqCodeProvider(config.groq);
  let resources: Resource[] = [];
  let sandbox: Sandbox | undefined;
  let checks: CheckRecord[] = [];
  let phaseCounter = 0;
  let desired: 'passed' | 'failed' | 'blocked' = 'failed';
  let summary = 'No successful repair was observed.';
  let errorMessage: string | undefined;
  const persist = () => store.setMetadata(run.id, 'resources', resources, lease);
  const track = (resource: Resource) => { resources.push(resource); persist(); };
  const event = (kind: 'status' | 'observation' | 'model' | 'execution' | 'check' | 'cleanup' | 'error', message: string, data?: Record<string, unknown>) => {
    store.appendEvent(run.id, { kind, message, data }, lease);
  };
  const assertActive = () => {
    signal.throwIfAborted();
    if (store.getRun(run.id)?.status === 'cancel_requested') { abort.abort(new Error('Cancellation requested.')); signal.throwIfAborted(); }
  };
  const heart = setInterval(() => {
    try { store.renewLease(run.id, lease); if (store.getRun(run.id)?.status === 'cancel_requested') abort.abort(new Error('Cancellation requested.')); }
    catch { abort.abort(new Error('Worker lease lost.')); }
  }, 10_000);
  heart.unref();
  const addChecks = (observed: CheckRecord[]) => {
    checks.push(...observed); store.updateRun(run.id, lease, { checks });
    for (const check of observed) event('check', `${check.customer}: ${check.message}`, { checkId: check.id, verdict: check.verdict, checkpoint: check.checkpoint });
  };
  try {
    const [trustedApp, baselineSource, contract] = await Promise.all([
      readFile(resolve('fixtures/sample-app/app.py'), 'utf8'), readFile(resolve('fixtures/sample-app/billing.py'), 'utf8'),
      readFile(resolve('fixtures/sample-app/INTERFACE.md'), 'utf8'),
    ]);
    const controlToken = token();
    store.setMetadata(run.id, 'trustedAppSha256', sha(trustedApp), lease);
    sandbox = await createos.createRunSandbox(run.id, { STRIPE_READONLY_KEY: config.stripe.readonlyKey }, receipt => {
      track({ kind: 'sandbox', id: receipt.sandboxId }); store.updateRun(run.id, lease, { sandboxId: receipt.sandboxId });
    });
    assertActive();
    await createos.uploadFiles(sandbox, { [`${ROOT}/app.py`]: trustedApp, [`${ROOT}/billing.py`]: baselineSource,
      [`${ROOT}/validate.py`]: VALIDATOR, [`${ROOT}/private-config.json`]: JSON.stringify({ controlToken, webhookSecret: '', fixtureRunId: `${run.id}-unconfigured` }) });
    const process = await createos.startProcess(sandbox, { cmd: 'python3', args: ['-B', '-u', `${ROOT}/app.py`], cwd: ROOT });
    track({ kind: 'process', id: process.processId });
    const previewUrl = await createos.preview(sandbox, 8000);
    if (new URL(previewUrl).protocol !== 'https:') throw new Error('A real HTTPS preview is required for signed Stripe webhook delivery.');
    store.updateRun(run.id, lease, { previewUrl });
    const health = await http(previewUrl, '/health', signal);
    if (health.status !== 200 || !(health.body as { ready?: boolean })?.ready) throw new Error('The controller could not independently reach the sample application.');
    const denied = await http(previewUrl, '/evidence', signal);
    if (denied.status !== 401) throw new Error('Sample application control evidence was not protected.');
    const hook = await stripe.createWebhook(new URL('/webhook', previewUrl).toString(), run.id);
    track({ kind: 'webhook', id: hook.id });
    event('observation', 'Real HTTPS sample application and protected control endpoint observed.', { sandboxId: sandbox.id, webhookEndpointId: hook.id });
    const ensureTrustedSource = async () => {
      if (sha(await createos.downloadText(sandbox!, `${ROOT}/app.py`)) !== sha(trustedApp)) throw new Error('Trusted HTTP/auth source integrity check failed.');
    };
    const phase = async (name: 'baseline' | 'verification', attempt: number): Promise<CheckRecord[]> => {
      assertActive(); const fixtureRunId = name === 'baseline' ? `${run.id}-b` : `${run.id}-v${attempt}`;
      try {
      await createos.uploadFiles(sandbox!, { [`${ROOT}/private-config.json`]: JSON.stringify({ controlToken, webhookSecret: hook.secret, fixtureRunId }) });
      await controlled(previewUrl, '/_reset', controlToken, signal, {});
      const bundle: StripeFixtureBundle = await stripe.createFixtures({ runId: fixtureRunId, phase: name, scenarios: run.scenarios,
        onResource: resource => track(resource) });
      await Promise.all(bundle.fixtures.map(fixture => stripe.verifyReadonlyFixture(fixture)));
      const people: ReportPerson[] = bundle.fixtures.map(fixture => ({ customerId: fixture.customerId,
        scenario: fixture.scenario, token: token(), report: `Private ${fixture.scenario} report ${randomUUID()}` }));
      await controlled(previewUrl, '/_fixtures', controlToken, signal, { people });
      const subscriptionIds = new Set(bundle.fixtures.map(fixture => fixture.subscriptionId));
      const evidence = async () => {
        const value = await controlled(previewUrl, '/evidence', controlToken, signal) as Evidence;
        if (!value || !Array.isArray(value.events) || (value.errors !== undefined && !Array.isArray(value.errors))) {
          throw new ProviderError('sample', 'EVIDENCE_INVALID', 'The protected evidence endpoint returned an invalid response.');
        }
        assertHandlerEvidence(value, fixtureRunId, subscriptionIds, name);
        return value;
      };
      await pollUntil(evidence, value => bundle.fixtures.every(fixture => value.events.some(item => item.type === 'customer.subscription.created' && item.object_id === fixture.subscriptionId)),
        { timeoutMs: 90_000, signal, description: 'actual signed initial subscription events' });
      const prefix = `${name}-${attempt}-${++phaseCounter}`;
      const observed: CheckRecord[] = [];
      for (const [index, fixture] of bundle.fixtures.entries()) {
        const person = people[index]; const initial = await stripe.observeFixture(fixture);
        const response = await http(previewUrl, '/report', signal, { headers: { Authorization: `Bearer ${person.token}` } });
        const check = evaluateReport({ id: `${prefix}-${fixture.scenario}-initial`, checkpoint: `${name}: initial subscription access`, person, observation: initial, response });
        observed.push(check);
        if (name === 'baseline' && check.verdict !== 'passed') throw new Error('Baseline initial access failed; signed transport/setup must work before testing the intended defect.');
      }
      const beforeEvents = new Set((await evidence()).events.map(item => item.id));
      const observations: StripeObservation[] = [];
      // Separate clocks; advancing one cannot corrupt another scenario or later verification.
      for (const fixture of bundle.fixtures) observations.push(await stripe.advanceFixture(fixture, signal));
      await pollUntil(evidence, value => finalSubscriptionEventsObserved(value, observations, beforeEvents),
        { timeoutMs: 90_000, signal, description: 'actual signed post-transition subscription updates matching independently observed final Stripe state' });
      for (const [index, observation] of observations.entries()) {
        const person = people[index];
        const response = await http(previewUrl, '/report', signal, { headers: { Authorization: `Bearer ${person.token}` } });
        observed.push(evaluateReport({ id: `${prefix}-${person.scenario}-transition`, checkpoint: `${name}: after billing transition`, person, observation, response }));
      }
      const first = people[0];
      observed.push(evaluateDenied({ id: `${prefix}-anonymous`, checkpoint: `${name}: unauthenticated report`, scenario: first.scenario,
        response: await http(previewUrl, '/report', signal), expectedStatus: 401 }));
      observed.push(evaluateDenied({ id: `${prefix}-unknown`, checkpoint: `${name}: unknown identity`, scenario: first.scenario,
        response: await http(previewUrl, '/report', signal, { headers: { Authorization: 'Bearer unknown-fixture-identity' } }), expectedStatus: 401 }));
      const otherId = people[1]?.customerId ?? 'cus_unknown_not_owned';
      observed.push(evaluateDenied({ id: `${prefix}-cross-customer`, checkpoint: `${name}: another customer report`, scenario: first.scenario,
        response: await http(previewUrl, `/report?customer=${encodeURIComponent(otherId)}`, signal, { headers: { Authorization: `Bearer ${first.token}` } }), expectedStatus: 403 }));
      await ensureTrustedSource();
      addChecks(observed);
      event('observation', 'Stripe records and actual report endpoints independently observed.', { phase: name,
        observations: observations.map(item => ({ ...item })), signedEventCount: (await evidence()).events.length });
      return observed;
      } finally {
        // Old signed events can be retried after a phase ends. Disable their fixture scope
        // before installing another handler, including during validation failure/retry.
        await createos.uploadFiles(sandbox!, { [`${ROOT}/private-config.json`]: JSON.stringify({ controlToken,
          webhookSecret: hook.secret, fixtureRunId: `${run.id}-inactive-${name}-${attempt}` }) });
        const failures = await cleanupResources(resources, stripe, createos, { fixturesOnly: true, onUpdate: persist });
        if (failures.length) throw new ProviderError('stripe', 'PHASE_CLEANUP_PENDING', 'Test-clock cleanup must complete before another verification phase.');
      }
    };
    store.updateRun(run.id, lease, { status: 'baseline', phase: 'Checking the original subscription integration' });
    const baseline = await phase('baseline', 0);
    let failures = failedChecks(baseline);
    if (!failures.length) {
      desired = 'passed'; summary = 'The selected baseline checks passed. No mismatch was observed and no repair was generated.';
    } else {
      event('observation', 'The original sample integration returned a real access mismatch. Repair is required.', { failureCount: failures.length });
      let source = baselineSource;
      for (let attempt = 1; attempt <= config.groq.maxCalls; attempt += 1) {
        assertActive(); store.updateRun(run.id, lease, { status: 'repairing', phase: 'Writing a repair from observed failures', attempt });
        const repair = await groq.generateRepair({ source, contract: `${contract}\nSafety validator: no imports, annotations, filesystem/process calls, loops, indirect calls, aliases or extra/nested definitions. Do not rebind event, db, stripe_get or builtins. SQL must be an explicit constant string writing only access; call db.execute directly.`, failures }, signal);
        source = repair.source;
        store.addArtifact(run.id, lease, { kind: 'source', name: `billing-attempt-${attempt}.py`, content: source });
        event('model', 'The model returned a new handler implementation; success has not been assumed.', { attempt, model: repair.model, usage: repair.usage, explanation: repair.explanation, sourceSha256: sha(source) });
        // The application never imports candidate.py. Validation precedes installation.
        await createos.uploadFiles(sandbox, { [`${ROOT}/candidate.py`]: source });
        const execution = await createos.execute(sandbox, 'python3', [`${ROOT}/validate.py`], 15_000);
        store.addArtifact(run.id, lease, { kind: 'execution', name: `execution-attempt-${attempt}.json`, content: JSON.stringify(execution, null, 2) });
        event('execution', 'CreateOS executed the trusted source validator and Python compilation.', { attempt, exitCode: execution.exitCode, durationMs: execution.durationMs });
        if (execution.exitCode !== 0) { failures = [`Source validation/compilation failed: ${boundedText(execution.stderr, 4000)}`]; continue; }
        let receipt: { accepted?: boolean; sha256?: string } = {};
        try { receipt = JSON.parse(execution.stdout.trim()); } catch { /* No receipt means no accepted source. */ }
        if (!receipt.accepted || receipt.sha256 !== sha(source)) { failures = ['Controller could not confirm the validated source hash.']; continue; }
        await createos.uploadFiles(sandbox, { [`${ROOT}/billing.py`]: source });
        await ensureTrustedSource();
        store.updateRun(run.id, lease, { status: 'verifying', phase: 'Testing the generated repair with fresh Stripe customers' });
        let verified: CheckRecord[];
        try { verified = await phase('verification', attempt); }
        catch (error) {
          if (!(error instanceof HandlerExecutionError)) throw error;
          failures = [`Generated handler raised an error while processing a real signed event:\n${error.message}`];
          event('observation', 'The generated handler raised a recorded runtime error. Fresh fixtures will be used for the next bounded repair attempt.', { attempt, feedback: failures[0] });
          continue;
        }
        failures = failedChecks(verified);
        if (!failures.length) {
          const oldLines = baselineSource.trimEnd().split('\n'); const newLines = source.trimEnd().split('\n');
          const patch = `--- a/billing.py\n+++ b/billing.py\n@@ -1,${oldLines.length} +1,${newLines.length} @@\n${oldLines.map(line => `-${line}`).join('\n')}\n${newLines.map(line => `+${line}`).join('\n')}\n`;
          store.addArtifact(run.id, lease, { kind: 'patch', name: 'billing-repair.patch', content: patch });
          desired = 'passed'; summary = 'Generated repair passed the fixed access and isolation checks using fresh Stripe test subscriptions. This result covers the supported sample and selected scenarios.';
          break;
        }
      }
      if (desired !== 'passed') { summary = 'The agent used its bounded repair attempts; the supported checks have not all passed.'; errorMessage = failures.join(' ').slice(0, 3000); }
    }
    assertActive();
    store.addArtifact(run.id, lease, { kind: 'report', name: 'verification-report.json', content: JSON.stringify({ runId: run.id,
      testMode: true, policy: run.policy, proposedOutcome: desired, modelCalls: groq.callsUsed, checks,
      limitation: 'Synthetic sample application and Stripe test objects only. Physical time and production billing were not changed.' }, null, 2) });
  } catch (error) {
    if (error instanceof StoreError && error.code === 'LEASE_LOST') return;
    desired = error instanceof ProviderError ? 'blocked' : 'failed';
    errorMessage = error instanceof ProviderError ? error.message : signal.aborted ? 'Execution stopped by cancellation, shutdown or its configured deadline.' : 'The real provider or sample-app verification did not complete. Inspect the saved bounded activity record.';
    try { event('error', errorMessage); } catch { /* A fenced worker must not write. */ }
  } finally {
    // Cleanup deliberately has its own bounded provider calls, independent of an aborted work signal.
    try {
      const failures = await cleanupResources(resources, stripe, createos, { onUpdate: persist });
      if (failures.length) {
        store.setMetadata(run.id, 'cleanup_pending', true, lease);
        event('cleanup', 'Cleanup is not confirmed. Another test is blocked until resource reconciliation.', { failures });
        const cancelling = store.getRun(run.id)?.status === 'cancel_requested';
        if (!cancelling) store.finishRun(run.id, lease, 'interrupted', 'Test stopped with resources awaiting cleanup.', 'Cleanup is pending; no final successful result is claimed.');
        // Pending cancellation retains its lease until expiry/recovery; do not label it cancelled.
      } else {
        event('cleanup', 'Tracked test clocks, webhook endpoint and sandbox cleanup confirmed.');
        if (store.getRun(run.id)?.status === 'cancel_requested') store.completeCancellation(run.id, lease);
        else store.finishRun(run.id, lease, desired, summary, errorMessage);
      }
    } catch { /* Lease expiry/recovery retains IDs and blocks fresh work. */ }
    clearInterval(heart);
  }
}

/** Long-lived worker, independent of the initiating browser or HTTP request. */
export async function runWorker(config: Config, store: RunStore, signal: AbortSignal) {
  const workerId = `worker-${randomUUID()}`;
  while (!signal.aborted) {
    try {
      store.recoverExpiredLeases();
      const pending = store.getCleanupPending();
      if (pending.length && config.stripe.controllerKey && config.stripe.readonlyKey && config.createos.apiKey) {
        const stripe = new StripeBillingProvider(config.stripe); const createos = new CreateOSProvider(config.createos);
        for (const run of pending) {
          const resources = store.getMetadata<Resource[]>(run.id, 'resources') ?? [];
          if (run.sandboxId && !resources.some(item => item.kind === 'sandbox' && item.id === run.sandboxId)) resources.push({ kind: 'sandbox', id: run.sandboxId });
          const failures = await cleanupResources(resources, stripe, createos);
          if (!failures.length) store.confirmCleanup(run.id);
        }
      }
      if (!store.getCleanupPending().length && (await getReadiness(config, store)).ready) {
        const claimed = store.claimNext(workerId);
        if (claimed) { await executeRun(config, store, claimed, signal); continue; }
      }
      await delay(1500, undefined, { signal });
    } catch { if (!signal.aborted) await delay(2000, undefined, { signal }).catch(() => undefined); }
  }
}
