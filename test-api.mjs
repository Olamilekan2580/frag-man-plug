import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'fmp-api-'));let child,base,cookie='';
async function start(){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',DATA_DIR:dir,ADMIN_PASSWORD:'test-owner-password-123'},stdio:['ignore','pipe','pipe']});let output='';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server start timed out')),10000);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/listening on (\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timer);resolve();}});});}
async function stop(){if(child&&!child.killed){const closed=new Promise(resolve=>child.once('exit',resolve));child.kill();await closed;}}
async function req(path,method='GET',value,origin=base){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:value?JSON.stringify(value):undefined});const data=await response.json();return {status:response.status,data,cookie:response.headers.get('set-cookie')};}
try{
 await start();assert.equal((await req('/api/products')).data.length,215);
 assert.equal((await req('/api/suppliers/cj/status')).status,401);
 assert.equal((await req('/api/suppliers/cj/automation')).status,401);
 const input={name:'Integration Test Fragrance',brand:'Test House',line:'Discovery',blurb:'An integration-test product.',image:'',prices:{'3ml':8.5,'5ml':13,'10ml':22},inStock:true};
 assert.equal((await req('/api/products','POST',input)).status,401);
 assert.equal((await req('/api/login','POST',{password:'wrong'})).status,401);
 const login=await req('/api/login','POST',{password:'test-owner-password-123'});assert.equal(login.status,200);cookie=login.cookie.split(';')[0];
 assert.equal((await req('/api/suppliers/cj/status')).data.market,'US');
 assert.equal((await req('/api/suppliers/cj/automation')).data.config.enabled,false);
 assert.equal((await req('/api/suppliers/cj/automation','PUT',{enabled:false,autoPrice:false,intervalMinutes:1,markup:100})).status,422);
 const lifestyle={name:'Linen shirt',brand:'VEGArance',category:'Fashion',inStock:true,variants:[{id:'medium',label:'Ivory / Medium',sku:'SHIRT-M',inStock:true},{id:'large',label:'Ivory / Large',sku:'SHIRT-L',inStock:false}],prices:{medium:45,large:48}};
 assert.equal((await req('/api/products','POST',{...lifestyle,variants:[lifestyle.variants[0],lifestyle.variants[0]]})).status,422);
 const shirt=await req('/api/products','POST',lifestyle);assert.equal(shirt.status,201);assert.equal(shirt.data.category,'Fashion');
 const unverified=await req('/api/products','POST',{...lifestyle,supplier:{provider:'cj',productId:'CJ-shirt'}});assert.equal((await req('/api/orders','POST',{state:'Florida',items:[{productId:unverified.data.id,size:'medium',qty:1}]})).status,422);await req('/api/products/'+unverified.data.id,'DELETE');
 assert.equal((await req('/api/orders','POST',{state:'Florida',items:[{productId:shirt.data.id,size:'large',qty:1}]})).status,422);
 assert.equal((await req('/api/orders','POST',{state:'Florida',items:[{productId:shirt.data.id,size:'3ml',qty:1}]})).status,422);
 const shirtOrder=await req('/api/orders','POST',{state:'Florida',items:[{productId:shirt.data.id,size:'medium',qty:1,price:.01}]});assert.equal(shirtOrder.data.subtotal,45);assert.match(shirtOrder.data.items,/Ivory \/ Medium/);await req('/api/orders/'+shirtOrder.data.id,'DELETE');await req('/api/products/'+shirt.data.id,'DELETE');
 assert.equal((await req('/api/products','POST',input,'https://attacker.example')).status,403);
 assert.equal((await req('/api/products','POST',{...input,name:'   '})).status,422);
 assert.equal((await req('/api/products','POST',{...input,prices:{'3ml':-1,'5ml':1,'10ml':2}})).status,422);
 const created=await req('/api/products','POST',input);assert.equal(created.status,201);const id=created.data.id;
 assert.equal((await req('/api/products/'+id)).data.name,input.name);
 const edited=await req('/api/products/'+id,'PUT',{...input,name:'Updated Fragrance',prices:{'3ml':10.25,'5ml':15,'10ml':25}});assert.equal(edited.data.prices['3ml'],10.25);
 const settings={storeName:'API Test Store',announcement:'Discover scents',shipThreshold:30,supportEmail:''};assert.equal((await req('/api/settings','PUT',settings)).status,200);
 const order=await req('/api/orders','POST',{state:'Florida',items:[{productId:id,size:'3ml',qty:2,price:.01}]});assert.equal(order.status,201);assert.equal(order.data.subtotal,20.5);assert.equal(order.data.total,27.45);
 assert.equal((await req('/api/orders/'+order.data.id,'PATCH',{status:'Shipped'})).data.status,'Shipped');
 await req('/api/products/'+id,'PATCH',{inStock:false});assert.equal((await req('/api/orders','POST',{state:'Florida',items:[{productId:id,size:'3ml',qty:1}]})).status,422);
 await stop();cookie='';await start();assert.equal((await req('/api/products/'+id)).data.inStock,false);assert.equal((await req('/api/catalog')).data.settings.storeName,'API Test Store');
 const secondLogin=await req('/api/login','POST',{password:'test-owner-password-123'});cookie=secondLogin.cookie.split(';')[0];assert.equal((await req('/api/orders')).data.length,1);
 assert.equal((await req('/api/products/'+id,'DELETE')).status,200);assert.equal((await req('/api/products/'+id)).status,404);assert.equal((await req('/api/orders')).data.length,1);
 assert.equal((await req('/api/orders/'+order.data.id,'DELETE')).status,200);assert.equal((await req('/api/orders')).data.length,0);
 await req('/api/logout','POST');assert.equal((await req('/api/products','POST',input)).status,401);
 console.log('PASS: authentication, CSRF, validation, product CRUD, stock, server-calculated demo orders, order update/delete, settings, restart persistence, logout.');
}finally{await stop();rmSync(dir,{recursive:true,force:true});}
