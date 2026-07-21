# OpenRouter Bauhaus Theme Revamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the LegalSoft Console from "Premium Ocean" (navy/teal, glass, gradients) to OpenRouter's Bauhaus language: flat surfaces, alpha-tint states, grape `#7624f4` light theme + volt `#c8ff00` dark theme.

**Architecture:** All components consume semantic CSS vars (`--brand`, `--surface`, `--text-primary`…). We rewrite the token layer (`tokens/*.css`) keeping every var NAME, then sweep 5 component stylesheets for hardcoded ocean values, then swap the theme picker to Light/Dark. No TSX logic changes beyond `Views.tsx` (picker) and `layout.tsx` (boot script).

**Tech Stack:** Next.js 15, React 19, plain CSS custom properties (no Tailwind), Google Fonts.

## Global Constraints

- Exact OpenRouter palette: grape `#7624f4`, volt `#c8ff00`, ink `#03080a`, cloud `#fcfcfe`, coral `#ff6849`, royal `#035ade`, positive `#00bf6f`, negative `#ff2d55`, warning `#e5a000`, amber `#ffab00` (spec §Decisions).
- Never DELETE a CSS var name — only change values (spec §Error handling).
- Alpha-tint ramp steps are hex-alpha suffixes: `05 08 0a 14 20 30 70 b0 e0` (2/3/4/8/12/19/44/69/88%).
- Fonts: Poppins (headings) + Plus Jakarta Sans variable (body, weight 450) + Geist Mono (code).
- Dark theme = `:root[data-theme="dark"]`; light = default (no attribute).
- On-volt text must be ink `#03080a` (white on volt is unreadable).
- Reference for all values: `openrouter-ui-reference.md` (repo root).
- Windows repo — no test framework for CSS; verification = grep gates + `npm run typecheck` + visual check in dev server.

---

### Task 1: Rewrite `tokens/colors.css` (light + dark)

**Files:**
- Modify: `tokens/colors.css` (full rewrite, 284 lines → ~230)

**Interfaces:**
- Produces: every existing var name with new values; new dark block `:root[data-theme="dark"]` replacing `[data-theme="sky"]` and `[data-theme="prussian"]`.
- Consumed by: all `app/*.css` and inline styles.

- [ ] **Step 1: Replace the entire file content with:**

