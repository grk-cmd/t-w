/* code-crypto.js — 🔐 캐릭터 코드 암호화(encryptCode · decryptCode — base64 · 키 만들기 · 이미지 줄이기)
   app.js «🔐 캐릭터 코드 암호화(encryptCode · decryptCode — base64 · 키 만들기 · 이미지 줄이기)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 45번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 3개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _b64 · _deriveKey · _unb64 · decryptCode · encryptCode — app.js 는 codeCryptoMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCodeCrypto — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-code-crypto.js */
(function(){

function createCodeCrypto(deps){
const charDef = deps.charDef;
const loadImg = deps.loadImg;
const newCanvas = deps.newCanvas;
function _b64(buf){let s='';const b=new Uint8Array(buf);for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s);}
function _unb64(str){const s=atob(str);const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b;}
async function _deriveKey(pass,salt){const enc=new TextEncoder();
  const km=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
/* 🐾 복제코드에 담을 동물 텍스처를 줄인다.
   동물 페인트는 512px PNG 4장이라 코드가 인간보다 훨씬 커진다. 이 4장은 불러올 때
   drawImage(im,0,0,P_SZ,P_SZ)로 '크기를 지정해' 그리므로, 256으로 담아도 512로 자동 확대되어 정상 동작한다.
   ★ face/blink는 drawImage(f,0,0)로 크기 없이 그려서 줄이면 좌상단 1/4에만 찍힌다 — 절대 줄이지 말 것. */
const CODE_TEX_SIZE = 256;
async function _shrinkDataUrl(url, size){
  if(!url || typeof url!=='string' || !url.startsWith('data:')) return url || null;
  try{
    const im = await loadImg(url);
    const c = document.createElement('canvas'); c.width=c.height=size;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(im, 0, 0, size, size);
    return c.toDataURL('image/png');
  }catch(_){ return url; }   // 실패하면 원본 그대로(코드 생성 자체는 성공시킴)
}
async function encryptCode(def,pass){
  // 동물 페인트 4장은 CODE_TEX_SIZE로 줄여서 담는다(코드 용량 절감). 동물이 아니면 전부 null.
  const _aTex = def.animal
    ? await Promise.all([
        _shrinkDataUrl(def.animalBody,        CODE_TEX_SIZE),
        _shrinkDataUrl(def.animalEarPaintL,   CODE_TEX_SIZE),
        _shrinkDataUrl(def.animalEarPaintR,   CODE_TEX_SIZE),
        _shrinkDataUrl(def.animalBlink,       CODE_TEX_SIZE),
        _shrinkDataUrl(def.animalEarBlinkL,   CODE_TEX_SIZE),
        _shrinkDataUrl(def.animalEarBlinkR,   CODE_TEX_SIZE)])
    : [null,null,null,null,null,null];
  // 🐾 동물 필드도 함께 담는다 — 예전엔 인간 필드만 직렬화해서, 동물 캐릭터의 복제코드를
  //   불러오면 동물 정보가 전부 빠진 채 인간으로 나왔다. 동물 필드는 저장 시점에 이미
  //   dataURL/JSON 형태라 그대로 담으면 된다(캔버스는 face/blink 두 개뿐).
  const payload=JSON.stringify({t:'creator',skin:def.skin||0,top:def.top,bot:def.bot,xf:def.xf||null,decor:def.decor||null,deskColor:def.deskColor||null,deskItems:def.deskItems||null,deskGlb:def.deskGlb||null,deskCatalogId:def.deskCatalogId||null,deskScale:def.deskScale||null,deskPos:def.deskPos||null,customItems:def.customItems||null,isCommission:def.isCommission||false,commName:def.commName||null,commGlb:def.commGlb||null,
    animal:def.animal||false,animalFace:def.animalFace||0,animalScl:def.animalScl||null,animalEarL:def.animalEarL||null,animalEarR:def.animalEarR||null,animalEarAdj:def.animalEarAdj||null,animalBody:_aTex[0],animalEarPaintL:_aTex[1],animalEarPaintR:_aTex[2],animalBlink:_aTex[3],animalEarBlinkL:_aTex[4],animalEarBlinkR:_aTex[5],
    // 👂 사람 귀 — 종류 · 조정값 · 올린 그림(URL 만 — dataURL 은 코드가 너무 커진다)
    earL:def.earL||null,earR:def.earR||null,earAdj:def.earAdj||null,
    earPicL:(typeof def.earPicL==='string'&&!def.earPicL.startsWith('data:'))?def.earPicL:null,earPicR:(typeof def.earPicR==='string'&&!def.earPicR.startsWith('data:'))?def.earPicR:null,
    face:def.face.toDataURL('image/png'),blink:def.blink.toDataURL('image/png')});
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await _deriveKey(pass,salt);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(payload)));
  const blob=new Uint8Array(28+ct.length); blob.set(salt,0); blob.set(iv,16); blob.set(ct,28);
  return 'DCC1.'+_b64(blob.buffer);}
async function decryptCode(code,pass){
  if(!/^DCC1\./.test(code)) throw new Error('format');
  const blob=_unb64(code.slice(5).replace(/\s+/g,''));
  const salt=blob.slice(0,16), iv=blob.slice(16,28), ct=blob.slice(28);
  const key=await _deriveKey(pass,salt);
  const ptBuf=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);
  const o=JSON.parse(new TextDecoder().decode(ptBuf)); if(o.t!=='creator')throw new Error('type');
  const[f,b]=await Promise.all([loadImg(o.face),loadImg(o.blink)]);
  const fc=newCanvas();fc.getContext('2d').drawImage(f,0,0);const bc=newCanvas();bc.getContext('2d').drawImage(b,0,0);
  {const _d=charDef(o.skin||0,fc,bc,o.top,o.bot);if(o.xf)_d.xf=o.xf;if(o.decor)_d.decor=o.decor;if(o.deskColor)_d.deskColor=o.deskColor;if(o.deskItems)_d.deskItems=o.deskItems;if(o.deskGlb)_d.deskGlb=o.deskGlb;if(o.deskCatalogId)_d.deskCatalogId=o.deskCatalogId;if(o.deskScale)_d.deskScale=o.deskScale;if(o.deskPos)_d.deskPos=o.deskPos;if(o.customItems)_d.customItems=o.customItems;
    if(o.isCommission){_d.isCommission=true;_d.commName=o.commName||'커미션';_d.commGlb=o.commGlb||null;}
    // 👂 사람 귀 복원(옛 코드엔 없다)
    if(!o.animal){ if(o.earL)_d.earL=o.earL; if(o.earR)_d.earR=o.earR; if(o.earAdj)_d.earAdj=o.earAdj; if(o.earPicL)_d.earPicL=o.earPicL; if(o.earPicR)_d.earPicR=o.earPicR; }
    // 🐾 동물 필드 복원 — slotToObj/objToSlot이 쓰는 필드명과 1:1 (crDone 승계 목록과 동일 세트)
    if(o.animal){
      _d.animal=true; _d.animalFace=o.animalFace||0; _d.animalScl=o.animalScl||null;
      _d.animalEarL=o.animalEarL||null; _d.animalEarR=o.animalEarR||null; _d.animalEarAdj=o.animalEarAdj||null;
      _d.animalBody=o.animalBody||null; _d.animalEarPaintL=o.animalEarPaintL||null;
      _d.animalEarPaintR=o.animalEarPaintR||null; _d.animalBlink=o.animalBlink||null;
      // 🐾 감은눈 귀 — 옛 코드엔 없다. loadSlots 와 같은 폴백(표정 귀)으로 예전과 같은 모양을 유지한다.
      _d.animalEarBlinkL=o.animalEarBlinkL||o.animalEarPaintL||null;
      _d.animalEarBlinkR=o.animalEarBlinkR||o.animalEarPaintR||null;
    }
    return _d;}}

return {
  _b64,
  _deriveKey,
  _unb64,
  decryptCode,
  encryptCode,
};
}

const api = { createCodeCrypto };
if(typeof window !== 'undefined') window.TwCodeCrypto = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
