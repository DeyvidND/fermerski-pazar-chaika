// Fills the confirmation recap from the order stashed at checkout, then clears
// the cart (covers the Stripe return path too, where the cart wasn't cleared
// before the redirect).
import { Cart, money } from '../lib/cart';
import { ICONS } from '../lib/icons';
import { esc } from '../lib/escape';

interface StashedSplit {
  orderNumber: number | null;
  farmerName: string | null;
  total: number;
}

interface StashedCourier {
  orderId: string;
  method: 'courier';
  split: StashedSplit[];
  // items/total/slot absent for courier stash
  items?: undefined;
  total?: undefined;
  slot?: undefined;
}

interface StashedNormal {
  orderId: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  method: 'pickup' | 'address' | 'econt';
  slot: string;
  paymentMethod?: 'online' | 'cod';
}

type Stashed = StashedNormal | StashedCourier;

let recap: Stashed | null = null;
try {
  recap = JSON.parse(sessionStorage.getItem('ff_last_order') || 'null');
} catch {
  recap = null;
}

// The header keeps the static „Поръчка приета" from confirmation.astro — we no
// longer print an order number (a sequential №N would expose the shop's order count).

const recapBox = document.getElementById('recap')!;

if (recap?.method === 'courier' && Array.isArray(recap.split)) {
  // Courier path: render per-farmer split lines
  const splitLines = recap.split
    .map(
      (s) =>
        `<div style="display:flex;justify-content:space-between;gap:16px;font-size:14.5px;padding:3px 0"><span>Поръчка #${esc(String(s.orderNumber ?? ''))} · ${esc(s.farmerName ?? 'фермер')}</span><span>${money(s.total)} (наложен платеж)</span></div>`,
    )
    .join('');
  recapBox.innerHTML =
    `<div class="muted" style="font-size:14px;padding-bottom:6px">Поръчката е разделена на ${recap.split.length} пратки — всяка с наложен платеж при доставка.</div>` +
    splitLines;
  // #paid shows the grand total for courier (sum of all splits) — courier is
  // always COD (each farmer collects on delivery), never pre-paid online.
  const courierTotal = recap.split.reduce((acc, s) => acc + s.total, 0);
  document.getElementById('paid')!.textContent = money(courierTotal);
  document.getElementById('paidLabel')!.textContent = 'За плащане при доставка';
} else {
  // Normal path: render items list
  const items = recap?.items ?? [];
  if (items.length) {
    recapBox.innerHTML = items
      .map(
        (it) =>
          `<div style="display:flex;justify-content:space-between;gap:16px;font-size:14.5px;padding:3px 0"><span>${esc(it.name)} × ${it.qty}</span><span>${money(it.price * it.qty)}</span></div>`,
      )
      .join('');
    document.getElementById('paid')!.textContent = money((recap as StashedNormal).total);
    // "Платено" only holds for the online/Stripe path — наложен платеж (COD)
    // hasn't actually been paid yet, it's collected on delivery/pickup.
    document.getElementById('paidLabel')!.textContent =
      (recap as StashedNormal).paymentMethod === 'cod' ? 'За плащане при доставка' : 'Платено';
  } else {
    recapBox.innerHTML = '<div class="muted" style="font-size:14.5px">Детайлите са изпратени на имейла ти.</div>';
  }
}

// receiving block — title + address must agree with the actual method, not just
// the timing note below them (a courier/home-delivery order previously kept the
// static "Фермерски пазар · Чайка" market address from the template, contradicting
// the correct method-specific note right under it).
const recvTitle = document.getElementById('receiveTitle')!;
const recvAddr = document.getElementById('receiveAddr')!;
const recv = document.getElementById('slotNote')!;
if (recap?.method === 'courier') {
  recvTitle.textContent = 'Доставка с куриер';
  recvAddr.textContent = 'Всеки фермер изпраща своите продукти отделно.';
  recv.innerHTML = ICONS.truck + ' Плащане при доставка';
} else if (recap?.method === 'pickup') {
  recvTitle.textContent = 'Фермерски пазар · Чайка';
  recvAddr.textContent = 'бул. „Ал. Стамболийски“, Варна';
  recv.innerHTML = ICONS.truck + ' Петък · 11:00–18:00 на Чайка';
} else if (recap?.method === 'address' || recap?.method === 'econt') {
  recvTitle.textContent = recap.method === 'econt' ? 'Доставка с Еконт' : 'Доставка до твоя адрес';
  recvAddr.textContent = 'Ще се свържем по телефон, ако се наложи да уточним нещо.';
  recv.innerHTML = recap.slot
    ? ICONS.truck + ' Доставка: ' + esc(recap.slot)
    : ICONS.truck + ' Петък · 11:00–20:00 ч.';
} else {
  recvTitle.textContent = 'Поръчката е приета';
  recvAddr.textContent = 'Детайлите са изпратени на имейла ти.';
  recv.innerHTML = '';
}

// Fire the purchase conversion for whatever ad/analytics vendors the farm
// configured (targets injected by TrackingScripts.astro as window.__ffPurchase).
// Each vendor self-gates on GDPR consent: Google via Consent Mode v2 (modeled
// until granted), Meta via its consent queue (revoked until granted). `total` is
// integer euro-cents. The stash is removed below, so a reload never re-fires.
const isCourier = recap?.method === 'courier' && Array.isArray((recap as StashedCourier).split);
const normalItems = isCourier ? [] : (recap?.items ?? []);
if (recap && (isCourier || normalItems.length)) {
  const w = window as unknown as {
    __ffPurchase?: {
      ga4: string | null;
      googleAds: string | null;
      googleAdsLabel: string | null;
      metaPixel: string | null;
    };
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  };
  const t = w.__ffPurchase;
  // For courier: sum all split totals (stotinki) then convert to major units.
  // For normal: use recap.total (stotinki) converted to major units.
  const value = isCourier
    ? (recap as StashedCourier).split.reduce((acc, s) => acc + s.total, 0) / 100
    : (recap as StashedNormal).total / 100;
  if (t && typeof w.gtag === 'function') {
    if (t.ga4) {
      w.gtag('event', 'purchase', {
        transaction_id: recap.orderId,
        value,
        currency: 'EUR',
        items: normalItems.map((it) => ({
          item_name: it.name,
          quantity: it.qty,
          price: it.price / 100,
        })),
      });
    }
    // Google Ads purchase conversion needs the AW-id/label pair; the base tag
    // alone can't attribute a sale.
    if (t.googleAds && t.googleAdsLabel) {
      w.gtag('event', 'conversion', {
        send_to: `${t.googleAds}/${t.googleAdsLabel}`,
        value,
        currency: 'EUR',
        transaction_id: recap.orderId,
      });
    }
  }
  if (t && t.metaPixel && typeof w.fbq === 'function') {
    w.fbq('track', 'Purchase', { value, currency: 'EUR' });
  }
}

// analytics: purchase conversion. `recap.split[].total` is already stotinki
// (totalStotinki, stashed as-is by checkout-page.ts); the normal path's
// `recap.total` is euros (sub + shipping), so it needs *100 to reach stotinki.
try {
  if (recap) {
    const valueStotinki = isCourier
      ? (recap as StashedCourier).split.reduce((acc, s) => acc + s.total, 0)
      : Math.round(((recap as StashedNormal).total ?? 0) * 100);
    window.ffTrack?.('purchase', { orderId: recap.orderId, value: valueStotinki });
  }
} catch {
  /* analytics must never break the confirmation page */
}

Cart.set([]);
sessionStorage.removeItem('ff_last_order');
