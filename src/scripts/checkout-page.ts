// Checkout: renders summary from the cart, wires the delivery-method radios.
// Four methods: market pickup, local farm delivery (with a live slot picker),
// Econt → office (nationwide, office picker), Econt → address (nationwide, door).
// Only local farm delivery uses a slot. Posts the order to the public checkout
// endpoint; redirects to Stripe when a checkoutUrl comes back, else to the
// confirmation page (cash / no-Stripe farm).
import { Cart, money } from '../lib/cart';
import { ICONS } from '../lib/icons';
import { PUBLIC_BASE } from '../lib/config';
import { esc } from '../lib/escape';
import type { Slot } from '../lib/types';
import { initAddressAutocomplete, type PickedAddress } from './address-autocomplete';
import { validateName, validateEmail, validatePhone, wireField } from '../lib/validate';

const MARKET = 'Вземане от пазара · Чайка, Варна';

const form = document.getElementById('checkoutForm') as HTMLFormElement | null;
if (!form) throw new Error('no checkout form');
const deliveryEnabled = form.dataset.delivery === '1';
// Own the validation: suppress the browser's default (English) constraint bubbles
// so our inline Bulgarian messages are the single source of truth.
form.noValidate = true;

// Contact fields — validated inline on blur/submit (see ../lib/validate).
const nameInput = form.elements.namedItem('customerName') as HTMLInputElement | null;
const phoneInput = form.elements.namedItem('customerPhone') as HTMLInputElement | null;
const emailInput = form.elements.namedItem('customerEmail') as HTMLInputElement | null;
const contactChecks = [
  wireField(nameInput, validateName),
  wireField(phoneInput, validatePhone),
  wireField(emailInput, validateEmail),
].filter(Boolean) as { check: () => boolean }[];

// Delivery fees + free-over threshold come from the farm's config, server-rendered
// onto the form as data-* (in leva). Fall back to legacy defaults. The server is
// authoritative at checkout — these drive the displayed estimate only.
const num = (v: string | undefined, def: number) => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : def;
};
const FREE_OVER = num(form.dataset.freeOver, 40); // 0 = no free-over rule
const SHIP_ADDRESS = num(form.dataset.shipAddress, 4.9); // local self-delivery
const SHIP_ECONT = num(form.dataset.shipEcont, 3.5); // Econt → office
const SHIP_ECONT_ADDRESS = num(form.dataset.shipEcontAddress, 5.9); // Econt → door

if (!Cart.get().length) location.replace('/cart');

type Method = 'pickup' | 'address' | 'econt' | 'econt_address';
let method: Method = 'pickup';
let selectedSlotId: string | null = null;
let selectedSlotLabel = '';

// Payment method, mirroring the admin panel. Default to card when the farm can
// take it, else наложен платеж (COD). The radios render only when both options
// are offered; otherwise this default is what gets sent.
const stripeEnabled = form.dataset.stripe === '1';
let pay: 'online' | 'cod' = stripeEnabled ? 'online' : 'cod';
document.querySelectorAll<HTMLElement>('[data-pay]').forEach((el) =>
  el.addEventListener('click', () => {
    pay = el.dataset.pay as 'online' | 'cod';
    document
      .querySelectorAll<HTMLElement>('[data-pay]')
      .forEach((x) => x.classList.toggle('is-active', x === el));
  }),
);

const addr = document.getElementById('addressFields') as HTMLElement;
const addrInput = document.getElementById('addressInput') as HTMLInputElement | null; // full address (Places)
const addrDetails = document.getElementById('addrDetails') as HTMLInputElement | null; // block/entrance/floor/flat
const econtFields = document.getElementById('econtOfficeFields') as HTMLElement | null;
const econtCity = document.getElementById('econtCity') as HTMLInputElement | null;
const econtOffice = document.getElementById('econtOffice') as
  | HTMLSelectElement
  | HTMLInputElement
  | null;
const slotCard = document.getElementById('slotCard') as HTMLElement | null;

