/* commission.js — 📦 커미션 zip 풀기 · 암호화 · 💾 저장 책상 · 아이템(savedDesks · savedItems)
   app.js «📦 커미션 zip 풀기 · 암호화 · 💾 저장 책상 · 아이템(savedDesks · savedItems)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 45번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 5개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: MAX_COMMISSION_BYTES · MAX_CUSTOM_ASSETS · MAX_CUSTOM_ITEMS · MAX_GLB_BYTES · decryptCommission · encryptCommission · persistSavedAssets · savedDesks · savedItems · unpackCommissionZip — app.js 는 commissionMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCommission — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-commission.js */
(function(){

function createCommission(deps){
const _b64 = deps._b64;
const _deriveKey = deps._deriveKey;
const _unb64 = deps._unb64;
const toast = deps.toast;
const MAX_COMMISSION_BYTES = 2 * 1024 * 1024;   // 2MB
const COMMISSION_TEX_SIZE = 512;
/* 이미지 Blob → 512×512 캔버스 → PNG 데이터 URL */
function resizeImgBlobTo(dataUrl, sz){
  return new Promise((res,rej)=>{
    const im=new Image();
    im.onload=()=>{
      const cv=document.createElement('canvas'); cv.width=sz; cv.height=sz;
      const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
      ctx.drawImage(im,0,0,sz,sz);
      res(cv.toDataURL('image/png'));
    };
    im.onerror=()=>rej(new Error('image load failed'));
    im.src=dataUrl;
  });
}
/* zip 파일에서 character.glb / face.png / blink.png 추출. PNG는 512로 리사이즈된 데이터 URL */
async function unpackCommissionZip(file){
  if(typeof JSZip==='undefined') throw new Error('JSZip 라이브러리가 로드되지 않았어요');
  if(file.size > MAX_COMMISSION_BYTES) throw new Error('zip 파일이 2MB를 넘어요');
  const z = await JSZip.loadAsync(file);
  // 파일 찾기 (대소문자 무시, 경로 무시)
  // 1순위: 정확히 일치하는 파일명(character.glb/face.png/blink.png) — 기존 방식 그대로 우선 시도.
  // 2순위: 정확히 안 맞으면 "키워드 포함 + 확장자 일치"로 완화 매칭 — face2.png, face (1).png, blink_v2.png 등도 인식되게.
  function find(exactName, keyword, ext){
    const exact = exactName.toLowerCase();
    for(const path in z.files){
      const f=z.files[path]; if(f.dir) continue;
      if(path.split('/').pop().toLowerCase()===exact) return f;
    }
    for(const path in z.files){
      const f=z.files[path]; if(f.dir) continue;
      const base=path.split('/').pop().toLowerCase();
      if(base.includes(keyword) && base.endsWith(ext)) return f;
    }
    return null;
  }
  const fGlb=find('character.glb','character','.glb'), fFace=find('face.png','face','.png'), fBlink=find('blink.png','blink','.png');
  if(!fGlb) throw new Error('character.glb 가 zip에 없어요');
  if(!fFace) throw new Error('face.png 가 zip에 없어요');
  if(!fBlink) throw new Error('blink.png 가 zip에 없어요');
  const [glbBuf, faceBlob, blinkBlob] = await Promise.all([
    fGlb.async('arraybuffer'),
    fFace.async('blob'),
    fBlink.async('blob')
  ]);
  const [faceUrl, blinkUrl] = await Promise.all([
    new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(faceBlob);}),
    new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(blinkBlob);})
  ]);
  // 512로 자동 리사이즈
  const [face512, blink512] = await Promise.all([
    resizeImgBlobTo(faceUrl, COMMISSION_TEX_SIZE),
    resizeImgBlobTo(blinkUrl, COMMISSION_TEX_SIZE)
  ]);
  return { glbBuf, faceDataUrl: face512, blinkDataUrl: blink512 };
}
/* 커미션 페이로드 → 암호화 코드 (DCM1 포맷, 기존 DCC1과 구분) */
async function encryptCommission(payload, pass){
  if(!(window.crypto&&crypto.subtle)) throw new Error('crypto unsupported');
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await _deriveKey(pass,salt);
  const ptBytes = new TextEncoder().encode(JSON.stringify(payload));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,ptBytes));
  const blob=new Uint8Array(28+ct.length); blob.set(salt,0); blob.set(iv,16); blob.set(ct,28);
  return 'DCM1.'+_b64(blob.buffer);
}
async function decryptCommission(code, pass){
  if(!/^DCM1\./.test(code)) throw new Error('format');
  const blob=_unb64(code.slice(5).replace(/\s+/g,''));
  const salt=blob.slice(0,16), iv=blob.slice(16,28), ct=blob.slice(28);
  const key=await _deriveKey(pass,salt);
  const ptBuf=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);
  return JSON.parse(new TextDecoder().decode(ptBuf));
}
/* 코드로 추가한 책상·아이템 영구 저장 (모든 캐릭터 공통, localStorage). 각 최대 6개 */
const SAVED_DESK_KEY='tw.savedDesks', SAVED_ITEM_KEY='tw.savedItems';
const MAX_CUSTOM_ASSETS=6, MAX_CUSTOM_ITEMS=50, MAX_GLB_BYTES=1024*1024;   // 1MB — 책상은 6개, 아이템은 요청에 따라 50개까지
let savedDesks=[], savedItems=[];   // [{id, name, icon, glb(base64)}]
function loadSavedAssets(){
  try{ savedDesks=JSON.parse(localStorage.getItem(SAVED_DESK_KEY)||'[]'); }catch(_){ savedDesks=[]; }
  try{ savedItems=JSON.parse(localStorage.getItem(SAVED_ITEM_KEY)||'[]'); }catch(_){ savedItems=[]; }
}
/* 카탈로그에서 다시 받을 수 있는 자산인가 — 그렇다면 GLB 바이트를 이 PC 저장소에 복사해 두지 않는다(필요할 때 resolveCatalogGlb).
   책상 프리셋(creator/desk-preset-store.js)도 이 판단을 쓴다 — 조건을 다시 쓰지 말 것. */
function catalogBacked(rec){ return !!(rec && rec.fromCatalog && rec.glbUrl); }
function persistSavedAssets(){
  const stripDesks = savedDesks.map(p=>{
    if(catalogBacked(p)){ const clone={...p}; delete clone.glb; return clone; }
    return p;
  });
  const stripItems = savedItems.map(p=>{
    if(catalogBacked(p)){ const clone={...p}; delete clone.glb; return clone; }
    return p;
  });
  try{ localStorage.setItem(SAVED_DESK_KEY,JSON.stringify(stripDesks)); }catch(_){ toast('저장 공간이 부족해요'); }
  try{ localStorage.setItem(SAVED_ITEM_KEY,JSON.stringify(stripItems)); }catch(_){}
}
loadSavedAssets();

return {
  MAX_COMMISSION_BYTES,
  MAX_CUSTOM_ASSETS,
  MAX_CUSTOM_ITEMS,
  MAX_GLB_BYTES,
  catalogBacked,
  decryptCommission,
  encryptCommission,
  persistSavedAssets,
  savedDesks: ()=>savedDesks,   // 읽는 함수
  setSavedDesks: (v)=>{ savedDesks = v; },   // 쓰는 함수 — app.js 가 비운다
  savedItems: ()=>savedItems,   // 읽는 함수
  setSavedItems: (v)=>{ savedItems = v; },   // 쓰는 함수 — app.js 가 비운다
  unpackCommissionZip,
};
}

const api = { createCommission };
if(typeof window !== 'undefined') window.TwCommission = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
