// Drives the /farmers explorer: two-tab „Производители | Карта" toggle, the
// „Филтри" sidebar (search + category checkboxes, multi-select OR, powered by
// `matchFarmers` from lib/farmer-map.ts), the server-rendered <FarmerCard>
// grid (this script only shows/hides each `[data-farmer-id]` wrapper — it
// never rebuilds that markup, so FarmerCard.astro's own styling/behavior is
// preserved), the Google Map (pins only for the currently-filtered farmers,
// re-rendered on every filter change), and a detail panel opened by clicking
// a pin — an HTML sibling positioned over the map (NOT a Maps OverlayView
// popup).
//
// All page data (mapsKey, geocoded pins, the farmer roster, the filterable
// product list, the category id→name lookup) is read off #kartaExplorer's
// dataset — set server-side in farmers.astro. Empty key / no geocoded pins →
// the Карта tab stays hidden and „Производители" is the only (forced) view;
// a Maps load failure at runtime degrades the same way.

import { matchFarmers } from '../lib/farmer-map';
import { wireSearch } from './search';
import { cfImage } from '../lib/img';
import { coverCropStyle } from '../lib/cover-crop';
import { ICONS } from '../lib/icons';
import type { CoverCrop } from '../lib/types';

interface MapPoint {
  id: string;
  name: string;
  village: string;
  lat: number;
  lng: number;
  slug: string | null;
}

interface FarmerPayload {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  city: string;
  imageUrl: string | null;
  coverCrop: CoverCrop | null;
  slug: string | null;
  productCount: number;
  verified: boolean;
}

interface ProductStub {
  farmerId: string | null;
  name: string;
  catId: string;
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
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === "'" ? '&#39;' : '&quot;',
  );
}

