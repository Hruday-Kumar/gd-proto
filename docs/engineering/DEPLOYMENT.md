# Deployment (W8)

Durable how-to for deploying PlaceMe. The account-creation and dashboard
steps below are things only a human with browser access can do — this
file exists so that step isn't lost between sessions (same reasoning as
`PROGRESS.md`). See `adr/0007-hosting-deployment.md` for *why* Render +
(originally Cloudflare Pages, now Vercel — see the ADR's "Superseded"
section) were chosen, and `PHASE1_PLAN.md` §3a for why the backend is one
Docker service, not two.

## Status as of 2026-07-29 — deploy is live

Both halves are actually deployed and were re-verified live in this
session, correcting `PLAN.md` §6's "still open" status for B1 (that section
had never been updated — this is the first record of the real state):

- **Backend — Render service `gd-proto-1`** (`srv-d9jof3l8nd3s73bqomjg`),
  tracking `placemestudy1/gd-proto`'s `main` branch, auto-deploy on. Not
  created from `render.yaml`'s Blueprint (hence the name — a manual "New
  Web Service" deploy instead, functionally equivalent). Live at
  `https://gd-proto-1.onrender.com` — `/health` and `/health/agent` both
  verified responding healthy. Two other, older services (`gd-proto`,
  `placeme-server`) existed pointing at the stale `Hruday-Kumar/gd-proto`
  repo, both already suspended by a user — deleted this session as dead
  weight, not referenced anywhere live.
- **`RENDER_APP_URL` GitHub Actions variable — now set** (this session) to
  `https://gd-proto-1.onrender.com`. The keepalive workflow was previously
  no-op'ing silently (no error, just a skipped ping) since this was never
  set. Manually triggered once to confirm: pinged real `/health` and
  `/health/agent`, both healthy.
- **Frontend — Vercel project `gd-proto-web`**, `gd-proto-web.vercel.app`
  live. `VITE_API_URL`/`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` all set
  for Production. **Origin unclear** — this predates this session and
  isn't documented anywhere else; if you set this up, worth adding a note
  here for the next session.
- **`placeme.study` intentionally points at the waitlist page, not this
  app — confirmed with the user, 2026-07-29.** The custom domain is
  attached to a separate Vercel project (`waitlist`), which is the
  intended pre-launch public landing page. **`https://gd-proto-web.vercel.app`
  is the correct URL for the actual app** (pilot testers, further
  verification sessions, etc.) until the user decides to launch publicly
  under the root domain.
- **✅ CORS fixed and re-verified, 2026-07-29 (same day).** `ALLOWED_ORIGINS`
  is now set on `gd-proto-1` to include both deployed frontend origins —
  a real `OPTIONS` preflight from `https://placeme.study` and
  `https://gd-proto-web.vercel.app` now gets a correct
  `Access-Control-Allow-Origin` header back (previously neither did).
  The deploy is now genuinely end-to-end reachable (via the `.vercel.app`
  URL — see the domain issue just above).
- **✅ Supabase "Confirm email" turned back ON, 2026-07-29.** Re-verified
  live via `/auth/v1/settings` → `mailer_autoconfirm: false`.
- **✅ B4 (Render sleep risk) — tested and PASSED, 2026-07-29.** Keepalive
  workflow deliberately disabled, backend left idle 18+ minutes with zero
  traffic, then a real room started: transcription agent dispatched
  successfully (`dispatchSuccesses: 1, dispatchFailures: 0`). Render logs
  showed the process never actually restarted during the idle window —
  more reassuring than ADR-0007's assumption that the free tier reliably
  sleeps after 15 min, though this is one observation, not a guarantee.
  Keepalive re-enabled immediately after.
