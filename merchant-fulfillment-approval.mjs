/* Supplier-confirmation approvals + manual tracking capture (Phase C / P1).
   Auto-ordering depth, WITHOUT auto-charges:
   - Printful / Printify orders are NEVER confirmed automatically. The
     merchant reviews a pending approval (provider, draft summary,
     estimated charge) and must explicitly confirm with confirmCharge:true.
     This record is the gate: it documents the merchant's explicit
     approval to be charged. It does NOT call any provider confirm
     endpoint — Printful orders are still confirmed in the Printful
     dashboard (confirm:false on create, payOrder refuses) and Printify
     orders still go to production from the Printify dashboard
     (send_to_production is never called). The merchant completes the
     charge step in the provider dashboard after confirming here.
   - AliExpress has no fulfilment API, so fulfilment stays manual. This
     module's tracking helper validates a merchant-pasted tracking
     number (from the AliExpress / Dropshipping Center order) so the
     system can store it and notify the buyer — it never invents one. */
import {randomBytes} from 'node:crypto';
const fail=(status,message)=>Object.assign(new Error(message),{status});
export const FULFILLMENT_PROVIDERS={printful:'Printful',printify:'Printify',aliexpress:'AliExpress'};
export function chargeWarning(provider,estimatedChargeCents,testMode){
 const name=FULFILLMENT_PROVIDERS[provider]||provider;
 if(testMode)return 'This is a test order — no real charge will be made. Confirming records your review of this supplier order.';
 return `Confirming this order will charge your ${name} account approximately $${(estimatedChargeCents/100).toFixed(2)}. Vegarance never confirms supplier charges automatically — this confirmation is your explicit approval to be charged. After confirming here, complete the charge step in your ${name} dashboard if the order also needs a dashboard step.`;
}
export function validateTracking(input){
 if(!input||typeof input!=='object')throw fail(422,'Enter the tracking number from your supplier order');
 const number=typeof input.trackingNumber==='string'?input.trackingNumber.trim():'';
 if(!/^[A-Za-z0-9][A-Za-z0-9 .,_-]{5,39}$/.test(number))throw fail(422,'Enter a tracking number of 6–40 letters, numbers, spaces, dots, commas, hyphens or underscores');
 const carrier=typeof input.carrier==='string'?input.carrier.trim().slice(0,100):'';
 const url=typeof input.trackingUrl==='string'?input.trackingUrl.trim():'';
 if(url){let u;try{u=new URL(url);}catch{throw fail(422,'Tracking URL must be a valid HTTPS link');}if(u.protocol!=='https:'||url.length>2000)throw fail(422,'Tracking URL must be a valid HTTPS link');}
 return {tracking:{number,carrier,url}};
}
export function createMerchantFulfillment({db,now=Date.now}){
 db.exec(`CREATE TABLE IF NOT EXISTS merchant_fulfillment_approvals(id TEXT PRIMARY KEY,store_id TEXT NOT NULL REFERENCES merchant_stores(id),order_id TEXT NOT NULL,document TEXT NOT NULL);`);
 const pub=doc=>{const {id,storeId,orderId,provider,draftSummary,estimatedChargeCents,testMode,state,warning,createdAt,confirmedAt,rejectedAt,rejectReason}=doc;return {id,storeId,orderId,provider,draftSummary,estimatedChargeCents,testMode,state,warning,createdAt,confirmedAt:confirmedAt||null,rejectedAt:rejectedAt||null,rejectReason:rejectReason||null};};
 function request(storeId,order,input){
  if(!order||order.paymentStatus!=='paid')throw fail(422,'Only verified paid orders can go to supplier confirmation');
  if(!input||typeof input!=='object')throw fail(422,'Describe the supplier order to confirm');
  if(!FULFILLMENT_PROVIDERS[input.provider])throw fail(422,'Choose a supplier to confirm: printful, printify or aliexpress');
  const draftSummary=typeof input.draftSummary==='string'?input.draftSummary.trim().slice(0,500):'';
  if(!Number.isSafeInteger(input.estimatedChargeCents)||input.estimatedChargeCents<1||input.estimatedChargeCents>100000000)throw fail(422,'Enter the estimated supplier charge in cents (1–100,000,000)');
  const pending=db.prepare(`SELECT document FROM merchant_fulfillment_approvals WHERE store_id=? AND order_id=? AND json_extract(document,'$.state')='pending'`).get(storeId,order.id);
  if(pending)throw fail(409,'A supplier confirmation is already awaiting review for this order');
  const testMode=input.testMode===true;
  const doc={id:randomBytes(16).toString('hex'),storeId,orderId:order.id,provider:input.provider,draftSummary,estimatedChargeCents:input.estimatedChargeCents,testMode,state:'pending',warning:chargeWarning(input.provider,input.estimatedChargeCents,testMode),createdAt:now(),confirmedAt:null,rejectedAt:null,rejectReason:null};
  db.prepare('INSERT INTO merchant_fulfillment_approvals VALUES(?,?,?,?)').run(doc.id,storeId,doc.orderId,JSON.stringify(doc));
  return pub(doc);
 }
 function get(storeId,id){const r=db.prepare('SELECT document FROM merchant_fulfillment_approvals WHERE id=? AND store_id=?').get(id,storeId);if(!r)throw fail(404,'Supplier confirmation not found');return pub(JSON.parse(r.document));}
 function list(storeId){return db.prepare('SELECT document FROM merchant_fulfillment_approvals WHERE store_id=? ORDER BY rowid DESC LIMIT 100').all(storeId).map(r=>pub(JSON.parse(r.document)));}
 function listForOrder(storeId,orderId){return db.prepare('SELECT document FROM merchant_fulfillment_approvals WHERE store_id=? AND order_id=? ORDER BY rowid').all(storeId,orderId).map(r=>pub(JSON.parse(r.document)));}
 function confirm(storeId,id,{confirmCharge}={}){
  const r=db.prepare('SELECT document FROM merchant_fulfillment_approvals WHERE id=? AND store_id=?').get(id,storeId);if(!r)throw fail(404,'Supplier confirmation not found');
  const doc=JSON.parse(r.document);
  if(doc.state!=='pending')throw fail(409,'This supplier confirmation is already '+doc.state);
  if(confirmCharge!==true)throw fail(422,'Confirm that you approve this supplier charge before it is confirmed. '+doc.warning);
  doc.state='confirmed';doc.confirmedAt=now();
  db.prepare('UPDATE merchant_fulfillment_approvals SET document=? WHERE id=? AND store_id=?').run(JSON.stringify(doc),id,storeId);
  return pub(doc);
 }
 function reject(storeId,id,{reason}={}){
  const r=db.prepare('SELECT document FROM merchant_fulfillment_approvals WHERE id=? AND store_id=?').get(id,storeId);if(!r)throw fail(404,'Supplier confirmation not found');
  const doc=JSON.parse(r.document);
  if(doc.state!=='pending')throw fail(409,'This supplier confirmation is already '+doc.state);
  doc.state='rejected';doc.rejectedAt=now();doc.rejectReason=typeof reason==='string'?reason.trim().slice(0,500):'';
  db.prepare('UPDATE merchant_fulfillment_approvals SET document=? WHERE id=? AND store_id=?').run(JSON.stringify(doc),id,storeId);
  return pub(doc);
 }
 return {request,get,list,listForOrder,confirm,reject,validateTracking};
}