```css
/* LegalSoft — Color tokens (OpenRouter Bauhaus)
   Ink #03080a · Cloud #fcfcfe · Grape #7624f4 (light primary) · Volt #c8ff00 (dark primary)
   Coral #ff6849 · Royal #035ade. Flat surfaces; elevation via 1px alpha borders.
   Interaction states are the SAME hue at fixed alpha stops (05/08/0a/14/20/30/70/b0/e0). */
:root {
  /* ---- Neutral scale (ink-alpha ramp; legacy keys preserved) ---- */
  --gray-0:   #FFFFFF;
  --gray-25:  #fcfcfe;   /* cloud */
  --gray-50:  #03080a05;
  --gray-100: #03080a08;
  --gray-150: #03080a0a;
  --gray-200: #03080a14;
  --gray-300: #03080a20;
  --gray-400: #03080a30;
  --gray-500: #03080a70;
  --gray-600: #03080ab0;
  --gray-700: #03080ac9;
  --gray-800: #03080ae0;
  --gray-900: #03080a;
  --ink:      #03080a;

  /* ---- Warm neutral (coral-subtle; replaces cream) ---- */
  --cream-50: #ff684905;
  --cream-100:#ff684908;
  --cream-200:#ff684914;

  /* ---- Brand ramp (grape; legacy --blue-* keys preserved) ---- */
  --blue-50:  #7624f408;
  --blue-100: #7624f414;
  --blue-200: #7624f420;
  --blue-300: #b79af9;
  --blue-400: #9d6ef7;
  --blue-500: #8946f5;
  --blue-600: #7624f4;   /* grape — brand main */
  --blue-700: #7624f4;
  --blue-800: #6516d9;
  --blue-900: #2d0a66;

  /* ---- Accent ramp (royal blue) ---- */
  --accent-50:  #035ade08;
  --accent-100: #035ade14;
  --accent-200: #035ade20;
  --accent-400: #4d8dff;
  --accent-500: #035ade;
  --accent-600: #0352c9;
  --accent-700: #0348b0;

  /* ---- Semantic status ---- */
  --green-50:  #00bf6f14;
  --green-500: #00bf6f;
  --green-600: #007544;
  --amber-50:  #e5a00014;
  --amber-500: #e5a000;
  --amber-600: #8a6000;
  --red-50:    #ff2d5514;
  --red-500:   #ff2d55;
  --red-600:   #bf0024;

  /* ---- Gradients — flattened (kept as vars for background-image consumers) ---- */
  --grad-brand:      linear-gradient(135deg, #7624f4 0%, #7624f4 100%); /* @kind color */
  --grad-brand-soft: linear-gradient(135deg, #7624f414 0%, #fcfcfe 100%); /* @kind color */
  --grad-duo:        linear-gradient(135deg, #7624f4 0%, #035ade 100%); /* @kind color */
  --grad-accent:     linear-gradient(135deg, #035ade 0%, #035ade 100%); /* @kind color */
  --grad-warm:       linear-gradient(135deg, #ff684914 0%, #ff6849 100%); /* @kind color */
  --grad-hero:       radial-gradient(120% 90% at 85% 0%, #7624f408 0%, #fcfcfe 60%, #ffffff 100%); /* @kind color */

  /* ---- Category palette (workstreams) ---- */
  --cat-design-bg:   #7624f414;  --cat-design:   #7624f4;
  --cat-seo-bg:      #00bf6f14;  --cat-seo:      #007544;
  --cat-copy-bg:     #ff684914;  --cat-copy:     #bf3d20;
  --cat-social-bg:   #ff2d5514;  --cat-social:   #bf0024;
  --cat-ads-bg:      #035ade14;  --cat-ads:      #0352c9;
  --cat-data-bg:     #ffab0014;  --cat-data:     #8a6000;

  /* =========================================================
     Semantic aliases — reference these in components & kits
     ========================================================= */
  --bg-app:          #fcfcfe;
  --surface:         #ffffff;
  --surface-card:    #ffffff;
  --surface-sunken:  #03080a05;
  --surface-hover:   #03080a08;
  --surface-active:  #03080a14;
  --surface-warm:    #ff684908;

  --border-subtle:   #03080a14;
  --border:          #03080a20;
  --border-strong:   #03080a30;

  --text-primary:    #03080a;
  --text-secondary:  #03080ab0;
  --text-tertiary:   #03080a70;
  --text-disabled:   #03080a4d;
  --text-inverse:    #fcfcfe;
  --text-link:       #7624f4;

  --brand:           #7624f4;
  --brand-hover:     #7624f4e0;
  --brand-active:    #6516d9;
  --brand-light:     #9d6ef7;
  --brand-subtle:    #7624f408;
  --brand-bg:        #7624f414;
  --brand-border:    #7624f420;
  --on-brand:        #fcfcfe;

  --action:          #7624f4;
  --action-hover:    #7624f4e0;
  --action-active:   #6516d9;
  --on-action:       #fcfcfe;

  --accent:          #035ade;
  --accent-hover:    #0352c9;
  --accent-active:   #0348b0;
  --accent-subtle:   #035ade14;
  --on-accent:       #fcfcfe;

  --focus-ring:      #03080a0f;

  --success:         #00bf6f;
  --success-bg:      #00bf6f14;
  --warning:         #e5a000;
  --warning-bg:      #e5a00014;
  --danger:          #ff2d55;
  --danger-hover:    #d91f47;
  --danger-bg:       #ff2d5514;

  /* Flat finish — glass/dot-grid retired (vars kept for compatibility) */
  --dot-grid:        transparent;
  --glass:           #ffffff;
  --glass-strong:    #fcfcfe;
  --glass-blur:      none;
  --glass-edge:      none;
}

/* =========================================================
   Dark theme — ink canvas, volt primary, cloud-alpha neutrals.
   Set `data-theme="dark"` on <html>; light is the default.
   ========================================================= */
:root[data-theme="dark"] {
  --gray-0:   #0b1013;
  --gray-25:  #03080a;
  --gray-50:  #fcfcfe05;
  --gray-100: #fcfcfe08;
  --gray-150: #fcfcfe0a;
  --gray-200: #fcfcfe14;
  --gray-300: #fcfcfe20;
  --gray-400: #fcfcfe30;
  --gray-500: #fcfcfe70;
  --gray-600: #fcfcfeb0;
  --gray-700: #fcfcfec9;
  --gray-800: #fcfcfee0;
  --gray-900: #fcfcfe;
  --ink:      #fcfcfe;

  --blue-50:  #c8ff0008;
  --blue-100: #c8ff0014;
  --blue-200: #c8ff0020;
  --blue-300: #e2ff70;
  --blue-400: #d4ff3d;
  --blue-500: #c8ff00;
  --blue-600: #c8ff00;   /* volt — brand main in dark */
  --blue-700: #c8ff00;
  --blue-800: #a5d400;
  --blue-900: #2a3600;

  --accent-400: #4d8dff;

  --grad-brand:      linear-gradient(135deg, #c8ff00 0%, #c8ff00 100%);
  --grad-brand-soft: linear-gradient(135deg, #c8ff0014 0%, #03080a 100%);
  --grad-duo:        linear-gradient(135deg, #7624f4 0%, #c8ff00 100%);
  --grad-warm:       linear-gradient(135deg, #ff684914 0%, #ff6849 100%);
  --grad-hero:       radial-gradient(120% 90% at 85% 0%, #c8ff0005 0%, #03080a 60%, #03080a 100%);

  --cat-design-bg:   #7624f420;  --cat-design:   #baa7ff;
  --cat-seo-bg:      #00bf6f14;  --cat-seo:      #3dd68c;
  --cat-copy-bg:     #ff684914;  --cat-copy:     #ff8c70;
  --cat-social-bg:   #ff2d5514;  --cat-social:   #ff5c7f;
  --cat-ads-bg:      #035ade20;  --cat-ads:      #4d8dff;
  --cat-data-bg:     #ffab0014;  --cat-data:     #ffab00;

  --bg-app:          #03080a;
  --surface:         #0b1013;
  --surface-card:    #0b1013;
  --surface-sunken:  #03080a;
  --surface-hover:   #fcfcfe0a;
  --surface-active:  #fcfcfe14;
  --surface-warm:    #ff684908;

  --border-subtle:   #fcfcfe14;
  --border:          #fcfcfe20;
  --border-strong:   #fcfcfe30;

  --text-primary:    #fcfcfe;
  --text-secondary:  #fcfcfeb0;
  --text-tertiary:   #fcfcfe70;
  --text-disabled:   #fcfcfe4d;
  --text-inverse:    #03080a;
  --text-link:       #c8ff00;

  --brand:           #c8ff00;
  --brand-hover:     #c8ff00e0;
  --brand-active:    #a5d400;
  --brand-light:     #d4ff3d;
  --brand-subtle:    #c8ff0008;
  --brand-bg:        #c8ff0014;
  --brand-border:    #c8ff0020;
  --on-brand:        #03080a;

  --action:          #c8ff00;
  --action-hover:    #c8ff00e0;
  --action-active:   #a5d400;
  --on-action:       #03080a;

  --accent:          #4d8dff;
  --accent-hover:    #7fabff;
  --accent-active:   #035ade;
  --accent-subtle:   #035ade20;
  --on-accent:       #03080a;

  --focus-ring:      #fcfcfe0f;

  --success-bg:      #00bf6f14;
  --warning-bg:      #e5a00014;
  --danger-bg:       #ff2d5514;

  --dot-grid:        transparent;
  --glass:           #0b1013;
  --glass-strong:    #0d1215;
  --glass-blur:      none;
  --glass-edge:      none;
}
```

