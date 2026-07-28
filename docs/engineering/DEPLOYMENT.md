# Deployment (W8)

Durable how-to for deploying PlaceMe. The account-creation and dashboard
steps below are things only a human with browser access can do — this
file exists so that step isn't lost between sessions (same reasoning as
`PROGRESS.md`). See `adr/0007-hosting-deployment.md` for *why* Render +
Cloudflare Pages were chosen, and `PHASE1_PLAN.md` §3a for why the backend
is one Docker service, not two.

## 1. Backend — Render

1. Push `render.yaml` (already in the repo root) to GitHub — done, it's on
   `dev`.
2. Render dashboard → **New** → **Blueprint** → connect the
   `Hruday-Kumar/gd-proto` repo → pick the `main` branch for the deployed
   service (production should track `main`, not `dev` — see
   `BRANCHING.md`; `dev` → `main` is still the user's call to make when
   ready to actually go live).
3. Render reads `render.yaml` and creates one free Web Service,
   `placeme-server`, building from the root `Dockerfile`. You'll be
   prompted to fill in every env var marked `sync: false` — see the
   **Secrets checklist** below for where each value comes from.
4. Once deployed, Render gives you a URL like
   `https://placeme-server.onrender.com`. **Set that as a GitHub
   Actions repository variable** (not a secret — it's not sensitive):
   repo → **Settings** → **Secrets and variables** → **Actions** →
   **Variables** tab → **New repository variable** →
   name `RENDER_APP_URL`, value the Render URL with no trailing slash.
   This is what `.github/workflows/keepalive.yml` pings.
5. Confirm it's alive: `curl https://<your-render-url>/health` should
   return `{"status":"ok"}`, and `curl https://<your-render-url>/health/agent`
   should return `{"activeRooms":0,...,"healthy":true}`.

### Secrets checklist (Render dashboard → service → Environment)

| Key | Where it comes from |
|---|---|
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API (service role, **not** the anon key — server-only, bypasses RLS) |
| `LIVEKIT_URL` | LiveKit Cloud project → Settings |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit Cloud project → Settings → Keys |
| `ASSEMBLYAI_API_KEY` | AssemblyAI dashboard |
| `GEMINI_API_KEY` | Google AI Studio |
| `ALLOWED_ORIGINS` | The deployed frontend's real origin(s) (M6, audit 2026-07-28) — comma-separated if there's more than one (e.g. a production domain plus a Vercel preview URL). No trailing slash, scheme required (`https://your-app.vercel.app`). Without this set, only the local Vite dev origins (`localhost:5173`) are allowed — the deployed frontend's requests would be silently missing CORS headers until this is set. |

Same values already sitting in `apps/server/.env` locally — this is
copying them into Render's dashboard, not generating new ones.
`NODE_ENV` and `GEMINI_MODEL` are already set as plain (non-secret)
values directly in `render.yaml`.

## 2. Frontend — Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → pick `Hruday-Kumar/gd-proto`, branch `main`
   (same production-tracks-`main` reasoning as the backend).
2. Build settings (this is a monorepo — Cloudflare needs to be told which
   sub-app to build):
   - **Framework preset:** Vite
   - **Build command:** `npm run build --workspace=@placeme/web`
   - **Build output directory:** `apps/web/dist`
   - **Root directory:** leave as `/` (repo root) so the workspace
     install/build works — do **not** set it to `apps/web`.
3. Environment variables (Pages project → Settings → Environment
   variables — set for **Production**):

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | same Supabase URL as the backend |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key (safe to expose client-side — see W2 in `PROGRESS.md`) |
   | `VITE_API_URL` | the Render backend URL from step 1 above (no trailing slash) |

4. Deploy. Cloudflare gives you a `*.pages.dev` URL — that's the app.

## 3. Keep-alive + agent health monitoring

Already built and merged (`.github/workflows/keepalive.yml`): every 10
minutes it pings `GET /health` (keeps Render's free tier from sleeping,
per ADR-0007) and checks `GET /health/agent` (W8's dispatch tracker,
`domain/agentWorkerStatus.js`) — if a transcription dispatch has failed
more recently than the last successful one, the workflow run fails, and
GitHub emails the repo's watchers by default. That's the "monitoring/
alerting on the worker's connection status" ADR-0007's Consequences
flagged as still needed — no new paid service required.

**Nothing to do here except step 4 above** (set `RENDER_APP_URL`) — the
workflow already no-ops safely if that variable isn't set yet.

## 4. Pre-launch checklist (do before real students use the deployed app)

- [ ] **Turn Supabase "Confirm email" back ON** — Authentication →
      Sign In / Providers → Email. It's been off since 2026-07-25 to make
      W2's testing possible (see `PROGRESS.md`'s Blockers section);
      leaving it off means anyone can sign up with an unconfirmed email.
- [ ] **Pre-flight P4 — verify the keep-alive pattern actually works**:
      let the deployed backend sit quiet for >15 minutes with no traffic
      (don't trigger the workflow manually), then start a real room and
      confirm the transcription agent still joins successfully. This is
      the specific risk ADR-0007's "Revisit if" section names.
- [ ] Confirm `RENDER_APP_URL` is set (step 1.4 above) and
      `.github/workflows/keepalive.yml` has at least one green run in the
      Actions tab.
- [ ] Full end-to-end run on the **deployed** stack (not local dev) with
      real people: signup → consent → create/join a room → live audio →
      attributed transcription → feedback → history. This is
      `PHASE1_PLAN.md` §5 W8's actual "done when."

## Notes

- **CORS is now an allowlist** (M6, audit 2026-07-28; was previously wide
  open) — set `ALLOWED_ORIGINS` (see the secrets checklist above) to the
  real deployed frontend origin(s) once known, or requests from the
  deployed frontend will be missing CORS headers (local dev is unaffected
  either way — `localhost:5173` is always allowed). This doc's frontend
  section below still says Cloudflare Pages; the project has since moved
  to Vercel (see `PROGRESS.md`'s 2026-07-28 entry and ADR-0007's
  "Superseded" section) — this section needs a rewrite, not attempted
  here since it's out of scope for the CORS fix.
- Render's free Web Service restarts (cold start) on every deploy and
  after any sleep period. `domain/agentWorkerStatus.js`'s counters reset
  on restart — that's fine, it's meant to answer "is dispatch healthy
  *right now*," not to be a durable audit log.
