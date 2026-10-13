// Explicit test-only preload. Normal npm start never loads this module.
const fixtureTransactions=new Map();let fixtureTransactionId=9000;
globalThis.fetch=async(url,options={})=>{
 const target=new URL(url),ok=data=>new Response(JSON.stringify({code:200,result:true,data}),{status:200,headers:{'Content-Type':'application/json'}});
 if(target.hostname==='api.flutterwave.com'&&target.pathname==='/v3/payments'){const order=JSON.parse(options.body);fixtureTransactions.set(order.tx_ref,{id:++fixtureTransactionId,tx_ref:order.tx_ref,status:'successful',currency:order.currency,amount:Number(order.amount),customer:{email:order.customer.email}});return new Response(JSON.stringify({status:'success',data:{link:'https://checkout.flutterwave.com/mock-'+order.tx_ref}}),{status:200});}
 if(target.hostname==='api.flutterwave.com'&&target.pathname==='/v3/transactions/verify_by_reference')return new Response(JSON.stringify({status:'success',data:fixtureTransactions.get(target.searchParams.get('tx_ref'))}),{status:200});
 if(target.pathname.endsWith('/logistic/freightCalculate'))return ok([{logisticName:'Test US Shipping',logisticPrice:6.95,logisticAging:'3–5 days'}]);
 if(target.hostname==='api.flutterwave.com'&&target.pathname==='/v3/transactions')return new Response(JSON.stringify({status:'success',data:[]}),{status:200});
 if(target.hostname!=='developers.cjdropshipping.com')throw new Error('Unexpected outbound test request');
 if(target.pathname.endsWith('/authentication/getAccessToken'))return ok({accessToken:'mock-cj-token',accessTokenExpiryDate:new Date(Date.now()+3600000).toISOString()});
 if(target.pathname.endsWith('/product/listV2'))return ok({totalRecords:1,content:[{productList:[{id:'fixture-shirt',nameEn:'Supplier Test Shirt',bigImage:'',sellPrice:10,warehouseInventoryNum:20,oneCategoryName:'Fashion'}]}]});
 if(target.pathname.endsWith('/product/variant/queryByVid'))return ok({vid:target.searchParams.get('vid'),variantSellPrice:target.searchParams.get('vid')==='fixture-medium'?10:12,inventories:[{countryCode:'US',verifiedWarehouse:'1',totalInventory:20}]});
 if(target.pathname.endsWith('/product/query'))return ok({productNameEn:'Supplier Test Shirt',bigImage:'',variants:[{vid:'fixture-medium',variantKey:'Medium',variantSku:'FIX-M',variantSellPrice:10},{vid:'fixture-large',variantKey:'Large',variantSku:'FIX-L',variantSellPrice:12}]});
 throw new Error('Unexpected CJ test endpoint');
};
