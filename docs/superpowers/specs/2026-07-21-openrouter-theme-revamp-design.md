# OpenRouter Bauhaus Theme — Full UI Revamp Design

**Date:** 2026-07-21
**Status:** Approved (user confirmed: light+dark themes, Poppins headings, exact OpenRouter colors)
**Reference:** `openrouter-ui-reference.md` (repo root) — tokens extracted from openrouter.ai's live CSS.

## Goal

Replace the "Premium Ocean" (navy/teal) visual identity of the LegalSoft Console with
OpenRouter's July-2026 Bauhaus design language: flat surfaces, alpha-tint interaction states,
1px borders instead of shadows, grape `#7624f4` primary on cloud `#fcfcfe` (light) and
volt `#c8ff00` primary on ink `#03080a` (dark).

Component TSX logic, API layer, and canvas code do NOT change. The only TSX edits are the
theme picker (`Views.tsx`) and the boot script default (`layout.tsx`).

## Decisions (user-approved)

1. **Themes:** exactly two — Light (default, grape/cloud) and Dark (volt/ink). Ocean, Sky,
   Prussian are removed.
2. **Fonts:** Poppins (headings, closest free Gordita substitute) + Plus Jakarta Sans
   variable (body, weight 450) + Geist Mono (code). Via Google Fonts, replacing
   Space Grotesk / JetBrains Mono.
3. **Colors:** exact OpenRouter values, not a LegalSoft-blue adaptation.

## Architecture

The app's components consume **semantic aliases** (`--brand`, `--surface`, `--text-primary`,
`--action`, `--border`…). We keep every alias NAME and change VALUES. Dark mode works by
re-declaring aliases under `:root[data-theme="dark"]` — same mechanism the old sky/prussian
themes used.

### 1. `tokens/colors.css` — full rewrite

- **Base ramps (light):** `--gray-*` becomes ink-alpha ramp (`#03080a` at 2/3/4/8/8/12/19/44/44/69/100%
  → the OpenRouter 05/08/0a/14/20/30/70/b0 hex-alpha steps mapped onto the existing 0–900 keys);
  `--blue-*` keys re-pointed to a grape ramp (tints of `#7624f4` for 50–400, solid grape 500–700,
  darkened 800–900) so legacy references stay purple-coherent; `--accent-*` = royal `#035ade` ramp.
- **Status:** positive `#00bf6f` (+text `#007544`), negative `#ff2d55` (+text `#bf0024`),
  warning `#e5a000` (+text `#8a6000`), info `#035ade`. Old `--green/amber/red-*` keys re-pointed.
- **Semantic aliases:** `--bg-app: #fcfcfe`, `--surface: #fff`, `--surface-hover: #03080a08`,
  `--surface-active: #03080a14`, `--border-subtle: #03080a14`, `--border: #03080a20`,
  `--border-strong: #03080a30`, `--text-primary: #03080a`, `--text-secondary: #03080ab0`,
  `--text-tertiary: #03080a70`, `--brand/--action: #7624f4`, hover `#7624f4e0`,
  `--brand-subtle: #7624f408`, `--brand-border: #7624f420`, `--focus-ring: #03080a0f` (3px),
  category colors → grape/royal/coral/green/amber alpha tints.
- **Gradients:** all `--grad-*` become flat grape or subtle grape→royal (kept as vars; consumers
  unchanged). `--glass*` become flat surface colors (no blur); `--dot-grid: transparent`.
- **Dark block** `:root[data-theme="dark"]`: bg ink, text cloud, cloud-alpha neutrals,
  primary volt `#c8ff00` with ink text on it (`--on-brand/--on-action: #03080a`), status text
  brightened (`#34dfaa`, `#ffab00`, `#4d8dff`), volt-based accent-subtle/border/hover.

### 2. `tokens/fonts.css` — swap Google Fonts import

Plus Jakarta Sans `wght@200..800` + Poppins 500/600/700 + Geist Mono 400/500.

### 3. `tokens/typography.css` — OpenRouter role scale

`--font-display: Poppins`, `--font-sans: 'Plus Jakarta Sans'`, `--font-mono: 'Geist Mono'`.
Scale: display 36/1.2/700 · h1 24/1.2/700 · h2 20/1.2/600 · h3 16/1.35/600 · body 14/1.625/450
(new `--fw-book: 450`) · caption/overline 12/500. Keep all existing var names; adjust values.
Tracking tight (−0.025em) only on display sizes.

### 4. `tokens/effects.css` — flatten

Radii: xs 2 → keep, sm 4, md 6, lg 8, xl 12, 2xl 16, pill 9999. Shadows xs–sm →
`0 1px 3px rgba(0,0,0,.06)` class; md–xl → near-flat (borders carry elevation);
`--ring: 0 0 0 3px var(--focus-ring)`. Durations 150/200ms, drop bounce easing usage
(keep var defined for safety).

### 5. Component CSS sweep — `app/console.css`, `kit-ui.css`, `creative.css`, `gd2.css`, `mr.css`

Per-file: replace hardcoded ocean hexes/rgba (25/32/19/121/16 instances respectively) with
semantic vars; remove `backdrop-filter` glass (31 uses) → flat `var(--surface)` +
`1px solid var(--border-subtle)`; remove dot-grid + radial hero backgrounds → flat
`var(--bg-app)`; gradient buttons/rails/avatars → solid grape (volt in dark handled by vars);
navy-tinted shadows → flat borders. Buttons follow OpenRouter recipe: 6px radius,
14px/500 label, primary = solid `--action` + `hover: --accent-hover`-style tint shift;
cards: 8px radius, `1px --border`, `hover: --surface-hover` tint, no shadow.

### 6. Theme picker + boot script

- `Views.tsx` THEMES → `[ {id:"light", swatch:[#7624f4,#fcfcfe,#03080a]}, {id:"dark",
  swatch:[#c8ff00,#03080a,#fcfcfe]} ]`; "light" is default (clears attribute).
- `layout.tsx` boot script: migrate stored legacy values (ocean/sky/prussian → light) and apply
  `data-theme="dark"` only for "dark".

## Error handling / compat

- Legacy `app-theme` localStorage values fall back to light silently.
- All old var names remain defined (re-pointed, never deleted) so any missed reference
  degrades to an on-palette color, never breaks.
- `prefers-reduced-motion` handling in console.css is preserved.

## Testing / verification

1. `npm run typecheck` and `npm run test` pass.
2. `npm run dev` → screenshot login + console in Light and Dark; verify: flat cloud/ink
   backgrounds, grape/volt primaries, no residual teal/navy/glass, readable contrast in both
   themes (volt buttons use ink text), theme toggle persists across reload.
3. Grep gate: no `#0077B6|#00B4D8|#03045E|#023E8A|backdrop-filter|Space Grotesk|JetBrains`
   left in `app/*.css`, `tokens/*.css`, `components/`.
