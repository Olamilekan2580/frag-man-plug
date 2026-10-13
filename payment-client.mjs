import {timingSafeEqual} from 'node:crypto';

// Flutterwave Standard v3 keeps card data on the provider's hosted checkout.
export function createPayments({secret=process.env.FLW_SECRET_KEY||'',webhookSecret=process.env.FLW_SECRET_HASH||'',mode=process.env.FLW_MODE||'test',fetcher=fetch}={}) {
  const live=mode==='live'&&!secret.includes('TEST');
  const configured=!!secret&&!!webhookSecret&&['test','live'].includes(mode)&&(mode!=='live'||!secret.includes('TEST'))&&(mode!=='test'||secret.includes('TEST'));
  const request=async(path,value)=>{
    if(!configured)throw Object.assign(new Error('Flutterwave keys and payment mode are not configured'),{status:503});
    const response=await fetcher('https://api.flutterwave.com/v3/'+path,{
      method:value?'POST':'GET',signal:AbortSignal.timeout(20000),
      headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:value?JSON.stringify(value):undefined
    });
    const result=await response.json();
    if(!response.ok||result.status!=='success')throw Object.assign(new Error('Payment provider request failed. Check your Flutterwave dashboard and USD approval.'),{status:502});
    return result.data;
  };
  return {
    configured,live,provider:'Flutterwave',
    async checkout(order,site){
      const result=await request('payments',{amount:(order.totalCents/100).toFixed(2),currency:'USD',tx_ref:order.id,
        redirect_url:site+'/order.html?token='+order.token,payment_options:'card',
        customer:{email:order.email,name:order.address.name,phonenumber:order.address.phone},
        customizations:{title:'VEGArance',description:'Order '+order.id},
        configurations:{session_duration:30},meta:{orderId:order.id}});
      if(!/^https:\/\/checkout\.flutterwave\.com\//.test(result.link||''))throw Object.assign(new Error('Payment provider returned an invalid checkout'),{status:502});
      return {id:order.id,url:result.link};
    },
    verifyTransaction:reference=>request('transactions/verify_by_reference?'+new URLSearchParams({tx_ref:reference})),
    refund:order=>request('transactions/'+encodeURIComponent(order.transactionId)+'/refund',{amount:order.totalCents/100,comments:'VEGArance full refund '+order.id}),
    refundStatus:id=>request('refunds/'+encodeURIComponent(id)),
    verify(raw,header){
      if(!webhookSecret)throw Object.assign(new Error('Webhook is not configured'),{status:503});
      const expected=Buffer.from(webhookSecret),received=Buffer.from(String(header||''));
      if(expected.length!==received.length||!timingSafeEqual(expected,received))throw Object.assign(new Error('Invalid payment webhook secret'),{status:400});
      try{return JSON.parse(raw.toString());}catch{throw Object.assign(new Error('Invalid payment event'),{status:400});}
    }
  };
}

export function createEmail({key=process.env.RESEND_API_KEY||'',from=process.env.EMAIL_FROM||'',fetcher=fetch}={}) {
  return {configured:!!key&&!!from,async send(order,kind,site){
    if(!key||!from) throw new Error('Email is not configured');
    const tracking=kind==='shipping'?'Your order has shipped. Tracking: '+order.tracking.number+'\n':'';
    const text=kind==='refund'?`Your refund for ${order.id} has been issued. Your bank determines when it appears.`:
      `${tracking}${kind==='receipt'?'Payment received for':'Order update for'} ${order.id}.\n\n${order.lines.map(l=>`${l.name} (${l.option}) ×${l.qty}`).join('\n')}\n\nTotal: $${(order.totalCents/100).toFixed(2)}\nView your order: ${site}/order.html?token=${order.token}`;
    const response=await fetcher('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':order.id+'-'+kind},body:JSON.stringify({from,to:[order.email],subject:kind==='receipt'?`VEGArance — order ${order.id} confirmed`:kind==='refund'?`VEGArance — refund for ${order.id}`:`VEGArance — order ${order.id} shipped`,text})});
    if(!response.ok) throw new Error('Email delivery failed');
    const result=await response.json();if(!result.id)throw new Error('Email provider returned no message ID');return result.id;
  }};
}
