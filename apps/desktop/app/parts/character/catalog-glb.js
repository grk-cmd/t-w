/* catalog-glb.js — 🔗 카탈로그 GLB 해결 — glbUrl 만 있는 레코드에 rec.glb 채우기(메모리 → 영구 캐시 → 서버)
   책임: 카탈로그 인덱스에는 glbUrl 만 오고(GLB 본체는 Storage) 앱 곳곳은 rec.glb(base64)를 보므로, 쓰는 때에 glbUrl → rec.glb 로 채운다. 같은 파일은 세션 메모리 · 영구 캐시(IndexedDB)로 두 번 안 받는다.
     영구 캐시 열쇠는 내용 해시(rec.modelHash) — 주소가 바뀌어도(0.13 서버 endpoint → Storage) 다시 받지 않는다. 옛 판이 주소로 남긴 줄도 찾아 새 열쇠로 옮긴다.
   받는 deps: glbIdbMod(영구 캐시 — shared/glb-idb-cache.js 의 _glbIdbGet · _glbIdbPut · _glbIdbPrune). catalogApiMod(서버 받기 — character/catalog-api.js 의 fetchGlb · legacyGlbUrl).
   내보내는 것: resolveCatalogGlb(rec) · resolveCatalogGlbCached(rec)(네트워크 없이) · resolveCatalogGlbAll(recs, cachedOnly) → 새로 채운 수 · glbFailWhy(url)(마지막 실패 이유 — 오류 진단 기록용).
   ★ 밖에서 부르는 이름: resolveCatalogGlb · resolveCatalogGlbCached · resolveCatalogGlbAll · glbFailWhy — app.js 는 catalogGlbMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCatalogGlb — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-catalog-glb.js */
(function(){

function createCatalogGlb(deps){
const catalogApiMod = deps.catalogApiMod;
const glbIdbMod = deps.glbIdbMod;
const _glbUrlCache = new Map();   // 열쇠(내용 해시 · 없으면 주소) → base64 (세션 메모리 1차 캐시)
/* url → 마지막 받기 실패 이유. 부르는 쪽(책상 카드 — 만들기 E-CHAR-14 · 꾸미기 E-CHAR-13)이 진단 기록에 싣는다 — 실패를 null 로만 돌려주면
   «막힘 · 몇 번 응답 · 연결 없음» 을 가를 수 없다. 주소(토큰이 든)는 남기지 않는다. 받으면 지운다. */
const _glbFailWhy = new Map();
/* fetch 가 연결이 안 되거나 받는 도중 끊기면 TypeError(차단 · DNS · 연결) — net-fail. 응답이 오면 상태 번호가 든 Error. 걸린 시간도 싣는다(바로 끊김 ↔ 오래 기다림) */
function _glbFailText(e, ms){
  const net = !!(e && e.name === 'TypeError');
  const msg = String((e && e.message) || e || '').replace(/\s+/g, ' ').slice(0, 40);
  return (net ? 'net-fail ' : 'fail ') + msg + ' ' + ms + 'ms';
}
const MODEL_HASH_RE = /^[0-9a-f]{64}$/;
/* 영구 캐시 열쇠 — 내용 해시(modelHash)가 있으면 «sha256:해시»(주소가 Storage ↔ 서버 endpoint 로 바뀌어도 같은 파일은 같은 열쇠),
   없으면 주소. 찾을 때는 옛 판이 남긴 주소 열쇠도 본다 — 지금 주소(glbUrl) · 0.13 판의 서버 endpoint 주소(legacyGlbUrl) */
function keysOf(rec){
  const h = (typeof rec.modelHash === 'string' && MODEL_HASH_RE.test(rec.modelHash)) ? rec.modelHash : null;
  const main = h ? 'sha256:' + h : rec.glbUrl;
  const old = h ? [rec.glbUrl, catalogApiMod.legacyGlbUrl(h)].filter((u) => u && u !== main) : [];
  return { main, old: Array.from(new Set(old)) };
}
/* 메모리 · 영구 캐시에서만 — 네트워크로 안 나간다. 찾으면 rec.glb 를 채우고 돌려준다(옛 열쇠로 찾았으면 새 열쇠로도 적어 둔다) */
async function resolveCatalogGlbCached(rec){
  if(!rec) return null;
  if(rec.glb) return rec.glb;                          // 구버전(base64 그대로) 호환
  if(!rec.glbUrl) return null;
  const k = keysOf(rec);
  if(_glbUrlCache.has(k.main)){
    // ⚠️ 캐시에서 꺼낼 때도 rec.glb 를 채운다 — 빠뜨리면 rec.glb 를 보는 곳이 «GLB를 불러올 수 없어요» 로 오탐한다.
    rec.glb = _glbUrlCache.get(k.main);
    return rec.glb;
  }
  let hit = await glbIdbMod._glbIdbGet(k.main);
  if(!hit){
    for(const o of k.old){
      hit = await glbIdbMod._glbIdbGet(o);
      if(hit){ glbIdbMod._glbIdbPut(k.main, hit); break; }   // 옛 열쇠 → 새 열쇠로 옮겨 적는다(옛 줄은 45일 뒤 치워진다)
    }
  }
  if(!hit) return null;
  _glbUrlCache.set(k.main, hit);
  rec.glb = hit;
  return hit;
}
async function resolveCatalogGlb(rec){
  if(!rec) return null;
  const c = await resolveCatalogGlbCached(rec);
  if(c || !rec.glbUrl) return c;
  const k = keysOf(rec);
  const t0 = Date.now();
  try{
    const b64 = await catalogApiMod.fetchGlb(rec.glbUrl);
    _glbFailWhy.delete(rec.glbUrl);
    _glbUrlCache.set(k.main, b64);
    glbIdbMod._glbIdbPut(k.main, b64);   // 기다리지 않는다 — 저장 실패해도 이번 실행에는 지장이 없다
    rec.glb = b64;    // 이후 rec.glb 참조 시 재fetch 없음
    return b64;
  }catch(e){ _glbFailWhy.set(rec.glbUrl, _glbFailText(e, Date.now() - t0)); console.warn('카탈로그 GLB 로드 실패', rec.id, e); return null; }
}
/* 레코드 여럿을 한꺼번에 — cachedOnly 면 네트워크로 안 나간다(첫 화면 전 합치기 · 영구 캐시만). @return 새로 채운 수 */
async function resolveCatalogGlbAll(recs, cachedOnly){
  glbIdbMod._glbIdbPrune();
  const list = Array.isArray(recs) ? recs : Object.keys(recs || {}).map((id) => recs[id]);
  const fn = cachedOnly ? resolveCatalogGlbCached : resolveCatalogGlb;
  const before = list.filter((r) => r && r.glb).length;
  await Promise.all(list.map((r) => fn(r)));
  return list.filter((r) => r && r.glb).length - before;
}

return {
  resolveCatalogGlb,
  resolveCatalogGlbCached,
  resolveCatalogGlbAll,
  glbFailWhy: (url)=>_glbFailWhy.get(url) || '',
};
}

const api = { createCatalogGlb };
if(typeof window !== 'undefined') window.TwCatalogGlb = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
