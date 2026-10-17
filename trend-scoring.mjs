/* Deterministic product-research / trend scoring (Phase C / P1).
   Scores are computed ONLY from supplier data the merchant supplies
   (sales signals, stock, price movement, rating). Nothing is fetched,
   nothing is invented: a missing signal scores neutrally for its
   component, lowers confidence, and is named in the notes. Scores are
   estimates from supplier data, never guarantees of sales — every
   result carries that disclaimer, and the AI summary path appends it
   again. Pure arithmetic: no randomness, no network, same input always
   gives the same score. */
const fail=(status,message)=>Object.assign(new Error(message),{status});
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const BANNED_SUMMARY=[/guarantee/i,/\bwill sell\b/i,/\bcertain(ly)? to sell\b/i,/\b100%\b/i,/\bdefinitely\b/i];
export const TREND_DISCLAIMER='Scores are estimates from supplier data supplied by the merchant — not a guarantee of sales.';
function intOrNull(v,name){if(v===undefined||v===null)return null;if(!Number.isSafeInteger(v)||v<0)throw fail(422,name+' must be a non-negative integer or omitted');return v;}
function numOrNull(v,name,lo,hi){if(v===undefined||v===null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw fail(422,name+' must be between '+lo+' and '+hi+' or omitted');return v;}
export function scoreProduct(signals={}){
 if(!signals||typeof signals!=='object'||Array.isArray(signals))throw fail(422,'Supply supplier signals for trend scoring');
 const salesVolume=intOrNull(signals.salesVolume,'salesVolume');
 const salesTrendPct=numOrNull(signals.salesTrendPct,'salesTrendPct',-100,1000);
 const stockQuantity=intOrNull(signals.stockQuantity,'stockQuantity');
 const priceChangePct=numOrNull(signals.priceChangePct,'priceChangePct',-100,1000);
 const rating=numOrNull(signals.rating,'rating',0,5);
 const reviewCount=intOrNull(signals.reviewCount,'reviewCount');
 const demand=salesVolume===null?0:Math.min(100,100*Math.log10(1+salesVolume)/Math.log10(1+10000));
 const momentum=salesTrendPct===null?50:clamp(50+salesTrendPct*0.5,0,100);
 const availability=stockQuantity===null?50:(stockQuantity===0?0:(stockQuantity<10?40:100));
 const price=priceChangePct===null?50:(priceChangePct<=-10?70:(priceChangePct<=10?90:Math.max(0,90-(priceChangePct-10)*2)));
 const score=Math.round(0.40*demand+0.25*momentum+0.20*availability+0.15*price);
 const confidence=salesVolume!==null&&stockQuantity!==null?'high':(salesVolume!==null?'medium':'low');
 const label=(salesVolume===null&&reviewCount===null)?'Insufficient data':(score>=70?'Rising':(score>=45?'Steady':'Cooling'));
 const notes=[];
 if(salesVolume===null)notes.push('No sales signal supplied — demand scored 0.');
 if(salesTrendPct===null)notes.push('No sales-trend signal supplied — momentum scored neutral (50).');
 if(stockQuantity===null)notes.push('No stock signal supplied — availability scored neutral (50).');
 if(priceChangePct===null)notes.push('No price-movement signal supplied — price scored neutral (50).');
 if(stockQuantity===0)notes.push('Out of stock at the supplier — do not list until restocked.');
 if(priceChangePct!==null&&priceChangePct>10)notes.push('Supplier price rose '+priceChangePct+'% — recheck margin before listing.');
 if(rating!==null)notes.push('Supplier rating '+rating.toFixed(1)+'/5'+(reviewCount!==null?' from '+reviewCount+' reviews':'')+' (context only — not scored).');
 notes.push(TREND_DISCLAIMER);
 return {score,label,confidence,breakdown:{demand:Math.round(demand),momentum:Math.round(momentum),availability:Math.round(availability),price:Math.round(price)},notes};
}
export function rankProducts(items){
 if(!Array.isArray(items)||!items.length||items.length>200)throw fail(422,'Provide 1–200 products with supplier signals');
 const scored=items.map(item=>{
  if(!item||typeof item!=='object'||typeof item.name!=='string'||!item.name.trim()||item.name.length>160)throw fail(422,'Each trend item needs a name of up to 160 characters');
  return {name:item.name.trim(),...scoreProduct(item.signals||{})};
 });
 scored.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
 scored.forEach((item,i)=>{item.rank=i+1;});
 return scored;
}
export function buildTrendPrompt(scored){
 if(!Array.isArray(scored)||!scored.length)throw fail(422,'Score products before summarizing');
 const lines=scored.map(s=>`- ${s.name}: ${s.score}/100 (${s.label}, ${s.confidence} confidence) — demand ${s.breakdown.demand}, momentum ${s.breakdown.momentum}, availability ${s.breakdown.availability}, price ${s.breakdown.price}.`).join('\n');
 return `Summarize these supplier trend estimates for a merchant deciding what to research further. Use ONLY the figures below. Do not predict sales, do not guarantee outcomes, do not invent figures. Plain text, 120 words or fewer.\n${lines}`;
}
export function validateTrendSummary(text){
 if(typeof text!=='string'||!text.trim()||text.length>2000)throw fail(502,'AI trend summary is invalid.');
 const trimmed=text.trim();
 for(const pattern of BANNED_SUMMARY)if(pattern.test(trimmed))throw fail(502,'AI trend summary made a guarantee it must not make.');
 return trimmed;
}
