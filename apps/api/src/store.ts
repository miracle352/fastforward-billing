import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ArtifactRecord, RunRecord, RunEventRecord, Scenario } from '@fastforward/contracts';

export type Lease = { workerId: string; leaseToken: number };
export type ClaimedRun = { run: RunRecord; lease: Lease };
export type SessionRecord = { id: string; csrfToken: string; expiresAt: string };
export type EventInput = { kind: RunEventRecord['kind']; message: string; data?: Record<string, unknown> | null };
type Row = Record<string, unknown>;
const terminal = new Set(['passed', 'failed', 'blocked', 'cancelled', 'interrupted']);
const now = () => new Date().toISOString();
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export class StoreError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'StoreError'; }
}

/** Trusted controller data. Keep the database on an explicitly persistent volume. */
export class RunStore {
  private db: DatabaseSync;
  constructor(public readonly dbPath: string) {
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runs(
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL,
        record TEXT NOT NULL, worker_id TEXT, lease_token INTEGER NOT NULL DEFAULT 0, lease_expires TEXT);
      CREATE INDEX IF NOT EXISTS runs_status ON runs(status, created_at);
      CREATE INDEX IF NOT EXISTS runs_owner ON runs(owner_id, created_at);
      CREATE TABLE IF NOT EXISTS events(
        id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id),
        created_at TEXT NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL, data TEXT);
      CREATE INDEX IF NOT EXISTS events_run ON events(run_id,id);
      CREATE TABLE IF NOT EXISTS artifacts(
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), content TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata(
        run_id TEXT NOT NULL REFERENCES runs(id), key TEXT NOT NULL, value TEXT NOT NULL,
        PRIMARY KEY(run_id,key));
    `);
  }
  close() { this.db.close(); }
  private atomic<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = action(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private row(id: string) { return this.db.prepare('SELECT * FROM runs WHERE id=?').get(id) as Row | undefined; }
  private parse(row: Row): RunRecord { return JSON.parse(String(row.record)) as RunRecord; }
  private write(run: RunRecord) {
    this.db.prepare('UPDATE runs SET status=?,record=? WHERE id=?').run(run.status, JSON.stringify(run), run.id);
  }
  private assertLease(id: string, lease: Lease): Row {
    const row = this.row(id);
    if (!row || row.worker_id !== lease.workerId || Number(row.lease_token) !== lease.leaseToken ||
      !row.lease_expires || String(row.lease_expires) <= now() || terminal.has(String(row.status))) {
      throw new StoreError('LEASE_LOST', 'This worker no longer owns the job.');
    }
    return row;
  }
  private insertEvent(id: string, event: EventInput): RunEventRecord {
    const createdAt = now();
    const result = this.db.prepare('INSERT INTO events(run_id,created_at,kind,message,data) VALUES(?,?,?,?,?)')
      .run(id, createdAt, event.kind, event.message, event.data == null ? null : JSON.stringify(event.data));
    return { id: Number(result.lastInsertRowid), runId: id, createdAt, kind: event.kind, message: event.message, data: event.data ?? null };
  }
  createSession(): SessionRecord {
    const id = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    this.db.prepare('INSERT INTO sessions(id,csrf,expires_at) VALUES(?,?,?)').run(hash(id), csrfToken, expiresAt);
    return { id, csrfToken, expiresAt };
  }
  getSession(id: string): SessionRecord | null {
    if (!/^[a-f0-9]{64}$/.test(id)) return null;
    const row = this.db.prepare('SELECT * FROM sessions WHERE id=? AND expires_at>?').get(hash(id), now()) as Row | undefined;
    return row ? { id, csrfToken: String(row.csrf), expiresAt: String(row.expires_at) } : null;
  }
  listRuns(ownerId: string): RunRecord[] {
    return (this.db.prepare('SELECT * FROM runs WHERE owner_id=? ORDER BY created_at DESC LIMIT 50').all(hash(ownerId)) as Row[]).map(r => this.parse(r));
  }
  getRun(id: string): RunRecord | null { const row = this.row(id); return row ? this.parse(row) : null; }
  getRunForOwner(id: string, ownerId: string): RunRecord | null {
    const row = this.row(id); return row?.owner_id === hash(ownerId) ? this.parse(row) : null;
  }
  getActiveRun(): RunRecord | null {
    const row = this.db.prepare("SELECT * FROM runs WHERE status NOT IN ('passed','failed','blocked','cancelled','interrupted') ORDER BY created_at LIMIT 1").get() as Row | undefined;
    return row ? this.parse(row) : null;
  }
  createRun(ownerId: string, scenarios: Scenario[], limits: { globalDailyLimit?: number; ownerDailyLimit?: number } = {}): RunRecord {
    return this.atomic(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const count = (sql: string, ...params: string[]) => Number((this.db.prepare(sql).get(...params) as Row).count);
      if (count('SELECT COUNT(*) AS count FROM runs WHERE created_at>?', cutoff) >= (limits.globalDailyLimit ?? 6))
        throw new StoreError('GLOBAL_LIMIT', 'The shared daily demonstration allowance has been used. Saved results remain available.');
      if (count('SELECT COUNT(*) AS count FROM runs WHERE created_at>? AND owner_id=?', cutoff, hash(ownerId)) >= (limits.ownerDailyLimit ?? 2))
        throw new StoreError('OWNER_LIMIT', 'Your daily demonstration allowance has been used. Saved results remain available.');
      if (this.getCleanupPending().length) throw new StoreError('CLEANUP_PENDING', 'A previous test environment needs confirmed cleanup before another test can start.');
      if (this.getActiveRun()) throw new StoreError('BUSY', 'Another test is using the shared sandbox. Please try again after it finishes.');
      const timestamp = now();
      const run: RunRecord = {
        id: randomUUID(), status: 'queued', phase: 'Waiting for worker', createdAt: timestamp, updatedAt: timestamp,
        attempt: 0, maxAttempts: 3, scenarios: [...new Set(scenarios)], checks: [], artifacts: [], summary: null,
        error: null, sandboxId: null, previewUrl: null, testMode: true, policy: 'active_or_trialing_no_grace',
      };
      this.db.prepare('INSERT INTO runs(id,owner_id,status,created_at,record) VALUES(?,?,?,?,?)')
        .run(run.id, hash(ownerId), run.status, timestamp, JSON.stringify(run));
      this.insertEvent(run.id, { kind: 'status', message: 'Test queued. No success has been observed yet.' });
      return run;
    });
  }
  getEvents(runId: string, after = 0): RunEventRecord[] {
    return (this.db.prepare('SELECT * FROM events WHERE run_id=? AND id>? ORDER BY id LIMIT 200').all(runId, after) as Row[])
      .map(row => ({ id: Number(row.id), runId: String(row.run_id), createdAt: String(row.created_at),
        kind: String(row.kind) as RunEventRecord['kind'], message: String(row.message), data: row.data == null ? null : JSON.parse(String(row.data)) }));
  }
  claimNext(workerId: string, leaseMs = 60_000): ClaimedRun | null {
    return this.atomic(() => {
      if (this.getCleanupPending().length) return null;
      const row = this.db.prepare("SELECT * FROM runs WHERE status='queued' ORDER BY created_at LIMIT 1").get() as Row | undefined;
      if (!row) return null;
      const run = this.parse(row); const leaseToken = Number(row.lease_token) + 1;
      run.status = 'provisioning'; run.phase = 'Preparing real test environments'; run.updatedAt = now();
      this.db.prepare('UPDATE runs SET worker_id=?,lease_token=?,lease_expires=? WHERE id=?')
        .run(workerId, leaseToken, new Date(Date.now() + leaseMs).toISOString(), run.id);
      this.write(run); this.insertEvent(run.id, { kind: 'status', message: run.phase });
      return { run, lease: { workerId, leaseToken } };
    });
  }
  renewLease(runId: string, lease: Lease, leaseMs = 60_000) {
    return this.atomic(() => {
      this.assertLease(runId, lease);
      this.db.prepare('UPDATE runs SET lease_expires=? WHERE id=?').run(new Date(Date.now() + leaseMs).toISOString(), runId);
    });
  }
  updateRun(runId: string, lease: Lease, patch: Partial<RunRecord>): RunRecord {
    return this.atomic(() => {
      const existing = this.parse(this.assertLease(runId, lease));
      if (existing.status === 'cancel_requested' && patch.status && patch.status !== 'cancel_requested')
        throw new StoreError('CANCEL_REQUESTED', 'Cancellation is pending; a late result cannot replace it.');
      const updated: RunRecord = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt,
        scenarios: existing.scenarios, policy: existing.policy, testMode: true, updatedAt: now() };
      this.write(updated);
      if (patch.status && patch.status !== existing.status) this.insertEvent(runId, { kind: 'status', message: updated.phase, data: { status: updated.status } });
      return updated;
    });
  }
  finishRun(runId: string, lease: Lease, status: 'passed' | 'failed' | 'blocked' | 'interrupted', summary?: string, error?: string) {
    return this.updateRun(runId, lease, { status, phase: status === 'passed' ? 'Supported checks passed' : 'Test stopped', summary: summary ?? null, error: error ?? null });
  }
  appendEvent(runId: string, event: EventInput, lease: Lease): RunEventRecord {
    return this.atomic(() => { this.assertLease(runId, lease); return this.insertEvent(runId, event); });
  }
  requestCancel(ownerId: string, runId: string): RunRecord | null {
    return this.atomic(() => {
      const run = this.getRunForOwner(runId, ownerId); if (!run) return null;
      if (terminal.has(run.status) || run.status === 'cancel_requested') return run;
      // Queued jobs have no process or sandbox to terminate.
      run.status = run.status === 'queued' ? 'cancelled' : 'cancel_requested';
      run.phase = run.status === 'cancelled' ? 'Cancelled before execution' : 'Cancellation requested; waiting for cleanup';
      run.updatedAt = now(); this.write(run);
      this.insertEvent(runId, { kind: 'cleanup', message: run.phase }); return run;
    });
  }
  completeCancellation(runId: string, lease: Lease): RunRecord {
    return this.atomic(() => {
      const run = this.parse(this.assertLease(runId, lease));
      if (run.status !== 'cancel_requested') throw new StoreError('NOT_CANCELLING', 'No cancellation is pending.');
      run.status = 'cancelled'; run.phase = 'Cancelled; worker confirmed cleanup'; run.updatedAt = now();
      this.write(run); this.insertEvent(runId, { kind: 'cleanup', message: run.phase }); return run;
    });
  }
  recoverExpiredLeases(): RunRecord[] {
    return this.atomic(() => {
      const rows = this.db.prepare("SELECT * FROM runs WHERE status NOT IN ('queued','passed','failed','blocked','cancelled','interrupted') AND lease_expires<=?").all(now()) as Row[];
      return rows.map(row => {
        const run = this.parse(row); run.status = 'interrupted'; run.phase = 'Worker interrupted; cleanup requires reconciliation';
        run.error = 'Worker lease expired. Saved resource identifiers are retained for cleanup; success was not assumed.';
        run.updatedAt = now(); this.write(run);
        this.db.prepare('UPDATE runs SET lease_token=lease_token+1,worker_id=NULL,lease_expires=NULL WHERE id=?').run(run.id);
        this.db.prepare("INSERT INTO metadata(run_id,key,value) VALUES(?,'cleanup_pending','true') ON CONFLICT(run_id,key) DO UPDATE SET value='true'").run(run.id);
        this.insertEvent(run.id, { kind: 'error', message: run.error }); return run;
      });
    });
  }
  /** A trusted recovery worker must inspect retained IDs and verify cleanup before clearing this gate. */
  getCleanupPending(): RunRecord[] {
    return (this.db.prepare("SELECT r.* FROM runs r JOIN metadata m ON m.run_id=r.id WHERE m.key='cleanup_pending' AND m.value='true'").all() as Row[]).map(row => this.parse(row));
  }
  confirmCleanup(runId: string): void {
    this.atomic(() => {
      const run = this.getRun(runId);
      if (!run || !terminal.has(run.status)) throw new StoreError('NOT_TERMINAL', 'Recovery cleanup can only be confirmed for a stopped job.');
      this.db.prepare("UPDATE metadata SET value='false' WHERE run_id=? AND key='cleanup_pending'").run(runId);
      this.insertEvent(runId, { kind: 'cleanup', message: 'Trusted recovery worker confirmed previous environment cleanup.' });
    });
  }
  setMetadata(runId: string, key: string, value: unknown, lease: Lease) {
    this.atomic(() => { this.assertLease(runId, lease); this.db.prepare('INSERT INTO metadata(run_id,key,value) VALUES(?,?,?) ON CONFLICT(run_id,key) DO UPDATE SET value=excluded.value').run(runId, key, JSON.stringify(value)); });
  }
  getMetadata<T = unknown>(runId: string, key: string): T | null {
    const row = this.db.prepare('SELECT value FROM metadata WHERE run_id=? AND key=?').get(runId, key) as Row | undefined;
    return row ? JSON.parse(String(row.value)) as T : null;
  }
  addArtifact(runId: string, lease: Lease, input: { kind: ArtifactRecord['kind']; name: string; content: string }): ArtifactRecord {
    return this.atomic(() => {
      const run = this.parse(this.assertLease(runId, lease));
      if (Buffer.byteLength(input.content) > 512_000) throw new StoreError('ARTIFACT_TOO_LARGE', 'Artifact exceeds the bounded storage allowance.');
      const id = randomUUID(); const artifact: ArtifactRecord = { id, kind: input.kind, name: input.name.replace(/[\r\n"\\/]/g, '_'),
        sha256: hash(input.content), createdAt: now(), downloadUrl: `/api/runs/${runId}/artifacts/${id}` };
      this.db.prepare('INSERT INTO artifacts(id,run_id,content) VALUES(?,?,?)').run(id, runId, input.content);
      run.artifacts.push(artifact); run.updatedAt = now(); this.write(run); return artifact;
    });
  }
  getArtifactContent(ownerId: string, runId: string, artifactId: string): { artifact: ArtifactRecord; content: string } | null {
    const run = this.getRunForOwner(runId, ownerId); const artifact = run?.artifacts.find(a => a.id === artifactId);
    if (!artifact) return null;
    const row = this.db.prepare('SELECT content FROM artifacts WHERE id=? AND run_id=?').get(artifactId, runId) as Row | undefined;
    return row ? { artifact, content: String(row.content) } : null;
  }
}
