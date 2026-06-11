// Renders the cart page from localStorage. Re-renders on qty change / removal.
import { Cart, money } from '../lib/cart';
import { ICONS } from '../lib/icons';
import { esc } from '../lib/escape';
import { coverCropStyle } from '../lib/cover-crop';
import { PUBLIC_BASE } from '../lib/config';
import type { CoverCrop } from '../lib/types';

const area = document.getElementById('cartArea');

// Product cover photos, fetched once and keyed by id, so the cart thumbnails show
// the real image instead of a placeholder box. Shipping is intentionally NOT shown
// here: the method (pickup / local delivery / Econt) and the farm's fee + free-over
// thresholds are resolved authoritatively at checkout, not guessed in the cart.
const imgMap = new Map<string, { src: string; crop: CoverCrop | null }>();

async function loadImages() {
  try {
    const res = await fetch(`${PUBLIC_BASE}/products`, { headers: { accept: 'application/json' } });
    if (!res.ok) return;
    const products = (await res.json()) as Array<{
      id: string;
      imageUrl?: string | null;
      images?: string[];
      coverCrop?: CoverCrop | null;
    }>;
    for (const p of products) {
      const src = p.imageUrl ?? p.images?.[0] ?? null;
      if (src) imgMap.set(p.id, { src, crop: p.coverCrop ?? null });
    }
  } catch {
    // offline → fall back to placeholders
  }
}

function thumb(it: { id: string; name: string }): string {
  const hit = imgMap.get(it.id);
  if (hit) {
    return `<div class="ph ph--rounded"><img src="${esc(hit.src)}" alt="${esc(it.name)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${coverCropStyle(hit.crop)}"></div>`;
  }
  return `<div class="ph"><span class="ph__label" style="font-size:9px">${esc(it.name)}</span></div>`;
}

function render() {
  if (!area) return;
  const items = Cart.get();

  if (!items.length) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="ph"><span class="ph__label">празна<br>количка</span></div>
        <h2 style="font-size:28px;margin-bottom:10px">Количката е празна</h2>
        <p class="muted" style="margin-bottom:24px">Разгледай свежите продукти от пазара и добави любимите си.</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a href="/shop" class="btn btn--primary">Към магазина</a>
        </div>
      </div>`;
    return;
  }

  const sub = Cart.subtotal();
  area.innerHTML = `
    <div class="commerce-grid">
      <div>
        <div id="lines"></div>
        <div style="margin-top:18px"><a href="/shop" class="btn btn--ghost btn--sm">← Продължи пазаруването</a></div>
      </div>
      <aside class="summary">
        <h3 style="font-size:22px;margin-bottom:14px">Резюме</h3>
        <div class="summary__row"><span>Междинна сума</span><span>${money(sub)}</span></div>
        <div class="summary__row"><span>Доставка</span><span class="muted">изчислява се при поръчка</span></div>
        <div class="summary__row total"><span>Общо</span><span>${money(sub)}</span></div>
        <a href="/checkout" class="btn btn--primary btn--full btn--lg" style="margin-top:16px">Към касата</a>
        <div class="note-fresh" style="margin-top:16px;width:100%;justify-content:center">${ICONS.leaf} Свежо за петъчната доставка</div>
      </aside>
    </div>`;

  const lines = document.getElementById('lines')!;
  lines.innerHTML = items
    .map(
      (it) => `
      <div class="line-item" data-product data-id="${esc(it.id)}">
        ${thumb(it)}
        <div>
          <div style="font-family:var(--font-head);font-size:19px;font-weight:var(--h-weight)">${esc(it.name)}</div>
          <div class="muted" style="font-size:13.5px">${esc(it.weight || '')}${it.weight ? ' · ' : ''}${money(it.price)}</div>
          <div style="display:flex;gap:14px;align-items:center;margin-top:10px">
            <div class="stepper">
              <button data-dir="down">−</button>
              <input type="number" value="${it.qty}" min="1" inputmode="numeric">
              <button data-dir="up">+</button>
            </div>
            <button data-remove style="color:var(--muted);font-size:13.5px;text-decoration:underline">Премахни</button>
          </div>
        </div>
        <div class="li-price" style="font-weight:700;font-size:18px">${money(it.price * it.qty)}</div>
      </div>`,
    )
    .join('');

  lines.querySelectorAll<HTMLElement>('.line-item').forEach((row) => {
    const id = row.dataset.id!;
    row.querySelector('input')!.addEventListener('change', (e) => {
      Cart.setQty(id, parseInt((e.target as HTMLInputElement).value, 10) || 1);
      render();
    });
    row.querySelector('[data-remove]')!.addEventListener('click', () => {
      Cart.remove(id);
      render();
    });
  });
}

render();
void loadImages().then(render);
