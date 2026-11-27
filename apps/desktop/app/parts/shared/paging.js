/* paging.js — 📄 쪽 나누기 규칙 한 벌(순수 함수 · DOM · 저장 없음 · 도메인을 모른다)
   꾸미기 창 파츠 칸(character/wardrobe-paging.js)과 도감(character/gacha-album.js)이 같이 쓴다 — 쪽 수 · 쪽 번호 바로잡기를 다시 쓰지 않는다.
   쪽 번호는 0 부터 — 화면에 쓰는 번호만 +1 한다.
   검사: checks/sim-paging.js */
(function(){

/** 쪽 수 — 칸이 없어도 1(음수 · 이상한 칸 수도 1) */
function pageCount(n, size){ return Math.max(1, Math.ceil((n | 0) / size)); }

/** 기억한 쪽을 지금 칸 수에 맞춘다 — 없는 쪽이면 마지막 · 이상한 값(NaN · undefined · 무한)이면 0 · 소수는 내림 · 음수는 0 */
function clampPage(page, n, size){
  const p = Number.isFinite(page) ? Math.floor(page) : 0;
  return Math.min(pageCount(n, size) - 1, Math.max(0, p));
}

const api = { pageCount, clampPage };
if(typeof window !== 'undefined') window.TwPaging = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
