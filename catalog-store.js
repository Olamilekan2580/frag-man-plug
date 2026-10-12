/* Shared catalog persistence: authenticated API when served by Node, browser demo otherwise. */
const Store={
  server:document.querySelector('meta[name="store-mode"]')?.content==='server',
  settings:typeof SERVER_SETTINGS!=='undefined'?SERVER_SETTINGS:null,
  async request(path,method='GET',value){
    const res=await fetch(path,{method,credentials:'same-origin',headers:value?{'Content-Type':'application/json'}:{},body:value?JSON.stringify(value):undefined});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'Request failed');return data;
  },
  async persist(method,id,value){
    if(this.server){const result=await this.request('/api/products'+(id?'/'+encodeURIComponent(id):''),method,value);if(method==='DELETE')PRODUCTS.splice(PRODUCTS.findIndex(p=>p.id===id),1);else{const index=PRODUCTS.findIndex(p=>p.id===result.id);if(index<0)PRODUCTS.push(result);else PRODUCTS[index]=result;}return result;}
    const next=PRODUCTS.map(p=>({...p}));let result;
    if(method==='DELETE'){const index=next.findIndex(p=>p.id===id);if(index<0)throw new Error('Product not found');next.splice(index,1);}
    else{result={...value,id:id||'p-'+crypto.randomUUID(),mono:value.brand.slice(0,3).toUpperCase(),badges:['Authentic fragrance','Hand-poured']};const index=next.findIndex(p=>p.id===id);if(id&&index<0)throw new Error('Product not found');if(index<0)next.push(result);else next[index]=result;}
    try{localStorage.setItem('vegarance_catalog',JSON.stringify(next));}catch{throw new Error('Browser storage is full. Try a smaller image. Your changes were not saved.');}
    PRODUCTS.splice(0,PRODUCTS.length,...next);return result;
  }
};
if(!Store.server){try{const saved=JSON.parse(localStorage.getItem('vegarance_catalog'));if(Array.isArray(saved)&&saved.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&typeof p.brand==='string'&&p.prices))PRODUCTS.splice(0,PRODUCTS.length,...saved);}catch{}}
