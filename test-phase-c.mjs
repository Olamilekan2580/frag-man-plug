/* Vegarance v3 Phase C — P1 gaps tests.
   Coupons (server-side validation, subtotal-only discount, redemption
   once per paid order), currency display + duties disclosure (no
   invented rates), deterministic trend scoring + AI summary grounding,
   supplier-confirmation approvals (explicit confirm, never auto-charge)
   + AliExpress manual tracking capture, abandoned-checkout single
   reminder (honest inactive state without Resend), and commerce /
   operations integration. Mock providers only; no live integrations. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createMerchantCoupons, normalizeCouponCode, discountFor} from './merchant-coupons.mjs';
import {createMerchantAbandoned} from './merchant-abandoned.mjs';
import {createMerchantFulfillment, chargeWarning, validateTracking} from './merchant-fulfillment-approval.mjs';
import {validateDisplayConfig, formatDisplay, dutiesText, DISCLAIMER_TEXT} from './merchant-currency.mjs';
import {scoreProduct, rankProducts, buildTrendPrompt, validateTrendSummary, TREND_DISCLAIMER} from './trend-scoring.mjs';
import {createAI} from './ai-client.mjs';
import {createMerchantCommerce} from './merchant-commerce.mjs';
import {createMerchantOperations} from './merchant-operations.mjs';

/* ---------- 1. Coupons: validation, discount math, redemption ---------- */
{
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE merchant_stores(id TEXT PRIMARY KEY); INSERT INTO merchant_stores VALUES('s1');");
  let time = 1000000;
  const coupons = createMerchantCoupons({db, now: () => time});
  const pct = coupons.create('s1', {code: 'save10', type: 'percentage', percent: 10, minOrderCents: 0, usageLimit: 1});
  assert.equal(pct.code, 'SAVE10', 'codes normalise to uppercase');
  assert.equal(pct.redemptions, 0);
  assert.throws(() => coupons.create('s1', {code: 'SAVE10', type: 'percentage', percent: 5}), e => e.status === 409, 'duplicate code per store');
  assert.throws(() => coupons.create('s1', {code: 'x', type: 'percentage', percent: 5}), e => e.status === 422, 'code too short');
  assert.throws(() => coupons.create('s1', {code: 'BAD!', type: 'percentage', percent: 5}), e => e.status === 422, 'code charset');
  assert.throws(() => coupons.create('s1', {code: 'OVER90', type: 'percentage', percent: 91}), e => e.status === 422, 'percentage capped at 90');
  assert.throws(() => coupons.create('s1', {code: 'NOFIX', type: 'fixed'}), e => e.status === 422, 'fixed needs amount');
  assert.throws(() => coupons.create('s1', {code: 'NOPCT', type: 'percentage'}), e => e.status === 422, 'percentage needs percent');
  assert.equal(normalizeCouponCode('  summer-20 '), 'SUMMER-20');
  assert.equal(discountFor(999, {type: 'percentage', percent: 10}), 99, 'percentage rounds down');
  assert.equal(discountFor(5000, {type: 'fixed', amountCents: 100000}), 5000, 'fixed discount capped at subtotal');
  assert.equal(discountFor(5000, {type: 'percentage', percent: 10}), 500);

  // Validation: min order, expiry, usage limit, inactive.
  const big = coupons.create('s1', {code: 'BIG50', type: 'fixed', amountCents: 5000, minOrderCents: 10000});
  assert.throws(() => coupons.validateForOrder('s1', 'BIG50', 9999), e => e.status === 422, 'below min order');
  assert.equal(coupons.validateForOrder('s1', 'BIG50', 10000).discountCents, 5000);
  assert.throws(() => coupons.validateForOrder('s1', 'NOPE', 10000), e => e.status === 422, 'unknown code');
  const exp = coupons.create('s1', {code: 'SOON', type: 'percentage', percent: 5, expiresAt: time + 1000});
  time += 2000;
  assert.throws(() => coupons.validateForOrder('s1', 'SOON', 10000), e => e.status === 422, 'expired code');
  assert.equal(coupons.validateForOrder('s1', 'SAVE10', 10000).discountCents, 1000);
  assert.equal(coupons.recordRedemption('s1', pct.id, 'ORDER-1'), true);
  assert.equal(coupons.recordRedemption('s1', pct.id, 'ORDER-1'), false, 'redemption is idempotent per order');
  assert.equal(coupons.usageCount('s1', pct.id), 1);
  assert.throws(() => coupons.validateForOrder('s1', 'SAVE10', 10000), e => e.status === 422, 'usage limit exhausted');
  const upd = coupons.update('s1', big.id, {active: false});
  assert.equal(upd.active, false);
  assert.throws(() => coupons.validateForOrder('s1', 'BIG50', 10000), e => e.status === 422, 'inactive code');
  assert.throws(() => coupons.update('s1', big.id, {percent: 50}), e => e.status === 422, 'update only allows active/expiry/limit');
  assert.equal(coupons.remove('s1', exp.id).active, false);
  assert.throws(() => coupons.get('s1', 'missing'), e => e.status === 404);
  db.close();
  console.log('PASS: coupons — code normalisation, duplicate rejection, percentage/fixed math with subtotal cap, min order, expiry, usage limit, inactive, idempotent redemption.');
}

