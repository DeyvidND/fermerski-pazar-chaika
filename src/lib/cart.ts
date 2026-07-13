// Client-side cart store (localStorage). Item id is the product UUID, so the
// checkout can post { productId, quantity } straight to the backend. Price is
// kept in euro (float) for display; the server recomputes authoritative totals.
import { bgnHtml } from './currency';
export interface CartItem {
  id: string;
  name: string;
  price: number; // euro
  weight?: string;
  qty: number;
  /** Chosen variant (вид/грамаж). Absent = a plain single-price product. */
  variantId?: string;
  variantLabel?: string;
  /** Farmer-as-seller: which producer sells this line. Captured at add-time from the
   *  product's data attributes so the checkout can disclose multi-seller orders (each
   *  producer is the seller) without a network lookup. Absent on legacy cart lines. */
  farmerId?: string;
  farmerName?: string;
  /** Companion rule (task #2), captured at add-time from the product data. When
   *  set, this line can't be ordered alone — see `unsatisfiedCompanions`. */
  requiresCompanion?: boolean;
  /** EUR-cents threshold for the required companion; null/absent = any other product. */
  companionMinPriceStotinki?: number | null;
}

const KEY = 'ff_cart';

/** Stable identity of a cart line. Same product in two variants = two lines. */
export function lineKey(it: { id: string; variantId?: string }): string {
  return it.variantId ? `${it.id}::${it.variantId}` : it.id;
}

export const Cart = {
  get(): CartItem[] {
    try {
      return (JSON.parse(localStorage.getItem(KEY) || '[]') as CartItem[]) || [];
    } catch {
      return [];
    }
  },
  set(items: CartItem[]) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateCount();
  },
  count(): number {
    return this.get().reduce((n, it) => n + it.qty, 0);
  },
  add(item: Omit<CartItem, 'qty'>, qty: number) {
    const items = this.get();
    const key = lineKey(item);
    const found = items.find((it) => lineKey(it) === key);
    if (found) found.qty += qty;
    else items.push({ ...item, qty });
    this.set(items);
    // analytics: fire-and-forget; guarded so a missing tracker is harmless
    try {
      window.ffTrack?.('add_to_cart', { productId: item.id, value: Math.round(item.price * qty * 100) });
    } catch {
      /* analytics must never break the cart */
    }
  },
  setQty(key: string, qty: number) {
    let items = this.get();
    if (qty <= 0) items = items.filter((it) => lineKey(it) !== key);
    else {
      const f = items.find((it) => lineKey(it) === key);
      if (f) f.qty = qty;
    }
    this.set(items);
  },
  remove(key: string) {
    this.set(this.get().filter((it) => lineKey(it) !== key));
  },
  subtotal(): number {
    return this.get().reduce((s, it) => s + it.price * it.qty, 0);
  },
};

export function money(lv: number): string {
  return lv.toFixed(2).replace('.', ',') + ' €' + bgnHtml(lv);
}

/** Companion rule (task #2, loss-leader). A line flagged `requiresCompanion`
 *  needs the OTHER products in the cart to TOTAL ≥ `companionMinPriceStotinki`
 *  (sum of price × qty over every different-product line — a basket of cheaper
 *  goods qualifies, not only one expensive item). When the threshold is null/0,
 *  any one other product suffices. Extra units of the SAME flagged product do NOT
 *  count. Returns the flagged lines still unsatisfied. The server enforces the
 *  same rule on /checkout — this is the pre-block UX. */
/** Sum of the OTHER cart lines (different product id) in integer stotinki. Rounds
 *  each line's euro price to cents before summing, so a basket that exactly meets
 *  the threshold can never be lost to float drift (e.g. 0,01+4,02+0,47 summing to
 *  4.4999999… < 4.5 in float euros). Matches the server, which compares in stotinki. */
function otherProductsStotinki(items: CartItem[], excludeId: string): number {
  return items
    .filter((o) => o.id !== excludeId)
    .reduce((s, o) => s + Math.round(o.price * 100) * o.qty, 0);
}

export function unsatisfiedCompanions(items: CartItem[]): CartItem[] {
  return items.filter((it) => {
    if (!it.requiresCompanion) return false;
    const min = it.companionMinPriceStotinki ?? 0;
    if (min > 0) return otherProductsStotinki(items, it.id) < min;
    return items.filter((o) => o.id !== it.id).length === 0;
  });
}

/** Can a `requiresCompanion` product be added right now? True when the cart
 *  already holds OTHER products (different id) totalling ≥ the threshold (or, with
 *  no threshold, at least one other product). Used to lock/unlock the add button
 *  before the product is even in the cart — the same rule as `unsatisfiedCompanions`
 *  but keyed by product id instead of an existing cart line. */
export function companionSatisfied(
  productId: string,
  minStotinki: number | null | undefined,
  items: CartItem[] = Cart.get(),
): boolean {
  const min = minStotinki ?? 0;
  if (min > 0) return otherProductsStotinki(items, productId) >= min;
  return items.filter((o) => o.id !== productId).length > 0;
}

/** Euro amount still needed before a companion product unlocks (0 when satisfied
 *  or no threshold). For the lock label. */
export function companionShortfall(
  productId: string,
  minStotinki: number | null | undefined,
  items: CartItem[] = Cart.get(),
): number {
  const min = minStotinki ?? 0;
  if (min <= 0) return 0;
  return Math.max(0, min - otherProductsStotinki(items, productId)) / 100;
}

/** Bulgarian nudge for an unsatisfied companion line (task #2). */
export function companionMessage(it: CartItem): string {
  const min = it.companionMinPriceStotinki;
  if (min && min > 0) {
    const eur = (min / 100).toFixed(2).replace('.', ',') + ' €';
    return `„${it.name}“ не се продава самостоятелно — добавете други продукти на обща стойност поне ${eur}.`;
  }
  return `„${it.name}“ не се продава самостоятелно — добавете още един продукт по избор.`;
}

/** Sync every .cart-count badge in the header. */
export function updateCount() {
  const n = Cart.count();
  document.querySelectorAll<HTMLElement>('.cart-count').forEach((el) => {
    // Write the number to the inner .cart-count__n span (not the badge itself)
    // so a plain el.textContent write can't clobber other markup in the badge.
    const numEl = el.querySelector<HTMLElement>('.cart-count__n');
    if (numEl) numEl.textContent = String(n);
    else el.textContent = String(n);
    el.classList.toggle('is-zero', n === 0);
    // The link carries a static aria-label ("Количка"), which — per the
    // accessible-name computation — overrides any visible/sr-only descendant
    // text, so the item count has to be folded into the label itself here to
    // actually be announced ("Количка, 3 продукта" vs. silently "Количка").
    const link = el.closest<HTMLElement>('.cart-btn');
    if (link) link.setAttribute('aria-label', n > 0 ? `Количка, ${n} продукта` : 'Количка');
  });
  window.dispatchEvent(new CustomEvent('cart:changed'));
}
