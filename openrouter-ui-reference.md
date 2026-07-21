# OpenRouter.ai — Complete UI Reference Spec

> Extracted via Firecrawl + direct CSS-bundle analysis on 2026-07-21.
> Reflects the **July 2026 Bauhaus brand refresh** (see their blog post "A New Look for OpenRouter").
> Stack: Next.js (App Router) + Tailwind CSS v4 + shadcn/ui-style tokens + Radix-style alpha color scales + Lucide icons.

---

## 1. Brand Palette (core "or-*" tokens)

| Token | Hex | Role |
|---|---|---|
| `--or-ink` | `#03080a` | Near-black ink — all text, dark bg |
| `--or-cloud` | `#fcfcfe` | Off-white — light bg, dark-mode text |
| `--or-grape` | `#7624f4` | Purple — **primary in light mode** |
| `--or-volt` | `#c8ff00` | Lime — **primary in dark mode** |
| `--or-coral` | `#ff6849` | Coral — accent / orange scale |
| `--or-royal` | `#035ade` | Royal blue — info / promo |

Semantic status: positive `#00bf6f` (text `#007544`), negative `#ff2d55` (text `#bf0024`),
warning `#e5a000` (text `#8a6000`), info/promo `#035ade` (text `#0352c9`), amber `#ffab00`.
Tiers: flex = green text `#218358` on `#e6f6eb`; priority = violet text `#6550b9` on `#f4f0fe`.

### Alpha ramp system
Every hue gets a 12-step ramp built from ONE hex + alpha suffixes (not separate hexes):
steps 1–12 = `05, 08, 0a, 14, 14, 20, 30, 70, <solid>, e0, a0, <solid>`.
E.g. `--purple-4: #7624f414`, `--gray-7: #03080a20`, `--red-9: #ff2d55`.
`slate-*` ≡ `gray-*` (ink-alpha in light, cloud-alpha in dark).

## 2. Theme Variables (shadcn convention, HSL triplets)

### Light (`:root`)
```css
--background: 240 50% 99.2%;          /* ≈ #fcfcfe cloud */
--foreground: 197.1 53.8% 2.5%;       /* ≈ #03080a ink */
--card: 0 0% 100%;  --table: 0 0% 100%;  --popover: 0 0% 100%;
--primary: 263.7 90.4% 54.9%;         /* grape #7624f4 */
--primary-foreground: 240 50% 99.2%;
--secondary / --accent: 263.7 90.4% 54.9% / .078;   /* grape @ 7.8% */
--secondary-foreground / --accent-foreground: grape;
--ring: grape;
--muted: ink / .031;  --muted-foreground: ink / .69;
--border / --input: ink / .078;
--destructive: 346.8 77.2% 49.8%;
--link: grape;  --link-hover: grape darkened (L 44.9%);
--surface: #fff;         --card-hover: #03080a08;
--selected-bg: #03080a14; --input-bg: #fff;  --text-faint: #03080a70;
--accent-subtle: #7624f408; --accent-border: #7624f420; --accent-hover: #7624f4e0;
--focus-border: #03080a4d;  --focus-shadow: 0 0 0 3px #03080a0f;
--error-border: #ff2d55;    --error-shadow: 0 0 0 3px #ff2d551a;
```

### Dark (`.dark`) — class strategy, next-themes, localStorage key `theme`, system default
```css
--background: 197.1 53.8% 2.5%;       /* ink #03080a */
--foreground: 240 50% 99.2%;          /* cloud */
--card: cloud / .02;   --table/--popover: 197 30% 4.5%;
--primary: 72.9 100% 50%;             /* VOLT #c8ff00 — accent flips to lime! */
--primary-foreground: ink;
--secondary / --accent: volt / .078;  --ring: volt;
--muted-foreground: cloud / .627;  --border/--input: cloud / .078;
--surface: #fcfcfe03;  --card-hover: #fcfcfe0a;  --selected-bg: #fcfcfe14;
--input-bg: #fcfcfe0a; --text-faint: #fcfcfe70;
--accent-subtle: #c8ff0008; --accent-border: #c8ff0020; --accent-hover: #c8ff00e0;
--focus-border: #fcfcfe4d;  --focus-shadow: 0 0 0 3px #fcfcfe0f;
--positive-text: #34dfaa; --warning-text: #ffab00; --info-text: #4d8dff;
--tier-flex: #3dd68c on #132d21;  --tier-priority: #baa7ff on #291f43;
```

