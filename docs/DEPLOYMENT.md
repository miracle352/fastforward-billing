# Fastforward public hosting checkpoint

Current observation: 2026-10-18 Lagos. **Public hosting is not verified.** The provider allocated https://production-fastforward-runtime.tyzo.nodeops.app and reports successful builds/deployed status, but actual HTTPS GET /api/health returns503. Do not present that URL as a working product or claim cloud persistence/worker operation.

## One concrete configuration

Use the existing approved CreateOS resource fastforward-runtime for one Node24 Docker image containing the compiled React frontend, trusted API and supervisor-managed persistent worker. Use the already-approved, provisioned Neon Free fastforward-data Postgres database for sessions, runs, allowances, events, resource recovery and artifact content. No additional provider resource is proposed.

The applied project/environment configuration is summarized without secrets in deploy/createos.json. This is an operator reference for the project and environment API settings, not a CLI config file. The provider's actual runtime catalogue lists dockerfile separately from node:24; the selected target is now dockerfile, with Node24 supplied by FROM node:24-bookworm-slim. Application port80; one production replica,500 millicores and1024MB RAM (free-plan ceiling, increased from200/500 for startup headroom). Provider build limits are1000 millicores,1024MB and1800 seconds.

The user explicitly approved disabling only this project's optional480-credit security scan. Build AI remains off. No paid plan, upgrade, payment or top-up was approved or requested.

## Verified storage and SQLite decision

CreateOS explicitly documents no mounted deployment volumes: https://createos.sh/blogs/railway-alternative-for-ai-agents . SQLite WAL requires a durable filesystem with correct locking; no such deployment mount was established. A Docker VOLUME declaration is not storage evidence and has been removed.

The hosted image requires FASTFORWARD_REQUIRE_POSTGRES=true and refuses startup without DATABASE_URL, preventing silent temporary SQLite fallback. Local SQLite remains supported when that requirement is false and is preserved as a private backup.

Actual Neon verification passed concurrent request replay, reopen persistence, ownership, cancellation, lease fencing and cleanup gating. Idle migration copied12 sessions,4 runs,90 events,16 artifacts and7 metadata records; every migrated row matched SQLite, and all16 artifact hashes matched. Both running local HTTP services committed fresh sessions to Neon, and protected saved-report downloads/ownership checks survived local process restart. These are real database/local HTTP results; cloud HTTP remains blocked.

The actual database size read was8,290,304 bytes. Neon currently advertises Free at$0 with100 CU-hours/month/project and1GB storage: https://neon.com/pricing . Remaining account-specific compute allowance was not available from SQL and is not asserted. Frequent worker polling keeps the database active; these free limits are finite. No automatic paid upgrade was configured.

## Credits and runtime cost

Actual CreateOS balance snapshot:395.0357146033739 credits; free-plan, plan amount0. The provider payment conversion endpoint confirms100 credits/USD, orUSD0.01/credit. Account ledger includes real metered debits; a complete settled Fastforward runtime charge has not been identified.

Published rates: https://createos.sh/docs/Account-Billing/Pricing/ . At the initial200 millicores/500MB, the CPU/RAM estimate wasUSD0.31266864/day. At the current500 millicores/1024MB, it isUSD0.718806/day, approximatelyUSD21.56/30 days, before builds, storage, rounding and other account usage. Storage isUSD0.0038016 perGB/day. At the provider's maximum build duration, one1-core/1.024GB build is approximately2.40 credits before storage. Actual usage may differ; this is a calculation, not a fixed-price quote or unlimited free hosting.

The balance would cover roughly5.5 days of that CPU/RAM estimate alone. Existing account workloads reduce that period. No recurring paid plan or top-up call was made. The existing account flag gnodeAutoConversionEnabled remains true: an attempt to disable it through the supported profile-update endpoint returned400 because that endpoint accepts profile fields only. Its financial effect and a provider-enforced credit-only cutoff remain unverified; do not claim automatic top-ups are disabled.

## Secrets and execution limits

Credentials are only in provider server-side runtime settings and private local files. Runtime readback matched the selected Stripe TEST controller/restricted reader, Groq, sandbox and Neon values. Build variables are empty. No VITE_ credential, uploaded .env, private report, SQLite database or provider vault is included.

