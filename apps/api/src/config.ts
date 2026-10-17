import { resolve } from 'node:path';
import { z } from 'zod';

const Budget = z.coerce.number().int().nonnegative();
const Env = z.object({
  FASTFORWARD_ACCEPT_RUNS: z.enum(['true','false']).default('true'),
  DATABASE_URL: z.string().default('').refine(value => {if(!value)return true;try{const url=new URL(value);return ['postgres:','postgresql:'].includes(url.protocol)&&url.hostname.endsWith('.neon.tech');}catch{return false;}}),
  HOST: z.string().default('127.0.0.1'), PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  FASTFORWARD_DATA_DIR: z.string().default('.local/data'),
  FASTFORWARD_SESSION_SECRET: z.string().default(''),
  CREATEOS_SANDBOX_BASE_URL: z.string().url().refine(value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } }).default('https://api-eu.sb.createos.sh'),
  CREATEOS_SANDBOX_API_KEY: z.string().default(''),
  CREATEOS_SANDBOX_SHAPE: z.string().default('s-1vcpu-1gb'),
  STRIPE_SECRET_KEY: z.string().default(''), STRIPE_READONLY_KEY: z.string().default(''),
  STRIPE_READONLY_CONFIRMED: z.enum(['true','false']).default('false'),
  GROQ_API_KEY: z.string().default(''), GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  MAX_MODEL_CALLS_PER_RUN: Budget.max(3).default(0), MODEL_MAX_OUTPUT_TOKENS: Budget.max(8000).default(0),
  MAX_RUNS_PER_DAY: Budget.max(50).default(0), RUN_TIMEOUT_SECONDS: z.coerce.number().int().min(30).max(1800).default(600),
});

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = Env.safeParse(environment);
  if (!parsed.success) throw new Error('Invalid server configuration fields: ' + [...new Set(parsed.error.issues.map(issue => issue.path.join('.')))].join(', '));
  const env = parsed.data;
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith('sk_test_')) throw new Error('The controller requires a Stripe secret TEST key; generated code receives only the separate restricted reader.');
  if (env.STRIPE_READONLY_KEY && !env.STRIPE_READONLY_KEY.startsWith('rk_test_')) throw new Error('The generated application requires a restricted Stripe TEST key.');
  const origin = new URL(env.APP_ORIGIN).origin;
  return {
    databaseUrl: env.DATABASE_URL,
    server: { acceptNewRuns: env.FASTFORWARD_ACCEPT_RUNS === 'true', host: env.HOST, port: env.PORT, origin, dataDir: resolve(env.FASTFORWARD_DATA_DIR), globalDailyLimit: env.MAX_RUNS_PER_DAY, ownerDailyLimit: Math.min(env.MAX_RUNS_PER_DAY, 3), secureCookies: origin.startsWith('https:'), sessionSecret: env.FASTFORWARD_SESSION_SECRET },
    stripe: { controllerKey: env.STRIPE_SECRET_KEY, readonlyKey: env.STRIPE_READONLY_KEY, readonlyConfirmed: env.STRIPE_READONLY_CONFIRMED === 'true', pollTimeoutMs: 90_000 },
    createos: { apiKey: env.CREATEOS_SANDBOX_API_KEY, baseUrl: env.CREATEOS_SANDBOX_BASE_URL, shape: env.CREATEOS_SANDBOX_SHAPE, rootfs: 'devbox:1', egress: ['api.stripe.com:443'] },
    groq: { apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, maxCalls: env.MAX_MODEL_CALLS_PER_RUN, maxOutputTokens: env.MODEL_MAX_OUTPUT_TOKENS, timeoutMs: 90_000 },
    runTimeoutMs: env.RUN_TIMEOUT_SECONDS * 1000,
  };
}
export type Config = ReturnType<typeof loadConfig>;
