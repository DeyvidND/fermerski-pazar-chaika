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

export interface Farmer {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  phone: string | null;
  since: string | null;
  tint: string | null;
  imageUrl: string | null;
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
  deliveryType?: 'address' | 'econt';
  deliveryAddress?: string;
  econtOffice?: string;
  notes?: string;
}

export interface CheckoutResult {
  orderId: string;
  checkoutUrl: string | null;
}
