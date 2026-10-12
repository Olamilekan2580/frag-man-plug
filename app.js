/* ═══ The Frag Man Plug — demo store logic ═══ */

/* Catalog: prices in USD are DEMO PLACEHOLDERS */
const SIZES = [
  { id:'3ml',  label:'3ml Decant',  sub:'perfect taster' },
  { id:'5ml',  label:'5ml Decant',  sub:'2–3 weeks wear' },
  { id:'10ml', label:'10ml Decant', sub:'a month+ of wear' },
  { id:'50ml', label:'50ml Bottle', sub:'full size' },
];

const PRODUCTS = [
  { id:'velvet-oud', name:'Velvet Oud', mono:'VO', family:'woody', famLabel:'Woody Oriental',
    blurb:'Smoked oud wrapped in velvet rose — the house icon.',
    desc:'The one that started it all. Velvet Oud opens with a spark of saffron and pink pepper before melting into smoked oud and Turkish rose. Hours later, all that remains is warm amber and vanilla on skin. This is the scent people ask about.',
    top:'Saffron, Cardamom, Pink Pepper', heart:'Smoked Oud, Turkish Rose, Leather', base:'Amber, White Musk, Vanilla',
    longevity:'10–12 hrs', sillage:'Heavy', season:'Fall / Winter',
    badges:['Bestseller','Hand-poured','Cruelty-free'],
    prices:{'3ml':14,'5ml':22,'10ml':38,'50ml':120}, hue:['#6b4a24','#c9a45c'],
    occasion:['evening','special'], intensity:'bold', tag:'Bestseller' },
  { id:'citrus-imperiale', name:'Citrus Imperiale', mono:'CI', family:'fresh', famLabel:'Citrus Fresh',
    blurb:'Sunlit bergamot over crisp neroli — effortless daytime luxury.',
    desc:'A crisp white-shirt of a fragrance. Calabrian bergamot and green fig sparkle over a heart of neroli, drying down to clean vetiver and cedar. The office-safe powerhouse that still turns heads in the elevator.',
    top:'Bergamot, Lemon Zest, Green Fig', heart:'Neroli, Petitgrain, Orange Blossom', base:'White Musk, Vetiver, Cedar',
    longevity:'6–8 hrs', sillage:'Moderate', season:'Spring / Summer',
    badges:['New','Hand-poured','Cruelty-free'],
    prices:{'3ml':12,'5ml':18,'10ml':32,'50ml':95}, hue:['#8a6f2a','#e8d5a8'],
    occasion:['day'], intensity:'subtle', tag:'New' },
  { id:'santal-mystique', name:'Santal Mystique', mono:'SM', family:'woody', famLabel:'Creamy Woods',
    blurb:'Meditative sandalwood with a violet-iris glow.',
    desc:'Creamy Mysore-style sandalwood wrapped in powdery iris and violet leaf. Quiet, expensive-smelling, meditative — the fragrance equivalent of a deep exhale. A connoisseur\u2019s daily wear.',
    top:'Cardamom, Violet Leaf, Bergamot', heart:'Sandalwood, Papyrus, Iris', base:'Tonka Bean, Ambroxan, Musk',
    longevity:'8–10 hrs', sillage:'Moderate', season:'All year',
    badges:['Hand-poured','Small-batch','Cruelty-free'],
    prices:{'3ml':13,'5ml':20,'10ml':35,'50ml':110}, hue:['#5c4322','#b99a5e'],
    occasion:['day','evening'], intensity:'moderate' },
  { id:'noir-vanille', name:'Noir Vanille', mono:'NV', family:'warm', famLabel:'Dark Gourmand',
    blurb:'Bourbon vanilla with a dangerous plum-and-patchouli edge.',
    desc:'Not your sweet vanilla. Noir Vanille is bourbon vanilla dragged through dark plum, rum and patchouli — gourmand with a leather jacket on. Addictive, after-dark, unforgettable.',
    top:'Dark Plum, Pink Pepper, Rum', heart:'Vanilla Bourbon, Orchid, Cocoa', base:'Benzoin, Patchouli, Suede',
    longevity:'9–11 hrs', sillage:'Heavy', season:'Fall / Winter',
    badges:['Bestseller','Hand-poured','Cruelty-free'],
    prices:{'3ml':12,'5ml':18,'10ml':32,'50ml':98}, hue:['#4a3040','#c9a45c'],
    occasion:['evening','special'], intensity:'bold', tag:'Bestseller' },
  { id:'azure-riviera', name:'Azure Riviera', mono:'AR', family:'fresh', famLabel:'Aquatic Fresh',
    blurb:'Sea salt and grapefruit over driftwood — the coast in a bottle.',
    desc:'Salt spray, grapefruit and mint over sun-warmed driftwood. Azure Riviera smells like the first hour of a beach holiday — clean, breezy, endlessly wearable. The ultimate heat-wave fragrance.',
    top:'Sea Salt, Grapefruit, Mint', heart:'Sage, Juniper, Cypress', base:'Driftwood, Ambergris, Musk',
    longevity:'6–7 hrs', sillage:'Moderate', season:'Summer',
    badges:['Hand-poured','Cruelty-free'],
    prices:{'3ml':11,'5ml':17,'10ml':30,'50ml':88}, hue:['#3d5a66','#9fc3d4'],
    occasion:['day'], intensity:'subtle' },
  { id:'rose-obscure', name:'Rose Obscure', mono:'RO', family:'floral', famLabel:'Dark Floral',
    blurb:'Turkish rose pulled through oud and leather — romance with teeth.',
    desc:'A rose for people who don\u2019t wear rose. Turkish rose and lychee pulled through smoked oud and supple leather — romantic but dangerous. Made for candlelit rooms and slow dances.',
    top:'Turkish Rose, Lychee, Saffron', heart:'Peony, Smoked Oud, Geranium', base:'Leather, White Musk, Amber',
    longevity:'9–12 hrs', sillage:'Heavy', season:'Fall / Winter',
    badges:['Hand-poured','Small-batch','Cruelty-free'],
    prices:{'3ml':13,'5ml':20,'10ml':36,'50ml':115}, hue:['#6b3040','#d48a9a'],
    occasion:['evening','special'], intensity:'bold' },
  { id:'tabac-dore', name:'Tabac Doré', mono:'TD', family:'warm', famLabel:'Spiced Warm',
    blurb:'Golden tobacco leaf, honey and cinnamon — pure confidence.',
    desc:'Golden tobacco leaf warmed with honey, cinnamon and clove. Tabac Doré smells like success — the corner office, the leather chair, the deal already closed. Unapologetically bold.',
    top:'Cinnamon, Nutmeg, Apple', heart:'Tobacco Leaf, Honey, Clove', base:'Cedarwood, Vanilla, Tonka',
    longevity:'8–10 hrs', sillage:'Heavy', season:'Fall / Winter',
    badges:['New','Hand-poured','Cruelty-free'],
    prices:{'3ml':12,'5ml':19,'10ml':33,'50ml':105}, hue:['#7a4d1a','#e0a84f'],
    occasion:['evening','special'], intensity:'moderate', tag:'New' },
  { id:'blanc-eternel', name:'Blanc Éternel', mono:'BE', family:'floral', famLabel:'Clean Floral Musk',
    blurb:'White tea, iris and cashmeran — the clean-girl classic, elevated.',
    desc:'Aldehydic sparkle over white tea and iris, settling into cashmeran and white musk. Blanc Éternel is the "you smell amazing, what is that?" fragrance — clean but never boring, soft but present.',
    top:'Aldehydes, White Tea, Pear', heart:'Iris, Lily of the Valley, Peony', base:'Cashmeran, White Musk, Blond Woods',
    longevity:'7–9 hrs', sillage:'Moderate', season:'Spring / Summer',
    badges:['Hand-poured','Cruelty-free'],
    prices:{'3ml':11,'5ml':17,'10ml':30,'50ml':90}, hue:['#8a7a5c','#e8e2d2'],
    occasion:['day'], intensity:'subtle' },
];

