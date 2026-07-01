// Reads PUBLIC_* env once. Works on server (import.meta.env) and is inlined into
// the client bundle by Astro for the cart/checkout/form scripts.
const RAW_BASE = import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:3000';

export const API_BASE = RAW_BASE.replace(/\/+$/, '');
export const TENANT_SLUG = import.meta.env.PUBLIC_TENANT_SLUG ?? 'ferma-petrovi';

/** Image CDN base for Cloudflare Transformations. Platform-wide: every tenant's
 *  objects live in one R2 bucket fronted by this domain, so the same value serves
 *  all client-factory sites — hence it's the hardcoded default rather than a per-site
 *  env var. Set PUBLIC_IMG_CDN='' (empty) to disable transforms (e.g. local dev
 *  against a stub-R2 API). See src/lib/img.ts. */
export const CDN_BASE = (import.meta.env.PUBLIC_IMG_CDN ?? 'https://cdn.fermeribg.com').replace(/\/+$/, '');

/** Base of all storefront endpoints for the configured farm. */
export const PUBLIC_BASE = `${API_BASE}/public/${TENANT_SLUG}`;

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
