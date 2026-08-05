# Builds apps/server (Express API + LiveKit agent worker, one process —
# see docs/engineering/PHASE1_PLAN.md §3a for why they share a container).
# Pinned to the same Node version as .nvmrc/CI (ACTION_PLAN.md Phase 3) --
# this is the actual production runtime, so unlike package.json's engines
# range (which tolerates a range of local dev machines), there's no reason
# to float it.
# Debian-based (glibc), not Alpine (musl): @livekit/rtc-ffi-bindings only
# ships prebuilt native bindings for linux-x64-gnu/linux-arm64-gnu, no musl
# build exists, so this image can never satisfy that dependency on Alpine.
FROM node:22.23.1-slim
WORKDIR /app

# node:22-slim ships without the system ca-certificates package. Node's own
# HTTPS calls don't need it (bundled root store), but @livekit/rtc-node's
# native Rust engine makes its own HTTPS requests (e.g. the region-info
# fetch before room.connect()) against the system TLS store -- without this,
# those requests fail with a generic "error sending request" on every
# attempt, in every Render region (confirmed live: identical failure in both
# Singapore and Oregon).
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# apps/web is excluded via .dockerignore: this image only ever runs
# apps/server (the frontend builds/deploys separately on Vercel, see
# ADR-0007), so its toolchain (Vite, Tailwind, oxlint, @types) never needs
# to land here. --omit=dev additionally strips apps/server's own
# devDependencies (Vitest, Supertest) -- NODE_ENV alone isn't reliably
# honored by npm ci across versions.
COPY . .
RUN npm ci --omit=dev

EXPOSE 3000
CMD ["node", "apps/server/src/index.js"]
