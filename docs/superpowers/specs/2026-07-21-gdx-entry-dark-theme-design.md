# GD Studio entry screen — theme-aware (dark mode) design

**Date:** 2026-07-21
**Status:** Approved (user: "theme-aware banao", "layout same, look adapt", Approach B)

## Problem

The Graphics Designer V2 entry screen (`.gdx-*` in `app/gd2.css`, lines ~884-1120) is a
fixed light island: hardcoded light lavender page, light cards, `color-scheme: light`.
Under the console's new OpenRouter Bauhaus dark theme (volt `#c8ff00` on ink `#03080a`)
it stays light, breaking visual continuity with the rest of the console.

## Decision

**Approach B — dark override block.** Light theme stays pixel-identical (zero changes to
current values). A single `:root[data-theme="dark"] .gdx-scroll { ... }` block redefines
every `--gdx-*` variable with hand-tuned dark equivalents. Hardcoded colors inside gdx
rules that cannot flip via the existing variables are promoted to new `--gdx-*` variables
(defined in both blocks) — never restyled inline.

Rejected: token remap onto global `--surface`/`--text-*` (subtly changes the approved
light look); full redesign (out of scope — layout is unchanged).

## Dark palette (mirrors tokens/colors.css dark theme)

| Variable | Light (unchanged) | Dark (new) |
|---|---|---|
| page background | lavender radial | volt-tinted ink radial: `radial-gradient(120% 90% at 50% -12%, #09100a 0%, #03080a 55%, #03080a 100%)` — opaque stops only; the layer beneath (`--gd2-paper`) is light, so alpha stops would wash gray |
| `color-scheme` | `light` | `dark` (native select popups go dark) |
| `--gdx-grad` (CTA) | grape→royal gradient | solid volt `#c8ff00` |
| `--gdx-grad-text` (hero accent) | grape | volt `#c8ff00 → #d4ff3d` |
| `--gdx-ink` | `#141428` | `#fcfcfe` |
| `--gdx-ink2` | `#565b72` | `#fcfcfeb0` |
| `--gdx-label` | `#7a7fa0` | `#fcfcfe70` |
| `--gdx-muted` | `#8a90a8` | `#fcfcfe70` |
| `--gdx-card` | `#ffffff` | `#0b1013` |
| `--gdx-border` | `#eceaf6` | `#fcfcfe14` |
| `--gdx-field-border` | `#e7e5f1` | `#fcfcfe20` |
| `--gdx-strip` | `#f6f4fc` | `#fcfcfe08` |
| `--gdx-strip-border` | `#edeaf7` | `#fcfcfe14` |
| `--gdx-accent` | `#7624f4` | `#c8ff00` |
| `--gdx-ring` | grape 32% | volt 25% |
| tinted chips `--gdx-t*` | pastel fills + saturated icons | alpha fills + brightened icons (same pattern as `--cat-*` dark tokens) |

New variables (both blocks) for currently-hardcoded values:

| New variable | Light | Dark | Replaces |
|---|---|---|---|
| `--gdx-field-bg` | `#fff` | `#03080a` (sunken) | select + textarea `background: #fff` |
| `--gdx-field-border-hover` | `#e7dcfc` | `#fcfcfe30` | hover `border-color: #e7dcfc` |
| `--gdx-on-grad` | `#fff` | `#03080a` | CTA `color: #fff` (ink-on-volt in dark) |
| `--gdx-dots` | grape 18% | volt 12% | `.gdx-wrap::before/after` dot color |

Any further hardcoded light-assuming color found in the gdx range during implementation
gets the same treatment: promote to a `--gdx-*` variable, define in both blocks.

## Extension (same date, user request): in-studio views

The same Approach-B treatment applied to the 4-step studio (`.gd2-*` section,
`app/gd2.css` lines ~1-960): palette pinned light (`--gd2-card: #ffffff`, was a
`var(--surface)` leak), ~26 hardcoded spots promoted to new `--gd2-*` variables
(btn, inkwell/on-inkwell selection pairs, ai tints, checkerboards, dot grid,
float bar, accent/royal, imgwell), one `:root[data-theme="dark"] .gd2` override
block (volt primary buttons, cloud-inversion selected states, brightened step
hues `#ffab00/#ff8c70/#baa7ff/#3dd68c`, ink surfaces, `color-scheme: dark`).
Intentional constants: `.gd2-brandmark` (royal brand "L") and the
`.gd2-bchip` logo well (white in both themes for logo legibility).

## Out of scope

- No layout, spacing, typography, or copy changes.
- No changes outside the `.gdx-*` / `.gd2-*` sections of `app/gd2.css`.

## Verification

- Headless (Playwright + Edge, `verify` skill recipe), both themes:
  - Light: entry screen computed styles unchanged (card `#ffffff`, select ink `#141428`).
  - Dark: card `#0b1013`, select `#fcfcfe` on `#03080a`, CTA volt bg + ink text,
    `color-scheme: dark` on the select; screenshots eyeballed for contrast.
- `npx tsc --noEmit` + `npx vitest run` stay green (guard only; change is CSS).
