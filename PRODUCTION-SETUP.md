# VEGArance production activation

The store now has a production checkout implementation using Flutterwave Standard v3, CJ shipping/fulfillment, Resend transactional email, private customer order links, and a durable Render deployment blueprint. Provider integration tests use mocks. No live account has been connected or charged by this build.

## Your existing Render services

Use **https://frag-man-plug-store.onrender.com** as the storefront and checkout origin. This Node web service serves the customer pages and API together; the static site at **https://frag-man-plug-demo.onrender.com** remains a preview and cannot process checkout.

Configure the existing `frag-man-plug-store` service with branch `main`, build command `npm run build`, start command `npm start`, Node version `24`, and health path `/api/health`.

Set `SITE_URL=https://frag-man-plug-store.onrender.com` in its private environment. Set Flutterwave's V3 webhook URL to `https://frag-man-plug-store.onrender.com/api/webhooks/flutterwave`. Owner Studio is `https://frag-man-plug-store.onrender.com/admin.html`; customer policies are `https://frag-man-plug-store.onrender.com/policies.html`.

Before deploying over an existing catalog, export/back up the database and uploads: a free service's filesystem can reset on deployment. For real sales, the existing service needs durable storage: attach a persistent disk at `/var/data` on an eligible paid instance, set `DATA_DIR=/var/data`, migrate existing data if needed, and set `DURABLE_STORAGE_CONFIRMED=true` only after confirming persistence. The separate `render.production.yaml` is a reference for a new paid service; it does not upgrade this existing service automatically.

Enter Flutterwave, CJ, and email credentials directly in Render. Keep `FLW_MODE=test` and sales closed until account eligibility, persistence, policies, approved products, and the end-to-end test payment have been verified. Once the web service is ready, point customer-facing links to it; the static preview should not be advertised as the live shop.

## Nigerian merchant / US customers

Use your existing Nigerian Flutterwave business account. Confirm with Flutterwave that the business is activated for international card payments, USD collection, the intended retail/dropshipping products, and your settlement arrangement. USD catalog prices are not silently converted into NGN. Account eligibility and settlement cannot be established from a test key.

