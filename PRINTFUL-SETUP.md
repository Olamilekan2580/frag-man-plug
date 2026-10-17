# Printful (print-on-demand) — setup

Second distributor adapter, CJ-shaped (`printful-client.mjs`). Printful is
print-on-demand: products are made to order, so there are **no stock counts**.
`variant()` returns `{cost, quantity: null, madeToOrder: true}` — treat that
as "made to order", never as zero stock.

## Configure

Set privately in Render Environment (never in version control or chat):

```sh
PRINTFUL_API_TOKEN=   # OAuth private token: Printful Dashboard → Settings → API
PRINTFUL_STORE_ID=    # Optional: only for account-level tokens (multi-store)
```

No token configured: Printful endpoints return 503 with an honest
not-configured message.

## Endpoints (owner login required)

- `GET /api/suppliers/printful/status` → `{configured, market: 'POD',
  orderAutomation: false}`
- `GET /api/suppliers/printful/search?q=...` → `{page, total, products[]}`
  (searches your Printful store products; client-side name filter)
- `POST /api/suppliers/printful/draft` with `{id, category, markup}` →
  Vegarance draft in the same shape as `cj.draft` (variants, prices with
  markup on Printful catalog cost, `supplier: {provider: 'printful', ...}`)

Products imported from a draft are hidden until you review them, like CJ
imports. Set `supplier` on a product to `{provider: 'printful', productId}`
to link it.

## Orders — draft-only, never auto-confirmed

`createOrder()` creates a **draft** order in Printful (`confirm: false`).
Printful charges when the order is explicitly confirmed. This module never
confirms automatically, and `payOrder()` refuses (422) for that reason:
confirm orders in the Printful dashboard after reviewing them.

`order(id)` returns `{id, status, tracking[], createdAt}`.

## Freight

`freight(items, destination)` → `[{name, cents, transit}]` via
`POST /shipping/rates`. `items` = `[{variantId, quantity}]`;
`destination` = `{countryCode, stateCode, city, zip}` (ZIP/postal required).

## Nigeria

Printful ships to most countries; Nigeria is NOT on its published no-ship
list, but some outsourced products ship only to a select list that excludes
Nigeria. Check per-product delivery to Nigeria in the Printful catalogue
before listing it for Nigerian customers.

## Do not confuse

Printful has no relationship with CJ Dropshipping or CJ Affiliate
(docs.cj.com). Never copy one provider's credentials into another's
integration. Printful API: `https://api.printful.com`, `Authorization:
Bearer <token>`, optional `X-PF-Store-Id`.

## No-key fallback

Without any distributor account, import supplier lists with the CSV adapter:
`POST /api/suppliers/csv/draft` with `{csv}`. Header must include
`name,brand,category,variant_label,sku,cost,price` (optional `line,blurb,
image`). One bad row fails the whole import — nothing is silently skipped.
