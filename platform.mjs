import {createMerchantCommerce} from './merchant-commerce.mjs';
import {createMerchantInventory} from './merchant-inventory.mjs';
import {createMerchantConnections} from './merchant-connections.mjs';
import {createMerchantBilling} from './merchant-billing.mjs';
import {createMerchantCoupons} from './merchant-coupons.mjs';
import {createMerchantAbandoned} from './merchant-abandoned.mjs';
import {createMerchantFulfillment} from './merchant-fulfillment-approval.mjs';
import {rankProducts} from './trend-scoring.mjs';
import {createAI} from './ai-client.mjs';
import {deriveOnboarding} from './onboarding.mjs';
import {randomBytes, scrypt, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt), fail=(status,message)=>Object.assign(new Error(message),{status});
const hash=s=>createHash('sha256').update(s).digest('hex');
const id=()=>randomBytes(16).toString('hex');
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw fail(422,'Invalid or missing text');return value.trim();};
/* Platform-level mailer for merchant account emails (verification + password
   recovery). Uses Resend via PLATFORM_RESEND_API_KEY / PLATFORM_RESEND_FROM.
   When not configured, the account flows honestly report 503 — verification
   and recovery cannot work until the platform owner configures email. */
export function createPlatformMailer({env=process.env,fetcher=fetch}={}){
 const key=env.PLATFORM_RESEND_API_KEY||'',from=env.PLATFORM_RESEND_FROM||'';
 const configured=!!key&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from);
 return {configured,async send({to,subject,text:bodyText}){if(!configured)throw fail(503,'Email sending is not configured on this platform. The platform owner must set PLATFORM_RESEND_API_KEY and PLATFORM_RESEND_FROM.');
  let response;try{response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,text:bodyText}),signal:AbortSignal.timeout(20000)});}catch{throw fail(502,'Email provider is temporarily unavailable. Try again later.');}
  if(!response.ok)throw fail(502,'Email provider rejected the message. Check the platform sender configuration.');return true;}};
}
export function createPlatform({db,body,send,sameOrigin,now=Date.now,env=process.env,connectionsFactory=createMerchantConnections,publicApi=null,onOrderEvent=null,mailerFactory=createPlatformMailer,aiFactory=createAI}){
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS merchants(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS merchant_sessions(token_hash TEXT PRIMARY KEY,merchant_id TEXT NOT NULL REFERENCES merchants(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS merchant_stores(id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL REFERENCES merchants(id),slug TEXT UNIQUE NOT NULL,document TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS merchant_products(id TEXT PRIMARY KEY,store_id TEXT NOT NULL REFERENCES merchant_stores(id),document TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS merchant_email_tokens(token_hash TEXT PRIMARY KEY,merchant_id TEXT NOT NULL REFERENCES merchants(id),purpose TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);`);
 try{db.exec('ALTER TABLE merchants ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');}catch{/* column already exists */}
 const mailer=mailerFactory({env});
 const connections=connectionsFactory({db,env,now});
 const inventory=createMerchantInventory({db,connections,now});
 const billing=createMerchantBilling({db,now});
 const coupons=createMerchantCoupons({db,now});
 const abandoned=createMerchantAbandoned({db,now});
 const fulfillment=createMerchantFulfillment({db,now});
 const ai=aiFactory({env});
 const commerce=createMerchantCommerce({db,connections,inventory,env,now,onOrderEvent,billing,coupons,abandoned,fulfillment});
 const publicRates=new Map();
 function checkoutLimit(req){const ip=req.socket.remoteAddress,old=publicRates.get(ip),entry=old&&old.until>now()?old:{count:0,until:now()+60000};entry.count++;publicRates.set(ip,entry);if(publicRates.size>10000)for(const [k,v] of publicRates)if(v.until<now())publicRates.delete(k);if(entry.count>30)throw fail(429,'Too many checkout requests. Please try again shortly.');}
 const rates=new Map();let hashes=0;
 function limit(req){const key=req.socket.remoteAddress,old=rates.get(key),entry=old&&old.until>now()?old:{count:0,until:now()+60000};rates.set(key,entry);if(++entry.count>10)throw fail(429,'Too many account attempts. Try again in a minute.');if(rates.size>10000)for(const [k,v] of rates)if(v.until<now())rates.delete(k);}
 async function passwordHash(password,salt){if(hashes>=4)throw fail(503,'Account service is busy. Please try again.');hashes++;try{return await derive(password,salt,64);}finally{hashes--;}}
 function credentials(input){const email=text(input.email,254,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof input.password!=='string'||input.password.length<12||input.password.length>200)throw fail(422,'Enter a valid email and a password of 12–200 characters');return {email,password:input.password};}
 function session(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('vegarance_merchant='))?.slice(19);if(!token||! /^[a-f0-9]{64}$/.test(token))throw fail(401,'Merchant login required');const row=db.prepare('SELECT m.id,m.name,m.email,m.email_verified FROM merchant_sessions s JOIN merchants m ON m.id=s.merchant_id WHERE s.token_hash=? AND s.expires>?').get(hash(token),now());if(!row)throw fail(401,'Merchant login required');return {id:row.id,name:row.name,email:row.email,emailVerified:row.email_verified===1};}
 function cookie(req,res,token,age){res.setHeader('Set-Cookie',`vegarance_merchant=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${req.headers['x-forwarded-proto']==='https'?'; Secure':''}`);}
 function login(req,res,merchant){const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM merchant_sessions WHERE expires<=?').run(now());db.prepare('INSERT INTO merchant_sessions VALUES(?,?,?)').run(hash(token),merchant.id,now()+7*86400000);cookie(req,res,token,604800);return {merchant:{id:merchant.id,name:merchant.name,email:merchant.email,emailVerified:merchant.emailVerified===true||merchant.email_verified===1}};}
 /* Email-verification + password-recovery tokens. Tokens are random, stored
    only as SHA-256 hashes, single-use, and short-lived. Tokens are NEVER
    returned in API responses — they only travel inside the emailed link. */
 function issueToken(merchantId,purpose,ttlMs){const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM merchant_email_tokens WHERE merchant_id=? AND purpose=?').run(merchantId,purpose);db.prepare('INSERT INTO merchant_email_tokens VALUES(?,?,?,?,0)').run(hash(token),merchantId,purpose,now()+ttlMs);return token;}
 function consumeToken(token,purpose){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw fail(400,'This link is invalid or has expired. Request a new one.');const row=db.prepare('SELECT merchant_id,expires,used FROM merchant_email_tokens WHERE token_hash=? AND purpose=?').get(hash(token),purpose);if(!row||row.used||row.expires<=now())throw fail(400,'This link is invalid or has expired. Request a new one.');db.prepare('UPDATE merchant_email_tokens SET used=1 WHERE token_hash=?').run(hash(token));return row.merchant_id;}
 async function sendVerification(merchant){if(!mailer.configured)throw fail(503,'Email sending is not configured on this platform. The platform owner must set PLATFORM_RESEND_API_KEY and PLATFORM_RESEND_FROM.');const token=issueToken(merchant.id,'verify',24*3600000);const link=(env.PLATFORM_PUBLIC_URL||'').replace(/\/$/,'')+'/verify-email.html?token='+token;await mailer.send({to:merchant.email,subject:'Verify your VEGArance merchant email',text:`Hi ${merchant.name},\n\nConfirm your email to finish setting up your VEGArance merchant account:\n${link||'(open the verification link from your merchant dashboard)'}\n\nThis link expires in 24 hours. If you did not create this account, ignore this email.`});return true;}
 async function sendRecovery(merchant){if(!mailer.configured)throw fail(503,'Email sending is not configured on this platform. The platform owner must set PLATFORM_RESEND_API_KEY and PLATFORM_RESEND_FROM.');const token=issueToken(merchant.id,'reset',3600000);const link=(env.PLATFORM_PUBLIC_URL||'').replace(/\/$/,'')+'/reset-password.html?token='+token;await mailer.send({to:merchant.email,subject:'Reset your VEGArance merchant password',text:`Hi ${merchant.name},\n\nReset your VEGArance merchant password here:\n${link||'(open the password-reset link from your merchant dashboard)'}\n\nThis link expires in 1 hour. If you did not request this, ignore this email — your password stays unchanged.`});return true;}
 function store(storeId,merchantId){const row=db.prepare('SELECT * FROM merchant_stores WHERE id=? AND merchant_id=?').get(storeId,merchantId);if(!row)throw fail(404,'Store not found');return {...JSON.parse(row.document),id:row.id,slug:row.slug};}
 const products=storeId=>db.prepare('SELECT id,document FROM merchant_products WHERE store_id=? ORDER BY rowid DESC').all(storeId).map(r=>({...JSON.parse(r.document),id:r.id}));
 const stores=merchantId=>db.prepare('SELECT id,slug,document FROM merchant_stores WHERE merchant_id=? ORDER BY rowid').all(merchantId).map(r=>({...JSON.parse(r.document),id:r.id,slug:r.slug}));
 function settings(input){const name=text(input.name,80,true),description=text(input.description??'',1200),supportEmail=text(input.supportEmail??'',254);if(supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail))throw fail(422,'Enter a valid support email');const accent=input.accent??'#245b49';if(!/^#[a-fA-F0-9]{6}$/.test(accent)||typeof input.published!=='boolean')throw fail(422,'Invalid store appearance');return {name,description,supportEmail,accent,published:input.published,currency:'USD',checkoutEnabled:false};}
 function product(input){const name=text(input.name,160,true),description=text(input.description??'',1600),image=text(input.image??'',2000);if(image){let u;try{u=new URL(image);}catch{throw fail(422,'Use an HTTPS image URL');}if(u.protocol!=='https:'||u.username||u.password)throw fail(422,'Use an HTTPS image URL');}if(!Number.isSafeInteger(input.priceCents)||input.priceCents<1||input.priceCents>1000000||typeof input.visible!=='boolean')throw fail(422,'Enter a valid USD price and visibility');return {name,description,image,priceCents:input.priceCents,visible:input.visible};}
 async function route(req,res,url){const path=url.pathname,method=req.method;
  // Public API (API-key auth) for merchant stores. Keys for the owner store
  // fall through to server.mjs. No Origin requirement: API clients are not browsers.
  if(publicApi&&path.startsWith('/api/v1/')){
   let auth;try{auth=publicApi.authenticate(req);}catch{return false;}
   if(auth.storeId==='owner')return false;
   const storeRow=db.prepare('SELECT id FROM merchant_stores WHERE id=?').get(auth.storeId);
   if(!storeRow)throw fail(404,'Store not found');
   const productMatch=path.match(/^\/api\/v1\/products\/([a-f0-9]{32})$/);
   if(path==='/api/v1/products'&&method==='GET'){publicApi.requireScope(auth,'read:products');
    const limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit'))||20)),offset=Math.max(0,Number(url.searchParams.get('offset'))||0);
    const all=products(auth.storeId).filter(p=>p.visible).map(p=>({id:p.id,name:p.name,description:p.description,image:p.image,priceCents:p.priceCents,visible:true,saleReady:inventory.approved(auth.storeId,p),variants:p.variants?.filter(v=>v.active!==false).map(v=>({id:v.id,label:v.label,priceCents:v.priceCents,inStock:inventory.available(auth.storeId,p,v)}))}));
    send(res,200,{total:all.length,limit,offset,products:all.slice(offset,offset+limit)});return true;}
   if(productMatch&&method==='GET'){publicApi.requireScope(auth,'read:products');
    const p=products(auth.storeId).find(p=>p.id===productMatch[1]&&p.visible);if(!p)throw fail(404,'Product not found');
    send(res,200,{id:p.id,name:p.name,description:p.description,image:p.image,priceCents:p.priceCents,visible:true,saleReady:inventory.approved(auth.storeId,p),variants:p.variants});return true;}
   const orderMatch=path.match(/^\/api\/v1\/orders\/(MORD-[a-f0-9]{24})$/);
   if(path==='/api/v1/orders'&&method==='GET'){publicApi.requireScope(auth,'read:orders');
    const limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit'))||20)),offset=Math.max(0,Number(url.searchParams.get('offset'))||0);
    const all=commerce.orders(auth.storeId).map(o=>({id:o.id,status:o.status,paymentStatus:o.paymentStatus,paymentMode:o.paymentMode,lines:o.lines,subtotalCents:o.subtotalCents,discountCents:o.discountCents||0,couponCode:o.couponCode||null,shippingCents:o.shippingCents,taxCents:o.taxCents,totalCents:o.totalCents,shippingMethod:o.shippingMethod,tracking:o.tracking||null,email:o.email,address:o.address,createdAt:o.createdAt,paidAt:o.paidAt||null}));
    send(res,200,{total:all.length,limit,offset,orders:all.slice(offset,offset+limit)});return true;}
   if(orderMatch&&method==='GET'){publicApi.requireScope(auth,'read:orders');
    const found=commerce.orders(auth.storeId).find(o=>o.id===orderMatch[1]);if(!found)throw fail(404,'Order not found');
    send(res,200,{id:found.id,status:found.status,paymentStatus:found.paymentStatus,paymentMode:found.paymentMode,lines:found.lines,subtotalCents:found.subtotalCents,discountCents:found.discountCents||0,couponCode:found.couponCode||null,shippingCents:found.shippingCents,taxCents:found.taxCents,totalCents:found.totalCents,shippingMethod:found.shippingMethod,tracking:found.tracking||null,email:found.email,address:found.address,createdAt:found.createdAt,paidAt:found.paidAt||null});return true;}
   throw fail(404,'Unknown public API route');
  }
  if(!path.startsWith('/api/platform/'))return false;
  const hook=path.match(/^\/api\/platform\/webhooks\/(flutterwave|stripe)\/([a-f0-9]{32})\/([a-f0-9-]{36})$/);
  if(hook&&method==='POST'){let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>1000000)throw fail(413,'Webhook too large');parts.push(chunk);}send(res,200,await commerce.webhook(hook[2],hook[3],Buffer.concat(parts),req.headers['verif-hash']||req.headers['stripe-signature']));return true;}
  if(method!=='GET')sameOrigin(req);
  if(path==='/api/platform/order-status'&&method==='GET'){checkoutLimit(req);send(res,200,await commerce.lookup(url.searchParams.get('token')));return true;}
  if(path==='/api/platform/order-status/verify'&&method==='POST'){checkoutLimit(req);send(res,200,await commerce.lookup((await body(req)).token,true));return true;}
  const buyer=path.match(/^\/api\/platform\/public\/([a-z0-9-]+)\/(quote|checkout)$/);if(buyer&&method==='POST'){checkoutLimit(req);const row=db.prepare('SELECT id FROM merchant_stores WHERE slug=?').get(buyer[1]);if(!row)throw fail(404,'Store not found');send(res,buyer[2]==='checkout'?201:200,await commerce[buyer[2]](row.id,await body(req)));return true;}
  if(path==='/api/platform/session'&&method==='GET'){try{const m=session(req);send(res,200,{merchant:m,stores:stores(m.id)});}catch(e){if(e.status!==401)throw e;send(res,200,{merchant:null,stores:[]});}return true;}
  if(['/api/platform/signup','/api/platform/login'].includes(path)&&method==='POST'){limit(req);const input=await body(req),c=credentials(input);
   if(path.endsWith('signup')){const name=text(input.name,100,true);if(db.prepare('SELECT id FROM merchants WHERE email=?').get(c.email))throw fail(409,'Unable to create this account. Try signing in.');const salt=randomBytes(16).toString('hex'),digest=await passwordHash(c.password,salt),merchant={id:id(),email:c.email,name,emailVerified:false};let verificationSent=false;try{db.prepare('INSERT INTO merchants(id,email,name,salt,password_hash,created_at) VALUES(?,?,?,?,?,?)').run(merchant.id,c.email,name,salt,digest.toString('hex'),now());}catch(e){if(e.code?.startsWith('ERR_SQLITE'))throw fail(409,'Unable to create this account. Try signing in.');throw e;}if(mailer.configured){try{await sendVerification(merchant);verificationSent=true;}catch{/* signup still succeeds; merchant can resend from dashboard */}}const out=login(req,res,merchant);send(res,201,{...out,verificationSent});
   }else{const m=db.prepare('SELECT * FROM merchants WHERE email=?').get(c.email),digest=await passwordHash(c.password,m?.salt||'missing-account-salt');if(!m||!timingSafeEqual(digest,Buffer.from(m.password_hash,'hex')))throw fail(401,'Incorrect email or password');send(res,200,login(req,res,m));}return true;}
  if(path==='/api/platform/logout'&&method==='POST'){session(req);const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('vegarance_merchant='))?.slice(19);db.prepare('DELETE FROM merchant_sessions WHERE token_hash=?').run(hash(token));cookie(req,res,'',0);send(res,200,{ok:true});return true;}
  if(path==='/api/platform/verify-email/request'&&method==='POST'){limit(req);const m=session(req);if(m.emailVerified){send(res,200,{verified:true});return true;}const row=db.prepare('SELECT * FROM merchants WHERE id=?').get(m.id);await sendVerification(row);send(res,200,{sent:true});return true;}
  if(path==='/api/platform/verify-email'&&method==='GET'){const merchantId=consumeToken(url.searchParams.get('token'),'verify');db.prepare('UPDATE merchants SET email_verified=1 WHERE id=?').run(merchantId);send(res,200,{verified:true});return true;}
  if(path==='/api/platform/forgot-password'&&method==='POST'){limit(req);const input=await body(req),email=typeof input.email==='string'?input.email.trim().toLowerCase():'';const m=email?db.prepare('SELECT * FROM merchants WHERE email=?').get(email):null;if(m&&mailer.configured){try{await sendRecovery(m);}catch{/* generic response below — never leak send failures */}}send(res,200,{sent:true});return true;}
  if(path==='/api/platform/reset-password'&&method==='POST'){limit(req);const input=await body(req);if(typeof input.password!=='string'||input.password.length<12||input.password.length>200)throw fail(422,'Enter a password of 12–200 characters');const merchantId=consumeToken(input.token,'reset');const salt=randomBytes(16).toString('hex'),digest=await passwordHash(input.password,salt);db.prepare('UPDATE merchants SET salt=?,password_hash=? WHERE id=?').run(salt,digest.toString('hex'),merchantId);db.prepare('DELETE FROM merchant_sessions WHERE merchant_id=?').run(merchantId);db.prepare('DELETE FROM merchant_email_tokens WHERE merchant_id=? AND purpose=?').run(merchantId,'reset');send(res,200,{reset:true});return true;}
  const publicMatch=path.match(/^\/api\/platform\/public\/([a-z0-9-]+)$/);if(publicMatch&&method==='GET'){const row=db.prepare('SELECT id,slug,document FROM merchant_stores WHERE slug=?').get(publicMatch[1]);if(!row||!JSON.parse(row.document).published)throw fail(404,'Store not found');send(res,200,{store:{...JSON.parse(row.document),slug:row.slug,...commerce.publicConfig(row.id)},products:products(row.id).filter(p=>p.visible).map(p=>({id:p.id,name:p.name,description:p.description,image:p.image,priceCents:p.priceCents,visible:true,saleReady:inventory.approved(row.id,p),...(p.variants?{variants:p.variants.filter(v=>v.active!==false).map(v=>({id:v.id,label:v.label,priceCents:v.priceCents,inStock:inventory.available(row.id,p,v)}))}:{})}))});return true;}
  /* Onboarding wizard (v3 Phase A): derived progress, never stored. Every
     step is computed from real DB state — no step is ever marked done
     without evidence. Unauthenticated callers get the account step only. */
  if(path==='/api/platform/onboarding'&&method==='GET'){
   let merchant=null;try{merchant=session(req);}catch(e){if(e.status!==401)throw e;}
   if(!merchant){send(res,200,{...deriveOnboarding({signedIn:false}),verificationRequired:mailer.configured});return true;}
   const allStores=stores(merchant.id);
   const requested=url.searchParams.get('storeId');
   const chosen=requested?allStores.find(s=>s.id===requested):allStores[0];
   if(requested&&!chosen)throw fail(404,'Store not found');
   let storeInput=null,connectionSummary=null;
   if(chosen){
    const status=connections.status(chosen.id);
    const byProvider=Object.fromEntries(status.connections.map(c=> [c.provider,{connected:!!c.connected,verifiedAt:c.verifiedAt||null,mode:c.mode||null,usdApproved:c.usdApproved||false}]));
    connectionSummary={storageConfigured:status.storageConfigured,providers:byProvider};
    const allProducts=products(chosen.id);
    const activation=commerce.readiness(chosen.id);
    storeInput={id:chosen.id,slug:chosen.slug,name:chosen.name,published:chosen.published===true,connections:byProvider,productCount:allProducts.length,saleReadyCount:allProducts.filter(p=>inventory.approved(chosen.id,p)).length,paymentProvider:activation.paymentProvider,activation:{ready:activation.ready,checks:activation.checks}};
   }
   send(res,200,{...deriveOnboarding({signedIn:true,emailVerified:merchant.emailVerified,verificationRequired:mailer.configured,store:storeInput,billing:billing.get(merchant.id)}),stores:allStores.map(s=>({id:s.id,slug:s.slug,name:s.name})),connections:connectionSummary});return true;}
  const merchant=session(req);
  /* Merchant billing (Phase B scaffolding — no provider, no charges).
     GET: current plan + limits. POST trial: one free 14-day Starter trial.
     POST cancel: end a trial/active plan (effective plan becomes Free). */
  if(path==='/api/platform/billing'&&method==='GET'){send(res,200,{billing:billing.get(merchant.id),plans:billing.plans()});return true;}
  if(path==='/api/platform/billing/trial'&&method==='POST'){send(res,200,{billing:billing.startTrial(merchant.id)});return true;}
  if(path==='/api/platform/billing/cancel'&&method==='POST'){send(res,200,{billing:billing.cancel(merchant.id)});return true;}
  /* Phase C — per-store coupons (merchant CRUD; codes are never exposed
     on the public storefront config) and product-research trend scoring
     (deterministic scores from merchant-supplied supplier signals,
     optional AI summary when AI_API_KEY is configured). */
  const couponRoute=path.match(/^\/api\/platform\/stores\/([a-f0-9]{32})\/coupons(?:\/([a-f0-9]{32}))?$/);
  if(couponRoute){store(couponRoute[1],merchant.id);
   if(!couponRoute[2]&&method==='GET')send(res,200,coupons.list(couponRoute[1]));
   else if(!couponRoute[2]&&method==='POST')send(res,201,coupons.create(couponRoute[1],await body(req)));
   else if(couponRoute[2]&&method==='PUT')send(res,200,coupons.update(couponRoute[1],couponRoute[2],await body(req)));
   else if(couponRoute[2]&&method==='DELETE')send(res,200,coupons.remove(couponRoute[1],couponRoute[2]));
   else throw fail(405,'Method not allowed');return true;}
  const trendRoute=path.match(/^\/api\/platform\/stores\/([a-f0-9]{32})\/trends$/);
  if(trendRoute&&method==='POST'){store(trendRoute[1],merchant.id);
   const input=await body(req);
   if(!Array.isArray(input.items)||!input.items.length||input.items.length>50)throw fail(422,'Provide 1–50 products with supplier signals');
   const scored=rankProducts(input.items.map(item=>{if(!item||typeof item!=='object'||typeof item.name!=='string')throw fail(422,'Each trend item needs a name');return {name:item.name,signals:item.signals||{}};}));
   let summary=null;
   if(input.aiSummary===true){if(!ai.configured)throw fail(503,'Configure AI_API_KEY privately on Render to use AI trend summaries.');summary=await ai.summarizeTrends(scored);}
   send(res,200,{scored,summary,disclaimer:'Scores are estimates from supplier data supplied by the merchant — not a guarantee of sales.'});return true;}
  if(path==='/api/platform/stores'&&method==='GET'){send(res,200,stores(merchant.id));return true;}
  if(path==='/api/platform/stores'&&method==='POST'){const gate=billing.gate(merchant.id,'create_store',{currentStores:stores(merchant.id).length});if(!gate.allowed)throw fail(402,gate.reason);const input=await body(req),slug=text(input.slug,48,true).toLowerCase();if(!/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/.test(slug))throw fail(422,'Store URL must be 3–48 lowercase letters, numbers or hyphens');if(stores(merchant.id).length>=5)throw fail(422,'You can create up to five stores');const cfg=settings({...input,published:false}),storeId=id();try{db.prepare('INSERT INTO merchant_stores VALUES(?,?,?,?)').run(storeId,merchant.id,slug,JSON.stringify(cfg));}catch(e){if(e.code?.startsWith('ERR_SQLITE'))throw fail(409,'That store URL is already taken');throw e;}send(res,201,store(storeId,merchant.id));return true;}
  const operationRoute=path.match(/^\/api\/platform\/stores\/([a-f0-9]{32})\/(?:orders\/(MORD-[a-f0-9]{24})\/(refund|refund_reconcile|dispatch|fund|tracking|reconcile|fulfillment_request|fulfillment_confirm|fulfillment_reject|aliexpress_tracking)|emails\/(MORD-[a-f0-9]{24}-(?:receipt|shipping|refund))\/retry)$/);
  if(operationRoute&&method==='POST'){store(operationRoute[1],merchant.id);if(operationRoute[4])send(res,200,commerce.retryEmail(operationRoute[1],operationRoute[4]));else{await commerce.action(operationRoute[1],operationRoute[2],operationRoute[3],await body(req));send(res,200,commerce.orders(operationRoute[1]));}return true;}
  const salesRoute=path.match(/^\/api\/platform\/stores\/([a-f0-9]{32})\/(?:sales|orders(?:\/(MORD-[a-f0-9]{24})\/verify)?)$/);
  if(salesRoute){store(salesRoute[1],merchant.id);if(path.endsWith('/sales')&&method==='GET')send(res,200,commerce.dashboard(salesRoute[1]));else if(path.endsWith('/sales')&&method==='PUT')send(res,200,commerce.configure(salesRoute[1],await body(req)));else if(salesRoute[2]&&method==='POST'){await commerce.verify(salesRoute[1],salesRoute[2]);send(res,200,commerce.orders(salesRoute[1]));}else if(path.endsWith('/orders')&&method==='GET')send(res,200,commerce.orders(salesRoute[1]));else throw fail(405,'Method not allowed');return true;}
  const stockRoute=path.match(/^\/api\/platform\/stores\/([a-f0-9]{32})\/inventory(?:\/(sync|settings))?$/);
  if(stockRoute){store(stockRoute[1],merchant.id);if(!stockRoute[2]&&method==='GET')send(res,200,inventory.status(stockRoute[1]));else if(stockRoute[2]==='sync'&&method==='POST'){const job=inventory.enqueue(stockRoute[1]);inventory.run().catch(()=>{});send(res,202,job);}else if(stockRoute[2]==='settings'&&method==='PUT')send(res,200,inventory.configure(stockRoute[1],await body(req)));else throw fail(405,'Method not allowed');return true;}
  const integration=path.match(/^\/api\/platform\/stores\/([a-f0-9]{32})\/(?:connections(?:\/(cj|flutterwave|stripe|resend)(?:\/(verify))?)?|suppliers\/cj\/(search|import))$/);
  if(integration){const cfg=store(integration[1],merchant.id),provider=integration[2];
   if(integration[4]==='search'&&method==='GET')send(res,200,await connections.search(cfg.id,url.searchParams.get('q')));
   else if(integration[4]==='import'&&method==='POST')send(res,201,await connections.importDraft(cfg.id,await body(req)));
   else if(integration[3]==='verify'&&method==='POST')send(res,200,await connections.verify(cfg.id,provider));
   else if(!provider&&!integration[4]&&method==='GET')send(res,200,connections.status(cfg.id));
   else if(provider&&!integration[3]&&method==='PUT')send(res,200,connections.save(cfg.id,provider,await body(req)));
   else if(provider&&!integration[3]&&method==='DELETE')send(res,200,connections.remove(cfg.id,provider));
   else throw fail(405,'Method not allowed');return true;
  }
  const apiRoute=path.match(/^\/api\/platform\/stores\/([a-f0-9]{32})\/(api-keys|webhooks)(?:\/([a-f0-9]{32}|deliveries)(?:\/(test))?)?$/);
  if(apiRoute&&publicApi){store(apiRoute[1],merchant.id);
   const [storeId,kind,sub,test]=[apiRoute[1],apiRoute[2],apiRoute[3],apiRoute[4]];
   if(kind==='api-keys'&&method==='GET'){send(res,200,publicApi.listKeys(storeId));return true;}
   if(kind==='api-keys'&&method==='POST'){const input=await body(req);const gate=billing.gate(merchant.id,'api',{scopes: Array.isArray(input.scopes)?input.scopes:[]});if(!gate.allowed)throw fail(402,gate.reason);send(res,201,publicApi.createKey(storeId,input));return true;}
   if(kind==='api-keys'&&method==='DELETE'&&sub&&sub!=='deliveries'){send(res,200,publicApi.revokeKey(storeId,sub));return true;}
   if(kind==='webhooks'&&method==='GET'&&sub==='deliveries'){send(res,200,publicApi.deliveries(storeId));return true;}
   if(kind==='webhooks'&&method==='GET'&&!sub){send(res,200,publicApi.listEndpoints(storeId));return true;}
   if(kind==='webhooks'&&method==='POST'&&!sub){const input=await body(req);const gate=billing.gate(merchant.id,'webhooks',{currentEndpoints:publicApi.listEndpoints(storeId).length});if(!gate.allowed)throw fail(402,gate.reason);send(res,201,publicApi.createEndpoint(storeId,input));return true;}
   if(kind==='webhooks'&&method==='DELETE'&&sub&&sub!=='deliveries'){send(res,200,publicApi.deleteEndpoint(storeId,sub));return true;}
   if(kind==='webhooks'&&method==='POST'&&sub&&sub!=='deliveries'&&test==='test'){send(res,200,await publicApi.testEndpoint(storeId,sub));return true;}
   throw fail(405,'Method not allowed');
  }
  const match=path.match(/^\/api\/platform\/stores\/([a-f0-9]{32})(?:\/products(?:\/([a-f0-9]{32}))?)?$/);if(!match)throw fail(404,'Unknown platform route');const cfg=store(match[1],merchant.id);
  if(path.endsWith(match[1])){if(method==='GET')send(res,200,{store:cfg,products:products(cfg.id)});else if(method==='PUT'){const updated=settings(await body(req));if(updated.published&&mailer.configured&&!merchant.emailVerified)throw fail(403,'Verify your email before publishing your store.');db.prepare('UPDATE merchant_stores SET document=? WHERE id=? AND merchant_id=?').run(JSON.stringify(updated),cfg.id,merchant.id);send(res,200,store(cfg.id,merchant.id));}else throw fail(405,'Method not allowed');return true;}
  const productId=match[2];if(productId){const row=db.prepare('SELECT id,document FROM merchant_products WHERE id=? AND store_id=?').get(productId,cfg.id);if(!row)throw fail(404,'Product not found');if(method==='DELETE'){db.prepare('DELETE FROM merchant_products WHERE id=? AND store_id=?').run(productId,cfg.id);send(res,200,{deleted:true});}else if(method==='PUT'){const existing=JSON.parse(row.document),input=await body(req),p={...existing,...product(input)};if(existing.supplier){
 if(input.variants!==undefined){if(!Array.isArray(input.variants)||input.variants.length!==existing.variants.length)throw fail(422,'Keep all supplier option identifiers');const options=new Map(input.variants.map(v=>[v.id,v]));if(options.size!==existing.variants.length)throw fail(422,'Duplicate supplier option');p.variants=existing.variants.map(v=>{const edit=options.get(v.id);if(!edit||!Number.isSafeInteger(edit.priceCents)||edit.priceCents<1||edit.priceCents>1000000||typeof edit.active!=='boolean')throw fail(422,'Invalid supplier option price or availability');const label=text(edit.label,160,true);return {...v,label,priceCents:edit.priceCents,active:edit.active,inStock:edit.active&&v.quantity>0&&edit.priceCents>v.costCents};});}
 p.priceCents=Math.min(...(p.variants.some(v=>v.active)?p.variants.filter(v=>v.active):p.variants).map(v=>v.priceCents));if(input.saleReady!==undefined&&typeof input.saleReady!=='boolean')throw fail(422,'Invalid sale approval');p.saleReady=input.saleReady===true;
 if(p.saleReady&&(!p.description||!p.image||!p.variants.some(v=>inventory.available(cfg.id,p,v))))throw fail(422,'Sale approval needs a description, image, and fresh available supplier options priced above cost');
 }else if(input.saleReady===true)throw fail(422,'Real sale approval requires a connected supplier');db.prepare('UPDATE merchant_products SET document=? WHERE id=? AND store_id=?').run(JSON.stringify(p),productId,cfg.id);send(res,200,{...p,id:productId});}else throw fail(405,'Method not allowed');return true;}
  if(method==='GET')send(res,200,products(cfg.id));else if(method==='POST'){const gate=billing.gate(merchant.id,'add_product',{currentProducts:products(cfg.id).length});if(!gate.allowed)throw fail(402,gate.reason);const p=product(await body(req)),productId=id();db.prepare('INSERT INTO merchant_products VALUES(?,?,?)').run(productId,cfg.id,JSON.stringify(p));send(res,201,{...p,id:productId});}else throw fail(405,'Method not allowed');return true;
 }
 return {route,billing,start(){inventory.start();commerce.start();},stop(){inventory.stop();commerce.stop();}};
}
