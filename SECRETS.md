# Deployment — production (one VM via Dokploy)

The **third-party Ferma Petrovi storefront** (Astro SSR) — points at the **real
FarmFlow public API**, not the mock demo. Runs on the same VM as the other apps,
under Dokploy. CI builds the image in GitHub Actions, pushes to GHCR, and a single
webhook tells Dokploy to pull + restart. Nothing compiles on the VM. Mirrors
`hogan-assessments-platform`.

## Image (GHCR package)
`ghcr.io/deyvidnd/fermerski-pazar-chaika:latest` (+ `:<sha>`). Pushing uses
the built-in `GITHUB_TOKEN` — no secret to add.

## One-time Dokploy setup (on the VM)
1. **Settings → Registry**: add `ghcr.io` (username `DeyvidND`, PAT with `read:packages`)
   — only needed once for the whole VM.
2. **Project → Create Service → Docker Compose**: Source = Git
   `https://github.com/DeyvidND/fermerski-pazar-chaika.git`, branch `main`,
   compose path `docker-compose.yml`.
3. **Environment** tab:
   ```
   PAZAR_DOMAIN=pazar.example.com
   # optional: IMAGE_TAG=<git-sha> to pin/rollback
   ```
   Point that DNS record at the VM; Traefik issues TLS automatically.
4. **Deployments → Webhook** — copy the URL.

## GitHub → Settings → Secrets and variables → Actions

### Repository **variables** (baked into the image at build time)
| Name | Value | Notes |
| --- | --- | --- |
| `PAZAR_API_BASE` | Real FarmFlow public API base, e.g. `https://api.farmflow.example` | `PUBLIC_API_BASE` |
| `PAZAR_TENANT_SLUG` | `ferma-petrovi` | tenant served |
| `PAZAR_ADMIN_URL` | Farmer admin URL, e.g. `https://admin.farmflow.example` | `PUBLIC_ADMIN_URL` |

> `PUBLIC_*` are Vite-inlined → baked at **build**; changing them needs a rebuild
> (push / `workflow_dispatch`), not just a redeploy.

### Repository **secret**
| Name | Value |
| --- | --- |
| `DOKPLOY_PAZAR_WEBHOOK` | the Dokploy Compose app's deploy webhook URL |

The deploy job skips the webhook if unset (build + push still run).

## Notes
- **No host ports** — Traefik routes `PAZAR_DOMAIN` over `dokploy-network`. Router
  name `pazar` is unique on the VM's Traefik.
- The container listens on **:3003** (Astro node standalone, `HOST`/`PORT` set in the image).
- **The deploy fires on `main`.** The infra currently sits on branch
  `feat/media-galleries` — merge it to `main` to build + ship the package.
