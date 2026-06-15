---
name: ensemble-design
description: Use this skill to generate well-branded interfaces and assets for Ensemble (an AI agent + AI teams automation platform for marketing), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation
- `readme.md` — full brand guide: voice, visual foundations, iconography, file index.
- `styles.css` — link this one file to get all tokens + fonts.
- `tokens/` — colors, typography, spacing, effects, fonts.
- `components/` — React primitives (Button, Input, Badge, Tag, StatusDot, Avatar, Card, Tabs, AgentCard, TeamCard). Each has a `.d.ts` props contract and `.prompt.md` usage note.
- `ui_kits/console/` — the product app (agents/teams dashboard, gallery, run activity).
- `ui_kits/marketing/` — landing page.
- `ui_kits/_shared/kit-ui.jsx` — a verifiable, dependency-free mirror of the components for static HTML mocks (use this in throwaway artifacts; in production import from the compiled bundle).
- `assets/` — logo mark + wordmarks.

## Brand in one line
White, minimal, sleek. Ink-black primary actions, a single blue (#2563EB) highlight, soft per-specialism category colors, sharp corners, generous whitespace, Lucide icons. Voice: playful-but-professional, sentence case, verb-led.
