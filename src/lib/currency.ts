// Bulgaria requires dual EUR/BGN pricing during the euro-transition period.
// Fixed official rate — never changes (BGN is currency-board pegged to EUR).
export const EUR_TO_BGN = 1.95583;

/** Format a euro amount as a plain BGN string, e.g. 6.50 -> "12,71 лв." */
export function formatBgn(eur: number): string {
  return (eur * EUR_TO_BGN).toFixed(2).replace('.', ',') + ' лв.';
}

/** Plain-text BGN suffix for contexts where HTML tags aren't rendered (Astro text nodes, plain strings). */
export function bgnText(eur: number): string {
  return ` (${formatBgn(eur)})`;
}

/** HTML BGN suffix (muted, smaller) for contexts rendered via innerHTML or set:html. */
export function bgnHtml(eur: number): string {
  return ` <span class="price-bgn">(${formatBgn(eur)})</span>`;
}
