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

let recap: Stashed | null = null;
try {
  recap = JSON.parse(sessionStorage.getItem('ff_last_order') || 'null');
} catch {
  recap = null;
}

// The header keeps the static „Поръчка приета" from confirmation.astro — we no
// longer print an order number (a sequential №N would expose the shop's order count).

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

// Fire the purchase conversion for whatever ad/analytics vendors the farm
// configured (targets injected by TrackingScripts.astro as window.__ffPurchase).
// Each vendor self-gates on GDPR consent: Google via Consent Mode v2 (modeled
// until granted), Meta via its consent queue (revoked until granted). `total` is
// integer euro-cents. The stash is removed below, so a reload never re-fires.
if (recap && items.length) {
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
  const value = recap.total / 100;
  if (t && typeof w.gtag === 'function') {
    if (t.ga4) {
      w.gtag('event', 'purchase', {
        transaction_id: recap.orderId,
        value,
        currency: 'EUR',
        items: items.map((it) => ({
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

Cart.set([]);
sessionStorage.removeItem('ff_last_order');
