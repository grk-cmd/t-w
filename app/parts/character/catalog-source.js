/* catalog-source.js — 🔌 카탈로그 데이터 provider — 카탈로그 구독 · GLB 받기 · 파츠 올리기를 도메인 이름으로
   책임: 카탈로그 도메인(catalog-sync · catalog-glb · admin-thumbs)이 firebaseAPI 를 직접 부르지 않게, 서버에 닿는 일을 도메인 이름 하나씩으로 내놓는다.
     지금은 Firebase 판(옛 길) 하나뿐 — 서버 API 판이 생기면 같은 이름으로 하나 더 만들고 app.js 의 고르는 줄만 바꾼다.
   받는 deps: 없음.
   내보내는 것: catalogSrcReady(fn) · catalogSrcCan(op) · catalogSrcSubscribe(kind, cb) · catalogSrcMigrateGacha() · catalogSrcFetchGlb(url) · catalogSrcPublishPart(id, data).
     op · kind: items · desks · parts · customCats · catOverrides(구독) · migrateGacha · fetchGlb · publishPart.
   ★ 동작은 직접 부르던 때와 같다 — firebaseAPI 는 부를 때마다 읽는다(부팅 뒤에 생긴다). 없거나 그 함수가 없으면 catalogSrcCan 이 false.
   ★ 넘기는 함수는 스스로 catalogSrcCan 을 본다 — 연결 · 함수가 없거나 모르는 종류 · 빈 인자면 서버에 아무 요청도 안 하고 null(던지지 않음).
   ⚠️ 전역 이름은 TwCatalogSource — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-catalog-source.js */
(function(){

function createCatalogSource(deps){
/* 도메인 이름 → Firebase 판 함수 이름(firebase-init.js) */
const CATALOG_SRC_FB_OPS = {
  items: 'subscribeCatalogItems',
  desks: 'subscribeCatalogDesks',
  parts: 'subscribeCatalogParts',
  customCats: 'subscribeCustomCats',
  catOverrides: 'subscribeCatOverrides',
  migrateGacha: 'migrateGachaCatalog',
  fetchGlb: 'fetchCatalogGlb',
  publishPart: 'publishPart',
};
const CATALOG_SRC_SUB_KINDS = ['items', 'desks', 'parts', 'customCats', 'catOverrides'];
function _catalogSrcFb(){ return window.firebaseAPI; }
/* 연결이 이미 있으면 바로, 아니면 firebase-ready 를 한 번만 기다린다 */
function catalogSrcReady(fn){
  if(_catalogSrcFb()) fn();
  else window.addEventListener('firebase-ready', fn, { once:true });
}
function catalogSrcCan(op){
  const fb = _catalogSrcFb();
  return !!(fb && CATALOG_SRC_FB_OPS[op] && fb[CATALOG_SRC_FB_OPS[op]]);
}
/* 입구 가드 — 부르는 쪽이 catalogSrcCan 을 먼저 보던 전제를 여기로 옮긴다: 연결 · 함수가 없거나 모르는 일 · 빈 인자면 요청 없이 null */
function _catalogSrcCall(op, ...a){ return catalogSrcCan(op) ? _catalogSrcFb()[CATALOG_SRC_FB_OPS[op]](...a) : null; }
function catalogSrcSubscribe(kind, cb){
  if(!CATALOG_SRC_SUB_KINDS.includes(kind) || typeof cb !== 'function') return null;
  return _catalogSrcCall(kind, cb);
}
function catalogSrcMigrateGacha(){ return _catalogSrcCall('migrateGacha'); }
function catalogSrcFetchGlb(url){ return url ? _catalogSrcCall('fetchGlb', url) : null; }
function catalogSrcPublishPart(id, data){ return (id && data) ? _catalogSrcCall('publishPart', id, data) : null; }

return {
  catalogSrcReady,
  catalogSrcCan,
  catalogSrcSubscribe,
  catalogSrcMigrateGacha,
  catalogSrcFetchGlb,
  catalogSrcPublishPart,
};
}

const api = { createCatalogSource };
if(typeof window !== 'undefined') window.TwCatalogSource = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
