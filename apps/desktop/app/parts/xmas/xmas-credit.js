/* xmas-credit.js — 🎄 음악 출처 올라가기(일회성 — 다음 업데이트에서 걷는다 · 이슈 #963) (검사 sim-xmas-credit.js)
   제목줄 [음악 출처] 를 누르면 출처 글이 트리 화면 아래에서 위로 한 번 올라가고 사라진다(영화 끝의 크레딧처럼). 올라가는 중에 다시 누르면 바로 걷는다.
   글은 textContent 로만 넣는다. 움직임은 CSS(.xm-roll.go · @keyframes xmCredit) — 여기서는 켜고 끄기만 한다.
   ⚠️ 글 상자는 pointer-events:none — 올라가는 동안에도 트리를 돌리고 장식을 누를 수 있어야 한다(html CSS).
   classic script(window.TwXmasCredit) — xmas-window.js 보다 먼저 싣는다. */
(function(){
'use strict';

/**
 * @param {{ doc: Document, box: HTMLElement, lines: ReadonlyArray<string> }} deps
 *   box — 트리 화면(#xmasStage) 안의 글 상자(#xmasCredit · 처음엔 hidden)
 */
function createXmasCredit(deps){
  const doc = deps.doc;
  const box = deps.box;
  const lines = deps.lines;
  let roll = null;

  function build(){
    if(roll) return roll;
    roll = doc.createElement('div');
    roll.className = 'xm-roll';
    lines.forEach((t, i) => {
      const row = doc.createElement('div');
      if(!t) row.className = 'xm-rgap';
      else { row.textContent = t; if(i === 0) row.className = 'xm-rhead'; }
      roll.appendChild(row);
    });
    roll.addEventListener('animationend', stop);
    box.appendChild(roll);
    return roll;
  }

  const showing = () => !box.hidden;
  function stop(){
    if(roll) roll.classList.remove('go');
    box.hidden = true;
  }
  function play(){
    const r = build();
    box.hidden = false;
    /* 글 전체가 화면 위로 다 빠져나가도록 — 올라갈 거리 = 글 높이 + 화면 높이 */
    r.style.setProperty('--xmStageH', box.clientHeight + 'px');
    r.classList.remove('go');
    void r.offsetWidth;   // 같은 클래스를 다시 붙여도 처음부터 돌게
    r.classList.add('go');
  }
  /** 보이는 중이면 걷고, 아니면 올린다 */
  function toggle(){ if(showing()) stop(); else play(); }

  return { toggle, stop, showing };
}

const api = Object.freeze({ createXmasCredit });
if(typeof window !== 'undefined') window.TwXmasCredit = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
