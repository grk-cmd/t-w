/* upload-cache.js — 🗂️ 업로드 캐시(«종류:내용해시 → URL») 규칙 한 곳 (검사 sim-upload-cache.js)
   [왜] 얼굴 캐시(room-sync.js · tw.roomFaceUrls)와 슬롯 GLB 캐시(slot-sync.js · tw.slotGlbUrls)가 «넘치면 어떻게 버리나» 를
     따로 들고 있었다. 같은 판단이라 여기로 모으고, 같은 그림을 여러 번 올리던 길(통째 비움 · 사본끼리 덮어쓰기 · 동시 업로드)도 여기서 막는다.
   받는 deps 없음. 내놓는 것: createUploadCache() → { trim · touch · merge · once · applyUrlSwaps · FACE_CACHE_MAX · GLB_CACHE_MAX · THUMB_CACHE_MAX }
     · 같은 이름의 순수 함수.
   app.js · 쓰는 모듈보다 먼저 싣는 classic script(window.TwUploadCache). 쓰는 모듈은 app.js 가 만든 것을 deps 로 받는다. */
(function(){

const FACE_CACHE_MAX = 100;
const GLB_CACHE_MAX = 40;
const THUMB_CACHE_MAX = 10;   // 섬네일은 외모가 바뀔 때마다 새 이름이라 얼굴 칸을 다 차지하지 않게 따로 줄인다
const THUMB_PREFIX = 'thumb:';

/* 캐시 키 «종류:해시» 의 해시가 새 규칙(h2…)인가 — 아니면 옛 해시로 올린 이름이다. */
function _isCurrentHash(k){
  const h = String(k).slice(String(k).indexOf(':') + 1);
  return /^h2/.test(h);
}

/* 상한 넘친 캐시 다듬기 — 오래 안 쓴 것(앞쪽)부터 버린다. 통째로 비우지 않는다(비우면 이미 올린 그림을 전부 다시 올린다).
   순서: 옛 해시 → 섬네일 상한 → 전체 상한. 키 순서가 «오래 안 쓴 순» 이다(touch · merge 가 맞춘다).
   ⚠️ 옛 해시 항목은 조회에 쓰지 않는다(그림이 같다는 보장이 없다). */
function trim(st, max){
  if(!st || typeof st !== 'object') return {};
  const keys = () => Object.keys(st);
  if(keys().length > max) for(const k of keys()) if(!_isCurrentHash(k)) delete st[k];
  const thumbs = keys().filter(k => k.indexOf(THUMB_PREFIX) === 0);
  for(let i = 0; i < thumbs.length - THUMB_CACHE_MAX; i++) delete st[thumbs[i]];
  const rest = keys();
  for(let i = 0; i < rest.length - max; i++) delete st[rest[i]];
  return st;
}

/* 쓴 항목을 맨 뒤로 — «최근에 씀» */
function touch(st, k){
  if(!st || !(k in st)) return;
  const v = st[k]; delete st[k]; st[k] = v;
}

/* 저장 직전 합치기 — 그 사이 다른 사본(방 입장 · 슬롯 올리기 · 보관함)이 저장한 항목을 잃지 않는다.
   mine 의 항목이 더 최근이라 뒤에 온다. */
function merge(stored, mine){
  const out = {};
  if(stored && typeof stored === 'object') for(const k of Object.keys(stored)) if(!(mine && k in mine)) out[k] = stored[k];
  if(mine && typeof mine === 'object') for(const k of Object.keys(mine)) out[k] = mine[k];
  return out;
}

/* 올린 자리 → URL 바꿔 넣기. 그 자리 값이 올릴 때 그대로(from)일 때만 — 그 사이 사용자가 바꾼 것은 덮지 않는다.
   swaps: [{ path: ['stickers', id, 'img'], from: dataURL, url }] */
function applyUrlSwaps(obj, swaps){
  let n = 0;
  if(!obj || !Array.isArray(swaps)) return n;
  for(const s of swaps){
    if(!s || !Array.isArray(s.path) || !s.path.length || typeof s.url !== 'string') continue;
    let o = obj;
    for(let i = 0; i < s.path.length - 1 && o; i++) o = o[s.path[i]];
    const last = s.path[s.path.length - 1];
    if(o && o[last] === s.from){ o[last] = s.url; n++; }
  }
  return n;
}

function createUploadCache(){
  const inflight = new Map();
  /* 같은 키(«종류:해시»)를 올리는 중이면 그 약속을 같이 쓴다 — 슬롯 올리기와 보관함 동기화가 같은 때 같은 그림을 두 번 올리던 길. */
  function once(key, run){
    if(inflight.has(key)) return inflight.get(key);
    const p = Promise.resolve().then(run).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }
  return { trim, touch, merge, once, applyUrlSwaps, FACE_CACHE_MAX, GLB_CACHE_MAX, THUMB_CACHE_MAX };
}

const api = { createUploadCache, trim, touch, merge, applyUrlSwaps, FACE_CACHE_MAX, GLB_CACHE_MAX, THUMB_CACHE_MAX };
if(typeof window !== 'undefined') window.TwUploadCache = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
