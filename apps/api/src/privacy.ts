/** Values stay private. Public diagnostics report only explicit booleans/counts. */
export function credentialValues(environment: NodeJS.ProcessEnv): string[] {
  const values = new Set<string>();
  const collect = (value: unknown, depth = 0): void => {
    if (depth > 8) return;
    if (typeof value === 'string') {
      if (value.length >= 8) values.add(value);
      if (/^[\[{]/.test(value.trim())) { try { collect(JSON.parse(value), depth + 1); } catch { /* opaque credential */ } }
    } else if (Array.isArray(value)) value.forEach(item => collect(item, depth + 1));
    else if (value && typeof value === 'object') Object.values(value).forEach(item => collect(item, depth + 1));
  };
  for (const [name, value] of Object.entries(environment))
    if (/(?:KEY|SECRET|PASSWORD|TOKEN|CREDENTIAL|AUTH|COOKIE)/i.test(name)) collect(value);
  return [...values].sort((a,b) => b.length - a.length);
}
export function redactDiagnosticText(value: string, environment: NodeJS.ProcessEnv = process.env): string {
  let redacted = value;
  for (const secret of credentialValues(environment)) {
    redacted = redacted.split(secret).join('[REDACTED]');
    const encoded = JSON.stringify(secret).slice(1,-1);
    if (encoded !== secret) redacted = redacted.split(encoded).join('[REDACTED]');
  }
  return redacted.replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+\b|\bwhsec_[A-Za-z0-9]+\b|\bgsk_[A-Za-z0-9]+\b|\bskp_[A-Za-z0-9_-]+\b/gi, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]');
}
export function safeDiagnosticSummary(environment: NodeJS.ProcessEnv) {
  const configured = (name: string) => Boolean(environment[name]);
  const boundedNumber = (name: string, maximum: number) => {
    const value = environment[name];
    if (!value || !/^\d+$/.test(value)) return null;
    const number = Number(value); return Number.isSafeInteger(number) && number <= maximum ? number : null;
  };
  return {
    credentialsConfigured: {
      stripeController: configured('STRIPE_SECRET_KEY'), stripeReader: configured('STRIPE_READONLY_KEY'),
      sandbox: configured('CREATEOS_SANDBOX_API_KEY'), groq: configured('GROQ_API_KEY'),
      runtime: configured('FASTFORWARD_RUNTIME_API_KEY'), runtimeContainer: configured('FASTFORWARD_RUNTIME_CREDENTIALS'),
    },
    budget: {maxModelCalls:boundedNumber('MAX_MODEL_CALLS_PER_RUN',3),maxOutputTokens:boundedNumber('MODEL_MAX_OUTPUT_TOKENS',8000),
      maxGlobalRuns:boundedNumber('MAX_RUNS_PER_DAY',50),runSeconds:boundedNumber('RUN_TIMEOUT_SECONDS',1800)},
    sharedRuntimeCredential: credentialValues(Object.fromEntries(Object.entries(environment).filter(([name])=>name.startsWith('FASTFORWARD_RUNTIME_'))))
      .some(value=>credentialValues(Object.fromEntries(Object.entries(environment).filter(([name])=>name.startsWith('CARRY_CREATEOS_FREE_')))).includes(value)),
  };
}
