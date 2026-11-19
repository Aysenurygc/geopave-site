/* Geopave Mühendislik — shared behaviour, loaded on every page.
   Contract: every feature looks up its own elements and returns quietly when they are absent,
   so any page can include this file whatever it contains.
   Exposes window.GP = { onTheme(fn), toast(html), reduced() } for assets/figures.js. */
(function(){
'use strict';
var doc=document, root=doc.documentElement;
function $(s,c){return (c||doc).querySelector(s);}
function $$(s,c){return Array.prototype.slice.call((c||doc).querySelectorAll(s));}
function mq(q){return window.matchMedia?window.matchMedia(q):{matches:false};}
function onMq(m,fn){if(m.addEventListener)m.addEventListener('change',fn);else if(m.addListener)m.addListener(fn);}
var mqReduce=mq('(prefers-reduced-motion: reduce)');

var GP=window.GP=window.GP||{};
GP.reduced=function(){return !!mqReduce.matches;};

/* ---------- theme change hook ----------
   Fires when the OS scheme flips or when <html data-theme> changes. Canvas/WebGL drawings subscribe to it. */
var themeFns=[];
GP.onTheme=function(fn){if(typeof fn==='function')themeFns.push(fn);};
function themeChanged(){themeFns.forEach(function(f){try{f();}catch(e){console.error(e);}});}
if('MutationObserver' in window)new MutationObserver(themeChanged).observe(root,{attributes:true,attributeFilter:['data-theme']});
onMq(mq('(prefers-color-scheme: dark)'),themeChanged);

/* ---------- year stamp ---------- */
$$('[data-year]').forEach(function(el){el.textContent=String(new Date().getFullYear());});

/* ---------- toast ---------- */
var toastEl=$('#toast'),toastT=0;
GP.toast=function(html){
  if(!toastEl)return;
  toastEl.innerHTML=html;toastEl.hidden=false;clearTimeout(toastT);
  toastT=setTimeout(function(){toastEl.hidden=true;},4200);
};

/* ---------- navigation: mobile overlay + dropdown panels ---------- */
var nav=$('#nav'),menuBtn=$('.menu-btn'),head=$('.site-head');
var mqMobile=mq('(max-width:1180px)');
function isMobile(){return !!mqMobile.matches;}
var items=nav?$$('.nav-item.has-panel',nav):[];

function setItem(it,on){
  it.classList.toggle('open',on);
  var b=$('.nav-exp',it);if(b)b.setAttribute('aria-expanded',on?'true':'false');
}
function closeAll(except){items.forEach(function(it){if(it!==except)setItem(it,false);});}

function setMenu(open){
  if(!nav||!menuBtn)return;
  nav.classList.toggle('open',open);
  menuBtn.setAttribute('aria-expanded',open?'true':'false');
  menuBtn.setAttribute('aria-label',open?'Menüyü kapat':'Menüyü aç');
  doc.body.classList.toggle('menu-open',open);
  if(open){
    if(head)nav.style.setProperty('--nav-top',Math.max(0,Math.round(head.getBoundingClientRect().bottom))+'px');
    // current section expanded on open; one accordion at a time
    closeAll();
    var cur=$('.nav-top[aria-current]',nav),it=cur&&cur.closest('.nav-item.has-panel');
    if(it)setItem(it,true);
  }else closeAll();
}
if(nav&&menuBtn){
  menuBtn.addEventListener('click',function(){setMenu(!nav.classList.contains('open'));});
  onMq(mqMobile,function(){setMenu(false);});
  window.addEventListener('resize',function(){if(nav.classList.contains('open')&&head)nav.style.setProperty('--nav-top',Math.max(0,Math.round(head.getBoundingClientRect().bottom))+'px');});
  // in-page anchors inside the overlay should close it
  $$('a',nav).forEach(function(a){a.addEventListener('click',function(){if(isMobile())setMenu(false);});});
}
items.forEach(function(it){
  var btn=$('.nav-exp',it),t=0;
  if(!btn)return;
  btn.addEventListener('click',function(e){
    e.stopPropagation();
    var on=!it.classList.contains('open');
    closeAll(it);setItem(it,on);
  });
  // desktop: hover opens with ~150 ms intent delay; hover is never the only way in
  it.addEventListener('mouseenter',function(){if(isMobile())return;clearTimeout(t);t=setTimeout(function(){closeAll(it);setItem(it,true);},150);});
  it.addEventListener('mouseleave',function(){if(isMobile())return;clearTimeout(t);t=setTimeout(function(){setItem(it,false);},220);});
  // close when keyboard focus leaves the item
  it.addEventListener('focusout',function(e){if(isMobile())return;if(!e.relatedTarget||!it.contains(e.relatedTarget))setItem(it,false);});
  it.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&it.classList.contains('open')){setItem(it,false);btn.focus();e.stopPropagation();}
  });
});
doc.addEventListener('click',function(e){if(nav&&!isMobile()&&!nav.contains(e.target))closeAll();});
doc.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  if(nav&&nav.classList.contains('open')){setMenu(false);if(menuBtn)menuBtn.focus();}
});