const usesAddress = (m: Method) => m === 'address' || m === 'econt_address';

// Picked address from Places Autocomplete (only when a browser Maps key is set).
// When set, the order carries exact coords (deliveryLat/Lng) + structured
// city/postal and the backend skips geocoding. Null when the customer typed the
// address by hand (no pick) → the backend geocodes the text (safety net). The key
// is rendered onto the form server-side from the runtime env (Dokploy), not baked
// at build — see checkout.astro / address-autocomplete.ts.
const mapsKey = form.dataset.mapsKey || '';
let picked: PickedAddress | null = null;
let acInited = false;
function initAutocompleteOnce() {
  if (acInited || !addrInput) return;
  acInited = true;
  initAddressAutocomplete(mapsKey, addrInput, (a) => {
    picked = a;
  });
}

// Final delivery address string: the (picked or typed) address plus the optional
// block/entrance/floor/flat detail the courier needs (Places never returns it).
function composeAddress(): string {
  const v = (el: HTMLInputElement | null) => (el?.value || '').trim();
  return [v(addrInput), v(addrDetails)].filter(Boolean).join(', ');
}

function shipping(sub: number): number {
  if (method === 'pickup') return 0;
  if (FREE_OVER > 0 && sub >= FREE_OVER) return 0;
  if (method === 'econt') return SHIP_ECONT;
  if (method === 'econt_address') return SHIP_ECONT_ADDRESS;
  return SHIP_ADDRESS;
}

function renderSummary() {
  const items = Cart.get();
  const sub = Cart.subtotal();
  const ship = shipping(sub);
  const shipNote =
    method === 'econt' || method === 'econt_address' ? ' <span class="muted">(приблизително)</span>' : '';
  document.getElementById('orderLines')!.innerHTML = items
    .map(
      (it) =>
        `<div class="summary__row"><span>${esc(it.name)} <span class="muted">× ${it.qty}</span></span><span>${money(it.price * it.qty)}</span></div>`,
    )
    .join('');
  document.getElementById('orderTotals')!.innerHTML = `
    <div class="summary__row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:12px"><span>Доставка${shipNote}</span><span>${ship === 0 ? 'безплатна' : money(ship)}</span></div>
    <div class="summary__row total"><span>Общо</span><span>${money(sub + ship)}</span></div>`;
}

function setMethod(m: Method) {
  method = m;
  document.querySelectorAll<HTMLElement>('[data-method]').forEach((el) =>
    el.classList.toggle('is-active', el.dataset.method === m),
  );
  // Structured address fields: local delivery + Econt-to-door.
  addr.style.display = usesAddress(m) ? '' : 'none';
  // Load Places autocomplete lazily the first time an address method is used —
  // a pickup/Econt-office customer never triggers the Maps JS load.
  if (usesAddress(m)) initAutocompleteOnce();
  // Econt office picker: office method only.
  if (econtFields) econtFields.style.display = m === 'econt' ? '' : 'none';
  // Slot: local farm delivery only (Econt is courier-shipped). Fetch the slots
  // lazily the first time address delivery is actually chosen — a pickup/Econt
  // customer never triggers the (uncacheable, live-capacity) /slots call.
  if (slotCard) slotCard.style.display = m === 'address' ? '' : 'none';
  if (m === 'address') void loadSlots();
  renderSummary();
}

document.querySelectorAll<HTMLElement>('[data-method]').forEach((el) =>
  el.addEventListener('click', () => setMethod(el.dataset.method as Method)),
);

