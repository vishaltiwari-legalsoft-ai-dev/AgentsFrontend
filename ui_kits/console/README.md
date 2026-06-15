# Console — Ensemble product app (UI kit)

A high-fidelity, interactive recreation of the Ensemble Console: the workspace where
marketers run **AI Agents** (specialists) and **AI Teams** (workflows).

## Run it
Open `index.html`. Everything is fake/in-memory.

## Screens & interactions
- **Home** — greeting, stat row, and a prominent **Agents ⇄ Teams** segmented toggle that
  swaps the dashboard between an *agents-first* layout (specialist gallery) and a *teams-first*
  layout (active TeamCards + a live-run mini panel). This is the agents-view vs teams-view
  exploration.
- **Agents** — category filter tabs (All / Design / SEO / Copy / Social / Ads / Data), agent
  gallery of `AgentCard`s with add-to-team actions, and a "create custom agent" tile.
- **Teams** — a chat **Team workspace**: a channel list (Campaign Manager, Outbound Reach,
  Content Engine, Launch Squad), and per-team a **Conversation** with the team *coordinator*.
  Messaging the coordinator orchestrates the member agents — it acknowledges, spins up live
  agent steps (running → done), then summarizes. A **History** tab lists the team's past runs
  with outcomes. Opening a team from Home deep-links into its channel.
- **Activity** — a live run view: agent-step timeline with status nodes, plus a summary/members
  side panel.
- Sidebar nav, workspace switcher, search, toasts on actions.

## Files
- `index.html` — shell layout CSS + script load order, mounts `window.ConsoleApp`.
- `data.jsx` — sample agents, teams, run steps, and per-team coordinator chat + history.
- `chrome.jsx` — `Sidebar`, `Topbar`, `Logo`.
- `views.jsx` — `HomeView`, `AgentsView`, `TeamsView`, `ActivityView`.
- `teamspace.jsx` — `TeamWorkspace` (channels, coordinator chat, orchestration, history).
- `app.jsx` — orchestrator (nav, mode, open team, toasts).
- Primitives come from `../_shared/kit-ui.jsx`.

## Production mapping
This kit loads `../_shared/kit-ui.jsx` (a verifiable mirror of the component library) instead of
the compiled bundle, so it renders in any preview. In production these map 1:1 to
`window.EnsembleDesignSystem_c3f858.*`: `Button`, `IconButton`, `Input`, `Badge`, `Tag`,
`StatusDot`, `Avatar`, `AvatarGroup`, `Card`, `Tabs`, `AgentCard`, `TeamCard`.

## Implementation notes
- Icons are **Lucide**, rendered via a React-owned `Icon` component (`LucideIcon`) that draws
  into a leaf `<span>` ref. Do **not** call `lucide.createIcons()` on React-managed nodes — it
  mutates the DOM and corrupts React reconciliation.
