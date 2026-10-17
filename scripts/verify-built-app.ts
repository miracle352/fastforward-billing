import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from '../apps/api/src/server.ts';
import { RunStore } from '../apps/api/src/store.ts';
import { Readiness, Session } from '../packages/contracts/src/index.ts';

// Exercise the actual compiled frontend and trusted API together. No worker,
// external providers, generated verdicts, or model calls participate in this check.
const staticRoot = resolve('apps/web/dist');
const index = readFileSync(join(staticRoot, 'index.html'), 'utf8');
const directory = mkdtempSync(join(tmpdir(), 'fastforward-integration-'));
const store = new RunStore(join(directory, 'integration.sqlite'));
const app = await createServer({ store, staticRoot, secureCookies: true,
  origin: 'https://fastforward.example', globalDailyLimit: 6, ownerDailyLimit: 3,
  readiness: () => ({ ready: false, providers: [], blockers: ['Integration check: providers intentionally disabled.'], testMode: true, activeRunId: null }),
});
try {
  const home = await app.inject('/');
  assert.equal(home.statusCode, 200);
  assert.equal(home.body, index);
  assert.match(home.headers['content-type'] as string, /text\/html/);
  const assets = [...index.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(path => path.endsWith('.js')));
  assert.ok(assets.some(path => path.endsWith('.css')));
  for (const path of assets) {
    const asset = await app.inject(path);
    assert.equal(asset.statusCode, 200);
    assert.ok(asset.rawPayload.byteLength > 0);
    assert.equal(asset.headers['x-content-type-options'], 'nosniff');
  }
  assert.equal((await app.inject('/api/does-not-exist')).statusCode, 404);
  assert.equal((await app.inject('/api/runs')).statusCode, 401);
  const session = await app.inject('/api/session');
  const parsed = Session.parse(session.json());
  const cookie = session.cookies.find(item => item.name === 'ff_visitor');
  assert.ok(cookie?.httpOnly && cookie.secure);
  const headers = { cookie: `ff_visitor=${cookie.value}`, origin: 'https://fastforward.example', 'x-csrf-token': parsed.csrfToken };
  assert.deepEqual((await app.inject({url:'/api/runs', headers})).json(), {runs:[]});
  assert.equal(Readiness.parse((await app.inject('/api/readiness')).json()).ready, false);
  assert.equal((await app.inject({method:'POST',url:'/api/runs',headers:{cookie:headers.cookie,origin:headers.origin},payload:{}})).statusCode, 403);
  const blocked = await app.inject({method:'POST',url:'/api/runs',headers,payload:{scenarios:['healthy_renewal','trial_payment_failure']}});
  assert.equal(blocked.statusCode, 503);
  assert.equal(blocked.json().error.code, 'SETUP_NEEDED');
  assert.equal(store.getActiveRun(), null);
  console.log(JSON.stringify({builtFrontend:true,assetsServed:assets.length,sameOriginSession:true,secureHttpOnlyCookie:true,emptyVisitorHistory:true,csrfDenied:true,blockedStart:503,queuedRuns:0,externalProviderCalls:0}));
} finally {
  await app.close();
  store.close();
  rmSync(directory, {recursive:true,force:true});
}
