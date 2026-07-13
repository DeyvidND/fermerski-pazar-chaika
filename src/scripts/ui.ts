// Global storefront interactivity, loaded on every page via Layout.astro.
// Mirrors the prototype's app.js (minus the now-SSR chrome + the demo theme
// switcher / module toggle): cart badge, promo close, mobile drawer, qty
// steppers, add-to-cart + toast, FAQ accordion, category tabs.
import { Cart, updateCount, companionSatisfied, companionShortfall } from '../lib/cart';
import { ICONS } from '../lib/icons';
import { esc } from '../lib/escape';

function promo() {
  const bar = document.getElementById('promo');
  const close = document.getElementById('promoClose');
  if (!bar) return;
  if (localStorage.getItem('ff_promo_closed') === '1') bar.classList.add('hide');
  close?.addEventListener('click', () => {
    bar.classList.add('hide');
    localStorage.setItem('ff_promo_closed', '1');
  });
}

function drawer() {
  const d = document.getElementById('drawer');
  const back = document.getElementById('drawerBackdrop');
  const hamburger = document.getElementById('hamburger');
  const closeBtn = document.getElementById('drawerClose') as HTMLElement | null;
  const open = () => {
    d?.classList.add('open');
    back?.classList.add('open');
    document.body.style.overflow = 'hidden';
    // The drawer starts aria-hidden + inert (see Header.astro) so AT never
    // announces, and Tab never reaches, the off-screen nav links — flip both
    // (and the toggle button's state) open.
    d?.removeAttribute('aria-hidden');
    if (d) (d as HTMLElement & { inert: boolean }).inert = false;
    hamburger?.setAttribute('aria-expanded', 'true');
    closeBtn?.focus();
  };
  const shut = () => {
    d?.classList.remove('open');
    back?.classList.remove('open');
    document.body.style.overflow = '';
    d?.setAttribute('aria-hidden', 'true');
    if (d) (d as HTMLElement & { inert: boolean }).inert = true;
    hamburger?.setAttribute('aria-expanded', 'false');
    // Return focus to the control that opened the drawer — otherwise focus is
    // left on (or inside) a now-hidden aside, stranding keyboard/AT users.
    hamburger?.focus();
  };
  hamburger?.addEventListener('click', open);
  closeBtn?.addEventListener('click', shut);
  back?.addEventListener('click', shut);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && d?.classList.contains('open')) shut();
  });
}

function steppers() {
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.stepper button');
    if (!btn) return;
    const input = btn.parentElement!.querySelector('input') as HTMLInputElement;
    let v = parseInt(input.value, 10) || 1;
    v += btn.dataset.dir === 'up' ? 1 : -1;
    const min = parseInt(input.min, 10) || 1;
    if (v < min) v = min;
    input.value = String(v);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

let toastTimer: ReturnType<typeof setTimeout>;
// A toast is either a success (green + ✓) or an error (red + ✕). Errors used to
// share the success styling, so a failed checkout / validation message showed up
// as a big green "done" tick — the opposite of what happened. The element is
// reused across calls, so background + icon are re-set every call (not just at
// creation), otherwise the first toast's colour would stick for later ones.
function toast(msg: string, type: 'success' | 'error' = 'success') {
  let t = document.getElementById('ff-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ff-toast';
    // role="alert" (implicit aria-live="assertive") so screen readers announce
    // the message the moment it's set — errors here are validation failures
    // that block checkout, so they must not go silently unheard.
    t.setAttribute('role', 'alert');
    t.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);color:#fff;padding:14px 22px;border-radius:14px;font-weight:600;font-size:15px;line-height:1.4;text-align:left;z-index:90;box-shadow:0 16px 40px -10px rgba(0,0,0,.35);opacity:0;transition:opacity .25s,transform .25s;display:flex;gap:10px;align-items:center;max-width:min(92vw,440px)';
    document.body.appendChild(t);
  }
  const isErr = type === 'error';
  t.style.background = isErr ? '#c0392b' : 'var(--primary)';
  t.innerHTML = (isErr ? ICONS.close : ICONS.check) + '<span>' + esc(msg) + '</span>';
  // The raw ICONS svg has a viewBox but no width/height, so in the flex toast it
  // balloons to fill the row. Pin it small.
  const ic = t.querySelector('svg');
  if (ic) {
    ic.setAttribute('width', '20');
    ic.setAttribute('height', '20');
    ic.style.flexShrink = '0';
  }
  requestAnimationFrame(() => {
    t!.style.opacity = '1';
    t!.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t!.style.opacity = '0';
    t!.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2400);
}
(window as any).FFtoast = toast;

function pulseCart() {
  document.querySelectorAll('.cart-count').forEach((el) => {
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }, { transform: 'scale(1)' }],
      { duration: 350 },
    );
  });
}

/** Format euros for a lock label: „4,50 €". */
function euros(lv: number): string {
  return lv.toFixed(2).replace('.', ',') + ' €';
}

/**
 * Companion lock (task #2, loss-leader): a `requiresCompanion` add button stays
 * disabled with an explanatory label until the cart already holds OTHER products
 * totalling ≥ its threshold. Re-evaluated on load and on every cart change, so it
 * unlocks the instant the basket qualifies. The cart/checkout pre-block + server
 * are the backstops; this makes the reason visible right on the product.
 */
