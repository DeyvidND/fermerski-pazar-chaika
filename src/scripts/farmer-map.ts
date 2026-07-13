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
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === "'" ? '&#39;' : '&quot;',
  );
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

/** Inner HTML of a custom popup card. Class-based (styled by the `is:global`
 *  .ff-popup* rules in karta.astro) rather than inline styles, so the card is a
 *  real branded element instead of Google's default white InfoWindow chrome. */
function popupHtml(p: MapPoint): string {
  const close = `<button class="ff-popup__close" type="button" aria-label="Затвори">&times;</button>`;
  const name = `<div class="ff-popup__name">${esc(p.name)}</div>`;
  const village = `<div class="ff-popup__village"><span class="ff-popup__dot"></span>${esc(p.village)}</div>`;
  const link = p.slug
    ? `<a class="ff-popup__link" href="/farmer/${encodeURIComponent(p.slug)}">Виж профил →</a>`
    : '';
  return `<div class="ff-popup__card">${close}${name}${village}${link}</div>`;
}

/** Build a custom OverlayView popup class bound to the loaded Maps namespace.
 *  Google's InfoWindow forces its own white bubble + close button + tail chrome
 *  that can't be fully themed; an OverlayView gives us a plain positioned div we
 *  style entirely ourselves (branded card + tail via CSS). */
function createPopupClass(maps: any): any {
  return class Popup extends maps.OverlayView {
    position: any;
    el: HTMLDivElement;
    constructor(position: any, html: string, onClose: () => void) {
      super();
      this.position = position;
      const el = document.createElement('div');
      el.className = 'ff-popup';
      el.innerHTML = html;
      el.querySelector('.ff-popup__close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        onClose();
      });
      // Let the card be clicked/scrolled without panning/zooming the map under it.
      maps.OverlayView.preventMapHitsAndGesturesFrom(el);
      this.el = el;
    }
    onAdd() {
      this.getPanes().floatPane.appendChild(this.el);
    }
    onRemove() {
      this.el.remove();
    }
    draw() {
      const p = this.getProjection().fromLatLngToDivPixel(this.position);
      if (p) {
        this.el.style.left = `${p.x}px`;
        this.el.style.top = `${p.y}px`;
      }
    }
  };
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
  if (!key || points.length === 0) {
    // No map possible → reveal the text village list (hidden by default in SSR).
    if (fallback) fallback.hidden = false;
    return;
  }

  // Reveal the container BEFORE creating the map so it has real dimensions.
  el.hidden = false;

  loadMaps(key)
    .then((maps: any) => {
      const map = new maps.Map(el, {
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        clickableIcons: false,
        backgroundColor: '#F6F0E2',
      });
      const bounds = new maps.LatLngBounds();
      const icon = pinIcon(maps);
      const Popup = createPopupClass(maps);

      // One popup at a time — opening another (or clicking the map) closes it.
      let current: any = null;
      const closeCurrent = () => {
        if (current) {
          current.setMap(null);
          current = null;
        }
      };

      for (const p of points) {
        const pos = { lat: p.lat, lng: p.lng };
        const marker = new maps.Marker({ position: pos, map, icon, title: `${p.name} · ${p.village}` });
        bounds.extend(pos);
        marker.addListener('click', () => {
          closeCurrent();
          current = new Popup(new maps.LatLng(pos), popupHtml(p), closeCurrent);
          current.setMap(map);
        });
      }
      map.addListener('click', closeCurrent);

      map.fitBounds(bounds, 64);
      // Clamp the INITIAL zoom only (a tight cluster would otherwise zoom to
      // street level); the user can still zoom in afterwards.
      maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > 11) map.setZoom(11);
      });

      // Map is up — the fallback list stays hidden (its SSR default).
      if (fallback) fallback.hidden = true;
    })
    .catch(() => {
      // Bad key / API off / offline → restore the fallback, hide the empty box.
      el.hidden = true;
      if (fallback) fallback.hidden = false;
    });
}

init();