/* ---------- 2. Currency display + duties disclosure ---------- */
{
  assert.throws(() => validateDisplayConfig({displayCurrency: 'XXX'}), e => e.status === 422, 'unknown currency');
  assert.throws(() => validateDisplayConfig({displayCurrency: 'EUR'}), e => e.status === 422, 'non-USD display needs a merchant-supplied rate');
  assert.throws(() => validateDisplayConfig({displayCurrency: 'EUR', exchangeRates: {EUR: -1}}), e => e.status === 422, 'rate must be positive');
  assert.throws(() => validateDisplayConfig({displayCurrency: 'EUR', exchangeRates: {EUR: 0.92}, dutiesMode: 'merchant_configured', dutiesDisclosure: ''}), e => e.status === 422, 'merchant duties need text');
  assert.throws(() => validateDisplayConfig({displayCurrency: 'EUR', exchangeRates: {EUR: 0.92}, dutiesDisclosure: 'x'.repeat(2001)}), e => e.status === 422, 'duties text length cap');
  const eur = validateDisplayConfig({displayCurrency: 'EUR', exchangeRates: {EUR: 0.92}});
  assert.equal(eur.dutiesMode, 'disclaimer');
  assert.equal(eur.dutiesDisclosure, '');
  assert.throws(() => validateDisplayConfig({displayCurrency: 'GBP'}, eur), e => e.status === 422, 'switching currency without its rate fails even with a previous rate');
  const usd = validateDisplayConfig({});
  assert.equal(usd.displayCurrency, 'USD');
  assert.equal(formatDisplay(10000, usd).displayAmount, '$100.00');
  assert.equal(formatDisplay(10000, usd).estimated, true);
  assert.equal(formatDisplay(10000, eur).displayAmount, '€92.00');
  assert.equal(formatDisplay(10000, eur).rateUsed, 0.92);
  const jpy = validateDisplayConfig({displayCurrency: 'JPY', exchangeRates: {JPY: 150}});
  assert.equal(formatDisplay(10000, jpy).displayAmount, '¥15,000', 'zero-decimal currency');
  assert.equal(formatDisplay(10000, jpy).displayMinor, 15000);
  assert.throws(() => formatDisplay(10000, {displayCurrency: 'EUR', exchangeRates: {}}), e => e.status === 422, 'format without a rate fails — never invents one');
  assert.equal(dutiesText(usd).source, 'disclaimer');
  assert.equal(dutiesText(usd).text, DISCLAIMER_TEXT);
  assert.ok(!dutiesText(usd).text.includes('%') && !/\d+%/.test(dutiesText(usd).text), 'disclaimer invents no duty rate');
  const configured = validateDisplayConfig({dutiesMode: 'merchant_configured', dutiesDisclosure: 'EU buyers pay VAT on delivery per our carrier.'});
  assert.equal(dutiesText(configured).source, 'merchant_configured');
  assert.equal(dutiesText(configured).text, 'EU buyers pay VAT on delivery per our carrier.');
  console.log('PASS: currency — non-USD requires merchant rate, display formatting incl. JPY zero-decimal, disclaimer invents no duty rate, merchant duties text honoured.');
}

