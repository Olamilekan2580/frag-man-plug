import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createMerchantInventory} from './merchant-inventory.mjs';
const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON;CREATE TABLE merchant_stores(id TEXT PRIMARY KEY);CREATE TABLE merchant_products(id TEXT PRIMARY KEY,store_id TEXT REFERENCES merchant_stores(id),document TEXT);INSERT INTO merchant_stores VALUES('a'),('b');");
let time=1000000,version='key-one',failRead=false,editDuringRead=false;const called=[];
const source={name:'Supplier Product',description:'Reviewed',image:'https://example.com/product.png',priceCents:2000,visible:false,saleReady:false,supplier:{provider:'cj',productId:'cj-one'},variants:[{id:'v-one',label:'Medium',priceCents:2000,active:true,inStock:false},{id:'v-two',label:'Large',priceCents:2400,active:true,inStock:false}]};
db.prepare('INSERT INTO merchant_products VALUES(?,?,?)').run('product-a','a',JSON.stringify(source));db.prepare('INSERT INTO merchant_products VALUES(?,?,?)').run('product-b','b',JSON.stringify(source));
const get=()=>JSON.parse(db.prepare("SELECT document FROM merchant_products WHERE id='product-a'").get().document);
const connections={status:storeId=>({connections:[{provider:'cj',connected:!!version,usable:!!version,version}]}),stock:async(storeId,work)=>work({async variant(id){called.push(storeId);if(failRead)throw Error('Mock outage');if(editDuringRead){const p=get();p.variants[0].priceCents=800;db.prepare("UPDATE merchant_products SET document=? WHERE id='product-a'").run(JSON.stringify(p));editDuringRead=false;}return {cost:10,quantity:id==='v-one'?5:0};}})};
let service=createMerchantInventory({db,connections,now:()=>time});
try{
 assert.equal(service.config('a').enabled,false);await service.tick();assert.equal(called.length,0);
 const first=service.enqueue('a');assert.equal(service.enqueue('a').id,first.id);await service.run();assert.equal(service.status('a').jobs[0].state,'done');assert.deepEqual(called,['a','a']);let p=get();assert.equal(p.visible,false);assert.equal(p.saleReady,false);assert.equal(p.variants[0].quantity,5);assert.equal(p.variants[0].costCents,1000);assert.equal(p.variants[0].priceCents,2000);assert.equal(service.available('a',p,p.variants[0]),true);assert.equal(service.available('a',p,p.variants[1]),false);
 assert.equal(JSON.parse(db.prepare("SELECT document FROM merchant_products WHERE id='product-b'").get().document).supplierSync,undefined);
 p.saleReady=true;assert.equal(service.approved('a',p),true);time=p.supplierSync.staleAfter+1;assert.equal(service.approved('a',p),false);
 service.enqueue('a');editDuringRead=true;await service.run();p=get();assert.equal(p.variants[0].priceCents,800);assert.equal(service.available('a',p,p.variants[0]),false);
 failRead=true;service.enqueue('a');await service.run();p=get();assert.equal(p.supplierSync.status,'needs_attention');assert.equal(p.saleReady,false);assert.equal(p.variants.every(v=>v.inStock===false),true);assert.equal(service.status('a').jobs[0].state,'retry');
 for(let i=0;i<2;i++){time+=200000;await service.run();}assert.equal(service.status('a').jobs[0].state,'failed');
 failRead=false;const queued=service.enqueue('a');const interrupted={...queued,state:'running'};db.prepare('UPDATE merchant_inventory_jobs SET document=? WHERE id=?').run(JSON.stringify(interrupted),queued.id);service=createMerchantInventory({db,connections,now:()=>time});assert.equal(service.status('a').jobs[0].state,'queued');await service.run();assert.equal(service.status('a').jobs[0].state,'done');
 const changed=service.enqueue('a');version='key-two';await service.run();assert.equal(service.status('a').jobs[0].state,'failed');assert.equal(service.status('a').jobs[0].id,changed.id);assert.equal(service.available('a',get(),get().variants[0]),false);
 service.configure('a',{enabled:true,intervalMinutes:30});time+=1800001;await service.tick();assert.equal(service.status('a').jobs[0].state,'done');assert.equal(service.status('b').jobs.length,0);version=null;assert.throws(()=>service.enqueue('a'),e=>e.status===422);assert.throws(()=>service.configure('a',{enabled:true,intervalMinutes:30}),e=>e.status===422);
 console.log('PASS: opt-in stock schedules, per-store isolation, job deduplication/recovery/retries, current prices preserved, fresh stock/cost requirements, expiry and changed-connection rejection; no supplier purchases.');
}finally{service.stop();db.close();}
