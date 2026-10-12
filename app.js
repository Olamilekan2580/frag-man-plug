/* ═══ The Frag Man Plug — demo store logic (real catalog) ═══ */

const SIZES = [
  { id:'3ml',  label:'3ml Decant',  sub:'A first impression' },
  { id:'5ml',  label:'5ml Decant',  sub:'Get to know your scent' },
  { id:'10ml', label:'10ml Decant', sub:'Keep your favorite close' },
];

const BRANDS = [...new Set(PRODUCTS.map(p=>p.brand))].sort();

/* brand imagery — one bottle photo per brand, generated for the demo */
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const BRAND_IMG = {};
BRANDS.forEach(b => { BRAND_IMG[b] = 'images/brand-' + slug(b) + '.webp'; });
const brandImg = p => (typeof PRODUCT_IMAGES !== 'undefined' && PRODUCT_IMAGES[p.id]) || BRAND_IMG[p.brand] || '';

/* admin overrides (demo) — prices/stock edited in admin.html persist here */
(function applyAdminOverrides(){
  try{
    const po = JSON.parse(localStorage.getItem('fmp_price_overrides')||'{}');
    const sm = JSON.parse(localStorage.getItem('fmp_stock')||'{}');
    PRODUCTS.forEach(p=>{
      if(po[p.id]) p.prices = Object.assign({}, p.prices, po[p.id]);
      p.inStock = sm[p.id] !== false;
    });
  }catch(e){ /* corrupted storage — fall back to defaults */ }
})();

/* featured picks — house icons, by exact id with graceful fallback */
const FEATURED_IDS = ['lattafa-asad','armaf-club-de-nuit-intense-man-edt','rasasi-hawas-original','9pm'];
const byId = id => PRODUCTS.find(p=>p.id===id);

/* ── state ── */
const readStore = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeStore = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('Browser storage unavailable; changes last for this visit.'); } };
let cart = readStore('fmp_cart', []);
if (!Array.isArray(cart)) cart = [];
cart = cart.filter(it => it && typeof it.name === 'string' && typeof it.detail === 'string' && Number.isFinite(it.price) && it.price > 0).map(it => ({...it, qty: Math.min(99, Math.max(1, Math.floor(it.qty || 1)))}));
let visibleLimit = 24, sortOrder = 'original';
let activeBrand = 'all';
let searchTerm = '';
let mixSearch = '';
let pmProduct = null, pmSize = '5ml';
let mixBase = null, mixAccent = null, mixRatio = '60/40', mixSize = { s:'10ml', p:42 };

const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(n);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const famLabel = p => p.line ? `${p.brand} · ${p.line}` : p.brand;

/* ── product cards ── */
function cardHTML(p){
  const oos = !p.inStock;
  return `<article class="card reveal${oos?' oos':''}" data-card="${p.id}">
    <div class="card-visual">
      <div class="mono-tile" aria-hidden="true">${esc(p.mono)}</div>
      <img class="card-img" src="${brandImg(p)}" alt="${esc(p.name)} — catalog artwork using representative AI brand imagery" width="560" height="700" loading="lazy" decoding="async" onerror="this.style.display='none'">
      ${oos?'<span class="oos-tag">Out of stock</span>':''}
    </div>
    <div class="card-body">
      <p class="card-family">${esc(famLabel(p).toUpperCase())}</p>
      <h3>${esc(p.name)}</h3>
      <p class="card-notes">Hand-poured in Florida · 3ml / 5ml / 10ml</p>
      <div class="card-foot">
        <span class="card-price">${money(p.prices['3ml'])}<small>3ml decant · demo price</small></span>
        <button class="card-btn" data-view="${p.id}" aria-label="Choose size for ${esc(p.name)}">Choose size ↗</button>
      </div>
    </div>
  </article>`;
}

function filteredProducts(){
  const q = searchTerm.trim().toLowerCase();
  const list = PRODUCTS.filter(p=>{
    if(activeBrand!=='all' && p.brand!==activeBrand) return false;
    if(q && !(p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || (p.line||'').toLowerCase().includes(q))) return false;
    return true;
  });
  if(sortOrder==='az') list.sort((a,b)=>a.name.localeCompare(b.name));
  if(sortOrder==='price') list.sort((a,b)=>a.prices['3ml']-b.prices['3ml'] || a.name.localeCompare(b.name));
  return list;
}

function renderShop(){
  const list = filteredProducts();
  $('#shopGrid').innerHTML = list.slice(0,visibleLimit).map(cardHTML).join('') ||
    `<div class="empty-state"><h3>No scents found.</h3><p>Try another name or explore the whole collection.</p><button class="btn btn-ghost" id="clearFilters">Reset filters</button></div>`;
  const total = PRODUCTS.length;
  $('#shopCount').textContent = list.length===total
    ? `${total} fragrances · ${BRANDS.length} brands`
    : `Showing ${list.length} of ${total}`;
  $('#loadMore').hidden = visibleLimit >= list.length;
  $('#loadMore').textContent = `Discover More (${Math.max(0,list.length-visibleLimit)} remaining)`;
  observeReveals();
}

