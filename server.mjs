import {createPlatform} from './platform.mjs';
import http from 'node:http';
import {createCommerce} from './commerce.mjs';
import {createCJ} from './cj-client.mjs';
import {createSupplierSync} from './supplier-sync.mjs';
const cj=createCJ();
import {readFileSync,existsSync,mkdirSync,writeFileSync,statSync} from 'node:fs';
import {resolve,extname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';

const root=fileURLToPath(new URL('.',import.meta.url));
const data=resolve(process.env.DATA_DIR||resolve(root,'data'));mkdirSync(data,{recursive:true});mkdirSync(resolve(data,'uploads'),{recursive:true});
const fresh=!existsSync(resolve(data,'store.sqlite'));
const db=new DatabaseSync(resolve(data,'store.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,document TEXT NOT NULL);');
if(fresh){const context={};vm.createContext(context);vm.runInContext(readFileSync(resolve(root,'products.js'),'utf8')+';globalThis.seed=PRODUCTS',context);const insert=db.prepare('INSERT INTO products VALUES(?,?)');db.exec('BEGIN');for(const p of context.seed)insert.run(p.id,JSON.stringify({...p,inStock:true}));db.exec('COMMIT');}
const sync=createSupplierSync({db,cj});sync.start();
const commerce=createCommerce({db,cj});commerce.start();
const sessions=new Map(),attempts=new Map();const salt=randomBytes(16),password=process.env.ADMIN_PASSWORD||'',passwordHash=password?scryptSync(password,salt,64):null;
if(password&&password.length<12)throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
const catalog=()=>db.prepare('SELECT document FROM products ORDER BY rowid').all().map(r=>JSON.parse(r.document));
const setting=()=>JSON.parse(db.prepare('SELECT document FROM settings WHERE id=1').get()?.document||'{}');
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function body(req){let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>2_000_000)throw fail(413,'Request too large');parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{throw fail(400,'Invalid JSON');}}
function owner(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('vegarance_owner='))?.slice(16);const session=sessions.get(token);if(!session||session.expires<Date.now()){sessions.delete(token);throw fail(401,'Owner login required');}return token;}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)throw fail(403,'Origin header required');try{if(new URL(origin).host!==req.headers.host)throw 0;}catch{throw fail(403,'Cross-origin write rejected');}}
function product(input,existing=null){
 const p={...existing,...input};const str=(key,max,required=false)=>{if(typeof p[key]!=='string'||p[key].length>max||(required&&!p[key].trim()))throw fail(422,`Invalid ${key}`);p[key]=p[key].trim();};
 str('name',160,true);str('brand',80,true);p.line??='';p.blurb??='';p.image??='';str('line',100);str('blurb',1600);str('image',1_500_000);
 if(p.image&&!(/^images\/[a-zA-Z0-9/_.-]+$/.test(p.image)||/^\/uploads\/[a-f0-9]+\.(png|jpg|webp)$/.test(p.image)||/^https:\/\//.test(p.image)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.image)))throw fail(422,'Use a secure image URL or uploaded image');
 p.category??='Fragrance';if(!['Fragrance','Beauty','Fashion','Accessories','Home'].includes(p.category))throw fail(422,'Invalid category');
 p.taxCode??='';if(typeof p.taxCode!=='string'||(p.taxCode&&!/^\d{5,10}$/.test(p.taxCode)))throw fail(422,'Invalid product tax code');
 if(p.saleReady!==undefined&&typeof p.saleReady!=='boolean')throw fail(422,'Invalid sale approval');
 if(p.saleReady&&(!p.supplier||!p.image||!p.blurb.trim()))throw fail(422,'Approved products need CJ sourcing, an image, and a description');
 if(typeof p.inStock!=='boolean')throw fail(422,'Stock must be true or false');
 let variants;
 if(p.variants!==undefined){if(!Array.isArray(p.variants)||!p.variants.length||p.variants.length>100)throw fail(422,'Provide 1–100 product options');const ids=new Set();variants=p.variants.map(v=>{if(!v||typeof v.id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(v.id)||ids.has(v.id)||typeof v.label!=='string'||!v.label.trim()||v.label.length>160||typeof v.inStock!=='boolean'||(v.sku!==undefined&&(typeof v.sku!=='string'||v.sku.length>100)))throw fail(422,'Invalid or duplicate product option');ids.add(v.id);return {id:v.id,label:v.label.trim(),sku:v.sku||'',inStock:v.inStock};});}
 if(p.category!=='Fragrance'&&!variants)throw fail(422,'Lifestyle products require product options');
 if(!p.prices||typeof p.prices!=='object')throw fail(422,'Prices required');const prices={};for(const size of variants?variants.map(v=>v.id):['3ml','5ml','10ml']){const n=p.prices[size];if(typeof n!=='number'||!Number.isFinite(n)||n<=0||n>10000)throw fail(422,`Invalid ${size} price`);prices[size]=Math.round(n*100)/100;}
 let supplier;if(p.supplier!==undefined){if(!p.supplier||p.supplier.provider!=='cj'||typeof p.supplier.productId!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(p.supplier.productId))throw fail(422,'Invalid supplier reference');supplier={provider:'cj',productId:p.supplier.productId};}
 return {taxCode:p.taxCode,saleReady:p.saleReady===true,...(supplier?{supplier}:{}),...(existing?.supplierSync&&supplier?.productId===existing.supplier?.productId?{supplierSync:existing.supplierSync}:{}),id:existing?.id||'p-'+randomBytes(8).toString('hex'),name:p.name,brand:p.brand,category:p.category,line:p.line,blurb:p.blurb,mono:p.brand.slice(0,3).toUpperCase(),prices,inStock:p.inStock,image:p.image,...(variants?{variants}:{}),badges:[],updatedAt:new Date().toISOString()};
}
const publicRates=new Map();
function publicLimit(req){
 const ip=req.socket.remoteAddress;const prior=publicRates.get(ip);const entry=prior&&prior.until>Date.now()?prior:{count:0,until:Date.now()+60000};entry.count++;publicRates.set(ip,entry);
 if(publicRates.size>10000)for(const [key,value] of publicRates)if(value.until<Date.now())publicRates.delete(key);
 if(entry.count>30)throw fail(429,'Too many requests. Please try again in a minute.');
}
const platform=createPlatform({db,body,send,sameOrigin});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 try{
  const url=new URL(req.url,'http://'+req.headers.host),path=decodeURIComponent(url.pathname),method=req.method;
  if(await platform.route(req,res,url))return;
  if(path==='/api/store-config'&&method==='GET')return send(res,200,commerce.publicConfig());
  if(path==='/api/webhooks/flutterwave'&&method==='POST'){
   let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>1000000)throw fail(413,'Webhook too large');parts.push(chunk);}
   return send(res,200,await commerce.webhook(Buffer.concat(parts),req.headers['verif-hash']));
  }
  if(path==='/api/checkout/quote'&&method==='POST'){sameOrigin(req);publicLimit(req);return send(res,200,await commerce.quote(await body(req)));}
  if(path==='/api/checkout'&&method==='POST'){sameOrigin(req);publicLimit(req);return send(res,201,await commerce.checkout(await body(req)));}
  if(path==='/api/order-status'&&method==='GET')return send(res,200,await commerce.lookup(url.searchParams.get('token')));
  if(path==='/api/order-status/verify'&&method==='POST'){sameOrigin(req);publicLimit(req);return send(res,200,await commerce.lookup((await body(req)).token,true));}
  if(path==='/api/health')return send(res,200,{ok:true,storage:'sqlite'});
  if(path==='/api/session'&&method==='GET'){try{owner(req);return send(res,200,{authenticated:true});}catch{return send(res,200,{authenticated:false,configured:!!password});}}
  if(path==='/api/login'&&method==='POST'){sameOrigin(req);if(!passwordHash)throw fail(503,'Set ADMIN_PASSWORD on the server before owner login');const ip=req.socket.remoteAddress;let rate=attempts.get(ip)||{count:0,until:Date.now()+60000};if(rate.until<Date.now())rate={count:0,until:Date.now()+60000};if(++rate.count>10)throw fail(429,'Too many attempts. Try again in one minute');attempts.set(ip,rate);const b=await body(req);if(typeof b.password!=='string'||b.password.length>200||!timingSafeEqual(scryptSync(b.password,salt,64),passwordHash))throw fail(401,'Incorrect password');const token=randomBytes(32).toString('hex');sessions.set(token,{expires:Date.now()+12*3600000});res.setHeader('Set-Cookie',`vegarance_owner=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${req.headers['x-forwarded-proto']==='https'?'; Secure':''}`);return send(res,200,{authenticated:true});}
  if(path==='/api/logout'&&method==='POST'){sameOrigin(req);sessions.delete(owner(req));res.setHeader('Set-Cookie','vegarance_owner=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
  if(path==='/api/catalog'&&method==='GET')return send(res,200,{products:catalog(),settings:setting()});
  if(path==='/api/products'&&method==='GET')return send(res,200,catalog());
  const match=path.match(/^\/api\/products\/([a-zA-Z0-9_-]+)$/);
  if(match&&method==='GET'){const row=db.prepare('SELECT document FROM products WHERE id=?').get(match[1]);if(!row)throw fail(404,'Product not found');return send(res,200,JSON.parse(row.document));}
  if(path==='/api/orders'&&method==='POST'){
   if(commerce.publicConfig().salesEnabled)throw fail(409,'Use the secure checkout to place an order');
   sameOrigin(req);const b=await body(req);if(!Array.isArray(b.items)||!b.items.length||b.items.length>100||typeof b.state!=='string'||b.state.length>80)throw fail(422,'Invalid demo order');
   const lines=b.items.map(item=>{if(!Number.isInteger(item.qty)||item.qty<1||item.qty>99)throw fail(422,'Invalid quantity');const get=id=>{const row=db.prepare('SELECT document FROM products WHERE id=?').get(String(id));if(!row)throw fail(422,'A product is no longer available');const p=JSON.parse(row.document);if(!p.inStock)throw fail(422,'A product is out of stock');if(p.supplier&&(p.supplierSync?.status!=='synced'||p.supplierSync.staleAfter<Date.now()))throw fail(422,'Supplier availability needs a fresh sync');return p;};if(item.productId){const p=get(item.productId);const option=p.variants?.find(v=>v.id===item.size);if(p.variants?(!option||!option.inStock):!['3ml','5ml','10ml'].includes(item.size))throw fail(422,'Product option is invalid or unavailable');return {name:p.name,size:option?.label||item.size,qty:item.qty,price:p.prices[item.size]};}if(item.baseId&&item.accentId&&item.baseId!==item.accentId&&['70/30','60/40','50/50'].includes(item.ratio)&&['5ml','10ml','30ml'].includes(item.size)){const a=get(item.baseId),c=get(item.accentId);if(a.variants||c.variants||(a.category&&a.category!=='Fragrance')||(c.category&&c.category!=='Fragrance'))throw fail(422,'Only decant fragrances can be blended');return {name:a.name+' × '+c.name,size:item.size+' · '+item.ratio,qty:item.qty,price:{'5ml':25,'10ml':42,'30ml':95}[item.size]};}throw fail(422,'Invalid order item');});
   const subtotal=lines.reduce((n,it)=>n+it.price*it.qty,0),threshold=setting().shipThreshold??75,shipping=subtotal>=threshold?0:6.95,id='DEMO-'+randomBytes(8).toString('hex').toUpperCase();const order={id,customer:'Demo customer · '+b.state,items:lines.map(it=>`${it.name} (${it.size}) ×${it.qty}`).join(' · '),total:Math.round((subtotal+shipping)*100)/100,subtotal,shipping,date:new Date().toISOString().slice(0,10),demo:true,status:'Pending'};db.prepare('INSERT INTO orders VALUES(?,?)').run(id,JSON.stringify(order));return send(res,201,order);
  }
  if(path.startsWith('/api/')){
   owner(req);if(method!=='GET')sameOrigin(req);
   if(path==='/api/sales'&&method==='GET')return send(res,200,commerce.dashboard());
   if(path==='/api/sales'&&method==='PUT')return send(res,200,commerce.configure(await body(req)));
   const emailRetry=path.match(/^\/api\/sales\/emails\/(VEGA-[a-f0-9]+-(?:receipt|shipping|refund))\/retry$/);if(emailRetry&&method==='POST')return send(res,200,commerce.retryEmail(emailRetry[1]));
   if(path==='/api/sales/orders'&&method==='GET')return send(res,200,commerce.orders());
   const salesAction=path.match(/^\/api\/sales\/orders\/(VEGA-[a-f0-9]+)\/(dispatch|fund|refund|tracking|reconcile)$/);
   if(salesAction&&method==='POST')return send(res,200,await commerce.action(salesAction[1],salesAction[2],await body(req)));
   if(path==='/api/suppliers/cj/automation'&&method==='GET')return send(res,200,sync.status());
   if(path==='/api/suppliers/cj/automation'&&method==='PUT')return send(res,200,sync.configure(await body(req)));
   if(path==='/api/suppliers/cj/sync'&&method==='POST'){const job=sync.enqueue();sync.run().catch(()=>{});return send(res,202,job);}
   if(path==='/api/suppliers/cj/status'&&method==='GET')return send(res,200,{configured:cj.configured,market:'US',orderAutomation:false});
   if(path==='/api/suppliers/cj/search'&&method==='GET'){const q=(url.searchParams.get('q')||'').trim();if(!q||q.length>120)throw fail(422,'Enter a search up to 120 characters');return send(res,200,await cj.search(q));}
   if(path==='/api/suppliers/cj/draft'&&method==='POST'){const b=await body(req);if(typeof b.id!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(b.id)||!['Fragrance','Beauty','Fashion','Accessories','Home'].includes(b.category)||typeof b.markup!=='number'||!Number.isFinite(b.markup)||b.markup<0||b.markup>1000)throw fail(422,'Invalid draft request');return send(res,200,await cj.draft(b.id,b.category,b.markup));}
   if(path==='/api/products'&&method==='POST'){const p=product(await body(req));db.prepare('INSERT INTO products VALUES(?,?)').run(p.id,JSON.stringify(p));return send(res,201,p);}
   if(match){const row=db.prepare('SELECT document FROM products WHERE id=?').get(match[1]);if(!row)throw fail(404,'Product not found');if(method==='PATCH'||method==='PUT'){const p=product(await body(req),JSON.parse(row.document));db.prepare('UPDATE products SET document=? WHERE id=?').run(JSON.stringify(p),p.id);return send(res,200,p);}if(method==='DELETE'){db.prepare('DELETE FROM products WHERE id=?').run(match[1]);return send(res,200,{deleted:true,id:match[1]});}}
   if(path==='/api/settings'&&method==='GET')return send(res,200,setting());
   if(path==='/api/orders'&&method==='GET')return send(res,200,db.prepare('SELECT document FROM orders ORDER BY rowid DESC').all().map(r=>JSON.parse(r.document)));
   const orderMatch=path.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)$/);
   if(orderMatch){const row=db.prepare('SELECT document FROM orders WHERE id=?').get(orderMatch[1]);if(!row)throw fail(404,'Order not found');if(method==='DELETE'){db.prepare('DELETE FROM orders WHERE id=?').run(orderMatch[1]);return send(res,200,{deleted:true});}if(method==='PATCH'){const b=await body(req);if(!['Pending','Processing','Shipped','Delivered','Cancelled'].includes(b.status))throw fail(422,'Invalid order status');const order={...JSON.parse(row.document),status:b.status};db.prepare('UPDATE orders SET document=? WHERE id=?').run(JSON.stringify(order),order.id);return send(res,200,order);}if(method==='GET')return send(res,200,JSON.parse(row.document));}
   if(path==='/api/settings'&&method==='PUT'){const b=await body(req);if(typeof b.storeName!=='string'||!b.storeName.trim()||b.storeName.length>60||typeof b.announcement!=='string'||b.announcement.length>120||typeof b.shipThreshold!=='number'||!Number.isFinite(b.shipThreshold)||b.shipThreshold<0||b.shipThreshold>10000||typeof b.supportEmail!=='string'||b.supportEmail.length>80||(b.supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.supportEmail)))throw fail(422,'Invalid store settings');db.prepare('INSERT INTO settings VALUES(1,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document').run(JSON.stringify(b));return send(res,200,b);}
   if(path==='/api/uploads'&&method==='POST'){const b=await body(req);const m=typeof b.image==='string'&&b.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw fail(422,'Upload a PNG, JPEG or WebP image');const image=Buffer.from(m[2],'base64');if(image.length>1_000_000)throw fail(413,'Image must be under 1 MB');const valid=m[1]==='png'?image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?image[0]===255&&image[1]===216:image.subarray(0,4).toString()==='RIFF'&&image.subarray(8,12).toString()==='WEBP';if(!valid)throw fail(422,'Invalid image file');const name=randomBytes(16).toString('hex')+'.'+(m[1]==='jpeg'?'jpg':m[1]);writeFileSync(resolve(data,'uploads',name),image);return send(res,201,{image:'/uploads/'+name});}
   throw fail(404,'Unknown API route');
  }
  if(path==='/products.js'){const publicProducts=catalog();if(!new URL(req.url,'http://'+req.headers.host).searchParams.has('owner')&&commerce.publicConfig().salesEnabled)publicProducts.splice(0,publicProducts.length,...publicProducts.filter(p=>p.saleReady));res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end('const PRODUCTS = '+JSON.stringify(publicProducts).replace(/</g,'\\u003c')+'; const SERVER_SETTINGS = '+JSON.stringify(setting()).replace(/</g,'\\u003c')+'; const SERVER_COMMERCE = '+JSON.stringify(commerce.publicConfig()).replace(/</g,'\\u003c')+';');}
  if(method!=='GET'&&method!=='HEAD')throw fail(405,'Method not allowed');
  const file=path.startsWith('/uploads/')?resolve(data,'uploads',basename(path)):resolve(root,path==='/'?'index.html':/^\/shops\/[a-z0-9-]+$/.test(path)?'merchant-shop.html':path.slice(1));
  if(!file.startsWith(root)&&!file.startsWith(resolve(data,'uploads')+'/'))throw fail(403,'Forbidden');
  if(path.startsWith('/data')||path.startsWith('/.')||['.mjs','.py','.json','.md'].includes(extname(file))||!mime[extname(file)]||!existsSync(file)||!statSync(file).isFile())throw fail(404,'Not found');
  let content=readFileSync(file);if(extname(file)==='.html')content=content.toString().replace('</head>','<meta name="store-mode" content="server"></head>');
  res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':extname(file)==='.html'?'no-store':'public,max-age=300'});res.end(method==='HEAD'?undefined:content);
 }catch(e){send(res,e.status||500,{error:e.status?e.message:'Internal server error'});}
});
server.listen(Number(process.env.PORT||4174),process.env.HOST||'127.0.0.1',()=>console.log('VEGArance server listening on '+server.address().port));
