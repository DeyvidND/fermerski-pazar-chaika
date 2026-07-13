# Design: „Карта на фермерите" — `/karta` page

**Date:** 2026-07-13
**Repo:** `fermerski-pazar-chaika` (Astro storefront, farmmarket.bg / Фермерски пазар Чайка)
**Branch:** `feat/farmer-map`

## Goal

Add a public page that shows every farmer of the marketplace pinned on an
interactive Google Map, by the (approximate) village they come from. Purely a
"meet the region" showcase — the pins are village-center approximations, not
exact farmer addresses. The operator has confirmed approximate placement is
acceptable for now.

## Non-goals

- No exact farmer geocoding. No backend/DB changes, no admin UI, no live
  per-farmer coordinates. (That is the deferred long-term option C below.)
- No delivery/logistics meaning — this is presentation only.
- No marker clustering (13 pins do not need it).

## Approaches considered

- **A — Interactive Google Map on a dedicated `/karta` page (CHOSEN).** Static
  hardcoded farmer→village→lat/lng data file, rendered as pins on the Maps JS
  API. Engaging, cheap, fully decoupled from the API. Reuses the existing
  runtime-maps-key pattern and the existing Maps JS loader style.
- **B — Static Maps image.** One rendered image with pins. No JS, but flat and
  not interactive, needs its own Static Maps signing. Rejected.
- **C — Live data-driven map.** Add lat/lng to farmer profiles in the FarmFlow
  backend + admin + public API, render from live data. Correct long-term but
  heavy (migration + admin UI + per-farmer geocode). Overkill for "approximate,
  for now". Deferred.

## Decisions (from brainstorming)

- **Placement:** a new standalone page `/karta`, linked in the main nav.
- **Pin click:** info window with the farmer name + village, PLUS a
  „Виж профил →" link **only when** the map point's name matches a real farmer
  in the live roster; otherwise text only.
- **Ambiguous villages** (Искра, Зимница, Храброво — several settlements share
  each name in Bulgaria): use the Dobrich/Varna-region settlement. Coordinates
  are approximate and editable in one file; the operator will fine-tune pins later.

## Architecture

Five focused units, all in the chaika repo:

### 1. `src/lib/farmer-map.ts` — static data + matcher (new)

```ts
export interface FarmerMapPoint {
  /** Display name as the operator gave it (farmer or business). */
  name: string;
  /** Village / settlement label shown in the info window. */
  village: string;
  /** Approximate village-center coordinates (WGS84). */
  lat: number;
  lng: number;
}

/** Point augmented with a resolved storefront profile slug when the name
 *  matches a real farmer in the live roster. */
export interface ResolvedMapPoint extends FarmerMapPoint {
  slug: string | null;
}

export const FARMER_MAP_POINTS: FarmerMapPoint[] = [ /* 13 entries, see seed table */ ];

/** Best-effort match each point to a live farmer by normalized name, attaching
 *  its `/farmer/<slug>` slug when found (else slug=null → text-only info window).
 *  Normalization: lowercase, trim, collapse whitespace, strip a leading
 *  "Ферма " prefix so "Ферма Калата" can match a farmer named "Калата". */
export function resolveMapPoints(points, farmers, slugs): ResolvedMapPoint[]
```

Matching is intentionally decoupled from the pin data: the data file never
references API ids, and an unmatched point degrades to a text-only info window.

**Seed table** (approximate, Dobrich/Varna region for the ambiguous ones — to be
fine-tuned by the operator):

| name | village | ~lat | ~lng |
|---|---|---|---|
| Мариана Петкова | Плачидол | 43.62 | 27.72 |
| Даниела Василева | Ведрина | 43.53 | 27.66 |
| Сладкарница | Сенокос | 43.47 | 28.06 |
| Денис | Искра | 43.66 | 27.75 |
| Ферма Калата | Русе | 43.849 | 25.954 |
| Азер | Белеградец | 43.35 | 27.42 |
| BT juice | Варна | 43.204 | 27.910 |
| Димка Четова | Крушари | 43.87 | 27.78 |
| Красимир Михайлов | Храброво | 43.47 | 28.02 |
| Красимир Костадинов | Зимница | 43.34 | 27.55 |
| Снежанка Добрева | с. Дъбрава | 43.57 | 27.80 |
| Ирена Михайлова | с. Бранище | 43.62 | 27.95 |
| Васил Цанчев | Галата | 43.176 | 27.918 |

### 2. `src/pages/karta.astro` — SSR page (new)

