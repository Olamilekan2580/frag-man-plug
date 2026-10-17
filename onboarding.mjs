/* Vegarance v3 — merchant onboarding wizard state machine (Phase A).
   Pure logic, no I/O: the same derivation runs on the server (platform.mjs
   builds the input from real DB state) and in tests. A step is NEVER marked
   done without evidence in the input — no fake completions, no optimistic
   steps. Statuses: done | current | todo | locked | skipped. */

export const ONBOARDING_STEPS = [
  {id: 'account', title: 'Create your account', description: 'Name, email, and a password of 12+ characters.'},
  {id: 'verify-email', title: 'Verify your email', description: 'Confirm the link sent to your email. Publishing requires a verified email when platform email is configured.'},
  {id: 'create-store', title: 'Create your store', description: 'Name and store URL. Your storefront will live at /shops/your-store.'},
  {id: 'connect-supplier', title: 'Connect a supplier', description: 'Connect your own CJ Dropshipping account. Secrets stay private and are never shown again.'},
  {id: 'import-products', title: 'Import or add products', description: 'Search the supplier catalogue and import drafts, or add products manually. Nothing is offered for sale until you review it.'},
  {id: 'set-pricing', title: 'Set pricing', description: 'Review each product and approve it for sale. Approval needs a description, an image, and a price above supplier cost.'},
  {id: 'connect-payments', title: 'Connect payments', description: 'Connect your own Flutterwave account so your store can collect payments. Checkout stays disabled until payments are connected.'},
  {id: 'publish', title: 'Publish your store', description: 'Publish your storefront so visitors can browse your visible products.'},
];

const PLATFORM_URL = 'platform.html';
const SHOP_URL = slug => '/shops/' + slug;

/* Input shape (all fields optional; missing evidence = step not done):
   {signedIn, emailVerified, verificationRequired, verificationSent,
    billing: null | {effectivePlan, status, suspended},
    store: null | {id, slug, name, published, paymentProvider,
    connections: {cj, flutterwave, stripe, resend}, productCount,
    saleReadyCount, checkoutEnabled,
    activation: null | {ready, checks: [{name, ready, detail}]}}} */