/* ---------- Econt office picker ---------- */
let officeTimer: ReturnType<typeof setTimeout> | null = null;
async function loadOffices(city: string) {
  if (!econtOffice) return;
  econtOffice.innerHTML = '<option value="">Зареждане…</option>';
  let offices: { code: string; name: string; city: string | null; address: string | null }[] = [];
  try {
    const res = await fetch(`${PUBLIC_BASE}/econt/offices?city=${encodeURIComponent(city)}`, {
      headers: { accept: 'application/json' },
    });
    if (res.ok) offices = await res.json();
  } catch {
    /* offline */
  }
  if (!offices.length) {
    econtOffice.innerHTML = '<option value="">Няма намерени офиси за този град</option>';
    return;
  }
  econtOffice.innerHTML =
    '<option value="">Избери офис…</option>' +
    offices
      .map((o) => `<option value="${esc(o.code)}">${esc(o.name)}${o.address ? ' — ' + esc(o.address) : ''}</option>`)
      .join('');
}
// Live office picker only in automatic mode; manual mode uses a free-text office input.
if (econtCity && form.dataset.econtMode === 'auto') {
  econtCity.addEventListener('input', () => {
    const v = econtCity.value.trim();
    if (officeTimer) clearTimeout(officeTimer);
    if (v.length < 2) return;
    officeTimer = setTimeout(() => loadOffices(v), 350);
  });
}

/* ---------- slot picker (local delivery only) ---------- */
const WD = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота'];
const MO = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек'];

