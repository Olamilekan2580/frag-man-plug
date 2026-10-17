/* Vegarance v3 Phase A — onboarding state-machine tests (pure logic).
   A step must NEVER be marked done without evidence in the input. */
import assert from 'node:assert/strict';
import {ONBOARDING_STEPS, deriveOnboarding} from './onboarding.mjs';

const byId = (result, id) => result.steps.find(s => s.id === id);
assert.equal(ONBOARDING_STEPS.length, 8);
assert.equal(new Set(ONBOARDING_STEPS.map(s => s.id)).size, 8);

// 1. Fresh visitor: only the account step is current; everything else locked.
let r = deriveOnboarding({signedIn: false});
assert.equal(byId(r, 'account').status, 'current');
assert.equal(r.nextStep.id, 'account');
assert.equal(r.progress.completed, 0);
assert.equal(r.allDone, false);
for (const id of ['verify-email', 'create-store', 'connect-supplier', 'import-products', 'set-pricing', 'connect-payments', 'publish'])
  assert.equal(byId(r, id).status, 'locked', id);

// 2. Signed in, email unverified, verification required: verify is current.
r = deriveOnboarding({signedIn: true, emailVerified: false, verificationRequired: true});
assert.equal(byId(r, 'verify-email').status, 'current');
assert.equal(byId(r, 'create-store').status, 'todo');
assert.equal(byId(r, 'publish').status, 'locked');
assert.equal(r.nextStep.id, 'verify-email');

// 3. Verification not configured on the platform: verify is skipped, honestly.
r = deriveOnboarding({signedIn: true, emailVerified: false, verificationRequired: false});
assert.equal(byId(r, 'verify-email').status, 'skipped');
assert.equal(byId(r, 'create-store').status, 'current');
assert.equal(r.nextStep.id, 'create-store');

// 4. Verified, no store: create-store is current.
r = deriveOnboarding({signedIn: true, emailVerified: true, verificationRequired: true});
assert.equal(byId(r, 'account').status, 'done');
assert.equal(byId(r, 'verify-email').status, 'done');
assert.equal(byId(r, 'create-store').status, 'current');

// 5. Store exists, nothing connected, no products: supplier + payments current, rest gated.
const store = {id: 's1', slug: 'first-store', name: 'First Store', published: false,
  connections: {cj: {connected: false}, flutterwave: {connected: false}}, productCount: 0, saleReadyCount: 0};
r = deriveOnboarding({signedIn: true, emailVerified: true, store});
assert.equal(byId(r, 'create-store').status, 'done');
assert.equal(byId(r, 'connect-supplier').status, 'current');
assert.equal(byId(r, 'import-products').status, 'todo');
assert.equal(byId(r, 'set-pricing').status, 'todo');
assert.equal(byId(r, 'connect-payments').status, 'current');
assert.equal(byId(r, 'publish').status, 'locked');
assert.equal(r.nextStep.id, 'connect-supplier');

// 6. Supplier connected, no products: import is current.
r = deriveOnboarding({signedIn: true, emailVerified: true,
  store: {...store, connections: {cj: {connected: true, verifiedAt: 1}, flutterwave: {connected: false}}}});
assert.equal(byId(r, 'connect-supplier').status, 'done');
assert.equal(byId(r, 'import-products').status, 'current');
assert.equal(byId(r, 'set-pricing').status, 'todo');

// 7. Products exist but none sale-ready: pricing is current, never done without approval.
r = deriveOnboarding({signedIn: true, emailVerified: true,
  store: {...store, connections: {cj: {connected: true}, flutterwave: {connected: false}}, productCount: 2, saleReadyCount: 0}});
assert.equal(byId(r, 'import-products').status, 'done');
assert.equal(byId(r, 'set-pricing').status, 'current');
assert.equal(byId(r, 'publish').status, 'locked');

// 8. Sale-ready products + payments connected: publish is current.
r = deriveOnboarding({signedIn: true, emailVerified: true,
  store: {...store, connections: {cj: {connected: true}, flutterwave: {connected: true, mode: 'test'}}, productCount: 2, saleReadyCount: 1}});
assert.equal(byId(r, 'set-pricing').status, 'done');
assert.equal(byId(r, 'connect-payments').status, 'done');
assert.equal(byId(r, 'publish').status, 'current');
assert.equal(r.nextStep.id, 'publish');

// 9. Published + everything done: all done, no next step, 100%.
r = deriveOnboarding({signedIn: true, emailVerified: true,
  store: {...store, published: true, connections: {cj: {connected: true}, flutterwave: {connected: true}}, productCount: 2, saleReadyCount: 1}});
assert.equal(r.allDone, true);
assert.equal(r.nextStep, null);
assert.equal(r.progress.percent, 100);
assert.equal(byId(r, 'publish').status, 'done');

// 10. Published flag but email unverified while verification is required:
//     publish must NOT count as done — the server gate would have blocked it.
r = deriveOnboarding({signedIn: true, emailVerified: false, verificationRequired: true,
  store: {...store, published: true, connections: {cj: {connected: true}, flutterwave: {connected: true}}, productCount: 1, saleReadyCount: 1}});
assert.equal(byId(r, 'publish').status, 'locked');
assert.equal(r.allDone, false);

// 11. Missing evidence never completes a step: no store object at all.
r = deriveOnboarding({signedIn: true, emailVerified: true});
assert.equal(byId(r, 'import-products').status, 'locked');
assert.equal(byId(r, 'set-pricing').status, 'locked');

console.log('PASS: onboarding state machine — 8 steps, honest done/current/todo/locked/skipped, publish gated on evidence.');
