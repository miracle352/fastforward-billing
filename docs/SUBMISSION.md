# Fastforward submission checkpoint

**Find and fix subscription-access bugs before customers do.**

Repository: https://github.com/miracle352/fastforward-billing

Fastforward advances Stripe TEST billing clocks against a deliberately incomplete sample application, observes actual protected report access, asks Groq for a bounded Python repair, executes generated code only in CreateOS, and independently verifies the repair with fresh customers, subscriptions, invoices and signed webhooks. A healthy renewal stays allowed; failed trial payment follows the sample's reviewed zero-grace policy.

Three real successful repair runs are recorded in docs/evidence/. The latest bounded recheck passed all seven fresh-clock checks with one Groq call. Artifact hashes, anonymous/foreign-visitor denials and cleanup were independently checked. Forty-seven backend tests, production frontend/API integration and compiled API/worker startup against Neon passed. This is a new hackathon implementation; prior product source was not reused.

Stack: React/Vite, Node24/Fastify, durable Neon Postgres, Stripe Billing test clocks/webhooks, Groq and CreateOS generated-code sandboxes. API, worker and frontend share one production origin; model and controller credentials stay server-side. Execution remains capped at three model calls/run,3000 output tokens/call,600 seconds,one active job and durable rolling visitor/global limits.

## Honest demo boundary

Only the supplied sample and two supported scenarios are verified. Historical real evidence is clearly labeled; it is not the visitor's new run. Production billing and arbitrary apps are not claimed.

Public candidate: https://production-fastforward-runtime.tyzo.nodeops.app . Its real health check returns503; provider-reported deployed status is insufficient. Public worker startup and persistence across cloud replacement remain unverified. The approved Neon database itself is provisioned, migrated and tested with all16 artifact hashes intact. See docs/DEPLOYMENT.md and BUILD-STATE.md for the current blocker. Do not claim a functioning public demo until actual checks pass.

For submission, use the real local demonstration/recorded repair evidence if cloud launch remains blocked, and disclose the hosting limitation. The public repository and redacted receipts are reviewable without any credential. A person-on-camera demo video and actual event-form/public-post submissions require the team's own participation; no submission has been fabricated or sent.

Published source checkpoint a30b6b7 passed [GitHub CI](https://github.com/miracle352/fastforward-billing/actions/runs/39081106950). For the immediate demo recording, open http://127.0.0.1:3001 on the team computer; this localhost address is not a public judge-accessible URL. The sixth CreateOS build also returned503 at public health, so the hosting limitation remains disclosed.

## Working public demo

Submit https://fastforward-demo.vercel.app . It opens the real app at https://prepaid-helped-stands-aug.trycloudflare.com, verified over public HTTPS with all four providers ready. This is a temporary demo backed by the team computer and persistent Neon data; the computer must stay awake and online. It is not independent persistent cloud hosting. Vercel receives no server credentials.
