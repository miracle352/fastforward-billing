import {resolve} from 'node:path';
import {RunStore} from './store.js';
import {PostgresRunStore} from './postgres-store.js';
import type {Config} from './config.js';
export type Store=RunStore|PostgresRunStore;
export async function openStore(config:Config):Promise<Store>{
 return config.databaseUrl?PostgresRunStore.open(config.databaseUrl):new RunStore(resolve(config.server.dataDir,'fastforward.sqlite'));
}
