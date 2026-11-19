/* Geopave Mühendislik — interactive figures (WebGL via three.js r128).
   Load ONLY on pages that carry a figure, after assets/site.js and three.min.js:
     <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
     <script src="[../]assets/figures.js"></script>

   Each figure initialises only if its stage element exists, so a page pays for the figures it shows.
   Markup contract (copy the <figure> block from a page that already carries it):
     Fig 1  exploded pavement section  #xs-stage  + #xs-labels, #xs-range, #xs-out, #xs-toggle,
                                                   #xs-r-no, #xs-r-name, #xs-r-mat, #xs-r-th, #xs-r-fn        (on: index.html)
     Fig 2  lane surface scan + IRI    #scan-stage + #scan-canvas, #scan-tip, #scan-pos, #scan-pos-out, #scan-play,
                                                   #scan-play-ic, #scan-play-t, #scan-tbody, #hud-km, #hud-il, #hud-ir, #hud-rut
     Fig 3  micro surfacing sequence   #ms-stage   + #ms-play, #ms-play-ic, #ms-play-t, #ms-steps, #ms-text
   Figs 1 and 3 hatch their static SVG fallbacks with patterns #pt-asph, #pt-bind, #pt-base, #pt-sub, #pt-soil:
   include the <svg class="defs"> block on the page (it is at the top of <body> on index.html).

   Every stage carries a static SVG fallback (.fallback) that is visible until WebGL paints, and stays if
   WebGL or three.js is unavailable (.nogl). prefers-reduced-motion: no intro, no idle drift, no autoplay;
   the figures still respond to direct input. */
(function(){
'use strict';
var doc=document, root=doc.documentElement;
var $=function(s,c){return (c||doc).querySelector(s);}, $$=function(s,c){return Array.prototype.slice.call((c||doc).querySelectorAll(s));};
var mqReduce=matchMedia('(prefers-reduced-motion: reduce)');
var REDUCED=mqReduce.matches;
function clamp(v,a,b){return v<a?a:v>b?b:v;}
function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
function cssv(n){var v=getComputedStyle(root).getPropertyValue(n).trim();return v||'#888888';}
function num(v,d){return v.toLocaleString('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d});}
function chainage(m){m=Math.max(0,m);var km=Math.floor(m/1000),r=Math.round(m-km*1000);return km+'+'+('00'+r).slice(-3);}
function rng(seed){var s=seed>>>0;return function(){s=(s+0x6D2B79F5)>>>0;var t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

var GP=window.GP||{};
function onTheme(fn){
  if(GP.onTheme){GP.onTheme(fn);return;}
  // standalone fallback if site.js is absent
  if('MutationObserver' in window)new MutationObserver(fn).observe(root,{attributes:true,attributeFilter:['data-theme']});
  var m=matchMedia('(prefers-color-scheme: dark)');if(m.addEventListener)m.addEventListener('change',fn);
}
var reducedFns=[];
function onReduced(fn){reducedFns.push(fn);}
if(mqReduce.addEventListener)mqReduce.addEventListener('change',function(e){REDUCED=e.matches;reducedFns.forEach(function(f){f(REDUCED);});});

/* =====================================================================
   3D — shared infrastructure
   ===================================================================== */
var HAS3=!!window.THREE;
var scenes=[],raf=0;
function kick(){if(!raf)raf=requestAnimationFrame(tick);}
var lastT=0;
function tick(now){
  raf=0;var dt=lastT?Math.min(.05,(now-lastT)/1000):.016;lastT=now;var more=false;
  scenes.forEach(function(s){if(s.visible&&s.step(dt,now/1000))more=true;});
  if(more)kick();else lastT=0;
}
function makeRenderer(canvas){
  if(!HAS3)return null;
  try{var r=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true,powerPreference:'low-power'});
    r.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));r.setClearColor(0x000000,0);return r;}
  catch(e){return null;}
}
function watch(s,stage){
  s.visible=false;scenes.push(s);
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(en){en.forEach(function(x){s.visible=x.isIntersecting;if(s.visible){if(s.onShow)s.onShow();kick();}});},{rootMargin:'120px'}).observe(stage);
  }else{s.visible=true;}
  if('ResizeObserver' in window){new ResizeObserver(function(){s.resize();s.dirty=true;kick();}).observe(stage);}
  else window.addEventListener('resize',function(){s.resize();s.dirty=true;kick();});
  onTheme(function(){s.theme();s.dirty=true;kick();});
}
function col(n){return new THREE.Color(cssv(n));}
function placeCam(cam,o,t){cam.position.set(t.x+o.dist*Math.cos(o.el)*Math.sin(o.az),t.y+o.dist*Math.sin(o.el),t.z+o.dist*Math.cos(o.el)*Math.cos(o.az));cam.lookAt(t);}
function orbit(el,o,changed){
  var down=null,moved=0;
  el.addEventListener('pointerdown',function(e){if(e.button!==0)return;down={x:e.clientX,y:e.clientY};moved=0;o.dragging=true;o.vaz=0;try{el.setPointerCapture(e.pointerId);}catch(x){}});
  el.addEventListener('pointermove',function(e){
    if(!down){if(o.hover)o.hover(e);return;}
    var dx=e.clientX-down.x,dy=e.clientY-down.y;down.x=e.clientX;down.y=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);
    if(moved<4)return;
    o.az=clamp(o.az-dx*.008,o.minAz,o.maxAz);o.el=clamp(o.el+dy*.005,o.minEl,o.maxEl);o.vaz=REDUCED?0:-dx*.008;o.touched=true;changed();
  });
  function up(e){if(!down)return;o.dragging=false;var m=moved;down=null;if(m<5&&o.click)o.click(e);changed();}
  el.addEventListener('pointerup',up);
  el.addEventListener('pointercancel',function(){down=null;o.dragging=false;});
  el.addEventListener('keydown',function(e){var k=e.key,h=true;
    if(k==='ArrowLeft')o.az=clamp(o.az+.12,o.minAz,o.maxAz);else if(k==='ArrowRight')o.az=clamp(o.az-.12,o.minAz,o.maxAz);
    else if(k==='ArrowUp')o.el=clamp(o.el+.07,o.minEl,o.maxEl);else if(k==='ArrowDown')o.el=clamp(o.el-.07,o.minEl,o.maxEl);else h=false;
    if(h){e.preventDefault();o.touched=true;changed();}});
}
function inertia(o){if(o.dragging||Math.abs(o.vaz)<1e-4){o.vaz=0;return false;}o.az=clamp(o.az+o.vaz,o.minAz,o.maxAz);o.vaz*=.9;return true;}

