// Server-side data layer. Each call hits the ФермериБГ public API for the
// configured tenant. Failures degrade gracefully (empty / null) so the
// storefront still renders its skeleton "ghost" + admin-note states rather
// than erroring — the design is reviewable before the admin adds content.
import { PUBLIC_BASE } from './config';
import type {
  Storefront,
  Product,
  Farmer,
  Subcategory,
  Review,
  ReviewSummary,
  Article,
  PublicAvailabilityWindow,
} from './types';

// --- Cloudflare runtime holder (set per-request by src/middleware.ts) ---------
interface SwrRuntime {
  ctx: SwrExecutionContext | null;
  caches: SwrCacheStorage | null;
}
let currentRuntime: SwrRuntime | null = null;

export function setSwrRuntime(rt: SwrRuntime | null): void {
  currentRuntime = rt;
}
function getSwrRuntime(): SwrRuntime | null {
  return currentRuntime;
}

// Short-lived in-process cache for SSR reads. The node-standalone server is one
// long-lived process, so a tiny TTL memo lets repeat renders skip the backend
// round trip, and an in-flight map coalesces concurrent identical reads into a
// single fetch under load (e.g. a burst of visitors all hitting the home page).
// Only successful responses are cached — failures fall through so a recovered
// backend is picked up immediately instead of serving an empty list for the TTL.
const READ_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 3_000;
const FETCH_RETRIES = 1;            // up to 1 retry → 2 attempts; ceiling ~6.15s
const RETRY_BACKOFF_MS = 150;
const SWR_FRESH_MS = 60_000;        // L2 fresh window
const SWR_MAX_AGE_MS = 86_400_000;  // 24h hard cap on stale
const CATALOG_CASCADE_TIMEOUT_MS = 3_500;
const memo = new Map<string, { exp: number; val: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

// --- Cloudflare Cache API accessor -------------------------------------------
// lib.dom types `caches` as `CacheStorage` (no `.default`), but the Workers
// runtime exposes `caches` as a CacheStorage with a `.default` named cache.
// We cast once here so all callers get the right shape without littering casts.
function getGlobalCaches(): SwrCacheStorage | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof caches !== 'undefined' ? (caches as unknown as SwrCacheStorage) : null;
}

// --- Cache key + envelope helpers --------------------------------------------

function swrCacheKey(path: string): string {
  return `https://swr.internal/${encodeURIComponent(PUBLIC_BASE)}${path || '/__root__'}`;
}
function makeCacheResponse(storedAt: number, bodyJson: string): Response {
  return new Response(bodyJson, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=31536000',
      'x-swr-stored': String(storedAt),
    },
  });
}
async function readCache<T>(path: string): Promise<{ storedAt: number; body: T } | null> {
  // Use the Workers global `caches` (always available in the fetch handler,
  // and is the same cache as locals.runtime.caches). Decoupling from the
  // per-request holder avoids a race where a sibling request's middleware
  // `finally` nulls `currentRuntime` mid-render.
  const gc = getGlobalCaches();
  if (!gc) return null;
  try {
    const res = await gc.default.match(swrCacheKey(path));
    if (!res) return null;
    const env = (await res.json()) as { storedAt: number; body: T };
    if (typeof env?.storedAt !== 'number') return null;
    if (Date.now() - env.storedAt > SWR_MAX_AGE_MS) return null;
    return env;
  } catch {
    return null;
  }
}
function writeCache<T>(rt: SwrRuntime | null, path: string, body: T): void {
  // Use the Workers global `caches` for the actual put; `rt` is only needed
  // for ctx.waitUntil (best-effort background extension).
  const gc = getGlobalCaches();
  if (!gc) return;
  const storedAt = Date.now();
  const json = JSON.stringify({ storedAt, body });
  const p = gc.default.put(swrCacheKey(path), makeCacheResponse(storedAt, json)).catch(() => {});
  if (rt?.ctx) rt.ctx.waitUntil(p);
}

// --- Fetch with retry --------------------------------------------------------

