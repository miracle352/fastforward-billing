import { resolve } from 'node:path';
import { mkdirSync,writeFileSync } from 'node:fs';
import { loadConfig } from './config.js';
import { RunStore } from './store.js';
import { getReadiness } from './readiness.js';
const config=loadConfig();
const store=new RunStore(resolve(config.server.dataDir,'fastforward.sqlite'));
try{
  const result=await getReadiness(config,store,true);
  mkdirSync('.local',{recursive:true});
  writeFileSync('.local/provider-readiness.json',JSON.stringify(result,null,2));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  process.exitCode=result.ready?0:2;
}finally{store.close();}
