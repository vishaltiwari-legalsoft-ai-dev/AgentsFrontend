# MR DeskBoard charts redesign

**Date:** 2026-07-21 · **Status:** Approved (user picked "teeno redesign")

## What changes (three panels of the Overview DeskBoard)

1. **Leads vs qualified: two lines → nested area.** The question is part-to-whole
   ("kitne me se kitne qualified"). Leads renders as a light neutral envelope,
   Qualified as a brand-filled area inside it; the gap IS the funnel loss. A
   qualification-rate chip (`qualified/leads` of the latest month) sits in the
   card header. End-value labels for both series; legend stays.
2. **Channel mix: stacked $ bars → 100% share area.** Total spend already lives
   in the hero Area above, so the mix panel answers "share kaise shift hua".
   Bands stacked to 100% with 2px surface strokes between bands; y-axis 0/50/100%;
   end-share labels for bands ≥ 10%; legend stays.
3. **CPQL by vendor: bars → lollipop.** Same ranked rows, same red decision line,
   same clipped-value chevrons; the mark becomes a 2px stem + 10px dot (less ink,
   same decision read). Under line = brand, over = red-500 (position + red value
   text carry the meaning, not color alone).

All three get a **real hover layer**: crosshair (time charts) / row highlight
(lollipop) + a styled HTML tooltip — replacing native `<title>` tooltips. The
hero Spend area is untouched.

## Channel palette (validated, chart-scoped)

Old `--cat-*` colors FAIL the dataviz validator (light: META `#bf0024` vs Email
`#bf3d20` normal-ΔE 6.1; dark: lightness band + pink/salmon 10.7). New
chart-scoped variables (`--mr-ch-*` in `mr.css`), **stack/legend order fixed as
Google, Email, META, Websites** (validated adjacency, ALL CHECKS PASS both modes):

| Channel | Light (surface #fff) | Dark (surface #0b1013) |
|---|---|---|
| Google | `#7624f4` | `#9d6ef7` |
| Email | `#bf3d20` | `#ef4a26` |
| META | `#0352c9` | `#4d8dff` |
| Websites | `#007544` | `#00a35e` |
| Organic (rare) | `#8a6000` | `#d99000` |
| LinkedIn (rare) | `#bf0024` | `#ff5c7f` |

Rare channels are identity fallbacks, not part of the validated 4-adjacency.
`channelColor()` keeps returning CSS vars so both themes flip automatically.

## Non-goals

- `Lines` / `StackedBars` / `HBars` / `Columns` exports stay (unused after this,
  but other views may pick them up); reports (`MrReportDoc`) untouched.
- No new dependencies — hand-rolled SVG as before.

## Verification

Headless both themes: board screenshots, hover simulation (tooltip visible),
palette validator output kept in this spec; `tsc` + `vitest` green.
