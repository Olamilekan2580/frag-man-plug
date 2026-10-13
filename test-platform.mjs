import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'vega-platform-'));let child,base;
async function start(){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,DATA_DIR:dir,PORT:'0',HOST:'127.0.0.1',ADMIN_PASSWORD:'platform-test-owner-password',PLATFORM_SECRET_KEY:'ab'.repeat(32)},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Server startup timeout')),15000);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});child.stdout.on('data',b=>{output+=b;const m=output.match(/listening on (\d+)/);if(m){clearTimeout(timer);base='http://127.0.0.1:'+m[1];resolve();}});});}
async function stop(){if(child&&!child.killed){const exit=new Promise(r=>child.once('exit',r));child.kill();await exit;}}
async function req(path,method='GET',value,cookie='',origin=base){const r=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:value===undefined?undefined:JSON.stringify(value)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const api='/api/platform/',account={name:'Merchant A',email:'merchant-a@example.com',password:'a-long-private-password'},settings={name:'First Store',description:'A merchant collection',supportEmail:'help@example.com',accent:'#235949',published:true},product={name:'Independent Product',description:'One store only',image:'',priceCents:4599,visible:true};
try{await start();assert.equal((await req(api+'stores')).status,401);assert.equal((await req(api+'signup','POST',account,'','https://evil.example')).status,403);assert.equal((await req(api+'signup','POST',{...account,password:'short'})).status,422);
 const a=await req(api+'signup','POST',account);assert.equal(a.status,201);assert.ok(a.cookie);assert.equal((await req(api+'session','GET',undefined,a.cookie)).data.merchant.email,account.email);assert.equal((await req('/api/sales','GET',undefined,a.cookie)).status,401);
 const b=await req(api+'signup','POST',{...account,email:'merchant-b@example.com',name:'Merchant B'});assert.equal(b.status,201);
 const s=await req(api+'stores','POST',{name:'First Store',slug:'first-store'},a.cookie);assert.equal(s.status,201);const sid=s.data.id;assert.equal((await req(api+'public/first-store')).status,404);
 assert.equal((await req(api+'stores','GET',undefined,b.cookie)).data.length,0);assert.equal((await req(api+'stores/'+sid,'GET',undefined,b.cookie)).status,404);assert.equal((await req(api+'stores/'+sid,'PUT',settings,b.cookie)).status,404);
 const duplicate=await req(api+'stores','POST',{name:'Duplicate',slug:'first-store'},b.cookie);assert.equal(duplicate.status,409);
 assert.equal((await req(api+'stores/'+sid+'/connections','GET',undefined,b.cookie)).status,404);
 assert.equal((await req(api+'stores/'+sid+'/connections/cj','PUT',{apiKey:'private-cj-a'},b.cookie)).status,404);
 const conn=await req(api+'stores/'+sid+'/connections/cj','PUT',{apiKey:'private-cj-a'},a.cookie);assert.equal(conn.status,200);assert.ok(!JSON.stringify(conn.data).includes('private-cj-a'));assert.equal(conn.data.connections.find(c=>c.provider==='cj').connected,true);
 assert.equal((await req(api+'stores/'+sid+'/sales','GET',undefined,b.cookie)).status,404);assert.equal((await req(api+'stores/'+sid+'/orders','GET',undefined,b.cookie)).status,404);assert.equal((await req(api+'stores/'+sid+'/sales','GET',undefined,a.cookie)).status,200);
 assert.equal((await req(api+'public/first-store/quote','POST',{items:[],address:{}},a.cookie)).status,503);
 assert.equal((await req(api+'stores/'+sid+'/inventory','GET',undefined,b.cookie)).status,404);
 assert.equal((await req(api+'stores/'+sid+'/inventory/sync','POST',{},b.cookie)).status,404);
 assert.equal((await req(api+'stores/'+sid+'/inventory/settings','PUT',{enabled:true,intervalMinutes:60},b.cookie)).status,404);
 assert.equal((await req(api+'stores/'+sid+'/suppliers/cj/search?q=shirt','GET',undefined,b.cookie)).status,404);
 assert.equal((await req(api+'stores/'+sid+'/suppliers/cj/import','POST',{productId:'p',category:'Fashion',markup:100},b.cookie)).status,404);
 const p=await req(api+'stores/'+sid+'/products','POST',product,a.cookie);assert.equal(p.status,201);const pid=p.data.id;
 const second=await req(api+'stores','POST',{name:'Second',slug:'second-store'},b.cookie);assert.equal(second.status,201);
 assert.equal((await req(api+'stores/'+sid+'/products/'+pid,'PUT',product,b.cookie)).status,404);
 assert.equal((await req(api+'stores/'+second.data.id+'/products/'+pid,'DELETE',undefined,b.cookie)).status,404);
 assert.equal((await req(api+'stores/'+sid+'/products','POST',{...product,image:'javascript:alert(1)'},a.cookie)).status,422);
 assert.equal((await req(api+'stores/'+sid+'/products','POST',{...product,priceCents:1.1},a.cookie)).status,422);
 assert.equal((await req(api+'stores/'+sid,'PUT',settings,a.cookie)).status,200);
 const publicStore=await req(api+'public/first-store');assert.equal(publicStore.data.products.length,1);assert.equal(publicStore.data.store.checkoutEnabled,false);assert.equal(publicStore.data.merchant,undefined);assert.equal(publicStore.data.store.merchant_id,undefined);assert.equal((await fetch(base+'/shops/first-store')).status,200);
 await req(api+'stores/'+sid+'/products/'+pid,'PUT',{...product,visible:false},a.cookie);assert.equal((await req(api+'public/first-store')).data.products.length,0);
 await stop();await start();assert.equal((await req(api+'session','GET',undefined,a.cookie)).data.merchant.email,account.email);assert.equal((await req(api+'stores/'+sid,'GET',undefined,a.cookie)).data.products[0].priceCents,4599);
 assert.equal((await req(api+'login','POST',{...account,password:'another-long-wrong-password'})).status,401);const login=await req(api+'login','POST',account);assert.equal(login.status,200);
 await req(api+'logout','POST',{},a.cookie);assert.equal((await req(api+'stores','GET',undefined,a.cookie)).status,401);assert.equal((await req(api+'stores','GET',undefined,login.cookie)).status,200);
 console.log('PASS: merchant signup/login/logout, persisted sessions/stores, unique URLs, cross-merchant and cross-store isolation, legacy owner separation, public catalog visibility, validation and CSRF.');
}finally{await stop();rmSync(dir,{recursive:true,force:true});}
