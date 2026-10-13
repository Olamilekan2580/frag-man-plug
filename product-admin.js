const editor=document.getElementById('productEditor'),form=document.getElementById('productForm');
let editingId=null,returnTo=null;
let editorVariants=[],pendingSupplier;
function renderVariantRows(){
 $('#variantRows').innerHTML=editorVariants.map((v,i)=>`<div class="variant-edit-row" data-variant-row="${i}"><label>Option<input data-field="label" value="${esc(v.label)}" maxlength="160" required placeholder="Black / Medium"></label><label>Price (USD)<input data-field="price" type="number" min="0.01" max="10000" step="0.01" value="${esc(v.price)}" required></label><label>Supplier SKU<input data-field="sku" value="${esc(v.sku||'')}" maxlength="100"></label><label class="stock-field"><input data-field="inStock" type="checkbox" ${v.inStock?'checked':''}>Available</label><button type="button" data-remove-variant="${i}" aria-label="Remove option ${i+1}">Remove</button></div>`).join('');
}
function syncEditorType(){
 const generic=form.elements.category.value!=='Fragrance'||editorVariants.length>0;
 $('#decantPrices').hidden=generic;$('#variantEditor').hidden=!generic;
 $('#decantPrices').querySelectorAll('input').forEach(input=>{input.disabled=generic;});
 if(generic&&!editorVariants.length)editorVariants=[{id:'standard',label:'Standard',price:'',sku:'',inStock:true}];
 renderVariantRows();
}
form.elements.category.onchange=syncEditorType;
$('#variantRows').addEventListener('input',e=>{const row=e.target.closest('[data-variant-row]');if(row&&e.target.dataset.field)editorVariants[+row.dataset.variantRow][e.target.dataset.field]=e.target.type==='checkbox'?e.target.checked:e.target.value;});
$('#variantRows').onclick=e=>{const button=e.target.closest('[data-remove-variant]');if(!button)return;if(editorVariants.length<=1){toast('Keep at least one product option.');return;}editorVariants.splice(+button.dataset.removeVariant,1);renderVariantRows();};
$('#addVariant').onclick=()=>{if(editorVariants.length>=100)return;editorVariants.push({id:'option-'+crypto.randomUUID().slice(0,8),label:'',price:'',sku:'',inStock:true});renderVariantRows();};
function refreshAdmin(){
  BRANDS.splice(0,BRANDS.length,...[...new Set(PRODUCTS.map(p=>p.brand))].sort());
  $('#adminBrandFilter').innerHTML='<option value="all">All brands</option>'+BRANDS.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('');
  if(!BRANDS.includes(adminBrand))adminBrand='all';$('#adminBrandFilter').value=adminBrand;
  renderProducts();
}
function openEditor(id=null,view=false){
  returnTo=document.activeElement;editingId=id;form.reset();$('#productError').textContent='';
  const product=id?PRODUCTS.find(p=>p.id===id):null;if(id&&!product)return;pendingSupplier=product?.supplier;
  $('#editorTitle').textContent=view?'Product details':id?'Edit product':'Add a product';
  $('#productFields').disabled=view;$('#productSave').hidden=view;$('#productEditFromView').hidden=!view;
  form.elements.name.value=product?.name||'';form.elements.brand.value=product?.brand||'';form.elements.line.value=product?.line||'';form.elements.blurb.value=product?.blurb||'';form.elements.image.value=product?.image||'';
  form.elements.category.value=categoryOf(product||{});form.elements.taxCode.value=product?.taxCode||'';
  editorVariants=(product?.variants||[]).map(v=>({...v,price:effPrice(product,v.id)}));syncEditorType();
  for(const size of ['3ml','5ml','10ml'])form.elements[size].value=product?effPrice(product,size):'';
  form.elements.inStock.checked=product?inStock(product):true;form.elements.saleReady.checked=product?.saleReady===true;
  $('#productPreview').src=product?.image||(typeof PRODUCT_IMAGES!=='undefined'&&product&&PRODUCT_IMAGES[product.id])||'images/brand-lattafa.webp';
  $('#productPreview').alt=product?product.name+' demo imagery':'Product image preview';
  editor.showModal();
}
function closeEditor(){editor.close();returnTo?.isConnected&&returnTo.focus();}
$('#newProduct').onclick=()=>openEditor();$('#productCancel').onclick=closeEditor;$('#productEditorClose').onclick=closeEditor;
$('#productEditFromView').onclick=()=>{editor.close();openEditor(editingId,false);};
form.elements.image.addEventListener('input',e=>{if(e.target.value.trim())$('#productPreview').src=e.target.value.trim();});
form.elements.upload.addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;$('#productError').textContent='';
 try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10_000_000)throw new Error('Choose a PNG, JPEG or WebP under 10 MB.');const bitmap=await createImageBitmap(file);const scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const image=canvas.toDataURL('image/webp',.82);if(image.length>1_300_000)throw new Error('Image is too large. Choose a smaller photo.');const source=Store.server?(await Store.request('/api/uploads','POST',{image})).image:image;form.elements.image.value=source;$('#productPreview').src=source;}catch(error){$('#productError').textContent=error.message;}
});
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!form.reportValidity())return;
 const value={name:form.elements.name.value.trim(),brand:form.elements.brand.value.trim(),line:form.elements.line.value.trim(),blurb:form.elements.blurb.value.trim(),image:form.elements.image.value.trim(),inStock:form.elements.inStock.checked,prices:{}};
 value.taxCode=form.elements.taxCode.value.trim();value.saleReady=form.elements.saleReady.checked;value.category=form.elements.category.value;if(pendingSupplier)value.supplier=pendingSupplier;
 if(!value.name||!value.brand){$('#productError').textContent='Product name and brand cannot be blank.';return;}
 if(value.image&&!/^(https:\/\/|images\/|\/uploads\/|data:image\/(png|jpeg|webp);base64,)/.test(value.image)){$('#productError').textContent='Use an HTTPS image URL or upload an image.';return;}
 if(!$('#variantEditor').hidden){value.variants=[];for(const v of editorVariants){const price=Number(v.price);if(!v.label.trim()||!Number.isFinite(price)||price<=0||price>10000){$('#productError').textContent='Each option needs a name and a price above zero, up to $10,000.';return;}value.variants.push({id:v.id,label:v.label.trim(),sku:v.sku.trim(),inStock:v.inStock});value.prices[v.id]=Math.round(price*100)/100;}}
 else for(const size of ['3ml','5ml','10ml']){const price=Number(form.elements[size].value);if(!Number.isFinite(price)||price<=0||price>10000){$('#productError').textContent='Each decant price must be above zero and no more than $10,000.';return;}value.prices[size]=Math.round(price*100)/100;}
 $('#productSave').disabled=true;$('#productError').textContent='';
 try{await Store.persist(editingId?'PUT':'POST',editingId,value);if(editingId){delete priceOverrides[editingId];delete stockMap[editingId];if(!Store.server){save('vegarance_price_overrides',priceOverrides);save('vegarance_stock',stockMap);}}refreshAdmin();closeEditor();toast('Product saved.');}catch(error){$('#productError').textContent=error.message;}finally{$('#productSave').disabled=false;}
});
let deleteId=null;const deletion=document.getElementById('deleteProductDialog');
$('#cancelDelete').onclick=()=>deletion.close();
$('#confirmDelete').onclick=async()=>{
 $('#confirmDelete').disabled=true;$('#deleteError').textContent='';
 try{await Store.persist('DELETE',deleteId);delete priceOverrides[deleteId];delete stockMap[deleteId];if(!Store.server){save('vegarance_price_overrides',priceOverrides);save('vegarance_stock',stockMap);}refreshAdmin();deletion.close();toast('Product deleted.');}catch(error){$('#deleteError').textContent=error.message;}finally{$('#confirmDelete').disabled=false;}
};
document.addEventListener('click',async e=>{
 const orderDelete=e.target.closest('[data-delete-order]');if(orderDelete){pendingOrderDelete=orderDelete.dataset.deleteOrder;$('#deleteOrderName').textContent=pendingOrderDelete;$('#deleteOrderError').textContent='';$('#deleteOrderDialog').showModal();return;}
 const action=e.target.closest('[data-product-action]');if(action){const id=action.dataset.pid;if(action.dataset.productAction==='delete'){deleteId=id;$('#deleteName').textContent=PRODUCTS.find(p=>p.id===id)?.name||'';$('#deleteError').textContent='';deletion.showModal();}else openEditor(id,action.dataset.productAction==='view');return;}
 const toggle=e.target.closest('[data-stock]');if(Store.server&&toggle){e.stopImmediatePropagation();toggle.disabled=true;try{const product=PRODUCTS.find(p=>p.id===toggle.dataset.stock);await Store.persist('PATCH',product.id,{inStock:!product.inStock});refreshAdmin();toast('Stock updated.');}catch(error){toast(error.message);toggle.disabled=false;}}
},true);
document.addEventListener('change',async e=>{
 const status=e.target.closest('.order-status');if(Store.server&&status){e.stopImmediatePropagation();status.disabled=true;try{const order=await Store.request('/api/orders/'+encodeURIComponent(status.dataset.oid),'PATCH',{status:status.value});const i=ORDERS.findIndex(o=>o.id===order.id);if(i>=0)ORDERS[i]=order;renderOrders();toast('Order status saved.');}catch(error){toast(error.message);renderOrders();}return;}
 const input=e.target.closest('.price-in');if(!Store.server||!input)return;e.stopImmediatePropagation();const product=PRODUCTS.find(p=>p.id===input.dataset.pid),price=Number(input.value);if(!Number.isFinite(price)||price<=0||price>10000){input.value=product.prices[input.dataset.size];toast('Enter a valid price above zero.');return;}input.disabled=true;try{await Store.persist('PATCH',product.id,{prices:{...product.prices,[input.dataset.size]:price}});refreshAdmin();toast('Price saved to the server.');}catch(error){input.value=product.prices[input.dataset.size];toast(error.message);input.disabled=false;}
},true);
document.addEventListener('submit',async e=>{
 if(!Store.server||e.target.id!=='settingsForm')return;e.preventDefault();e.stopImmediatePropagation();if(!e.target.reportValidity())return;
 const value={storeName:$('#setStoreName').value.trim(),announcement:$('#setAnnouncement').value.trim(),shipThreshold:Number($('#setShipThreshold').value),supportEmail:$('#setSupportEmail').value.trim()};try{settings=await Store.request('/api/settings','PUT',value);renderSettings();toast('Settings saved to the server.');}catch(error){toast(error.message);}
},true);
async function ownerSession(){
 if(!Store.server)return;
 $('#resetDemo').hidden=true;$('#logoutOwner').hidden=false;
 document.querySelector('.admin-notice').textContent='Server-backed owner panel. Product changes are stored in the database and shared with storefront visitors. Open Sales & connections for Flutterwave checkout, paid orders and CJ fulfillment.';
 try{const session=await Store.request('/api/session');if(!session.authenticated){$('#ownerLogin').showModal();if(!session.configured)$('#loginError').textContent='The server owner must configure ADMIN_PASSWORD before login.';return;}settings=await Store.request('/api/settings');if(!Object.keys(settings).length)settings=null;renderSettings();const orders=await Store.request('/api/orders');ORDERS.splice(0,ORDERS.length,...orders);renderOrders();}catch(error){toast(error.message);}
}
$('#ownerLoginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';$('#ownerLoginSubmit').disabled=true;try{await Store.request('/api/login','POST',{password:$('#ownerPassword').value});$('#ownerPassword').value='';$('#ownerLogin').close();await ownerSession();document.dispatchEvent(new Event('owner-authenticated'));}catch(error){$('#loginError').textContent=error.message;}finally{$('#ownerLoginSubmit').disabled=false;}});
$('#ownerLogin').addEventListener('cancel',e=>e.preventDefault());
$('#logoutOwner').onclick=async()=>{try{await Store.request('/api/logout','POST');await ownerSession();}catch(error){toast(error.message);}};
ownerSession().then(()=>{if(!$('#ownerLogin').open)document.dispatchEvent(new Event('owner-authenticated'));});
let pendingOrderDelete=null;
$('#cancelOrderDelete').onclick=()=>$('#deleteOrderDialog').close();
$('#confirmOrderDelete').onclick=async()=>{
 $('#confirmOrderDelete').disabled=true;
 try{if(Store.server)await Store.request('/api/orders/'+encodeURIComponent(pendingOrderDelete),'DELETE');else{const removed=[...deletedOrders,pendingOrderDelete];save('vegarance_deleted_orders',removed);deletedOrders.splice(0,deletedOrders.length,...removed);}const index=ORDERS.findIndex(o=>o.id===pendingOrderDelete);if(index>=0)ORDERS.splice(index,1);renderOrders();$('#deleteOrderDialog').close();toast('Demo order deleted.');}catch(error){$('#deleteOrderError').textContent=error.message;}finally{$('#confirmOrderDelete').disabled=false;}
};
