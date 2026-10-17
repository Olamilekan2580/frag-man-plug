# VEGArance v3 — Architecture (Phase A)

VEGArance is a **multi-merchant dropshipping platform** (Shopify + AutoDS
combined), not a personal store. Merchants sign up, create stores (up to
five each), connect their own supplier / payment / email accounts, and sell.
Buyers shop on merchant storefronts at `/shops/{slug}`. The owner store
(`index.html`, the original fragrance catalogue) is one store among the
platform's stores, not the product.

Ground rules (unchanged from v2, enforced in Phase A):

- No invented keys, accounts, live integrations, or fake data. No fake
  reviews, testimonials, counters, or urgency.
- Honest empty states and honest not-configured responses everywhere
  (503 with the exact missing configuration, never a faked success).
- Secrets are env-only; provider secrets are AES-256-GCM encrypted at rest
  per store; API keys are stored as SHA-256 hashes, shown once.

## 1. The five layers

```
┌──────────────────────────────────────────────────────────────┐
│ 1. STOREFRONT — what buyers see                              │
│    owner store (index/shop/product/cart/…) · merchant        │
│    storefronts (/shops/{slug}) · checkout · order tracking   │
├──────────────────────────────────────────────────────────────┤
│ 2. ADMIN / MERCHANT — what sellers see                       │
│    owner admin (admin.html) · merchant dashboard             │
│    (platform.html) · onboarding wizard (onboarding.html)    │
├──────────────────────────────────────────────────────────────┤
│ 3. COMMERCE ENGINE — the order state machine                 │
│    quote → checkout → payment → paid → fulfillment →          │
│    shipped → delivered → refunded. Prices revalidated        │
│    server-side at checkout; orders held pending-payment      │
│    until the payment webhook confirms.                       │
├──────────────────────────────────────────────────────────────┤
│ 4. SUPPLIER ADAPTERS — one interface, many providers         │
│    search · draft · variant (inventory) · freight ·           │
│    createOrder · payOrder · order (detail)                   │
├──────────────────────────────────────────────────────────────┤
│ 5. INTEGRATION / EVENTS — how the platform talks outward     │
│    inbound payment webhooks · outbound merchant webhooks     │
│    (HMAC-SHA256, retry 1m→6h, failed after 6) · public       │
│    REST API (scoped keys, 60/min/key) · email (Resend)      │
└──────────────────────────────────────────────────────────────┘
```

## 2. Module map

### Layer 1 — Storefront

| Module | Role | v3 status |
|---|---|---|
| `index.html` + `app.js` + `style.css` / `vegarance.css` / `refinement.css` / `luxury.css` / `layout-fixes.css` / `commerce.css` | Owner store: shop, categories, product detail, cart, checkout, FAQ, policies | KEPT, restyled onto design-system tokens |
| `shop.html`, `category.html`, `product.html`, `search.html`, `cart.html`, `track.html`, `about.html`, `contact.html`, `faq.html`, `policies.html`, `privacy.html`, `terms.html`, `shipping.html`, `wishlist.html`, `blog.html`, `blog-post.html`, `become-seller.html`, `order.html` | The 16 v2 storefront pages + shared chrome (`vegarance-pages.js`, `vegarance-pages.css`) | KEPT, restyled onto design-system tokens; `become-seller` CTA now points at the onboarding wizard |
| `merchant-shop.html` + `merchant-shop.js` | Public merchant storefront at `/shops/{slug}` | KEPT, design-system scope (`.ds-app`) + skip link |
| `merchant-order.html` + `merchant-order.js` | Private buyer order-status page | KEPT, design-system scope + skip link |
| `design-system.css` + `DESIGN-SYSTEM.md` | **NEW.** Tokens + reusable components, loaded last on every page | NEW (Phase A) |

### Layer 2 — Admin / Merchant

