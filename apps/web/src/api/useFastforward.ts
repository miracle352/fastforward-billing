import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReadinessRecord, RunEventRecord, RunRecord, Scenario } from '@fastforward/contracts';
import {
  ApiError, cancelRun, createRun, getEvents, getReadiness, getRun, getSession, isAbort, listRuns,
} from './client';
import { isTerminal } from '../lib/status';

/**
 * Owns the visitor session and the real run lifecycle.
 * - Polls ordered events with a cursor every ~1.8 s only while the run is nonterminal.
 * - A lost connection is "reconnecting", never a job failure.
 * - Cancellation stays "requested" until the server reports confirmed cleanup.
 */

export type Connection = 'connecting' | 'online' | 'offline';
export type Feed = 'idle' | 'live' | 'reconnecting';
export type StartOutcome = null | 'checking' | 'recovered' | 'not-found' | 'unknown';

const POLL_MS = 1800;
const MAX_BACKOFF_MS = 15000;
const STORAGE_KEY = 'ff.selectedRun';

const remember = (id: string | null) => {
  try { if (id) sessionStorage.setItem(STORAGE_KEY, id); else sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage optional */ }
};
const recall = () => { try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; } };

const asApiError = (caught: unknown) =>
  caught instanceof ApiError ? caught : new ApiError('network', 0, 'UNKNOWN', 'Something went wrong in this page. No result was assumed.');

