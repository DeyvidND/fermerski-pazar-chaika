# Farmer Map `/karta` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/karta` page to the chaika storefront that pins every farmer on an interactive Google Map by their (approximate) village, with an info window that links to the farmer's profile when the name matches a real farmer.

**Architecture:** A static data file holds `{name, village, lat, lng}` for each farmer plus a pure matcher that attaches a profile slug when the name matches the live roster. The SSR page (`karta.astro`) reads the runtime Maps key, resolves points against the live catalog, and emits a map container + a no-JS/no-key fallback list. A small client script lazy-loads the Maps JS API, drops the markers, fits bounds, and wires info windows.

**Tech Stack:** Astro (SSR, `@astrojs/cloudflare`), TypeScript, Google Maps JS API. No test runner exists in this repo — pure logic is tested with `node:test` run through on-demand `npx tsx` (no dependency added, file is tree-shaken from the build); UI is verified in the browser via the preview tools + `npm run check`.

## Global Constraints

- **Repo:** `fermerski-pazar-chaika`, branch `feat/farmer-map` (already created).
- **Maps key read:** request-time only — `const runtimeEnv = (globalThis as any).process?.env ?? {}` then `String(runtimeEnv.PUBLIC_GOOGLE_MAPS_KEY ?? import.meta.env.PUBLIC_GOOGLE_MAPS_KEY ?? '').trim()`. NEVER a build-time `import.meta.env` constant. (Matches `checkout.astro`.)
- **Maps JS loader:** plain JS API, `language=bg&region=BG`, NO `places` library (unlike `address-autocomplete.ts`). Load once, guard on `window.google?.maps`.
- **Empty key or load failure must never break the page:** fallback list stays visible, no empty map box shows.
- **Farmer slugs:** always via the existing collision-safe `farmerSlugMap(farmers)` from `src/lib/farmer-slug.ts`. Never hand-roll a slug.
- **Coordinates are approximate** village-center points; ambiguous villages (Искра, Зимница, Храброво) use the Dobrich/Varna-region settlement.
- `.astro` / `.ts` under `src/lib` never become routes; a `*.test.ts` there is tree-shaken from the Cloudflare bundle (not imported by any page).

---

### Task 1: Static data + name→slug matcher

**Files:**
- Create: `src/lib/farmer-map.ts`
- Test: `src/lib/farmer-map.test.ts`

