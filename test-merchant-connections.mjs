import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createMerchantConnections} from './merchant-connections.mjs';
const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON; CREATE TABLE merchant_stores(id TEXT PRIMARY KEY); CREATE TABLE merchant_products(id TEXT PRIMARY KEY,store_id TEXT REFERENCES merchant_stores(id),document TEXT); INSERT INTO merchant_stores VALUES('store-a'),('store-b');");
const env={PLATFORM_SECRET_KEY:'ab'.repeat(32)},calls=[];let release;
const cjFactory=({apiKey})=>({async search(q){calls.push({apiKey,q});if(q==='wait')await new Promise(r=>release=r);if(q==='fail')throw Object.assign(new Error('Mock supplier failed'),{status:502});return {products:[{id:apiKey,name:'Mock product'}]};},async draft(){return {name:'Supplier Shirt',image:'https://example.com/shirt.png',variants:[{id:'vid-one',label:'Medium',sku:'shirt-m'}],prices:{'vid-one':20},supplier:{provider:'cj',productId:'supplier-one'}};}});
const paymentFactory=s=>({configured:s.mode==='test'&&s.secret.includes('TEST'),async checkConnection(){calls.push({secret:s.secret});return true;}});
const service=createMerchantConnections({db,env,cjFactory,paymentFactory});
try{
 assert.equal(service.status('store-a').connections.every(c=>!c.connected),true);
 assert.throws(()=>createMerchantConnections({db,env:{},cjFactory,paymentFactory}).save('store-a','cj',{apiKey:'private-a'}),e=>e.status===503);
 service.save('store-a','cj',{apiKey:'private-a'});service.save('store-b','cj',{apiKey:'private-b'});
 service.save('store-a','flutterwave',{secret:'FLWSECK_TEST-private',webhookSecret:'private-webhook',mode:'test',usdApproved:true});
 const records=db.prepare('SELECT * FROM merchant_connections').all(),serialized=JSON.stringify(records);for(const secret of ['private-a','private-b','FLWSECK_TEST-private','private-webhook'])assert.ok(!serialized.includes(secret));assert.ok(!JSON.stringify(service.status('store-a')).includes('private'));
 await service.verify('store-a','cj');await service.verify('store-a','flutterwave');assert.ok(service.status('store-a').connections.every(c=>c.verifiedAt));
 assert.equal((await service.search('store-a','shirt')).products[0].id,'private-a');assert.equal((await service.search('store-b','shirt')).products[0].id,'private-b');
 const p=await service.importDraft('store-a',{productId:'supplier-one',category:'Fashion',markup:100});assert.equal(p.visible,false);assert.equal(p.saleReady,false);assert.equal(p.variants[0].inStock,false);assert.equal(p.variants[0].priceCents,2000);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM merchant_products WHERE store_id=?').get('store-b').n,0);
 const pending=service.search('store-a','wait');await new Promise(r=>setTimeout(r,0));assert.throws(()=>service.remove('store-a','cj'),e=>e.status===409);assert.throws(()=>service.save('store-a','cj',{apiKey:'replacement'}),e=>e.status===409);release();await pending;
 const binding=service.paymentBinding('store-a');service.save('store-a','flutterwave',{secret:'FLWSECK_TEST-replacement',webhookSecret:'replacement-hook',mode:'test',usdApproved:true});await service.withPayment('store-a',binding.version,p=>p.checkConnection());assert.equal(calls.at(-1).secret,'FLWSECK_TEST-private');service.remove('store-a','flutterwave');await service.withPayment('store-a',binding.version,p=>p.checkConnection());assert.equal(calls.at(-1).secret,'FLWSECK_TEST-private');assert.ok(!JSON.stringify(db.prepare('SELECT * FROM merchant_payment_bindings').all()).includes('FLWSECK_TEST-private'));
 const original=db.prepare("SELECT envelope FROM merchant_connections WHERE store_id='store-a' AND provider='cj'").get();db.prepare("UPDATE merchant_connections SET envelope=? WHERE store_id='store-b' AND provider='cj'").run(original.envelope);await assert.rejects(()=>service.search('store-b','shirt'),e=>e.status===503);
 await assert.rejects(()=>createMerchantConnections({db,env:{PLATFORM_SECRET_KEY:'cd'.repeat(32)},cjFactory,paymentFactory}).search('store-a','shirt'),e=>e.status===503);
 const damaged=JSON.parse(original.envelope);damaged.tag='00'.repeat(16);db.prepare("UPDATE merchant_connections SET envelope=? WHERE store_id='store-a' AND provider='cj'").run(JSON.stringify(damaged));await assert.rejects(()=>service.search('store-a','shirt'),e=>e.status===503);
 service.save('store-a','cj',{apiKey:'private-a'});assert.equal(service.status('store-a').connections.find(c=>c.provider==='cj').verifiedAt,null);service.remove('store-a','cj');assert.equal(service.status('store-a').connections.find(c=>c.provider==='cj').connected,false);await assert.rejects(()=>service.search('store-a','shirt'),e=>e.status===422);
 console.log('PASS: encrypted credentials, status redaction, store-bound authenticated encryption, missing/wrong keys, tamper rejection, separate provider clients, read checks, hidden CJ drafts and concurrent connection-change protection.');
}finally{db.close();}
