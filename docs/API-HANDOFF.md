# Frontend/backend boundary v1

Canonical runtime schemas/types: packages/contracts/src/index.ts. Import types from @fastforward/contracts. All times ISO UTC; IDs opaque strings. Server returns testMode:true. Null means not yet observed, never success.

Development: Vite on 5173 proxies /api to localhost:3000 with cookies. Production serves compiled frontend and API from one origin. Fetch with credentials:'include'.

1. GET /api/session -> Session. Establishes HttpOnly visitor cookie, returns CSRF token. No operator password or provider key requested from judges.
2. GET /api/readiness -> Readiness. Ready only after real provider probes and configured spending limits; display server blockers plainly.
3. GET /api/runs -> {runs: Run[]}; only current visitor's jobs.
4. POST /api/runs body CreateRun, header X-CSRF-Token -> 202 {run: Run}; 409 busy, 429 bounded limit, 503 setup needed. Two supported scenario IDs are healthy_renewal and trial_payment_failure.
5. GET /api/runs/:id -> {run: Run}; ownership-protected, 404 for another visitor.
6. GET /api/runs/:id/events?after=0 -> {events: RunEvent[], nextCursor:number}. Poll every 1.5-2 seconds while nonterminal; retain order, deduplicate IDs. No artificial progress percentage.
7. POST /api/runs/:id/cancel, X-CSRF-Token -> 202 {run: Run}. Requested is not confirmed cleanup.
8. GET /api/runs/:id/artifacts/:artifactId -> authenticated text download. Use server artifact downloadUrl. Never insert HTML from logs/source.

Errors: {error:{code:string,message:string,blockers?:string[]}}. Frontend must handle unavailable providers, busy queue, limits, timeout, failed checks and interrupted jobs. Only passed status means the fixed checks passed for the supported sample and scenario.

Core flow: Test my billing -> real baseline observations -> detected mismatch -> generated handler source and bounded execution -> fresh-clock verification -> report/patch. Explain zero-grace access policy. A healthy customer must remain allowed. Show that funding/production payments are not part of this product.

Fixture-only visual previews may be labelled in development, but connected routes must not substitute them when providers are unavailable. Fake invoices, IDs, repair counters, verdicts and progress are forbidden.

## Backend audit additions - 2026-10-17, 22:59 Lagos

POST /api/runs accepts optional Idempotency-Key (8-128 characters: letters/numbers, dot, colon, underscore or dash; first character alphanumeric). Create one key per deliberate start and reuse it for uncertain retries with the same scenarios. The durable owner-scoped mapping returns202 and the same current run after completion or API restart, even if readiness or daily allowance now fails. A recognized replay carries Idempotency-Replayed:true; atomic racing requests still share one run. Reusing a key with different scenarios returns409 IDEMPOTENCY_CONFLICT. Invalid keys return400. Existing bodies/schemas, authentication, CSRF and ownership rules remain unchanged; requests without a key keep existing behavior.

Status events now include data.status='provisioning' on claim; observation batches include data.attempt. Cancellation is a request until cleanup is confirmed. Lease expiry fences old writes and retains cancellation intent; recovery may finish cancelled only after known resource cleanup is proven. An unacknowledged provider creation or missing legacy resource metadata remains interrupted/cleanup-blocked for operator reconciliation, never assumed empty or successful. No automatic discovery for unknown provider allocations is implemented.

Offline audit: 37 backend tests, root typecheck and current production frontend/API integration passed. Prior real-run evidence was reused; no new live run or generation.
