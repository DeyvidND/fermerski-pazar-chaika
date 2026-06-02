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
