/* Server-only Printify (print-on-demand) connector, CJ-shaped interface.
   Printify API v1: https://api.printify.com/v1, Bearer Personal Access Token,
   shop-scoped paths /shops/{shopId}/... Token scopes needed: shops.read,
   products.read, orders.read, orders.write (orders.write only because
   createOrder posts the order; this module NEVER calls send_to_production).
   Printify is NOT CJ Dropshipping, Printful, or AliExpress and shares no
   auth with them. POD has no stock counts: variant() returns madeToOrder:true
   and quantity:null — callers must treat that as "made to order", not zero.
   Variant ids are composite "productId_variantId" (underscore separator, so
   they pass server.mjs's variant-id check) because a Printify variant id
   alone does not identify its product. createOrder posts the order and stops:
   the order lands On hold under the shop's order-approval settings and this
   module NEVER sends it to production; payOrder() refuses with 422 for that
   reason. IMPORTANT: set the shop's order approval to MANUAL in Printify —
   with auto-approve on, an On-hold order can proceed to production and charge
   on its own. Printify exposes no documented public shipping-quote endpoint
   this adapter can rely on, so freight() refuses with 422 and quotes stay a
   dashboard step. ASSUMPTIONS (see PRINTIFY-SETUP.md): product detail
   carries variants with a numeric `cost`; order detail carries `shipments`
   with carrier/number/url; order creation leaves the order On hold. */
const API='https://api.printify.com/v1/';
export function createPrintify({token=process.env.PRINTIFY_API_TOKEN||'',shopId=process.env.PRINTIFY_SHOP_ID||'',fetcher=fetch}={}){
 const failure=(status,message)=>Object.assign(new Error(message),{status});
 const num=(v)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
 const img=(p)=>{const src=p?.images?.[0]?.src||p?.images?.[0]?.preview||'';return /^https:\/\//.test(src)?src:'';};
 async function call(path,{method='GET',body}={}){
  if(!token)throw failure(503,'Configure PRINTIFY_API_TOKEN privately on Render to connect Printify.');
  if(!shopId)throw failure(503,'Configure PRINTIFY_SHOP_ID privately on Render to connect Printify. Find it in the Printify dashboard or via GET /v1/shops.json.');
  let response,data;
  try{response=await fetcher(API+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});try{data=await response.json();}catch{data=null;}}catch{throw failure(502,'Printify is temporarily unavailable. Try again later.');}
  if(!response.ok){const reason=typeof data?.errors?.reason==='string'?data.errors.reason:typeof data?.message==='string'?data.message:typeof data?.errors==='string'?data.errors:'';throw failure(response.status===429?429:502,'Printify rejected the request'+(reason?' : '+reason.slice(0,200):'. Check the token, shop ID, or try again later.'));}
  return data;
 }
 return {
  configured:!!(token&&shopId),
  async search(query,page=1){
   const q=String(query||'').trim();if(!q)throw failure(422,'Enter a search term');
   const result=await call(`shops/${encodeURIComponent(String(shopId))}/products.json?page=${Math.max(1,page)}&limit=100`);
   const list=Array.isArray(result)?result:Array.isArray(result?.data)?result.data:[];
   const found=list.filter(p=>String(p.title||'').toLowerCase().includes(q.toLowerCase()));
   return {page:Math.max(1,page),total:found.length,products:found.slice(0,12).map(p=>({id:String(p.id),name:String(p.title||''),image:img(p),cost:null,stock:null,category:'Print on demand',madeToOrder:true}))};
  },
  async draft(id,category,markup){
   if(typeof id!=='string'||!id)throw failure(422,'Invalid Printify product id');
   if(typeof markup!=='number'||!Number.isFinite(markup)||markup<0||markup>1000)throw failure(422,'Invalid markup');
   const detail=await call(`shops/${encodeURIComponent(String(shopId))}/products/${encodeURIComponent(id)}.json`);
   const variantsRaw=Array.isArray(detail?.variants)?detail.variants:[];
   const variantsEnabled=variantsRaw.filter(v=>v?.is_enabled!==false);
   if(!detail||!variantsEnabled.length||variantsEnabled.length>100)throw failure(422,'This Printify product needs manual variant review.');
   const variants=[],prices={};
   for(const v of variantsEnabled){
    if(v?.id===undefined||v?.id===null)throw failure(422,'Printify option is missing its id.');
    const cost=num(v.cost);
    if(cost===null||cost<=0)throw failure(502,'Printify variant cost is incomplete.');
    const vid=String(id)+'_'+String(v.id);
    variants.push({id:vid,label:String(v.title||'').slice(0,160),sku:String(v.sku||'').slice(0,100),inStock:true,cost});
    prices[vid]=Math.round(cost*(1+markup/100)*100)/100;
   }
   return {name:String(detail.title||'').slice(0,160),brand:'VEGArance',category,line:'',blurb:'',image:img(detail),inStock:true,variants,prices,supplier:{provider:'printify',productId:String(id)},madeToOrder:true,note:'Printify print-on-demand: confirm this product ships to Nigeria (check the Printify dashboard) before listing it for Nigerian buyers. Fulfilment confirmation stays manual in Printify.'};
  },
  async variant(id){
   if(typeof id!=='string'||!id)throw failure(422,'Invalid Printify variant id');
   const split=id.lastIndexOf('_');
   if(split<=0||split===id.length-1)throw failure(422,'Invalid Printify variant id. Use the productId_variantId form from a Printify draft.');
   const productId=id.slice(0,split),variantId=id.slice(split+1);
   const detail=await call(`shops/${encodeURIComponent(String(shopId))}/products/${encodeURIComponent(productId)}.json`);
   const v=(Array.isArray(detail?.variants)?detail.variants:[]).find(x=>String(x?.id)===variantId);
   if(!v)throw failure(502,'Printify option data is incomplete.');
   const cost=num(v.cost);
   if(cost===null||cost<=0)throw failure(502,'Printify variant cost is incomplete.');
   return {cost,quantity:null,madeToOrder:true};
  },
  async freight(){throw failure(422,'Printify has no documented public shipping-quote endpoint this adapter can rely on. Get the shipping quote in the Printify dashboard when you confirm the order; this adapter never estimates freight.');},
  async createOrder(payload){
   if(!payload||typeof payload!=='object'||Array.isArray(payload))throw failure(422,'Invalid Printify order payload');
   // Posts the order and stops: it lands On hold under the shop's approval
   // settings. This module NEVER calls send_to_production, so it never
   // submits charges on its own. Keep the shop's order approval MANUAL.
   return call(`shops/${encodeURIComponent(String(shopId))}/orders.json`,{method:'POST',body:payload});
  },
  payOrder:()=>{throw failure(422,'Printify orders are confirmed in the Printify dashboard (send to production). This module never confirms or charges an order automatically.');},
  async order(id){
   if(typeof id!=='string'||!id)throw failure(422,'Invalid Printify order id');
   const o=await call(`shops/${encodeURIComponent(String(shopId))}/orders/${encodeURIComponent(id)}.json`);
   const shipments=Array.isArray(o?.shipments)?o.shipments:[];
   return {id:String(o.id),status:String(o.status||''),tracking:shipments.map(s=>({carrier:String(s.carrier||''),trackingNumber:String(s.number||s.tracking_number||''),trackingUrl:String(s.url||s.tracking_url||'')})).filter(t=>t.trackingNumber),createdAt:o.created_at||o.createdAt||null};
  },
 };
}
