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
