import { z } from 'zod';
import {
  ErrorResponse, Readiness, Run, RunEvent, Session,
  type ReadinessRecord, type RunEventRecord, type RunRecord, type Scenario,
} from '@fastforward/contracts';

/**
 * Thin, schema-checked client for the Fastforward API (docs/API-HANDOFF.md).
 * Every response is parsed against @fastforward/contracts; a mismatch is surfaced
 * as an error rather than being guessed at. Nothing here fabricates a result.
 */

export type ApiErrorKind = 'network' | 'unavailable' | 'http' | 'contract';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    readonly code: string,
    message: string,
    readonly blockers: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

let csrfToken: string | null = null;

type RequestOptions = { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal; csrf?: boolean };

async function request<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.csrf) {
    if (!csrfToken) await getSession(options.signal);
    headers['X-CSRF-Token'] = csrfToken ?? '';
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (caught) {
    if (isAbort(caught)) throw caught;
    throw new ApiError('network', 0, 'NETWORK', 'This page could not reach the Fastforward server.');
  }
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }

  if (!response.ok) {
    const parsed = ErrorResponse.safeParse(body);
    if (parsed.success) {
      const { code, message, blockers } = parsed.data.error;
      throw new ApiError('http', response.status, code, message, blockers ?? []);
    }
    // A proxy or host error without the API's own error shape: the server is not answering.
    if (response.status >= 500) {
      throw new ApiError('unavailable', response.status, `HTTP_${response.status}`, 'The Fastforward server is not answering right now.');
    }
    throw new ApiError('http', response.status, `HTTP_${response.status}`, 'The request was not accepted.');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('contract', response.status, 'CONTRACT_MISMATCH',
      'The server sent a response this page does not recognise. No result was assumed.');
  }
  return parsed.data;
}

/** POST with CSRF. If the server says the token expired, refresh the session once and retry. */
async function post<T>(path: string, schema: z.ZodType<T>, body: unknown, signal?: AbortSignal): Promise<T> {
  try {
    return await request(path, schema, { method: 'POST', body, signal, csrf: true });
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 403 && caught.code === 'CSRF_INVALID') {
      await getSession(signal);
      return request(path, schema, { method: 'POST', body, signal, csrf: true });
    }
    throw caught;
  }
}

export async function getSession(signal?: AbortSignal) {
  const session = await request('/api/session', Session, { signal });
  csrfToken = session.csrfToken;
  return session;
}

export const getReadiness = (signal?: AbortSignal): Promise<ReadinessRecord> =>
  request('/api/readiness', Readiness, { signal });

const RunList = z.object({ runs: z.array(Run) });
const RunEnvelope = z.object({ run: Run });
const EventPage = z.object({ events: z.array(RunEvent), nextCursor: z.number().int().nonnegative() });

export const listRuns = async (signal?: AbortSignal): Promise<RunRecord[]> =>
  (await request('/api/runs', RunList, { signal })).runs;

export const getRun = async (id: string, signal?: AbortSignal): Promise<RunRecord> =>
  (await request(`/api/runs/${encodeURIComponent(id)}`, RunEnvelope, { signal })).run;

export const getEvents = (id: string, after: number, signal?: AbortSignal): Promise<{ events: RunEventRecord[]; nextCursor: number }> =>
  request(`/api/runs/${encodeURIComponent(id)}/events?after=${after}`, EventPage, { signal });

export const createRun = async (scenarios: Scenario[], signal?: AbortSignal): Promise<RunRecord> =>
  (await post('/api/runs', RunEnvelope, { scenarios }, signal)).run;

export const cancelRun = async (id: string, signal?: AbortSignal): Promise<RunRecord> =>
  (await post(`/api/runs/${encodeURIComponent(id)}/cancel`, RunEnvelope, {}, signal)).run;

/** Fetch an artifact's text through the server's authorised downloadUrl only. Rendered as escaped text. */
export async function getArtifactText(downloadUrl: string, signal?: AbortSignal): Promise<string> {
  const url = new URL(downloadUrl, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
    throw new ApiError('contract', 0, 'ARTIFACT_URL', 'This file link does not point at the Fastforward server.');
  }
  let response: Response;
  try {
    response = await fetch(url, { credentials: 'include', signal });
  } catch (caught) {
    if (isAbort(caught)) throw caught;
    throw new ApiError('network', 0, 'NETWORK', 'This page could not reach the Fastforward server.');
  }
  if (!response.ok) throw new ApiError('http', response.status, `HTTP_${response.status}`, 'The file could not be opened.');
  return response.text();
}
