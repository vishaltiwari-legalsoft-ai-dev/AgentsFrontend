# Marketing — Ensemble landing page (UI kit)

A single-screen marketing landing page for Ensemble.

## Run it
Open `index.html`.

## Sections
- Sticky nav with blur, hero (with live `TeamCard` + floating `AgentCard`s as the product art),
  logo strip, **Agents vs Teams** split explainer, specialist `AgentCard` grid, 3-step
  "how it works", final CTA, footer.

## Files
- `index.html` — page CSS + load order, mounts `window.MarketingLanding`.
- `sections.jsx` — all page sections.
- Reuses primitives from `../_shared/kit-ui.jsx` and sample data from `../console/data.jsx`.

## Production mapping
Same as the Console kit: primitives map 1:1 to `window.EnsembleDesignSystem_c3f858.*`.
