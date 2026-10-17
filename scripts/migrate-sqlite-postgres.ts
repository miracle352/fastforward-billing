import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {loadConfig} from '../apps/api/src/config.js';
import {PostgresRunStore} from '../apps/api/src/postgres-store.js';
let destination:PostgresRunStore|undefined;
try{
 const config=loadConfig();if(!config.databaseUrl)throw Error('A destination URL is required');
 if(config.server.acceptNewRuns)throw Error('Source admission must be paused');
 const readiness=await fetch('http://127.0.0.1:'+config.server.port+'/api/readiness',{signal:AbortSignal.timeout(16000)});const ready=await readiness.json() as {ready?:boolean;blockers?:string[]};
 if(!readiness.ok||ready.ready!==false||!ready.blockers?.includes('New runs are paused by the operator.'))throw Error('Running source admission pause not observed');
 const source=new DatabaseSync(resolve(config.server.dataDir,'fastforward.sqlite'),{readOnly:true});
 const tables=['sessions','runs','run_requests','events','artifacts','metadata'];const snapshot:Record<string,Record<string,unknown>[] >={};
 try{source.exec('BEGIN');const active=Number(source.prepare("SELECT COUNT(*) AS n FROM runs WHERE status NOT IN ('passed','failed','blocked','cancelled','interrupted')").get()!.n);if(active)throw Error('Migration requires idle source');
 for(const table of tables){const exists=source.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);snapshot[table]=exists?source.prepare('SELECT * FROM '+table).all():[];}source.exec('COMMIT');}finally{source.close();}
 destination=await PostgresRunStore.open(config.databaseUrl);const counts=await destination.importLegacy(snapshot);
 console.log(JSON.stringify({migrationConfirmed:true,sourcePreserved:true,rows:counts,providerRuns:0}));
}catch{console.error(JSON.stringify({migrationFailed:true,sourcePreserved:true,privateDetailsSuppressed:true}));process.exitCode=1;}
finally{await destination?.close();}
