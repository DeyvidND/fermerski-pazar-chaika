// Global storefront interactivity, loaded on every page via Layout.astro.
// Mirrors the prototype's app.js (minus the now-SSR chrome + the demo theme
// switcher / module toggle): cart badge, promo close, mobile drawer, qty
// steppers, add-to-cart + toast, FAQ accordion, category tabs.
import { Cart, updateCount } from '../lib/cart';
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
  const open = () => {
    d?.classList.add('open');
    back?.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  const shut = () => {
    d?.classList.remove('open');
    back?.classList.remove('open');
    document.body.style.overflow = '';
  };
  document.getElementById('hamburger')?.addEventListener('click', open);
  document.getElementById('drawerClose')?.addEventListener('click', shut);
  back?.addEventListener('click', shut);
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
function toast(msg: string) {
  let t = document.getElementById('ff-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ff-toast';
    t.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--primary);color:#fff;padding:14px 22px;border-radius:999px;font-weight:600;font-size:15px;z-index:90;box-shadow:0 16px 40px -10px rgba(0,0,0,.35);opacity:0;transition:opacity .25s,transform .25s;display:flex;gap:10px;align-items:center;max-width:90vw';
    document.body.appendChild(t);
  }
  t.innerHTML = ICONS.check + '<span>' + esc(msg) + '</span>';
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

function addToCart() {
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-add-cart]');
    if (!btn) return;
    e.preventDefault();
    const scope = btn.closest<HTMLElement>('[data-product]') || document;
    const qtyInput = scope.querySelector('.stepper input') as HTMLInputElement | null;
    const qty = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
    Cart.add(
      {
        id: btn.dataset.id!,
        name: btn.dataset.name!,
        price: parseFloat(btn.dataset.price!),
        weight: btn.dataset.weight || '',
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
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
