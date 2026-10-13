// Explicitly imported by the browser test only. Never loaded by npm start.
const checkouts=new Map();
globalThis.fetch=async(url,init={})=>{
  const parsed=new URL(url),path=parsed.pathname,body=init.body?JSON.parse(init.body):null;
  const ok=data=>({ok:true,status:200,json:async()=>data});
  if(parsed.hostname==='developers.cjdropshipping.com'){
    let data;
    if(path.endsWith('getAccessToken'))data={accessToken:'fixture-token'};
    else if(path.endsWith('queryByVid'))data={vid:parsed.searchParams.get('vid'),variantSellPrice:22,inventories:[{countryCode:'US',verifiedWarehouse:1,totalInventory:10}]};
    else if(path.endsWith('freightCalculate'))data=[{logisticName:'USPS',logisticPrice:8,logisticAging:'2-5'}];
    else throw new Error('Unexpected CJ test endpoint '+path);
    return ok({code:200,result:true,data});
  }
  if(parsed.hostname==='api.flutterwave.com'){
    if(path.endsWith('/payments')){checkouts.set(body.tx_ref,body);return ok({status:'success',data:{link:'https://checkout.flutterwave.com/test?return='+encodeURIComponent(body.redirect_url)}});}
    if(path.endsWith('verify_by_reference')){const c=checkouts.get(parsed.searchParams.get('tx_ref'));return ok({status:'success',data:{id:123,tx_ref:c.tx_ref,status:'successful',amount:Number(c.amount),currency:c.currency,customer:c.customer}});}
    throw new Error('Unexpected payment test endpoint '+path);
  }
  if(parsed.hostname==='api.resend.com')return ok({id:'fixture-email'});
  throw new Error('Outbound network blocked by test fixture: '+url);
};
