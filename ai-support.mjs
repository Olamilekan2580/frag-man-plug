/* AI support chat for VEGArance. Server-only.
   Grounding rule (hard): the answer may ONLY use
   (a) supplied store data — the order record for a supplied token, the
   product catalog, and policy text (the static store facts below plus any
   owner-configured policies injected via the `policies` option), and
   (b) general helpful guidance, which the AI is told to label as general.
   It must NEVER invent order status, tracking numbers, delivery dates,
   stock, or policy. Order questions without a valid token get an ask-for-
   token reply, never a guessed status. Output is validated: any tracking
   number, date, or order status not present in the grounded data is a 502,
   never returned. No AI key -> honest 503. Invalid question -> 422.
   Follows ai-client.mjs conventions: provider-agnostic OpenAI-compatible
   completions (Groq default), env-key gating, BANNED-claims validation. */

const API_DEFAULT = 'https://api.groq.com/openai/v1';
const MAX_QUESTION = 2000;
const MAX_CATALOG = 8;
// Same banned delivery/authenticity claims as ai-client.mjs.
const BANNED = [/in stock in nigeria/i, /next[- ]day delivery/i, /same[- ]day delivery/i,
  /guaranteed delivery/i, /official (product|store|distributor)/i,
  /\b100% (authentic|genuine|original)\b/i, /free shipping worldwide/i,
  /ships (today|tomorrow|immediately)/i];
const ORDER_INTENT = /order|track|tracking|shipment|shipped|deliver|where is my|package|parcel|my purchase|my parcel|my package/i;
const OFF_TOPIC = /\b(weather|poem|joke|song|lyrics|movie|football|basketball|score|politics|election|celebrity|horoscope|lottery|homework|essay|medical|diagnosis|prescription|write (me )?code|debug (my|this) code)\b/i;
const GENERIC_TRACKING_WORDS = new Set(['none', 'not', 'available', 'provided', 'recorded', 'pending', 'unknown', 'listed', 'shown', 'yet']);
const KNOWN_STATUSES = ['shipped', 'delivered', 'processing', 'paid', 'awaiting payment',
  'awaiting supplier payment', 'cancelled', 'refunded', 'refund requested',
  'checkout needs attention', 'payment needs review', 'supplier submission needs review'];
const MONTHS = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12' };

/* Static store facts. Deliberately minimal: the repo holds NO fixed
   shipping times, return windows, fees, or contact address — policies are
   owner-configured (commerce.mjs sales_config) and served on the Customer
   care page (policies.html / policies.js). This text states only what the
   code verifies, and never invents a timeline, fee, or address. Real
   configured policy text arrives via the `policies` factory option. */
export const STORE_POLICY_TEXT = [
  'Customer care: the store\'s shipping, returns, privacy, and terms texts are published on the Customer care page. They are set by the store owner; if a section is empty, the page says the policies will be published before sales open.',
  'Order lookup: an order can be looked up with the order token issued at checkout (GET /api/order-status?token=...). Without that token, order status cannot be confirmed.',
  'Checkout: checkout serves US delivery addresses (a US state plus a valid ZIP code) and charges in USD. Shipping options and costs are quoted at checkout based on the delivery address. No fixed delivery date is promised by the store.',
  'Checkout requires accepting the terms and return policy shown at checkout.',
  'Contact: the support email shown on the Customer care page is the store\'s contact. No other contact address is stated here.',
].join('\n');

const failure = (status, message) => Object.assign(new Error(message), { status });

function money(cents) {
  return typeof cents === 'number' ? '$' + (cents / 100).toFixed(2) : 'not recorded';
}

