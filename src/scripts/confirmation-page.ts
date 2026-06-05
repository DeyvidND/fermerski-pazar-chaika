// Fills the confirmation recap from the order stashed at checkout, then clears
// the cart (covers the Stripe return path too, where the cart wasn't cleared
// before the redirect).
import { Cart, money } from '../lib/cart';
import { ICONS } from '../lib/icons';
import { esc } from '../lib/escape';

interface Stashed {
  orderId: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  method: 'pickup' | 'address' | 'econt';
  slot: string;
}

const params = new URLSearchParams(location.search);
const orderId = params.get('order');

let recap: Stashed | null = null;
try {
  recap = JSON.parse(sessionStorage.getItem('ff_last_order') || 'null');
} catch {
  recap = null;
}

const idForDisplay = (orderId || recap?.orderId || '').slice(0, 8).toUpperCase();
document.getElementById('orderNo')!.textContent = idForDisplay ? `Поръчка #FS-${idForDisplay}` : 'Поръчка приета';

const items = recap?.items ?? [];
const recapBox = document.getElementById('recap')!;
if (items.length) {
  recapBox.innerHTML = items
    .map(
      (it) =>
        `<div style="display:flex;justify-content:space-between;gap:16px;font-size:14.5px;padding:3px 0"><span>${esc(it.name)} × ${it.qty}</span><span>${money(it.price * it.qty)}</span></div>`,
    )
    .join('');
  document.getElementById('paid')!.textContent = money(recap!.total);
} else {
  recapBox.innerHTML = '<div class="muted" style="font-size:14.5px">Детайлите са изпратени на имейла ти.</div>';
}

// receiving block
const recv = document.getElementById('slotNote')!;
if (recap?.method === 'pickup') {
  recv.innerHTML = ICONS.truck + ' Петък · 11:00–18:00 на Чайка';
} else if (recap?.slot) {
  recv.innerHTML = ICONS.truck + ' Доставка: ' + esc(recap.slot);
} else {
  recv.innerHTML = ICONS.truck + ' Петък · 11:00–20:00 ч.';
}

Cart.set([]);
sessionStorage.removeItem('ff_last_order');
