# Claude Code design handoff — Fastforward

This is a new hackathon implementation started October 17, 2026, after the permitted build window opened. Codex is implementing the real backend; Claude Code owns the frontend. Do not import Carry or Finish code, designs, assets or tests.

## Start here

Open the SAME local project folder as Codex:

`C:/Users/IYANUOLUWA/OneDrive/Documents/ChatGPT/My experiments/fastforward`

Read `AGENTS.md`, `CLAUDE.md`, `BUILD-STATE.md`, `docs/API-HANDOFF.md`, `packages/contracts/src/index.ts`, and `docs/DESIGN-SKILLS.md` before editing. Contracts may evolve during the build; re-read them before final integration.

You own only `apps/web/` and `docs/frontend/`. Codex owns the API, schemas, evaluator, deployment and root dependency lock. Do not switch branches, reset or clean the shared checkout, edit provider configuration, install a different application stack, or commit/push shared changes. Record dependency/API requests in `docs/frontend/REQUESTS.md`; Codex integrates and commits them. Existing files may be another builder's live work.

## The product in plain English

**Fastforward finds and fixes subscription bugs before customers do.**

A sample software app sells access to private reports. Stripe may correctly report a failed payment while the app mistakenly still permits the report download. Fastforward runs the app through supported billing scenarios, observes an actual protected action, asks an agent to repair the billing handler, executes that repair inside CreateOS, and independently checks the repaired behaviour against fresh Stripe test objects.

Primary action: **Test my billing.** No API key entry, local file instructions or operator password for judges. This build supports the supplied sample app, not arbitrary repository uploads or live production accounts.

The sample access policy is **active or trialing subscriptions may access; no grace period**. A failed payment does not mean every real business must revoke access immediately. Explain that the result is assessed against this chosen sample policy.

Two supported scenarios:

- `healthy_renewal`: a valid paying customer must retain access to their own report.
- `trial_payment_failure`: the sample policy must block access after the relevant failed conversion is observed.

Never “fix” a defect by blocking all customers. Correct permission denial is a passing check when denial is expected.

## Creative thesis

**Make the gap between billing time and customer access visible.**

Read this as a confident editorial product for a founder who wants a straight answer: a deep black stage, precise typography, and one authored instrument showing Stripe state and app access coming into agreement. This is a product people can operate, not a cinematic intro they must finish watching.

The signature SVG is a **two-lane billing timeline**: upper lane is verified Stripe billing state; lower lane is the observed report access. A mismatch opens a visible separation. During a real repair, the generated change appears between them; when fresh checks actually pass, the lanes reconnect. Use discrete labels and ticks, not an invented completion percentage. Do not animate simulated months unless the server supplied the corresponding observed state/time. A separately labelled explanatory illustration may animate on viewport entry, but must never look like live evidence.

Art direction requirements:

- Deep near-black background; pale warm interface text; one cool mint or ice accent for the main action and verified agreement. Warm amber identifies a mismatch; red is reserved for actual errors.
- Use authored SVG, type, real source excerpts and actual observed evidence as the imagery. No AI-generated image, Higgsfield, stock robot, 3D object, decorative wireframe sphere, emoji or fake customer avatar.
- Glass is deliberate: one main instrument surface and compact navigation/dialog treatments. Preserve readable opaque fallback surfaces. Do not place translucent cards inside translucent cards everywhere.
- Large, decisive type with short meaningful line breaks. Use an available licensed self-hosted font or a good system fallback. Prefer a single strong sans family and a monospace only for actual code/IDs. Font license notices remain in the source/distribution as required; do not put a row of distracting font/license buttons in the main journey.
- Avoid the default centred badge/headline/two-CTA/three-feature-cards layout. The hero should show the product's actual question and primary action, followed immediately by the working test surface.
- No folder breadcrumb called Fieldnote. Header: Fastforward wordmark, concise navigation, and the small truthful label **Sample app · Stripe test mode**.
- No unverified claim such as “months in three minutes”, “all billing bugs”, “production ready”, customer logos, savings, counters or testimonials.

## Page and application composition

