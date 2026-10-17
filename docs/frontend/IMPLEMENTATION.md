# Frontend implementation — Fastforward

Written by Claude Code on 2026-10-17 (Lagos evening). Everything here is uncommitted for Codex to integrate. Only `apps/web/` and `docs/frontend/` were edited.

## Design reading

Reading this as: a diagnostic product for a founder or an older non-technical visitor who wants a straight answer. Deep-black editorial stage, one big plain-English question, one action, and one authored instrument that *is* the product's evidence.

**Idea:** Stripe's billing record and the app's actual report access become two lanes on one timeline. When they disagree under the declared policy, the access lane physically drops away and an amber break opens between them; when fresh checks pass, the lanes reconnect.

- **Type:** one sans family, the platform's own UI display face (Segoe UI Variable on Windows, SF Pro on Apple, system-ui elsewhere). No webfont is loaded, so there is no font licence to carry and no layout shift. Monospace only for code, hashes and the server's error text.
- **Colour:** ground `#060708`; pale warm ink `#f2eee6`; ice-mint `#8ef0d1` only for the main action and verified agreement; amber `#f6b552` only for a mismatch; red `#ff8070` only for actual errors. Verdicts always carry words and icons as well as colour.
- **Glass:** used twice, deliberately: the instrument stage and the sticky top bar. There is an opaque fallback without `backdrop-filter` and under `prefers-reduced-transparency`. No glass cards inside glass cards.
- **Motion:** one hero entrance (≈700 ms, staggered by 80 ms); the lane path draws in once; real state changes animate node positions in 320–420 ms. The explanatory illustration plays one finite four-step sequence when it enters the viewport and resets when it leaves. It has no controls and its captions are a static list, so the copy never moves. Live views move only when a server response changes. Loops are limited to the spinner and the "live" status dot.
- **Mobile:** its own composition rather than a squeezed desktop. Headline, scenarios, a full-width action, then the instrument *rotated vertical* (time flows down, Stripe and app lanes side by side), then stacked checks and activity.

### Skills and references actually used

