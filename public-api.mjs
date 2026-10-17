/* Public API + outbound webhooks for one store (owner store 'owner' or a
   merchant store id). Server-only.
   API KEYS: `vg_live_` + random secret. Only the SHA-256 hash is stored;
   the full key is shown ONCE at creation and never logged or returned again.
   Scopes: read:products, read:orders, read:webhooks, write:webhooks.
   Auth: `Authorization: Bearer <key>` or `X-API-Key: <key>`. Per-key rate
   limit (default 60 requests/minute) returns 429.
   WEBHOOKS: per-store endpoints subscribed to order events
   (order.created, order.paid, order.shipped, order.delivered, order.refunded,
   webhook.test, or '*' for all). Each delivery is POSTed as JSON
   {id, event, storeId, sentAt, data} with headers X-Vegarance-Event,
   X-Vegarance-Delivery, X-Vegarance-Timestamp and
   X-Vegarance-Signature: `sha256=<HMAC-SHA256 hex of the raw body>` using
   the endpoint secret. The secret is shown ONCE at creation and never
   returned by list/get afterwards (it must be kept server-side to sign).
   Delivery retries with backoff (1m, 5m, 15m, 1h, 6h); after 6 attempts the
   delivery is marked failed and kept for inspection — it is never retried
   silently forever. Delivery happens in a background tick, never in the
   checkout request path: emit() only enqueues a DB row.
   Order payloads carry the store's own order summary (id, status, totals,
   lines, tracking) — no session tokens, no API keys, no customer passwords.
   Buyer email/address ARE included because fulfilment automations (n8n,
   Zapier, own apps) need them; treat webhook payloads as confidential. */
