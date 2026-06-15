// src/pages/editable-manifest.json.ts
import type { APIRoute } from 'astro';
import { MANIFEST } from '../lib/editable-manifest';

// The admin panel (cross-origin) fetches this to render the editor. Public data
// (labels/defaults only, no secrets). CORS limited to the configured admin URL.
const ADMIN = import.meta.env.PUBLIC_ADMIN_URL || '';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(MANIFEST), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60',
      ...(ADMIN ? { 'access-control-allow-origin': ADMIN, vary: 'Origin' } : {}),
    },
  });
