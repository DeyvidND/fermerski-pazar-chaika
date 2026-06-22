import type { CoverCrop } from './types';

/**
 * Cover-image framing for an `object-fit: cover` image. Returns the extra inline
 * CSS (object-position pans to the focal point; transform scales/zooms around it)
 * to append after the base `…;object-fit:cover` declaration. The image must sit in
 * an `overflow: hidden` box. Mirrors the ФермериБГ admin editor + Next storefront
 * math so the framing is identical. null/absent = centered, no zoom.
 */
const clamp = (n: number, lo: number, hi: number) =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;

export function coverCropStyle(crop?: CoverCrop | null): string {
  const x = clamp(crop?.x ?? 0.5, 0, 1);
  const y = clamp(crop?.y ?? 0.5, 0, 1);
  const zoom = clamp(crop?.zoom ?? 1, 1, 3);
  const pos = `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`;
  let s = `object-position:${pos}`;
  if (zoom > 1) s += `;transform:scale(${zoom});transform-origin:${pos}`;
  return s;
}
