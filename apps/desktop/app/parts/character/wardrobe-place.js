/* wardrobe-place.js — 🎨 꾸미기 창 · 👀 미리보기 창의 자리 규칙(순수 함수 · DOM · 저장 없음)
   두 창은 한 몸이다 — 미리보기는 늘 꾸미기 창 왼쪽에 붙고, 자리 기억은 꾸미기 창 왼쪽 위 하나뿐이다.
   처음(기억 없음)에는 두 창을 묶어 화면 가운데에 둔다. 화면이 좁아 둘이 다 안 들어가면 꾸미기 창을 먼저 살리고
   미리보기는 화면 안으로만 당긴다(겹쳐도 둘 다 보이게).
   검사: checks/sim-wardrobe-place.js */
(function(){

const GAP = 8;      // 두 창 사이
const MARGIN = 8;   // 화면 가장자리

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 저장된 자리로 쓸 수 있는 값인가 — {x, y} 둘 다 유한한 수 */
function isPos(s){ return !!s && Number.isFinite(s.x) && Number.isFinite(s.y); }

/**
 * 두 창 자리.
 * @param {{vw:number, vh:number, panel:{w:number,h:number}, preview:{w:number,h:number}, saved?:{x:number,y:number}|null}} o
 * @returns {{panel:{x:number,y:number}, preview:{x:number,y:number}}}
 */
function placeGroup(o){
  const pw = o.panel.w, ph = o.panel.h, vw = o.preview.w, vh2 = o.preview.h;
  const total = vw + GAP + pw;
  const tallest = Math.max(ph, vh2);
  let x, y;
  if(isPos(o.saved)){ x = o.saved.x; y = o.saved.y; }
  else { x = (o.vw - total) / 2 + vw + GAP; y = (o.vh - tallest) / 2; }
  /* 둘이 다 들어가면 묶음째 화면 안으로 · 아니면 꾸미기 창만 화면 안으로 */
  const minX = (o.vw >= total + MARGIN * 2) ? MARGIN + vw + GAP : MARGIN;
  x = clamp(x, minX, Math.max(minX, o.vw - pw - MARGIN));
  y = clamp(y, MARGIN, Math.max(MARGIN, o.vh - tallest - MARGIN));
  const px = Math.max(MARGIN, x - GAP - vw);
  return { panel: { x: Math.round(x), y: Math.round(y) }, preview: { x: Math.round(px), y: Math.round(y) } };
}

const api = { GAP, MARGIN, isPos, placeGroup };
if(typeof window !== 'undefined') window.TwWardrobePlace = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
