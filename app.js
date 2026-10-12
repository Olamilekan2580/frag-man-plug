/* ═══ The Frag Man Plug — demo store logic (real catalog) ═══ */

const SIZES = [
  { id:'3ml',  label:'3ml Decant',  sub:'~35 sprays · perfect taster' },
  { id:'5ml',  label:'5ml Decant',  sub:'~65 sprays · 2–3 weeks wear' },
  { id:'10ml', label:'10ml Decant', sub:'~130 sprays · a month+ wear' },
];

const BRANDS = [...new Set(PRODUCTS.map(p=>p.brand))].sort();

/* brand imagery — one bottle photo per brand, generated for the demo */
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const BRAND_IMG = {};
BRANDS.forEach(b => { BRAND_IMG[b] = 'images/brand-' + slug(b) + '.png'; });
const brandImg = p => BRAND_IMG[p.brand] || '';

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
let cart = [];
let activeBrand = 'all';
let searchTerm = '';
let mixSearch = '';
let pmProduct = null, pmSize = '5ml';
let mixBase = null, mixAccent = null, mixRatio = '60/40', mixSize = { s:'10ml', p:42 };

const $ = s => document.querySelector(s);
const money = n => '$' + n;
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const famLabel = p => p.line ? `${p.brand} · ${p.line}` : p.brand;

/* ── product cards ── */
function cardHTML(p){
  const oos = !p.inStock;
  return `<article class="card reveal${oos?' oos':''}" data-card="${p.id}">
    <div class="card-visual">
      <div class="mono-tile" aria-hidden="true">${esc(p.mono)}</div>
      <img class="card-img" src="${brandImg(p)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'">
      <span class="demo-tag">demo price</span>
      ${oos?'<span class="oos-tag">Out of stock</span>':''}
    </div>
    <div class="card-body">
      <p class="card-family">${esc(famLabel(p).toUpperCase())}</p>
      <h3>${esc(p.name)}</h3>
      <p class="card-notes">${esc(p.blurb)}</p>
      <div class="card-foot">
        <span class="card-price">${money(p.prices['3ml'])}<small>3ml decant · demo price</small></span>
        <button class="card-btn" data-view="${p.id}">View</button>
      </div>
    </div>
  </article>`;
}

function filteredProducts(){
  const q = searchTerm.trim().toLowerCase();
  return PRODUCTS.filter(p=>{
    if(activeBrand!=='all' && p.brand!==activeBrand) return false;
    if(q && !(p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || (p.line||'').toLowerCase().includes(q))) return false;
    return true;
  });
}

function renderShop(){
  const list = filteredProducts();
  $('#shopGrid').innerHTML = list.map(cardHTML).join('') ||
    `<p class="muted" style="text-align:center;grid-column:1/-1;padding:2rem">No fragrances match — try a different search or brand.</p>`;
  const total = PRODUCTS.length;
  $('#shopCount').textContent = list.length===total
    ? `${total} fragrances · ${BRANDS.length} brands`
    : `Showing ${list.length} of ${total}`;
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
  pmImg.src = brandImg(p); pmImg.alt = p.name;
  pmImg.style.display = ''; pmImg.onerror = ()=>{ pmImg.style.display='none'; };
  $('#pmDesc').textContent = p.blurb + ' Poured fresh from sealed, authentic stock — decanted to order in Florida.';
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
}
function closeModal(){ $('#productModal').hidden = true; document.body.style.overflow = ''; }

/* ── cart ── */
function addToCart(name, detail, price){
  cart.push({name, detail, price});
  renderCart(); toast(`Added — ${name} (${detail})`);
}
function renderCart(){
  $('#cartCount').textContent = cart.length;
  const box = $('#cartItems');
  if(!cart.length){ box.innerHTML = '<p class="cart-empty">Your cart is empty.<br>The scent journey begins with a decant. ✦</p>'; }
  else box.innerHTML = cart.map((it,i)=>`
    <div class="cart-item"><div class="ci-info"><strong>${esc(it.name)}</strong><small>${esc(it.detail)}</small></div>
    <span class="ci-price">${money(it.price)}</span>
    <button class="ci-rm" data-rm="${i}" aria-label="Remove">✕</button></div>`).join('');
  $('#cartTotal').textContent = money(cart.reduce((a,b)=>a+b.price,0));
}
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(()=>t.hidden = true, 2600);
}

/* ── mix builder ── */
function mixList(){
  const q = mixSearch.trim().toLowerCase();
  if(!q) return PRODUCTS;
  return PRODUCTS.filter(p=>p.name.toLowerCase().includes(q)||p.brand.toLowerCase().includes(q));
}
function renderMixPicks(){
  const list = mixList();
  const mk = (el, sel, other, fn) => {
    el.innerHTML = list.map(p=>{
      const dis = (p.id===other) ? ' disabled' : '';
      return `<div class="mix-pick${sel===p.id?' sel':''}${dis}" data-id="${p.id}"><strong>${esc(p.name)}</strong><small>${esc(p.brand)}</small></div>`;
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
    $('#mixDesc').textContent = `${mixRatio} — ${b.name} leading, ${a.name} weaving through. Blended fresh to order, rested 48 hours.`;
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
  if(e.target.closest('[data-close]')){ closeModal(); $('#drawerWrap').hidden = true; document.body.style.overflow=''; return; }
  const rm = e.target.closest('[data-rm]'); if(rm){ cart.splice(+rm.dataset.rm,1); renderCart(); return; }
  const sz = e.target.closest('#pmSizes button'); if(sz){ pmSize = sz.dataset.size;
    document.querySelectorAll('#pmSizes button').forEach(b=>b.classList.toggle('active', b===sz));
    $('#pmPrice').textContent = money(pmProduct.prices[pmSize]); return; }
  const chip = e.target.closest('.chip'); if(chip){
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); chip.classList.add('active');
    activeBrand = chip.dataset.brand; renderShop(); return; }
});
$('#pmAdd').onclick = ()=>{ if(!pmProduct) return; const s = SIZES.find(x=>x.id===pmSize);
  addToCart(pmProduct.name, `${pmProduct.brand} · ${s.label} · demo price`, pmProduct.prices[pmSize]); };
$('#cartBtn').onclick = ()=>{ $('#drawerWrap').hidden = false; document.body.style.overflow='hidden'; };
$('#checkoutBtn').onclick = ()=>toast('Demo checkout — the real store will process payment securely.');
$('#burger').onclick = ()=>$('#navLinks').classList.toggle('open');
document.querySelectorAll('#navLinks a').forEach(a=>a.addEventListener('click',()=>$('#navLinks').classList.remove('open')));
$('#shopSearch').addEventListener('input', e=>{ searchTerm = e.target.value; renderShop(); });
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
  $('#notifyForm').hidden = true; $('#notifyOk').hidden = false; toast('You\u2019re on the launch list ✦'); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeModal(); $('#drawerWrap').hidden=true; document.body.style.overflow=''; }});

/* ── init ── */
renderBrandChips(); renderFeatured(); renderShop();
renderMixPicks(); updateMix(); renderCart(); initFaq();
