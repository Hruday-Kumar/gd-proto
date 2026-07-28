# Builds apps/server (Express API + LiveKit agent worker, one process —
# see docs/engineering/PHASE1_PLAN.md §3a for why they share a container).
# Matches the Node version used in local dev (node --version → v22.x).
# Debian-based (glibc), not Alpine (musl): @livekit/rtc-ffi-bindings only
# ships prebuilt native bindings for linux-x64-gnu/linux-arm64-gnu, no musl
# build exists, so this image can never satisfy that dependency on Alpine.
FROM node:22-slim
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

COPY . .
RUN npm ci

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/server/src/index.js"]