/* ── state ── */
let cart = [];
let pmProduct = null, pmSize = '5ml';
let mixBase = null, mixAccent = null, mixRatio = '60/40', mixSize = { s:'10ml', p:42 };

const $ = s => document.querySelector(s);
const money = n => '$' + n;

/* ── product cards ── */
function cardHTML(p){
  return `<article class="card reveal" data-card="${p.id}">
    <div class="card-visual">
      ${p.tag?`<span class="card-tag">${p.tag}</span>`:''}
      <div class="mini-bottle" data-mono="${p.mono}" style="--h1:${p.hue[0]};--h2:${p.hue[1]}"></div>
    </div>
    <div class="card-body">
      <p class="card-family">${p.famLabel}</p>
      <h3>${p.name}</h3>
      <p class="card-notes">${p.top.split(',').slice(0,2).join(',')} · ${p.heart.split(',')[0]}</p>
      <div class="card-foot">
        <span class="card-price">${money(p.prices['5ml'])}<small>5ml decant · from ${money(p.prices['3ml'])}</small></span>
        <button class="card-btn" data-view="${p.id}">View</button>
      </div>
    </div>
  </article>`;
}

function renderGrids(){
  $('#featuredGrid').innerHTML = PRODUCTS.slice(0,4).map(cardHTML).join('');
  renderShop('all');
  observeReveals();
}

