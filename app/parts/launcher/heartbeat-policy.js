/* heartbeat-policy.js — 렌더러 하트비트(setCharBounds, 100ms)에 무거운 칸을 실을지 판단하는 규칙 한 곳
   받는 deps: 없음 — 순수 함수다. DOM · IPC · 타이머는 부르는 쪽(app.js 하트비트)이 한다.
   내놓는 것: HIDDEN_FULL_EVERY_MS · fullStep
   ★ 하트비트 자체는 창이 안 보여도 늘 보낸다 — main 이 «렌더러가 살아 있다» 신호로 본다(click-through-policy.js stallStep).
     여기서 정하는 것은 무거운 칸(regions = 우리 창 사각형 · others = 남의 좌석 원)을 이번에 새로 잴지뿐이다.
   ★ 빼고 보내면 main 은 그 칸을 «안 왔다» 로 읽고 마지막 값을 그대로 둔다(main.js companion:setCharBounds).
   ⚠️ 창이 안 보이는지는 main 이 알려 준다(companion:winShown). backgroundThrottling:false 라 document.hidden 은 최소화에도 안 바뀐다. */
(function(){
'use strict';

/* 창이 안 보여도 이 간격마다 한 번은 다 잰다 — 복귀 신호를 놓치는 일이 있어도 main 의 칸이 이보다 오래 낡지 않게. */
const HIDDEN_FULL_EVERY_MS = 1000;

/* 이번 하트비트에 무거운 칸을 새로 잴까 — true 면 잰다.
   f: shown(main 이 알려 준 창 보임 — 아직 모르면 null/undefined) · sinceFull(마지막으로 다 잰 뒤 ms)
   ⚠️ 모르면 잰다 — «보임» 을 확인하지 못한 상태에서 빼면 클릭 통과 판정 재료가 낡는다. */
function fullStep(f){
  if(!f || f.shown !== false) return true;
  const since = Number(f.sinceFull);
  if(!Number.isFinite(since) || since < 0) return true;
  return since >= HIDDEN_FULL_EVERY_MS;
}

const api = { HIDDEN_FULL_EVERY_MS, fullStep };
if(typeof window !== 'undefined') window.TwHeartbeatPolicy = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
