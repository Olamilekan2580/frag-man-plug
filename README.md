# The Frag Man Plug

A responsive fragrance storefront demo for Jonathan Castellanos. The current demo uses HTML, CSS and browser JavaScript; React, Node.js, Stripe and a database are future production work, not connected integrations.

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
- Separate admin preview for prices, stock, orders and storefront settings.
- Responsive storefront and owner interface; keyboard navigation, dialog focus trapping, reduced-motion support.
- Optimized WebP brand styling and locally served Google Fonts with their SIL Open Font Licenses.

## Demo boundaries

Prices, shipping estimates, sample orders and availability are illustrative. Images are AI-generated brand styling, not verified photographs of exact fragrances. No payments, emails or shipments are created. Demo checkout saves item summaries in the current browser without retaining the submitted customer name/email. Admin changes persist in this browser only and apply when returning to or refreshing the storefront. The admin preview is public and has no authentication; production requires server-side authorization and persistence.

Full bottles and future candle, soap and body collections need confirmed product information before launch. New arrivals have not been identified, so the demo includes a decant size guide instead of invented arrivals. Unsupported reviews, customer ratings, delivery guarantees and return terms have been removed.

The supplied inventory PDF has conflicting totals (221/26 in the header and approximately 200 at the end), plus brand headings inside product lists. The repository currently contains 215 entries across 23 brand groups; confirm ambiguous entries and final availability with the owner before production.

## Validation

```sh
node --check app.js
node --check experience.js
node --check admin.js
python3 test-demo.py
```

The browser checks require Python Playwright and Chromium and start their own local server. They cover search/reset/pagination, persistent cart/quantities, demo checkout, hybrids, admin price/stock propagation, image responses, mobile navigation and storefront/admin overflow at 320, 375, 390, 480, 768, 820, 1024, 1440 and 1920 pixels.

## Hosting

Render can publish the repository root as a static site with no build command. Connect the `main` branch for automatic deployment. Production hosting, client GitHub ownership transfer, real pricing, logo, payment provider, database, authentication and policies remain to be finalized.