Official documentation: [Hosted checkout](https://developer.flutterwave.com/docs/flutterwave-standard-1), [verification](https://developer.flutterwave.com/reference/verify-transaction-with-tx_ref), [webhooks](https://developer.flutterwave.com/docs/webhooks), [refunds](https://developer.flutterwave.com/docs/refunds), [settlement](https://sandbox.flutterwave.com/us/support/payments/settlement-in-different-currencies).

## Configure hosting

The existing `render.yaml` remains the free preview. `render.production.yaml` is a separate, reviewable blueprint for a paid always-on service with a persistent disk. Applying it incurs Render charges; it has not been deployed.

For an existing service, use Node 24, build `npm run build`, start `npm start`, and health check `/api/health`. Mount a persistent disk at `/var/data`. Set `DATA_DIR=/var/data`; confirm that the disk is actually mounted before setting `DURABLE_STORAGE_CONFIRMED=true`. This preserves SQLite records and uploaded assets. Use one service instance: SQLite and this worker design do not support multiple replicas. This is an initial production architecture, not a claim of unlimited scale.

Add your domain in Render and configure its DNS/HTTPS. Set `SITE_URL` to the exact HTTPS origin, such as `https://shop.example.com`, without a path. Set `ADMIN_PASSWORD` to a strong private value of at least 12 characters. Render private environment settings hold all credentials; do not put secrets in chat or GitHub.

[Render persistent disks](https://render.com/docs/disks) preserve data across deploys, and impose single-instance/deployment limitations. A future move to managed Postgres/object storage is appropriate when multiple instances are needed.

## Flutterwave

Configure:

- `FLW_SECRET_KEY`: your test secret key first.
- `FLW_SECRET_HASH`: a random webhook secret, matching Flutterwave's V3 webhook settings.
- `FLW_MODE=test`: test keys are required in test mode. Switch to `live` only with live credentials.
- `FLW_USD_APPROVED=true`: only after confirming international USD access/settlement with Flutterwave.

In the Flutterwave dashboard, select V3 webhooks, set the URL to `https://YOUR_DOMAIN/api/webhooks/flutterwave`, set the matching secret hash, and enable retries. This endpoint checks `verif-hash` using a constant-time comparison and independently queries the transaction API. Reference, exact USD amount, currency and customer email must match the saved order before payment is accepted. A success URL or browser status parameter never confirms payment.

The worker and customer return page also check pending payments if a webhook was missed. Repeated checks/webhooks reuse the same order. Hosted checkout keeps card data off this server. An uncertain initialization is retained for review rather than automatically creating another payment request.

## CJ fulfillment

Set `CJ_API_KEY`. Enable stock scheduling in Products after importing supplier drafts. Confirm actual supplier images, descriptions, source authenticity, option identifiers, warehouse availability, costs, and shipping suitability. Check **Approved for real sales** in each reviewed product. The illustrative 215-entry fragrance catalog is never automatically approved for paid checkout.

Sales checkout accepts approved CJ products with fresh US inventory checks. Quantities and selling prices are validated by the server. A live freight quote chooses among CJ shipping services; the selected service/cost is saved with the order. Quotes expire after 15 minutes. Transit estimates are shown separately from the owner-configured processing time. Supplier inventory is checked, not reserved: it can still change between payment and submission.

In **Sales & connections**, review paid orders. **Submit paid order to CJ** creates an unpaid supplier order (`payType=3`). **Pay CJ supplier order** is a separate confirmed action that deducts from your CJ balance. Keep enough supplier funding available independently of payment settlement. Test payments cannot create or fund real supplier orders.

Supplier writes are never automatically retried on timeout/restart. An uncertain order is marked for review: find it in CJ using the VEGArance order reference. Do not create another supplier order blindly. Use **Link verified existing CJ order** to recover an uncertain order: the server verifies the store reference and option quantities against CJ. If CJ does not expose the parent shipment identifier needed for API funding, fund the recovered order in the CJ dashboard and refresh tracking. If cancellation is needed after submission, resolve it with CJ before refunding in Flutterwave. Tracking is read periodically and can be refreshed manually; verified tracking triggers a shipping email. Refunds for unsubmitted orders are available in Studio. Refund initiation is separate from final provider completion; the worker reconciles final status.

[Official CJ order API](https://developers.cjdropshipping.com/en/api/api2/api/shopping.html), [shipping API](https://developers.cjdropshipping.com/en/api/api2/api/logistic.html).

## Transactional email

Create/choose a Resend account, verify the sending domain's DNS, then set `RESEND_API_KEY` and `EMAIL_FROM`, e.g. `VEGArance <orders@YOUR_DOMAIN>`. Receipt, shipment and refund messages use persistent jobs, bounded retries and provider idempotency keys. Studio shows sent/queued/review-needed jobs; failed jobs can be requeued after resolving the provider issue. No marketing email or subscription is created automatically.

[Resend sending API](https://resend.com/docs/api-reference/emails/send-email), [idempotency](https://resend.com/changelog/idempotency-keys). Confirm eligibility for your account directly with the provider if necessary.

## Tax, customer policies and opening sales

Set business name, customer support email, actual shipping/returns/privacy policies and terms in **Sales & connections**. They are published as plain text on the customer-care page. No return windows, business addresses or guarantees have been invented for you.

Tax settings require your review. The basic state-rate JSON is limited: it does not calculate local jurisdictions or product exemptions. An empty object collects no tax and must only be approved when that is the correct treatment for your business. It is not an automatic tax exemption.

For address-based calculation, configure `TAXJAR_API_TOKEN`, `TAXJAR_ORIGIN_JSON` with your actual supplier shipping origin (`country`, `state`, `zip`, optional `city`/`street`), and `TAXJAR_SANDBOX=true` during testing. Registered nexus must be configured in TaxJar. Set `TAXJAR_SANDBOX=false` before opening live Flutterwave checkout; live checkout rejects a sandbox tax configuration. Once a token is supplied, checkout requires a valid origin and uses TaxJar instead of manual rates. Product tax codes can be entered in the product editor; no exemptions are inferred from category names. Confirm a consistent shipping origin for the initial collection; varying warehouse origins need a corresponding origin model before launch. API outage blocks checkout instead of charging guessed tax. Calculations do not register your business or file/remit tax. [TaxJar reference](https://developers.taxjar.com/api/reference/).

Opening checkout requires all connection/configuration checks. The checks establish configuration presence, not external account approval, policy legality or sample quality. Run a full test payment, confirm delivery address, payment notification, order email and saved order, then verify a small live transaction/refund before inviting customers. Live provider access and supplier fulfillment must be checked with your actual accounts.

## Backups and operations

Run `npm run backup -- /PATH/TO/NEW/BACKUP_DIRECTORY`. The script uses SQLite `VACUUM INTO` for a consistent database snapshot, then copies uploads. Backups contain private customer data; protect access and transfer encrypted copies off the service. A backup kept only on the same disk is not disaster recovery. Schedule backups through your hosting/operations setup and test restoration on a separate copy before launch. Freeze uploads during a full restore/snapshot workflow when strict file/database consistency is needed.

Pending payment/order records contain necessary delivery details; order tokens are private bearer links. Real customer orders are separate from preview orders and have no destructive delete action in Studio. Configure business-appropriate data retention and customer data-request procedures before launch. No advertising pixels or third-party analytics are installed by this build.

## Checks

```sh
npm run build
npm test
npm run test:browser
npm run test:sales
```

The sales browser test imports `test-sales-fixture.mjs` explicitly to mock all outbound providers. Production `npm start` does not import it. Tests never purchase products, charge accounts, send real emails or provision hosting.

## Merchant platform connections

Before inviting merchants, set `PLATFORM_SECRET_KEY` privately in Render to 32 cryptographically random bytes encoded as 64 hex characters. Generate it on a trusted machine, store it in your password manager, and retain it across restarts/deploys. Do not paste it into chat or commit it. Back up this key separately from the encrypted database with restricted access. This key cannot be replaced casually; existing credential records require explicit migration to a new key.

Merchant payment and CJ credentials belong to individual stores and are encrypted in the database. Existing single-store `FLW_*`/`CJ_API_KEY` environment values are not inherited by merchants. Use `/platform.html` to configure connections and import hidden CJ drafts. Merchant checkout now supports gated test payments, policy setup, state-rate tax simulation and per-store orders. Live merchant checkout remains blocked until fulfillment, refunds, receipt email and live tax/account verification are implemented. Merchant email verification/password recovery and durable storage are also required before commercial onboarding.

Merchant stock schedules use the existing Node process and durable SQLite job tables. Use one process/instance; do not scale replicas against this worker. Scheduling is opt-in per store. Changing CJ credentials invalidates the previous stock freshness; queue a new check. Stock reads are recoverable and never purchase inventory. Up to 500 supplier options per store are supported by this initial worker. Configure a schedule and review the latest job in the store editor before approving products. Supplier inventory is checked rather than reserved.

## Merchant test checkout

In `/platform.html`, open a store and complete **Checkout and orders**. Configure reviewed shipping/returns/privacy/terms, processing time and test tax rates. Publish the store, enter its support email, check CJ read access, save/check Flutterwave **test** credentials, and confirm actual USD account access. The HTTPS platform origin and durable storage checks must also pass. These checks indicate configuration/read access, not a verified live merchant business.

Use the exact Flutterwave V3 webhook URL shown in this store’s editor and its saved webhook secret hash. Each initialized order retains an encrypted copy of its payment connection for subsequent verification. Replacing/disconnecting the current connection blocks new checkout until checks pass again, but retained order bindings still verify older payments. Keep the encryption key securely; policies for retiring archived credentials and customer records must be completed before commercial onboarding.

The customer’s cart is scoped to `/shops/{slug}` and private order pages use `/merchant-order.html?token=...`. A saved private link lets customers check test payment status without exposing address/email details. Receipt email is not yet sent. Test orders cannot cause supplier purchases/shipments. This build has no live merchant checkout activation switch.
