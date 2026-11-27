/* stroke-pointer.js — 🖊 끌어서 그리는 획의 «아직 누르고 있나» · «획이 끊겼다» 판정 한 곳
   책임: 그림판(사람 · 동물 만들기)이 획을 이어 갈지 끝낼지 정할 때 쓰는 두 판단. 그리지도 · 상태를 들지도 않는다.
   받는 deps: 없음(순수 함수 + 이벤트 걸기).
   내놓는 것: isDown(e) — 주 버튼(펜 끝 · 왼쪽 버튼)이 눌려 있나 · onLost(el, fn) — 획이 끊겼을 때(pointercancel · lostpointercapture) fn 을 부른다.
   ⚠️ 펜은 화면에서 떼고 떠 있기만 해도 pointermove 가 온다(buttons 0) — «그리는 중» 깃발만 보고 그리면 뗀 펜을 따라 선이 그어진다.
   ⚠️ 펜 끌기는 터치처럼 브라우저가 화면 밀기로 가져가며 pointercancel 을 낸다(pointerup 은 안 온다) — 그림판 캔버스는 CSS touch-action:none 을 같이 건다.
   ⚠️ lostpointercapture 는 정상 pointerup 뒤에도 온다 — fn 은 이미 끝난 획에 다시 불려도 되게 쓴다.
   classic script(window.TwStrokePointer) — 쓰는 모듈 · app.js 보다 먼저 싣는다. 검사: checks/sim-stroke-pointer.js */
(function(){
'use strict';

const PRIMARY = 1;   // PointerEvent.buttons 의 주 버튼 비트(왼쪽 버튼 · 펜 끝 닿음)

/** @param {{ buttons?: number }} e */
function isDown(e){ return !!e && ((e.buttons | 0) & PRIMARY) === PRIMARY; }

/** @param {{ addEventListener(type: string, fn: (e: unknown) => void): void }} el @param {(e: unknown) => void} fn */
function onLost(el, fn){
  el.addEventListener('pointercancel', fn);
  el.addEventListener('lostpointercapture', fn);
}

const api = Object.freeze({ isDown, onLost });
if(typeof window !== 'undefined') window.TwStrokePointer = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
