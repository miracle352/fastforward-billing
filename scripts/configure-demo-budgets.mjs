import {readFileSync,writeFileSync} from 'node:fs';
const values={MAX_MODEL_CALLS_PER_RUN:'3',MODEL_MAX_OUTPUT_TOKENS:'3000',MAX_RUNS_PER_DAY:'6',RUN_TIMEOUT_SECONDS:'600'};
let contents=readFileSync('.env','utf8');
for(const [name,value] of Object.entries(values)){
  const pattern=new RegExp(`^${name}=.*$`,'m');
  contents=pattern.test(contents)?contents.replace(pattern,`${name}=${value}`):`${contents.trimEnd()}\n${name}=${value}\n`;
}
writeFileSync('.env',contents,{mode:0o600});
console.log(JSON.stringify({configuredBudgets:values,providerCredentialsDisplayed:false,paidUpgrade:false}));