/* ---------- copy buttons ---------- */
$$('.copy').forEach(function(b){
  b.addEventListener('click',function(){
    var v=b.getAttribute('data-copy');
    function done(t){b.textContent=t;b.classList.add('done');setTimeout(function(){b.textContent='Kopyala';b.classList.remove('done');},2200);}
    function fallback(){var t=doc.getElementById(b.getAttribute('aria-controls'));if(t&&window.getSelection){var r=doc.createRange();r.selectNodeContents(t);var s=getSelection();s.removeAllRanges();s.addRange(r);}done('Seçildi');}
    try{navigator.clipboard.writeText(v).then(function(){done('Kopyalandı');},fallback);}catch(e){fallback();}
  });
});

/* ---------- table filter: <input data-filter="#tbodyId"> + optional <output data-filter-count> ---------- */
$$('input[data-filter]').forEach(function(inp){
  var body=$(inp.getAttribute('data-filter'));if(!body)return;
  var out=inp.closest('.filter')?$('[data-filter-count]',inp.closest('.filter')):null;
  var rows=$$('tr',body);
  function norm(s){return (s||'').toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim();}
  function run(){
    var v=norm(inp.value),n=0;
    rows.forEach(function(r){var hit=!v||norm(r.textContent).indexOf(v)>=0;r.classList.toggle('no-match',!hit);if(hit)n++;});
    if(out)out.textContent=n+' / '+rows.length+' model';
  }
  inp.addEventListener('input',run);run();
});

