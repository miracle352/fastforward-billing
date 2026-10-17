# Design direction: Fastforward redesign, round 2

Written 2026-10-17, Lagos evening. Supersedes the glass-era direction in IMPLEMENTATION.md §"Design reading". The user withdrew glass and asked for the current `design-taste-frontend` (tasteskill v2) rules.

## Audit of the previous page (browser, http://127.0.0.1:3001, 1440 and 800 wide)

1. **The story was not on the page.** The headline "Find billing bugs before customers do" is a category promise. The actual contradiction ("Stripe says the payment failed, the app still lets them in") lived only in a small SVG. That SVG rested on its empty first frame (ghost columns of "—") whenever its viewport timer did not run, which happened in the inspected pane.
2. **Thin, uniform composition with Taste tells.** It used a glass stage, hairline borders, pill tags, tiny uppercase tracked labels and a grid of equal cells for "assumptions". The empty "No test yet" box filled a screen, and the real recorded evidence in `docs/evidence/` was never used. Everything sat at the same three or four sizes.
3. **Readiness hurt comprehension.**
   - The page showed "Connecting to the test server…" for as long as the slow provider probe took, because boot waited for readiness.
   - The blocker shown to visitors was raw operator text: "createos access could not be confirmed. Check the local credential, account and network."
   - The disabled button looked dead. A lost POST response was described as "Nothing ran", which Codex flagged as untrue.

## Taste process (design-taste-frontend, installed in ~/.claude/skills)

- **Draw:** `draw.mjs --sector dev-tool --tone technical --have product-ui --sections showcase,how-it-works,proof,faq,cta,footer --options 3` dealt `type-only-statement`, `quiet-instrument` and `dense-tiles`. **Chosen:** `type-only-statement` (seed 738392838), because the subject's material is a sentence pair: two systems making contradictory statements. Sheet saved to `apps/web/.taste-skill/direction.json`.
- **Sheet:**
  - Hero: "Headline across two fields".
  - Type: Bodoni Moda / Jost.
  - Palette: "Charcoal and sage".
  - Sections: Headline you can type → Stages as one bar → Names as one sentence → Answers as reading text → A sentence with a blank → Name first, places under it.
  - Motion: Colour by chapter.
- **Adjustments, with reasons:**
  - **Palette:** the dealt proportions are kept, but the colours come from the subject and the user's deep-black requirement. The ground is deep black `#0a0a09`, not charcoal. Sage `#9dc39a` is the accent (action and agreement). Amber `#e8a33d` is the subject's own alarm colour and appears as a whole field wherever the page talks about the mismatch. Concrete paper `#d6d2c6` is the invoice/record field.
  - **Proof:** there are no client names and none may be invented. "Names as one sentence" becomes one statement of the recorded browser run, at statement size.
  - **Header:** it is static rather than fixed, so it never sits on content. Colour by chapter therefore lives in the section fields themselves.
  - **Imagery:** no photographs. The user forbids irrelevant stock imagery, and the sheet's "Architecture" atmosphere set is optional. Pictures are the product's own interface fragments, marked `data-ui`, plus the real source excerpt.
  - **Footer:** the wordmark is cropped at the bottom, not the top, as the sheet's own adjustment requires.
- **Scripts:** `lint.mjs` and `inspect.mjs`, which SKILL.md steps 7–9 call for, are **not present** in the installed copy (only `draw.mjs` and `assets.mjs`). The gate was done with browser screenshots and manual measurement instead. `assets.mjs` was not used.

## Inventory (things only this product has)

1. Two named synthetic customers, Maya (healthy renewal) and Leo (failed trial payment).
2. The real defect in `fixtures/sample-app/billing.py`, one line that ignores every event except `customer.subscription.created`.
3. Recorded Stripe values: Leo `past_due`, invoice open, $19.00 due, $0.00 paid. Maya `active`, $19.00 paid.
4. The recorded wrong answer: HTTP 200 where the policy wanted 403.
5. The policy: active or trialing, no grace.
6. Test clocks: simulated time jumping past renewal.
7. Recorded stage durations, run of 20:35–20:36 UTC on 17 Oct: setup 3.8 s, original check 52.5 s, repair 2.9 s, fresh verification 45.1 s, cleanup 3.3 s.
8. The model's recorded one-sentence explanation of its repair.
9. Seven verification checks, including three access-boundary checks.
10. The files a run saves: source, patch, sandbox record, report.
11. The label "Sample app · Stripe test mode".

**Idea:** On this page, *the two records that disagree (Stripe's billing state and the app's door)* become *the two fields of the first screen*. The headline "Payment failed. / Access granted." crosses the seam between them and changes ink as it does. Competitor test: an analytics or uptime tool cannot say this sentence.

**One live thing:** the evidence explorer. Pick a recorded situation (Leo's payment fails, Maya renews, a stranger asks, Maya asks for Leo's report) and switch between the original and the repaired app. You see what Stripe recorded beside what the app did, using values from the recorded run.

## Primary references (studied in the browser on 17 Oct)

| Reference | Principle taken |
| --- | --- |
| ASSAY (assay-steel.vercel.app) | Put the contradiction in the headline and the exact recorded value right under the claim. Here: "Payment failed. / Access granted." with the recorded `past_due` / `HTTP 200` beside it. |
| Lantern (lantern-midnight.vercel.app) | One protagonist persists through the chapters while its state changes. Here: Leo's subscription returns in the explorer, the stage bar, the bug section and the proof statement. |
| Trimmy (trimmy.xyz) | One short sentence per beat on black. The section headings are single beats of the story. |

Also looked at, not used as a direction: Qash (light consumer fintech; only its plain-language principle is relevant) and SoulStack (seen in round 1). React Bits, Awesome AI Motion and Motion Primitives were **not opened** and **not used**. The existing `motion` library, CSS and SVG covered every need.

## Argument (one claim per section)

1. Stripe can say a payment failed while the app still lets the customer in. → Hero, two fields.
2. Here is that exact moment, recorded. → Evidence explorer (the live thing).
3. The cause was one line of the handler. → Real source excerpt plus the recorded repair explanation.
4. A test runs in four stages, under two minutes. → Stage bar with recorded durations (labelled illustration).
5. You can run it now. → The working test (product UI: scenarios, readiness, live lanes, activity, checks, files).
6. It has worked from this page. → Proof statement on the sage field.
7. Plain answers. → FAQ as reading text.
8. Do it. → Closing sentence plus the button.
9. Name and source. → Footer.
