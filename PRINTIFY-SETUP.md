# Printify setup for Vegarance

Printify is a print-on-demand supplier adapter, shaped like the existing
CJ / Printful / AliExpress adapters. It reads products from YOUR Printify
shop, builds Vegarance drafts from them, and posts orders that stay On hold
until you confirm them in Printify. It never confirms, submits, or charges
an order on its own.

## 1. Get a Personal Access Token

1. Sign in to Printify.
2. Go to **My Profile → Connections** and generate a **Personal Access
   Token** (API key). If Printify asks you to connect a store first, go to
   **My Stores → Add new store → API** and connect it, then generate the
   token.
3. The token is shown **only once** — copy it immediately into a safe place.
   It cannot be viewed again; if you lose it, generate a new one.
4. Give the token the narrowest scopes this adapter needs:
   `shops.read`, `products.read`, `orders.read`, `orders.write`.
   (`orders.write` is needed because creating an order is a write; the
   adapter never calls send-to-production, so the token alone cannot submit
   charges through this code.)
5. Never paste the token into chat, a doc, or a commit. It lives only in
   the server environment (step 3).

## 2. Find your Shop ID

Your Shop ID is the Printify shop this adapter reads products from. Find
it in the Printify dashboard URL for the shop, or call
`GET https://api.printify.com/v1/shops.json` with the token
(`Authorization: Bearer <token>`) and copy the `id` of the right shop.

## 3. Set the environment variables (Render)

Set these privately in Render → Environment (never in code):

- `PRINTIFY_API_TOKEN` — the Personal Access Token from step 1.
- `PRINTIFY_SHOP_ID` — the Shop ID from step 2.

Then redeploy. Without both, every Printify call fails with an honest
`503` saying what is missing. No token is invented or defaulted anywhere.

## 4. Token expiry + rotation

Personal Access Tokens are valid for **1 year**. When a token expires,
Printify calls start failing (401 → surfaced as `502` by the adapter).
To rotate: generate a new token in Printify (same steps as step 1), replace
`PRINTIFY_API_TOKEN` in Render, redeploy, and delete/revoke the old token
in Printify. Set a calendar reminder a week before the 1-year mark so a
live listing never goes stale because of an expired token.

## 5. What works / what stays manual

Works through the adapter:

- `search` — lists YOUR shop's products and filters by title. Printify
  has no global catalogue search, so only products already in your shop
  appear. Add a product in Printify first, then search for it here.
- `draft` — builds a Vegarance draft from a shop product: variants, base
  cost from Printify, and sale price from your markup. POD has no stock:
  variants are `madeToOrder: true` with `quantity: null` (made to order,
  not zero stock).
- `variant` — re-checks one variant's cost. Variant ids are composite,
  `productId_variantId` (e.g. `111_9001`), because a Printify variant id
  alone does not identify its product.
- `createOrder` — posts the order to Printify. It lands **On hold** and
  stops there. The adapter never calls send-to-production.
- `order` — reads an order's status and tracking (shipments) from Printify.

Stays manual (you do these in the Printify dashboard):

- **Fulfilment confirmation** — review the On-hold order, then send it to
  production in Printify. Nothing in Vegarance confirms or pays for an
  order automatically.
- **Shipping quotes** — Printify exposes no documented public
  shipping-quote endpoint this adapter can rely on, so `freight()` refuses
  with an honest `422`. Get the shipping cost in the Printify dashboard
  when you confirm the order. Do not treat a draft price as including
  shipping.
- **Product creation / artwork** — create and design products in Printify;
  this adapter only reads products that already exist in your shop.
- **Order-approval setting** — set your shop's order approval to
  **manual** in Printify before using `createOrder`. With auto-approve on,
  an On-hold order can proceed to production and charge on its own, which
  would bypass the draft-only safety this adapter is built around.

## 6. Nigeria delivery check (required before listing)

Printify ships through different print providers, and **whether a product
ships to Nigeria depends on the specific product / print provider** — it
is per-product, not account-wide. Before listing any Printify product for
Nigerian buyers:

1. In the Printify dashboard, open the product and check its print
   provider's shipping destinations include Nigeria, plus the shipping
   cost and delivery time to Nigeria.
2. If it does not ship to Nigeria, do not list it for Nigerian buyers
   (or list it only where its provider does deliver, and say so clearly).
3. Remember duties/customs may apply on delivery in Nigeria — confirm
   who pays them before you promise a delivered price.

The adapter cannot verify Nigeria delivery for you; the draft carries a
reminder note, but the check itself is yours.

## 7. Assumptions documented (verify on first live use)

- Base URL `https://api.printify.com/v1`, `Authorization: Bearer <token>`,
  shop-scoped paths `/shops/{shopId}/...`, `.json` suffixes — per
  Printify's public API docs.
- Product detail returns `variants` with a numeric `cost` (the base cost
  used for drafts). If a variant has no usable cost, the draft fails
  loudly instead of guessing.
- Order detail returns `shipments` with `carrier` / `number` / `url` for
  tracking; the adapter also accepts `tracking_number` / `tracking_url`
  spellings defensively.
- Order creation leaves the order On hold (per Printify's own help: API
  orders move into "On hold" and are sent to production according to the
  shop's order-approval settings). Verify the FIRST real order stays On
  hold in the dashboard before relying on this.
- No live connectivity is claimed: until a real token + shop ID are set
  and a real call succeeds, treat Printify as unconfigured.

## 8. Files

- `printify-client.mjs` — the adapter (`createPrintify`).
- `test-printify.mjs` — mock-fetcher tests (no network). Run:
  `node test-printify.mjs`.
- Route wiring (in `server.mjs`, not yet applied — see the wiring snippet
  in the handoff): `GET /api/suppliers/printify/status`,
  `GET /api/suppliers/printify/search`, `POST /api/suppliers/printify/draft`.
