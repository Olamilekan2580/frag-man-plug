// Optional address-based US sales-tax calculation. Configure real origin/nexus data.
export function createTax({token=process.env.TAXJAR_API_TOKEN||'',originJSON=process.env.TAXJAR_ORIGIN_JSON||'',sandbox=process.env.TAXJAR_SANDBOX==='true',fetcher=fetch}={}){
  let origin;try{origin=JSON.parse(originJSON);}catch{}
  const configured=!!token&&origin?.country==='US'&&/^[A-Z]{2}$/.test(origin.state||'')&&/^\d{5}(?:-\d{4})?$/.test(origin.zip||'');
  return {requested:!!token,configured,sandbox,async calculate(lines,address,shippingCents){
    if(!configured)throw Object.assign(new Error('Address-based tax calculation needs a configured shipping origin'),{status:503});
    const payload={from_country:origin.country,from_state:origin.state,from_zip:origin.zip,from_city:origin.city||'',from_street:origin.street||'',
      to_country:'US',to_state:address.state,to_zip:address.zip,to_city:address.city,to_street:address.line1,
      amount:lines.reduce((n,l)=>n+l.unitCents*l.qty,0)/100,shipping:shippingCents/100,
      line_items:lines.map((l,i)=>({id:String(i),quantity:l.qty,unit_price:l.unitCents/100,...(l.taxCode?{product_tax_code:l.taxCode}:{})}))};
    const response=await fetcher('https://'+(sandbox?'api.sandbox.taxjar.com':'api.taxjar.com')+'/v2/taxes',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','x-api-version':'2022-01-24'},body:JSON.stringify(payload)});
    const data=await response.json(),amount=data.tax?.amount_to_collect;
    if(!response.ok||typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>payload.amount+payload.shipping)throw Object.assign(new Error('Tax calculation is temporarily unavailable. Please try again.'),{status:502});
    return Math.round(amount*100);
  }};
}
