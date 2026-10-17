# Fastforward deployment checkpoint

Checked 2026-10-17, approximately 22:08 Lagos. Public deployment is **not complete**.

## Approved allocation and actual checks

Only the existing Stripe Projects resource `fastforward-runtime` (`createos/project`, free component) is approved. Current `stripe projects services list --json` reports it complete, and a refreshed `projects catalog createos --json` reports that component available under the free account plan. No paid upgrade, top-up, new database, disk, or payment change was made.

The resource's existing credential authenticates to the CreateOS platform using `X-Api-Key`; `/v1/users/me` reports `free-plan`. `/v1/quotas` reports 50 project slots, 1 used, 49 remaining. `/v1/projects` lists the prior product only. That existing product was not changed or reused. The Stripe provisioning receipt is not evidence of an actual running Fastforward application.

Deployment usage is metered even with a free account plan. The current official pricing documentation lists CPU, RAM and storage consumption rates; the remaining account credit balance has not been established. Do not infer unlimited free hosting from the catalogue's free component label. Sources: https://createos.sh/docs/Account-Billing/Pricing/ and https://github.com/NodeOps-app/createos-mcp .

## Persistent storage blocker

The trusted controller uses SQLite WAL with the API and worker sharing one directory. It requires an explicitly persistent filesystem with SQLite locking semantics, mounted at `/data` (or `FASTFORWARD_DATA_DIR`), one deployment replica, and protection against overlapping writers during replacement.

The inspected official deployment/environment settings expose CPU, memory, replicas and environment variables, but no documented persistent-volume mount. The official `CreateDisk` operation registers an S3-compatible bucket for a **sandbox**; it does not establish a deployment volume or SQLite WAL filesystem. Do not use that object-storage mount as an assumed SQLite solution. A Dockerfile `VOLUME` declaration alone is also not proof that the hosting platform allocates or retains storage.

Next required evidence: a supported durable mount within the approved resource and its cost/credit terms, followed by a deployed API/worker restart or replacement test proving that the same visitor's run and artifact hashes survive. Until then, do not claim persistent public hosting, substitute a temporary sandbox URL, provision another resource, or deploy with a disposable database.

## Ready to deploy once storage and allowance are established

- `npm run check`, `npm test`, `npm run verify:integration` validate backend, frontend build and production HTTP integration.
- Root Dockerfile builds Node 24, runs the API and worker supervisor, and serves the compiled React frontend from the API origin.
- Supply runtime credentials through the provider's secret environment, never build variables or uploaded `.env`. Set `HOST=0.0.0.0`, `PORT=3000`, `APP_ORIGIN` to the actual HTTPS origin and `FASTFORWARD_DATA_DIR` to the verified persistent mount.
- Retain existing limits: three Groq calls/run, 3000 output tokens/call, six global runs/rolling day, three runs/visitor/rolling day and 600-second deadline. No OpenAI API key is needed; the configured model is hosted by Groq.
- Preserve the existing database and allowance if migrating; do not copy private visitor cookies into another browser or present previous private runs as a new visitor's result.
- After deployment, verify same-origin secure HttpOnly cookies, CSRF, ownership denial, worker startup, artifact hashes and persistence before starting another billable test.

## Local integrated preview

`http://127.0.0.1:3001` serves the production build and shares the existing private local store/worker. It does not replace the API on port 3000 or the unrelated service on 5173. `.local/serve-integrated.mjs` configures this preview only and is excluded from Git.

The actual browser-started repair passed at 21:00:52 UTC / 22:00:52 Lagos, using three Groq calls and 4645 reported tokens, with all seven fresh-customer verification checks passing and cleanup confirmed. The downloaded verification report's SHA256 matches the stored artifact. See `docs/evidence/2026-10-17-browser-integration.json`. This is local integration evidence, not cloud persistence.

## Confirmed storage decision - 2026-10-17, 23:52 Lagos

CreateOS explicitly documents that deployment volumes are not mounted: https://createos.sh/blogs/railway-alternative-for-ai-agents . The user approved fastforward-data on Neon Free and its free Postgres component after catalogue availability/pricing checks. No database has been provisioned yet: Stripe Projects is signed into the Carry BUYER test-only account rather than the existing project's owning account. No project was recreated.

The optional DATABASE_URL path uses Postgres with verified TLS, durable request keys, transactional admission/leases/cleanup and ownership-protected artifacts. Without DATABASE_URL, local SQLite continues to work. scripts/verify-postgres.ts must pass against the actual approved database before claiming durable deployment. It creates and removes only a disposable isolated namespace; no model or sandbox call occurs.

Before migration, pause new local admissions with FASTFORWARD_ACCEPT_RUNS=false, restart only owned idle processes, and confirm that the running readiness endpoint reports that exact pause. scripts/migrate-sqlite-postgres.ts refuses active source jobs, unobserved admission pause and nonempty destination tables; source SQLite remains intact. Configure all API/worker processes against the same Postgres database to preserve a single global allowance and active-job gate. Do not leave a second accepting SQLite controller running after cutover.

Observed platform credit amount395.4321609482359, zero plan monthly amount and zero purchased-credit total are a point-in-time snapshot only. Public hosting, actual Postgres persistence/restart tests and deployed URL remain incomplete.


## Actual Neon migration and hosting gate - 2026-10-18, 00:14 Lagos

This section supersedes the earlier account/provisioning blockers. Original owning-account context is restored. Neon Free and fastforward-data Postgres are complete; real database regression verification and the SQLite migration passed, with exact comparison across all six tables and16 matching artifact hashes. Both local services now use the migrated Postgres database. SQLite is preserved as an idle backup. Public hosting has not been deployed.

CreateOS still reports395.4321609482359 credits and free-plan; automatic GNODE conversion is enabled, with its financial implications unverified. Verify a free-credit-only deployment limit before enabling compute. Never authorize paid plans, upgrades or top-ups. Pricing: https://createos.sh/docs/Account-Billing/Pricing/ . The optional security scan is480 credits per deployment.

A proposed empty upload project creation explicitly set enabledSecurityScan=false. Automatic approval review rejected that security-setting change without separate approval; nothing executed. The concrete proposed configuration is a Fastforward upload project under the existing approved runtime, Node24/Dockerfile, port3000, Build AI off, optional security scan off. Before actual deployment, use the supported minimum200mCPU/500MiB and exactly one replica, confirm those limits and cost, configure runtime-only secrets, and keep admission paused during local/cloud cutover. No source, secret, build or deployment has been uploaded.

After approval, independently verify the resulting public HTTPS origin, secure cookie/CSRF, saved report ownership/hash and persistence across deployment replacement. Local Neon verification is not evidence that public hosting or deployment replacement works.