/* hatch textures — same material code as the static drawings */
function hatchCanvas(pat,bg,ink){
  var S=256,c=doc.createElement('canvas');c.width=c.height=S;var g=c.getContext('2d');
  g.fillStyle=bg;g.fillRect(0,0,S,S);g.strokeStyle=ink;g.fillStyle=ink;g.lineCap='square';
  var r=rng(pat.length*97+3),k;
  function diag(step,w){g.lineWidth=w;g.beginPath();for(k=-S;k<=2*S;k+=step){g.moveTo(k,0);g.lineTo(k-S,S);}g.stroke();}
  if(pat==='asph'){diag(S/12,2.6);}
  else if(pat==='bind'){diag(S/8,2.4);for(var i=0;i<8;i++)for(var j=0;j<8;j++){g.beginPath();g.arc(i*32+16,j*32+16,2.4,0,7);g.fill();}}
  else if(pat==='base'){g.lineWidth=2.4;for(k=0;k<16;k++){var cx=r()*S,cy=r()*S,rad=10+r()*16;for(var ox=-1;ox<=1;ox++)for(var oy=-1;oy<=1;oy++){g.beginPath();for(var v=0;v<7;v++){var a=v/7*6.283+r()*.4,rr=rad*(.7+r()*.4),x=cx+ox*S+Math.cos(a)*rr,y=cy+oy*S+Math.sin(a)*rr;if(v)g.lineTo(x,y);else g.moveTo(x,y);}g.closePath();g.stroke();}}}
  else if(pat==='sub'){for(k=0;k<520;k++){g.beginPath();g.arc(r()*S,r()*S,1.9,0,7);g.fill();}}
  else if(pat==='soil'){g.lineWidth=2.4;for(var a2=0;a2<4;a2++)for(var b2=0;b2<4;b2++){var x0=a2*64+8,y0=b2*64+30;for(var q=0;q<3;q++){g.beginPath();g.moveTo(x0+q*9,y0);g.lineTo(x0+q*9+20,y0-20);g.stroke();}g.beginPath();g.arc(x0+44,y0+18,2.6,0,7);g.fill();}}
  else if(pat==='grain'){g.globalAlpha=.55;for(k=0;k<900;k++){g.beginPath();g.arc(r()*S,r()*S,.6+r()*1.4,0,7);g.fill();}g.globalAlpha=1;}
  return c;
}
function tex(canvas,renderer){var t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}

var GLSL_LIGHT='vec3 nrm(vec3 p){vec3 n=normalize(cross(dFdx(p),dFdy(p)));return n.y<0.0?-n:n;}\n'+
  'float hash1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n';

/* =====================================================================
   FIG 1 — set up only if the page carries it
   ===================================================================== */