- Reads the browser Maps key at **request time** from the container runtime env,
  reusing the exact checkout pattern:
  `const runtimeEnv = (globalThis as any).process?.env ?? {}` then
  `runtimeEnv.PUBLIC_GOOGLE_MAPS_KEY ?? import.meta.env.PUBLIC_GOOGLE_MAPS_KEY ?? ''`.
- `await getCatalog()` for the live `{ storefront, farmers }`; build the
  collision-safe slug map with `farmerSlugMap(farmers)`; call `resolveMapPoints`.
- Renders inside `Layout` (title „Карта на фермерите · <sf.name>", a unique meta
  description, `pageLabel="Карта"`, indexable).
- Emits: a `<section>` head (eyebrow/title/intro), the map container
  `<div id="farmerMap" data-maps-key={mapsKey} data-points={JSON.stringify(points)}>`,
  and a **no-key / no-JS fallback** — a styled list of village + name cards that
  is always in the DOM and only hidden once the map successfully initializes.
- Gate: the page still renders standalone even in single-farmer mode, but the
  nav link only shows in multiFarmer mode (see unit 4). Direct visits always work.

### 3. `src/scripts/farmer-map.ts` — client map init (new)

- Reads `data-maps-key` + `data-points` off `#farmerMap`.
- Empty key or no points → leave the fallback list visible, do nothing.
- Otherwise lazy-load the Maps JS API once (same loader shape as
  `address-autocomplete.ts`, but **no `places` library** — plain
  `maps.googleapis.com/maps/api/js?key=…&language=bg&region=BG&callback=…`),
  create a `google.maps.Map`, drop one marker per point, and
  `map.fitBounds(bounds)` over all markers (with a sane max-zoom so a single
  cluster doesn't zoom to street level).
- One shared `InfoWindow`; on marker click set its content to
  `<b>{name}</b><br><span>{village}</span>` plus
  `<a href="/farmer/{slug}">Виж профил →</a>` when `slug` is present.
- On success, hide the fallback list and reveal the map container.
- All failures (bad key, API off, offline) are swallowed → fallback stays. No
  regression: the page is useful without the map.

### 4. `src/lib/nav.ts` — nav link (edit)

Add `{ label: 'Карта', href: '/karta' }` immediately after the Фермери entry,
gated on the same `multiFarmer` flag (a single-farmer storefront has nothing to
map).

### 5. `src/pages/sitemap.xml.ts` — add `/karta` (edit)

Include the new route in the static page list so it is discoverable (only if the
farmers/multiFarmer surface is enabled, matching how the sitemap already gates
the `/farmers` route if it does).

## Data flow

```
runtime env ─┐
             ├─ karta.astro (SSR) ── getCatalog() ── farmers[] ─┐
Maps key ────┘                                                  ├─ resolveMapPoints() ─ points[{name,village,lat,lng,slug}]
FARMER_MAP_POINTS (static) ────────────────────────────────────┘                        │
                                                                                         ▼
                                          data-maps-key + data-points on #farmerMap  ── farmer-map.ts (client)
                                                                                         │
                                                          load Maps JS ─ markers ─ fitBounds ─ infoWindow(name/village/+profile)
                                                                                         │
                                                                       success → hide fallback list, show map
                                                                       failure → keep fallback list
```

## Error handling / edge cases

- **No Maps key** (local dev without `.env`, or key unset): map never initializes,
  fallback list is the page. Fully functional.
- **Maps JS fails to load** (offline, quota, bad key): swallowed, fallback shown.
- **Name doesn't match any farmer** (e.g. „BT juice", „Сладкарница"): info window
  shows name + village only, no broken profile link.
- **Two farmers slugify the same**: handled by the existing collision-safe
  `farmerSlugMap`, reused unchanged.
- **Empty roster / points**: fallback list renders whatever static points exist;
  map still works, profile links simply resolve to null.

## Testing / verification

- `npm run build` (astro) succeeds, no TS errors.
- Dev server + browser on `/karta`:
  - With a key: 13 markers, bounds fit the region, clicking a pin opens the info
    window; a matched farmer shows „Виж профил →" linking to `/farmer/<slug>`; an
    unmatched one shows text only.
  - Without a key: no map, fallback list of villages + names renders.
  - Nav shows „Карта" (multiFarmer) and it is active on `/karta`.
  - Mobile 375px: map height/controls usable, fallback list readable.

## Out of scope / follow-ups

- Live per-farmer coordinates from the backend (option C).
- Editing pins from the admin panel.
- Directions / "how to reach" from a pin.
