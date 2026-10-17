/* Vegarance v3 Phase A — design-system + onboarding wiring tests (static).
   Asserts the tokens/components exist, every page loads the design system,
   and the emailed auth links point at real pages. */
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';

const css = readFileSync(new URL('./design-system.css', import.meta.url), 'utf8');
for (const token of ['--ds-ink', '--ds-ivory', '--ds-gold', '--ds-text', '--ds-muted', '--ds-line',
  '--ds-success', '--ds-warning', '--ds-danger', '--ds-info',
  '--ds-space-4', '--ds-radius-pill', '--ds-font-sans', '--ds-focus-ring'])
  assert.ok(css.includes(token), 'missing token ' + token);
for (const cls of ['.ds-btn', '.ds-btn-ghost', '.ds-btn-danger', '.ds-input', '.ds-label',
  '.ds-card', '.ds-badge', '.ds-alert', '.ds-empty', '.ds-table', '.ds-stepper',
  '.ds-progress', '.ds-skeleton', '.ds-toast', '.ds-skip-link', '.ds-app', '.vega-empty'])
  assert.ok(css.includes(cls), 'missing component ' + cls);
assert.ok(css.includes(':focus-visible'), 'missing focus-visible rule');
assert.ok(css.includes('prefers-reduced-motion'), 'missing reduced-motion rule');
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
assert.ok(!/countdown|only \d+ left|hurry|act now/i.test(cssNoComments), 'design system must not contain fake-urgency styling');

const pages = readdirSync(new URL('.', import.meta.url)).filter(f => f.endsWith('.html'));
assert.ok(pages.length >= 20, 'expected 20+ HTML pages, got ' + pages.length);
for (const page of pages) {
  const html = readFileSync(new URL('./' + page, import.meta.url), 'utf8');
  assert.ok(html.includes('design-system.css'), page + ' does not load design-system.css');
}
const onboarding = readFileSync(new URL('./onboarding.html', import.meta.url), 'utf8');
assert.ok(onboarding.includes('onboarding.js'), 'onboarding.html must load onboarding.js');
assert.ok(onboarding.includes('ds-stepper'), 'onboarding.html must render the stepper');
assert.ok(onboarding.includes('role="status"') && onboarding.includes('aria-live'), 'onboarding.html must expose live status');
for (const page of ['verify-email.html', 'reset-password.html']) {
  const html = readFileSync(new URL('./' + page, import.meta.url), 'utf8');
  assert.ok(html.includes('role="status"'), page + ' must expose live status');
}
const platform = readFileSync(new URL('./platform.mjs', import.meta.url), 'utf8');
assert.ok(platform.includes('/verify-email.html?token='), 'verification email must link to verify-email.html');
assert.ok(platform.includes('/reset-password.html?token='), 'recovery email must link to reset-password.html');
assert.ok(platform.includes("'/api/platform/onboarding'"), 'platform must expose the onboarding endpoint');
const wizard = readFileSync(new URL('./onboarding.js', import.meta.url), 'utf8');
assert.ok(wizard.includes('/api/platform/onboarding'), 'wizard must read onboarding state from the server');
assert.ok(!/TODO|FIXME|lorem ipsum/i.test(wizard), 'wizard must not contain placeholder logic');

console.log('PASS: design system tokens/components/a11y rules present; all ' + pages.length + ' HTML pages load design-system.css; onboarding + auth-link wiring present.');