- [ ] **Step 2: Verify no ocean colors remain in the file**

Run: `grep -icE '0077B6|00B4D8|03045E|023E8A|0096C7|48CAE4|CAF0F8|219EBC|FFB703|14213D|FCA311' tokens/colors.css`
Expected: `0`

- [ ] **Step 3: Verify old theme blocks are gone and dark exists**

Run: `grep -c 'data-theme="sky"\|data-theme="prussian"' tokens/colors.css` → expected `0`; `grep -c 'data-theme="dark"' tokens/colors.css` → expected `1`

- [ ] **Step 4: Commit**

```bash
git add tokens/colors.css
git commit -m "feat(theme): OpenRouter palette — grape/cloud light + volt/ink dark token layer"
```

---

### Task 2: Fonts + typography scale

**Files:**
- Modify: `tokens/fonts.css` (replace the @import line and header comment)
- Modify: `tokens/typography.css` (full rewrite)

**Interfaces:**
- Produces: `--font-display` = Poppins, `--font-sans` = Plus Jakarta Sans, `--font-mono` = Geist Mono, new `--fw-book: 450`; all existing `--fs-*/--lh-*/--ls-*` names kept with new values.

- [ ] **Step 1: Rewrite `tokens/fonts.css`:**

```css
/* Ensemble Design System — Webfonts (OpenRouter Bauhaus)
   Display: Poppins — geometric sans (free Gordita substitute) for headings & brand voice.
   Body:    Plus Jakarta Sans (variable 200–800) — set at weight 450 for UI text.
   Mono:    Geist Mono for technical detail (API keys, code, tabular data).
*/
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Poppins:wght@500;600;700&family=Geist+Mono:wght@400;500&display=swap');
```

