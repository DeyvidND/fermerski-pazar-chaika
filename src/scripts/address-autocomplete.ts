// Optional Google Places Autocomplete for the checkout street field.
//
// Graceful degradation (mirrors the backend's no-key stub mode): when
// PUBLIC_GOOGLE_MAPS_KEY is empty, initAddressAutocomplete() is a no-op and the
// plain structured inputs behave exactly as before — the backend geocodes the
// typed address on order intake. When the key is set, the Maps JS + Places
// library is loaded lazily (first time address delivery is used), the street
// field gets autocomplete, and on pick we:
//   - autofill city / postal / district from the chosen place, and
//   - capture precise coords so the order carries deliveryLat/deliveryLng —
//     the backend then skips its own (billed) Geocoding call and the farm's
//     route pin is exact.
// Any failure (bad key, Places API not enabled, offline) is swallowed, leaving
// the plain inputs fully working. No regression is possible without the key.
import { GOOGLE_MAPS_KEY } from '../lib/config';

export interface PickedCoords {
  lat: number;
  lng: number;
}

interface AddressEls {
  street: HTMLInputElement;
  city?: HTMLInputElement | null;
  postal?: HTMLInputElement | null;
  district?: HTMLInputElement | null;
}

let mapsPromise: Promise<any> | null = null;

/** Load the Maps JS API (places lib) once, resolving to `google.maps`. */
function loadMaps(key: string): Promise<any> {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.google?.maps?.places) {
      resolve(w.google.maps);
      return;
    }
    const cb = '__ffMapsReady';
    w[cb] = () => resolve(w.google.maps);
    const s = document.createElement('script');
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&libraries=places&language=bg&region=BG&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error('maps load failed'));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

/**
 * Wire Places Autocomplete onto the street input. `onPick` fires with the chosen
 * place's coords (or null when the user edits the field after picking, which
 * invalidates the captured pin). No-op when no browser key is configured.
 */
export function initAddressAutocomplete(els: AddressEls, onPick: (c: PickedCoords | null) => void): void {
  if (!GOOGLE_MAPS_KEY) return; // no key → plain inputs, backend geocodes (today's behaviour)

  loadMaps(GOOGLE_MAPS_KEY)
    .then((maps: any) => {
      const ac = new maps.places.Autocomplete(els.street, {
        componentRestrictions: { country: 'bg' },
        fields: ['address_components', 'geometry'],
        types: ['address'],
      });

      const comp = (place: any, type: string): string => {
        const c = (place?.address_components ?? []).find((x: any) => x.types?.includes(type));
        return c ? c.long_name : '';
      };

      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        const loc = place?.geometry?.location;
        if (!loc) {
          onPick(null);
          return;
        }
        // Autofill the structured fields from the chosen place.
        const street = [comp(place, 'route'), comp(place, 'street_number')].filter(Boolean).join(' ');
        if (street) els.street.value = street;
        const city = comp(place, 'locality') || comp(place, 'administrative_area_level_2');
        if (city && els.city) els.city.value = city;
        const postal = comp(place, 'postal_code');
        if (postal && els.postal) els.postal.value = postal;
        const district = comp(place, 'sublocality') || comp(place, 'neighborhood');
        if (district && els.district && !els.district.value) els.district.value = district;

        onPick({ lat: loc.lat(), lng: loc.lng() });
      });

      // Typing after a pick means the address was edited by hand — drop the pin
      // so the backend re-geocodes the final text rather than trusting a stale one.
      els.street.addEventListener('input', () => onPick(null));
    })
    .catch(() => {
      /* key invalid / Places off / offline → keep plain inputs (no regression) */
    });
}
