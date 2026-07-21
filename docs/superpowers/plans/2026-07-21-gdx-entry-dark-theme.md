# GDX Entry Screen Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Graphics Designer V2 entry screen follow the console's light/dark theme toggle — volt-on-ink in dark, pixel-identical in light.

**Architecture:** Approach B from the spec (`docs/superpowers/specs/2026-07-21-gdx-entry-dark-theme-design.md`): every hardcoded light-assuming color inside the `.gdx-*` section of `app/gd2.css` is promoted to a `--gdx-*` variable in the existing `.gdx-scroll` block (zero visual change), then one `:root[data-theme="dark"] .gdx-scroll` block redefines all variables with hand-tuned dark values mirroring `tokens/colors.css` dark literals.

**Tech Stack:** Plain CSS custom properties; Playwright (msedge, headless) for surface verification; tsc + vitest as regression guard.

## Risk ledger

- **Coupling:** none added — gdx stays self-contained; the dark block references no global tokens (mirrors their literal values, same convention as `tokens/colors.css` dark theme which is also literal-based).
- **Rigidity:** low — all theme decisions live in two adjacent variable blocks; a future retheme edits only those.
- **Hardcode %:** after Task 1, 0 hardcoded colors remain in gdx *rules* (all behind `--gdx-*` vars); the two variable blocks are intentionally literal, consistent with the token files.

## Global Constraints

- Light theme must stay **pixel-identical** — Task 1 is a pure refactor.
- Layout, spacing, typography, copy: untouched (spec: out of scope).
- Only the `.gdx-*` section of `app/gd2.css` (~lines 884-1120) may change.
- **Do NOT commit** — the working tree carries a large uncommitted batch; the user decides commits.
- Verification bar: headless computed-style checks + screenshots (both themes), `npx tsc --noEmit`, `npx vitest run`. `npm run lint` is broken by design — never run it.

---

### Task 1: Promote hardcoded gdx colors to variables (light-identical refactor)

**Files:**
- Modify: `app/gd2.css` (gdx section only)

**Interfaces:**
- Produces: new variables `--gdx-page-bg`, `--gdx-dots`, `--gdx-badge-bg`, `--gdx-card-shadow`, `--gdx-field-bg`, `--gdx-field-border-hover`, `--gdx-warn`, `--gdx-max`, `--gdx-on-grad`, `--gdx-on-grad-dim`, `--gdx-cta-glow`, `--gdx-cta-glow-hover` — Task 2 defines their dark values.

- [ ] **Step 1: Add the new variables to the `.gdx-scroll` block** — extend the existing variable list (after `--gdx-ring`) with the current literal values, and switch the `background` shorthand to use the new var:

```css
.gdx-scroll {
  flex: 1;
  overflow-y: auto;
  padding: clamp(26px, 4.5vh, 52px) clamp(18px, 4vw, 40px) 46px;
  background: var(--gdx-page-bg);
  /* Fixed light island: this screen keeps its light design under the dark
     theme, so native controls (select popups) must render light too. */
  color-scheme: light;
  --gdx-page-bg: radial-gradient(120% 90% at 50% -12%, #fcfcfe 0%, #f1eafd 100%);
  ...existing --gdx-* vars stay as they are...
  --gdx-dots: rgba(118, 36, 244, 0.18);
  --gdx-badge-bg: #efebfe;
  --gdx-card-shadow: 0 24px 56px -30px rgba(3, 8, 10, 0.3), 0 2px 8px -3px rgba(3, 8, 10, 0.06);
  --gdx-field-bg: #fff;
  --gdx-field-border-hover: #e7dcfc;
  --gdx-warn: #e5a000;
  --gdx-max: #e0574a;
  --gdx-on-grad: #fff;
  --gdx-on-grad-dim: rgba(255, 255, 255, 0.45);
  --gdx-cta-glow: 0 16px 32px -14px rgba(118, 36, 244, 0.72);
  --gdx-cta-glow-hover: 0 22px 40px -14px rgba(118, 36, 244, 0.8);
}
```

(The stale "Fixed light island" comment is rewritten in Task 2.)

- [ ] **Step 2: Replace the 10 hardcoded usages with the variables** (line numbers pre-edit):

| Line | Old | New |
|---|---|---|
| 925 | `radial-gradient(rgba(118, 36, 244, 0.18) 1.5px, transparent 1.6px)` | `radial-gradient(var(--gdx-dots) 1.5px, transparent 1.6px)` |
| 938 | `background: #efebfe;` | `background: var(--gdx-badge-bg);` |
| 971 | `box-shadow: 0 24px 56px -30px rgba(3, 8, 10, 0.3), 0 2px 8px -3px rgba(3, 8, 10, 0.06);` | `box-shadow: var(--gdx-card-shadow);` |
| 997 | `background: #fff;` (select) | `background: var(--gdx-field-bg);` |
| 1002 | `border-color: #e7dcfc;` | `border-color: var(--gdx-field-border-hover);` |
| 1012 | `background: #fff;` (textarea) | `background: var(--gdx-field-bg);` |
| 1024 | `color: #e5a000;` | `color: var(--gdx-warn);` |
| 1025 | `color: #e0574a;` | `color: var(--gdx-max);` |
| 1034 | `border-color: #e7dcfc;` | `border-color: var(--gdx-field-border-hover);` |
| 1041 | `color: #fff;` (CTA) | `color: var(--gdx-on-grad);` |
| 1044 | `box-shadow: 0 16px 32px -14px rgba(118, 36, 244, 0.72);` | `box-shadow: var(--gdx-cta-glow);` |
| 1050 | `box-shadow: 0 22px 40px -14px rgba(118, 36, 244, 0.8);` | `box-shadow: var(--gdx-cta-glow-hover);` |
| 1053 | `box-shadow: 0 0 0 4px var(--gdx-ring), 0 16px 32px -14px rgba(118, 36, 244, 0.72);` | `box-shadow: 0 0 0 4px var(--gdx-ring), var(--gdx-cta-glow);` |
| 1056 | `border: 2.5px solid rgba(255, 255, 255, 0.45);` | `border: 2.5px solid var(--gdx-on-grad-dim);` |
| 1057 | `border-top-color: #fff;` | `border-top-color: var(--gdx-on-grad);` |

