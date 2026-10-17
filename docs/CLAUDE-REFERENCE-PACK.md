# Fastforward — recovered references and revised frontend direction

## Current user decision

The user has withdrawn the glass requirement and wants to follow the current `design-taste-frontend` skill's design rules. This supersedes earlier glass instructions in the frontend design brief, design-skills notes and chat prompts. Keep backend contracts, file ownership and real evidence boundaries unchanged.

Build a much stronger, original editorial product experience through typography, composition, solid tonal surfaces, useful product imagery and coordinated motion. No glass/backdrop-blur surfaces, decorative gradients, glow pools or interchangeable feature-card grids. Retain the previously requested deep-black foundation unless the user subsequently changes it. Product controls and actual data views keep the conventions needed for usability.

Use the current Taste skill as the main landing-page art direction. Use selected typography, accessibility, motion and review skills for specialist work. Do not combine competing complete art-direction systems or install every resource below.

## Provenance

Recovered from the current conversation, accessible chats titled "Install taste-skill", "Identify referenced site UI styles", "Build the Carry handover demo", and relevant FIELDWORK/Pactset chats. The earlier visual-study reference notes supplied additional source URLs. Only public reference URLs and design decisions are included here; no old project implementation or private repository is a reusable application asset.

Historical links are not proof of current availability, licensing, installed packages or connected MCP tools. Inspect selected references before making claims. Do not copy old Carry code, assets or compositions into this new hackathon implementation.

## Primary visual references

These are study assignments, not assertions that all their design choices fit Taste or Fastforward.

| Reference | What to investigate for this project |
| --- | --- |
| https://lantern-midnight.vercel.app/ | Overall craft, narrative composition and purposeful interaction. Keep it a quality benchmark; Fastforward is not a Web3 product. |
| https://assay-steel.vercel.app/ | Typography, information hierarchy and how an unfamiliar mechanism becomes understandable. |
| https://www.soulstack.app/ | Product explanation, a stable product preview and transitions between related views. |
| https://qash.global/ | Plain-language product communication, typographic confidence and presentation of actual interface screens. |
| https://trimmy.xyz/ | The dark-stage and sequential-storytelling reference previously requested by the user. |

On 17 October the web reading tool loaded SoulStack and Qash. It could not load Lantern, ASSAY or Trimmy; that does not prove those sites are offline. Try a normal browser before dropping them and report access limitations accurately.

Choose at most three primary references for the actual direction. Record one transferable principle from each. Do not blend their branding, exact layouts, palettes or distinctive assets.

## UI, SVG and motion resources explicitly supplied by the user

| Resource | Role to evaluate |
| --- | --- |
| https://opensourceui.in/components | Selected controls and useful interface details, adapted to the chosen material language. |
| https://www.beautifului.dev/ | Interface organisation and component details. |
| https://kexsio.com/animations | Motion examples, section transitions and interaction research. |
| https://kexsio.com/svgs | SVG catalogue found in the earlier reference notes; check individual reuse rights. |
| https://reactbits.dev/ | Selected React effects that fit the new non-glass direction. |
| https://github.com/DavidHDev/react-bits | Component source and actual dependencies/licence. |
| https://github.com/gongnyang/awesome-ai-motion | Motion field guide and relevant technique recipes; not a required video-rendering stack. |
| https://github.com/ibelick/motion-primitives | Focused interface motion primitives. |
| https://github.com/greensock/gsap | Alternative animation engine only if the existing Motion/CSS stack cannot meet a concrete requirement. |
| https://github.com/darkroomengineering/lenis | Optional scroll behaviour research; native scrolling remains acceptable. |
| https://github.com/DavidHDev/canvas-ui | Optional component research. |
| https://github.com/ui-layouts/uilayouts | Optional layout/component research. |
| https://github.com/ui-layouts/cursify | Historical cursor-effect resource; cursor replacement is not part of this brief. |
| https://github.com/paper-design/shaders | Historical graphics resource; heavy decorative backgrounds are not part of the new direction. |
| https://github.com/shader-effects-inc/shaders | Historical shader resource; inspect package/preset terms separately if ever needed. |
| https://github.com/gholtzap/lintapple | UI validation research, not a visual theme. |
| https://github.com/Hyperiux-Immersive/Hyperiux | Exact historical user link. Purpose/current availability not reverified; optional only. |

