// Public storefront shapes returned by the ФермериБГ `/public/:slug/*` API.
// These mirror @fermeribg/types' Public* types (tenant_id + internal fields
// already stripped server-side).

/** One dynamic landing block. `mode`/`ids` are absent on an older backend → the
 *  storefront treats the block as auto (count-driven), preserving old behavior. */
export interface LandingBlock {
  show: boolean;
  mode?: 'auto' | 'manual';
  count: number;
  ids?: string[];
}

export interface Storefront {
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  deliveryEnabled: boolean;
  multiFarmer: boolean;
  multiSubcat: boolean;
  econtEnabled: boolean;
  // Econt mode: 'off' | 'manual' (free-text office, ship-it-yourself) | 'auto'
  // (live API office picker). The office picker is used only in 'auto'.
  econtMode: 'off' | 'manual' | 'auto';
  // Customer payment options, mirroring the admin panel. `codEnabled`: наложен
  // платеж (pay on delivery) is offered. `stripeEnabled`: the farm can take card
  // payments now. Absent (older backend) → COD on, card off (cash-first).
  codEnabled?: boolean;
  stripeEnabled?: boolean;
  // Whether the farm runs BOTH Econt and Speedy live — when true the door-delivery
  // checkout shows a carrier comparison/picker. Absent (older backend) → off.
  comparisonActive?: boolean;
  // How a door order picks its carrier when both run: 'customer' (the buyer picks),
  // 'cheapest' (server ships the cheaper), or a forced 'econt'/'speedy'. Absent → 'customer'.
  carrierPolicy?: 'customer' | 'cheapest' | 'econt' | 'speedy';
  // Whether Speedy live pricing/fulfillment is configured for this farm (and the
  // deliveries package is on). Door delivery is offered when Econt-address is on OR
  // this is true — mirrors the backend courierDoorEnabled(). Absent → off.
  speedyConfigured?: boolean;
  // Read-only delivery pricing from the farm's config (cents). The server is
  // authoritative at checkout; these are for display. freeThreshold 0 = no free.
  delivery: DeliveryPricing;
  // Per-method on/off flags — the storefront shows only the methods the farm
  // switched on. Optional (older backend) → callers fall back to sensible defaults.
  methods?: DeliveryMethods;
  pickup?: PickupInfo;
  ownSlots?: OwnSlotsInfo;
  // Tenant-uploaded photos for the static decorative slots, keyed by catalog slot
  // id (e.g. "home.hero"). Optional: older backends omit it. Empty/missing slot →
  // the MediaSlot wrapper renders its `.ph` mock.
  media?: Record<string, { url: string }>;
  // Editable contact block from the farm's admin. Optional (older backend) →
  // the storefront falls back to its static copy in site.ts.
  contact?: {
    address: string | null;
    hours: string | null;
    tagline: string | null;
    phone: string | null;
    email: string | null;
    // `network`: known key ('fb'|'ig'|'yt'|'tt'|'viber'|'telegram'|'whatsapp'|'x'|
    // 'other') driving the icon; absent on older rows → guessed from the url.
    social: { network?: string; label: string; url: string }[];
    // Arbitrary extra contact rows the farm added; empty ones are dropped server-side.
    custom: { label: string; value: string }[];
    mapLat: string | null;
    mapLng: string | null;
  };
  // Tenant website icon + browser theme color. Null/absent → static defaults.
  faviconUrl?: string | null;
  themeColor?: string | null;
  // «Продукт на седмицата» placement: 'section' (full banner under the hero, the
  // default) or 'bar' (a thin announcement strip above the header, site-wide).
  // Absent (older backend) → 'section'. The product itself comes from `productOfWeek`.
  productOfWeekPlacement?: 'section' | 'bar';
  // Configurable landing blocks (settings.landing). Optional (older backend) →
  // index.astro falls back to DEFAULT_LANDING (all cats, 3 farmers, 4 latest).
  // Each dynamic block: `mode: 'auto'` shows the first N (count); `mode: 'manual'`
  // shows exactly the hand-picked `ids` (older backend omits mode/ids → auto).
  landing?: {
    categories: LandingBlock;
    farmers: LandingBlock;
    latest: LandingBlock;
    reviews: { show: boolean; ids: string[] };
  };
  // Merchandising toggles (settings.merchandising). Optional (older backend) →
  // both features treated as off. bestSellers gates the shop „Най-продавани" chip;
  // recommendations gates the cart's „Често купувано заедно" picks.
  merchandising?: {
    bestSellers: { show: boolean };
    recommendations: { show: boolean };
  };
  // Per-vendor ad/analytics tracking IDs (settings.marketing). Optional (older
  // backend) → no scripts injected. A null field = that vendor is off. IDs are
  // server-validated (alphanumeric + -/_ only), safe to interpolate into <script>.
  marketing?: {
    ga4: string | null;
    googleAds: string | null;
    googleAdsLabel: string | null;
    metaPixel: string | null;
    gtm: string | null;
    tiktok: string | null;
  };
  // «Налично сега» home section. Optional (older backend) → section hidden.
  availabilitySectionEnabled?: boolean;
  // Editable body copy (settings.copy) — slot key → override text. Optional (older
  // backend) → CopySlot renders its inline fallback. Empty value = use the default.
  copy?: Record<string, string>;
  // Editable FAQ list (settings.faq). Optional/empty → faq.astro uses DEFAULT_FAQ.
  faq?: { q: string; a: string }[];
}

