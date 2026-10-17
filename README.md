# VEGArance

Independent fragrance storefront owned by the project author. Work locally with `cd /home/olamihacks/vegarance` and `npm start`.

Production checkout implementation: Flutterwave for the owner’s Nigerian business, CJ freight/owner-controlled fulfillment, Resend order emails, private order-status links, optional TaxJar calculation and a durable Render blueprint. Activation requires approved accounts and private configuration; live integrations have not been tested. See [PRODUCTION-SETUP.md](PRODUCTION-SETUP.md).

Current preview release: VEGArance identity, ink/plum and ivory palette, responsive catalog, saved scent shortlist, product image uploads, authenticated product/order/settings management. Existing catalog prices and artwork remain illustrative; real sales are not enabled. Browser storage is isolated under `vegarance_` keys.

Lifestyle expansion adds Fragrance, Beauty, Fashion, Accessories and Home category browsing, arbitrary size/color options with individual availability and prices, and an owner-only CJ catalog search/draft connector for the United States. See [CJ-SETUP.md](CJ-SETUP.md) to configure `CJ_API_KEY` privately on Render. Supplier orders are not yet automated; preview checkout remains active. New category collections display honest empty states until products are approved.

CJ stock/cost sync now supports owner-controlled scheduling, opt-in price updates, manual runs, persisted job history, retries and interrupted-job recovery. Missing or stale supplier checks block checkout. Automation defaults off and does not purchase supplier orders. Free Render sleeping/reset behavior prevents reliable continuous operation until durable hosting is configured. Run `node test-sync.mjs` and `node test-cj.mjs` for mocked worker/provider checks, plus `npm run test:api` and `python3 test-crud-layout.py` for API/browser validation.

Vegarance v2 (branch `vegarance-v2`) adds, without changing the checkout engine: an AI product-description endpoint (`POST /api/ai/describe`, Groq default / OpenAI-compatible, key-gated, banned-claim validation — see [AI-SETUP.md](AI-SETUP.md)); a deterministic pricing/margin engine (`POST /api/pricing/preview`, USD/NGN charm rounding, margin-floor guard — the engine sets prices, the LLM only suggests); a second distributor adapter, Printful print-on-demand (`/api/suppliers/printful/*`, draft-only orders, never auto-confirms — see [PRINTFUL-SETUP.md](PRINTFUL-SETUP.md)); and a no-key CSV/feed import adapter (`POST /api/suppliers/csv/draft`). Printful orders are made to order (no stock counts). CJ Dropshipping and CJ Affiliate (docs.cj.com) are different companies — never mix their credentials.

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

## Build and validation

The app serves its source assets directly; no bundler or package installation is required. `npm run build` checks every JavaScript file and verifies local HTML/CSS asset references. Render runs this check before starting the service.

```sh
npm run build
npm test
npm run test:browser
```

The browser suite requires Python Playwright with Chromium installed. Individual checks are also available:

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

## Merchant platform foundation

Open `/platform.html` on the Node service to sign up, create up to five stores, manage branding and products, and publish catalog storefronts at `/shops/{slug}`. Each merchant owns separate store/product records. The existing single-store owner dashboard and payment accounts are separate; merchant accounts cannot access them. Passwords use salted scrypt hashes; only hashed session tokens are stored. Sessions expire after seven days and survive server restarts.

Merchant storefronts support gated Flutterwave test checkout and isolated orders. Live payment activation, subscription billing, custom domains, email verification and password recovery are outstanding platform work. Do not invite paying merchants yet. Account and store persistence requires durable storage on Render. No credentials or live orders are copied from the original store to merchants.

Run `npm run test:platform` for merchant authentication, tenant isolation, visibility, restart persistence and validation checks.

Merchant connections are available in the store editor. Configure `PLATFORM_SECRET_KEY` as a privately generated, stable 64-character hex value (32 random bytes) in Render. Credential writes fail closed without it. AES-256-GCM encryption binds each record to its store and provider; APIs return connection status rather than keys. Keep this key securely with encrypted backups; replacing it without re-encrypting records makes existing connections unreadable. Secrets are decrypted only by the server for provider requests.

