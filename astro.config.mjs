// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// SSR on Cloudflare Pages/Workers: pages fetch the ФермериБГ public API on the
// server (fresh content + SEO), while cart / checkout / forms hit the same API
// client-side (it is CORS-open).
//
// MIGRATION NOTE (node -> cloudflare): the build now targets the Workers runtime
// instead of a standalone Node server. Runtime env vars are read from
// `Astro.locals.runtime.env` (Cloudflare bindings), NOT `process.env`.
// `platformProxy` makes those bindings available during `astro dev` too.
// See CLOUDFLARE.md for what still needs wiring before this serves traffic.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  server: { port: 3003 },
  devToolbar: { enabled: false },
  // Inline ALL bundled CSS into each page's <head> as <style> instead of a
  // separate <link rel="stylesheet">. The storefront gets heavy in-app-browser
  // traffic (Viber/Messenger/Facebook webviews) on flaky cellular; a render-
  // blocking same-origin CSS request that stalls there leaves WebKit showing a
  // blank white page with the progress bar frozen (reported live). Inlining makes
  // the single HTML response self-sufficient for first paint — zero blocking
  // sub-requests — so the page renders even when a follow-up fetch hangs. Costs a
  // few KB of non-cross-page-cached CSS per HTML doc; first-paint reliability on
  // social traffic outweighs that. (Astro default 'auto' only inlines <4KB, so
  // the ~50KB critical bundle was always an external blocking request.)
  build: { inlineStylesheets: 'always' },
  // Prefetch internal links on hover/tap so navigation feels instant (better
  // Core Web Vitals on click-through). Built-in; no extra client router/JS bundle.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