let slotsLoaded = false;
async function loadSlots() {
  if (!deliveryEnabled || !slotCard || slotsLoaded) return;
  slotsLoaded = true; // memoize: one fetch per checkout view, on first address pick
  let slots: Slot[] = [];
  // Only offer slots within the next 21 days. A farm may seed slots far ahead,
  // but a months-long pill strip is noise — `to` is an inclusive upper bound.
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 21);
  const pad = (n: number) => String(n).padStart(2, '0');
  const to = `${horizon.getFullYear()}-${pad(horizon.getMonth() + 1)}-${pad(horizon.getDate())}`;
  try {
    const res = await fetch(`${PUBLIC_BASE}/slots?to=${to}`, { headers: { accept: 'application/json' } });
    if (res.ok) slots = (await res.json()) as Slot[];
  } catch {
    slotsLoaded = false; // transient failure — allow a retry on the next selection
  }

  const datePills = document.getElementById('datePills')!;
  const slotsBox = document.getElementById('slots')!;
  const step2 = document.getElementById('slotStep2');
  if (!slots.length) {
    datePills.innerHTML = '';
    if (step2) step2.style.display = 'none';
    slotsBox.innerHTML =
      '<p class="muted" style="font-size:14px">Няма свободни часове в момента — ще се свържем с теб за уговорка след поръчката.</p>';
    return;
  }
  if (step2) step2.style.display = '';

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
        return `<button type="button" class="date-pill${d === activeDate ? ' is-active' : ''}" data-date="${esc(d)}">
          <span class="m wd">${WD[dt.getDay()]}</span><span class="d">${dt.getDate()}</span><span class="m">${MO[dt.getMonth()]}</span></button>`;
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
    const buttons = list
      .map((s) => {
        return `<button type="button" class="slot" data-id="${esc(s.id)}" data-note="${esc(s.customerNote ?? '')}" data-label="${esc(s.startTime)}–${esc(s.endTime)}">${esc(s.startTime)}–${esc(s.endTime)}</button>`;
      })
      .join('');
    // Farmer's note for the day (e.g. "ще се обадя преди доставка") — same across a
    // day's slots when it comes from the recurring rule, so show it once.
    const dayNote = list.find((s) => s.customerNote)?.customerNote;
    const noteLine = dayNote
      ? `<p class="muted" style="font-size:13px;margin-top:10px">${esc(dayNote)}</p>`
      : '';
    slotsBox.innerHTML = buttons + noteLine;
    slotsBox.querySelectorAll<HTMLElement>('.slot').forEach((b) =>
      b.addEventListener('click', () => {
        slotsBox.querySelectorAll('.slot').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        selectedSlotId = b.dataset.id!;
        const dt = new Date(`${activeDate}T00:00:00`);
        selectedSlotLabel = `${dt.getDate()} ${MO[dt.getMonth()]}, ${b.dataset.label}`;
        const chosen = document.getElementById('slotChosen')!;
        chosen.style.display = 'inline-flex';
        const note = b.dataset.note ? ` · <span class="muted">${esc(b.dataset.note)}</span>` : '';
        chosen.innerHTML = ICONS.check + ` Избра: ${esc(selectedSlotLabel)}${note}`;
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

  // Validate contact fields first — run every check (so all errors show at once),
  // then focus the first invalid input.
  const results = contactChecks.map((c) => c.check());
  if (results.some((ok) => !ok)) {
    [nameInput, phoneInput, emailInput].find((el) => el?.classList.contains('is-invalid'))?.focus();
    toast?.('Провери въведените данни за контакт.');
    return;
  }

  const payload: Record<string, unknown> = {
    items: items.map((it) => ({ productId: it.id, quantity: it.qty })),
    customerName,
    customerPhone,
    customerEmail,
    paymentMethod: pay,
  };

  if (method === 'pickup') {
    payload.deliveryType = 'pickup';
    payload.deliveryAddress = MARKET;
    payload.notes = 'Вземане от пазара (Чайка)';
  } else if (method === 'address' || method === 'econt_address') {
    const street = (addrInput?.value || '').trim();
    if (!street) {
      toast?.('Въведи адрес за доставка.');
      addrInput?.focus();
      return;
    }
    // Econt routes a door label by structured city, which we only have from a
    // picked Google address. Local farm delivery has no such need — a hand-typed
    // address is geocoded by the backend.
    if (method === 'econt_address' && !picked?.city) {
      toast?.('Избери адрес от предложенията, за да определим града за Еконт.');
      addrInput?.focus();
      return;
    }
    payload.deliveryType = method;
    if (method === 'address') {
      // Local delivery: street goes to deliveryAddress (geocoded by the backend),
      // block/entrance detail goes to deliveryNote (display + route only, NEVER
      // geocoded — keeping it out of the address is the whole point).
      payload.deliveryAddress = street;
      const note = (addrDetails?.value || '').trim();
      if (note) payload.deliveryNote = note;
    } else {
      // econt_address: Econt's door label needs the full string; keep it merged.
      payload.deliveryAddress = composeAddress();
    }
    // Structured city/postal from the picked place — sharpen the backend geocode
    // (#3) for local delivery and satisfy Econt's door-label city requirement.
    if (picked?.city) payload.deliveryCity = picked.city;
    if (picked?.postal) payload.deliveryPostal = picked.postal;
    // Exact pin from the picked address — the backend then skips geocoding
    // entirely (local delivery only; the Econt methods are courier-shipped).
    if (method === 'address' && picked) {
      payload.deliveryLat = picked.lat;
      payload.deliveryLng = picked.lng;
    }
    if (method === 'address' && selectedSlotId) payload.slotId = selectedSlotId;
  } else {
    const code = (econtOffice?.value || '').trim();
    if (!code) {
      toast?.('Избери офис на Еконт.');
      econtCity?.focus();
      return;
    }
    payload.deliveryType = 'econt';
    payload.econtOffice = code;
  }

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
    // Only ever navigate to an https: payment URL. The backend returns a
    // Stripe-hosted URL, but validate the scheme at the sink so a bug/compromise
    // can't push the browser to a javascript:/data: location.
    const httpsCheckout = (() => {
      if (!out.checkoutUrl) return null;
      try {
        return new URL(out.checkoutUrl).protocol === 'https:' ? out.checkoutUrl : null;
      } catch {
        return null;
      }
    })();
    if (out.checkoutUrl && !httpsCheckout) {
      toast?.('Грешка при плащането. Опитай отново.');
      btn.disabled = false;
      btn.textContent = 'Завърши поръчката';
      return;
    }
    if (httpsCheckout) {
      window.location.href = httpsCheckout; // Stripe-hosted payment
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

// Default to the first method the farm actually offers (pickup may be hidden).
// setMethod lazily fires loadSlots() itself when that default is address delivery.
const firstMethodEl = document.querySelector('[data-method]') as HTMLElement | null;
setMethod((firstMethodEl?.dataset.method as Method) ?? 'pickup');
