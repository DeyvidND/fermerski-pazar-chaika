// Server-side data layer. Each call hits the FarmFlow public API for the
// configured tenant. Failures degrade gracefully (empty / null) so the
// storefront still renders its skeleton "ghost" + admin-note states rather
// than erroring — the design is reviewable before the admin adds content.
import { PUBLIC_BASE } from './config';
import type {
  Storefront,
  Product,
  Farmer,
  Subcategory,
  Slot,
  ReviewSummary,
} from './types';

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${PUBLIC_BASE}${path}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export const getStorefront = () =>
  get<Storefront | null>('', null);

export const getProducts = () =>
  get<Product[]>('/products', []);

export const getProduct = (slug: string) =>
  get<Product | null>(`/products/${encodeURIComponent(slug)}`, null);

export const getFarmers = () =>
  get<Farmer[]>('/farmers', []);

export const getSubcategories = () =>
  get<Subcategory[]>('/subcategories', []);

export const getSlots = (date?: string) =>
  get<Slot[]>(`/slots${date ? `?date=${date}` : ''}`, []);

export const getReviews = () =>
  get<ReviewSummary>('/reviews', { average: 0, count: 0, reviews: [] });

/** Storefront profile + catalog + farmers + sections in one request. Saves three
 *  round trips on the home page; the backend serves it from cache. Returns null
 *  if the endpoint is unavailable (older backend) so callers can fall back to the
 *  individual reads. */
export interface Bootstrap {
  storefront: Storefront;
  products: Product[];
  farmers: Farmer[];
  subcategories: Subcategory[];
}

export const getBootstrap = () =>
  get<Bootstrap | null>('/bootstrap', null);

/** Sensible defaults when `GET /public/:slug` is unreachable (dev w/o backend). */
export const FALLBACK_STOREFRONT: Storefront = {
  name: 'ФермаСвежест',
  slug: 'ferma',
  phone: '+359 88 123 4567',
  email: 'info@fermasvezhest.bg',
  deliveryEnabled: false,
  multiFarmer: false,
  multiSubcat: false,
  econtEnabled: false,
  delivery: {
    freeThresholdStotinki: 4000,
    addressFeeStotinki: 490,
    econtFeeStotinki: 350,
    econtAddressFeeStotinki: 590,
  },
};
