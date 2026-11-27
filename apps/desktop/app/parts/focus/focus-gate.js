/* focus-gate.js — 😴 포커싱 어플 게이트: 앞 창이 바뀔 때 «잠듦 게이트» 를 어떻게 둘지 · 게이트가 닫혔을 때 자세 (검사 sim-focus-gate.js)
   [왜] «투게더워킹 창이 앞이면 안 잠듦» 을 활성 창 처리(app.js _applyActiveAppState)와 자세 판정(app.js seatState)이 같이 쓴다.
        한쪽만 고치면 서로 어긋나서 여기 한 곳에 둔다.
   ★ 투게더워킹 창이 앞이면 게이트를 직전 값 그대로 둔다 — 포커싱 어플에서 넘어오면 깨어 있고, 다른 앱에서 넘어오면 닫힌 채.
     자기를 포커싱 어플로 등록했으면(mac 옛 키) «등록 앱» 으로 보고 예전대로 연다(잠든 모습으로 시간이 쌓이지 않게).
   ★ 게이트가 닫혀 있어도 투게더워킹 창이 앞이면 바로 재우지 않는다 — 손을 뗀 지 sleepMs 가 넘어야 잔다.
   ★ 피규어 모드 · 폰 켜짐은 투게더워킹 창이 앞이어도 게이트를 연다.
   ★ 순수 함수만 — DOM · localStorage 를 모르고 받은 값을 고치지 않는다.
   받는 것 없음(실릴 때 바로 만든다). 내보냄: window.TwFocusGate = { selfFront, nextGateSleep, gatedPose }.
   app.js 보다 먼저 싣는 classic script. */
(function(){

/* 투게더워킹 창이 맨 앞인가(main.js activeAppState.isSelf). 옛 main 은 isSelf 를 안 보낸다 — 그때는 아니다. */
function selfFront(state){
  return !!state && state.isSelf === true && !state.isFocusedAppRegistered;
}

/* 다음 게이트 값 — true 면 잠듦 · null 이면 직전 값을 둔다. o = { figureMode, mobOn } */
function nextGateSleep(state, o){
  if(o.figureMode || o.mobOn) return false;
  if(selfFront(state)) return null;
  return state.hasAnyRegistered ? !state.isFocusedAppRegistered : true;
}

/* 게이트가 닫힌 데스크톱 모드의 자세 — idleMs 는 마지막 입력(어느 입력이든)부터 지난 시간 */
function gatedPose(isSelfFront, idleMs, sleepMs){
  return (isSelfFront && idleMs <= sleepMs) ? 'idle' : 'sleep';
}

const api = Object.freeze({ selfFront, nextGateSleep, gatedPose });
if(typeof window !== 'undefined') window.TwFocusGate = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
