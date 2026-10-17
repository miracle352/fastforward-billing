# Fastforward

**Find and fix subscription-access bugs before your customers do.**

Fastforward is a new CreateOS × Stripe Projects hackathon implementation. It exercises selected Stripe test subscription lifecycles against a deliberately incomplete sample application, generates a Python billing-handler repair, executes it in CreateOS, and verifies real protected report access with a fixed external evaluator.

## Current evidence boundary

Backend implementation and integration are in progress. Read BUILD-STATE.md for observed checks. Provider account access is not a successful repair. No claim is made about arbitrary applications, production safety, all billing paths, or a guaranteed completion time.

Only synthetic customers, Stripe TEST resources and simulated billing time are permitted. The sample policy allows access for active/trialing subscriptions and deliberately has no past-due grace period; that is a reviewed sample policy, not a universal Stripe rule.

## Local setup

Requires Node 24+.

```sh
npm ci
# Create .env from .env.example privately and populate server-only credentials.
npm run providers:check
npm test
npm run check
```

Configure a Stripe test controller key, a separately restricted read-only Stripe test key, CreateOS Sandbox key and Groq key. The restricted key must belong to the same test environment and have no write permissions. Set STRIPE_READONLY_CONFIRMED=true only after checking its configuration.

Explicit budgets default to zero. The operator must choose MAX_MODEL_CALLS_PER_RUN (1–3), MODEL_MAX_OUTPUT_TOKENS, MAX_RUNS_PER_DAY and the runtime bound before any run can start. Groq model visibility does not prove that the account has available token allowance; check actual account limits. No OpenAI API key is required.

The event-specific CreateOS endpoint is https://api-eu.sb.createos.sh, as provided by organisers. Keep the endpoint configurable; keys and actual account allocation must be verified.

Development runs three processes:

```sh
npm run dev:api
npm run dev:worker
npm run dev:web
```

The frontend is being implemented separately by Claude Code in apps/web/. Follow docs/CLAUDE-DESIGN-BRIEF.md. Vite must proxy /api to http://127.0.0.1:3000. No provider credentials belong in browser variables.

## Build ownership

- Codex: trusted API, durable worker, schemas, provider adapters, tests and deployment.
- Claude Code: React/Vite interface in apps/web/ and frontend notes.
- Canonical API schemas: packages/contracts/src/index.ts.
- Boundary and state rules: docs/API-HANDOFF.md.
- Only Codex updates the shared root dependency lockfile and pushes commits.

## Verification and safety

The evaluator/policy lives outside the generated-code VM. It tests authenticated private report access and denied unauthenticated/cross-customer requests. Generated Python receives only restricted Stripe test reads. It never receives controller, CreateOS or model credentials.

CreateOS networking uses an explicit nonempty destination allowlist before unfamiliar code runs. Source, execution receipts, observations and artifacts are retained by the trusted controller. A fresh Stripe clock and fresh customer identities are used for verification. Webhook HTTP 200 alone is never a passing result.

Jobs use durable SQLite storage, atomic claims, fenced leases and a separate persistent worker. The service must have an explicitly persistent data volume; an ephemeral filesystem is insufficient for durable hosted operation. A browser disconnect does not itself cancel a worker job. Cancellation remains requested until resource cleanup is observed.

## Hosting

The production process starts API and worker through npm start and serves compiled Vite output on the API origin. Configure HOST=0.0.0.0, PORT, APP_ORIGIN to the real HTTPS origin, and FASTFORWARD_DATA_DIR to the mounted persistent volume. Do not scale this SQLite deployment to multiple replicas.

Before claiming hosted completion, verify persistent storage, outbound provider access, worker restart recovery, browser-disconnect operation, anonymous/session boundaries, cleanup and the real public URL. Deployment entitlement and pricing are not yet verified.

## Sponsors and event submission

Provision the new stack through Stripe Projects during the event. Stripe Billing supplies real test lifecycle state; CreateOS runs generated code and exposes the sample webhook URL. Swytchcode is optional until a useful, available governance path is verified; no integration is claimed without execution evidence.

Organiser updates specify submission by October 17, 2026, 5:30 PM Pacific (October 18, 01:30 Lagos). Submit the event form and Stripe Projects leaderboard with code **CreateOS-2026**. Public repository, viewable 2–3-minute video including a person on camera, team details and a tagged public post are required per supplied announcements.

## Prior art and licences

CreateOS publicly proposes a Stripe webhook fixer. This project concentrates on approved customer-access behaviour after coherent subscription lifecycles and fresh verification, beyond successful HTTP delivery. Stripe test clocks are existing infrastructure, not an invention of this project.

The original application is newly written for the event. Open-source dependencies retain their respective licences. Do not commit credentials, local databases, private artifacts or old Carry source. No AI-generated media is used.
