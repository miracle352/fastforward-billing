import { createClient, type Sandbox } from '@nodeops-createos/sandbox';
import { boundedText, ProviderError, safeProviderError } from './common.js';

export interface ExecutionReceipt {
  sandboxId: string; command: string; args: string[]; stdout: string; stderr: string;
  exitCode: number; durationMs: number; observedAt: string;
}
export interface SandboxReceipt { sandboxId: string; status: string; egress: string[]; observedAt: string; }

/** The regional control plane accepts at most 22 characters, including the prefix. */
export function sandboxNameForRun(runId: string): string {
  const suffix = runId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 19);
  if (!suffix) throw new ProviderError('createos', 'RUN_ID_REQUIRED', 'A run identifier is required for sandbox creation.');
  return `ff-${suffix}`;
}

export function assertRestrictedEgress(egress: string[]): void {
  if (!Array.isArray(egress) || !egress.length || egress.some(rule => !rule.trim() || rule.trim() === '*'
    || rule.trim() === '0.0.0.0/0' || rule.trim() === '::/0'))
    throw new ProviderError('createos', 'EGRESS_REQUIRED', 'A nonempty destination allowlist is required before generated code executes.');
  if (!egress.includes('api.stripe.com:443'))
    throw new ProviderError('createos', 'STRIPE_EGRESS_REQUIRED', 'The sample app requires api.stripe.com:443 in its explicit allowlist.');
}

