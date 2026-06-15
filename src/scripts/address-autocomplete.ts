// Google Places Autocomplete for the checkout address field.
//
// The browser Maps key is passed in (read server-side from the runtime env and
// rendered onto the form as data-maps-key — see checkout.astro). It is NOT a
// build-time import.meta.env constant, because the production image is built in
// CI before Dokploy runs it: only a runtime env read sees the Dokploy-provided
// key. Empty key → initAddressAutocomplete() is a no-op and the single address
// field works as plain text (the backend geocodes the typed address).
//
// With a key, the Maps JS + Places library loads lazily (first time address
// delivery is used) and the field suggests real Bulgarian addresses. On pick we:
//   - rewrite the field to the clean chosen address, and
//   - return the precise coords + structured city/postal, so the order carries
//     deliveryLat/deliveryLng and the backend SKIPS its own geocode entirely —
//     no server-side geocoding ambiguity, the pin is exactly what the customer
//     chose.
// Picking is the happy path; a hand-typed address (no pick) still submits and
// the backend geocodes it as a safety net. Any failure (bad key, Places off,
// offline) is swallowed, leaving the plain field working. No regression possible.

export interface PickedAddress {
  lat: number;
  lng: number;
  /** Settlement (locality) from the chosen place — Econt needs it structured. */
  city: string;
  /** Postal code from the chosen place (may be empty). */
  postal: string;
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
 * Wire Places Autocomplete onto the single address input. `onPick` fires with the
 * chosen place ({lat,lng,city,postal}) — or null when the user edits the field by
 * hand after picking, which invalidates the captured pin. No-op without a key.
 */
export function initAddressAutocomplete(
  key: string,
  input: HTMLInputElement,
  onPick: (a: PickedAddress | null) => void,
): void {
  if (!key) return; // no key → plain text field, backend geocodes (today's behaviour)

  loadMaps(key)
    .then((maps: any) => {
      const ac = new maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'bg' },
        fields: ['address_components', 'geometry', 'formatted_address'],
        // 'geocode' (not 'address') → broader, earlier suggestions: streets,
        // neighbourhoods and settlements, not only addresses with a precise house
        // number — so a partial query (e.g. a Burgas street) shows up sooner.
        // Still geographic only (no businesses/POIs).
        types: ['geocode'],
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
        // Show the clean chosen address in the field (drop the ", България" tail).
        // Programmatic value writes do NOT fire 'input', so this won't clear the pin.
        const formatted = (place.formatted_address || input.value).replace(/,?\s*(България|Bulgaria)\s*$/i, '');
        const street = [comp(place, 'route'), comp(place, 'street_number')].filter(Boolean).join(' ');
        const city = comp(place, 'locality') || comp(place, 'administrative_area_level_2');
        input.value = formatted || [street, city].filter(Boolean).join(', ');

        onPick({
          lat: loc.lat(),
          lng: loc.lng(),
          city,
          postal: comp(place, 'postal_code'),
        });
      });

      // Typing after a pick means the address was edited by hand — drop the pin
      // so the backend re-geocodes the final text rather than trusting a stale one.
      input.addEventListener('input', () => onPick(null));
    })
    .catch(() => {
      /* key invalid / Places off / offline → keep plain field (no regression) */
    });
}
