# Deployment — Cloudflare Pages (Git integration)

The storefront (Astro SSR via `@astrojs/cloudflare`) deploys to **Cloudflare
Pages** with the **Git integration**: connect the repo in the CF dashboard and CF
builds + deploys on every push to the production branch. No VM, no container, no
GitHub Actions, no API token. See `CLOUDFLARE.md` for full setup + cutover.

## CF dashboard (one-time)
- Workers & Pages → Create → Pages → **Import an existing Git repository** →
  `DeyvidND/fermerski-pazar-chaika`.
- Project name `fermerski-pazar-chaika`; framework preset **Astro**
  (build `npm run build`, output `dist`).
- Production branch: **`feat/cloudflare-pages`** for now (switch to `main` after
  cutover — main still has the Node adapter).

## Environment variables (CF project → Settings → Variables, Production)
`PUBLIC_*` are Vite-inlined at build → set them in CF BEFORE the first build, and
a rebuild is needed to change them.

| Name | Value |
| --- | --- |
| `PUBLIC_API_BASE` | ФермериБГ public API base, e.g. `https://app.fermeribg.com` |
| `PUBLIC_TENANT_SLUG` | `ferma-petrovi` |
| `PUBLIC_ADMIN_URL` | farmer admin URL |
| `PUBLIC_GOOGLE_MAPS_KEY` | optional browser Maps key |

> The runtime Maps key read in `checkout.astro` (`globalThis.process?.env`) must
> move to `Astro.locals.runtime.env` on Workers — see `CLOUDFLARE.md` item 1.

## Deploy
Push to the production branch → CF builds + deploys. Preview branches get their
own `*.pages.dev` URLs automatically.
