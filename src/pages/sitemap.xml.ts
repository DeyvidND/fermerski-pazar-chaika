// Dynamic XML sitemap for search engines (Google/Bing). The storefront is SSR
// with a catalog that lives in the ФермериБГ API, so a build-time static sitemap
// (@astrojs/sitemap) can't enumerate products/farmers/articles — we render the
// list at request time from the same cached API reads the pages use.
//
// URLs are absolute against SITE_URL (the canonical customer domain) so the entry
// host matches <link rel="canonical"> and the Workers preview host never leaks in.
// Failures degrade to just the static pages (api.ts never throws), so the sitemap
// is always valid even when the backend is down.
import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/config';
import { getCatalog, getArticles } from '../lib/api';

export const prerender = false;

interface Entry {
  loc: string;
  lastmod?: string | null;
  changefreq?: string;
  priority?: string;
}

// Public, indexable static routes. Excludes transactional/private pages
// (cart, checkout, confirmation, orders) and the 404.
const STATIC: Entry[] = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/shop', changefreq: 'daily', priority: '0.9' },
  { loc: '/farmers', changefreq: 'weekly', priority: '0.7' },
  { loc: '/articles', changefreq: 'weekly', priority: '0.6' },
  { loc: '/orders', changefreq: 'monthly', priority: '0.5' },
  { loc: '/about', changefreq: 'monthly', priority: '0.5' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.5' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.4' },
  { loc: '/reviews', changefreq: 'weekly', priority: '0.4' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.2' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.2' },
  { loc: '/cookies', changefreq: 'yearly', priority: '0.2' },
];

const xmlEscape = (s: string): string =>
  s.replace(/[&<>'"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === "'" ? '&apos;' : '&quot;',
  );

/** Build an absolute, XML-safe URL from a path whose dynamic segments are already
 *  encoded. */
const abs = (path: string): string => xmlEscape(`${SITE_URL}${path}`);

/** YYYY-MM-DD from an ISO timestamp, or undefined when absent/unparseable. */
function isoDate(ts: string | null | undefined): string | undefined {
  if (!ts) return undefined;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function renderUrl(e: Entry): string {
  const parts = [`    <loc>${abs(e.loc)}</loc>`];
  const lastmod = isoDate(e.lastmod);
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
  if (e.priority) parts.push(`    <priority>${e.priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

export const GET: APIRoute = async () => {
  const [catalog, articles] = await Promise.all([getCatalog(), getArticles()]);

  const entries: Entry[] = [...STATIC];

  for (const p of catalog.products) {
    if (!p.slug || p.isActive === false) continue;
    entries.push({
      loc: `/product/${encodeURIComponent(p.slug)}`,
      lastmod: p.createdAt,
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  for (const f of catalog.farmers) {
    entries.push({
      loc: `/farmer/${encodeURIComponent(f.id)}`,
      lastmod: f.createdAt,
      changefreq: 'monthly',
      priority: '0.6',
    });
  }

  for (const a of articles) {
    if (a.status !== 'published') continue;
    entries.push({
      loc: `/articles/${encodeURIComponent(a.slug)}`,
      lastmod: a.updatedAt ?? a.publishedAt ?? a.createdAt,
      changefreq: 'monthly',
      priority: '0.5',
    });
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map(renderUrl).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // Edge-cache 1h, serve stale while revalidating — the catalog moves slowly
      // and crawlers don't need second-fresh data.
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
};
