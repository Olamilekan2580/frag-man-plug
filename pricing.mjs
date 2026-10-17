/* Deterministic pricing / margin engine. No AI, no network. Pure arithmetic.
   retail = (cost + shipping + fees + refund reserve) / (1 - target margin),
   charm-rounded to a .99 / 9,999-style price. The engine never sets a price
   below the margin floor; the LLM (ai-client) may suggest a band, but this
   module sets the final price. All money is integer cents. */
const failure=(status,message)=>Object.assign(new Error(message),{status});
function cents(value,name){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100000000)throw failure(422,`Invalid ${name}`);return Math.round(value*100);}
function rate(value,name,allowZero=true){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>=1||(!allowZero&&value===0))throw failure(422,`Invalid ${name}`);return value;}
export function charmRound(centsValue,style='usd'){
 if(!Number.isSafeInteger(centsValue)||centsValue<0)throw failure(422,'Invalid price');
 if(style==='ngn'){const naira=Math.ceil(centsValue/100);const rounded=Math.ceil(naira/100)*100-1;return Math.max(99,rounded)*100;}
 const dollars=centsValue/100;
 if(dollars<=10)return Math.ceil(dollars)-0.01>0?Math.round((Math.ceil(dollars)-0.01)*100):99;
 return Math.round((Math.floor(dollars)+0.99)*100);
}
export function priceFor(input){
 const cost=cents(input.cost,'supplier cost'),shipping=cents(input.shipping??0,'shipping');
 const feeRate=rate(input.feeRate??0,'payment fee rate'),feeFixed=cents(input.feeFixed??0,'payment fee fixed');
 const reserveRate=rate(input.refundReserveRate??0,'refund reserve rate'),margin=rate(input.targetMargin,'target margin',false);
 const fixed=cost+shipping+feeFixed,denominator=1-margin-feeRate-reserveRate;
 if(denominator<=0)throw failure(422,'Margin + fees + reserve must stay below 100%');
 const raw=fixed/denominator;
 if(!Number.isFinite(raw)||raw<=0||raw>100000000)throw failure(422,'Price out of range');
 return {cents:charmRound(Math.ceil(raw),input.currency==='NGN'?'ngn':'usd'),breakdown:{cost,shipping,feeFixed,feeRate,reserveRate,margin,rawCents:Math.ceil(raw)}};
}
export function marginFor({retail, cost, shipping=0, feeRate=0, feeFixed=0, refundReserveRate=0}){
 const r=cents(retail,'retail price'),c=cents(cost,'supplier cost'),s=cents(shipping,'shipping'),f=cents(feeFixed,'payment fee fixed');
 rate(feeRate,'payment fee rate');rate(refundReserveRate,'refund reserve rate');
 if(r<=0)throw failure(422,'Retail price must be positive');
 const fees=r*feeRate+f,net=r-c-s-fees-r*refundReserveRate;
 return {cents:Math.round(net),margin:net/r,belowFloor:null};
}
export function applyRules({cost, shipping=0, rules={}}){
 const r={feeRate:rules.feeRate??0.029,feeFixed:rules.feeFixed??0,refundReserveRate:rules.refundReserveRate??0.02,targetMargin:rules.targetMargin??0.4,currency:rules.currency||'USD'};
 const priced=priceFor({cost,shipping,...r});
 const floor=r.targetMargin;
 const actual=marginFor({retail:priced.cents/100,cost,shipping,feeRate:r.feeRate,feeFixed:r.feeFixed,refundReserveRate:r.refundReserveRate});
 return {...priced,retail:priced.cents/100,margin:actual.margin,meetsFloor:actual.margin>=floor-1e-9,rules:r};
}
export function validateRules(rules={}){
 if(typeof rules!=='object'||rules===null)throw failure(422,'Invalid pricing rules');
 const out={feeRate:rules.feeRate??0.029,feeFixed:rules.feeFixed??0,refundReserveRate:rules.refundReserveRate??0.02,targetMargin:rules.targetMargin??0.4,currency:rules.currency||'USD'};
 rate(out.feeRate,'payment fee rate');cents(out.feeFixed,'payment fee fixed');rate(out.refundReserveRate,'refund reserve rate');rate(out.targetMargin,'target margin',false);
 if(!['USD','NGN'].includes(out.currency))throw failure(422,'Currency must be USD or NGN');
 return out;
}
