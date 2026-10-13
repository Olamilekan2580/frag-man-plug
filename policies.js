const policySections={shipping:['Shipping & delivery','shippingPolicy'],returns:['Returns & refunds','returnPolicy'],privacy:['Privacy','privacyPolicy'],terms:['Terms of sale','terms']};
const policySection=policySections[new URLSearchParams(location.search).get('section')]||policySections.shipping;
document.getElementById('policyTitle').textContent=policySection[0];
fetch('/api/store-config').then(async response=>{if(!response.ok)throw new Error('Customer-care information is currently unavailable.');return response.json();}).then(cfg=>{
  document.getElementById('policyText').textContent=cfg[policySection[1]]||'This collection is in preview. The store’s policies will be published before sales open.';
  if(cfg.supportEmail){const link=document.createElement('a');link.href='mailto:'+cfg.supportEmail;link.textContent='Questions? '+cfg.supportEmail;document.getElementById('policySupport').append(link);}
}).catch(error=>document.getElementById('policyText').textContent=error.message);
