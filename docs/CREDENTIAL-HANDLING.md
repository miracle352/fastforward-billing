# Credential handling and incident follow-up

## Recorded diagnostic incident
A prior private chat tool response printed two JSON credential environment containers. Both held the same CreateOS platform credential, shared by Fastforward and the earlier product. This is an exposure in chat output, even though no publication of the value was found. Redaction cannot revoke it or erase historical chat/tool output.

At the initial audit, the credential had not been rotated. Subsequent authorized rotation results and the still-valid exact exposed token are recorded below. No credential value is copied into this document.

## Safe diagnostics
Run `node --env-file=.env scripts/diagnostics.mjs` from the repository. Output is an explicit allowlist of configured booleans, bounded numeric budgets and a shared-credential boolean. Never enumerate environment values, SDK client objects, credential containers, raw request/response objects, authorization headers, cookies or provider exceptions. An environment-name blacklist is insufficient: JSON wrappers can contain secrets.

Provider text redaction covers configured credential values, nested JSON leaves, escaped representations, Stripe/Groq/CreateOS key patterns and bearer authorization. Generated handlers containing configured credential values are rejected. Invalid configuration errors name fields only; API errors and live-check failures suppress raw exception text. These are defenses in depth; they do not authorize printing raw objects.

Run `node scripts/check-staged-secrets.mjs` before publication; `--tracked --history` additionally checks current tracked files and reachable historical blobs. Comparison values stay in memory, never shell arguments or output. This scan covers saved credentials, not every possible unknown secret or unreachable Git object.

Audit on 2026-10-17: 78 tracked files and 106 reachable historical blobs checked against 10 private credential values; no matches. The prior chat exposure remains real despite this result.

## Coordinated rotation still required
1. While Fastforward is idle, privately inventory every consumer of the shared platform credential, including the earlier product and local vault/container references. Do not alter or inspect that product's source as part of Fastforward.
2. In the provider's authenticated account, establish whether a replacement credential can coexist and preserve the existing free resources. Do not approve any paid plan, top-up or additional resource.
3. Privately save the replacement and update all authorized consumers before revoking the old value. Preserve local credentials until replacements are safely saved. Stop if any consumer owner or provider rotation behavior is unknown.
4. Perform bounded read-only identity checks for each authorized consumer, restart only its verified idle services, then revoke the exposed credential and verify old-key rejection without showing response bodies or key values.
5. Record booleans/timestamps only. Do not claim completion until both replacement access and revocation are observed.

No revocation, replacement credential, paid action or change to the earlier product was performed during this audit.

## Rotation progress - 2026-10-17, 23:52 Lagos

The user explicitly approved a30-day replacement key and full coordinated rotation of the four listed managed keys. Local Fastforward/Carry credential references and Carry's deployed environment were migrated with private backups; environment readback matched. All four old managed keys returned401 after revocation; replacement returned200 on platform and sandbox identity. The replacement remains private.

The exact exposed bearer.access_token is a separate credential and STILL AUTHENTICATED after managed-key revocation. Incident remediation is incomplete until that exact token returns an authentication rejection through its supported rotation/revocation flow. Current containers contain the replacement; backup copies remain private. Never print either token or assume it is revoked because the managed-key list changed. Stripe Projects is currently authorized only for Carry BUYER test mode, which cannot administer the existing Fastforward project; original owning-account sign-in is required before attempting resource credential rotation.

Retired credential backups are included in the local secret scanner's comparison set. Database URL credentials are now treated as secrets and connection errors suppress private values.


## Exact-token audit - 2026-10-18, 00:14 Lagos

Original Stripe Projects owner context is restored. Supported runtime-resource rotation completed with private credential backups, but a subsequent exact-token identity read still returned200. Exposed token and replacement identify the same provider account; the exposed token is absent from the two current managed-key metadata records. Supported OAuth consent listing returned null, so no consent was revoked. This remains a provider-specific revocation blocker; do not claim that resource rotation or the four observed managed-key401 responses revoke it. Carry runtime adoption of its readback-verified replacement still needs a redeploy/restart observation.

The actual Neon CONNECTION_STRING field is now included in private credential matching and full redaction, including generated-source rejection and staged scanning. The asynchronous-storage HTTP regression confirms that database URLs, passwords and raw provider errors do not reach visitors through the existing safe handler.
