# VEGArance

Independent fragrance storefront owned by the project author. Work locally with `cd /home/olamihacks/vegarance` and `npm start`.

Current release: VEGArance identity, ink/plum and ivory palette, responsive catalog, saved scent shortlist, product image uploads, authenticated product/order/settings management. Existing catalog prices and artwork remain illustrative; real sales are not enabled. Browser storage is isolated under `vegarance_` keys.

Before taking real orders: confirm sellable inventory and prices, country/currency and fulfillment policies; connect a payment account and verified webhook; use durable database/upload storage; add transactional email and real shipping/tax rules. The existing free Render filesystem may reset.

## Technical reference

A responsive independent fragrance storefront, with an HTML/CSS/JavaScript frontend and a Node/SQLite backend. Production payment fulfillment remains disconnected. See [RENDER-SETUP.md](RENDER-SETUP.md) for hosting configuration.

## Preview

```sh
cd /home/olamihacks/frag-man-plug/storefront
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://localhost:4173`. Owner preview: `http://localhost:4173/admin.html`.

## Included

- 215 catalog entries across 23 brand groups, search, brand filters, sorting and progressive loading.
- 3ml, 5ml and 10ml size selection; persistent cart, quantities and removal.
- Two-scent hybrid preview and a demo checkout with local confirmation.
- Complete product creation, detail viewing, editing and deletion, including brand, collection, description, prices, availability and image uploads.
- Separate admin for products, demo orders and storefront settings. Node mode uses authenticated API writes and shared SQLite records; static mode remains a clearly labeled browser-only preview.
- Demo order creation, status updates and confirmed deletion.
- Responsive storefront and owner interface; keyboard navigation, dialog focus trapping, reduced-motion support.
- Optimized WebP brand styling and locally served Google Fonts with their SIL Open Font Licenses.
- 215 individually named catalog artworks composed from the existing 23 AI brand images, with consistent cream/brass framing and fragrance titles. These are product-specific compositions, not 215 newly generated photographs or verified retail packaging.

## Demo boundaries

Prices, shipping estimates, sample orders and availability are illustrative. Images are AI-generated brand styling, not verified photographs of exact fragrances. No payments, emails or shipments are created. Demo checkout retains no submitted customer name/email. Static mode saves catalog changes and demo orders in the current browser. Node mode saves shared products, settings and demo orders in SQLite and protects owner mutations with password login, HTTP-only session cookies, same-origin write checks and server validation. Prices and stock are checked again by the backend during demo checkout.

The existing static Render site is not the Node service. The user chose to create a separate free Node web service in the Render dashboard. Free Render filesystem changes may disappear on restarts/redeploys; this is an accepted temporary demo limitation. Local SQLite storage survives local server restarts. Durable production database/upload storage still needs configuration before launch.

Rebuild the individual catalog artwork with `python3 prepare-product-art.py` (requires Pillow and Node.js). Image paths are recorded in `product-images.js`, and the resulting assets live in `images/products/`. This compositor uses existing imagery and calls no image-generation API.

Full bottles and future candle, soap and body collections need confirmed product information before launch. New arrivals have not been identified, so the demo includes a decant size guide instead of invented arrivals. Unsupported reviews, customer ratings, delivery guarantees and return terms have been removed.

The supplied inventory PDF has conflicting totals (221/26 in the header and approximately 200 at the end), plus brand headings inside product lists. The repository currently contains 215 entries across 23 brand groups; confirm ambiguous entries and final availability with the owner before production.

## Validation

```sh
node --check app.js
node --check experience.js
node --check admin.js
python3 test-demo.py
node test-api.mjs
python3 test-crud-layout.py
```

The browser checks require Python Playwright and Chromium and start their own local server. They cover search/reset/pagination, persistent cart/quantities, demo checkout, hybrids, admin price/stock propagation, image responses and mobile navigation. CRUD/layout tests additionally cover both static and Node modes, uploads, cross-browser visibility, confirmed/cancelled deletion, server-backed demo orders, and vertical group overlap, scrolling list containment and expanded FAQ answers at ten viewport widths. The hybrid picker lists are constrained scrolling containers, preventing rows from spilling into later sections.

## Hosting

The current static Render service publishes the repository root. The separate Node service uses `npm start` and the free settings in `render.yaml`; follow [RENDER-SETUP.md](RENDER-SETUP.md). Client GitHub ownership transfer, real pricing, logo, payment provider, durable production storage and final policies remain to be finalized.
