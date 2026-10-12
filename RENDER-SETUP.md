# Create the free Node demo service

The current `frag-man-plug-demo.onrender.com` service is a static site. Updating its files does not start the Node backend. Create a separate **Web Service** for the server-backed version.

1. In Render, select **New → Web Service** and connect `Olamilekan2580/frag-man-plug`.
2. Branch: `main`. Runtime: Node. Root directory: leave blank.
3. Name: `frag-man-plug-store` (or another available name).
4. Build command: `node --check server.mjs`.
5. Start command: `npm start`.
6. Instance type: **Free**. Do not attach a paid disk.
7. Environment variables:
   - `NODE_VERSION`: `24`
   - `HOST`: `0.0.0.0`
   - `ADMIN_PASSWORD`: your own strong password, at least 12 characters. Set it in Render; do not put it in GitHub or chat.
8. Deploy. Health path: `/api/health`. Open the new service's URL for the storefront and `/admin.html` for owner login.

`render.yaml` describes the same free service if you prefer a Blueprint.

## What this service does

Products are stored in SQLite on the server. Owners can add, inspect, edit and delete products, including descriptions, brands, collection names, three decant prices, availability, image URLs and uploaded PNG/JPEG/WebP images. Owner writes require a login session. Visitors see the shared catalog without logging in. Demo checkout recalculates prices from server products and stores a demo order without customer name/email. The owner can read and update order status and save store settings. Payments remain disconnected.

## Agreed free-demo limitation

Render's free filesystem is temporary: database changes and uploaded images can be lost on restarts or redeploys. This is the temporary option explicitly selected by the user. It is not durable production storage. For launch, migrate to a persistent database/upload provider or an approved paid service with a persistent disk.

Render documentation: https://render.com/docs/web-services and https://render.com/docs/free.

## Local run

Use Node 24+ (Node 22.13+ also exposes the SQLite API). Set `ADMIN_PASSWORD` in your local shell environment, then run:

```sh
cd /home/olamihacks/frag-man-plug/storefront
npm start
```

The local server defaults to `http://127.0.0.1:4174`. Local SQLite data lives in the ignored `data/` directory and survives local server restarts. `DATA_DIR` can point to another directory. The Node server marks its pages as server-backed automatically. The existing static Render site continues to use an explicitly labeled browser-only CRUD preview until you open the new Node service.

## Checks

```sh
node test-api.mjs
python3 test-crud-layout.py
python3 test-demo.py
```

The API tests verify authentication, same-origin writes, validation, product CRUD, stock, server-side order totals, order status/deletion, settings, restart persistence and logout. Browser tests cover create/read/edit/delete, image uploads, cancellation, storefront propagation and shared visibility between independent browser sessions. Layout tests check each lower-page section, constrained scrolling lists, sibling overlap and expanded FAQ answers across ten widths.
