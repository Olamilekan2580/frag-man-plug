/* VEGArance support chat widget. Standalone, no external dependencies.
   NOT auto-injected into any page. To use it, include support-widget.css
   and this file, add an empty container element, then call:
     VegaranceSupport.init({ endpoint: '/api/ai/support', mount: document.getElementById('support-chat') });
   The widget POSTs { question, orderToken } and renders the answer as
   plain text (never as HTML). Order questions need the order token issued
   at checkout; the widget offers an optional token field for that. */
(function (global) {
  'use strict';

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function init(options) {
    options = options || {};
    var endpoint = options.endpoint || '/api/ai/support';
    var mount = options.mount || document.body;
    var fetcher = options.fetch || global.fetch.bind(global);

    var root = el('div', 'vega-support');
    var toggle = el('button', 'vega-support__toggle', 'Support chat');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'vega-support-panel');

    var panel = el('div', 'vega-support__panel');
    panel.id = 'vega-support-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'VEGArance support chat');
    panel.hidden = true;

    var header = el('div', 'vega-support__header');
    header.appendChild(el('strong', '', 'VEGArance support'));
    var close = el('button', 'vega-support__close', 'Close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close support chat');
    header.appendChild(close);

    var messages = el('ul', 'vega-support__messages');
    messages.setAttribute('aria-live', 'polite');

    var form = el('form', 'vega-support__form');
    var questionLabel = el('label', 'vega-support__label', 'Your question');
    questionLabel.setAttribute('for', 'vega-support-question');
    var questionInput = el('input', 'vega-support__input');
    questionInput.id = 'vega-support-question';
    questionInput.type = 'text';
    questionInput.maxLength = 2000;
    questionInput.autocomplete = 'off';
    questionInput.required = true;
    questionInput.placeholder = 'Ask about an order, shipping, returns, or a product…';

    var tokenLabel = el('label', 'vega-support__label', 'Order token (optional — needed for order questions)');
    tokenLabel.setAttribute('for', 'vega-support-token');
    var tokenInput = el('input', 'vega-support__input');
    tokenInput.id = 'vega-support-token';
    tokenInput.type = 'text';
    tokenInput.autocomplete = 'off';
    tokenInput.placeholder = 'Order token from your checkout confirmation';

    var send = el('button', 'vega-support__send', 'Send');
    send.type = 'submit';
    var status = el('p', 'vega-support__status');
    status.setAttribute('aria-live', 'polite');

    form.appendChild(questionLabel);
    form.appendChild(questionInput);
    form.appendChild(tokenLabel);
    form.appendChild(tokenInput);
    form.appendChild(send);
    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(form);
    panel.appendChild(status);
    root.appendChild(toggle);
    root.appendChild(panel);
    mount.appendChild(root);

    function addMessage(who, text) {
      var item = el('li', 'vega-support__message vega-support__message--' + who);
      item.textContent = text;
      messages.appendChild(item);
      messages.scrollTop = messages.scrollHeight;
    }

    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) questionInput.focus();
    }

    toggle.addEventListener('click', function () { setOpen(panel.hidden); });
    close.addEventListener('click', function () { setOpen(false); toggle.focus(); });
    panel.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { setOpen(false); toggle.focus(); }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var question = questionInput.value.trim();
      if (!question) return;
      var orderToken = tokenInput.value.trim();
      addMessage('user', question);
      questionInput.value = '';
      send.disabled = true;
      status.textContent = 'Thinking…';
      var payload = { question: question };
      if (orderToken) payload.orderToken = orderToken;
      fetcher(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data && data.error ? data.error : 'Request failed');
          return data;
        });
      }).then(function (data) {
        addMessage('assistant', data.answer || 'No answer returned. Please try again.');
        status.textContent = '';
      }).catch(function () {
        addMessage('assistant', 'Sorry — support chat is temporarily unavailable. Please try again in a moment.');
        status.textContent = 'Support chat is temporarily unavailable.';
      }).finally(function () {
        send.disabled = false;
        questionInput.focus();
      });
    });

    return { element: root, open: function () { setOpen(true); }, close: function () { setOpen(false); } };
  }

  global.VegaranceSupport = { init: init };
})(typeof window !== 'undefined' ? window : globalThis);
