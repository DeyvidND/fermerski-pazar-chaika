// Client-side cart store (localStorage). Item id is the product UUID, so the
// checkout can post { productId, quantity } straight to the backend. Price is
// kept in euro (float) for display; the server recomputes authoritative totals.
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
  return lv.toFixed(2).replace('.', ',') + ' €';
}

/** Sync every .cart-count badge in the header. */
export function updateCount() {
  const n = Cart.count();
  document.querySelectorAll<HTMLElement>('.cart-count').forEach((el) => {
    el.textContent = String(n);
    el.classList.toggle('is-zero', n === 0);
  });
}