/** A single active availability window from the ФермериБГ API.
 *  Returned by both `GET /public/:slug/bootstrap` (preferred) and the
 *  dedicated `GET /public/:slug/availability` endpoint. */
export interface PublicAvailabilityWindow {
  productId: string;
  startsAt: string;
  endsAt: string;
  quantity: number;
  remaining: number;
}

export interface DeliveryPricing {
  freeThresholdStotinki: number;
  addressFeeStotinki: number;
  econtFeeStotinki: number;
  econtAddressFeeStotinki: number;
}

/** Per-method on/off flags from the farm's config. */
export interface DeliveryMethods {
  ownSlots: boolean;
  pickup: boolean;
  econtOffice: boolean;
  econtAddress: boolean;
}

/** Pickup/market info (label, address, hours, optional fixed weekday+time
 *  schedule). Optional (older backend) → checkout falls back to a generic label
 *  and no schedule line. */
export interface PickupInfo {
  label: string;
  address: string | null;
  hours: string | null;
  /** 0=Sun..6=Sat, or null when the farm hasn't set a fixed schedule. */
  weekday: number | null;
  timeFrom: string | null;
  timeTo: string | null;
}

/** Own self-delivery (local courier) recurring schedule, pre-formatted server-side
 *  from the farm's `SlotRule`. Optional (older backend) → checkout drops the
 *  day/time line rather than showing a stale hardcoded one. `schedule` null means
 *  no fixed day/time to show (rule off, or weekdays mode with no days picked). */
export interface OwnSlotsInfo {
  active: boolean;
  schedule: string | null;
}

/** A purchasable option of a product (вид/грамаж). Server-computed; raw stock is
 *  never exposed — only `soldOut`. `salePriceStotinki` present = promo active. */
