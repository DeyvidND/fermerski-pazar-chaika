# Chaika Storefront — Product Variants + Promo Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chaika storefront render and order product variants (вид/грамаж with per-variant price+stock) and promotional pricing that FarmFlow already serves from `api.fermeribg.com`.

**Architecture:** The server is the single source of pricing truth — chaika does NO price math, it only displays server-computed numbers (`salePriceStotinki`, per-variant prices, `soldOut`) and passes `variantId` back at checkout. Product card shows "от {cheapest}" + struck/sale price; product detail gets a variant picker that rewires the add-to-cart button; the cart keys lines by `(productId, variantId)` so the same product in two variants is two lines; checkout sends `variantId` per line. All new API fields are additive/optional → no-variant, no-promo products render exactly as today.

**Tech Stack:** Astro 5 (SSR on Cloudflare Workers), TypeScript, vanilla client JS, localStorage cart. **No unit-test runner exists** (confirmed: no vitest/jest/playwright, no `*.test.*`/`*.spec.*`). Verification per task = `npm run check` (astro check / tsc) + `npm run build` where DOM/templates change, and a final live puppeteer smoke. This mirrors how the FarmFlow client (also no unit runner) is verified.

**CRITICAL coupling (why this matters):** FarmFlow's order endpoint now REJECTS an order line that omits `variantId` for a product that has variants ("Изберете вариант" backstop). Until this plan ships, **any product a farmer gives variants is UNORDERABLE on chaika.** Promo on non-variant products is only a cosmetic mismatch (chaika shows regular price, server charges sale) — varianted products are hard-broken. Ship this before farmers use variants in prod.

**Server contract (already live on `api.fermeribg.com`, additive):**
- `PublicProduct` gains: `salePercent?: number|null`, `saleEndsAt?: string|null`, `salePriceStotinki?: number|null` (headline sale price for the base/cheapest), and `variants: { id, label, priceStotinki, salePriceStotinki?, soldOut }[]` (empty `[]` when none).
- Raw per-variant stock is NOT exposed — only `soldOut` (boolean).
- Order line accepts optional `variantId`; server recomputes the price (never trusts the client) and snapshots `variantLabel`.

**Repo:** `C:\Users\Lenovo\source\repos\fermerski-pazar-chaika`
**Deploy note:** chaika auto-deploys via Cloudflare Workers Builds on push to `main`. Do ALL work on a feature branch; only merge to `main` after the final smoke passes (merge = deploy).

---

## Pre-flight (controller does this once, before Task 1)

```bash
cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika
git checkout main && git pull
git checkout -b feat/variants-and-promo
npm run check   # baseline — must be green before any change
```
Expected: astro check passes with 0 errors (note any pre-existing warnings so new ones are distinguishable).

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/lib/types.ts` | API/data types | Add `PublicProductVariant`; extend `Product`, `OrderItemInput` |
| `src/lib/cart.ts` | localStorage cart + line identity | Extend `CartItem`; add `lineKey`; key add/setQty/remove by it |
| `src/lib/pricing.ts` | **NEW** — pure display-price selection | `priceDisplay`, `cheapestVariant`, `hasVariants`, `allVariantsSoldOut`, `variantPriceStotinki` |
| `src/components/ProductCard.astro` | listing card | "от {cheapest}", struck/sale, varianted → "Избери вариант" link |
| `src/pages/product/[slug].astro` | product detail | Variant picker + selection script + promo display + variant add-to-cart |
| `src/scripts/ui.ts` | global add-to-cart handler | Read `data-variant-id` / `data-variant-label` |
| `src/scripts/cart-page.ts` | cart page render | Key rows by `lineKey`, show variant label |
| `src/scripts/checkout-page.ts` | order POST | Send `variantId` per line |

---

## Task 1: Types — variant + promo fields

**Files:**
- Modify: `src/lib/types.ts:127-150` (Product), `:213-216` (OrderItemInput)

- [ ] **Step 1: Add `PublicProductVariant` and extend `Product`**

In `src/lib/types.ts`, replace the `Product` interface (lines 127–150) with the version below — it keeps every existing field and appends the four additive promo/variant fields. Add the new `PublicProductVariant` interface directly above it.

```typescript
/** A purchasable option of a product (вид/грамаж). Server-computed; raw stock is
 *  never exposed — only `soldOut`. `salePriceStotinki` present = promo active. */