/* ---------- 3. Trend scoring + AI summary grounding ---------- */
{
  const hot = scoreProduct({salesVolume: 10000, salesTrendPct: 50, stockQuantity: 100, priceChangePct: 0, rating: 4.5, reviewCount: 100});
  assert.equal(hot.score, 92);
  assert.equal(hot.label, 'Rising');
  assert.equal(hot.confidence, 'high');
  assert.deepEqual(hot.breakdown, {demand: 100, momentum: 75, availability: 100, price: 90});
  const empty = scoreProduct({});
  assert.equal(empty.score, 30);
  assert.equal(empty.label, 'Insufficient data');
  assert.equal(empty.confidence, 'low');
  assert.ok(empty.notes.some(n => n.includes('No sales signal')));
  assert.ok(empty.notes.includes(TREND_DISCLAIMER));
  assert.equal(scoreProduct({salesVolume: 100, salesTrendPct: 0, stockQuantity: 0, priceChangePct: 0}).breakdown.availability, 0, 'out of stock scores 0 availability');
  assert.equal(scoreProduct({salesVolume: 100, salesTrendPct: 0, stockQuantity: 5, priceChangePct: 30}).breakdown.price, 50, 'supplier price spike lowers price component');
  assert.ok(scoreProduct({salesVolume: 100, salesTrendPct: 0, stockQuantity: 5, priceChangePct: 30}).notes.some(n => n.includes('recheck margin')));
  assert.throws(() => scoreProduct({salesVolume: -1}), e => e.status === 422);
  assert.throws(() => scoreProduct({salesVolume: 1.5}), e => e.status === 422);
  assert.throws(() => scoreProduct({rating: 6}), e => e.status === 422);
  const ranked = rankProducts([
    {name: 'Slow', signals: {salesVolume: 10, salesTrendPct: -20, stockQuantity: 100, priceChangePct: 0}},
    {name: 'Hot', signals: {salesVolume: 10000, salesTrendPct: 50, stockQuantity: 100, priceChangePct: 0}},
  ]);
  assert.equal(ranked[0].name, 'Hot');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].rank, 2);
  assert.equal(scoreProduct({salesVolume: 10000, salesTrendPct: 50, stockQuantity: 100, priceChangePct: 0, rating: 4.5, reviewCount: 100}).score, 92, 'deterministic: same input, same score');
  const prompt = buildTrendPrompt(ranked);
  assert.ok(prompt.includes('Hot') && prompt.includes('92/100'));
  assert.ok(prompt.includes('Use ONLY the figures'));
  assert.throws(() => validateTrendSummary('This product is guaranteed to sell.'), e => e.status === 502, 'guarantee language rejected');
  assert.throws(() => validateTrendSummary('This will sell fast.'), e => e.status === 502);
  assert.equal(validateTrendSummary('Hot shows the strongest supplier signals.'), 'Hot shows the strongest supplier signals.');

  // AI summary: grounded in supplied scores, disclaimer appended, 503 without key, 502 on banned output.
  const fetcher = async () => new Response(JSON.stringify({choices: [{message: {content: 'Hot shows the strongest supplier signals; Slow is cooling.'}}]}), {status: 200, headers: {'Content-Type': 'application/json'}});
  const ai = createAI({apiKey: 'test-key', fetcher});
  const summary = await ai.summarizeTrends(ranked);
  assert.ok(summary.summary.includes('Hot shows the strongest supplier signals'));
  assert.ok(summary.summary.endsWith(TREND_DISCLAIMER), 'disclaimer appended server-side');
  const unconfigured = createAI({apiKey: ''});
  await assert.rejects(() => unconfigured.summarizeTrends(ranked), e => e.status === 503);
  const bannedFetcher = async () => new Response(JSON.stringify({choices: [{message: {content: 'Hot is guaranteed to sell.'}}]}), {status: 200, headers: {'Content-Type': 'application/json'}});
  await assert.rejects(() => createAI({apiKey: 'test-key', fetcher: bannedFetcher}).summarizeTrends(ranked), e => e.status === 502);
  console.log('PASS: trends — deterministic scoring, confidence/labels, missing-signal notes, ranking, prompt grounding, summary validation (guarantee rejected), disclaimer appended, 503 without AI key.');
}

