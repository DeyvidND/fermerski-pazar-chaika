// Static storefront chrome copy shared by header/footer/pages. Phone + email
// come live from the tenant profile; the market location/hours are presentation
// copy for this farm (Фермерски пазар Чайка, Варна).
export const ADDRESS = 'кв. Чайка, бул. „Ал. Стамболийски“ (пред „Фратели“), Варна';
export const MARKET_HOURS = 'Всеки петък · 11:00–18:00';
export const BRAND_TAG = 'Фермерски пазар · Чайка, Варна';

export const SOCIALS = [
  { name: 'fb', label: 'Facebook', href: 'https://facebook.com' },
  { name: 'ig', label: 'Instagram', href: 'https://instagram.com' },
  { name: 'tt', label: 'TikTok', href: 'https://tiktok.com' },
];

export const DEFAULT_PHONE = '+359 88 123 4567';
export const DEFAULT_EMAIL = 'info@fermasvezhest.bg';

export const telHref = (phone: string) => 'tel:' + phone.replace(/\s/g, '');

/** Origin of the first usable absolute image URL (the tenant's R2/CDN host), for
 *  a `<link rel="preconnect">` so the browser opens that connection before it
 *  meets the first <img>. Returns null when no absolute URL is present. */
export const imageOrigin = (...urls: (string | null | undefined)[]): string | null => {
  for (const u of urls) {
    if (!u) continue;
    try {
      return new URL(u).origin;
    } catch {
      // relative or malformed — skip
    }
  }
  return null;
};