export function deriveOnboarding(input = {}) {
  const signedIn = input.signedIn === true;
  const verificationRequired = input.verificationRequired !== false;
  const emailVerified = input.emailVerified === true;
  const store = input.store || null;
  const connections = store?.connections || {};
  const productCount = Number.isSafeInteger(store?.productCount) ? store.productCount : 0;
  const saleReadyCount = Number.isSafeInteger(store?.saleReadyCount) ? store.saleReadyCount : 0;
  const supplierConnected = connections.cj?.connected === true;
  const paymentProvider = store?.paymentProvider === 'stripe' ? 'stripe' : 'flutterwave';
  const paymentNames = {flutterwave: 'Flutterwave', stripe: 'Stripe'};
  const paymentsConnected = connections[paymentProvider]?.connected === true;
  const published = store?.published === true && (emailVerified || !verificationRequired);

  const steps = ONBOARDING_STEPS.map(def => ({...def, status: 'locked', detail: '', action: null}));
  const byId = id => steps.find(s => s.id === id);

  // 1 — account
  byId('account').status = signedIn ? 'done' : 'current';
  byId('account').detail = signedIn ? 'Signed in.' : 'Create your account below to begin.';
  if (!signedIn) byId('account').action = {label: 'Create your account', href: '#account'};

  // 2 — verify email
  const verify = byId('verify-email');
  if (!signedIn) { verify.status = 'locked'; verify.detail = 'Create your account first.'; }
  else if (!verificationRequired) { verify.status = 'skipped'; verify.detail = 'Email verification is not configured on this platform, so publishing is not gated by it.'; }
  else if (emailVerified) { verify.status = 'done'; verify.detail = 'Your email is verified.'; }
  else {
    verify.status = 'current';
    verify.detail = input.verificationSent === true
      ? 'Verification email sent. Check your inbox (and spam) for the confirmation link.'
      : 'No verification email has been sent yet. Request one below.';
    verify.action = {label: 'Resend verification email', href: '#verify-email'};
  }

  // 3 — create store
  const create = byId('create-store');
  if (!signedIn) { create.status = 'locked'; create.detail = 'Create your account first.'; }
  else if (store) { create.status = 'done'; create.detail = `Store “${store.name || store.slug}” exists at ${SHOP_URL(store.slug)}.`; create.action = {label: 'Open your storefront', href: SHOP_URL(store.slug)}; }
  else { create.status = (emailVerified || !verificationRequired) ? 'current' : 'todo'; create.detail = 'No store yet. Create your first store (up to five per merchant).'; create.action = {label: 'Create your store', href: '#create-store'}; }

  // 4 — connect supplier
  const supplier = byId('connect-supplier');
  if (!store) { supplier.status = 'locked'; supplier.detail = 'Create your store first.'; }
  else if (supplierConnected) { supplier.status = 'done'; supplier.detail = 'CJ Dropshipping is connected.' + (connections.cj?.verifiedAt ? ' Read access checked.' : ' Read access has not been checked yet — run the check in your dashboard.'); supplier.action = {label: 'Manage connections', href: PLATFORM_URL}; }
  else { supplier.status = 'current'; supplier.detail = 'No supplier connected. Your store cannot list supplier products until CJ is connected.'; supplier.action = {label: 'Connect CJ in your dashboard', href: PLATFORM_URL}; }

  // 5 — import / add products
  const products = byId('import-products');
  if (!store) { products.status = 'locked'; products.detail = 'Create your store first.'; }
  else if (productCount > 0) { products.status = 'done'; products.detail = `${productCount} product${productCount === 1 ? '' : 's'} in this store.`; products.action = {label: 'Manage products', href: PLATFORM_URL}; }
  else { products.status = supplierConnected ? 'current' : 'todo'; products.detail = 'No products yet.'; products.action = {label: 'Find supplier products', href: PLATFORM_URL}; }

  // 6 — set pricing
  const pricing = byId('set-pricing');
  if (!store) { pricing.status = 'locked'; pricing.detail = 'Create your store first.'; }
  else if (saleReadyCount > 0) { pricing.status = 'done'; pricing.detail = `${saleReadyCount} product${saleReadyCount === 1 ? '' : 's'} approved for sale (reviewed, priced above supplier cost).`; pricing.action = {label: 'Review products', href: PLATFORM_URL}; }
  else if (productCount > 0) { pricing.status = 'current'; pricing.detail = 'Products exist but none are approved for sale yet. Review each product and approve it for sale.'; pricing.action = {label: 'Review products', href: PLATFORM_URL}; }
  else { pricing.status = 'todo'; pricing.detail = 'Add products first, then review and approve them for sale.'; }

  // 7 — connect payments (per-store provider selection; Stripe is the
  // second slot and stays inactive until its keys are saved + checked).
  const payments = byId('connect-payments');
  if (!store) { payments.status = 'locked'; payments.detail = 'Create your store first.'; }
  else if (paymentsConnected) {
    payments.status = 'done';
    const mode = connections[paymentProvider]?.mode ? ` (${connections[paymentProvider].mode} mode)` : '';
    payments.detail = `${paymentNames[paymentProvider]} is connected${mode}.` + (paymentProvider === 'flutterwave' && !connections.flutterwave?.usdApproved ? ' USD approval is not confirmed — confirm it in your dashboard if you sell in USD.' : '');
    payments.action = {label: 'Manage connections', href: PLATFORM_URL};
  } else { payments.status = 'current'; payments.detail = `Payments are not connected. Checkout cannot collect payments until ${paymentNames[paymentProvider]} is connected.`; payments.action = {label: `Connect ${paymentNames[paymentProvider]} in your dashboard`, href: PLATFORM_URL}; }

  // 8 — publish. When the server supplies activation checks (Phase B),
  // publish stays locked until the store is actually ready to sell:
  // provider keys, storage, policies, tax review, billing standing.
  // Without activation evidence (older callers) the legacy prior-steps
  // gate applies unchanged.
  const publish = byId('publish');
  const priorsDone = ['verify-email', 'create-store', 'connect-supplier', 'import-products', 'set-pricing', 'connect-payments']
    .every(id => ['done', 'skipped'].includes(byId(id).status));
  const activation = store?.activation || null;
  const activationReady = activation ? activation.ready === true : true;
  const firstFailing = activation && Array.isArray(activation.checks)
    ? activation.checks.find(c => c.ready !== true) : null;
  if (!store) { publish.status = 'locked'; publish.detail = 'Create your store first.'; }
  else if (published && activationReady) { publish.status = 'done'; publish.detail = 'Your storefront is published and visitors can browse your visible products.'; publish.action = {label: 'Open your storefront', href: SHOP_URL(store.slug)}; }
  else if (!priorsDone) { publish.status = 'locked'; publish.detail = 'Finish the steps above first. Publishing is blocked until your store is ready.'; }
  else if (!activationReady) { publish.status = 'locked'; publish.detail = 'Activation checks are not all passing yet — publishing is blocked until they pass.' + (firstFailing ? ` First failing check: ${firstFailing.name} — ${firstFailing.detail || 'not ready.'}` : ''); }
  else { publish.status = 'current'; publish.detail = 'Your store is ready. Publish it to make your storefront visible.'; publish.action = {label: 'Publish your store', href: '#publish'}; }

  const completed = steps.filter(s => s.status === 'done' || s.status === 'skipped').length;
  const nextStep = steps.find(s => s.status === 'current') || steps.find(s => s.status === 'todo') || null;
  return {
    steps,
    store: store ? {id: store.id, slug: store.slug, name: store.name || store.slug, published} : null,
    signedIn,
    emailVerified,
    verificationRequired,
    billing: input.billing || null,
    activation: activation ? {ready: activationReady, checks: activation.checks || []} : null,
    progress: {completed, total: steps.length, percent: Math.round((completed / steps.length) * 100)},
    nextStep: nextStep ? {id: nextStep.id, title: nextStep.title, detail: nextStep.detail, action: nextStep.action} : null,
    allDone: steps.every(s => s.status === 'done' || s.status === 'skipped'),
  };
}
