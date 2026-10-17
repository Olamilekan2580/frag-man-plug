# AliExpress (affiliate catalogue) — setup

Third distributor adapter, CJ-shaped (`aliexpress-client.mjs`). The
AliExpress **Affiliate / Open Platform API** returns catalogue data +
tracked links. It is **not** a fulfilment API: it does not place orders,
quote freight, or report live stock. Read the honest limits below before
building a listing on it.

## Configure

Apply in AliExpress Portals (**Tools → API**), then finish in the
AliExpress Open Platform console. Approval takes a few days. The App Key,
App Secret and Tracking ID must all come from the **same** AliExpress
account — a Tracking ID from a different account will not work.

Set privately in Render Environment (never in version control or chat):

```sh
ALIEXPRESS_APP_KEY=<redacted>
ALIEXPRESS_APP_SECRET=<redacted>
ALIEXPRESS_TRACKING_ID=your-tracking-id
# Optional: ALIEXPRESS_BASE_URL (default https://api-sg.aliexpress.com/sync)
# Optional: ALIEXPRESS_SIGN_METHOD (md5 default, or hmac-sha256)
# Optional: ALIEXPRESS_CURRENCY (default USD), ALIEXPRESS_LANGUAGE (default EN)
```

No keys configured: AliExpress endpoints return 503 with an honest
not-configured message.

## Endpoints (owner login required)

- `GET /api/suppliers/aliexpress/status` → `{configured,
  market: 'AliExpress affiliate catalogue', orderAutomation: false,
  fulfilment: 'manual'}`
- `GET /api/suppliers/aliexpress/search?q=...` → `{page, total,
  products[]}` — affiliate product search. `stock` is `null` and
  `stockUnknown` is `true` on every product: the API does not report
  live stock.
- `POST /api/suppliers/aliexpress/draft` with `{id, category, markup}` →
  Vegarance draft in the same shape as `cj.draft` (one `Standard` variant,
  price with markup on the affiliate price,
  `supplier: {provider: 'aliexpress', ...}`). Drafts start **unavailable**
  (`inStock: false`).

Products imported from a draft are hidden until you review them, like CJ
imports. Set `supplier` on a product to
`{provider: 'aliexpress', productId}` to link it.

## Honest limits — fulfilment is manual

- `variant()` returns `{cost, quantity: null, stockUnknown: true}`.
  Quantity `null` means **unknown**, never zero and never "in stock".
  Verify stock, shipping time and final cost on the live AliExpress
  listing before approving any product for sale.
- `freight()`, `createOrder()`, `payOrder()` and `order()` refuse with
  422 and a plain explanation: place and pay for the order in AliExpress /
  the Dropshipping Center, where you pay per order (product + shipping).
  This adapter never places orders or charges anything automatically.
- The Dropshipping Center (`ds.aliexpress.com`) is a free in-account
  research tool, not a feed or API — there is nothing to connect to it.
- The AliExpress **Affiliate** route (tracked links, commission paid by
  wire) and the **dropshipping** route (you pay AliExpress per order) are
  two different money flows. This adapter uses the affiliate API for
  catalogue data only; it does not pay you commissions and does not fulfil
  orders. Do not mix the two in the ledger.

## Signing

Requests are POST, form-urlencoded, to the Open Platform gateway.
Signature (per AliExpress affiliate guides): sort all params except
`sign`, concatenate key+value with no separator, wrap with the secret on
both sides (`secret + joined + secret`), MD5, uppercase hex. If your
console requires it, set `ALIEXPRESS_SIGN_METHOD=hmac-sha256` instead
(HMAC-SHA256 over the same concatenated string, keyed with the secret).
A bad signature surfaces as a 502 with the provider's message — never a
faked result.

## Never mix the CJs

CJ Dropshipping (`cj-client.mjs`) and CJ Affiliate (`docs.cj.com`) are
different companies. AliExpress credentials never go into the CJ adapter
and vice versa.
