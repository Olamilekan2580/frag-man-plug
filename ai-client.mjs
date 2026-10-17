/* Provider-agnostic AI copy client. OpenAI-compatible chat completions
   (Groq default, OpenAI by changing base URL + key). Server-only.
   The model NEVER invents specs: it only rewrites the supplied facts.
   Output is validated: banned delivery/stock claims are rejected, and any
   response that fails validation is a 502, never saved. When no key is
   configured every method throws 503 with an honest not-configured message. */
import {buildTrendPrompt,validateTrendSummary,TREND_DISCLAIMER} from './trend-scoring.mjs';
const API_DEFAULT='https://api.groq.com/openai/v1';
const BANNED=[/in stock in nigeria/i,/next[- ]day delivery/i,/same[- ]day delivery/i,/guaranteed delivery/i,/official (product|store|distributor)/i,/\b100% (authentic|genuine|original)\b/i,/free shipping worldwide/i,/ships (today|tomorrow|immediately)/i];
const MAX_IN=4000,MAX_OUT=1500;
export function createAI({apiKey=process.env.AI_API_KEY||'',baseUrl=process.env.AI_BASE_URL||API_DEFAULT,model=process.env.AI_MODEL||'llama-3.1-8b-instant',fetcher=fetch}={}){
 const failure=(status,message)=>Object.assign(new Error(message),{status});
 const configured=!!apiKey;
 function checkText(text,field){if(typeof text!=='string'||!text.trim())throw failure(422,`Missing ${field}`);if(text.length>MAX_IN)throw failure(422,`${field} is too long`);return text.trim();}
 async function complete({system,prompt}){
  if(!configured)throw failure(503,'Configure AI_API_KEY privately on Render to use AI copy.');
  let response,data;
  try{response=await fetcher(baseUrl.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:prompt}],temperature:0.3,max_tokens:MAX_OUT}),signal:AbortSignal.timeout(30000)});data=await response.json();}catch{throw failure(502,'AI provider is temporarily unavailable. Try again later.');}
  if(!response.ok)throw failure(502,'AI provider rejected the request. Check the key and model, then try again.');
  const text=data?.choices?.[0]?.message?.content;
  if(typeof text!=='string'||!text.trim())throw failure(502,'AI provider returned no text.');
  return text;
 }
 function extractJson(text){
  const start=text.indexOf('{');const end=text.lastIndexOf('}');
  if(start<0||end<=start)throw failure(502,'AI response was not valid JSON.');
  try{return JSON.parse(text.slice(start,end+1));}catch{throw failure(502,'AI response was not valid JSON.');}
 }
 function validateCopy(copy){
  const fields=['title','shortDescription','longDescription','bullets','keywords','metaDescription'];
  for(const f of fields)if(copy[f]===undefined)throw failure(502,`AI response is missing ${f}.`);
  if(typeof copy.title!=='string'||!copy.title.trim()||copy.title.length>160)throw failure(502,'AI title is invalid.');
  if(typeof copy.shortDescription!=='string'||!copy.shortDescription.trim()||copy.shortDescription.length>300)throw failure(502,'AI short description is invalid.');
  if(typeof copy.longDescription!=='string'||!copy.longDescription.trim()||copy.longDescription.length>1600)throw failure(502,'AI long description is invalid.');
  if(!Array.isArray(copy.bullets)||copy.bullets.length<2||copy.bullets.length>8||copy.bullets.some(b=>typeof b!=='string'||!b.trim()||b.length>200))throw failure(502,'AI bullets are invalid.');
  if(!Array.isArray(copy.keywords)||copy.keywords.length<3||copy.keywords.length>12||copy.keywords.some(k=>typeof k!=='string'||!k.trim()||k.length>60))throw failure(502,'AI keywords are invalid.');
  if(typeof copy.metaDescription!=='string'||!copy.metaDescription.trim()||copy.metaDescription.length>160)throw failure(502,'AI meta description is invalid.');
  const joined=[copy.title,copy.shortDescription,copy.longDescription,...copy.bullets,copy.metaDescription].join(' ');
  for(const pattern of BANNED)if(pattern.test(joined))throw failure(502,'AI response made a delivery or authenticity claim it must not make.');
  return {title:copy.title.trim(),shortDescription:copy.shortDescription.trim(),longDescription:copy.longDescription.trim(),bullets:copy.bullets.map(b=>b.trim()),keywords:copy.keywords.map(k=>k.trim()),metaDescription:copy.metaDescription.trim()};
 }
 return {
  configured,model,
  async describe({name,brand='',category='',specs=[],tone='Considered, everyday luxury. Plain, confident, no hype.'}={}){
   const productName=checkText(name,'product name');
   if(typeof brand!=='string'||brand.length>80)throw failure(422,'Invalid brand');
   if(typeof category!=='string'||category.length>80)throw failure(422,'Invalid category');
   if(!Array.isArray(specs)||specs.some(s=>typeof s!=='string'||s.length>300))throw failure(422,'Invalid specs');
   const specList=specs.length?specs.map(s=>'- '+s.trim()).join('\n'):'- (no supplier specs supplied; describe only the name and category)';
   const system='You write product copy for VEGArance, an online store. Return ONLY a JSON object with keys: title, shortDescription, longDescription, bullets (array of 3-6 strings), keywords (array of 4-10 strings), metaDescription. Never invent specifications: use only the facts in the user message. Never claim stock location, delivery speed, authenticity, warranty, or a guarantee. Never mention a supplier brand name. Keep the tone in the user message.';
   const prompt=`Product name: ${productName}\nBrand: ${brand||'(none)'}\nCategory: ${category||'(none)'}\nTone: ${tone}\nSupplier facts (use only these):\n${specList}\nWrite the copy now as JSON.`;
   const copy=validateCopy(extractJson(await complete({system,prompt})));
   return {...copy,source:'ai',model};
  },
  /* Trend summary (Phase C): summarises ONLY the supplied scored items.
     Same grounding rule as describe(): the model never sees anything but
     the scores, the summary is validated against guarantee language,
     and the estimate disclaimer is appended server-side. 503 when no
     AI key is configured. */
  async summarizeTrends(scored){
   const prompt=buildTrendPrompt(scored);
   const system='You summarize supplier trend estimates for VEGArance merchants. Use ONLY the figures in the user message. Never predict sales, never guarantee outcomes, never invent figures. Plain text, 120 words or fewer.';
   const summary=validateTrendSummary(await complete({system,prompt}));
   return {summary:summary+'\n\n'+TREND_DISCLAIMER,source:'ai',model};
  },
 };
}
