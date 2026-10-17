# Fastforward build ownership

This is a NEW hackathon implementation created during the event on October 17, 2026. Do not copy Carry or Finish source, tests, assets or deployment.

- Codex owns apps/api/, packages/contracts/, root package/config, tests and deployment.
- Claude Code owns apps/web/ and docs/frontend/. Do not reset, clean, stash, switch branches or modify another builder's files.
- Everyone reads packages/contracts/src/index.ts, docs/API-HANDOFF.md and BUILD-STATE.md before editing.
- The canonical API payload definitions are Zod schemas in packages/contracts/src/index.ts. Propose changes in docs/frontend/REQUESTS.md; do not silently redefine them.
- Only Codex commits/pushes shared changes and updates root package-lock.json. Claude records dependency requests in docs/frontend/REQUESTS.md; baseline frontend dependencies are supplied.
- Never commit credentials, .env, local databases, generated raw logs, private reports or browser authentication.
- Never claim a fixture, animation, queued job or a provider response is a successful repair. External checks must observe real protected actions on fresh Stripe test objects.
- No AI images, emoji or decorative 3D. Use authored SVG and accessible motion. Label sample app, Stripe test data and simulated billing time.
- Account credentials may be reused with permission; old product source and resources are not the submission.

Architecture: Node 24 TypeScript trusted API plus persistent worker; SQLite on an explicitly persistent volume for this narrow deployment; React/Vite frontend on the same origin in production. Generated Python executes ONLY in CreateOS. The trusted evaluator/policy never becomes agent-editable. A hosted deployment without persistent storage cannot claim durable results.
