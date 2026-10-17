/* Vegarance v3 — pluggable buyer-payment providers (Phase B / P0).
   Every provider implements the same interface, so a store can pick one
   per store and the commerce engine never cares which one it is:
     { provider, configured, live,
       checkConnection(), checkout(order, site, opts),
       verifyTransaction(reference), refund(order), refundStatus(id),
       verify(rawBuffer, signatureHeader) -> normalised event }
   Flutterwave (existing, in payment-client.mjs) already implements this.
   Stripe is the second provider SLOT: fully specified here, but
   NOT CONFIGURED until the owner supplies STRIPE_SECRET_KEY +
   STRIPE_WEBHOOK_SECRET. Until then every Stripe method throws an honest
   503 — never a faked success. No live Stripe charges are possible from
   this code until the platform owner wires keys AND the platform enables
   live merchant payments (currently blocked globally: merchant-commerce
   refuses any non-test binding). See PAYMENTS.md. */

import {createHmac, timingSafeEqual} from 'node:crypto';

const fail = (status, message) => Object.assign(new Error(message), {status});

export const PAYMENT_PROVIDER_IDS = ['flutterwave', 'stripe'];
export const PAYMENT_PROVIDER_INFO = {
  flutterwave: {
    id: 'flutterwave', name: 'Flutterwave',
    envVars: ['FLW_SECRET_KEY', 'FLW_SECRET_HASH', 'FLW_MODE'],
    setupDoc: 'LAUNCH-CHECKLIST.md §3',
    status: 'live slot — configured per store from the merchant’s own Flutterwave keys',
  },
  stripe: {
    id: 'stripe', name: 'Stripe',
    envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_MODE'],
    setupDoc: 'PAYMENTS.md',
    status: 'second provider slot — NOT CONFIGURED until Stripe keys are supplied',
  },
};

function formEncode(obj) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    params.append(k, String(v));
  }
  return params.toString();
}

/* Stripe Checkout Sessions + webhooks, via the Stripe REST API
   (application/x-www-form-urlencoded, as Stripe requires). */
