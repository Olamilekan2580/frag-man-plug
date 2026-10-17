# Eprolo — adapter decision (Phase C, 2026-10-17)

**Decision: NO Eprolo adapter.** Nothing is built, nothing is faked.
The owner supplier-status endpoint reports Eprolo as `not_integrated`,
and `/api/health` reports the same. Revisit only if Eprolo publishes
verifiable API documentation (see "What would change this" below).

## What was checked

On 2026-10-17, before writing any adapter code, Eprolo's API was
checked against real public sources:

1. **eprolo.com has no public API documentation.** A site-scoped search
   for API/developer documentation on eprolo.com returned no results.
   There is no developer-docs page, no OpenAPI spec, no published
   base URL, no published auth scheme, and no published endpoint list.
2. **"Custom API support" is marketing copy, not documentation.**
   Third-party comparisons (SourceForge, ecommerce-platforms.com) repeat
   Eprolo's claim of "custom API support" / "plug-and-play setup, plus
   custom API support", but none of them names an endpoint, a base URL,
   an auth method, or a request/response shape. A marketing claim is
   not a verifiable API.
3. **The one eprolo.com result about API tokens is Shopify's API, not
   Eprolo's.** Eprolo's help article "How to build a custom app in your
   Shopify store and get the API token?" describes creating a custom
   app *in Shopify* and granting *Shopify* Admin API scopes
   (orders, products, fulfillments, inventory). That is Shopify's API
   surface, and it does not give Vegarance a way to talk to Eprolo.
4. **The WooCommerce plugin route uses an Eprolo-issued Auth Key**
   (Eprolo → My Account → WooCommerce → "Connect with Auth Key"), but
   the plugin's protocol is not publicly documented either — there is
   no published endpoint or payload to implement against.

## Why no adapter was built

An adapter needs at minimum: a base URL, an auth scheme, and the
request/response shapes for search, draft, variant, freight, order
create/pay, and order detail. None of those exist in any public,
verifiable source for Eprolo. Writing an adapter from guesses would
be a fake integration: it would fail against the real service, or
worse, appear to work in tests while doing nothing real. The
ground-truth rule — no invented keys, accounts, live integrations, or
fake data — forbids it.

## What Eprolo integration would need (user actions)

- **Contact Eprolo** (support@eprolo.com, or via the Eprolo dashboard)
  and ask for API access: base URL, auth method, and documentation
  for product search, product detail, inventory, shipping quotes,
  order creation/payment, order status, and tracking.
- **Or use Eprolo's existing routes** outside Vegarance: the Shopify
  app, the WooCommerce plugin, or the app.eprolo.com dashboard.
  Those are real integration paths — they just are not APIs
  Vegarance can call.
- **Re-verify before building.** If Eprolo publishes docs, re-check
  them against a live account (search → draft → order → tracking)
  before claiming the adapter works.

## What would change this

Eprolo publishing verifiable API documentation (base URL + auth +
endpoint shapes) on eprolo.com or a developer portal, confirmed by
a live call against a real Eprolo account. At that point the adapter
follows the standard CJ-shaped interface in `ARCHITECTURE.md`
(search · draft · variant · freight · createOrder · payOrder ·
order) and lands with tests, the same as every other adapter.
