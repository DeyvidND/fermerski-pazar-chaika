import { defineMiddleware } from 'astro:middleware';
import { setSwrRuntime } from './lib/api';

// Security headers on every SSR response. X-Frame-Options + CSP frame-ancestors
// block clickjacking; nosniff/Referrer-Policy/HSTS are defense-in-depth. A full
// content-CSP is intentionally omitted here — it would need allowlists for the
// fonts/maps/youtube/Stripe.js/R2 hosts the shop loads, and the high-value,
// zero-breakage subset is frame-ancestors.
export const onRequest = defineMiddleware(async (ctx, next) => {
  // Wire the Cloudflare Cache API + waitUntil into the api.ts SWR layer for
  // this request. Cleared in `finally` so a Worker reuse across requests never
  // leaks one tenant's runtime into another request.
  const rt = ctx.locals.runtime;
  // Cloudflare's CacheStorage uses its own RequestInfo generic; cast to the
  // structural SwrCacheStorage interface defined in src/env.d.ts which uses
  // the standard Request/string union that api.ts needs.
  setSwrRuntime(
    rt
      ? {
          ctx: rt.ctx ?? null,
          caches: rt.caches ? (rt.caches as unknown as SwrCacheStorage) : null,
        }
      : null,
  );

  let res: Response;
  try {
    res = await next();
  } finally {
    setSwrRuntime(null);
  }

  res.headers.set('X-Frame-Options', 'DENY');
  // frame-ancestors blocks clickjacking; object-src/base-uri are zero-breakage
  // hardening (a full script-src is omitted — it would need allowlists for the
  // fonts/maps/youtube/Stripe.js/R2 hosts the shop loads).
  res.headers.set('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'none'");
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  const isEdit = ctx.url.searchParams.get('edit') !== null;
  if (isEdit) res.headers.set('Cache-Control', 'no-store');

  // Tag SSR HTML as edge-cacheable. The storefront is fully anonymous — cart +
  // session live in localStorage, never cookies — so every GET page renders
  // identically for all visitors and is safe for a shared (Cloudflare/CDN) cache.
  // Without this header the CDN won't cache HTML, so behind the Cloudflare Tunnel
  // every view does a full origin SSR render; this lets repeat views be served
  // from the edge (the in-process memo only repopulates once per s-maxage window).
  // Mirrors the backend's public policy. NOTE: needs a matching Cloudflare Cache
  // Rule (cache eligible, respect origin headers) — the header alone is inert on
  // Cloudflare's default (HTML isn't cached by extension).
  if (
    !isEdit &&
    ctx.request.method === 'GET' &&
    res.headers.get('content-type')?.includes('text/html') &&
    !res.headers.has('cache-control')
  ) {
    // /checkout bakes the farm's live payment + delivery config (card on/off, COD,
    // methods, prices) into its HTML — edge-caching it would keep showing a toggled-
    // off card (or stale prices) for the whole s-maxage+SWR window. Render it fresh.
    const dynamic = ctx.url.pathname === '/checkout' || ctx.url.pathname.startsWith('/checkout/');
    res.headers.set(
      'Cache-Control',
      dynamic
        ? 'private, no-store'
        : 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    );
  }
  return res;
});
