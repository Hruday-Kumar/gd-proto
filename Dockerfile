# Builds apps/server (Express API + LiveKit agent worker, one process —
# see docs/engineering/PHASE1_PLAN.md §3a for why they share a container).
# Matches the Node version used in local dev (node --version → v22.x).
FROM node:22-alpine
WORKDIR /app

COPY . .
RUN npm ci

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/server/src/index.js"]