| Module | Role | v3 status |
|---|---|---|
| `admin.html` + `admin.js` + `admin-crud.css` | Owner admin: catalogue CRUD, settings, supplier drafts, sales | KEPT, design-system tokens + focus rules |
| `platform.html` + `platform-ui.js` | Merchant dashboard: stores, connections, products, checkout settings, orders | KEPT, design-system scope (`.ds-app`), onboarding banner, skip link |
| `onboarding.html` + `onboarding.js` + `onboarding.mjs` | **NEW.** 8-step wizard: signup → verify email → create store → connect supplier → import products → set pricing → connect payments → publish. Progress is derived from real server state; each step shows its exact next action. | NEW (Phase A) |
| `verify-email.html`, `reset-password.html` | **NEW.** Landing pages for the emailed verification / password-reset links (previously pointed at non-existent routes and 404'd). | NEW (Phase A, bug fix) |
| `platform.mjs` | Merchant platform backend: auth, stores, connections, products, publish gate, sales config | KEPT + `GET /api/platform/onboarding` endpoint (Phase A) |

### Layer 3 — Commerce engine

| Module | Role | v3 status |
|---|---|---|
| `commerce.mjs` | Owner-store checkout: quotes (15-min), Flutterwave Standard v3, webhooks, pending-payment worker, refunds + reconciliation | KEPT, untouched |
| `merchant-commerce.mjs` | Per-merchant checkout, readiness checks, order ops (dispatch / fund / refund / tracking / reconcile) | KEPT, untouched |
| `merchant-inventory.mjs` | Supplier stock sync jobs, sale-ready approval (`inventory.approved`) | KEPT, untouched |
| `pricing.mjs` | Deterministic margin engine: `retail = (cost + shipping + fees + reserve) / (1 − margin)`, charm rounding, margin-floor guard. The LLM only suggests; the engine sets prices. | KEPT, untouched |
| `payment-client.mjs`, `tax-client.mjs` | Flutterwave + TaxJar clients | KEPT, untouched |

### Layer 4 — Supplier adapters

| Module | Role | v3 status |
|---|---|---|
| `cj-client.mjs` + `supplier-sync.mjs` | CJ Dropshipping: search, draft, order create/pay, sync jobs with retry + stale-data checkout blocking | KEPT, untouched — only adapter with full order + pay + sync |
| `printful-client.mjs` | Printful POD: search, draft. **Draft-only** — never auto-confirms charges | KEPT, untouched |
| `printify-client.mjs` | Printify POD: search, draft. **Draft-only** | KEPT, untouched |
| `aliexpress-client.mjs` | AliExpress Affiliate/Open Platform: search, draft. **Manual fulfilment** (the Affiliate API has no ordering) | KEPT, untouched |
| `csv-import.mjs` | CSV supplier import → drafts | KEPT, untouched |

### Layer 5 — Integration / Events

| Module | Role | v3 status |
|---|---|---|
| `public-api.mjs` | Public REST API v1 (scoped keys `vg_live_…`, SHA-256 hash stored, shown once, 60/min/key, max 20 keys/store) + HMAC-SHA256 webhooks with backoff retries | KEPT, untouched |
| `server.mjs` | HTTP server: routing, static serving, owner auth, owner-store API, webhook entry points | KEPT, untouched |
| `merchant-connections.mjs` | Per-store provider connections (CJ / Flutterwave / Resend), AES-256-GCM encrypted, verify = read-access check only | KEPT, untouched |
| `merchant-email-client.mjs`, `ai-client.mjs`, `ai-support.mjs` | Resend mailer; Groq/OpenAI-compatible AI client; grounded support chat (answers only from retrieved order/product/policy facts) | KEPT, untouched |
| `backup.mjs` | SQLite backup | KEPT, untouched |

## 3. Data flow

### Buyer checkout (merchant store)

1. Buyer browses `/shops/{slug}` → `merchant-shop.js` loads the public
   catalogue (`GET /api/platform/public/{slug}`).
2. Buyer checks out → `POST /api/platform/public/{slug}/quote` (server
   revalidates every price) → `POST …/checkout` → redirect to Flutterwave
   hosted checkout.
3. Flutterwave posts to the per-store webhook
   (`/api/platform/webhooks/flutterwave/{storeId}/{version}`, verified with
   `verif-hash`) → order moves pending → paid.
4. Paid order routes to the supplier adapter: CJ `createOrder` + `payOrder`
   (real); Printful/Printify draft + manual confirm; AliExpress manual.
5. Tracking syncs back → receipt / shipping / delivery emails (Resend).
   Refunds reconcile against Flutterwave.

### Merchant onboarding (NEW, Phase A)

1. `onboarding.html` loads → `GET /api/platform/onboarding` → `platform.mjs`
   builds the input from real DB state (session, email verification flag,
   first/selected store, `connections.status`, product counts,
   `inventory.approved` sale-ready count) and runs the pure
   `deriveOnboarding()` state machine in `onboarding.mjs`.
2. The wizard renders the 8 steps with `done / current / todo / locked /
   skipped` status, a progress bar, and the exact next step.
3. The current step's inline form POSTs to the existing real endpoint
   (signup / verify-email/request / stores / store publish PUT). After
   every mutation the wizard re-fetches state — a step only flips to done
   when server state proves it.
4. Steps the wizard cannot do inline (connect supplier, import products,
   set pricing, connect payments) deep-link to the exact dashboard
   section in `platform.html`.
5. Honest inactive states: unconnected providers show "Not connected —
   checkout cannot collect payments" (never a fake completed step);
   verification shows "skipped" with the reason when platform email is
   not configured; publish stays `locked` until every prior step is done
   or skipped, and the server still enforces the verified-email publish
   gate (403) as the backstop.

### Supplier sync (kept)

Scheduled CJ sync jobs (retry + interrupted recovery) update stock/cost;
stale supplier data blocks checkout. Printful/Printify/AliExpress have no
auto-sync — availability is checked at draft/approval time.

## 4. What was kept vs rebuilt (Phase A)

**Kept (working, tested):** the entire commerce engine, all five supplier
adapters, the public API + webhooks, the AI layer (descriptions, pricing
suggestions, grounded support), merchant auth / connections / inventory /
orders, and all 16 v2 storefront pages plus the merchant dashboard.

**Rebuilt:** the visual layer onto one design system (tokens + components +
accessibility primitives — see `DESIGN-SYSTEM.md`); the merchant
dashboard + storefront UX restyled onto it (`.ds-app` scope, storefront
bridge classes, skip links); the merchant entry flow, from scattered
dashboard forms to a guided 8-step onboarding wizard with derived progress.

**Fixed as part of onboarding:** the emailed verification and
password-reset links pointed at `/verify-email` and `/reset-password`,
which did not exist as routes and returned 404. They now point at
`verify-email.html` / `reset-password.html`, which call the real API
endpoints.

## 5. Deliberately deferred (later phases — NOT in Phase A)

Per the research build order (`dropshipping-platform-research.md` §8):

- **Merchant billing** (how Vegarance charges merchants) — NOT BUILT.
  Needs a provider decision + subscription/commission logic + receipts +
  dunning. Phase A changes nothing about money flows.
- **Live payments beyond Flutterwave** (PayPal / Stripe / Paystack).
- **Durable storage + production deploy** (Render disk or managed DB;
  backup/restore verification). The v3 branch touches no Render service
  and no live config.
- **Custom merchant domains** — NOT BUILT. Merchants live at
  `/shops/{slug}`.
- **Auto-ordering depth** — Printful/Printify confirm flow (explicit
  merchant opt-in + charge warning), AliExpress tracking capture.
- **Discounts / coupons / gift cards; abandoned-checkout emails.**
- **Product research / trend scoring; multi-currency / Markets /
  duties; customer accounts; reviews; analytics depth; chargeback
  evidence packs; multi-channel feed export; SEO depth.**
- **Layout rewrite** of the legacy stylesheets — Phase A is a token +
  component layer on top, not a layout rewrite.
- **No merge to main.** Phase A lives on branch `vegarance-v3` only.