function renderBrandChips(){
  $('#brandChips').innerHTML =
    `<button class="chip active" data-brand="all">All (${PRODUCTS.length})</button>` +
    BRANDS.map(b=>{
      const n = PRODUCTS.filter(p=>p.brand===b).length;
      return `<button class="chip" data-brand="${esc(b)}">${esc(b)} (${n})</button>`;
    }).join('');
}

function renderFeatured(){
  const picks = FEATURED_IDS.map(byId).filter(Boolean);
  while(picks.length<4) picks.push(PRODUCTS[picks.length]);
  $('#featuredGrid').innerHTML = picks.slice(0,4).map(cardHTML).join('');
}

/* ── reveal on scroll ── */
let io;
function observeReveals(){
  if(!('IntersectionObserver' in window)){ document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in')); return; }
  io = io || new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){e.target.classList.add('in'); io.unobserve(e.target);} }),{threshold:.04});
  document.querySelectorAll('.reveal:not(.in)').forEach(el=>io.observe(el));
}

/* ── product modal ── */
function openProduct(id){
  const p = byId(id); if(!p) return;
  pmProduct = p; pmSize = '5ml';
  $('#pmEyebrow').textContent = famLabel(p);
  $('#pmName').textContent = p.name;
  $('#pmMono').textContent = p.mono;
  const pmImg = $('#pmImg');
  pmImg.src = brandImg(p); pmImg.alt = `Representative ${p.brand} AI demo styling`;
  pmImg.style.display = ''; pmImg.onerror = ()=>{ pmImg.style.display='none'; };
  $('#pmDesc').textContent = p.blurb + ' Available as a hand-poured decant from Florida. Explore a little before committing to more.';
  $('#pmBadges').innerHTML = p.badges.map(b=>`<span class="pm-badge">✦ ${b}</span>`).join('') +
    `<span class="pm-badge demo">demo price</span>`;
  $('#pmSizes').innerHTML = SIZES.map(s=>
    `<button data-size="${s.id}" class="${s.id===pmSize?'active':''}">${s.label}<small>${s.sub} · ${money(p.prices[s.id])}</small></button>`).join('');
  $('#pmPrice').textContent = money(p.prices[pmSize]);
  const addBtn = $('#pmAdd');
  if(!p.inStock){
    addBtn.disabled = true;
    addBtn.textContent = 'Out of Stock';
  } else {
    addBtn.disabled = false;
    addBtn.textContent = 'Add to Cart';
  }
  $('#productModal').hidden = false;
  document.body.style.overflow = 'hidden';
  focusOverlay($('#productModal'));
}
function closeModal(){ $('#productModal').hidden = true; document.body.style.overflow = ''; }

/* ── cart ── */
function addToCart(name, detail, price, productId = null, size = null){
  const existing = cart.find(it => it.name === name && it.detail === detail);
  if(existing) existing.qty = Math.min(99, existing.qty + 1);
  else cart.push({name, detail, price, qty:1, productId, size});
  renderCart(); toast(`Added to your bag — ${name}`);
}
function syncCart(){
  cart = cart.filter(it => !it.productId || byId(it.productId)?.inStock);
  cart.forEach(it => { if(it.productId && it.size) it.price = byId(it.productId).prices[it.size]; });
}
function renderCart(){
  syncCart();
  writeStore('fmp_cart',cart);
  $('#cartCount').textContent = cart.reduce((n,it)=>n+it.qty,0);
  $('#checkoutBtn').disabled = !cart.length;
  $('#cartItems').innerHTML = cart.length ? cart.map((it,i)=>`
    <div class="cart-item"><div class="ci-info"><strong>${esc(it.name)}</strong><small>${esc(it.detail)}</small><div class="quantity"><button data-qty="${i}" data-delta="-1" aria-label="Decrease quantity for ${esc(it.name)}">−</button><span>${it.qty}</span><button data-qty="${i}" data-delta="1" aria-label="Increase quantity for ${esc(it.name)}">+</button></div></div><span class="ci-price">${money(it.price*it.qty)}</span><button class="ci-rm" data-rm="${i}" aria-label="Remove ${esc(it.name)}">✕</button></div>`).join('') : '<div class="cart-empty"><p class="eyebrow">A little curiosity goes a long way.</p><h3>Your discovery starts here.</h3><p>Your bag is waiting for its first fragrance.</p><button class="btn btn-gold" data-close>Explore the Collection</button></div>';
  $('#cartTotal').textContent = money(cart.reduce((a,b)=>a+b.price*b.qty,0));
}
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(()=>t.hidden = true, 2600);
}

