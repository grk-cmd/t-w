(function(){
  /* ── 파츠 표: 얼굴 레이어는 200×200 텍스처 좌표. 한 짝을 (0,0) 중심으로 그리고 자리(BASE)에 놓는다. 오른쪽 짝은 좌우를 뒤집어 놓는다 ── */
  var INK='#2A2320';
  var P={
    shape:[
      {id:'round',name:'동글',rx:96,ry:96},
      {id:'soft',name:'말랑',rx:98,ry:90},
      {id:'long',name:'갸름',rx:88,ry:98}
    ],
    eyes:[
      {id:'dot',name:'콩',open:function(){return '<circle r="7" fill="'+INK+'"/>';},closed:'<path d="M-8 0h16" stroke="'+INK+'" stroke-width="4" stroke-linecap="round"/>'},
      {id:'round',name:'동그랑',open:function(c){return '<ellipse rx="10" ry="12" fill="'+c+'" stroke="'+INK+'" stroke-width="3"/><circle cx="3" cy="-5" r="3.5" fill="#fff"/>';},closed:'<path d="M-11 -2q11 10 22 0" fill="none" stroke="'+INK+'" stroke-width="4" stroke-linecap="round"/>'},
      {id:'sparkle',name:'반짝',open:function(c){return '<ellipse rx="13" ry="15" fill="'+c+'" stroke="'+INK+'" stroke-width="3"/><circle cx="4" cy="-6" r="4.5" fill="#fff"/><circle cx="-5" cy="6" r="2" fill="#fff"/><path d="M-14 -12q14-8 28 0" fill="none" stroke="'+INK+'" stroke-width="4" stroke-linecap="round"/>';},closed:'<path d="M-14 -4q14 14 28 0M-14 -4l-5 -4" fill="none" stroke="'+INK+'" stroke-width="4" stroke-linecap="round"/>'},
      {id:'smile',name:'웃는',open:function(){return '<path d="M-10 4q10-12 20 0" fill="none" stroke="'+INK+'" stroke-width="4.5" stroke-linecap="round"/>';},closed:'<path d="M-10 4q10-12 20 0" fill="none" stroke="'+INK+'" stroke-width="4.5" stroke-linecap="round"/>'},
      {id:'sleepy',name:'졸린',open:function(c){return '<path d="M-11 -4h22v4a11 9 0 0 1-22 0z" fill="'+c+'" stroke="'+INK+'" stroke-width="3"/>';},closed:'<path d="M-11 0h22" stroke="'+INK+'" stroke-width="4" stroke-linecap="round"/>'}
    ],
    brows:[
      {id:'none',name:'없음',svg:''},
      {id:'arc',name:'얇은',svg:'<path d="M-12 2q12-8 24 0" fill="none" stroke="'+INK+'" stroke-width="3" stroke-linecap="round"/>'},
      {id:'thick',name:'굵은',svg:'<rect x="-10" y="-3" width="20" height="6" rx="3" fill="'+INK+'"/>'},
      {id:'worry',name:'걱정',svg:'<path d="M-10 -3l20 6" stroke="'+INK+'" stroke-width="3.5" stroke-linecap="round"/>'}
    ],
    mouth:[
      {id:'smile',name:'미소',svg:'<path d="M-10 -2q10 9 20 0" fill="none" stroke="'+INK+'" stroke-width="3.5" stroke-linecap="round"/>'},
      {id:'cat',name:'고양이',svg:'<path d="M-14 -4q7 9 14 0q7 9 14 0" fill="none" stroke="'+INK+'" stroke-width="3.5" stroke-linecap="round"/>'},
      {id:'open',name:'헤',svg:'<path d="M-11 -6h22q-2 16-11 16t-11-16z" fill="#9A3B3B" stroke="'+INK+'" stroke-width="3" stroke-linejoin="round"/><path d="M-6 5q6-4 12 0" fill="none" stroke="#F28A8A" stroke-width="3"/>'},
      {id:'flat',name:'일자',svg:'<path d="M-8 -1h16" stroke="'+INK+'" stroke-width="3.5" stroke-linecap="round"/>'},
      {id:'o',name:'오',svg:'<ellipse rx="5" ry="6" fill="#9A3B3B" stroke="'+INK+'" stroke-width="3"/>'}
    ],
    cheek:[
      {id:'none',name:'없음',svg:''},
      {id:'blush',name:'발그레',svg:'<ellipse rx="13" ry="7" fill="#FF8FA8" opacity=".6"/>'},
      {id:'lines',name:'빗금',svg:'<path d="M-8 4l5-8M0 4l5-8M8 4l5-8" stroke="#F06A88" stroke-width="2.5" stroke-linecap="round"/>'},
      {id:'freckle',name:'주근깨',svg:'<g fill="#B5784F"><circle cx="-2" cy="-6" r="2"/><circle cx="6" cy="0" r="2"/><circle cx="-6" cy="2" r="2"/></g>'}
    ],
    hair:[
      {id:'bob',name:'단발'},
      {id:'bang',name:'일자 앞머리'},
      {id:'side',name:'옆 가르마'},
      {id:'bun',name:'똥머리'},
      {id:'twin',name:'양갈래'}
    ]
  };
  /* 자리: 짝 파츠는 왼쪽 x(오른쪽은 200-x), 하나짜리는 가운데 */
  var BASE={eyes:{x:66,y:112},brows:{x:66,y:88},cheek:{x:48,y:134},mouth:{x:100,y:142}};
  var PAIRED={eyes:true,brows:true,cheek:true};
  var ADJ_KEYS=['eyes','brows','mouth','cheek','hair'];
  var LIM={x:[-40,40],y:[-40,40],s:[0.5,1.8],r:[-45,45]};
  var COLORS={
    skin:['#FFE9D9','#FFDCC2','#F2C29E','#D69E78','#9C6B4C'],
    eyes:['#3B2A22','#2E5E9C','#3E8A5A','#8A4FB5','#C2593A'],
    hair:['#3A2A22','#7A4E33','#D9A35B','#F0D9A8','#E58FA9','#7C8BD9','#3E3E46'],
    cloth:['#9AD8C6','#FF9BB3','#BEC2EE','#FFC24B','#FFFFFF','#5C6B8A']
  };
  /* 탭: 얼굴 레이어(텍스처로 합쳐짐) · 내 그림 · 3D 파츠(머리 · 옷) */
  var TABS=[
    {id:'shape',name:'얼굴형 · 피부',items:'shape',color:'skin'},
    {id:'eyes',name:'눈',items:'eyes',color:'eyes'},
    {id:'brows',name:'눈썹',items:'brows'},
    {id:'mouth',name:'입',items:'mouth'},
    {id:'cheek',name:'볼',items:'cheek'},
    {id:'img',name:'내 그림'},
    {id:'hair',name:'머리',items:'hair',color:'hair'},
    {id:'cloth',name:'옷',color:'cloth'}
  ];
  var NAMES={shape:'얼굴형 · 피부',eyes:'눈',brows:'눈썹',mouth:'입',cheek:'볼',img:'내 그림'};
  function one(){return {x:0,y:0,s:1,r:0};}
  function freshAdj(){var a={};ADJ_KEYS.forEach(function(k){a[k]=PAIRED[k]?{L:one(),R:one()}:{C:one()};});return a;}
  var DEFAULT={shape:'round',skin:COLORS.skin[1],eyes:'round',eyesC:COLORS.eyes[0],brows:'arc',mouth:'smile',cheek:'blush',hair:'bang',hairC:COLORS.hair[1],cloth:COLORS.cloth[0],sym:true,adj:freshAdj(),img:null};
  function clone(o){return JSON.parse(JSON.stringify(o));}
  /* 예시 캐릭터처럼 조정값이 없는 상태도 받아 준다 */
  function norm(s){var n=clone(s);if(!n.adj)n.adj=freshAdj();if(n.sym===undefined)n.sym=true;if(n.img===undefined)n.img=null;return n;}
  function mirror(a){return {x:-a.x,y:a.y,s:a.s,r:-a.r};}
  function find(list,id){for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i];return list[0];}
  function clamp(v,k){return Math.max(LIM[k][0],Math.min(LIM[k][1],v));}

  function partInner(k,s,expr){
    if(k==='eyes'){var e=find(P.eyes,s.eyes);return expr==='closed'?e.closed:e.open(s.eyesC);}
    return find(P[k],s[k]).svg;
  }
  function g(x,y,a,flip){return '<g transform="translate('+(x+a.x)+' '+(y+a.y)+') rotate('+a.r+') scale('+(flip?-a.s:a.s)+' '+a.s+')">';}
  function layerSVG(k,s,expr){
    var inner=partInner(k,s,expr);if(!inner)return '';
    var b=BASE[k],a=s.adj[k];
    if(!PAIRED[k])return g(b.x,b.y,a.C)+inner+'</g>';
    return g(b.x,b.y,a.L)+inner+'</g>'+g(200-b.x,b.y,a.R,true)+inner+'</g>';
  }
  function imgSVG(s,expr){
    var im=s.img;if(!im||(im.on!=='both'&&im.on!==expr))return '';
    return '<image href="'+im.url+'" x="0" y="0" width="200" height="200" preserveAspectRatio="none"/>';
  }
  /* 얼굴 텍스처 = 레이어를 아래부터 쌓은 결과. 내 그림은 «눈코입 아래» 또는 «맨 위» */
  function faceLayers(s,expr){
    s=s.adj?s:norm(s);
    var under=s.img&&s.img.pos==='under'?imgSVG(s,expr):'',top=s.img&&s.img.pos==='top'?imgSVG(s,expr):'';
    return under+layerSVG('cheek',s,expr)+layerSVG('eyes',s,expr)+layerSVG('brows',s,expr)+layerSVG('mouth',s,expr)+top;
  }
  function texture(s,expr){
    var sh=find(P.shape,s.shape);
    return '<ellipse cx="100" cy="104" rx="'+(sh.rx-6)+'" ry="'+(sh.ry-8)+'" fill="'+s.skin+'"/>'+faceLayers(s,expr);
  }
  function shade(hex,k){var n=parseInt(hex.slice(1),16),r=n>>16,gg=n>>8&255,b=n&255;function f(v){return Math.max(0,Math.min(255,Math.round(v*k)));}return 'rgb('+f(r)+','+f(gg)+','+f(b)+')';}

  /* 캐릭터 그림(시안용 2D). 머리 중심 120,120 · 얼굴 텍스처를 머리 위에 줄여 붙인다 */
  function deskSVG(o){
    return '<rect x="18" y="226" width="204" height="18" fill="#B98A5E" stroke="#6B4A2E" stroke-width="3"/>'+
      '<rect x="150" y="206" width="22" height="22" fill="#9AD8C6" stroke="'+o+'" stroke-width="3"/>'+
      '<rect x="36" y="244" width="10" height="26" fill="#8C6544"/><rect x="194" y="244" width="10" height="26" fill="#8C6544"/>';
  }
  function charSVG(s,expr,uid,noDesk){
    s=s.adj?s:norm(s);
    var sh=find(P.shape,s.shape),hc=s.hairC,dk=shade(hc,.78),o='#3A2E28';
    var rx=sh.rx*0.84,ry=sh.ry*0.84,back='',front='';
    if(s.hair==='bob'){back='<path d="M38 120q0-86 82-86t82 86v40q-14 8-26 0v-30H64v30q-12 8-26 0z" fill="'+hc+'" stroke="'+o+'" stroke-width="3"/>';front='<path d="M46 108q4-62 74-64q70 2 74 64q-30-26-74-26t-74 26z" fill="'+hc+'" stroke="'+o+'" stroke-width="3"/>';}
    if(s.hair==='bang'){back='<path d="M42 118q0-82 78-82t78 82v16H42z" fill="'+dk+'" stroke="'+o+'" stroke-width="3"/>';front='<path d="M44 102q6-58 76-60q70 2 76 60l-12-8-10 10-12-10-12 10-12-10-12 10-12-10-12 10-12-10-10 10z" fill="'+hc+'" stroke="'+o+'" stroke-width="3" stroke-linejoin="round"/>';}
    if(s.hair==='side'){back='<path d="M40 122q0-84 80-84t80 84v24q-10 6-18 0V122H58v24q-8 6-18 0z" fill="'+dk+'" stroke="'+o+'" stroke-width="3"/>';front='<path d="M44 112q2-66 76-68q72 2 78 62q-40-6-62-34q-16 30-92 40z" fill="'+hc+'" stroke="'+o+'" stroke-width="3" stroke-linejoin="round"/>';}
    if(s.hair==='bun'){back='<circle cx="120" cy="28" r="24" fill="'+hc+'" stroke="'+o+'" stroke-width="3"/><path d="M42 118q0-80 78-80t78 80z" fill="'+dk+'" stroke="'+o+'" stroke-width="3"/>';front='<path d="M46 100q8-56 74-58q66 2 74 58q-36-18-74-18t-74 18z" fill="'+hc+'" stroke="'+o+'" stroke-width="3"/>';}
    if(s.hair==='twin'){back='<path d="M30 110q-24 40-6 84q14-30 30-44zM210 110q24 40 6 84q-14-30-30-44z" fill="'+hc+'" stroke="'+o+'" stroke-width="3" stroke-linejoin="round"/><path d="M42 118q0-80 78-80t78 80z" fill="'+dk+'" stroke="'+o+'" stroke-width="3"/>';front='<path d="M46 104q6-58 74-60q68 2 74 60q-22-14-40-16l-34 10-34-10q-18 2-40 16z" fill="'+hc+'" stroke="'+o+'" stroke-width="3" stroke-linejoin="round"/><circle cx="40" cy="104" r="7" fill="#FF9BB3" stroke="'+o+'" stroke-width="2.5"/><circle cx="200" cy="104" r="7" fill="#FF9BB3" stroke="'+o+'" stroke-width="2.5"/>';}
    /* 머리 조정: 머리 중심을 기준으로 옮기고 키운다 */
    var h=s.adj.hair.C,ht='translate('+h.x+' '+h.y+') translate(120 120) scale('+h.s+') translate(-120 -120)';
    var clip='fc'+uid;
    return '<defs><clipPath id="'+clip+'"><ellipse cx="120" cy="120" rx="'+rx+'" ry="'+ry+'"/></clipPath></defs>'+
      '<g transform="'+ht+'">'+back+'</g>'+
      '<path d="M78 196q42-26 84 0v34H78z" fill="'+s.cloth+'" stroke="'+o+'" stroke-width="3"/>'+
      '<ellipse cx="120" cy="120" rx="'+rx+'" ry="'+ry+'" fill="'+s.skin+'" stroke="'+o+'" stroke-width="3"/>'+
      '<g clip-path="url(#'+clip+')"><g transform="translate(120 120) scale('+(rx/100)+' '+(ry/100)+') translate(-100 -108)">'+faceLayers(s,expr)+'</g></g>'+
      '<g transform="'+ht+'">'+front+'</g>'+
      (noDesk?'':deskSVG(o));
  }

  /* ── 상태 ── */
  var sceneReady=false;
  var state=clone(DEFAULT),history=[],expr='open',tab='shape',side='L',uidN=0;
  function snap(){history.push(clone(state));if(history.length>40)history.shift();$('undo').disabled=false;}
  function set(k,v){snap();state[k]=v;render();}

  var $=function(id){return document.getElementById(id);};
  function thumbFor(t,item){
    var s=clone(state);s.adj=freshAdj();s.img=null;
    if(t.id==='hair'){s.hair=item.id;return '<svg viewBox="20 0 200 220">'+charSVG(s,'open','t'+(uidN++))+'</svg>';}
    if(t.id==='shape'){var sh=item;return '<svg viewBox="0 0 200 200"><ellipse cx="100" cy="104" rx="'+(sh.rx-6)+'" ry="'+(sh.ry-8)+'" fill="'+state.skin+'" stroke="#3A2E28" stroke-width="4"/></svg>';}
    s[t.id]=item.id;
    var layer=layerSVG(t.id,s,'open')||'<path d="M70 70l60 60M130 70l-60 60" stroke="#C0C0C0" stroke-width="4"/>';
    var vb=t.id==='mouth'?'50 100 100 80':t.id==='brows'?'30 45 140 90':t.id==='cheek'?'20 90 160 90':'30 70 140 90';
    return '<svg viewBox="'+vb+'"><rect x="0" y="0" width="200" height="200" fill="'+state.skin+'"/>'+layer+'</svg>';
  }
  var colorKey={skin:'skin',eyes:'eyesC',hair:'hairC',cloth:'cloth'};
  function curTab(){return TABS.filter(function(x){return x.id===tab;})[0];}

  function renderTabs(){
    $('tabs').innerHTML=TABS.map(function(t){return '<button type="button" role="tab" aria-selected="'+(t.id===tab)+'" data-tab="'+t.id+'">'+t.name+'</button>';}).join('');
  }
  function renderPanel(){
    var t=curTab();
    var list=t.items?P[t.items]:null;
    $('itemsLabel').hidden=!list;$('items').hidden=!list;
    if(list){
      $('items').innerHTML=list.map(function(it){return '<button type="button" aria-pressed="'+(state[t.items]===it.id)+'" data-item="'+it.id+'" title="'+it.name+'" aria-label="'+it.name+'">'+thumbFor(t,it)+'</button>';}).join('');
    }
    $('swLabel').hidden=!t.color;$('swatches').hidden=!t.color;
    if(t.color){
      var key=colorKey[t.color];
      $('swatches').innerHTML=COLORS[t.color].map(function(c){return '<button type="button" style="--c:'+c+'" aria-label="색 '+c+'" aria-pressed="'+(state[key]===c)+'" data-color="'+c+'"></button>';}).join('');
    }
    renderAdj();renderImgBox();
  }
  /* 조정 칸: 짝 파츠는 대칭이면 왼쪽을 고치고 오른쪽은 거울로 따라온다 */
  function adjTarget(){
    var a=state.adj[tab];if(!a)return null;
    if(!PAIRED[tab])return a.C;
    return state.sym?a.L:a[side];
  }
  function renderAdj(){
    var on=ADJ_KEYS.indexOf(tab)>=0;$('adjBox').hidden=!on;if(!on)return;
    var paired=!!PAIRED[tab];
    $('symBtn').hidden=!paired;$('symBtn').setAttribute('aria-pressed',String(state.sym));
    $('sideSeg').hidden=!paired||state.sym;
    document.querySelectorAll('#sideSeg [data-side]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-side')===side));});
    $('rowR').hidden=tab==='hair';
    syncSliders();
  }
  function syncSliders(){
    var a=adjTarget();if(!a)return;
    $('adjX').value=a.x;$('adjY').value=a.y;$('adjS').value=Math.round(a.s*100);$('adjR').value=a.r;
    $('outX').textContent=a.x;$('outY').textContent=a.y;$('outS').textContent=Math.round(a.s*100)+'%';$('outR').textContent=a.r+'°';
  }
  function applyAdj(k,val){
    var a=adjTarget();if(!a)return;
    a[k]=k==='s'?clamp(val/100,'s'):clamp(val,k);
    if(PAIRED[tab]&&state.sym)state.adj[tab].R=mirror(state.adj[tab].L);
  }
  function renderImgBox(){
    var on=tab==='img';$('imgBox').hidden=!on;if(!on)return;
    var im=state.img;
    $('imgInfo').textContent=im?im.note:'아직 불러온 그림이 없어요.';
    $('imgOpts').hidden=!im;
    if(im){
      document.querySelectorAll('[name=imgPos]').forEach(function(r){r.checked=r.value===im.pos;});
      document.querySelectorAll('[name=imgOn]').forEach(function(r){r.checked=r.value===im.on;});
    }
  }
  function renderLayers(){
    var order=['cheek','mouth','brows','eyes','shape'];
    if(state.img)order.splice(state.img.pos==='top'?0:4,0,'img');
    $('layers').innerHTML=order.map(function(k,i){
      var label=k==='img'?(state.img.pos==='top'?'맨 위':'눈코입 아래'):find(P[k],state[k]).name;
      return '<div class="'+(k===tab?'on':'')+'" data-tab="'+k+'"><span>'+(order.length-i)+'</span><span>'+NAMES[k]+'</span><span>'+label+'</span></div>';
    }).join('');
  }
  /* Shift 로 한 방향만 움직이는 중이면 그 줄을 보여 준다 */
  function lockGuide(){
    if(!drag||!drag.lock)return '';
    var b=BASE[tab],bx=drag.sd==='R'?200-b.x:b.x,x=bx+drag.sx,y=b.y+drag.sy;
    return drag.lock==='x'?'<line x1="0" y1="'+y+'" x2="200" y2="'+y+'" stroke="#C2185B" stroke-width="1.2" stroke-dasharray="3 3"/>':'<line x1="'+x+'" y1="0" x2="'+x+'" y2="200" stroke="#C2185B" stroke-width="1.2" stroke-dasharray="3 3"/>';
  }
  /* 텍스처 위 손잡이: 지금 탭의 파츠 자리마다 점 하나 */
  function handles(){
    if(!BASE[tab])return '';
    var b=BASE[tab],a=state.adj[tab],out='';
    /* 손가락 끝(0,0)이 파츠 자리를 짚는 손. 오른쪽 짝은 좌우를 뒤집어 오른손으로 */
    function dot(x,y,sd,active){
      var line=active?'#000080':'#6A6A6A';
      return '<g class="hd" data-hd="'+sd+'" transform="translate('+x+' '+y+') scale('+(sd==='R'?-1.35:1.35)+' 1.35)" opacity="'+(active?1:.75)+'">'+
        '<circle r="4" fill="none" stroke="'+line+'" stroke-width="1.2"/>'+
        '<path d="M-1.6 1.5V-.2Q0-1.6 1.6-.2V7Q3 6 4.4 7.3Q6 6.6 7.2 8.2Q8.8 7.8 9.6 9.6V14Q9.6 18.5 5.6 19.5H.6Q-2.4 19.5-4 16.6L-6.6 11.6Q-7.2 10 -5.6 9.6Q-4.4 9.4 -3.4 11L-1.6 13Z" fill="#fff" stroke="'+line+'" stroke-width="1.3" stroke-linejoin="round"/>'+
        '<path d="M1.6 7V11M4.4 7.3V11.4M7.2 8.2V11.8" stroke="'+line+'" stroke-width=".9" stroke-linecap="round"/>'+
        '<rect x="-8" y="-4" width="19" height="25" fill="transparent"/>'+
        '</g>';
    }
    if(!PAIRED[tab])return lockGuide()+dot(b.x+a.C.x,b.y+a.C.y,'C',true);
    out+=dot(b.x+a.L.x,b.y+a.L.y,'L',state.sym||side==='L');
    out+=dot(200-b.x+a.R.x,b.y+a.R.y,'R',state.sym||side==='R');
    if(state.sym)out='<line x1="100" y1="20" x2="100" y2="190" stroke="#000080" stroke-width="1" stroke-dasharray="4 4" opacity=".5"/>'+out;
    return lockGuide()+out;
  }
  function renderFace(){
    $('preview').innerHTML=charSVG(state,expr,'p');
    $('texOpen').innerHTML=texture(state,'open')+'<g class="hds">'+handles()+'</g>';
    $('texClosed').innerHTML=texture(state,'closed');
    if(sceneReady)drawScene();
  }
  function render(){
    renderFace();renderTabs();renderPanel();renderLayers();
    $('undo').disabled=!history.length;
  }

  /* 슬라이더: 끌기 한 번에 되돌리기 한 칸 */
  var sliding=false;
  [['adjX','x'],['adjY','y'],['adjS','s'],['adjR','r']].forEach(function(p){
    var el=$(p[0]);
    el.addEventListener('input',function(){if(!sliding){snap();sliding=true;}applyAdj(p[1],+el.value);syncSliders();renderFace();});
    el.addEventListener('change',function(){sliding=false;renderLayers();});
  });
  $('adjReset').addEventListener('click',function(){
    if(!state.adj[tab])return;snap();
    state.adj[tab]=PAIRED[tab]?{L:one(),R:one()}:{C:one()};
    syncSliders();renderFace();
  });
  $('symBtn').addEventListener('click',function(){
    snap();state.sym=!state.sym;
    if(state.sym)Object.keys(PAIRED).forEach(function(k){state.adj[k].R=mirror(state.adj[k].L);});
    renderAdj();renderFace();
  });
  $('sideSeg').addEventListener('click',function(e){var b=e.target.closest('[data-side]');if(!b)return;side=b.getAttribute('data-side');renderAdj();renderFace();});

  /* 텍스처 위에서 점 끌기 */
  var drag=null,tex=$('texOpen');
  function svgPt(e){var pt=tex.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(tex.getScreenCTM().inverse());}
  tex.addEventListener('pointerdown',function(e){
    var h=e.target.closest('.hd');if(!h)return;
    var sd=h.getAttribute('data-hd');
    if(PAIRED[tab]&&!state.sym)side=sd;
    var p0=svgPt(e),t0=state.adj[tab][sd];
    drag={sd:sd,px:p0.x,py:p0.y,sx:t0.x,sy:t0.y,lock:null};snap();tex.setPointerCapture(e.pointerId);tex.classList.add('dragging');e.preventDefault();
    renderAdj();
  });
  tex.addEventListener('pointermove',function(e){
    if(!drag)return;
    var p=svgPt(e),b=BASE[tab],a=state.adj[tab];
    var t=a[drag.sd],dx=p.x-drag.px,dy=p.y-drag.py;
    /* Shift: 끌기 시작한 자리에서 더 많이 움직인 쪽 한 방향으로만 */
    drag.lock=e.shiftKey?(Math.abs(dx)>=Math.abs(dy)?'x':'y'):null;
    if(drag.lock==='x')dy=0;if(drag.lock==='y')dx=0;
    t.x=Math.round(clamp(drag.sx+dx,'x'));t.y=Math.round(clamp(drag.sy+dy,'y'));
    if(PAIRED[tab]&&state.sym){if(drag.sd==='L')a.R=mirror(a.L);else a.L=mirror(a.R);}
    syncSliders();renderFace();
  });
  function endDrag(){tex.classList.remove('dragging');if(drag){drag=null;renderLayers();renderFace();}}
  tex.addEventListener('pointerup',endDrag);tex.addEventListener('pointercancel',endDrag);

  /* 내 그림: 256×256 으로 맞춰 텍스처 레이어로 붙인다 */
  $('imgFile').addEventListener('change',function(){
    var f=this.files&&this.files[0];this.value='';if(!f)return;
    if(!/^image\/(png|jpeg|webp)$/.test(f.type)){$('imgInfo').textContent='PNG · JPG · WEBP 그림만 불러올 수 있어요.';return;}
    var r=new FileReader();
    r.onload=function(){
      var im=new Image();
      im.onload=function(){
        var c=document.createElement('canvas');c.width=c.height=256;
        c.getContext('2d').drawImage(im,0,0,256,256);
        var fit=im.naturalWidth===256&&im.naturalHeight===256;
        snap();
        state.img={url:c.toDataURL('image/png'),pos:state.img?state.img.pos:'under',on:state.img?state.img.on:'both',
          note:f.name+' · '+(fit?'256×256 그대로 붙였어요.':im.naturalWidth+'×'+im.naturalHeight+' 그림을 256×256 으로 맞췄어요.')};
        tab='img';render();
      };
      im.onerror=function(){$('imgInfo').textContent='그림을 읽지 못했어요. 다른 파일로 해 주세요.';};
      im.src=r.result;
    };
    r.readAsDataURL(f);
  });
  $('imgBox').addEventListener('change',function(e){
    if(!state.img)return;
    if(e.target.name==='imgPos'){snap();state.img.pos=e.target.value;render();}
    if(e.target.name==='imgOn'){snap();state.img.on=e.target.value;render();}
  });
  $('imgClear').addEventListener('click',function(){if(!state.img)return;snap();state.img=null;render();});

  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-tab]');
    if(b){tab=b.getAttribute('data-tab');render();return;}
    b=e.target.closest('#items [data-item]');
    if(b){set(curTab().items,b.getAttribute('data-item'));return;}
    b=e.target.closest('#swatches [data-color]');
    if(b){set(colorKey[curTab().color],b.getAttribute('data-color'));return;}
    b=e.target.closest('[data-expr]');
    if(b){expr=b.getAttribute('data-expr');document.querySelectorAll('[data-expr]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});renderFace();return;}
    b=e.target.closest('.card[data-pick]');
    if(b){snap();state=norm(JSON.parse(b.getAttribute('data-pick')));render();document.getElementById('maker').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});return;}
    b=e.target.closest('[data-dl]');
    if(b){openDl(b.getAttribute('data-dl'));return;}
    b=e.target.closest('[data-dlg]');
    if(b){openDlg(b.getAttribute('data-dlg'));return;}
  });
  $('rand').addEventListener('click',function(){snap();var keep=state.img;state=randomState();state.img=keep;render();});
  $('undo').addEventListener('click',function(){if(history.length){state=history.pop();render();}});
  $('reset').addEventListener('click',function(){snap();state=clone(DEFAULT);render();});

  function pick(a){return a[Math.floor(Math.random()*a.length)];}
  function randomState(){
    return norm({shape:pick(P.shape).id,skin:pick(COLORS.skin),eyes:pick(P.eyes).id,eyesC:pick(COLORS.eyes),brows:pick(P.brows).id,mouth:pick(P.mouth).id,cheek:pick(P.cheek).id,hair:pick(P.hair).id,hairC:pick(COLORS.hair),cloth:pick(COLORS.cloth)});
  }

  /* 대화상자 (시안: 실제 동작 없음) */
  var DLG={
    land:{t:'투게더랜드',b:'<div class="land-dlg"><span class="warn" aria-hidden="true">⚠️</span><div><p><b>이 문은 아직 잠겨 있어요.</b></p><p>어딘가에서 새로운 땅을 짓는 소리가 들려요…</p><p class="land-bar" aria-label="TOGETHER LAND 38%">TOGETHER LAND ▓▓▓▓▓<span class="blink" aria-hidden="true">▓</span>░░░░░ 38%</p></div></div><div class="row"><button class="btn default" type="button" data-close>확인</button></div>'},
    export:{t:'앱으로 가져가기',b:'<p style="margin:0">아래 코드를 복사해 앱의 <b>캐릭터 선택하기 › 코드 입력하기</b>에 붙여 넣으면 돼요.</p><div class="field">DCC1-예시-이-코드는-시안용이에요-3f9a…</div><p style="margin:0;font-size:13px;color:var(--ink-soft)">얼굴은 기본 · 감은눈 텍스처 두 장으로 함께 들어가요.</p><div class="row"><button class="btn" type="button" data-close>파일로 받기</button><button class="btn default" type="button" data-close>코드 복사</button></div>'},
    upload:{t:'라이브러리에 올리기',b:'<p style="margin:0">올리려면 투게더워킹 계정으로 로그인해야 해요.</p><div class="row"><button class="btn" type="button" data-close>취소</button><button class="btn default" type="button" data-dlg="share">로그인</button></div><p class="hint-s">시안: 로그인 버튼을 누르면 로그인된 것으로 보고 다음 창으로 넘어가요.</p>'},
    share:{t:'라이브러리에 올리기',wide:true,b:shareForm},
    login:{t:'로그인',b:'<div class="row" style="justify-content:stretch;flex-direction:column"><button class="btn big" type="button" data-close>구글로 로그인</button><button class="btn big" type="button" data-close>친구 코드로 로그인</button></div><p style="margin:0;font-size:13px;color:var(--ink-soft)">로그인은 라이브러리에 올리거나 ♥ 할 때만 필요해요.</p>'}
  };
  var lastFocus=null;
  /* 라이브러리에 올리기 설정창 — 공개 이름을 «내 닉네임» 또는 «익명» 으로 고른다. 시안: 로그인한 사람의 닉네임은 예시 */
  var MY_NICK='고로케';
  var ANON_ANIMALS=['오리','고양이','토끼','너구리','펭귄','햄스터'];
  function anonName(){return '익명의 '+ANON_ANIMALS[Math.floor(Math.random()*ANON_ANIMALS.length)]+' #'+(1000+Math.floor(Math.random()*9000));}
  var shareAnon=anonName();
  function shareForm(){
    return '<form id="shareForm" class="share">'+
      '<div class="share-grid">'+
        '<div class="share-prev"><p class="group-l">라이브러리에 이렇게 보여요</p>'+
          '<div class="card share-card"><div class="thumb"><svg viewBox="10 0 220 250" aria-hidden="true">'+charSVG(state,'open','sh')+'</svg></div><b id="shPrevName">내 캐릭터</b><div class="meta"><span id="shPrevBy"></span><span>♥ 0 · ⤓ 0</span></div></div>'+
        '</div>'+
        '<div class="share-fields">'+
          '<label for="shName">캐릭터 이름</label><input id="shName" maxlength="20" value="내 캐릭터" required>'+
          '<label for="shDesc">한 줄 소개 <small>(선택)</small></label><input id="shDesc" maxlength="40" placeholder="예: 마감 전날의 나">'+
          '<label for="shTags">태그 <small>(쉼표로 나눠요)</small></label><input id="shTags" maxlength="40" placeholder="예: 사람, 단발, 졸림">'+
          '<fieldset><legend>올린 사람 이름</legend>'+
            '<label><input type="radio" name="shWho" value="me" checked> 내 닉네임으로 <b id="shMe"></b></label>'+
            '<label><input type="radio" name="shWho" value="anon"> 익명으로 <b id="shAnon"></b> <button class="btn mini" type="button" id="shReroll" aria-label="익명 이름 다시 뽑기">🎲</button></label>'+
            '<p class="hint-s">익명이면 다른 사람에게 내 닉네임 · 친구 코드 · 마이홈이 보이지 않아요. 신고가 들어오면 운영진은 올린 계정을 확인할 수 있어요.</p>'+
          '</fieldset>'+
          '<fieldset><legend>다른 사람이</legend>'+
            '<label><input type="checkbox" id="shTake" checked> 앱으로 가져갈 수 있어요</label>'+
            '<label><input type="checkbox" id="shRemix" checked> 이걸로 시작해서 고칠 수 있어요</label>'+
          '</fieldset>'+
        '</div>'+
      '</div>'+
      '<div class="row"><button class="btn" type="button" data-close>취소</button><button class="btn default" type="submit">올리기</button></div>'+
    '</form>';
  }
  function wireShare(){
    var f=$('shareForm');if(!f)return;
    $('shMe').textContent=MY_NICK;$('shAnon').textContent=shareAnon;
    function sync(){
      var anon=f.querySelector('[name=shWho]:checked').value==='anon';
      $('shPrevBy').textContent=anon?shareAnon:MY_NICK;
      $('shPrevName').textContent=$('shName').value.trim()||'내 캐릭터';
    }
    f.addEventListener('change',sync);f.addEventListener('input',sync);
    $('shReroll').addEventListener('click',function(){shareAnon=anonName();$('shAnon').textContent=shareAnon;f.querySelector('[value=anon]').checked=true;sync();});
    f.addEventListener('submit',function(e){
      e.preventDefault();
      var who=$('shPrevBy').textContent,name=$('shPrevName').textContent;
      $('dlgBody').innerHTML='<p style="margin:0">라이브러리에 올렸어요: <b id="shDoneName"></b></p><p style="margin:0;font-size:13px;color:var(--ink-soft)">올린 사람: <span id="shDoneBy"></span> · 시안이라 실제로 올라가지는 않아요.</p><div class="row"><button class="btn default" type="button" data-close>확인</button></div>';
      $('shDoneName').textContent=name;$('shDoneBy').textContent=who;
      $('dlgBody').querySelector('button').focus();
    });
    sync();
  }
  /* 내려받기 비밀번호 창 — 프로토타입은 모양만 보여 준다. 비밀번호는 서버가 확인한다(페이지에 값 · 해시를 두지 않는다) */
  var DL_NAME={win:'Windows',mac:'macOS'};
  function openDl(os){
    lastFocus=document.activeElement;
    $('dlgTitle').textContent=DL_NAME[os]+' 내려받기';
    $('dlgBody').innerHTML='<form id="dlForm" style="display:flex;flex-direction:column;gap:10px"><label for="dlPw">내려받으려면 비밀번호를 입력해 주세요.</label><input id="dlPw" type="password" autocomplete="off" required><p class="err" id="dlErr" role="alert" hidden>비밀번호가 맞지 않아요. 다시 입력해 주세요.</p><div class="row"><button class="btn" type="button" data-close>취소</button><button class="btn default" type="submit">확인</button></div></form>';
    $('dlg').hidden=false;$('dlPw').focus();
    $('dlForm').addEventListener('submit',function(e){
      e.preventDefault();
      $('dlgBody').innerHTML='<p style="margin:0"><b>'+DL_NAME[os]+'</b> 설치 파일 내려받기가 여기서 시작돼요.</p><p style="margin:0;font-size:13px;color:var(--ink-soft)">프로토타입이라 비밀번호는 확인하지 않아요 — 실제로는 서버가 확인한 뒤 내려받기 주소를 줘요.</p><div class="row"><button class="btn default" type="button" data-close>닫기</button></div>';
      $('dlgBody').querySelector('button').focus();
    });
  }

  function openDlg(k){var d=DLG[k];lastFocus=document.activeElement;$('dlgTitle').textContent=d.t;document.querySelector('.dlg').classList.toggle('wide',!!d.wide);$('dlgBody').innerHTML=typeof d.b==='function'?d.b():d.b;$('dlg').hidden=false;if(d.wide)wireShare();var f=$('dlgBody').querySelector('button,input');if(f)f.focus();}
  function closeDlg(){$('dlg').hidden=true;if(lastFocus)lastFocus.focus();}
  $('dlg').addEventListener('click',function(e){if(e.target===$('dlg')||e.target.closest('[data-close]')||e.target.id==='dlgX')closeDlg();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('dlg').hidden)closeDlg();if((e.key==='Enter'||e.key===' ')&&e.target.id==='dlgX')closeDlg();});

  /* 히어로 친구들 · 라이브러리 카드: 같은 파츠 표로 만든 예시 캐릭터 */
  /* 운영진 — 이름 · 역할 · 한마디 · 모습은 자리표시. 실제 값으로 바꿔 넣는다 */
  var STAFF=[
    {n:'운영진 1',role:'개발',line:'버그는 제보해 주시면 제가 잡을게요!',s:{shape:'round',skin:'#FFDCC2',eyes:'round',eyesC:'#3B2A22',brows:'arc',mouth:'smile',cheek:'blush',hair:'bang',hairC:'#7A4E33',cloth:'#9AD8C6'}},
    {n:'운영진 2',role:'디자인',line:'새 파츠 그리는 중… 조금만 기다려 주세요',s:{shape:'soft',skin:'#FFE9D9',eyes:'sleepy',eyesC:'#2E5E9C',brows:'none',mouth:'cat',cheek:'lines',hair:'twin',hairC:'#E58FA9',cloth:'#FFFFFF'}},
    {n:'운영진 3',role:'운영',line:'오늘도 같이 집중해요 🍅',s:{shape:'long',skin:'#F2C29E',eyes:'dot',eyesC:'#3B2A22',brows:'worry',mouth:'o',cheek:'freckle',hair:'bun',hairC:'#3A2A22',cloth:'#BEC2EE'}}
  ];
