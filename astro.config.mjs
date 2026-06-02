// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// SSR: pages fetch the FarmFlow public API on the server (fresh content + SEO),
// while cart / checkout / forms hit the same API client-side (it is CORS-open).
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: 3003 },
  devToolbar: { enabled: false },
});