- **✅ B7 (guardrail #1 human gate) — DONE, 2026-07-29.** Real two-person
  walkthrough on the deployed stack: room created, joined, live
  conversation, transcription and speaker attribution both confirmed
  correct. **Caught a real production bug in the process** (see below) —
  fixed and re-verified with a second live room before calling this done.
- **🔴 Incident, found and fixed same session: `GEMINI_API_KEY`'s backing
  Google Cloud service account had been deleted or disabled.** Every
  feedback generation was failing with `401 UNAUTHENTICATED:
  "The bound service account is deleted or disabled"` — confirmed in the
  Render logs (`[feedback] generation failed... for both participants`)
  and independently reproduced by calling Gemini's API directly with the
  same key (also 401). This would have hit **every real student
  session** — feedback is the entire point of W6 — and would have hit
  Gemini-generated topics too, just not exercised that session. User
  rotated the key in Google AI Studio; the new key was verified two ways:
  a direct `200 OK` call to Gemini's API, and a second real room on the
  deployed app that generated feedback successfully with no error logs.
  **Updated in both places** — `apps/server/.env` locally and
  `GEMINI_API_KEY` on the Render service (saving it there triggers an
  automatic redeploy, confirmed via `render deploys list`). No indication
  of *why* the service account was disabled — worth keeping an eye on
  whether it recurs, since nothing in this project controls that from the
  application side.

## 1. Backend — Render

1. Push `render.yaml` (already in the repo root) to GitHub — done, it's on
   `dev`.
2. Render dashboard → **New** → **Blueprint** → connect the
   `placemestudy1/gd-proto` repo (not `Hruday-Kumar/gd-proto` — that's a
   stale personal fork, see `PLAN.md` §2 "Repo identity") → pick the
   `main` branch for the deployed service (production should track
   `main`, not `dev` — see `BRANCHING.md`; `dev` → `main` is still the
   user's call to make when ready to actually go live).
3. Render reads `render.yaml` and creates one free Web Service,
   `placeme-server`, building from the root `Dockerfile`. You'll be
   prompted to fill in every env var marked `sync: false` — see the
   **Secrets checklist** below for where each value comes from.

   **(Already done, 2026-07-29 — see "Status" above.)** The live service
   is `gd-proto-1`, created via a direct "New Web Service" rather than the
   Blueprint — if you ever redeploy from scratch, either path works, but
   the Blueprint is the documented one and will name the service
   `placeme-server` per `render.yaml`.
4. Once deployed, Render gives you a URL like
   `https://placeme-server.onrender.com`. **Set that as a GitHub
   Actions repository variable** (not a secret — it's not sensitive):
   repo → **Settings** → **Secrets and variables** → **Actions** →
   **Variables** tab → **New repository variable** →
   name `RENDER_APP_URL`, value the Render URL with no trailing slash.
   This is what `.github/workflows/keepalive.yml` pings.

   **(Already done, 2026-07-29)** — set to `https://gd-proto-1.onrender.com`
   via `gh variable set`, confirmed working with a manual workflow run.
5. Confirm it's alive: `curl https://<your-render-url>/health` should
   return `{"status":"ok"}`, and `curl https://<your-render-url>/health/agent`
   should return `{"activeRooms":0,...,"healthy":true}`.

   **(Confirmed live, 2026-07-29.)**

### Secrets checklist (Render dashboard → service → Environment)

| Key | Where it comes from |
|---|---|
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API (service role, **not** the anon key — server-only, bypasses RLS) |
| `LIVEKIT_URL` | LiveKit Cloud project → Settings |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit Cloud project → Settings → Keys |
| `ASSEMBLYAI_API_KEY` | AssemblyAI dashboard |
| `GEMINI_API_KEY` | Google AI Studio |
| `ALLOWED_ORIGINS` | **⚠️ Not yet set on the live service as of 2026-07-29 — this is the one thing currently broken.** The deployed frontend's real origin(s) (M6, audit 2026-07-28) — comma-separated if there's more than one. No trailing slash, scheme required. Current value needed: `https://placeme.study,https://gd-proto-web.vercel.app`. Without this set, only the local Vite dev origins (`localhost:5173`) are allowed — the deployed frontend's requests are silently missing CORS headers right now. Render dashboard → `gd-proto-1` service → Environment → add it → save (auto-redeploys). |

Same values already sitting in `apps/server/.env` locally — this is
copying them into Render's dashboard, not generating new ones.
`NODE_ENV` and `GEMINI_MODEL` are already set as plain (non-secret)
values directly in `render.yaml`.

## 2. Frontend — Vercel

**(Superseded from Cloudflare Pages, 2026-07-28 — see ADR-0007's
"Superseded" section. Already deployed as of 2026-07-29 — see "Status"
above: project `gd-proto-web`, domain `placeme.study`, env vars all set.
Steps below are the from-scratch how-to, kept for reference / redeploy.)**

1. Vercel dashboard → **Add New** → **Project** → **Import** → pick
   `placemestudy1/gd-proto`, branch `main` (same production-tracks-`main`
   reasoning as the backend). Or via CLI: `npx vercel link` from the repo
   root, then `npx vercel --prod`.
2. Build settings (this is a monorepo — Vercel needs to be told which
   sub-app to build):
   - **Framework preset:** Vite
   - **Build command:** `npm run build --workspace=@placeme/web`
   - **Output directory:** `apps/web/dist`
   - **Root directory:** leave as `/` (repo root) so the workspace
     install/build works — do **not** set it to `apps/web`.
   - `apps/web/vercel.json` already provides the SPA rewrite
     (`/(.*) → /index.html`) so client-side routing works on refresh.
3. Environment variables (Project → Settings → Environment Variables —
   set for **Production**):

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | same Supabase URL as the backend |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key (safe to expose client-side — see W2 in `PROGRESS.md`) |
   | `VITE_API_URL` | the Render backend URL from step 1 above (no trailing slash) — currently `https://gd-proto-1.onrender.com` |

4. Deploy. Vercel gives you a `*.vercel.app` URL — currently
   `gd-proto-web.vercel.app`, the only working deployed frontend URL as
   of 2026-07-29. **`placeme.study` is registered under this Vercel team
   but attached to a different project (`waitlist`)** — see "Status"
   above. Don't assume it points here until that's fixed.

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

- [x] **Set `ALLOWED_ORIGINS` on the live Render service.** **Done and
      re-verified live, 2026-07-29.**
- [x] **Turn Supabase "Confirm email" back ON.** **Done and re-verified
      live, 2026-07-29** — `mailer_autoconfirm: false`.
- [x] **Pre-flight P4 — verify the keep-alive pattern actually works.**
      **Done, PASSED, 2026-07-29** — see B4 in the "Status" section above.
- [x] Confirm `RENDER_APP_URL` is set (step 1.4 above) and
      `.github/workflows/keepalive.yml` has at least one green run in the
      Actions tab. **Done, 2026-07-29.**
- [x] Full end-to-end run on the **deployed** stack (not local dev) with
      real people: signup → consent → create/join a room → live audio →
      attributed transcription → feedback → history. **Done, 2026-07-29**
      — see B7 in the "Status" section above, including the
      `GEMINI_API_KEY` incident found and fixed along the way.
- [ ] **New:** fix `placeme.study`'s domain mapping — currently points at
      a different Vercel project (`waitlist`), not this app. Not a
      blocker for a pilot using the `.vercel.app` URL, but should be
      fixed before advertising `placeme.study` to real students.

## Notes

- **CORS is now an allowlist** (M6, audit 2026-07-28; was previously wide
  open) — `ALLOWED_ORIGINS` (see the secrets checklist above) is set on
  the live service to the real deployed frontend origins, verified
  working 2026-07-29 (local dev is unaffected either way —
  `localhost:5173` is always allowed).
- Render's free Web Service restarts (cold start) on every deploy and
  after any sleep period. `domain/agentWorkerStatus.js`'s counters reset
  on restart — that's fine, it's meant to answer "is dispatch healthy
  *right now*," not to be a durable audit log.
