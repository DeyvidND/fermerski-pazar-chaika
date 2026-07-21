// Checkout: renders summary from the cart, wires the delivery-method radios.
// Four methods: market pickup, local farm delivery (with a live slot picker),
// Econt → office (nationwide, office picker), Econt → address (nationwide, door).
// Only local farm delivery uses a slot. Posts the order to the public checkout
// endpoint; redirects to Stripe when a checkoutUrl comes back, else to the
// confirmation page (cash / no-Stripe farm).
import { Cart, money, unsatisfiedCompanions, companionMessage } from '../lib/cart';
import { ICONS } from '../lib/icons';
import { PUBLIC_BASE } from '../lib/config';
import { esc } from '../lib/escape';
import type { Slot, CheckoutResult } from '../lib/types';
import { getBootstrap } from '../lib/api';
import { initAddressAutocomplete, type PickedAddress } from './address-autocomplete';
import { validateName, validateEmail, validatePhone, wireField } from '../lib/validate';

try {
  window.ffTrack?.('checkout_start');
} catch {
  /* analytics must never break checkout */
}

const form = document.getElementById('checkoutForm') as HTMLFormElement | null;
if (!form) throw new Error('no checkout form');
const deliveryEnabled = form.dataset.delivery === '1';
// Own the validation: suppress the browser's default (English) constraint bubbles
// so our inline Bulgarian messages are the single source of truth.
form.noValidate = true;

// Mobile sticky submit bar (see main.css .co-mobilebar) — the order summary and
// submit button land dead-last once the checkout grid collapses to one column, so
// this proxies the real submit button rather than duplicating any guard logic.
document.body.classList.add('has-mobilebar');
const mobileBarBtn = document.getElementById('mobileOrderBtn') as HTMLButtonElement | null;
const mobileBarTotal = document.getElementById('mobileBarTotal');
const placeOrderBtn = document.getElementById('placeOrder') as HTMLButtonElement | null;
mobileBarBtn?.addEventListener('click', () => placeOrderBtn?.click());

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

// Real pickup label/address from the farm's config, server-rendered as data-*
// (see checkout.astro). Falls back to the label itself if no address is set.
const PICKUP_LABEL = form.dataset.pickupLabel || 'Вземане от място';
const PICKUP_ADDRESS = form.dataset.pickupAddress || PICKUP_LABEL;

if (!Cart.get().length) location.replace('/cart');

type Method = 'pickup' | 'address' | 'econt' | 'econt_address' | 'courier';
let method: Method = 'pickup';
// True once a pickup-only product (courierDisabled) or a basket is found in the
// cart — set by initCourierDisabledGate() on load. Neither can go on a courier
// waybill, so Econt/courier methods are hidden and the submit guard refuses them.
let courierDisabledBlocked = false;
let selectedSlotId: string | null = null;
let selectedSlotLabel = '';

// Payment method, mirroring the admin panel. Default to card when the farm can
// take it, else наложен платеж (COD). The radios render only when both options
// are offered; otherwise this default is what gets sent.
const stripeEnabled = form.dataset.stripe === '1';
let pay: 'online' | 'cod' = stripeEnabled ? 'online' : 'cod';
// Remembers the buyer's pre-courier choice so we can restore it when they switch
// away from courier (which forces COD).
let payBeforeCourier: 'online' | 'cod' = pay;
const payEls = Array.from(document.querySelectorAll<HTMLElement>('[data-pay]'));
const payCardEl = payEls.find((el) => el.dataset.pay === 'online') || null;
const payCodEl = payEls.find((el) => el.dataset.pay === 'cod') || null;
const payCardInput = payCardEl?.querySelector<HTMLInputElement>('input[name="paymentMethod"]') || null;
/** Reflect the active payment choice in the radio-cards (+ the native radios,
 *  so keyboard/AT state always matches the visual .is-active card). */
function syncPayUI() {
  payEls.forEach((x) => {
    x.classList.toggle('is-active', x.dataset.pay === pay);
    const input = x.querySelector<HTMLInputElement>('input[name="paymentMethod"]');
    if (input) input.checked = x.dataset.pay === pay;
  });
}
/** Select a payment method — shared by the label click handler and the native
 *  radio's change handler (arrow-key selection fires change, not click). */
