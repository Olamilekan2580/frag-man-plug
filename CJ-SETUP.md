# VEGArance × CJ — United States

The owner selected a custom storefront and CJ API, selling first in the US. The owner-only connector searches CJ's US inventory and prepares product drafts using real supplier pictures and option IDs. Drafts start unavailable; markup is applied to supplier product cost and does not include shipping, fees or taxes. Review the draft before saving.

1. Create/sign into your CJ account.
2. Install the API app under Apps → Install App → Others → API.
3. In the CJ API authorization page, create an API key for VEGArance.
4. Add `CJ_API_KEY` privately in the Render service's Environment settings, then redeploy. Do not send it in chat or commit it.
5. Sign into VEGArance Studio, open Products, and use CJ product discovery. Select a collection and markup, search, then prepare a draft.
6. Review title, description, actual shipping quote, margin, product images and warehouse stock. Supplier options default unavailable. Saving a draft does not place an order with CJ.

Implemented: authenticated server-only API client, cached tokens, serialized rate-limited requests, bounded timeout, US product search, draft preparation, category/options/SKU persistence, flexible cart and authoritative order price checks. Provider tests use mocked responses; live supplier access is unverified until credentials are configured.

Stock/cost automation is implemented behind owner controls. In Products → Inventory & pricing sync, set the interval (30–1440 minutes), optionally enable automatic selling-price updates and save. Defaults are off. Sync now creates a recoverable SQLite job; history shows attempts, paused options, cost changes and errors. Failed jobs retry at most three times. Stock checks count only verified US warehouses. Drafts remain unpublished until the owner enables the product. Prices at or below supplier cost are paused; markup excludes shipping, taxes and payment fees.

Missing/failed/stale supplier data blocks checkout. Freshness expires after three configured sync intervals. Supplier costs are kept in a private table; catalog prices are public. Owner edits are re-read before applying results. The job queue resumes interrupted reads if the database survives; free Render restart/redeploy can delete the database. The server only processes timers while awake, so free-service sleeping prevents reliable continuous sync.

Still required for end-to-end automation: durable database and continuously running worker, shipping quotes, verified payments, idempotent supplier order dispatch, supplier purchase funding, tracking sync and customer notifications. No supplier purchasing endpoints are connected in this release.

Official references: [Authentication](https://developers.cjdropshipping.com/en/api/api2/api/auth.html), [Products and variants](https://developers.cjdropshipping.com/en/api/api2/api/product.html).
