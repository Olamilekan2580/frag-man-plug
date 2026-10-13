/* Sales checkout. The preview remains available until the owner opens sales. */
const sales=Store.commerce;
let shippingQuote=null;
if(sales?.salesEnabled){
  document.documentElement.dataset.sales='open';
  const form=$('#checkoutForm');
  form.innerHTML=`<div class="checkout-fields"><label>Full name<input name="name" required maxlength="50" autocomplete="name"></label><label>Email<input name="email" type="email" required maxlength="100" autocomplete="email"></label><label>Phone<input name="phone" type="tel" required maxlength="20" autocomplete="tel"></label><label>Street address<input name="line1" required maxlength="200" autocomplete="address-line1"></label><label>Apartment / suite (optional)<input name="line2" maxlength="200" autocomplete="address-line2"></label><label>City<input name="city" required maxlength="50" autocomplete="address-level2"></label><label>US state<select name="state" required autocomplete="address-level1"><option value="">Choose a state</option></select></label><label>ZIP code<input name="zip" required pattern="[0-9]{5}(-[0-9]{4})?" autocomplete="postal-code" inputmode="numeric"></label></div><button type="button" class="btn btn-ghost full" id="getShipping">Get shipping options</button><div id="shippingOptions" class="shipping-options"></div><div id="checkoutSummary"></div><label class="checkout-consent"><input name="consent" type="checkbox" required> I agree to the <a href="policies.html?section=terms" target="_blank" rel="noopener">terms</a> and <a href="policies.html?section=returns" target="_blank" rel="noopener">return policy</a>.</label><p class="form-error" id="salesCheckoutError" role="alert"></p><button class="btn btn-gold full" type="submit" disabled>Continue to secure payment ↗</button><button class="text-button" id="backToCart" type="button">← Back to your bag</button>`;
  // State names and postal codes are mapped explicitly to avoid locale ambiguity.
  const stateCodes='AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ');
  form.elements.state.innerHTML+=states.map((name,i)=>`<option value="${stateCodes[i]}">${name}</option>`).join('');
  $('#checkoutTitle').textContent='Make it yours.';
  $('#checkoutContent > p.muted').textContent='Delivery within the United States. Choose shipping, then pay securely with Flutterwave.';
  $('.drawer-foot > p').textContent='Shipping and applicable tax calculated before payment.';
  $('.f-bottom p').textContent=`© ${new Date().getFullYear()} ${sales.businessName||'VEGArance'}.`;
  $('.announce').textContent=Store.settings?.announcement||'VEGArance · The art of living';
  document.querySelectorAll('.pm-info > p.muted').forEach(p=>p.textContent='Choose your preferred option. Shipping is calculated at checkout.');
  for(const selector of ['#sizes','#mix','#soon','.perks','.pm-specs'])document.querySelector(selector)?.setAttribute('hidden','');
  document.querySelectorAll('a[href="#mix"],a[href="#sizes"],a[href="#soon"],.hero-badges').forEach(el=>el.hidden=true);
  document.querySelectorAll('.demo-note').forEach(el=>el.hidden=true);
  $('#featured .section-sub').textContent='Selected pieces from the VEGArance collection.';
  $('#shop .section-sub').textContent='Explore the details. Find something that feels like you.';
  $('#brandTotal').textContent=`${BRANDS.length} brands in the collection`;
  $('#catalogTotal').textContent=`${PRODUCTS.length} products to discover`;
  const trustCopy=[['Secure checkout','Hosted payments with Flutterwave'],['Shipping choices','Quoted for your delivery address']];
  document.querySelectorAll('.trust-item').forEach((item,i)=>{if(trustCopy[i]){item.querySelector('strong').textContent=trustCopy[i][0];item.querySelector('small').textContent=trustCopy[i][1];}});
  const firstProduct=PRODUCTS.find(p=>p.image);
  if(firstProduct){const hero=document.querySelector('.hero-img');hero.src=firstProduct.image;hero.alt=firstProduct.name;const story=document.querySelector('.story-visual img');story.src=firstProduct.image;story.alt=firstProduct.name;}
  document.querySelector('.hero-caption').innerHTML='<span>Considered details.<br><b>Everyday discoveries.</b></span><span>VEGArance</span>';
  document.querySelector('.marquee-track').textContent=[...BRANDS,...BRANDS,...BRANDS].join('  ✦  ');
  document.querySelector('.story-text h2').innerHTML='Everyday living.<br><span class="gold"><em>A little more considered.</em></span>';
  const storyParagraphs=document.querySelectorAll('.story-text > p:not(.eyebrow)');storyParagraphs[0].textContent='A finishing touch. A favorite detail. Something that makes the everyday feel more like you.';storyParagraphs[1].textContent='Explore the VEGArance collection, choose your preferred option, and follow your order from payment to delivery.';
  const valueCopy=[['Choose your details','Product options, descriptions and prices in one place.'],['Make it yours','Secure hosted payment after choosing your shipping service.'],['Stay in the loop','Order confirmation and tracking updates by email.']];
  document.querySelectorAll('.value').forEach((el,i)=>{el.querySelector('strong').textContent=valueCopy[i][0];el.querySelector('small').textContent=valueCopy[i][1];});
  document.querySelector('.image-caption').textContent='THE VEGARANCE COLLECTION';
  document.querySelector('.story-stats').innerHTML=`<div><strong>${PRODUCTS.length}</strong><span>Products</span></div><div><strong>${BRANDS.length}</strong><span>Brands</span></div><div><strong>US</strong><span>Delivery</span></div><div><strong>V</strong><span>VEGArance</span></div>`;
  document.querySelector('#discovery > p:not(.eyebrow)').textContent='Find a favorite detail. Discover something new.';document.querySelector('#discovery > a').textContent='Explore the collection ↗';
  const faqAnswers=[sales.shippingPolicy,sales.returnPolicy,sales.privacyPolicy];
  document.querySelectorAll('.faq-item').forEach((item,i)=>{if(i>2){item.hidden=true;return;}item.querySelector('.faq-q').firstChild.textContent=['Shipping & delivery','Returns & refunds','Privacy & support'][i];item.querySelector('.faq-a').innerHTML=`<p>${esc(faqAnswers[i].slice(0,200))}${faqAnswers[i].length>200?'…':''} <a href="policies.html?section=${['shipping','returns','privacy'][i]}">Read the full policy ↗</a></p>`;});
  const footer=document.querySelector('.f-bottom');footer.insertAdjacentHTML('beforeend','<nav class="policy-links" aria-label="Store policies"><a href="policies.html?section=shipping">Shipping</a><a href="policies.html?section=returns">Returns</a><a href="policies.html?section=privacy">Privacy</a><a href="policies.html?section=terms">Terms</a></nav>');
  if(sales.supportEmail)footer.insertAdjacentHTML('beforeend',`<a href="mailto:${esc(sales.supportEmail)}">${esc(sales.supportEmail)}</a>`);
  openCheckout=function(){
    renderCart();if(!cart.length)return;shippingQuote=null;
    $('#drawerWrap').hidden=true;$('#checkoutContent').hidden=false;$('#checkoutSuccess').hidden=true;
    $('#shippingOptions').innerHTML='';$('#salesCheckoutError').textContent='';form.querySelector('[type=submit]').disabled=true;
    $('#checkoutSummary').innerHTML=cart.map(it=>`<div class="summary-row"><span>${esc(it.name)}<small>${esc(it.detail)} · Qty ${it.qty}</small></span><strong>${money(it.price*it.qty)}</strong></div>`).join('')+`<div class="summary-row"><span>Subtotal</span><strong>${money(cart.reduce((n,it)=>n+it.price*it.qty,0))}</strong></div>`;
    $('#checkoutModal').hidden=false;document.body.style.overflow='hidden';focusOverlay($('#checkoutModal'));
  };
  $('#backToCart').onclick=()=>{$('#checkoutModal').hidden=true;openCart();};
  form.addEventListener('input',e=>{if(['zip','state',...(sales.addressTax?['name','email','phone','line1','line2','city']:[])].includes(e.target.name)){shippingQuote=null;$('#shippingOptions').innerHTML='';form.querySelector('[type=submit]').disabled=true;}});
  function selectedShipping(){return shippingQuote?.choices.find(c=>c.id===form.querySelector('[name=shipping]:checked')?.value);}
  function showQuote(){
    const choice=selectedShipping();if(!choice)return;
    $('#checkoutSummary').innerHTML=`<div class="summary-row"><span>Subtotal</span><strong>${money(shippingQuote.subtotalCents/100)}</strong></div><div class="summary-row"><span>Shipping</span><strong>${money(choice.cents/100)}</strong></div><div class="summary-row"><span>Tax</span><strong>${money(choice.taxCents/100)}</strong></div><div class="summary-row summary-total"><span>Total (USD)</span><strong>${money(choice.totalCents/100)}</strong></div>`;
  }
  $('#getShipping').onclick=async()=>{
    if(!form.elements.zip.reportValidity()||!form.elements.state.reportValidity())return;
    if(sales.addressTax&&!['name','email','phone','line1','city'].every(k=>form.elements[k].reportValidity()))return;
    $('#getShipping').disabled=true;$('#salesCheckoutError').textContent='';shippingQuote=null;form.querySelector('[type=submit]').disabled=true;
    try{
      shippingQuote=await Store.request('/api/checkout/quote','POST',{address:Object.fromEntries(['name','email','phone','line1','line2','city'].map(k=>[k,form.elements[k].value.trim()])),destination:{zip:form.elements.zip.value.trim(),state:form.elements.state.value},items:cart.map(({productId,size,qty})=>({productId,size,qty}))});
      $('#shippingOptions').innerHTML=shippingQuote.choices.map((c,i)=>`<label class="shipping-option"><input type="radio" name="shipping" value="${esc(c.id)}" ${i===0?'checked':''}><span><strong>${esc(c.name)}</strong>${c.transit?`<small>Supplier transit estimate: ${esc(c.transit)} days, plus up to ${shippingQuote.processingDays} days processing</small>`:''}</span><strong>${money(c.cents/100)}</strong></label>`).join('');
      form.querySelector('[type=submit]').disabled=false;showQuote();
    }catch(error){$('#salesCheckoutError').textContent=error.message;}finally{$('#getShipping').disabled=false;}
  };
  form.addEventListener('change',e=>{if(e.target.name==='shipping')showQuote();});
  form.addEventListener('submit',async e=>{
    e.preventDefault();e.stopImmediatePropagation();if(!form.reportValidity())return;
    const choice=selectedShipping();if(!choice){$('#salesCheckoutError').textContent='Get a shipping quote before continuing.';return;}
    const button=form.querySelector('[type=submit]');button.disabled=true;$('#salesCheckoutError').textContent='';
    try{
      const address=Object.fromEntries(['name','email','phone','line1','line2','city'].map(k=>[k,form.elements[k].value.trim()]));
      const result=await Store.request('/api/checkout','POST',{quoteId:shippingQuote.id,shippingId:choice.id,address,consent:true});
      sessionStorage.setItem('vegarance_pending_order',result.token);sessionStorage.setItem('vegarance_paid_cart',JSON.stringify(cart));
      location.assign(result.url);
    }catch(error){$('#salesCheckoutError').textContent=error.message;button.disabled=false;}
  },true);
}
