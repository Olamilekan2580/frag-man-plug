/* Personal scent shortlist. Stored on this device, with no account required. */
const savedToggle=document.createElement('button');
savedToggle.type='button';savedToggle.className='chip saved-toggle';
document.querySelector('.catalog-toolbar').prepend(savedToggle);
function syncSaved(){
  savedToggle.textContent=`Saved scents (${savedIds.size})`;
  savedToggle.setAttribute('aria-pressed',String(savedOnly));
  savedToggle.classList.toggle('active',savedOnly);
  document.querySelectorAll('[data-save]').forEach(button=>{
    const saved=savedIds.has(button.dataset.save),product=byId(button.dataset.save);
    button.textContent=saved?'♥':'♡';button.setAttribute('aria-pressed',String(saved));
    button.setAttribute('aria-label',`${saved?'Unsave':'Save'} ${product?.name||'fragrance'}`);
  });
}
savedToggle.onclick=()=>{savedOnly=!savedOnly;visibleLimit=24;renderShop();syncSaved();};
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-save]');if(!button)return;
  const id=button.dataset.save;if(savedIds.has(id))savedIds.delete(id);else savedIds.add(id);
  writeStore('vegarance_saved',[...savedIds]);
  if(savedOnly)renderShop();syncSaved();
});
syncSaved();
