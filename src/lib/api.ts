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
  ReviewSummary,
  Article,
} from './types';

// Short-lived in-process cache for SSR reads. The node-standalone server is one
// long-lived process, so a tiny TTL memo lets repeat renders skip the backend
// round trip, and an in-flight map coalesces concurrent identical reads into a
// single fetch under load (e.g. a burst of visitors all hitting the home page).
// Only successful responses are cached — failures fall through so a recovered
// backend is picked up immediately instead of serving an empty list for the TTL.
const READ_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 8_000;
const memo = new Map<string, { exp: number; val: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function get<T>(path: string, fallback: T, ttlMs = READ_TTL_MS): Promise<T> {
  if (ttlMs > 0) {
    const hit = memo.get(path);
    if (hit && hit.exp > Date.now()) return hit.val as T;
    const flying = inflight.get(path);
    if (flying) return (await flying) as T;
  }

  const run = (async (): Promise<T> => {
    try {
      const res = await fetch(`${PUBLIC_BASE}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return fallback;
      const data = (await res.json()) as T;
      if (ttlMs > 0) memo.set(path, { exp: Date.now() + ttlMs, val: data });
      return data;
    } catch {
      return fallback;
    }
  })();

  if (ttlMs <= 0) return run;
  inflight.set(path, run);
  try {
    return await run;
  } finally {
    inflight.delete(path);
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

export const getReviews = () =>
  get<ReviewSummary>('/reviews', { average: 0, count: 0, reviews: [] });

export const getArticles = () =>
  get<Article[]>('/articles', []);

export const getArticle = (slug: string) =>
  get<Article | null>(`/articles/${encodeURIComponent(slug)}`, null, 0);

/** Storefront profile + catalog + farmers + sections in one request. Saves three
 *  round trips on the home page; the backend serves it from cache. Returns null
 *  if the endpoint is unavailable (older backend) so callers can fall back to the
 *  individual reads. */
export interface Bootstrap {
  storefront: Storefront;
  products: Product[];
  farmers: Farmer[];
  subcategories: Subcategory[];
  /** Resolved «Продукт на седмицата» (manual pick or weekly auto-rotation), or
   *  null when the highlight is off. Look the product up in `products` by id. */
  productOfWeek?: { id: string; note: string | null } | null;
}

export const getBootstrap = () =>
  get<Bootstrap | null>('/bootstrap', null);

/** Prime the per-resource memo from a bootstrap payload so a later
 *  getStorefront()/getProducts()/… on the same (or a subsequent within-TTL) render
 *  reuses it instead of issuing its own backend round trip. */
function seedMemo(path: string, val: unknown): void {
  memo.set(path, { exp: Date.now() + READ_TTL_MS, val });
}

/** The catalog bundle every content page needs: profile + products + farmers +
 *  subcategories (+ resolved product-of-week). One backend round trip via
 *  `/bootstrap`; on an older backend without it, falls back to the four individual
 *  (still cached) reads in parallel. Seeds the per-resource memo so single-resource
 *  callers (Layout, cart, checkout) on the same render reuse the same fetch. Use
 *  this on shop/farmers/product pages instead of fanning out 3-5 calls each. */
export async function getCatalog(): Promise<Bootstrap> {
  const boot = await getBootstrap();
  if (boot) {
    seedMemo('', boot.storefront);
    seedMemo('/products', boot.products);
    seedMemo('/farmers', boot.farmers);
    seedMemo('/subcategories', boot.subcategories);
    return boot;
  }
  const [storefront, products, farmers, subcategories] = await Promise.all([
    getStorefront(),
    getProducts(),
    getFarmers(),
    getSubcategories(),
  ]);
  return {
    storefront: storefront ?? FALLBACK_STOREFRONT,
    products,
    farmers,
    subcategories,
    productOfWeek: null,
  };
}

/** Sensible defaults when `GET /public/:slug` is unreachable (dev w/o backend). */
export const FALLBACK_STOREFRONT: Storefront = {
  name: 'Фермерски пазар „Чайка“',
  slug: 'ferma',
  phone: '+359 88 123 4567',
  email: 'info@fermasvezhest.bg',
  deliveryEnabled: false,
  multiFarmer: false,
  multiSubcat: false,
  econtEnabled: false,
  econtMode: 'off',
  codEnabled: true,
  stripeEnabled: false,
  delivery: {
    freeThresholdStotinki: 4000,
    addressFeeStotinki: 490,
    econtFeeStotinki: 350,
    econtAddressFeeStotinki: 590,
  },
  methods: { ownSlots: false, pickup: true, econtOffice: false, econtAddress: false },
  media: {},
  contact: { address: null, hours: null, tagline: null, social: [], mapLat: null, mapLng: null },
  faviconUrl: null,
  themeColor: null,
  landing: {
    categories: { show: true, count: 0 },
    farmers: { show: true, count: 3 },
    latest: { show: true, count: 4 },
  },
};
