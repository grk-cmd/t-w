/* catalog-glb.js — 🔗 카탈로그 GLB 해결 — glbUrl 만 있는 레코드에 rec.glb 채우기(메모리 → 영구 캐시 → 서버)
   책임: 카탈로그 인덱스에는 glbUrl 만 오고(GLB 본체는 Storage) 앱 곳곳은 rec.glb(base64)를 보므로, 쓰는 때에 glbUrl → rec.glb 로 채운다. 같은 url 은 세션 메모리 · 영구 캐시(IndexedDB)로 두 번 안 받는다.
   받는 deps: glbIdbMod(영구 캐시 — shared/glb-idb-cache.js 의 _glbIdbGet · _glbIdbPut · _glbIdbPrune). catalogSourceMod(서버 받기 — character/catalog-source.js 의 Firebase 판).
   내보내는 것: resolveCatalogGlb(rec) · resolveCatalogGlbAll(catalogObj).
   app.js «💾 카탈로그 GLB 영구 캐시(IndexedDB) · URL 해결» 구역의 뒤쪽(URL 해결 몫)을 그대로 옮겼다(구역 떼기 C · w2). 동작은 옮기기 전과 같다.
   ★ 아래 코드는 app.js 에 있던 글 그대로다(들여쓰기도 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄였다). 바뀐 코드 줄은 0줄(영구 캐시를 부르는 세 줄 «glbIdbMod._glbIdb…(» 은 같은 커밋에서 앞 모듈로 옮기며 바뀐 자리).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 밖에서 부르는 이름: resolveCatalogGlb · resolveCatalogGlbAll — app.js 는 catalogGlbMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCatalogGlb — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-catalog-glb.js */
(function(){

function createCatalogGlb(deps){
const catalogSourceMod = deps.catalogSourceMod;
const glbIdbMod = deps.glbIdbMod;
const _glbUrlCache = new Map();   // url → base64 (세션 메모리 1차 캐시)
async function resolveCatalogGlb(rec){
  if(!rec) return null;
  if(rec.glb) return rec.glb;                          // 구버전(base64 그대로) 호환
  if(!rec.glbUrl) return null;
  if(_glbUrlCache.has(rec.glbUrl)){
    // ⚠️ 캐시에서 꺼낼 때도 rec.glb 를 채운다 — 빠뜨리면 rec.glb 를 보는 곳이 «GLB를 불러올 수 없어요» 로 오탐한다.
    rec.glb = _glbUrlCache.get(rec.glbUrl);
    return rec.glb;
  }
  // 2차 캐시(IndexedDB) — 앱을 껐다 켜도 남는다. 여기서 맞으면 네트워크로 안 나간다.
  const hit = await glbIdbMod._glbIdbGet(rec.glbUrl);
  if(hit){
    _glbUrlCache.set(rec.glbUrl, hit);
    rec.glb = hit;
    return hit;
  }
  if(!catalogSourceMod.catalogSrcCan('fetchGlb')) return null;
  try{
    const b64 = await catalogSourceMod.catalogSrcFetchGlb(rec.glbUrl);
    _glbUrlCache.set(rec.glbUrl, b64);
    glbIdbMod._glbIdbPut(rec.glbUrl, b64);   // 기다리지 않는다 — 저장 실패해도 이번 실행에는 지장이 없다
    rec.glb = b64;    // 이후 rec.glb 참조 시 재fetch 없음
    return b64;
  }catch(e){ console.warn('카탈로그 GLB 로드 실패', rec.id, e); return null; }
}
// 카탈로그 스냅샷 전체를 병렬로 해결 — 각 rec에 .glb 채워서 반환.
async function resolveCatalogGlbAll(catalogObj){
  glbIdbMod._glbIdbPrune();
  const ids = Object.keys(catalogObj||{});
  await Promise.all(ids.map(id=>resolveCatalogGlb(catalogObj[id])));
  return catalogObj;
}

return {
  resolveCatalogGlb,
  resolveCatalogGlbAll,
};
}

const api = { createCatalogGlb };
if(typeof window !== 'undefined') window.TwCatalogGlb = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