- [ ] **Step 3: Verify zero hardcoded colors remain in gdx rules**

Run (PowerShell):
```powershell
$lines = Get-Content app\gd2.css; for ($i = 883; $i -lt 1140; $i++) { $l = $lines[$i]; if ($l -match '#[0-9a-fA-F]{3,8}\b|rgba?\(' -and $l -notmatch '--gdx-') { "{0}: {1}" -f ($i+1), $l.Trim() } }
```
Expected: no output (every match line now contains `--gdx-`).

- [ ] **Step 4: Verify light theme is pixel-identical** — headless light-theme computed-style check (script in Task 2 Step 3 with `THEME=light`): card `rgb(255, 255, 255)`, select color `rgb(20, 20, 40)`, select bg `rgb(255, 255, 255)`, CTA color `rgb(255, 255, 255)`. Screenshot and compare against the pre-change light screenshot by eye.

### Task 2: Add the dark override block

**Files:**
- Modify: `app/gd2.css` (immediately after the `.gdx-scroll` block, before `.gdx-wrap`)

**Interfaces:**
- Consumes: every variable named in Task 1 plus the pre-existing `--gdx-*` set.

- [ ] **Step 1: Rewrite the island comment and add the dark block**

Replace the two-line "Fixed light island" comment above `color-scheme: light` with:
```css
  /* Light values below; the [data-theme="dark"] block after this one flips
     the screen to volt-on-ink. color-scheme keeps native popups in sync. */
```

Insert after the closing `}` of `.gdx-scroll`:

```css
/* Dark theme — volt-on-ink, flat Bauhaus surfaces (mirrors tokens/colors.css dark). */
:root[data-theme="dark"] .gdx-scroll {
  color-scheme: dark;
  --gdx-page-bg: radial-gradient(120% 90% at 50% -12%, #09100a 0%, #03080a 55%, #03080a 100%);
  --gdx-grad: linear-gradient(96deg, #c8ff00 0%, #c8ff00 100%);
  --gdx-grad-text: linear-gradient(92deg, #c8ff00 0%, #d4ff3d 100%);
  --gdx-ink: #fcfcfe;
  --gdx-ink2: #fcfcfeb0;
  --gdx-label: #fcfcfe70;
  --gdx-muted: #fcfcfe70;
  --gdx-card: #0b1013;
  --gdx-border: #fcfcfe14;
  --gdx-field-border: #fcfcfe20;
  --gdx-strip: #fcfcfe08;
  --gdx-strip-border: #fcfcfe14;
  --gdx-accent: #c8ff00;
  --gdx-ring: rgba(200, 255, 0, 0.25);
  --gdx-tv: #7624f420;  --gdx-tvi: #baa7ff;
  --gdx-tb: #035ade20;  --gdx-tbi: #4d8dff;
  --gdx-tg: #00bf6f14;  --gdx-tgi: #3dd68c;
  --gdx-tp: #ffab0014;  --gdx-tpi: #ffab00;
  --gdx-dots: rgba(200, 255, 0, 0.12);
  --gdx-badge-bg: #c8ff0014;
  --gdx-card-shadow: none;
  --gdx-field-bg: #03080a;
  --gdx-field-border-hover: #fcfcfe30;
  --gdx-warn: #ffab00;
  --gdx-max: #ff5c7f;
  --gdx-on-grad: #03080a;
  --gdx-on-grad-dim: rgba(3, 8, 10, 0.35);
  --gdx-cta-glow: 0 16px 32px -14px rgba(200, 255, 0, 0.3);
  --gdx-cta-glow-hover: 0 22px 40px -14px rgba(200, 255, 0, 0.4);
}
```

- [ ] **Step 2: tsc + vitest guard**

Run: `npx tsc --noEmit` then `npx vitest run`
Expected: tsc silent; `Tests  55 passed (55)`.

- [ ] **Step 3: Headless verification, both themes**

Extend the existing scratchpad script `dark-theme-check.js` (verify skill recipe: msedge headless, minted JWT + `gd_ui_v2=1`, goto `/`, click Graphic Designer card's Open, wait `#gd2type`). Run once with `app-theme=dark`, once with `app-theme=light`; assert:

| Check | Light expected | Dark expected |
|---|---|---|
| `.gdx-card` background | `rgb(255, 255, 255)` | `rgb(11, 16, 19)` |
| `#gd2type` color | `rgb(20, 20, 40)` | `rgb(252, 252, 254)` |
| `#gd2type` background | `rgb(255, 255, 255)` | `rgb(3, 8, 10)` |
| `#gd2type` color-scheme | `light` | `dark` |
| `.gdx-generate` color | `rgb(255, 255, 255)` | `rgb(3, 8, 10)` |
| `.gdx-generate` background-image resolves volt | — | contains `rgb(200, 255, 0)` |
| `.gdx-promise b` color | `rgb(20, 20, 40)` | `rgb(252, 252, 254)` |

Screenshot both themes (entry top + side card in view) and **look at them**: dark must read volt-on-ink with no low-contrast text; light must match the pre-change screenshot.

- [ ] **Step 4: Report** — summarize checks to the user with the screenshots' verdict. No commit (Global Constraints).
