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
export const CDN_BASE = (import.meta.env.PUBLIC_IMG_CDN ?? 'https://cdn.farmsteadflow.com').replace(/\/+$/, '');

/** Base of all storefront endpoints for the configured farm. */
export const PUBLIC_BASE = `${API_BASE}/public/${TENANT_SLUG}`;

/** Optional Google Maps **browser** key (Places + Maps JS). When set, the
 *  checkout street field gets address autocomplete and a precise pin is sent
 *  with the order (the backend then skips its own billed geocode). When empty
 *  (the default), checkout uses plain inputs and the backend geocodes the typed
 *  address — i.e. exactly today's behaviour. Separate from the server-side
 *  GOOGLE_MAPS_API_KEY; this one is exposed to the browser, so restrict it by
 *  HTTP referrer in the Google Cloud console. */
export const GOOGLE_MAPS_KEY = (import.meta.env.PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();

/** FarmFlow admin panel (the @farmflow/web app) where the owner logs in to
 *  manage products, farmers, toggles and delivery. Footer links to its /login. */
export const ADMIN_URL = (import.meta.env.PUBLIC_ADMIN_URL ?? 'http://localhost:3005').replace(/\/+$/, '');
export const ADMIN_LOGIN_URL = `${ADMIN_URL}/login`;
