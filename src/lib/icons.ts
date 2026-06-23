// Inline SVG icon set (ported verbatim from the prototype's app.js FFICON map,
// plus the basket/pin/clock glyphs the home/orders/confirmation pages add).
// Keyed by name; render with `set:html`.
export const ICONS: Record<string, string> = {
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  berry: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8.5" cy="14" r="4"/><circle cx="15.5" cy="14" r="4"/><circle cx="12" cy="9" r="4"/><path d="M12 5c0-2 1-3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2l2.2 12.4a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.3L21 7H6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
  fb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V5.5h-3c-2.2 0-4 1.8-4 4V12H7v3.5h3V22h3.5v-6.5H16L17 12h-3.5V9.5c0-.3.2-.5.5-.5Z"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>',
  tt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2.3 1.9 4 4 4.2V10c-1.5 0-2.9-.5-4-1.3v6.1A5.8 5.8 0 1 1 10.2 9v3.1a2.7 2.7 0 1 0 2 2.6V3h3.8Z"/></svg>',
  yt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3Z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  viber: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6c-5.1 0-8.7 3.3-8.7 7.4 0 2 .9 3.8 2.4 5.1.1 1-.3 2.4-.9 3.4 1.3-.2 2.6-.7 3.6-1.4 1.1.4 2.3.6 3.6.6 5.1 0 8.7-3.3 8.7-7.3S17.1 2.6 12 2.6Zm3.7 9.9c-.2.5-.9 1-1.4 1.1-.4.1-.8.1-2.5-.6-2.1-.9-3.4-3-3.5-3.1-.1-.1-.8-1.1-.8-2.1 0-1 .5-1.5.7-1.7.2-.2.4-.2.5-.2h.4c.2 0 .4 0 .5.4.2.4.6 1.4.6 1.5l.1.3c0 .1 0 .2-.1.3l-.2.3-.2.2c-.1.1-.2.2-.1.4.1.2.5.9 1.1 1.4.8.7 1.4.9 1.6 1 .2.1.3.1.4-.1l.5-.6c.1-.2.3-.1.4-.1.2.1 1.1.5 1.3.6.2.1.3.2.4.3 0 .1 0 .5-.2 1Z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 2.9 11.6c-1 .4-1 1.7.1 2l4.6 1.5 1.8 5.4c.2.6.9.7 1.3.3l2.6-2.4 4.6 3.4c.5.4 1.3.1 1.4-.5l3-15.5c.2-.8-.6-1.4-1.4-1.1ZM9.3 14.2l8.2-5.1c.2-.1.4.2.2.3l-6.7 6.1c-.2.2-.4.5-.4.8l-.2 2.1-1.3-4.2Z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5A9.4 9.4 0 0 0 3.8 16.6L2.7 21l4.5-1.1A9.4 9.4 0 1 0 12 2.5Zm0 1.8a7.6 7.6 0 0 1 6.4 11.7l.1.2-.7 2.6-2.7-.7-.2.1A7.6 7.6 0 1 1 12 4.3Zm-3 3.4c-.2 0-.4.1-.6.3-.2.2-.7.7-.7 1.7s.7 2 .8 2.1c.1.2 1.5 2.3 3.6 3.2 1.8.8 2.1.6 2.5.6.4 0 1.3-.5 1.5-1 .2-.5.2-.9.1-1l-.6-.3s-1-.5-1.2-.6c-.2-.1-.3-.1-.5.1l-.6.7c-.1.1-.2.2-.4.1-.2-.1-.8-.3-1.5-1-.6-.5-1-1.1-1.1-1.3-.1-.2 0-.3.1-.4l.3-.3.2-.3v-.3c0-.1-.5-1.2-.7-1.6-.1-.4-.3-.3-.5-.4Z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3l-6.6 7.5L21.7 21h-6l-4.7-6.1L5.6 21h-3l7-8L2.3 3h6.1l4.2 5.6L17.5 3Zm-1 16h1.6L7.6 4.7H5.9L16.5 19Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.8 6.1 20.7l1.3-6.6L2.5 8.9l6.6-.8Z"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5H18l3 3v3h-7.5"/><circle cx="6.5" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  basket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10h14l-1.2 8.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 10 12 3l3 7"/><path d="M3 10h18"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 3h3l1.5 4.5L9 9.6a12.5 12.5 0 0 0 5.4 5.4l2.1-2.1L21 14.4v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7.5 8 5.5 8-5.5"/></svg>',
  // category taxonomy icons (ФермаСвежест)
  produce: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8.5c-1.4-2-5-2.6-6.6-.2C3.6 11 5 17 8 20c1.5 1.5 2.8 1 4 0 1.2 1 2.5 1.5 4 0 3-3 4.4-9 2.6-11.7C17 5.9 13.4 6.5 12 8.5Z"/><path d="M12 8.5C12 6 13 3.6 16 3"/></svg>',
  dairy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5h6v2.6l1.7 3a3 3 0 0 1 .3 1.3V20a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20V9.4a3 3 0 0 1 .3-1.3l1.7-3z"/><path d="M7.2 12.5h9.6"/></svg>',
  honey: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 4v8l-7 4-7-4V7z"/><path d="M12 8l3.5 2v4L12 16l-3.5-2v-4z"/></svg>',
  meat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.6 10.4a5 5 0 1 0-7 7l-1.9 1.9a2 2 0 1 0 2.8 2.8l1.9-1.9a5 5 0 0 0 4.2-9.8z"/><path d="m14 10 6-6"/><path d="m16.5 3 4.5 4.5"/></svg>',
  jam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9.5h10V20a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20z"/><path d="M8 9.5V7a1 1 0 0 1 .7-1l6.6-2.2"/><path d="M16 9.5V7.2"/><path d="M7.5 13.5h9"/></svg>',
};

export type IconName = keyof typeof ICONS;

/** Best-effort icon by category name (free-text `product.category` fallback). */
export function iconForCategory(name: string | null | undefined): string {
  const n = (name || '').toLowerCase();
  if (/плод|зелен|fruit|produce/.test(n)) return 'produce';
  if (/млеч|сирен|dairy|мляко/.test(n)) return 'dairy';
  if (/мед|honey|пчел/.test(n)) return 'honey';
  if (/мес|meat|колбас/.test(n)) return 'meat';
  if (/слад|сироп|jam|конфитюр|зимнин|буркан|преработ/.test(n)) return 'jam';
  return 'berry';
}