- Read: `design-taste`, `taste-typography`, `taste-motion`, `taste-accessibility`, `taste-ux-copy`, `taste-web-performance` (Claude global), plus `design-taste-frontend`, `landing-page-design` and `regards-art-direction`. Those three were missing from `~/.claude/skills` and were installed with the three targeted `npx skills add … --global --yes` commands from `docs/DESIGN-SKILLS.md`. All three reported "copied". The installed `regards-art-direction/SKILL.md` differs from the older local Codex copy; the installed one was used.
- **Regards:** its MCP research tools (`search_sections` etc.) are **not connected** in this Claude session. No regards.design search was run. Following its documented fallback, the direction was decided from the brief and the subject, not researched. Its inspector/lint scripts were not run.
- Better Design MCP, SuperDesign, Figma and Magic Patterns were **not used**.
- **Soulstack** (https://www.soulstack.app/) was opened in the browser pane and scrolled. The one idea taken is narrative pairing: each claim sits beside the instrument that proves it. Nothing in the layout or branding was copied. The other references in DESIGN-SKILLS.md were not opened.
- **Resolved conflicts.** User and brief requirements win over skill defaults.
  - Selective glass is kept, although Regards bans glass.
  - Headline text is solid, not Elaya's gradient text.
  - Monospace appears for code and hashes only.
  - No photographs are used, despite Regards' picture floor; the user asked for SVG only.
  - Elaya's mandatory tagline-reveal section, FAQ, social proof and pricing were not added. The brief forbids invented proof or pricing.
  - Small uppercase group labels appear only inside the instrument, where they name real phases.

## How it connects (all real API paths)

| Concern | Where | Behaviour |
| --- | --- | --- |
| Session + CSRF | `src/api/client.ts` | `GET /api/session` stores the CSRF token. Every POST sends `X-CSRF-Token` with `credentials: 'include'`. On `403 CSRF_INVALID` the session is refreshed and the POST retried once. |
| Schema checking | `client.ts` | Every response is parsed with the Zod schemas from `@fastforward/contracts`. A mismatch is shown as an error and is never guessed. |
| Readiness | `Console.tsx` | Shows Ready, Not ready (server blockers plus "Check again"), Can't reach server (auto-retry plus "Try now") or Connecting. "Connection details" lists provider status and messages. No key or password is ever requested. |
| Runs + restore | `useFastforward.ts` | On load it selects the server's `activeRunId`, then the run remembered in `sessionStorage`, then the visitor's newest run. An earlier-runs selector appears when there is more than one. |
| Create | `useFastforward.start` | Uses the selected scenario IDs. A ref guard plus a disabled button prevent duplicate POSTs. 409/429/503 and origin/CSRF errors become plain sentences, and blockers are listed. On 409/503 readiness is refreshed. |
| Ordered events | `useFastforward` feed effect | Reads the run, then pages `events?after=cursor` until fewer than 200 arrive. IDs are deduplicated and sorted. Polls every 1.8 s while the run is nonterminal (5.4 s in a hidden tab). Network failures show **Reconnecting** with backoff up to 15 s and never mark the job failed. Polling stops at a terminal status. Requests are aborted on run change or unmount. |
| Cancellation | `Evidence.tsx` | "Stop this test" POSTs cancel. `cancel_requested` is shown as "Stopping — waiting for cleanup to be confirmed" until the server reports `cancelled`. |
| Results | `Evidence.tsx`, `Stage.tsx` | The verdict renders only for terminal statuses, with the server's summary and error. Baseline failures stay visible as evidence. `null` means "Not observed yet", never a pass. |
| Artifacts | `Evidence.tsx` | Only artifacts the server returned are listed. "Download" uses the server's `downloadUrl`. "View" fetches same-origin `/api/…` only and renders escaped text in a bounded viewer. |
| Live region | `run__phase` | Only `run.phase` is announced, politely. The activity log is not live. |
| Focus | `App.tsx` | Focus moves once, after the visitor's own start, to "The working test". It never moves on polling updates. |

The two-lane instrument (`LaneInstrument.tsx`, `lib/lanes.ts`) draws only server data:
- One instrument per scenario.
- Columns come from real checks, grouped by check-ID phase prefix.
- Expected and observed access come from the check; Stripe status comes from `stripeStatus`.
- The simulated date comes from `data.observations[].clockTime` on the server's observation events.
- Before the first observation, the planned columns appear as "Not read yet / Not observed yet".
- With more than one repair attempt, the original app and the latest attempt are drawn. A note points to the full evidence list.

Before any run, the stage shows the explanatory illustration, labelled **"Illustration · not a live result"**.

### Design preview (development only)

`?preview=<state>` loads `src/preview/Preview.tsx`, but only when `import.meta.env.DEV` is true. It renders fixture shapes under a sticky amber **"Design preview · Not connected"** banner, so each state could be inspected without spending real runs. States: `empty`, `not-ready`, `offline`, `busy`, `baseline`, `repairing`, `reconnecting`, `cancel-requested`, `passed`, `failed`, `blocked`, `interrupted`.

The production build was checked: it contains no fixture strings (`preview-run`, `Preview blocker`). The connected app never falls back to these shapes.

## Files

All new. `apps/web/package.json` was left unchanged.

- `apps/web/index.html`, `vite.config.ts`, `tsconfig.json`, `public/favicon.svg`
- `apps/web/src/main.tsx`, `App.tsx`, `styles.css`
- `apps/web/src/api/client.ts`, `api/useFastforward.ts`
- `apps/web/src/lib/status.ts`, `lib/lanes.ts`, `lib/hooks.ts`
- `apps/web/src/components/LaneInstrument.tsx`, `HowItWorks.tsx`, `Stage.tsx`, `Console.tsx`, `Evidence.tsx`, `Explainer.tsx`, `Wordmark.tsx`
- `apps/web/src/preview/Preview.tsx` (development only)
- `docs/frontend/IMPLEMENTATION.md` (this file), `docs/frontend/REQUESTS.md` (appended)

## Dependencies

No new dependencies. Uses only the supplied `react`, `react-dom`, `motion` (`motion/react`), `lucide-react` (SVG icons) and `zod` (through `@fastforward/contracts`), plus the dev tools `vite`, `@vitejs/plugin-react` and `typescript`. `clsx` and `tailwind-merge` were not needed. No fonts, images or third-party snippets were added, so there are no extra licence notices.

## Checks actually run

- `npm run build` in `apps/web` (`tsc -b && vite build`): passes. Output: 497 kB JS (155 kB gzip) and 24 kB CSS. The JS size is mostly React, motion and Zod 4 from the contracts package. Generated `dist/` and `tsconfig.tsbuildinfo` were deleted afterwards.
- **Connected (Vite on :5174 → API on :3000):**
  - `/api/session`, `/api/readiness` and `/api/runs` returned 200. Readiness showed Ready, and connection details listed four providers.
  - A POST without CSRF returned `403 CSRF_INVALID`. With CSRF from origin :5174 it returned `403 ORIGIN_INVALID`.
  - `events` for an unknown run returned 404.
  - No console errors.
- **Not run from this browser:** run creation, live polling of a real run, cancellation and artifact download. Port 5173 is occupied on this machine by an unrelated local app ("Atlas"), and the API only accepts POSTs from `http://localhost:5173`. Codex's own CLI run had already used the shared allowance. Event, check and observation shapes were compared against Codex's redacted live receipt (`docs/evidence/2026-10-17-live-repair.json`) and match the parser: check-ID prefixes, `data.status`, and `data.observations[].clockTime`.
- **Layouts inspected by screenshot** with the connected page and preview states: 1440×900, about 800 wide, 720×450 (equivalent to 1440 at 200% zoom), 390×844, 375×812 and 320×640. `scrollWidth` equals `clientWidth` at 390, 720 and 320 after the fixes.
- **Keyboard:** skip link first, then wordmark, nav, both scenario checkboxes (Space toggles; the focus ring is drawn on the card), the primary button and the Connection details disclosure. Focus rings are visible on the dark ground.
- **Reduced motion:** checked in code only. The browser pane cannot emulate `prefers-reduced-motion`. The code changes:
  - `useReducedMotion` disables the hero entrance, path draw-in and position tweens, and shows the illustration fully drawn with every caption marked.
  - A global CSS gate removes transitions and loops.

### Visible problems found and fixed

1. On desktop the headline broke into four ragged lines. The copy column was widened (11fr/13fr) and the display size retuned, so it is now two lines at 1440.
2. The four-column live instrument rendered at about 11 px text inside the half-width stage. When a run exists, the stage now spans the full width on desktop (scenarios move beside the headline), and the SVG scale is capped.
3. On phones the vertical instrument overflowed by 5 px and its labels collided with the rails. The geometry was rebuilt, labels now draw above the rails with a dark halo, the repair marker was repositioned, and the stage glow is clipped.
4. Also fixed: the "Ready" dot sat on its own line on mobile; the activity list trapped page scrolling; the has-run hero left a gap under the headline.

## Remaining limitations

- No connected run was created from the web UI (see above). The first real web-started run should be watched end to end on :5173 or the deployed origin.
- Regards research, its inspector and a Lighthouse run were not performed.
- Reduced motion and real screen readers were not tested with assistive technology or OS emulation; only the code paths were reviewed.
- Only the original app and the latest repair attempt appear in the instrument; earlier attempts appear in the checks list.
- Clock dates map to observation events by phase order. If the backend later emits observation events without checks, see the request in REQUESTS.md.
