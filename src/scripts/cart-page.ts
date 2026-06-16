// Renders the cart page from localStorage. Re-renders on qty change / removal.
import { Cart, money } from '../lib/cart';
import { ICONS } from '../lib/icons';
import { esc } from '../lib/escape';
import { coverCropStyle } from '../lib/cover-crop';
import { cfImage } from '../lib/img';
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

// «Често купувано заедно» — up to 3 bought-together picks from the backend,
// keyed by the cart's product ids. Gated on the farm's recommendations toggle
// (the cart area carries `data-recommend="1"` when it's on). Cached per id-set so
// a quantity change (same ids) doesn't refetch.
interface RecProduct {
  id: string;
  name: string;
  priceStotinki: number;
  weight?: string | null;
  imageUrl?: string | null;
  images?: string[];
  coverCrop?: CoverCrop | null;
}
const recCache = new Map<string, RecProduct[]>();

async function loadRecs(ids: string[]): Promise<RecProduct[]> {
  const key = [...ids].sort().join(',');
  const hit = recCache.get(key);
  if (hit) return hit;
  try {
    const res = await fetch(
      `${PUBLIC_BASE}/recommendations?ids=${encodeURIComponent(ids.join(','))}`,
      { headers: { accept: 'application/json' } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as RecProduct[];
    recCache.set(key, data);
    return data;
  } catch {
    return [];
  }
}

function recThumb(p: RecProduct): string {
  const src = p.imageUrl ?? p.images?.[0] ?? null;
  if (src) {
    return `<div class="ph ph--rounded" style="aspect-ratio:1/1"><img src="${esc(cfImage(src, 320) ?? src)}" alt="${esc(p.name)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${coverCropStyle(p.coverCrop ?? null)}"></div>`;
  }
  return `<div class="ph" style="aspect-ratio:1/1"><span class="ph__label" style="font-size:9px">${esc(p.name)}</span></div>`;
}

async function renderRecs(ids: string[]) {
  const host = document.getElementById('recArea');
  if (!host || area?.dataset.recommend !== '1' || !ids.length) return;
  const recs = await loadRecs(ids);
  if (!recs.length) {
    host.innerHTML = '';
    return;
  }
  host.innerHTML = `
    <h2 style="font-size:24px;margin:40px 0 16px">Често купувано заедно</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px">
      ${recs
        .map(
          (p) => `
        <article class="card" data-rec data-id="${esc(p.id)}" style="padding:10px">
          ${recThumb(p)}
          <div style="padding:12px 4px 4px">
            <div style="font-family:var(--font-head);font-size:17px;font-weight:var(--h-weight)">${esc(p.name)}</div>
            <div class="muted" style="font-size:13px;margin:2px 0 10px">${p.weight ? esc(p.weight) + ' · ' : ''}${money(p.priceStotinki / 100)}</div>
            <button class="btn btn--primary btn--sm btn--full" data-add>Добави</button>
          </div>
        </article>`,
        )
        .join('')}
    </div>`;

  host.querySelectorAll<HTMLElement>('[data-rec]').forEach((card) => {
    const p = recs.find((r) => r.id === card.dataset.id);
    if (!p) return;
    card.querySelector('[data-add]')!.addEventListener('click', () => {
      Cart.add(
        { id: p.id, name: p.name, price: p.priceStotinki / 100, weight: p.weight ?? undefined },
        1,
      );
      render();
    });
  });
}

function thumb(it: { id: string; name: string }): string {
  const hit = imgMap.get(it.id);
  if (hit) {
    return `<div class="ph ph--rounded"><img src="${esc(cfImage(hit.src, 192) ?? hit.src)}" alt="${esc(it.name)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${coverCropStyle(hit.crop)}"></div>`;
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
    </div>
    <div id="recArea"></div>`;

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

  void renderRecs(items.map((it) => it.id));
}

render();
void loadImages().then(render);