function safeParse<T>(json: string | undefined, fallback: T): T {
  try {
    return json ? (JSON.parse(json) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Brand teardrop pin (primary green, cream ring, accent-gold dot) — matches
// theme.css's --primary/--surface/--accent so the map doesn't read as a raw
// default-Google-red-drop against this site's warm, editorial palette.
const PIN_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">` +
  `<path d="M15 0C6.7 0 0 6.7 0 15c0 10.9 15 25 15 25s15-14.1 15-25C30 6.7 23.3 0 15 0z" fill="#2C5530"/>` +
  `<circle cx="15" cy="15" r="6.4" fill="#FBF8F1"/>` +
  `<circle cx="15" cy="15" r="3" fill="#E8A33D"/>` +
  `</svg>`;

/** Marker icon descriptor for the brand pin — built lazily since it needs the
 *  loaded `google.maps.Size`/`Point` constructors. */
function pinIcon(maps: any) {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(PIN_SVG)}`,
    scaledSize: new maps.Size(30, 40),
    anchor: new maps.Point(15, 40),
  };
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('bg');
}

function init(): void {
  const root = document.getElementById('kartaExplorer');
  if (!root) return; // no farmers at all — AdminNote is shown instead, nothing to wire

  const mapsKey = root.dataset.mapsKey || '';
  let mapAvailable = root.dataset.mapAvailable === '1';
  const points: MapPoint[] = safeParse(root.dataset.points, []);
  const farmersData: FarmerPayload[] = safeParse(root.dataset.farmers, []);
  const productsData: ProductStub[] = safeParse(root.dataset.products, []);
  const catsData: { id: string; name: string }[] = safeParse(root.dataset.cats, []);

  const catNameById = new Map(catsData.map((c) => [c.id, c.name]));
  const farmersById = new Map(farmersData.map((f) => [f.id, f]));

  const mapWrap = document.getElementById('farmerMapWrap');
  const mapEl = document.getElementById('farmerMap');
  const gridEl = document.getElementById('farmerGrid');
  // Server-rendered <FarmerCard> wrappers, keyed by farmer id — apply()
  // toggles their inline display (not [hidden], to avoid needing extra CSS
  // specificity rules for grid children) instead of rebuilding any markup.
  const cardEntries = new Map<string, HTMLElement>(
    Array.from(document.querySelectorAll<HTMLElement>('[data-farmer-id]')).map((el) => [
      el.dataset.farmerId!,
      el,
    ]),
  );
  const emptyEl = document.getElementById('kartaEmpty');
  const countEl = document.getElementById('kartaCount');
  const resetBtn = document.getElementById('kartaReset');
  const catsFieldset = document.querySelector<HTMLFieldSetElement>('.km-cats');
  const filtersDetails = document.querySelector<HTMLDetailsElement>('.km-filters');
  const panel = document.getElementById('kartaPanel');
  const panelBody = document.getElementById('kartaPanelBody');
  const panelClose = document.getElementById('kartaPanelClose');

  if (!mapEl || !gridEl) return;

  // Desktop: the sidebar is always expanded — the <details> disclosure is a
  // mobile-only affordance (CSS hides/disables the summary toggle ≥881px, see
  // farmers.astro's is:global <style>). Force it open on load and whenever the
  // viewport crosses back into desktop width.
  const desktopMq = window.matchMedia('(min-width: 881px)');
  const syncFiltersOpen = () => {
    if (desktopMq.matches && filtersDetails) filtersDetails.open = true;
  };
  syncFiltersOpen();
  desktopMq.addEventListener('change', syncFiltersOpen);

  let mapInited = false;
  let map: any = null;
  const markers = new Map<string, any>(); // farmer id -> google.maps.Marker
  let firstFit = true;
  let lastMatched: FarmerPayload[] = farmersData;

  const state = { q: '', cats: new Set<string>() };

  function closePanel(): void {
    if (panel) panel.hidden = true;
    mapWrap?.classList.remove('is-panel-open');
  }

  function openPanel(farmerId: string): void {
    const f = farmersById.get(farmerId);
    if (!f || !panel || !panelBody) return;

    const photo = f.imageUrl
      ? `<img src="${esc(cfImage(f.imageUrl, 640) || f.imageUrl)}" alt="" loading="lazy" decoding="async" style="${coverCropStyle(f.coverCrop)}" />`
      : `<span class="km-card__initials">${esc(initialsOf(f.name))}</span>`;
    const check = f.verified
      ? `<span class="km-card__check" title="Потвърден производител">${ICONS.check}</span>`
      : '';
    const role = f.role ? `<div class="km-panel__role">${esc(f.role)}</div>` : '';
    const city = f.city ? `<div class="km-panel__city">${ICONS.pin}${esc(f.city)}</div>` : '';
    const bio = f.bio ? `<p class="km-panel__bio">${esc(f.bio)}</p>` : '';
    const myCats = new Set(productsData.filter((p) => p.farmerId === f.id).map((p) => p.catId));
    const chips = [...myCats]
      .map((id) => catNameById.get(id))
      .filter((n): n is string => !!n)
      .map((n) => `<span class="km-panel__chip">${esc(n)}</span>`)
      .join('');
    const href = f.slug ? `/farmer/${encodeURIComponent(f.slug)}` : '/farmers';

    panelBody.innerHTML =
      `<div class="km-panel__photo">${photo}</div>` +
      `<h2 class="km-panel__name">${esc(f.name)}${check}</h2>` +
      role +
      city +
      bio +
      (chips ? `<div class="km-panel__chips">${chips}</div>` : '') +
      `<a class="btn btn--primary" href="${href}">Виж магазина →</a>`;

    panel.hidden = false;
    mapWrap?.classList.add('is-panel-open');
  }

  // Panel is a plain DOM sibling of the map (not a Maps OverlayView), so it
  // never receives the map's own click events — stopPropagation here is just
  // defense-in-depth against any wrapping click handlers.
  panel?.addEventListener('click', (e) => e.stopPropagation());
  panelClose?.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel && !panel.hidden) closePanel();
  });

  /** Show only the given farmer ids' server-rendered card wrappers. Inline
   *  style (not [hidden]) so it always wins regardless of the grid's own CSS,
   *  same trick the old plain-list farmers.astro used. */
  function renderGrid(matched: FarmerPayload[]): void {
    const matchedIds = new Set(matched.map((f) => f.id));
    for (const [id, el] of cardEntries) {
      el.style.display = matchedIds.has(id) ? '' : 'none';
    }
  }

  function updateMarkers(matchedIds: Set<string>): void {
    if (!map) return;
    const maps = (window as any).google?.maps;
    if (!maps) return;
    const bounds = new maps.LatLngBounds();
    let any = false;
    for (const [id, marker] of markers) {
      const show = matchedIds.has(id);
      marker.setMap(show ? map : null);
      if (show) {
        bounds.extend(marker.getPosition());
        any = true;
      }
    }
    if (!any) return;
    map.fitBounds(bounds, { top: 64, right: 64, bottom: 64, left: 64 });
    if (firstFit) {
      firstFit = false;
      // Clamp the INITIAL zoom only (a tight cluster would otherwise zoom to
      // street level); the user can still zoom in afterwards, and later
      // filter-triggered re-fits don't reclamp.
      maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > 11) map.setZoom(11);
      });
    }
  }

  function ensureMap(): void {
    if (mapInited || !mapAvailable || !mapEl) return;
    mapInited = true;
    mapEl.hidden = false; // reveal before creating so it has real dimensions

    loadMaps(mapsKey)
      .then((maps: any) => {
        map = new maps.Map(mapEl, {
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          clickableIcons: false,
          backgroundColor: '#F6F0E2',
        });
        const icon = pinIcon(maps);
        for (const p of points) {
          const marker = new maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map: null,
            icon,
            title: `${p.name} · ${p.village}`,
          });
          marker.addListener('click', () => openPanel(p.id));
          markers.set(p.id, marker);
        }
        map.addListener('click', () => closePanel());
        updateMarkers(new Set(lastMatched.map((f) => f.id)));
      })
      .catch(() => {
        // Bad key / API off / offline → hide the map strip entirely; the
        // always-visible card grid below is the page's base state.
        mapAvailable = false;
        if (mapWrap) mapWrap.hidden = true;
        closePanel();
      });
  }

  // Роден Дар layout: the map (when available) sits above the always-visible
  // card grid — no tabs, one combined view driven by the same filters.
  function showMapIfAvailable(): void {
    if (!mapAvailable || !mapWrap) return;
    mapWrap.hidden = false;
    ensureMap();
  }

  function apply(): void {
    const matched = matchFarmers(farmersData, productsData, { q: state.q, cats: state.cats });
    lastMatched = matched;
    renderGrid(matched);
    if (mapInited) updateMarkers(new Set(matched.map((f) => f.id)));

    if (countEl) {
      countEl.textContent = matched.length === 1 ? '1 производител' : `${matched.length} производители`;
    }
    if (emptyEl) emptyEl.hidden = matched.length !== 0;

    const filtering = state.q !== '' || state.cats.size > 0;
    if (resetBtn) resetBtn.hidden = !filtering;
  }

  wireSearch('kartaSearch', (q) => {
    state.q = q;
    apply();
  });

  catsFieldset?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.classList.contains('km-cat__input')) return;
    if (input.checked) state.cats.add(input.value);
    else state.cats.delete(input.value);
    apply();
  });

  resetBtn?.addEventListener('click', () => {
    state.q = '';
    state.cats.clear();
    catsFieldset?.querySelectorAll<HTMLInputElement>('.km-cat__input').forEach((i) => {
      i.checked = false;
    });
    const searchInput = document.getElementById('kartaSearch') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    apply();
  });

  // Initial paint: apply the (unfiltered) card visibility + counts, then
  // reveal the map strip above the grid when a key + geocoded pins exist.
  apply();
  showMapIfAvailable();
}

init();
