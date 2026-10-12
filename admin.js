/* ═══ The Frag Man Plug — demo admin panel ═══
   Separate from the customer storefront. All state persists in localStorage
   so the storefront (app.js) picks it up on load. */

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const money = n => '$' + n;

/* ── persisted state ── */
const load = (k, fb) => { if(Store.server) return fb; try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch(e){ return fb; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let priceOverrides = load('fmp_price_overrides', {});   // {productId: {'3ml':n,'5ml':n,'10ml':n}}
let stockMap       = load('fmp_stock', {});             // {productId: true/false} (default true)
let orderStatus    = load('fmp_order_status', {});      // {orderId: status}
let settings       = load('fmp_settings', null);

const effPrice = (p, size) => (priceOverrides[p.id] && priceOverrides[p.id][size] != null)
  ? priceOverrides[p.id][size] : p.prices[size];
const inStock = p => Store.server ? p.inStock !== false : (stockMap[p.id] ?? p.inStock) !== false;

/* ── toast ── */
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(()=>t.hidden = true, 2200);
}

/* ── tabs (deep-linkable via ?tab=orders etc.) ── */
function showTab(name){
  document.querySelectorAll('.admin-tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  document.querySelectorAll('.admin-pane').forEach(p=>p.classList.toggle('active', p.id==='pane-'+name));
}
document.querySelectorAll('.admin-tab').forEach(b=>b.addEventListener('click', ()=>{
  showTab(b.dataset.tab);
  history.replaceState(null,'','?tab='+b.dataset.tab);
}));

/* ── products table ── */
const BRANDS = [...new Set(PRODUCTS.map(p=>p.brand))].sort();
let adminSearch = '', adminBrand = 'all';

function filteredAdmin(){
  const q = adminSearch.trim().toLowerCase();
  return PRODUCTS.filter(p=>{
    if(adminBrand!=='all' && p.brand!==adminBrand) return false;
    if(q && !(p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))) return false;
    return true;
  });
}

function renderProducts(){
  const list = filteredAdmin();
  $('#productRows').innerHTML = list.map(p=>{
    const stock = inStock(p);
    return `<tr data-row="${p.id}" class="${stock?'':'oos-row'}">
      <td class="pname"><button class="product-name-button" data-product-action="view" data-pid="${p.id}">${esc(p.name)}</button>${p.line?`<small>${esc(p.line)}</small>`:''}</td>
      <td>${esc(p.brand)}</td>
      ${['3ml','5ml','10ml'].map(s=>
        `<td class="num" data-label="${s} USD"><input type="number" min="1" step="0.01" class="price-in" data-pid="${p.id}" data-size="${s}" value="${effPrice(p,s)}" aria-label="${esc(p.name)} ${s} price"></td>`
      ).join('')}
      <td><button class="stock-toggle ${stock?'on':''}" data-stock="${p.id}" aria-pressed="${stock}">
        <span class="knob"></span><span class="st-label">${stock?'In stock':'Out of stock'}</span>
      </button></td>
      <td><div class="row-actions"><button data-product-action="view" data-pid="${p.id}">View</button><button data-product-action="edit" data-pid="${p.id}">Edit</button><button class="delete-action" data-product-action="delete" data-pid="${p.id}">Delete</button></div></td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" class="muted" style="text-align:center;padding:2rem">No products match.</td></tr>`;
  $('#adminCount').textContent = `Showing ${list.length} of ${PRODUCTS.length}`;
  $('#tabProductCount').textContent = PRODUCTS.length;
}

$('#adminSearch').addEventListener('input', e=>{ adminSearch = e.target.value; renderProducts(); });
$('#adminBrandFilter').addEventListener('change', e=>{ adminBrand = e.target.value; renderProducts(); });

document.addEventListener('change', e=>{
  const inp = e.target.closest('.price-in');
  if(inp){
    const pid = inp.dataset.pid, size = inp.dataset.size;
    const v = Math.max(1, Math.round((+inp.value || 0)*100)/100);
    inp.value = v;
    priceOverrides[pid] = priceOverrides[pid] || {};
    priceOverrides[pid][size] = v;
    save('fmp_price_overrides', priceOverrides);
    toast('Price updated — storefront will show $' + v);
  }
  const sel = e.target.closest('.order-status');
  if(sel){
    orderStatus[sel.dataset.oid] = sel.value;
    save('fmp_order_status', orderStatus);
    renderOrderStats();
    toast('Order ' + sel.dataset.oid + ' → ' + sel.value);
  }
});

document.addEventListener('click', e=>{
  const t = e.target.closest('[data-stock]');
  if(t){
    const pid = t.dataset.stock;
    stockMap[pid] = !inStock(PRODUCTS.find(p=>p.id===pid));
    save('fmp_stock', stockMap);
    renderProducts();
    toast(stockMap[pid]===false ? 'Marked out of stock' : 'Back in stock');
  }
});

/* ── orders (mock) ── */
const SAMPLE_ORDERS = [
  {id:'FMP-1042', customer:'Marcus T. · Miami, FL', items:'Lattafa Asad (5ml) ×1 · Rasasi Hawas (3ml) ×2', total:32, date:'2026-10-11'},
  {id:'FMP-1041', customer:'Danielle R. · Orlando, FL', items:'Custom Hybrid Mix (10ml) ×1', total:42, date:'2026-10-11'},
  {id:'FMP-1040', customer:'Chris B. · Tampa, FL', items:'Rasasi Hawas Original (10ml) ×1', total:24, date:'2026-10-10'},
  {id:'FMP-1039', customer:'Priya S. · Atlanta, GA', items:'Armaf Club de Nuit Intense Man EDT (10ml) ×1 · Afnan 9pm (5ml) ×1', total:38, date:'2026-10-10'},
  {id:'FMP-1038', customer:'James W. · Houston, TX', items:'Lattafa Khamrah Qahwa (5ml) ×2', total:28, date:'2026-10-09'},
  {id:'FMP-1037', customer:'Andre L. · Charlotte, NC', items:'Jo Milano Game of Spade King (3ml) ×1', total:9, date:'2026-10-09'},
  {id:'FMP-1036', customer:'Sofia M. · Dallas, TX', items:'Haramain Amber Oud Ruby (5ml) ×1 · Lattafa Asad (3ml) ×1', total:23, date:'2026-10-08'},
  {id:'FMP-1035', customer:'Devon K. · New York, NY', items:'Afnan Supremacy Noir (10ml) ×1', total:24, date:'2026-10-08'},
  {id:'FMP-1034', customer:'Alicia G. · Phoenix, AZ', items:'Custom Hybrid Mix (5ml) ×1 · Rayhaan Azul (3ml) ×1', total:34, date:'2026-10-07'},
  {id:'FMP-1033', customer:'Tom H. · Chicago, IL', items:'Rasasi Hawas Ice (5ml) ×1', total:14, date:'2026-10-07'},
];
const demoOrders = load('fmp_demo_orders', []);
const deletedOrders = load('fmp_deleted_orders', []);
const ORDERS = [...(Array.isArray(demoOrders) ? demoOrders : []), ...SAMPLE_ORDERS].filter(o=>!deletedOrders.includes(o.id));
const STATUSES = ['Pending','Processing','Shipped','Delivered','Cancelled'];
const oStatus = o => o.status || orderStatus[o.id] || (o.demo ? 'Pending' : o.id>='FMP-1041' ? 'Processing' : o.id>='FMP-1038' ? 'Shipped' : 'Delivered');

function renderOrderStats(){
  const rev = ORDERS.reduce((a,o)=>a+o.total,0);
  const pending = ORDERS.filter(o=>['Pending','Processing'].includes(oStatus(o))).length;
  $('#orderStats').innerHTML = `
    <div class="stat"><strong>${money(rev)}</strong><span>Revenue (mock)</span></div>
    <div class="stat"><strong>${ORDERS.length}</strong><span>Orders</span></div>
    <div class="stat"><strong>${pending}</strong><span>Need attention</span></div>`;
  $('#tabOrderCount').textContent = ORDERS.length;
}
function renderOrders(){
  $('#orderRows').innerHTML = ORDERS.map(o=>`
    <tr>
      <td><strong>${o.id}</strong></td>
      <td>${esc(o.customer)}</td>
      <td class="oitems">${esc(o.items)}</td>
      <td class="num"><strong>${money(o.total)}</strong></td>
      <td><select class="order-status st-${oStatus(o).toLowerCase()}" data-oid="${o.id}" aria-label="Status for ${o.id}">
        ${STATUSES.map(s=>`<option ${s===oStatus(o)?'selected':''}>${s}</option>`).join('')}
      </select></td>
      <td>${o.date}</td>
      <td><button class="delete-order-button" data-delete-order="${o.id}" aria-label="Delete demo order ${o.id}">Delete</button></td>
    </tr>`).join('');
  renderOrderStats();
}

/* ── settings ── */
const DEFAULT_SETTINGS = {
  storeName: 'The Frag Man Plug',
  announcement: 'Complimentary US shipping on orders $75+ · Hand-poured in Florida',
  shipThreshold: 75,
  supportEmail: ''
};
function renderSettings(){
  const s = settings || DEFAULT_SETTINGS;
  $('#setStoreName').value = s.storeName;
  $('#setAnnouncement').value = s.announcement;
  $('#setShipThreshold').value = s.shipThreshold;
  $('#setSupportEmail').value = s.supportEmail;
}
$('#settingsForm').addEventListener('submit', e=>{
  e.preventDefault();
  settings = {
    storeName: $('#setStoreName').value.trim() || DEFAULT_SETTINGS.storeName,
    announcement: $('#setAnnouncement').value.trim() || DEFAULT_SETTINGS.announcement,
    shipThreshold: Math.max(0, +$('#setShipThreshold').value || 0),
    supportEmail: $('#setSupportEmail').value.trim() || DEFAULT_SETTINGS.supportEmail
  };
  save('fmp_settings', settings);
  toast('Settings saved ✓');
});
$('#resetDemo').addEventListener('click', ()=>{
  ['fmp_price_overrides','fmp_stock','fmp_order_status','fmp_settings','fmp_cart','fmp_demo_orders','fmp_catalog','fmp_deleted_orders'].forEach(k=>localStorage.removeItem(k));
  priceOverrides = {}; stockMap = {}; orderStatus = {}; settings = null;
  ORDERS.splice(0, ORDERS.length, ...SAMPLE_ORDERS);
  renderProducts(); renderOrders(); renderSettings();
  toast('Demo data reset'); location.reload();
});

/* ── init ── */
$('#adminBrandFilter').innerHTML = '<option value="all">All brands</option>' +
  BRANDS.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('');
renderProducts(); renderOrders(); renderSettings();
const tab = new URLSearchParams(location.search).get('tab');
if(tab && ['products','orders','settings'].includes(tab)) showTab(tab);