- [ ] **Step 2: Rewrite `tokens/typography.css`:**

```css
/* Ensemble Design System — Typography tokens (OpenRouter Bauhaus)
   Display = Poppins (headings, brand voice); Body = Plus Jakarta Sans @ 450. */
:root {
  /* ---- Families ---- */
  --font-display: 'Poppins', 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-sans:    'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono:    'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;

  /* Lining, tabular figures for any numeric display (stats, leaderboards, data). */
  --fvn-tabular: tabular-nums lining-nums;

  /* ---- Weights (450 "book" is the OpenRouter body weight) ---- */
  --fw-regular:  400; /* @kind font */
  --fw-book:     450; /* @kind font */
  --fw-medium:   500; /* @kind font */
  --fw-semibold: 600; /* @kind font */
  --fw-bold:     700; /* @kind font */
  --fw-extrabold:700; /* @kind font */

  /* ---- Type scale (OpenRouter role sizes; 12px floor) ---- */
  --fs-display-2xl: 56px;   /* @kind font */
  --fs-display-xl:  36px;   /* @kind font */
  --fs-display-lg:  30px;   /* @kind font */
  --fs-h1:          24px;   /* @kind font */
  --fs-h2:          20px;   /* @kind font */
  --fs-h3:          16px;   /* @kind font */
  --fs-h4:          14px;   /* @kind font */
  --fs-body-lg:     16px;   /* @kind font */
  --fs-body:        14px;   /* @kind font */
  --fs-body-sm:     13px;   /* @kind font */
  --fs-caption:     12px;   /* @kind font */
  --fs-overline:    12px;   /* @kind font */
  --fs-mono:        13px;   /* @kind font */
  /* line-heights */
  --lh-display-2xl: 1.1; /* @kind other */ --lh-display-xl: 1.2; /* @kind other */ --lh-display-lg: 1.2; /* @kind other */
  --lh-h1: 1.2; /* @kind other */ --lh-h2: 1.2; /* @kind other */ --lh-h3: 1.35; /* @kind other */ --lh-h4: 1.35; /* @kind other */
  --lh-body-lg: 1.5; /* @kind other */ --lh-body: 1.625; /* @kind other */ --lh-body-sm: 1.5; /* @kind other */
  --lh-caption: 1.4; /* @kind other */ --lh-overline: 1.3; /* @kind other */ --lh-mono: 1.5; /* @kind other */
  /* letter-spacing */
  --ls-display-2xl: -0.025em; /* @kind other */ --ls-display-xl: -0.025em; /* @kind other */ --ls-display-lg: -0.025em; /* @kind other */
  --ls-h1: -0.025em; /* @kind other */ --ls-h2: -0.02em; /* @kind other */ --ls-h3: -0.01em; /* @kind other */ --ls-h4: 0; /* @kind other */
  --ls-body: 0; /* @kind other */ --ls-caption: 0.005em; /* @kind other */ --ls-overline: 0.05em; /* @kind other */ --ls-mono: -0.01em; /* @kind other */

  /* ---- Semantic roles ---- */
  --text-display:  var(--fw-bold)     var(--fs-display-xl)/var(--lh-display-xl) var(--font-display);
  --text-heading:  var(--fw-bold)     var(--fs-h1)/var(--lh-h1) var(--font-display);
  --text-title:    var(--fw-semibold) var(--fs-h2)/var(--lh-h2) var(--font-sans);
  --text-body:     var(--fw-book)     var(--fs-body)/var(--lh-body) var(--font-sans);
  --text-label:    var(--fw-medium)   var(--fs-body-sm)/1.2 var(--font-sans);
  --text-code:     var(--fw-medium)   var(--fs-mono)/var(--lh-mono) var(--font-mono);
}
```

