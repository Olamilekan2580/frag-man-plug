/* Server-only Printful (print-on-demand) connector, CJ-shaped interface.
   Printful API v1: https://api.printful.com, Bearer token, optional
   X-PF-Store-Id for account-level tokens. Responses are {code, result}.
   Printful is NOT CJ Dropshipping and shares no auth with it.
   POD has no stock counts: variant() returns madeToOrder:true and
   quantity:null — callers must treat that as "made to order", not zero.
   createOrder creates a DRAFT order only. Printful charges on explicit
   confirm (dashboard or a later confirm step); this module NEVER confirms
   an order automatically, and payOrder() refuses with 422 for that reason. */
const API='https://api.printful.com/';
export function createPrintful({token=process.env.PRINTFUL_API_TOKEN||'',storeId=process.env.PRINTFUL_STORE_ID||'',fetcher=fetch}={}){
 const failure=(status,message)=>Object.assign(new Error(message),{status});
 const num=(v)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
 async function call(path,{method='GET',body}={}){
  if(!token)throw failure(503,'Configure PRINTFUL_API_TOKEN privately on Render to connect Printful.');
  let response,data;
  try{response=await fetcher(API+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...(storeId?{'X-PF-Store-Id':storeId}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});data=await response.json();}catch{throw failure(502,'Printful is temporarily unavailable. Try again later.');}
  if(!response.ok||data.code!==200)throw failure(response.status===429?429:502,'Printful rejected the request. Check the token, store ID, or try again later.');
  return data.result;
 }
 async function catalogCost(productId,variantId){
  const catalog=await call('products/'+encodeURIComponent(String(productId)));
  const variants=Array.isArray(catalog?.variants)?catalog.variants:[];
  const match=variants.find(v=>String(v.id)===String(variantId));
  const cost=num(match?.price);
  if(cost===null||cost<=0)throw failure(502,'Printful catalog price is incomplete.');
  return cost;
 }
 function toVariant(sv,cost){
  return {id:String(sv.id),label:String(sv.name||'').slice(0,160),sku:String(sv.sku||'').slice(0,100),inStock:true,cost};
 }
 return {
  configured:!!token,
  async search(query,page=1){
   const q=String(query||'').trim();if(!q)throw failure(422,'Enter a search term');
   const offset=Math.max(0,(Math.max(1,page)-1)*100);
   const result=await call(`store/products?limit=100&offset=${offset}`);
   const list=Array.isArray(result)?result:[];
   const found=list.filter(p=>String(p.name||'').toLowerCase().includes(q.toLowerCase()));
   return {page,total:found.length,products:found.slice(0,12).map(p=>({id:String(p.id),name:String(p.name||''),image:/^https:\/\//.test(p.thumbnail_url||'')?p.thumbnail_url:'',cost:null,stock:null,category:'Print on demand',madeToOrder:true}))};
  },
  async draft(id,category,markup){
   if(typeof id!=='string'||!id)throw failure(422,'Invalid Printful product id');
   if(typeof markup!=='number'||!Number.isFinite(markup)||markup<0||markup>1000)throw failure(422,'Invalid markup');
   const detail=await call('store/products/'+encodeURIComponent(id));
   const syncProduct=detail?.sync_product,syncVariants=detail?.sync_variants;
   if(!syncProduct||!Array.isArray(syncVariants)||!syncVariants.length||syncVariants.length>100)throw failure(422,'This Printful product needs manual variant review.');
   const variants=[],prices={};
   for(const sv of syncVariants){
    const productId=sv?.product?.product_id,variantId=sv?.product?.variant_id;
    if(!productId||!variantId)throw failure(422,'Printful option is missing its catalog reference.');
    const cost=await catalogCost(productId,variantId);
    const v=toVariant(sv,cost);variants.push(v);
    prices[v.id]=Math.round(cost*(1+markup/100)*100)/100;
   }
   return {name:String(syncProduct.name||'').slice(0,160),brand:'VEGArance',category,line:'',blurb:'',image:/^https:\/\//.test(syncProduct.thumbnail_url||'')?syncProduct.thumbnail_url:'',inStock:true,variants,prices,supplier:{provider:'printful',productId:String(id)},madeToOrder:true};
  },
  async variant(id){
   if(typeof id!=='string'||!id)throw failure(422,'Invalid Printful variant id');
   const sv=await call('store/variants/'+encodeURIComponent(id));
   const productId=sv?.product?.product_id,variantId=sv?.product?.variant_id;
   if(!productId||!variantId)throw failure(502,'Printful option data is incomplete.');
   const cost=await catalogCost(productId,variantId);
   return {cost,quantity:null,madeToOrder:true};
  },
  async freight(items,destination={}){
   if(!Array.isArray(items)||!items.length||items.length>100)throw failure(422,'Provide 1–100 freight items');
   const country=String(destination.countryCode||'US').toUpperCase();if(!/^[A-Z]{2}$/.test(country))throw failure(422,'Invalid destination country code');
   const zip=String(destination.zip||'');if(!zip||zip.length>20)throw failure(422,'Destination ZIP/postal code is required for a Printful quote');
   const payload={recipient:{country_code:country,state_code:String(destination.stateCode||''),city:String(destination.city||''),zip},items:items.map(it=>{if(!Number.isInteger(it.quantity)||it.quantity<1||it.quantity>99)throw failure(422,'Invalid freight quantity');return {sync_variant_id:Number(it.variantId),quantity:it.quantity};})};
   const result=await call('shipping/rates',{method:'POST',body:payload});
   if(!Array.isArray(result))throw failure(502,'Printful shipping quote is unavailable.');
   return result.filter(r=>typeof r.name==='string'&&r.name).flatMap(r=>{const amount=num(r.rate);if(amount===null||amount<0||amount>1000)return [];return [{name:r.name.slice(0,100),cents:Math.ceil(amount*100),transit:[r.minDeliveryDays,r.maxDeliveryDays].filter(Boolean).join('–')||''}];}).sort((a,b)=>a.cents-b.cents);
  },
  createOrder:payload=>call('orders',{method:'POST',body:{...payload,confirm:false}}),
  payOrder:()=>{throw failure(422,'Printful orders are charged when explicitly confirmed. Confirm in the Printful dashboard; this module never confirms automatically.');},
  async order(id){
   if(typeof id!=='string'||!id)throw failure(422,'Invalid Printful order id');
   const o=await call('orders/'+encodeURIComponent(id));
   const shipments=Array.isArray(o?.shipments)?o.shipments:[];
   return {id:String(o.id),status:String(o.status||''),tracking:shipments.map(s=>({carrier:String(s.carrier||''),trackingNumber:String(s.tracking_number||''),trackingUrl:String(s.tracking_url||'')})).filter(t=>t.trackingNumber),createdAt:o.created||null};
  },
 };
}