/* ── mix builder ── */
function mixList(){
  const q = mixSearch.trim().toLowerCase();
  if(!q) return PRODUCTS.filter(p=>p.inStock);
  return PRODUCTS.filter(p=>p.inStock && (p.name.toLowerCase().includes(q)||p.brand.toLowerCase().includes(q)));
}
function renderMixPicks(){
  const list = mixList();
  const mk = (el, sel, other, fn) => {
    el.innerHTML = list.map(p=>{
      const dis = (p.id===other) ? ' disabled' : '';
      return `<button type="button" class="mix-pick${sel===p.id?' sel':''}${dis}" data-id="${p.id}" ${p.id===other?'disabled':''} aria-pressed="${sel===p.id}"><strong>${esc(p.name)}</strong><small>${esc(p.brand)}</small></button>`;
    }).join('') || '<p class="muted small">No matches.</p>';
    el.querySelectorAll('.mix-pick:not(.disabled)').forEach(d=>d.onclick=()=>fn(d.dataset.id));
  };
  mk($('#mixBase'), mixBase, mixAccent, id=>{ mixBase = (mixBase===id?null:id); renderMixPicks(); updateMix(); });
  mk($('#mixAccent'), mixAccent, mixBase, id=>{ mixAccent = (mixAccent===id?null:id); renderMixPicks(); updateMix(); });
  $('#mixCount').textContent = `${list.length} scents to blend`;
}
function updateMix(){
  const b = byId(mixBase), a = byId(mixAccent);
  const btn = $('#mixAdd');
  if(b && a && b.id!==a.id){
    const name = `${b.name} × ${a.name}`;
    $('#mixName').textContent = name;
    $('#mixDesc').textContent = `${mixRatio} — ${b.name} leading, ${a.name} weaving through. Your custom blend preview.`;
    $('#mixPrice').textContent = `${mixSize.s} · ${money(mixSize.p)}`;
    btn.disabled = false;
    btn.onclick = ()=>addToCart('Custom Hybrid Mix', `${name} · ${mixRatio} · ${mixSize.s} · demo price`, mixSize.p);
  } else {
    $('#mixName').textContent = 'Select a base & accent';
    $('#mixDesc').textContent = 'Pick two different fragrances above to preview your hybrid.';
    $('#mixPrice').textContent = ''; btn.disabled = true; btn.onclick = null;
  }
}

/* ── FAQ accordion ── */
function initFaq(){
  document.querySelectorAll('.faq-item').forEach(item=>{
    const q = item.querySelector('.faq-q');
    q.addEventListener('click', ()=>{
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(o=>o.classList.remove('open'));
      if(!open) item.classList.add('open');
    });
  });
}

/* ── events ── */
document.addEventListener('click', e=>{
  const v = e.target.closest('[data-view]');
  if(v){ openProduct(v.dataset.view); return; }
  const card = e.target.closest('[data-card]');
  if(card){ openProduct(card.dataset.card); return; }
  if(e.target.closest('[data-close]')){ closeOverlays(); return; }
  const rm = e.target.closest('[data-rm]'); if(rm){ cart.splice(+rm.dataset.rm,1); renderCart(); return; }
  const sz = e.target.closest('#pmSizes button'); if(sz){ pmSize = sz.dataset.size;
    document.querySelectorAll('#pmSizes button').forEach(b=>b.classList.toggle('active', b===sz));
    $('#pmPrice').textContent = money(pmProduct.prices[pmSize]); return; }
  const chip = e.target.closest('.chip'); if(chip){
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); chip.classList.add('active');
    activeBrand = chip.dataset.brand; visibleLimit = 24; renderShop(); return; }
});
$('#pmAdd').onclick = ()=>{ if(!pmProduct || !pmProduct.inStock) return; const s = SIZES.find(x=>x.id===pmSize);
  addToCart(pmProduct.name, `${pmProduct.brand} · ${s.label} · demo price`, pmProduct.prices[pmSize], pmProduct.id, pmSize); closeModal(); openCart(); };
$('#cartBtn').onclick = ()=>openCart();
$('#checkoutBtn').onclick = ()=>openCheckout();
$('#burger').onclick = ()=>{const open = $('#navLinks').classList.toggle('open'); $('#burger').setAttribute('aria-expanded',open);};
document.querySelectorAll('#navLinks a').forEach(a=>a.addEventListener('click',()=>{ $('#navLinks').classList.remove('open'); $('#burger').setAttribute('aria-expanded','false'); }));
$('#shopSearch').addEventListener('input', e=>{ searchTerm = e.target.value; visibleLimit = 24; renderShop(); });
$('#mixRatio').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#mixRatio button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  mixRatio = b.dataset.r; updateMix(); });
$('#mixSize').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#mixSize button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  mixSize = { s:b.dataset.s, p:+b.dataset.p }; updateMix(); });
$('#mixSearch').addEventListener('input', e=>{ mixSearch = e.target.value; renderMixPicks(); });
$('#notifyForm').addEventListener('submit', e=>{ e.preventDefault();
  const em = $('#notifyEmail').value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ toast('Please enter a valid email address.'); $('#notifyEmail').focus(); return; }
  $('#notifyForm').hidden = true; $('#notifyOk').hidden = false; toast('Demo signup complete — no email saved or sent'); });


/* ── init ── */
renderBrandChips(); renderFeatured(); renderShop();
renderMixPicks(); updateMix(); renderCart(); initFaq();