- [ ] **Step 3: Verify old fonts gone**

Run: `grep -icE 'Space Grotesk|JetBrains|Hanken' tokens/fonts.css tokens/typography.css`
Expected: `tokens/fonts.css:0` and `tokens/typography.css:0`

- [ ] **Step 4: Commit**

```bash
git add tokens/fonts.css tokens/typography.css
git commit -m "feat(theme): Poppins + Plus Jakarta Sans + Geist Mono, OpenRouter type scale"
```

---

### Task 3: Flatten `tokens/effects.css`

**Files:**
- Modify: `tokens/effects.css` (values only; keyframes below the `:root` block stay untouched)

- [ ] **Step 1: Replace the `:root { ... }` block (radii/borders/shadows/ring/motion) with:**

```css
:root {
  /* ---- Radii (OpenRouter: 4/6/8/12) ---- */
  --radius-xs:   2px;
  --radius-sm:   4px;
  --radius-md:   6px;
  --radius-lg:   8px;
  --radius-xl:   12px;
  --radius-2xl:  16px;
  --radius-pill: 999px;

  /* ---- Border widths ---- */
  --border-w:        1px;
  --border-w-strong: 1px;

  /* ---- Shadows (near-flat; 1px borders carry elevation) ---- */
  --shadow-xs:  0 1px 2px rgba(3,8,10,0.04);
  --shadow-sm:  0 1px 3px rgba(3,8,10,0.06);
  --shadow-md:  0 2px 8px -2px rgba(3,8,10,0.08);
  --shadow-lg:  0 8px 24px -8px rgba(3,8,10,0.10);
  --shadow-xl:  0 25px 50px -12px rgba(3,8,10,0.25);

  /* Focus halo (paired with --focus-ring color) */
  --ring:       0 0 0 3px var(--focus-ring);

  /* ---- Motion (150ms color transitions, calm curves) ---- */
  --ease-out:    cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-fast:    150ms;
  --dur-base:    200ms;
  --dur-slow:    300ms;
  --dur-slower:  400ms;
}
```

- [ ] **Step 2: Verify navy-tinted shadows gone**

Run: `grep -c '3,4,94' tokens/effects.css` → expected `0`

- [ ] **Step 3: Commit**

```bash
git add tokens/effects.css
git commit -m "feat(theme): flat elevation — OpenRouter radii, near-zero shadows, 150ms motion"
```

---

### Task 4: Sweep `app/console.css` (shell, sidebar, nav)

**Files:**
- Modify: `app/console.css` (25 hardcoded colors, 7 gradients, 21 glass refs)

**Procedure (applies to Tasks 4–7 — the sweep rules):**

