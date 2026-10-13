const orderToken=new URLSearchParams(location.search).get('token');
const orderEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const orderMoney=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
async function refreshOrder(){
  const button=document.getElementById('refreshOrder');button.disabled=true;
  try{
    const response=await fetch('/api/order-status/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:orderToken})});const o=await response.json();if(!response.ok)throw new Error(o.error||'Unable to load your order');
    const paid=['paid','refund_pending','refunded'].includes(o.paymentStatus);
    let cartMessage='';
    if(paid&&sessionStorage.getItem('vegarance_pending_order')===orderToken){
      // Preserve additions made in another tab while payment was in progress.
      const current=localStorage.getItem('vegarance_cart'),submitted=sessionStorage.getItem('vegarance_paid_cart');
      if(current===submitted)localStorage.setItem('vegarance_cart','[]');
      sessionStorage.removeItem('vegarance_pending_order');sessionStorage.removeItem('vegarance_paid_cart');
    }
    document.getElementById('orderResult').innerHTML=`<section class="commerce-box"><p class="eyebrow">${orderEscape(o.id)}</p><h2>${paid?'Thank you for your order.':'Your payment is being checked.'}</h2><span class="order-status">${orderEscape(o.status)}</span>${o.paymentMode==='test'?'<p>This is a test order. No supplier purchase or shipment will be created.</p>':''}<p>${o.paymentStatus==='unpaid'?'A return from checkout does not confirm payment. Refresh this page shortly, or contact us if you completed payment.':o.paymentStatus==='review'?'Your payment needs a review. Contact support with your order reference.':'You can return here for delivery updates.'}</p>${o.lines.map(l=>`<div class="order-line"><span>${orderEscape(l.name)}<small>${orderEscape(l.option)} · Qty ${l.qty}</small></span><strong>${orderMoney(l.unitCents*l.qty)}</strong></div>`).join('')}<div class="order-line"><span>Shipping · ${orderEscape(o.shippingMethod)}</span><strong>${orderMoney(o.shippingCents)}</strong></div><div class="order-line"><span>Tax</span><strong>${orderMoney(o.taxCents)}</strong></div><div class="order-line"><strong>Total (USD)</strong><strong>${orderMoney(o.totalCents)}</strong></div>${o.tracking?`<p>Tracking: <strong>${orderEscape(o.tracking.number)}</strong> · ${orderEscape(o.tracking.carrier)}</p>${/^https:\/\//.test(o.tracking.url||'')?`<a class="btn btn-ghost" href="${orderEscape(o.tracking.url)}" target="_blank" rel="noopener noreferrer">Track delivery ↗</a>`:''}`:''}</section>`;
  }catch(error){document.getElementById('orderResult').textContent=error.message;}finally{button.disabled=false;}
}
document.getElementById('refreshOrder').onclick=refreshOrder;refreshOrder();
fetch('/api/store-config').then(r=>r.json()).then(cfg=>{if(cfg.supportEmail){const a=document.createElement('a');a.href='mailto:'+cfg.supportEmail;a.textContent='Contact us: '+cfg.supportEmail;document.getElementById('orderSupport').append(a);}}).catch(()=>{});
