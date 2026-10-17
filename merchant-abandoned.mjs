/* Abandoned-checkout capture + single-reminder tracking (Phase C / P1).
   A checkout is "abandoned" when a quote was created and never turned
   into a paid order. This module only records that fact and tracks
   whether a reminder has been queued: the actual email is sent by the
   merchant-operations email-job loop (Resend, when the store's email
   connection is configured). Honest inactive state: with no email
   connection configured, nothing is queued and the row stays pending —
   no fake send is recorded.
   Exactly one reminder per abandonment: a row moves pending → queued
   once, and never returns to pending. If the order later pays, the row
   moves to converted and no reminder goes out. */
const fail=(status,message)=>Object.assign(new Error(message),{status});
export const ABANDONED_MIN_AGE_MS=3600000;
export function createMerchantAbandoned({db,now=Date.now}){
 db.exec(`CREATE TABLE IF NOT EXISTS merchant_abandoned_checkouts(quote_id TEXT PRIMARY KEY,store_id TEXT NOT NULL REFERENCES merchant_stores(id),document TEXT NOT NULL);`);
 const pub=row=>{const d=JSON.parse(row.document);return {quoteId:row.quote_id,storeId:row.store_id,email:d.email,subtotalCents:d.subtotalCents,lines:d.lines,state:d.state,createdAt:d.createdAt,reminderQueuedAt:d.reminderQueuedAt||null,reminderJobId:d.reminderJobId||null,convertedAt:d.convertedAt||null};};
 function capture(storeId,quote){
  if(!quote||typeof quote.id!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quote.address?.email||''))return null;
  const doc={email:quote.address.email,subtotalCents:Number.isSafeInteger(quote.subtotalCents)?quote.subtotalCents:0,lines:Array.isArray(quote.lines)?quote.lines.map(l=>({name:String(l.name||'Item').slice(0,160),qty:Number.isSafeInteger(l.qty)?l.qty:1})):[],
   state:'pending',createdAt:Number.isSafeInteger(quote.createdAt)?quote.createdAt:now(),reminderQueuedAt:null,reminderJobId:null,convertedAt:null};
  db.prepare('INSERT OR IGNORE INTO merchant_abandoned_checkouts VALUES(?,?,?)').run(quote.id,storeId,JSON.stringify(doc));
  return pub({quote_id:quote.id,store_id:storeId,document:JSON.stringify(doc)});
 }
 function get(quoteId){const r=db.prepare('SELECT * FROM merchant_abandoned_checkouts WHERE quote_id=?').get(quoteId);return r?pub(r):null;}
 function list(storeId){return db.prepare('SELECT * FROM merchant_abandoned_checkouts WHERE store_id=? ORDER BY rowid DESC LIMIT 100').all(storeId).map(pub);}
 function due(limit=5,minAgeMs=ABANDONED_MIN_AGE_MS){
  return db.prepare(`SELECT * FROM merchant_abandoned_checkouts WHERE json_extract(document,'$.state')='pending' AND json_extract(document,'$.createdAt')<? ORDER BY rowid ASC LIMIT ?`).all(now()-minAgeMs,Math.max(1,Math.min(50,limit))).map(pub);
 }
 function markQueued(quoteId,jobId){
  const r=db.prepare('SELECT document FROM merchant_abandoned_checkouts WHERE quote_id=?').get(quoteId);if(!r)throw fail(404,'Abandoned checkout not found');
  const doc=JSON.parse(r.document);if(doc.state!=='pending')return get(quoteId);
  doc.state='queued';doc.reminderQueuedAt=now();doc.reminderJobId=jobId||null;
  db.prepare('UPDATE merchant_abandoned_checkouts SET document=? WHERE quote_id=?').run(JSON.stringify(doc),quoteId);
  return get(quoteId);
 }
 function markConverted(quoteId){
  const r=db.prepare('SELECT document FROM merchant_abandoned_checkouts WHERE quote_id=?').get(quoteId);if(!r)return null;
  const doc=JSON.parse(r.document);if(doc.state==='converted')return get(quoteId);
  doc.state='converted';doc.convertedAt=now();
  db.prepare('UPDATE merchant_abandoned_checkouts SET document=? WHERE quote_id=?').run(JSON.stringify(doc),quoteId);
  return get(quoteId);
 }
 return {capture,get,list,due,markQueued,markConverted};
}
