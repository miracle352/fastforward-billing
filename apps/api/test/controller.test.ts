import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from '../src/server.js';
import { RunStore, StoreError } from '../src/store.js';
import type { ReadinessRecord } from '@fastforward/contracts';

const ready: ReadinessRecord = { ready: true, providers: [], blockers: [], testMode: true, activeRunId: null };
async function fixture(readiness = ready) {
  const dir = mkdtempSync(join(tmpdir(), 'ff-controller-'));
  const store = new RunStore(join(dir, 'db.sqlite'));
  const app = await createServer({ store, readiness: () => readiness, origin: ['http://localhost:5173'], globalDailyLimit: 10 });
  const establish = async () => {
    const response = await app.inject({ method: 'GET', url: '/api/session' });
    const cookie = response.cookies.find(item => item.name === 'ff_visitor');
    assert.ok(cookie);
    return { cookie: `ff_visitor=${cookie.value}`, 'x-csrf-token': response.json().csrfToken, origin: 'http://localhost:5173' };
  };
  const close = async () => { await app.close(); store.close(); rmSync(dir, { recursive: true, force: true }); };
  return { dir, store, app, establish, close };
}

test('spend endpoint requires a visitor session, CSRF, configured Origin and real readiness', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/runs', payload: {} })).statusCode, 401);
    const headers = await f.establish();
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/runs', headers: { cookie: headers.cookie }, payload: {} })).statusCode, 403);
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/runs', headers: { ...headers, origin: 'https://attacker.example' }, payload: {} })).statusCode, 403);
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/runs', headers, payload: { scenarios: ['unsupported'] } })).statusCode, 400);
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/runs', headers, payload: {} })).statusCode, 202);
  } finally { await f.close(); }
  const blocked = await fixture({ ...ready, ready: false, blockers: ['CreateOS is not configured.'] });
  try {
    const headers = await blocked.establish();
    const response = await blocked.app.inject({ method: 'POST', url: '/api/runs', headers, payload: {} });
    assert.equal(response.statusCode, 503); assert.deepEqual(response.json().error.blockers, ['CreateOS is not configured.']);
    assert.equal(blocked.store.getActiveRun(), null);
  } finally { await blocked.close(); }
});

test('jobs, events and source artifacts remain private; one active job prevents duplicate spend', async () => {
  const f = await fixture();
  try {
    const first = await f.establish(); const second = await f.establish();
    const created = await f.app.inject({ method: 'POST', url: '/api/runs', headers: first, payload: {} });
    const id = created.json().run.id as string;
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/runs', headers: second, payload: {} })).statusCode, 409);
    for (const path of [`/api/runs/${id}`, `/api/runs/${id}/events`]) {
      assert.equal((await f.app.inject({ method: 'GET', url: path, headers: second })).statusCode, 404);
    }
    assert.deepEqual((await f.app.inject({ method: 'GET', url: '/api/runs', headers: second })).json().runs, []);
    const claimed = f.store.claimNext('worker'); assert.ok(claimed);
    const artifact = f.store.addArtifact(id, claimed.lease, { kind: 'source', name: 'handler.py', content: 'print("test source, not a repair verdict")' });
    assert.equal((await f.app.inject({ method: 'GET', url: artifact.downloadUrl, headers: second })).statusCode, 404);
    assert.equal((await f.app.inject({ method: 'GET', url: artifact.downloadUrl, headers: first })).statusCode, 200);
    const response = await f.app.inject({ method: 'GET', url: `/api/runs/${id}/events?after=0`, headers: first });
    const cursor = response.json().nextCursor;
    assert.ok(cursor > 0);
    assert.deepEqual((await f.app.inject({ method: 'GET', url: `/api/runs/${id}/events?after=${cursor}`, headers: first })).json().events, []);
    assert.equal((await f.app.inject({ method: 'POST', url: `/api/runs/${id}/cancel`, headers: first })).json().run.status, 'cancel_requested');
    assert.throws(() => f.store.updateRun(id, claimed.lease, { status: 'passed' }), (error: unknown) => error instanceof StoreError && error.code === 'CANCEL_REQUESTED');
    f.store.completeCancellation(id, claimed.lease);
    assert.equal(f.store.getRun(id)?.status, 'cancelled');
  } finally { await f.close(); }
});

test('database survives reopen, expired leases fence late writes and block new jobs until cleanup', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ff-durable-'));
  const path = join(dir, 'db.sqlite');
  let store = new RunStore(path);
  try {
    const session = store.createSession();
    const run = store.createRun(session.id, ['healthy_renewal']);
    const claim = store.claimNext('old-worker', 1000); assert.ok(claim);
    store.setMetadata(run.id, 'clockId', 'test-clock-fixture', claim.lease);
    store.close();
    await delay(1100);
    store = new RunStore(path);
    assert.ok(store.getSession(session.id));
    assert.equal(store.getRunForOwner(run.id, session.id)?.id, run.id);
    assert.equal(store.getMetadata(run.id, 'clockId'), 'test-clock-fixture');
    assert.equal(store.recoverExpiredLeases()[0]?.status, 'interrupted');
    assert.equal(store.getCleanupPending()[0]?.id, run.id);
    assert.throws(() => store.updateRun(run.id, claim.lease, { status: 'passed' }), (error: unknown) => error instanceof StoreError && error.code === 'LEASE_LOST');
    assert.throws(() => store.createRun(session.id, ['healthy_renewal']), (error: unknown) => error instanceof StoreError && error.code === 'CLEANUP_PENDING');
    store.confirmCleanup(run.id);
    assert.equal(store.getCleanupPending().length, 0);
    assert.ok(store.createRun(session.id, ['healthy_renewal']));
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('rolling daily allowance survives changing visitor cookies', () => {
  const store = new RunStore(':memory:');
  try {
    const one = store.createSession();
    const run = store.createRun(one.id, ['healthy_renewal'], { globalDailyLimit: 1 });
    store.requestCancel(one.id, run.id);
    const two = store.createSession();
    assert.throws(() => store.createRun(two.id, ['healthy_renewal'], { globalDailyLimit: 1 }), (error: unknown) => error instanceof StoreError && error.code === 'GLOBAL_LIMIT');
  } finally { store.close(); }
});
