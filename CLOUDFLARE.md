# Cloudflare Pages migration (WIP)

Branch `feat/cloudflare-pages` moves the storefront's deploy target from the
GHCR-image + Dokploy-container path (`@astrojs/node`) to **Cloudflare Pages**
(`@astrojs/cloudflare`, Workers SSR), deployed via **Cloudflare Pages Git
integration** (CF builds on push — no GitHub Actions, no API token). This branch
removes the old Docker/Dokploy files entirely. The `main` *branch* still carries
the live Node/Dokploy path until this branch is merged + the domain is cut over.

## Done on this branch

- `@astrojs/node` → `@astrojs/cloudflare@^12` (Astro 5 compatible).
- `astro.config.mjs` adapter swapped; `output: 'server'` kept; `platformProxy`
  on so `Astro.locals.runtime.env` works in `astro dev`.
- `wrangler.toml` — Pages output dir + `nodejs_compat` (read by the CF build).
- `.node-version` → 20 (pins the CF build runtime).
- Removed the entire old deploy: `deploy.yml`, `Dockerfile`, `docker-compose.yml`,
  `.dockerignore`, and the interim `deploy-cloudflare.yml` GH Actions workflow.
  Deploy is now **CF Pages Git integration**. `ci.yml` (PR type-check/build) kept.
- **`npm run build` is green** → `dist/_worker.js` + `dist/_routes.json` emitted
  (valid Pages SSR output). The SSR code is clean: no `node:` imports.

## Set up the Cloudflare Pages project (Git integration)

In the CF dashboard → Workers & Pages → Create → Pages → **Import an existing Git
repository** → `DeyvidND/fermerski-pazar-chaika`:

- **Project name:** `fermerski-pazar-chaika`
- **Production branch:** `feat/cloudflare-pages` *(NOT `main` yet — main still has
  the Node adapter + no wrangler.toml; switch to `main` after merge + cutover)*
- **Framework preset:** Astro (or build command `npm run build`, output dir `dist`)
- **Environment variables** (Settings → Variables, Production) — set BEFORE first
  build or it bakes `localhost` defaults:
  - `PUBLIC_API_BASE` = real ФермериБГ API base (e.g. `https://app.fermeribg.com`)
  - `PUBLIC_TENANT_SLUG` = `ferma-petrovi`
  - `PUBLIC_ADMIN_URL` = farmer admin URL
  - `PUBLIC_GOOGLE_MAPS_KEY` = optional browser Maps key

Push to the production branch → CF builds + deploys to `*.pages.dev`. No GitHub
secrets or API token needed — the Git connection authorizes CF.

## Still TODO to actually serve traffic

1. **Runtime Google Maps key** — `src/pages/checkout.astro` reads it via
   `globalThis.process?.env.PUBLIC_GOOGLE_MAPS_KEY`. On Workers that is not
   populated the Node way. Switch to `Astro.locals.runtime.env.PUBLIC_GOOGLE_MAPS_KEY`.
   (The other `PUBLIC_*` are inlined by Vite at build time — already fine.)

2. **SESSION KV binding** — the build warns the CF adapter enables Astro sessions
   expecting a `SESSION` KV namespace. The cart is client-side, so sessions are
   likely unused; if a runtime `Invalid binding SESSION` appears, create a KV
   namespace and bind it as `SESSION` in `wrangler.toml`, or disable sessions.

3. **Images / sharp** — CF has no `sharp` at runtime. Product images come from the
   R2 CDN (`CDN_BASE`), so the built-in image service should not run; if any local
   optimization breaks, set the image service to `passthrough`/`compile`.

4. **Local preview** needs wrangler: `npm i -D wrangler` (for `npm run preview` →
   `wrangler pages dev ./dist`). Not needed for CF git builds.

5. **Smoke test** home / product / cart / checkout / `?edit` token on the
   `*.pages.dev` URL, then attach the storefront's custom domain to the Pages
   project (DNS is already on Cloudflare) and retire the Dokploy container.

6. **Cutover** — after launch + verification: merge this branch to `main`, switch
   the Pages project's production branch to `main`, point the domain, decommission
   the Dokploy app.

7. **Control plane** — once proven, update the `new-storefront` skill +
   `provision.ps1` + storefront-ops PLAYBOOK to provision CF Pages projects
   (Git-connected) instead of Dokploy services for future storefronts.

## Rollback

The `main` branch still has the full Node/Dokploy path. To abandon this work:
delete this branch (and the CF Pages project). To restore the Node path on this
branch: `git checkout main -- .` then `npm i`.
