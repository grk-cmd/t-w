/* drag-scroll.js — 🖱 목록을 마우스로 끌어 위아래로 움직이기(스크롤바를 숨긴 목록용 — 휠은 브라우저가 그대로 한다)
   ・내놓는 것: attachDragScroll(el, opts) — 한 요소에 한 번만 건다 · opts.skip(선택자 — 여기서 누르면 끌기를 시작하지 않는다 · 글자 고르기 · 링크) · DRAG_PX
   ⚠️ DRAG_PX 보다 적게 움직이면 끌기가 아니라 누르기다 — 항목 열기(click)를 그대로 둔다. 끈 뒤 손을 뗄 때 나는 click 은 막는다(끌다가 엉뚱한 글이 열리지 않게).
   ⚠️ 왼쪽 버튼만 — 우클릭 메뉴는 건드리지 않는다. 순수 DOM 도우미라 도메인을 모른다(shared).
   검사: checks/sim-drag-scroll.js */
(function(){

const DRAG_PX = 5;

function attachDragScroll(el, opts){
  if(!el || el._dragScroll) return;
  el._dragScroll = true;
  const skip = (opts && opts.skip) || '';
  let start = null, moved = false;
  el.addEventListener('pointerdown', e=>{
    if(e.button !== 0) return;
    moved = false;
    if(skip && e.target.closest(skip)){ start = null; return; }   // 본문 글자 고르기 · 링크 끌어 놓기는 브라우저 몫
    start = { y: e.clientY, top: el.scrollTop, id: e.pointerId };
  });
  el.addEventListener('pointermove', e=>{
    if(!start) return;
    if(!(e.buttons & 1)){ end(); return; }   // 문턱 안에서 목록 밖으로 나가 떼면 pointerup 이 안 온다 — 버튼 없는 움직임은 따라가지 않는다
    const dy = e.clientY - start.y;
    if(!moved){
      if(Math.abs(dy) < DRAG_PX) return;
      moved = true;
      el.classList.add('dragging');
      try{ el.setPointerCapture(start.id); }catch(_){}
    }
    el.scrollTop = start.top - dy;
  });
  const end = ()=>{
    if(!start) return;
    start = null;
    el.classList.remove('dragging');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('click', e=>{
    if(!moved) return;
    moved = false;
    e.preventDefault(); e.stopPropagation();
  }, true);
}

const api = { attachDragScroll, DRAG_PX };
if(typeof window !== 'undefined') window.TwDragScroll = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
