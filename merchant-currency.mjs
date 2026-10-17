/* Storefront currency display + duties/tax disclosure (Phase C / P1).
   DISPLAY ONLY. Checkout still charges in USD through the store's
   payment provider. A non-USD display currency requires a
   merchant-supplied exchange rate — the platform never invents a rate
   and never fetches one. Duties are never estimated with invented
   rates: either the merchant writes their own duties text
   (dutiesMode 'merchant_configured') or buyers see the standard
   disclaimer that duties/taxes/import fees are not included and may be
   charged on delivery. */
const fail=(status,message)=>Object.assign(new Error(message),{status});
export const CURRENCIES=[
 {code:'USD',symbol:'$',minorUnits:2,name:'US Dollar'},
 {code:'EUR',symbol:'€',minorUnits:2,name:'Euro'},
 {code:'GBP',symbol:'£',minorUnits:2,name:'British Pound'},
 {code:'NGN',symbol:'₦',minorUnits:2,name:'Nigerian Naira'},
 {code:'CAD',symbol:'$',minorUnits:2,name:'Canadian Dollar'},
 {code:'AUD',symbol:'$',minorUnits:2,name:'Australian Dollar'},
 {code:'JPY',symbol:'¥',minorUnits:0,name:'Japanese Yen'},
 {code:'INR',symbol:'₹',minorUnits:2,name:'Indian Rupee'},
 {code:'BDT',symbol:'৳',minorUnits:2,name:'Bangladeshi Taka'},
 {code:'KES',symbol:'KSh',minorUnits:2,name:'Kenyan Shilling'},
 {code:'GHS',symbol:'GH₵',minorUnits:2,name:'Ghanaian Cedi'},
 {code:'ZAR',symbol:'R',minorUnits:2,name:'South African Rand'},
 {code:'CHF',symbol:'CHF',minorUnits:2,name:'Swiss Franc'},
 {code:'AED',symbol:'د.إ',minorUnits:2,name:'UAE Dirham'},
 {code:'BRL',symbol:'R$',minorUnits:2,name:'Brazilian Real'},
 {code:'MXN',symbol:'$',minorUnits:2,name:'Mexican Peso'},
];
const byCode=Object.fromEntries(CURRENCIES.map(c=>[c.code,c]));
export const DISCLAIMER_TEXT='Duties, taxes and import fees are not included in the prices shown. They may be charged by the carrier or customs when your order arrives. No duty rate is estimated here — check with your local customs authority if you need an exact figure.';
export function validateDisplayConfig(input={},previous={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail(422,'Invalid currency settings');
 const displayCurrency=input.displayCurrency!==undefined?input.displayCurrency:(previous.displayCurrency||'USD');
 if(typeof displayCurrency!=='string'||!byCode[displayCurrency])throw fail(422,'Choose a supported display currency');
 const rawRates=input.exchangeRates!==undefined?input.exchangeRates:(previous.exchangeRates||{});
 if(!rawRates||typeof rawRates!=='object'||Array.isArray(rawRates))throw fail(422,'Exchange rates must map currency codes to your own rates');
 const exchangeRates={};
 for(const [code,rate] of Object.entries(rawRates)){
  if(!byCode[code])throw fail(422,'Unsupported currency in exchange rates: '+code);
  if(!Number.isFinite(rate)||rate<=0||rate>1000000)throw fail(422,'Exchange rates must be positive numbers');
  exchangeRates[code]=rate;
 }
 if(displayCurrency!=='USD'&&exchangeRates[displayCurrency]===undefined)throw fail(422,'Supply your own exchange rate for '+displayCurrency+' (units of '+displayCurrency+' per 1 USD). The platform never invents exchange rates.');
 const dutiesMode=input.dutiesMode!==undefined?input.dutiesMode:(previous.dutiesMode||'disclaimer');
 if(!['disclaimer','merchant_configured'].includes(dutiesMode))throw fail(422,'Duties mode must be disclaimer or merchant_configured');
 const rawDisclosure=input.dutiesDisclosure!==undefined?input.dutiesDisclosure:(previous.dutiesDisclosure||'');
 if(typeof rawDisclosure!=='string'||rawDisclosure.length>2000)throw fail(422,'Duties text must be at most 2000 characters');
 const dutiesDisclosure=dutiesMode==='merchant_configured'?rawDisclosure.trim():'';
 if(dutiesMode==='merchant_configured'&&!dutiesDisclosure)throw fail(422,'Write your own duties text when using merchant-configured duties');
 return {displayCurrency,exchangeRates,dutiesMode,dutiesDisclosure};
}
export function formatDisplay(amountCentsUSD,config){
 if(!Number.isSafeInteger(amountCentsUSD)||amountCentsUSD<0)throw fail(422,'Invalid amount');
 const cfg=validateDisplayConfig(config||{},config||{});
 const currency=byCode[cfg.displayCurrency];
 const rate=cfg.displayCurrency==='USD'?1:cfg.exchangeRates[cfg.displayCurrency];
 if(rate===undefined)throw fail(422,'No exchange rate configured for '+cfg.displayCurrency);
 const displayMinor=Math.round((amountCentsUSD/100)*rate*(10**currency.minorUnits));
 const displayAmount=currency.symbol+(displayMinor/(10**currency.minorUnits)).toLocaleString('en-US',{minimumFractionDigits:currency.minorUnits,maximumFractionDigits:currency.minorUnits});
 return {amountCentsUSD,displayCurrency:cfg.displayCurrency,displayMinor,displayAmount,estimated:true,rateUsed:rate,note:'Display only — checkout charges in USD at the payment provider.'};
}
export function dutiesText(config,{destinationCountry=''}={}){
 const cfg=validateDisplayConfig(config||{},config||{});
 if(cfg.dutiesMode==='merchant_configured')return {text:cfg.dutiesDisclosure,source:'merchant_configured'};
 let text=DISCLAIMER_TEXT;
 if(/^[A-Z]{2}$/.test(destinationCountry))text=text.replace('when your order arrives','when your order arrives in '+destinationCountry);
 return {text,source:'disclaimer'};
}
