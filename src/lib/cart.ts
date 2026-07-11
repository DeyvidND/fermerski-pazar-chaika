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
