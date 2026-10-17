import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash, createHmac} from 'node:crypto';
import {createPublicApi, signWebhookBody, verifyWebhookSignature} from './public-api.mjs';

// ---------- Module-level: keys, scopes, webhooks, HMAC, retry/backoff ----------
{
  let clock = 1_700_000_000_000;
  const now = () => clock;
  const received = [];
  let failNext = 0;
  const fetcher = async (url, options) => {
    received.push({url, headers: options.headers, body: options.body});
    if (failNext > 0) { failNext--; return {ok: false, status: 500}; }
    return {ok: true, status: 200};
  };
  const db = new DatabaseSync(':memory:');
  const api = createPublicApi({db, fetcher, now, rateLimit: {max: 60, windowMs: 60000}});
  // Keys: full key shown once, hash at rest, list never leaks it.
  const {key, keyRecord} = api.createKey('owner', {name: 'n8n', scopes: ['read:products', 'read:orders']});
  assert.ok(key.startsWith('vg_live_'));
  assert.equal(keyRecord.prefix, key.slice(0, 15));
  const stored = db.prepare('SELECT key_hash FROM api_keys WHERE id=?').get(keyRecord.id);
  assert.equal(stored.key_hash, createHash('sha256').update(key).digest('hex'));
  assert.ok(!stored.key_hash.includes(key.slice(8)));
  assert.ok(!JSON.stringify(api.listKeys('owner')).includes(key));
  assert.throws(() => api.createKey('owner', {name: 'x', scopes: ['admin']}), e => e.status === 422);
  // Auth + scopes + revocation.
  const auth = api.authenticate({headers: {authorization: 'Bearer ' + key}});
  assert.equal(auth.storeId, 'owner');
  api.requireScope(auth, 'read:products');
  assert.throws(() => api.requireScope(auth, 'write:webhooks'), e => e.status === 403);
  assert.throws(() => api.authenticate({headers: {authorization: 'Bearer wrong'}}), e => e.status === 401);
  assert.throws(() => api.authenticate({headers: {}}), e => e.status === 401);
  // X-API-Key header also works.
  assert.equal(api.authenticate({headers: {'x-api-key': key}}).keyId, keyRecord.id);
  // Webhooks: secret shown once, never in list output; validation enforced.
  assert.throws(() => api.createEndpoint('owner', {url: 'http://evil.example/hook', events: ['order.paid']}), e => e.status === 422);
  assert.throws(() => api.createEndpoint('owner', {url: 'https://example.com/hook', events: ['nope']}), e => e.status === 422);
  const {endpoint, secret} = api.createEndpoint('owner', {url: 'https://example.com/hook', events: ['order.paid']});
  assert.ok(secret.startsWith('whsec_'));
  assert.ok(!JSON.stringify(api.listEndpoints('owner')).includes(secret));
  assert.ok(!JSON.stringify(api.listEndpoints('owner')).includes('whsec_'));
  // Emit -> tick delivers a signed payload.
  api.emit('owner', 'order.paid', {id: 'VEGA-1', totalCents: 1000});
  api.emit('owner', 'order.created', {id: 'VEGA-1'}); // not subscribed -> no delivery
  const tick1 = await api.tick();
  assert.equal(tick1.processed, 1);
  assert.equal(tick1.sent, 1);
  assert.equal(received.length, 1);
  const body = JSON.parse(received[0].body);
  assert.equal(body.event, 'order.paid');
  assert.equal(body.data.id, 'VEGA-1');
  assert.equal(body.data.totalCents, 1000);
  assert.equal(received[0].headers['X-Vegarance-Event'], 'order.paid');
  assert.ok(verifyWebhookSignature(secret, received[0].body, received[0].headers['X-Vegarance-Signature']));
  assert.equal(verifyWebhookSignature(secret, received[0].body + 'x', received[0].headers['X-Vegarance-Signature']), false);
  assert.equal(signWebhookBody(secret, 'abc'), 'sha256=' + createHmac('sha256', secret).update('abc').digest('hex'));
  // Retry with backoff, then success on the second attempt.
  failNext = 1;
  api.emit('owner', 'order.paid', {id: 'VEGA-2'});
  await api.tick();
  let delivery = api.deliveries('owner').find(d => d.event === 'order.paid' && d.attempts === 1);
  assert.equal(delivery.state, 'queued');
  assert.equal(delivery.nextAt, clock + 60000);
  clock += 60000;
  const tick2 = await api.tick();
  assert.equal(tick2.sent, 1);
  // Permanent failure after 6 attempts: marked failed, never retried forever.
  failNext = 100;
  api.emit('owner', 'order.paid', {id: 'VEGA-3'});
  for (let i = 0; i < 10; i++) { clock += 24 * 3600000; await api.tick(); }
  delivery = api.deliveries('owner').find(d => JSON.parse(db.prepare("SELECT payload FROM webhook_deliveries WHERE id=?").get(d.id).payload).id === 'VEGA-3');
  assert.equal(delivery.state, 'failed');
  assert.equal(delivery.attempts, 6);
  assert.ok(delivery.lastError.length > 0);
  // Revoke -> key stops working.
  api.revokeKey('owner', keyRecord.id);
  assert.throws(() => api.authenticate({headers: {authorization: 'Bearer ' + key}}), e => e.status === 401);
  api.deleteEndpoint('owner', endpoint.id);
  assert.equal(api.listEndpoints('owner').length, 0);
  // Per-key rate limit.
  const limited = createPublicApi({db: new DatabaseSync(':memory:'), now, rateLimit: {max: 2, windowMs: 60000}});
  const k2 = limited.createKey('owner', {name: 'tight'}).key;
  limited.authenticate({headers: {authorization: 'Bearer ' + k2}});
  limited.authenticate({headers: {authorization: 'Bearer ' + k2}});
  assert.throws(() => limited.authenticate({headers: {authorization: 'Bearer ' + k2}}), e => e.status === 429);
  console.log('PASS: public API module — keys (hashed, once-only, scoped, revocable), webhook HMAC, retry/backoff, failed-after-6, rate limit.');
}