**Interfaces:**
- Consumes: `type { Farmer }` from `./types` (type-only, erased at runtime — keeps this module dependency-free and unit-testable).
- Produces:
  - `interface FarmerMapPoint { name: string; village: string; lat: number; lng: number }`
  - `interface ResolvedMapPoint extends FarmerMapPoint { slug: string | null }`
  - `const FARMER_MAP_POINTS: FarmerMapPoint[]` (13 entries)
  - `function resolveMapPoints(points: FarmerMapPoint[], farmers: Farmer[], slugs: Map<string, string>): ResolvedMapPoint[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/farmer-map.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMapPoints, FARMER_MAP_POINTS, type FarmerMapPoint } from './farmer-map.ts';

// Minimal Farmer stubs — only id + name are read by the matcher.
const farmer = (id: string, name: string) => ({ id, name }) as any;

test('exact name match attaches the slug', () => {
  const points: FarmerMapPoint[] = [{ name: 'Димка Четова', village: 'Крушари', lat: 43.87, lng: 27.78 }];
  const farmers = [farmer('f1', 'Димка Четова')];
  const slugs = new Map([['f1', 'dimka-chetova']]);
  const out = resolveMapPoints(points, farmers, slugs);
  assert.equal(out[0].slug, 'dimka-chetova');
});

test('match is case/whitespace-insensitive', () => {
  const points: FarmerMapPoint[] = [{ name: '  димка   четова ', village: 'Крушари', lat: 43.87, lng: 27.78 }];
  const farmers = [farmer('f1', 'Димка Четова')];
  const slugs = new Map([['f1', 'dimka-chetova']]);
  assert.equal(resolveMapPoints(points, farmers, slugs)[0].slug, 'dimka-chetova');
});

test('strips a leading "Ферма " prefix on either side', () => {
  const points: FarmerMapPoint[] = [{ name: 'Ферма Калата', village: 'Русе', lat: 43.849, lng: 25.954 }];
  const farmers = [farmer('f1', 'Калата')];
  const slugs = new Map([['f1', 'kalata']]);
  assert.equal(resolveMapPoints(points, farmers, slugs)[0].slug, 'kalata');
});

test('no matching farmer → slug is null', () => {
  const points: FarmerMapPoint[] = [{ name: 'BT juice', village: 'Варна', lat: 43.204, lng: 27.91 }];
  const out = resolveMapPoints(points, [], new Map());
  assert.equal(out[0].slug, null);
});

test('seed data has 13 points, all with finite coords and non-empty labels', () => {
  assert.equal(FARMER_MAP_POINTS.length, 13);
  for (const p of FARMER_MAP_POINTS) {
    assert.ok(p.name.trim().length > 0, `name empty: ${JSON.stringify(p)}`);
    assert.ok(p.village.trim().length > 0, `village empty: ${JSON.stringify(p)}`);
    assert.ok(Number.isFinite(p.lat) && p.lat > 42 && p.lat < 45, `lat off: ${JSON.stringify(p)}`);
    assert.ok(Number.isFinite(p.lng) && p.lng > 22 && p.lng < 29, `lng off: ${JSON.stringify(p)}`);
  }
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika && npx --yes tsx --test src/lib/farmer-map.test.ts`
Expected: FAIL — cannot resolve `./farmer-map.ts` (module not created yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/farmer-map.ts`:

```ts
// Static "meet the farmers" map data for the /karta page. These are APPROXIMATE
// village-center coordinates, NOT exact farmer addresses — a regional showcase.
// Ambiguous village names (Искра, Зимница, Храброво exist several times in BG)
// use the Dobrich/Varna-region settlement. Edit coordinates here to fine-tune a
// pin; nothing else in the app needs to change.
import type { Farmer } from './types';

export interface FarmerMapPoint {
  /** Display name as the operator gave it (a farmer or a business). */
  name: string;
  /** Village / settlement label shown in the info window. */
  village: string;
  /** Approximate village-center latitude (WGS84). */
  lat: number;
  /** Approximate village-center longitude (WGS84). */
  lng: number;
}

/** A point augmented with the storefront profile slug when its name matches a
 *  real farmer in the live roster; `slug` is null when there is no match (the
 *  info window then shows name + village only, no profile link). */
export interface ResolvedMapPoint extends FarmerMapPoint {
  slug: string | null;
}

export const FARMER_MAP_POINTS: FarmerMapPoint[] = [
  { name: 'Мариана Петкова', village: 'Плачидол', lat: 43.62, lng: 27.72 },
  { name: 'Даниела Василева', village: 'Ведрина', lat: 43.53, lng: 27.66 },
  { name: 'Сладкарница', village: 'Сенокос', lat: 43.47, lng: 28.06 },
  { name: 'Денис', village: 'Искра', lat: 43.66, lng: 27.75 },
  { name: 'Ферма Калата', village: 'Русе', lat: 43.849, lng: 25.954 },
  { name: 'Азер', village: 'Белеградец', lat: 43.35, lng: 27.42 },
  { name: 'BT juice', village: 'Варна', lat: 43.204, lng: 27.91 },
  { name: 'Димка Четова', village: 'Крушари', lat: 43.87, lng: 27.78 },
  { name: 'Красимир Михайлов', village: 'Храброво', lat: 43.47, lng: 28.02 },
  { name: 'Красимир Костадинов', village: 'Зимница', lat: 43.34, lng: 27.55 },
  { name: 'Снежанка Добрева', village: 'с. Дъбрава', lat: 43.57, lng: 27.80 },
  { name: 'Ирена Михайлова', village: 'с. Бранище', lat: 43.62, lng: 27.95 },
  { name: 'Васил Цанчев', village: 'Галата', lat: 43.176, lng: 27.918 },
];

/** Normalize a name for loose matching: lowercase, trim, collapse internal
 *  whitespace, and drop a leading "ферма " so "Ферма Калата" ↔ "Калата". */
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^ферма\s+/, '');
}

