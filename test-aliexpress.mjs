import assert from 'node:assert/strict';
import {createHash, createHmac} from 'node:crypto';
import {createAliExpress, signParams} from './aliexpress-client.mjs';

// No credentials anywhere: everything runs against a mock fetcher.
const searchPayload = {resp_result: {resp_code: 200, resp_msg: 'success', result: {total_count: 2, products: [
  {product_id: '1005001', product_title: 'Linen Summer Dress', product_main_image_url: 'https://example.com/dress.jpg',
   app_sale_price: '18.50', lastest_volume: 1200, evaluate_rate: '4.8', product_detail_url: 'https://example.com/p/1'},
  {product_id: '1005002', product_title: 'Ceramic Vase', product_main_image_url: '', sale_price: '9.00'},
]}}};
const detailPayload = {resp_result: {resp_code: 200, result: {products: [
  {product_id: '1005001', product_title: 'Linen Summer Dress', product_main_image_url: 'https://example.com/dress.jpg', app_sale_price: '18.50'},
]}}};
const seen = [];
const fetcher = async (url, options) => {
  const params = Object.fromEntries(new URLSearchParams(options.body));
  seen.push({url, params, contentType: options.headers['Content-Type'], method: options.method});
  if (params.method === 'aliexpress.affiliate.productdetail.get') return {ok: true, status: 200, json: async () => detailPayload};
  if (params.method === 'aliexpress.affiliate.product.query') return {ok: true, status: 200, json: async () => searchPayload};
  throw new Error('unexpected method ' + params.method);
};
const client = createAliExpress({appKey: '12345', appSecret: 's3cret', trackingId: 'track1', fetcher});
assert.equal(client.configured, true);

// Signing: MD5 bookend, uppercase hex, recomputed from the captured params.
const found = await client.search('dress');
assert.equal(found.total, 2);
assert.equal(found.products[0].id, '1005001');
assert.equal(found.products[0].cost, 18.5);
assert.equal(found.products[0].stock, null);
assert.equal(found.products[0].stockUnknown, true);
assert.equal(found.products[1].image, '');
assert.equal(found.note.includes('not reported live'), true);
const req = seen[0];
assert.equal(req.url, 'https://api-sg.aliexpress.com/sync');
assert.equal(req.method, 'POST');
assert.equal(req.contentType, 'application/x-www-form-urlencoded;charset=utf-8');
assert.equal(req.params.tracking_id, 'track1');
assert.equal(req.params.target_currency, 'USD');
assert.equal(req.params.sign_method, 'md5');
const {sign, ...unsigned} = req.params;
const joined = Object.keys(unsigned).sort().map(k => k + unsigned[k]).join('');
assert.equal(sign, createHash('md5').update('s3cret' + joined + 's3cret', 'utf8').digest('hex').toUpperCase());
assert.equal(signParams({b: '2', a: '1'}, 's', 'md5'), createHash('md5').update('s' + 'a1b2' + 's').digest('hex').toUpperCase());
assert.equal(signParams({b: '2', a: '1'}, 's', 'hmac-sha256'), createHmac('sha256', 's').update('a1b2').digest('hex').toUpperCase());

// Draft: markup applied, starts unavailable, honest manual-fulfilment note.
const draft = await client.draft('1005001', 'Fashion', 100);
assert.equal(draft.prices['ae-1005001'], 37);
assert.equal(draft.supplier.provider, 'aliexpress');
assert.equal(draft.inStock, false);
assert.equal(draft.stockUnknown, true);
assert.match(draft.note, /manual/);

// Variant: cost known, quantity null = unknown, never zero.
const v = await client.variant('ae-1005001');
assert.equal(v.cost, 18.5);
assert.equal(v.quantity, null);
assert.equal(v.stockUnknown, true);

// Affiliate API has no fulfilment: freight / order / pay refuse plainly.
for (const fn of [() => client.freight(), () => client.createOrder({}), () => client.payOrder('1'), () => client.order('1')]) {
  await assert.rejects(fn, e => e.status === 422 && /manual|Affiliate API/.test(e.message));
}

// Not configured -> honest 503, never a fake result.
await assert.rejects(createAliExpress({appKey: '', appSecret: '', trackingId: ''}).search('x'), e => e.status === 503);
await assert.rejects(createAliExpress({appKey: 'k', appSecret: '', trackingId: 't'}).search('x'), e => e.status === 503);

// Provider error -> 502 with the provider message, secrets never echoed.
const errClient = createAliExpress({appKey: 'k', appSecret: 's', trackingId: 't',
  fetcher: async () => ({ok: true, status: 200, json: async () => ({resp_result: {resp_code: 50, resp_msg: 'signature invalid'}})})});
await assert.rejects(errClient.search('x'), e => e.status === 502 && /signature invalid/.test(e.message));
console.log('PASS: AliExpress MD5 signing, search/draft/variant mapping, manual-fulfilment refusals, not-configured 503, provider errors. Mock provider only.');
