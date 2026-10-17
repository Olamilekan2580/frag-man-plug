/* Vegarance v3 Phase B — P0 gaps tests.
   Billing state machine + gating (no charges, no prices), pluggable
   payment providers (Stripe slot: 503-until-configured, then real
   Checkout/webhook/refund shapes via a mock fetcher), durable-storage
   truthfulness + backup verification, activation gates (billing standing
   + selected payment provider + string Stripe transaction ids), and
   onboarding publish gating on activation. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMerchantBilling, effectivePlan, BILLING_PLANS} from './merchant-billing.mjs';
import {createStripePayments, createPaymentProvider} from './payment-providers.mjs';
import {describeStorage, verifyBackupFile} from './storage.mjs';
import {createMerchantCommerce} from './merchant-commerce.mjs';
import {createMerchantConnections} from './merchant-connections.mjs';
import {deriveOnboarding} from './onboarding.mjs';

/* ---------- 1. Billing: plans, trial, expiry, past-due, gating ---------- */
{
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE merchants(id TEXT PRIMARY KEY);
    CREATE TABLE merchant_stores(id TEXT PRIMARY KEY, merchant_id TEXT);
    INSERT INTO merchants VALUES('m1'),('m2'),('m3'),('m4');
    INSERT INTO merchant_stores VALUES('store-m1','m1');`);
  let time = 1000000;
  const billing = createMerchantBilling({db, now: () => time});

  // Default: Free, no provider, no charges, no prices anywhere.
  const fresh = billing.get('m1');
  assert.equal(fresh.effectivePlan, 'free');
  assert.equal(fresh.status, 'none');
  assert.equal(fresh.provider, 'none');
  assert.equal(fresh.billingEnabled, false);
  assert.equal(fresh.chargesLive, false);
  assert.equal(fresh.limits.maxStores, 1);
  assert.equal(fresh.limits.maxProducts, 20);
  assert.equal(JSON.stringify(billing.plans()).includes('$'), false, 'no prices in plan definitions');
  assert.equal(JSON.stringify(fresh).includes('$'), false);

  // Gates on Free.
  assert.equal(billing.gate('m1', 'create_store', {currentStores: 0}).allowed, true);
  assert.equal(billing.gate('m1', 'create_store', {currentStores: 1}).allowed, false);
  assert.ok(billing.gate('m1', 'create_store', {currentStores: 1}).reason.includes('Free'));
  assert.equal(billing.gate('m1', 'add_product', {currentProducts: 19}).allowed, true);
  assert.equal(billing.gate('m1', 'add_product', {currentProducts: 20}).allowed, false);
  assert.equal(billing.gate('m1', 'api', {scopes: ['read:products']}).allowed, true);
  assert.equal(billing.gate('m1', 'api', {scopes: ['read:orders', 'write:products']}).allowed, false);
  assert.equal(billing.gate('m1', 'webhooks', {currentEndpoints: 0}).allowed, false);
  assert.equal(billing.gate('m1', 'custom_domain').allowed, false);
  assert.ok(billing.gate('m1', 'custom_domain').reason.includes('not built'));

  // Free trial: 14 days of Starter, once ever, no charge.
  const trial = billing.startTrial('m1');
  assert.equal(trial.effectivePlan, 'starter');
  assert.equal(trial.status, 'trialing');
  assert.equal(trial.trialEndsAt, time + 14 * 86400000);
  assert.equal(billing.gate('m1', 'create_store', {currentStores: 1}).allowed, true);
  assert.equal(billing.gate('m1', 'webhooks', {currentEndpoints: 4}).allowed, true);
  assert.equal(billing.gate('m1', 'webhooks', {currentEndpoints: 5}).allowed, false);
  assert.equal(billing.gate('m1', 'custom_domain').allowed, false, 'even Starter cannot unlock unbuilt custom domains');
  assert.throws(() => billing.startTrial('m1'), e => e.status === 409, 'trial is once ever');

  // Trial expiry downgrades to Free (pure function + stored record).
  time += 14 * 86400000 + 1;
  assert.equal(effectivePlan({plan: 'starter', status: 'trialing', trialEndsAt: time - 1}, time), 'free');
  assert.equal(billing.get('m1').effectivePlan, 'free');
  assert.equal(billing.gate('m1', 'create_store', {currentStores: 1}).allowed, false);

  // Cancel: trialing/active/past_due only; nothing to cancel on Free.
  assert.throws(() => billing.cancel('m3'), e => e.status === 409);
  billing.setPlan('m4', {plan: 'starter', status: 'active', provider: 'manual'});
  assert.equal(billing.get('m4').effectivePlan, 'starter');
  assert.equal(billing.cancel('m4').effectivePlan, 'free');
  assert.equal(billing.get('m4').status, 'cancelled');

  // Past-due: grace keeps the plan, past grace suspends (gates as Free).
  billing.setPlan('m2', {plan: 'growth', status: 'past_due', provider: 'manual', pastDueSince: time});
  assert.equal(billing.get('m2').effectivePlan, 'growth');
  assert.equal(billing.get('m2').suspended, false);
  time += 8 * 86400000;
  assert.equal(billing.get('m2').effectivePlan, 'free');
  assert.equal(billing.get('m2').suspended, true);
  assert.equal(billing.statusForStore('store-m1').merchantId, 'm1');
  assert.equal(billing.statusForStore('missing-store'), null);

  // setPlan validation: unknown plan/status/provider rejected.
  assert.throws(() => billing.setPlan('m3', {plan: 'ultra', status: 'active', provider: 'manual'}), e => e.status === 422);
  assert.throws(() => billing.setPlan('m3', {plan: 'starter', status: 'weird', provider: 'manual'}), e => e.status === 422);
  assert.throws(() => billing.setPlan('m3', {plan: 'starter', status: 'active', provider: 'magic'}), e => e.status === 422);
  assert.throws(() => billing.gate('m3', 'teleport'), e => e.status === 422);
  assert.ok(BILLING_PLANS.free && BILLING_PLANS.starter && BILLING_PLANS.growth);
  db.close();
  console.log('PASS: billing — Free default (no charges/prices), trial once + expiry, cancel, past-due grace + suspension, gates, setPlan validation.');
}

/* ---------- 2. Stripe provider slot ---------- */
{
  // Not configured: every method is an honest 503.
  const empty = createStripePayments({secret: '', webhookSecret: '', mode: 'test'});
  assert.equal(empty.configured, false);
  assert.equal(empty.provider, 'stripe');
  await assert.rejects(() => empty.checkConnection(), e => e.status === 503);
  await assert.rejects(() => empty.checkout({id: 'MORD-1', totalCents: 100, email: 'a@b.co', token: 't'}, 'https://x.example'), e => e.status === 503);
  await assert.rejects(() => empty.verifyTransaction('cs_1'), e => e.status === 503);
  await assert.rejects(() => empty.refund({transactionId: 'pi_1', totalCents: 100, id: 'MORD-1'}), e => e.status === 503);
  assert.throws(() => empty.verify(Buffer.from('{}'), 't=1,v1=abc'), e => e.status === 503);

  // Configured with a mock fetcher: real Checkout / verify / refund shapes.
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({url, method: options.method || 'GET'});
    const target = new URL(url);
    const json = data => new Response(JSON.stringify(data), {status: 200, headers: {'Content-Type': 'application/json'}});
    if (target.pathname === '/v1/account') return json({id: 'acct_1'});
    if (target.pathname === '/v1/checkout/sessions' && options.method === 'POST')
      return json({id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1'});
    if (target.pathname === '/v1/checkout/sessions/cs_test_1')
      return json({id: 'cs_test_1', payment_status: 'paid', amount_total: 6042, currency: 'usd',
        client_reference_id: 'MORD-abc', customer_details: {email: 'buyer@example.com'}, payment_intent: 'pi_test_123'});
    if (target.pathname === '/v1/refunds' && options.method === 'POST') return json({id: 're_1', status: 'succeeded'});
    if (target.pathname === '/v1/refunds/re_1') return json({id: 're_1', status: 'succeeded'});
    throw new Error('Unexpected Stripe call ' + target.pathname);
  };
  const stripe = createStripePayments({secret: 'sk_test_xxx', webhookSecret: 'whsec_test_xxx', mode: 'test', fetcher});
  assert.equal(stripe.configured, true);
  assert.equal(stripe.live, false);
  assert.equal(await stripe.checkConnection(), true);
  const session = await stripe.checkout({id: 'MORD-abc', totalCents: 6042, email: 'buyer@example.com', token: 'tok'}, 'https://platform.example.com');
  assert.equal(session.id, 'cs_test_1');
  assert.ok(session.url.startsWith('https://checkout.stripe.com/'));
  const tx = await stripe.verifyTransaction('cs_test_1');
  assert.equal(tx.id, 'pi_test_123', 'verify maps to the PaymentIntent so refunds work');
  assert.equal(tx.status, 'successful');
  assert.equal(tx.tx_ref, 'MORD-abc');
  assert.equal(tx.currency, 'USD');
  assert.equal(tx.amount, 60.42);
  assert.equal(tx.customer.email, 'buyer@example.com');
  const refund = await stripe.refund({transactionId: 'pi_test_123', totalCents: 6042, id: 'MORD-abc'});
  assert.equal(refund.id, 're_1');
  assert.equal((await stripe.refundStatus('re_1')).status, 'succeeded');
  await assert.rejects(() => stripe.refund({transactionId: 'cs_test_1', totalCents: 100, id: 'MORD-abc'}), e => e.status === 422);

  // Webhook signature: valid passes, forged/stale fail.
  const event = {type: 'checkout.session.completed', data: {object: {client_reference_id: 'MORD-abc'}}};
  const raw = Buffer.from(JSON.stringify(event));
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', 'whsec_test_xxx').update(t + '.' + raw.toString()).digest('hex');
  const normalised = stripe.verify(raw, `t=${t},v1=${sig}`);
  assert.equal(normalised.event, 'charge.completed');
  assert.equal(normalised.data.tx_ref, 'MORD-abc');
  assert.throws(() => stripe.verify(raw, `t=${t},v1=${'0'.repeat(64)}`), e => e.status === 400);
  assert.throws(() => stripe.verify(raw, `t=${t - 1000},v1=${sig}`), e => e.status === 400);

  // Mode/key mismatch is not configured; dispatcher rejects unknowns.
  assert.equal(createStripePayments({secret: 'sk_live_xxx', webhookSecret: 'whsec_x', mode: 'test'}).configured, false);
  assert.throws(() => createPaymentProvider('paypal', {}), e => e.status === 404);
  console.log('PASS: Stripe slot — 503 until configured; Checkout, verify (PaymentIntent mapping), refund, HMAC webhook verify, mode/key matching.');
}

/* ---------- 3. Storage truthfulness + backup verification ---------- */
{
  assert.equal(describeStorage({}).durable, false);
  assert.equal(describeStorage({}).ephemeral, true);
  assert.equal(describeStorage({}).database.status, 'sqlite_only');
  assert.ok(describeStorage({}).warning.includes('NOT durable'));
  assert.equal(describeStorage({DATA_DIR: '/var/data', DURABLE_STORAGE_CONFIRMED: 'true'}).durable, true);
  assert.equal(describeStorage({DATA_DIR: '/var/data', DURABLE_STORAGE_CONFIRMED: 'false'}).durable, false);
  const withUrl = describeStorage({DATABASE_URL: 'postgres://user:pass@host/db', DATA_DIR: '/var/data', DURABLE_STORAGE_CONFIRMED: 'true'});
  assert.equal(withUrl.database.status, 'recognised_not_wired');
  assert.equal(withUrl.database.inUse, 'sqlite', 'DATABASE_URL must not claim Postgres is in use');
  assert.equal(withUrl.durable, true);

  const dir = mkdtempSync(join(tmpdir(), 'vega-phase-b-backup-'));
  const good = join(dir, 'good');
  const {mkdirSync} = await import('node:fs');
  mkdirSync(good, {recursive: true});
  const backupDb = new DatabaseSync(join(good, 'store.sqlite'));
  backupDb.exec(`CREATE TABLE products(id TEXT PRIMARY KEY, document TEXT);
    CREATE TABLE settings(id INTEGER PRIMARY KEY, document TEXT);
    CREATE TABLE orders(id TEXT PRIMARY KEY, document TEXT);
    INSERT INTO products VALUES('p1','{}');`);
  backupDb.close();
  const verified = verifyBackupFile(good);
  assert.equal(verified.ok, true);
  assert.equal(verified.integrity, 'ok');
  assert.equal(verified.counts.products, 1);
  assert.throws(() => verifyBackupFile(join(dir, 'missing')), /Backup not found/);
  const bad = join(dir, 'bad');
  mkdirSync(bad, {recursive: true});
  writeFileSync(join(bad, 'store.sqlite'), 'this is not a database');
  assert.throws(() => verifyBackupFile(bad));
  const cliGood = spawnSync(process.execPath, ['backup.mjs', '--verify', good], {encoding: 'utf8'});
  assert.equal(cliGood.status, 0, cliGood.stderr);
  const cliBad = spawnSync(process.execPath, ['backup.mjs', '--verify', bad], {encoding: 'utf8'});
  assert.notEqual(cliBad.status, 0);
  console.log('PASS: storage — durable/ephemeral truth, DATABASE_URL recognised-not-wired, backup verify (good/bad/missing + CLI).');
}

/* ---------- 4. Connections: Stripe provider plumbing ---------- */
{
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE merchant_stores(id TEXT PRIMARY KEY); CREATE TABLE merchant_products(id TEXT PRIMARY KEY,store_id TEXT,document TEXT); INSERT INTO merchant_stores VALUES('store-a');");
  const stripeFactory = secrets => ({
    configured: secrets.secret.startsWith('sk_test_'),
    async checkConnection() { return true; },
    _secrets: secrets,
  });
  const paymentFactory = s => ({configured: s.mode === 'test' && s.secret.includes('TEST'), async checkConnection() { return true; }});
  const service = createMerchantConnections({db, env: {PLATFORM_SECRET_KEY: 'ab'.repeat(32)}, paymentFactory, stripeFactory});
  assert.ok(service.status('store-a').connections.some(c => c.provider === 'stripe'));
  assert.throws(() => service.save('store-a', 'stripe', {secret: 'sk_live_xxx', webhookSecret: 'whsec_x', mode: 'test'}), e => e.status === 422, 'live key + test mode rejected');
  service.save('store-a', 'stripe', {secret: 'sk_test_private', webhookSecret: 'whsec_private', mode: 'test'});
  assert.equal(service.status('store-a').connections.find(c => c.provider === 'stripe').connected, true);
  const serialized = JSON.stringify(db.prepare('SELECT * FROM merchant_connections').all());
  assert.ok(!serialized.includes('sk_test_private') && !serialized.includes('whsec_private'), 'Stripe secrets encrypted at rest');
  await service.verify('store-a', 'stripe');
  assert.ok(service.status('store-a').connections.find(c => c.provider === 'stripe').verifiedAt);
  const binding = service.paymentBinding('store-a', 'stripe');
  assert.equal(binding.provider, 'stripe');
  await service.withPayment('store-a', binding.version, p => { assert.equal(p._secrets.secret, 'sk_test_private'); return true; });
  assert.throws(() => service.paymentBinding('store-a', 'paypal'), e => e.status === 404);
  db.close();
  console.log('PASS: connections — Stripe save/verify/binding/provider isolation, secrets encrypted, unknown provider rejected.');
}

/* ---------- 5. Activation: billing standing + selected provider + Stripe tx ids ---------- */
{
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE merchant_stores(id TEXT PRIMARY KEY,slug TEXT,document TEXT);
    CREATE TABLE merchant_products(id TEXT PRIMARY KEY,store_id TEXT,document TEXT);`);
  db.prepare('INSERT INTO merchant_stores VALUES(?,?,?)').run('a', 'store-a', JSON.stringify({name: 'Store A', published: true, supportEmail: 'help@example.com'}));
  const product = {name: 'Merchant Shirt', description: 'Reviewed', image: 'https://example.com/shirt.png', visible: true, saleReady: true,
    supplier: {provider: 'cj', productId: 'supplier-shirt'},
    variants: [{id: 'shirt-medium', label: 'Medium', priceCents: 2500, active: true, quantity: 10, costCents: 1000}],
    supplierSync: {staleAfter: 9999999999}};
  db.prepare('INSERT INTO merchant_products VALUES(?,?,?)').run('product-a', 'a', JSON.stringify(product));
  let time = 1000000, stripeConnected = true, billingSuspended = false;
  const connections = {
    status: () => ({storageConfigured: true, connections: [
      {provider: 'cj', connected: true, verifiedAt: 1, version: 'cj-a'},
      {provider: 'resend', connected: true, verifiedAt: 1, version: 'email-a'},
      {provider: 'flutterwave', connected: true, verifiedAt: 1, version: 'payment-a', mode: 'test', usdApproved: true},
      {provider: 'stripe', connected: stripeConnected, verifiedAt: stripeConnected ? 1 : null, version: 'stripe-a', mode: 'test'},
    ]}),
    stock: async (storeId, work) => work({async variant() { return {cost: 10, quantity: 10}; }, async freight() { return [{name: 'US shipping', cents: 700, transit: '3–5 days'}]; }}),
    emailBinding: () => ({version: 'email-a'}),
    supplierBinding: () => ({version: 'cj-a'}),
    withPayment: async (storeId, version, work) => work({
      async checkout(o) { return {url: 'https://checkout.stripe.com/mock-' + o.id, id: 'cs_' + o.id}; },
      async verifyTransaction(ref) { return {status: 'successful', id: 'pi_test_123', tx_ref: ref, currency: 'USD', amount: 60.42, customer: {email: 'buyer@example.com'}}; },
      verify(raw) { return JSON.parse(raw.toString()); },
    }),
    paymentBinding: (storeId, provider = 'flutterwave') => ({version: provider + '-a', mode: 'test', provider}),
  };
  const inventory = {approved: () => true, available: (id, p, v) => v.active && v.quantity > 0 && v.priceCents > v.costCents};
  const billing = {statusForStore: () => ({suspended: billingSuspended, effectivePlan: 'starter'})};
  const env = {SITE_URL: 'https://platform.example.com', DATA_DIR: 'fixture', DURABLE_STORAGE_CONFIRMED: 'true'};
  const service = createMerchantCommerce({db, connections, inventory, env, now: () => time, billing});
  const cfg = {enabled: true, taxReviewed: true, taxRates: {FL: 6}, processingDays: 2,
    shippingPolicy: 'Shipping policy for this test store with reviewed details.',
    returnPolicy: 'Return policy for this test store with reviewed details.',
    privacyPolicy: 'Privacy policy for this test store with reviewed details.',
    terms: 'Terms for this test store with reviewed customer requirements.'};
  const address = {name: 'Test Buyer', email: 'buyer@example.com', phone: '3055551234', line1: '123 Test Street', line2: '', city: 'Miami', state: 'FL', zip: '33101'};
  try {
    // Stripe-selected store: readiness names Stripe, not Flutterwave.
    service.configure('a', {...cfg, paymentProvider: 'stripe'});
    const ready = service.readiness('a');
    assert.equal(ready.paymentProvider, 'stripe');
    assert.ok(ready.checks.some(c => c.name === 'Stripe test account checked' && c.ready));
    assert.ok(ready.checks.some(c => c.name === 'Merchant billing in good standing' && c.ready));
    assert.ok(ready.checks.every(c => typeof c.detail === 'string' && c.detail.length > 0), 'every check explains itself');
    assert.equal(ready.ready, true);
    assert.ok(service.dashboard('a').webhookUrl.includes('/webhooks/stripe/a/stripe-a'));

    // Stripe disconnected -> activation fails on the selected provider.
    stripeConnected = false;
    assert.equal(service.readiness('a').ready, false);
    assert.equal(service.readiness('a').checks.find(c => c.name === 'Stripe test account checked').ready, false);
    stripeConnected = true;

    // Billing suspended -> activation fails, checkout stays disabled.
    billingSuspended = true;
    const suspended = service.readiness('a');
    assert.equal(suspended.ready, false);
    assert.equal(suspended.checks.find(c => c.name === 'Merchant billing in good standing').ready, false);
    assert.throws(() => service.configure('a', {...cfg, paymentProvider: 'stripe'}), e => e.status === 422);
    await assert.rejects(() => service.quote('a', {items: [{productId: 'product-a', vid: 'shirt-medium', qty: 1}], address}), e => e.status === 503);
    billingSuspended = false;
    assert.equal(service.readiness('a').ready, true);

    // Full Stripe flow: quote -> checkout -> webhook -> paid, string tx id kept.
    const q = await service.quote('a', {items: [{productId: 'product-a', vid: 'shirt-medium', qty: 2}], address});
    const paid = await service.checkout('a', {quoteId: q.id, shippingId: '0', address, consent: true});
    assert.ok(paid.url.startsWith('https://checkout.stripe.com/'));
    const order = service.orders('a')[0];
    assert.equal(order.paymentMode, 'test');
    const raw = Buffer.from(JSON.stringify({event: 'charge.completed', data: {tx_ref: order.id}}));
    await service.webhook('a', 'stripe-a', raw, 't=1,v1=x');
    assert.equal((await service.lookup(paid.token)).paymentStatus, 'paid');
    assert.equal(service.orders('a')[0].transactionId, 'pi_test_123', 'Stripe PaymentIntent id survives verification');
    const storedOrder = JSON.parse(db.prepare('SELECT document FROM merchant_orders WHERE id=?').get(order.id).document);
    assert.equal(storedOrder.transactionKey, 'test:pi_test_123');

    // Unknown payment provider rejected at configure time.
    assert.throws(() => service.configure('a', {...cfg, paymentProvider: 'paypal'}), e => e.status === 422);
    console.log('PASS: activation — Stripe-selected readiness, billing suspension blocks checkout, Stripe string transaction ids, unknown provider rejected.');
  } finally { service.stop(); db.close(); }
}