/* ---------- 4. Fulfillment approvals + tracking validation ---------- */
{
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE merchant_stores(id TEXT PRIMARY KEY); INSERT INTO merchant_stores VALUES('s1');");
  let time = 1000000;
  const fulfillment = createMerchantFulfillment({db, now: () => time});
  const unpaid = {id: 'ORD-1', paymentStatus: 'unpaid'};
  assert.throws(() => fulfillment.request('s1', unpaid, {provider: 'printful', estimatedChargeCents: 100}), e => e.status === 422, 'unpaid orders cannot go to confirmation');
  const paid = {id: 'ORD-1', paymentStatus: 'paid'};
  assert.throws(() => fulfillment.request('s1', paid, {provider: 'cj', estimatedChargeCents: 100}), e => e.status === 422, 'only POD/manual providers');
  assert.throws(() => fulfillment.request('s1', paid, {provider: 'printful', estimatedChargeCents: 0}), e => e.status === 422, 'charge must be positive');
  const approval = fulfillment.request('s1', paid, {provider: 'printful', draftSummary: 'Tee draft', estimatedChargeCents: 1999, testMode: false});
  assert.equal(approval.state, 'pending');
  assert.ok(approval.warning.includes('will charge your Printful account approximately $19.99'));
  assert.ok(approval.warning.includes('never confirms supplier charges automatically'));
  assert.throws(() => fulfillment.request('s1', paid, {provider: 'printify', estimatedChargeCents: 100}), e => e.status === 409, 'one pending approval per order');
  assert.throws(() => fulfillment.confirm('s1', approval.id, {}), e => e.status === 422, 'confirm requires explicit confirmCharge');
  assert.throws(() => fulfillment.confirm('s1', approval.id, {confirmCharge: false}), e => e.status === 422);
  const confirmed = fulfillment.confirm('s1', approval.id, {confirmCharge: true});
  assert.equal(confirmed.state, 'confirmed');
  assert.equal(confirmed.confirmedAt, time);
  assert.throws(() => fulfillment.confirm('s1', approval.id, {confirmCharge: true}), e => e.status === 409, 'cannot confirm twice');
  const testApproval = fulfillment.request('s1', {id: 'ORD-2', paymentStatus: 'paid'}, {provider: 'printify', estimatedChargeCents: 500, testMode: true});
  assert.ok(testApproval.warning.includes('no real charge'), 'test orders warn no real charge');
  const rejected = fulfillment.reject('s1', testApproval.id, {reason: 'Wrong variant'});
  assert.equal(rejected.state, 'rejected');
  assert.equal(rejected.rejectReason, 'Wrong variant');
  assert.throws(() => fulfillment.get('s1', 'missing'), e => e.status === 404);
  assert.equal(chargeWarning('aliexpress', 1234, false).includes('AliExpress'), true);
  assert.throws(() => validateTracking({trackingNumber: 'x'}), e => e.status === 422, 'tracking number too short');
  assert.throws(() => validateTracking({trackingNumber: 'AE123456', trackingUrl: 'http://example.com/x'}), e => e.status === 422, 'tracking URL must be HTTPS');
  assert.deepEqual(validateTracking({trackingNumber: 'AE123456789', carrier: 'Cainiao', trackingUrl: 'https://example.com/track/AE123456789'}).tracking,
    {number: 'AE123456789', carrier: 'Cainiao', url: 'https://example.com/track/AE123456789'});
  db.close();
  console.log('PASS: fulfillment — pending approval with charge warning, explicit confirmCharge gate, reject, test-mode warning, tracking validation (HTTPS only).');
}

