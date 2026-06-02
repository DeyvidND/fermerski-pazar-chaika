// Client-side cart store (localStorage). Item id is the product UUID, so the
// checkout can post { productId, quantity } straight to the backend. Price is
// kept in leva (float) for display; the server recomputes authoritative totals.
export interface CartItem {
  id: string;
  name: string;
  price: number; // leva
  weight?: string;
  qty: number;
}

const KEY = 'ff_cart';

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
    const found = items.find((it) => it.id === item.id);
    if (found) found.qty += qty;
    else items.push({ ...item, qty });
    this.set(items);
  },
  setQty(id: string, qty: number) {
    let items = this.get();
    if (qty <= 0) items = items.filter((it) => it.id !== id);
    else {
      const f = items.find((it) => it.id === id);
      if (f) f.qty = qty;
    }
    this.set(items);
  },
  remove(id: string) {
    this.set(this.get().filter((it) => it.id !== id));
  },
  subtotal(): number {
    return this.get().reduce((s, it) => s + it.price * it.qty, 0);
  },
};

export function money(lv: number): string {
  return lv.toFixed(2).replace('.', ',') + ' лв';
}

/** Sync every .cart-count badge in the header. */
export function updateCount() {
  const n = Cart.count();
  document.querySelectorAll<HTMLElement>('.cart-count').forEach((el) => {
    el.textContent = String(n);
    el.classList.toggle('is-zero', n === 0);
  });
}
