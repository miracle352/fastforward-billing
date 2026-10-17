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
