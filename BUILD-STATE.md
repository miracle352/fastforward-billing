# Fastforward build state

Started during the hackathon: 2026-10-17, after 20:30 Lagos. Product/backend implementation is new.

## Observed
- Node 24.12.0 is available.
- GitHub account miracle352 confirmed through the connector and CLI with network permission.
- Public repository created: https://github.com/miracle352/fastforward-billing .
- Claude Code 2.1.287 exists locally. Its authentication has not been verified.
- Shared API schemas and ownership instructions created.
- Current organiser screenshots specify EU API https://api-eu.sb.createos.sh and submission code CreateOS-2026.
- Read-only saved-credential probes confirmed Stripe test subscription access, CreateOS EU identity and Groq model visibility. No model generation or sandbox creation was performed by these probes.
- CreateOS reported running=0, paused=0, lifetime total=19. This is not proof of remaining rolling daily creations, credits or hosting allocation.
- Local API observed at port 3000: health/session HTTP200, missing CSRF HTTP403, properly authenticated job request HTTP503 while setup is incomplete. No job was queued by this smoke check.
- New Stripe Project created at 2026-10-17T20:10:38Z after explicit empty-project approval. A separate explicit approval subsequently authorised only the free CreateOS resource below. No paid plans, upgrades or payment method changes were authorised or provisioned. Detailed resource identifiers remain private locally.
- Stripe CLI 1.54.0 and Projects plugin 0.50.0 installed/verified. Actual catalogue/preflight confirmed the existing free plan. Provisioned createos/project named fastforward-runtime successfully, status complete. Provider-returned credentials and identifiers remain private locally.
- Restricted Stripe test key saved and operator-confirmed. A controller-created temporary customer was readable through that key; a metadata write through it was denied. The temporary customer was deleted. This checks same-account customer access and that mutation; it does not enumerate every key permission.
- Configured bounded demo settings: at most three model calls per run, 3000 output tokens per call, six global runs/day, three runs/visitor/day, 600-second run deadline. No paid upgrade or model call was performed while configuring limits.
- First real queued run stopped at CreateOS creation HTTP400 before any VM receipt, Stripe fixtures or model calls. One bounded diagnostic confirmed the EU API accepts sandbox names up to 22 characters; the original generated name had 48. Name generation corrected before retrying. EU catalogue confirms the configured shape and rootfs exist.
- First complete real repair succeeded, queued 20:35:06Z and completed 20:36:53Z on October 17. The baseline found one intended access mismatch (past_due Stripe subscription, report incorrectly returned HTTP200). A Groq-generated handler passed source validation and compilation in CreateOS, then all seven external checks passed with fresh test customers/clocks. One generation call, 1358 total reported tokens. Real signed Stripe events and independently fetched subscription/invoice state were observed in both phases. Run and provider identifiers are retained only in the private receipt.
- Cleanup confirmed for the run's four test clocks, webhook endpoint and CreateOS sandbox. The single created VM is counted against provider quota. Source, execution receipt, patch and report are saved privately in the controller; a public receipt omitting provider and run identifiers is in docs/evidence/2026-10-17-live-repair.json.
- All four actual artifact downloads matched their stored SHA256. Anonymous downloads returned HTTP401; a separate visitor could not retrieve the run (HTTP404).
- After terminating and restarting the idle local supervisor/API/worker, the same visitor could still retrieve the passed run and all four matching artifacts; anonymous and other-visitor denial remained intact. This proves local file persistence across process restart, not cloud-volume persistence or mid-run recovery.
- Implemented trusted API/store, persistent worker, actual provider adapters, fixed external evaluator and new Python sample app. Review fixes include narrow database capability plus SQLite authorizer, candidate validation before installation, runtime-error repair feedback, final-state event correlation and distinct renewal invoice verification.
- npm run check passed. All 23 automated backend tests passed: session/CSRF/ownership, durable job recovery/fencing, truthful verdicts/report ownership, provider boundaries/budgets, fresh renewal invoice and webhook convergence/runtime feedback, regional sandbox naming and bounded public preview readiness.
- Staged-source check found no saved local credential values among the files prepared for publishing; .env, .local and provider vaults are excluded.

## Not yet verified
- Credits and exact remaining current quotas. Key permission configuration is operator-confirmed with a same-account read and one denied mutation probe, not an exhaustive permission audit.
- Public hosting and persistent volume allocation.
- Frontend design and connected operation.

The supplied sample's two supported scenarios have one observed successful real repair. Arbitrary applications, additional billing paths, out-of-order event resilience, production safety and a deployed product are not established by that result.