export interface PublicProductVariant {
  id: string;
  label: string;
  priceStotinki: number;
  salePriceStotinki?: number | null;
  soldOut: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  priceStotinki: number;
  unit: string;
  weight: string | null;
  category: string | null;
  tint: string | null;
  isActive: boolean | null;
  imageUrl: string | null;
  /** Cover framing for the card; null/absent = centered, no zoom. */
  coverCrop?: CoverCrop | null;
  /** Ordered gallery (cover first). Optional: older backends omit it; derive a
   *  fallback from `imageUrl`. */
  images?: string[];
  farmerId: string | null;
  subcategoryId: string | null;
  bundleItems: string[] | null;
  compareAtPriceStotinki: number | null;
  featured: boolean;
  /** Pickup-only: never shipped by courier (perishable/fragile). The checkout
   *  hides courier/Еконт delivery when any cart product has this set. */
  courierDisabled?: boolean;
  createdAt: string | null;
  /** Promotion (additive). `salePriceStotinki` = headline discounted price for the
   *  base/cheapest; `salePercent`/`saleEndsAt` are informational. Absent = no promo. */
  salePercent?: number | null;
  saleEndsAt?: string | null;
  salePriceStotinki?: number | null;
  /** Purchasable options. Empty/absent = a plain single-price product. */
  variants?: PublicProductVariant[];
}

/** How a cover image is framed: focal point (x/y, 0..1) + zoom (1..3). Returned
 *  by the ФермериБГ public API; null/absent = centered, no zoom. */
export interface CoverCrop {
  x: number;
  y: number;
  zoom: number;
  shape?: 'wide' | 'square' | 'tall';
}

export interface Farmer {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  since: string | null;
  tint: string | null;
  imageUrl: string | null;
  coverCrop?: CoverCrop | null;
  images?: string[];
  position: number;
  createdAt: string | null;
  /** Phase 2: farmer offers nationwide courier delivery (enabled + carrier connected). */
  courierReady?: boolean;
  /** Legal seller identity (farmer-as-seller marketplace). КЗП disclosure — the buyer
   *  contracts with this producer, not the platform. NULL / absent = not yet provided. */
  legal?: {
    kind?: 'individual' | 'sole_trader' | 'company';
    name?: string;
    eik?: string;
    vatNumber?: string;
    address?: string;
    regNo?: string;
    confirmedAt?: string;
  } | null;
}

export interface Subcategory {
  id: string;
  name: string;
  description: string | null;
  tint: string | null;
  imageUrl: string | null;
  coverCrop?: CoverCrop | null;
  images?: string[];
  position: number;
  createdAt: string | null;
}

export interface Slot {
  id: string;
  date: string; // YYYY-MM-DD
  // A slot is now a whole day (capacity per day, not an hour window). Times are
  // null on a day-row slot; kept as string | null so an older backend that still
  // sends hour windows keeps working.
  startTime: string | null; // HH:MM
  endTime: string | null; // HH:MM
  // Orders still bookable that day; null/absent = unlimited (no capacity cap).
  remaining?: number | null;
  // Optional farmer note shown to the customer (e.g. "ще се обадя преди доставка").
  customerNote?: string | null;
}

export interface Review {
  id: string;
  authorName: string;
  authorLocation: string | null;
  rating: number;
  body: string;
  createdAt: string | null;
}

export interface ReviewSummary {
  average: number;
  count: number;
  reviews: Review[];
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
  variantId?: string;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  slotId?: string;
  deliveryType?: 'pickup' | 'address' | 'econt' | 'econt_address' | 'courier';
  deliveryAddress?: string;
  deliveryCity?: string;
  econtOffice?: string;
  // How the customer pays: 'online' (Stripe card) or 'cod' (наложен платеж).
  paymentMethod?: 'online' | 'cod';
  notes?: string;
}

export interface CheckoutResult {
  orderId: string;
  checkoutUrl: string | null;
  /** Present for a courier order split into one COD order per farmer. */
  orders?: {
    orderId: string;
    orderNumber: number | null;
    farmerId: string | null;
    farmerName: string | null;
    totalStotinki: number;
  }[];
}

export interface ArticleMedia {
  id: string;
  type: 'image' | 'video' | 'youtube' | 'instagram';
  url: string;
  embedId: string | null;
  caption: string | null;
  position: number;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  coverImageUrl: string | null;
  category: string | null;
  status: 'published' | 'draft';
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  media: ArticleMedia[];
}