function setupFig1(){
  var xsStage=$('#xs-stage');
  if(!xsStage)return null;
  /* =====================================================================
     FIG 1 — exploded pavement section
     ===================================================================== */
  var LAYERS=[
    {name:'Aşınma tabakası',mat:'Bitümlü sıcak karışım (BSK)',th:'40–50 mm',fn:'Trafikle doğrudan temas eden yüzey. Kayma direnci, sürüş konforu ve alt tabakaların sudan korunması bu tabakanın işidir.',pat:'asph',h:.30,ring:.30},
    {name:'Binder tabakası',mat:'BSK binder',th:'50–80 mm',fn:'Aşınma tabakası ile temel arasında gerilmeleri dağıtır; tekerlek izi oluşumuna karşı direncin önemli bölümünü taşır.',pat:'bind',h:.42,ring:.44},
    {name:'Temel',mat:'Granüler veya plent-miks temel',th:'150–250 mm',fn:'Trafik yükünü geniş bir alana yayan ana taşıyıcı tabaka.',pat:'base',h:.80,ring:.64},
    {name:'Alt temel',mat:'Granüler malzeme',th:'150–300 mm',fn:'Drenajı ve dona karşı korumayı sağlar; temel için sağlam bir çalışma platformu oluşturur.',pat:'sub',h:.90,ring:.84},
    {name:'Taban zemini',mat:'Doğal veya iyileştirilmiş zemin',th:'kalınlık yok; taşıma gücü CBR ile',fn:'Tüm üstyapıyı taşıyan zemin. Taşıma gücü (örneğin CBR değeri) tasarımın başlangıç verisidir.',pat:'soil',h:1.20,ring:.96}
  ];
  var xsSel=0,xsLabelBtns=$$('#xs-labels button');
  function xsSelect(i){
    xsSel=i;var L=LAYERS[i];
    $('#xs-r-no').textContent=('0'+(i+1)).slice(-2);$('#xs-r-name').textContent=L.name;$('#xs-r-mat').textContent=L.mat;$('#xs-r-th').textContent=L.th;$('#xs-r-fn').textContent=L.fn;
    xsLabelBtns.forEach(function(b){b.setAttribute('aria-pressed',+b.getAttribute('data-layer')===i?'true':'false');});
    $$('.fallback .slab',xsStage).forEach(function(g){g.classList.toggle('sel',+g.getAttribute('data-i')===i);});
    $$('.fallback .ldr,.fallback .ldr-dot',xsStage).forEach(function(g){g.classList.toggle('on',+g.getAttribute('data-i')===i);});
    if(fig1)fig1.select(i);
  }
  xsLabelBtns.forEach(function(b){b.addEventListener('click',function(){xsSelect(+b.getAttribute('data-layer'));});});
  var xsRange=$('#xs-range'),xsOut=$('#xs-out'),xsToggle=$('#xs-toggle');
  function xsSetExplode(v,fromUser){xsRange.value=Math.round(v*100);xsOut.textContent='%'+Math.round(v*100);xsToggle.textContent=v>.3?'Katmanları birleştir':'Katmanları ayır';xsToggle.setAttribute('aria-pressed',v>.3?'true':'false');if(fig1)fig1.explodeTo(v,fromUser);}
  xsRange.addEventListener('input',function(){xsSetExplode(xsRange.value/100,true);});
  xsToggle.addEventListener('click',function(){xsSetExplode(+xsRange.value>30?0:.62,true);});

  var fig1=null;
  function initFig1(){
    var canvas=$('canvas',xsStage),R=makeRenderer(canvas);
    if(!R){xsStage.classList.add('nogl');return;}
    var scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(24,1,.1,100);
    scene.add(new THREE.AmbientLight(0xffffff,.74));var dl=new THREE.DirectionalLight(0xffffff,.42);dl.position.set(-4,8,6);scene.add(dl);
    var W=3.0,D=2.0,GAP=.62,TILE=1.0;
    var group=new THREE.Group();scene.add(group);
    var slabs=LAYERS.map(function(L,i){
      var geo=new THREE.BoxGeometry(W,L.h,D),uv=geo.attributes.uv;
      for(var f=0;f<6;f++){var dims=f<2?[D,L.h]:f<4?[W,D]:[W,L.h];for(var k=0;k<4;k++){var idx=f*4+k;uv.setXY(idx,uv.getX(idx)*dims[0]/TILE,uv.getY(idx)*dims[1]/TILE);}}
      var side=new THREE.MeshLambertMaterial({color:0xffffff}),top=new THREE.MeshLambertMaterial({color:0xffffff});
      var mesh=new THREE.Mesh(geo,[side,side,top,side,side,side]);mesh.userData.i=i;
      var edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial());mesh.add(edges);
      var pts=[];for(var a=0;a<=96;a++){var t=a/96*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(t)*L.ring,0,Math.sin(t)*L.ring*.98));}
      var ring=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({dashSize:.07,gapSize:.05}));ring.computeLineDistances();ring.position.y=L.h/2+.006;mesh.add(ring);
      group.add(mesh);
      return {mesh:mesh,side:side,top:top,edges:edges,ring:ring,h:L.h};
    });
    // wheel load P on the wearing course
    var s0=slabs[0],h0=LAYERS[0].h/2;
    var patch=new THREE.Mesh(new THREE.CircleGeometry(.17,40),new THREE.MeshBasicMaterial());patch.rotation.x=-Math.PI/2;patch.position.y=h0+.008;s0.mesh.add(patch);
    var shaft=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,h0+1.15,0),new THREE.Vector3(0,h0+.24,0)]),new THREE.LineBasicMaterial());s0.mesh.add(shaft);
    var head=new THREE.Mesh(new THREE.ConeGeometry(.075,.2,20),new THREE.MeshBasicMaterial());head.rotation.x=Math.PI;head.position.y=h0+.14;s0.mesh.add(head);

    var texN=[],texS=[],grainN,grainS;
    function theme(){
      var face=cssv('--fig-face'),hatch=cssv('--fig-hatch'),sel=cssv('--fig-sel'),selH=cssv('--fig-sel-hatch');
      texN.concat(texS).forEach(function(t){t.dispose();});texN=[];texS=[];
      LAYERS.forEach(function(L){texN.push(tex(hatchCanvas(L.pat,face,hatch),R));texS.push(tex(hatchCanvas(L.pat,sel,selH),R));});
      if(grainN){grainN.dispose();grainS.dispose();}
      grainN=tex(hatchCanvas('grain',cssv('--fig-top'),hatch),R);grainS=tex(hatchCanvas('grain',sel,selH),R);
      var edge=col('--fig-edge'),amb=col('--amber');
      slabs.forEach(function(s){s.ring.material.color.copy(amb);});
      patch.material.color.copy(amb);shaft.material.color.copy(edge);head.material.color.copy(edge);
      applySel();
    }
    function applySel(){
      var edge=col('--fig-edge'),pri=col('--primary'),topc=col('--fig-top'),selc=col('--fig-sel');
      slabs.forEach(function(s,i){var on=i===xsSel;
        s.side.map=on?texS[i]:texN[i];s.side.needsUpdate=true;
        if(i===0){s.top.map=on?grainS:grainN;s.top.color.set(0xffffff);}else{s.top.map=null;s.top.color.copy(on?selc:topc);}
        s.top.needsUpdate=true;s.edges.material.color.copy(on?pri:edge);});
    }
    var o={az:-.62,el:.5,dist:16.2,minEl:.1,maxEl:1.2,minAz:-Infinity,maxAz:Infinity,vaz:0};
    var target=new THREE.Vector3(0,0,0);
    var E=REDUCED?.62:0,Et=.62,intro=REDUCED?1:0,baseAz=o.az,clock=0,userExp=false;
    var w=1,h=1;
    function resize(){var r=xsStage.getBoundingClientRect();w=Math.max(1,r.width);h=Math.max(1,r.height);R.setSize(w,h,false);
      cam.aspect=(w*1.36)/h;cam.setViewOffset(w*1.36,h,w*.36,0,w,h);cam.updateProjectionMatrix();leaders.setAttribute('viewBox','0 0 '+w+' '+h);}
    function layout(){
      var tot=0;LAYERS.forEach(function(L){tot+=L.h;});tot+=4*GAP*E;
      var y=tot/2-.25;
      slabs.forEach(function(s,i){s.mesh.position.y=y-s.h/2;y-=s.h+GAP*E;});
    }
    // leaders + labels
    var leaders=$('.leaders',xsStage),lis=$$('#xs-labels li'),ns='http://www.w3.org/2000/svg',lg=[];
    for(var i=0;i<5;i++){var g=doc.createElementNS(ns,'g'),p=doc.createElementNS(ns,'path'),c=doc.createElementNS(ns,'circle');c.setAttribute('r','2.6');g.appendChild(p);g.appendChild(c);leaders.appendChild(g);lg.push({g:g,p:p,c:c});}
    var v3=new THREE.Vector3(),corners=[[1,1],[1,-1],[-1,1],[-1,-1]];
    function labels(){
      var ys=[],ax=[];
      slabs.forEach(function(s,i){var best=-1e9,bx=0,by=0;
        corners.forEach(function(cn){v3.set(cn[0]*W/2,0,cn[1]*D/2);s.mesh.localToWorld(v3);v3.project(cam);var px=(v3.x+1)/2*w,py=(1-v3.y)/2*h;if(px>best){best=px;bx=px;by=py;}});
        ax.push([bx,by]);ys.push(by);});
      var gap=Math.max(34,Math.min(50,h*.085)),lo=gap*.55,hi=h-gap*.55;
      for(var i=0;i<5;i++){ys[i]=Math.max(ys[i],i?ys[i-1]+gap:lo);}
      if(ys[4]>hi){ys[4]=hi;for(i=3;i>=0;i--)ys[i]=Math.min(ys[i],ys[i+1]-gap);}
      var lx=w*.64;
      for(i=0;i<5;i++){lis[i].style.top=ys[i].toFixed(1)+'px';
        var a=ax[i],ex=lx-6;lg[i].p.setAttribute('d','M'+a[0].toFixed(1)+' '+a[1].toFixed(1)+' L'+(ex-16).toFixed(1)+' '+ys[i].toFixed(1)+' L'+ex.toFixed(1)+' '+ys[i].toFixed(1));
        lg[i].c.setAttribute('cx',a[0].toFixed(1));lg[i].c.setAttribute('cy',a[1].toFixed(1));lg[i].g.setAttribute('class',i===xsSel?'on':'');}
    }
    var ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
    function pick(e){var r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,cam);var hit=ray.intersectObjects(slabs.map(function(s){return s.mesh;}),false)[0];return hit?hit.object.userData.i:-1;}
    o.click=function(e){var i=pick(e);if(i>=0)xsSelect(i);};
    var hoverT=0;o.hover=function(e){var n=performance.now();if(n-hoverT<60)return;hoverT=n;xsStage.classList.toggle('pick',pick(e)>=0);};
    orbit(xsStage,o,function(){S.dirty=true;kick();});

    var S={dirty:true,resize:resize,theme:theme,
      select:function(){applySel();S.dirty=true;kick();},
      explodeTo:function(v,u){Et=v;if(u){userExp=true;intro=1;}if(REDUCED)E=v;S.dirty=true;kick();},
      step:function(dt){
        var anim=false;clock+=dt;
        if(intro<1){intro=Math.min(1,intro+dt/2.4);var k=ease(intro);if(!userExp)E=Et*k;o.az=baseAz-.5*(1-k);anim=true;}
        else if(Math.abs(Et-E)>.001){E+=(Et-E)*Math.min(1,dt*7);anim=true;}else E=Et;
        if(inertia(o))anim=true;
        if(!REDUCED&&!o.touched&&intro>=1){o.az=baseAz+Math.sin(clock*.28)*.11;anim=true;}
        if(!anim&&!S.dirty)return false;
        layout();placeCam(cam,o,target);R.render(scene,cam);labels();
        if(!xsStage.classList.contains('gl'))xsStage.classList.add('gl');
        S.dirty=false;return anim;
      }};
    theme();resize();layout();
    fig1=S;watch(S,xsStage);
  }
  return {stage:xsStage,init:initFig1};
}

