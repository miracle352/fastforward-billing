import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {credentialValues} from '../apps/api/src/privacy.ts';

try {
const environment={...process.env,...(existsSync('.env')?parseEnv(readFileSync('.env','utf8')):{})};
const sensitive=[...new Set([credentialValues(environment),...['.local/credential-backups','.local/full-rotation-backups'].filter(existsSync).flatMap(directory=>readdirSync(directory).filter(name=>name.endsWith('.env')).map(name=>credentialValues(parseEnv(readFileSync(directory+'/'+name,'utf8')))))].flat())];
const args=process.argv.slice(2);const history=args.includes('--history');const tracked=args.includes('--tracked');
const git=(args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:50_000_000,stdio:['pipe','pipe','pipe']});
const files=git(tracked?['ls-files']:['diff','--cached','--name-only','--diff-filter=ACM']).trim().split(/\r?\n/).filter(Boolean);
const findings=[];
for(const path of files){
 if(/(^|\/)(\.env(?:\..*)?|\.local|vault)(\/|$)/.test(path)&&path!=='.env.example')findings.push({path,issue:'Private path included'});
 const content=tracked&&existsSync(path)?readFileSync(path,'utf8'):git(['show',`:${path}`]);
 if(sensitive.some(value=>content.includes(value)||content.includes(JSON.stringify(value).slice(1,-1))))findings.push({path,issue:'Configured credential value found'});
}
let historicalBlobsScanned=0;
if(history){
 const ids=[...new Set(git(['rev-list','--objects','--all']).trim().split(/\r?\n/).map(line=>line.split(' ')[0]).filter(Boolean))];
 const types=execFileSync('git',['cat-file','--batch-check=%(objectname) %(objecttype)'],{input:ids.join('\n')+'\n',encoding:'utf8',maxBuffer:50_000_000,stdio:['pipe','pipe','pipe']});
 for(const line of types.trim().split(/\r?\n/)){
  const [id,type]=line.split(' ');if(type!=='blob')continue;historicalBlobsScanned++;
  const content=git(['cat-file','blob',id]);if(sensitive.some(value=>content.includes(value)||content.includes(JSON.stringify(value).slice(1,-1))))findings.push({scope:'history',issue:'Configured credential in a reachable historical blob'});
 }
}
console.log(JSON.stringify({filesScanned:files.length,scope:tracked?'tracked':'staged',knownCredentialValuesChecked:sensitive.length,historicalBlobsScanned,findings},null,2));
if(findings.length)process.exitCode=1;

} catch { console.error(JSON.stringify({auditFailed:true,reason:'Credential audit could not complete; private error details were suppressed.'})); process.exitCode=1; }
