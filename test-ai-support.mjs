import assert from 'node:assert/strict';
import { createSupport } from './ai-support.mjs';

// Stub data in the shape commerce.lookup() returns (publicOrder) and the
// catalog returns. No network, no AI provider.
const order = { id: 'VEGA-abcdef123456', status: 'Paid', paymentStatus: 'paid', paymentMode: 'test',
  lines: [{ name: 'Test Perfume', option: '10ml', qty: 1, unitCents: 2500 }],
  subtotalCents: 2500, shippingCents: 695, taxCents: 0, totalCents: 3195,
  shippingMethod: 'Standard', tracking: null, createdAt: 1760000000000 };
const products = [{ id: 'p-1', name: 'Test Perfume', brand: 'VEGArance', category: 'Fragrance',
  prices: { '10ml': 25 }, inStock: true, variants: [{ id: '10ml', label: '10ml', inStock: true }] }];
const lookupOrder = async (token) => {
  if (token === 'valid-token') return order;
  throw Object.assign(new Error('Order not found'), { status: 404 });
};
const getCatalog = async () => products;

const stubAI = (text, calls = []) => ({ configured: true,
  complete: async ({ system, prompt }) => { calls.push({ system, prompt }); return text; } });

// 1. Order-status question with a valid token uses the real order data.
{
  const calls = [];
  const support = createSupport({ ai: stubAI('Order VEGA-abcdef123456 is Paid. It includes Test Perfume (10ml) x1, total $31.95.', calls) , lookupOrder, getCatalog });
  const res = await support.answer({ question: 'Where is my order?', orderToken: 'valid-token' });
  assert.equal(res.grounded, true);
  assert.ok(res.answer.includes('VEGA-abcdef123456'));
  assert.ok(res.answer.includes('Paid'));
  assert.ok(res.sources.includes('order:VEGA-abcdef123456'));
  assert.ok(calls.length === 1 && calls[0].prompt.includes('VEGA-abcdef123456'), 'AI prompt must carry the grounded order');
  assert.ok(!calls[0].prompt.includes('valid-token'), 'order token must not leak into the AI prompt');
}
// 2. Order question without a token asks for the token — never guesses.
{
  const calls = [];
  const support = createSupport({ ai: stubAI('should not be called', calls), lookupOrder, getCatalog });
  const res = await support.answer({ question: 'Where is my order?' });
  assert.match(res.answer, /order token/i);
  assert.ok(!res.answer.includes('Paid'));
  assert.equal(calls.length, 0);
}
// 3. Invented tracking number / date is rejected (502), never returned.
{
  const support = createSupport({ ai: stubAI('Your tracking number is 1Z999AA1234567890, arriving 2026-10-25.'), lookupOrder, getCatalog });
  await assert.rejects(support.answer({ question: 'Where is my order?', orderToken: 'valid-token' }), (e) => e.status === 502);
}
// 4. Wrong order status asserted by the AI is rejected (502).
{
  const support = createSupport({ ai: stubAI('Good news — your order is delivered.'), lookupOrder, getCatalog });
  await assert.rejects(support.answer({ question: 'Where is my order?', orderToken: 'valid-token' }), (e) => e.status === 502);
}
// 5. Unknown token is not guessed at — asks to double-check, no AI call.
{
  const calls = [];
  const support = createSupport({ ai: stubAI('should not be called', calls), lookupOrder, getCatalog });
  const res = await support.answer({ question: 'Where is my order?', orderToken: 'nope' });
  assert.match(res.answer, /could not find an order/i);
  assert.equal(calls.length, 0);
}
// 6. 503 without a key.
{
  const support = createSupport({ ai: { configured: false }, lookupOrder, getCatalog });
  await assert.rejects(support.answer({ question: 'What is your return policy?' }), (e) => e.status === 503);
}
// 7. Policy question answered from the static policy text (no invented window/fee).
{
  const support = createSupport({ ai: stubAI('Returns are covered on the Customer care page; the store\'s return policy text is published there before sales open.'), lookupOrder, getCatalog });
  const res = await support.answer({ question: 'What is your return policy?' });
  assert.ok(res.answer.includes('Customer care'));
  assert.equal(res.grounded, true);
  assert.ok(!/within \d+ days/i.test(res.answer), 'must not invent a return window');
}
// 8. Out-of-scope question gets a safe deflection, not a fabricated answer.
{
  const calls = [];
  const support = createSupport({ ai: stubAI('should not be called', calls), lookupOrder, getCatalog });
  const res = await support.answer({ question: 'Tell me a joke about cats.' });
  assert.match(res.answer, /only help with VEGArance store questions/i);
  assert.equal(calls.length, 0);
}
// 9. Invalid question -> 422.
{
  const support = createSupport({ ai: stubAI('x'), lookupOrder, getCatalog });
  await assert.rejects(support.answer({ question: '   ' }), (e) => e.status === 422);
  await assert.rejects(support.answer({ question: 'x'.repeat(2001) }), (e) => e.status === 422);
}
// 10. Banned delivery claim is rejected (502).
{
  const support = createSupport({ ai: stubAI('Good news — we offer same-day delivery on everything.'), lookupOrder, getCatalog });
  await assert.rejects(support.answer({ question: 'How fast is shipping?' }), (e) => e.status === 502);
}
// 11. A real tracking number from the order record passes validation.
{
  const tracked = { ...order, status: 'Shipped', tracking: { number: 'TRK123456789', carrier: 'CJ', url: 'https://example.test/track/TRK123456789' } };
  const support = createSupport({ ai: stubAI('Your order is shipped. Tracking number: TRK123456789.'), lookupOrder: async () => tracked, getCatalog });
  const res = await support.answer({ question: 'Where is my order?', orderToken: 'valid-token' });
  assert.ok(res.answer.includes('TRK123456789'));
}
console.log('PASS: AI support order grounding, ask-for-token, invented-tracking/status rejection, 503 without key, policy grounding, out-of-scope deflection, 422, banned-claim rejection. Stub AI only.');
