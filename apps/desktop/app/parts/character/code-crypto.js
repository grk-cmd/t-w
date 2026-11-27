/* code-crypto.js — 🔐 캐릭터 복제 코드 DCC1(encryptCode · decryptCode)의 앱 쪽 — 암호 · 칸 싣기 · 되살리기는 캐릭터 코어(TwCharCore · packages/char-core/src/clone-code.ts)가 한다(#433).
   여기 남은 몫: 그림 다루기(동물 그림 줄이기 · 주소 → 캔버스) · 커미션 이름이 비면 «커미션»(화면 글).
   ★ 밖에서 부르는 이름: _b64 · _deriveKey · _unb64 · decryptCode · encryptCode — app.js 는 codeCryptoMod.이름 으로 부른다(DCK1 · 커미션 코드도 _b64 · _deriveKey 를 쓴다).
   ⚠️ 전역 이름은 TwCodeCrypto — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-code-crypto.js · 코어 시험 packages/char-core/tests/clone-code.test.ts */
(function(){

function createCodeCrypto(deps){
const charCore = deps.charCore;
const charDef = deps.charDef;
const loadImg = deps.loadImg;
const newCanvas = deps.newCanvas;
function _b64(buf){ return charCore.b64(buf); }
function _unb64(str){ return charCore.unb64(str); }
function _deriveKey(pass,salt){ return charCore.deriveKey(pass,salt); }
/* 동물 그림 4~6장은 불러올 때 크기를 정해 그리므로(drawImage(im,0,0,P_SZ,P_SZ)) 줄여 담아도 된다.
   ⚠️ face · blink 는 크기 없이 그려서 줄이면 왼쪽 위 1/4 에만 찍힌다 — 코어도 둘은 줄이지 않는다. */
async function _shrinkDataUrl(url, size){
  if(!url || typeof url!=='string' || !url.startsWith('data:')) return url || null;
  try{
    const im = await loadImg(url);
    const c = document.createElement('canvas'); c.width=c.height=size;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(im, 0, 0, size, size);
    return c.toDataURL('image/png');
  }catch(_){ return url; }   // 실패하면 원본 그대로(코드 만들기 자체는 성공시킴)
}
function encryptCode(def,pass){ return charCore.encodeCloneCode(def, pass, { shrinkDataUrl: _shrinkDataUrl }); }
async function decryptCode(code,pass){
  const o=await charCore.decodeCloneCode(code,pass);
  const[f,b]=await Promise.all([loadImg(o.face),loadImg(o.blink)]);
  const fc=newCanvas();fc.getContext('2d').drawImage(f,0,0);const bc=newCanvas();bc.getContext('2d').drawImage(b,0,0);
  const {type:_t,skin,face:_f,blink:_b,top,bot,...rest}=o;
  const _d=Object.assign(charDef(skin,fc,bc,top,bot),rest);
  if(_d.isCommission && !_d.commName) _d.commName='커미션';
  return _d;}

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
