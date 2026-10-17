import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import {openStore} from './storage.js';
import { runWorker } from './worker.js';

const config = loadConfig();
const store = await openStore(config);
const shutdown = new AbortController();
process.once('SIGTERM', () => shutdown.abort());
process.once('SIGINT', () => shutdown.abort());
process.stdout.write(config.databaseUrl ? 'Fastforward worker ready; storage=postgres; test mode only.\n' : 'Fastforward worker ready; storage=sqlite; test mode only.\n');
try { await runWorker(config, store, shutdown.signal); }
finally { await store.close(); }
