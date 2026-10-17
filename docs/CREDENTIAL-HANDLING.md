# Credential handling and incident follow-up

## Recorded diagnostic incident
A prior private chat tool response printed two JSON credential environment containers. Both held the same CreateOS platform credential, shared by Fastforward and the earlier product. This is an exposure in chat output, even though no publication of the value was found. Redaction cannot revoke it or erase historical chat/tool output.

The credential has NOT been rotated. Its shared use makes uncoordinated revocation unsafe for the earlier product. No local credential was overwritten, removed or copied into this document.

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