1. **First screen.** Short headline: “Find billing bugs before customers do.” Supporting text: “Run a sample subscription through renewal and failed payment. Fastforward checks access, writes a repair, and tests it again.” Primary action: **Test my billing**. Put the supported-sample/test-mode label nearby. A concise SVG instrument can preview the mechanism, visibly labelled “How it works” until a real run replaces it.
2. **The working test.** Scenario controls with both default scenarios selected. Each uses a short label and a one-line explanation. Server readiness determines whether a run can start. Show a short, actionable blocker in context; put detailed provider diagnostics behind “Connection details”. Do not replace missing readiness with a pretend run.
3. **Observed work.** A readable current phase, discrete activity events, protected-access observations, and an optional expandable source panel. The default view is plain English; technical evidence is one deliberate click away. Prefer “Writing a repair”, “Running the changed app”, and “Checking with fresh test customers” to internal infrastructure language.
4. **The verdict.** Only show success when the server's run status and checks support it. Show expected versus observed access, healthy and ineligible customers, scope, and actual artifact downloads. A source download, patch, execution record and report appear only when returned by the API. Do not manufacture empty deliverables as completed files.
5. **Short explanation and close.** Explain the sample policy, simulated billing time, provider roles and limits in plain words. No pricing cards for an unlaunched commercial service. The old “tap-to-fit pricing” request belonged to the previous concept; do not invent prices or payment collection for this diagnostic product. Tap-friendly scenario controls are useful here.

## Motion that is enjoyable and truthful

Use React with the supplied `motion` dependency and CSS/SVG. Do not add GSAP plus another animation engine unless one specific requirement cannot be achieved cleanly with the baseline.

- One confident 600–900 ms hero composition: type, instrument, action; not every element flying in.
- Short 100–150 ms control feedback and 200–350 ms state transitions. Avoid `transition: all`, huge animated blurs, layout shifts, scroll hijacking and large hover translations.
- SVG paths can draw and discrete states can transform to explain the relationship. During an actual job, transitions must follow real ordered server events; no timer-driven fake phases, fake percentages or inevitable green ending.
- A noninteractive decorative illustration may start as it enters the viewport and reset when re-entering. No play/pause/replay controls or progress scrubber. If a continuous decorative animation would require a pause mechanism, use a short finite sequence instead. Important copy and evidence remain readable and stationary.
- Every essential action remains fast. No intro gate, forced wait, autoplay sound, mouse-only effects or cursor replacement.
- Full reduced-motion mode: static, complete illustration and instantaneous state changes; all hierarchy, labels and functionality survive.

## Mobile, accessibility and resilience

Design at 390, 768 and 1440 pixels; also inspect 320 pixels and 200% zoom. Mobile is a deliberate vertical composition: headline, one action, scenario controls, two stacked evidence lanes, then detailed results. Never compress a desktop table into unreadable horizontal cells. Code and raw IDs may scroll inside their own bounded viewer; the page must not overflow.

Use body text at least 16px, clear contrast, visible keyboard focus, semantic buttons and labels, 44px touch targets, properly labelled native controls or complete keyboard tab patterns, and a skip link. Use an unobtrusive live region for phase changes; do not announce the whole log every two seconds. Do not convey verdicts with colour alone. Focus should stay on the action/result after async updates, not jump on each event.

Refresh restores the visitor's saved run. A page disconnect is not a job failure. Distinguish server error, network reconnecting, queued, active, cancellation requested, cleanup confirmed, interrupted and checks failed. Cancel requested cannot immediately become cancelled in the frontend.

## Backend contract and integration

Canonical schemas are in `@fastforward/contracts`. Follow `docs/API-HANDOFF.md` exactly. Initialize the cookie-based visitor session and retain the returned CSRF token. Use `credentials: 'include'`. Use the same origin in production; Vite proxies `/api` locally.

Fetch readiness and the visitor's runs; create a run with the two supported scenario IDs. Observe events with an ordered cursor, deduplicate IDs, and poll roughly every 1.5–2 seconds while the run is nonterminal. Stop or back off when appropriate. Abort obsolete requests. Avoid duplicate POSTs on double click or remount. The server remains the authority on limits and readiness.

