/* seat-eq-clamp.js — 🪑 평준화 가두기 — 좌석 크기 평준화 중 «책상 위» 파츠를 자기 자리 안으로
   책임: 평준화가 켜졌을 때 좌석마다 «책상 위» 파츠 핀의 파츠를 옆 좌석으로 넘어가지 않게 자기 자리 반폭 안으로 미는 주기 작업 하나(_clampSeatDeskParts) — 500ms 마다 · 꺼지면 되돌림. 계산은 seat-slot.js(seatSlot.clampParts).
   받는 deps: seats · 좌석 간격(SPACING · MULTIPLAYER_SPACING, 읽는 함수) · seatEqMod(평준화 깃발) · seatDeskHalfWidth · seatSlot(가두기 계산 — app.js 가 만든다, 읽는 함수) · DESK_PART_ANCHOR_NAME(파츠 핀 이름).
   내보내는 것: _clampSeatDeskParts(now).
   app.js «📌 책상 위 파츠 앵커 · 책상 위치 · 배율» 구역 안의 평준화 가두기 몫을 그대로 옮겼다(desk-place 가 seat-equalize 를 모르게 — 순환 끊기 · wAC). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 3줄 —
     MULTIPLAYER_SPACING · SPACING · seatSlot 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 1개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _clampSeatDeskParts — app.js 는 seatEqClampMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwSeatEqClamp — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-seat-eq-clamp.js */
(function(){

function createSeatEqClamp(deps){
const DESK_PART_ANCHOR_NAME = deps.DESK_PART_ANCHOR_NAME;
const MULTIPLAYER_SPACING = deps.MULTIPLAYER_SPACING;   // 읽는 함수
const SPACING = deps.SPACING;   // 읽는 함수
const seatDeskHalfWidth = deps.seatDeskHalfWidth;
const seatEqMod = deps.seatEqMod;
const seatSlot = deps.seatSlot;   // 읽는 함수
const seats = deps.seats;
/* 🪑 좌석 크기 평준화를 켜면 «책상 위» 파츠가 옆 좌석으로 넘어가지 않게 자기 자리 안으로 민다(seat-slot.js 머리말).
   자리 = 책상이 뻗은 거리(seatDeskHalfWidth) + 좌석 사이 여백(layoutSeats 와 같은 값)의 절반.
   책상 · 파츠 박스를 재야 해서 매 프레임이 아니라 SEAT_SLOT_EVERY_MS 마다 — 평준화를 끄면 다음 차례에 되돌아간다. */
const SEAT_SLOT_EVERY_MS = 500;
let _seatSlotNext = 0;
function _clampSeatDeskParts(now){
  if(!seatSlot()) return;
  const t = (now != null) ? now : performance.now();
  if(t < _seatSlotNext) return;
  _seatSlotNext = t + SEAT_SLOT_EVERY_MS;
  const gap = seats.some(s=>s.remote) ? MULTIPLAYER_SPACING() : SPACING();
  seats.forEach(s=>{
    try{
      const pin = s.deskAnchor && s.deskAnchor.getObjectByName && s.deskAnchor.getObjectByName(DESK_PART_ANCHOR_NAME);
      if(!pin) return;
      const parts = pin.children.filter(o=>o.userData && o.userData.__twPartWrap);
      if(!parts.length) return;
      // 올라탄 좌석은 책상이 숨고 자리도 안 차지한다(layoutSeats) — 가두지 않는다
      const on = !!(seatEqMod.seatEqualizeOn() && !s.ridingOn && s.desk && s.desk.visible !== false);
      const half = on ? seatDeskHalfWidth(s) + gap / 2 : 0;
      seatSlot().clampParts(parts, s.group ? s.group.position.x : 0, half, on);
    }catch(e){ console.warn('[좌석 자리] 파츠 가두기 실패', e); }
  });
}

return {
  _clampSeatDeskParts,
};
}

const api = { createSeatEqClamp };
if(typeof window !== 'undefined') window.TwSeatEqClamp = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