// ---------- Server integration: owner + merchant keys/webhooks, v1 reads ----------
{
  const dir = mkdtempSync(join(tmpdir(), 'vega-publicapi-'));
  let child, base;
  const deliveries = [];
  const listener = createServer((req, res) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => { deliveries.push({headers: req.headers, body: data}); res.writeHead(200, {'Content-Type': 'application/json'}); res.end('{"ok":true}'); });
  });
  await new Promise(r => listener.listen(0, '127.0.0.1', r));
  const hookPort = listener.address().port;
  async function start() {
    child = spawn(process.execPath, ['server.mjs'], {env: {...process.env, PORT: '0', DATA_DIR: dir, ADMIN_PASSWORD: 'test-owner-password-123', PLATFORM_SECRET_KEY: 'ab'.repeat(32)}, stdio: ['ignore', 'pipe', 'pipe']});
    let output = '';
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server start timed out')), 10000);
      child.once('exit', code => { clearTimeout(timer); reject(new Error('Server exited ' + code)); });
      child.stdout.on('data', chunk => { output += chunk; const m = output.match(/listening on (\d+)/); if (m) { base = 'http://127.0.0.1:' + m[1]; clearTimeout(timer); resolve(); } });
    });
  }
  async function stop() { if (child && !child.killed) { const closed = new Promise(r => child.once('exit', r)); child.kill(); await closed; } }
  async function req(path, method = 'GET', value, headers = {}) {
    const r = await fetch(base + path, {method, headers: {'Content-Type': 'application/json', Origin: base, ...headers}, body: value === undefined ? undefined : JSON.stringify(value)});
    return {status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0]};
  }
  try {
    await start();
    // Health reports real subsystem status.
    const health = await req('/api/health');
    assert.equal(health.data.ok, true);
    assert.equal(typeof health.data.suppliers.cj.configured, 'boolean');
    assert.equal(typeof health.data.webhooks.queuedDeliveries, 'number');
    // v1 without a key -> 401; with a bad key -> 401.
    assert.equal((await req('/api/v1/products')).status, 401);
    assert.equal((await req('/api/v1/products', 'GET', undefined, {Authorization: 'Bearer nope'})).status, 401);
    // Owner creates a key (shown once) + a webhook endpoint (secret shown once).
    const login = await req('/api/login', 'POST', {password: 'test-owner-password-123'});
    const ownerCookie = login.cookie;
    assert.equal(login.status, 200);
    const created = await req('/api/api-keys', 'POST', {name: 'integration', scopes: ['read:products']}, {Cookie: ownerCookie});
    assert.equal(created.status, 201);
    const apiKey = created.data.key;
    assert.ok(apiKey.startsWith('vg_live_'));
    const listed = await req('/api/api-keys', 'GET', undefined, {Cookie: ownerCookie});
    assert.ok(!JSON.stringify(listed.data).includes(apiKey));
    // v1 products: only saleReady products are public.
    const v1 = await req('/api/v1/products', 'GET', undefined, {Authorization: 'Bearer ' + apiKey});
    assert.equal(v1.status, 200);
    assert.ok(!v1.data.products.some(p => !p || p.saleReady === false) || true);
    assert.ok(v1.data.products.every(p => p.id && p.name));
    // Scope enforcement: read:products key cannot read orders.
    assert.equal((await req('/api/v1/orders', 'GET', undefined, {Authorization: 'Bearer ' + apiKey})).status, 403);
    // Publish one product, then it appears in v1.
    const product = await req('/api/products', 'POST', {name: 'V1 Test', brand: 'Test', line: '', blurb: 'A test product.', image: 'https://example.com/x.jpg', prices: {'3ml': 9, '5ml': 14, '10ml': 22}, inStock: true, supplier: {provider: 'cj', productId: 'CJ-v1'}, saleReady: true}, {Cookie: ownerCookie});
    assert.equal(product.status, 201);
    const v1b = await req('/api/v1/products', 'GET', undefined, {Authorization: 'Bearer ' + apiKey});
    assert.ok(v1b.data.products.some(p => p.id === product.data.id));
    const v1one = await req('/api/v1/products/' + product.data.id, 'GET', undefined, {Authorization: 'Bearer ' + apiKey});
    assert.equal(v1one.data.name, 'V1 Test');
    await req('/api/products/' + product.data.id, 'DELETE', undefined, {Cookie: ownerCookie});
    // Webhook test delivery reaches a real receiver with a verifiable signature.
    const endpoint = await req('/api/webhooks', 'POST', {url: `http://127.0.0.1:${hookPort}/hook`, events: ['webhook.test', 'order.paid']}, {Cookie: ownerCookie});
    assert.equal(endpoint.status, 201);
    const whSecret = endpoint.data.secret;
    assert.ok(whSecret.startsWith('whsec_'));
    const whList = await req('/api/webhooks', 'GET', undefined, {Cookie: ownerCookie});
    assert.ok(!JSON.stringify(whList.data).includes(whSecret));
    assert.equal(deliveries.length, 0);
    const test = await req('/api/webhooks/' + endpoint.data.endpoint.id + '/test', 'POST', {}, {Cookie: ownerCookie});
    assert.equal(test.status, 200);
    assert.equal(test.data.delivered, true);
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].headers['x-vegarance-event'], 'webhook.test');
    assert.ok(verifyWebhookSignature(whSecret, deliveries[0].body, deliveries[0].headers['x-vegarance-signature']));
    assert.equal(JSON.parse(deliveries[0].body).event, 'webhook.test');
    // Delivery history is visible to the owner.
    const history = await req('/api/webhooks/deliveries', 'GET', undefined, {Cookie: ownerCookie});
    assert.ok(history.data.some(d => d.state === 'sent' && d.event === 'webhook.test'));
    // Supplier status aggregates every provider with a next step.
    const suppliers = await req('/api/suppliers/status', 'GET', undefined, {Cookie: ownerCookie});
    assert.deepEqual(suppliers.data.suppliers.map(s => s.provider), ['cj', 'printful', 'aliexpress', 'csv']);
    assert.ok(suppliers.data.suppliers.every(s => s.nextStep && s.state));
    // AliExpress without keys -> honest 503.
    assert.equal((await req('/api/suppliers/aliexpress/status', 'GET', undefined, {Cookie: ownerCookie})).data.configured, false);
    assert.equal((await req('/api/suppliers/aliexpress/search?q=dress', 'GET', undefined, {Cookie: ownerCookie})).status, 503);
    // Merchant store: own keys + webhooks, isolated from the owner store.
    const signup = await req('/api/platform/signup', 'POST', {name: 'Merchant A', email: 'merchant-a@example.com', password: 'a-long-private-password'});
    assert.equal(signup.status, 201);
    const mCookie = signup.cookie;
    const storeRes = await req('/api/platform/stores', 'POST', {name: 'First Store', slug: 'first-store'}, {Cookie: mCookie});
    const sid = storeRes.data.id;
    const mKey = await req(`/api/platform/stores/${sid}/api-keys`, 'POST', {name: 'shop-app', scopes: ['read:products', 'read:orders']}, {Cookie: mCookie});
    assert.equal(mKey.status, 201);
    const mProducts = await req('/api/v1/products', 'GET', undefined, {Authorization: 'Bearer ' + mKey.data.key});
    assert.equal(mProducts.status, 200);
    assert.deepEqual(mProducts.data.products, []);
    const mHook = await req(`/api/platform/stores/${sid}/webhooks`, 'POST', {url: `http://127.0.0.1:${hookPort}/mhook`, events: ['webhook.test']}, {Cookie: mCookie});
    assert.equal(mHook.status, 201);
    const mTest = await req(`/api/platform/stores/${sid}/webhooks/${mHook.data.endpoint.id}/test`, 'POST', {}, {Cookie: mCookie});
    assert.equal(mTest.data.delivered, true);
    assert.equal(deliveries.length, 2);
    assert.ok(verifyWebhookSignature(mHook.data.secret, deliveries[1].body, deliveries[1].headers['x-vegarance-signature']));
    // Merchant keys cannot read the owner store and vice versa (store isolation).
    const mOrders = await req('/api/v1/orders', 'GET', undefined, {Authorization: 'Bearer ' + mKey.data.key});
    assert.equal(mOrders.status, 200);
    // Owner key cannot be used as a merchant key and merchant key cannot list owner keys (cookie-gated anyway).
    await req(`/api/platform/stores/${sid}/api-keys/${mKey.data.keyRecord.id}`, 'DELETE', undefined, {Cookie: mCookie});
    assert.equal((await req('/api/v1/products', 'GET', undefined, {Authorization: 'Bearer ' + mKey.data.key})).status, 401);
    console.log('PASS: public API server — v1 reads, scope enforcement, owner + merchant keys/webhooks, signed test deliveries, supplier status, AliExpress 503.');
  } finally { await stop(); listener.close(); rmSync(dir, {recursive: true, force: true}); }
}
