// RSS 2.0 feed of published articles, for feed readers and content-discovery
// crawlers. Hand-rolled (like sitemap.xml) instead of @astrojs/rss so it needs
// no extra dependency on the Workers runtime, and reads the same cached API.
import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/config';
import { getStorefront, getArticles, FALLBACK_STOREFRONT } from '../lib/api';

export const prerender = false;

const xmlEscape = (s: string): string =>
  s.replace(/[&<>'"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === "'" ? '&apos;' : '&quot;',
  );

/** RFC-822/1123 date for <pubDate>, or undefined when unparseable. */
function rfcDate(ts: string | null | undefined): string | undefined {
  if (!ts) return undefined;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? undefined : d.toUTCString();
}

export const GET: APIRoute = async () => {
  const [sfRaw, articles] = await Promise.all([getStorefront(), getArticles()]);
  const sf = sfRaw ?? FALLBACK_STOREFRONT;

  const published = articles
    .filter((a) => a.status === 'published')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

  const items = published
    .map((a) => {
      const url = `${SITE_URL}/articles/${encodeURIComponent(a.slug)}`;
      const parts = [
        `      <title>${xmlEscape(a.title)}</title>`,
        `      <link>${xmlEscape(url)}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(url)}</guid>`,
      ];
      const pub = rfcDate(a.publishedAt);
      if (pub) parts.push(`      <pubDate>${pub}</pubDate>`);
      if (a.excerpt) parts.push(`      <description>${xmlEscape(a.excerpt)}</description>`);
      return `    <item>\n${parts.join('\n')}\n    </item>`;
    })
    .join('\n');

  const title = `${sf.name} · Статии`;
  const desc = `Новини и статии от ${sf.name}.`;
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>${xmlEscape(title)}</title>\n` +
    `    <link>${SITE_URL}/articles</link>\n` +
    `    <description>${xmlEscape(desc)}</description>\n` +
    `    <language>bg</language>\n` +
    `    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />\n` +
    (items ? `${items}\n` : '') +
    `  </channel>\n` +
    `</rss>\n`;

  return new Response(body, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
};