function renderShop(cat){
  let list = PRODUCTS;
  if(cat==='decant'||cat==='bottle') list = PRODUCTS;                 // same catalog, sizes chosen in modal
  else if(['fresh','woody','floral','warm'].includes(cat)) list = PRODUCTS.filter(p=>p.family===cat);
  $('#shopGrid').innerHTML = list.map(cardHTML).join('') ||
    '<p class="muted" style="text-align:center">No scents in this lane yet.</p>';
  observeReveals();
}

/* ── reveal on scroll ── */
let io;
function observeReveals(){
  if(!('IntersectionObserver' in window)){ document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in')); return; }
  io = io || new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){e.target.classList.add('in'); io.unobserve(e.target);} }),{threshold:.08});
  document.querySelectorAll('.reveal:not(.in)').forEach(el=>io.observe(el));
}

/* ── product modal ── */
function openProduct(id){
  const p = PRODUCTS.find(x=>x.id===id); if(!p) return;
  pmProduct = p; pmSize = '5ml';
  $('#pmFamily').textContent = p.famLabel;
  $('#pmName').textContent = p.name;
  $('#pmDesc').textContent = p.desc;
  $('#pmBadges').innerHTML = p.badges.map(b=>`<span class="pm-badge">✦ ${b}</span>`).join('');
  $('#pmTop').textContent = p.top; $('#pmHeart').textContent = p.heart; $('#pmBase').textContent = p.base;
  $('#pmLong').textContent = p.longevity; $('#pmSill').textContent = p.sillage; $('#pmSeason').textContent = p.season;
  $('#pmBottle').style.setProperty('--h1', p.hue[0]);
  $('#pmBottle').querySelector('i').textContent = p.mono;
  $('#pmSizes').innerHTML = SIZES.map(s=>
    `<button data-size="${s.id}" class="${s.id===pmSize?'active':''}">${s.label}<small>${s.sub} · ${money(p.prices[s.id])}</small></button>`).join('');
  $('#pmPrice').textContent = money(p.prices[pmSize]);
  $('#productModal').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal(){ $('#productModal').hidden = true; document.body.style.overflow = ''; }

/* ── cart ── */
function addToCart(name, detail, price){
  cart.push({name, detail, price});
  renderCart(); toast(`Added — ${name} (${detail})`);
}
function renderCart(){
  $('#cartCount').textContent = cart.length;
  const box = $('#cartItems');
  if(!cart.length){ box.innerHTML = '<p class="cart-empty">Your cart is empty.<br>The scent journey begins with a decant. ✦</p>'; }
  else box.innerHTML = cart.map((it,i)=>`
    <div class="cart-item"><div class="ci-info"><strong>${it.name}</strong><small>${it.detail}</small></div>
    <span class="ci-price">${money(it.price)}</span>
    <button class="ci-rm" data-rm="${i}" aria-label="Remove">✕</button></div>`).join('');
  $('#cartTotal').textContent = money(cart.reduce((a,b)=>a+b.price,0));
}
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(()=>t.hidden = true, 2600);
}