import {randomBytes, createHash, createHmac, timingSafeEqual} from 'node:crypto';
const fail = (status, message) => Object.assign(new Error(message), {status});
const SCOPES = new Set(['read:products', 'read:orders', 'read:webhooks', 'write:webhooks']);
const EVENTS = new Set(['order.created', 'order.paid', 'order.shipped', 'order.delivered', 'order.refunded', 'webhook.test']);
const BACKOFF_MS = [60000, 300000, 900000, 3600000, 21600000];
const MAX_ATTEMPTS = 6;
const MAX_KEYS = 20, MAX_ENDPOINTS = 10;
const hash = s => createHash('sha256').update(s).digest('hex');
export function signWebhookBody(secret, body) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}
export function verifyWebhookSignature(secret, body, signature) {
  if (typeof signature !== 'string') return false;
  const expected = signWebhookBody(secret, body);
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
function isLocalhostHttpsOk(url) {
  try { const u = new URL(url); return u.protocol === 'https:' || ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.protocol === 'http:'); }
  catch { return false; }
}
export function createPublicApi({db, fetcher = fetch, now = Date.now, rateLimit = {max: 60, windowMs: 60000}, timerFns = {setInterval, clearInterval}} = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS api_keys(id TEXT PRIMARY KEY, store_id TEXT NOT NULL, name TEXT NOT NULL, prefix TEXT NOT NULL, last4 TEXT NOT NULL, key_hash TEXT UNIQUE NOT NULL, scopes TEXT NOT NULL, created_at INTEGER NOT NULL, last_used_at INTEGER, revoked INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS webhook_endpoints(id TEXT PRIMARY KEY, store_id TEXT NOT NULL, url TEXT NOT NULL, events TEXT NOT NULL, secret TEXT NOT NULL, created_at INTEGER NOT NULL, disabled INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS webhook_deliveries(id TEXT PRIMARY KEY, endpoint_id TEXT NOT NULL, store_id TEXT NOT NULL, event TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, last_error TEXT, created_at INTEGER NOT NULL, delivered_at INTEGER);`);
  const rates = new Map();
  const id = () => randomBytes(16).toString('hex');
  const checkLimit = keyId => {
    const old = rates.get(keyId), entry = old && old.until > now() ? old : {count: 0, until: now() + rateLimit.windowMs};
    entry.count++; rates.set(keyId, entry);
    if (rates.size > 10000) for (const [k, v] of rates) if (v.until < now()) rates.delete(k);
    if (entry.count > rateLimit.max) throw fail(429, 'API rate limit exceeded. Slow down and try again shortly.');
  };
  function publicKey(row) {
    return {id: row.id, storeId: row.store_id, name: row.name, prefix: row.prefix, last4: row.last4,
      scopes: JSON.parse(row.scopes), createdAt: row.created_at, lastUsedAt: row.last_used_at || null, revoked: !!row.revoked};
  }
  function publicEndpoint(row) {
    return {id: row.id, storeId: row.store_id, url: row.url, events: JSON.parse(row.events),
      createdAt: row.created_at, disabled: !!row.disabled};
  }
  function createKey(storeId, input = {}) {
    if (typeof storeId !== 'string' || !storeId) throw fail(422, 'Invalid store');
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 80) throw fail(422, 'Give the API key a name up to 80 characters');
    const scopes = Array.isArray(input.scopes) && input.scopes.length ? input.scopes : ['read:products', 'read:orders'];
    if (scopes.some(s => !SCOPES.has(s))) throw fail(422, 'Unknown API key scope');
    const existing = db.prepare('SELECT COUNT(*) c FROM api_keys WHERE store_id=? AND revoked=0').get(storeId);
    if (existing.c >= MAX_KEYS) throw fail(422, 'This store already has the maximum of 20 active API keys. Revoke an unused key first.');
    const secret = randomBytes(24).toString('hex');
    const key = 'vg_live_' + secret;
    const row = {id: id(), storeId, name, prefix: key.slice(0, 15), last4: secret.slice(-4),
      keyHash: hash(key), scopes, createdAt: now()};
    db.prepare('INSERT INTO api_keys VALUES(?,?,?,?,?,?,?,?,?,0)').run(row.id, storeId, name, row.prefix, row.last4, row.keyHash, JSON.stringify(scopes), row.createdAt, null);
    return {key, keyRecord: publicKey({id: row.id, store_id: storeId, name, prefix: row.prefix, last4: row.last4, scopes: JSON.stringify(scopes), created_at: row.createdAt, last_used_at: null, revoked: 0})};
  }
  function listKeys(storeId) {
    return db.prepare('SELECT * FROM api_keys WHERE store_id=? ORDER BY created_at DESC').all(storeId).map(publicKey);
  }
  function revokeKey(storeId, keyId) {
    const row = db.prepare('SELECT * FROM api_keys WHERE id=? AND store_id=?').get(keyId, storeId);
    if (!row) throw fail(404, 'API key not found');
    db.prepare('UPDATE api_keys SET revoked=1 WHERE id=?').run(keyId);
    return {...publicKey(row), revoked: true};
  }
  function authenticate(req) {
    const header = req.headers.authorization || '';
    const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : (req.headers['x-api-key'] || '');
    if (!presented || presented.length > 200) throw fail(401, 'Provide a valid API key in the Authorization header (Bearer <key>) or X-API-Key.');
    const row = db.prepare('SELECT * FROM api_keys WHERE key_hash=? AND revoked=0').get(hash(presented));
    if (!row) throw fail(401, 'Invalid or revoked API key.');
    checkLimit(row.id);
    db.prepare('UPDATE api_keys SET last_used_at=? WHERE id=?').run(now(), row.id);
    return {storeId: row.store_id, keyId: row.id, prefix: row.prefix, scopes: JSON.parse(row.scopes)};
  }
  function requireScope(auth, scope) {
    if (!auth.scopes.includes(scope)) throw fail(403, `This API key does not have the ${scope} scope. Create a key with that scope in API settings.`);
  }
  function validateEndpointInput(input = {}) {
    if (typeof input.url !== 'string' || !isLocalhostHttpsOk(input.url) || input.url.length > 2000) throw fail(422, 'Webhook URL must be an HTTPS URL (HTTP is allowed only for localhost testing)');
    const events = Array.isArray(input.events) && input.events.length ? input.events : null;
    if (!events || events.some(e => e !== '*' && !EVENTS.has(e))) throw fail(422, 'Webhook events must be order.created, order.paid, order.shipped, order.delivered, order.refunded, webhook.test, or * for all events');
    return {url: input.url.trim(), events: [...new Set(events)]};
  }
  function createEndpoint(storeId, input = {}) {
    if (typeof storeId !== 'string' || !storeId) throw fail(422, 'Invalid store');
    const {url, events} = validateEndpointInput(input);
    const existing = db.prepare('SELECT COUNT(*) c FROM webhook_endpoints WHERE store_id=? AND disabled=0').get(storeId);
    if (existing.c >= MAX_ENDPOINTS) throw fail(422, 'This store already has the maximum of 10 webhook endpoints. Delete an unused endpoint first.');
    const secret = 'whsec_' + randomBytes(32).toString('hex');
    const row = {id: id(), storeId, url, events, createdAt: now()};
    db.prepare('INSERT INTO webhook_endpoints VALUES(?,?,?,?,?,?,0)').run(row.id, storeId, url, JSON.stringify(events), secret, row.createdAt);
    return {endpoint: publicEndpoint({id: row.id, store_id: storeId, url, events: JSON.stringify(events), created_at: row.createdAt, disabled: 0}), secret};
  }
  function listEndpoints(storeId) {
    return db.prepare('SELECT * FROM webhook_endpoints WHERE store_id=? ORDER BY created_at DESC').all(storeId).map(publicEndpoint);
  }
  function deleteEndpoint(storeId, endpointId) {
    const row = db.prepare('SELECT * FROM webhook_endpoints WHERE id=? AND store_id=?').get(endpointId, storeId);
    if (!row) throw fail(404, 'Webhook endpoint not found');
    db.prepare('DELETE FROM webhook_endpoints WHERE id=?').run(endpointId);
    db.prepare('DELETE FROM webhook_deliveries WHERE endpoint_id=? AND state=?').run(endpointId, 'queued');
    return {deleted: true, id: endpointId};
  }
  function deliveries(storeId, limit = 50) {
    return db.prepare('SELECT d.*, e.url endpoint_url FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id=d.endpoint_id WHERE d.store_id=? ORDER BY d.created_at DESC LIMIT ?').all(storeId, Math.min(200, Math.max(1, limit))).map(r => ({
      id: r.id, endpointId: r.endpoint_id, endpointUrl: r.endpoint_url, storeId: r.store_id, event: r.event,
      state: r.state, attempts: r.attempts, nextAt: r.next_at, lastError: r.last_error || null,
      createdAt: r.created_at, deliveredAt: r.delivered_at || null,
    }));
  }
  function enqueue(storeId, endpoint, event, payload) {
    const queued = db.prepare("SELECT COUNT(*) c FROM webhook_deliveries WHERE endpoint_id=? AND state='queued'").get(endpoint.id);
    if (queued.c > 500) return null; // Bound growth: drop when a dead endpoint piles up.
    const delivery = {id: id(), endpointId: endpoint.id, storeId, event, payload, state: 'queued', attempts: 0, nextAt: now(), createdAt: now()};
    db.prepare('INSERT INTO webhook_deliveries VALUES(?,?,?,?,?,?,?,?,NULL,?,NULL)').run(
      delivery.id, endpoint.id, storeId, event, JSON.stringify(payload), 'queued', 0, delivery.nextAt, delivery.createdAt);
    return delivery;
  }
  function emit(storeId, event, payload) {
    if (!EVENTS.has(event)) return [];
    const endpoints = db.prepare('SELECT * FROM webhook_endpoints WHERE store_id=? AND disabled=0').all(storeId);
    const out = [];
    for (const row of endpoints) {
      const events = JSON.parse(row.events);
      if (!events.includes('*') && !events.includes(event)) continue;
      const d = enqueue(storeId, {id: row.id}, event, payload);
      if (d) out.push(d);
    }
    return out;
  }
  async function deliverOne(delivery) {
    const endpoint = db.prepare('SELECT * FROM webhook_endpoints WHERE id=? AND disabled=0').get(delivery.endpoint_id);
    if (!endpoint) { db.prepare("UPDATE webhook_deliveries SET state='failed', last_error='Endpoint deleted or disabled' WHERE id=?").run(delivery.id); return {delivered: false, reason: 'Endpoint deleted or disabled'}; }
    const body = JSON.stringify({id: delivery.id, event: delivery.event, storeId: delivery.store_id, sentAt: now(), data: JSON.parse(delivery.payload)});
    const headers = {'Content-Type': 'application/json', 'X-Vegarance-Event': delivery.event,
      'X-Vegarance-Delivery': delivery.id, 'X-Vegarance-Timestamp': String(now()),
      'X-Vegarance-Signature': signWebhookBody(endpoint.secret, body)};
    try {
      const response = await fetcher(endpoint.url, {method: 'POST', headers, body, signal: AbortSignal.timeout(15000)});
      if (response.ok) {
        db.prepare("UPDATE webhook_deliveries SET state='sent', delivered_at=?, last_error=NULL WHERE id=?").run(now(), delivery.id);
        return {delivered: true, status: response.status};
      }
      throw new Error('Receiver returned HTTP ' + response.status);
    } catch (e) {
      const attempts = delivery.attempts + 1;
      const lastError = String(e?.message || e).slice(0, 300);
      if (attempts >= MAX_ATTEMPTS) {
        db.prepare('UPDATE webhook_deliveries SET state=?, attempts=?, last_error=? WHERE id=?').run('failed', attempts, lastError, delivery.id);
        return {delivered: false, reason: lastError, attempts, state: 'failed'};
      }
      const nextAt = now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
      db.prepare('UPDATE webhook_deliveries SET state=?, attempts=?, next_at=?, last_error=? WHERE id=?').run('queued', attempts, nextAt, lastError, delivery.id);
      return {delivered: false, reason: lastError, attempts, state: 'queued', nextAt};
    }
  }
  async function tick(limit = 20) {
    const due = db.prepare("SELECT * FROM webhook_deliveries WHERE state='queued' AND next_at<=? ORDER BY next_at ASC LIMIT ?").all(now(), limit);
    let sent = 0, failed = 0;
    for (const row of due) {
      const current = db.prepare('SELECT * FROM webhook_deliveries WHERE id=?').get(row.id);
      if (!current || current.state !== 'queued') continue;
      const result = await deliverOne(current);
      if (result.delivered) sent++; else if (result.state === 'failed') failed++;
    }
    return {processed: due.length, sent, failed};
  }
  async function testEndpoint(storeId, endpointId) {
    const row = db.prepare('SELECT * FROM webhook_endpoints WHERE id=? AND store_id=? AND disabled=0').get(endpointId, storeId);
    if (!row) throw fail(404, 'Webhook endpoint not found');
    const created = enqueue(storeId, row, 'webhook.test', {message: 'Test delivery from VEGArance. If you can read this, your endpoint verifies signatures and accepts events.'});
    if (!created) throw fail(503, 'Webhook delivery queue is full for this endpoint. Try again after it drains.');
    const fresh = db.prepare('SELECT * FROM webhook_deliveries WHERE id=?').get(created.id);
    return deliverOne(fresh);
  }
  function stats() {
    const endpoints = db.prepare('SELECT COUNT(*) c FROM webhook_endpoints WHERE disabled=0').get().c;
    const queued = db.prepare("SELECT COUNT(*) c FROM webhook_deliveries WHERE state='queued'").get().c;
    const failed = db.prepare("SELECT COUNT(*) c FROM webhook_deliveries WHERE state='failed'").get().c;
    return {endpoints, queuedDeliveries: queued, failedDeliveries: failed};
  }
  let timer;
  return {createKey, listKeys, revokeKey, authenticate, requireScope, createEndpoint, listEndpoints,
    deleteEndpoint, deliveries, emit, deliverOne, tick, testEndpoint, stats, signWebhookBody,
    start() { timer = timerFns.setInterval(() => tick().catch(() => {}), 30000); if (timer.unref) timer.unref(); },
    stop() { if (timer) timerFns.clearInterval(timer); }};
}