/* =====================================================================
   FIG 2
   ===================================================================== */
function setupFig2(){
  var scanStage=$('#scan-stage');
  if(!scanStage)return null;
  /* =====================================================================
     FIG 2 — representative profile, IRI (quarter-car) and 3D surface
     ===================================================================== */
  var SL=300,DX=.1,N=Math.round(SL/DX)+1;
  function envelope(x){return .62+.32*Math.sin(x/SL*Math.PI-.4)+1.15*Math.exp(-Math.pow((x-205)/36,2));}
  function genProfile(seed){
    var r=rng(seed),p=new Float64Array(N),G0=22e-6,n0=.1,nMin=.02,nMax=3,K=220;
    for(var k=0;k<K;k++){
      var n1=nMin*Math.pow(nMax/nMin,k/K),n2=nMin*Math.pow(nMax/nMin,(k+1)/K),n=Math.sqrt(n1*n2),dn=n2-n1;
      var A=Math.sqrt(2*G0*Math.pow(n/n0,-2)*dn),ph=r()*6.2832,w=6.2832*n,mod=n>.15;
      for(var i=0;i<N;i++){var x=i*DX;p[i]+=A*Math.cos(w*x+ph)*(mod?envelope(x):1);}
    }
    return p; // metres
  }
  function quarterCar(p){ // ASTM E1926 Golden Car, 80 km/h; returns cumulative |zs'-zu'| dt (m)
    var V=80/3.6,dt=DX/V,sub=8,hh=dt/sub,k1=653,k2=63.3,c=6,mu=.15;
    var acc=new Float64Array(N),zs=p[0],zu=p[0],vs=0,vu=0,a=0;
    for(var i=0;i<N-1;i++){
      for(var s=0;s<sub;s++){var y=p[i]+(p[i+1]-p[i])*(s/sub);var as=-c*(vs-vu)-k2*(zs-zu),au=(c*(vs-vu)+k2*(zs-zu)-k1*(zu-y))/mu;vs+=as*hh;vu+=au*hh;zs+=vs*hh;zu+=vu*hh;a+=Math.abs(vs-vu)*hh;}
      acc[i+1]=a;
    }
    return acc;
  }
  function detrend(p,win){var n=p.length,pre=new Float64Array(n+1),o=new Float32Array(n),h=Math.round(win/2);for(var i=0;i<n;i++)pre[i+1]=pre[i]+p[i];for(i=0;i<n;i++){var a=Math.max(0,i-h),b=Math.min(n,i+h+1);o[i]=(p[i]-(pre[b]-pre[a])/(b-a))*1000;}return o;}
  function rutSeries(seed,scale){var r=rng(seed),o=new Float32Array(N),ph=r()*6.28,ph2=r()*6.28;for(var i=0;i<N;i++){var x=i*DX;o[i]=Math.max(.5,scale*(2.6+11.5*Math.exp(-Math.pow((x-208)/40,2))+1.4*Math.sin(x/17+ph)+.8*Math.sin(x/5.3+ph2)));}return o;}
  var pL=genProfile(11),pR=genProfile(29),aL=quarterCar(pL),aR=quarterCar(pR);
  var hL=detrend(pL,10),hR=detrend(pR,10),rL=rutSeries(5,1),rR=rutSeries(9,.78);
  function iriBetween(acc,x0,x1){var i0=Math.round(x0/DX),i1=Math.round(x1/DX);return (acc[i1]-acc[i0])*1000/(x1-x0);}
  function rutMax(x0,x1){var m=0;for(var i=Math.round(x0/DX);i<=Math.round(x1/DX);i++)m=Math.max(m,rL[i],rR[i]);return m;}
  var SEG=20,segs=[];for(var s0=0;s0<SL;s0+=SEG){var il=iriBetween(aL,s0,s0+SEG),ir=iriBetween(aR,s0,s0+SEG);segs.push({x0:s0,x1:s0+SEG,l:il,r:ir,m:(il+ir)/2,rut:rutMax(s0,s0+SEG)});}

  /* table 2 */
  (function(){var tb=$('#scan-tbody'),html='';for(var x=0;x<SL;x+=50){html+='<tr data-x0="'+x+'"><th scope="row" class="mono">'+chainage(x)+'–'+chainage(x+50)+'</th><td class="n">'+num(iriBetween(aL,x,x+50),2)+'</td><td class="n">'+num(iriBetween(aR,x,x+50),2)+'</td><td class="n">'+num(rutMax(x,x+50),1)+'</td></tr>';}tb.innerHTML=html;})();

  var scanC=REDUCED?205:205,scanPlaying=false,scanUserPaused=false;
  var scanPos=$('#scan-pos'),scanPosOut=$('#scan-pos-out'),scanPlay=$('#scan-play');
  var fig2=null;
  function hudUpdate(){
    var c=scanC,x0=Math.max(0,c-20);
    $('#hud-km').textContent='Km '+chainage(c);
    $('#hud-il').textContent=c>=10?num(iriBetween(aL,x0,c),2)+' m/km':'—';
    $('#hud-ir').textContent=c>=10?num(iriBetween(aR,x0,c),2)+' m/km':'—';
    $('#hud-rut').textContent=num(rutMax(x0,c),1)+' mm';
    scanPos.value=c;scanPosOut.textContent=chainage(c);
    $$('#scan-tbody tr').forEach(function(tr){var a=+tr.getAttribute('data-x0');tr.classList.toggle('cur',c>=a&&c<a+50);});
  }
  function setScan(c,user){scanC=clamp(c,10,270);if(user&&scanPlaying){scanPlaying=false;scanUserPaused=true;playUI();}hudUpdate();drawChart();if(fig2){fig2.dirty=true;kick();}}
  function playUI(){scanPlay.setAttribute('aria-pressed',scanPlaying?'true':'false');$('#scan-play-ic').textContent=scanPlaying?'❚❚':'▶';$('#scan-play-t').textContent=scanPlaying?'Duraklat':'Oynat';}
  scanPlay.addEventListener('click',function(){scanPlaying=!scanPlaying;scanUserPaused=!scanPlaying;playUI();kick();});
  scanPos.addEventListener('input',function(){setScan(+scanPos.value,true);});

  /* chart */
  var CH_AMP=(function(){var m=0;for(var i=0;i<N;i++)m=Math.max(m,Math.abs(hL[i]));return Math.ceil(m);})();
  var chart=$('#scan-canvas'),tip=$('#scan-tip'),hoverSeg=-1,CH={};
  function drawChart(){
    var dpr=Math.min(window.devicePixelRatio||1,2),W=chart.clientWidth,H=chart.clientHeight;if(!W||!H)return;
    if(chart.width!==Math.round(W*dpr)||chart.height!==Math.round(H*dpr)){chart.width=Math.round(W*dpr);chart.height=Math.round(H*dpr);}
    var g=chart.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
    var ink=cssv('--ink-900'),mut=cssv('--ink-500'),line=cssv('--line'),soft=cssv('--line-soft'),strong=cssv('--line-strong'),amb=cssv('--amber'),pri=cssv('--primary'),band=cssv('--primary-100'),body=cssv('--ink-700');
    var L=46,Rr=12,T=16,mid=Math.round(H*.36),B=H-24;
    var X=function(m){return L+(m/SL)*(W-L-Rr);};
    CH={L:L,Rr:Rr,W:W,mid:mid,B:B,X:X};
    // window band (3D view extent)
    g.fillStyle=band;g.fillRect(X(scanC-10),T-6,X(scanC+30)-X(scanC-10),B-T+6);
    g.font='500 10.5px "IBM Plex Mono", ui-monospace, monospace';g.textBaseline='middle';
    // panel A: profile (left wheel path, detrended mm)
    var aTop=T,aBot=mid-14,aMid=(aTop+aBot)/2,amp=CH_AMP;
    g.strokeStyle=soft;g.lineWidth=1;g.beginPath();g.moveTo(L,aMid+.5);g.lineTo(W-Rr,aMid+.5);g.stroke();
    g.fillStyle=mut;g.textAlign='right';g.fillText('+'+amp,L-6,aTop+4);g.fillText('0',L-6,aMid);g.fillText('−'+amp,L-6,aBot-4);
    g.textAlign='left';g.fillText('Profil, sol iz (mm)',L+4,aTop-6);
    g.strokeStyle=body;g.lineWidth=1.2;g.beginPath();
    var step=Math.max(1,Math.floor(N/(W-L-Rr)/1));for(var i=0;i<N;i+=step){var y=aMid-clamp(hL[i]/amp,-1,1)*(aBot-aTop)/2;if(i)g.lineTo(X(i*DX),y);else g.moveTo(X(0),y);}g.stroke();
    // panel B: IRI bars
    var bTop=mid+16,maxI=Math.ceil(Math.max.apply(null,segs.map(function(s){return Math.max(s.l,s.r);}))/2)*2;
    var Y=function(v){return B-(v/maxI)*(B-bTop);};
    g.fillStyle=mut;g.textAlign='left';g.fillText('IRI, 20 m ortalaması (m/km)',L+4,bTop-8);
    for(var t=0;t<=maxI;t+=2){g.strokeStyle=t?soft:strong;g.beginPath();g.moveTo(L,Math.round(Y(t))+.5);g.lineTo(W-Rr,Math.round(Y(t))+.5);g.stroke();g.fillStyle=mut;g.textAlign='right';g.fillText(String(t),L-6,Y(t));}
    var cur=Math.min(segs.length-1,Math.floor(scanC/SEG));
    segs.forEach(function(s,k){var x0=X(s.x0)+1,x1=X(s.x1)-1,y=Y(s.m);g.fillStyle=k===cur?amb:strong;
      var r=Math.min(3,(x1-x0)/2);g.beginPath();g.moveTo(x0,B);g.lineTo(x0,y+r);g.quadraticCurveTo(x0,y,x0+r,y);g.lineTo(x1-r,y);g.quadraticCurveTo(x1,y,x1,y+r);g.lineTo(x1,B);g.closePath();g.fill();
      if(k===hoverSeg){g.strokeStyle=ink;g.lineWidth=1.5;g.stroke();}
    });
    var cs=segs[cur];g.fillStyle=ink;g.textAlign='center';g.font='600 11px "IBM Plex Mono", ui-monospace, monospace';g.fillText(num(cs.m,2),(X(cs.x0)+X(cs.x1))/2,Y(cs.m)-9);
    // x axis
    g.font='500 10.5px "IBM Plex Mono", ui-monospace, monospace';g.fillStyle=mut;g.textBaseline='alphabetic';
    for(var m=0;m<=SL;m+=50){g.textAlign=m===0?'left':m===SL?'right':'center';g.fillText(chainage(m),X(m),H-6);}
    // cursor
    g.strokeStyle=pri;g.lineWidth=1.5;g.beginPath();g.moveTo(Math.round(X(scanC))+.5,T-6);g.lineTo(Math.round(X(scanC))+.5,B);g.stroke();
  }
  function chartSeg(e){var r=chart.getBoundingClientRect(),x=e.clientX-r.left;if(!CH.X)return{m:0,k:-1};var m=(x-CH.L)/(CH.W-CH.L-CH.Rr)*SL;return{m:m,k:(m>=0&&m<SL)?Math.floor(m/SEG):-1,x:x};}
  var chartDrag=false;
  chart.addEventListener('pointerdown',function(e){chartDrag=true;try{chart.setPointerCapture(e.pointerId);}catch(x){}setScan(chartSeg(e).m,true);});
  chart.addEventListener('pointerup',function(){chartDrag=false;});
  chart.addEventListener('pointercancel',function(){chartDrag=false;});
  chart.addEventListener('pointermove',function(e){var s=chartSeg(e);if(chartDrag){setScan(s.m,true);}
    if(s.k!==hoverSeg){hoverSeg=s.k;drawChart();}
    if(s.k>=0){var q=segs[s.k];tip.hidden=false;tip.innerHTML='<b>Km '+chainage(q.x0)+'–'+chainage(q.x1)+'</b><br>IRI ort. '+num(q.m,2)+' m/km<br>sol '+num(q.l,2)+' · sağ '+num(q.r,2)+'<br>iz maks. '+num(q.rut,1)+' mm';
      var x=clamp(s.x,90,chart.clientWidth-90);tip.style.left=x+'px';}else tip.hidden=true;});
  chart.addEventListener('pointerleave',function(){hoverSeg=-1;tip.hidden=true;drawChart();});
  if('ResizeObserver' in window)new ResizeObserver(drawChart).observe(chart);else window.addEventListener('resize',drawChart);
  onTheme(drawChart);
  if(doc.fonts&&doc.fonts.ready)doc.fonts.ready.then(drawChart);
  hudUpdate();drawChart();

  function initFig2(){
    var stage=scanStage,canvas=$('canvas',stage),R=makeRenderer(canvas);
    if(!R){stage.classList.add('nogl');return;}
    var scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(30,16/9,.1,200);
    var NX=37,NZ=201,LEN=40,Z0=10,LW=3.6,nv=NX*NZ;
    var pos=new Float32Array(nv*3),rutA=new Float32Array(nv),chA=new Float32Array(nv),idx=[];
    for(var j=0;j<NZ;j++)for(var i=0;i<NX;i++){var v=j*NX+i;pos[v*3]=-LW/2+i*LW/(NX-1);pos[v*3+2]=Z0-j*LEN/(NZ-1);}
    for(j=0;j<NZ-1;j++)for(i=0;i<NX-1;i++){var a=j*NX+i,b=a+1,c=a+NX,d=c+1;idx.push(a,c,b,b,c,d);}
    var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('aRut',new THREE.BufferAttribute(rutA,1));geo.setAttribute('aChain',new THREE.BufferAttribute(chA,1));geo.setIndex(idx);
    // lateral weights
    var wl=[],wr=[],bl=[],br=[],tL=[];
    for(i=0;i<NX;i++){var X=-LW/2+i*LW/(NX-1),gs=function(u,s){return Math.exp(-u*u/(s*s));};
      wl.push(gs(X+.9,.32));wr.push(gs(X-.9,.32));bl.push(gs(X+.9-.52,.17)+gs(X+.9+.52,.17));br.push(gs(X-.9-.52,.17)+gs(X-.9+.52,.17));tL.push(clamp((.9-X)/1.8,0,1));}
    var mat=new THREE.ShaderMaterial({
      uniforms:{uBase:{value:new THREE.Color()},uMeas:{value:new THREE.Color()},uAmber:{value:new THREE.Color()},uGrid:{value:new THREE.Color()}},
      vertexShader:'attribute float aRut;attribute float aChain;varying vec3 vP;varying float vRut;varying float vCh;void main(){vP=position;vRut=aRut;vCh=aChain;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:GLSL_LIGHT+'uniform vec3 uBase;uniform vec3 uMeas;uniform vec3 uAmber;uniform vec3 uGrid;varying vec3 vP;varying float vRut;varying float vCh;\n'+
        'float gl1(float v,float sp,float w){float x=v/sp;float d=abs(fract(x-0.5)-0.5);float fw=fwidth(x);return 1.0-smoothstep(fw*0.5,fw*(0.5+w),d);}\n'+
        'void main(){vec3 n=nrm(vP);float lit=0.5+0.5*max(dot(n,normalize(vec3(0.45,1.0,0.3))),0.0);float meas=smoothstep(-0.04,0.04,vP.z);\n'+
        'vec3 c=mix(uBase,uMeas,meas)*lit;c=mix(c,uAmber,meas*smoothstep(0.12,0.8,vRut));\n'+
        'float g=max(gl1(vCh,1.0,0.8)*0.45,gl1(vCh,10.0,1.4));float gx=gl1(vP.x+1.8,0.6,0.8)*0.45;\n'+
        'c=mix(c,uGrid,max(g,gx)*(0.16+0.4*meas));float far=smoothstep(-12.0,-29.5,vP.z);gl_FragColor=vec4(c,1.0-far);}',
      transparent:true,side:THREE.DoubleSide,extensions:{derivatives:true}});
    var mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;scene.add(mesh);
    // scan line + laser fan + sensor beam
    var rowS=Math.round(Z0/(LEN/(NZ-1)));
    var linePos=new Float32Array(NX*3),lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(linePos,3));
    var scanLine=new THREE.Line(lineGeo,new THREE.LineBasicMaterial());scanLine.frustumCulled=false;scene.add(scanLine);
    var fanPos=new Float32Array((NX+1)*3),fanIdx=[];for(i=0;i<NX-1;i++)fanIdx.push(NX,i,i+1);
    var fanGeo=new THREE.BufferGeometry();fanGeo.setAttribute('position',new THREE.BufferAttribute(fanPos,3));fanGeo.setIndex(fanIdx);
    var fan=new THREE.Mesh(fanGeo,new THREE.MeshBasicMaterial({transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}));fan.frustumCulled=false;scene.add(fan);
    var beamGeo=new THREE.BoxGeometry(3.9,.07,.12),beam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial());beam.position.set(0,1.62,0);scene.add(beam);
    var beamEdges=new THREE.LineSegments(new THREE.EdgesGeometry(beamGeo),new THREE.LineBasicMaterial());beam.add(beamEdges);
    var head=new THREE.Mesh(new THREE.BoxGeometry(.22,.14,.2),new THREE.MeshBasicMaterial());head.position.set(0,-.1,0);beam.add(head);

    function sample(arr,m){var f=m/DX,i0=Math.floor(f),t=f-i0;i0=clamp(i0,0,N-2);return arr[i0]*(1-t)+arr[i0+1]*t;}
    var VS=.02;
    function build(){
      var c=scanC;
      for(var j=0;j<NZ;j++){var z=Z0-j*LEN/(NZ-1),m=clamp(c-z,0,SL),hl=sample(hL,m),hr=sample(hR,m),rl=sample(rL,m),rr=sample(rR,m);
        for(var i=0;i<NX;i++){var v=j*NX+i,t=tL[i],base=hr*(1-t)+hl*t,rut=-rl*wl[i]-rr*wr[i]+.28*(rl*bl[i]+rr*br[i]);
          pos[v*3+1]=(base+rut)*VS;rutA[v]=Math.max(rl*wl[i],rr*wr[i])/18;chA[v]=m;}}
      geo.attributes.position.needsUpdate=true;geo.attributes.aRut.needsUpdate=true;geo.attributes.aChain.needsUpdate=true;
      var apexY=1.55;
      for(var i2=0;i2<NX;i2++){var v2=rowS*NX+i2;linePos[i2*3]=pos[v2*3];linePos[i2*3+1]=pos[v2*3+1]+.012;linePos[i2*3+2]=0;fanPos[i2*3]=pos[v2*3]*.98;fanPos[i2*3+1]=pos[v2*3+1]+.01;fanPos[i2*3+2]=0;}
      fanPos[NX*3]=0;fanPos[NX*3+1]=apexY;fanPos[NX*3+2]=0;
      lineGeo.attributes.position.needsUpdate=true;fanGeo.attributes.position.needsUpdate=true;
    }
    function theme(){mat.uniforms.uBase.value.copy(col('--scan-base'));mat.uniforms.uMeas.value.copy(col('--scan-meas'));mat.uniforms.uAmber.value.copy(col('--amber'));mat.uniforms.uGrid.value.copy(col('--scan-grid'));
      var amb=col('--amber'),ink=col('--fig-edge'),face=col('--fig-face');scanLine.material.color.copy(amb);fan.material.color.copy(amb);beam.material.color.copy(face);beamEdges.material.color.copy(ink);head.material.color.copy(ink);}
    var o={az:.62,el:.4,dist:14.5,minEl:.12,maxEl:1.1,minAz:-.4,maxAz:1.3,vaz:0},target=new THREE.Vector3(0,0,-3.5);
    function resize(){var r=stage.getBoundingClientRect();R.setSize(Math.max(1,r.width),Math.max(1,r.height),false);cam.aspect=r.width/Math.max(1,r.height);cam.updateProjectionMatrix();}
    orbit(stage,o,function(){S.dirty=true;kick();});
    var lastBuilt=-1,hudT=0;
    var S={dirty:true,resize:resize,theme:theme,
      onShow:function(){if(!REDUCED&&!scanUserPaused&&!scanPlaying){scanPlaying=true;playUI();}},
      step:function(dt){
        var anim=false;
        if(scanPlaying){scanC+=dt*6;if(scanC>270)scanC=10;anim=true;hudT+=dt;if(hudT>.1){hudT=0;hudUpdate();drawChart();}}
        if(inertia(o))anim=true;
        if(!anim&&!S.dirty)return false;
        if(scanC!==lastBuilt){build();lastBuilt=scanC;}
        placeCam(cam,o,target);R.render(scene,cam);
        if(!stage.classList.contains('gl'))stage.classList.add('gl');
        S.dirty=false;return anim;
      }};
    theme();resize();build();
    fig2=S;watch(S,stage);
  }
  onReduced(function(r){if(r){scanPlaying=false;playUI();}});
  return {stage:scanStage,init:initFig2};
}

