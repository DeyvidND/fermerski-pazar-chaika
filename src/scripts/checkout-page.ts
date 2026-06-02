// Checkout: renders summary from the cart, wires the delivery-method radios +
// (when the farm offers delivery) a live slot picker, then posts the order to
// the public checkout endpoint. Redirects to Stripe when a checkoutUrl comes
// back, otherwise to the confirmation page (cash / no-Stripe farm).
import { Cart, money } from '../lib/cart';
import { ICONS } from '../lib/icons';
import { PUBLIC_BASE } from '../lib/config';
import type { Slot } from '../lib/types';

const FREE_OVER = 40;
const SHIP_ADDRESS = 4.9;
const SHIP_ECONT = 3.5;
const MARKET = 'Вземане от пазара · Чайка, Варна';

const form = document.getElementById('checkoutForm') as HTMLFormElement | null;
if (!form) throw new Error('no checkout form');
const deliveryEnabled = form.dataset.delivery === '1';

if (!Cart.get().length) location.replace('/cart');

type Method = 'pickup' | 'address' | 'econt';
let method: Method = 'pickup';
let selectedSlotId: string | null = null;
let selectedSlotLabel = '';

const addr = document.getElementById('addressFields') as HTMLElement;
const addrInput = document.getElementById('addressInput') as HTMLInputElement | null;
const slotCard = document.getElementById('slotCard') as HTMLElement | null;

function shipping(sub: number): number {
  if (method === 'pickup') return 0;
  if (sub >= FREE_OVER) return 0;
  return method === 'econt' ? SHIP_ECONT : SHIP_ADDRESS;
}

function renderSummary() {
  const items = Cart.get();
  const sub = Cart.subtotal();
  const ship = shipping(sub);
  document.getElementById('orderLines')!.innerHTML = items
    .map(
      (it) =>
        `<div class="summary__row"><span>${it.name} <span class="muted">× ${it.qty}</span></span><span>${money(it.price * it.qty)}</span></div>`,
    )
    .join('');
  document.getElementById('orderTotals')!.innerHTML = `
    <div class="summary__row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:12px"><span>Доставка</span><span>${ship === 0 ? 'безплатна' : money(ship)}</span></div>
    <div class="summary__row total"><span>Общо</span><span>${money(sub + ship)}</span></div>`;
}

function setMethod(m: Method) {
  method = m;
  document.querySelectorAll<HTMLElement>('[data-method]').forEach((el) =>
    el.classList.toggle('is-active', el.dataset.method === m),
  );
  if (m === 'pickup') {
    addr.style.display = 'none';
    if (slotCard) slotCard.style.display = 'none';
  } else {
    addr.style.display = '';
    const office = m === 'econt';
    addr.querySelector('label')!.textContent = office ? 'Избери офис на Еконт' : 'Адрес за доставка';
    if (addrInput) addrInput.placeholder = office ? 'напр. Еконт Варна Център' : 'ул., №, град, пощенски код';
    if (slotCard) slotCard.style.display = '';
  }
  renderSummary();
}

document.querySelectorAll<HTMLElement>('[data-method]').forEach((el) =>
  el.addEventListener('click', () => setMethod(el.dataset.method as Method)),
);

/* ---------- slot picker (delivery farms only) ---------- */
const WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MO = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек'];