/* ---------- 5. Abandoned checkouts: capture, due, convert ---------- */
{
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE merchant_stores(id TEXT PRIMARY KEY); INSERT INTO merchant_stores VALUES('s1');");
  let time = 1000000;
  const abandoned = createMerchantAbandoned({db, now: () => time});
  const quote = {id: 'q1', address: {email: 'buyer@example.com'}, subtotalCents: 5000, lines: [{name: 'Shirt', qty: 1}], createdAt: time};
  assert.deepEqual(abandoned.capture('s1', quote).state, 'pending');
  assert.equal(abandoned.capture('s1', quote).state, 'pending', 'capture is idempotent');
  assert.equal(abandoned.list('s1').length, 1);
  assert.equal(abandoned.due().length, 0, 'not due before the 1-hour minimum age');
  assert.equal(abandoned.capture('s1', {id: 'q2', address: {email: 'not-an-email'}, subtotalCents: 1, lines: []}), null, 'invalid email is not captured');
  time += 3600000 + 1;
  assert.equal(abandoned.due().length, 1);
  assert.equal(abandoned.markQueued('q1', 'ABANDONED-q1').state, 'queued');
  assert.equal(abandoned.due().length, 0, 'queued rows are never due again — one reminder');
  assert.equal(abandoned.markConverted('q1').state, 'converted');
  assert.equal(abandoned.get('q1').state, 'converted');
  assert.throws(() => abandoned.markQueued('missing', 'x'), e => e.status === 404);
  db.close();
  console.log('PASS: abandoned — idempotent capture, 1-hour minimum age, single-reminder state machine (pending → queued), converted on payment.');
}

