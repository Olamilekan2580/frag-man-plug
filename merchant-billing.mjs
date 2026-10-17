/* Vegarance v3 — merchant billing scaffolding (Phase B / P0).
   Provider-agnostic subscription state machine + feature gating.
   NO LIVE BILLING CHARGES: there is no billing provider connected.
   `provider` is 'none' until the owner picks one (Stripe, Flutterwave,
   manual invoicing — see MERCHANT-BILLING.md) and a provider adapter is
   plugged into the documented integration point (setPlan / webhooks).
   Until then every merchant is on Free, or on a free 14-day Starter trial
   started via POST /api/platform/billing/trial. Nothing here charges anyone.
   Prices are NOT stated anywhere in this module: no amount is promised
   until the owner sets real pricing with a real provider. */

const fail = (status, message) => Object.assign(new Error(message), {status});

export const BILLING_PLANS = {
  free: {
    id: 'free', name: 'Free',
    maxStores: 1, maxProducts: 20,
    apiAccess: 'read', // read-only scopes only (read:products, read:orders)
    webhooks: false, maxWebhookEndpoints: 0,
    customDomain: false,
    note: 'Free forever. No card required.',
  },
  starter: {
    id: 'starter', name: 'Starter',
    maxStores: 3, maxProducts: 200,
    apiAccess: 'full',
    webhooks: true, maxWebhookEndpoints: 5,
    customDomain: false,
    note: 'Starter plan. Pricing is set when a billing provider is connected — see MERCHANT-BILLING.md.',
  },
  growth: {
    id: 'growth', name: 'Growth',
    maxStores: 5, maxProducts: 2000,
    apiAccess: 'full',
    webhooks: true, maxWebhookEndpoints: 20,
    customDomain: true, // Gated by the feature itself: custom domains are NOT BUILT (CUSTOM-DOMAINS.md).
    note: 'Growth plan. Pricing is set when a billing provider is connected — see MERCHANT-BILLING.md.',
  },
};

export const PLAN_IDS = Object.keys(BILLING_PLANS);
export const TRIAL_DAYS = 14;
export const TRIAL_MS = TRIAL_DAYS * 86400000;
export const PAST_DUE_GRACE_MS = 7 * 86400000;
export const BILLING_STATUSES = ['none', 'trialing', 'active', 'past_due', 'cancelled', 'trial_expired'];
export const BILLING_PROVIDERS = ['none', 'manual', 'stripe', 'flutterwave'];
const READ_SCOPES = new Set(['read:products', 'read:orders']);

/* Pure: what plan actually gates on right now, given a stored record + time.
   Never trust the stored plan alone — an expired trial or a past-due
   subscription past its grace period gates as Free. */
export function effectivePlan(record, now = Date.now()) {
  if (!record || typeof record !== 'object') return 'free';
  const plan = BILLING_PLANS[record.plan] ? record.plan : 'free';
  if (record.status === 'trialing') {
    if (Number.isSafeInteger(record.trialEndsAt) && now > record.trialEndsAt) return 'free';
    return plan;
  }
  if (record.status === 'past_due') {
    const since = Number.isSafeInteger(record.pastDueSince) ? record.pastDueSince : now;
    if (now - since > PAST_DUE_GRACE_MS) return 'free';
    return plan;
  }
  if (record.status === 'active') return plan;
  return 'free'; // none | cancelled | trial_expired | unknown
}

export function suspendedForBilling(record, now = Date.now()) {
  if (!record || record.status !== 'past_due') return false;
  const since = Number.isSafeInteger(record.pastDueSince) ? record.pastDueSince : now;
  return now - since > PAST_DUE_GRACE_MS;
}