/* ── mix builder ── */
function renderMixPicks(){
  const mk = (el, sel, other, fn) => {
    el.innerHTML = PRODUCTS.map(p=>{
      const dis = (p.id===other) ? ' disabled' : '';
      return `<div class="mix-pick${sel===p.id?' sel':''}${dis}" data-id="${p.id}"><strong>${p.name}</strong><small>${p.famLabel}</small></div>`;
    }).join('');
    el.querySelectorAll('.mix-pick:not(.disabled)').forEach(d=>d.onclick=()=>fn(d.dataset.id));
  };
  mk($('#mixBase'), mixBase, mixAccent, id=>{ mixBase = (mixBase===id?null:id); renderMixPicks(); updateMix(); });
  mk($('#mixAccent'), mixAccent, mixBase, id=>{ mixAccent = (mixAccent===id?null:id); renderMixPicks(); updateMix(); });
}
function updateMix(){
  const b = PRODUCTS.find(p=>p.id===mixBase), a = PRODUCTS.find(p=>p.id===mixAccent);
  const btn = $('#mixAdd');
  if(b && a && b.id!==a.id){
    const name = `${b.name} × ${a.name}`;
    $('#mixName').textContent = name;
    $('#mixDesc').textContent = `${mixRatio} — ${b.name} leading, ${a.name} weaving through. Blended fresh to order, rested 48 hours.`;
    $('#mixPrice').textContent = `${mixSize.s} · ${money(mixSize.p)}`;
    btn.disabled = false;
    btn.onclick = ()=>addToCart('Custom Hybrid Mix', `${name} · ${mixRatio} · ${mixSize.s}`, mixSize.p);
  } else {
    $('#mixName').textContent = 'Select a base & accent';
    $('#mixDesc').textContent = 'Pick two different fragrances above to preview your hybrid.';
    $('#mixPrice').textContent = ''; btn.disabled = true; btn.onclick = null;
  }
}

/* ── quiz ── */
const QUIZ = [
  { q:'When will you wear it most?', opts:[
    {t:'Everyday — work, errands, life', s:{occasion:'day'}},
    {t:'Nights out & dates', s:{occasion:'evening'}},
    {t:'Big moments — I want to be remembered', s:{occasion:'special'}} ]},
  { q:'Which scent family pulls you in?', opts:[
    {t:'Fresh & citrusy — clean and bright', s:{family:'fresh'}},
    {t:'Woody — deep, smooth, grounded', s:{family:'woody'}},
    {t:'Floral — romantic and expressive', s:{family:'floral'}},
    {t:'Warm & spicy — rich and bold', s:{family:'warm'}} ]},
  { q:'How loud should it speak?', opts:[
    {t:'Subtle — a whisper, not a shout', s:{intensity:'subtle'}},
    {t:'Balanced — noticeable, not overwhelming', s:{intensity:'moderate'}},
    {t:'Bold — I want the room to know', s:{intensity:'bold'}} ]},
  { q:'What\u2019s your move?', opts:[
    {t:'Start small — a decant under $40', s:{budget:'decant'}},
    {t:'Go big — the full bottle', s:{budget:'bottle'}} ]},
];
let qi = 0, answers = {};
function renderQuiz(){
  const body = $('#quizBody'), bar = $('#quizBar');
  if(!body) return;
  if(qi < QUIZ.length){
    const step = QUIZ[qi];
    bar.style.width = (qi/QUIZ.length*100)+'%';
    body.innerHTML = `<p class="quiz-q">${step.q}</p><div class="quiz-opts">`+
      step.opts.map((o,i)=>`<button class="quiz-opt" data-i="${i}">${o.t}</button>`).join('')+`</div>`;
    body.querySelectorAll('.quiz-opt').forEach(b=>b.onclick=()=>{
      Object.assign(answers, step.opts[+b.dataset.i].s); qi++; renderQuiz();
    });
  } else {
    bar.style.width = '100%';
    const recs = recommend();
    body.innerHTML = `<div class="quiz-result-card">
      <p class="eyebrow">Your matches</p><h3>Made for <span class="gold">you</span></h3>
      <p class="muted">Based on your answers, start with these:</p>
      <div class="quiz-picks">${recs.map(p=>`
        <div class="quiz-pick" data-id="${p.id}"><strong>${p.name}</strong>
        <span>${p.famLabel}</span><br><small class="muted">5ml ${money(p.prices['5ml'])} · bottle ${money(p.prices['50ml'])}</small></div>`).join('')}
      </div>
      <button class="btn btn-ghost" id="quizRetry">Retake Quiz</button></div>`;
    body.querySelectorAll('.quiz-pick').forEach(d=>d.onclick=()=>openProduct(d.dataset.id));
    $('#quizRetry').onclick = ()=>{ qi=0; answers={}; renderQuiz(); };
  }
}
function recommend(){
  const scored = PRODUCTS.map(p=>{
    let s = 0;
    if(answers.occasion && p.occasion.includes(answers.occasion)) s+=3;
    if(answers.family && p.family===answers.family) s+=3;
    if(answers.intensity && p.intensity===answers.intensity) s+=2;
    return {p, s};
  }).sort((a,b)=>b.s-a.s);
  return scored.slice(0,3).map(x=>x.p);
}

