function renderCategories(){
  document.querySelectorAll('[data-category]').forEach(button=>{
    const active=button.dataset.category===activeCategory;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  });
}
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-category]');if(!target)return;
  activeCategory=target.dataset.category;activeBrand='all';searchTerm='';$('#shopSearch').value='';visibleLimit=24;
  renderBrandChips();renderShop();renderCategories();document.getElementById('shop').scrollIntoView({behavior:'smooth'});
});
renderCategories();
