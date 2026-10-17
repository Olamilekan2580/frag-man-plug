/* VEGArance standalone pages — shared chrome + page logic.
   Data comes from the existing APIs (/api/catalog, /api/store-config,
   /api/order-status). When the API is unreachable the page falls back to
   the embedded PRODUCTS list. No fake data: empty states stay honest. */
(function () {
  'use strict';
  var CATEGORIES = ['Fragrance', 'Beauty', 'Fashion', 'Accessories', 'Home'];
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var money = function (n) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0); };
  var slug = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  var param = function (k) { return new URLSearchParams(location.search).get(k) || ''; };
  var readStore = function (key, fb) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fb : v; } catch (e) { return fb; } };
  var writeStore = function (key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- catalog ---------- */
  var catalogCache = null;
  function loadCatalog() {
    if (catalogCache) return catalogCache;
    catalogCache = fetch('/api/catalog', { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('catalog unavailable');
      return r.json();
    }).then(function (d) {
      return { products: Array.isArray(d.products) ? d.products : [], settings: d.settings || {} };
    }).catch(function () {
      var list = (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) ? PRODUCTS : [];
      return { products: list, settings: {} };
    });
    return catalogCache;
  }
  function loadConfig() {
    return fetch('/api/store-config', { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('config unavailable');
      return r.json();
    }).catch(function () { return {}; });
  }
  function brandImg(p) {
    if (p.image) return p.image;
    if (typeof PRODUCT_IMAGES !== 'undefined' && PRODUCT_IMAGES[p.id]) return PRODUCT_IMAGES[p.id];
    return 'images/brand-' + slug(p.brand) + '.webp';
  }
  function categoryOf(p) { return p.category || 'Fragrance'; }
  function optionsOf(p) {
    if (Array.isArray(p.variants) && p.variants.length) return p.variants.map(function (v) { return { id: v.id, label: v.label, inStock: v.inStock !== false }; });
    return [{ id: '3ml', label: '3ml Decant', inStock: true }, { id: '5ml', label: '5ml Decant', inStock: true }, { id: '10ml', label: '10ml Decant', inStock: true }];
  }
  function startingPrice(p) { var o = optionsOf(p); return Math.min.apply(null, o.map(function (v) { return p.prices[v.id]; }).filter(function (n) { return Number.isFinite(n); })); }
  function byId(products, id) { for (var i = 0; i < products.length; i++) if (products[i].id === id) return products[i]; return null; }

  /* ---------- cart (same localStorage shape as app.js) ---------- */
  function getCart() { var c = readStore('vegarance_cart', []); return Array.isArray(c) ? c : []; }
  function cartCount() { return getCart().reduce(function (n, it) { return n + (it.qty || 1); }, 0); }
  function updateCartCount() { $$('.vega-cart-count').forEach(function (el) { el.textContent = cartCount(); }); }
  function addToCart(p, option, qty) {
    var cart = getCart();
    var detail = p.brand + ' · ' + option.label;
    var found = null;
    for (var i = 0; i < cart.length; i++) if (cart[i].name === p.name && cart[i].detail === detail) found = cart[i];
    if (found) found.qty = Math.min(99, found.qty + qty);
    else cart.push({ name: p.name, detail: detail, price: p.prices[option.id], qty: qty, productId: p.id, size: option.id });
    writeStore('vegarance_cart', cart);
    updateCartCount();
    toast('Added to your bag — ' + p.name);
  }

  /* ---------- saved scents (same key as saved-scents.js) ---------- */
  function getSaved() { var ids = readStore('vegarance_saved', []); return new Set(Array.isArray(ids) ? ids : []); }
  function toggleSave(id) {
    var saved = getSaved();
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    writeStore('vegarance_saved', Array.from(saved));
    $$('[data-save="' + id + '"]').forEach(function (b) {
      b.textContent = saved.has(id) ? '♥' : '♡';
      b.setAttribute('aria-pressed', String(saved.has(id)));
      b.setAttribute('aria-label', (saved.has(id) ? 'Unsave ' : 'Save ') + id);
    });
    return saved.has(id);
  }

  /* ---------- recently viewed ---------- */
  function recordView(id) {
    var list = readStore('vegarance_recently_viewed', []);
    if (!Array.isArray(list)) list = [];
    list = [id].concat(list.filter(function (x) { return x !== id; })).slice(0, 8);
    writeStore('vegarance_recently_viewed', list);
  }
  function recentRail(el, products) {
    var ids = readStore('vegarance_recently_viewed', []);
    if (!Array.isArray(ids) || !ids.length) return;
    var items = ids.map(function (id) { return byId(products, id); }).filter(Boolean);
    if (!items.length) return;
    el.innerHTML = '<h2>Recently viewed</h2><div class="vega-grid">' + items.map(function (p) { return cardHTML(p); }).join('') + '</div>';
  }

  /* Fallback if support-widget.js failed to load: honest placeholder button. */
  function supportFallback(mount) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'vega-support-fallback';
    b.textContent = 'Support chat — coming soon';
    b.onclick = function () { toast('Support chat is coming soon. For help now, use the Contact page.'); };
    mount.appendChild(b);
  }

  /* ---------- toast ---------- */
  function toast(msg) {
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, 3000);
  }

  /* ---------- product card ---------- */
  function cardHTML(p) {
    var saved = getSaved();
    var oos = p.inStock === false;
    return '<article class="card' + (oos ? ' oos' : '') + '">' +
      '<div class="card-visual">' +
      '<button class="save-scent" data-save="' + esc(p.id) + '" aria-pressed="' + saved.has(p.id) + '" aria-label="' + (saved.has(p.id) ? 'Unsave ' : 'Save ') + esc(p.name) + '">' + (saved.has(p.id) ? '♥' : '♡') + '</button>' +
      '<div class="mono-tile" aria-hidden="true">' + esc(p.mono || (p.brand || '').slice(0, 3).toUpperCase()) + '</div>' +
      '<img class="card-img" src="' + esc(brandImg(p)) + '" alt="' + esc(p.name) + '" width="560" height="700" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">' +
      (oos ? '<span class="oos-tag">Out of stock</span>' : '') +
      '</div><div class="card-body">' +
      '<p class="card-family">' + esc(((p.line ? p.brand + ' · ' + p.line : p.brand) || '').toUpperCase()) + '</p>' +
      '<h3><a href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a></h3>' +
      '<p class="card-notes">' + esc(categoryOf(p)) + ' · ' + optionsOf(p).length + ' options</p>' +
      '<div class="card-foot"><span class="card-price">' + money(startingPrice(p)) + '<small>From</small></span></div>' +
      '<div class="vega-card-actions"><button class="btn btn-ghost" data-qv="' + esc(p.id) + '">Quick view</button>' +
      '<button class="btn btn-gold" data-add="' + esc(p.id) + '"' + (oos ? ' disabled' : '') + '>Add to bag</button></div>' +
      '</div></article>';
  }
  function skeleton(el, n) {
    var i, h = '';
    for (i = 0; i < (n || 8); i++) h += '<div class="vega-sk"><div class="vega-sk-img"></div><div class="vega-sk-line"></div><div class="vega-sk-line short"></div></div>';
    el.innerHTML = '<div class="vega-skeleton">' + h + '</div>';
  }
  function emptyState(title, text, ctaHref, ctaLabel) {
    return '<div class="vega-empty"><p class="eyebrow">VEGArance</p><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
      (ctaHref ? '<a class="btn btn-gold" href="' + esc(ctaHref) + '">' + esc(ctaLabel || 'Explore the collection') + '</a>' : '') + '</div>';
  }

  /* ---------- quick view ---------- */
  function openQuickView(products, id) {
    var p = byId(products, id); if (!p) return;
    var opts = optionsOf(p);
    var first = opts.filter(function (o) { return o.inStock; })[0] || opts[0];
    var qv = $('#vegaQuickView');
    qv.innerHTML = '<div class="vega-qv-card"><button class="vega-qv-close" data-qv-close aria-label="Close quick view">✕</button>' +
      '<div class="vega-qv-img"><img src="' + esc(brandImg(p)) + '" alt="' + esc(p.name) + '" onerror="this.style.display=\'none\'"></div>' +
      '<div class="vega-qv-body"><p class="eyebrow">' + esc(p.brand) + '</p><h3>' + esc(p.name) + '</h3>' +
      '<p class="muted">' + esc(p.blurb || 'Explore this piece in the collection.') + '</p>' +
      '<div class="size-row" id="qvSizes">' + opts.map(function (o) {
        return '<button data-qv-size="' + esc(o.id) + '"' + (o.inStock ? '' : ' disabled') + ' class="' + (o.id === first.id ? 'active' : '') + '">' + esc(o.label) + '<small>' + (o.inStock ? money(p.prices[o.id]) : 'Unavailable') + '</small></button>';
      }).join('') + '</div>' +
      '<p class="vega-qv-price" id="qvPrice">' + money(p.prices[first.id]) + '</p>' +
      '<button class="btn btn-gold" id="qvAdd"' + (p.inStock === false ? ' disabled' : '') + '>Add to bag</button> ' +
      '<a class="btn btn-ghost" href="product.html?id=' + encodeURIComponent(p.id) + '">Full details ↗</a></div></div>';
    qv.hidden = false; document.body.style.overflow = 'hidden';
    var chosen = first.id;
    qv.querySelectorAll('[data-qv-size]').forEach(function (b) {
      b.onclick = function () {
        chosen = b.dataset.qvSize;
        qv.querySelectorAll('[data-qv-size]').forEach(function (x) { x.classList.toggle('active', x === b); });
        $('#qvPrice').textContent = money(p.prices[chosen]);
      };
    });
    $('#qvAdd').onclick = function () {
      var o = opts.filter(function (x) { return x.id === chosen; })[0];
      if (o && o.inStock) { addToCart(p, o, 1); closeQuickView(); }
    };
  }
  function closeQuickView() { var qv = $('#vegaQuickView'); if (qv) qv.hidden = true; document.body.style.overflow = ''; }

  /* ---------- shared chrome ---------- */
  function renderChrome(active) {
    var announce = $('#vegaAnnounce');
    if (announce) {
      loadCatalog().then(function (d) {
        announce.textContent = d.settings.announcement || 'VEGARANCE  /  THE ART OF LIVING  /  COLLECTION PREVIEW';
      });
    }
    var header = $('#vegaHeader');
    if (header) {
      var catLinks = CATEGORIES.map(function (c) {
        return '<a href="category.html?category=' + encodeURIComponent(c) + '"' + (active === 'category-' + c ? ' aria-current="page"' : '') + '>' + c + '</a>';
      }).join('');
      header.className = 'nav';
      header.innerHTML = '<div class="nav-inner"><a class="brand" href="index.html"><span class="brand-mark">V</span><span class="brand-text">VEGA<em>rance</em></span></a>' +
        '<nav class="nav-links" id="vegaNavLinks">' +
        '<a href="shop.html"' + (active === 'shop' ? ' aria-current="page"' : '') + '>Shop</a>' +
        '<a href="about.html"' + (active === 'about' ? ' aria-current="page"' : '') + '>Our Story</a>' +
        '<a href="blog.html"' + (active === 'blog' ? ' aria-current="page"' : '') + '>Journal</a>' +
        '<a href="become-seller.html"' + (active === 'seller' ? ' aria-current="page"' : '') + '>Become a seller</a>' +
        '<a href="track.html"' + (active === 'track' ? ' aria-current="page"' : '') + '>Track order</a>' +
        '<a href="wishlist.html"' + (active === 'wishlist' ? ' aria-current="page"' : '') + '>Saved</a>' +
        '</nav><div class="nav-actions vega-header-row">' +
        '<div class="vega-search"><label class="sr-only" for="vegaSearchInput" style="position:absolute;left:-9999px">Search products</label>' +
        '<input type="search" id="vegaSearchInput" placeholder="Search…" aria-label="Search products" autocomplete="off">' +
        '<div class="vega-suggest" id="vegaSuggest"></div></div>' +
        '<a class="icon-btn" href="cart.html" aria-label="Open cart">Bag <span class="vega-cart-count">0</span></a>' +
        '<button class="icon-btn burger" id="vegaBurger" aria-label="Menu" aria-expanded="false" aria-controls="vegaNavLinks">☰</button>' +
        '</div></div>' +
        '<div class="vega-catnav" aria-label="Categories">' + catLinks + '</div>';
      var burger = $('#vegaBurger');
      burger.onclick = function () { var open = $('#vegaNavLinks').classList.toggle('open'); burger.setAttribute('aria-expanded', String(open)); };
      initSearch();
      updateCartCount();
    }
    var footer = $('#vegaFooter');
    if (footer) {
      footer.className = 'footer';
      footer.innerHTML = '<div class="footer-inner"><div class="f-brand"><a class="brand" href="index.html"><span class="brand-mark">V</span><span class="brand-text">VEGA<em>rance</em></span></a>' +
        '<p>A study in scent.<br>Find what feels like you.</p></div>' +
        '<div class="f-col"><h4>Shop</h4><a href="shop.html">All Products</a><a href="category.html?category=Fragrance">Fragrance</a><a href="category.html?category=Beauty">Beauty</a><a href="category.html?category=Fashion">Fashion</a><a href="category.html?category=Accessories">Accessories</a><a href="category.html?category=Home">Home</a><a href="wishlist.html">Saved scents</a></div>' +
        '<div class="f-col"><h4>Help</h4><a href="faq.html">FAQ</a><a href="shipping.html">Shipping &amp; Returns</a><a href="contact.html">Contact</a><a href="track.html">Track your order</a><a href="cart.html">Your bag</a></div>' +
        '<div class="f-col"><h4>House</h4><a href="about.html">Our Story</a><a href="blog.html">Journal</a><a href="become-seller.html">Become a seller</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="policies.html">All policies</a></div></div>' +
        '<div class="f-bottom"><p>© 2026 VEGArance — Collection preview. <span id="vegaFooterSupport"></span></p></div>';
      loadConfig().then(function (cfg) {
        if (cfg.supportEmail) $('#vegaFooterSupport').innerHTML = 'Questions? <a href="mailto:' + esc(cfg.supportEmail) + '">' + esc(cfg.supportEmail) + '</a>';
      });
    }
    var mobile = $('#vegaMobileNav');
    if (mobile) {
      mobile.className = 'vega-mobile-nav';
      var items = [['index.html', '⌂', 'Home'], ['shop.html', '◇', 'Shop'], ['search.html', '⌕', 'Search'], ['wishlist.html', '♡', 'Saved'], ['cart.html', '◍', 'Bag']];
      mobile.innerHTML = items.map(function (it) {
        var cur = (active === it[1] || location.pathname.indexOf(it[0]) !== -1) ? ' aria-current="page"' : '';
        return '<a href="' + it[0] + '"' + cur + '><span aria-hidden="true">' + it[1] + '</span>' + it[2] + '</a>';
      }).join('');
    }
    var extras = $('#vegaExtras');
    if (extras) {
      extras.innerHTML = '<div class="vega-toast" id="vegaToast" role="status" aria-live="polite" hidden></div>' +
        '<div class="vega-qv" id="vegaQuickView" role="dialog" aria-modal="true" aria-label="Quick view" hidden></div>' +
        '<button class="vega-backtop" id="vegaBackTop" type="button" aria-label="Back to top">↑</button>' +
        '<div id="vegaSupportMount"></div>';
      var mount = document.getElementById('vegaSupportMount');
      if (window.VegaranceSupport && mount) {
        try { VegaranceSupport.init({ endpoint: '/api/ai/support', mount: mount }); }
        catch (e) { mount.innerHTML = ''; supportFallback(mount); }
      } else if (mount) { supportFallback(mount); }
      var bt = $('#vegaBackTop');
      window.addEventListener('scroll', function () { bt.classList.toggle('show', window.scrollY > 600); }, { passive: true });
      bt.onclick = function () { window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
    }
  }

  /* ---------- header search with live suggestions ---------- */
  function initSearch() {
    var input = $('#vegaSearchInput'), box = $('#vegaSuggest');
    if (!input || !box) return;
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim().toLowerCase();
      if (q.length < 2) { box.classList.remove('open'); box.innerHTML = ''; return; }
      timer = setTimeout(function () {
        loadCatalog().then(function (d) {
          var hits = d.products.filter(function (p) {
            return p.name.toLowerCase().indexOf(q) !== -1 || p.brand.toLowerCase().indexOf(q) !== -1 || (p.line || '').toLowerCase().indexOf(q) !== -1;
          }).slice(0, 6);
          if (!hits.length) {
            box.innerHTML = '<button type="button">No matches — press Enter to search</button>';
          } else {
            box.innerHTML = hits.map(function (p) {
              return '<a href="product.html?id=' + encodeURIComponent(p.id) + '"><img src="' + esc(brandImg(p)) + '" alt="" onerror="this.style.display=\'none\'"><span>' + esc(p.name) + '<br><small>' + esc(p.brand) + ' · ' + money(startingPrice(p)) + '</small></span></a>';
            }).join('') + '<button type="button">See all results for “' + esc(input.value.trim()) + '”</button>';
          }
          box.classList.add('open');
          box.querySelectorAll('button').forEach(function (b) { b.onclick = function () { location.href = 'search.html?q=' + encodeURIComponent(input.value.trim()); }; });
        });
      }, 180);
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); location.href = 'search.html?q=' + encodeURIComponent(input.value.trim()); } });
    document.addEventListener('click', function (e) { if (!e.target.closest('.vega-search')) box.classList.remove('open'); });
  }

  /* ---------- shared listing: filters + sort ---------- */
  function initListing(opts) {
    // opts: {products, gridEl, countEl, filtersEl, sortEl, fixedCategory, showCategoryFilter}
    var state = { q: '', brands: [], categories: opts.fixedCategory ? [opts.fixedCategory] : [], min: '', max: '', sort: 'original' };
    function apply() {
      var list = opts.products.filter(function (p) {
        if (state.categories.length && state.categories.indexOf(categoryOf(p)) === -1) return false;
        if (state.brands.length && state.brands.indexOf(p.brand) === -1) return false;
        var price = startingPrice(p);
        if (state.min !== '' && price < Number(state.min)) return false;
        if (state.max !== '' && price > Number(state.max)) return false;
        if (state.q) {
          var q = state.q.toLowerCase();
          if (!(p.name.toLowerCase().indexOf(q) !== -1 || p.brand.toLowerCase().indexOf(q) !== -1 || (p.line || '').toLowerCase().indexOf(q) !== -1)) return false;
        }
        return true;
      });
      if (state.sort === 'az') list.sort(function (a, b) { return a.name.localeCompare(b.name); });
      if (state.sort === 'price') list.sort(function (a, b) { return startingPrice(a) - startingPrice(b); });
      if (state.sort === 'price-desc') list.sort(function (a, b) { return startingPrice(b) - startingPrice(a); });
      opts.gridEl.innerHTML = list.length ? '<div class="vega-grid">' + list.map(function (p) { return cardHTML(p); }).join('') + '</div>'
        : emptyState('No products found.', 'Try widening the price range or clearing a filter.', 'shop.html', 'Explore all products');
      if (opts.countEl) opts.countEl.textContent = 'Showing ' + list.length + ' of ' + opts.products.length + ' products';
      return list;
    }
    function renderFilters() {
      var brands = [];
      opts.products.forEach(function (p) { if (brands.indexOf(p.brand) === -1) brands.push(p.brand); });
      brands.sort();
      var html = '';
      if (opts.showCategoryFilter) {
        html += '<fieldset><legend>Category</legend>' + CATEGORIES.map(function (c) {
          return '<label><input type="checkbox" data-cat="' + esc(c) + '"> ' + esc(c) + '</label>';
        }).join('') + '</fieldset>';
      }
      html += '<fieldset><legend>Brand</legend>' + brands.map(function (b) {
        var n = opts.products.filter(function (p) { return p.brand === b; }).length;
        return '<label><input type="checkbox" data-brand="' + esc(b) + '"> ' + esc(b) + ' (' + n + ')</label>';
      }).join('') + '</fieldset>' +
        '<fieldset><legend>Price (USD, from)</legend><div class="vega-price-row"><label>Min <input type="number" id="vegaMin" min="0" step="1" placeholder="0"></label><label>Max <input type="number" id="vegaMax" min="0" step="1" placeholder="Any"></label></div></fieldset>' +
        '<button class="btn btn-ghost" id="vegaClearFilters" type="button">Clear filters</button>';
      opts.filtersEl.innerHTML = html;
      opts.filtersEl.querySelectorAll('[data-brand]').forEach(function (cb) {
        cb.addEventListener('change', function () {
          state.brands = $$('[data-brand]:checked', opts.filtersEl).map(function (x) { return x.dataset.brand; });
          apply();
        });
      });
      opts.filtersEl.querySelectorAll('[data-cat]').forEach(function (cb) {
        cb.addEventListener('change', function () {
          state.categories = $$('[data-cat]:checked', opts.filtersEl).map(function (x) { return x.dataset.cat; });
          apply();
        });
      });
      $('#vegaMin').addEventListener('input', function (e) { state.min = e.target.value; apply(); });
      $('#vegaMax').addEventListener('input', function (e) { state.max = e.target.value; apply(); });
      $('#vegaClearFilters').onclick = function () {
        state = { q: state.q, brands: [], categories: opts.fixedCategory ? [opts.fixedCategory] : [], min: '', max: '', sort: 'original' };
        opts.filtersEl.querySelectorAll('input[type=checkbox]').forEach(function (x) { x.checked = false; });
        $('#vegaMin').value = ''; $('#vegaMax').value = '';
        if (opts.sortEl) opts.sortEl.value = 'original';
        apply();
      };
    }
    if (opts.sortEl) opts.sortEl.addEventListener('change', function (e) { state.sort = e.target.value; apply(); });
    renderFilters();
    apply();
    return { setQuery: function (q) { state.q = q; apply(); } };
  }

  /* ---------- global click delegation ---------- */
  document.addEventListener('click', function (e) {
    var save = e.target.closest('[data-save]');
    if (save) { e.preventDefault(); e.stopPropagation(); var on = toggleSave(save.dataset.save); toast(on ? 'Saved to your shortlist.' : 'Removed from your shortlist.'); return; }
    var add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault(); e.stopPropagation();
      loadCatalog().then(function (d) {
        var p = byId(d.products, add.dataset.add); if (!p) return;
        var o = optionsOf(p).filter(function (x) { return x.inStock; })[0] || optionsOf(p)[0];
        addToCart(p, o, 1);
      });
      return;
    }
    var qv = e.target.closest('[data-qv]');
    if (qv) { e.preventDefault(); e.stopPropagation(); loadCatalog().then(function (d) { openQuickView(d.products, qv.dataset.qv); }); return; }
    if (e.target.closest('[data-qv-close]') || e.target === $('#vegaQuickView')) closeQuickView();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeQuickView(); });

  /* ---------- FAQ accordion ---------- */
  function initFaq() {
    $$('.faq-item').forEach(function (item) {
      var q = $('.faq-q', item);
      if (!q) return;
      q.setAttribute('aria-expanded', 'false');
      q.addEventListener('click', function () {
        var open = item.classList.contains('open');
        $$('.faq-item.open').forEach(function (o) { o.classList.remove('open'); $('.faq-q', o).setAttribute('aria-expanded', 'false'); });
        if (!open) { item.classList.add('open'); q.setAttribute('aria-expanded', 'true'); }
      });
    });
  }

  /* ---------- blog (honest seed posts — no fake dates, claims, or numbers) ---------- */
  var BLOG = [
    { slug: 'our-story', title: 'Our story: a fragrance, a feeling, a memory', standfirst: 'Why VEGArance starts with discovery — small sizes, familiar houses, and blends that feel like you.', body: [
      'A fragrance can change how you feel. Finding yours should be an adventure, not a shelf full of blind buys.',
      'VEGArance is a place to explore scent with intention. Discover fragrance houses in 3ml, 5ml and 10ml sizes, revisit familiar favorites, or compose a blend that feels entirely yours.',
      'The collection is a preview: explore at your own pace, save the scents you like, and follow the store as new collections are curated. Nothing here is rushed — curiosity looks good on you.'
    ] },
    { slug: 'how-decants-work', title: 'How decants work', standfirst: 'A decant is a smaller portion of an authentic branded fragrance, poured into a sample vial.', body: [
      'A decant is a smaller portion of a fragrance, transferred from a full bottle into a sample vial — not an original retail bottle. It lets you try a scent properly before committing to a full bottle.',
      'VEGArance offers three decant sizes: 3ml for a first impression, 5ml to get to know a scent, and 10ml to keep a favorite close. Spray counts and wear time vary with the atomizer and how much you use.',
      'The decants are poured fresh to order from authentic branded fragrances. Product images on the store are representative styling, not a photo of each exact fragrance.'
    ] },
    { slug: 'how-ordering-works', title: 'How ordering works', standfirst: 'Browse, choose your option, check out, and track your order from one place.', body: [
      'Browse the collection, open a product, and choose your preferred option — for fragrances, that means picking a decant size. Add pieces to your bag and review them on the cart page before checkout.',
      'When checkout is open, you choose a shipping option for your delivery address and pay through secure hosted payment. Your order confirmation includes a private tracking token.',
      'Use the Track order page with that token to check payment and delivery updates. The storefront also runs a preview checkout for demonstration: preview orders take no payment and create no shipment.'
    ] }
  ];

  /* ---------- page inits ---------- */
  function pageInit() {
    var page = document.body.dataset.page;
    if (!page) return;
    renderChrome(page);

    if (page === 'shop') {
      var grid = $('#shopGrid');
      skeleton(grid, 8);
      loadCatalog().then(function (d) {
        initListing({ products: d.products, gridEl: grid, countEl: $('#shopCount'), filtersEl: $('#shopFilters'), sortEl: $('#shopSort'), showCategoryFilter: true });
        recentRail($('#recentRail'), d.products);
      });
    }
    if (page === 'category') {
      var cat = param('category');
      var title = $('#categoryTitle'), crumb = $('#categoryCrumb');
      if (CATEGORIES.indexOf(cat) === -1) {
        title.textContent = 'Category not found';
        $('#categoryGrid').innerHTML = emptyState('That category does not exist.', 'The store carries Fragrance, Beauty, Fashion, Accessories and Home.', 'shop.html', 'Explore all products');
        return;
      }
      title.textContent = cat;
      if (crumb) crumb.innerHTML = '<a href="index.html">Home</a> / <span>' + esc(cat) + '</span>';
      skeleton($('#categoryGrid'), 8);
      loadCatalog().then(function (d) {
        var list = d.products.filter(function (p) { return categoryOf(p) === cat; });
        if (!list.length) {
          $('#categoryGrid').innerHTML = emptyState('A new chapter is coming.', 'There are no ' + cat.toLowerCase() + ' products in the collection yet. Explore the current collection while we curate what comes next.', 'shop.html', 'Explore all products');
          $('#categoryCount').textContent = '0 products';
          return;
        }
        initListing({ products: list, gridEl: $('#categoryGrid'), countEl: $('#categoryCount'), filtersEl: $('#categoryFilters'), sortEl: $('#categorySort'), fixedCategory: cat, showCategoryFilter: false });
      });
    }
    if (page === 'product') {
      var id = param('id');
      var wrap = $('#productWrap');
      skeleton(wrap, 2);
      loadCatalog().then(function (d) {
        var p = byId(d.products, id);
        if (!p) { wrap.innerHTML = emptyState('Product not found.', 'That product may have been removed or the link may be incomplete.', 'shop.html', 'Explore all products'); return; }
        recordView(p.id);
        document.title = p.name + ' — VEGArance';
        var opts = optionsOf(p);
        var first = opts.filter(function (o) { return o.inStock; })[0] || opts[0];
        var gallery = [];
        [brandImg(p), p.image, 'images/brand-' + slug(p.brand) + '.webp'].forEach(function (src) { if (src && gallery.indexOf(src) === -1) gallery.push(src); });
        var saved = getSaved();
        wrap.innerHTML = '<nav class="vega-crumb" aria-label="Breadcrumb"><a href="index.html">Home</a> / <a href="category.html?category=' + encodeURIComponent(categoryOf(p)) + '">' + esc(categoryOf(p)) + '</a> / <span>' + esc(p.name) + '</span></nav>' +
          '<div class="vega-product"><div class="vega-gallery"><div class="vega-gallery-main" id="galMain" title="Click to zoom"><img id="galImg" src="' + esc(gallery[0]) + '" alt="' + esc(p.name) + '" onerror="this.style.display=\'none\'"></div>' +
          '<div class="vega-gallery-thumbs">' + gallery.map(function (src, i) { return '<button data-thumb="' + i + '" class="' + (i === 0 ? 'active' : '') + '" aria-label="View image ' + (i + 1) + '"><img src="' + esc(src) + '" alt="" onerror="this.parentElement.style.display=\'none\'"></button>'; }).join('') + '</div></div>' +
          '<div><p class="eyebrow">' + esc(p.brand) + (p.line ? ' · ' + esc(p.line) : '') + '</p><h1>' + esc(p.name) + '</h1>' +
          '<p class="vega-lead">' + esc(p.blurb || 'Explore this piece in the collection.') + '</p>' +
          '<div class="vega-trust"><span>Secure payment</span><span><a href="shipping.html">Shipping &amp; Returns</a></span><span><a href="policies.html">Store policies</a></span></div>' +
          '<h3>Choose your option</h3><div class="size-row" id="pdSizes">' + opts.map(function (o) {
            return '<button data-pd-size="' + esc(o.id) + '"' + (o.inStock ? '' : ' disabled') + ' class="' + (o.id === first.id ? 'active' : '') + '">' + esc(o.label) + '<small>' + (o.inStock ? money(p.prices[o.id]) : 'Unavailable') + '</small></button>';
          }).join('') + '</div>' +
          '<p class="vega-qv-price" id="pdPrice">' + money(p.prices[first.id]) + '</p>' +
          '<div class="vega-qty"><button id="pdMinus" aria-label="Decrease quantity">−</button><span id="pdQty">1</span><button id="pdPlus" aria-label="Increase quantity">+</button></div>' +
          '<button class="btn btn-gold" id="pdAdd"' + (p.inStock === false ? ' disabled' : '') + '>Add to bag</button> ' +
          '<button class="btn btn-ghost" id="pdSave" aria-pressed="' + saved.has(p.id) + '">' + (saved.has(p.id) ? '♥ Saved' : '♡ Save scent') + '</button>' +
          '<div class="vega-meta">Category: ' + esc(categoryOf(p)) + '<br>Brand: ' + esc(p.brand) + '<br>Availability: ' + (p.inStock === false ? 'Out of stock' : 'In stock') + '<br>Image is representative styling, not a photo of this exact fragrance.</div>' +
          '</div></div>' +
          '<section class="vega-reviews" aria-label="Reviews"><h2>Reviews</h2><p>No reviews yet. Reviews from verified orders will appear here when customers leave them.</p></section>' +
          '<section class="vega-related"><h2>You may also like</h2><div class="vega-grid" id="relatedGrid"></div></section>' +
          '<section class="vega-rail" id="recentRail"></section>';
        var chosen = first.id, qty = 1;
        $('#galMain').onclick = function () { this.classList.toggle('zoomed'); };
        $$('[data-thumb]').forEach(function (b) {
          b.onclick = function () {
            $$('[data-thumb]').forEach(function (x) { x.classList.toggle('active', x === b); });
            $('#galImg').src = gallery[Number(b.dataset.thumb)];
            $('#galMain').classList.remove('zoomed');
          };
        });
        $$('[data-pd-size]').forEach(function (b) {
          b.onclick = function () {
            chosen = b.dataset.pdSize;
            $$('[data-pd-size]').forEach(function (x) { x.classList.toggle('active', x === b); });
            $('#pdPrice').textContent = money(p.prices[chosen]);
          };
        });
        $('#pdMinus').onclick = function () { qty = Math.max(1, qty - 1); $('#pdQty').textContent = qty; };
        $('#pdPlus').onclick = function () { qty = Math.min(99, qty + 1); $('#pdQty').textContent = qty; };
        $('#pdAdd').onclick = function () {
          var o = opts.filter(function (x) { return x.id === chosen; })[0];
          if (o && o.inStock) addToCart(p, o, qty);
        };
        $('#pdSave').onclick = function () {
          var on = toggleSave(p.id);
          this.textContent = on ? '♥ Saved' : '♡ Save scent';
          this.setAttribute('aria-pressed', String(on));
          toast(on ? 'Saved to your shortlist.' : 'Removed from your shortlist.');
        };
        var related = d.products.filter(function (x) { return x.id !== p.id && (x.brand === p.brand || categoryOf(x) === categoryOf(p)); }).slice(0, 4);
        $('#relatedGrid').innerHTML = related.length ? related.map(function (x) { return cardHTML(x); }).join('')
          : '<p class="muted">No related products yet.</p>';
        recentRail($('#recentRail'), d.products);
      });
    }
    if (page === 'search') {
      var form = $('#searchForm'), input = $('#searchInput'), grid = $('#searchGrid'), sugg = $('#searchSuggestions');
      function run(q) {
        input.value = q;
        document.title = q ? 'Search: ' + q + ' — VEGArance' : 'Search — VEGArance';
        if (!q) { grid.innerHTML = emptyState('Search the collection.', 'Enter a product, brand, or category above.', 'shop.html', 'Explore all products'); sugg.innerHTML = ''; return; }
        skeleton(grid, 4);
        loadCatalog().then(function (d) {
          var ql = q.toLowerCase();
          var hits = d.products.filter(function (p) {
            return p.name.toLowerCase().indexOf(ql) !== -1 || p.brand.toLowerCase().indexOf(ql) !== -1 || (p.line || '').toLowerCase().indexOf(ql) !== -1 || categoryOf(p).toLowerCase().indexOf(ql) !== -1;
          });
          $('#searchCount').textContent = hits.length + ' result' + (hits.length === 1 ? '' : 's') + ' for “' + q + '”';
          grid.innerHTML = hits.length ? '<div class="vega-grid">' + hits.map(function (p) { return cardHTML(p); }).join('') + '</div>'
            : emptyState('No matches for “' + q + '”.', 'Try a different spelling, a brand name, or a category like Fragrance.', 'shop.html', 'Explore all products');
          var terms = [];
          d.products.forEach(function (p) { [p.brand, categoryOf(p)].forEach(function (t) { if (t.toLowerCase().indexOf(ql) !== -1 && terms.indexOf(t) === -1) terms.push(t); }); });
          sugg.innerHTML = terms.length ? '<p>Suggestions: ' + terms.slice(0, 6).map(function (t) { return '<a href="search.html?q=' + encodeURIComponent(t) + '">' + esc(t) + '</a>'; }).join(' · ') + '</p>' : '';
        });
      }
      form.addEventListener('submit', function (e) { e.preventDefault(); history.replaceState(null, '', 'search.html?q=' + encodeURIComponent(input.value.trim())); run(input.value.trim()); });
      run(param('q'));
    }
    if (page === 'cart') {
      function renderCartPage() {
        var cart = getCart();
        var wrap = $('#cartWrap');
        updateCartCount();
        if (!cart.length) {
          wrap.innerHTML = emptyState('Your bag is empty.', 'Your discovery starts with a single scent.', 'shop.html', 'Explore the collection');
          return;
        }
        var subtotal = cart.reduce(function (n, it) { return n + it.price * it.qty; }, 0);
        wrap.innerHTML = '<table class="vega-cart-table"><thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th><th></th></tr></thead><tbody>' +
          cart.map(function (it, i) {
            return '<tr><td><strong>' + esc(it.name) + '</strong><br><small>' + esc(it.detail) + '</small></td><td>' + money(it.price) + '</td>' +
              '<td><button data-cqty="' + i + '" data-d="-1" aria-label="Decrease quantity">−</button> ' + it.qty + ' <button data-cqty="' + i + '" data-d="1" aria-label="Increase quantity">+</button></td>' +
              '<td>' + money(it.price * it.qty) + '</td><td><button data-crm="' + i + '" aria-label="Remove ' + esc(it.name) + '">✕</button></td></tr>';
          }).join('') + '</tbody></table>' +
          '<div class="vega-cart-summary"><div class="row"><span>Subtotal</span><strong>' + money(subtotal) + '</strong></div>' +
          '<p class="muted small">Shipping and applicable tax are calculated at checkout. Prices are in USD.</p>' +
          '<a class="btn btn-gold full" href="index.html?checkout=1">Continue to checkout ↗</a>' +
          '<p class="checkout-trust">Secure payment · <a href="shipping.html">Shipping &amp; Returns</a> · <a href="terms.html">Terms</a></p></div>';
        wrap.querySelectorAll('[data-cqty]').forEach(function (b) {
          b.onclick = function () {
            var c = getCart(), it = c[Number(b.dataset.cqty)]; if (!it) return;
            it.qty += Number(b.dataset.d);
            if (it.qty <= 0) c.splice(Number(b.dataset.cqty), 1);
            writeStore('vegarance_cart', c); renderCartPage();
          };
        });
        wrap.querySelectorAll('[data-crm]').forEach(function (b) {
          b.onclick = function () { var c = getCart(); c.splice(Number(b.dataset.crm), 1); writeStore('vegarance_cart', c); renderCartPage(); toast('Removed from your bag.'); };
        });
      }
      renderCartPage();
    }
    if (page === 'track') {
      var tform = $('#trackForm'), tinput = $('#trackToken'), tout = $('#trackResult');
      function showOrder(o) {
        var cents = function (c) { return money((c || 0) / 100); };
        tout.innerHTML = '<section class="commerce-box"><p class="eyebrow">' + esc(o.id) + '</p><h2>Order status: ' + esc(o.status) + '</h2>' +
          '<p>Payment: ' + esc(o.paymentStatus) + (o.paymentMode ? ' · ' + esc(o.paymentMode) + ' mode' : '') + '</p>' +
          (o.lines || []).map(function (l) { return '<div class="order-line"><span>' + esc(l.name) + '<small>' + esc(l.option) + ' · Qty ' + l.qty + '</small></span><strong>' + cents(l.unitCents * l.qty) + '</strong></div>'; }).join('') +
          '<div class="order-line"><span>Shipping' + (o.shippingMethod ? ' · ' + esc(o.shippingMethod) : '') + '</span><strong>' + cents(o.shippingCents) + '</strong></div>' +
          '<div class="order-line"><span>Tax</span><strong>' + cents(o.taxCents) + '</strong></div>' +
          '<div class="order-line"><strong>Total (USD)</strong><strong>' + cents(o.totalCents) + '</strong></div>' +
          (o.tracking ? '<p>Tracking: <strong>' + esc(o.tracking.number) + '</strong> · ' + esc(o.tracking.carrier) + '</p>' +
            (/^https:\/\//.test(o.tracking.url || '') ? '<a class="btn btn-ghost" href="' + esc(o.tracking.url) + '" target="_blank" rel="noopener noreferrer">Track delivery ↗</a>' : '') : '<p>No tracking number yet.</p>') +
          '</section>';
      }
      tform.addEventListener('submit', function (e) {
        e.preventDefault();
        var token = tinput.value.trim();
        if (!token) { tout.innerHTML = '<p role="alert">Enter your order tracking token.</p>'; return; }
        tout.innerHTML = '<p>Looking up your order…</p>';
        fetch('/api/order-status?token=' + encodeURIComponent(token), { credentials: 'same-origin' }).then(function (r) {
          if (!r.ok) throw new Error('not-found');
          return r.json();
        }).then(showOrder).catch(function () {
          tout.innerHTML = '<div class="vega-empty"><h3>No order found for that token.</h3><p>Check the token for typos — it must match the private tracking token from your order confirmation exactly. Demo preview orders are not tracked here; this lookup covers secure-checkout orders.</p></div>';
        });
      });
      if (param('token')) { tinput.value = param('token'); tform.dispatchEvent(new Event('submit')); }
    }
    if (page === 'wishlist') {
      var wgrid = $('#wishlistGrid');
      skeleton(wgrid, 4);
      loadCatalog().then(function (d) {
        var saved = getSaved();
        var items = d.products.filter(function (p) { return saved.has(p.id); });
        if (!items.length) {
          wgrid.innerHTML = emptyState('No saved scents yet.', 'Tap the ♡ on any product to keep it here on this device. Saved scents are stored in this browser only.', 'shop.html', 'Explore the collection');
          return;
        }
        wgrid.innerHTML = '<div class="vega-grid">' + items.map(function (p) { return cardHTML(p); }).join('') + '</div>';
      });
    }
    if (page === 'faq') initFaq();
    if (page === 'shipping' || page === 'privacy' || page === 'terms') {
      var field = page === 'shipping' ? 'shippingPolicy' : page === 'privacy' ? 'privacyPolicy' : 'terms';
      var el = $('#policyBody');
      var fallback = 'This collection is in preview. The store’s policies will be published before sales open.';
      loadConfig().then(function (cfg) {
        var text = cfg[field];
        if (page === 'shipping') {
          var ship = cfg.shippingPolicy || '', ret = cfg.returnPolicy || '';
          el.innerHTML = '<h2>Shipping &amp; delivery</h2><p class="vega-policy">' + esc(ship || fallback) + '</p>' +
            '<h2>Returns &amp; refunds</h2><p class="vega-policy">' + esc(ret || fallback) + '</p>';
        } else {
          el.innerHTML = '<p class="vega-policy">' + esc(text || fallback) + '</p>';
        }
        if (cfg.supportEmail) $('#policySupport').innerHTML = 'Questions? <a href="mailto:' + esc(cfg.supportEmail) + '">' + esc(cfg.supportEmail) + '</a>';
      });
    }
    if (page === 'contact') {
      var cform = $('#contactForm');
      loadConfig().then(function (cfg) {
        if (cfg.supportEmail) {
          $('#contactEmail').innerHTML = 'Email us at <a href="mailto:' + esc(cfg.supportEmail) + '">' + esc(cfg.supportEmail) + '</a>.';
          cform.addEventListener('submit', function (e) {
            e.preventDefault();
            var subject = encodeURIComponent($('#contactSubject').value.trim() || 'VEGArance question');
            var body = encodeURIComponent($('#contactMessage').value.trim());
            location.href = 'mailto:' + cfg.supportEmail + '?subject=' + subject + '&body=' + body;
          });
        } else {
          $('#contactEmail').textContent = 'The store’s support email has not been published yet.';
          cform.addEventListener('submit', function (e) { e.preventDefault(); toast('No support email is published yet, so this message cannot be sent.'); });
        }
      });
    }
    if (page === 'about') {
      loadCatalog().then(function (d) {
        var brands = [];
        d.products.forEach(function (p) { if (brands.indexOf(p.brand) === -1) brands.push(p.brand); });
        $$('[data-total-products]').forEach(function (el) { el.textContent = d.products.length; });
        $$('[data-total-brands]').forEach(function (el) { el.textContent = brands.length; });
      });
    }
    if (page === 'blog') {
      $('#blogList').innerHTML = BLOG.map(function (post) {
        return '<article class="vega-blog-card"><p class="eyebrow">VEGArance Journal</p><h2><a href="blog-post.html?slug=' + post.slug + '">' + esc(post.title) + '</a></h2><p>' + esc(post.standfirst) + '</p><a class="btn btn-ghost" href="blog-post.html?slug=' + post.slug + '">Read ↗</a></article>';
      }).join('');
    }
    if (page === 'blog-post') {
      var post = null;
      for (var i = 0; i < BLOG.length; i++) if (BLOG[i].slug === param('slug')) post = BLOG[i];
      var wrap = $('#blogPost');
      if (!post) { wrap.innerHTML = emptyState('Post not found.', 'That journal entry does not exist.', 'blog.html', 'Back to the Journal'); return; }
      document.title = post.title + ' — VEGArance Journal';
      wrap.innerHTML = '<nav class="vega-crumb"><a href="index.html">Home</a> / <a href="blog.html">Journal</a> / <span>' + esc(post.title) + '</span></nav>' +
        '<p class="eyebrow">VEGArance Journal</p><h1>' + esc(post.title) + '</h1><p class="vega-lead">' + esc(post.standfirst) + '</p>' +
        post.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
        '<p><a class="btn btn-ghost" href="blog.html">← Back to the Journal</a></p>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pageInit);
  else pageInit();
})();
