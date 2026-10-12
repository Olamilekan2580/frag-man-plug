# VEGArance × CJ — United States

The owner selected a custom storefront and CJ API, selling first in the US. The owner-only connector searches CJ's US inventory and prepares product drafts using real supplier pictures and option IDs. Drafts start unavailable; markup is applied to supplier product cost and does not include shipping, fees or taxes. Review the draft before saving.

1. Create/sign into your CJ account.
2. Install the API app under Apps → Install App → Others → API.
3. In the CJ API authorization page, create an API key for VEGArance.
4. Add `CJ_API_KEY` privately in the Render service's Environment settings, then redeploy. Do not send it in chat or commit it.
5. Sign into VEGArance Studio, open Products, and use CJ product discovery. Select a collection and markup, search, then prepare a draft.
6. Review title, description, actual shipping quote, margin, product images and warehouse stock. Supplier options default unavailable. Saving a draft does not place an order with CJ.

Implemented: authenticated server-only API client, cached tokens, serialized rate-limited requests, bounded timeout, US product search, draft preparation, category/options/SKU persistence, flexible cart and authoritative order price checks. Provider tests use mocked responses; live supplier access is unverified until credentials are configured.

Still required for end-to-end automation: durable database and background job storage, scheduled stock/cost refresh with stale-data handling, shipping quotes, verified payments, idempotent supplier order dispatch, supplier purchase funding, tracking sync and customer notifications. No supplier purchasing endpoints are connected in this release.

Official references: [Authentication](https://developers.cjdropshipping.com/en/api/api2/api/auth.html), [Products and variants](https://developers.cjdropshipping.com/en/api/api2/api/product.html).
