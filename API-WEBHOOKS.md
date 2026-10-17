# Public API + outbound webhooks

Connect n8n, Zapier, or your own app to a VEGArance store — read its
published products and orders, and receive signed order events the moment
they happen. No scraping, no session cookies.

Two stores, two key spaces: the **owner store** (keys managed in
`admin.html` via `GET/POST/DELETE /api/api-keys`) and each **merchant
store** (keys managed via
`/api/platform/stores/:storeId/api-keys` while signed in as that merchant).
A key only ever works for the store it was created for.

## Authentication

`Authorization: Bearer <key>` or `X-API-Key: <key>`.

- Keys look like `vg_live_<48 hex chars>`. The full key is shown **once**
  at creation. Only a SHA-256 hash is stored; the key is never logged and
  cannot be recovered from the server — if you lose it, revoke it and
  create a new one.
- Rate limit: **60 requests/minute per key** (429 when exceeded).
- Scopes: `read:products`, `read:orders`, `read:webhooks`,
  `write:webhooks`. A key without the needed scope gets 403 with the
  missing scope named.

## Read endpoints

All `GET`, all paginated with `?limit=` (1–100, default 20) and
`?offset=` (default 0). Responses are
`{total, limit, offset, products[]}` / `{total, limit, offset, orders[]}`.

| Endpoint | Scope | Notes |
|---|---|---|
| `GET /api/v1/products` | `read:products` | Published (`saleReady`) products only. |
| `GET /api/v1/products/:id` | `read:products` | 404 unless published. |
| `GET /api/v1/orders` | `read:orders` | Store's own orders, newest first. |
| `GET /api/v1/orders/:id` | `read:orders` | One order. |

Product shape: `{id, name, brand, category, line, blurb, image, prices,
variants, inStock, updatedAt}` (merchant stores: `{id, name, description,
image, priceCents, visible, saleReady, variants[]}`).

Order shape: `{id, status, paymentStatus, paymentMode, lines[],
subtotalCents, shippingCents, taxCents, totalCents, shippingMethod,
tracking, email, address, createdAt, paidAt}`. Email/address are included
because fulfilment automations need them — keep keys secret and treat
responses as confidential. No session tokens are ever returned.

## Webhooks

Outbound events for order changes. Manage endpoints per store:

- Owner store: `GET/POST /api/webhooks`, `DELETE /api/webhooks/:id`,
  `POST /api/webhooks/:id/test`, `GET /api/webhooks/deliveries`
  (owner login required).
- Merchant store: same shapes under
  `/api/platform/stores/:storeId/webhooks…` (merchant login required).

Create: `POST …/webhooks` with `{url, events}`. `url` must be HTTPS
(HTTP is allowed only for `localhost`/`127.0.0.1` testing). `events` is a
subset of the list below, or `["*"]` for all events. The response contains
the endpoint **and** a `secret` (`whsec_…`) shown **once** — it is never
returned by list/get afterwards, because the server needs it to sign
deliveries. Store it with your endpoint. Max 10 endpoints per store.

Events: `order.created`, `order.paid`, `order.shipped`,
`order.delivered`, `order.refunded`, `webhook.test`.

Delivery: `POST` to your URL with a JSON body

```json
{"id": "<delivery id>", "event": "order.paid", "storeId": "owner",
 "sentAt": 1700000000000,
 "data": {"id": "VEGA-…", "status": "Paid", "paymentStatus": "paid",
  "totalCents": 4599, "lines": [], "email": "buyer@example.com",
  "address": {"name": "…", "city": "…", "state": "FL", "zip": "33101"}}}
```

and headers `X-Vegarance-Event`, `X-Vegarance-Delivery`,
`X-Vegarance-Timestamp`, and

```
X-Vegarance-Signature: sha256=<HMAC-SHA256 hex of the raw request body, keyed with your endpoint secret>
```

**Verify every delivery** — reject anything whose signature does not match.
Node:

```js
import {createHmac, timingSafeEqual} from 'node:crypto';
const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
const ok = expected.length === signature.length &&
  timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
```

Python:

```python
import hmac, hashlib
expected = 'sha256=' + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
ok = hmac.compare_digest(expected, signature)
```

Return any 2xx to acknowledge. Anything else (or a timeout, 15s) is a
failed attempt. Retries use backoff **1 min, 5 min, 15 min, 1 h, 6 h**;
after **6 attempts** the delivery is marked `failed` and kept in delivery
history (`GET …/webhooks/deliveries`) for inspection — it is never retried
forever. Delivery runs in a background worker, never in the checkout
request path, so a slow receiver cannot slow down a buyer. If an endpoint
piles up more than 500 queued deliveries, new events for it are dropped
until the queue drains (a dead endpoint must not grow the queue forever).

`POST …/webhooks/:id/test` sends a `webhook.test` event immediately and
returns `{delivered: true/false, …}` — use it to confirm your receiver
verifies signatures before relying on real order events.

### n8n / Zapier

- **n8n:** Webhook node (POST) → verify the signature in a Code node with
  the snippet above → branch on `event` (`order.paid` → fulfilment,
  `order.refunded` → cancel fulfilment).
- **Zapier:** Webhooks by Zapier → Catch Hook → Filter on the
  `X-Vegarance-Event` header (Zapier cannot verify HMAC in a Catch Hook;
  use a Code step if verification matters, or front it with a small
  verifier).

## Health

`GET /api/health` (no auth) reports real subsystem status: supplier
configuration (`cj`, `printful`, `aliexpress`, `csv`, `ai`), sales
readiness, and webhook queue depth (`queuedDeliveries`,
`failedDeliveries`).

## Errors

All API errors are `{error: "<buyer/operator-actionable message>"}` with
the HTTP status: 400 invalid JSON, 401 missing/invalid/revoked key,
403 missing scope, 404 unknown route/id, 422 invalid input, 429 rate
limit, 502 provider rejected the request, 503 not configured / sales not
open.
