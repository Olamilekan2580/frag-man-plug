# VEGArance v3 — Phase C: P1 gaps (auto-ordering depth, coupons, abandoned checkout, supplier breadth, multi-currency/duties, trend scoring)

**Ground truth unchanged:** multi-merchant platform, no invented keys /
accounts / live integrations / fake data. No live supplier charges are
made by any Phase C code. No fake discounts, no invented exchange or
duty rates, no invented trend data.

## What Phase C added

| Area | Module(s) | What is real | What is explicitly NOT real |
|---|---|---|---|
| Auto-ordering depth | `merchant-fulfillment-approval.mjs` | Supplier-confirmation approvals for Printful / Printify / AliExpress: merchant reviews provider + draft + estimated charge, then explicitly confirms with `confirmCharge: true`. Charge warning names the provider and the approximate amount and states Vegarance never confirms charges automatically. Manual tracking capture: merchant pastes the tracking number from their AliExpress order; the system validates it, stores it, marks the order Shipped, and notifies the buyer. Order actions: `fulfillment_request` / `fulfillment_confirm` / `fulfillment_reject` / `aliexpress_tracking` | NO provider confirm call. This record is the approval gate; the charge step still happens in the Printful / Printify dashboard. `send_to_production` is never called, Printful `confirm` is never called. AliExpress ordering stays manual (no fulfilment API exists). |
| Discounts / coupons | `merchant-coupons.mjs` | Per-store coupon codes: percentage (1–90%) or fixed cents, expiry, usage limits, min order, active flag. Server-side validation at quote time AND checkout time. Discount applies to the merchandise subtotal only, capped at the subtotal; tax is computed on the discounted subtotal. Redemption recorded once per order, only when the order is verified paid. Buyer field on the storefront checkout; merchant CRUD at `GET/POST /api/platform/stores/{id}/coupons`, `PUT/DELETE /{couponId}` (DELETE deactivates) | NO gift cards. NO fake discounts: an invalid code is a 422, never a silent discount. Codes are never exposed on the public storefront config (only `couponsAccepted: true/false`). |
| Abandoned checkout | `merchant-abandoned.mjs` + operations tick | Quote created → captured as abandoned. Quote never paid + older than 1 hour → exactly ONE reminder email via the store's Resend connection, queued through the existing email-job loop. Paid orders convert the abandonment and never get reminded. Dashboard lists abandonments per store | NO email marketing / campaigns. NO spam loops: pending → queued is one-way; a queued row is never due again. With no Resend connection configured, nothing is queued and nothing is recorded as sent (honest inactive state). |
| Supplier breadth | `EPROLO.md` | Eprolo API verified against real public sources: NOT verifiable — no public docs, no base URL, no auth scheme, no endpoints. Documented in `EPROLO.md`; owner supplier status + `/api/health` report `not_integrated` | NO Eprolo adapter. Nothing faked. CJ / Printful / Printify / AliExpress / CSV adapters unchanged. |
| Multi-currency / duties | `merchant-currency.mjs` | Storefront currency display per store config: 16 currencies, merchant-supplied exchange rate required for any non-USD display (the platform never invents or fetches a rate). Duties: merchant-written text OR the standard disclaimer that duties/taxes/import fees are not included and may be charged on delivery. Displayed on the storefront (Currency & duties section) and in `publicConfig.currency` | DISPLAY ONLY. Checkout still charges in USD through the store's payment provider. NO invented duty rates, NO Markets / merchant-of-record equivalent, NO local payment methods. |
| Product research / trending | `trend-scoring.mjs` + `ai-client.summarizeTrends` | Deterministic scoring (0–100) from merchant-supplied supplier signals only: sales volume, sales trend, stock, price movement (+ rating as context). Breakdown, confidence (high/medium/low), label (Rising / Steady / Cooling / Insufficient data), per-signal notes, estimate disclaimer on every result. `POST /api/platform/stores/{id}/trends` scores 1–50 items; optional `aiSummary: true` summarises ONLY the supplied scores (503 without `AI_API_KEY`, 502 on guarantee language, disclaimer appended server-side) | NO fetched data, NO invented trend data, NO sales predictions, NO guarantees. Scores are estimates from supplier data, never promises. |

## Data-flow deltas (Phase C)

- **Coupons:** `platform.mjs` creates one `createMerchantCoupons({db})`
  and passes it to `createMerchantCommerce({coupons})`. Buyer quote
  accepts `couponCode`; the quote stores `discountCents / couponCode /
  couponId`; checkout re-validates before creating the order; `verify`
  records the redemption on paid. Order payloads (dashboard, public
  order page, public API v1, webhook events) carry `discountCents` +
  `couponCode`.
- **Abandoned:** `platform.mjs` creates one
  `createMerchantAbandoned({db})`, passed to commerce (capture on
  quote, convert on paid) and to operations (single-reminder scan in
  `tick()`). Reminder emails are ordinary email jobs with kind
  `abandoned` and id `ABANDONED-{quoteId}`.
- **Fulfillment:** `platform.mjs` creates one
  `createMerchantFulfillment({db})`, passed to commerce → operations.
  Order-operation routes accept the four new kinds (see above).
- **Currency:** `merchant-commerce.configure()` accepts
  `displayCurrency / exchangeRates / dutiesMode / dutiesDisclosure`,
  validated by `validateDisplayConfig` (merchant rate required for
  non-USD). `publicConfig()` exposes `currency` + `couponsAccepted`.
- **Trends:** `POST /api/platform/stores/{id}/trends` (merchant auth).
  No writes; scoring is pure, the AI summary is grounded in the
  scored items only.

## What still needs the user

- **Supplier accounts + float** (unchanged): Printful / Printify /
  AliExpress accounts; the merchant completes the charge step in the
  provider dashboard after confirming here, and pays suppliers per
  order at order time.
- **Resend** (unchanged): abandoned reminders only send when the
  store's Resend connection is configured and verified.
- **AI key** (unchanged): trend summaries need `AI_API_KEY`; scoring
  works without it.
- **Merchant-supplied data**: exchange rates for non-USD display,
  duties text if `merchant_configured` is chosen, and the supplier
  signals fed into trend scoring (sales, stock, price movement) —
  the platform never invents any of these.
- **Eprolo**: contact Eprolo for API access (see `EPROLO.md`) before
  any adapter is built.

## Tests

`test-phase-c.mjs` (7 sections): coupons, currency, trends + AI
summary, fulfillment approvals + tracking, abandoned state machine,
commerce integration (coupon quote → checkout → paid + redemption +
abandonment converted), operations integration (fulfillment actions,
AliExpress tracking + buyer notification, single abandoned reminder,
honest inactive state without email). Live-server smoke test verified
the coupon CRUD + trends routes (200s, honest 503 for AI summary
without a key, 404 cross-store).