/** Attach each point's `/farmer/<slug>` slug when its name matches a live
 *  farmer (by normalized name); otherwise slug=null. Pure — safe to unit test.
 *  `slugs` is the collision-safe map from `farmerSlugMap(farmers)`. */
export function resolveMapPoints(
  points: FarmerMapPoint[],
  farmers: Farmer[],
  slugs: Map<string, string>,
): ResolvedMapPoint[] {
  const byName = new Map<string, string>();
  for (const f of farmers) {
    const key = normName(f.name);
    const slug = slugs.get(f.id);
    // First writer wins on a duplicate normalized name — deterministic in roster order.
    if (slug && !byName.has(key)) byName.set(key, slug);
  }
  return points.map((p) => ({ ...p, slug: byName.get(normName(p.name)) ?? null }));
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika && npx --yes tsx --test src/lib/farmer-map.test.ts`
Expected: PASS — `# pass 5`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika
git add src/lib/farmer-map.ts src/lib/farmer-map.test.ts
git commit -m "feat(karta): farmer map data + name→profile matcher"
```

---

### Task 2: `/karta` SSR page (map container + fallback list, no client yet)

**Files:**
- Create: `src/pages/karta.astro`

**Interfaces:**
- Consumes: `getCatalog()` from `../lib/api` (returns `{ storefront, farmers, ... }`); `farmerSlugMap` from `../lib/farmer-slug`; `FARMER_MAP_POINTS`, `resolveMapPoints` from `../lib/farmer-map`; `Layout` from `../components/Layout.astro`.
- Produces: the `/karta` route with `<div id="farmerMap" data-maps-key data-points>` and `<ul id="mapFallback">`, both consumed by the Task 3 client script.

- [ ] **Step 1: Create the page**

Create `src/pages/karta.astro`:

```astro
---
import Layout from '../components/Layout.astro';
import { getCatalog } from '../lib/api';
import { farmerSlugMap } from '../lib/farmer-slug';
import { FARMER_MAP_POINTS, resolveMapPoints } from '../lib/farmer-map';

export const prerender = false;

// Browser Google Maps key — read at REQUEST time from the container runtime env
// (Dokploy), NOT a build-time import.meta.env constant (prod image is built in CI
// before Dokploy supplies the env). Same pattern as checkout.astro. Empty key →
// the map stays off and the fallback village list is the page.
const runtimeEnv = (globalThis as any).process?.env ?? {};
const mapsKey = String(
  runtimeEnv.PUBLIC_GOOGLE_MAPS_KEY ?? import.meta.env.PUBLIC_GOOGLE_MAPS_KEY ?? '',
).trim();

const { storefront: sf, farmers } = await getCatalog();
const slugs = farmerSlugMap(farmers);
const points = resolveMapPoints(FARMER_MAP_POINTS, farmers, slugs);

const metaDesc = `Виж на картата откъде идват фермерите и стопанствата зад продуктите на ${sf.name}.`;
---
<Layout title={`Карта на фермерите · ${sf.name}`} description={metaDesc} storefront={sf} pageLabel="Карта">
  <main>
    <div class="wrap">
      <nav class="breadcrumb"><a href="/">Начало</a> / <span>Карта</span></nav>
    </div>

    <section class="section--tight">
      <div class="wrap">
        <div class="section-head">
          <span class="eyebrow">Откъде идва храната</span>
          <h1 style="margin-top:8px">Карта на фермерите</h1>
          <p>Нашите фермери и стопанства из България. Точките са приблизителни — по селото на стопанството.</p>
        </div>

        <div
          id="farmerMap"
          class="farmer-map"
          hidden
          data-maps-key={mapsKey}
          data-points={JSON.stringify(points)}
          aria-label="Карта с местоположението на фермерите"
        ></div>

        <ul id="mapFallback" class="map-fallback">
          {points.map((p) => (
            <li class="map-fallback__item">
              <span class="map-fallback__village">{p.village}</span>
              {p.slug
                ? <a class="map-fallback__name" href={`/farmer/${p.slug}`}>{p.name}</a>
                : <span class="map-fallback__name">{p.name}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  </main>

  <style>
    .farmer-map {
      width: 100%;
      min-height: 460px;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--border, #e5e7eb);
      background: var(--surface-2, #f3f4f6);
    }
    .map-fallback {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    .map-fallback__item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 14px 16px;
      border-radius: 12px;
      background: var(--surface-2, #f3f4f6);
      border: 1px solid var(--border, #e5e7eb);
    }
    .map-fallback__village { font-size: 13px; color: var(--muted, #6b7280); }
    .map-fallback__name { font-weight: 600; color: var(--text, #111827); text-decoration: none; }
    a.map-fallback__name:hover { text-decoration: underline; }
    @media (max-width: 480px) { .farmer-map { min-height: 380px; } }
  </style>
</Layout>
```

- [ ] **Step 2: Typecheck**

Run: `cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika && npm run check`
Expected: no errors for `karta.astro` (pre-existing warnings elsewhere are fine).

- [ ] **Step 3: Verify the page renders (fallback visible, map hidden)**

Start the dev server and load `/karta`:
- `preview_start` with `{ name: "chaika-dev" }` (port 4321 from `.claude/launch.json`), then `navigate` to `http://localhost:4321/karta`.
- `read_page` (or `get_page_text`): confirm the heading „Карта на фермерите" and the 13 fallback items (village + name) render. The `#farmerMap` div is `hidden` (no client script yet), so only the fallback list shows — this is the intended no-JS state.
- `read_console_messages`: no errors.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika
git add src/pages/karta.astro
git commit -m "feat(karta): SSR page with map container + no-JS village fallback"
```

---

### Task 3: Client map script (markers, fit-bounds, info windows)

**Files:**
- Create: `src/scripts/farmer-map.ts`
- Modify: `src/pages/karta.astro` (add the `<script>` import at the end of `<main>`)

**Interfaces:**
- Consumes: `#farmerMap` element with `data-maps-key` and `data-points` (a JSON array of `{name, village, lat, lng, slug}`), and `#mapFallback` (from Task 2).
- Produces: none (side-effecting DOM/map init only).

- [ ] **Step 1: Write the client script**

Create `src/scripts/farmer-map.ts`:

```ts
// Renders the /karta farmer map. Reads the key + points off #farmerMap (set
// server-side in karta.astro). Empty key / load failure / no points → leave the
// #mapFallback village list visible and do nothing (no broken empty map box).
//
// Loads the Google Maps JS API once (no `places` library — just base maps),
// drops one marker per point, fits the viewport to all markers, and shows a
// single shared info window with the farmer name + village, plus a
// „Виж профил →" link when the point resolved to a real farmer slug.

interface MapPoint {
  name: string;
  village: string;
  lat: number;
  lng: number;
  slug: string | null;
}

let mapsPromise: Promise<any> | null = null;

function loadMaps(key: string): Promise<any> {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.google?.maps) {
      resolve(w.google.maps);
      return;
    }
    const cb = '__ffKartaMapsReady';
    w[cb] = () => resolve(w.google.maps);
    const s = document.createElement('script');
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&language=bg&region=BG&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error('maps load failed'));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  );
}

function infoHtml(p: MapPoint): string {
  const head = `<div style="font-weight:700;margin-bottom:2px">${esc(p.name)}</div>`;
  const village = `<div style="color:#6b7280;font-size:13px">${esc(p.village)}</div>`;
  const link = p.slug
    ? `<a href="/farmer/${encodeURIComponent(p.slug)}" style="display:inline-block;margin-top:6px;font-weight:600">Виж профил →</a>`
    : '';
  return `<div style="min-width:150px;line-height:1.35">${head}${village}${link}</div>`;
}

function init(): void {
  const el = document.getElementById('farmerMap');
  const fallback = document.getElementById('mapFallback');
  if (!el) return;

  const key = el.dataset.mapsKey || '';
  let points: MapPoint[] = [];
  try {
    points = JSON.parse(el.dataset.points || '[]');
  } catch {
    points = [];
  }
  if (!key || points.length === 0) return; // keep fallback visible

  // Reveal the container BEFORE creating the map so it has real dimensions.
  el.hidden = false;

  loadMaps(key)
    .then((maps: any) => {
      const map = new maps.Map(el, {
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      const bounds = new maps.LatLngBounds();
      const info = new maps.InfoWindow();

      for (const p of points) {
        const pos = { lat: p.lat, lng: p.lng };
        const marker = new maps.Marker({ position: pos, map, title: `${p.name} · ${p.village}` });
        bounds.extend(pos);
        marker.addListener('click', () => {
          info.setContent(infoHtml(p));
          info.open({ map, anchor: marker });
        });
      }

      map.fitBounds(bounds, 48);
      // Clamp the INITIAL zoom only (a tight cluster would otherwise zoom to
      // street level); the user can still zoom in afterwards.
      maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > 11) map.setZoom(11);
      });

      // Map is up — hide the text fallback.
      if (fallback) fallback.hidden = true;
    })
    .catch(() => {
      // Bad key / API off / offline → restore the fallback, hide the empty box.
      el.hidden = true;
      if (fallback) fallback.hidden = false;
    });
}

init();
```

- [ ] **Step 2: Import the script in the page**

In `src/pages/karta.astro`, add this block right after the closing `</main>` tag (before the `<style>` block):

```astro
  <script>
    import '../scripts/farmer-map';
  </script>
```

- [ ] **Step 3: Typecheck**

Run: `cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika && npm run check`
Expected: no new errors.

- [ ] **Step 4: Browser verification (with a key)**

Ensure a Maps key is available to the dev server. If `.env` lacks `PUBLIC_GOOGLE_MAPS_KEY`, add it (the operator confirmed a key exists), then restart the `chaika-dev` preview so the runtime env read picks it up.

- `navigate` to `http://localhost:4321/karta`.
- `computer {action:"screenshot"}`: the map renders with markers spanning the Dobrich/Varna region (plus the Ruse pin to the west); the fallback list is gone.
- Click a marker that resolves to a real farmer (e.g. one whose name matches the roster): `read_page` confirms the info window shows name + village + a „Виж профил →" link to `/farmer/<slug>`.
- Click an unmatched marker (e.g. „BT juice"): info window shows name + village only, no link.
- `read_console_messages`: no errors.
- `resize_window` to mobile (375px): map height ~380px, controls usable.

If the key isn't available in this environment, verify the negative path instead: with an empty key the `#farmerMap` stays hidden and `#mapFallback` renders all 13 items — and note in the commit/PR that the live-map path needs a keyed environment to see markers.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika
git add src/scripts/farmer-map.ts src/pages/karta.astro
git commit -m "feat(karta): interactive Google map markers + profile info windows"
```

---

### Task 4: Nav link + sitemap entry

**Files:**
- Modify: `src/lib/nav.ts`
- Modify: `src/pages/sitemap.xml.ts:29` (the `STATIC` array)

**Interfaces:**
- Consumes: `navLinks(multiFarmer)` shape (`{ label, href }[]`); the sitemap `STATIC` entry shape (`{ loc, changefreq, priority }`).
- Produces: „Карта" nav link (multiFarmer-gated) and a `/karta` sitemap URL.

- [ ] **Step 1: Add the nav link**

In `src/lib/nav.ts`, add the Карта entry immediately after the Фермери entry, gated on the same `multiFarmer` flag (a single-farmer storefront has nothing to map). The relevant array becomes:

```ts
  return [
    { label: 'Начало', href: '/' },
    ...(multiFarmer ? [{ label: 'Фермери', href: '/farmers' }] : []),
    ...(multiFarmer ? [{ label: 'Карта', href: '/karta' }] : []),
    { label: 'Магазин', href: '/shop' },
    { label: 'Поръчки', href: '/orders' },
    { label: 'За нас', href: '/about' },
    { label: 'Статии', href: '/articles' },
    { label: 'Отзиви', href: '/reviews' },
    { label: 'Контакти', href: '/contact' },
  ];
```

- [ ] **Step 2: Add the sitemap entry**

In `src/pages/sitemap.xml.ts`, add a `/karta` line to the `STATIC` array, right after the `/farmers` entry:

```ts
  { loc: '/farmers', changefreq: 'weekly', priority: '0.7' },
  { loc: '/karta', changefreq: 'monthly', priority: '0.6' },
```

- [ ] **Step 3: Typecheck**

Run: `cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika && npm run check`
Expected: no errors.

- [ ] **Step 4: Verify nav + sitemap**

- `navigate` to `http://localhost:4321/` and `read_page`: the header nav shows „Карта" (multiFarmer storefront). Click it → lands on `/karta`, and the link renders active there.
- `navigate` to `http://localhost:4321/sitemap.xml` and `get_page_text`: contains `<loc>https://farmmarket.bg/karta</loc>`.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika
git add src/lib/nav.ts src/pages/sitemap.xml.ts
git commit -m "feat(karta): nav link + sitemap entry for the farmer map page"
```

---

### Task 5: Full build + final verification

**Files:** none (verification only).

- [ ] **Step 1: Production build**

Run: `cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika && npm run build`
Expected: build succeeds; `farmer-map.test.ts` is NOT emitted as a route (it's not under `src/pages`).

- [ ] **Step 2: Rerun the unit test**

Run: `cd /c/Users/Lenovo/source/repos/fermerski-pazar-chaika && npx --yes tsx --test src/lib/farmer-map.test.ts`
Expected: PASS.

- [ ] **Step 3: Final smoke on the running preview**

- `/karta` renders (map with a key, or fallback without).
- Header „Карта" link present and active on the page.
- No console errors.

- [ ] **Step 4: (No commit)** — verification task only. If everything is green, the branch is ready for review / PR against `main`.

---

## Self-Review

**Spec coverage:**
- `farmer-map.ts` data + matcher → Task 1. ✓
- `/karta` SSR page + runtime key + fallback → Task 2. ✓
- Client map script (markers, fitBounds, info window, „Виж профил") → Task 3. ✓
- Nav link (multiFarmer-gated) → Task 4. ✓
- Sitemap `/karta` → Task 4. ✓
- No-key / load-failure fallback behavior → built into Tasks 2 (hidden container + visible list) and 3 (reveal-on-success / restore-on-failure). ✓
- Approximate coords, Dobrich/Varna for ambiguous villages → Task 1 seed table. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `FarmerMapPoint` / `ResolvedMapPoint` / `resolveMapPoints(points, farmers, slugs)` used identically across Tasks 1–3. The client `MapPoint` interface mirrors `ResolvedMapPoint`'s serialized shape (`{name, village, lat, lng, slug}`). `data-maps-key` → `el.dataset.mapsKey`, `data-points` → `el.dataset.points` consistent between Tasks 2 and 3. ✓

**Note on tests:** The repo has no test runner; introducing vitest for one pure function is unjustified scope. `node:test` via on-demand `npx tsx` gives a real red/green cycle with zero dependency changes, and the file is tree-shaken from the Cloudflare bundle. UI paths are verified in the browser, matching the repo's established practice.