function selectPayment(val: 'online' | 'cod') {
  // Courier is COD only — while it's selected the card option is disabled, so
  // this is defensive (the input itself is also `disabled` — see applyPaymentForMethod).
  if (method === 'courier' && val === 'online') return;
  pay = val;
  syncPayUI();
  // COD adds a carrier surcharge → re-price the door comparison.
  if (comparisonActive && method === 'econt_address') void loadCompare();
}
payEls.forEach((el) =>
  el.addEventListener('click', () => selectPayment(el.dataset.pay as 'online' | 'cod')),
);
document.querySelectorAll<HTMLInputElement>('input[name="paymentMethod"]').forEach((input) =>
  input.addEventListener('change', () => selectPayment(input.value as 'online' | 'cod')),
);
/** Courier is COD-only: lock the payment choice to COD and grey out the card
 *  option while courier is the method; restore the buyer's prior choice on exit. */
function applyPaymentForMethod(m: Method) {
  if (m === 'courier') {
    if (pay !== 'cod') payBeforeCourier = pay; // remember to restore later
    pay = 'cod';
    if (payCardEl) {
      payCardEl.style.opacity = '.45';
      payCardEl.style.pointerEvents = 'none';
    }
    // Also disable the native radio — pointer-events:none only blocks the mouse,
    // a keyboard/AT user could still Tab to it and select "card" during courier.
    if (payCardInput) payCardInput.disabled = true;
  } else {
    if (payCardEl) {
      payCardEl.style.opacity = '';
      payCardEl.style.pointerEvents = '';
    }
    if (payCardInput) payCardInput.disabled = false;
    // Coming back from courier → restore what the buyer had before (only if the
    // card option exists / Stripe is on; otherwise stay on COD).
    if (payCardEl || payCodEl) pay = payBeforeCourier;
  }
  syncPayUI();
}

// ---------- carrier comparison (door delivery, both carriers live) ----------
// When the farm runs Econt + Speedy, a до-адрес order can ship with either. The
// farm's policy decides: 'customer' → the buyer picks; 'cheapest' → the server
// ships the cheaper; 'econt'/'speedy' → forced. We fetch live prices from
// /shipping/compare once a city is known and render a picker (or a read-only note).
type Carrier = 'econt' | 'speedy';
type CarrierPolicy = 'customer' | 'cheapest' | 'econt' | 'speedy';
interface CarrierQuote { carrier: Carrier; priceStotinki: number | null; available: boolean }
interface CompareResult { quotes: CarrierQuote[]; cheapest: Carrier | null; policy: CarrierPolicy; selected: Carrier | null }

const comparisonActive = form.dataset.comparison === '1';
const carrierPolicy = (form.dataset.carrierPolicy as CarrierPolicy) || 'customer';
const CARRIER_NAME: Record<Carrier, string> = { econt: 'Еконт', speedy: 'Speedy' };
const carrierPickerEl = document.getElementById('carrierPicker') as HTMLElement | null;
const carrierOptionsEl = document.getElementById('carrierOptions') as HTMLElement | null;
const carrierHintEl = document.getElementById('carrierHint') as HTMLElement | null;

let compare: CompareResult | null = null;
let compareKey = ''; // the city/address + COD combo the current `compare` was priced for (avoids refetch)
let chosenCarrier: Carrier | null = null; // the buyer's pick (only in 'customer' policy)
let compareLoading = false;

/** Price in stotinki for a carrier in the current compare result (null if none). */
function carrierPrice(c: Carrier | null): number | null {
  if (!c || !compare) return null;
  return compare.quotes.find((q) => q.carrier === c)?.priceStotinki ?? null;
}

/** The carrier whose price drives the displayed door fee + the payload `carrier`.
 *  'customer' → the buyer's pick (default: the server's `selected`); other policies
 *  defer to the server's resolved `selected`. Null until a compare has loaded. */
function effectiveCarrier(): Carrier | null {
  if (!comparisonActive) return null;
  if (carrierPolicy === 'customer') return chosenCarrier ?? compare?.selected ?? null;
  return compare?.selected ?? null;
}

const eurFromStotinki = (st: number) => money(st / 100);

