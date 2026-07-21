// "/karta" pin data: one point per farmer with a real geocoded `lat`/`lng`
// (from the farmer's registered address, resolved server-side). No more
// hand-typed village-center guesses — a farmer without coords yet simply
// doesn't get a pin until the backend geocodes their address.
import type { Farmer } from './types';

/** A map pin, augmented with the storefront profile slug when the farmer has
 *  one; `slug` is null when there is no match (the info window then shows
 *  name + village only, no profile link). */
export interface ResolvedMapPoint {
  /** Display name as the operator gave it. */
  name: string;
  /** Village / settlement label shown in the info window. */
  village: string;
  /** Geocoded latitude (WGS84). */
  lat: number;
  /** Geocoded longitude (WGS84). */
  lng: number;
  slug: string | null;
}

/** Resolve the /karta pins: one per live farmer with a real geocoded
 *  `lat`/`lng`. Pure — safe to unit test. `slugs` is the collision-safe map
 *  from `farmerSlugMap(farmers)`. */
export function resolveMapPoints(farmers: Farmer[], slugs: Map<string, string>): ResolvedMapPoint[] {
  return farmers
    .filter((f): f is Farmer & { lat: number; lng: number } => f.lat != null && f.lng != null)
    .map((f) => ({
      name: f.name,
      village: f.city ?? '',
      lat: f.lat,
      lng: f.lng,
      slug: slugs.get(f.id) ?? null,
    }));
}
