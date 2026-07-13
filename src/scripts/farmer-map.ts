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

/** Info-window content: a small editorial card matching the site's brand
 *  tokens (Lora serif name, muted village line with an accent dot, and a
 *  pill-style profile link when the point resolved to a real farmer). Colors
 *  are hardcoded to theme.css's values — InfoWindow content sits outside the
 *  page's normal cascade scope, so custom properties aren't a safe bet here. */
function infoHtml(p: MapPoint): string {
  const name = `<div style="font-family:'Lora',Georgia,serif;font-weight:600;font-size:16px;color:#25301F;margin:0 0 4px">${esc(p.name)}</div>`;
  const village =
    `<div style="display:flex;align-items:center;gap:6px;color:#686456;font-size:12.5px;` +
    `margin-bottom:${p.slug ? '10px' : '0'}">` +
    `<span style="width:6px;height:6px;border-radius:50%;background:#E8A33D;flex:none"></span>${esc(p.village)}</div>`;
  const link = p.slug
    ? `<a href="/farmer/${encodeURIComponent(p.slug)}" style="display:inline-flex;align-items:center;gap:4px;` +
      `font-family:'Commissioner',system-ui,sans-serif;font-size:13px;font-weight:600;color:#2C5530;` +
      `text-decoration:none;padding:6px 12px;background:#E7EDE4;border-radius:999px">Виж профил →</a>`
    : '';
  return `<div style="min-width:190px;max-width:240px;font-family:'Commissioner',system-ui,sans-serif;line-height:1.4;padding:2px">${name}${village}${link}</div>`;
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
      const icon = pinIcon(maps);

      for (const p of points) {
        const pos = { lat: p.lat, lng: p.lng };
        const marker = new maps.Marker({ position: pos, map, icon, title: `${p.name} · ${p.village}` });
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