export interface PublicProductVariant {
  id: string;
  label: string;
  priceStotinki: number;
  salePriceStotinki?: number | null;
  soldOut: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  priceStotinki: number;
  unit: string;
  weight: string | null;
  category: string | null;
  tint: string | null;
  isActive: boolean | null;
  imageUrl: string | null;
  /** Cover framing for the card; null/absent = centered, no zoom. */
  coverCrop?: CoverCrop | null;
  /** Ordered gallery (cover first). Optional: older backends omit it; derive a
   *  fallback from `imageUrl`. */
  images?: string[];
  farmerId: string | null;
  subcategoryId: string | null;
  bundleItems: string[] | null;
  compareAtPriceStotinki: number | null;
  featured: boolean;
  createdAt: string | null;
  /** Promotion (additive). `salePriceStotinki` = headline discounted price for the
   *  base/cheapest; `salePercent`/`saleEndsAt` are informational. Absent = no promo. */
  salePercent?: number | null;
  saleEndsAt?: string | null;
  salePriceStotinki?: number | null;
  /** Purchasable options. Empty/absent = a plain single-price product. */
  variants?: PublicProductVariant[];
}
```

- [ ] **Step 2: Extend `OrderItemInput` with `variantId`**

Replace lines 213–216:

```typescript
export interface OrderItemInput {
  productId: string;
  quantity: number;
  variantId?: string;
}
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: PASS, 0 new errors. (Nothing consumes the new fields yet — this only widens the types.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add product variant + promo fields to Product/OrderItemInput"
```

---

## Task 2: Pricing helper — single display-price source

**Files:**
- Create: `src/lib/pricing.ts`

- [ ] **Step 1: Write `src/lib/pricing.ts`**

Pure functions only (no DOM, no fetch) so the card, the detail page, and the cart all choose the same headline/compare numbers. No math beyond picking the cheapest and choosing which server number to show.

```typescript
// Pure display-price selection. The SERVER computes every price (sale prices,
// per-variant prices); this module only decides which one to SHOW and finds the
// cheapest variant. No price arithmetic, no rounding — single source for the card,
// the detail page, and the cart so they never disagree.
import type { Product, PublicProductVariant } from './types';

/** Effective unit price of a variant in stotinki — the sale price when present,
 *  otherwise the regular price. */
export function variantPriceStotinki(v: PublicProductVariant): number {
  return v.salePriceStotinki ?? v.priceStotinki;
}

/** Does this product have purchasable variants? */
export function hasVariants(p: Product): boolean {
  return Array.isArray(p.variants) && p.variants.length > 0;
}

/** The cheapest variant by effective price, or null when the product has none. */
export function cheapestVariant(p: Product): PublicProductVariant | null {
  if (!hasVariants(p)) return null;
  return p.variants!.reduce((min, v) =>
    variantPriceStotinki(v) < variantPriceStotinki(min) ? v : min,
  );
}

/** True only for a varianted product whose every variant is sold out. */
export function allVariantsSoldOut(p: Product): boolean {
  return hasVariants(p) && p.variants!.every((v) => v.soldOut);
}

export interface PriceDisplay {
  /** Big headline price (stotinki). */
  headlineStotinki: number;
  /** Struck-through original (stotinki), or null when there's nothing to compare. */
  compareStotinki: number | null;
  /** Prefix the headline with "от" (variants with more than one option). */
  fromPrefix: boolean;
}

/** Headline + optional struck-through compare price for a card/detail.
 *  Priority: variants (cheapest) → % promo (salePriceStotinki) → legacy
 *  compareAtPriceStotinki (bundles) → plain price. */
export function priceDisplay(p: Product): PriceDisplay {
  if (hasVariants(p)) {
    const cv = cheapestVariant(p)!;
    const sale = cv.salePriceStotinki ?? null;
    return {
      headlineStotinki: sale ?? cv.priceStotinki,
      compareStotinki: sale != null ? cv.priceStotinki : null,
      fromPrefix: p.variants!.length > 1,
    };
  }
  const sale = p.salePriceStotinki ?? null;
  if (sale != null) {
    return { headlineStotinki: sale, compareStotinki: p.priceStotinki, fromPrefix: false };
  }
  if (p.compareAtPriceStotinki != null) {
    return { headlineStotinki: p.priceStotinki, compareStotinki: p.compareAtPriceStotinki, fromPrefix: false };
  }
  return { headlineStotinki: p.priceStotinki, compareStotinki: null, fromPrefix: false };
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS, 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pricing.ts
git commit -m "feat(pricing): pure display-price helper (variants + promo + legacy compare-at)"
```

---

## Task 3: Cart — line identity by (productId, variantId)

**Files:**
- Modify: `src/lib/cart.ts:4-51`
- Modify: `src/scripts/ui.ts:100-108`
- Modify: `src/scripts/cart-page.ts:188-224`

- [ ] **Step 1: Extend `CartItem` + add `lineKey`, key all mutations by it**

In `src/lib/cart.ts`, replace the `CartItem` interface (lines 4–10) and the `Cart` object (lines 14–51) with the version below. A variant line is identified by `productId::variantId`; a plain line stays keyed by `productId` alone, so existing carts in localStorage keep working unchanged.

```typescript
export interface CartItem {
  id: string;
  name: string;
  price: number; // euro
  weight?: string;
  qty: number;
  /** Chosen variant (вид/грамаж). Absent = a plain single-price product. */
  variantId?: string;
  variantLabel?: string;
}

const KEY = 'ff_cart';

/** Stable identity of a cart line. Same product in two variants = two lines. */
export function lineKey(it: { id: string; variantId?: string }): string {
  return it.variantId ? `${it.id}::${it.variantId}` : it.id;
}

export const Cart = {
  get(): CartItem[] {
    try {
      return (JSON.parse(localStorage.getItem(KEY) || '[]') as CartItem[]) || [];
    } catch {
      return [];
    }
  },
  set(items: CartItem[]) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateCount();
  },
  count(): number {
    return this.get().reduce((n, it) => n + it.qty, 0);
  },
  add(item: Omit<CartItem, 'qty'>, qty: number) {
    const items = this.get();
    const key = lineKey(item);
    const found = items.find((it) => lineKey(it) === key);
    if (found) found.qty += qty;
    else items.push({ ...item, qty });
    this.set(items);
  },
  setQty(key: string, qty: number) {
    let items = this.get();
    if (qty <= 0) items = items.filter((it) => lineKey(it) !== key);
    else {
      const f = items.find((it) => lineKey(it) === key);
      if (f) f.qty = qty;
    }
    this.set(items);
  },
  remove(key: string) {
    this.set(this.get().filter((it) => lineKey(it) !== key));
  },
  subtotal(): number {
    return this.get().reduce((s, it) => s + it.price * it.qty, 0);
  },
};
```

(Leave `money`, `updateCount` below unchanged.)

- [ ] **Step 2: Read variant data in the global add-to-cart handler**

In `src/scripts/ui.ts`, replace the `Cart.add(...)` call inside `addToCart()` (lines 100–108) with:

```typescript
    Cart.add(
      {
        id: btn.dataset.id!,
        name: btn.dataset.name!,
        price: parseFloat(btn.dataset.price!),
        weight: btn.dataset.weight || '',
        variantId: btn.dataset.variantId || undefined,
        variantLabel: btn.dataset.variantLabel || undefined,
      },
      qty,
    );
```

(`data-variant-id` / `data-variant-label` are absent on plain products → `undefined` → unchanged behavior.)

- [ ] **Step 3: Cart page — key rows by `lineKey`, show the variant label**

In `src/scripts/cart-page.ts`:

3a. Update the import on line 2:
```typescript
import { Cart, lineKey, money } from '../lib/cart';
```

3b. Replace the line-item template (lines 188–210) — row keyed by `data-key`, variant label added to the meta line:
```typescript
  lines.innerHTML = items
    .map(
      (it) => `
      <div class="line-item" data-product data-key="${esc(lineKey(it))}">
        ${thumb(it)}
        <div class="li-body">
          <div class="li-top">
            <div class="li-name">${esc(it.name)}${it.variantLabel ? ` <span class="muted" style="font-weight:500">· ${esc(it.variantLabel)}</span>` : ''}</div>
            <div class="li-price">${money(it.price * it.qty)}</div>
          </div>
          <div class="muted li-meta">${esc(it.weight || '')}${it.weight ? ' · ' : ''}${money(it.price)}</div>
          <div class="li-actions">
            <div class="stepper">
              <button data-dir="down">−</button>
              <input type="number" value="${it.qty}" min="1" inputmode="numeric">
              <button data-dir="up">+</button>
            </div>
            <button data-remove style="color:var(--muted);font-size:13.5px;text-decoration:underline">Премахни</button>
          </div>
        </div>
      </div>`,
    )
    .join('');
```

3c. Replace the row handler block (lines 212–222) — use `data-key`:
```typescript
  lines.querySelectorAll<HTMLElement>('.line-item').forEach((row) => {
    const key = row.dataset.key!;
    row.querySelector('input')!.addEventListener('change', (e) => {
      Cart.setQty(key, parseInt((e.target as HTMLInputElement).value, 10) || 1);
      render();
    });
    row.querySelector('[data-remove]')!.addEventListener('click', () => {
      Cart.remove(key);
      render();
    });
  });
```

(The `thumb(it)` lookup by `it.id` and `renderRecs(items.map((it) => it.id))` on line 224 stay as-is — images and recommendations are per product, not per variant. The recommendations "Добави" handler on lines 112–116 adds a plain product with no variant, which is correct for non-varianted recs.)

- [ ] **Step 4: Type-check + build**

Run: `npm run check && npm run build`
Expected: both PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cart.ts src/scripts/ui.ts src/scripts/cart-page.ts
git commit -m "feat(cart): identify lines by (productId, variantId); carry+show variant label"
```

---

## Task 4: Product card — "от {cheapest}", sale price, variant CTA

**Files:**
- Modify: `src/components/ProductCard.astro:1-91`

- [ ] **Step 1: Update the frontmatter (imports + derived state)**

In `src/components/ProductCard.astro`, replace lines 1–33 (the `---` frontmatter block) with:

```astro
---
import Icon from './Icon.astro';
import { money } from '../lib/money';
import { coverCropStyle } from '../lib/cover-crop';
import { cfImage, cfSrcset } from '../lib/img';
import { priceDisplay, hasVariants, allVariantsSoldOut } from '../lib/pricing';
import type { Product } from '../lib/types';

interface Props {
  product: Product;
  stepper?: boolean;
  farmerName?: string | null;
  cat?: string; // grouping id, used by the catalog filter tabs
  remaining?: number | null; // active availability window remaining stock (undefined = no window)
  bestSeller?: boolean; // member of the „Най-продавани" set → shown under that chip
}
const {
  product: p,
  stepper = false,
  farmerName = null,
  cat = '',
  remaining = null,
  bestSeller = false,
} = Astro.props;
const href = p.slug ? `/product/${p.slug}` : '/shop';
const hasV = hasVariants(p);
const pd = priceDisplay(p);
const priceLv = (pd.headlineStotinki / 100).toFixed(2);
const tag = p.featured ? '★ Популярен' : pd.compareStotinki != null ? 'Промо' : null;
const metaBits = [p.weight, farmerName].filter(Boolean).join(' · ');
const photoCount = p.images?.length ?? (p.imageUrl ? 1 : 0);
const shapeAspect = p.coverCrop?.shape === 'square' ? '1/1' : p.coverCrop?.shape === 'tall' ? '4/5' : null;

// Availability badge state. A varianted product is sold out only when every
// variant is sold out; the legacy per-product window applies to plain products.
const hasWindow = remaining !== null && remaining !== undefined;
const soldOut = (hasWindow && remaining === 0) || allVariantsSoldOut(p);
---
```

- [ ] **Step 2: Update the price block**

Replace the `<div class="product__price">…</div>` block (lines 63–70) with:

```astro
    <div class="product__price">
      {pd.fromPrefix && <span class="muted" style="font-weight:500;font-size:14px">от </span>}
      {money(pd.headlineStotinki)}
      {pd.compareStotinki != null && (
        <span class="muted" style="font-size:14px;font-weight:500;text-decoration:line-through;margin-left:8px">
          {money(pd.compareStotinki)}
        </span>
      )}
    </div>
```

- [ ] **Step 3: Update the foot (stepper gate + variant CTA)**

Replace the `<div class="product__foot">…</div>` block (lines 71–89) with — a varianted product can't be added from the card (it must pick a variant on the detail page), so its button becomes a link:

```astro
    <div class="product__foot">
      {stepper && !soldOut && !hasV && (
        <div class="stepper" aria-label="Количество">
          <button data-dir="down" aria-label="по-малко">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12h14"/></svg>
          </button>
          <input type="number" value="1" min="1" inputmode="numeric" />
          <button data-dir="up" aria-label="повече">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      )}
      {hasV ? (
        <a href={href} class="btn btn--primary btn--sm btn--full"
          style={soldOut ? 'opacity:0.5' : undefined}>
          <Icon name="cart" /> {soldOut ? 'Изчерпан' : 'Избери вариант'}
        </a>
      ) : (
        <button class="btn btn--primary btn--sm btn--full" data-add-cart
          data-id={p.id} data-name={p.name} data-price={priceLv} data-weight={p.weight || ''}
          disabled={soldOut || undefined}
          style={soldOut ? 'opacity:0.5;pointer-events:none;cursor:not-allowed' : undefined}>
          <Icon name="cart" /> {soldOut ? 'Изчерпан' : 'Добави'}
        </button>
      )}
    </div>
```

- [ ] **Step 4: Type-check + build**

Run: `npm run check && npm run build`
Expected: both PASS, 0 errors. (A varianted product now renders "от {cheapest}" and a "Избери вариант" link; a promo product renders sale price + struck original; a plain product is unchanged.)

- [ ] **Step 5: Commit**

```bash
git add src/components/ProductCard.astro
git commit -m "feat(card): 'от {cheapest}' for variants, sale price display, variant CTA"
```

---

## Task 5: Product detail — variant picker + promo + variant add-to-cart

**Files:**
- Modify: `src/pages/product/[slug].astro:1-110`

- [ ] **Step 1: Update the frontmatter (imports + derived variant state)**

In `src/pages/product/[slug].astro`, replace lines 1–43 with the version below. It adds the pricing imports, computes the default selected variant (first in-stock, else cheapest), and the headline/compare for the initial server render.

```astro
---
import Layout from '../../components/Layout.astro';
import Icon from '../../components/Icon.astro';
import ProductCard from '../../components/ProductCard.astro';
import Gallery from '../../components/Gallery.astro';
import { getCatalog } from '../../lib/api';
import { money } from '../../lib/money';
import { featured } from '../../lib/catalog';
import { imageOrigin } from '../../lib/site';
import { hasVariants, allVariantsSoldOut, variantPriceStotinki, cheapestVariant } from '../../lib/pricing';

const { slug } = Astro.params;
// One /bootstrap round trip (shared memo). The backend's single-product endpoint
// is just a find over this same cached catalog, so look the product up locally
// instead of a redundant 5th call.
const boot = await getCatalog();
const { storefront: sf, products, farmers, subcategories: subcats } = boot;
const product = products.find((p) => p.slug === slug) ?? null;
// Per-product availability map: productId → remaining (defensive: field absent on older backends).
const availMap = new Map((boot.availability ?? []).map((w: { productId: string; remaining: number }) => [w.productId, w.remaining]));

if (!product) {
  return Astro.redirect('/404');
}

const farmer = farmers.find((f) => f.id === product.farmerId) ?? null;
const catName = sf.multiSubcat
  ? subcats.find((s) => s.id === product.subcategoryId)?.name ?? null
  : product.category && product.category !== 'bundle'
    ? product.category
    : null;
const related = featured(products.filter((p) => p.id !== product.id), 4);
const productImages = product.images?.length
  ? product.images
  : product.imageUrl
    ? [product.imageUrl]
    : [];
const metaBits = [product.weight, farmer?.name].filter(Boolean).join(' · ');
const imgOrigin = imageOrigin(productImages[0]);

// Variants + promo state
const hasV = hasVariants(product);
const variantsSoldOut = allVariantsSoldOut(product);
// Default selection: first in-stock variant, else the cheapest (so the page shows
// a concrete price, not "от"). The client script keeps this in sync on click.
const defaultVariant = hasV
  ? (product.variants!.find((v) => !v.soldOut) ?? cheapestVariant(product))
  : null;

// Headline + struck compare for the initial server render.
const baseHeadlineStotinki = defaultVariant ? variantPriceStotinki(defaultVariant) : (product.salePriceStotinki ?? product.priceStotinki);
const baseCompareStotinki = defaultVariant
  ? (defaultVariant.salePriceStotinki != null ? defaultVariant.priceStotinki : null)
  : (product.salePriceStotinki != null ? product.priceStotinki : product.compareAtPriceStotinki);
const priceLv = (baseHeadlineStotinki / 100).toFixed(2);
const tag = product.featured ? '★ Популярен' : baseCompareStotinki != null ? 'Промо' : null;

// Availability for this specific product (legacy per-product window applies to
// plain products; varianted products use per-variant soldOut).
const productRemaining = availMap.has(product.id) ? (availMap.get(product.id) ?? null) : null;
const productSoldOut = (productRemaining !== null && productRemaining === 0) || variantsSoldOut;
const defaultVariantId = defaultVariant && !defaultVariant.soldOut ? defaultVariant.id : '';
const defaultVariantLabel = defaultVariant && !defaultVariant.soldOut ? defaultVariant.label : '';
---
```

- [ ] **Step 2: Update the price display element (give it an id for the script)**

Replace the `<div class="product__price" …>…</div>` block (lines 62–69) with — note `id="detailPrice"` so the selection script can rewrite it:

```astro
          <div class="product__price" id="detailPrice" style="font-size:34px;margin:18px 0">
            {money(baseHeadlineStotinki)}
            {baseCompareStotinki != null && (
              <span class="muted" style="font-size:20px;font-weight:500;text-decoration:line-through;margin-left:10px">
                {money(baseCompareStotinki)}
              </span>
            )}
          </div>
```

- [ ] **Step 3: Insert the variant picker (between description/bundle block and the add-to-cart row)**

Immediately AFTER the `<div class="note-fresh" …>…</div>` line (currently line 85) and BEFORE the stock badge block (`{productRemaining !== null && (`), insert the picker. It renders one button per variant with the data the script needs; sold-out variants are disabled and struck.

```astro
          {hasV && (
            <div class="variant-picker" data-variant-picker style="margin:18px 0">
              <div class="muted" style="font-size:14px;margin-bottom:8px">Изберете вариант</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px">
                {product.variants!.map((v) => {
                  const eff = v.salePriceStotinki ?? v.priceStotinki;
                  return (
                    <button type="button" class="variant-opt" data-variant-opt
                      data-variant-id={v.id}
                      data-variant-label={v.label}
                      data-price-lv={(eff / 100).toFixed(2)}
                      data-headline={money(eff)}
                      data-compare={v.salePriceStotinki != null ? money(v.priceStotinki) : ''}
                      disabled={v.soldOut || undefined}
                      style={v.soldOut
                        ? 'opacity:0.45;cursor:not-allowed;text-decoration:line-through'
                        : undefined}>
                      {v.label}{v.soldOut ? ' · изчерпан' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
```

- [ ] **Step 4: Wire the add-to-cart button to the (default) variant**

Replace the add-to-cart `<button …>…</button>` (lines 104–109) with — it carries the default variant's id/label/price so a click before any picker interaction still posts a valid variant; the script updates these on selection:

```astro
            <button class="btn btn--primary btn--lg" data-add-cart
              data-id={product.id} data-name={product.name} data-price={priceLv} data-weight={product.weight || ''}
              data-variant-id={defaultVariantId} data-variant-label={defaultVariantLabel}
              disabled={productSoldOut || undefined}
              style={productSoldOut ? 'opacity:0.5;pointer-events:none;cursor:not-allowed' : undefined}>
              {productSoldOut ? 'Изчерпан' : 'Добави в количка'}
            </button>
```

- [ ] **Step 5: Add the selection script + picker styles at the end of the file**

Append, AFTER the closing `</Layout>` tag, a hoisted module script and a `<style>` block. The script syncs the active variant into the price element and the add-to-cart button's data attributes.

```astro
<script>
  const picker = document.querySelector<HTMLElement>('[data-variant-picker]');
  if (picker) {
    const opts = Array.from(picker.querySelectorAll<HTMLElement>('[data-variant-opt]'));
    const addBtn = document.querySelector<HTMLElement>('[data-product] [data-add-cart]');
    const priceEl = document.getElementById('detailPrice');

    function select(btn: HTMLElement) {
      opts.forEach((o) => o.classList.toggle('is-active', o === btn));
      if (addBtn) {
        addBtn.dataset.variantId = btn.dataset.variantId || '';
        addBtn.dataset.variantLabel = btn.dataset.variantLabel || '';
        addBtn.dataset.price = btn.dataset.priceLv || addBtn.dataset.price || '';
      }
      if (priceEl) {
        const headline = btn.dataset.headline || '';
        const compare = btn.dataset.compare || '';
        priceEl.innerHTML =
          headline +
          (compare
            ? ` <span class="muted" style="font-size:20px;font-weight:500;text-decoration:line-through;margin-left:10px">${compare}</span>`
            : '');
      }
    }

    opts.forEach((o) => {
      if (o.hasAttribute('disabled')) return;
      o.addEventListener('click', () => select(o));
    });

    // Mark the default (first in-stock) option active on load; if none, leave the
    // disabled add-to-cart button as the server rendered it.
    const first = opts.find((o) => !o.hasAttribute('disabled'));
    if (first) select(first);
  }
</script>

<style>
  .variant-opt {
    padding: 8px 16px;
    border: 1.5px solid var(--line, #e2e0d8);
    border-radius: 999px;
    background: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color .15s, background .15s;
  }
  .variant-opt:hover:not([disabled]) {
    border-color: var(--color-primary, #4C8A54);
  }
  .variant-opt.is-active {
    border-color: var(--color-primary, #4C8A54);
    background: var(--color-primary, #4C8A54);
    color: #fff;
  }
</style>
```

- [ ] **Step 6: Type-check + build**

Run: `npm run check && npm run build`
Expected: both PASS, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add "src/pages/product/[slug].astro"
git commit -m "feat(detail): variant picker syncs price + add-to-cart; promo sale display"
```

---

## Task 6: Checkout — send `variantId` per line

**Files:**
- Modify: `src/scripts/checkout-page.ts:304-310`

- [ ] **Step 1: Include `variantId` in the order payload**

In `src/scripts/checkout-page.ts`, replace the `items:` line inside the `payload` object (line 305) with a mapper that adds `variantId` only when the line has one:

```typescript
    items: items.map((it) => ({
      productId: it.id,
      quantity: it.qty,
      ...(it.variantId ? { variantId: it.variantId } : {}),
    })),
```

(Plain lines send `{ productId, quantity }` exactly as before; varianted lines add `variantId`, which the server's order endpoint requires — this is what unblocks ordering varianted products.)

- [ ] **Step 2: Type-check + build**

Run: `npm run check && npm run build`
Expected: both PASS, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/scripts/checkout-page.ts
git commit -m "feat(checkout): post variantId per order line"
```

---

## Task 7: Final verification + live smoke

**Files:** none (verification only)

- [ ] **Step 1: Full type-check + production build**

Run: `npm run check && npm run build`
Expected: both PASS, 0 errors.

- [ ] **Step 2: Live smoke against the dev server**

Run `npm run dev`, then (via the preview tools or a browser) confirm against a tenant that has at least one varianted product and one promo product:
1. Shop grid: varianted product shows **"от {cheapest}"** and a **"Избери вариант"** button (links to detail, not add). Promo product shows **sale price + struck original** and a "Промо" tag.
2. Detail page of the varianted product: variant buttons render; clicking a variant updates the big price; sold-out variants are disabled + struck. Default in-stock variant is pre-selected on load.
3. Add a chosen variant → cart shows the line with its **variant label**; add a *different* variant of the same product → it's a **separate line** (not merged). Change qty / remove operate on the right line.
4. Checkout the cart → in the network request to `…/checkout`, each varianted line carries `variantId`; the order is **accepted** (no "Изберете вариант" 400). A plain product still checks out unchanged.
5. A product with neither variants nor promo renders exactly as before.

Expected: all five pass. Capture a screenshot of the varianted detail page + the checkout network payload as proof.

- [ ] **Step 3: Finish the branch**

Use superpowers:finishing-a-development-branch. Because chaika auto-deploys on push to `main` (Cloudflare Workers Builds), merging to `main` IS the deploy — only do it after Step 2 passes. After deploy, if HTML edge-caching is on, purge the Cloudflare cache so the new card/detail markup is served.

---

## Self-Review (controller, against the spec §5 and the server contract)

**Spec coverage:**
- §5 "Product card — от {cheapest}, struck + sale" → Task 4. ✅
- §5 "Product detail — variant picker, selecting updates price, изчерпан per variant" → Task 5. ✅
- §5 "Cart — each line carries variantId + label; add-to-cart sends variantId" → Task 3 (carry) + Task 6 (send). ✅
- §5 "No price math in the browser" → Task 2 selects server numbers only; no arithmetic beyond cheapest-of and cents→euro formatting (pre-existing). ✅
- Server backstop (variantId required) → Task 5 default-variant data + Task 6 payload. ✅
- Backward compat (no-variant / no-promo unchanged) → every branch guards on `hasVariants` / null sale fields; Task 7 Step 2.5 verifies. ✅

**Type consistency:** `PublicProductVariant` fields (`id,label,priceStotinki,salePriceStotinki?,soldOut`) are used identically in `pricing.ts`, the card, and the detail picker. `lineKey` signature `{id, variantId?}` matches `CartItem`. `variantId` is optional on `OrderItemInput`, `CartItem`, dataset reads, and the checkout payload — consistent throughout.

**Placeholder scan:** No TBD/TODO; every code step is complete and copy-paste runnable.

**Known gap (acceptable, documented):** cart thumbnails and "често купувано заедно" recommendations remain keyed by `productId` (one image/rec set per product regardless of variant) — correct, variants share the product photo.
