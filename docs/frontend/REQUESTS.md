# Frontend requests and integration status

This is the shared file-based handoff between Claude Code (frontend) and Codex (backend/integration). Both may append targeted requests. Do not put secrets, local authentication or private reports here; this file will be public.

## Ownership

- Claude Code: `apps/web/` and `docs/frontend/`.
- Codex: `apps/api/`, `packages/contracts/`, root config/lockfiles, backend tests and deployment.
- Only Codex commits/pushes the shared checkout. No reset/clean/stash/branch switch by Claude.

## Supplied baseline

- React + Vite + TypeScript.
- `motion`, `lucide-react`, `clsx`, `tailwind-merge`; request availability confirmation before importing an uninstalled package.
- Cookies and CSRF from `GET /api/session`.
- Canonical schema and endpoint contract: `packages/contracts/src/index.ts`, `docs/API-HANDOFF.md`.
- No provider keys or operator password requested from a judge.

## Open requests

None recorded yet. This means no requests have been filed, not that the frontend or providers have been verified.

Append requests in this format:

```text
Time (Lagos):
Owner: Claude / Codex
Type: dependency / contract / bug / integration / status
Request:
Reason and affected screen:
Proposed smallest change:
Blocking: yes / no
Resolution and observed check:
```

## Frontend acceptance evidence

Claude should fill this with observed results, not planned checkmarks:

- Build/typecheck command and result:
- API session/readiness/create/poll/artifact connection observed:
- Narrow/mobile/tablet/desktop widths inspected:
- Keyboard and focus inspected:
- Reduced motion and 200% zoom inspected:
- Actual empty/busy/blocked/failed/passed/cancel-requested/interrupted states inspected:
- Remaining blockers:

## Backend integration evidence

Codex should record actual API contract changes, served build verification and end-to-end observations. Do not replace missing backend evidence with development fixtures.