| Find | Replace with |
|---|---|
| `backdrop-filter:…` / `-webkit-backdrop-filter:…` declarations | delete the declarations |
| `background:var(--glass)` / `var(--glass-strong)` | `background:var(--surface)` |
| `box-shadow:var(--glass-edge)` (alone) | delete |
| dot-grid `radial-gradient(circle, var(--dot-grid)…)` background layers | delete the layer — flat `background:var(--bg-app)` |
| decorative `radial-gradient(...brand-subtle...)` canvas washes | delete the layer |
| `var(--grad-brand)` on small elements (rails, avatars, chips) | `var(--brand)` |
| hardcoded ocean hexes `#0077B6 #0096C7 #023E8A #03045E #00B4D8 #48CAE4 #CAF0F8 #ADE8F4 #90E0EF #8ECAE6 #219EBC #FFB703 #FB8500 #14213D #FCA311` | nearest semantic var: brand→`var(--brand)`, deep navy text→`var(--text-primary)`, tints→`var(--brand-bg)`/`var(--surface-hover)`, ambers→`var(--warning)` |
| `rgba(3,4,94,…)` / `rgba(2,62,138,…)` shadows & tints | `var(--shadow-*)` tier or ink-alpha `#03080aNN` |
| literal `white`/`#fff` text on brand fills | `var(--on-brand)` / `var(--on-action)` |
| any `font-weight:400` on body-size text | `var(--fw-book)` |

Specific known spots in this file:
- `.capp` — remove both background-image layers (radial wash + dot grid): keep `background-color:var(--bg-app)` only.
- `.csidebar` — `background:var(--surface)`; drop backdrop-filter; keep the 1px right border but use `var(--border-subtle)`.
- `.cnav--active::before` rail — `background:var(--brand)`; drop the box-shadow glow.
- `.cworkbar` — keep; `background:var(--brand-subtle)`.

- [ ] **Step 1: Apply the sweep rules to `app/console.css`** (every table row, plus the four specific spots above)

- [ ] **Step 2: Verify**

Run: `grep -icE '0077B6|00B4D8|03045E|023E8A|0096C7|48CAE4|backdrop-filter|dot-grid' app/console.css`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add app/console.css
git commit -m "feat(theme): flatten console shell — no glass/dot-grid, grape nav rail"
```

---

### Task 5: Sweep `app/kit-ui.css` (buttons, cards, badges, inputs)

**Files:**
- Modify: `app/kit-ui.css` (32 hardcoded colors, 14 gradients, 10 glass refs)

Apply the Task 4 sweep table, plus the OpenRouter component recipes:
- Primary buttons: flat `background:var(--action); color:var(--on-action);` hover `background:var(--action-hover)`; radius `var(--radius-md)`; no gradient, no shadow.
- Secondary buttons: `border:1px solid var(--border); background:var(--surface);` hover `background:var(--surface-hover)`.
- Cards: `border:1px solid var(--border); border-radius:var(--radius-lg); background:var(--surface-card);` hover `background:var(--surface-hover)`; no shadow.
- Badges/pills: `border-radius:var(--radius-pill);` tint bg + strong text (e.g. `background:var(--brand-bg); color:var(--brand);` + `border:1px solid var(--brand-border)`), `font-size:var(--fs-caption); font-weight:var(--fw-medium)`.
- Inputs: `border:1px solid var(--border);` focus `border-color:var(--border-strong); box-shadow:var(--ring)`.

- [ ] **Step 1: Apply sweep + recipes to `app/kit-ui.css`**

- [ ] **Step 2: Verify**

Run: `grep -icE '0077B6|00B4D8|03045E|023E8A|0096C7|48CAE4|backdrop-filter' app/kit-ui.css`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add app/kit-ui.css
git commit -m "feat(theme): kit-ui components on OpenRouter recipes — flat buttons/cards/badges"
```

---

### Task 6: Sweep `app/creative.css` + `app/mr.css`

**Files:**
- Modify: `app/creative.css` (19 hardcoded colors, 3 gradients, 1 glass ref)
- Modify: `app/mr.css` (16 hardcoded colors, 1 gradient)

Apply the Task 4 sweep table to both files. `mr.css` already states "Colors reference semantic aliases only" — expect mostly rgba/shadow cleanup there.

- [ ] **Step 1: Apply sweep to both files**

- [ ] **Step 2: Verify**

Run: `grep -icE '0077B6|00B4D8|03045E|023E8A|0096C7|48CAE4|backdrop-filter' app/creative.css app/mr.css`
Expected: `0` for both

- [ ] **Step 3: Commit**

