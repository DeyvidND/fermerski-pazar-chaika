# Shop page redesign — filters + „Зареди още" pagination

Date: 2026-07-13
Surface: `src/pages/shop.astro` (Магазин), `src/styles/main.css`
Motivation: 90% of storefront traffic is mobile; the shop filter zone is plain and
buries products, and all products render at once (no pagination).

## Constraints

- **Theme-safe**: CSS variables only; must work across `klasik` / `svezho` / default.
- **No backend change**, no new deps, all client-side.
- Desktop must stay as good or better.
- Elder-friendly market: nothing important hidden behind a tap; calm, no flicker.

## Current model (unchanged foundation)

`shop.astro` SSRs **every** active product into `#catalogGrid`. Filters are
client-side: category chips + „С куриер" chip + farmer `<select>` + text search all
compose (AND) through one `apply()` that toggles `card.style.display`. This instant
client filtering is preserved — pagination layers on top, never replaces it.

## A. Filter zone polish

1. **Category chips: icon + count.** Reuse existing `iconForCategory` → `ICONS`
   inline SVG (same glyph set as the homepage category grid). Each chip renders
   `[icon] <name> · <count>`. Count is computed server-side over the **active** set
   (a `Map<catId, number>` in frontmatter) — fixes the current `cat.count`, which
   counts inactive products too. „Всички · <total>` shows the grand total. Counts
   are **static category totals** (they do NOT re-narrow as other filters apply →
   no flicker); the live filtered number lives in the result bar.
2. **Sticky category chip row.** The chip row sticks under the header on scroll so
   shoppers can re-filter without scrolling back to the top. The header is sticky
   and can wrap (variable height), so the sticky offset is **JS-measured**
   (`--shop-sticky-top` set from header height, updated on resize) — never a magic
   number. Subtle background + bottom shadow when stuck.
3. **Secondary filters grouped.** Farmer `<select>` + „📦 С куриер" chip sit in one
   tidy row under the chips (select full-width on mobile, aligned with the search
   pill). Behaviour unchanged.
4. **Result bar.** `Показани <shown> от <total>` + „Изчисти филтрите" (shown only
   while filtering). Clearer than the bare count.

## B. „Зареди още" pagination

- `PAGE = 24`. SSR still renders all cards (SEO + instant filter preserved). Only
  the first 24 of the **filter-matched** set are visible; the rest are
  `display:none`.
- `apply()` builds the `matched[]` array (cards passing all filters, others hidden),
  then `renderPage()` shows `matched.slice(0, shown)` and hides the rest — filters
  and pagination never fight over `display`.
- Centered „Зареди още (<remaining> оставащи)" button below the grid; each click
  raises `shown` by `PAGE`.
- Any filter/search/farmer change resets `shown` to `PAGE`.
- Button auto-hides when `shown >= matched.length`.
- Enhancement: an IntersectionObserver auto-loads the next page when the button
  nears the viewport; the button stays as the no-JS / manual fallback.

## C. Cards

Untouched. Possibly minor grid-gap consistency only.

## Files touched

- `src/pages/shop.astro` — frontmatter count map; chip / secondary-filter / result-bar
  / load-more markup; rewritten `<script>` (matched[] + renderPage + load-more +
  IntersectionObserver + JS-measured sticky offset).
- `src/styles/main.css` — chip icon/count, sticky chip row, secondary filter row,
  load-more button, result bar.

## Verification

Logic lives in an inline Astro `<script>` (not unit-testable via vitest, which only
runs `*.test.ts` here). Verify in the browser preview: filter compose + count, load
more + reset on filter, sticky offset, mobile 375px + desktop, theme sanity.
