/* ride-chain.js — 🗼 올라타기 탑 사슬 — 좌석이 속한 탑의 바닥 좌석 찾기
   책임: seat.ridingOn 사슬만 보고 답하는 순수 계산(DOM · 3D · 서버 없음).
     올라타기(ride-bench.js)와 좌석 줄 배치(seat-layout.js)가 같이 쓴다 — 둘이 서로를 부르면 모듈 순환이 생겨 아래층에 따로 둔다.
   받는 deps: 없음. 내보내는 것: _rideBottom(seat).
   ★ 아래 본문은 ride-bench.js 에 있던 글 그대로다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ⚠️ 전역 이름은 TwRideChain — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-ride-chain.js */
(function(){

function createRideChain(deps){
/* 🐾 이 좌석이 속한 탑의 '바닥' 좌석 — 아무 데도 안 타고 있는 맨 아래.
   올라타 있지 않으면 자기 자신이다. 순환 방어로 순회 상한(_rideDepth와 같은 16)을 둔다. */
function _rideBottom(seat){
  let s = seat, guard = 0;
  while(s && s.ridingOn && guard++ < 16) s = s.ridingOn;
  return s || seat;
}

return {
  _rideBottom,
};
}

const api = { createRideChain };
if(typeof window !== 'undefined') window.TwRideChain = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
