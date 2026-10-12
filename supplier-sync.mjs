import {randomUUID} from 'node:crypto';
export function createSupplierSync({db,cj,now=Date.now}){
 db.exec('CREATE TABLE IF NOT EXISTS supplier_config(id INTEGER PRIMARY KEY CHECK(id=1),document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS supplier_jobs(id TEXT PRIMARY KEY,document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS supplier_costs(id TEXT PRIMARY KEY,document TEXT NOT NULL);');
 const defaults={enabled:false,intervalMinutes:60,autoPrice:false,markup:100};
 const config=()=>({...defaults,...JSON.parse(db.prepare('SELECT document FROM supplier_config WHERE id=1').get()?.document||'{}')});
 const jobs=()=>db.prepare('SELECT document FROM supplier_jobs ORDER BY rowid DESC LIMIT 30').all().map(r=>JSON.parse(r.document));
 const saveJob=j=>db.prepare('INSERT INTO supplier_jobs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document').run(j.id,JSON.stringify(j));
 // Interrupted stock reads can safely resume; this queue never purchases anything.
 for(const row of db.prepare('SELECT document FROM supplier_jobs').all()){const j=JSON.parse(row.document);if(j.state==='running'){j.state='queued';j.nextAt=now();saveJob(j);}}
 let busy=false,timer;
 const linked=()=>db.prepare('SELECT document FROM products').all().map(r=>JSON.parse(r.document)).filter(p=>p.supplier?.provider==='cj'&&p.variants?.length);
 function configure(value){if(typeof value.enabled!=='boolean'||typeof value.autoPrice!=='boolean'||!Number.isInteger(value.intervalMinutes)||value.intervalMinutes<30||value.intervalMinutes>1440||!Number.isFinite(value.markup)||value.markup<0||value.markup>1000)throw Object.assign(new Error('Invalid sync settings'),{status:422});if(value.enabled&&!cj.configured)throw Object.assign(new Error('Configure CJ_API_KEY before enabling automatic sync'),{status:503});const cfg={enabled:value.enabled,intervalMinutes:value.intervalMinutes,autoPrice:value.autoPrice,markup:value.markup};db.prepare('INSERT INTO supplier_config VALUES(1,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document').run(JSON.stringify(cfg));return cfg;}
 function enqueue(){if(!cj.configured)throw Object.assign(new Error('Configure CJ_API_KEY before syncing'),{status:503});const active=jobs().find(j=>['queued','running','retry'].includes(j.state));if(active)return active;if(!linked().length)throw Object.assign(new Error('Import a CJ product before syncing'),{status:422});const j={id:randomUUID(),state:'queued',attempts:0,createdAt:now(),nextAt:now(),result:null};saveJob(j);return j;}
 async function run(){if(busy)return;const j=jobs().find(j=>['queued','retry'].includes(j.state)&&j.nextAt<=now());if(!j)return;busy=true;j.state='running';j.attempts++;saveJob(j);const result={products:0,options:0,paused:0,costChanges:0,errors:0};try{
  const cfg=config();for(const snapshot of linked()){
   const updates=new Map(),costs={};for(const v of snapshot.variants){try{const data=await cj.variant(v.id);updates.set(v.id,{...data});costs[v.id]=data.cost;result.options++;}catch{updates.set(v.id,{error:true});result.errors++;}}
   // Re-read after requests so an owner edit or deletion is respected.
   const current=db.prepare('SELECT document FROM products WHERE id=?').get(snapshot.id);if(!current)continue;const p=JSON.parse(current.document);if(p.supplier?.productId!==snapshot.supplier.productId)continue;
   const previous=JSON.parse(db.prepare('SELECT document FROM supplier_costs WHERE id=?').get(p.id)?.document||'{}');let hasError=false;
   for(const v of p.variants||[]){const data=updates.get(v.id);if(!data||data.error){if(!data)result.errors++;v.inStock=false;result.paused++;hasError=true;continue;}if(previous[v.id]!==undefined&&previous[v.id]!==data.cost)result.costChanges++;if(cfg.autoPrice){const price=Math.round(data.cost*(1+cfg.markup/100)*100)/100;if(price>10000){v.inStock=false;hasError=true;result.paused++;result.errors++;continue;}p.prices[v.id]=price;}v.inStock=data.quantity>0&&p.prices[v.id]>data.cost;if(!v.inStock)result.paused++;}
   p.supplierSync={checkedAt:now(),staleAfter:now()+cfg.intervalMinutes*3*60000,status:hasError?'needs_attention':'synced'};db.prepare('UPDATE products SET document=? WHERE id=?').run(JSON.stringify(p),p.id);db.prepare('INSERT INTO supplier_costs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document').run(p.id,JSON.stringify({...previous,...costs}));result.products++;
  }
  j.result=result;j.finishedAt=now();j.state=result.errors?(j.attempts<3?'retry':'failed'):'done';j.nextAt=now()+j.attempts*60000;saveJob(j);
 }catch{j.state=j.attempts<3?'retry':'failed';j.nextAt=now()+j.attempts*60000;j.result={...result,errors:result.errors+1};saveJob(j);}finally{busy=false;}}
 function tick(){const cfg=config(),latest=jobs()[0];if(cfg.enabled&&cj.configured&&linked().length&&(!latest||now()-latest.createdAt>=cfg.intervalMinutes*60000))enqueue();return run();}
 return {config,configure,jobs,enqueue,run,tick,status:()=>({config:config(),linkedProducts:linked().length,jobs:jobs(),running:busy}),start(){timer=setInterval(()=>tick().catch(()=>{}),10000);timer.unref();tick().catch(()=>{});},stop(){clearInterval(timer);}};
}
