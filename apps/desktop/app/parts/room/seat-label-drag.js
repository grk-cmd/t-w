/* seat-label-drag.js — 🏷️ 이름표 · 경험치 바를 눌러 끌면 책상을 끌 때처럼 좌석 자리를 바꾼다.
   끌기 상태(drag) · 자리 계산 · 놓기는 app.js 캔버스 끌기 한 벌을 그대로 탄다 — 여기는 «끌기를 시작해도 되나» 판단과
   시작 부탁(beginDrag)만 한다. 같은 drag 상태라 클릭 통과 유지 · blur 안전망 · 맨 오른쪽 고정(seat-pin.js)도 같이 따라온다.
   ⚠️ 누르기만 하고 떼면 아무 일도 없다(쓰다듬기 아님) — app.js pointerup 의 targetType 'label' 갈래.
   deps: beginDrag(e, seat) → 시작했으면 true · flyAiming() · bonkAiming()
   내놓음: createSeatLabelDrag · canStartLabelDrag · canGrabSeat(캔버스 pointerdown 도 부른다)
   검사: checks/sim-seat-label-drag.js */
(function(){
'use strict';

/* 좌석을 잡아도 되나 — 캔버스(캐릭터 · 책상)와 이름표 끌기가 같이 쓰는 한 줄.
   ⚠️ 날아가는 중에 잡으면 흔들기 · 비행이 같은 좌표를 서로 덮어써 떨리고, 슬롯을 옮기면 돌아올 자리가 바뀐다. */
function canGrabSeat(seat){ return !!seat && !seat.fly; }

/* 이름표 · 경험치 바 끌기를 시작해도 되나 — canGrabSeat 위에 이름표만의 조건.
   ・조준 중(날리기 · 때리기): 캔버스는 표적 고르기로 받지만 이름표는 아무것도 안 한다.
   ・남의 머리에 탄 중 · 벤치에 앉은 중: 캔버스는 캐릭터를 잡으면 내려 주지만, 이름표는 group 이 제자리가 아니라 자리 계산이 어긋나 막는다. */
function canStartLabelDrag(seat, aiming){
  if(!canGrabSeat(seat) || !seat.group) return false;
  if(aiming) return false;
  if(seat.ridingOn || seat.seatedOn) return false;
  return true;
}

function createSeatLabelDrag(deps){
  const flyAiming = deps.flyAiming;
  const bonkAiming = deps.bonkAiming;
  const beginDrag = deps.beginDrag;
  const aiming = () => !!(flyAiming() || bonkAiming());
  /* 이름표 · 경험치 바의 pointerdown — 시작했으면 true(이벤트를 여기서 멈춘다) */
  function onLabelPointerDown(e, seat){
    if(!e || e.button !== 0) return false;
    if(!canStartLabelDrag(seat, aiming())) return false;
    if(!beginDrag(e, seat)) return false;
    e.preventDefault();   // 이름 글자가 선택되지 않게
    e.stopPropagation();
    return true;
  }
  return { onLabelPointerDown };
}

const api = { createSeatLabelDrag, canStartLabelDrag, canGrabSeat };
if(typeof window !== 'undefined') window.TwSeatLabelDrag = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
