/* glb-idb-cache.js — 💾 GLB 영구 캐시(IndexedDB) — url 별 base64 넣기 · 꺼내기 · 오래된 것 치우기
   책임: 받은 GLB(base64)를 url 을 키로 IndexedDB(tw-glb-cache)에 두고 꺼낸다 · 45일 넘게 안 쓴 것을 실행마다 한 번 치운다. 무슨 GLB 인지(카탈로그 · 파츠)는 모른다 — 부르는 쪽(catalog-glb.js 의 resolveCatalogGlb)이 정한다.
   받는 deps: 없음(브라우저 indexedDB 전역). 내보내는 것: _glbIdbGet(url) · _glbIdbPut(url, b64) · _glbIdbPrune().
   app.js «💾 카탈로그 GLB 영구 캐시(IndexedDB) · URL 해결» 구역의 앞쪽(IndexedDB 몫)을 그대로 옮겼다(구역 떼기 C · w2). 동작은 옮기기 전과 같다.
   ★ 아래 코드는 app.js 에 있던 글 그대로다(들여쓰기도 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄였다). 바뀐 코드 줄은 0줄.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 밖에서 부르는 이름: _glbIdbGet · _glbIdbPrune · _glbIdbPut — app.js 는 glbIdbMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwGlbIdbCache — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-glb-idb-cache.js */
(function(){

function createGlbIdbCache(deps){

/* 💾 GLB 영구 캐시 (IndexedDB) — 세션 메모리 캐시는 껐다 켜면 사라져 실행마다 Storage 에서 전량을 다시 받았다.
   ★ 키는 glbUrl 그대로 — 관리자가 다시 올리면 URL 토큰이 바뀌어 저절로 새로 받는다. localStorage(5MB)엔 GLB 몇 개도 안 들어가 IndexedDB.
   ⚠️ 실패는 전부 조용히 넘긴다 — 캐시가 막혀도(프라이빗 모드 등) 매번 받아 쓰면 된다. */
const _GLB_IDB_NAME = 'tw-glb-cache', _GLB_IDB_STORE = 'glb', _GLB_IDB_TTL = 45 * 86400000;   // 45일
let _glbIdbPromise = null;
function _glbIdb(){
  if(_glbIdbPromise) return _glbIdbPromise;
  _glbIdbPromise = new Promise(res=>{
    try{
      if(!window.indexedDB) return res(null);
      const rq = indexedDB.open(_GLB_IDB_NAME, 1);
      rq.onupgradeneeded = ()=>{ try{ rq.result.createObjectStore(_GLB_IDB_STORE, {keyPath:'url'}); }catch(_){} };
      rq.onsuccess = ()=>res(rq.result);
      rq.onerror = ()=>res(null);
    }catch(_){ res(null); }
  });
  return _glbIdbPromise;
}
function _glbIdbGet(url){
  return _glbIdb().then(db=>new Promise(res=>{
    if(!db) return res(null);
    try{
      const rq = db.transaction(_GLB_IDB_STORE, 'readonly').objectStore(_GLB_IDB_STORE).get(url);
      rq.onsuccess = ()=>res(rq.result ? rq.result.b64 : null);
      rq.onerror = ()=>res(null);
    }catch(_){ res(null); }
  })).catch(()=>null);
}
function _glbIdbPut(url, b64){
  return _glbIdb().then(db=>{
    if(!db) return;
    try{ db.transaction(_GLB_IDB_STORE, 'readwrite').objectStore(_GLB_IDB_STORE).put({ url, b64, ts: Date.now() }); }catch(_){}
  }).catch(()=>{});
}
/* 오래 안 쓴 항목 정리 — 세션당 1회(옛 URL 은 다시 안 쓰인다 · 지워도 필요하면 다시 받는다). */
let _glbIdbPruned = false;
function _glbIdbPrune(){
  if(_glbIdbPruned) return; _glbIdbPruned = true;
  _glbIdb().then(db=>{
    if(!db) return;
    try{
      const cutoff = Date.now() - _GLB_IDB_TTL;
      const st = db.transaction(_GLB_IDB_STORE, 'readwrite').objectStore(_GLB_IDB_STORE);
      const rq = st.openCursor();
      rq.onsuccess = ()=>{
        const c = rq.result; if(!c) return;
        if(!c.value || !(c.value.ts > cutoff)){ try{ c.delete(); }catch(_){} }
        c.continue();
      };
    }catch(_){}
  }).catch(()=>{});
}

return {
  _glbIdbGet,
  _glbIdbPrune,
  _glbIdbPut,
};
}

const api = { createGlbIdbCache };
if(typeof window !== 'undefined') window.TwGlbIdbCache = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