/* ---------- request form (iletisim/) ---------- */
var form=$('#q-form');
if(form)(function(){
  var types=$$('input[name="tur"]',form),groups=$$('.group',form);
  var submit=$('#q-submit'),micro=$('#q-micro'),done=$('#q-done'),sum=$('#err-sum'),box=$('#talep');
  var submitTxt={hizmet:'Proje Ön Görüşmesi Talep Edin',urun:'Teklif İsteyin',temsil:'Türkiye Temsilciliği için Görüşelim',diger:'Mesajınızı İletin'};
  var microTxt={hizmet:'Projenizi kısaca aktarın; bir iş günü içinde sizi arayalım. Ön görüşme için ücret talep etmiyoruz.',urun:'Proforma faturanın hazırlanabilmesi için gereken bilgileri tek seferde istiyoruz.',temsil:'Manufacturers may write in English.',diger:''};
  var typeLabel={hizmet:'Proje ön görüşmesi',urun:'Ürün teklifi',temsil:'Temsilcilik',diger:'Diğer'};
  function currentType(){var c=types.filter(function(t){return t.checked;})[0];return c?c.value:'hizmet';}
  function setType(v){
    if(!submitTxt.hasOwnProperty(v))v='hizmet';
    types.forEach(function(t){t.checked=t.value===v;});
    groups.forEach(function(g){g.disabled=g.getAttribute('data-group')!==v;});
    if(submit)submit.textContent=submitTxt[v];
    if(micro){micro.textContent=microTxt[v];micro.lang=v==='temsil'?'en':'tr';}
  }
  function showForm(){if(done)done.hidden=true;form.hidden=false;}
  function toForm(focusSel){
    if(box)box.scrollIntoView({behavior:GP.reduced()?'auto':'smooth',block:'start'});
    var f=focusSel&&$(focusSel);if(f)setTimeout(function(){f.focus({preventScroll:true});},GP.reduced()?0:500);
  }
  types.forEach(function(t){t.addEventListener('change',function(){setType(t.value);});});

  // pre-fill from the link that brought the visitor here: ?tur=urun&urun=IMPACT%207000 / ?tur=hizmet&hizmet=...
  var params={};
  try{var sp=new URLSearchParams(location.search);sp.forEach(function(v,k){params[k]=v;});}catch(e){}
  setType(params.tur||currentType());
  if(params.urun&&$('#f-urun'))$('#f-urun').value=params.urun;
  if(params.hizmet&&$('#f-hizmet')){var sel=$('#f-hizmet');$$('option',sel).forEach(function(o){if(o.text===params.hizmet)sel.value=o.value||o.text;});}

  // same-page enquiry doors switch the form without a reload
  $$('[data-enquiry]').forEach(function(a){a.addEventListener('click',function(e){
    e.preventDefault();showForm();setType(a.getAttribute('data-enquiry'));toForm('#f-kurum');
    try{history.replaceState(null,'','?tur='+a.getAttribute('data-enquiry')+'#talep');}catch(x){}
  });});

  var errIcon='<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 3.6v4.2M7 9.6v1" stroke="currentColor" stroke-width="1.6"/></svg>';
  function fieldErr(inp,msg){
    var id=inp.id+'-err',e=doc.getElementById(id);
    var host=inp.type==='checkbox'?inp.closest('.kvkk'):inp.closest('.fld');
    if(msg){
      if(!e&&host){e=doc.createElement('p');e.className='err';e.id=id;host.appendChild(e);}
      if(e)e.innerHTML=errIcon+'<span>'+msg+'</span>';
      inp.setAttribute('aria-invalid','true');
      var d=(inp.getAttribute('aria-describedby')||'').split(' ').filter(Boolean);if(d.indexOf(id)<0)d.push(id);inp.setAttribute('aria-describedby',d.join(' '));
    }else{
      if(e)e.remove();inp.removeAttribute('aria-invalid');
      var d2=(inp.getAttribute('aria-describedby')||'').split(' ').filter(function(x){return x&&x!==id;});
      if(d2.length)inp.setAttribute('aria-describedby',d2.join(' '));else inp.removeAttribute('aria-describedby');
    }
  }
  function check(inp){
    var v=(inp.value||'').trim(),t=inp.getAttribute('data-type'),ok=true;
    if(t==='check')ok=inp.checked;
    else if(!v)ok=false;
    else if(t==='email')ok=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    else if(t==='tel')ok=v.replace(/\D/g,'').length>=10;
    fieldErr(inp,ok?null:inp.getAttribute('data-msg'));
    return ok;
  }
  function activeReq(){return $$('[data-req]',form).filter(function(i){var g=i.closest('.group');return !(g&&g.disabled);});}
  function recheck(e){var t=e.target;if(t&&t.hasAttribute&&t.hasAttribute('data-req')&&t.getAttribute('aria-invalid')==='true')check(t);}
  form.addEventListener('blur',recheck,true);
  form.addEventListener('change',recheck);
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var bad=activeReq().filter(function(i){return !check(i);});
    if(bad.length){if(sum){sum.hidden=false;sum.textContent=bad.length===1?'Formda tamamlanması gereken 1 alan var.':'Formda tamamlanması gereken '+bad.length+' alan var.';}bad[0].focus();return;}
    if(sum)sum.hidden=true;
    var hp=$('#f-web');if(hp&&hp.value)return; // honeypot
    var dl=$('#q-summary');
    if(dl){
      dl.innerHTML='';
      var row=function(k,v){if(!v)return;var dt=doc.createElement('dt');dt.textContent=k;var dd=doc.createElement('dd');dd.textContent=v;dl.appendChild(dt);dl.appendChild(dd);};
      row('Talep türü',typeLabel[currentType()]);
      $$('input,select,textarea',form).forEach(function(i){
        if(i.type==='radio'||i.type==='checkbox'||i.id==='f-web')return;var g=i.closest('.group');if(g&&g.disabled)return;
        var l=form.querySelector('label[for="'+i.id+'"]');if(!l)return;
        row(l.childNodes[0].textContent.trim(),i.value.trim());
      });
    }
    // PREVIEW: there is no server. Nothing is transmitted or stored; the panel says so.
    form.hidden=true;if(done){done.hidden=false;done.focus();}
  });
  var edit=$('#q-edit');if(edit)edit.addEventListener('click',function(){showForm();var k=$('#f-kurum');if(k)k.focus();});
  var kl=$('#kvkk-link'),kv=$('#kvkk');if(kl&&kv)kl.addEventListener('click',function(){setTimeout(function(){kv.focus({preventScroll:true});},50);});
})();
})();