function refreshCompanionLocks() {
  document
    .querySelectorAll<HTMLButtonElement>('[data-add-cart][data-requires-companion="1"]')
    .forEach((btn) => {
      // A button that arrived already disabled (sold out) is locked for another
      // reason — record it once and never manage it, so we can't un-sell-out it.
      if (btn.dataset.companionManaged == null) {
        btn.dataset.companionManaged = btn.disabled ? 'skip' : '1';
      }
      if (btn.dataset.companionManaged === 'skip') return;
      const id = btn.dataset.id!;
      const min = btn.dataset.companionMin ? parseInt(btn.dataset.companionMin, 10) : 0;
      const ok = companionSatisfied(id, min);
      // Remember the original markup once so we can restore it on unlock.
      if (btn.dataset.companionOrigHtml == null) btn.dataset.companionOrigHtml = btn.innerHTML;
      // The card's persistent „why" hint (if present) is redundant once the
      // basket qualifies — hide it so a satisfied cart isn't nagged.
      const hint = (btn.closest<HTMLElement>('[data-product]') || document)
        .querySelector<HTMLElement>('[data-companion-hint]');
      if (ok) {
        if (hint) hint.hidden = true;
        btn.disabled = false;
        btn.classList.remove('is-companion-locked');
        btn.innerHTML = btn.dataset.companionOrigHtml;
        btn.removeAttribute('title');
      } else {
        if (hint) hint.hidden = false;
        const shortfall = companionShortfall(id, min);
        const label =
          min > 0
            ? `🔒 Още ${euros(shortfall)} други продукти`
            : '🔒 Добави с друг продукт';
        btn.disabled = true;
        btn.classList.add('is-companion-locked');
        btn.innerHTML = label;
        btn.title =
          min > 0
            ? `„${btn.dataset.name}“ се добавя само с други продукти на обща стойност поне ${euros(min / 100)}.`
            : `„${btn.dataset.name}“ се добавя само заедно с друг продукт.`;
      }
    });
}

function addToCart() {
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-add-cart]');
    if (!btn) return;
    e.preventDefault();
    // Companion guard: never add a locked loss-leader product. The button is
    // disabled when unsatisfied, but guard the handler too (defence in depth).
    if (btn.dataset.requiresCompanion === '1') {
      const min = btn.dataset.companionMin ? parseInt(btn.dataset.companionMin, 10) : 0;
      if (!companionSatisfied(btn.dataset.id!, min)) {
        toast(
          min > 0
            ? `„${btn.dataset.name}“ се добавя само с други продукти на обща стойност поне ${euros(min / 100)}.`
            : `„${btn.dataset.name}“ се добавя само заедно с друг продукт.`,
          'error',
        );
        return;
      }
    }
    const scope = btn.closest<HTMLElement>('[data-product]') || document;
    const qtyInput = scope.querySelector('.stepper input') as HTMLInputElement | null;
    const qty = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
    Cart.add(
      {
        id: btn.dataset.id!,
        name: btn.dataset.name!,
        price: parseFloat(btn.dataset.price!),
        weight: btn.dataset.weight || '',
        variantId: btn.dataset.variantId || undefined,
        variantLabel: btn.dataset.variantLabel || undefined,
        // Farmer-as-seller: stamp the selling producer onto the cart line (checkout
        // reads it to disclose multi-seller orders). Absent when the button has no farmer.
        farmerId: btn.dataset.farmerId || undefined,
        farmerName: btn.dataset.farmerName || undefined,
        // Companion rule (task #2): stamp the flag + threshold so the cart/checkout
        // can pre-block a "can't be bought alone" product without a network lookup.
        requiresCompanion: btn.dataset.requiresCompanion === '1' || undefined,
        companionMinPriceStotinki: btn.dataset.companionMin
          ? parseInt(btn.dataset.companionMin, 10)
          : undefined,
      },
      qty,
    );
    toast(`„${btn.dataset.name}“ е добавен в количката`);
    pulseCart();
  });
}

function accordion() {
  document.addEventListener('click', (e) => {
    const head = (e.target as HTMLElement).closest('.acc__head');
    if (!head) return;
    const item = head.parentElement!;
    const open = item.classList.contains('open');
    const acc = item.closest('.acc') as HTMLElement | null;
    if (!acc?.dataset.multi) {
      item.parentElement!
        .querySelectorAll('.acc__item.open')
        .forEach((i) => {
          if (i !== item) i.classList.remove('open');
        });
    }
    item.classList.toggle('open', !open);
  });
}

function tabs() {
  document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (!tab) return;
      group
        .querySelectorAll<HTMLElement>('[data-tab]')
        .forEach((t) => t.classList.toggle('is-active', t === tab));
      const key = tab.dataset.tab;
      const target = document.querySelector<HTMLElement>(
        group.dataset.tabsTarget || '[data-tab-panels]',
      );
      if (!target) return;
      target.querySelectorAll<HTMLElement>('[data-cat]').forEach((card) => {
        // „Най-продавани" is a cross-category set, not a real category — match the
        // best-seller flag instead of the grouping id.
        const show =
          key === 'all' ||
          card.dataset.cat === key ||
          (key === 'best-sellers' && card.dataset.bestseller === '1');
        card.style.display = show ? '' : 'none';
      });
    });
  });
}

function init() {
  promo();
  drawer();
  updateCount();
  steppers();
  addToCart();
  accordion();
  tabs();
  refreshCompanionLocks();
  // Re-evaluate locks whenever the cart changes (updateCount fires this) so a
  // loss-leader unlocks the instant the basket reaches its threshold.
  window.addEventListener('cart:changed', refreshCompanionLocks);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
