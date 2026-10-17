import { resolve } from 'node:path';
import { mkdirSync,writeFileSync } from 'node:fs';
import { loadConfig } from './config.js';
import {openStore} from './storage.js';
import { getReadiness } from './readiness.js';
const config=loadConfig();
const store=await openStore(config);
try{
  const result=await getReadiness(config,store,true);
  mkdirSync('.local',{recursive:true});
  writeFileSync('.local/provider-readiness.json',JSON.stringify(result,null,2));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  process.exitCode=result.ready?0:2;
}finally{await store.close();}
