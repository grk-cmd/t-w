/* seat-label-drag.js — 🏷️ 이름표 · 경험치 바를 눌러 끌면 책상을 끌 때처럼 좌석 자리를 바꾼다.
   끌기 상태(drag) · 자리 계산 · 놓기는 app.js 캔버스 끌기 한 벌을 그대로 탄다 — 여기는 «끌기를 시작해도 되나» 판단과
   시작 부탁(beginDrag)만 한다. 같은 drag 상태라 클릭 통과 유지 · blur 안전망 · 맨 오른쪽 고정(seat-pin.js)도 같이 따라온다.
   ⚠️ 누르기만 하고 떼면 아무 일도 없다(쓰다듬기 아님) — app.js pointerup 의 targetType 'label' 갈래.
   deps: beginDrag(e, seat) → 시작했으면 true · flyAiming() · bonkAiming()
   검사: checks/sim-seat-label-drag.js */
(function(){
'use strict';

/* 끌기를 시작해도 되나 — 캔버스 pointerdown 이 막는 것과 같은 것을 막는다.
   ・조준 중(날리기 · 때리기)은 표적 고르기라 끌지 않는다.
   ・날아가는 중 · 남의 머리에 탄 중 · 벤치에 앉은 중은 group 이 제자리가 아니라 자리 계산이 어긋난다. */
function canStartLabelDrag(seat, aiming){
  if(!seat || !seat.group) return false;
  if(aiming) return false;
  if(seat.fly || seat.ridingOn || seat.seatedOn) return false;
  return true;
}

function createSeatLabelDrag(deps){
  const aiming = () => {
    try{ return !!(deps.flyAiming() || deps.bonkAiming()); }catch(_){ return false; }
  };
  /* 이름표 · 경험치 바의 pointerdown — 시작했으면 true(이벤트를 여기서 멈춘다) */
  function onLabelPointerDown(e, seat){
    if(!e || e.button !== 0) return false;
    if(!canStartLabelDrag(seat, aiming())) return false;
    if(!deps.beginDrag(e, seat)) return false;
    e.preventDefault();   // 이름 글자가 선택되지 않게
    e.stopPropagation();
    return true;
  }
  return { onLabelPointerDown };
}

const api = { createSeatLabelDrag, canStartLabelDrag };
if(typeof window !== 'undefined') window.TwSeatLabelDrag = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
