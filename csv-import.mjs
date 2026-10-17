/* CSV / feed import adapter — the no-key fallback distributor.
   A supplier spreadsheet/CSV becomes Vegarance drafts in the same shape as
   cj.draft / printful.draft, so the owner can import any supplier's list
   without an API key. Nothing is purchased and nothing is saved here;
   the caller decides what to import. Strict validation: one bad row fails
   the whole import, never silently. */
const failure=(status,message)=>Object.assign(new Error(message),{status});
const CATEGORIES=['Fragrance','Beauty','Fashion','Accessories','Home'];
function parseLine(line){
 const out=[];let cur='',quoted=false;
 for(let i=0;i<line.length;i++){const ch=line[i];
  if(quoted){if(ch==='"'){if(line[i+1]==='"'){cur+='"';i++;}else quoted=false;}else cur+=ch;}
  else if(ch==='"')quoted=true;
  else if(ch===','){out.push(cur);cur='';}
  else cur+=ch;
 }
 if(quoted)throw failure(422,'CSV has an unterminated quoted field');
 out.push(cur);return out;
}
export function parseCSV(text){
 if(typeof text!=='string'||!text.trim())throw failure(422,'CSV is empty');
 if(text.length>2_000_000)throw failure(422,'CSV is too large (max 2 MB)');
 const lines=text.replace(/\r\n?/g,'\n').split('\n').filter(l=>l.trim());
 if(lines.length<2)throw failure(422,'CSV needs a header row and at least one product row');
 const header=parseLine(lines[0]).map(h=>h.trim().toLowerCase());
 const required=['name','brand','category','variant_label','sku','cost','price'];
 for(const col of required)if(!header.includes(col))throw failure(422,`CSV header is missing "${col}"`);
 const idx=col=>header.indexOf(col);
 const groups=new Map();
 for(let r=1;r<lines.length;r++){
  const cells=parseLine(lines[r]);
  if(cells.length!==header.length)throw failure(422,`CSV row ${r+1} has ${cells.length} fields, expected ${header.length}`);
  const get=col=>cells[idx(col)]?.trim()??'';
  const name=get('name'),brand=get('brand'),category=get('category');
  if(!name||name.length>160)throw failure(422,`CSV row ${r+1}: invalid name`);
  if(!brand||brand.length>80)throw failure(422,`CSV row ${r+1}: invalid brand`);
  if(!CATEGORIES.includes(category))throw failure(422,`CSV row ${r+1}: category must be one of ${CATEGORIES.join(', ')}`);
  const label=get('variant_label'),sku=get('sku');
  if(!label||label.length>160)throw failure(422,`CSV row ${r+1}: invalid variant label`);
  if(sku.length>100)throw failure(422,`CSV row ${r+1}: invalid sku`);
  const cost=Number(get('cost')),price=Number(get('price'));
  if(!Number.isFinite(cost)||cost<=0||cost>100000)throw failure(422,`CSV row ${r+1}: invalid cost`);
  if(!Number.isFinite(price)||price<=0||price>10000)throw failure(422,`CSV row ${r+1}: invalid price`);
  if(price<=cost)throw failure(422,`CSV row ${r+1}: price must be above supplier cost`);
  const key=name+'\u0000'+brand+'\u0000'+category;
  if(!groups.has(key))groups.set(key,{name,brand,category,line:get('line')||'',blurb:get('blurb')||'',image:get('image')||'',variants:[],prices:{}});
  const g=groups.get(key);
  if(g.variants.some(v=>v.label===label))throw failure(422,`CSV row ${r+1}: duplicate variant "${label}" for "${name}"`);
  const id='csv-'+g.variants.length+'-'+Buffer.from(label).toString('hex').slice(0,12);
  g.variants.push({id,label,sku,inStock:true,cost});
  g.prices[id]=Math.round(price*100)/100;
 }
 const drafts=[];
 for(const g of groups.values()){
  if(g.variants.length>100)throw failure(422,`"${g.name}" has more than 100 variants`);
  drafts.push({name:g.name,brand:g.brand,category:g.category,line:g.line,blurb:g.blurb,image:/^https:\/\//.test(g.image)?g.image:'',inStock:true,variants:g.variants,prices:g.prices,supplier:{provider:'csv',productId:'csv:'+Buffer.from(g.name).toString('hex').slice(0,16)},madeToOrder:false});
 }
 return drafts;
}
export function createCSVImport(){return {configured:true,parse:parseCSV};}