Chart palette (dashboards): cost `#6366f1`, requests `#22c55e`, prompt-tokens `#3b82f6`,
completion `#a855f7`, reasoning `#f43f5e`, cached `#f59e0b`, uncached/neutral `#94a3b8`,
credits `#8b5cf6`, byok `#fbbf24`; generic chart-1..20 rainbow (#0088fe, #00c49f, #ffbb28, #ff8042, tomato…).

## 3. Typography

### Fonts (all self-hosted via next/font)
| Var | Family | Weights | Use |
|---|---|---|---|
| `--font-gordita` | **Gordita** (woff2, static) | 300 / 400 / 500 / 700 | Brand: `h1`, logo, hero (`--font-brand`) |
| `--font-jakarta` | **Plus Jakarta Sans** (variable TTF) | 200–800 + italic | Everything (`--font-sans`, default) |
| `--font-geist-mono` | **Geist Mono** (variable) | 100–900 | Code, API keys, kbd |

Body: `font-weight: 450` (variable font), `tabular-nums`, antialiased,
`font-feature-settings: "rlig" 1, "calt" 1`.

### Semantic type scale (role tokens)
| Role | Size | Weight | Line-height |
|---|---|---|---|
| hero | 36px | 700 | 1.2 (homepage h1 overridden to **56px** `!text-[56px]`) |
| display | 24px | 700 | 1.2 |
| title | 20px | 600 | 1.2 (h1/h2 use `--font-brand` for h1) |
| section | 16px | 500 | 1.35 (h3) |
| heading | 16px | 600 | — |
| prose | 16px | 400 | **1.7** |
| body | 14px | **450** | 1.625 |
| button | 14px | 500 | — |
| overline | 12px | 500 | — |

### Remapped Tailwind text-* scale (non-default!)
`text-xs`→14px/1.625 · `text-sm`→14px/1.35 · `text-base`→16px/1.35 · `text-lg`→16px
· `text-xl`→20px/1.2 · `text-2xl`→24 · `text-3xl`→30 · `text-4xl`→36 · `text-5xl`→48 · `text-6xl`→60.
(Minimum text size is effectively 12px overline / 14px body — deliberate accessibility floor.)
Tracking: tight −0.025em (used on hero). Leading: tight 1.2 / snug 1.35 / normal 1.5 / body 1.625 / prose 1.7.

## 4. Shape, Spacing, Elevation, Motion

- **Radii**: sm 4px · md 6px (buttons, inputs) · lg 8px (cards) · xl 12px · full 9999px (badges, pills, avatars). Base `--radius: .5rem`.
- **Spacing**: Tailwind base `--spacing: .25rem` (4px grid).
- **Breakpoints**: md 768px · lg 1024px · xl 1280px. Containers: hero `max-w-4xl` (896px), stats/cards `max-w-6xl` (1152px), footer `max-w-7xl` (1280px).
- **Shadows**: nearly **flat design** — elevation via 1px borders + alpha bg tints, not shadows. Only shadow-sm (`0 1px 3px #0000001a`) and shadow-2xl (`0 25px 50px -12px #00000040`) appear, sparingly. Focus ring = border + `0 0 0 3px` 6% tint (not Tailwind ring).
- **Motion**: default transition 150ms `cubic-bezier(.4,0,.2,1)`; hover states 500ms ease-out for scale effects. Provider icon cloud: per-icon `float{n} 4s ease-in-out infinite` with staggered delays (150ms increments) + `hover:scale-110 hover:brightness-110`. Card hover: `bg-card-hover` tint + icon `group-hover:scale-110`; arrow icons `group-hover:translate-x-0.5`. Nav uses View Transitions API (`view-transition-name: app-navbar`).
- **z-index**: sticky nav = 49 (`--z-index-sticky`).

## 5. Component Recipes (exact classes)

**Primary button** (Get API Key / Sign Up):
`inline-flex items-center justify-center whitespace-nowrap rounded-md text-button font-medium
bg-primary text-primary-foreground hover:bg-accent-hover active:bg-primary/80
h-11 px-8 gap-2` (nav Sign Up: `px-3 h-full`). Focus: `focus-visible:border-focus-border focus-visible:shadow-focus`. SVG children forced `size-4`.

**Secondary/outline button** (Explore Models):
same base + `border border-input bg-background hover:bg-muted hover:text-accent-foreground active:bg-muted/80 text-foreground`.

**Card** (model card):
`rounded-lg border border-border bg-card text-card-foreground group hover:bg-card-hover transition-colors overflow-hidden` with `p-6` body.
Provider logo: `size-10 rounded-sm ring-1 ring-border/60 group-hover:scale-110`.
Name `text-base font-semibold leading-snug` + `text-xs text-muted-foreground` byline.
Stat divider: `pt-5 border-t border-border`; stat label `text-xs text-muted-foreground`, value `text-xs font-medium`; trend up `text-positive-text`.

**Badge "New"**:
`inline-flex items-center rounded-full border font-medium bg-promo/12 text-promo-text border-promo/14 px-2.5 py-0.5 text-overline`.

**Search trigger** (fake input, ⌘K):
`px-3 border border-input bg-input-bg text-muted-foreground hover:border-focus-border` + Lucide search `size-4` + `<kbd>` chips: `rounded-sm px-1.5 py-0.5 font-mono text-overline bg-muted text-muted-foreground`.

**Navbar**:
`<nav id="main-nav" class="sticky top-0 z-sticky bg-background w-full border-b border-border">` → inner `mx-auto flex h-14 w-full items-center px-6` (56px tall). Nav links: `text-muted-foreground font-medium px-2` buttons. Logo swaps light/dark SVG (`/brand/v2/openrouter-{light,dark}.svg`, h-5).

**Footer**:
`px-6 py-12 md:px-12 md:py-16 border-t bg-background` → `mx-auto max-w-7xl grid gap-8 grid-cols-2 md:grid-cols-4 lg:grid-cols-5`. Col 1 = logo + © line; cols = Product / Company / Developer / Connect.

## 6. Homepage Wireframe (desktop, 1920px)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ NAV (sticky, h-56px, border-b, bg-background, z-49)                       │
│ [◙ openrouter]  [🔍 Search  ⌘K]        Models Fusion Chat Rankings Apps   │
│                                         Docs  [Sign Up ▮primary]          │
├────────────────────────────────────────────────────────────────────────────┤
│ HERO (max-w-4xl center, pt-8, gap-12)                                     │
│         "The Unified Interface For LLMs"  (56px Gordita bold, tight)      │
│     Better _prices_, better _uptime_, no subscriptions. (muted, links)    │
│     [ Get API Key ▮grape h-44px ]  [ Explore Models ▢outline + favicons ] │
│                                                                            │
│ STATS (grid-cols-4, max-w-6xl, borderless "cards")                        │
│    100T           10M+           70+            400+                       │
│  Monthly Tokens  Global Users   Providers      Models   (12px muted)      │
├────────────────────────────────────────────────────────────────────────────┤
│ FEATURE ROW (4 cards, rounded-lg border, px-6 py-4 text)                  │
│ ┌ floating 25-icon ┐ ┌ routing tree:   ┐ ┌ perf line-chart ┐ ┌ shield ✓ ┐ │
│ │ provider cloud   │ │ model slug fans │ │ (light/dark img)│ │ + locks  │ │
│ │ (4s float anim)  │ │ to 3 providers  │ │                 │ │          │ │
│ │ One API for Any  │ │ Higher          │ │ Price and       │ │ Custom   │ │
│ │ Model            │ │ Availability    │ │ Performance     │ │ Data     │ │
│ │ …OpenAI SDK…     │ │ …fall back…     │ │ …at the edge…   │ │ Policies │ │
│ │ Browse all ↗     │ │ Learn more ↗    │ │ Learn more ↗    │ │ View docs│ │
│ └──────────────────┘ └─────────────────┘ └─────────────────┘ └──────────┘ │
├────────────────────────────────────────────────────────────────────────────┤
│ FEATURED MODELS ›            400+ active models on 70+ providers  View all│
│ ┌─ [A\ logo] Claude Fable 5 ─┐ ┌─ GPT-5.6 Sol (New) ─┐ ┌─ Muse Spark 1.1 ┐│
│ │  by anthropic              │ │  by openai           │ │ (New) by meta   ││
│ │  ── border-t ──            │ │                      │ │                 ││
│ │  Tokens 484.3B   +7%       │ │  505.1B      +84%    │ │  41.5B     0%   ││
│ └────────────────────────────┘ └──────────────────────┘ └─────────────────┘│
├────────────────────────────────────────────────────────────────────────────┤
│ FEATURED AGENTS ›     250k+ apps … 4.2M+ users globally           View all│
│ ┌─ dark app screenshot ─┐ ┌─ HERMES-AGENT art ─┐ ┌─ Kilo Code art ─┐      │
│ │ [logo] Replit         │ │ [logo] Hermes Agent │ │ [logo] Kilo Code│      │
│ │ tagline (muted)       │ │ tagline             │ │ tagline         │      │
│ └───────────────────────┘ └─────────────────────┘ └─────────────────┘      │
├────────────────────────────────────────────────────────────────────────────┤
│ HOW IT WORKS (3 numbered steps, small illustrations)                      │
│  ① Signup            ② Buy credits          ③ Get your API key           │
│  Google/GitHub/      credit rows w/ $99/$10  OPENROUTER_API_KEY           │
│  MetaMask/email      skeleton bars           ••••••••••• (mono)           │
├────────────────────────────────────────────────────────────────────────────┤
│ RECENT BLOG POSTS                                                View all→│
│  [purple thumb]  Every Modality Through One API    excerpt…  date (New)   │
│  [brand logo]    A New Look for OpenRouter         excerpt…  date (New)   │
│  [neuron art]    Why Use OpenRouter for DeepSeek   excerpt…  date (New)   │
├────────────────────────────────────────────────────────────────────────────┤
│ FOOTER (border-t, max-w-7xl, 5-col grid)                                  │
│ [◙ openrouter]   Product      Company     Developer      Connect          │
│ © 2026           Chat         About       Documentation  Discord          │
│ OpenRouter, Inc  Rankings     Blog        API Reference  GitHub           │
│                  Apps         Careers(Hiring) SDK        LinkedIn         │
│                  Models       Privacy     Status         X                │
│                  Providers    Terms       …              YouTube          │
│                  Pricing      Support                                     │
│                  Enterprise   Works With OR                               │
│                  Labs         Data                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

Page shell: `flex flex-col items-center gap-16 px-6 md:gap-20 md:px-8 md:pt-8`,
`min-h-[calc(100vh-80px)]`, `mb-16`. Section rhythm = 64–80px vertical gaps.

## 7. Design-language summary

1. **Bauhaus-flat**: geometric, near-zero shadows, 1px alpha borders, generous whitespace.
2. **Two-accent duality**: grape `#7624f4` on cloud (light) ↔ volt `#c8ff00` on ink (dark) — the whole accent system (secondary/accent/ring/link/focus) pivots on one hue per theme at fixed alpha stops.
3. **Alpha-tint everything**: hovers, selections, borders, badges are the SAME hue at 3–12% alpha, never new grays.
4. **Type hierarchy by weight not size**: only 5 sizes on the page (56/24/16/14/12); Gordita reserved for the brand voice (h1/logo), Jakarta 450 for everything else, tabular figures for stats.
5. **Micro-motion**: slow floats (4s), tiny hover translates (2px), scale 1.1 on icons, 150ms color transitions — nothing bounces.
