// Pure display-price selection. The SERVER computes every price (sale prices,
// per-variant prices); this module only decides which one to SHOW and finds the
// cheapest variant. No price arithmetic, no rounding — single source for the card,
// the detail page, and the cart so they never disagree.
import type { Product, PublicProductVariant } from './types';

/** Effective unit price of a variant in stotinki — the sale price when present,
 *  otherwise the regular price. */
export function variantPriceStotinki(v: PublicProductVariant): number {
  return v.salePriceStotinki ?? v.priceStotinki;
}

/** Does this product have purchasable variants? */
export function hasVariants(p: Product): boolean {
  return Array.isArray(p.variants) && p.variants.length > 0;
}

/** The cheapest variant by effective price, or null when the product has none. */
export function cheapestVariant(p: Product): PublicProductVariant | null {
  if (!hasVariants(p)) return null;
  return p.variants!.reduce((min, v) =>
    variantPriceStotinki(v) < variantPriceStotinki(min) ? v : min,
  );
}

/** True only for a varianted product whose every variant is sold out. */
export function allVariantsSoldOut(p: Product): boolean {
  return hasVariants(p) && p.variants!.every((v) => v.soldOut);
}

export interface PriceDisplay {
  /** Big headline price (stotinki). */
  headlineStotinki: number;
  /** Struck-through original (stotinki), or null when there's nothing to compare. */
  compareStotinki: number | null;
  /** Prefix the headline with "от" (variants with more than one option). */
  fromPrefix: boolean;
}

/** Headline + optional struck-through compare price for a card/detail.
 *  Priority: variants (cheapest) → % promo (salePriceStotinki) → legacy
 *  compareAtPriceStotinki (bundles) → plain price. */
export function priceDisplay(p: Product): PriceDisplay {
  if (hasVariants(p)) {
    const cv = cheapestVariant(p)!;
    const sale = cv.salePriceStotinki ?? null;
    return {
      headlineStotinki: sale ?? cv.priceStotinki,
      compareStotinki: sale != null ? cv.priceStotinki : null,
      fromPrefix: p.variants!.length > 1,
    };
  }
  const sale = p.salePriceStotinki ?? null;
  if (sale != null) {
    return { headlineStotinki: sale, compareStotinki: p.priceStotinki, fromPrefix: false };
  }
  if (p.compareAtPriceStotinki != null) {
    return { headlineStotinki: p.priceStotinki, compareStotinki: p.compareAtPriceStotinki, fromPrefix: false };
  }
  return { headlineStotinki: p.priceStotinki, compareStotinki: null, fromPrefix: false };
}

/** Rounded % off vs. the struck-through compare price, or null when there's
 *  nothing to compare — computed from the two shown stotinki amounts (not the
 *  separate `salePercent` field, which isn't populated for every promo path:
 *  variant sales and compareAtPriceStotinki bundles never set it). Lets the
 *  customer see the savings instead of just two raw prices. */
export function discountPercent(pd: PriceDisplay): number | null {
  if (pd.compareStotinki == null || pd.compareStotinki <= 0) return null;
  const off = Math.round((1 - pd.headlineStotinki / pd.compareStotinki) * 100);
  return off > 0 ? off : null;
}
