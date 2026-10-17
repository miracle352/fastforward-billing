import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Start both persistent processes at service startup, never from an HTTP request.
// All processes share DATABASE_URL, or a verified persistent FASTFORWARD_DATA_DIR for SQLite.
const children = new Map<string, ChildProcess>();
const restarts = new Map<string, number[]>();
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children.values()) child.kill('SIGTERM');
  const deadline = setTimeout(() => {
    for (const child of children.values()) child.kill('SIGKILL');
  }, 10_000);
  deadline.unref();
}
function launch(name: 'main' | 'worker-main') {
  if (stopping) return;
  const sourceMode = import.meta.url.endsWith('.ts');
  const entry = fileURLToPath(new URL(`./${name}.${sourceMode ? 'ts' : 'js'}`, import.meta.url));
  const child = spawn(process.execPath, [...(sourceMode ? ['--import','tsx'] : []), entry], { stdio: 'inherit', env: process.env, windowsHide: true });
  children.set(name, child);
  child.once('error', () => { process.stderr.write(`Fastforward ${name} process could not start.\n`); shutdown(1); });
  child.once('exit', () => {
    children.delete(name);
    if (stopping) return;
    const recent = (restarts.get(name) ?? []).filter(timestamp => timestamp > Date.now() - 5 * 60_000);
    if (recent.length >= 3) {
      process.stderr.write(`Fastforward ${name} exceeded its bounded restart allowance.\n`);
      shutdown(1); return;
    }
    recent.push(Date.now()); restarts.set(name, recent);
    setTimeout(() => launch(name), Math.min(5_000, recent.length * 1_000));
  });
}
process.once('SIGTERM', () => shutdown());
process.once('SIGINT', () => shutdown());
launch('main');
launch('worker-main');
