# Chaika storefront — live search bar (Фермери + Магазин)

Date: 2026-07-06
Repo: `fermerski-pazar-chaika` (Astro SSR storefront)

## Goal

Add a good-looking, **mobile-first** search bar to two pages:

- **Магазин** (`/shop`) — filter product cards by product name **and** farmer name.
- **Фермери** (`/farmers`) — filter farmer cards by name and role.

Search is **live client-side filtering** of the already-rendered cards (no reload,
no API, no new pages). On `/shop` it composes with the existing category chips and
the „С куриер" filter (all three combine with AND).

## Non-goals (YAGNI)

- No global header search / typeahead dropdown.
- No server-side `?q=` search or SSR round-trip.
- No search on the `/orders` (Поръчки) marketing page — it has no list.
- No fuzzy/diacritic-fold matching — plain normalized substring is enough for Cyrillic.
- No sticky bar in v1 (see Decision below).

## Approach

Reusable `SearchBar.astro` component + a shared `wireSearch()` client helper.
Each page owns its own filter callback; the shop callback drives a single unified
filter controller so category + courier + text never fight over `display`.

### Match semantics

- Normalize query: `q.trim().toLocaleLowerCase('bg')`.
- A card's searchable text lives in a `data-name` attribute, pre-lowercased at SSR.
- Match = `q === '' || card.dataset.name.includes(q)`.

## Components / files

### New: `src/components/SearchBar.astro`

Dumb markup only (no filtering logic). Props:

- `id: string` — unique id for the `<input>` (page script targets it).
- `placeholder: string`
- `sticky?: boolean` — accepted, defaults `false`; renders `data-sticky` when true. Not enabled in v1.

Markup: a `.searchbar` pill wrapper containing
`<Icon name="search" />` (left), `<input class="searchbar__input" type="search"
inputmode="search" autocomplete="off" aria-label={placeholder}>`, and a
`<button class="searchbar__clear" type="button" aria-label="Изчисти" hidden>` with
the `x` icon (right).

### New: `src/scripts/search.ts`

`export function wireSearch(inputId: string, onQuery: (q: string) => void): void`

- On `input`: normalize value, toggle the sibling `.searchbar__clear` `hidden` by
  whether the raw value is non-empty, call `onQuery(normalized)`.
- Clear button click → empty the input, refocus it, call `onQuery('')`, hide itself.
- `Escape` key in the input → same as clear.

### Edit: `src/components/ProductCard.astro`

Add to the root `<article>`:
`data-name={[p.name, farmerName].filter(Boolean).join(' ').toLocaleLowerCase('bg')}`.
(`farmerName` is already a prop.)

### Edit: `src/components/FarmerCard.astro`

Add to the root `<article>`: `data-farmer` marker + `data-name={[f.name, f.role]
.filter(Boolean).join(' ').toLocaleLowerCase('bg')}`.

### Edit: `src/pages/shop.astro`

- Render `<SearchBar id="shopSearch" placeholder="Търси продукт или фермер…" />`
  above the chips row — only when `seeded` (there are products).
- Remove `data-tabs` / `data-tabs-target` from the chips row so the global
  `tabs()` in `ui.ts` no longer double-handles shop; the page now owns filtering.
- Add a result-count line + empty state:
  `<p id="shopCount">` (e.g. „3 резултата") and
  `<p id="shopEmpty" hidden>Няма намерени продукти за „…"</p>`.
- Replace the inline courier-only script with **one** unified controller:
  - state `{ cat: 'all', courierOnly: false, q: '' }`.
  - `apply()` loops `#catalogGrid [data-product]`, sets `display` per card:
    `visible = matchCat && matchCourier && matchText`, where
    - `matchCat = cat==='all' || card.dataset.cat===cat || (cat==='best-sellers' && card.dataset.bestseller==='1')`
    - `matchCourier = !courierOnly || card.dataset.courier==='1'`
    - `matchText = q==='' || (card.dataset.name||'').includes(q)`.
  - Chip click (delegated on `#catChips`): set `state.cat`, toggle `is-active`, `apply()`.
  - Courier chip click: toggle `state.courierOnly` + `is-active`, `apply()`.
  - `wireSearch('shopSearch', q => { state.q = q; apply(); })`.
  - After every `apply()`, update count / toggle empty state from the visible count.
  - Preserve the existing deep-link: `/shop#<catId>` still clicks the matching chip
    on load (chip handler runs `apply()`).

### Edit: `src/pages/farmers.astro`

- Render `<SearchBar id="farmerSearch" placeholder="Търси фермер по име…" />`
  above the farmers grid — only when `farmers.length > 0`.
- Add count line + empty state (`Няма намерени фермери`).
- Page `<script>`: `wireSearch('farmerSearch', q => filter)` filtering
  `[data-farmer]` cards by `data-name` includes; update count / empty state.

### Edit: `src/styles/main.css`

Add `.searchbar` block (mobile-first):

- Wrapper: `display:flex; align-items:center; gap:10px; height:48px; padding:0 14px;
  background:var(--surface); border:1.5px solid var(--line-strong);
  border-radius:999px; transition:border-color .18s, box-shadow .18s;`
- `.searchbar:focus-within`: `border-color:var(--primary); box-shadow:0 0 0 4px var(--primary-050);`
- `.searchbar .searchbar__input`: `flex:1; min-width:0; border:0; background:transparent;
  font-size:15.5px; color:var(--ink);` + hide native search cancel
  (`::-webkit-search-cancel-button { -webkit-appearance:none; }`).
- Search icon: `color:var(--primary); width:20px; height:20px; flex:none;`
- `.searchbar__clear`: round 26px, `background:var(--surface-2); color:var(--muted);`
  hover darker; `[hidden]` respected.
- Desktop (`@media (min-width:701px)`): cap `max-width:460px` so the bar isn't huge.
- `.searchbar[data-sticky]` rule authored but gated behind the `sticky` prop (unused v1).
- Count line `.result-count { color:var(--muted); font-size:13px; margin-top:12px; }`.

## Decision: no sticky in v1

`.site-header` is `position:sticky` with a `flex-wrap` nav whose height varies on
phones (some in-app browsers misreport viewport and wrap the row). A sticky search
bar offset below it would need a reliable header height; the wrapping makes that
brittle and risks overlap. So v1 ships a solid in-flow bar (matches the approved
mockup). The `sticky` prop + CSS hook are stubbed so it can be enabled later with a
JS-measured header-height CSS var if desired.

## Edge cases

- Empty catalog / no farmers: search bar not rendered (nothing to filter).
- Best-sellers chip: handled by `data-bestseller` inside `matchCat`.
- Courier + category + text: strict AND via the single `apply()`.
- Deep-link `/shop#category`: still activates the chip and runs `apply()`.
- A11y: `type="search"`, `aria-label`, labelled clear button, `Escape` to clear.

## Verification

- `astro dev`, then preview tools: type in each bar, confirm cards filter live,
  clear button resets, count/empty state correct, category+courier still compose on
  shop. Resize to mobile (375px) and confirm the bar looks good and taps well.