/* ── FAQ accordion ── */
function initFaq(){
  document.querySelectorAll('.faq-item').forEach(item=>{
    const q = item.querySelector('.faq-q');
    q.addEventListener('click', ()=>{
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(o=>o.classList.remove('open'));
      if(!open) item.classList.add('open');
    });
  });
}

/* ── events ── */
document.addEventListener('click', e=>{
  const v = e.target.closest('[data-view]');
  if(v){ openProduct(v.dataset.view); return; }
  const card = e.target.closest('[data-card]');
  if(card){ openProduct(card.dataset.card); return; }
  if(e.target.closest('[data-close]')){ closeModal(); $('#drawerWrap').hidden = true; document.body.style.overflow=''; return; }
  const rm = e.target.closest('[data-rm]'); if(rm){ cart.splice(+rm.dataset.rm,1); renderCart(); return; }
  const sz = e.target.closest('#pmSizes button'); if(sz){ pmSize = sz.dataset.size;
    document.querySelectorAll('#pmSizes button').forEach(b=>b.classList.toggle('active', b===sz));
    $('#pmPrice').textContent = money(pmProduct.prices[pmSize]); return; }
  const chip = e.target.closest('.chip'); if(chip){
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); chip.classList.add('active');
    renderShop(chip.dataset.cat); return; }
  const dc = e.target.closest('.drop-menu [data-cat]'); // nav dropdown links
  if(dc){
    document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active', c.dataset.cat===dc.dataset.cat));
    renderShop(dc.dataset.cat);
  }
});
$('#pmAdd').onclick = ()=>{ if(!pmProduct) return; const s = SIZES.find(x=>x.id===pmSize);
  addToCart(pmProduct.name, s.label, pmProduct.prices[pmSize]); };
$('#cartBtn').onclick = ()=>{ $('#drawerWrap').hidden = false; document.body.style.overflow='hidden'; };
$('#checkoutBtn').onclick = ()=>toast('Demo checkout — the real store will process payment securely.');
$('#burger').onclick = ()=>$('#navLinks').classList.toggle('open');
document.querySelectorAll('#navLinks a').forEach(a=>a.addEventListener('click',()=>$('#navLinks').classList.remove('open')));
$('#mixRatio').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#mixRatio button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  mixRatio = b.dataset.r; updateMix(); });
$('#mixSize').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#mixSize button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  mixSize = { s:b.dataset.s, p:+b.dataset.p }; updateMix(); });
$('#notifyForm').addEventListener('submit', e=>{ e.preventDefault();
  const em = $('#notifyEmail').value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ toast('Please enter a valid email address.'); $('#notifyEmail').focus(); return; }
  $('#notifyForm').hidden = true; $('#notifyOk').hidden = false; toast('You\u2019re on the launch list ✦'); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeModal(); $('#drawerWrap').hidden=true; document.body.style.overflow=''; }});

/* ── init ── */
renderGrids(); renderMixPicks(); updateMix(); renderQuiz(); renderCart(); initFaq();
