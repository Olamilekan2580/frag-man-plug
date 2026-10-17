# VEGArance — Buyer Payments: Pluggable Providers (Phase B, P0)

## The interface

Every buyer-payment provider implements the same shape
(`payment-providers.mjs`), so a store picks one per store and the
commerce engine never cares which one it is:

```
{ provider, configured, live,
  checkConnection(),
  checkout(order, site, opts) -> {id, url},
  verifyTransaction(reference) -> {id, status, tx_ref, currency, amount, customer:{email}},
  refund(order) -> {id, status},
  refundStatus(id),
  verify(rawBuffer, signatureHeader) -> {event, data:{tx_ref}} }
```

- `checkout` returns a hosted-checkout URL. Card data never touches
  Vegarance servers — it lives on the provider's hosted page.
- `verify` normalises provider webhooks to `{event: 'charge.completed',
  data: {tx_ref}}`. The commerce engine only marks an order paid after
  `verifyTransaction` re-checks the transaction (amount, currency, email,
  reference) — a webhook alone never marks an order paid.
- `verifyTransaction` ids: Flutterwave returns a numeric transaction id;
  Stripe returns the PaymentIntent id (`pi_…`) so refunds work. The
  commerce engine accepts either shape.

## Provider 1 — Flutterwave (unchanged)

- Implementation: `payment-client.mjs` (Flutterwave Standard v3).
- Configured per store from the merchant's own keys (secret, webhook
  secret hash, test/live mode) + merchant-confirmed USD approval flag.
- Webhook: `POST /api/platform/webhooks/flutterwave/{storeId}/{version}`
  with the `verif-hash` header.
- This is the default provider for every store (`paymentProvider:
  'flutterwave'` in the sales config).

## Provider 2 — Stripe (new slot, NOT CONFIGURED)

- Implementation: `createStripePayments` in `payment-providers.mjs`
  (Stripe REST API, Checkout Sessions, `whsec_`-verified webhooks).
- **Not configured until the owner supplies keys AND the merchant saves
  a Stripe connection for their store.** Until then every Stripe method
  throws an honest 503: "Stripe payments are not configured…".
- Env vars: `STRIPE_SECRET_KEY` (`sk_test_…` / `sk_live_…`),
  `STRIPE_WEBHOOK_SECRET` (`whsec_…`), `STRIPE_MODE` (`test` / `live`).
  Keys must match the mode or the connection is rejected at save time.
- Per-store connection: saved encrypted like every other provider
  (`merchant_connections`, provider `stripe`), read-access check via
  `GET /v1/account`.
- Webhook: `POST /api/platform/webhooks/stripe/{storeId}/{version}`
  with the `Stripe-Signature` header (HMAC-SHA256, 5-minute tolerance).
  The normalised event maps `checkout.session.completed` →
  `charge.completed` using the session's `client_reference_id` (the
  Vegarance order id).
- Refunds use the PaymentIntent id captured at verification time
  (`transactionId` on the order). Orders paid before this build, or paid
  through Flutterwave, cannot be refunded through Stripe — the refund
  call fails with a plain 422 instead of guessing.

## Per-store selection

- Each store's sales config carries `paymentProvider`
  (`'flutterwave'` or `'stripe'`, default Flutterwave), set in the
  dashboard checkout settings.
- The activation check reads the SELECTED provider only:
  "{Provider} test account checked" passes when that provider is
  connected, read-access-checked, and in test mode. Connecting
  Flutterwave does not activate a Stripe-selected store, and vice versa.
- The dashboard shows one webhook URL per store, built from the selected
  provider. The old Flutterwave webhook URL shape still works.
- Quote/checkout uses the selected provider's binding
  (`connections.paymentBinding(storeId, provider)`). Order payment
  bindings are snapshotted per order version, so rotating a store's keys
  never breaks verification of an in-flight order.
- Buyer-facing behaviour is unchanged: quote → hosted checkout →
  webhook/verification → paid → receipt. Test mode only.

## What is NOT true yet (do not claim)

- **Live merchant payments are NOT enabled.** The commerce engine
  refuses any non-test payment binding (`503: Live merchant payments
  are not enabled`), for Flutterwave and Stripe alike. Enabling live
  payments is a separate, owner-approved step: live keys, live webhook
  endpoints, a live end-to-end test with a real card, and a refund +
  reconciliation check — per provider.
- No PayPal / Paystack provider exists. Adding a third provider means
  implementing the same six-method interface in `payment-providers.mjs`
  and registering it in `PAYMENT_PROVIDER_IDS` + the connections
  provider set. Nothing else in the commerce engine changes.
- The owner store (`commerce.mjs`) still uses Flutterwave only. The
  pluggable interface covers merchant stores; unifying the owner store
  onto it is a later cleanup, not a Phase B change.
