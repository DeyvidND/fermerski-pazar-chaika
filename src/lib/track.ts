// First-party, cookieless analytics beacon → FarmFlow /public/:slug/track.
// Best-effort: never throws, never blocks. Cookieless ⇒ intentionally NOT gated
// by ConsentBanner/ffGrantConsent (no cross-site identifier, no Set-Cookie —
// unlike GA4/Meta/TikTok).
// PUBLIC_BASE already resolves to the CF-tunneled host in the browser (see
// config.ts BROWSER_BASE note) — origin-api's firewall blocks real visitor IPs.
//
// Deliberately NOT using navigator.sendBeacon: it sends the request in `no-cors`
// mode, and Cloudflare's edge in front of api.fermeribg.com 503s every no-cors
// POST to this path (confirmed live 2026-07-03 — cors-mode fetch() to the exact
// same endpoint succeeds every time, no-cors fetch()/sendBeacon fails every
// time). `fetch(..., { keepalive: true })` gets the same "survives page unload"
// guarantee while staying in `cors` mode, which the edge actually allows through.
import { PUBLIC_BASE } from './config';

const TRACK_URL = `${PUBLIC_BASE}/track`;

export type TrackType =
  | 'page_view' | 'product_view' | 'add_to_cart' | 'checkout_start' | 'purchase';

export interface TrackData {
  path?: string;
  /** Human label for this page (e.g. "Продукт", "Фермери") — set by the page
   *  itself via <Layout pageLabel="...">. Lets the panel's "Топ страници"
   *  group/label pages without FarmFlow hardcoding this storefront's route
   *  shape server-side. */
  pageLabel?: string;
  referrer?: string;
  productId?: string;
  orderId?: string;
  value?: number; // stotinki
}

/** Same-host document.referrer means internal page-to-page navigation, not a
 *  real traffic source — sending it as-is makes the storefront's own domain
 *  show up as its own top "source" (confirmed live 2026-07-03). Domain-
 *  agnostic: compares against location.host, never a hardcoded domain/slug,
 *  so it works for any storefront on any custom domain. Unparseable/empty
 *  referrer is treated as "no referrer" (direct). */
function externalReferrer(explicit?: string): string {
  const ref = explicit ?? document.referrer ?? '';
  if (!ref) return '';
  try {
    return new URL(ref).host === location.host ? '' : ref;
  } catch {
    return '';
  }
}

export function ffTrack(type: TrackType, data: TrackData = {}): void {
  try {
    const body = JSON.stringify({
      type,
      path: data.path ?? location.pathname,
      pageLabel: data.pageLabel,
      referrer: externalReferrer(data.referrer),
      productId: data.productId,
      orderId: data.orderId,
      value: data.value,
    });
    fetch(TRACK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    /* analytics must never break the storefront */
  }
}

// Expose for inline call sites (confirmation/checkout scripts) + fire the page view.
declare global {
  interface Window { ffTrack?: typeof ffTrack }
}
if (typeof window !== 'undefined') {
  window.ffTrack = ffTrack;
}
