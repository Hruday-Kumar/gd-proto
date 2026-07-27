# Builds apps/server (Express API + LiveKit agent worker, one process —
# see docs/engineering/PHASE1_PLAN.md §3a for why they share a container).
# Matches the Node version used in local dev (node --version → v22.x).
# Debian-based (glibc), not Alpine (musl): @livekit/rtc-ffi-bindings only
# ships prebuilt native bindings for linux-x64-gnu/linux-arm64-gnu, no musl
# build exists, so this image can never satisfy that dependency on Alpine.
FROM node:22-slim
WORKDIR /app

COPY . .
RUN npm ci

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/server/src/index.js"]