export function createMerchantBilling({db, now = Date.now} = {}) {
  if (!db) throw new Error('createMerchantBilling requires db');
  db.exec(`CREATE TABLE IF NOT EXISTS merchant_billing(
    merchant_id TEXT PRIMARY KEY REFERENCES merchants(id), document TEXT NOT NULL)`);

  const read = merchantId => {
    const row = db.prepare('SELECT document FROM merchant_billing WHERE merchant_id=?').get(merchantId);
    if (!row) return null;
    try { return JSON.parse(row.document); } catch { return null; }
  };
  const write = (merchantId, record) => {
    db.prepare('INSERT INTO merchant_billing VALUES(?,?) ON CONFLICT(merchant_id) DO UPDATE SET document=excluded.document')
      .run(merchantId, JSON.stringify(record));
    return record;
  };
  const merchantForStore = storeId => {
    try {
      const row = db.prepare('SELECT merchant_id FROM merchant_stores WHERE id=?').get(storeId);
      return row ? row.merchant_id : null;
    } catch { return null; }
  };

  /* Public view: never exposes provider ids, secrets, or payment details
     (there are none stored — no provider is connected). */
  function get(merchantId) {
    const record = read(merchantId) || {plan: 'free', status: 'none', provider: 'none', trialUsed: false};
    const plan = effectivePlan(record, now());
    const limits = BILLING_PLANS[plan];
    return {
      merchantId,
      plan: record.plan && BILLING_PLANS[record.plan] ? record.plan : 'free',
      effectivePlan: plan,
      status: record.status || 'none',
      provider: record.provider || 'none',
      billingEnabled: false, // No billing provider is connected. Always false in Phase B.
      chargesLive: false,
      trialEndsAt: record.trialEndsAt || null,
      trialUsed: record.trialUsed === true,
      currentPeriodEndsAt: record.currentPeriodEndsAt || null,
      suspended: suspendedForBilling(record, now()),
      limits: {
        maxStores: limits.maxStores, maxProducts: limits.maxProducts,
        apiAccess: limits.apiAccess, webhooks: limits.webhooks,
        maxWebhookEndpoints: limits.maxWebhookEndpoints, customDomain: limits.customDomain,
      },
    };
  }

  function gate(merchantId, feature, usage = {}) {
    const view = get(merchantId);
    const limits = BILLING_PLANS[view.effectivePlan];
    const upgrade = `Your ${BILLING_PLANS[view.effectivePlan].name} plan does not include this.`;
    switch (feature) {
      case 'create_store': {
        const current = Number.isSafeInteger(usage.currentStores) ? usage.currentStores : 0;
        if (current >= limits.maxStores)
          return {allowed: false, plan: view.effectivePlan, reason: `${upgrade} It allows ${limits.maxStores} store${limits.maxStores === 1 ? '' : 's'} and you already have ${current}.`};
        return {allowed: true, plan: view.effectivePlan, reason: ''};
      }
      case 'add_product': {
        const current = Number.isSafeInteger(usage.currentProducts) ? usage.currentProducts : 0;
        if (current >= limits.maxProducts)
          return {allowed: false, plan: view.effectivePlan, reason: `${upgrade} It allows ${limits.maxProducts} products per store and this store already has ${current}.`};
        return {allowed: true, plan: view.effectivePlan, reason: ''};
      }
      case 'api': {
        const scopes = Array.isArray(usage.scopes) ? usage.scopes : [];
        if (limits.apiAccess === 'full') return {allowed: true, plan: view.effectivePlan, reason: ''};
        if (scopes.every(s => READ_SCOPES.has(s))) return {allowed: true, plan: view.effectivePlan, reason: ''};
        return {allowed: false, plan: view.effectivePlan, reason: `${upgrade} Free allows read-only API scopes (read:products, read:orders).`};
      }
      case 'webhooks': {
        const current = Number.isSafeInteger(usage.currentEndpoints) ? usage.currentEndpoints : 0;
        if (!limits.webhooks)
          return {allowed: false, plan: view.effectivePlan, reason: `${upgrade} Outbound webhooks need Starter or Growth.`};
        if (current >= limits.maxWebhookEndpoints)
          return {allowed: false, plan: view.effectivePlan, reason: `${upgrade} It allows ${limits.maxWebhookEndpoints} webhook endpoints and you already have ${current}.`};
        return {allowed: true, plan: view.effectivePlan, reason: ''};
      }
      case 'custom_domain':
        // The plan gate and the build gate are separate: even Growth is
        // refused because custom domains are NOT BUILT (CUSTOM-DOMAINS.md).
        return {allowed: false, plan: view.effectivePlan, reason: 'Custom merchant domains are not built yet — see CUSTOM-DOMAINS.md. No plan unlocks them today.'};
      default:
        throw fail(422, 'Unknown billing feature: ' + String(feature));
    }
  }

  /* Free trial: 14 days of Starter, no card, once per merchant ever.
     No charge is created — there is no billing provider to charge with. */
  function startTrial(merchantId) {
    const record = read(merchantId) || {plan: 'free', status: 'none', provider: 'none', trialUsed: false};
    if (record.trialUsed) throw fail(409, 'The free trial was already used on this account.');
    if (record.status === 'trialing') throw fail(409, 'A trial is already running on this account.');
    if (record.status === 'active') throw fail(409, 'This account already has an active plan.');
    const next = {...record, plan: 'starter', status: 'trialing', provider: 'none',
      trialEndsAt: now() + TRIAL_MS, trialUsed: true, trialStartedAt: now()};
    write(merchantId, next);
    return get(merchantId);
  }

  function cancel(merchantId) {
    const record = read(merchantId);
    if (!record || !['trialing', 'active', 'past_due'].includes(record.status))
      throw fail(409, 'There is no active plan or trial to cancel.');
    write(merchantId, {...record, status: 'cancelled', cancelledAt: now()});
    return get(merchantId);
  }

  /* INTEGRATION POINT for a future billing provider (see MERCHANT-BILLING.md).
     Called by provider webhook handlers (subscribe / renew / past-due /
     cancel) and by the owner admin route (provider 'manual' / 'none' only).
     This function itself never contacts a provider and never charges. */
  function setPlan(merchantId, input = {}) {
    if (!PLAN_IDS.includes(input.plan)) throw fail(422, 'Unknown plan: ' + String(input.plan));
    if (!BILLING_STATUSES.includes(input.status)) throw fail(422, 'Unknown billing status: ' + String(input.status));
    if (!BILLING_PROVIDERS.includes(input.provider)) throw fail(422, 'Unknown billing provider: ' + String(input.provider));
    const record = read(merchantId) || {plan: 'free', status: 'none', provider: 'none', trialUsed: false};
    const next = {...record, plan: input.plan, status: input.status, provider: input.provider};
    if (Number.isSafeInteger(input.trialEndsAt)) next.trialEndsAt = input.trialEndsAt;
    if (Number.isSafeInteger(input.currentPeriodEndsAt)) next.currentPeriodEndsAt = input.currentPeriodEndsAt;
    if (Number.isSafeInteger(input.pastDueSince)) next.pastDueSince = input.pastDueSince;
    if (typeof input.providerSubscriptionId === 'string' && input.providerSubscriptionId.length <= 200)
      next.providerSubscriptionId = input.providerSubscriptionId;
    write(merchantId, next);
    return get(merchantId);
  }

  function statusForStore(storeId) {
    const merchantId = merchantForStore(storeId);
    if (!merchantId) return null;
    return get(merchantId);
  }

  return {get, gate, startTrial, cancel, setPlan, statusForStore, plans: () => Object.values(BILLING_PLANS)};
}
