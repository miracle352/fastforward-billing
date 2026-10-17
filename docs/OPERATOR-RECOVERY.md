# Operator cleanup reconciliation

Run from the repository with no receipt to inspect the queue:

```powershell
node --env-file=.env --import tsx scripts/reconcile-cleanup.ts
```

For an interrupted job whose provider creation response was lost, privately identify the actual resource through the provider dashboard. Store a JSON receipt under `.local/` with `runId`, `kind` and `id`. Supported kinds: sandbox, webhook, clock, product, price, customer, subscription. Never put the receipt or raw provider response into a public issue, chat or evidence file.

```powershell
node --env-file=.env --import tsx scripts/reconcile-cleanup.ts --receipt .local/recovery-receipt.json
node --env-file=.env --import tsx scripts/reconcile-cleanup.ts --receipt .local/recovery-receipt.json --apply
```

The first command reads provider identity and validates scope without changing the run. Apply records the positively attributed resource and attempts the existing independent cleanup routine. A foreign resource, missing provider object, changed intent, active job, failed cleanup or ambiguous ownership leaves admission blocked. Absence from a list is not proof that a creation failed. Process cleanup is covered by destruction of its known parent sandbox.

Attribution checks the exact generated run/scenario name or controller metadata, creation window, Stripe test mode, and parent product/clock/customer as appropriate. A previously deleted object without a recoverable receipt may require additional provider-side proof; the tool deliberately does not offer an unconditional clear flag. Discovery is manual and private; this tool is not a tenant-wide deletion sweep.

Both SQLite and the optional Postgres store preserve the gate. Public diagnostics expose only counts, booleans and static error text. A true cleanup result never upgrades the interrupted repair to passed.