/* =====================================================================
   FIG 3
   ===================================================================== */
function setupFig3(){
  var msStage=$('#ms-stage');
  if(!msStage)return null;
  /* =====================================================================
     FIG 3 — micro surfacing application sequence
     ===================================================================== */
  var MS_STEPS=[
    {t0:0,text:'Mevcut yüzey: tekerlek izi çukurlaşması, çatlaklar ve agrega kaybı tespit edilir (amber). Uygulama kararı bu tespitten sonra verilir.'},
    {t0:3.5,text:'Yüzey hazırlığı: kaplama temizlenir; serme öncesi gerekli ön işlemler yapılır.'},
    {t0:5.5,text:'Karışım, serme kutusuyla şerit genişliğinde yayılır. Tekerlek izi çukurlaşmaları doldurulur, çatlaklar kapanır.'},
    {t0:13.5,text:'Kür ve trafiğe açılış: yeni, ince bir aşınma yüzeyi oluşur. Taşıyıcı tabakalar değişmez.'}
  ];
  var MS_T=17,msT=9.4,msPlaying=false,msUserPaused=false,fig3=null;
  var msPlay=$('#ms-play'),msSteps=$$('#ms-steps button'),msText=$('#ms-text');
  function msStepOf(t){for(var i=MS_STEPS.length-1;i>=0;i--)if(t>=MS_STEPS[i].t0)return i;return 0;}
  var msLastStep=-1;
  function msUI(){var s=msStepOf(msT);if(s!==msLastStep){msLastStep=s;msSteps.forEach(function(b){if(+b.getAttribute('data-step')===s)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});msText.textContent=MS_STEPS[s].text;}}
  function msPlayUI(){msPlay.setAttribute('aria-pressed',msPlaying?'true':'false');$('#ms-play-ic').textContent=msPlaying?'❚❚':'▶';$('#ms-play-t').textContent=msPlaying?'Duraklat':'Oynat';}
  msPlay.addEventListener('click',function(){msPlaying=!msPlaying;msUserPaused=!msPlaying;if(msPlaying&&msT>=MS_T-.05)msT=0;msPlayUI();kick();});
  msSteps.forEach(function(b){b.addEventListener('click',function(){var s=+b.getAttribute('data-step');msT=s===2?(REDUCED?9.4:MS_STEPS[2].t0):s===3?15.5:MS_STEPS[s].t0+(s===0?1.4:0);msUI();if(fig3){fig3.dirty=true;kick();}});});
  msUI();

  function initFig3(){
    var stage=msStage,canvas=$('canvas',stage),R=makeRenderer(canvas);
    if(!R){stage.classList.add('nogl');return;}
    var scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(30,2,.1,100);
    scene.add(new THREE.AmbientLight(0xffffff,.74));var dl=new THREE.DirectionalLight(0xffffff,.42);dl.position.set(-4,8,6);scene.add(dl);
    var NX=193,NZ=57,LX=12,LZ=3.6,nv=NX*NZ;
    function gs(u,s){return Math.exp(-u*u/(s*s));}
    function oldH(x,z){return -.065*(gs(z-.9,.34)*(.75+.25*Math.sin(x*.7))+gs(z+.9,.34)*(.55+.25*Math.sin(x*.5+1)))+.017*(gs(z-1.42,.18)+gs(z-.38,.18)+gs(z+.38,.18)+gs(z+1.42,.18))+.008*Math.sin(x*1.3+z*.7)+.004*Math.sin(x*4.1);}
    function rutN(x,z){return Math.max(gs(z-.9,.34)*(.75+.25*Math.sin(x*.7)),gs(z+.9,.34)*(.55+.25*Math.sin(x*.5+1)));}
    var TH=.03;function newH(x,z){return Math.max(oldH(x,z),-.004)+TH;}
    function grid(fn,withRut){var p=new Float32Array(nv*3),ra=new Float32Array(nv),ix=[];
      for(var j=0;j<NZ;j++)for(var i=0;i<NX;i++){var v=j*NX+i,x=-LX/2+i*LX/(NX-1),z=-LZ/2+j*LZ/(NZ-1);p[v*3]=x;p[v*3+1]=fn(x,z);p[v*3+2]=z;ra[v]=rutN(x,z);}
      for(j=0;j<NZ-1;j++)for(i=0;i<NX-1;i++){var a=j*NX+i,b=a+1,c=a+NX,d=c+1;ix.push(a,c,b,b,c,d);}
      var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('aRut',new THREE.BufferAttribute(ra,1));g.setIndex(ix);return g;}
    var VSH='attribute float aRut;varying vec3 vP;varying float vRut;void main(){vP=position;vRut=aRut;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
    var oldMat=new THREE.ShaderMaterial({uniforms:{uAsph:{value:new THREE.Color()},uCrack:{value:new THREE.Color()},uAmber:{value:new THREE.Color()},uMark:{value:0}},
      vertexShader:VSH,
      fragmentShader:GLSL_LIGHT+'uniform vec3 uAsph;uniform vec3 uCrack;uniform vec3 uAmber;uniform float uMark;varying vec3 vP;varying float vRut;\n'+
        'vec2 h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}\n'+
        'float vor(vec2 x){vec2 n=floor(x),f=fract(x),mg,mr;float md=8.0;for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j));vec2 r=g+h2(n+g)-f;float d=dot(r,r);if(d<md){md=d;mr=r;mg=g;}}\n'+
        'md=8.0;for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){vec2 g=mg+vec2(float(i),float(j));vec2 r=g+h2(n+g)-f;if(dot(mr-r,mr-r)>0.00001)md=min(md,dot(0.5*(mr+r),normalize(r-mr)));}return md;}\n'+
        'void main(){vec3 n=nrm(vP);float lit=0.55+0.45*max(dot(n,normalize(vec3(-0.3,1.0,0.5))),0.0);vec2 q=vP.xz;\n'+
        'float wp=clamp(exp(-pow((q.y-0.9)/0.3,2.0))+exp(-pow((q.y+0.9)/0.3,2.0)),0.0,1.0)*clamp(0.35+0.9*sin(q.x*0.8+1.3)*sin(q.x*0.31+0.4)+0.3,0.0,1.0);\n'+
        'float e=vor(q*vec2(2.3,2.9));float fw=fwidth(e);float crack=(1.0-smoothstep(0.012,0.012+fw*1.5+0.02,e))*wp;\n'+
        'float lc=(1.0-smoothstep(0.006,0.02,abs(q.y-0.05-0.03*sin(q.x*2.3))))*step(-3.0,q.x)*step(q.x,4.5);crack=max(crack,lc);\n'+
        'float sp=hash1(floor(q*60.0));float rav=step(0.93,hash1(floor(q*22.0)))*wp;\n'+
        'vec3 c=uAsph*lit*(0.88+0.24*sp);c=mix(c,uCrack,max(crack*0.92,rav*0.5));\n'+
        'float mk=max(crack,smoothstep(0.35,0.85,vRut)*0.55);c=mix(c,mix(c,uAmber,mk),uMark);gl_FragColor=vec4(c,1.0);}',
      extensions:{derivatives:true}});
    var newMat=new THREE.ShaderMaterial({uniforms:{uNew:{value:new THREE.Color()},uAmber:{value:new THREE.Color()},uFront:{value:-7}},
      vertexShader:VSH,
      fragmentShader:GLSL_LIGHT+'uniform vec3 uNew;uniform vec3 uAmber;uniform float uFront;varying vec3 vP;varying float vRut;\n'+
        'void main(){if(vP.x>uFront)discard;vec3 n=nrm(vP);float lit=0.6+0.4*max(dot(n,normalize(vec3(-0.3,1.0,0.5))),0.0);float sp=hash1(floor(vP.xz*90.0));\n'+
        'vec3 c=uNew*lit*(0.8+0.4*sp)+vec3(0.03)*sp;float edge=1.0-smoothstep(0.0,0.1,uFront-vP.x);c=mix(c,uAmber,edge*0.9);gl_FragColor=vec4(c,1.0);}',
      extensions:{derivatives:true}});
    var oldMesh=new THREE.Mesh(grid(oldH),oldMat),newMesh=new THREE.Mesh(grid(newH),newMat);scene.add(oldMesh,newMesh);
    // cut faces (front edge z=+LZ/2, end edge x=+LX/2)
    var hatchTex=null,skirtMat=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}),BOT=-.34;
    function skirt(pts,top,bot){var n=pts.length,p=new Float32Array(n*2*3),uv=new Float32Array(n*2*2),ix=[],s=0;
      for(var k=0;k<n;k++){var x=pts[k][0],z=pts[k][1];if(k)s+=Math.hypot(x-pts[k-1][0],z-pts[k-1][1]);var yt=top(x,z),yb=bot(x,z);
        p.set([x,yt,z,x,yb,z],k*6);uv.set([s,yt,s,yb],k*4);if(k)ix.push((k-1)*2,(k-1)*2+1,k*2,k*2,(k-1)*2+1,k*2+1);}
      var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('aRut',new THREE.BufferAttribute(new Float32Array(n*2),1));g.setIndex(ix);g.computeVertexNormals();return g;}
    var front=[],end=[];for(var k=0;k<NX;k++)front.push([-LX/2+k*LX/(NX-1),LZ/2]);for(k=0;k<NZ;k++)end.push([LX/2,LZ/2-k*LZ/(NZ-1)]);
    var fb=function(){return BOT;};
    scene.add(new THREE.Mesh(skirt(front,oldH,fb),skirtMat),new THREE.Mesh(skirt(end,oldH,fb),skirtMat));
    var newSkirtMat=newMat.clone();newSkirtMat.uniforms=newMat.uniforms; // share uniforms
    newSkirtMat.side=THREE.DoubleSide;
    scene.add(new THREE.Mesh(skirt(front,newH,oldH),newSkirtMat),new THREE.Mesh(skirt(end,newH,oldH),newSkirtMat));
    var edgeMat=new THREE.LineBasicMaterial();
    function edgeLine(pts,fn){return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(function(q){return new THREE.Vector3(q[0],fn(q[0],q[1]),q[1]);})),edgeMat);}
    scene.add(edgeLine(front,fb),edgeLine(end,fb));
    // spreader box
    var spr=new THREE.Group(),sprMat=new THREE.MeshLambertMaterial(),sprInk=new THREE.LineBasicMaterial();
    function part(w,h,d,x,y,z,m){var g=new THREE.BoxGeometry(w,h,d),me=new THREE.Mesh(g,m||sprMat);me.position.set(x,y,z);me.add(new THREE.LineSegments(new THREE.EdgesGeometry(g),sprInk));spr.add(me);return me;}
    part(.62,.4,3.92,.36,.24,0);part(.46,.3,3.5,.5,.6,0);part(1.0,.12,.07,.4,.1,1.99);part(1.0,.12,.07,.4,.1,-1.99);
    var strike=part(.05,.07,3.86,.03,.05,0,new THREE.MeshLambertMaterial());
    scene.add(spr);
    function theme(){
      oldMat.uniforms.uAsph.value.copy(col('--asph-old'));oldMat.uniforms.uCrack.value.copy(col('--crack'));oldMat.uniforms.uAmber.value.copy(col('--amber'));
      newMat.uniforms.uNew.value.copy(col('--asph-new'));newMat.uniforms.uAmber.value.copy(col('--amber'));
      if(hatchTex)hatchTex.dispose();hatchTex=tex(hatchCanvas('asph',cssv('--fig-face'),cssv('--fig-hatch')),R);hatchTex.repeat.set(1/.8,1/.8);skirtMat.map=hatchTex;skirtMat.needsUpdate=true;
      edgeMat.color.copy(col('--fig-edge'));sprMat.color.copy(col('--fig-face'));sprInk.color.copy(col('--fig-edge'));strike.material.color.copy(col('--fig-edge'));
    }
    var o={az:.36,el:.5,dist:12.6,minEl:.15,maxEl:1.15,minAz:-.9,maxAz:1.2,vaz:0},target=new THREE.Vector3(.2,-.1,0);
    function resize(){var r=stage.getBoundingClientRect();R.setSize(Math.max(1,r.width),Math.max(1,r.height),false);cam.aspect=r.width/Math.max(1,r.height);
      o.dist=cam.aspect<1.7?14.5:12.6;cam.updateProjectionMatrix();}
    function apply(){
      var t=msT,f,mark=0,sx;
      if(t<3.5){f=-7;mark=clamp(t/1.0,0,1);}
      else if(t<5.5){f=-7;mark=1-clamp((t-3.5)/1.6,0,1);}
      else if(t<13.5){f=-6.25+(t-5.5)/8*12.5;}
      else{f=6.4;}
      newMat.uniforms.uFront.value=f;oldMat.uniforms.uMark.value=mark;
      sx=t<5.5?-6.75:t<13.5?f:6.25+(t-13.5)*.9;
      spr.position.x=sx;spr.visible=t>=4.8&&sx<7.2;
    }
    orbit(stage,o,function(){S.dirty=true;kick();});
    var S={dirty:true,resize:resize,theme:theme,
      onShow:function(){if(!REDUCED&&!msUserPaused&&!msPlaying){msPlaying=true;msPlayUI();}},
      step:function(dt){
        var anim=false;
        if(msPlaying){msT+=dt;if(msT>=MS_T)msT=0;anim=true;msUI();}
        if(inertia(o))anim=true;
        if(!anim&&!S.dirty)return false;
        apply();placeCam(cam,o,target);R.render(scene,cam);
        if(!stage.classList.contains('gl'))stage.classList.add('gl');
        S.dirty=false;return anim;
      }};
    theme();resize();apply();
    fig3=S;watch(S,stage);
  }
  onReduced(function(r){if(r){msPlaying=false;msPlayUI();}});
  return {stage:msStage,init:initFig3};
}

/* ---------- boot: text first, WebGL after first paint ---------- */
var figs=[];
[setupFig1,setupFig2,setupFig3].forEach(function(setup){
  try{var f=setup();if(f)figs.push(f);}catch(e){console.error(e);}
});
if(!figs.length)return;
function boot(){
  figs.forEach(function(f){try{f.init();}catch(e){console.error(e);f.stage.classList.add('nogl');}});
  kick();
}
if(!HAS3)figs.forEach(function(f){f.stage.classList.add('nogl');});
else requestAnimationFrame(function(){setTimeout(boot,30);});
})();
