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
