# Operator setup — local secrets only

The saved controller key was verified on 2026-10-17 against Stripe test account acct_1UQVLTGb8mhCaV7T. This account identifier is not a secret. Use the matching test environment when creating the restricted reader key. Do not activate real payments or provide business registration to use Stripe Projects solely for this event.

1. Open Stripe Dashboard and select the matching test environment, then API keys.
2. Create a new restricted key from zero permissions; name it Fastforward sandbox reader.
3. Grant Read only for Customers, Products, Prices and Subscriptions. Leave other resources and Connect permissions None. No Write permissions.
4. Complete Stripe's verification and save the rk_test_ key in local .env as STRIPE_READONLY_KEY. Do not share it in chat or record it.
5. Set STRIPE_READONLY_CONFIRMED=true only after reviewing permissions. The rk_test_ prefix alone does not prove read-only permissions.
6. Choose bounded model/run settings after checking actual credits and allowances. Suggested narrow demo budget, if permitted: MAX_MODEL_CALLS_PER_RUN=3, MODEL_MAX_OUTPUT_TOKENS=1800, MAX_RUNS_PER_DAY=6, RUN_TIMEOUT_SECONDS=600. Account quotas remain shared with previous work.
7. Run npm run providers:check. This reads access only; it does not create a VM or generate source.

Default .env budgets are zero until explicitly configured. The programme must not silently activate paid service plans. Missing provider/setup states must remain visible and truthful.

## Stripe Projects

The current CLI is a local dev dependency. In PowerShell use node_modules/.bin/stripe.cmd. Upgrade/install the Projects plugin as documented, authenticate the intended account, then initialise a NEW Fastforward project and provision the verified createos/project resource. Preserve .env privately before any credential synchronisation; never overwrite unrelated credentials or reuse Carry's project resource as the new submission.

Record resource/project IDs and redacted creation receipts in BUILD-STATE.md; no vault files or keys in Git. If the normal account onboarding asks for live-business activation, use the Projects-specific onboarding linked by organisers: https://dashboard.stripe.com/projects/new . Public guide: https://projects.dev/hackathon-participants .

## Claude Code

Claude Code 2.1.287 was verified installed. Launch it in this exact Fastforward directory. Authenticate through its own login prompts if necessary. No account bridge between Claude and Codex is needed: both read the same local files, with AGENTS.md ownership boundaries. A normal Claude browser chat does not automatically edit this checkout.

Read docs/DESIGN-SKILLS.md for the verified inventory, targeted missing skill installs and optional Regards MCP setup. Read docs/CLAUDE-DESIGN-BRIEF.md for the paste-ready frontend assignment.

## Repeating the bounded verification

`node --env-file=.env scripts/verify-stripe-reader.mjs` creates disposable Stripe TEST clock/customer/product/price/subscription objects, reads them with the saved restricted key, checks that one customer write is denied and cleans up the test objects. It prints only redacted checks, never credentials. Private resource tracking is saved under .local/ for recovery.

With the trusted API and worker running, `node scripts/run-live-check.mjs` deliberately consumes one real run under the configured shared allowance. It checks actual signed webhooks, baseline access, generated repair, fresh clocks/invoices and artifact integrity. It does not fabricate a passing result or retry job submission automatically. Public evidence omits IDs; session and detailed evidence stay in .local/. Do not use this command as a free health check.

Groq generation responses now retain an allowlisted snapshot of numeric rate-limit headers. Model visibility and a free-plan label do not prove remaining spend credit. See the current provider-allowance receipt and BUILD-STATE.md for measured counts and explicit unknowns.
