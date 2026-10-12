/* Shared storefront/admin view of supplier-ready categories and variants. */
const CATEGORIES=['Fragrance','Beauty','Fashion','Accessories','Home'];
const categoryOf=p=>p.category||'Fragrance';
const optionsOf=p=>Array.isArray(p.variants)&&p.variants.length?p.variants.map(v=>({id:v.id,label:v.label,sub:v.sku?`SKU ${v.sku}`:'',inStock:v.inStock!==false})):[{id:'3ml',label:'3ml Decant',sub:'A first impression',inStock:true},{id:'5ml',label:'5ml Decant',sub:'Get to know your scent',inStock:true},{id:'10ml',label:'10ml Decant',sub:'Keep your favorite close',inStock:true}];
const startingPrice=p=>Math.min(...optionsOf(p).map(v=>p.prices[v.id]));
