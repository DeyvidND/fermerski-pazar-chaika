import { defineMiddleware } from 'astro:middleware';

// Security headers on every SSR response. X-Frame-Options + CSP frame-ancestors
// block clickjacking; nosniff/Referrer-Policy/HSTS are defense-in-depth. A full
// content-CSP is intentionally omitted here — it would need allowlists for the
// fonts/maps/youtube/Stripe.js/R2 hosts the shop loads, and the high-value,
// zero-breakage subset is frame-ancestors.
export const onRequest = defineMiddleware(async (ctx, next) => {
  const res = await next();

  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
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
