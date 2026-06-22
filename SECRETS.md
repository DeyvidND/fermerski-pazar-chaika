# Deployment — Cloudflare Pages

The storefront (Astro SSR via `@astrojs/cloudflare`) deploys to **Cloudflare
Pages**. CI builds the Workers output (`dist/_worker.js`) and `wrangler` ships it.
No VM, no container, no Docker. See `CLOUDFLARE.md` for the migration status and
the full cutover checklist.

## One-time Cloudflare setup
1. Create a Pages project named **`fermerski-pazar-chaika`**.
2. Create an API token with **Pages: Edit** permission; note your **Account ID**.
3. After first deploy, attach the storefront's custom domain in the Pages project
   (DNS is already on Cloudflare).

## GitHub → Settings → Secrets and variables → Actions

### Repository **secrets**
| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token with Pages: Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |

### Repository **variables** (`PUBLIC_*` are Vite-inlined at build → rebuild to change)
| Name | Value | Maps to |
| --- | --- | --- |
| `PAZAR_API_BASE` | ФермериБГ public API base, e.g. `https://app.fermeribg.com` | `PUBLIC_API_BASE` |
| `PAZAR_TENANT_SLUG` | `ferma-petrovi` | `PUBLIC_TENANT_SLUG` |
| `PAZAR_ADMIN_URL` | farmer admin URL | `PUBLIC_ADMIN_URL` |
| `PAZAR_GOOGLE_MAPS_KEY` | optional browser Maps key | `PUBLIC_GOOGLE_MAPS_KEY` |

> The runtime Maps key read in `checkout.astro` (`globalThis.process?.env`) must
> move to `Astro.locals.runtime.env` on Workers — see `CLOUDFLARE.md` item 2.

## Deploy
- **Push to `main`** (or run the **Deploy to Cloudflare Pages** workflow manually)
  → build + `wrangler pages deploy`.
- Set the secrets + Pages project **before** merging to main, else the deploy step
  fails.
