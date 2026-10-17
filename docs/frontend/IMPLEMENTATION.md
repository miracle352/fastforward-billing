# Frontend implementation — Fastforward

## Round 3: product redesign after user review (current)

User feedback on round 2:
- The Bodoni font and the amber/sage/paper colours were rejected, and the colours did not work together.
- The FAQ should open and close.
- "Run it yourself" and the receipt panel were weak.
- The page read as a hackathon demo instead of a product.
- The footer looked poor.
- Everything must be easy for a 60-year-old to understand, with visuals built in code.

**What changed**
- **Type:** Geist for all text, with Geist Mono for codes and statuses only. Google Fonts, SIL OFL. Body text is 18px.
- **Colour:** one system. Near-black surfaces, one green for action and "correct", red only for "something is wrong", and amber only for "waiting" chips. The amber, sage and paper fields are gone.
- **Hero:**
  - "Payment failed. / Access granted.", with the second line in red.
  - A one-sentence plain explanation, then "Test my billing" and "See how it works".
  - A coded product monitor that replays the recorded 17 Oct test with CSS-only timing: Stripe's events beside the app's answers, then a red "Mismatch found" and a green "Repair verified". It is labelled "Example" and "Example from a recorded test".
- **Explorer:** four big tap-friendly moment cards with icons and Agree/Disagree chips. "Before the fix / After the fix" toggle. "Stripe says" and "The app" cards joined by a solid or broken link.
- **How it works:** four numbered step cards with icons and recorded timings, plus a to-scale bar.
- **Bug section:** a code window with the faulty lines lit, and three plain cards: what went wrong, how it was fixed, who says it works.
- **Run a real billing test:** one app window in three numbered steps.
  1. Choose what to test, with large checkbox cards.
  2. Start the test. A visible readiness checklist covers Stripe, the read-only check, the sandbox and the repair writer, with "Ready"/"Not ready" per service, then the big button.
  3. Watch the results, with the live lanes relabelled "Stripe says / The app did".
  The connected behaviour, uncertain-start reconciliation and Idempotency-Key are unchanged.
- **Proof:** three stat cards from the recorded browser run.
- **FAQ:** an accessible accordion built on native `<details>`, with large rows and a +/× toggle. The first question starts open.
- **Closing call to action:** a card with a coded two-track drawing (billing, plus access breaking and rejoining in a check).
- **Footer:**
  - A live service-status strip driven by `/api/readiness`.
  - Brand line and CTA, product and resource links.
  - The two-track motif and a large quiet wordmark.
- **Product framing:** "hackathon", "no real money" and the "Sample app · Stripe test mode" header label are gone. AGENTS.md labelling is kept, in calmer product language:
  - The hero note: "The live demo checks our own sample subscription app with Stripe test customers. Your real billing and customers are never touched."
  - Step 2: "…Stripe test customers and simulated dates. No real money moves."
  - The FAQ, the footer line, and the monitor's "Example" label.

**Checks performed:**
- `npx tsc` passes, and `npm run build` passes: 525.9 kB JS (162.9 kB gzip) and 32.8 kB CSS.
- `dist` was rebuilt, and :3001 returned 200.
- Screenshots at 1440 of every section and at 390 of the hero, explorer and test app, with animations finished via `getAnimations().finish()` because the pane was hidden.
- No horizontal overflow at 390 and 320 (`scrollWidth == clientWidth`).
- Fonts loaded: Geist and Geist Mono.

**Fixed during review:**
- The hero headline wrapped to three lines.
- The monitor's JS timers stalled in a hidden tab, so the replay is now CSS keyframes.
- The outlined footer wordmark showed overlapping font contours; it is now solid.
- The phone toggle wrapped onto two lines.
- The brand name was hidden at 390.

**Not done:** a live run from this design, a reduced-motion emulation (code review only), a screen reader pass, and a 768 or 200% zoom recheck for this round.

> **Round 2 (redesign), 2026-10-17 late evening, is the previous, superseded design. The round 1 notes after it describe the superseded glass-era design and its checks.** Direction, audit and references: `docs/frontend/DESIGN-DIRECTION.md`.

## Round 2: redesign with design-taste-frontend

### What changed

- **Direction:** dealt by `design-taste-frontend` as "Type and nothing else" (seed 738392838). The hero is "Payment failed. / Access granted." across two flat fields; the seam is the disagreement. There is no glass, no decorative gradient, no shadows at rest, no pills and no tiny tracked labels. Buttons are square and solid. Type is Bodoni Moda (display) with Jost (text). The page moves colour by chapter: black, amber, black, paper, black, surface, sage, black, amber, black.
- **Live thing:** the evidence explorer (`components/Explorer.tsx`). It offers four recorded moments times original or repaired app. Values come from `src/lib/recorded.ts`, copied from the committed public receipts and the public sample source. Every view says "Recorded 17 October 2026, local test run. Not your run."
- **How it works:** `Story.tsx` `HowItWorks`. The four stages are drawn as one bar sized by the recorded durations, labelled as an illustration. It fills once on viewport entry and rests complete. An 8-second fallback settles it if the viewport observer never fires; under reduced motion it is static.
- **The working test:** the console, live lanes and run details are restyled as product-interface fragments (`data-ui`). Session, CSRF, ownership, ordered polling, saved history, cancellation and artifact view/download are all preserved.
- **Behaviour fixes:**
  - Boot no longer waits for the slow readiness probe. The page shows "Checking that Stripe, the sandbox and the model are ready…" instead of "Connecting…".
  - Blockers are translated per service into plain language. The server's raw text sits behind "What the server said".
  - **Uncertain start (Codex request):** a lost POST reply no longer claims "Nothing ran". The page reconciles with the visitor's run history. It selects a newly appeared run ("Your test did start…"). Otherwise it says no new test is in the history, so retrying is safe, or that the history could not be checked and the visitor should reload first.
  - `POST /api/runs` now sends an `Idempotency-Key`: one per deliberate start, reused only when retrying an uncertain start with the same scenarios. This follows Codex's 22:45 note; servers without it ignore the header.
