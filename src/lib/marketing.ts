import type { Storefront } from './types';

/** Per-vendor ID shape, same as the API's settings.marketing. */
export interface TrackingIds {
  ga4: string | null;
  googleAds: string | null;
  googleAdsLabel: string | null;
  metaPixel: string | null;
  gtm: string | null;
  tiktok: string | null;
}

// Strict per-vendor format — identical to the backend `normalizeMarketing`
// patterns. Used here as defense-in-depth: the IDs are interpolated into inline
// <script> tags, so re-validating guarantees only [A-Za-z0-9-_] reaches them even
// if a future server write-path regression let something else through.
const RE: Record<keyof TrackingIds, RegExp> = {
  ga4: /^G-[A-Z0-9]{4,15}$/i,
  googleAds: /^AW-[0-9]{6,15}$/i,
  googleAdsLabel: /^[A-Za-z0-9_-]{6,40}$/,
  metaPixel: /^[0-9]{10,20}$/,
  gtm: /^GTM-[A-Z0-9]{4,12}$/i,
  tiktok: /^[A-Z0-9]{10,40}$/i,
};

const KEYS = Object.keys(RE) as (keyof TrackingIds)[];

/** Re-validate the marketing IDs from the API before they reach a <script>. */
export function resolveTrackingIds(storefront?: Storefront | null): TrackingIds {
  const m = (storefront?.marketing ?? null) as Record<string, unknown> | null;
  const out = {} as TrackingIds;
  for (const k of KEYS) {
    const v = m?.[k];
    out[k] = typeof v === 'string' && RE[k].test(v) ? v : null;
  }
  // A lone Ads conversion label is useless without its Ads id.
  if (out.googleAdsLabel && !out.googleAds) out.googleAdsLabel = null;
  return out;
}

/** Whether any vendor that emits scripts/cookies is configured (the Ads label
 *  alone does not count — it only enriches an existing Ads tag). */
export function hasAnyTracking(ids: TrackingIds): boolean {
  return !!(ids.ga4 || ids.googleAds || ids.metaPixel || ids.gtm || ids.tiktok);
}
