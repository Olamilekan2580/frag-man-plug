# VEGArance — Merchant Billing (Phase B, P0)

**Status: scaffolding only. No billing provider is connected. No merchant
can be charged. Nothing in this document is a price promise.**

## Why billing exists

Vegarance is a multi-merchant platform. Merchants use the platform to sell;
the platform charges merchants for the platform. Until now there was no
mechanism for that at all — no plans, no subscription state, no gating.
This build adds the state machine, the gates, and the admin views so a
provider can plug in. It deliberately does NOT add a provider.

## Plans

| Plan | Stores | Products / store | Public API | Outbound webhooks | Custom domain |
|---|---|---|---|---|---|
| Free | 1 | 20 | Read-only (`read:products`, `read:orders`) | No | No |
| Starter | 3 | 200 | Full | Up to 5 endpoints | No |
| Growth | 5 | 2,000 | Full | Up to 20 endpoints | When built (not built yet) |

- All plans can sell (buyer checkout is gated by the activation checks,
  not by plan). Billing gates platform capabilities, never a merchant's
  right to sell what they already listed — except past-due suspension
  below.
- Prices are NOT stated here or in code. No amount is promised until the
  owner sets real pricing with a real provider. Any price a prospect is
  quoted must come from the owner, not from this repo.

## Subscription state machine

```
none → trialing (14-day Starter trial, no card) → active
                                                     ↓
active → past_due → (7-day grace, still gated on plan) → suspended (gates as Free)
active → cancelled → gates as Free
trialing → trial_expired (after 14 days, no payment) → gates as Free
```

- Stored in `merchant_billing` (one row per merchant): plan, status,
  provider, trialEndsAt, currentPeriodEndsAt, pastDueSince,
  providerSubscriptionId, trialUsed.
- `effectivePlan()` is the only thing gates read: an expired trial, a
  cancelled plan, or a past-due subscription past its grace period all
  gate as Free, whatever the stored plan says.
- The free trial is once per merchant ever (`trialUsed`), started by the
  merchant via `POST /api/platform/billing/trial`. It creates no charge —
  there is no provider to charge with.
- `POST /api/platform/billing/cancel` ends a trial/active plan.
- `GET /api/platform/billing` returns the merchant's plan, status,
  effective plan, limits, and `billingEnabled: false` /
  `chargesLive: false` (always false in Phase B).

## Feature gating

Enforced server-side in `platform.mjs` (402 with the exact reason — never
a silent failure):

- `POST /api/platform/stores` — `create_store` gate (current store count).
- `POST /api/platform/stores/:id/products` — `add_product` gate.
- `POST /api/platform/stores/:id/api-keys` — `api` gate (Free: read-only
  scopes only).
- `POST /api/platform/stores/:id/webhooks` — `webhooks` gate (Free: none).
- `custom_domain` gate — always refused: custom domains are NOT BUILT
  (`CUSTOM-DOMAINS.md`), and no plan unlocks them today.
- Activation: `merchant-commerce` readiness includes "Merchant billing in
  good standing" — a merchant past-due beyond the grace period cannot
  enable or run checkout until billing is resolved.

Gating lives in `merchant-billing.mjs` (`gate()`), so the provider
adapter never has to re-implement limits.

## The integration point (what Phase C / the owner builds)

When the owner picks a provider, the provider adapter implements this
surface and nothing else needs to change in the gates:

1. **Checkout session for plan purchase** — provider-hosted checkout
   (Stripe Checkout / Flutterwave Standard) that returns a session/link
   for a chosen plan. Merchant-facing endpoint to add:
   `POST /api/platform/billing/checkout {plan}` → `{url}`.
2. **Webhook handler** — provider events map to `billing.setPlan()`:
   - `subscription created / renewed` → `{plan, status: 'active',
     provider, providerSubscriptionId, currentPeriodEndsAt}`.
   - `payment failed` → `{status: 'past_due', pastDueSince: now}`.
   - `subscription deleted / cancelled` → `{status: 'cancelled'}`.
   - Webhook signatures MUST be verified with the provider's secret
     (Stripe: `STRIPE_WEBHOOK_SECRET`; Flutterwave: `verif-hash`) before
     any state change — unverified webhooks must never change billing.
3. **Dunning** — the provider (or the adapter) emails the merchant on
   payment failure and again before suspension. Suspension itself is
   already implemented: past-due past grace gates as Free + checkout
   disabled.
4. **Receipts / invoices** — issued by the provider (Stripe Billing
   invoices / Flutterwave receipts). Vegarance stores no card data, ever.
5. **Owner admin** — `POST /api/billing/admin/set-plan` (owner cookie +
   same-origin) already exists for `provider: 'manual' | 'none'` only
   (comped / manually-invoiced plans). It cannot set a Stripe/Flutterwave
   provider record; only a verified provider webhook may do that.

## Decision the owner must make (blocking paid plans)

Pick ONE billing provider before any merchant is charged:

- **Stripe Billing** — best fit if merchants pay by card internationally;
  needs a Stripe account, products/prices created in Stripe, and the
  webhook endpoint above.
- **Flutterwave billing** — best fit if merchants pay with local methods;
  needs a Flutterwave account approved for subscriptions/recurring
  collection in the target markets.
- **Manual invoicing** — owner invoices merchants off-platform and marks
  plans via the admin route. No automation, no dunning, no receipts in
  Vegarance.

Until that decision is made and the adapter is built, `BILLING_PROVIDER`
stays `none` and `billingEnabled` stays `false`. Do not quote prices,
do not promise a paid tier, do not invite merchants to "upgrade" — there
is nothing to upgrade to yet.