function renderCarrierOptions() {
  if (!carrierPickerEl || !carrierOptionsEl || !carrierHintEl) return;
  const show = method === 'econt_address' && comparisonActive;
  carrierPickerEl.style.display = show ? '' : 'none';
  if (!show) return;

  if (compareLoading) {
    carrierOptionsEl.innerHTML = '<span class="muted" style="font-size:14px">Изчисляваме цените на куриерите…</span>';
    carrierHintEl.textContent = '';
    return;
  }
  if (!compare) {
    carrierOptionsEl.innerHTML = '';
    carrierHintEl.textContent = 'Избери адрес от предложенията, за да сравним куриерите.';
    return;
  }

  const eff = effectiveCarrier();
  // 'customer' policy → interactive radio-cards. Other policies → a single
  // read-only line stating which carrier the farm ships with (+ price).
  if (carrierPolicy === 'customer') {
    carrierOptionsEl.innerHTML = compare.quotes
      .map((q) => {
        const price = q.priceStotinki != null ? `от ${eurFromStotinki(q.priceStotinki)}` : 'не е наличен';
        const disabled = !q.available ? ' style="opacity:.5;pointer-events:none"' : '';
        const active = q.carrier === eff ? ' is-active' : '';
        return `<label class="radio-card${active}" data-carrier="${q.carrier}"${disabled}>
          <span class="dot"></span>
          <span><b>${CARRIER_NAME[q.carrier]}</b><br><span class="muted" style="font-size:14px">${price}</span></span>
        </label>`;
      })
      .join('');
    carrierOptionsEl.querySelectorAll<HTMLElement>('[data-carrier]').forEach((el) =>
      el.addEventListener('click', () => {
        const c = el.dataset.carrier as Carrier;
        if (carrierPrice(c) == null) return; // unavailable
        chosenCarrier = c;
        renderCarrierOptions();
        renderSummary();
      }),
    );
    carrierHintEl.textContent = 'Избери куриер — цената се обновява в обобщението.';
  } else {
    const label = eff ? CARRIER_NAME[eff] : '—';
    const price = carrierPrice(eff);
    const priceTxt = price != null ? ` · от ${eurFromStotinki(price)}` : '';
    carrierOptionsEl.innerHTML = `<div class="radio-card is-active" style="cursor:default">
      <span class="dot"></span>
      <span><b>${label}</b><br><span class="muted" style="font-size:14px">${
        carrierPolicy === 'cheapest' ? 'Избираме най-евтиния за теб' : 'Куриер за тази ферма'
      }${priceTxt}</span></span></div>`;
    carrierHintEl.textContent = '';
  }
}

/** Fetch live carrier prices for the destination (COD-aware). Prefers a Google
 *  pick's structured city; falls back to the hand-typed address text (the backend
 *  geocodes it — same as the July-7 order-creation fix) when there's no pick, so
 *  a typed-only address still gets a live carrier picker under 'customer' policy
 *  instead of silently losing the buyer's carrier choice. Memoized per destination
 *  + payment combo so re-rendering doesn't spam the endpoint. */
