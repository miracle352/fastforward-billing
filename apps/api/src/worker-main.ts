import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { RunStore } from './store.js';
import { runWorker } from './worker.js';

const config = loadConfig();
const store = new RunStore(resolve(config.server.dataDir, 'fastforward.sqlite'));
const shutdown = new AbortController();
process.once('SIGTERM', () => shutdown.abort());
process.once('SIGINT', () => shutdown.abort());
try { await runWorker(config, store, shutdown.signal); }
finally { store.close(); }
