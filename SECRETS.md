# Deployment — secrets & variables

CI/CD pattern (mirrors `hogan-assessments-platform`): on push to `main`,
`.github/workflows/deploy.yml` builds the Docker image, pushes it to GHCR, then
triggers a Dokploy deploy webhook. Dokploy pulls the new image and redeploys.

This is the **third-party Ferma Petrovi storefront** (Astro SSR) — it points at the
**real FarmFlow public API**, not the mock demo.

## Image produced (GHCR package)

`ghcr.io/deyvidnd/fermerski-pazar-chaika:latest` (+ `:<sha>`)

GHCR auth uses the built-in `GITHUB_TOKEN` — **no secret to add** for pushing.

## GitHub → Settings → Secrets and variables → Actions

### Repository **variables** (baked into the image at build time)
| Name | Value | Notes |
| --- | --- | --- |
| `PAZAR_API_BASE` | Real FarmFlow public API base, e.g. `https://api.farmflow.example` | `import.meta.env.PUBLIC_API_BASE` |
| `PAZAR_TENANT_SLUG` | `ferma-petrovi` | tenant this storefront serves |
| `PAZAR_ADMIN_URL` | Farmer admin URL (for any admin links), e.g. `https://admin.farmflow.example` | `import.meta.env.PUBLIC_ADMIN_URL` |

> These are `PUBLIC_*` (Vite-inlined) — they are baked at **build** time, so a change
> requires a rebuild (a fresh push / `workflow_dispatch`), not just a redeploy.

### Repository **secret**
| Secret | From Dokploy app |
| --- | --- |
| `DOKPLOY_PAZAR_WEBHOOK` | the Dokploy application's Deploy webhook URL |

The deploy job skips the webhook if it isn't set, so the pipeline stays green while
you wire Dokploy up.

## Dokploy app settings
- Image: `ghcr.io/deyvidnd/fermerski-pazar-chaika:latest`
- Port: **3003** (Astro node standalone honours `PORT`/`HOST`, already set in the image).
- Private package → make it public, or add a Dokploy registry credential for `ghcr.io`
  (username `DeyvidND`, password = GitHub PAT with `read:packages`).
