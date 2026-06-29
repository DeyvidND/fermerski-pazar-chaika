// robots.txt served from the origin so we control the `Sitemap:` directive (so
// Google/Bing auto-discover the sitemap without a manual submit). We also keep
// the AI-scraper blocks Cloudflare's managed robots used to inject — replicated
// here so making the origin authoritative doesn't silently drop them.
import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/config';

export const prerender = false;

// AI training / scraping crawlers we don't want harvesting the catalog. Search
// crawlers (Googlebot, Bingbot, …) are intentionally NOT listed → fully allowed.
const AI_BOTS = [
  'Amazonbot',
  'Applebot-Extended',
  'Bytespider',
  'CCBot',
  'ClaudeBot',
  'Google-Extended',
  'GPTBot',
  'meta-externalagent',
];

export const GET: APIRoute = () => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    // Keep transactional / private pages out of the index.
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /confirmation',
    'Disallow: /orders',
    '',
    ...AI_BOTS.flatMap((bot) => [`User-agent: ${bot}`, 'Disallow: /', '']),
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  });
};
