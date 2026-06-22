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
});