Use the supplied React/Vite, TypeScript, `motion`, `lucide-react`, `clsx` and `tailwind-merge` stack first. A catalogue entry does not justify a new dependency. Record dependency requests in docs/frontend/REQUESTS.md; Codex owns the root lockfile.

## Additional websites recovered from the earlier reference notes

These were in the previous reference set; they are optional discovery sources, not a checklist to reproduce:

- https://tryalcove.com/
- https://www.graphicalui.com/
- https://prompt-motion.com/
- https://shotreel.app/
- https://www.evilbuttons.com/
- https://www.drawably.dev/
- https://appllama.io/
- https://designbookmark.com/
- https://amicons.design/
- https://genjutsu.athevon.dev/

Genjutsu's public page was readable on 17 October and describes code-based creative motion. Its workflow is optional; do not let a second full workflow override Taste's selected direction.

## Skill and design-tool repositories recovered from the installation chat

Primary:
- https://github.com/Leonxlnx/taste-skill — current install name `design-taste-frontend`.
- https://github.com/madebymustafa/design-taste — use only relevant specialist skills, not every genre pack.

Additional explicitly supplied sources, retained for reference:
- https://github.com/elayadesign/ai-design-skills
- https://github.com/filipwojda/regards-skill — supplied in the current conversation; live research requires its MCP.
- https://github.com/marvkr/better-design
- https://github.com/superdesigndev/superdesign — original user URL; the earlier assistant separately suggested a maintained skill repository.
- https://github.com/zanwei/design-dna/blob/main/SKILL.md
- https://github.com/greensock/gsap-skills
- https://github.com/Jakubantalik/transitions.dev
- https://github.com/Jakubantalik/Libraries.dev

Other historical installation identifiers: `emilkowalski/skill`, `LottieFiles/motion-design-skill`, `Leonxlnx/cinetic`, `DietrichGebert/ponytail`, `21st-dev/codex-plugin`, and `npx impeccable install`. These are not all relevant to this landing-page redesign. Verify exact current sources before installing anything missing.

Read the installed skill before using it. If the main skill is missing from Claude Code:

```text
npx skills add Leonxlnx/taste-skill --skill design-taste-frontend --agent claude-code --global --yes
```

## Execution brief for Claude

Read AGENTS.md, CLAUDE.md, BUILD-STATE.md, docs/API-HANDOFF.md, packages/contracts/src/index.ts and docs/frontend/REQUESTS.md. Preserve existing functionality and concurrent edits. Work only in apps/web/ and docs/frontend/.

Audit the current page in a browser before redesigning. Follow Taste's inventory, page argument, direction selection, copy, still composition, motion and screenshot critique process. Use the actual skill scripts where available. Apply the landing-page skill to public composition; keep the working application's controls and data views usable.

Make the difference between Stripe billing state and real customer access immediately visible. Use actual interface fragments and authored SVG. An explanatory animation is clearly labelled "How it works"; actual run phases, evidence, verdicts and downloads come from the API. One clear action: "Test my billing". Explain sample app, Stripe test mode and the no-grace sample policy plainly. No invented customers, endorsements, prices, metrics or integrations.

Deliver the full frontend rather than only the hero. Inspect 320/390/768/1440px, keyboard, 200% zoom and reduced motion. Fix the most consequential screenshot problems, then inspect again. Do not run live billable/provider jobs repeatedly to tune visuals. Record commands actually run, references actually studied, licences and remaining blockers in docs/frontend/.

No generated images, emoji, Higgsfield, decorative 3D, playback toolbar, fake progress percentages or automatic simulated success. Do not migrate the existing application to Next.js. Do not copy previous project implementation or publish private test identifiers.
