# Deployment — Cloudflare Workers (Git integration)

The storefront (Astro SSR via `@astrojs/cloudflare`) deploys to **Cloudflare
Workers** with the **Workers Builds Git integration**: connect the repo in the CF
dashboard and CF builds + `wrangler deploy`s on every push to `main`. No VM, no
container, no GitHub Actions, no API token in the repo. See `CLOUDFLARE.md`.

## CF dashboard (one-time)
- Workers & Pages → Create → connect `DeyvidND/fermerski-pazar-chaika`.
- Production branch **`main`**; build `npm run build`; deploy `npx wrangler deploy`.

## Build variables (set in the Worker's build config, Production)
`PUBLIC_*` are Vite-inlined at build → set them BEFORE the first build; a rebuild
is needed to change them.

| Name | Value |
| --- | --- |
| `PUBLIC_API_BASE` | ФермериБГ public API base (= old `PAZAR_API_BASE`) |
| `PUBLIC_TENANT_SLUG` | the tenant served (= old `PAZAR_TENANT_SLUG`) |
| `PUBLIC_ADMIN_URL` | farmer admin URL (= old `PAZAR_ADMIN_URL`) |
| `PUBLIC_GOOGLE_MAPS_KEY` | optional browser Maps key |

> The runtime Maps key read in `checkout.astro` (`globalThis.process?.env`) may
> need `Astro.locals.runtime.env` on Workers — see `CLOUDFLARE.md` item 1.

## Deploy
Push to `main` → CF builds + deploys. Non-production branches get preview
deployments automatically.
