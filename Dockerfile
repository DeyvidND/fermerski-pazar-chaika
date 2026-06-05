# ФермаСвежест (Пазар Чайка) — Astro SSR (node standalone).
# PUBLIC_* are inlined at build time (Vite), so the API base is a build arg.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG PUBLIC_API_BASE=http://localhost:3000
ARG PUBLIC_TENANT_SLUG=ferma-petrovi
ARG PUBLIC_ADMIN_URL=http://localhost:3005
ENV PUBLIC_API_BASE=$PUBLIC_API_BASE \
    PUBLIC_TENANT_SLUG=$PUBLIC_TENANT_SLUG \
    PUBLIC_ADMIN_URL=$PUBLIC_ADMIN_URL
RUN npm run build

# Slim runtime: production deps + built server only.
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3003
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3003/ || exit 1
CMD ["node", "./dist/server/entry.mjs"]
