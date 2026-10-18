# Fastforward

**Find and fix subscription-access bugs before your customers do.**

### [Launch the live demo →](https://fastforward-demo.vercel.app)

[Demo](https://fastforward-demo.vercel.app) · [Verified repair evidence](docs/evidence/) · [Architecture and API](docs/API-HANDOFF.md) · [Deployment](docs/DEPLOYMENT.md)

Fastforward tests what happens to customer access when a subscription changes. It advances real Stripe TEST billing clocks, finds an access-policy mismatch, asks Groq to repair the sample's Python billing handler, and runs that code inside CreateOS. A separate trusted evaluator then checks the repair against fresh customers, signed webhooks, invoices and protected reports.

Built during the CreateOS × Stripe Projects hackathon on October 17, 2026.

## Try it

1. Open **[fastforward-demo.vercel.app](https://fastforward-demo.vercel.app)**. The short Vercel address opens the connected application.
2. Select the supported billing scenarios and choose **Test my billing**.
3. Follow the actual baseline, repair and fresh-clock verification. A completed run provides its report, generated source, patch and execution evidence.

The demo uses synthetic customers and Stripe TEST resources only. Availability and execution limits are checked before a new run starts; provider failures are shown rather than replaced with simulated results.

**Demo availability:** the public link currently routes through a temporary Cloudflare tunnel to the team's running API and persistent worker, backed by Neon. It requires the team computer to remain awake and online. Independent persistent public hosting is still unfinished; the CreateOS deployment currently returns HTTP503. [Observed public demo checks](docs/evidence/2026-10-18-vercel-demo.json) and [deployment findings](docs/DEPLOYMENT.md) document the distinction.

## What Fastforward verifies

| Scenario | Expected access |
| --- | --- |
| Healthy paid renewal | Customer keeps access; a distinct renewal invoice is verified. |
| Trial ends with payment failure | Customer loses access when the subscription becomes past_due. |
| Missing or unknown identity | Protected report access is denied. |
| Another customer's report | Cross-customer access is denied. |

The sample allows active or trialing subscriptions and has no past-due grace period. This is the sample's explicit policy, not a universal Stripe billing rule.

## How it works

1. **Observe the bug.** The trusted controller creates disposable Stripe test objects and checks real protected actions against the incomplete sample.
2. **Generate a bounded repair.** Groq proposes a Python handler using only the permitted application capabilities.
3. **Execute in isolation.** Generated code runs only in CreateOS, with restricted Stripe test reads and an explicit network destination allowlist.
4. **Verify independently.** Fresh Stripe clocks and customer identities test the candidate through signed events, actual billing state and report access.
5. **Save evidence and clean up.** The controller retains hash-addressed artifacts and confirms resource cleanup. A webhook HTTP200 alone never counts as a successful repair.

The evaluator and access policy remain outside the generated-code sandbox. Controller, CreateOS and model credentials are never given to generated code or the browser.

## Recorded results

Three successful real repair runs are recorded, including a run started through the connected frontend. The latest bounded recheck passed all seven fresh-clock verification checks with one Groq call. Independent checks covered invoice identity, artifact hashes, anonymous and foreign-visitor denial, and resource cleanup.

- [First real repair](docs/evidence/2026-10-17-live-repair.json)
- [Browser integration](docs/evidence/2026-10-17-browser-integration.json)
- [Bounded fresh-clock recheck](docs/evidence/2026-10-17-bounded-recheck.json)
- [Independent cleanup audit](docs/evidence/2026-10-17-cleanup-recheck.json)
- [Public demo and API restart checks](docs/evidence/2026-10-18-vercel-demo.json)

Validation includes **47 backend regression tests**, TypeScript checks, compiled API/worker startup against Neon, and the production frontend/API integration check. [GitHub Actions](https://github.com/miracle352/fastforward-billing/actions) records published checks. Historical repair evidence is labeled and is not presented as a visitor's new run.

Only the supplied sample and two billing scenarios are established by this evidence. Arbitrary applications, every billing path and production-payment safety are outside the verified scope.

## Stack and execution limits

| Component | Implementation |
| --- | --- |
| Interface | React, TypeScript and Vite |
| Trusted API | Node24 and Fastify; same-origin frontend/API |
| Persistent worker | Durable claims, fenced leases and independent cleanup recovery |
| Storage | Approved Neon Free Postgres; SQLite supported locally |
| Billing verification | Stripe Billing TEST clocks, invoices and signed webhooks |
| Repair generation | Groq; no OpenAI API credit required |
| Generated-code execution | CreateOS sandbox |
| Public demo entry | Vercel Hobby redirect to the temporary HTTPS tunnel |

The configured demo permits **three model calls per run**, **3000 output tokens per call**, a **600-second run deadline**, and **one active job**. Durable limits allow six global runs and three runs per visitor per rolling24 hours. A browser disconnect does not cancel a job; cancellation is confirmed only after cleanup is observed.

## Run locally

Requires **Node24+**.

```sh
npm ci
# Privately copy .env.example to .env and configure server-only credentials.
npm run providers:check
npm run check
npm test
npm run verify:integration
```

Configure a Stripe TEST controller key, a separate restricted read-only Stripe TEST key for the same test environment, CreateOS Sandbox credentials and a Groq key. Set STRIPE_READONLY_CONFIRMED=true only after verifying its configuration. Never put provider secrets in VITE_ variables or commit .env.

Execution budgets default to zero. Explicitly configure MAX_MODEL_CALLS_PER_RUN, MODEL_MAX_OUTPUT_TOKENS, MAX_RUNS_PER_DAY and RUN_TIMEOUT_SECONDS before enabling runs. Provider visibility does not establish available quota.

For development, run these in separate terminals:

```sh
npm run dev:api
npm run dev:worker
npm run dev:web
```

Vite proxies /api to the API. Set APP_ORIGIN to the frontend's actual origin, including its port. The event-specific sandbox endpoint is https://api-eu.sb.createos.sh and remains configurable.

For a compiled single-origin application:

```sh
npm run build:server
npm run build
npm run start:compiled
```

Hosted Docker startup requires DATABASE_URL and refuses an ephemeral SQLite fallback. See [.env.example](.env.example), [deployment configuration](deploy/createos.json) and [deployment notes](docs/DEPLOYMENT.md).

## Project guide

- [BUILD-STATE.md](BUILD-STATE.md): verified checkpoints, actual results and remaining blockers.
- [API handoff](docs/API-HANDOFF.md): authentication, contracts and lifecycle rules.
- [Canonical contracts](packages/contracts/src/index.ts): shared Zod payload schemas.
- [Submission summary](docs/SUBMISSION.md): product description and demo scope.
- [Frontend coordination](docs/frontend/REQUESTS.md): concurrent integration requests.

Codex owns the backend, contracts, integration and deployment. Claude Code owns apps/web/ and frontend design. Only Codex updates the shared dependency lockfile and publishes commits.

## Attribution and scope

Stripe test clocks and CreateOS's publicly proposed Stripe webhook fixer are existing infrastructure and prior art. Fastforward focuses on independently verified customer-access behavior across billing lifecycles, beyond successful event delivery. Stripe Projects provisions the event stack; Groq supplies repair generation. No Swytchcode integration is claimed.

The application was newly written during the event. Open-source dependencies retain their respective licences. No prior Carry source, private credentials, local databases or private reports belong in this repository. No AI-generated media is used.