export class CreateOSProvider {
  private readonly client: ReturnType<typeof createClient>;
  private readonly config: { apiKey: string; baseUrl: string; egress: string[]; shape?: string; rootfs?: string };
  constructor(config: { apiKey: string; baseUrl: string; egress: string[]; shape?: string; rootfs?: string }) {
    assertRestrictedEgress(config.egress);
    if (!config.apiKey || new URL(config.baseUrl).protocol !== 'https:')
      throw new ProviderError('createos', 'CONFIG_REQUIRED', 'Configure a CreateOS API key and HTTPS API endpoint.');
    this.config = { ...config, egress: [...config.egress] };
    this.client = createClient({ apiKey: config.apiKey, baseUrl: config.baseUrl, timeoutMs: 30_000, retry: false });
  }
  async probe(): Promise<{ authenticated: true; running: number | null; activeSandboxIds: string[]; creationPerformed: false }> {
    try {
      const [identity, boxes] = await Promise.all([this.client.whoami(), this.client.listSandboxes({ limit: 100 })]);
      const stats = identity.stats as unknown as { running?: number };
      return { authenticated: true, running: stats.running ?? null,
        activeSandboxIds: boxes.filter(box => !['destroyed','failed'].includes(box.status)).map(box => box.id), creationPerformed: false };
    } catch (error) { throw safeProviderError('createos', error); }
  }
  async createRunSandbox(runId: string, env: Record<string, string> = {},
    onCreated?: (receipt: SandboxReceipt) => void | Promise<void>): Promise<Sandbox> {
    assertRestrictedEgress(this.config.egress);
    // Only explicitly supplied per-app test credentials are injected. Never inherit process.env.
    if (Object.entries(env).some(([name, value]) => /(?:CONTROLLER|GROQ|CREATEOS)/i.test(name) || /(?:sk|rk)_live_/.test(value)
      || /^sk_test_/.test(value)))
      throw new ProviderError('createos', 'SECRET_BOUNDARY', 'Controller/model/platform secrets cannot be passed into generated-code sandboxes.');
    let sandbox: Sandbox | undefined;
    try {
      sandbox = await this.client.createSandbox({ name: sandboxNameForRun(runId),
        shape: this.config.shape ?? 's-1vcpu-1gb', rootfs: this.config.rootfs ?? 'devbox:1',
        egress: this.config.egress, envs: env, auto_pause_after_seconds: 600,
      }, { wait: false, timeoutMs: 30_000 });
      await onCreated?.({ sandboxId: sandbox.id, status: sandbox.status, egress: [...this.config.egress], observedAt: new Date().toISOString() });
      await sandbox.waitUntilRunning({ timeoutMs: 120_000 });
      const policy = await sandbox.getEgress();
      assertRestrictedEgress(policy.egress);
      if (policy.egress.length !== this.config.egress.length || policy.egress.some(rule => !this.config.egress.includes(rule)))
        throw new ProviderError('createos', 'EGRESS_MISMATCH', 'Observed sandbox networking policy differs from the required allowlist.');
      return sandbox;
    } catch (error) {
      let cleanupConfirmed = !sandbox;
      if (sandbox) {
        try { await sandbox.destroy(); await sandbox.waitUntilDestroyed({ timeoutMs: 60_000 }); cleanupConfirmed = true; }
        catch { cleanupConfirmed = false; }
      }
      const safe = safeProviderError('createos', error);
      throw new ProviderError('createos', safe.code, safe.message,
        { sandboxId: sandbox?.id ?? null, cleanupConfirmed });
    }
  }
  async reconnect(sandboxId: string): Promise<Sandbox> {
    try { return await this.client.getSandbox(sandboxId); } catch (error) { throw safeProviderError('createos', error); }
  }
  async uploadFiles(sandbox: Sandbox, files: Record<string, string>): Promise<void> {
    const entries = Object.entries(files);
    if (!entries.length || entries.length > 20 || entries.some(([path, content]) => !path.startsWith('/tmp/fastforward/')
      || path.includes('..') || content.length > 200_000))
      throw new ProviderError('createos', 'UPLOAD_BOUNDARY', 'Uploads must be bounded files beneath /tmp/fastforward/.');
    try {
      const mkdir = await sandbox.runCommand('mkdir', ['-p', '/tmp/fastforward'], { timeoutMs: 10_000 });
      if (mkdir.result.exit_code !== 0) throw new ProviderError('createos', 'MKDIR_FAILED', 'The sandbox application directory could not be created.');
      for (const [path, content] of entries) await sandbox.files.upload(path, content, { timeoutMs: 20_000 });
    } catch (error) { throw safeProviderError('createos', error); }
  }
  async execute(sandbox: Sandbox, command: string, args: string[], timeoutMs = 30_000): Promise<ExecutionReceipt> {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000)
      throw new ProviderError('createos', 'TIMEOUT_REQUIRED', 'Sandbox commands require a bounded timeout.');
    try {
      // GNU timeout stops the process; a transport timeout alone does not guarantee process termination.
      const result = await sandbox.runCommand('timeout', ['--signal=TERM','--kill-after=2s',`${Math.ceil(timeoutMs / 1000)}s`, command, ...args],
        { timeoutMs: timeoutMs + 10_000, retry: false });
      return { sandboxId: sandbox.id, command, args, stdout: boundedText(result.result.stdout), stderr: boundedText(result.result.stderr),
        exitCode: result.result.exit_code, durationMs: result.exec_ms, observedAt: new Date().toISOString() };
    } catch (error) { throw safeProviderError('createos', error); }
  }
  async startProcess(sandbox: Sandbox, request: { cmd: string; args: string[]; cwd?: string; env?: Record<string,string> }): Promise<{ processId: string }> {
    if (Object.entries(request.env ?? {}).some(([name,value]) => /(?:CONTROLLER|GROQ|CREATEOS)/i.test(name)
      || /(?:sk|rk)_live_|sk_test_/.test(value)))
      throw new ProviderError('createos', 'SECRET_BOUNDARY', 'Trusted-controller credentials cannot be passed to the application process.');
    try { const process = await sandbox.processes.create(request); return { processId: process.process_id }; }
    catch (error) { throw safeProviderError('createos', error); }
  }
  async stopProcess(sandbox: Sandbox, processId: string): Promise<void> {
    try { await sandbox.processes.delete(processId); } catch (error) { throw safeProviderError('createos', error); }
  }
  async preview(sandbox: Sandbox, port: number): Promise<string> {
    try { await sandbox.setIngress(true); await sandbox.waitForPortReady(port, { timeoutMs: 30_000 }); return sandbox.previewUrl(port); }
    catch (error) { throw safeProviderError('createos', error); }
  }
  async downloadText(sandbox: Sandbox, path: string): Promise<string> {
    if (!path.startsWith('/tmp/fastforward/') || path.includes('..')) throw new ProviderError('createos', 'DOWNLOAD_BOUNDARY', 'Artifact path is outside the sample app.');
    try { return boundedText(new TextDecoder().decode(await sandbox.files.download(path)), 100_000); }
    catch (error) { throw safeProviderError('createos', error); }
  }
  async destroy(sandbox: Sandbox): Promise<{ sandboxId: string; destroyed: true; observedAt: string }> {
    try { await sandbox.destroy(); await sandbox.waitUntilDestroyed({ timeoutMs: 60_000 });
      return { sandboxId: sandbox.id, destroyed: true, observedAt: new Date().toISOString() }; }
    catch (error) { throw safeProviderError('createos', error); }
  }
}