/* ---------- 6. Commerce integration: coupon quote → checkout → paid + abandoned ---------- */
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
  let time = 1000000;
  const coupons = createMerchantCoupons({db, now: () => time});
  const abandoned = createMerchantAbandoned({db, now: () => time});
  const fulfillment = createMerchantFulfillment({db, now: () => time});
  const connections = {
    status: () => ({storageConfigured: true, connections: [
      {provider: 'cj', connected: true, verifiedAt: 1, version: 'cj-a'},
      {provider: 'resend', connected: true, verifiedAt: 1, version: 'email-a'},
      {provider: 'flutterwave', connected: true, verifiedAt: 1, version: 'payment-a', mode: 'test', usdApproved: true},
      {provider: 'stripe', connected: true, verifiedAt: 1, version: 'stripe-a', mode: 'test'},
    ]}),
    stock: async (storeId, work) => work({async variant() { return {cost: 10, quantity: 10}; }, async freight() { return [{name: 'US shipping', cents: 700, transit: '3–5 days'}]; }}),
    emailBinding: () => ({version: 'email-a'}),
    supplierBinding: () => ({version: 'cj-a'}),
    withPayment: async (storeId, version, work) => work({
      async checkout(o) { return {url: 'https://checkout.example.com/mock-' + o.id, id: 'cs_' + o.id}; },
      async verifyTransaction(ref) {
        const row = db.prepare('SELECT document FROM merchant_orders WHERE id=?').get(ref);
        const order = JSON.parse(row.document);
        return {status: 'successful', id: 'pi_test_123', tx_ref: ref, currency: 'USD', amount: order.totalCents / 100, customer: {email: 'buyer@example.com'}};
      },
      verify(raw) { return JSON.parse(raw.toString()); },
    }),
    paymentBinding: (storeId, provider = 'flutterwave') => ({version: provider + '-a', mode: 'test', provider}),
  };
  const inventory = {approved: () => true, available: (id, p, v) => v.active && v.quantity > 0 && v.priceCents > v.costCents};
  const billing = {statusForStore: () => ({suspended: false, effectivePlan: 'starter'})};
  const env = {SITE_URL: 'https://platform.example.com', DATA_DIR: 'fixture', DURABLE_STORAGE_CONFIRMED: 'true'};
  const service = createMerchantCommerce({db, connections, inventory, env, now: () => time, billing, coupons, abandoned, fulfillment});
  const cfg = {enabled: true, taxReviewed: true, taxRates: {FL: 6}, processingDays: 2,
    shippingPolicy: 'Shipping policy for this test store with reviewed details.',
    returnPolicy: 'Return policy for this test store with reviewed details.',
    privacyPolicy: 'Privacy policy for this test store with reviewed details.',
    terms: 'Terms for this test store with reviewed customer requirements.'};
  const address = {name: 'Test Buyer', email: 'buyer@example.com', phone: '3055551234', line1: '123 Test Street', line2: '', city: 'Miami', state: 'FL', zip: '33101'};
  const items = [{productId: 'product-a', vid: 'shirt-medium', qty: 2}];
  try {
    // Currency display: EUR needs a merchant rate; GBP without one fails.
    service.configure('a', {...cfg, displayCurrency: 'EUR', exchangeRates: {EUR: 0.92}});
    assert.equal(service.publicConfig('a').currency.displayCurrency, 'EUR');
    assert.equal(service.publicConfig('a').currency.duties.source, 'disclaimer');
    assert.ok(service.publicConfig('a').currency.duties.text.includes('not included'));
    assert.throws(() => service.configure('a', {...cfg, displayCurrency: 'GBP'}), e => e.status === 422);
    assert.equal(service.publicConfig('a').currency.displayCurrency, 'EUR', 'failed configure leaves settings unchanged');
    assert.equal(service.publicConfig('a').couponsAccepted, false);

    // Coupons: bad code rejected, discount applied to subtotal, tax on discounted subtotal.
    coupons.create('a', {code: 'SAVE10', type: 'percentage', percent: 10, usageLimit: 1});
    assert.equal(service.publicConfig('a').couponsAccepted, true);
    await assert.rejects(() => service.quote('a', {items, address, couponCode: 'NOPE'}), e => e.status === 422);
    const plain = await service.quote('a', {items, address});
    assert.equal(plain.discountCents, 0);
    assert.equal(plain.choices[0].totalCents, 5000 + 700 + 342, 'no coupon: tax on full subtotal + shipping');
    const q = await service.quote('a', {items, address, couponCode: 'save10'});
    assert.equal(q.discountCents, 500, '10% of 5000');
    assert.equal(q.couponCode, 'SAVE10');
    assert.equal(q.choices[0].taxCents, 312, 'tax on discounted subtotal + shipping: (5000-500+700)*6%');
    assert.equal(q.choices[0].totalCents, 5000 - 500 + 700 + 312);
    assert.equal(abandoned.get(q.id).state, 'pending', 'quote captured as abandoned');

    // Checkout carries the discount; verify pays, records redemption, converts abandonment.
    const paid = await service.checkout('a', {quoteId: q.id, shippingId: '0', address, consent: true});
    const order = service.orders('a')[0];
    assert.equal(order.discountCents, 500);
    assert.equal(order.couponCode, 'SAVE10');
    assert.equal(order.totalCents, 5512);
    const raw = Buffer.from(JSON.stringify({event: 'charge.completed', data: {tx_ref: order.id}}));
    await service.webhook('a', 'flutterwave-a', raw, 't=1,v1=x');
    assert.equal((await service.lookup(paid.token)).paymentStatus, 'paid');
    assert.equal(coupons.usageCount('a', coupons.findByCode('a', 'SAVE10').id), 1, 'redemption recorded once on paid');
    assert.equal(abandoned.get(q.id).state, 'converted', 'paid order converts the abandonment — no reminder');
    await assert.rejects(() => service.quote('a', {items, address, couponCode: 'SAVE10'}), e => e.status === 422, 'usage limit exhausted after redemption');
    const dash = service.dashboard('a');
    assert.equal(dash.coupons.length, 1);
    assert.equal(dash.abandoned.length, 2, 'plain + coupon quotes both tracked');
    assert.deepEqual(dash.fulfillmentApprovals, []);
    console.log('PASS: commerce — currency config gating, coupon quote/checkout/verify with tax on discounted subtotal, redemption once on paid, abandonment converted.');
  } finally { service.stop(); db.close(); }
}

