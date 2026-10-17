# Fastforward

**Find and fix subscription-access bugs before your customers do.**

Fastforward is a new CreateOS × Stripe Projects hackathon implementation. It exercises selected Stripe test subscription lifecycles against a deliberately incomplete sample application, generates a Python billing-handler repair, executes it in CreateOS, and verifies real protected report access with a fixed external evaluator.

## Current evidence boundary

The backend has three recorded successful real repair runs. In the first, the baseline exposed an access mismatch, one model call produced a handler, CreateOS executed it, and all seven fresh-customer checks passed. Cleanup was confirmed. See [the redacted receipt](docs/evidence/2026-10-17-live-repair.json) and BUILD-STATE.md. A second, browser-started run through the production frontend also passed all seven fresh-customer checks, with three bounded Groq calls and confirmed cleanup. Report download integrity and local API restart persistence were verified; see [the browser receipt](docs/evidence/2026-10-17-browser-integration.json). Persistent public hosting remains blocked; see [deployment findings](docs/DEPLOYMENT.md). No claim is made about arbitrary applications, production safety, all billing paths, or a guaranteed completion time.

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

The React frontend is implemented by Claude Code in apps/web/ and uses the canonical API. Vite proxies /api to the local API; its actual origin must match APP_ORIGIN for POSTs. If port 5173 is occupied, configure a matching origin instead of relying on Vite selecting another port. No provider credentials belong in browser variables. Run npm run verify:integration to build the frontend and verify production asset/API serving without external provider calls.

## Build ownership

- Codex: trusted API, durable worker, schemas, provider adapters, tests and deployment.
- Claude Code: React/Vite interface in apps/web/ and frontend notes.
- Canonical API schemas: packages/contracts/src/index.ts.
- Boundary and state rules: docs/API-HANDOFF.md.
- Only Codex updates the shared root dependency lockfile and pushes commits.

## Verification and safety

The evaluator/policy lives outside the generated-code VM. It tests authenticated private report access and denied unauthenticated/cross-customer requests. Generated Python receives only restricted Stripe test reads. It never receives controller, CreateOS or model credentials.

CreateOS networking uses an explicit nonempty destination allowlist before unfamiliar code runs. Source, execution receipts, observations and artifacts are retained by the trusted controller. A fresh Stripe clock and fresh customer identities are used for verification. Webhook HTTP 200 alone is never a passing result.

Jobs use local SQLite or the approved Neon Postgres store, atomic claims, fenced leases and a separate persistent worker. Hosted Docker startup requires Postgres and cannot silently fall back to an ephemeral SQLite database. A browser disconnect does not itself cancel a worker job. Cancellation remains requested until resource cleanup is observed.

## Hosting

The Docker image compiles the trusted API and worker, starts both through npm run start:compiled, and serves compiled Vite output from the same API origin. Local development keeps npm start and SQLite support. Hosted records use the already-approved Neon Free database; CreateOS does not provide a verified SQLite-compatible deployment volume.

The concrete configuration is in deploy/createos.json. The provider allocated https://production-fastforward-runtime.tyzo.nodeops.app, but actual health checks currently return503 despite provider-reported successful deployment. Public hosting and cloud restart persistence are **not verified**. Do not present this as a live passing demo. See docs/DEPLOYMENT.md for actual storage, credit, cost and failure evidence.

Validated:47 backend regressions, root typecheck, compiled API/worker startup against Neon and the built frontend/API integration. Existing real repair evidence is preserved without consuming another generation or sandbox allowance.

## Sponsors and event submission

Provision the new stack through Stripe Projects during the event. Stripe Billing supplies real test lifecycle state; CreateOS runs generated code and exposes the sample webhook URL. Swytchcode is optional until a useful, available governance path is verified; no integration is claimed without execution evidence.

Organiser updates specify submission by October 17, 2026, 5:30 PM Pacific (October 18, 01:30 Lagos). Submit the event form and Stripe Projects leaderboard with code **CreateOS-2026**. Public repository, viewable 2–3-minute video including a person on camera, team details and a tagged public post are required per supplied announcements.

## Prior art and licences

CreateOS publicly proposes a Stripe webhook fixer. This project concentrates on approved customer-access behaviour after coherent subscription lifecycles and fresh verification, beyond successful HTTP delivery. Stripe test clocks are existing infrastructure, not an invention of this project.

The original application is newly written for the event. Open-source dependencies retain their respective licences. Do not commit credentials, local databases, private artifacts or old Carry source. No AI-generated media is used.