export function createStripePayments({
  secret = process.env.STRIPE_SECRET_KEY || '',
  webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '',
  mode = process.env.STRIPE_MODE || 'test',
  fetcher = fetch,
} = {}) {
  const live = mode === 'live' && secret.startsWith('sk_live_');
  const configured = !!secret && !!webhookSecret &&
    ['test', 'live'].includes(mode) &&
    (mode === 'live' ? secret.startsWith('sk_live_') : secret.startsWith('sk_test_')) &&
    webhookSecret.startsWith('whsec_');
  const notConfigured = () => Object.assign(
    new Error('Stripe payments are not configured. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and STRIPE_MODE, then save your Stripe connection for this store.'),
    {status: 503});

  async function request(path, body) {
    if (!configured) throw notConfigured();
    let response;
    try {
      response = await fetcher('https://api.stripe.com/v1/' + path, {
        method: body ? 'POST' : 'GET',
        signal: AbortSignal.timeout(20000),
        headers: {Authorization: 'Bearer ' + secret, 'Content-Type': 'application/x-www-form-urlencoded'},
        body: body ? formEncode(body) : undefined,
      });
    } catch {
      throw Object.assign(new Error('Stripe is temporarily unavailable. Try again later.'), {status: 502});
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error('Stripe request failed: ' + (result?.error?.message || 'check your Stripe dashboard.')), {status: 502});
    return result;
  }

  return {
    provider: 'stripe', configured, live,
    async checkConnection() {
      if (!configured) throw notConfigured();
      await request('account');
      return true;
    },
    async checkout(order, site, {redirectPath = '/merchant-order.html', title = 'VEGArance'} = {}) {
      if (!configured) throw notConfigured();
      const session = await request('checkout/sessions', {
        mode: 'payment',
        'payment_method_types[0]': 'card',
        client_reference_id: order.id,
        'metadata[orderId]': order.id,
        customer_email: order.email,
        success_url: site + redirectPath + '?token=' + order.token + '&session_id={CHECKOUT_SESSION_ID}',
        cancel_url: site + redirectPath + '?token=' + order.token,
        'line_items[0][quantity]': 1,
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': order.totalCents,
        'line_items[0][price_data][product_data][name]': title + ' order ' + order.id,
      });
      if (typeof session.url !== 'string' || !session.url.startsWith('https://checkout.stripe.com/'))
        throw Object.assign(new Error('Stripe returned an invalid checkout session'), {status: 502});
      return {id: session.id, url: session.url};
    },
    async verifyTransaction(reference) {
      // Reference is a Checkout Session id (cs_…). Map to the commerce
      // engine's Flutterwave-shaped transaction: amount in dollars,
      // id = the PaymentIntent (so refunds can use it), session kept aside.
      const session = await request('checkout/sessions/' + encodeURIComponent(reference));
      const amountTotal = Number(session.amount_total);
      if (!Number.isSafeInteger(amountTotal)) throw Object.assign(new Error('Stripe session has no amount'), {status: 502});
      return {
        id: typeof session.payment_intent === 'string' && session.payment_intent ? session.payment_intent : session.id,
        sessionId: session.id,
        status: session.payment_status === 'paid' ? 'successful' : session.payment_status || 'pending',
        tx_ref: session.client_reference_id || session.metadata?.orderId || null,
        currency: String(session.currency || 'usd').toUpperCase(),
        amount: amountTotal / 100,
        customer: {email: session.customer_details?.email || session.customer_email || ''},
      };
    },
    async refund(order) {
      if (!configured) throw notConfigured();
      const paymentIntent = order.transactionId;
      if (typeof paymentIntent !== 'string' || !paymentIntent.startsWith('pi_'))
        throw Object.assign(new Error('Stripe refund needs a PaymentIntent id (pi_…). This order was not paid through Stripe Checkout.'), {status: 422});
      const refund = await request('refunds', {
        payment_intent: paymentIntent,
        amount: order.totalCents,
        reason: 'requested_by_customer',
        'metadata[orderId]': order.id,
      });
      return {id: refund.id, status: refund.status};
    },
    async refundStatus(id) {
      return request('refunds/' + encodeURIComponent(id));
    },
    verify(raw, header) {
      if (!configured) throw notConfigured();
      if (!webhookSecret) throw Object.assign(new Error('Stripe webhook is not configured'), {status: 503});
      const parts = Object.fromEntries(String(header || '').split(',').map(p => {
        const [k, ...rest] = p.split('=');
        return [k.trim(), rest.join('=').trim()];
      }));
      const timestamp = Number(parts.t);
      const signature = parts.v1 || '';
      if (!Number.isSafeInteger(timestamp) || !signature)
        throw Object.assign(new Error('Invalid Stripe webhook signature'), {status: 400});
      if (Math.abs(Date.now() / 1000 - timestamp) > 300)
        throw Object.assign(new Error('Stripe webhook timestamp is outside the tolerance window'), {status: 400});
      const signed = timestamp + '.' + raw.toString();
      const expected = createHmac('sha256', webhookSecret).update(signed).digest('hex');
      const a = Buffer.from(expected), b = Buffer.from(signature);
      if (a.length !== b.length || !timingSafeEqual(a, b))
        throw Object.assign(new Error('Invalid Stripe webhook signature'), {status: 400});
      let event;
      try { event = JSON.parse(raw.toString()); } catch {
        throw Object.assign(new Error('Invalid Stripe webhook event'), {status: 400});
      }
      // Normalise to the commerce engine's event shape.
      const session = event.data?.object || {};
      if (event.type === 'checkout.session.completed') {
        return {event: 'charge.completed', data: {tx_ref: session.client_reference_id || session.metadata?.orderId || null}};
      }
      return {event: event.type, data: {tx_ref: session.client_reference_id || session.metadata?.orderId || null}};
    },
  };
}

/* Dispatcher: build the provider a store selected. Unknown ids are a 404,
   never a silent fallback to another provider's money flow. */
export function createPaymentProvider(provider, config, factories = {}) {
  if (provider === 'flutterwave') {
    if (typeof factories.flutterwave !== 'function')
      throw Object.assign(new Error('Flutterwave provider factory is not available'), {status: 500});
    const client = factories.flutterwave(config);
    return {...client, provider: 'flutterwave'};
  }
  if (provider === 'stripe') {
    return createStripePayments({...config, fetcher: factories.fetcher || fetch});
  }
  throw Object.assign(new Error('Unknown payment provider: ' + String(provider)), {status: 404});
}
