/* asset-code.js — 🔐 에셋 코드 — 풀 GLB 암호화(.dcc) · 책상 · 아이템 GLB 코드(DCK1)
   app.js «🔐 에셋 코드 — 풀 GLB 암호화(.dcc) · 책상 · 아이템 GLB 코드(DCK1)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 48번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: decryptAssetCode · decryptBytes · encryptAssetCode · encryptBytes · parseGlbBytes · parseGlbFull · unwrapAsset · wrapAsset — app.js 는 assetCodeMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAssetCode — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-asset-code.js */
(function(){

function createAssetCode(deps){
const codeCryptoMod = deps.codeCryptoMod;
const loader = deps.loader;
async function encryptBytes(buf,pass){
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await codeCryptoMod._deriveKey(pass,salt);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,buf));
  const out=new Uint8Array(33+ct.length); out.set([0x44,0x43,0x47,0x31,0x00],0); out.set(salt,5); out.set(iv,21); out.set(ct,33);
  return out.buffer;}
async function decryptBytes(buf,pass){
  const b=new Uint8Array(buf);
  if(!(b[0]===0x44&&b[1]===0x43&&b[2]===0x47&&b[3]===0x31)) throw new Error('format');
  const salt=b.slice(5,21), iv=b.slice(21,33), ct=b.slice(33);
  const key=await codeCryptoMod._deriveKey(pass,salt);
  return crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);}

async function encryptAssetCode(buf,pass,kind){
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await codeCryptoMod._deriveKey(pass,salt);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,buf));
  const blob=new Uint8Array(28+ct.length); blob.set(salt,0); blob.set(iv,16); blob.set(ct,28);
  return 'DCK1.'+kind+'.'+codeCryptoMod._b64(blob.buffer); }
async function decryptAssetCode(code,pass){
  const m=/^DCK1\.(desk|item)\.([\s\S]+)$/.exec((code||'').trim()); if(!m)throw new Error('format');
  const blob=codeCryptoMod._unb64(m[2].replace(/\s+/g,''));
  const salt=blob.slice(0,16), iv=blob.slice(16,28), ct=blob.slice(28);
  const key=await codeCryptoMod._deriveKey(pass,salt);
  const buf=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);
  return {kind:m[1], buf}; }
function wrapAsset(name,icon,glbBuf){ const nb=new TextEncoder().encode(JSON.stringify({name,icon:icon||''}));
  const out=new Uint8Array(4+nb.length+glbBuf.byteLength); new DataView(out.buffer).setUint32(0,nb.length);
  out.set(nb,4); out.set(new Uint8Array(glbBuf),4+nb.length); return out.buffer; }
function unwrapAsset(buf){ const dv=new DataView(buf); const len=dv.getUint32(0);
  let meta={name:'커스텀',icon:''};
  try{ meta=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,len))); }catch(_){}
  const glbBuf=buf.slice(4+len); return {name:meta.name||'커스텀', icon:meta.icon||'', glbBuf}; }
function parseGlbBytes(buf){ return new Promise((res,rej)=>{ try{ loader.parse(buf,'',g=>res(g.scene), e=>rej(e)); }catch(e){rej(e);} }); }
// 아이템 전용 — 씬뿐 아니라 애니메이션 클립도 같이 반환 (parseGlbBytes는 기존 호환을 위해 씬만 반환하는 채로 둠)
function parseGlbFull(buf){ return new Promise((res,rej)=>{ try{ loader.parse(buf,'',g=>res({scene:g.scene, animations:g.animations||[]}), e=>rej(e)); }catch(e){rej(e);} }); }

return {
  decryptAssetCode,
  decryptBytes,
  encryptAssetCode,
  encryptBytes,
  parseGlbBytes,
  parseGlbFull,
  unwrapAsset,
  wrapAsset,
};
}

const api = { createAssetCode };
if(typeof window !== 'undefined') window.TwAssetCode = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
