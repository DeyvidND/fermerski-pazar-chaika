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

/** Companion rule (task #2). A line flagged `requiresCompanion` needs ≥1 OTHER
 *  product in the cart whose unit price ≥ `companionMinPriceStotinki` (or any
 *  other product when the threshold is null/0). Extra units of the SAME flagged
 *  product do NOT satisfy it. Returns the flagged lines that are still unsatisfied.
 *  The server enforces the same rule on /checkout — this is the pre-block UX. */
export function unsatisfiedCompanions(items: CartItem[]): CartItem[] {
  return items.filter((it) => {
    if (!it.requiresCompanion) return false;
    const minEuro = (it.companionMinPriceStotinki ?? 0) / 100;
    return !items.some((o) => o.id !== it.id && o.price >= minEuro);
  });
}

/** Bulgarian nudge for an unsatisfied companion line (task #2). */
export function companionMessage(it: CartItem): string {
  const min = it.companionMinPriceStotinki;
  if (min && min > 0) {
    const eur = (min / 100).toFixed(2).replace('.', ',') + ' €';
    return `„${it.name}“ не се продава самостоятелно — добавете още един продукт на стойност поне ${eur}.`;
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
