# VEGArance launch

VEGArance is the author's independent fragrance storefront. Current public hosting retains its earlier Render service URL until renamed in Render. The working project is accessible at `/home/olamihacks/vegarance`.

Implemented: responsive storefront, 215 reference catalog entries, saved scents on this device, size selection, blends, cart, preview orders, owner authentication, product CRUD and image uploads, order management, settings. Artwork is representative; existing source images are retained by user choice. Each named composition has been rebranded.

Sales are still closed. Do not substitute preview orders for payment confirmation.

Launch dependencies:

- Confirm country, currency, actual sellable products, ownership/sourcing and real prices. The reference catalog is not proof of stock.
- Connect the owner's payment provider with server-created checkout sessions and signed, idempotent webhooks. Fulfillment begins after verified payment.
- Move the SQLite database and uploads to durable storage, with backups. Current free Render storage resets on restart/redeploy.
- Configure delivery regions, actual shipping rates, tax handling, and return/privacy policies.
- Capture delivery addresses only in the real sales flow. Add transactional order emails and fulfillment tracking.
- Replace representative product artwork with distinct approved images or actual photography. Paid image API use was declined for this release.

Owner confirmed expansion into lifestyle categories, United States market, custom store with CJ API. Country/currency are US/USD for the initial release. The owner has Flutterwave; the production checkout connector uses Flutterwave Standard v3. Owner-only CJ US catalog search and draft preparation are implemented; credentials are pending. See `CJ-SETUP.md`. Stock/cost scheduling is implemented with owner controls and recoverable jobs. Verified-payment order handling, owner-controlled supplier submission/funding and tracking are implemented. Live activation is pending. No payment credentials were requested in chat or committed.

Production integration code and activation instructions: [PRODUCTION-SETUP.md](PRODUCTION-SETUP.md). The build does not provision paid services or connect accounts automatically.
