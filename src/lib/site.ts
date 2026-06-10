// Static storefront chrome copy shared by header/footer/pages. Phone + email
// come live from the tenant profile; the market location/hours are presentation
// copy for this farm (Фермерски пазар Чайка, Варна).
import type { Storefront } from './types';

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

/** Pick an icon name (from icons.ts) for a social link by matching a known
 *  network as a substring anywhere in the URL (lenient, so short domains like
 *  fb.me / instagr.am are caught too), falling back to 'globe'. */
export function socialIconName(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('facebook') || u.includes('fb.com') || u.includes('fb.me')) return 'fb';
  if (u.includes('instagram') || u.includes('instagr.am')) return 'ig';
  if (u.includes('tiktok')) return 'tt';
  if (u.includes('youtube') || u.includes('youtu.be')) return 'yt';
  if (u.includes('viber')) return 'phone';
  return 'globe';
}

/** Allow only safe link schemes for any href built from API/tenant data.
 *  Neutralizes `javascript:`/`data:`/`vbscript:` etc. to '#' — defense-in-depth
 *  on top of the backend's @IsUrl validation, so a future write-path regression
 *  can't turn a tenant social link into stored XSS on the storefront. */
export function safeHref(url: string): string {
  try {
    const proto = new URL(url, 'https://invalid.example').protocol;
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(proto) ? url : '#';
  } catch {
    return '#';
  }
}

/** Resolved social links for rendering: live admin list if present, else the
 *  static SOCIALS fallback. Each row carries an href, label, and icon name. */
export function resolveSocials(sf: Storefront): { href: string; label: string; icon: string }[] {
  const live = (sf.contact?.social ?? []).filter((s) => s.url);
  if (live.length) {
    return live.map((s) => ({ href: safeHref(s.url), label: s.label || 'Социална мрежа', icon: socialIconName(s.url) }));
  }
  return SOCIALS.map((s) => ({ href: safeHref(s.href), label: s.label, icon: s.name }));
}

/** Contact fields with static fallbacks. */
export const contactAddress = (sf: Storefront) => sf.contact?.address || ADDRESS;
export const contactHours = (sf: Storefront) => sf.contact?.hours || MARKET_HOURS;
export const contactTagline = (sf: Storefront) =>
  sf.contact?.tagline ||
  'Фермерски пазар на Чайка, Варна. Местни стопани на едно място — пазарувай на живо всеки петък или поръчай онлайн с доставка до дома.';

/** Keyless Google Maps embed: prefer the admin map pin (lat,lng), else the address text. */
export const mapEmbedSrc = (sf: Storefront) => {
  const q =
    sf.contact?.mapLat && sf.contact?.mapLng
      ? `${sf.contact.mapLat},${sf.contact.mapLng}`
      : contactAddress(sf);
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=15&hl=bg&output=embed`;
};
