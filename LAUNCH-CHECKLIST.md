# VEGArance — Launch Checklist

Everything that must happen before the store (owner store and merchant platform)
can take real money. Nothing here deploys anything. Check items off only with
evidence: a green test run, a verified dashboard setting, or a completed live
end-to-end order.

## Status key
- DONE — built and tested in the repo (branch `vegarance-v2` unless noted).
- USER ACTION — only the store owner can do this (keys, accounts, approvals).
- DECISION — a choice the owner must make.

## 1. Code & tests
- [x] DONE — `npm run build` passes; full `npm test` suite passes (owner store,
      merchant platform, CJ/Printful/AliExpress/Printify adapters, CSV import,
      AI copy + AI support, pricing engine, public API + webhooks, auth flows).
- [x] DONE — No fake data anywhere: no fake reviews, testimonials, sales
      counters, stock urgency, or social proof. Empty states are honest.
- [x] DONE — Secrets are env-only (`.env.example` lists every variable). No
      real keys in the repo.

## 2. Hosting & storage — USER ACTION / DECISION
- [ ] DECISION — Durable storage. The free Render filesystem resets and wipes
      SQLite + uploads. Options: paid Render disk for the Node service, or
      move the database to a managed Postgres/Supabase. Do NOT launch on the
      free filesystem — orders and uploads will be lost on restart.
- [ ] USER ACTION — Render production config. `render.production.yaml` is an
      undeployed reference blueprint: review it, set the production service to
      the `vegarance-v2` branch (or main after merge), set every env var below,
      and confirm the deploy goes green.
- [ ] USER ACTION — Domain. Point the real domain at the Render service and
      confirm HTTPS. Update `PLATFORM_PUBLIC_URL` to the real domain so
      verification/recovery emails link correctly.

## 3. Payments — USER ACTION
- [ ] USER ACTION — Flutterwave keys (live secret + public key + webhook
      secret) in Render env. Confirm the account is approved for USD
      (`FLW_USD_APPROVED`) if selling in USD.
- [ ] USER ACTION — Live end-to-end test with a real card: quote → checkout →
      webhook → order marked paid → receipt email → refund + reconciliation.
      Use a small real amount; verify the money lands and the refund reverses it.

## 4. Email — USER ACTION
- [ ] USER ACTION — Resend key + verified sending domain for the OWNER store
      (order receipts, shipping, refunds).
- [ ] USER ACTION — Platform mailer: `PLATFORM_RESEND_API_KEY` +
      `PLATFORM_RESEND_FROM` (a verified domain you own). Without these,
      merchant email verification and password recovery return 503 and
      publishing is ungated (verification inactive). With these set,
      publishing requires a verified merchant email.

## 5. Owner account — USER ACTION
- [ ] USER ACTION — `ADMIN_PASSWORD` (12+ characters) on the server before
      owner login. Without it, owner login returns 503.

## 6. Suppliers / distributors — USER ACTION
- [ ] USER ACTION — CJ Dropshipping account + API key. Confirm Nigeria
      shipping for each product before listing (CJ does not name Nigeria;
      verify in the CJ dashboard, per product).
- [ ] USER ACTION — Printful account + OAuth token (`PRINTFUL_API_TOKEN`,
      optional `PRINTFUL_STORE_ID`). Confirm per-product Nigeria delivery
      before listing. Orders stay draft-only until confirmed in Printful.
- [ ] USER ACTION — Printify account + Personal Access Token
      (`PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID`). Token lasts 1 year —
      calendar a rotation reminder. Confirm per-product Nigeria delivery.
      Orders stay draft-only until confirmed in Printify.
- [ ] USER ACTION — AliExpress: apply in Portals (Tools → API) → Open
      Platform console; set `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`,
      `ALIEXPRESS_TRACKING_ID`. Approval takes days. Fulfilment stays manual
      by design (the Affiliate API has no ordering). Verify the first live
      search/draft; an unknown method surfaces as a 502, never faked.
- [ ] DECISION — Launch market: Nigeria, US/EU, or both. This decides which
      supplier catalog, shipping expectations, and currency are primary.
- [ ] USER ACTION — Supplier-charge payment method + float buffer. You pay
      suppliers per order at order time; store payouts arrive days later.
      Keep enough float to cover pending orders.

## 7. AI — USER ACTION
- [ ] USER ACTION — `AI_API_KEY` (Groq free tier or OpenAI) to enable AI
      product descriptions and AI support chat. Without it both return an
      honest 503. The AI only rewrites supplied supplier facts and grounded
      order data; it cannot invent specs, tracking, or policy.

## 8. Merchant platform — USER ACTION / DECISION
- [x] DONE — Merchant email verification + password recovery flows
      (single-use hashed tokens, expiry, generic responses, session
      invalidation on reset, publish gate when platform email is configured).
- [ ] DECISION — Merchant billing: NOT built. Merchant subscriptions/fees
      need a provider decision (Flutterwave billing, Stripe, or manual) and
      are a separate build.
- [ ] DECISION — Custom merchant domains: NOT built. Documented next step;
      needs DNS + per-domain TLS planning before it is scoped.
- [ ] USER ACTION — Do NOT invite paying merchants until payments, email,
      storage, and the live end-to-end test are all done.

## 9. Catalog & content — USER ACTION
- [ ] USER ACTION — Replace the 215 illustrative catalog entries with real,
      supplier-sourced products (or approve each one via the admin supplier
      draft flow). Never auto-approve illustrative data for paid checkout.
- [ ] USER ACTION — Replace AI-generated brand-styling images with real
      product photos (supplier images or your own).
- [ ] USER ACTION — Review policies (shipping, returns, privacy, terms) for
      the launch market and confirm the wording matches what the store
      actually does.

## 10. Go-live sequence
1. Merge `vegarance-v2` → main (owner approval only).
2. Configure durable storage + Render production + domain.
3. Set every env var in sections 3–7.
4. Run the live end-to-end test (section 3) on the production domain.
5. Publish one real, supplier-verified product; place a real test order.
6. Open sales; monitor the first 10 orders end-to-end (payment, supplier
      fulfilment, tracking, delivery, emails).
