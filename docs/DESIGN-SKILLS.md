# Design skills and resources for Claude Code

Inventory checked on this Windows computer on October 17, 2026. These are instructions and development tools, not runtime dependencies. A skill folder does not prove an associated MCP service is connected or that a paid tool has credit. Do not copy the user's global configuration or authentication into this public repository.

## Small relevant set

Read the existing `design-taste`, `taste-typography`, `taste-ux-copy`, `taste-motion`, `taste-accessibility`, `taste-web-performance`, and `taste-design-review` skills first. They are already Claude-readable under `C:/Users/IYANUOLUWA/.claude/skills/<name>/SKILL.md`.

For the public first screen, the user also explicitly requested Leonxlnx's Taste, Elaya's landing skill and Regards. Their local sources exist, but the matching Claude global folders were absent at inventory time:

| Skill | Existing local source | Upstream source |
| --- | --- | --- |
| `design-taste-frontend` | `C:/Users/IYANUOLUWA/.agents/skills/design-taste-frontend/SKILL.md` | https://github.com/Leonxlnx/taste-skill |
| `landing-page-design` | `C:/Users/IYANUOLUWA/.agents/skills/landing-page-design/SKILL.md` | https://github.com/elayadesign/ai-design-skills |
| `regards-art-direction` | `C:/Users/IYANUOLUWA/.codex/skills/regards-art-direction/SKILL.md` | https://github.com/filipwojda/regards-skill |

Read the local source immediately if installation is unavailable. To make them discoverable by Claude across projects, the user-authorized targeted commands are:

```powershell
npx skills add Leonxlnx/taste-skill --skill design-taste-frontend --agent claude-code --global --yes
npx skills add elayadesign/ai-design-skills --skill landing-page-design --agent claude-code --global --yes
npx skills add filipwojda/regards-skill --skill regards-art-direction --agent claude-code --global --yes
```

