/* 최소 DOM 껍데기로 목업 스크립트를 통째로 굴려본다.
   ★ 목적은 하나다 — wChar 를 지우고 세 함수를 옮긴 뒤 **null 참조로 죽는 자리**가 없는지.
     문법 검사(node --check)는 이걸 절대 못 잡는다. */
const fs=require('fs');
const html=fs.readFileSync('togetherland-ui-mockup.html','utf8');
const ids=[...html.matchAll(/id="([\w-]+)"/g)].map(m=>m[1]);
const missing=new Set();

const ctx=new Proxy({},{get:(_,k)=>{
  if(k==='canvas') return {width:736,height:416};
  if(k==='measureText') return ()=>({width:24});
  if(k==='createLinearGradient'||k==='createPattern'||k==='createRadialGradient')
    return ()=>({addColorStop(){}});
  if(k==='getImageData') return (x,y,w,h)=>({data:new Uint8ClampedArray(4*(w||1)*(h||1)),width:w||1,height:h||1});
  return ()=>{};
},set:()=>true});

function cls(){ const s=new Set(); return {
  add:(...a)=>a.forEach(x=>s.add(x)), remove:(...a)=>a.forEach(x=>s.delete(x)),
  toggle:(x,f)=>{ (f===undefined? s.has(x): !f) ? s.delete(x) : s.add(x); },
  contains:x=>s.has(x), _s:s }; }

function el(id){
  const o={ id, children:[], style:new Proxy({},{get:(t,k)=>t[k]||'',set:(t,k,v)=>(t[k]=v,true)}),
    classList:cls(), dataset:{}, files:[], value:'', disabled:false, title:'',
    _text:'', _html:'',
    appendChild(c){o.children.push(c);return c;}, removeChild(){}, remove(){},
    insertBefore(c){o.children.push(c);return c;}, setAttribute(){}, getAttribute(){return null;},
    addEventListener(){}, removeEventListener(){}, focus(){}, blur(){}, click(){},
    getContext:()=>ctx, getBoundingClientRect:()=>({left:0,top:0,width:736,height:416}),
    querySelector:()=>el('q'), querySelectorAll:()=>[], closest:()=>null, scrollIntoView(){},
    replaceChildren(){o.children=[];} };
  Object.defineProperty(o,'textContent',{get:()=>o._text,set:v=>{o._text=String(v);o.children=[];}});
  Object.defineProperty(o,'innerHTML',{get:()=>o._html,set:v=>{o._html=String(v);o.children=[];}});
  Object.defineProperty(o,'firstChild',{get:()=>o.children[0]||null});
  Object.defineProperty(o,'parentNode',{get:()=>doc.body});
  return o;
}
const store=new Map(ids.map(i=>[i,el(i)]));
const doc={
  body:Object.assign(el('body'),{classList:cls()}),
  documentElement:el('html'),
  getElementById:id=>{ if(!store.has(id)){ missing.add(id); return null; } return store.get(id); },
  createElement:t=>el('new:'+t), createTextNode:t=>({nodeValue:t}),
  querySelector:sel=>el('sel:'+sel), querySelectorAll:()=>[],
  addEventListener(){}, removeEventListener(){}, createDocumentFragment:()=>el('frag'),
};
globalThis.document=doc;
globalThis.window={addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),
  devicePixelRatio:1,requestAnimationFrame:()=>0,setTimeout:()=>0,setInterval:()=>0,innerWidth:1200,innerHeight:800};
globalThis.requestAnimationFrame=()=>0; globalThis.cancelAnimationFrame=()=>{};
globalThis.setInterval=()=>0; globalThis.setTimeout=()=>0;
globalThis.Blob=class{constructor(a){this.size=(a&&a[0]||'').length;}};
globalThis.URL={createObjectURL:()=>'blob:x',revokeObjectURL(){}};
globalThis.FileReader=class{readAsText(){}};
globalThis.alert=()=>{}; globalThis.confirm=()=>true; globalThis.prompt=()=>null;
globalThis.navigator={userAgent:'node'};
globalThis.getComputedStyle=()=>new Proxy({},{get:()=>''});
globalThis.addEventListener=()=>{}; globalThis.removeEventListener=()=>{};
globalThis.location={href:'',hash:''}; globalThis.history={replaceState(){}};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};

const src=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
let died=null;
try{ new Function(src)(); }catch(e){ died=e; }

const say=console.log;
if(died){ say('✗ 스크립트가 죽었다: '+died.message); say(died.stack.split('\n').slice(0,4).join('\n')); process.exit(1); }
say('✓ 스크립트가 끝까지 돌았다 (초기화 전부 통과)');
if(missing.size){ say('⚠️ 없는 id 를 찾은 자리: '+[...missing].join(', ')); process.exit(1); }
say('✓ getElementById 가 null 을 돌려준 자리 없음');
say('  crewCnt  → "'+store.get('crewCnt').textContent+'"');
say('  crewN    → "'+store.get('crewN').textContent+'"');
say('  yardPill → "'+store.get('yardPill').textContent+'"');
say('  yardTxt  → "'+store.get('yardTxt').textContent+'"');
say('  enterGo  → "'+store.get('enterGo').textContent+'"');
say('  enterPop 클래스 → ['+[...store.get('enterPop').classList._s].join(',')+']  (동네를 아직 안 열었으니 비어 있어야 정상)');
say('  enterPageLbl → "'+store.get('enterPageLbl').textContent+'"');
say('  enterList 줄 수 → '+store.get('enterList').children.length+'  (한 쪽에 3개여야 정상)');
say('  enterPrevPg disabled → '+store.get('enterPrevPg').disabled+' / enterNextPg → '+store.get('enterNextPg').disabled);
say('  winTitle → "'+store.get('winTitle').textContent+'"');
say('  chBtn → "'+store.get('chBtn').textContent+'"');
say('전부 통과 ✅');
