/* os-drag.js — 🪟 런처 화면에서 창 제목줄을 끌면 앱 창(OS 창)째 옮기기 (검사 sim-os-drag.js)
   [왜] 런처 화면은 앱 창이 런처 카드 크기라, 그 안에서 뜨는 창(마이홈 · 크리스마스)을 DOM 으로 끌면 앱 창 테두리 밖으로 못 나간다.
     런처가 켜져 있으면 앱 창 자체를 끈다 — 자리는 main 이 마우스 자리로 계산한다(win-drag.js · 배율이 다른 모니터 사이에서도).
     실행 화면(전체 화면 오버레이)에서는 화면 전체가 앱 창이라 DOM 끌기 그대로.
   받는 것: { doc, companion: () => window.companion }. 내보냄: window.TwOsDrag = { createOsDrag }.
   쓰는 모듈(myhome-ui.js · xmas-window.js — deps 로)보다 먼저 싣는 classic script. */
(function(){

/**
 * @param {{ doc: Document, companion: () => ({ dragWindow?: (phase: string) => void } | null | undefined) }} deps
 */
function createOsDrag(deps){
  const doc = deps.doc;
  let on = false;
  /** 이 끌기를 앱 창째로 할지 — 런처가 켜져 있고 main 끌기 통로가 있을 때. 고르면 바로 시작한다 */
  function begin(){
    const c = deps.companion();
    const launcher = doc.getElementById('launcher');
    on = !!(launcher && launcher.classList.contains('on') && c && c.dragWindow);
    if (on) c.dragWindow('start');
    return on;
  }
  function move(){ if (on) deps.companion().dragWindow('move'); }
  function end(){ if (!on) return; on = false; deps.companion().dragWindow('end'); }
  return { begin, move, end, active: () => on };
}

const api = Object.freeze({ createOsDrag });
if (typeof window !== 'undefined') window.TwOsDrag = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
