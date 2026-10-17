/* Vegarance v3 Phase A — onboarding API tests (server-level).
   Boots the real server: unauthenticated state, signup progression,
   store creation moving the next step, per-store selection, 404s. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'vega-onboarding-'));
let child, base;
async function start() {
  child = spawn(process.execPath, ['server.mjs'], {env: {...process.env, DATA_DIR: dir, PORT: '0', HOST: '127.0.0.1', ADMIN_PASSWORD: 'onboarding-test-owner-password', PLATFORM_SECRET_KEY: 'cd'.repeat(32)}, stdio: ['ignore', 'pipe', 'pipe']});
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Server startup timeout')), 15000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error('Server exited ' + code)); });
    child.stdout.on('data', b => { output += b; const m = output.match(/listening on (\d+)/); if (m) { clearTimeout(timer); base = 'http://127.0.0.1:' + m[1]; resolve(); } });
  });
}
async function stop() { if (child && !child.killed) { const exit = new Promise(r => child.once('exit', r)); child.kill(); await exit; } }
async function req(path, method = 'GET', value, cookie = '') {
  const r = await fetch(base + path, {method, headers: {'Content-Type': 'application/json', Cookie: cookie, Origin: base}, body: value === undefined ? undefined : JSON.stringify(value)});
  return {status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0]};
}
const api = '/api/platform/';
const account = {name: 'Onboarding Merchant', email: 'onboarding@example.com', password: 'a-long-private-password'};
try {
  await start();
  const anon = await req(api + 'onboarding');
  assert.equal(anon.status, 200);
  assert.equal(anon.data.signedIn, false);
  assert.equal(anon.data.nextStep.id, 'account');
  assert.equal(anon.data.steps.find(s => s.id === 'verify-email').status, 'locked');

  const signup = await req(api + 'signup', 'POST', account);
  assert.equal(signup.status, 201);
  assert.ok(signup.cookie);
  const fresh = await req(api + 'onboarding', 'GET', undefined, signup.cookie);
  assert.equal(fresh.status, 200);
  assert.equal(fresh.data.signedIn, true);
  // No platform mailer configured in this test env: verification is skipped, honestly.
  assert.equal(fresh.data.verificationRequired, false);
  assert.equal(fresh.data.steps.find(s => s.id === 'verify-email').status, 'skipped');
  assert.equal(fresh.data.nextStep.id, 'create-store');

  const store = await req(api + 'stores', 'POST', {name: 'First Store', slug: 'first-store'}, signup.cookie);
  assert.equal(store.status, 201);
  const withStore = await req(api + 'onboarding', 'GET', undefined, signup.cookie);
  assert.equal(withStore.data.store.slug, 'first-store');
  assert.equal(withStore.data.nextStep.id, 'connect-supplier');
  assert.equal(withStore.data.steps.find(s => s.id === 'publish').status, 'locked');

  assert.equal((await req(api + 'onboarding?storeId=' + '0'.repeat(32), 'GET', undefined, signup.cookie)).status, 404);
  const second = await req(api + 'stores', 'POST', {name: 'Second', slug: 'second-store'}, signup.cookie);
  assert.equal(second.status, 201);
  const picked = await req(api + 'onboarding?storeId=' + second.data.id, 'GET', undefined, signup.cookie);
  assert.equal(picked.data.store.slug, 'second-store');

  await stop(); await start();
  const persisted = await req(api + 'onboarding', 'GET', undefined, signup.cookie);
  assert.equal(persisted.data.store.slug, 'first-store');
  assert.equal(persisted.data.nextStep.id, 'connect-supplier');
  console.log('PASS: onboarding API — anonymous state, signup progression, store creation moves the next step, per-store selection, 404s, persistence.');
} finally { await stop(); rmSync(dir, {recursive: true, force: true}); }
