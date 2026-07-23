// "/karta" explorer: map pin data + the pure farmer filter shared by the
// map/grid views. Pins are one per farmer with a real geocoded `lat`/`lng`
// (from the farmer's registered address, resolved server-side) — no more
// hand-typed village-center guesses; a farmer without coords yet simply
// doesn't get a pin until the backend geocodes their address.
import type { Farmer } from './types';

/** A map pin, augmented with the storefront profile slug when the farmer has
 *  one; `slug` is null when there is no match (the detail panel then has no
 *  „Виж магазина" link). `id` lets the client intersect the matched-farmer
 *  set (from `matchFarmers`) against which pins to draw. */
export interface ResolvedMapPoint {
  /** Farmer id. */
  id: string;
  /** Display name as the operator gave it. */
  name: string;
  /** Village / settlement label shown in the detail panel. */
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
      id: f.id,
      name: f.name,
      village: f.city ?? '',
      lat: f.lat,
      lng: f.lng,
      slug: slugs.get(f.id) ?? null,
    }));
}

/** Minimal farmer shape the explorer filter needs — a structural subset of
 *  `Farmer` so the client's trimmed JSON payload (id/name/role/bio/… only, no
 *  phone/email/position/…) satisfies it directly without a cast. */
export interface FilterableFarmer {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
}

/** Minimal product shape the filter needs. `catId` is the category grouping id
 *  the caller already resolved via `catIdOf`/`categoriesFrom` (lib/catalog.ts)
 *  — this module doesn't import catalog.ts or know about `multiSubcat`, so
 *  filtering stays consistent with whatever taxonomy the sidebar shows. */
export interface FilterableProduct {
  farmerId: string | null;
  name: string;
  catId: string;
}

export interface FarmerFilter {
  /** Search text, matched against name/role/bio/product-names. Comparisons are
   *  done `toLocaleLowerCase('bg')`, so pass the raw (un-normalized) text —
   *  empty/absent = no text filter. */
  q?: string;
  /** Category ids to match — a farmer matches if ANY of its products falls in
   *  ANY of these (OR). Empty/absent = no category filter. */
  cats?: Set<string>;
}

/** /karta explorer filter: `q` matches the farmer's own name/role/bio OR any of
 *  its product names; `cats` matches when the farmer has ≥1 product in the
 *  given category set. The two compose (AND) — either being empty drops that
 *  half of the filter, so an all-empty `filter` matches every farmer. Pure —
 *  safe to unit test. */
export function matchFarmers<F extends FilterableFarmer>(
  farmers: F[],
  products: FilterableProduct[],
  filter: FarmerFilter,
): F[] {
  const q = (filter.q ?? '').trim().toLocaleLowerCase('bg');
  const cats = filter.cats;

  const byFarmer = new Map<string, FilterableProduct[]>();
  for (const p of products) {
    if (!p.farmerId) continue;
    const list = byFarmer.get(p.farmerId);
    if (list) list.push(p);
    else byFarmer.set(p.farmerId, [p]);
  }

  return farmers.filter((f) => {
    const mine = byFarmer.get(f.id) ?? [];
    if (cats && cats.size > 0 && !mine.some((p) => cats.has(p.catId))) return false;
    if (q) {
      const own = [f.name, f.role, f.bio].filter(Boolean).join(' ').toLocaleLowerCase('bg');
      const inOwn = own.includes(q);
      const inProduct = mine.some((p) => p.name.toLocaleLowerCase('bg').includes(q));
      if (!inOwn && !inProduct) return false;
    }
    return true;
  });
}