`null` means not observed, never a pass. The server may expose several failed baseline checks as the motivating bug; preserve them in the evidence rather than rewriting their history green after repair. Render generated code and logs as escaped text, never raw HTML. Private artifacts use only the server's authorized `downloadUrl`; provider keys and credentials never enter frontend variables.

Do not add fake API handlers or silently fall back to fixtures on connected routes. Isolated development previews, if useful, must have a persistent **Design preview · Not connected** label and must never be linked as a functioning judge run.

## Skill and reference use

Follow `docs/DESIGN-SKILLS.md`. Select the relevant instructions, explain the creative reading briefly, then implement. The user has already approved Claude owning the design; do not use optional tool installations as a reason to stop the frontend. If a design MCP is absent, state that accurately and use the documented fallback. Do not claim to have seen a reference website or used a plugin without actually doing so.

Use Soulstack for narrative motion principles, OpenSourceUI/BeautifulUI for a small number of licensed control ideas, Qash for confident spacing/type, and Kexsio for meaningful SVG transitions. Do not reproduce their branding or a whole section. Investigate a resource only when it materially helps this product. No library shopping marathon.

## Handoff checklist

- Page remains useful while the backend reports Setup needed.
- React/TypeScript build succeeds with the supplied workspace.
- Connected request paths, CSRF, cookies, ordered events and cancellation states match the schemas.
- Initial, busy, limit, blocked, reconnecting, failed, passed and interrupted views are composed.
- Run evidence is real; no fake progress, fixed success timer or fabricated providers.
- Keyboard, narrow screen, reduced motion and 200% zoom inspected.
- Source, borrowed snippets, fonts and licenses recorded in `docs/frontend/IMPLEMENTATION.md`.
- Record exact commands and observed UI checks, remaining limitations and all dependency requests in `docs/frontend/REQUESTS.md`.
- Leave changes uncommitted for Codex integration. Do not wait for permission to fix ordinary reversible UI issues in your owned files.

## Prompt to paste into Claude Code

```text
You are the frontend designer and engineer for Fastforward. Codex is building the real backend concurrently in this SAME directory. Read AGENTS.md, CLAUDE.md, docs/CLAUDE-DESIGN-BRIEF.md, docs/DESIGN-SKILLS.md, docs/API-HANDOFF.md, packages/contracts/src/index.ts and BUILD-STATE.md first.

Own only apps/web/ and docs/frontend/. Build a distinctive, working React/Vite frontend against the canonical API; do not create another app/repo, change root configuration or lockfiles, touch provider credentials, edit backend code or commit/push. Put dependency/API requests in docs/frontend/REQUESTS.md. Codex supplies baseline dependencies.

The product finds subscription-access defects, writes and runs repairs in CreateOS, and independently checks actual protected report access against Stripe test state. Make it understandable in 15 seconds and operable without an operator password. One action: Test my billing. Supported sample, test payments/data, simulated billing time and no-grace access policy must be clear. Do not add arbitrary repository upload or pretend production integration.

Use the relevant installed design skills and targeted missing installs documented in DESIGN-SKILLS.md. Research actual references/tools where available, then make decisive art direction choices. Deep black, confident editorial typography, tasteful glass, authored SVG billing/access instrument, fun purposeful motion, polished buttons and intentional phone layout. No emoji, AI images, Higgsfield, decorative 3D, folder breadcrumbs, fake progress bars, playback controls, invented results or pricing. Skill defaults that conflict with those explicit user choices do not override the brief.

Design first in your notes briefly, then implement and connect the complete flow. The app must show truthful readiness/blockers, real ordered activity, source/evidence, verification outcomes and artifact downloads. Follow cookie/CSRF/ownership and cancellation semantics. Keep explanatory illustration separate from live execution. Independently inspect 390/768/1440 widths, keyboard, 200% zoom and reduced motion; fix the three most important visible problems. Report exactly what ran, what remains blocked and the files changed. Continue within your owned files while Codex works; request contract changes in the shared request document.
```
