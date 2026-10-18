# Render Free fallback — awaiting user approval

One Render Free web service named fastforward-runtime. No Render database, background-worker product, disk, paid plan, card or top-up is proposed. The existing approved Neon database stores sessions, runs, budgets and artifacts. The one web-service process runs the already-tested compiled supervisor, API and worker and serves the current frontend. Configuration: render.yaml.

Published limits: Free web service, USD0 compute,750 shared free instance hours per workspace/month; sleeps after15 minutes without inbound traffic and wakes on the next request, typically around one minute. Free services can restart at any time. Local disk is temporary, so Postgres is mandatory. See https://render.com/docs/free and https://render.com/pricing . This is a recoverable demo service, not an always-on guarantee.

Render may bill bandwidth/build overages if the account has a payment method. Before provisioning, verify actual workspace allowances and a zero-spend/no-payment-method configuration. Stop if a paid plan, card, upgrade or top-up is required. Account-specific remaining allowances and available capacity are NOT verified yet.

Credentials must be supplied only through server-side secret settings using preserved local values; sync:false prevents embedding them in this blueprint. The public origin comes from Render's own RENDER_EXTERNAL_URL. Admission begins paused. Keep3 model calls/run,3000 output tokens/call,600 seconds,one active job and the shared6-global/3-owner rolling24h budget. No independent database or allowance reset.

Before cutover: health200, API/worker startup, public secure session/CSRF/ownership and stored-report hashes, actual process restart persistence. Confirm no active job and pause local admission before enabling the hosted controller. Then update the existing Vercel entry to the verified hosted URL and independently verify the redirect. Only after that can the laptop shut down without taking the demo offline.

User approval is required because only the existing CreateOS runtime, Neon Free and Vercel demo entry have been authorized. No Render service has been created.
