/* Vegarance v3 — onboarding wizard client (Phase A).
   Renders GET /api/platform/onboarding state. Inline forms POST to the real
   merchant endpoints (signup, create store, resend verification, publish).
   After every action the wizard re-fetches state — a step only shows as
   done when the server state says so. */
(function () {
  'use strict';
  var API = '/api/platform/';
  var statusEl = document.getElementById('onboardingStatus');
  var nextEl = document.getElementById('onboardingNext');
  var progressEl = document.getElementById('onboardingProgress');
  var barEl = document.getElementById('onboardingBar');
  var stepperEl = document.getElementById('onboardingStepper');
  var stepsEl = document.getElementById('onboardingSteps');
  var currentStoreId = new URLSearchParams(location.search).get('storeId') || '';
  var verificationSent = false;

  function showStatus(message, kind) {
    statusEl.textContent = message || '';
    statusEl.className = message ? 'ds-alert' + (kind === 'error' ? ' ds-alert-danger' : kind === 'success' ? ' ds-alert-success' : '') : '';
  }
  function api(path, method, value) {
    return fetch(API + path, {
      method: method || 'GET',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: value === undefined ? undefined : JSON.stringify(value),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error((data && data.error) || ('Request failed (' + r.status + ')'));
        return data;
      });
    });
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function field(labelText, input) {
    var wrap = el('div', 'ds-field');
    var label = el('label', 'ds-label', labelText);
    label.appendChild(input);
    wrap.appendChild(label);
    return wrap;
  }
  function input(name, type, attrs) {
    var i = document.createElement('input');
    i.name = name; i.type = type || 'text'; i.className = 'ds-input';
    Object.keys(attrs || {}).forEach(function (k) { i.setAttribute(k, attrs[k]); });
    return i;
  }

  function signupForm() {
    var form = el('form');
    form.appendChild(field('Your name', input('name', 'text', { autocomplete: 'name', maxlength: '100', required: '' })));
    form.appendChild(field('Email', input('email', 'email', { autocomplete: 'email', required: '' })));
    form.appendChild(field('Password', input('password', 'password', { autocomplete: 'new-password', minlength: '12', maxlength: '200', required: '' })));
    var hint = el('p', 'ds-hint', 'Use at least 12 characters. Your email is used for verification and password recovery.');
    var btn = el('button', 'ds-btn', 'Create account');
    form.append(hint, btn);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      btn.disabled = true;
      api('signup', 'POST', { name: form.elements.name.value, email: form.elements.email.value, password: form.elements.password.value })
        .then(function (data) {
          verificationSent = !!(data && data.verificationSent);
          showStatus(data.verificationSent ? 'Account created. Verification email sent — check your inbox.' : 'Account created.', 'success');
          return refresh();
        })
        .catch(function (err) { showStatus(err.message, 'error'); btn.disabled = false; });
    });
    return form;
  }
  function storeForm() {
    var form = el('form');
    form.appendChild(field('Store name', input('name', 'text', { maxlength: '80', required: '' })));
    form.appendChild(field('Store URL', input('slug', 'text', { placeholder: 'your-store', minlength: '3', maxlength: '48', pattern: '[a-z0-9][a-z0-9-]{1,46}[a-z0-9]', required: '' })));
    form.appendChild(el('p', 'ds-hint', 'Your storefront will be at /shops/your-store. You can create up to five stores.'));
    var btn = el('button', 'ds-btn', 'Create store');
    form.appendChild(btn);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      btn.disabled = true;
      api('stores', 'POST', { name: form.elements.name.value, slug: form.elements.slug.value })
        .then(function (data) {
          showStatus('Store created.', 'success');
          if (data && data.id) { currentStoreId = data.id; history.replaceState(null, '', '?storeId=' + encodeURIComponent(data.id)); }
          return refresh();
        })
        .catch(function (err) { showStatus(err.message, 'error'); btn.disabled = false; });
    });
    return form;
  }
  function verifyForm() {
    var wrap = el('div');
    var btn = el('button', 'ds-btn', 'Resend verification email');
    wrap.appendChild(btn);
    btn.addEventListener('click', function () {
      btn.disabled = true;
      api('verify-email/request', 'POST', {})
        .then(function () { verificationSent = true; showStatus('Verification email sent. Check your inbox (and spam).', 'success'); return refresh(); })
        .catch(function (err) { showStatus(err.message, 'error'); btn.disabled = false; });
    });
    return wrap;
  }
  function publishForm(store) {
    var wrap = el('div');
    var btn = el('button', 'ds-btn', 'Publish your store');
    wrap.appendChild(btn);
    btn.addEventListener('click', function () {
      btn.disabled = true;
      api('stores/' + store.id, 'GET')
        .then(function (data) {
          var settings = data.store || data;
          settings.published = true;
          return api('stores/' + store.id, 'PUT', settings);
        })
        .then(function () { showStatus('Your store is published.', 'success'); return refresh(); })
        .catch(function (err) { showStatus(err.message, 'error'); btn.disabled = false; });
    });
    return wrap;
  }

  function render(data) {
    barEl.style.width = data.progress.percent + '%';
    progressEl.textContent = data.progress.completed + ' of ' + data.progress.total + ' steps complete (' + data.progress.percent + '%).';
    if (data.allDone) {
      nextEl.textContent = 'Your store is fully set up. Keep it going from the dashboard.';
    } else if (data.nextStep) {
      nextEl.textContent = data.nextStep.title + ' — ' + data.nextStep.detail;
    } else {
      nextEl.textContent = 'Checking your setup…';
    }

    stepperEl.replaceChildren();
    data.steps.forEach(function (step) {
      var li = el('li', '', step.title);
      if (step.status === 'done' || step.status === 'skipped') li.classList.add('ds-done');
      if (step.status === 'current') li.setAttribute('aria-current', 'step');
      if (step.status === 'locked') li.classList.add('ds-locked');
      stepperEl.appendChild(li);
    });

    stepsEl.replaceChildren();
    if (Array.isArray(data.stores) && data.stores.length > 1) {
      var picker = el('div', 'ds-field');
      var label = el('label', 'ds-label', 'Setup progress for store');
      var select = document.createElement('select');
      select.className = 'ds-select';
      data.stores.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.id; opt.textContent = s.name || s.slug;
        if (s.id === (data.store && data.store.id)) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', function () { location.search = '?storeId=' + encodeURIComponent(select.value); });
      label.appendChild(select);
      picker.appendChild(label);
      stepsEl.appendChild(picker);
    }

    data.steps.forEach(function (step) {
      var card = el('section', 'panel ds-card');
      var heading = el('h2', '', step.title);
      card.appendChild(heading);
      var badge = el('span', 'ds-badge' +
        (step.status === 'done' ? ' ds-badge-success' : step.status === 'current' ? ' ds-badge-info' : step.status === 'skipped' ? ' ds-badge-warning' : ''), step.status);
      card.appendChild(badge);
      card.appendChild(el('p', '', step.description));
      if (step.detail) card.appendChild(el('p', '', step.detail));
      if (step.status === 'current') {
        if (step.id === 'account') card.appendChild(signupForm());
        else if (step.id === 'verify-email') card.appendChild(verifyForm());
        else if (step.id === 'create-store') card.appendChild(storeForm());
        else if (step.id === 'publish' && data.store) card.appendChild(publishForm(data.store));
      }
      if (step.action && !(step.status === 'current' && (step.id === 'account' || step.id === 'verify-email' || step.id === 'create-store' || step.id === 'publish'))) {
        var link = el('a', 'ds-btn ds-btn-ghost', step.action.label);
        link.href = step.action.href;
        card.appendChild(link);
      }
      stepsEl.appendChild(card);
    });
  }

  function refresh() {
    showStatus('', '');
    var path = 'onboarding' + (currentStoreId ? '?storeId=' + encodeURIComponent(currentStoreId) : '');
    return api(path, 'GET').then(function (data) {
      if (verificationSent && data.steps) {
        var verify = data.steps.find(function (s) { return s.id === 'verify-email'; });
        if (verify && verify.status === 'current') verify.detail = 'Verification email sent. Check your inbox (and spam) for the confirmation link.';
      }
      render(data);
    }).catch(function (err) { showStatus(err.message, 'error'); });
  }

  refresh();
})();
