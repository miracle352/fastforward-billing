import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { getReadiness } from './readiness.js';
import { RunStore } from './store.js';
import { createServer } from './server.js';

const config = loadConfig();
const store = new RunStore(resolve(config.server.dataDir, 'fastforward.sqlite'));
const app = await createServer({
  store, readiness: () => getReadiness(config, store), ...config.server,
  staticRoot: resolve('apps/web/dist'),
});
app.addHook('onClose', async () => store.close());
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await app.close();
};
process.once('SIGTERM', () => { void stop(); });
process.once('SIGINT', () => { void stop(); });
try {
  await app.listen({ port: config.server.port, host: config.server.host });
  process.stdout.write(`Fastforward API listening on port ${config.server.port}; test mode only.\n`);
} catch {
  process.stderr.write('Fastforward API could not bind its configured port.\n');
  await stop(); process.exitCode = 1;
}