Merchants can save/check/disconnect CJ and Flutterwave credentials, search CJ US products, and import hidden supplier drafts. A read-access check does not establish international USD eligibility or enable checkout automatically. CJ variant prices and supplier links are preserved when editing product descriptions; option prices and stock checks are managed in the product editor and stock panel. Imported draft descriptions need merchant review; no orders or supplier purchases occur. Provider tests are mocked. Flutterwave checks use the [official transaction-list endpoint](https://developer.flutterwave.com/reference/get-all-transactions), discarding transaction contents.

Merchant inventory jobs now run per store with scheduling disabled by default. Enable a 30–1440 minute interval or queue a manual check. The single-process worker recovers interrupted stock reads, deduplicates active jobs, retries failures up to three times, and preserves merchant price edits made during supplier requests. The initial worker supports up to 500 supplier options per store. It never submits or funds supplier orders.

Supplier option names, selling prices and offered/paused status can be edited without changing CJ identifiers. Sale approval requires reviewed description/image and at least one fresh available option priced above supplier cost. Public option availability also expires and is invalidated by disconnecting/replacing the store’s CJ connection. Internal costs, quantities and connection versions are excluded from public catalog responses. Product approval is separate from enabling checkout: complete the store’s test-checkout settings and checks first.

### Merchant test checkout and orders

Each store now has a test-checkout setup panel, customer policies, reviewed state tax rates, a unique Flutterwave V3 webhook URL, and an isolated order list. Customers can choose approved supplier options, build a store-specific cart, request a server-priced shipping/tax quote, and continue to that merchant’s hosted Flutterwave test checkout. Consent and the full delivery address are bound to the quote; quotes expire after 15 minutes. Inventory and prices are revalidated before initializing checkout. Duplicate requests reuse the saved checkout.

Payment acceptance requires independently verified store reference, exact USD amount, currency and customer email. Browser redirect parameters never establish payment. The private order page excludes delivery/email details; only the store’s authenticated merchant can read full order delivery details. Pending payments are checked by a single-process worker for up to 48 hours. Test orders never initiate supplier purchases or shipments, and clearly marked receipt emails and full test refunds are available. Live merchant checkout is blocked by the server. Manual state tax rates are for this test flow, not a complete live US tax implementation.

A payment initialization snapshots the encrypted provider connection in `merchant_payment_bindings`. Historical bindings are retained to verify existing orders even when a merchant replaces or disconnects the current account; disconnecting prevents new checkout and does not erase order verification credentials. APIs never expose these encrypted bindings or key material. Credential retirement/retention and key rotation need explicit operations procedures before commercial onboarding.

Set `SITE_URL` to the HTTPS platform origin, use durable `DATA_DIR`, and set `DURABLE_STORAGE_CONFIRMED=true` only after verifying persistence. Configure the platform encryption key and each store’s test Flutterwave/CJ read checks, USD approval, published store/support email and customer policies before enabling checkout. Use Flutterwave’s test dashboard webhook URL shown in the store editor with the matching secret hash.

### Merchant operations

Stores can now connect their own Resend key and sender. The sender-domain check requires domain-list permissions and a verified matching domain in the first 100 returned domain records. Enabling new test checkout requires this check; the key and sender are captured in an encrypted binding for each order. Receipt/refund/shipping jobs keep immutable payloads, deterministic idempotency keys, bounded retries and private per-store status. `accepted` means provider acceptance rather than inbox delivery. See [Resend’s 24-hour idempotency window](https://resend.com/changelog/idempotency-keys). Uncertain sending pauses after that window; expired jobs cannot be blindly requeued.

Verified paid, unsubmitted orders can request full refunds with confirmation. Requests are saved before the provider call; ambiguous or interrupted requests pause for owner review and cannot be repeated automatically. Provider `completed` is initiation rather than final completion. Final refund status, exact amount and transaction ID are checked before recording a refund and queuing its email.

Supplier submission, funding, recovery and tracking controls are implemented for future live orders. Submission creates an unpaid CJ order; funding is a separate confirmed action after validating the order reference, options, quantities and amount against the supplier invoice. Ambiguous writes require manual CJ review/reconciliation. Each order uses its captured supplier credentials. Test payments are rejected before any supplier submission/funding request. Live merchant checkout remains blocked: live tax/eligibility, production sample fulfillment and platform account verification/recovery are still pending.

Historical supplier and email bindings are retained to process existing orders even after current connections change. These are encrypted like payment bindings. Database backups and credential-retirement procedures must account for all binding tables and private email payloads.

For an uncertain refund, **Link verified existing refund** queries the order’s original payment account and requires the same transaction ID and exact full amount before attaching it. It never issues a new refund. Review-needed or failed provider statuses remain blocked for manual provider review.
