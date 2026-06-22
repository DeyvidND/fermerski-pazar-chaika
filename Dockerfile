# ФермаСвежест (Пазар Чайка) — Astro SSR (node standalone).
# PUBLIC_* are inlined at build time (Vite), so the API base is a build arg.
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG PUBLIC_API_BASE=http://localhost:3000
ARG PUBLIC_TENANT_SLUG=ferma-petrovi
ARG PUBLIC_ADMIN_URL=http://localhost:3005
# Browser Google Maps key (Places + Maps JS) for checkout address autocomplete.
# Baked at build like the other PUBLIC_* vars — the runtime-env path via Dokploy
# Compose proved unreliable in this setup. Empty default keeps autocomplete off
# (plain field, backend geocodes). It's a referrer-restricted public key, so
# baking it into the browser bundle is fine.
ARG PUBLIC_GOOGLE_MAPS_KEY=
ENV PUBLIC_API_BASE=$PUBLIC_API_BASE \
    PUBLIC_TENANT_SLUG=$PUBLIC_TENANT_SLUG \
    PUBLIC_ADMIN_URL=$PUBLIC_ADMIN_URL \
    PUBLIC_GOOGLE_MAPS_KEY=$PUBLIC_GOOGLE_MAPS_KEY
RUN npm run build

# Slim runtime: production deps + built server only.
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3003
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Drop root: run the SSR server as the unprivileged `node` user shipped by the
# base image (matches the ФермериБГ images). Copied files are world-readable, so
# read-only execution needs no extra chown.
USER node
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3003/ || exit 1
CMD ["node", "./dist/server/entry.mjs"]
