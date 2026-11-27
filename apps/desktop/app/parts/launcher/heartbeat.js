/* heartbeat.js — 🩺 0.1초 하트비트(렌더러 → main 「companion.setCharBounds」)
   app.js 에 있던 하트비트 덩이를 그대로 옮긴 모듈이다. 만들 때 한 번 돈다(창 보임 구독 · 100ms 타이머) — 옛 자리에서 부팅 때 한 번 돌던 것과 같다.
   ★ 본문은 app.js 에 있던 글 그대로다. 바뀐 줄은 넷 — _charBoundsLatest · _charBadWhy · _twMoveSeenAt 은 다른 곳이 다시 대입하는 값이라 이름() 으로 읽고,
     남의 좌석 원은 상태칩 모듈을 직접 부르지 않고 deps.otherSeatCircles 로 받는다.
   ★ 무거운 칸(regions · others)을 뺄지는 heartbeat-policy.js(TwHeartbeatPolicy) 가 정한다. 시간 재기 runCost 는 app.js 의 것(프레임 · 다른 모듈과 한 벌).
   ★ 밖에서 부르는 이름: 없음.
   검사: checks/sim-heartbeat.js · 동작은 checks/sim-heartbeat-policy.js 2절 */
(function(){

function createHeartbeat(deps){
const _charBadWhy = deps._charBadWhy;   // 읽는 함수
const _charBoundsLatest = deps._charBoundsLatest;   // 읽는 함수
const _twMoveSeenAt = deps._twMoveSeenAt;   // 읽는 함수
const otherSeatCircles = deps.otherSeatCircles;
const runCost = deps.runCost;   // 🩺 1분 [비용] 줄 — 하트비트 시간(shared/run-cost-diag.js)
/* 🪟 창이 보이는가(main 이 최소화 · 숨김 · 복귀 때 알려 준다 — 모르면 null) · 무거운 칸을 마지막으로 잰 시각.
   안 보이면 regions · others 를 잠깐 빼고 보낸다 — 판단은 heartbeat-policy.js fullStep. */
let _hbWinShown = null, _hbFullAt = 0;
try{
  if(window.companion) companion.onWinShown(v => { _hbWinShown = !!v; });
  setInterval(runCost.timed('hb', ()=>{
    try{
      if(!(window.companion && companion.setCharBounds)) return;
      const _now = Date.now();
      const _hbFull = TwHeartbeatPolicy.fullStep({ shown: _hbWinShown, sinceFull: _now - _hbFullAt });
      if(_hbFull) _hbFullAt = _now;
      /* ★ _charBoundsLatest 를 직접 건드리지 않고 매번 새 객체로 보낸다 — 그 값은 다음 주기에도
         재사용되므로 필드를 덧붙이면 안 된다. moveAge 는 "mousemove 가 마지막으로 온 지 몇 ms 됐나",
         한 번도 온 적 없으면 -1(=판단 불가, main 은 이때 아무것도 하지 않는다). */
      const _b = _charBoundsLatest() || { x:-99999, y:-99999, r:0 };
      /* 📐 우리 창들의 사각형도 같이 보낸다 — main 의 회수 판정이 캐릭터 하나만 알아서
         대화창 위에서 렌더러와 싸우던 문제(핸드오프5 §1-4). __uiRegions 는 클릭통과 블록이
         정의하는데, 그 블록은 companion 이 없으면 아예 안 돈다 — 그래서 존재 확인이 필요하다. */
      companion.setCharBounds({ x:_b.x, y:_b.y, r:_b.r,
        moveAge: _twMoveSeenAt() ? (Date.now() - _twMoveSeenAt()) : -1,
        regions: (_hbFull && window.__uiRegions) ? window.__uiRegions() : undefined,
        others: _hbFull ? otherSeatCircles() : undefined,   // 🖊️ 남의 좌석 원 — main 펜 근접 판단만 본다
        /* 🧭 좌표를 못 믿는 구간이면 그 이유를 실어 보낸다 — main 이 구간 시작·끝만 기록한다.
           구버전 main 은 이 필드를 그냥 무시한다(동작 변화 없음). */
        charBad: _charBadWhy() || undefined });
    }catch(_){}
  }), 100);
}catch(_){}

return {

};
}

const api = { createHeartbeat };
if(typeof window !== 'undefined') window.TwHeartbeat = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
