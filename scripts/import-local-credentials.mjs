import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

// Explicitly authorised credential reuse only. This does not read or copy prior application code.
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Provide the local .env path as the only argument. Never provide secret values.');
const destination = resolve('.env');
if (existsSync(destination)) throw new Error('Destination .env already exists; refusing to overwrite it.');
const source = Object.fromEntries(readFileSync(resolve(sourcePath), 'utf8').split(/\r?\n/).flatMap(line => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) return [];
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1,-1);
  return [[match[1], value]];
}));
const first = names => names.map(name => source[name]).find(Boolean) || '';
const stripe = first(['CARRY_SERVICE_STRIPE_SECRET_KEY','STRIPE_DESTINATION_SECRET_KEY','STRIPE_SECRET_KEY']);
if (stripe && !/^(sk|rk)_test_/.test(stripe)) throw new Error('Saved Stripe credential is not a test key; refusing import.');
const variables = {
  HOST:'127.0.0.1', PORT:'3000', APP_ORIGIN:'http://localhost:5173', FASTFORWARD_DATA_DIR:'.local/data',
  FASTFORWARD_SESSION_SECRET:randomBytes(32).toString('hex'),
  CREATEOS_SANDBOX_BASE_URL:'https://api-eu.sb.createos.sh',
  CREATEOS_SANDBOX_API_KEY:first(['CREATEOS_SANDBOX_API_KEY']), CREATEOS_SANDBOX_SHAPE:'s-1vcpu-1gb',
  STRIPE_SECRET_KEY:stripe, STRIPE_READONLY_KEY:first(['STRIPE_READONLY_KEY']),
  GROQ_API_KEY:first(['GROQ_API_KEY']), GROQ_MODEL:'openai/gpt-oss-120b',
  MAX_MODEL_CALLS_PER_RUN:'0', MODEL_MAX_OUTPUT_TOKENS:'0', MAX_RUNS_PER_DAY:'0', RUN_TIMEOUT_SECONDS:'600',
};
mkdirSync('.local',{recursive:true});
writeFileSync(destination, Object.entries(variables).map(([name,value])=>`${name}=${JSON.stringify(value)}`).join('\n')+'\n', {mode:0o600, flag:'wx'});
console.log(JSON.stringify({file:'.env', credentials:Object.fromEntries(['CREATEOS_SANDBOX_API_KEY','STRIPE_SECRET_KEY','STRIPE_READONLY_KEY','GROQ_API_KEY'].map(name=>[name,Boolean(variables[name])])),spendingEnabled:false}));