$('heroPals').innerHTML=STAFF.map(function(p,i){return '<button class="seat" type="button" aria-label="'+p.n+' ('+p.role+'): '+p.line+'"><span class="bubble" aria-hidden="true">'+p.line+'</span><span class="pal-stack"><svg class="who" viewBox="0 0 240 270" aria-hidden="true">'+charSVG(p.s,'open','h'+i,true)+'</svg><svg class="desk" viewBox="0 0 240 270" aria-hidden="true">'+deskSVG('#3A2E28')+'</svg><span class="seat-fx"></span></span><span class="plate" aria-hidden="true">'+p.n+'</span><span class="role" aria-hidden="true">'+p.role+'</span></button>';}).join('');
  /* 터치 화면엔 호버가 없어서 누르면 잠깐 말한다. 짧은 사이에 다섯 번 누르면 💣 펑 — 날아갔다 떨어져서 어지러워한다 */
  var LAUNCH_CLICKS=5,LAUNCH_WINDOW=1600;
  var reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function seatFx(b,cls,ch,ms){var fx=b.querySelector('.seat-fx'),sp=document.createElement('span');sp.className=cls;sp.textContent=ch;fx.appendChild(sp);if(ms)setTimeout(function(){sp.remove();},ms);return sp;}
  function launch(b){
    b._flying=true;b.classList.remove('say');
    var who=b.querySelector('.who'),bubble=b.querySelector('.bubble'),line=bubble.textContent;
    b.querySelectorAll('.seat-fx .bomb').forEach(function(x){x.remove();});
    seatFx(b,'boom','💥',600);
    bubble.textContent='으아아~!';b.classList.add('say');
    var land=function(){
      bubble.textContent='어질어질…';
      var dz=seatFx(b,'dz','💫');
      setTimeout(function(){dz.remove();b.classList.remove('say');bubble.textContent=line;b._flying=false;},2200);
    };
    if(reduceMotion){setTimeout(land,400);return;}
    var side=Math.random()<.5?-1:1;
    who.animate([
      {transform:'translate(0,0) rotate(0)'},
      {transform:'translate(0,6%) scale(1.15,.8)',offset:.08},
      {transform:'translate('+(side*60)+'%,-420%) rotate('+(side*900)+'deg)',offset:.45,easing:'ease-in'},
      {transform:'translate(0,-420%) rotate(0)',offset:.46},
      {transform:'translate(0,-420%) rotate(0)',offset:.7,easing:'cubic-bezier(.5,0,1,1)'},
      {transform:'translate(0,0) scale(1.1,.85)',offset:.9},
      {transform:'translate(0,-8%) scale(.95,1.05)',offset:.95},
      {transform:'translate(0,0)'}
    ],{duration:2400}).onfinish=land;
  }
  $('heroPals').addEventListener('click',function(e){
    var b=e.target.closest('.seat');if(!b||b._flying)return;
    var now=Date.now();
    b._clicks=(b._clicks||[]).filter(function(t){return now-t<LAUNCH_WINDOW;});b._clicks.push(now);
    b.classList.remove('poke');void b.offsetWidth;b.classList.add('poke');
    if(b._clicks.length>=LAUNCH_CLICKS){b._clicks=[];launch(b);return;}
    /* 세 번째부터 머리 위에 💣 가 치익 */
    if(b._clicks.length>=3&&!b.querySelector('.seat-fx .bomb')){var bm=seatFx(b,'bomb','💣');setTimeout(function(){bm.remove();},LAUNCH_WINDOW);}
    b.classList.add('say');clearTimeout(b._t);b._t=setTimeout(function(){b.classList.remove('say');},2500);
  });

  var LIB=[
    ['졸린 단발',  'mochi',  412,1288,{shape:'soft',skin:'#FFE9D9',eyes:'sleepy',eyesC:'#3B2A22',brows:'arc',mouth:'flat',cheek:'blush',hair:'bob',hairC:'#3A2A22',cloth:'#5C6B8A'}],
    ['딸기우유',   'pinkpong',388,940,{shape:'round',skin:'#FFDCC2',eyes:'sparkle',eyesC:'#8A4FB5',brows:'none',mouth:'open',cheek:'blush',hair:'twin',hairC:'#E58FA9',cloth:'#FF9BB3'}],
    ['야근 요정',  'deadline',301,822,{shape:'long',skin:'#F2C29E',eyes:'dot',eyesC:'#3B2A22',brows:'worry',mouth:'o',cheek:'lines',hair:'side',hairC:'#7C8BD9',cloth:'#FFFFFF'}],
    ['햇살 똥머리','sunny',  276,610,{shape:'round',skin:'#FFE9D9',eyes:'smile',eyesC:'#3B2A22',brows:'arc',mouth:'cat',cheek:'blush',hair:'bun',hairC:'#D9A35B',cloth:'#FFC24B'}],
    ['조용한 민트','quiet',  198,455,{shape:'soft',skin:'#D69E78',eyes:'round',eyesC:'#3E8A5A',brows:'thick',mouth:'smile',cheek:'freckle',hair:'bang',hairC:'#3E3E46',cloth:'#9AD8C6'}]
  ];
  $('lib').innerHTML=LIB.map(function(c,i){return '<button class="card" type="button" data-pick=\''+JSON.stringify(c[4])+'\' aria-label="'+c[0]+' 불러오기"><div class="thumb"><svg viewBox="10 0 220 250" aria-hidden="true">'+charSVG(c[4],'open','l'+i)+'</svg></div><b>'+c[0]+'</b><div class="meta"><span>'+c[1]+'</span><span>♥ '+c[2]+' · ⤓ '+c[3]+'</span></div></button>';}).join('');

  /* 소개 탭 */
  var FEAT=[
    ['⏱','집중','집중한 시간이 레벨이 돼요','포커싱할 프로그램을 골라 두면 그 창을 쓰는 동안 시간이 쌓여요. 뽀모도로 · 주간 달성표 · 일정 알림도 있어요.'],
    ['💼','같이 일하는 방','같은 방 코드로 옆자리에','워킹룸은 무료로 조용히, 투게더룸은 대화하며 함께. 최대 10명까지 들어와요.'],
    ['🏠','마이홈','나만의 미니홈피','프로필 · 게시글 · 스티커 · 배경음악으로 꾸미고, 친구 홈에 놀러 가서 방명록을 남겨요.'],
    ['🎨','꾸미기','파츠를 하나씩 입혀요','옷 · 소품 · 책상을 바꾸고 캡슐을 열어 새 파츠를 모아요. 동물 캐릭터는 Lv.50 에 열려요.'],
    ['📷','스티커사진','친구랑 한 컷','방 친구들과 스티커사진을 찍고 꾸며서 남겨요.'],
    ['🖐','상호작용','쓰다듬고 흔들고 고정해요','위 그림 속 캐릭터를 직접 만져 보세요. 방에 있으면 상대 화면에도 같이 보여요.']
  ];
  var INTER=5;
  var fi=0;
  function renderFeat(){
    $('featList').innerHTML=FEAT.map(function(f,i){return '<button type="button" role="tab" aria-selected="'+(i===fi)+'" data-feat="'+i+'"><span aria-hidden="true">'+f[0]+'</span><b>'+f[1]+'</b><small>'+f[2]+'</small></button>';}).join('');
    drawScene();$('featTitle').textContent=FEAT[fi][2];$('featText').textContent=FEAT[fi][3];
    $('featKeys').hidden=fi!==INTER;
  }
  /* 장면 그리기 — 캐릭터 하나는 240×270 그림을 원하는 자리 · 크기로 놓는다 */
  var sceneN=0;
  function put(s,x,y,w,ex){return '<svg x="'+x+'" y="'+y+'" width="'+w+'" height="'+(w*270/240)+'" viewBox="0 0 240 270">'+charSVG(s,ex||'open','sc'+(sceneN++))+'</svg>';}
  function txt(x,y,t,size,anchor){return '<text x="'+x+'" y="'+y+'" font-size="'+(size||11)+'" font-weight="700" text-anchor="'+(anchor||'middle')+'" fill="#fff" stroke="#000" stroke-width="2.6" paint-order="stroke" font-family="Malgun Gothic, sans-serif">'+t+'</text>';}
  /* 장면 속 말풍선 — 앱 도트 말풍선과 같은 계단 모서리 · 계단 꼬리(한 칸 u) */
  function tag(x,y,t){
    var u=1.5,w=t.length*7+16,h=19,x0=x-w/2,y0=y-14;
    function step(a,b,W,H,k){return [[a+k,b],[a+W-k,b],[a+W-k,b+k],[a+W,b+k],[a+W,b+H-k],[a+W-k,b+H-k],[a+W-k,b+H],[a+k,b+H],[a+k,b+H-k],[a,b+H-k],[a,b+k],[a+k,b+k]].map(function(q){return q.join(',');}).join(' ');}
    /* 꼬리: 앱 꼬리 아트(5×4)를 한 칸 t 로 — 첫 줄은 크림이라 몸통 아래 테두리를 뚫는다 */
    var t=2,tx=x-2.5*t,ty=y0+h-u,TAIL=[[0,0,5,'#FFFFCC'],[1,1,3,'#FFFFCC'],[2,2,1,'#FFFFCC'],[0,1,1,'#000'],[4,1,1,'#000'],[1,2,1,'#000'],[3,2,1,'#000'],[2,3,1,'#000']];
    var tail=TAIL.map(function(r){return '<rect x="'+(tx+r[0]*t)+'" y="'+(ty+r[1]*t)+'" width="'+(r[2]*t)+'" height="'+t+'" fill="'+r[3]+'"/>';}).join('');
    return '<g><polygon points="'+step(x0,y0,w,h,u*2)+'" fill="#000"/><polygon points="'+step(x0+u,y0+u,w-2*u,h-2*u,u*2)+'" fill="#FFFFCC"/>'+tail+'<text x="'+x+'" y="'+(y0+13.5)+'" font-size="10" font-weight="700" text-anchor="middle" font-family="Tahoma, Malgun Gothic, sans-serif">'+t+'</text></g>';
  }
  function variant(s,cloth,hairC){var v=clone(s.adj?s:norm(s));v.cloth=cloth;v.hairC=hairC;return v;}
  var SCENES=[
    function(){return '<rect width="320" height="200" fill="#CDE7E7"/><rect x="18" y="20" width="120" height="70" fill="#C0C0C0" stroke="#000" stroke-width="1.5"/><rect x="18" y="20" width="120" height="12" fill="#000080"/><text x="24" y="29.5" font-size="8" fill="#fff" font-family="Tahoma, sans-serif">뽀모도로</text><text x="78" y="70" font-size="24" text-anchor="middle" font-family="Consolas, monospace">18:42</text>'+put(state,160,30,130)+txt(225,190,'🍅 집중 18분')+'<rect x="232" y="22" width="40" height="16" rx="8" fill="#FFC24B" stroke="#000" stroke-width="1.2"/><text x="252" y="33.5" font-size="9" font-weight="700" text-anchor="middle" font-family="Tahoma, sans-serif">Lv.12</text>';},
    function(){var a=STAFF[0].s,c=STAFF[2].s;return '<rect width="320" height="200" fill="#008080"/><rect y="182" width="320" height="18" fill="#C0C0C0"/>'+put(a,10,64,96)+put(state,112,48,110)+put(c,218,64,96)+txt(58,178,STAFF[0].n)+txt(167,178,'나')+txt(266,178,STAFF[2].n)+tag(167,44,'같이 해요!');},
    function(){return '<rect width="320" height="200" fill="#BFD9F2"/><rect x="14" y="14" width="292" height="172" rx="10" fill="#fff" stroke="#7FA0C4" stroke-width="2"/><rect x="26" y="26" width="92" height="148" rx="6" fill="#F3F7FB" stroke="#BFD0E2"/>'+put(state,30,34,84)+'<text x="72" y="148" font-size="10" font-weight="700" text-anchor="middle" font-family="Malgun Gothic, sans-serif">나의 홈</text><text x="72" y="164" font-size="8" fill="#5E676A" text-anchor="middle" font-family="Consolas, monospace">TODAY 12 · TOTAL 340</text><text x="132" y="44" font-size="11" font-weight="700" font-family="Malgun Gothic, sans-serif">📖 방명록</text><g fill="#E8EEF5"><rect x="132" y="54" width="160" height="26" rx="4"/><rect x="132" y="86" width="160" height="26" rx="4"/><rect x="132" y="118" width="160" height="26" rx="4"/></g><g font-size="9" font-family="Malgun Gothic, sans-serif" fill="#333B3E"><text x="140" y="71">운영진 1 : 캐릭터 귀엽다!</text><text x="140" y="103">운영진 3 : 오늘도 집중 화이팅</text><text x="140" y="135">운영진 2 : 스티커 예뻐요 ✦</text></g><text x="132" y="166" font-size="16" fill="#FF9BB3">✦ ♥ ✧</text>';},
    function(){var after=variant(state,'#FF9BB3','#7C8BD9');return '<rect width="320" height="200" fill="#F2EDF8"/>'+put(state,22,26,118)+'<text x="160" y="112" font-size="26" text-anchor="middle" fill="#7A5AA6" font-family="Tahoma, sans-serif">→</text>'+put(after,180,26,118)+txt(81,188,'지금')+txt(239,188,'새 옷 · 새 머리색')+'<text x="290" y="34" font-size="16" fill="#E8B930">✦</text>';},
    function(){var f=STAFF[1].s;return '<rect width="320" height="200" fill="#FFE4EC"/><rect x="60" y="12" width="200" height="176" fill="#fff" stroke="#FF9BB3" stroke-width="6"/><rect x="72" y="24" width="176" height="128" fill="#FFF6D6"/>'+put(state,76,32,96)+put(f,150,32,96)+'<text x="84" y="46" font-size="16" fill="#FF6F91">♥</text><text x="226" y="54" font-size="14" fill="#E8B930">✦</text><text x="160" y="146" font-size="12" font-weight="700" text-anchor="middle" fill="#FF6F91" font-family="Malgun Gothic, sans-serif">우리 둘이 한 컷 ♡</text><text x="160" y="176" font-size="10" text-anchor="middle" fill="#7A5A6A" font-family="Consolas, monospace">2026.10.20</text>';}
  ];
  function drawScene(){
    if(fi===INTER){play.mount();return;}
    play.unmount();sceneN=0;$('featShot').innerHTML='<svg viewBox="0 0 320 200" aria-hidden="true">'+SCENES[fi]()+'</svg>';
  }

  /* ── 상호작용 무대: 앱의 쓰다듬기 · 흔들기(어지러움) · 끈 채로 우클릭(고정) · 때리기를 흉내 낸다 ── */
  var play=(function(){
    var root=null,wrap,body,fx,hammer,tip;
    var pos={dx:0,dy:0,tilt:0},drag=null,pinned=false,dizzyT=0,aim=false,rev=[],lastVx=0;
    function el(id){return root.querySelector('#'+id);}
    function apply(){wrap.style.transform='translate('+pos.dx+'px,'+pos.dy+'px) rotate('+pos.tilt+'deg)';}
    function say(t){tip.textContent=t;}
    function paint(){
      body.innerHTML='<svg viewBox="0 0 240 270" aria-hidden="true">'+charSVG(state,'open','pl',true)+'</svg>';
      el('desk').innerHTML='<svg viewBox="0 0 240 270" aria-hidden="true">'+deskSVG('#3A2E28')+'</svg>';
    }
    function pop(ch,n,cls){
      for(var i=0;i<n;i++){
        var sp=document.createElement('span');sp.className=cls||'heart';sp.textContent=ch;
        sp.style.left=(30+Math.random()*40)+'%';sp.style.setProperty('--dx',(Math.random()*40-20)+'px');sp.style.animationDelay=(i*0.08)+'s';
        fx.appendChild(sp);setTimeout(function(x){return function(){x.remove();};}(sp),1500);
      }
    }
    function dizzy(){
      clearTimeout(dizzyT);body.classList.add('wobble');fx.querySelectorAll('.dz').forEach(function(x){x.remove();});
      var dz=document.createElement('span');dz.className='dz';dz.textContent='💫';fx.appendChild(dz);
      say('어질어질…');
      dizzyT=setTimeout(function(){body.classList.remove('wobble');dz.remove();say(pinned?'고정됐어요 — 다시 끌면 풀려요':'캐릭터를 눌러 보세요');},2500);
    }
    function goHome(){
      wrap.classList.add('home');pos.dx=0;pos.dy=0;pos.tilt=0;apply();
      setTimeout(function(){wrap.classList.remove('home');},400);
    }
    function look(x,y){
      var face=body.querySelector('g[clip-path]');if(!face)return;
      if(x===null){face.removeAttribute('transform');return;}
      var r=body.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height*0.45;
      var vx=x-cx,vy=y-cy,d=Math.hypot(vx,vy)||1,k=Math.min(1,d/120)*7;
      face.setAttribute('transform','translate('+(vx/d*k).toFixed(1)+' '+(vy/d*k).toFixed(1)+')');
    }
    function bonk(){
      body.classList.remove('bonk');void body.offsetWidth;body.classList.add('bonk');
      pop('💥',1,'boom');setTimeout(dizzy,450);say('뿅!');
    }
    function setAim(on){aim=on;root.classList.toggle('aiming',on);hammer.hidden=!on;$('bonkBtn').setAttribute('aria-pressed',String(on));if(on)say('캐릭터를 누르면 콩! (B · 우클릭으로 취소)');else say(pinned?'고정됐어요 — 다시 끌면 풀려요':'캐릭터를 눌러 보세요');}

    function onDown(e){
      if(aim){e.preventDefault();bonk();return;}
      if(e.button!==0)return;
      drag={x:e.clientX,y:e.clientY,dx:pos.dx,dy:pos.dy,lx:e.clientX,moved:false};
      wrap.setPointerCapture(e.pointerId);e.preventDefault();
    }
    function onMove(e){
      if(aim){var r=root.getBoundingClientRect();hammer.style.left=(e.clientX-r.left)+'px';hammer.style.top=(e.clientY-r.top)+'px';}
      if(!drag){if(pinned)look(e.clientX,e.clientY);return;}
      var mx=e.clientX-drag.x,my=e.clientY-drag.y;
      if(!drag.moved&&Math.hypot(mx,my)<5)return;
      if(!drag.moved){drag.moved=true;if(pinned){pinned=false;look(null);}say('흔들흔들 — 거칠게 흔들면 어지러워해요');}
      var R=root.getBoundingClientRect(),W=wrap.offsetWidth;
      pos.dx=Math.max(-R.width/2+W/4,Math.min(R.width/2-W/4,drag.dx+mx));
      pos.dy=Math.max(-R.height*0.55,Math.min(0,drag.dy+my));
      var vx=e.clientX-drag.lx;drag.lx=e.clientX;
      pos.tilt=Math.max(-28,Math.min(28,vx*1.6));
      /* 방향이 빠르게 여러 번 바뀌면 «거칠게 흔듦» */
      var now=Date.now();
      if(Math.abs(vx)>6&&lastVx&&(vx>0)!==(lastVx>0))rev.push(now);
      if(Math.abs(vx)>6)lastVx=vx;
      rev=rev.filter(function(t){return now-t<900;});
      if(rev.length>=4&&!body.classList.contains('wobble')){rev=[];dizzy();}
      apply();
    }
    function onUp(){
      if(!drag)return;
      var d=drag;drag=null;
      if(!d.moved){pop('💗',5);body.classList.remove('pet');void body.offsetWidth;body.classList.add('pet');if(!body.classList.contains('wobble'))say('쓰담쓰담 💗');return;}
      if(!pinned){pos.tilt=0;goHome();if(!body.classList.contains('wobble'))say('캐릭터를 눌러 보세요');}
    }
    function onContext(e){
      e.preventDefault();
      if(aim){setAim(false);return;}
      if(drag&&drag.moved){pinned=true;drag=null;say('고정됐어요 — 마우스를 쳐다봐요 · 다시 끌면 풀려요');}
    }
    function onKey(e){
      if(!root||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
      if(/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName||'')))return;
      if(e.key==='b'||e.key==='B'||e.key==='ㅠ'){setAim(!aim);}
      if(e.key==='Escape'&&aim)setAim(false);
    }
    document.addEventListener('keydown',onKey);
    $('bonkBtn').addEventListener('click',function(){if(root)setAim(!aim);});
    return {
      mount:function(){
        if(root){paint();return;}
        $('featShot').innerHTML='<div class="play" id="play"><div class="play-bar"></div><div class="play-desk" id="desk"></div><div class="pal-wrap" id="palWrap"><div class="fx" id="fx"></div><div class="pal-body" id="palBody"></div></div><div class="hammer" id="hammer" hidden aria-hidden="true">🔨</div><div class="play-tip" id="playTip" aria-live="polite">캐릭터를 눌러 보세요</div></div>';
        root=$('featShot').querySelector('.play');wrap=el('palWrap');body=el('palBody');fx=el('fx');hammer=el('hammer');tip=el('playTip');
        pos={dx:0,dy:0,tilt:0};pinned=false;aim=false;
        paint();apply();
        wrap.addEventListener('pointerdown',onDown);root.addEventListener('pointermove',onMove);
        wrap.addEventListener('pointerup',onUp);wrap.addEventListener('pointercancel',onUp);
        root.addEventListener('contextmenu',onContext);
        root.addEventListener('pointerdown',function(e){if(aim&&e.button===2)setAim(false);});
      },
      unmount:function(){if(root){clearTimeout(dizzyT);root=null;drag=null;aim=false;$('bonkBtn').setAttribute('aria-pressed','false');}}
    };
  })();
  $('featList').addEventListener('click',function(e){var b=e.target.closest('[data-feat]');if(b){fi=+b.getAttribute('data-feat');renderFeat();}});
  renderFeat();sceneReady=true;


  /* 언어 바꾸기 — 화면에 그려진 한국어 글자를 사전으로 바꾼다. 스크립트가 나중에 그리는 글자(창 안 · 장면 · 대화상자)도
     MutationObserver 로 잡아 바꾼다. 원래 한국어는 노드에 붙여 두고 한국어로 돌아갈 때 되살린다 */
  var I18N_DICT={
    "투게더워킹":["Together Working", "トゥゲザーワーキング"],
    "캐릭터 만들기":["Character Maker", "キャラクターメーカー"],
    "라이브러리":["Library", "ライブラリ"],
    "소개":["About", "紹介"],
    "도움말":["Help", "ヘルプ"],
    "로그인":["Log in", "ログイン"],
    "다운로드":["Download", "ダウンロード"],
    "투게더랜드":["Together Land", "トゥゲザーランド"],
    "Windows · macOS 데스크톱 컴패니언":["Desktop companion for Windows · macOS", "Windows・macOS 対応デスクトップコンパニオン"],
    "혼자서도 외롭지 않게,":["Never alone at your desk —", "ひとりでも寂しくない、"],
    "투게더워킹!":["Together Working!", "トゥゲザーワーキング!"],
    "내가 만든 캐릭터와 함께 작업해요.":["Work alongside a character you made yourself.", "自分で作ったキャラクターと一緒に作業しよう。"],
    "집중한 시간만큼 레벨이 오르고, 새로운 보상이 열려요.":["Focus longer to level up and unlock new rewards.", "集中した時間だけレベルが上がり、新しいごほうびが解放されます。"],
    "캐릭터 만들어 보기 →":["Make a character →", "キャラを作ってみる →"],
    "최신 버전 v0.11.3 · 초대 코드가 있어야 가입할 수 있어요":["Latest v0.11.3 · An invite code is required to sign up", "最新バージョン v0.11.3・登録には招待コードが必要です"],
    "📰 소식 · 업데이트":["📰 News · Updates", "📰 お知らせ・アップデート"],
    "전체":["All", "すべて"],
    "공지":["Notice", "お知らせ"],
    "업데이트":["Update", "アップデート"],
    "전체 보기 ›":["See all ›", "すべて見る ›"],
    "버그는 제보해 주시면 제가 잡을게요!":["Report a bug and I'll squash it!", "バグを報告してくれたら、つかまえます!"],
    "새 파츠 그리는 중… 조금만 기다려 주세요":["Drawing new parts… hang tight!", "新しいパーツを描いています…少し待っててね"],
    "오늘도 같이 집중해요 🍅":["Let's focus together today 🍅", "今日も一緒に集中しよう 🍅"],
    "개발":["Dev", "開発"],
    "디자인":["Design", "デザイン"],
    "운영":["Ops", "運営"],
    "얼굴 레이어를 골라 쌓고 자리 · 크기를 맞추면 기본 · 감은눈 얼굴이 함께 만들어져요. 로그인 없이 해 볼 수 있어요.":["Stack face layers and adjust their position and size — the default and eyes-closed faces are made together. No login needed.", "顔のレイヤーを重ねて位置とサイズを整えると、通常と目閉じの顔が一緒に作られます。ログインなしで試せます。"],
    "🎨 캐릭터 만들기":["🎨 Character Maker", "🎨 キャラクターメーカー"],
    "미리보기 · 실제는 3D":["Preview · 3D in the app", "プレビュー・実際は3D"],
    "기본":["Default", "通常"],
    "감은눈":["Eyes closed", "目閉じ"],
    "🎲 랜덤":["🎲 Random", "🎲 ランダム"],
    "↶ 되돌리기":["↶ Undo", "↶ 元に戻す"],
    "처음부터":["Start over", "最初から"],
    "🖼 내 그림 불러오기":["🖼 Load my image", "🖼 自分の画像を読み込む"],
    "기본 · 손을 끌어 옮겨요 (Shift: 가로 · 세로만)":["Default · drag the hands to move (Shift: straight lines only)", "通常・手をドラッグして移動(Shift:縦・横のみ)"],
    "얼굴형 · 피부":["Face · Skin", "顔の形・肌"],
    "눈":["Eyes", "目"],
    "눈썹":["Brows", "まゆ"],
    "입":["Mouth", "口"],
    "볼":["Cheeks", "ほお"],
    "내 그림":["My image", "自分の画像"],
    "머리":["Hair", "髪"],
    "옷":["Clothes", "服"],
    "모양":["Shape", "形"],
    "색":["Color", "色"],
    "위치 · 크기 조정":["Position · Size", "位置・サイズ調整"],
    "⇔ 대칭":["⇔ Mirror", "⇔ 左右対称"],
    "왼쪽":["Left", "左"],
    "오른쪽":["Right", "右"],
    "초기화":["Reset", "リセット"],
    "좌우":["X", "左右"],
    "위아래":["Y", "上下"],
    "크기":["Size", "サイズ"],
    "회전":["Rotate", "回転"],
    "256×256 그림을 얼굴 텍스처에 붙여요. 투명 배경 PNG 면 아래 얼굴이 비쳐 보여요.":["Attach a 256×256 image to the face texture. With a transparent PNG, the face shows through.", "256×256の画像を顔テクスチャに貼り付けます。背景が透明なPNGなら下の顔が透けて見えます。"],
    "📂 그림 불러오기":["📂 Load image", "📂 画像を読み込む"],
    "지우기":["Remove", "削除"],
    "쌓는 자리":["Layer position", "重ねる位置"],
    "눈코입 아래 (피부 위)":["Under the features (on the skin)", "目鼻口の下(肌の上)"],
    "맨 위":["On top", "いちばん上"],
    "눈코입 아래":["Under the features", "目鼻口の下"],
    "붙일 텍스처":["Apply to", "貼り付けるテクスチャ"],
    "둘 다":["Both", "両方"],
    "기본만":["Default only", "通常のみ"],
    "감은눈만":["Eyes closed only", "目閉じのみ"],
    "얼굴 레이어 (위가 앞)":["Face layers (top is front)", "顔のレイヤー(上が手前)"],
    "동글":["Round", "まんまる"],
    "말랑":["Soft", "ふんわり"],
    "갸름":["Slim", "ほっそり"],
    "콩":["Dot", "てん"],
    "동그랑":["Round", "まる"],
    "반짝":["Sparkle", "キラキラ"],
    "웃는":["Smiling", "にっこり"],
    "졸린":["Sleepy", "ねむい"],
    "없음":["None", "なし"],
    "얇은":["Thin", "細い"],
    "굵은":["Thick", "太い"],
    "걱정":["Worried", "こまり"],
    "미소":["Smile", "ほほえみ"],
    "고양이":["Cat", "ねこ"],
    "헤":["Open", "ぽかん"],
    "일자":["Flat", "まっすぐ"],
    "오":["O", "お"],
    "발그레":["Blush", "ほんのり"],
    "빗금":["Lines", "しゃしゃ"],
    "주근깨":["Freckles", "そばかす"],
    "단발":["Bob", "ボブ"],
    "일자 앞머리":["Straight bangs", "ぱっつん前髪"],
    "옆 가르마":["Side part", "サイド分け"],
    "똥머리":["Bun", "おだんご"],
    "양갈래":["Pigtails", "ツインテール"],
    "앱으로 가져가기":["Take to the app", "アプリに持っていく"],
    "코드 복사 · 파일 받기":["Copy code · Get file", "コードをコピー・ファイルで受け取る"],
    "라이브러리에 올리기":["Share to Library", "ライブラリに投稿"],
    "로그인 필요":["Login required", "ログインが必要"],
    "커스텀 라이브러리":["Custom Library", "カスタムライブラリ"],
    "다른 사람이 만든 캐릭터를 골라 앱으로 가져가거나, 그걸로 시작해서 고쳐요.":["Take a character someone else made to your app, or start from it and make it yours.", "ほかの人が作ったキャラクターをアプリに持っていったり、それをもとにアレンジしたり。"],
    "📁 라이브러리":["📁 Library", "📁 ライブラリ"],
    "🔍 이름 · 태그로 찾기":["🔍 Search by name · tag", "🔍 名前・タグで探す"],
    "인기":["Popular", "人気"],
    "최신":["Newest", "新着"],
    "많이 가져간":["Most taken", "よく使われる"],
    "졸린 단발":["Sleepy Bob", "ねむねむボブ"],
    "딸기우유":["Strawberry Milk", "いちごミルク"],
    "야근 요정":["Overtime Fairy", "残業の妖精"],
    "햇살 똥머리":["Sunny Bun", "おひさまおだんご"],
    "조용한 민트":["Quiet Mint", "しずかなミント"],
    "카드를 누르면 그 캐릭터로 위 만들기 창이 바뀌어요. 이름 · 숫자는 시안용 예시예요.":["Click a card to load that character into the maker above. Names and numbers are mockup samples.", "カードを押すと、上のメーカーがそのキャラクターに変わります。名前・数字はサンプルです。"],
    "책상 위에서 하는 일":["What it does on your desk", "デスクの上でできること"],
    "다른 프로그램 위에 켜 두어도 방해되지 않게 작고 조용하게.":["Small and quiet, so it never gets in the way of your other apps.", "ほかのアプリの上に置いても邪魔にならない、小さくて静かな存在。"],
    "ℹ️ 소개":["ℹ️ About", "ℹ️ 紹介"],
    "집중":["Focus", "集中"],
    "집중한 시간이 레벨이 돼요":["Focus time becomes your level", "集中した時間がレベルになる"],
    "같이 일하는 방":["Work rooms", "いっしょに作業する部屋"],
    "같은 방 코드로 옆자리에":["Same room code, side by side", "同じルームコードでとなりの席に"],
    "마이홈":["My Home", "マイホーム"],
    "나만의 미니홈피":["Your own mini homepage", "自分だけのミニホームページ"],
    "꾸미기":["Dress-up", "着せかえ"],
    "파츠를 하나씩 입혀요":["Put on parts one by one", "パーツをひとつずつ着せる"],
    "스티커사진":["Sticker photos", "プリクラ"],
    "친구랑 한 컷":["A snap with friends", "友だちと一枚"],
    "상호작용":["Interactions", "ふれあい"],
    "쓰다듬고 흔들고 고정해요":["Pet, shake, and pin", "なでて、ゆらして、固定する"],
    "뽀모도로":["Pomodoro", "ポモドーロ"],
    "🍅 집중 18분":["🍅 Focus 18 min", "🍅 集中 18分"],
    "위에서 만든 캐릭터가 나와요. 실제 페이지에선 이 자리에 GIF 를 넣어도 돼요.":["Your character from above appears here. On the real site this spot can hold a GIF.", "上で作ったキャラクターが登場します。本番ではここにGIFを入れてもOK。"],
    "포커싱할 프로그램을 골라 두면 그 창을 쓰는 동안 시간이 쌓여요. 뽀모도로 · 주간 달성표 · 일정 알림도 있어요.":["Pick the apps you focus in, and time adds up while you use them. Pomodoro, weekly goals and reminders included.", "集中するアプリを選んでおくと、そのウィンドウを使っている間の時間がたまります。ポモドーロ・週間達成表・予定通知もあります。"],
    "워킹룸은 무료로 조용히, 투게더룸은 대화하며 함께. 최대 10명까지 들어와요.":["Working Room is free and quiet; Together Room lets you chat. Up to 10 people per room.", "ワーキングルームは無料で静かに、トゥゲザールームはおしゃべりしながら。最大10人まで入れます。"],
    "프로필 · 게시글 · 스티커 · 배경음악으로 꾸미고, 친구 홈에 놀러 가서 방명록을 남겨요.":["Decorate it with a profile, posts, stickers and music, then visit friends and sign their guestbooks.", "プロフィール・投稿・ステッカー・BGMで飾って、友だちのホームに遊びに行って足あとを残そう。"],
    "옷 · 소품 · 책상을 바꾸고 캡슐을 열어 새 파츠를 모아요. 동물 캐릭터는 Lv.50 에 열려요.":["Change clothes, items and desks, and open capsules to collect new parts. Animal characters unlock at Lv.50.", "服・小物・デスクを替えて、カプセルを開けて新しいパーツを集めよう。動物キャラはLv.50で解放。"],
    "방 친구들과 스티커사진을 찍고 꾸며서 남겨요.":["Take sticker photos with your roommates and decorate them.", "ルームの友だちとプリクラを撮ってデコって残そう。"],
    "위 그림 속 캐릭터를 직접 만져 보세요. 방에 있으면 상대 화면에도 같이 보여요.":["Try touching the character above. In a room, others see it on their screens too.", "上の絵のキャラクターをさわってみよう。ルームにいると相手の画面にも表示されます。"],
    "클릭":["Click", "クリック"],
    "쓰다듬기 — 하트가 뿅뿅":["Pet — hearts pop up", "なでる — ハートがぽんぽん"],
    "끌고 흔들기":["Drag & shake", "ドラッグしてゆらす"],
    "거칠게 흔들면 어지러워해요":["Shake hard and they get dizzy", "激しくゆらすと目を回す"],
    "끈 채로 우클릭":["Right-click while dragging", "ドラッグ中に右クリック"],
    "그 자세로 고정 · 마우스를 쳐다봐요 · 다시 끌면 풀려요":["Pins in place · watches your mouse · drag again to release", "その姿勢で固定・マウスを見つめる・もう一度ドラッグで解除"],
    "👑 때리기 — 뿅망치로 콩":["👑 Bonk — with a squeaky hammer", "👑 ピコハン — ピコッとたたく"],
    "🔨 때리기":["🔨 Bonk", "🔨 たたく"],
    "캐릭터를 눌러 보세요":["Try clicking the character", "キャラクターを押してみて"],
    "쓰담쓰담 💗":["Pat pat 💗", "なでなで 💗"],
    "흔들흔들 — 거칠게 흔들면 어지러워해요":["Wobble — shake hard to make them dizzy", "ゆらゆら — 激しくゆらすと目を回すよ"],
    "어질어질…":["So dizzy…", "くらくら…"],
    "고정됐어요 — 마우스를 쳐다봐요 · 다시 끌면 풀려요":["Pinned — watching your mouse · drag again to release", "固定しました — マウスを見ています・もう一度ドラッグで解除"],
    "고정됐어요 — 다시 끌면 풀려요":["Pinned — drag again to release", "固定しました — もう一度ドラッグで解除"],
    "뿅!":["Boing!", "ピコッ!"],
    "캐릭터를 누르면 콩! (B · 우클릭으로 취소)":["Click the character to bonk! (B or right-click to cancel)", "キャラを押すとピコッ!(B・右クリックで取り消し)"],
    "으아아~!":["Waaah~!", "うわぁ~!"],
    "나":["Me", "わたし"],
    "같이 해요!":["Let's go!", "いっしょにやろう!"],
    "나의 홈":["My Home", "わたしのホーム"],
    "📖 방명록":["📖 Guestbook", "📖 足あと"],
    "운영진 1 : 캐릭터 귀엽다!":["Staff 1: So cute!", "スタッフ1:キャラかわいい!"],
    "운영진 3 : 오늘도 집중 화이팅":["Staff 3: Keep focusing today!", "スタッフ3:今日も集中ファイト"],
    "운영진 2 : 스티커 예뻐요 ✦":["Staff 2: Love the stickers ✦", "スタッフ2:ステッカーかわいい ✦"],
    "지금":["Now", "いま"],
    "새 옷 · 새 머리색":["New outfit · new hair color", "新しい服・新しい髪色"],
    "우리 둘이 한 컷 ♡":["Just us two ♡", "ふたりで一枚 ♡"],
    "스크린샷":["Screenshots", "スクリーンショット"],
    "실제 화면":["Real screens", "実際の画面"],
    "내려받기":["Download", "ダウンロード"],
    "마음에 들었다면 지금 책상에 데려가요.":["Like it? Bring it to your desk now.", "気に入ったら、今すぐデスクに連れていこう。"],
    "💾 설치":["💾 Install", "💾 インストール"],
    "Windows 내려받기":["Download for Windows", "Windows 版をダウンロード"],
    "macOS 내려받기":["Download for macOS", "macOS 版をダウンロード"],
    "운영체제":["OS", "対応OS"],
    "Windows 10 이상 · macOS":["Windows 10 or later · macOS", "Windows 10 以降・macOS"],
    "최신 버전":["Latest version", "最新バージョン"],
    "가입":["Sign-up", "登録"],
    "초대 코드 필요 · 지금은 새 초대장 발급을 잠시 멈췄어요":["Invite code required · new invites are paused for now", "招待コードが必要・現在、新しい招待状の発行を一時停止中"],
    "💬 같이 이야기해요":["💬 Talk with us", "💬 いっしょに話そう"],
    "버그 제보 · 질문 · 새 소식은 여기에서.":["Bug reports, questions and news live here.", "バグ報告・質問・最新情報はこちら。"],
    "오픈카톡":["KakaoTalk open chat", "カカオトーク オープンチャット"],
    "후원하기":["Support us", "支援する"],
    "개인정보 처리방침":["Privacy policy", "プライバシーポリシー"],
    "메인 메뉴":["Main menu", "メインメニュー"],
    "언어 바꾸기":["Change language", "言語を変更"],
    "언어":["Language", "言語"],
    "투게더랜드 (잠겨 있음)":["Together Land (locked)", "トゥゲザーランド(ロック中)"],
    "소식 거르기":["Filter news", "お知らせを絞り込む"],
    "표정 보기":["Expression", "表情"],
    "만든 캐릭터 미리보기":["Character preview", "キャラクタープレビュー"],
    "기본 얼굴 텍스처":["Default face texture", "通常の顔テクスチャ"],
    "감은눈 얼굴 텍스처":["Eyes-closed face texture", "目閉じの顔テクスチャ"],
    "고칠 쪽":["Side to edit", "編集する側"],
    "내가 만든 캐릭터로 보여 주는 장면":["A scene starring your character", "あなたのキャラクターが登場するシーン"],
    "닫기":["Close", "閉じる"],
    "아직 불러온 그림이 없어요.":["No image loaded yet.", "まだ画像を読み込んでいません。"],
    "PNG · JPG · WEBP 그림만 불러올 수 있어요.":["Only PNG · JPG · WEBP images can be loaded.", "PNG・JPG・WEBP の画像のみ読み込めます。"],
    "그림을 읽지 못했어요. 다른 파일로 해 주세요.":["Couldn't read the image. Please try another file.", "画像を読み込めませんでした。別のファイルでお試しください。"],
    "앱으로 가져가기 ":["Take to the app", "アプリに持っていく"],
    "아래 코드를 복사해 앱의":["Copy the code below and paste it into the app's", "下のコードをコピーして、アプリの"],
    "캐릭터 선택하기 › 코드 입력하기":["Choose character › Enter code", "キャラクター選択 › コード入力"],
    "에 붙여 넣으면 돼요.":[".", "に貼り付けてください。"],
    "DCC1-예시-이-코드는-시안용이에요-3f9a…":["DCC1-sample-this-code-is-for-the-mockup-3f9a…", "DCC1-サンプル-このコードは試作用です-3f9a…"],
    "얼굴은 기본 · 감은눈 텍스처 두 장으로 함께 들어가요.":["The face goes in as two textures: default and eyes closed.", "顔は通常・目閉じの2枚のテクスチャで入ります。"],
    "파일로 받기":["Get file", "ファイルで受け取る"],
    "코드 복사":["Copy code", "コードをコピー"],
    "올리려면 투게더워킹 계정으로 로그인해야 해요.":["Log in with your Together Working account to share.", "投稿するにはトゥゲザーワーキングのアカウントでログインしてください。"],
    "취소":["Cancel", "キャンセル"],
    "구글로 로그인":["Log in with Google", "Googleでログイン"],
    "친구 코드로 로그인":["Log in with friend code", "フレンドコードでログイン"],
    "로그인은 라이브러리에 올리거나 ♥ 할 때만 필요해요.":["You only need to log in to share or ♥ in the Library.", "ログインはライブラリへの投稿や♥のときだけ必要です。"],
    "이 문은 아직 잠겨 있어요.":["This door is still locked.", "この扉はまだ閉ざされています。"],
    "어딘가에서 새로운 땅을 짓는 소리가 들려요…":["You can hear something new being built somewhere…", "どこかで新しい土地をつくる音が聞こえる…"],
    "확인":["OK", "OK"],
    "내려받으려면 비밀번호를 입력해 주세요.":["Enter the password to download.", "ダウンロードするにはパスワードを入力してください。"],
    "비밀번호가 맞지 않아요. 다시 입력해 주세요.":["Wrong password. Please try again.", "パスワードが違います。もう一度入力してください。"],
    "설치 파일 내려받기가 여기서 시작돼요.":["installer download starts here.", "のインストーラーのダウンロードがここで始まります。"],
    "한국어":["Korean", "韓国語"],
    "시안: 로그인 버튼을 누르면 로그인된 것으로 보고 다음 창으로 넘어가요.":["Mockup: pressing Log in treats you as logged in and moves on.", "試作:ログインを押すとログイン済みとして次の画面に進みます。"],
    "라이브러리에 이렇게 보여요":["How it looks in the Library", "ライブラリではこう見えます"],
    "내 캐릭터":["My character", "わたしのキャラ"],
    "캐릭터 이름":["Character name", "キャラクター名"],
    "한 줄 소개":["One-line intro", "ひとこと紹介"],
    "(선택)":["(optional)", "(任意)"],
    "태그":["Tags", "タグ"],
    "(쉼표로 나눠요)":["(separate with commas)", "(カンマで区切る)"],
    "올린 사람 이름":["Shown as", "投稿者名"],
    "내 닉네임으로":["My nickname", "ニックネームで"],
    "익명으로":["Anonymously", "匿名で"],
    "익명 이름 다시 뽑기":["Pick another anonymous name", "匿名名を引き直す"],
    "익명이면 다른 사람에게 내 닉네임 · 친구 코드 · 마이홈이 보이지 않아요. 신고가 들어오면 운영진은 올린 계정을 확인할 수 있어요.":["When anonymous, others can't see your nickname, friend code or My Home. If it's reported, staff can still see which account posted it.", "匿名の場合、ほかの人にはニックネーム・フレンドコード・マイホームが表示されません。通報があった場合、運営は投稿したアカウントを確認できます。"],
    "다른 사람이":["Others can", "ほかの人が"],
    "앱으로 가져갈 수 있어요":["take it to their app", "アプリに持っていける"],
    "이걸로 시작해서 고칠 수 있어요":["start from it and remix", "これをもとにアレンジできる"],
    "올리기":["Share", "投稿する"],
    "올린 사람:":["Shown as:", "投稿者:"],
    "· 시안이라 실제로 올라가지는 않아요.":["· This is a mockup, so nothing is actually uploaded.", "・試作なので実際には投稿されません。"],
    "라이브러리에 올렸어요:":["Shared to the Library:", "ライブラリに投稿しました:"],
    "프로토타입이라 비밀번호는 확인하지 않아요 — 실제로는 서버가 확인한 뒤 내려받기 주소를 줘요.":["This prototype doesn't check the password — the server checks it and then provides the download link.", "試作のためパスワードは確認しません — 実際はサーバーが確認してからダウンロードURLを渡します。"]
  };
  var I18N_RULES=[
    [/^색 (#[0-9A-Fa-f]{6})$/,function(m,c){return c===1?'Color '+m[1]:'色 '+m[1];}],
    [/^운영진 (\d)$/,function(m,c){return c===1?'Staff '+m[1]:'スタッフ'+m[1];}],
    [/^익명의 (\S+) #(\d+)$/,function(m,c){var A={'오리':['Duck','アヒル'],'고양이':['Cat','ネコ'],'토끼':['Bunny','ウサギ'],'너구리':['Raccoon','タヌキ'],'펭귄':['Penguin','ペンギン'],'햄스터':['Hamster','ハムスター']}[m[1]];if(!A)return null;return c===1?'Anonymous '+A[0]+' #'+m[2]:'匿名の'+A[1]+' #'+m[2];}],
    [/^예: (.+)$/,function(m,c){var X={'마감 전날의 나':['me, the night before a deadline','締め切り前日のわたし'],'사람, 단발, 졸림':['human, bob, sleepy','人, ボブ, ねむい']}[m[1]];if(!X)return null;return (c===1?'e.g. ':'例:')+X[c-1];}],
    [/^스크린샷 (\d)$/,function(m,c){return c===1?'Screenshot '+m[1]:'スクリーンショット '+m[1];}],
    [/^(운영진 \d) \((.+)\): (.+)$/,function(m,c){return tr(m[1],c)+' ('+tr(m[2],c)+'): '+tr(m[3],c);}],
    [/^(.+) 불러오기$/,function(m,c){var n=tr(m[1],c);if(n===m[1])return null;return c===1?'Load '+n:n+' を読み込む';}],
    [/^(.+) · 256×256 그대로 붙였어요\.$/,function(m,c){return c===1?m[1]+' · attached at 256×256.':m[1]+'・256×256のまま貼り付けました。';}],
    [/^(.+) · (\d+)×(\d+) 그림을 256×256 으로 맞췄어요\.$/,function(m,c){return c===1?m[1]+' · resized '+m[2]+'×'+m[3]+' to 256×256.':m[1]+'・'+m[2]+'×'+m[3]+'の画像を256×256に合わせました。';}]
  ];
  var LANGS={ko:{name:'한국어',col:0},en:{name:'English',col:1},ja:{name:'日本語',col:2}};
  var LANG_KEY='tw.mock.lang',langCol=0,HANGUL=/[가-힣]/;
  function tr(k,c){
    var v=I18N_DICT[k];if(v)return v[c-1];
    for(var i=0;i<I18N_RULES.length;i++){var m=k.match(I18N_RULES[i][0]);if(m){var r=I18N_RULES[i][1](m,c);if(r!=null)return r;}}
    return k;
  }
  function skip(el){return !el||/^(SCRIPT|STYLE)$/.test(el.nodeName)||(el.closest&&el.closest('[data-notr]'));}
  function trText(n){
    if(skip(n.parentNode))return;
    if(n.__ko===undefined){if(!HANGUL.test(n.data))return;n.__ko=n.data;}
    var ko=n.__ko,k=ko.trim();
    n.data=langCol?ko.replace(k,tr(k,langCol)):ko;
  }
  function trAttrs(el){
    if(skip(el))return;
    ['aria-label','title','alt','placeholder'].forEach(function(a){
      var v=el.getAttribute(a);if(v==null)return;
      el.__koA=el.__koA||{};
      if(el.__koA[a]===undefined){if(!HANGUL.test(v))return;el.__koA[a]=v;}
      el.setAttribute(a,langCol?tr(el.__koA[a].trim(),langCol):el.__koA[a]);
    });
  }
  function trTree(root){
    if(root.nodeType===3){trText(root);return;}
    if(root.nodeType!==1)return;
    trAttrs(root);
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT),n;
    while((n=w.nextNode())){if(n.nodeType===3)trText(n);else trAttrs(n);}
  }
  new MutationObserver(function(ms){
    if(!langCol)return;
    ms.forEach(function(m){m.addedNodes.forEach(trTree);});
  }).observe(document.body,{childList:true,subtree:true});
  function setLang(code){
    var L=LANGS[code]||LANGS.ko;
    langCol=L.col;trTree(document.body);
    document.documentElement.lang=code;
    $('langCur').textContent=L.name;
    document.querySelectorAll('#langMenu [data-lang]').forEach(function(li){li.setAttribute('aria-selected',String(li.getAttribute('data-lang')===code));});
    try{localStorage.setItem(LANG_KEY,code);}catch(_){}
  }
  function langOpen(on){
    $('langMenu').hidden=!on;$('langBtn').setAttribute('aria-expanded',String(on));
    if(on){var cur=$('langMenu').querySelector('[aria-selected="true"]');if(cur)cur.focus();}
  }
  $('langBtn').addEventListener('click',function(e){e.stopPropagation();langOpen($('langMenu').hidden);});
  $('langMenu').addEventListener('click',function(e){var li=e.target.closest('[data-lang]');if(!li)return;setLang(li.getAttribute('data-lang'));langOpen(false);$('langBtn').focus();});
  $('langMenu').addEventListener('keydown',function(e){
    var items=[].slice.call(this.querySelectorAll('[data-lang]')),i=items.indexOf(document.activeElement);
    if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length].focus();}
    if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length].focus();}
    if(e.key==='Enter'||e.key===' '){e.preventDefault();if(i>=0)items[i].click();}
    if(e.key==='Escape'){langOpen(false);$('langBtn').focus();}
  });
  document.addEventListener('click',function(e){if(!$('langMenu').hidden&&!e.target.closest('.lang'))langOpen(false);});
  (function(){var saved=null;try{saved=localStorage.getItem(LANG_KEY);}catch(_){}if(saved&&LANGS[saved]&&saved!=='ko')setLang(saved);})();

  /* 소식 거르기 */
  document.querySelector('.news-tabs').addEventListener('click',function(e){
    var b=e.target.closest('[data-nk]');if(!b)return;var k=b.getAttribute('data-nk');
    document.querySelectorAll('.news-tabs [data-nk]').forEach(function(x){x.setAttribute('aria-selected',String(x===b));});
    document.querySelectorAll('#newsList li').forEach(function(li){li.hidden=k!=='all'&&li.getAttribute('data-k')!==k;});
  });

  render();
})();
