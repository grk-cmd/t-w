/* win-drag.js — 🖱 창 끌기(수동) — 끄는 동안 창 자리를 main 이 마우스 자리로 정한다
   ・내놓는 것: createWinDrag({ getCursor, getBounds, setBounds, onMove, onEnd }) → { start(), move(), end(), cancel(), active() }.
   [왜] 예전엔 렌더러가 «앞 프레임에서 움직인 만큼(dx, dy)» 을 보내고 main 이 지금 창 사각형에 더했다.
     ・배율이 다른 모니터 사이에서는 렌더러의 화면 좌표(screenX)가 창이 놓인 모니터의 배율을 따라 바뀌어, 창이 움직이면 다음 값이 흔들린다(떨림).
     ・지금 창 크기(getBounds)를 매번 다시 넣어, OS 가 배율 경계에서 반올림한 크기가 그대로 쌓였다(크기가 변함).
     그래서 끌기 시작 때의 마우스 · 창 사각형을 기억하고, 자리는 «시작 창 자리 + (지금 마우스 − 시작 마우스)», 크기는 시작 크기로 고정한다.
   ⚠️ 끄는 동안 창 사각형의 주인은 이 모듈이다 — main 의 다른 길(setConfigMode)은 active() 면 창을 건드리지 않고, 끝난 뒤 onEnd 에서 한 번 맞춘다.
   검사: checks/sim-win-drag.js */
'use strict';

/** @param {{
 *    getCursor: () => { x: number, y: number },
 *    getBounds: () => { x: number, y: number, width: number, height: number },
 *    setBounds: (r: { x: number, y: number, width: number, height: number }) => void,
 *    onMove: (r: { x: number, y: number, width: number, height: number }) => void,
 *    onEnd: (r: { x: number, y: number, width: number, height: number }) => void,
 *  }} deps */
function createWinDrag(deps){
  const getCursor = deps.getCursor;
  const getBounds = deps.getBounds;
  const setBounds = deps.setBounds;
  const onMove = deps.onMove;
  const onEnd = deps.onEnd;

  let from = null;   // 끌기 시작 때 — { cx, cy, rect } · null = 끌고 있지 않음
  let last = null;   // 이 끌기에서 마지막으로 놓은 사각형 · null = 아직 안 움직임

  function start(){
    if(from) close();   // 끝 신호를 못 받은 앞 끌기 — 지금 마우스 자리로 옮기지 않고(창이 튄다) 닫기만 한다
    const c = getCursor(), r = getBounds();
    from = { cx: c.x, cy: c.y, rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
    last = null;
  }

  function move(){
    if(!from) return;
    const c = getCursor();
    const rect = { x: from.rect.x + (c.x - from.cx), y: from.rect.y + (c.y - from.cy), width: from.rect.width, height: from.rect.height };
    const prev = last || from.rect;
    if(rect.x === prev.x && rect.y === prev.y) return;
    setBounds(rect);
    last = rect;
    onMove(rect);
  }

  function close(){
    const moved = last;
    from = null; last = null;
    if(moved) onEnd(moved);   // 누르기만 하고 안 움직였으면 맞출 것이 없다
  }

  function end(){
    if(!from) return;
    move();
    close();
  }

  /* 창이 사라졌다 — 창을 건드리지 않고 끌기만 놓는다(안 놓으면 active() 가 남아 setConfigMode 가 계속 건너뛴다) */
  function cancel(){ from = null; last = null; }

  return { start, move, end, cancel, active: () => !!from };
}

module.exports = { createWinDrag };
