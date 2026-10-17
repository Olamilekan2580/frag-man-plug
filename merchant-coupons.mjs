/* Per-store coupon codes (Phase C / P1).
   A coupon is created by the merchant for one store: percentage or fixed
   amount off, optional expiry, optional usage limit, optional minimum
   order subtotal. Codes are normalised to uppercase.
   Server-side only: the buyer sends a code with the quote request and the
   server validates it against the stored coupon — the client never
   decides the discount. Discounts apply to the merchandise subtotal only
   (never to shipping), are capped at the subtotal, and tax is computed on
   the discounted subtotal. Redemptions are recorded once per order, when
   the order is verified paid. A coupon that is valid at quote/checkout
   time is honoured for that order even if another order exhausts the
   usage limit before payment lands — the buyer already paid the
   discounted total. No fake discounts: a code that does not validate is
   a 422, never a silent discount. */
import {randomBytes} from 'node:crypto';
const fail=(status,message)=>Object.assign(new Error(message),{status});
export function normalizeCouponCode(code){
 if(typeof code!=='string')throw fail(422,'Enter a coupon code');
 const c=code.trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9_-]{2,29}$/.test(c))throw fail(422,'Coupon codes use 3–30 letters, numbers, hyphens or underscores');
 return c;
}
export function discountFor(subtotalCents,coupon){
 if(!Number.isSafeInteger(subtotalCents)||subtotalCents<0)throw fail(422,'Invalid order subtotal');
 if(coupon.type==='percentage')return Math.floor(subtotalCents*coupon.percent/100);
 return Math.min(coupon.amountCents,subtotalCents);
}
export function createMerchantCoupons({db,now=Date.now}){
 db.exec(`CREATE TABLE IF NOT EXISTS merchant_coupons(id TEXT PRIMARY KEY,store_id TEXT NOT NULL REFERENCES merchant_stores(id),code TEXT NOT NULL,document TEXT NOT NULL,UNIQUE(store_id,code));
 CREATE TABLE IF NOT EXISTS merchant_coupon_redemptions(id TEXT PRIMARY KEY,store_id TEXT NOT NULL REFERENCES merchant_stores(id),coupon_id TEXT NOT NULL,order_id TEXT UNIQUE NOT NULL,document TEXT NOT NULL);`);
 const row=(storeId,id)=>db.prepare('SELECT document FROM merchant_coupons WHERE id=? AND store_id=?').get(id,storeId);
 const usageCount=(storeId,couponId)=>db.prepare('SELECT COUNT(*) n FROM merchant_coupon_redemptions WHERE store_id=? AND coupon_id=?').get(storeId,couponId).n;
 function pub(doc){const {id,storeId,code,type,percent,amountCents,expiresAt,usageLimit,minOrderCents,active,createdAt}=doc;return {id,storeId,code,type,percent,amountCents,expiresAt,usageLimit,minOrderCents,active,createdAt,redemptions:usageCount(storeId,id)};}
 function validateInput(input){
  const out={};
  out.code=normalizeCouponCode(input.code);
  if(!['percentage','fixed'].includes(input.type))throw fail(422,'Coupon type must be percentage or fixed');out.type=input.type;
  if(input.percent!==undefined){if(input.type==='fixed')throw fail(422,'A fixed-amount coupon has no percentage');if(!Number.isInteger(input.percent)||input.percent<1||input.percent>90)throw fail(422,'Percentage coupons are 1–90% off');out.percent=input.percent;}
  if(input.amountCents!==undefined){if(!Number.isSafeInteger(input.amountCents)||input.amountCents<1||input.amountCents>1000000)throw fail(422,'Fixed-amount coupons are 1–1,000,000 cents off');out.amountCents=input.amountCents;}
  if(input.expiresAt!==undefined){if(input.expiresAt!==null&&(!Number.isSafeInteger(input.expiresAt)||input.expiresAt<=now()))throw fail(422,'Coupon expiry must be a future time or empty');out.expiresAt=input.expiresAt;}
  if(input.usageLimit!==undefined){if(input.usageLimit!==null&&(!Number.isSafeInteger(input.usageLimit)||input.usageLimit<1||input.usageLimit>1000000))throw fail(422,'Usage limit must be a positive number or empty');out.usageLimit=input.usageLimit;}
  if(input.minOrderCents!==undefined){if(!Number.isSafeInteger(input.minOrderCents)||input.minOrderCents<0||input.minOrderCents>100000000)throw fail(422,'Minimum order must be 0–100,000,000 cents');out.minOrderCents=input.minOrderCents;}
  if(input.active!==undefined){if(typeof input.active!=='boolean')throw fail(422,'Coupon active must be true or false');out.active=input.active;}
  return out;
 }
 function create(storeId,input){
  if(!input||typeof input!=='object')throw fail(422,'Invalid coupon');
  const v=validateInput(input);
  if(v.type==='percentage'&&v.percent===undefined)throw fail(422,'Percentage coupons need a percent value');
  if(v.type==='fixed'&&v.amountCents===undefined)throw fail(422,'Fixed-amount coupons need an amount in cents');
  if(v.type==='percentage')v.amountCents=null;
  if(v.type==='fixed')v.percent=null;
  const doc={id:randomBytes(16).toString('hex'),storeId,code:v.code,type:v.type,percent:v.percent??null,amountCents:v.amountCents??null,expiresAt:v.expiresAt??null,usageLimit:v.usageLimit??null,minOrderCents:v.minOrderCents??0,active:v.active!==false,createdAt:now()};
  try{db.prepare('INSERT INTO merchant_coupons VALUES(?,?,?,?)').run(doc.id,storeId,doc.code,JSON.stringify(doc));}
  catch(e){if(e.code?.startsWith('ERR_SQLITE'))throw fail(409,'That coupon code already exists for this store');throw e;}
  return pub(doc);
 }
 function list(storeId){return db.prepare('SELECT document FROM merchant_coupons WHERE store_id=? ORDER BY rowid DESC').all(storeId).map(r=>pub(JSON.parse(r.document)));}
 function get(storeId,id){const r=row(storeId,id);if(!r)throw fail(404,'Coupon not found');return pub(JSON.parse(r.document));}
 function update(storeId,id,patch){
  const r=row(storeId,id);if(!r)throw fail(404,'Coupon not found');
  const existing=JSON.parse(r.document);
  if(!patch||typeof patch!=='object'||!['active','expiresAt','usageLimit'].some(k=>patch[k]!==undefined))throw fail(422,'Update active, expiry or usage limit');
  const v={};
  if(patch.active!==undefined){if(typeof patch.active!=='boolean')throw fail(422,'Coupon active must be true or false');v.active=patch.active;}
  if(patch.expiresAt!==undefined){if(patch.expiresAt!==null&&(!Number.isSafeInteger(patch.expiresAt)||patch.expiresAt<=now()))throw fail(422,'Coupon expiry must be a future time or empty');v.expiresAt=patch.expiresAt;}
  if(patch.usageLimit!==undefined){if(patch.usageLimit!==null&&(!Number.isSafeInteger(patch.usageLimit)||patch.usageLimit<1||patch.usageLimit>1000000))throw fail(422,'Usage limit must be a positive number or empty');v.usageLimit=patch.usageLimit;}
  const next={...existing};
  if(v.active!==undefined)next.active=v.active;
  if(patch.expiresAt!==undefined)next.expiresAt=v.expiresAt??null;
  if(patch.usageLimit!==undefined)next.usageLimit=v.usageLimit??null;
  db.prepare('UPDATE merchant_coupons SET document=? WHERE id=? AND store_id=?').run(JSON.stringify(next),id,storeId);
  return pub(next);
 }
 function remove(storeId,id){
  const r=row(storeId,id);if(!r)throw fail(404,'Coupon not found');
  const next={...JSON.parse(r.document),active:false};
  db.prepare('UPDATE merchant_coupons SET document=? WHERE id=? AND store_id=?').run(JSON.stringify(next),id,storeId);
  return pub(next);
 }
 function findByCode(storeId,code){const c=normalizeCouponCode(code);const r=db.prepare('SELECT document FROM merchant_coupons WHERE store_id=? AND code=?').get(storeId,c);return r?JSON.parse(r.document):null;}
 function validateForOrder(storeId,code,subtotalCents){
  if(!Number.isSafeInteger(subtotalCents)||subtotalCents<0)throw fail(422,'Invalid order subtotal');
  const coupon=findByCode(storeId,code);
  if(!coupon)throw fail(422,'That coupon code is not valid for this store');
  if(!coupon.active)throw fail(422,'That coupon code is no longer active');
  if(coupon.expiresAt!==null&&coupon.expiresAt<=now())throw fail(422,'That coupon code has expired');
  if(coupon.usageLimit!==null&&usageCount(storeId,coupon.id)>=coupon.usageLimit)throw fail(422,'That coupon code has reached its usage limit');
  if(subtotalCents<coupon.minOrderCents)throw fail(422,'That coupon needs a minimum order of $'+(coupon.minOrderCents/100).toFixed(2));
  return {coupon:pub(coupon),discountCents:discountFor(subtotalCents,coupon)};
 }
 function recordRedemption(storeId,couponId,orderId){
  const existing=db.prepare('SELECT id FROM merchant_coupon_redemptions WHERE order_id=?').get(orderId);
  if(existing)return false;
  db.prepare('INSERT INTO merchant_coupon_redemptions VALUES(?,?,?,?,?)').run(randomBytes(16).toString('hex'),storeId,couponId,orderId,JSON.stringify({couponId,orderId,createdAt:now()}));
  return true;
 }
 return {create,list,get,update,remove,validateForOrder,recordRedemption,usageCount,findByCode};
}
