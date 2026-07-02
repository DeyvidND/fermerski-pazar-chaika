// Reads PUBLIC_* env once. Works on server (import.meta.env) and is inlined into
// the client bundle by Astro for the cart/checkout/form scripts.
const RAW_BASE = import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:3000';

export const API_BASE = RAW_BASE.replace(/\/+$/, '');
export const TENANT_SLUG = import.meta.env.PUBLIC_TENANT_SLUG ?? 'ferma-petrovi';

/** Client-side fetches (cart/checkout/form scripts, run in the shopper's browser)
 *  can't reach `origin-api.fermeribg.com` — its firewall only lets Cloudflare's own
 *  egress IPs through (Worker SSR subrequests), not real visitor IPs; see
 *  infra/hetzner/README.md "Direct non-tunnel API origin". Browser code must go
 *  through the public CF-tunneled host instead. Hardcoded platform-wide (same
 *  reasoning as CDN_BASE below) — no per-site env var to keep in sync. In local dev
 *  PUBLIC_API_BASE already points at localhost, so reuse that instead of prod. */
const BROWSER_BASE = (import.meta.env.DEV ? RAW_BASE : 'https://api.fermeribg.com').replace(/\/+$/, '');

/** Image CDN base for Cloudflare Transformations. Platform-wide: every tenant's
 *  objects live in one R2 bucket fronted by this domain, so the same value serves
 *  all client-factory sites — hence it's the hardcoded default rather than a per-site
 *  env var. Set PUBLIC_IMG_CDN='' (empty) to disable transforms (e.g. local dev
 *  against a stub-R2 API). See src/lib/img.ts. */
export const CDN_BASE = (import.meta.env.PUBLIC_IMG_CDN ?? 'https://cdn.fermeribg.com').replace(/\/+$/, '');

/** Base of all storefront endpoints for the configured farm. This module is
 *  evaluated separately in the SSR bundle and the client bundle, so the runtime
 *  check below picks the reachable host for wherever the code actually runs. */
export const PUBLIC_BASE = `${typeof window === 'undefined' ? API_BASE : BROWSER_BASE}/public/${TENANT_SLUG}`;

/** Public canonical origin of THIS storefront (the customer-facing domain), used
 *  for <link rel="canonical">, og:url and the sitemap. Fixed per site so the
 *  Workers preview host (…workers.dev / …fermeribg.com) doesn't compete with the
 *  real domain as duplicate content in Google. Override per client via env. */
export const SITE_URL = (import.meta.env.PUBLIC_SITE_URL ?? 'https://farmmarket.bg').replace(/\/+$/, '');

// NOTE: the browser Google Maps key (PUBLIC_GOOGLE_MAPS_KEY) is intentionally
// NOT read here. It is consumed at REQUEST time in checkout.astro from the
// container runtime env (Dokploy), then rendered onto the form — see that file.
// A build-time import.meta.env constant would miss it, since the prod image is
// built in CI (GH Actions) before Dokploy supplies the runtime env.

/** ФермериБГ admin panel (the @fermeribg/web app) where the owner logs in to
 *  manage products, farmers, toggles and delivery. Footer links to its /login. */
export const ADMIN_URL = (import.meta.env.PUBLIC_ADMIN_URL ?? 'http://localhost:3005').replace(/\/+$/, '');
export const ADMIN_LOGIN_URL = `${ADMIN_URL}/login`;

/** TEMP (2026-06-30): courier carrier delivery (Еконт/Спиди) is broken storefront-
 *  wide + there's no Maps key for the checkout address autocomplete, so it's
 *  disabled everywhere until fixed. Single source of truth: checkout.astro locks
 *  the courier method behind this, and every courier badge/filter chip
 *  (ProductCard, shop.astro, product/[slug].astro) must gate on it too — otherwise
 *  a product card can promise courier shipping that checkout won't actually offer.
 *  Flip to false (and/or remove) once courier is back. */
export const ONLY_LOCAL_DELIVERY = true;