async function loadCompare(): Promise<void> {
  if (!comparisonActive || method !== 'econt_address') return;
  const city = picked?.city?.trim();
  const typed = (addrInput?.value || '').trim();
  const codStotinki = pay === 'cod' ? Math.round(Cart.subtotal() * 100) : 0;

  let body: Record<string, unknown>;
  let key: string;
  if (city) {
    body = { destinationCity: city, deliveryMode: 'address', codAmountStotinki: codStotinki };
    key = `city:${city}|${codStotinki}`;
  } else if (typed && looksLikeStreetAddress(typed)) {
    body = { destinationAddress: typed, deliveryMode: 'address', codAmountStotinki: codStotinki };
    key = `addr:${typed.toLowerCase()}|${codStotinki}`;
  } else {
    return; // no pick and not a real street line yet — don't fire
  }
  if (key === compareKey && compare) return; // already priced for this destination+COD
  compareLoading = true;
  renderCarrierOptions();
  try {
    const res = await fetch(`${PUBLIC_BASE}/shipping/compare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const parsed = res.ok ? ((await res.json()) as CompareResult) : null;
    // An empty-quotes response (garbage input / geocode miss / non-comparison farm)
    // reads as "no compare" so the picker keeps its "избери адрес…" hint.
    compare = parsed && parsed.quotes.length ? parsed : null;
    compareKey = compare ? key : '';
    // Reset a stale customer pick that's no longer available in the new quote.
    if (chosenCarrier && carrierPrice(chosenCarrier) == null) chosenCarrier = null;
  } catch {
    compare = null;
    compareKey = '';
  } finally {
    compareLoading = false;
    renderCarrierOptions();
    renderSummary();
  }
}

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

const usesAddress = (m: Method) => m === 'address' || m === 'econt_address' || m === 'courier';

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
    // A real pick → structured city known, (re)price immediately. A hand-edit
    // (a === null, the lib clears `picked` on manual typing) is handled by the
    // debounced typed-address listener below instead of firing on every keystroke.
    if (a && comparisonActive && method === 'econt_address') void loadCompare();
  });
}

// Typed-address carrier compare (no Google pick): debounced so a hand-typed door
// address still gets a live carrier price/picker under 'customer' policy instead of
// silently losing the buyer's carrier choice (see loadCompare). Mirrors the existing
// Econt-office-city debounce pattern below. Fires only once the text looks like a
// real street line (looksLikeStreetAddress) — cheap client-side gate before the
// request even reaches the backend's own geocode shape-gate + 30/min throttle.
let compareAddrTimer: ReturnType<typeof setTimeout> | null = null;
addrInput?.addEventListener('input', () => {
  if (!comparisonActive) return;
  if (compareAddrTimer) clearTimeout(compareAddrTimer);
  compareAddrTimer = setTimeout(() => {
    if (picked) return; // a Google pick owns pricing for this address
    if (method !== 'econt_address') return;
    const typed = (addrInput?.value || '').trim();
    if (!looksLikeStreetAddress(typed)) return;
    void loadCompare();
  }, 350);
});

// Final delivery address string: the (picked or typed) address plus the optional
// block/entrance/floor/flat detail the courier needs (Places never returns it).
function composeAddress(): string {
  const v = (el: HTMLInputElement | null) => (el?.value || '').trim();
  return [v(addrInput), v(addrDetails)].filter(Boolean).join(', ');
}

/** Whether a hand-typed address looks like a real street line — a street name
 *  (≥3 letters after stripping digits/punctuation) plus a house/block number —
 *  rather than a bare city ("Варна") or a lone number ("5"). Used to guard typed
 *  addresses that carry no Google Places pick, across every delivery method that
 *  needs a findable door ("ул.Дунав5" without spaces still passes). */
function looksLikeStreetAddress(street: string): boolean {
  const hasNumber = /\d/.test(street);
  const hasName = street.replace(/[\s\d.,№#/\\-]/g, '').length >= 3;
  return hasNumber && hasName;
}

function shipping(sub: number): number {
  if (method === 'pickup') return 0;
  // Courier splits the cart per farmer and the server prices each farmer's
  // shipment at checkout — we can't quote a single fee here, so the estimate is
  // omitted (shown as "по куриер" in the summary note).
  if (method === 'courier') return 0;
  if (FREE_OVER > 0 && sub >= FREE_OVER) return 0;
  if (method === 'econt') return SHIP_ECONT;
  if (method === 'econt_address') {
    // Prefer the live carrier-comparison price (the carrier that will actually
    // ship) when both carriers run and a quote has loaded; else the flat estimate.
    const st = carrierPrice(effectiveCarrier());
    return st != null ? st / 100 : SHIP_ECONT_ADDRESS;
  }
  return SHIP_ADDRESS;
}

function renderSummary() {
  const items = Cart.get();
  const sub = Cart.subtotal();
  const ship = shipping(sub);
  const shipNote =
    method === 'econt' || method === 'econt_address' ? ' <span class="muted">(приблизително)</span>' : '';
  // Courier fee is per-farmer and priced by the server → don't promise "безплатна".
  const shipText = method === 'courier' ? 'по куриер (наложен платеж)' : ship === 0 ? 'безплатна' : money(ship);
  document.getElementById('orderLines')!.innerHTML = items
    .map(
      (it) =>
        `<div class="summary__row"><span>${esc(it.name)} <span class="muted">× ${it.qty}</span></span><span>${money(it.price * it.qty)}</span></div>`,
    )
    .join('');
  document.getElementById('orderTotals')!.innerHTML = `
    <div class="summary__row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:12px"><span>Доставка${shipNote}</span><span>${shipText}</span></div>
    <div class="summary__row total"><span>Общо</span><span>${money(sub + ship)}</span></div>`;
  // Euro-only, plain text — money() emits an HTML €+лв. span meant for innerHTML,
  // too wide for the fixed mobile bar at 320-375px.
  if (mobileBarTotal) mobileBarTotal.textContent = (sub + ship).toFixed(2).replace('.', ',') + ' €';
}

function setMethod(m: Method) {
  method = m;
  document.querySelectorAll<HTMLElement>('[data-method]').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.method === m);
    // Keep the native radio in sync too (setMethod can be called programmatically,
    // e.g. the courier-disabled bounce below, not just from a user radio pick).
    const input = el.querySelector<HTMLInputElement>('input[name="deliveryMethod"]');
    if (input) input.checked = el.dataset.method === m;
  });
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
  // Carrier picker: door delivery only, and only when both carriers run. Price
  // lazily the first time door is chosen if a city is already known. Courier is
  // its own door method (per-farmer split, fixed COD) — no comparison picker.
  renderCarrierOptions();
  if (m === 'econt_address') void loadCompare();
  // Courier ships per-farmer COD — force the payment choice to наложен платеж and
  // disable the card option; restore the buyer's choice when switching away.
  applyPaymentForMethod(m);
  renderSummary();
}

document.querySelectorAll<HTMLElement>('[data-method]').forEach((el) =>
  el.addEventListener('click', () => setMethod(el.dataset.method as Method)),
);
// Native radios: arrow-key navigation between options in the group checks a
// radio and fires `change` WITHOUT a `click` (so the listener above alone
// leaves keyboard selection dead) — this is the keyboard-equivalent read path.
document.querySelectorAll<HTMLInputElement>('input[name="deliveryMethod"]').forEach((input) =>
  input.addEventListener('change', () => setMethod(input.value as Method)),
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
// True once loadSlots() confirms the farm actually has open slots — distinguishes
// "slots exist, customer just didn't pick one" (block submit) from "no slots at
// all right now" (already explained inline, farmer will follow up — allowed).
let slotsAvailable = false;
async function loadSlots() {
  if (!deliveryEnabled || !slotCard || slotsLoaded) return;
  slotsLoaded = true; // memoize: one fetch per checkout view, on first address pick
  let slots: Slot[] = [];
  // Only offer slots within the next 30 days. A farm may seed slots far ahead,
  // but a months-long pill strip is noise — `to` is an inclusive upper bound.
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
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
  if (!slots.length) {
    slotsAvailable = false;
    datePills.innerHTML = '';
    slotsBox.innerHTML =
      '<p class="muted" style="font-size:14px">Няма свободни дни за доставка в момента — ще се свържем с теб за уговорка след поръчката.</p>';
    return;
  }
  slotsAvailable = true;

  const byDate = new Map<string, Slot[]>();
  for (const s of slots) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date)!.push(s);
  }
  const dates = [...byDate.keys()];
  let activeDate: string | null = null;

  // A slot is now a whole day (capacity per day, not an hour window) — a date
  // pill click *is* the selection, no separate hour step. Each date maps to
  // exactly one day-row slot (byDate.get(d)![0]); pick it straight off the pill.
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
        const s = byDate.get(activeDate)![0];
        selectedSlotId = s.id;
        const dt = new Date(`${activeDate}T00:00:00`);
        selectedSlotLabel = `${WD[dt.getDay()]}, ${dt.getDate()} ${MO[dt.getMonth()]}`;
        const chosen = document.getElementById('slotChosen')!;
        chosen.style.display = 'inline-flex';
        chosen.innerHTML = ICONS.check + ` Избра: ${esc(selectedSlotLabel)}`;
        renderPills();
        renderSlots();
      }),
    );
  };

  // Shows the selected day's farmer note + remaining capacity — no more
  // time-buttons, the day itself is the whole slot.
  const renderSlots = () => {
    if (!activeDate) {
      slotsBox.innerHTML = '';
      return;
    }
    const s = byDate.get(activeDate)![0];
    const noteLine = s.customerNote
      ? `<p class="muted" style="font-size:13px">${esc(s.customerNote)}</p>`
      : '';
    const leftLine =
      s.remaining != null
        ? `<p class="muted" style="font-size:13px;margin-top:${noteLine ? '4px' : '0'}">Остават ${esc(String(s.remaining))} ${s.remaining === 1 ? 'място' : 'места'}</p>`
        : '';
    slotsBox.innerHTML = noteLine + leftLine;
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
  const FFtoastEarly = (window as any).FFtoast as (m: string, type?: 'success' | 'error') => void;

  // Companion rule (task #2): block a "не се продава самостоятелно" product that
  // has no qualifying companion in the cart. The server rejects it with a 400 too;
  // this pre-block gives a clearer, earlier message and points the shopper back.
  const unmet = unsatisfiedCompanions(items);
  if (unmet.length) {
    FFtoastEarly?.(companionMessage(unmet[0]), 'error');
    location.assign('/cart');
    return;
  }
  const customerName = String(data.get('customerName') || '').trim();
  const customerPhone = String(data.get('customerPhone') || '').trim();
  const customerEmail = String(data.get('customerEmail') || '').trim();
  // Every toast raised from checkout is an error/validation warning, so route
  // them through the error style (red + ✕) — never the green success tick.
  const FFtoast = (window as any).FFtoast as (m: string, type?: 'success' | 'error') => void;
  const toast = (m: string) => FFtoast?.(m, 'error');

  // Pickup-only backstop: a courierDisabled product can't ship on a waybill. The
  // method cards are already hidden, but guard the POST too (the server rejects it
  // anyway — this just gives a friendly message instead of a 400).
  if (courierDisabledBlocked && (method === 'econt' || method === 'econt_address' || method === 'courier')) {
    toast?.('Някои продукти не се изпращат с куриер. Избери местна доставка или вземане от пазара.');
    return;
  }

  // Slots were on offer for local delivery and the customer skipped picking one —
  // don't let the order go out with no scheduled time. (When there are genuinely
  // no slots today, slotsAvailable stays false and the order is allowed through —
  // that path already explains "we'll follow up to arrange it".)
  if (method === 'address' && slotsAvailable && !selectedSlotId) {
    toast?.('Избери ден за доставка.');
    slotCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Validate contact fields first — run every check (so all errors show at once),
  // then focus the first invalid input.
  const results = contactChecks.map((c) => c.check());
  if (results.some((ok) => !ok)) {
    [nameInput, phoneInput, emailInput].find((el) => el?.classList.contains('is-invalid'))?.focus();
    toast?.('Провери въведените данни за контакт.');
    return;
  }

  const payload: Record<string, unknown> = {
    items: items.map((it) => ({
      productId: it.id,
      quantity: it.qty,
      ...(it.variantId ? { variantId: it.variantId } : {}),
    })),
    customerName,
    customerPhone,
    customerEmail,
    paymentMethod: pay,
  };

  if (method === 'pickup') {
    payload.deliveryType = 'pickup';
    payload.deliveryAddress = PICKUP_ADDRESS;
    payload.notes = PICKUP_LABEL;
  } else if (method === 'courier') {
    // Courier: each farmer ships their own products COD. Needs the recipient's
    // door address + structured city; no slot, no Econt office, no carrier picker.
    // Backend splits the cart per farmer. City comes from the Google pick when the
    // buyer picked one; otherwise the backend geocodes the typed address to derive
    // the settlement the carrier routes by.
    const street = composeAddress();
    const typed = (addrInput?.value || '').trim();
    if (!typed) {
      toast?.('Въведи адрес за доставка.');
      addrInput?.focus();
      return;
    }
    if (!picked && !looksLikeStreetAddress(typed)) {
      toast?.('Напиши улица, номер и град (напр. „ул. Дунав 5, Варна“).');
      addrInput?.focus();
      return;
    }
    Object.assign(payload, {
      deliveryType: 'courier',
      paymentMethod: 'cod',
      deliveryAddress: street,
    });
    if (picked?.city) payload.deliveryCity = picked.city;
    if (picked?.postal) payload.deliveryPostal = picked.postal;
  } else if (method === 'address' || method === 'econt_address') {
    const street = (addrInput?.value || '').trim();
    if (!street) {
      toast?.('Въведи адрес за доставка.');
      addrInput?.focus();
      return;
    }
    // Hand-typed address with no Google pick: guard against a bare city ("Варна")
    // or a lone number ("5"). We need a real street line to find the door (local
    // delivery) or to geocode the settlement the carrier routes by (Econt door).
    // When the buyer picked a Google suggestion we trust it and skip this check.
    if (!picked && !looksLikeStreetAddress(street)) {
      const msg =
        method === 'econt_address'
          ? 'Напиши улица, номер и град (напр. „ул. Дунав 5, Варна“).'
          : 'Напиши улица и номер, не само града (напр. „ул. Дунав 5, Варна“).';
      toast?.(msg);
      addrInput?.focus();
      return;
    }
    // Confused buyers put the real street in the block/entrance field instead of
    // Адрес (it's the field right underneath, and both look like "extra address
    // info"). That field is deliveryNote — NEVER geocoded on purpose — so the
    // order ships with no usable address. Catch the giveaway: a street keyword
    // (ул./бул./ж.к.) in there means the street belongs one field up.
    if (method === 'address') {
      const detail = (addrDetails?.value || '').trim();
      // Only unambiguous street forms flag: dotted abbreviations (ул./бул.), full
      // words (улица/булевард), or жк/ж.к. as a bounded token — so ordinary words
      // that merely contain those letters (булката, дръжка, акумулатор) never
      // false-flag a legitimate landmark note in this optional field.
      const streetInDetail = /(^|[^а-яА-ЯёЁ])(ул\.|бул\.|улица|булевард|ж\.?\s?к\.|жк)(?=[\s\d]|$)/i;
      if (detail && streetInDetail.test(detail)) {
        toast?.('Улицата пиши в полето „Адрес“ по-горе — тук е само за блок/вход/етаж.');
        addrDetails?.focus();
        return;
      }
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
    // Door order + both carriers + 'customer' policy → send the buyer's chosen
    // carrier (defaulting to the server's pre-selected/cheaper one). Other policies
    // omit it so the server resolves authoritatively (forced carrier / cheapest).
    if (method === 'econt_address' && comparisonActive && carrierPolicy === 'customer') {
      const eff = effectiveCarrier();
      if (eff) payload.carrier = eff;
    }
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
  if (mobileBarBtn) {
    mobileBarBtn.disabled = true;
    mobileBarBtn.textContent = 'Изпращане...';
  }
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
      btn.textContent = 'Поръчай сега';
      if (mobileBarBtn) {
        mobileBarBtn.disabled = false;
        mobileBarBtn.textContent = 'Поръчай';
      }
      return;
    }
    const data = (await res.json()) as CheckoutResult;
    // Courier → the backend split the cart into one COD order per farmer. Stash the
    // per-farmer breakdown for the confirmation page, clear the cart, and skip the
    // single-order / Stripe paths below (courier is COD only, no checkoutUrl).
    if (data.orders && data.orders.length) {
      sessionStorage.setItem(
        'ff_last_order',
        JSON.stringify({
          orderId: data.orderId,
          method: 'courier',
          split: data.orders.map((o) => ({
            orderNumber: o.orderNumber,
            farmerName: o.farmerName,
            total: o.totalStotinki,
          })),
        }),
      );
      Cart.set([]);
      window.location.href = `/confirmation?order=${data.orderId}`;
      return;
    }
    const out = data;
    const sub = Cart.subtotal();
    sessionStorage.setItem(
      'ff_last_order',
      JSON.stringify({
        orderId: out.orderId,
        items,
        total: sub + shipping(sub),
        method,
        slot: selectedSlotLabel,
        paymentMethod: pay,
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
      btn.textContent = 'Поръчай сега';
      if (mobileBarBtn) {
        mobileBarBtn.disabled = false;
        mobileBarBtn.textContent = 'Поръчай';
      }
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
    btn.textContent = 'Поръчай сега';
    if (mobileBarBtn) {
      mobileBarBtn.disabled = false;
      mobileBarBtn.textContent = 'Поръчай';
    }
  }
});

/* ---------- courier eligibility (Phase 2) ---------- */
// Courier is offered only when EVERY farmer represented in the cart is
// courierReady. We need the product→farmer map (cart lines carry only the
// productId) + the farmer flags, both from the cached /bootstrap payload.
async function computeCourierEligible(): Promise<boolean> {
  const cart = Cart.get();
  if (!cart.length) return false;
  try {
    const boot = await getBootstrap();
    if (!boot) return false;
    const { products, farmers } = boot;
    const productById = new Map(products.map((p) => [p.id, p]));
    const farmerById = new Map(farmers.map((f) => [f.id, f]));
    const cartFarmerIds = new Set<string>();
    for (const line of cart) {
      const fid = productById.get(line.id)?.farmerId;
      if (!fid) return false; // unknown product / no farmer → can't courier-split
      cartFarmerIds.add(fid);
    }
    return [...cartFarmerIds].every((fid) => farmerById.get(fid)?.courierReady === true);
  } catch {
    return false; // bootstrap unavailable → don't offer courier
  }
}

// Reveal the courier option when eligible; defensive — never throws out of init.
async function initCourier(): Promise<void> {
  const courierEl = document.querySelector<HTMLElement>('[data-courier]');
  if (!courierEl) return;
  let eligible = false;
  try {
    eligible = await computeCourierEligible();
  } catch {
    eligible = false;
  }
  courierEl.hidden = !eligible;
}
void initCourier();

/* ---------- farmer-as-seller: multi-seller disclosure (КЗП) ---------- */
// When the cart holds products from more than one producer, the buyer contracts with
// EACH producer separately (the platform is an intermediary, not the seller). The seller
// is stamped onto every cart line at add-time (farmerId/farmerName), so this reads the
// cart directly — no network lookup, reliable client-side. Discloses the sellers above
// the terms checkbox. Inert for single-seller carts and legacy lines without a farmer.
function initSellersNotice(): void {
  const el = document.getElementById('sellersNotice');
  if (!el) return;
  const byFarmer = new Map<string, string>();
  for (const line of Cart.get()) {
    if (line.farmerId) byFarmer.set(line.farmerId, line.farmerName || '');
  }
  if (byFarmer.size < 2) return; // single (or unknown) seller → no notice needed
  const names = [...byFarmer.values()].filter(Boolean).map((n) => esc(n));
  el.innerHTML =
    `<div style="margin-top:16px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);font-size:13px;line-height:1.55">` +
    `<b>Поръчка от ${byFarmer.size} производители.</b> ` +
    `Договорът за всеки продукт се сключва със съответния производител — пазарът е посредник (онлайн място за търговия).` +
    (names.length ? ` <span class="muted">Продавачи: ${names.join(', ')}.</span>` : '') +
    `</div>`;
  el.hidden = false;
}
initSellersNotice();

/* ---------- pickup-only gate (courierDisabled products + baskets) ---------- */
// Some products (perishable/fragile) are flagged `courierDisabled` and must never
// be couriered. Baskets (`category === 'bundle'`) are pickup/local-delivery only
// for the same reason — the backend rejects a courier checkout containing one
// (see cartCourierBlockers below) — so this must not rely solely on the courier
// kill-switch (ONLY_LOCAL_DELIVERY) staying flipped. Cart lines carry only the
// productId, so resolve both (and names, for the on-screen note) through the
// cached /bootstrap product map (same source computeCourierEligible uses).
async function cartCourierBlockers(): Promise<{ fragileNames: string[]; hasBasket: boolean }> {
  const cart = Cart.get();
  if (!cart.length) return { fragileNames: [], hasBasket: false };
  try {
    const boot = await getBootstrap();
    if (!boot) return { fragileNames: [], hasBasket: false };
    const byId = new Map(boot.products.map((p) => [p.id, p]));
    const fragileNames: string[] = [];
    let hasBasket = false;
    for (const line of cart) {
      const p = byId.get(line.id);
      if (!p) continue;
      if (p.category === 'bundle') hasBasket = true;
      else if (p.courierDisabled === true) fragileNames.push(p.name);
    }
    return { fragileNames, hasBasket };
  } catch {
    return { fragileNames: [], hasBasket: false }; // bootstrap unavailable → don't block (server still backstops)
  }
}

// When the cart holds a pickup-only product or a basket, hide every carrier
// (waybill) method — Еконт office + door (courier is already locked) — drop a
// note explaining why, and bounce the selection to a waybill-free method (local
// delivery / pickup). Defensive: never throws out of init.
async function initCourierDisabledGate(): Promise<void> {
  let fragileNames: string[] = [];
  let hasBasket = false;
  try {
    ({ fragileNames, hasBasket } = await cartCourierBlockers());
  } catch {
    fragileNames = [];
    hasBasket = false;
  }
  courierDisabledBlocked = fragileNames.length > 0 || hasBasket;
  if (!courierDisabledBlocked) return;

  const carrierMethods = ['econt', 'econt_address'];
  let hidAny = false;
  for (const m of carrierMethods) {
    const el = document.querySelector<HTMLElement>(`[data-method="${m}"]`);
    if (el) {
      el.style.display = 'none';
      hidAny = true;
    }
  }
  // Also drop the locked courier teaser so it doesn't add noise.
  const lockedCourier = document.querySelector<HTMLElement>('[data-courier-locked]');
  if (lockedCourier) lockedCourier.style.display = 'none';

  if (!hidAny) return; // farm offered no Еконт anyway → nothing to explain

  const container = document.getElementById('deliveryMethod');
  if (container && !document.getElementById('courierDisabledNote')) {
    const note = document.createElement('div');
    note.id = 'courierDisabledNote';
    note.style.cssText =
      'padding:10px 12px;border-radius:10px;background:#fdf1e3;color:#9a5b13;font-size:13.5px;line-height:1.45';
    const sentences: string[] = [];
    // Same wording the backend uses when it rejects a courier order containing
    // a basket — keeps the message consistent if the shopper had gotten past
    // this client-side gate somehow.
    if (hasBasket) {
      sentences.push('Кошниците се получават на място или с доставка от фермата, не с куриер.');
    }
    if (fragileNames.length) {
      const single = fragileNames.length === 1;
      sentences.push(
        single
          ? `„${fragileNames[0]}“ не се изпраща с куриер (чуплив или бързо разваляем).`
          : `Тези продукти не се изпращат с куриер (чупливи или бързо разваляеми): ${fragileNames.join(', ')}.`,
      );
    }
    sentences.push('Куриерската доставка е скрита — избери местна доставка или вземане от пазара.');
    note.textContent = sentences.join(' ');
    container.prepend(note);
  }

  // If a now-hidden carrier method is selected, switch to a visible one.
  if (method === 'econt' || method === 'econt_address' || method === 'courier') {
    const visible = Array.from(document.querySelectorAll<HTMLElement>('[data-method]')).find(
      (el) => el.style.display !== 'none',
    );
    if (visible?.dataset.method) setMethod(visible.dataset.method as Method);
  }
}

// Default to the first method the farm actually offers (pickup may be hidden).
// setMethod lazily fires loadSlots() itself when that default is address delivery.
const firstMethodEl = document.querySelector('[data-method]') as HTMLElement | null;
setMethod((firstMethodEl?.dataset.method as Method) ?? 'pickup');

// Run after the default method is set so the bounce (if any) lands last.
void initCourierDisabledGate();

// Soft keyboard open → hide the fixed mobile submit bar (main.css body.kb-open)
// so it never floats over the field the buyer is typing into; a shrunk visual
// viewport is the standard signal a mobile on-screen keyboard is showing.
const vv = window.visualViewport;
if (vv) {
  const onViewportResize = () => {
    const kbOpen = window.innerHeight - vv.height > 150;
    document.body.classList.toggle('kb-open', kbOpen);
  };
  vv.addEventListener('resize', onViewportResize);
  onViewportResize();
}