async function fetchJson<T>(path: string): Promise<{ ok: true; data: T } | { ok: false }> {
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(`${PUBLIC_BASE}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return { ok: false };
      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch {
      if (attempt < FETCH_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (attempt + 1)));
        continue;
      }
      return { ok: false };
    }
  }
  return { ok: false };
}

// --- Core read primitive (never throws) --------------------------------------

async function get<T>(path: string, fallback: T, ttlMs = READ_TTL_MS): Promise<T> {
  const useCache = ttlMs > 0;

  if (useCache) {
    const hit = memo.get(path);
    if (hit && hit.exp > Date.now()) return hit.val as T;
    const flying = inflight.get(path);
    if (flying) return (await flying) as T;
  }

  const rt = getSwrRuntime();

  if (!useCache) {
    const r = await fetchJson<T>(path);
    return r.ok ? r.data : fallback;
  }

  // Always attempt L2 (CF Cache API) — readCache uses the Workers global
  // `caches` directly, so it is not gated on the per-request holder state.
  const env = await readCache<T>(path);
  if (env) {
    const age = Date.now() - env.storedAt;
    if (age < SWR_FRESH_MS) {
      memo.set(path, { exp: Date.now() + ttlMs, val: env.body });
      return env.body;
    }
    if (rt?.ctx) {
      rt.ctx.waitUntil(revalidate<T>(rt, path, ttlMs));
    } else {
      void revalidate<T>(rt, path, ttlMs);
    }
    memo.set(path, { exp: Date.now() + ttlMs, val: env.body });
    return env.body;
  }

  const run = (async (): Promise<T> => {
    const r = await fetchJson<T>(path);
    if (r.ok) {
      memo.set(path, { exp: Date.now() + ttlMs, val: r.data });
      writeCache(rt, path, r.data);
      return r.data;
    }
    return fallback;
  })();

  inflight.set(path, run);
  try {
    return await run;
  } finally {
    inflight.delete(path);
  }
}

/** Background revalidation: only writes to cache on success; never overwrites
 *  stale data with a failed fetch result. */
async function revalidate<T>(rt: SwrRuntime | null, path: string, ttlMs: number): Promise<void> {
  if (inflight.has(path)) return;
  const run = (async (): Promise<T | undefined> => {
    const r = await fetchJson<T>(path);
    if (r.ok) {
      memo.set(path, { exp: Date.now() + ttlMs, val: r.data });
      writeCache(rt, path, r.data);
      return r.data;
    }
    return undefined;
  })();
  inflight.set(path, run as Promise<unknown>);
  try {
    await run;
  } finally {
    inflight.delete(path);
  }
}

// --- Public API --------------------------------------------------------------

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
  /** Farmer-picked reviews for the home block, in pick order. Empty/absent when
   *  the block is off or nothing is picked. */
  homeReviews?: Review[];
  /** Active availability windows for today. Absent on older backends → treat as [].
   *  Each entry refers to a product by id; remaining=0 means sold out. */
  availability?: PublicAvailabilityWindow[];
  /** Sales-ranked product ids for the „Най-продавани" shop chip, highest first.
   *  Empty/absent when the chip is off or the farm has no sales yet. */
  bestSellerIds?: string[];
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
 *  this on shop/farmers/product pages instead of fanning out 3-5 calls each.
 *  A CATALOG_CASCADE_TIMEOUT_MS cap prevents the fallback fan-out from hanging
 *  when the backend is flaky. */
export async function getCatalog(): Promise<Bootstrap> {
  const boot = await getBootstrap();
  if (boot) {
    seedMemo('', boot.storefront);
    seedMemo('/products', boot.products);
    seedMemo('/farmers', boot.farmers);
    seedMemo('/subcategories', boot.subcategories);
    return boot;
  }
  const fallbackBundle: Bootstrap = {
    storefront: FALLBACK_STOREFRONT,
    products: [], farmers: [], subcategories: [],
    productOfWeek: null, homeReviews: [], availability: [],
  };
  const fan = (async (): Promise<Bootstrap> => {
    const [storefront, products, farmers, subcategories] = await Promise.all([
      getStorefront(), getProducts(), getFarmers(), getSubcategories(),
    ]);
    return {
      storefront: storefront ?? FALLBACK_STOREFRONT,
      products, farmers, subcategories,
      productOfWeek: null, homeReviews: [], availability: [],
    };
  })();
  const timeout = new Promise<Bootstrap>((resolve) =>
    setTimeout(() => resolve(fallbackBundle), CATALOG_CASCADE_TIMEOUT_MS),
  );
  return Promise.race([fan, timeout]);
}

/** Sensible defaults when `GET /public/:slug` is unreachable (dev w/o backend). */
export const FALLBACK_STOREFRONT: Storefront = {
  name: 'Фермерски пазар „Чайка"',
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
  pickup: {
    label: 'Вземане от място',
    address: 'кв. Чайка, бул. „Ал. Стамболийски" (пред „Фратели")',
    hours: 'Всеки петък · 11:00–18:00',
    weekday: 5,
    timeFrom: '11:00',
    timeTo: '18:00',
  },
  media: {},
  contact: { address: null, hours: null, tagline: null, phone: null, email: null, social: [], custom: [], mapLat: null, mapLng: null },
  faviconUrl: null,
  themeColor: null,
  landing: {
    categories: { show: true, count: 0 },
    farmers: { show: true, count: 3 },
    latest: { show: true, count: 4 },
    reviews: { show: false, ids: [] },
  },
  marketing: { ga4: null, googleAds: null, googleAdsLabel: null, metaPixel: null, gtm: null, tiktok: null },
  availabilitySectionEnabled: false,
  copy: {},
  faq: [],
};