- **Removed:** `components/HowItWorks.tsx` (old lane illustration) and `components/Explainer.tsx`. Their content now lives in `Story.tsx` (FAQ, scope).
- **Added:** `components/Hero.tsx`, `Explorer.tsx`, `Story.tsx`, `Reveal.tsx`, `lib/recorded.ts`, `docs/frontend/DESIGN-DIRECTION.md`.
- **Changed:** `App.tsx`, `main.tsx`, `styles.css` (rewritten), `Console.tsx`, `Stage.tsx`, `Evidence.tsx`, `Wordmark.tsx`, `lib/lanes.ts`, `api/client.ts`, `api/useFastforward.ts`, `preview/Preview.tsx`, `index.html`, `public/favicon.svg`.

### Licences and external resources

- **Fonts:** Bodoni Moda and Jost, both SIL Open Font License 1.1. They load from Google Fonts by `<link>` in `index.html`, so the visitor's browser contacts fonts.googleapis.com and fonts.gstatic.com. Fallbacks are Didot/Georgia and system sans. They are credited in the footer.
- **Icons:** lucide-react (ISC, already supplied).
- **Content:** no images, photographs, emoji or third-party assets; visuals are CSS/SVG and product-UI fragments. React Bits, Motion Primitives and Awesome AI Motion were not used. Motion comes from the supplied `motion` library plus CSS.

### Checks actually performed (round 2)

- **Build:** `npx tsc -p tsconfig.json` passes, and `npm run build` in `apps/web` passes.
  - Output: 512.5 kB JS (159.9 kB gzip) and 31.4 kB CSS. Vite warns that one chunk is over 500 kB.
  - Fixture strings are absent from the production bundle (`grep preview-run` returned 0).
- **dist incident:** I briefly deleted `apps/web/dist` after a build check, although Codex had asked to keep it. I rebuilt it straight away. `http://127.0.0.1:3001/` and its JS/CSS assets returned HTTP 200 afterwards, and that preview now serves **this redesign**.
- **Connected (Vite :5174 → API :3000):** session, runs and readiness returned 200, and readiness showed "Ready". No run was started, so no live allowance was spent in round 2.
- **Screenshots inspected:**

  | Page | Widths |
  | --- | --- |
  | Connected page | 1440, 768, 390, 320, and 720×450 (equivalent to 1440 at 200% zoom) |
  | Preview states `failed` and `passed` | 390 and 1440 |

  The browser pane was hidden, which pauses CSS animations. Before capture, animations were finished with `document.getAnimations().forEach(a => a.finish())`. This is an inspection step only; the page is unchanged.
- **Measured:**
  - `scrollWidth == clientWidth` at 320, 390 and 720.
  - Every heading is two lines or fewer at 320 and 720.
  - At 720×450 the headline top (108px) clears the header (84px).
- **Keyboard:** the order is skip link, wordmark, three nav links and "Test my billing", then the explorer version toggle and moments. The moments form one roving radio stop: ArrowDown moved the selection to "Maya renews" with `aria-checked=true`. Then come the code excerpt (scrollable), the scenario checkboxes, "Test my billing", Connection details, the closing button and the footer links. Focus outlines are visible: sage on dark, black on coloured fields.
- **Reduced motion:** code review only; the pane cannot emulate the media query.
  - CSS keyframes run only under `prefers-reduced-motion: no-preference`.
  - `Reveal`, the stage bar, the explorer and the lanes switch to static when `useReducedMotion()` is true.
  - The global reduce rule removes transitions and loops.
- **Not run:** Taste's `lint.mjs` and `inspect.mjs` (absent from the installed skill), Lighthouse, a screen reader, and a live run from the redesigned page.

### Problems found in screenshots and fixed (three rounds)

1. **Round 1:**
   - Stage-bar notes were squeezed under narrow segments; they are now four equal columns with colour keys.
   - The hero sentence wrapped to four lines and is now wider.
   - The code excerpt scrolled sideways; the long line is shortened and the caption says so.
2. **Round 2:**
   - The phone headline was small and left a third of the screen empty; it is now 13vw with the seam at 42svh.
   - The "Test my billing" button wrapped at 320; it is now nowrap and the mark is hidden under 360.
   - The closing sentence ran to three lines at 320 and is now two.
   - Explorer choices sat below the answer on phones and now come first.
   - The 768 stage segments clipped "seconds" and now have a minimum width.
3. **Round 3:**
   - The headline crowded the header at 200% zoom; the seam is now never higher than header + headline.
   - The explorer heading waited on an exit animation; it now updates immediately.
   - The activity column was short beside the long checks list and is now sticky on desktop.

### Remaining limitations

- No live run has been started from the redesigned page. Codex's earlier browser-run evidence covers the round 1 UI with the same API code paths.
- Explorer and proof figures are recorded evidence from 17 Oct, labelled as such, not live data.
- Fonts depend on Google Fonts at runtime. Self-hosting would need a dependency or asset decision; see REQUESTS.md.
- Public hosting remains blocked on the backend side (see BUILD-STATE.md).

---

# Round 1 notes (superseded design)

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