function isoDate(value) {
  if (value === undefined || value === null || value === '') return '';
  const d = new Date(typeof value === 'number' ? value : String(value));
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function orderContext(order) {
  if (!order) return '';
  const lines = (Array.isArray(order.lines) ? order.lines : [])
    .map((l) => `- ${l.name} (${l.option || 'standard'}) x${l.qty} — ${money(l.unitCents)} each`).join('\n') || '- (no lines recorded)';
  const tracking = order.tracking && (order.tracking.number || order.tracking.url)
    ? `Tracking number: ${order.tracking.number || '(not recorded)'}\nTracking carrier: ${order.tracking.carrier || '(not recorded)'}\nTracking URL: ${order.tracking.url || '(not recorded)'}`
    : 'Tracking: none recorded on this order.';
  return [
    'ORDER (use ONLY these facts for order questions):',
    `Order ID: ${order.id}`,
    `Status: ${order.status}`,
    `Payment status: ${order.paymentStatus || '(not recorded)'}`,
    `Shipping method: ${order.shippingMethod || '(not recorded)'}`,
    tracking,
    `Created: ${isoDate(order.createdAt) || '(not recorded)'}`,
    `Subtotal: ${money(order.subtotalCents)}`,
    `Shipping: ${money(order.shippingCents)}`,
    `Tax: ${money(order.taxCents)}`,
    `Total: ${money(order.totalCents)}`,
    'Lines:',
    lines,
  ].join('\n');
}

function catalogContext(products, question) {
  const list = (Array.isArray(products) ? products : []).filter((p) => p && typeof p.name === 'string');
  if (!list.length) return 'CATALOG: (no products supplied)';
  const words = question.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const scored = list.map((p) => {
    const hay = `${p.name} ${p.category || ''} ${p.brand || ''}`.toLowerCase();
    return { p, score: words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, MAX_CATALOG).map(({ p }) => {
    const prices = p.prices && typeof p.prices === 'object'
      ? Object.entries(p.prices).map(([size, price]) => `${size}: $${Number(price).toFixed(2)}`).join(', ')
      : '(price not recorded)';
    const options = Array.isArray(p.variants) && p.variants.length
      ? ` Options: ${p.variants.map((v) => `${v.label} (${v.inStock ? 'in stock' : 'out of stock'})`).join(', ')}`
      : '';
    return `- ${p.name} (${p.category || 'no category'}) — ${prices}. Store stock flag: ${p.inStock ? 'in stock' : 'out of stock'}.${options}`;
  });
  return 'CATALOG (use ONLY these products/prices/stock flags for product questions):\n' + top.join('\n');
}

function policiesContext(policies) {
  // `policies` may be a plain object or a zero-arg getter returning one,
  // so the server can pass live owner-configured policy text per request.
  const resolved = typeof policies === 'function' ? policies() : policies;
  if (!resolved || typeof resolved !== 'object') return '';
  const parts = [];
  if (typeof resolved.shippingPolicy === 'string' && resolved.shippingPolicy.trim()) parts.push('Owner-configured shipping policy:\n' + resolved.shippingPolicy.trim());
  if (typeof resolved.returnPolicy === 'string' && resolved.returnPolicy.trim()) parts.push('Owner-configured return policy:\n' + resolved.returnPolicy.trim());
  if (typeof resolved.privacyPolicy === 'string' && resolved.privacyPolicy.trim()) parts.push('Owner-configured privacy policy:\n' + resolved.privacyPolicy.trim());
  if (typeof resolved.terms === 'string' && resolved.terms.trim()) parts.push('Owner-configured terms of sale:\n' + resolved.terms.trim());
  if (typeof resolved.supportEmail === 'string' && resolved.supportEmail.trim()) parts.push('Store support email: ' + resolved.supportEmail.trim());
  if (Number.isInteger(resolved.processingDays)) parts.push(`Store processing days (configured): ${resolved.processingDays}`);
  return parts.join('\n\n');
}

/* Extract ISO dates (YYYY-MM-DD) present in the grounded text so the
   validator can accept an AI answer that restates a grounded date in
   another format (e.g. "Oct 25, 2026" for grounded 2026-10-25). */
function groundedDates(groundedText) {
  return new Set([...groundedText.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map((m) => m[0]));
}

function monthNameToIso(month, day, year) {
  const m = MONTHS[month.toLowerCase()];
  if (!m || !year) return null;
  return `${year}-${m}-${String(day).padStart(2, '0')}`;
}

/* Reject (502) any tracking number, date, or order status in the answer
   that is not present in the grounded data. */
function validateAnswer(answer, { order, groundedText }) {
  const joined = answer;
  for (const pattern of BANNED) {
    if (pattern.test(joined)) throw failure(502, 'AI response made a delivery or authenticity claim it must not make.');
  }
  const lowerGrounded = groundedText.toLowerCase();
  // Tracking numbers / order IDs.
  const trackingCandidates = new Set();
  for (const m of answer.matchAll(/\bVEGA-[A-Za-z0-9]+\b/g)) trackingCandidates.add(m[0]);
  for (const m of answer.matchAll(/\b[A-Z]{2}\d{6,}[A-Z0-9]*\b/g)) trackingCandidates.add(m[0]);
  for (const m of answer.matchAll(/\b\d{12,}\b/g)) trackingCandidates.add(m[0]);
  for (const m of answer.matchAll(/tracking(?: number| no\.?| #)?\s*(?:is|:)?\s*([A-Za-z0-9][A-Za-z0-9-]{5,})/gi)) {
    if (!GENERIC_TRACKING_WORDS.has(m[1].toLowerCase())) trackingCandidates.add(m[1]);
  }
  for (const candidate of trackingCandidates) {
    if (!lowerGrounded.includes(candidate.toLowerCase())) {
      throw failure(502, 'AI response included a tracking number or order ID not present in the store data.');
    }
  }
  // Dates: accept only dates present in the grounded data (any format).
  const dates = groundedDates(groundedText);
  for (const m of answer.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
    if (!dates.has(m[0])) throw failure(502, 'AI response included a delivery date not present in the store data.');
  }
  for (const m of answer.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/g)) {
    // No year: accept only if the exact phrase appears in the grounded data.
    if (!m[3]) {
      if (!lowerGrounded.includes(m[0].toLowerCase())) throw failure(502, 'AI response included a delivery date not present in the store data.');
      continue;
    }
    if (!dates.has(monthNameToIso(m[1], m[2], m[3]))) throw failure(502, 'AI response included a delivery date not present in the store data.');
  }
  for (const m of answer.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    if (!dates.has(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`)) throw failure(502, 'AI response included a delivery date not present in the store data.');
  }
  // Order-status assertions: only the grounded status may be asserted.
  const statusMatch = answer.match(/\byour order (?:is|has been|was|is currently)\s+([a-z][a-z ]{2,60}?)(?:\.|,|;| and | —|!|\?|$)/i);
  if (statusMatch) {
    const claimed = statusMatch[1].trim().toLowerCase();
    if (KNOWN_STATUSES.some((s) => claimed.includes(s) || s.includes(claimed))) {
      if (!order) throw failure(502, 'AI response asserted an order status with no order record supplied.');
      const actual = String(order.status || '').toLowerCase();
      if (!actual || (!actual.includes(claimed) && !claimed.includes(actual))) {
        throw failure(502, 'AI response asserted an order status that does not match the order record.');
      }
    }
  }
  return answer.trim();
}

/* Call the AI. Prefers an ai object exposing complete({system, prompt});
   falls back to a direct OpenAI-compatible call using the same env
   conventions as ai-client.mjs (AI_API_KEY / AI_BASE_URL / AI_MODEL) so a
   plain createAI() instance — which only exposes describe() — still works. */
async function callAI(ai, fetcher, system, prompt) {
  if (ai && typeof ai.complete === 'function') {
    const text = await ai.complete({ system, prompt });
    if (typeof text !== 'string' || !text.trim()) throw failure(502, 'AI provider returned no text.');
    return text;
  }
  if (ai && typeof ai.chat === 'function') {
    const text = await ai.chat({ system, prompt });
    if (typeof text !== 'string' || !text.trim()) throw failure(502, 'AI provider returned no text.');
    return text;
  }
  const apiKey = process.env.AI_API_KEY || '';
  if (!apiKey) throw failure(503, 'Configure AI_API_KEY privately on Render to use AI support chat.');
  const baseUrl = (process.env.AI_BASE_URL || API_DEFAULT).replace(/\/$/, '');
  const model = process.env.AI_MODEL || 'llama-3.1-8b-instant';
  let response, data;
  try {
    response = await (fetcher || fetch)(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.2, max_tokens: 800 }),
      signal: AbortSignal.timeout(30000),
    });
    data = await response.json();
  } catch { throw failure(502, 'AI provider is temporarily unavailable. Try again later.'); }
  if (!response.ok) throw failure(502, 'AI provider rejected the request. Check the key and model, then try again.');
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw failure(502, 'AI provider returned no text.');
  return text;
}

export function createSupport({ ai, lookupOrder, getCatalog, fetcher, policies } = {}) {
  const configured = ai ? ai.configured !== false : false;

  async function answer({ question, orderToken } = {}) {
    if (typeof question !== 'string' || !question.trim()) throw failure(422, 'Ask a question.');
    const q = question.trim();
    if (q.length > MAX_QUESTION) throw failure(422, 'Question is too long.');
    if (!ai || !configured) throw failure(503, 'Configure AI_API_KEY privately on Render to use AI support chat.');

    const token = typeof orderToken === 'string' ? orderToken.trim() : '';
    const isOrderQuestion = ORDER_INTENT.test(q);

    // Order questions without a token: ask for it. Never guess a status.
    if (isOrderQuestion && !token) {
      return {
        answer: 'I can check that, but I need your order token — the token issued at checkout. Paste it here and I will look up the order record. Without it I cannot confirm any order status.',
        grounded: true,
        sources: ['policy:order-lookup'],
      };
    }

    // Clearly out-of-scope: safe deflection, no AI call, nothing fabricated.
    if (!isOrderQuestion && OFF_TOPIC.test(q)) {
      return {
        answer: 'I can only help with VEGArance store questions — orders, shipping, returns, products, and store policies. Ask me about an order (with your order token), a product, shipping, or returns.',
        grounded: true,
        sources: ['policy:store'],
      };
    }

    // Fetch the order record when a token was supplied.
    let order = null;
    if (token) {
      try {
        order = await lookupOrder(token);
      } catch (e) {
        if (e && e.status === 404) {
          return {
            answer: 'I could not find an order with that token. Double-check the token from your checkout confirmation and try again. I cannot confirm any order status without a matching order record.',
            grounded: true,
            sources: ['policy:order-lookup'],
          };
        }
        throw e;
      }
      if (!order || typeof order !== 'object') {
        return {
          answer: 'I could not find an order with that token. Double-check the token from your checkout confirmation and try again.',
          grounded: true,
          sources: ['policy:order-lookup'],
        };
      }
    }

    // Catalog is supplementary grounding; a catalog failure must not
    // block an order/policy answer.
    let products = [];
    try { products = await getCatalog?.(); } catch { products = []; }

    const policyBlock = [STORE_POLICY_TEXT, policiesContext(policies)].filter(Boolean).join('\n\n');
    const groundedText = [orderContext(order), catalogContext(products, q), policyBlock].filter(Boolean).join('\n\n');
    const system = 'You are the VEGArance store support assistant. Answer ONLY from the grounded data in the user message: the order record (if one is shown), the catalog list, and the policy text. NEVER invent order status, tracking numbers, delivery dates, stock, prices, or policy details. If the grounded data does not contain the answer, say so plainly and say what the customer should provide or where to check (e.g. the order token, or the Customer care page). General helpful guidance is allowed ONLY if you start that part with "General guidance:" and it makes no store-specific claim. Do not claim delivery speed, authenticity, warranty, or guarantees. Keep answers short and plain.';
    const prompt = `GROUNDED DATA (use only this):\n${groundedText}\n\nCUSTOMER QUESTION: ${q}\n\nAnswer now from the grounded data only.`;

    const raw = await callAI(ai, fetcher, system, prompt);
    const validated = validateAnswer(raw, { order, groundedText });

    const sources = ['policy:store'];
    if (order) sources.unshift(`order:${order.id}`);
    if (Array.isArray(products) && products.length) sources.push('catalog');
    if (policies) sources.push('policy:configured');
    return { answer: validated, grounded: true, sources };
  }

  return { answer, configured };
}