/* ---------- 6. Onboarding: publish gated on activation ---------- */
{
  const base = {id: 's1', slug: 'first-store', name: 'First Store', published: false,
    connections: {cj: {connected: true}, flutterwave: {connected: true, mode: 'test'}, stripe: {connected: true, mode: 'test'}},
    productCount: 2, saleReadyCount: 1};
  const byId = (result, id) => result.steps.find(s => s.id === id);
  // Activation failing -> publish locked with the failing check named.
  let r = deriveOnboarding({signedIn: true, emailVerified: true,
    billing: {effectivePlan: 'starter', status: 'trialing', suspended: false},
    store: {...base, activation: {ready: false, checks: [{name: 'Persistent platform storage', ready: false, detail: 'Storage is NOT durable.'}]}}});
  assert.equal(byId(r, 'publish').status, 'locked');
  assert.ok(byId(r, 'publish').detail.includes('Persistent platform storage'));
  assert.equal(r.billing.effectivePlan, 'starter');
  // Activation passing -> publish current.
  r = deriveOnboarding({signedIn: true, emailVerified: true, store: {...base, activation: {ready: true, checks: []}}});
  assert.equal(byId(r, 'publish').status, 'current');
  // Stripe-selected store: payments step names Stripe.
  r = deriveOnboarding({signedIn: true, emailVerified: true,
    store: {...base, paymentProvider: 'stripe', connections: {cj: {connected: true}, stripe: {connected: true, mode: 'test'}}}});
  assert.equal(byId(r, 'connect-payments').status, 'done');
  assert.ok(byId(r, 'connect-payments').detail.includes('Stripe'));
  // No activation evidence (older callers): legacy prior-steps gate still applies.
  r = deriveOnboarding({signedIn: true, emailVerified: true, store: {...base}});
  assert.equal(byId(r, 'publish').status, 'current');
  console.log('PASS: onboarding — publish locked on failing activation, current when ready, Stripe-aware payments step, legacy behaviour without activation.');
}
