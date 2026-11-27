/* panel-fit.js — 📐 끌어 옮기는 창을 화면 안으로 맞추기 (검사 sim-panel-fit.js)
   [왜] 화면 밖으로 나간 창은 제목줄이 잘려 끌 수도 닫을 수도 없다(앱 안 화면이라 ALT+SPACE 도 안 먹는다).
     머리 위 자동 배치 · 끌어 옮기기 · 크기 바뀜이 같은 규칙을 쓴다.
   받는 것 없음(순수 함수 · DOM 없음). 내보냄: window.TwPanelFit = { fitTopCenter(위 가운데 기준 — ⚙ 설정창), fitTopLeft(왼쪽 위 기준 — 크리스마스 창) }.
   쓰는 모듈(status-chip.js · settings-panel.js — fitTopCenter · xmas-window.js — fitTopLeft 를 deps 로)보다 먼저 싣는 classic script. */
(function(){

/* (x, y) = 창의 위 가운데(transform: translate(-50%,0)). 창 크기 w×h · 화면 vw×vh · 가장자리 여유 edge 로 창 전체가 화면 안에 들도록 옮긴 기준점.
   위가 고정이라 탭이 길어지면 아래로 자란다 — 아래가 화면 밖이면 그만큼만 올린다. 창이 화면보다 크면 위(제목줄)를 살린다(아래는 창 안 스크롤). */
function fitTopCenter(x, y, w, h, vw, vh, edge){
  const e = edge || 0;
  const minX = w / 2 + e, maxX = vw - w / 2 - e;
  const fx = maxX < minX ? vw / 2 : Math.max(minX, Math.min(maxX, x));
  const fy = Math.max(e, Math.min(vh - h - e, y));   // max 가 나중 — 창이 더 크면 위가 이긴다
  return { x: fx, y: fy };
}

/* (x, y) = 창의 왼쪽 위. 창 전체가 화면 안에 들도록 옮긴 자리 — 창이 화면보다 크면 왼쪽 위(제목줄)가 보이는 쪽(0 · edge)을 고른다.
   끌어 옮기는 창(크리스마스 창)이 화면 밖으로 나가 아래가 잘리지 않게 */
function fitTopLeft(x, y, w, h, vw, vh, edge){
  const e = edge || 0;
  const maxX = vw - w - e, maxY = vh - h - e;
  return { x: Math.max(e, Math.min(maxX, x)), y: Math.max(e, Math.min(maxY, y)) };   // max 가 나중 — 창이 더 크면 왼쪽 위가 이긴다
}

const api = Object.freeze({ fitTopCenter, fitTopLeft });
if(typeof window !== 'undefined') window.TwPanelFit = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