```bash
git add app/creative.css app/mr.css
git commit -m "feat(theme): creative + mr views flattened to OpenRouter language"
```

---

### Task 7: Sweep `app/gd2.css` (heaviest file — 121 hardcoded colors)

**Files:**
- Modify: `app/gd2.css` (121 hardcoded colors, 11 gradients, 1 glass ref)

Apply the Task 4 sweep table. This file likely contains per-feature accent colors — map any non-ocean decorative hues to the category palette (`--cat-*`) or status vars rather than inventing new colors. Where a chart/canvas needs literal colors, use the OpenRouter chart set: `#6366f1 #22c55e #3b82f6 #a855f7 #f43f5e #f59e0b #94a3b8`.

- [ ] **Step 1: Apply sweep to `app/gd2.css`**

- [ ] **Step 2: Verify**

Run: `grep -icE '0077B6|00B4D8|03045E|023E8A|0096C7|48CAE4|CAF0F8|backdrop-filter' app/gd2.css`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add app/gd2.css
git commit -m "feat(theme): gd2 view swept to OpenRouter palette"
```

---

### Task 8: Theme picker Light/Dark + boot script + final verification

**Files:**
- Modify: `components/console/Views.tsx:163-183` (THEMES array + apply/default)
- Modify: `app/layout.tsx:19-25` (boot script)
- Check: `components/LoginScreen.tsx` for hardcoded ocean styles (sweep if any)

**Interfaces:**
- Produces: `data-theme` ∈ {absent = light, `"dark"`}; localStorage `app-theme` ∈ {`"light"`, `"dark"`}; legacy values (ocean/sky/prussian) migrate to light.

- [ ] **Step 1: Replace THEMES + default in `Views.tsx`:**

```tsx
/** Selectable color themes. `id` matches the `data-theme` value on <html>
 *  ("light" is the default and clears the attribute). */
const THEMES = [
  { id: "light", label: "Light", desc: "Grape on cloud", swatch: ["#7624f4", "#fcfcfe", "#03080a"] },
  { id: "dark", label: "Dark", desc: "Volt on ink", swatch: ["#c8ff00", "#03080a", "#fcfcfe"] },
];
```

And in `ThemePicker`: initial state `useState("light")`; effect reads `document.documentElement.dataset.theme === "dark" ? "dark" : "light"`; `apply` clears the attribute for `"light"` and sets it for `"dark"` (same structure as the old `"ocean"` branch, id renamed).

- [ ] **Step 2: Replace boot script in `layout.tsx`:**

```tsx
<script
  dangerouslySetInnerHTML={{
    __html:
      "try{var t=localStorage.getItem('app-theme');if(t==='dark')document.documentElement.dataset.theme='dark';}catch(e){}",
  }}
/>
```

(Legacy stored values — ocean/sky/prussian — simply don't match `'dark'`, so they fall back to light. No explicit migration needed.)

- [ ] **Step 3: Sweep `components/LoginScreen.tsx` if it holds hardcoded ocean styles**

Run first: `grep -nE '0077B6|00B4D8|03045E|023E8A|gradient|glass' components/LoginScreen.tsx` — replace matches per the Task 4 table.

- [ ] **Step 4: Full verification gate**

```bash
npm run typecheck        # expected: exit 0
npm run test             # expected: existing vitest suite passes (canvasMath)
grep -rniE '0077B6|00B4D8|03045E|023E8A|0096C7|48CAE4|CAF0F8|ADE8F4|90E0EF|219EBC|FFB703|14213D|FCA311|backdrop-filter|Space Grotesk|JetBrains' tokens app components --include='*.css' --include='*.tsx'
# expected: no matches
```

- [ ] **Step 5: Visual verification in the running app**

Run `npm run dev`, open the console: verify flat cloud background, grape primary buttons/nav, Jakarta/Poppins fonts render; toggle Dark in the theme picker: ink background, volt primary with INK text on buttons, readable secondary text; reload to confirm persistence; screenshot both themes.

- [ ] **Step 6: Commit**

```bash
git add components/console/Views.tsx app/layout.tsx components/LoginScreen.tsx
git commit -m "feat(theme): Light/Dark theme picker, dark boot script, login sweep"
```
