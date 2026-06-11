// Public storefront shapes returned by the FarmFlow `/public/:slug/*` API.
// These mirror @farmflow/types' Public* types (tenant_id + internal fields
// already stripped server-side).

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
  // Read-only delivery pricing from the farm's config (cents). The server is
  // authoritative at checkout; these are for display. freeThreshold 0 = no free.
  delivery: DeliveryPricing;
  // Per-method on/off flags — the storefront shows only the methods the farm
  // switched on. Optional (older backend) → callers fall back to sensible defaults.
  methods?: DeliveryMethods;
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
    social: { label: string; url: string }[];
    mapLat: string | null;
    mapLng: string | null;
  };
  // Tenant website icon + browser theme color. Null/absent → static defaults.
  faviconUrl?: string | null;
  themeColor?: string | null;
  // Configurable landing blocks (settings.landing). Optional (older backend) →
  // index.astro falls back to DEFAULT_LANDING (all cats, 3 farmers, 4 latest).
  landing?: {
    categories: { show: boolean; count: number };
    farmers: { show: boolean; count: number };
    latest: { show: boolean; count: number };
  };
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
  createdAt: string | null;
}

/** How a cover image is framed: focal point (x/y, 0..1) + zoom (1..3). Returned
 *  by the FarmFlow public API; null/absent = centered, no zoom. */
export interface CoverCrop {
  x: number;
  y: number;
  zoom: number;
}

export interface Farmer {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  phone: string | null;
  since: string | null;
  tint: string | null;
  imageUrl: string | null;
  coverCrop?: CoverCrop | null;
  images?: string[];
  position: number;
  createdAt: string | null;
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
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  remaining: number;
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
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  slotId?: string;
  deliveryType?: 'pickup' | 'address' | 'econt' | 'econt_address';
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
