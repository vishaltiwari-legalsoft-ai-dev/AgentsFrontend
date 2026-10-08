# AgentHub console (agenthub-ui-lab)

The Next.js console for the AgentOS backend (FastAPI on Cloud Run). This repo
grew out of `newfrontend/` (forked at `3e667cd`, branch `feat/a12-ordering-note`)
and carries the revamped hub shell: landing, top navigation, Brands panel,
the per-brand SEO dashboard and the Inbox Triage workspace, over the same
`lib/api.ts` contract the old console used.

## Local dev

```bash
npm install
copy .env.example .env.local      # fill NEXT_PUBLIC_GOOGLE_CLIENT_ID and OPENROUTER_API_KEY
npm run dev                       # always on http://localhost:3000
```

Start the backend first (`uvicorn app.main:app --reload --port 8080` from
`backend/`). Locally the browser calls it directly, so the backend's
`CORS_ORIGINS` must include `http://localhost:3000`.

Gate before any commit: `npm run typecheck && npm run test` (vitest, pure
functions). `npm run lint` is knowingly broken — do not fix it as a side quest.

## Modes

- **Live** (default): real Google sign-in, every call to the backend.
- **UI-lab preview**: `NEXT_PUBLIC_PREVIEW_NO_AUTH=1` at build time boots a
  mock all-roles user and answers known GETs from `lib/demo.ts`. Only for a
  throwaway design preview — never where real people sign in. The build sets
  no default, and `lib/api.timeout.test.ts` pins that.

## Production topology

```
browser ── same origin ──▶ Vercel (this app)
                             └─ /backend/api/* ──▶ app/backend/[...path]/route.ts
                                                     └─ X-Serverless-Authorization ──▶ Cloud Run agentsbackend
```

The org policy forbids `allUsers` on Cloud Run, so the browser never reaches
the backend directly. Vercel env for the project that serves this repo:

| var | value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `/backend` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | same as backend `GOOGLE_CLIENT_ID` |
| `OPENROUTER_API_KEY` | server-side, for the header strip |
| `BACKEND_ORIGIN` | the Cloud Run URL for that environment |
| `GCP_SA_KEY` | service-account JSON the relay signs with |
| `NEXT_PUBLIC_PREVIEW_NO_AUTH` | unset |

Backend side, for a NEW origin: add it as an Authorized JavaScript origin on
the Google Web client; set `APP_PUBLIC_URL` on the Cloud Run service (the
Gmail/Canva OAuth return URLs are built from it) and add
`https://<origin>/oauth/google` to the Inbox OAuth client's redirect URIs.
Re-pointing the existing Vercel project (`agents-frontend`) at this repo keeps
all of that as it is.

## Design system

- `styles.css` + `tokens/` — token-driven theming (no Tailwind utilities).
- `components/hub/` — the shell and panels; `components/hub/work/` — the
  workspaces; `components/console/` — the legacy GD / Blog / SEO consoles,
  mounted unchanged behind the new chrome.