export function useFastforward() {
  const [connection, setConnection] = useState<Connection>('connecting');
  const [connectionError, setConnectionError] = useState<ApiError | null>(null);
  const [readiness, setReadiness] = useState<ReadinessRecord | null>(null);
  const [readinessError, setReadinessError] = useState<ApiError | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [run, setRun] = useState<RunRecord | null>(null);
  const [events, setEvents] = useState<RunEventRecord[]>([]);
  const [feed, setFeed] = useState<Feed>('idle');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<ApiError | null>(null);
  /** Only set when the start request's reply was lost: what reconciling with history found. */
  const [startOutcome, setStartOutcome] = useState<StartOutcome>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<ApiError | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  const startInFlight = useRef(false);
  /** Kept only while a start's outcome is uncertain, so a retry repeats the same request. */
  const pendingStart = useRef<{ key: string; scenarios: string } | null>(null);
  const cancelInFlight = useRef(false);
  const runId = run?.id ?? null;

  const upsertRun = useCallback((next: RunRecord) => {
    setRun(current => (current && current.id === next.id ? next : current));
    setRuns(list => {
      const index = list.findIndex(item => item.id === next.id);
      if (index === -1) return [next, ...list];
      const copy = list.slice(); copy[index] = next; return copy;
    });
  }, []);

  // Boot: session → this visitor's runs. Readiness is fetched separately because its provider
  // probes can be slow; the page must not look disconnected while they run.
  useEffect(() => {
    const controller = new AbortController();
    let retry: number | undefined;
    (async () => {
      try {
        await getSession(controller.signal);
        const list = await listRuns(controller.signal);
        setConnection('online'); setConnectionError(null);
        setRuns(list);
        const remembered = recall();
        const chosen = list.find(item => item.id === remembered) ?? list.find(item => !isTerminal(item.status)) ?? list[0] ?? null;
        setRun(current => current ?? chosen);
        setCheckingReadiness(true);
        try {
          const ready = await getReadiness(controller.signal);
          setReadiness(ready); setReadinessError(null);
        } catch (caught) {
          if (isAbort(caught)) return;
          setReadinessError(asApiError(caught));
        } finally {
          setCheckingReadiness(false);
        }
      } catch (caught) {
        if (isAbort(caught)) return;
        setConnection('offline'); setConnectionError(asApiError(caught));
        retry = window.setTimeout(() => setBootAttempt(n => n + 1), Math.min(4000 * (bootAttempt + 1), MAX_BACKOFF_MS));
      }
    })();
    return () => { controller.abort(); window.clearTimeout(retry); };
  }, [bootAttempt]);

  useEffect(() => { remember(runId); }, [runId]);

  // Ordered event feed for the selected run.
  useEffect(() => {
    if (!runId) { setFeed('idle'); return; }
    const controller = new AbortController();
    let cursor = 0;
    let timer: number | undefined;
    let failures = 0;
    const seen = new Set<number>();
    setEvents([]);

    const tick = async () => {
      try {
        // Read the run first; events fetched afterwards include everything up to that status.
        const latest = await getRun(runId, controller.signal);
        let page: { events: RunEventRecord[]; nextCursor: number };
        const fresh: RunEventRecord[] = [];
        do {
          page = await getEvents(runId, cursor, controller.signal);
          for (const event of page.events) if (!seen.has(event.id)) { seen.add(event.id); fresh.push(event); }
          cursor = Math.max(cursor, page.nextCursor);
        } while (page.events.length >= 200);
        if (fresh.length) setEvents(list => [...list, ...fresh].sort((a, b) => a.id - b.id));
        upsertRun(latest);
        failures = 0;
        if (isTerminal(latest.status)) { setFeed('idle'); return; }
        setFeed('live');
        timer = window.setTimeout(tick, document.hidden ? POLL_MS * 3 : POLL_MS);
      } catch (caught) {
        if (isAbort(caught)) return;
        const error = asApiError(caught);
        if (error.kind === 'http' && error.status === 404) { setFeed('idle'); return; }
        failures += 1;
        setFeed('reconnecting');
        timer = window.setTimeout(tick, Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS));
      }
    };
    void tick();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [runId, upsertRun]);

  const refreshReadiness = useCallback(async () => {
    setCheckingReadiness(true);
    try {
      const ready = await getReadiness();
      setReadiness(ready); setReadinessError(null); setConnection('online');
      return ready;
    } catch (caught) {
      setReadinessError(asApiError(caught));
      return null;
    } finally {
      setCheckingReadiness(false);
    }
  }, []);

  // Once a run stops, readiness (active run, limits) may have changed.
  const terminal = run ? isTerminal(run.status) : false;
  useEffect(() => { if (terminal) void refreshReadiness(); }, [terminal, refreshReadiness]);

  const start = useCallback(async (scenarios: Scenario[]): Promise<RunRecord | null> => {
    if (startInFlight.current || scenarios.length === 0) return null;
    startInFlight.current = true;
    setStarting(true); setStartError(null); setCancelError(null); setStartOutcome(null);
    try {
      const fingerprint = scenarios.join(',');
      const key = pendingStart.current?.scenarios === fingerprint ? pendingStart.current.key : crypto.randomUUID();
      pendingStart.current = { key, scenarios: fingerprint };
      const created = await createRun(scenarios, key);
      pendingStart.current = null;
      setRuns(list => [created, ...list.filter(item => item.id !== created.id)]);
      setRun(created);
      return created;
    } catch (caught) {
      const error = asApiError(caught);
      if (error.kind === 'network' || error.kind === 'unavailable') {
        // The request may have reached the server even though its reply did not reach us.
        // Reconcile with this visitor's history before saying anything about what ran.
        setStartOutcome('checking');
        const known = new Set(runs.map(item => item.id));
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const list = await listRuns();
            setRuns(list); setConnection('online');
            const appeared = list.find(item => !known.has(item.id));
            if (appeared) { pendingStart.current = null; setRun(appeared); setStartOutcome('recovered'); return appeared; }
            setStartOutcome('not-found'); setStartError(error);
            return null;
          } catch {
            await new Promise(resolve => window.setTimeout(resolve, 1500 * (attempt + 1)));
          }
        }
        setStartOutcome('unknown'); setStartError(error);
        return null;
      }
      pendingStart.current = null;
      setStartError(error);
      if (error.status === 409 || error.status === 503) {
        const ready = await refreshReadiness();
        if (ready?.activeRunId) {
          const active = ready.activeRunId;
          setRun(current => current?.id === active ? current : runs.find(item => item.id === active) ?? current);
        }
      }
      return null;
    } finally {
      startInFlight.current = false;
      setStarting(false);
    }
  }, [refreshReadiness, runs]);

  const cancel = useCallback(async () => {
    if (!run || cancelInFlight.current) return;
    cancelInFlight.current = true;
    setCancelling(true); setCancelError(null);
    try {
      upsertRun(await cancelRun(run.id));
    } catch (caught) {
      setCancelError(asApiError(caught));
    } finally {
      cancelInFlight.current = false;
      setCancelling(false);
    }
  }, [run, upsertRun]);

  const selectRun = useCallback((id: string) => {
    setRun(runs.find(item => item.id === id) ?? null);
    setStartError(null); setCancelError(null); setStartOutcome(null);
  }, [runs]);

  const retryConnection = useCallback(() => setBootAttempt(n => n + 1), []);

  return {
    connection, connectionError, retryConnection,
    readiness, readinessError, checkingReadiness, refreshReadiness,
    runs, run, events, feed, selectRun,
    start, starting, startError, startOutcome,
    cancel, cancelling, cancelError,
  };
}

export type Fastforward = ReturnType<typeof useFastforward>;