/* ---------- 7. Operations: fulfillment actions, AliExpress tracking, abandoned reminder ---------- */
{
  const db = new DatabaseSync(':memory:');
  db.exec("PRAGMA foreign_keys=ON;CREATE TABLE merchant_stores(id TEXT PRIMARY KEY);CREATE TABLE merchant_orders(id TEXT PRIMARY KEY,store_id TEXT REFERENCES merchant_stores(id),document TEXT);INSERT INTO merchant_stores VALUES('a');");
  let time = 1000000, emailFailure = false;
  const sent = [];
  const fulfillment = createMerchantFulfillment({db, now: () => time});
  const abandoned = createMerchantAbandoned({db, now: () => time});
  const seed = (id, mode = 'test') => {
    const o = {id, storeId: 'a', storeName: 'Merchant A', email: 'buyer@example.com', emailVersion: 'email-a', supplierVersion: 'cj-a', paymentVersion: 'payment-a', paymentMode: mode, paymentStatus: 'paid', status: 'Paid', transactionId: 9, totalCents: 3387, shippingCents: 695, shippingMethod: 'US Shipping', token: '1'.repeat(64),
      address: {name: 'Buyer', email: 'buyer@example.com', phone: '3055551234', line1: '123 Test Street', line2: '', city: 'Miami', state: 'FL', zip: '33101'},
      lines: [{productId: 'shirt', vid: 'shirt-medium', name: 'Shirt', option: 'Medium', unitCents: 2500, qty: 1}], fulfillment: {state: 'not_started'}};
    db.prepare('INSERT INTO merchant_orders VALUES(?,?,?)').run(id, 'a', JSON.stringify(o));
    return o;
  };
  const get = (storeId, id) => { const row = db.prepare('SELECT document FROM merchant_orders WHERE store_id=? AND id=?').get(storeId, id); if (!row) throw Object.assign(new Error('Order not found'), {status: 404}); return JSON.parse(row.document); };
  const save = o => db.prepare('UPDATE merchant_orders SET document=? WHERE store_id=? AND id=?').run(JSON.stringify(o), o.storeId, o.id);
  const connections = {
    emailBinding: () => ({version: 'email-a'}),
    withEmail: async (storeId, version, work) => work({async send(payload, key) { sent.push({payload, key}); if (emailFailure) throw Error('Mock email timeout'); return 'message-' + key; }}),
    withPayment: async (storeId, version, work) => work({async refund() { return {id: 'refund-x'}; }, async refundStatus() { return {status: 'completed', amount_refunded: 33.87, tx_id: 9}; }}),
    withSupplier: async (storeId, version, work) => work({async freight() { return [{name: 'US Shipping', cents: 695}]; }, async createOrder() { return {orderId: 'cj-1', shipmentOrderId: 'sh-1', orderAmount: 20}; }, async order() { return {platformOrderId: 'x', orderAmount: 20, shipmentOrderId: 'sh-1', productList: [{vid: 'shirt-medium', quantity: 1}]}; }, async payOrder() {}}),
  };
  const service = createMerchantOperations({db, connections, get, save, store: () => ({name: 'Merchant A', slug: 'store-a'}), site: 'https://platform.example.com', stock: async () => {}, now: () => time, abandoned, fulfillment});
  seed('live-order', 'live');
  const requested = await service.action('a', 'live-order', 'fulfillment_request', {provider: 'printful', draftSummary: 'Tee draft', estimatedChargeCents: 1999});
  assert.equal(requested.fulfillmentApproval.state, 'pending');
  assert.ok(requested.fulfillmentApproval.warning.includes('will charge your Printful account approximately $19.99'));
  await assert.rejects(() => service.action('a', 'live-order', 'fulfillment_confirm', {approvalId: requested.fulfillmentApproval.id}), e => e.status === 422, 'confirm without confirmCharge');
  const confirmed = await service.action('a', 'live-order', 'fulfillment_confirm', {approvalId: requested.fulfillmentApproval.id, confirmCharge: true});
  assert.equal(confirmed.status, 'Awaiting supplier confirmation');
  assert.equal(confirmed.fulfillment.state, 'awaiting_provider_confirm');
  seed('live-reject', 'live');
  const toReject = await service.action('a', 'live-reject', 'fulfillment_request', {provider: 'printify', draftSummary: 'Mug draft', estimatedChargeCents: 899});
  const rejected = await service.action('a', 'live-reject', 'fulfillment_reject', {approvalId: toReject.fulfillmentApproval.id, reason: 'Wrong design'});
  assert.equal(rejected.status, 'Supplier confirmation rejected');
  assert.equal(fulfillment.list('a').find(x => x.id === toReject.fulfillmentApproval.id).state, 'rejected');
  seed('test-order', 'test');
  const testApproval = await service.action('a', 'test-order', 'fulfillment_request', {provider: 'printful', draftSummary: 'Test draft', estimatedChargeCents: 100});
  assert.equal(testApproval.fulfillmentApproval.testMode, true, 'test orders record test mode');
  seed('live-track', 'live');
  await assert.rejects(() => service.action('a', 'live-track', 'aliexpress_tracking', {trackingNumber: 'x'}), e => e.status === 422, 'bad tracking number');
  await assert.rejects(() => service.action('a', 'live-track', 'aliexpress_tracking', {trackingNumber: 'AE123456', trackingUrl: 'http://example.com/x'}), e => e.status === 422, 'non-HTTPS tracking URL');
  const tracked = await service.action('a', 'live-track', 'aliexpress_tracking', {trackingNumber: 'AE123456789', carrier: 'Cainiao', trackingUrl: 'https://example.com/track/AE123456789'});
  assert.equal(tracked.status, 'Shipped');
  assert.equal(tracked.tracking.number, 'AE123456789');
  assert.equal(service.emailJobs('a').filter(j => j.kind === 'shipping').length, 1, 'buyer notified on manual tracking capture');
  await assert.rejects(() => service.action('a', 'test-order', 'aliexpress_tracking', {trackingNumber: 'AE123456789'}), e => e.status === 422, 'test orders have no real shipment');

  // Abandoned reminder: one email, then never again.
  abandoned.capture('a', {id: 'q-ab', address: {email: 'buyer@example.com'}, subtotalCents: 2500, lines: [{name: 'Shirt', qty: 1}], createdAt: time});
  await service.tick();
  assert.equal(abandoned.get('q-ab').state, 'pending', 'not due before 1 hour');
  time += 3600000 + 1;
  await service.tick();
  assert.equal(abandoned.get('q-ab').state, 'queued');
  await service.tick();
  assert.equal(sent.filter(s => s.key === 'ABANDONED-q-ab').length, 1, 'exactly one reminder sent');
  await service.tick();
  assert.equal(sent.filter(s => s.key === 'ABANDONED-q-ab').length, 1, 'no second reminder on later ticks');
  assert.equal(service.emailJobs('a').filter(j => j.kind === 'abandoned').length, 1);
  assert.ok(sent.find(s => s.key === 'ABANDONED-q-ab').payload.text.includes('single reminder'));

  // Honest inactive state: no email binding → stays pending, nothing recorded as sent.
  const db2 = new DatabaseSync(':memory:');
  db2.exec("CREATE TABLE merchant_stores(id TEXT PRIMARY KEY);CREATE TABLE merchant_orders(id TEXT PRIMARY KEY,store_id TEXT,document TEXT);INSERT INTO merchant_stores VALUES('a');");
  const abandoned2 = createMerchantAbandoned({db: db2, now: () => time});
  const get2 = (storeId, id) => { throw Object.assign(new Error('Order not found'), {status: 404}); };
  const save2 = () => {};
  const noEmail = createMerchantOperations({db: db2, connections: {emailBinding: () => { throw Object.assign(new Error('no email'), {status: 422}); }, withEmail: async () => { throw Error('should not send'); }}, get: get2, save: save2, store: () => ({name: 'Merchant A', slug: 'store-a'}), site: 'https://platform.example.com', stock: async () => {}, now: () => time, abandoned: abandoned2, fulfillment});
  abandoned2.capture('a', {id: 'q-noemail', address: {email: 'buyer@example.com'}, subtotalCents: 100, lines: [], createdAt: time - 7200000});
  await noEmail.tick();
  assert.equal(abandoned2.get('q-noemail').state, 'pending', 'without Resend configured, nothing is queued or recorded as sent');
  assert.equal(noEmail.emailJobs('a').length, 0);
  db.close(); db2.close();
  console.log('PASS: operations — fulfillment request/confirm/reject, AliExpress tracking capture + buyer notification, abandoned single reminder, honest inactive state without email.');
}
console.log('PASS: Phase C complete.');
