# Cloudflare deploy (Workers, Git integration)

The storefront (Astro SSR via `@astrojs/cloudflare`) deploys to **Cloudflare
Workers** through **Workers Builds Git integration**: CF builds on push to `main`
and runs `wrangler deploy`. No VM, no container, no GitHub Actions, no API token
in the repo. Merged to `main` 2026-06-22 (replaced the old GHCR + Dokploy path).

## What's in the repo

- `@astrojs/cloudflare@^12` adapter (Astro 5 compatible); `output: 'server'`,
  `platformProxy` on so `Astro.locals.runtime.env` works in `astro dev`.
- `wrangler.toml` — Workers format: `main = ./dist/_worker.js/index.js`,
  `[assets] directory = ./dist`, `nodejs_compat`.
- `.node-version` → 20 (CF build runtime).
- `ci.yml` — PR type-check + build. The old `deploy.yml`, `Dockerfile`,
  `docker-compose.yml`, `.dockerignore` are gone.
- `npm run build` is green → `dist/_worker.js/index.js` + static `dist/`.

## Cloudflare project setup (one-time)

Workers & Pages → Create → connect repo `DeyvidND/fermerski-pazar-chaika`:
- **Production branch:** `main`
- **Build command:** `npm run build` · **Deploy:** `npx wrangler deploy`
- **Build variables** (set BEFORE first build — Vite inlines them, else it bakes
  `localhost`): `PUBLIC_API_BASE`, `PUBLIC_TENANT_SLUG`, `PUBLIC_ADMIN_URL`
  (same values as the old `PAZAR_*` repo vars), `PUBLIC_GOOGLE_MAPS_KEY` (optional).

Push to `main` → CF builds + deploys to `*.workers.dev`.

## Still TODO to fully serve the live domain

1. **Runtime Google Maps key** — `src/pages/checkout.astro` reads it via
   `globalThis.process?.env.PUBLIC_GOOGLE_MAPS_KEY`. With `nodejs_compat` this may
   resolve from the Worker's vars; if not, switch to
   `Astro.locals.runtime.env.PUBLIC_GOOGLE_MAPS_KEY`. (Other `PUBLIC_*` are
   build-time inlined — fine.)
2. **SESSION KV binding** — build warns the adapter enables Astro sessions
   expecting a `SESSION` KV namespace. Cart is client-side, so likely unused; if a
   runtime `Invalid binding SESSION` appears, bind a KV namespace as `SESSION` or
   disable sessions.
3. **Images / sharp** — no `sharp` at runtime; product images come from the R2 CDN
   (`CDN_BASE`), so fine. If local optimization breaks, set image service to
   `passthrough`/`compile`.
4. **Local preview** — `npm i -D wrangler`, then `npm run preview`.
5. **Smoke test** home / product / cart / checkout / `?edit` token on the
   `*.workers.dev` URL.
6. **Domain cutover** — attach the storefront's custom domain to the Worker (DNS
   is already on Cloudflare), then **decommission the Dokploy container** (the live
   domain is still served by it until this step).
7. **Control plane** — update the `new-storefront` skill + `provision.ps1` +
   storefront-ops PLAYBOOK to provision CF Workers (Git-connected) for future
   storefronts.

## Rollback

`main` no longer has the Node/Dokploy files. To revert: `git revert` the merge
commits, or restore the deleted files (`Dockerfile`, `docker-compose.yml`,
`deploy.yml`, `.dockerignore`) and reinstall `@astrojs/node`. The live domain is
unaffected by code changes until the DNS cutover, so there's no rush.