scripts/prepare-createos-upload.mjs builds an allowlisted source snapshot, checks configured credential values and enforces the provider's100-file upload limit. The latest compiled-runtime snapshot contains55 files and420,685 bytes. SHA256 of its sorted path/hash manifest:b30664279d8b08327c067359200b1cd0ab7fe4022140162fb1c4bb073b5372f7.

Keep3 Groq calls/run,3000 output tokens/call,600-second execution deadline,6 global runs and3 visitor runs per rolling24h. Postgres admission and lease fencing retain one active job across processes. Cloud admission remains false until actual public verification passes. Local working services remain available on3000/3001 and share Neon; their existing evidence/allowances are preserved.

## Actual deployment attempts and next verification

Four source deployments completed their builds. Attempts1–3 used mixed Node/Docker settings, including a corrected explicit runtime command; actual health remained503. The fourth uses the catalogue-correct dedicated Dockerfile target and verified runtime-only secrets; actual health still returned503. Provider runtime logs return only a listening status with no API/worker startup evidence. A supported sleep/wakeup recovery was attempted on the third: immediate wake returned422 before asynchronous sleep completed; wake after observed sleeping returned200, but health still503. This is retained as failure evidence.

Superseded previews were put to sleep through the official recoverable deployment sleep operation, preserving their build artifacts and Neon data. Only the latest candidate is assigned to Production. There is no observed public worker startup, authenticated report access or replacement-persistence success. The current blocker is launch/routing diagnosis; storage has been verified independently. Asked the user for the dashboard's actual runtime/event error because API logs give no startup detail.

Before enabling public jobs: observe API health200 and the safe worker startup marker; run node --import tsx scripts/verify-hosted-persistence.mjs before; prove secure cookies, CSRF, isolated visitor history and original-owner report hashes. Pause local admission, verify idle state, then enable cloud admission with unchanged limits. Replace/restart the actual healthy deployment and run the same verification with after, reusing that verification client's privately saved visitor session. Never copy its cookie into another browser or present a historical report as a new repair.

Do not spend another repair allowance to diagnose hosting. This continuation used zero new repair runs, model calls or generated sandboxes. A new resource is not established as necessary by these503 responses.

## Deadline-focused compiled runtime

A fifth image compiles API/worker with tsc and starts plain Node24 processes, removing runtime TypeScript-loader overhead. The actual compiled supervisor, API, persistent worker and HTTP session passed locally against Neon with admission paused; no generation or sandbox was used. The source still supports local TypeScript development. The compiled image built and was assigned to Production, but its observed public health remained503. Resource readback confirmed500 millicores/1024MB/one replica. API startup evidence is still absent from provider runtime logs; the failure cause has not been established. The team reported30 minutes remaining and could not locate the dashboard; a corrected direct dashboard link was supplied privately.

## Final submission verification

The sixth build also completed and was assigned to Production. It tests the provider default ingress port80 with matching Docker EXPOSE, application PORT and project setting, retaining the non-root application user. Actual production health still returned503 after assignment; runtime logs remained a listening placeholder with no startup marker. No root cause was established and no further speculative rebuild was initiated. Superseded deployments were slept or requested to sleep through the official recoverable operation; source/history and Neon were preserved. The latest unsuccessful Production candidate remains assigned, with admission paused.

Published source commit a30b6b7 passed GitHub Actions run39081106950, including typecheck, compiled build, all47 backend tests and production frontend/API integration: https://github.com/miracle352/fastforward-billing/actions/runs/39081106950 . Local3001 was rechecked with health200, ready=true and all four providers ready. Use the local recording and real redacted repair evidence for the deadline; public hosting remains an explicitly disclosed blocker.

## Working temporary submission URL

https://fastforward-demo.vercel.app redirects to the verified working local-backed HTTPS demo at https://prepaid-helped-stands-aug.trycloudflare.com. Vercel Hobby serves only the static entry; a free Cloudflare Quick Tunnel forwards to dedicated loopback3003 Fastforward API, sharing Neon and the existing worker. No credentials are uploaded to Vercel. Public frontend/API/session/CSRF/report ownership and4 artifact hashes passed. Keep the computer awake and internet/API/worker/tunnel running. The destination is temporary and has no uptime guarantee; persistent public hosting remains blocked by CreateOS503. See docs/evidence/2026-10-18-vercel-demo.json.