Run only missing installs, inspect their result, and read the actual installed SKILL.md. Do not install every skill or use `--all`. A future repository revision may change names: use `npx skills add OWNER/REPO --list` to discover them rather than inventing replacements. The documented CLI supports named skills, agent targeting and global installs. [Skills CLI](https://github.com/vercel-labs/skills)

### Conflicts and honest scope

- Taste frontend and Regards explicitly target public pages, not app dashboards. Apply their composition research to the hero/explanation and use the app-oriented typography/accessibility/motion skills on the working interface.
- User requirements win: authored SVG and code visuals, no AI images, restrained glass and a usable app. Do not add four photographs simply to satisfy a skill's image quota, strip all glass because of a house-style ban, or claim an inspector passed while hiding contradictory elements.
- Elaya's broad skill prescribes hero gradients, icon choices, section lengths and animation styles that conflict with other skills. The product brief resolves those choices: one consistent SVG icon set, readable solid headline text, concise useful sections and bounded motion. Do not stack incompatible defaults.
- Do not invent social proof, guarantees, prices or legal commitments because a marketing checklist asks for them. Real license obligations must be preserved without prominent irrelevant license controls.

## Regards and other optional tools

Regards requires live tools such as `search_sections` and `view_section`. If they are absent in Claude Code, the skill documents:

```powershell
claude mcp add --transport http regards https://mcp.regards.design/mcp
```

Check the result and reconnect/restart Claude if necessary. A successful configuration command is not proof a search ran. If unavailable, use the bundled Taste/Regards direction fallback and state that the direction was not based on live Regards research. Do not spend the build window debugging optional tooling.

`better-design` is installed, but its skill requires the Better Design MCP. If its tools are missing, the skill says the human must review and run the [official setup](https://github.com/marvkr/better-design#setup); do not execute invented setup commands. Pause only that optional MCP workflow, then continue the authorized frontend with other available skills.

`superdesign` is installed. Its CLI and canvas may require separate availability, authentication and credit. Use only if it speeds this specific job; no image/video generation is permitted here. A connected Figma, Magic Patterns, MagicPath or Lovable tool in Codex does not automatically appear in Claude Code. Do not promise a cross-client connection or silently export the project to a new service. Native local authoring is sufficient.

## Verified Claude global inventory

All folders below have `SKILL.md`, unless noted. Base path: `C:/Users/IYANUOLUWA/.claude/skills/`.

| Source | Available skill names | Recommended use |
| --- | --- | --- |
| https://github.com/madebymustafa/design-taste | `design-taste`, `taste-accessibility`, `taste-brand-identity`, `taste-code-craft`, `taste-code-review`, `taste-color`, `taste-design-review`, `taste-design-system`, `taste-gsap`, `taste-landing-page`, `taste-motion`, `taste-typography`, `taste-ux-copy`, `taste-web-performance` | Select only relevant core/specialist guidance. |
| Same source: alternative genre packs | `brutalist-industrial`, `cinematic-motion`, `corporate-trust`, `dark-tech`, `editorial-minimal`, `japanese-minimal`, `neo-brutalism`, `playful-color`, `quiet-luxury`, `retro-print` | Alternatives, not ten styles to combine. |
| https://github.com/marvkr/better-design | `better-design` | Only with its MCP tools available. |
| https://github.com/superdesigndev/superdesign-skill | `superdesign` | Optional authored design workflow; verify CLI/auth first. |
| Other installed helpers; source not reverified for this handoff | `impeccable`, `animate-text`, `media-use` | Consult if a specific refinement needs them. No generated media. |
| Other installed video suite; source not reverified for this handoff | `hyperframes`, `hyperframes-animation`, `hyperframes-audio`, `hyperframes-cli`, `hyperframes-core`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-registry`, `hyperframes-studio` | Out of scope for the working website; not necessary dependencies. |

`learned/` exists but has no top-level SKILL.md; do not call it an available skill without inspecting an actual child skill. The source mapping for the first three rows was verified against the local skills installation manifest, not guessed from similar names. Other Codex-only plugins such as ECC and product-design are not automatically Claude Code plugins.

## Component, animation and reference resources

These are references/libraries, not skills to install with `npx skills add`:

- https://www.soulstack.app/ — reference for narrative motion and a clear sequence; inspect before citing particular behaviour.
- https://opensourceui.in/components — choose at most a few useful licensed controls.
- https://www.beautifului.dev/ — control/detail inspiration.
- https://qash.global/ — typography/spacing reference.
- https://kexsio.com/animations — SVG/transition inspiration; verify actual implementation and licensing.
- https://trimmy.xyz/ — reference, not a required runtime dependency.
- https://github.com/gholtzap/lintapple — inspect purpose and license before adopting; not assumed to be a component library.
- https://github.com/shader-effects-inc/shaders — optional shader experiments; not needed for the core app, and no heavy canvas behind essential copy.
- The previous skills chat also mentioned Paper Design shaders, Motion Primitives, Canvas UI, UI Layouts, Cursify and React Bits. They are optional libraries/reference collections. Resolve their official source and license before adoption; do not guess package names or install all of them.
- The user's screenshot also listed prompt-motion.com, shotreel.app, evilbuttons.com, drawably.dev, tryalcove.com, appllama.io, designbookmark.com, amicons.design and graphicalui.com. Treat these as unverified references. Do not turn a screenshot list into a dependency list.

The baseline is React/Vite, `motion`, `lucide-react`, `clsx` and `tailwind-merge`; Tailwind is optional if the root setup supports it. Prefer CSS and SVG to another runtime library. Request dependencies in `docs/frontend/REQUESTS.md`; only Codex edits the root lockfile.

## Starting Claude Code locally

Claude Code can work with Codex through the same files; no account-to-account bridge is required. In a separate terminal:

```powershell
Set-Location -LiteralPath 'C:/Users/IYANUOLUWA/OneDrive/Documents/ChatGPT/My experiments/fastforward'
claude
```

Complete Claude's own login prompt if it asks; do not paste authentication tokens into chat. Then paste the prompt at the end of `docs/CLAUDE-DESIGN-BRIEF.md`. If launching from an editor or desktop client instead, choose this exact folder and confirm it can edit local files. An ordinary Claude web conversation does not by itself share this checkout.

Codex and Claude do not automatically receive each other's chat messages. Contract changes and requests go through the shared documents, and the human can relay concise status between chats. Do not use another agent's files as permission to send external messages.
