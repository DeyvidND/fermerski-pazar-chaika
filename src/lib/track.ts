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
  referrer?: string;
  productId?: string;
  orderId?: string;
  value?: number; // stotinki
}

export function ffTrack(type: TrackType, data: TrackData = {}): void {
  try {
    const body = JSON.stringify({
      type,
      path: data.path ?? location.pathname,
      referrer: data.referrer ?? document.referrer ?? '',
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
