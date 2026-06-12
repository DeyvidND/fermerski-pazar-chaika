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

/** Display metadata per known social-network key (icon name from icons.ts +
 *  human label). 'other' = a free link → globe icon, label from the row. */
export const NETWORKS: { key: string; name: string; icon: string }[] = [
  { key: 'fb', name: 'Facebook', icon: 'fb' },
  { key: 'ig', name: 'Instagram', icon: 'ig' },
  { key: 'yt', name: 'YouTube', icon: 'yt' },
  { key: 'tt', name: 'TikTok', icon: 'tt' },
  { key: 'viber', name: 'Viber', icon: 'viber' },
  { key: 'telegram', name: 'Telegram', icon: 'telegram' },
  { key: 'whatsapp', name: 'WhatsApp', icon: 'whatsapp' },
  { key: 'x', name: 'X', icon: 'x' },
  { key: 'other', name: 'Връзка', icon: 'globe' },
];
const NETWORK_MAP = new Map(NETWORKS.map((n) => [n.key, n]));

/** Pick an icon name (from icons.ts) for a social link by matching a known
 *  network as a substring anywhere in the URL (lenient, so short domains like
 *  fb.me / instagr.am are caught too), falling back to 'globe'. Used only when a
 *  row has no explicit `network` (older data). */
export function socialIconName(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('facebook') || u.includes('fb.com') || u.includes('fb.me')) return 'fb';
  if (u.includes('instagram') || u.includes('instagr.am')) return 'ig';
  if (u.includes('tiktok')) return 'tt';
  if (u.includes('youtube') || u.includes('youtu.be')) return 'yt';
  if (u.includes('t.me') || u.includes('telegram')) return 'telegram';
  if (u.includes('wa.me') || u.includes('whatsapp')) return 'whatsapp';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'x';
  if (u.includes('viber')) return 'viber';
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
    return live.map((s) => {
      const meta = s.network ? NETWORK_MAP.get(s.network) : undefined;
      const icon = meta ? meta.icon : socialIconName(s.url);
      // Known network → its name; 'other'/unknown → the row's own label, else a generic.
      const label =
        meta && meta.key !== 'other' ? meta.name : s.label || meta?.name || 'Социална мрежа';
      return { href: safeHref(s.url), label, icon };
    });
  }
  return SOCIALS.map((s) => ({ href: safeHref(s.href), label: s.label, icon: s.name }));
}

/** Phone: the admin „Контакти“ phone wins, then the tenant's top-level phone.
 *  null → the storefront hides the field (no demo fallback for a real tenant). */
export const contactPhone = (sf: Storefront) => sf.contact?.phone || sf.phone || null;
/** Email: the admin „Контакти“ email wins, then the tenant's top-level email.
 *  null → the storefront hides the field. */
export const contactEmail = (sf: Storefront) => sf.contact?.email || sf.email || null;

/** Extra contact rows the farm added ("каквото иска клиента"); drops empties. */
export const customFields = (sf: Storefront): { label: string; value: string }[] =>
  (sf.contact?.custom ?? []).filter((c) => c.value && c.value.trim());

/** Smart href for a custom-field value: email → mailto, http(s) → safe link,
 *  phone-ish → tel, anything else → null (rendered as plain text). */
export function contactValueHref(value: string): string | null {
  const v = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'mailto:' + v;
  if (/^https?:\/\//i.test(v)) return safeHref(v);
  if (/^\+?[\d][\d\s()\-./]{4,}$/.test(v)) return 'tel:' + v.replace(/\s+/g, '');
  return null;
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
