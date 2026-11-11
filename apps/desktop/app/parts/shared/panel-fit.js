/* panel-fit.js — 📐 아래 가운데를 기준점으로 붙는 창(transform: translate(-50%,-100%))을 화면 안으로 맞추기 (검사 sim-panel-fit.js)
   [왜] ⚙ 설정창은 기준점이 창의 아래 가운데라, 내용이 긴 탭에서 창이 위로 자란다. 화면 안으로 묶지 않으면 제목줄이 화면 위로
     나가 끌 수도 닫을 수도 없다(앱 안 화면이라 ALT+SPACE 도 안 먹는다). 머리 위 자동 배치 · 끌어 옮기기 · 크기 바뀜이 같은 규칙을 쓴다.
   받는 것 없음(순수 함수 · DOM 없음). 내보냄: window.TwPanelFit = { fitBottomCenter }.
   쓰는 모듈(status-chip.js · settings-panel.js)보다 먼저 싣는 classic script. */
(function(){

/* (x, y) = 창의 아래 가운데. 창 크기 w×h · 화면 vw×vh · 가장자리 여유 edge 로 창 전체가 화면 안에 들도록 옮긴 기준점.
   창이 화면보다 크면 위(제목줄)가 보이는 쪽을 고른다 — 아래가 잘려도 창 안에서 스크롤되지만 제목줄이 잘리면 끌 수 없다. */
function fitBottomCenter(x, y, w, h, vw, vh, edge){
  const e = edge || 0;
  const minX = w / 2 + e, maxX = vw - w / 2 - e;
  const fx = maxX < minX ? vw / 2 : Math.max(minX, Math.min(maxX, x));
  const minY = h + e, maxY = vh - e;
  const fy = Math.max(minY, maxY < minY ? minY : Math.min(maxY, y));
  return { x: fx, y: fy };
}

const api = Object.freeze({ fitBottomCenter });
if(typeof window !== 'undefined') window.TwPanelFit = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
