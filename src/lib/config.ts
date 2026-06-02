// Reads PUBLIC_* env once. Works on server (import.meta.env) and is inlined into
// the client bundle by Astro for the cart/checkout/form scripts.
const RAW_BASE = import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:3000';

export const API_BASE = RAW_BASE.replace(/\/+$/, '');
export const TENANT_SLUG = import.meta.env.PUBLIC_TENANT_SLUG ?? 'ferma-petrovi';

/** Base of all storefront endpoints for the configured farm. */
export const PUBLIC_BASE = `${API_BASE}/public/${TENANT_SLUG}`;

/** FarmFlow admin panel (the @farmflow/web app) where the owner logs in to
 *  manage products, farmers, toggles and delivery. Footer links to its /login. */
export const ADMIN_URL = (import.meta.env.PUBLIC_ADMIN_URL ?? 'http://localhost:3005').replace(/\/+$/, '');
export const ADMIN_LOGIN_URL = `${ADMIN_URL}/login`;
