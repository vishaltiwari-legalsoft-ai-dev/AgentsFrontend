# LegalSoft Frontend (newfrontend)

Next.js app wired to the AgentOS backend. Uses the **LegalSoft design system**
(`styles.css`, tokens, and components in this folder) with the same API surface
as the legacy `frontend/` app.

## Local dev

```bash
npm install
copy .env.example .env.local
npm run dev
```

Required env vars (see `.env.example`):

- `NEXT_PUBLIC_API_URL` — backend base URL (default `http://localhost:8080`)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — same value as backend `GOOGLE_CLIENT_ID`

Start the backend first (`uvicorn app.main:app --reload --port 8080` from `backend/`).

## Design system

- `styles.css` — global tokens entry point
- `components/` — React primitives (Button, Input, AgentCard, etc.)
- `ui_kits/console/` — static UI kit mocks (reference only; production app is in `app/`)

## Deploy (Vercel)

Set **Root Directory** = `newfrontend`, add the env vars above, and point the
backend `CORS_ORIGINS` / `APP_PUBLIC_URL` at your Vercel URL.
