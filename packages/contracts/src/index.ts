import { z } from 'zod';

export const ProviderId = z.enum(['stripe', 'stripe_readonly', 'createos', 'groq']);
export const ProviderStatus = z.enum(['unconfigured', 'unchecked', 'ready', 'error']);
export const ProviderReadiness = z.object({
  id: ProviderId, status: ProviderStatus, message: z.string(), checkedAt: z.string().nullable(),
});
export const Readiness = z.object({
  ready: z.boolean(), providers: z.array(ProviderReadiness), blockers: z.array(z.string()),
  testMode: z.literal(true), activeRunId: z.string().nullable(),
});
export const ScenarioId = z.enum(['healthy_renewal', 'trial_payment_failure']);
export const RunStatus = z.enum(['queued','provisioning','baseline','repairing','verifying','passed','failed','blocked','cancel_requested','cancelled','interrupted']);
export const Check = z.object({
  id: z.string(), scenario: ScenarioId, customer: z.string(), checkpoint: z.string(),
  expectedAccess: z.boolean(), observedAccess: z.boolean().nullable(),
  stripeStatus: z.string().nullable(), verdict: z.enum(['pending','passed','failed','error']),
  message: z.string(), stripeObjectIds: z.array(z.string()),
});
export const Artifact = z.object({
  id: z.string(), kind: z.enum(['source','patch','execution','report']), name: z.string(),
  sha256: z.string(), createdAt: z.string(), downloadUrl: z.string(),
});
export const Run = z.object({
  id: z.string(), status: RunStatus, phase: z.string(), createdAt: z.string(), updatedAt: z.string(),
  attempt: z.number().int().nonnegative(), maxAttempts: z.number().int().min(1).max(3),
  scenarios: z.array(ScenarioId), checks: z.array(Check), artifacts: z.array(Artifact),
  summary: z.string().nullable(), error: z.string().nullable(),
  sandboxId: z.string().nullable(), previewUrl: z.string().nullable(),
  testMode: z.literal(true), policy: z.literal('active_or_trialing_no_grace'),
});
export const RunEvent = z.object({
  id: z.number().int().positive(), runId: z.string(), createdAt: z.string(),
  kind: z.enum(['status','observation','model','execution','check','cleanup','error']),
  message: z.string(), data: z.record(z.string(), z.unknown()).nullable(),
});
export const CreateRun = z.object({ scenarios: z.array(ScenarioId).min(1).max(2).refine(items=>new Set(items).size===items.length,'Scenarios must be distinct.').default(['healthy_renewal','trial_payment_failure']) }).strict();
export const Session = z.object({ csrfToken: z.string(), testMode: z.literal(true) });
export const ErrorResponse = z.object({ error: z.object({ code: z.string(), message: z.string(), blockers: z.array(z.string()).optional() }) });
export type RunRecord = z.infer<typeof Run>;
export type CheckRecord = z.infer<typeof Check>;
export type RunEventRecord = z.infer<typeof RunEvent>;
export type ArtifactRecord = z.infer<typeof Artifact>;
export type ReadinessRecord = z.infer<typeof Readiness>;
export type ProviderReadinessRecord = z.infer<typeof ProviderReadiness>;
export type Scenario = z.infer<typeof ScenarioId>;
