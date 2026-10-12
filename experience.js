/* Demo checkout and accessible storefront interactions. No network submission. */
let returnFocus = null;
function focusOverlay(el){
  if (!document.activeElement.closest('.modal,.drawer')) returnFocus = document.activeElement;
  requestAnimationFrame(()=>el.querySelector('button,input,select,a')?.focus());
}
function closeOverlays(){
  ['productModal','drawerWrap','checkoutModal'].forEach(id=>document.getElementById(id).hidden=true);
  document.body.style.overflow='';
  returnFocus?.focus();
}
function openCart(){
  closeModal(); renderCart();
  $('#drawerWrap').hidden=false; document.body.style.overflow='hidden';
  focusOverlay($('.drawer'));
}
function totals(){
  const subtotal=cart.reduce((n,it)=>n+it.price*it.qty,0);
  const settings=Store.server?Store.settings:readStore('fmp_settings',{});
  const threshold=Number.isFinite(settings?.shipThreshold) ? Math.max(0,settings.shipThreshold) : 75;
  const shipping=subtotal >= threshold ? 0 : 6.95;
  return {subtotal,shipping,total:subtotal+shipping};
}
function openCheckout(){
  renderCart(); if(!cart.length) return;
  $('#drawerWrap').hidden=true;
  $('#checkoutContent').hidden=false; $('#checkoutSuccess').hidden=true;
  const t=totals();
  $('#checkoutSummary').innerHTML=cart.map(it=>`<div class="summary-row"><span>${esc(it.name)}<small>${esc(it.detail)} · Qty ${it.qty}</small></span><strong>${money(it.price*it.qty)}</strong></div>`).join('')+`<div class="summary-row"><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div><div class="summary-row"><span>Demo shipping</span><strong>${t.shipping?money(t.shipping):'Complimentary'}</strong></div><div class="summary-row summary-total"><span>Demo total</span><strong>${money(t.total)}</strong></div>`;
  $('#checkoutModal').hidden=false; document.body.style.overflow='hidden'; focusOverlay($('#checkoutModal'));
}
const states='Alabama,Alaska,Arizona,Arkansas,California,Colorado,Connecticut,Delaware,Florida,Georgia,Hawaii,Idaho,Illinois,Indiana,Iowa,Kansas,Kentucky,Louisiana,Maine,Maryland,Massachusetts,Michigan,Minnesota,Mississippi,Missouri,Montana,Nebraska,Nevada,New Hampshire,New Jersey,New Mexico,New York,North Carolina,North Dakota,Ohio,Oklahoma,Oregon,Pennsylvania,Rhode Island,South Carolina,South Dakota,Tennessee,Texas,Utah,Vermont,Virginia,Washington,West Virginia,Wisconsin,Wyoming,District of Columbia'.split(',');
$('#checkoutForm select').innerHTML += states.map(s=>`<option>${s}</option>`).join('');
$('#checkoutForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const form=e.currentTarget;
  if(!form.reportValidity()) return;
  if(!form.elements.customer.value.trim()){form.elements.customer.focus();toast('Enter a sample customer name.');return;}
  syncCart(); if(!cart.length){closeOverlays();renderCart();toast('Your cart items are no longer available.');return;}
  let id='DEMO-'+Date.now().toString(36).toUpperCase();
  const orders=readStore('fmp_demo_orders',[]);
  let t=totals();
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  if(Store.server){try{const order=await Store.request('/api/orders','POST',{state:form.elements.state.value,items:cart.map(({productId,size,qty,baseId,accentId,ratio})=>({productId,size,qty,baseId,accentId,ratio}))});id=order.id;t={...t,total:order.total};}catch(error){toast(error.message);submit.disabled=false;return;}}
  // Do not persist name or email: this public preview needs no personal information.
  const order={id,customer:'Demo customer · '+form.elements.state.value,items:cart.map(it=>`${it.name} (${it.detail}) ×${it.qty}`).join(' · '),total:t.total,date:new Date().toISOString().slice(0,10),demo:true};
  if(!Store.server)writeStore('fmp_demo_orders',[order,...(Array.isArray(orders)?orders:[])].slice(0,50));
  cart=[];renderCart();form.reset();
  $('#checkoutContent').hidden=true;$('#checkoutSuccess').hidden=false;
  $('#orderConfirmation').textContent=`Demo order ${id} · ${money(t.total)} in illustrative pricing.`;
  $('#checkoutSuccess button').focus();
  submit.disabled=false;
});
$('#backToCart').onclick=()=>{$('#checkoutModal').hidden=true;openCart();};
$('#loadMore').onclick=()=>{visibleLimit+=24;renderShop();};
$('#shopSort').onchange=e=>{sortOrder=e.target.value;visibleLimit=24;renderShop();};
document.addEventListener('click',e=>{
  const quantity=e.target.closest('[data-qty]');
  if(quantity){const it=cart[+quantity.dataset.qty];if(!it)return;it.qty=Math.min(99,it.qty+Number(quantity.dataset.delta));if(it.qty<=0)cart.splice(+quantity.dataset.qty,1);renderCart();}
  if(e.target.closest('#clearFilters')){activeBrand='all';searchTerm='';$('#shopSearch').value='';visibleLimit=24;renderBrandChips();renderShop();}
  if(e.target.classList.contains('modal'))closeOverlays();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeOverlays();$('#navLinks').classList.remove('open');$('#burger').setAttribute('aria-expanded','false');}
  const overlay=[...document.querySelectorAll('.modal,.drawer-wrap')].find(el=>!el.hidden);
  if(e.key!=='Tab'||!overlay)return;
  const controls=[...overlay.querySelectorAll('button:not(:disabled),a[href],input,select,[tabindex="0"]')].filter(el=>el.getClientRects().length);
  const first=controls[0],last=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
});
document.querySelectorAll('.faq-q').forEach(el=>{el.setAttribute('aria-expanded','false');el.addEventListener('click',()=>document.querySelectorAll('.faq-q').forEach(q=>q.setAttribute('aria-expanded',q.closest('.faq-item').classList.contains('open'))));});
$('#brandTotal').textContent=`${BRANDS.length} fragrance houses`;
$('#catalogTotal').textContent=`${PRODUCTS.length} scents to discover`;
document.querySelectorAll('[data-total-products]').forEach(el=>el.textContent=PRODUCTS.length);
document.querySelectorAll('[data-total-brands]').forEach(el=>el.textContent=BRANDS.length);
const settings=Store.server?Store.settings:readStore('fmp_settings',null);
if(settings&&typeof settings==='object'){
  if(settings.storeName)document.querySelectorAll('.brand-text').forEach(el=>el.textContent=settings.storeName);
  if(settings.announcement)$('.announce').textContent=settings.announcement+' · Demo preview';
}
