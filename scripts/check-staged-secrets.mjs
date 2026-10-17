import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';

const sensitive=[];
if(existsSync('.env')) for(const line of readFileSync('.env','utf8').split(/\r?\n/)){
  const match=line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if(!match || !/(?:KEY|SECRET|PASSWORD|TOKEN)/.test(match[1])) continue;
  let value=match[2].trim();
  if(value.startsWith('"')){try{value=JSON.parse(value);}catch{throw new Error('Invalid private env quoting.');}}
  else if(value.startsWith("'")&&value.endsWith("'"))value=value.slice(1,-1);
  if(typeof value==='string'&&value.length>=12)sensitive.push({name:match[1],value});
}
const files=execFileSync('git',['diff','--cached','--name-only','--diff-filter=ACM'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const findings=[];
for(const path of files){
  if(/(^|\/)(\.env(?:\..*)?|\.local|vault)(\/|$)/.test(path)&&path!=='.env.example')findings.push({path,issue:'Private path staged'});
  const content=execFileSync('git',['show',`:${path}`],{encoding:'utf8',maxBuffer:5_000_000});
  for(const secret of sensitive)if(content.includes(secret.value))findings.push({path,issue:`Saved ${secret.name} value found`});
}
console.log(JSON.stringify({stagedFiles:files.length,knownLocalSecretsChecked:sensitive.length,findings},null,2));
if(findings.length)process.exitCode=1;
