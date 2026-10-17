/* upload-cache.js — 🗂️ 업로드 캐시(«종류:내용해시 → URL») 상한 규칙 한 곳 (검사 sim-upload-cache.js)
   [왜] 얼굴 캐시(room-sync.js · tw.roomFaceUrls)와 슬롯 GLB 캐시(slot-sync.js · tw.slotGlbUrls)가 «넘치면 어떻게 버리나» 를
     따로 들고 있었다. 같은 판단이라 여기로 모은다.
   받는 deps 없음. 내놓는 것: createUploadCache() → { trim · FACE_CACHE_MAX · GLB_CACHE_MAX } · 순수 trim(st, max, opts) · FACE_CACHE_MAX · GLB_CACHE_MAX.
   app.js · 쓰는 모듈보다 먼저 싣는 classic script(window.TwUploadCache). 쓰는 모듈은 app.js 가 만든 것을 deps 로 받는다. */
(function(){

const FACE_CACHE_MAX = 60;
const GLB_CACHE_MAX = 40;

/* 캐시 키 «종류:해시» 의 해시가 새 규칙(h2…)인가 — 아니면 옛 해시로 올린 이름이다. */
function _isCurrentHash(k){
  const h = String(k).slice(String(k).indexOf(':') + 1);
  return /^h2/.test(h);
}

/* 상한 넘친 캐시 다듬기 — 돌려준 객체를 쓴다(통째로 비우면 새 객체).
   opts.dropLegacyFirst: 옛 해시 항목을 먼저 버린다 — 전환기에 한 그림이 두 칸을 차지해 상한에 금방 닿는 얼굴 캐시용.
   ⚠️ 옛 해시 항목은 조회에 쓰지 않는다(그림이 같다는 보장이 없다) — 여기서 남기는 건 통째 비움을 늦추려는 것뿐. */
function trim(st, max, opts){
  if(!st || typeof st !== 'object') return {};
  if(Object.keys(st).length <= max) return st;
  if(opts && opts.dropLegacyFirst){
    for(const k of Object.keys(st)) if(!_isCurrentHash(k)) delete st[k];
    if(Object.keys(st).length <= max) return st;
  }
  return {};
}

function createUploadCache(){
  return { trim, FACE_CACHE_MAX, GLB_CACHE_MAX };
}

const api = { createUploadCache, trim, FACE_CACHE_MAX, GLB_CACHE_MAX };
if(typeof window !== 'undefined') window.TwUploadCache = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
