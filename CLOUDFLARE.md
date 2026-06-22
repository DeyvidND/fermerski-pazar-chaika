# Cloudflare Pages migration (WIP)

Branch `feat/cloudflare-pages` moves the storefront's deploy target from the
GHCR-image + Dokploy-container path (`@astrojs/node`) to **Cloudflare Pages**
(`@astrojs/cloudflare`, Workers SSR). `main` is untouched and stays on the live
Node/Dokploy path until cutover.

## Done on this branch

- `@astrojs/node` → `@astrojs/cloudflare@^12` (Astro 5 compatible).
- `astro.config.mjs` adapter swapped; `output: 'server'` kept; `platformProxy`
  on so `Astro.locals.runtime.env` works in `astro dev`.
- `wrangler.toml` — Pages output dir + `nodejs_compat`.
- `.github/workflows/deploy-cloudflare.yml` — manual/branch-only deploy (does NOT
  fire on `main`, so the production Dokploy path is safe).
- **`npm run build` is green** → `dist/_worker.js` + `dist/_routes.json` emitted
  (valid Pages SSR output). The SSR code is clean: no `node:` imports.

## Still TODO to actually serve traffic

1. **Cloudflare project + creds**
   - Create a Pages project named `fermerski-pazar-chaika`.
   - Repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
   - Repo vars already used by the Dokploy path (reuse): `PAZAR_API_BASE`,
     `PAZAR_TENANT_SLUG`, `PAZAR_ADMIN_URL`, `PAZAR_GOOGLE_MAPS_KEY`.

2. **Runtime Google Maps key** — `src/pages/checkout.astro` reads it via
   `globalThis.process?.env.PUBLIC_GOOGLE_MAPS_KEY`. On Workers that is not
   populated the Node way. Switch to `Astro.locals.runtime.env.PUBLIC_GOOGLE_MAPS_KEY`
   (CF binding) and set it as a Pages env var. The other `PUBLIC_*` (API base,
   tenant slug, admin url) are inlined by Vite at build time — already fine.

3. **SESSION KV binding** — build warns the CF adapter enables Astro sessions
   expecting a `SESSION` KV namespace. The storefront cart is client-side, so
   sessions are likely unused; if a runtime `Invalid binding SESSION` appears,
   create a KV namespace and bind it as `SESSION` in `wrangler.toml`, or disable
   sessions in the Astro config.

4. **Images / sharp** — CF has no `sharp` at runtime. Product images come from
   the R2 CDN (`CDN_BASE`), so the built-in image service should not run; if any
   local optimization breaks, set `image: { service: { entrypoint: 'astro/assets/services/noop' } }`
   or `imageService: 'compile'`.

5. **Local preview/deploy** need wrangler: `npm i -D wrangler` (CI uses
   `cloudflare/wrangler-action`, so this is only for local `npm run preview`).

6. **Smoke test** home / product / cart / checkout / `?edit` token against a real
   `PUBLIC_API_BASE`, then point the storefront domain at the Pages project
   (DNS is already on Cloudflare) and retire the Dokploy container.

7. **Control plane** — once proven, update the `new-storefront` skill +
   `provision.ps1` + storefront-ops PLAYBOOK to provision CF Pages projects
   instead of Dokploy services for future storefronts.

## Rollback

`main` still builds and deploys the Node/Dokploy image. To abandon: delete this
branch. To revert mid-branch: `git checkout main -- astro.config.mjs package.json`
and reinstall `@astrojs/node`.
