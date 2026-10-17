import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CreateRun, type ReadinessRecord } from '@fastforward/contracts';
import { RunStore, StoreError, type SessionRecord } from './store.js';

export type ServerOptions = {
  store: RunStore; readiness: () => Promise<ReadinessRecord> | ReadinessRecord;
  secureCookies?: boolean; globalDailyLimit?: number; ownerDailyLimit?: number; staticRoot?: string;
  origin?: string | string[];
};
const COOKIE = 'ff_visitor';
function equal(a: string, b: string) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 16_384, trustProxy: false });
  await app.register(cookie);
  const error = (reply: FastifyReply, status: number, code: string, message: string, blockers?: string[]) =>
    reply.code(status).send({ error: { code, message, ...(blockers ? { blockers } : {}) } });
  const session = (request: FastifyRequest): SessionRecord | null => options.store.getSession(request.cookies[COOKIE] ?? '');
  const authorize = (request: FastifyRequest, reply: FastifyReply, csrf = false): SessionRecord | null => {
    const current = session(request);
    if (!current) { error(reply, 401, 'SESSION_REQUIRED', 'Open the test page to establish your visitor session.'); return null; }
    if (csrf) {
      const token = request.headers['x-csrf-token'];
      if (typeof token !== 'string' || !equal(token, current.csrfToken)) {
        error(reply, 403, 'CSRF_INVALID', 'Your session confirmation expired. Refresh the page and try again.'); return null;
      }
      if (request.headers.origin) {
        try {
          const configured = options.origin ? (Array.isArray(options.origin) ? options.origin : [options.origin]) : [`${options.secureCookies ? 'https' : 'http'}://${request.headers.host}`];
          if (!configured.includes(new URL(request.headers.origin).origin)) {
            error(reply, 403, 'ORIGIN_INVALID', 'This action must originate from the application.'); return null;
          }
        } catch { error(reply, 403, 'ORIGIN_INVALID', 'This action must originate from the application.'); return null; }
      }
    }
    return current;
  };
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Cache-Control', 'no-store');
    return payload;
  });
  app.get('/api/health', async () => ({ ok: true, service: 'fastforward', testMode: true }));
  app.get('/api/session', async (request, reply) => {
    let current = session(request);
    if (!current) {
      current = options.store.createSession();
      reply.setCookie(COOKIE, current.id, { httpOnly: true, secure: options.secureCookies ?? false, sameSite: 'strict',
        path: '/', maxAge: 24 * 60 * 60 });
    }
    return { csrfToken: current.csrfToken, testMode: true };
  });
  app.get('/api/readiness', async (request) => {
    const readiness = await options.readiness();
    const current = session(request); const active = options.store.getActiveRun();
    return { ...readiness, activeRunId: active && current && options.store.getRunForOwner(active.id, current.id) ? active.id : null };
  });
  app.get('/api/runs', async (request, reply) => {
    const current = authorize(request, reply); if (!current) return;
    return { runs: options.store.listRuns(current.id) };
  });
  app.post('/api/runs', async (request, reply) => {
    const current = authorize(request, reply, true); if (!current) return;
    const input = CreateRun.safeParse(request.body);
    if (!input.success) return error(reply, 400, 'INPUT_INVALID', 'Choose one or both supported billing scenarios.');
    const readiness = await options.readiness();
    if (!readiness.ready) return error(reply, 503, 'SETUP_NEEDED', 'A real test cannot start until the listed services are ready.', readiness.blockers);
    try {
      const run = options.store.createRun(current.id, input.data.scenarios, options);
      return reply.code(202).send({ run });
    } catch (caught) {
      if (caught instanceof StoreError) return error(reply, ['BUSY', 'CLEANUP_PENDING'].includes(caught.code) ? 409 : 429, caught.code, caught.message);
      throw caught;
    }
  });
  app.get<{ Params: { id: string } }>('/api/runs/:id', async (request, reply) => {
    const current = authorize(request, reply); if (!current) return;
    const run = options.store.getRunForOwner(request.params.id, current.id);
    return run ? { run } : error(reply, 404, 'NOT_FOUND', 'Test not found.');
  });
  app.get<{ Params: { id: string }; Querystring: { after?: string } }>('/api/runs/:id/events', async (request, reply) => {
    const current = authorize(request, reply); if (!current) return;
    if (!options.store.getRunForOwner(request.params.id, current.id)) return error(reply, 404, 'NOT_FOUND', 'Test not found.');
    const after = Number(request.query.after ?? 0);
    if (!Number.isSafeInteger(after) || after < 0) return error(reply, 400, 'CURSOR_INVALID', 'Event cursor must be a nonnegative integer.');
    const events = options.store.getEvents(request.params.id, after);
    return { events, nextCursor: events.at(-1)?.id ?? after };
  });
  app.post<{ Params: { id: string } }>('/api/runs/:id/cancel', async (request, reply) => {
    const current = authorize(request, reply, true); if (!current) return;
    const run = options.store.requestCancel(current.id, request.params.id);
    return run ? reply.code(202).send({ run }) : error(reply, 404, 'NOT_FOUND', 'Test not found.');
  });
  app.get<{ Params: { id: string; artifactId: string } }>('/api/runs/:id/artifacts/:artifactId', async (request, reply) => {
    const current = authorize(request, reply); if (!current) return;
    const saved = options.store.getArtifactContent(current.id, request.params.id, request.params.artifactId);
    if (!saved) return error(reply, 404, 'NOT_FOUND', 'Artifact not found.');
    reply.header('Content-Disposition', `attachment; filename="${saved.artifact.name}"`);
    return reply.type('text/plain; charset=utf-8').send(saved.content);
  });
  if (options.staticRoot && existsSync(resolve(options.staticRoot, 'index.html'))) {
    const staticPlugin = await import('@fastify/static');
    await app.register(staticPlugin.default, { root: resolve(options.staticRoot), prefix: '/' });
    app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/')
      ? error(reply, 404, 'NOT_FOUND', 'API route not found.') : reply.sendFile('index.html'));
  }
  app.setErrorHandler((caught, _request, reply) => {
    const status = (caught as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) return error(reply, status, 'REQUEST_INVALID', 'The request could not be accepted.');
    // Never serialize provider exceptions, environment values or stack traces to a visitor.
    return error(reply, 500, 'INTERNAL_ERROR', 'The operation could not complete. No successful result was assumed.');
  });
  return app;
}