async function loadSlots() {
  if (!deliveryEnabled || !slotCard) return;
  let slots: Slot[] = [];
  try {
    const res = await fetch(`${PUBLIC_BASE}/slots`, { headers: { accept: 'application/json' } });
    if (res.ok) slots = (await res.json()) as Slot[];
  } catch {
    /* offline — leave empty */
  }

  const datePills = document.getElementById('datePills')!;
  const slotsBox = document.getElementById('slots')!;
  if (!slots.length) {
    datePills.innerHTML = '';
    slotsBox.innerHTML =
      '<p class="muted" style="font-size:14px">Няма свободни часове в момента — ще се свържем с теб за уговорка след поръчката.</p>';
    return;
  }

  const byDate = new Map<string, Slot[]>();
  for (const s of slots) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date)!.push(s);
  }
  const dates = [...byDate.keys()];
  let activeDate = dates[0];

  const renderPills = () => {
    datePills.innerHTML = dates
      .map((d) => {
        const dt = new Date(`${d}T00:00:00`);
        return `<button type="button" class="date-pill${d === activeDate ? ' is-active' : ''}" data-date="${d}">
          <span class="m">${WD[dt.getDay()]}</span><span class="d">${dt.getDate()}</span><span class="m">${MO[dt.getMonth()]}</span></button>`;
      })
      .join('');
    datePills.querySelectorAll<HTMLElement>('.date-pill').forEach((p) =>
      p.addEventListener('click', () => {
        activeDate = p.dataset.date!;
        selectedSlotId = null;
        document.getElementById('slotChosen')!.style.display = 'none';
        renderPills();
        renderSlots();
      }),
    );
  };

  const renderSlots = () => {
    const list = byDate.get(activeDate) || [];
    slotsBox.innerHTML = list
      .map(
        (s) =>
          `<button type="button" class="slot" data-id="${s.id}" data-label="${s.startTime}–${s.endTime}">${s.startTime}–${s.endTime}</button>`,
      )
      .join('');
    slotsBox.querySelectorAll<HTMLElement>('.slot').forEach((b) =>
      b.addEventListener('click', () => {
        slotsBox.querySelectorAll('.slot').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        selectedSlotId = b.dataset.id!;
        const dt = new Date(`${activeDate}T00:00:00`);
        selectedSlotLabel = `${dt.getDate()} ${MO[dt.getMonth()]}, ${b.dataset.label}`;
        const chosen = document.getElementById('slotChosen')!;
        chosen.style.display = 'inline-flex';
        chosen.innerHTML = ICONS.check + ` Избра: ${selectedSlotLabel}`;
      }),
    );
  };

  renderPills();
  renderSlots();
}

/* ---------- submit ---------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const items = Cart.get();
  if (!items.length) {
    location.replace('/cart');
    return;
  }
  const data = new FormData(form);
  const customerName = String(data.get('customerName') || '').trim();
  const customerPhone = String(data.get('customerPhone') || '').trim();
  const customerEmail = String(data.get('customerEmail') || '').trim();
  const toast = (window as any).FFtoast as (m: string) => void;

  const payload: Record<string, unknown> = {
    items: items.map((it) => ({ productId: it.id, quantity: it.qty })),
    customerName,
    customerPhone,
    customerEmail,
  };

  if (method === 'pickup') {
    payload.deliveryType = 'address';
    payload.deliveryAddress = MARKET;
    payload.notes = 'Вземане от пазара (Чайка)';
  } else if (method === 'address') {
    const a = (addrInput?.value || '').trim();
    if (!a) {
      toast?.('Въведи адрес за доставка.');
      addrInput?.focus();
      return;
    }
    payload.deliveryType = 'address';
    payload.deliveryAddress = a;
  } else {
    const o = (addrInput?.value || '').trim();
    if (!o) {
      toast?.('Избери офис на Еконт.');
      addrInput?.focus();
      return;
    }
    payload.deliveryType = 'econt';
    payload.econtOffice = o;
  }
  if (selectedSlotId) payload.slotId = selectedSlotId;

  const btn = document.getElementById('placeOrder') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Изпращане...';
  try {
    const res = await fetch(`${PUBLIC_BASE}/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body?.message?.message ?? body?.message) || 'Поръчката не можа да бъде приета.';
      toast?.(Array.isArray(msg) ? msg[0] : String(msg));
      btn.disabled = false;
      btn.textContent = 'Завърши поръчката';
      return;
    }
    const out = (await res.json()) as { orderId: string; checkoutUrl: string | null };
    // recap for the confirmation page
    const sub = Cart.subtotal();
    sessionStorage.setItem(
      'ff_last_order',
      JSON.stringify({
        orderId: out.orderId,
        items,
        total: sub + shipping(sub),
        method,
        slot: selectedSlotLabel,
      }),
    );
    if (out.checkoutUrl) {
      window.location.href = out.checkoutUrl; // Stripe-hosted payment
    } else {
      Cart.set([]);
      window.location.href = `/confirmation?order=${out.orderId}`;
    }
  } catch {
    toast?.('Няма връзка със сървъра. Опитай отново.');
    btn.disabled = false;
    btn.textContent = 'Завърши поръчката';
  }
});

setMethod('pickup');
loadSlots();
