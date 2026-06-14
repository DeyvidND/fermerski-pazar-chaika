// Cloudflare image-transformation URL builders. The backend stores one web-sized
// master per image in R2; the edge resizes + re-encodes (AVIF/WebP) on demand so
// grids ship a fraction of the bytes. Framing is unchanged — these only swap the
// URL; the `object-fit:cover` + coverCropStyle CSS still does the cropping.
//
// No CDN configured (PUBLIC_IMG_CDN empty) → every function falls back to the raw
// URL, so local dev and non-CDN deploys render exactly as before.
import { CDN_BASE } from './config';

// .png is skipped on purpose: legacy odd PNGs can hit CF "ERROR 9516" decode
// failures, and serving them raw keeps them working. New uploads are always WebP,
// so this only affects pre-existing PNGs (until a backfill re-encodes them).
const TRANSFORMABLE = /\.(jpe?g|webp|gif)$/i;
const MASTER_MAX = 2560; // never request larger than the stored master

/** The object key (path) from any stored URL — legacy `pub-*.r2.dev` or `cdn.`.
 *  The bucket is the same on both hosts, so the key transforms identically. */
function keyOf(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\/+/, '') || null;
  } catch {
    return null;
  }
}

function transformable(url: string | null | undefined): string | null {
  if (!url || !CDN_BASE) return null;
  const key = keyOf(url);
  return key && TRANSFORMABLE.test(key) ? key : null;
}

/** One transformed URL at `width` px. `format=auto` negotiates AVIF/WebP from the
 *  Accept header; `fit=scale-down` never upscales past the master. Falls back to
 *  the original URL when transforms don't apply. */
export function cfImage(url: string | null | undefined, width: number): string | undefined {
  const key = transformable(url);
  if (!key) return url ?? undefined;
  const w = Math.min(MASTER_MAX, Math.round(width));
  return `${CDN_BASE}/cdn-cgi/image/width=${w},format=auto,fit=scale-down/${key}`;
}

/** A `srcset` across the given CSS widths (deduped, capped at the master). Returns
 *  undefined when transforms don't apply, so the attribute is simply omitted. */
export function cfSrcset(url: string | null | undefined, widths: number[]): string | undefined {
  if (!transformable(url)) return undefined;
  const ws = [...new Set(widths.map((w) => Math.min(MASTER_MAX, Math.round(w))))].sort((a, b) => a - b);
  return ws.map((w) => `${cfImage(url, w)} ${w}w`).join(', ');
}

/** Origin to `<link rel=preconnect>` for the image CDN (null when unconfigured). */
export const IMG_ORIGIN: string | null = (() => {
  try {
    return CDN_BASE ? new URL(CDN_BASE).origin : null;
  } catch {
    return null;
  }
})();
