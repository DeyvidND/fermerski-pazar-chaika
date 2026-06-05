// HTML-escape a value before interpolating it into innerHTML / template HTML.
// Catalog data (product names, Econt office labels, slot times) flows from the
// backend into client-built markup; escaping here stops any HTML/script stored
// in a tenant's catalog from executing in the storefront. Covers text and
// double/single-quoted attribute contexts.
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
