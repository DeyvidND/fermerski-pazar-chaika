// First-party, cookieless analytics beacon → FarmFlow /public/:slug/track.
// Best-effort: never throws, never blocks. Uses sendBeacon when available so it
// survives page unload. Browser must hit the CF-tunneled host (see config.ts
// BROWSER_BASE note) — origin-api's firewall blocks real visitor IPs.
import { TENANT_SLUG } from './config';

const RAW_BASE = (import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:3000').replace(/\/+$/, '');
const BROWSER_BASE = (import.meta.env.DEV ? RAW_BASE : 'https://api.fermeribg.com').replace(/\/+$/, '');
const TRACK_URL = `${BROWSER_BASE}/public/${TENANT_SLUG}/track`;

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
    if (navigator.sendBeacon) {
      navigator.sendBeacon(TRACK_URL, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(TRACK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
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
