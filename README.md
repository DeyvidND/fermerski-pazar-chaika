# ФермаСвежест — Фермерски пазар Чайка

Storefront for a Bulgarian farmers-market business (кв. Чайка, Варна), in the
**"Пазар"** theme — a bright, photo-forward look with a full-bleed hero,
mirroring [berriesfresh.net](https://berriesfresh.net/). Built from the
`ФермериБГ Templates` design handoff and wired to the **ФермериБГ** backend's
public storefront API.

## Stack

- **[Astro](https://astro.build/) (SSR, Node standalone adapter)** — pages are
  server-rendered for SEO and always-fresh content; small client scripts handle
  the cart, checkout, mobile drawer, accordion and forms.
- No UI framework — the prototype's hand-authored CSS is reused verbatim
  (`src/styles/{theme,main,home}.css`) so the design is pixel-accurate. The
  single active theme is `data-theme="ferma"` (Пазар).

## Connecting to the backend

Everything comes from the ФермериБГ public API (CORS-open, no auth):

```
GET  /public/:slug                      profile + module toggles
GET  /public/:slug/products             catalog (active products)
GET  /public/:slug/products/:slug       single product
GET  /public/:slug/farmers              [] unless multiFarmer
GET  /public/:slug/subcategories        [] unless multiSubcat
GET  /public/:slug/slots?date=          [] unless deliveryEnabled
GET  /public/:slug/reviews              published reviews + average
POST /public/:slug/checkout             place order -> { orderId, checkoutUrl }
POST /public/:slug/{newsletter,contact,reviews}
```

Configure via env (see `.env.example`):

```
PUBLIC_API_BASE=http://localhost:3000      # ФермериБГ API base
PUBLIC_TENANT_SLUG=ferma-petrovi           # which farm (tenants.slug)
```

### Adaptive to tenant toggles

The storefront reads the tenant profile and adapts:

- **multiFarmer** off → the *Фермери* nav/footer links and the home farmers
  section are hidden; products are grouped by their free-text `category`.
  On → farmers pages + per-farmer category subsections light up.
- **multiSubcat** on → categories come from the tenant's subcategories;
  otherwise they fall back to distinct `product.category` values.
- **deliveryEnabled** on → checkout offers address/Еконт delivery + a live slot
  picker; off → market pickup only.

Until the admin panel adds content, listings render tasteful skeleton "ghost"
cards + an admin note, so the layout is reviewable while empty.

Prices are stored as integer stotinki on the backend and shown as `X,XX лв`.

## Admin panel (the farm owner)

The owner does **not** edit this site — they manage everything in the ФермериБГ
admin panel (the `@fermeribg/web` app) and it shows up here automatically (the
SSR pages re-fetch the public API on each request).

- The footer carries a **"Вход за стопани"** link to `<PUBLIC_ADMIN_URL>/login`
  (default `http://localhost:3005/login`). Point `PUBLIC_ADMIN_URL` at wherever
  the admin panel is deployed.
- In the panel the owner adds products / farmers / subcategories, uploads photos,
  and flips the module toggles (multiFarmer, multiSubcat, deliveryEnabled) — each
  the on/off switch for the matching storefront feature. Add an item → it appears
  here; toggle a module on → its nav/sections light up.
- Demo tenant credentials (from the DB seed): **ivan@ferma-petrovi.bg / ferma1234**.

The storefront is read-only and unauthenticated — it never holds admin
credentials; the link just sends the owner to the panel to sign in.

## Develop

```bash
npm install
cp .env.example .env        # point PUBLIC_API_BASE at your ФермериБГ API
npm run dev                 # http://localhost:3003
```

Make sure the ФермериБГ backend (and its Postgres/Redis) is running and seeded
so the storefront has data to show.

## Build

```bash
npm run build               # outputs dist/ (server + client)
npm run preview             # serves the built standalone server
npm run check               # astro/tsc diagnostics
```

## Pages

`/` home · `/shop` catalog · `/product/[slug]` · `/farmers` · `/farmer/[id]` ·
`/orders` · `/about` · `/reviews` · `/contact` · `/faq` · `/cart` ·
`/checkout` · `/confirmation` · `404`.

Checkout posts a real order; if the farm has a connected Stripe account the
response carries a `checkoutUrl` and we redirect there, otherwise the order is
placed for cash and the customer lands on the confirmation page.
