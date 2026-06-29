// Schema.org JSON-LD builders. Structured data makes pages eligible for Google
// rich results: LocalBusiness (map/knowledge panel for the physical Чайка market),
// Product (price + availability under the listing), Article, and breadcrumbs.
//
// Builders are pure (object in → object out); `serializeLd` renders them safely
// into a <script type="application/ld+json"> via the JsonLd.astro component.
// Every value mirrors what the page actually shows (EUR price, real address) —
// mismatched structured data gets the markup ignored or penalised by Google.
import type { Storefront, Product, Article } from './types';
import { SITE_URL } from './config';
import { contactAddress, contactPhone, contactEmail, resolveSocials } from './site';
import { cfImage } from './img';

/** Absolute URL on the canonical site for a path. */
const abs = (path: string): string => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** An absolute http(s) image URL (CDN-transformed when possible), or null when the
 *  source is relative/missing — schema images must be absolute. */
function absImage(url: string | null | undefined, width: number): string | null {
  if (!url) return null;
  const out = cfImage(url, width);
  return out && /^https?:\/\//i.test(out) ? out : null;
}

/** JSON for a <script type="application/ld+json">. Escapes the few characters that
 *  could break out of the script element or trip a JSON parser in HTML. */
export function serializeLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Sitewide WebSite node — ties the brand name to the canonical origin. */
export function websiteLd(sf: Storefront): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: sf.name,
    url: `${SITE_URL}/`,
  };
}

/** The physical farmers' market as a LocalBusiness. Address/phone/socials come
 *  live from the admin „Контакти", with the same static fallbacks the footer uses. */
export function localBusinessLd(sf: Storefront): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/#business`,
    name: sf.name,
    url: `${SITE_URL}/`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: contactAddress(sf),
      addressLocality: 'Варна',
      addressCountry: 'BG',
    },
  };
  const logo = absImage(sf.faviconUrl, 512);
  if (logo) {
    ld.image = logo;
    ld.logo = logo;
  }
  const phone = contactPhone(sf);
  if (phone) ld.telephone = phone;
  const email = contactEmail(sf);
  if (email) ld.email = email;
  if (sf.contact?.mapLat != null && sf.contact?.mapLng != null) {
    ld.geo = {
      '@type': 'GeoCoordinates',
      latitude: sf.contact.mapLat,
      longitude: sf.contact.mapLng,
    };
  }
  const sameAs = resolveSocials(sf)
    .map((s) => s.href)
    .filter((h) => /^https?:\/\//i.test(h));
  if (sameAs.length) ld.sameAs = sameAs;
  return ld;
}

/** A purchasable Product with an Offer (price in EUR + stock state). */
export function productLd(
  p: Product,
  sf: Storefront,
  opts: { priceStotinki: number; soldOut: boolean; images: string[]; description?: string | null },
): Record<string, unknown> {
  const url = abs(`/product/${encodeURIComponent(p.slug ?? '')}`);
  const images = opts.images.map((u) => absImage(u, 1200)).filter((u): u is string => !!u);
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    url,
    brand: { '@type': 'Brand', name: sf.name },
    offers: {
      '@type': 'Offer',
      price: (opts.priceStotinki / 100).toFixed(2),
      priceCurrency: 'EUR',
      availability: opts.soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      url,
    },
  };
  if (images.length) ld.image = images;
  if (opts.description) ld.description = opts.description;
  return ld;
}

/** A blog/news Article for content pages. */
export function articleLd(
  a: Article,
  sf: Storefront,
  opts: { image?: string | null },
): Record<string, unknown> {
  const url = abs(`/articles/${encodeURIComponent(a.slug)}`);
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    url,
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: sf.name },
    publisher: { '@type': 'Organization', name: sf.name },
  };
  if (a.excerpt) ld.description = a.excerpt;
  if (a.publishedAt) ld.datePublished = a.publishedAt;
  const modified = a.updatedAt ?? a.publishedAt;
  if (modified) ld.dateModified = modified;
  const img = absImage(opts.image, 1200);
  if (img) ld.image = img;
  return ld;
}

/** Breadcrumb trail. `path` is a site-relative path; `name` is the crumb label. */
export function breadcrumbLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}
