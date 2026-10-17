import {randomBytes,createHash} from 'node:crypto';
import {createTax} from './tax-client.mjs';
import {createPayments,createEmail} from './payment-client.mjs';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const US_STATES=new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '));
const cents=n=>Math.round(n*100);
export function createCommerce({db,cj,env=process.env,payments=createPayments(),email=createEmail(),tax=createTax(),now=Date.now,onOrderEvent=null}){
  db.exec(`CREATE TABLE IF NOT EXISTS sales_config(id INTEGER PRIMARY KEY CHECK(id=1),document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS checkout_quotes(id TEXT PRIMARY KEY,document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sales_orders(id TEXT PRIMARY KEY,token TEXT UNIQUE NOT NULL,document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS email_jobs(id TEXT PRIMARY KEY,document TEXT NOT NULL);`);
  const defaults={enabled:false,businessName:'',supportEmail:'',shippingPolicy:'',returnPolicy:'',privacyPolicy:'',terms:'',taxReviewed:false,taxRates:{},processingDays:0};
  const config=()=>({...defaults,...JSON.parse(db.prepare('SELECT document FROM sales_config WHERE id=1').get()?.document||'{}')});
  const save=o=>db.prepare('INSERT INTO sales_orders VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document').run(o.id,o.token,JSON.stringify(o));
  // Outbound webhook payload: the store's own order summary. No tokens,
  // no session data, no keys. Email/address included — fulfilment
  // automations need them; treat webhook payloads as confidential.
  // Emission never breaks checkout: enqueue-only, errors swallowed.
  const eventOrder=o=>({id:o.id,status:o.status,paymentStatus:o.paymentStatus,paymentMode:o.paymentMode,
    lines:o.lines.map(({name,option,qty,unitCents})=>({name,option,qty,unitCents})),
    subtotalCents:o.subtotalCents,shippingCents:o.shippingCents,taxCents:o.taxCents,totalCents:o.totalCents,
    shippingMethod:o.shippingMethod,tracking:o.tracking||null,email:o.email,address:o.address,createdAt:o.createdAt,paidAt:o.paidAt||null});
  const emit=(type,o)=>{try{onOrderEvent?.(type,eventOrder(o));}catch{}};
  const get=id=>{const row=db.prepare('SELECT document FROM sales_orders WHERE id=?').get(id);if(!row)throw fail(404,'Order not found');return JSON.parse(row.document);};
  const orders=()=>db.prepare('SELECT document FROM sales_orders ORDER BY rowid DESC').all().map(r=>JSON.parse(r.document));
  let site='';try{const u=new URL(env.SITE_URL);if(u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/')site=u.origin;}catch{}
  const readiness=()=>{
    const cfg=config();
    const checks=[
      {name:'Flutterwave secret key',ready:payments.configured},
      {name:'Approved Flutterwave international USD payments',ready:env.FLW_USD_APPROVED==='true'},
      {name:'CJ API key',ready:cj.configured},
      {name:'Order email sender',ready:email.configured},
      {name:'HTTPS store URL',ready:!!site},
      {name:'Persistent storage configured',ready:env.DURABLE_STORAGE_CONFIRMED==='true'&&!!env.DATA_DIR},
      {name:'Business name and support email',ready:!!cfg.businessName&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.supportEmail)},
      {name:'Shipping, returns, privacy and terms',ready:['shippingPolicy','returnPolicy','privacyPolicy','terms'].every(k=>cfg[k].trim().length>=40)},
      {name:'US tax treatment reviewed',ready:cfg.taxReviewed&&(!tax.requested||(tax.configured&&(!payments.live||!tax.sandbox)))},
    ];
    return {checks,ready:checks.every(c=>c.ready),enabled:cfg.enabled,paymentMode:payments.live?'live':'test',provider:'Flutterwave'};
  };
  const publicConfig=()=>{const cfg=config(),r=readiness();return {salesEnabled:cfg.enabled&&r.ready,configured:cfg.enabled,provider:'Flutterwave',paymentMode:r.paymentMode,businessName:cfg.businessName,supportEmail:cfg.supportEmail,shippingPolicy:cfg.shippingPolicy,returnPolicy:cfg.returnPolicy,privacyPolicy:cfg.privacyPolicy,terms:cfg.terms,processingDays:cfg.processingDays,addressTax:tax.requested};};
  function configure(input){
    const cfg={};
    if(typeof input.enabled!=='boolean'||typeof input.taxReviewed!=='boolean'||!Number.isInteger(input.processingDays)||input.processingDays<0||input.processingDays>30)throw fail(422,'Invalid sales settings');
    for(const [key,max] of Object.entries({businessName:100,supportEmail:100,shippingPolicy:12000,returnPolicy:12000,privacyPolicy:12000,terms:12000})){
      if(typeof input[key]!=='string'||input[key].length>max)throw fail(422,'Invalid '+key);cfg[key]=input[key].trim();
    }
    if(cfg.supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.supportEmail))throw fail(422,'Enter a valid support email');
    if(!input.taxRates||Array.isArray(input.taxRates)||typeof input.taxRates!=='object')throw fail(422,'Tax rates must be a state-to-percentage object');
    cfg.taxRates={};for(const [state,rate] of Object.entries(input.taxRates)){if(!US_STATES.has(state)||!Number.isFinite(rate)||rate<0||rate>20)throw fail(422,'Invalid state tax rate');cfg.taxRates[state]=rate;}
    Object.assign(cfg,{enabled:input.enabled,taxReviewed:input.taxReviewed,processingDays:input.processingDays});
    // Saving a draft is always possible. Opening sales requires every connection.
    if(cfg.enabled){const old=config();db.prepare('INSERT INTO sales_config VALUES(1,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document').run(JSON.stringify({...cfg,enabled:false}));
      if(!readiness().ready){db.prepare('UPDATE sales_config SET document=? WHERE id=1').run(JSON.stringify(old));throw fail(422,'Complete the connection checks before opening sales');}}
    db.prepare('INSERT INTO sales_config VALUES(1,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document').run(JSON.stringify(cfg));return {config:cfg,...readiness()};
  }
  function requireSales(){if(!publicConfig().salesEnabled)throw fail(503,'Sales are not open yet. Please check back soon.');}
  function validateDestination(input){
    if(!input||!US_STATES.has(input.state)||!/^\d{5}(?:-\d{4})?$/.test(input.zip||''))throw fail(422,'Choose a US state and valid ZIP code');
    return {state:input.state,zip:input.zip};
  }
  function currentLines(items){
    if(!Array.isArray(items)||!items.length||items.length>20)throw fail(422,'Choose 1–20 products');
    const merged=new Map();
    for(const item of items){
      if(!item||typeof item.productId!=='string'||typeof item.size!=='string'||!Number.isInteger(item.qty)||item.qty<1||item.qty>99)throw fail(422,'Invalid cart item');
      const p=JSON.parse(db.prepare('SELECT document FROM products WHERE id=?').get(item.productId)?.document||'null');
      const variant=p?.variants?.find(v=>v.id===item.size);
      if(!p?.saleReady||!p.inStock||p.supplier?.provider!=='cj'||!variant?.inStock||p.supplierSync?.status!=='synced'||!(p.supplierSync.staleAfter>now()))throw fail(422,'An item is unavailable for purchase. Refresh your bag.');
      const unitCents=cents(p.prices[item.size]);if(!Number.isSafeInteger(unitCents)||unitCents<=0)throw fail(422,'Product price is unavailable');
      const key=p.id+':'+item.size,previous=merged.get(key);
      if(previous){previous.qty+=item.qty;if(previous.qty>99)throw fail(422,'Maximum quantity is 99 per option');}
      else merged.set(key,{productId:p.id,vid:variant.id,name:p.name,option:variant.label,qty:item.qty,unitCents,...(p.taxCode?{taxCode:p.taxCode}:{})});
    }
    return [...merged.values()];
  }
  async function stock(lines){const combined=new Map();for(const line of lines){const prior=combined.get(line.vid)||{...line,qty:0};prior.qty+=line.qty;prior.unitCents=Math.min(prior.unitCents,line.unitCents);combined.set(line.vid,prior);}for(const line of combined.values()){const data=await cj.variant(line.vid);if(data.quantity<line.qty||cents(data.cost)>=line.unitCents)throw fail(422,'An option is unavailable or its price needs updating');}}
  async function quote(input){
    requireSales();const destination=validateDestination(input.destination),lines=currentLines(input.items);await stock(lines);
    const rates=await cj.freight(lines.map(l=>({vid:l.vid,quantity:l.qty})),destination.zip);
    if(!rates.length)throw fail(422,'No shipping service is available for this destination');
    const cfg=config(),subtotalCents=lines.reduce((n,l)=>n+l.unitCents*l.qty,0),id=randomBytes(24).toString('hex');
    const quotedAddress=tax.requested?address(input.address,destination):null;
    const choices=[];for(const [i,r] of rates.slice(0,5).entries()){const taxCents=tax.requested?await tax.calculate(lines,quotedAddress,r.cents):Math.round((subtotalCents+r.cents)*(cfg.taxRates[destination.state]||0)/100);choices.push({...r,id:String(i),taxCents,totalCents:subtotalCents+r.cents+taxCents});}
    db.prepare('INSERT INTO checkout_quotes VALUES(?,?)').run(id,JSON.stringify({id,lines,destination,quotedAddress,subtotalCents,choices,taxMode:tax.requested?'address':'manual',expiresAt:now()+15*60000}));
    db.prepare("DELETE FROM checkout_quotes WHERE json_extract(document,'$.expiresAt') < ?").run(now()-86400000);
    return {id,subtotalCents,choices,expiresAt:now()+15*60000,processingDays:cfg.processingDays};
  }
  function address(input,destination){
    if(!input)throw fail(422,'Enter your delivery details');const result={...destination,country:'US'};
    for(const [key,max] of Object.entries({name:50,line1:200,line2:200,city:50,phone:20,email:100})){
      if(typeof input[key]!=='string'||input[key].length>max||(key!=='line2'&&!input[key].trim()))throw fail(422,'Enter a valid '+key);result[key]=input[key].trim();
    }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)||!/^\+?[0-9 ()-]{7,20}$/.test(result.phone))throw fail(422,'Enter a valid email and phone number');
    return result;
  }
  const checkoutPending=new Map();
  async function checkout(input){
    requireSales();if(input.consent!==true)throw fail(422,'Accept the terms and return policy before payment');
    const q=JSON.parse(db.prepare('SELECT document FROM checkout_quotes WHERE id=?').get(String(input.quoteId))?.document||'null');
    if(!q||q.expiresAt<now())throw fail(422,'Shipping quote expired. Request a new quote.');
    const choice=q.choices.find(c=>c.id===input.shippingId);if(!choice)throw fail(422,'Choose a shipping service');
    const delivery=address(input.address,q.destination);
    if(q.taxMode!== (tax.requested?'address':'manual')||(q.quotedAddress&&JSON.stringify(q.quotedAddress)!==JSON.stringify(delivery)))throw fail(422,'Delivery or tax setup changed. Request a new quote.');
    if(!tax.requested&&choice.taxCents!==Math.round((q.subtotalCents+choice.cents)*(config().taxRates[q.destination.state]||0)/100))throw fail(422,'Tax settings changed. Request a new quote.');
    const existing=orders().find(o=>o.quoteId===q.id);
    if(existing){if(existing.shippingMethod!==choice.name||JSON.stringify(existing.address)!==JSON.stringify(delivery))throw fail(409,'This quote was already used. Request a new quote to change details.');if(existing.checkoutUrl)return {url:existing.checkoutUrl,token:existing.token};throw fail(409,'Checkout is already being prepared. Please check your order or request a new quote.');}
    if(checkoutPending.has(q.id))return checkoutPending.get(q.id);
    const checkoutConfig=JSON.stringify(config());
    const task=(async()=>{
      const lines=currentLines(q.lines.map(l=>({productId:l.productId,size:l.vid,qty:l.qty})));
      if(JSON.stringify(lines)!==JSON.stringify(q.lines))throw fail(422,'Your bag changed. Request a new shipping quote.');await stock(lines);
      requireSales();if(checkoutConfig!==JSON.stringify(config())||JSON.stringify(currentLines(q.lines.map(l=>({productId:l.productId,size:l.vid,qty:l.qty}))))!==JSON.stringify(lines))throw fail(422,'Store settings or your bag changed. Request a new quote.');
      const o={id:'VEGA-'+randomBytes(12).toString('hex'),token:randomBytes(32).toString('hex'),quoteId:q.id,lines,destination:q.destination,address:delivery,email:delivery.email,
        subtotalCents:q.subtotalCents,shippingCents:choice.cents,taxCents:choice.taxCents,totalCents:choice.totalCents,shippingMethod:choice.name,
        consent:{acceptedAt:now(),terms:config().terms,returnPolicy:config().returnPolicy,version:createHash('sha256').update(config().terms+'\n'+config().returnPolicy).digest('hex')},createdAt:now(),status:'Awaiting payment',paymentStatus:'unpaid',fulfillment:{state:'not_started'},paymentMode:payments.live?'live':'test'};
      save(o);
      try{const session=await payments.checkout(o,site);o.checkoutId=session.id;o.checkoutUrl=session.url;save(o);emit('order.created',o);return {url:session.url,token:o.token};}
      catch(e){o.status='Checkout needs attention';save(o);throw e;}
    })().finally(()=>checkoutPending.delete(q.id));checkoutPending.set(q.id,task);return task;
  }
  function queueEmail(o,kind){const id=o.id+'-'+kind;db.prepare('INSERT OR IGNORE INTO email_jobs VALUES(?,?)').run(id,JSON.stringify({id,orderId:o.id,kind,state:'queued',attempts:0,nextAt:now(),order:o}));}
  const verificationPending=new Map();
  async function verifyPayment(id){
    if(verificationPending.has(id))return verificationPending.get(id);
    const task=(async()=>{
      const o=get(id);if(o.paymentStatus!=='unpaid')return o;
      const data=await payments.verifyTransaction(o.id);
      if(data.status!=='successful')return o;
      if(!Number.isSafeInteger(data.id)||data.id<=0)throw fail(502,'Payment provider returned an invalid transaction');
      if(data.tx_ref!==o.id||data.currency!=='USD'||!Number.isFinite(Number(data.amount))||cents(Number(data.amount))!==o.totalCents||data.customer?.email?.toLowerCase()!==o.email.toLowerCase()){
        o.paymentStatus='review';o.status='Payment needs review';save(o);return o;
      }
      // Durable payment state is saved before any notification or fulfillment.
      o.paymentStatus='paid';o.paidAt=now();o.transactionId=data.id;o.status='Paid';save(o);queueEmail(o,'receipt');emit('order.paid',o);return o;
    })().finally(()=>verificationPending.delete(id));verificationPending.set(id,task);return task;
  }
  async function webhook(raw,header){
    const event=payments.verify(raw,header);
    if(event.event==='charge.completed'&&typeof event.data?.tx_ref==='string'){
      if(db.prepare('SELECT id FROM sales_orders WHERE id=?').get(event.data.tx_ref))await verifyPayment(event.data.tx_ref);
    }
    // Refunds are reconciled with the provider API by the worker, never trusted from a redirect.
    return {received:true};
  }
  function publicOrder(o){return {id:o.id,status:o.status,paymentStatus:o.paymentStatus,paymentMode:o.paymentMode,lines:o.lines.map(({name,option,qty,unitCents})=>({name,option,qty,unitCents})),subtotalCents:o.subtotalCents,shippingCents:o.shippingCents,taxCents:o.taxCents,totalCents:o.totalCents,shippingMethod:o.shippingMethod,tracking:o.tracking||null,createdAt:o.createdAt};}
  async function lookup(token,verify=false){
    if(!/^[a-f0-9]{64}$/.test(token||''))throw fail(404,'Order not found');
    const row=db.prepare('SELECT document FROM sales_orders WHERE token=?').get(token);if(!row)throw fail(404,'Order not found');let o=JSON.parse(row.document);
    if(verify&&o.paymentStatus==='unpaid'&&o.checkoutId){try{o=await verifyPayment(o.id);}catch{}}
    return publicOrder(o);
  }
  const operations=new Set();
  async function action(id,kind,input={}){
    if(operations.has(id))throw fail(409,'Order operation is already running');operations.add(id);
    try{
      let o=get(id);
      if(kind==='tracking'){await tracking(o);return get(id);}
      if(kind==='reconcile'){
        if(o.paymentStatus!=='paid'||o.paymentMode!=='live'||!['needs_review','funding_needs_review'].includes(o.fulfillment.state))throw fail(422,'Only an uncertain paid supplier order can be reconciled');
        if(typeof input.orderId!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(input.orderId))throw fail(422,'Enter the existing CJ order ID');
        const details=await cj.order(input.orderId);
        if(details.platformOrderId!==o.id||!Array.isArray(details.productList))throw fail(422,'CJ order does not match this store order');
        const expected=new Map(),actual=new Map();for(const line of o.lines)expected.set(line.vid,(expected.get(line.vid)||0)+line.qty);for(const line of details.productList)actual.set(line.vid,(actual.get(line.vid)||0)+Number(line.quantity));
        if(expected.size!==actual.size||[...expected].some(([vid,qty])=>actual.get(vid)!==qty))throw fail(422,'CJ order products do not match this order');
        o=get(id);o.fulfillment={...o.fulfillment,orderId:input.orderId,state:details.paymentDate?'processing':'awaiting_supplier_payment',...(details.shipmentOrderId?{shipmentOrderId:details.shipmentOrderId}:{}),reconciledAt:now()};
        o.status=details.paymentDate?'Processing':'Awaiting supplier payment';save(o);await tracking(o);return get(id);
      }
      if(o.paymentStatus!=='paid')throw fail(422,'Only verified paid orders can be fulfilled or refunded');
      if(kind==='dispatch'){
        if(o.paymentMode!=='live')throw fail(422,'Test payments cannot create real supplier orders');
        if(o.fulfillment.state!=='not_started')throw fail(409,'Supplier order already submitted or needs review');
        const fresh=await cj.freight(o.lines.map(l=>({vid:l.vid,quantity:l.qty})),o.destination.zip);
        const rate=fresh.find(r=>r.name===o.shippingMethod);if(!rate||rate.cents>o.shippingCents)throw fail(422,'Supplier shipping changed. Review the order before fulfillment');
        await stock(o.lines);o=get(id);if(o.paymentStatus!=='paid')throw fail(409,'Payment state changed');
        o.fulfillment={state:'creating',startedAt:now()};save(o);
        try{
          const a=o.address,result=await cj.createOrder({orderNumber:o.id,shippingZip:a.zip,shippingProvince:a.state,shippingCity:a.city,shippingAddress:a.line1,shippingAddress2:a.line2,shippingCustomerName:a.name,shippingPhone:a.phone,email:a.email,logisticName:o.shippingMethod,shopAmount:o.totalCents/100,products:o.lines.map(l=>({vid:l.vid,quantity:l.qty,storeLineItemId:l.productId+':'+l.vid}))});
          if(!result?.orderId||!result.shipmentOrderId)throw new Error('Supplier response needs review');
          o=get(id);o.fulfillment={state:'awaiting_supplier_payment',orderId:result.orderId,shipmentOrderId:result.shipmentOrderId,amount:result.orderAmount,createdAt:now()};o.status='Awaiting supplier payment';save(o);
        }catch(e){o=get(id);o.fulfillment.state='needs_review';o.status='Supplier submission needs review';save(o);throw fail(502,'Supplier submission is uncertain. Check CJ for this order number before taking any further action.');}
      }else if(kind==='fund'){
        if(o.paymentMode!=='live'||o.fulfillment.state!=='awaiting_supplier_payment'||!o.fulfillment.shipmentOrderId)throw fail(422,'This supplier order is not ready for funding');
        const bill=await cj.order(o.fulfillment.orderId),amount=Number(bill.orderAmount);
        if(bill.platformOrderId!==o.id||!Number.isFinite(amount)||amount<=0||amount!==Number(o.fulfillment.amount)||cents(amount)>o.totalCents)throw fail(422,'Supplier invoice changed or cannot be verified. Review the amount in CJ before funding.');
        o=get(id);if(o.paymentStatus!=='paid'||o.fulfillment.state!=='awaiting_supplier_payment')throw fail(409,'Order state changed');
        o.fulfillment.state='funding';save(o);
        try{await cj.payOrder(o.fulfillment.shipmentOrderId);o=get(id);o.fulfillment.state='processing';o.status='Processing';save(o);}
        catch{ o=get(id);o.fulfillment.state='funding_needs_review';o.status='Supplier funding needs review';save(o);throw fail(502,'Supplier payment is uncertain. Check your CJ balance and order before retrying.');}
      }else if(kind==='refund'){
        if(o.refund||o.fulfillment.state!=='not_started')throw fail(422,'Refund requires an unsubmitted order. For supplier orders, resolve cancellation in CJ first and refund in Flutterwave.');
        o.refund={state:'requesting',requestedAt:now()};o.status='Refund requested';save(o);
        try{const result=await payments.refund(o);if(!result?.id)throw new Error('Missing refund ID');o=get(id);o.refund={...o.refund,id:result.id,state:'pending'};o.paymentStatus='refund_pending';save(o);}
        catch{o=get(id);o.refund.state='needs_review';o.status='Refund needs review';save(o);throw fail(502,'Refund result is uncertain. Check Flutterwave before issuing another refund.');}
      }else throw fail(404,'Unknown order operation');
      return get(id);
    }finally{operations.delete(id);}
  }
  async function tracking(o){
    if(!o.fulfillment.orderId)return;
    const details=await cj.order(o.fulfillment.orderId);o=get(o.id);
    if(o.paymentStatus!=='paid')return;
    const before=o.status;
    if(details.trackNumber){o.tracking={number:String(details.trackNumber).slice(0,200),carrier:String(details.trackingProvider||details.logisticName||'').slice(0,100),url:/^https:\/\//.test(details.trackingUrl||'')?details.trackingUrl:''};
      if(o.status!=='Delivered')o.status='Shipped';queueEmail(o,'shipping');}
    if(details.orderStatus==='DELIVERED')o.status='Delivered';
    o.lastTrackingAt=now();save(o);
    if(o.status!==before)emit(o.status==='Delivered'?'order.delivered':'order.shipped',o);
  }
  // Ambiguous supplier writes are never automatically repeated after a crash.
  for(const o of orders())if(['creating','funding'].includes(o.fulfillment.state)){o.fulfillment.state='needs_review';o.status='Supplier operation interrupted — review required';save(o);}
  let busy=false,timer;
  async function tick(){
    if(busy)return;busy=true;
    try{
      for(const o of orders()){
        if(o.paymentStatus==='unpaid'&&o.checkoutId&&now()-o.createdAt<48*3600000&&now()-(o.lastPaymentCheck||0)>60000){try{await verifyPayment(o.id);}catch{}const current=get(o.id);current.lastPaymentCheck=now();save(current);}
        if(['paid','refund_pending','refunded'].includes(o.paymentStatus))queueEmail(o,'receipt');
        if(o.paymentStatus==='refunded')queueEmail(o,'refund');
        if(o.refund?.id&&o.refund.state==='pending'){
          try{const r=await payments.refundStatus(o.refund.id);const current=get(o.id);if(['completed-mpgs','completed-preauth','completed-bank-transfer','completed-momo','completed-offline'].includes(r.status)&&cents(Number(r.amount_refunded))===o.totalCents&&String(r.tx_id)===String(o.transactionId)){
            current.refund.state='processed';current.paymentStatus='refunded';current.status='Refunded';save(current);queueEmail(current,'refund');emit('order.refunded',current);
          }else if(['failed','needs-attention'].includes(r.status)){current.refund.state='needs_review';current.status='Refund needs review';save(current);}}catch{}
        }
        if(o.paymentStatus==='paid'&&o.fulfillment.orderId&&o.status!=='Delivered'&&now()-(o.lastTrackingAt||0)>10*60000&&!operations.has(o.id))try{await tracking(o);}catch{}
      }
      for(const row of db.prepare('SELECT document FROM email_jobs').all()){
        const job=JSON.parse(row.document);if(job.state!=='queued'||job.nextAt>now()||!email.configured)continue;
        job.attempts++;
        try{job.messageId=await email.send(job.order||get(job.orderId),job.kind,site);job.state='sent';}
        catch{job.nextAt=now()+Math.min(3600000,job.attempts*60000);if(job.attempts>=10)job.state='needs_review';}
        db.prepare('UPDATE email_jobs SET document=? WHERE id=?').run(JSON.stringify(job),job.id);
      }
    }finally{busy=false;}
  }
  function retryEmail(id){
    const row=db.prepare('SELECT document FROM email_jobs WHERE id=?').get(id);if(!row)throw fail(404,'Email job not found');const job=JSON.parse(row.document);
    if(job.state!=='needs_review')throw fail(409,'Only failed email jobs can be retried');job.state='queued';job.attempts=0;job.nextAt=now();db.prepare('UPDATE email_jobs SET document=? WHERE id=?').run(JSON.stringify(job),id);return {queued:true};
  }
  function dashboard(){const list=orders().filter(o=>o.paymentMode===(payments.live?'live':'test')),paid=list.filter(o=>['paid','refund_pending'].includes(o.paymentStatus));return {config:config(),...readiness(),stats:{orders:paid.length,revenueCents:paid.reduce((n,o)=>n+o.totalCents,0),refunds:list.filter(o=>o.paymentStatus==='refunded').length,needAttention:list.filter(o=>o.status.includes('review')||o.status==='Paid'||o.status==='Awaiting supplier payment').length},emailJobs:db.prepare('SELECT document FROM email_jobs ORDER BY rowid DESC LIMIT 20').all().map(r=>{const {order,...job}=JSON.parse(r.document);return job;})};}
  return {config,configure,publicConfig,readiness,quote,checkout,webhook,lookup,orders,get,action,tick,dashboard,retryEmail,start(){timer=setInterval(()=>tick().catch(()=>{}),30000);timer.unref();},stop(){clearInterval(timer);}};
}
