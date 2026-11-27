/* idle-gate.js — 😴 할 일이 없는 동안 반복(rAF · 짧은 타이머)을 재우고, 일이 생기면 다음 틱에 다시 거는 한 벌
   받는 deps: 없음 — 부르는 쪽이 «돌 때인가»(isOn · idle) · 할 일(frame · step) · 타이머 함수를 넘긴다.
   내놓는 것: rafWhile · intervalWhile · onClassChange
   ★ 재우는 조건은 «돌아도 결과가 화면 · 저장 · 서버에 닿지 않는 동안» 뿐이다. 깨우는 신호를 놓치면 그 반복이 영영 서므로,
     깨우기는 여는 함수마다 부르지 않고 그 상태를 바꾸는 길을 한 번에 잡는 것(클래스 변화 감시)에 건다.
   검사: checks/sim-idle-gate.js */
(function(){
'use strict';

/* rAF 반복 — isOn() 인 동안만 돈다. 꺼진 것을 본 틱에서 sleep(now) 를 한 번 부르고 rAF 를 더 걸지 않는다.
   o: isOn() · frame(now) · sleep(now) · raf(fn)
   wake() 는 다음 rAF 에 다시 건다 — 이미 돌고 있거나 꺼져 있으면 아무것도 안 한다(두 벌이 돌지 않게). */
function rafWhile(o){
  let on = false;
  function tick(now){
    if(!o.isOn()){ on = false; o.sleep(now); return; }
    o.frame(now);
    o.raf(tick);
  }
  function wake(){
    if(on || !o.isOn()) return;
    on = true;
    o.raf(tick);
  }
  return { wake, running: () => on };
}

/* 짧은 주기 타이머 — idle() 이 참인 틱에서 타이머를 지운다. 아니면 step().
   o: idle() · step() · ms · setInterval · clearInterval
   wake() 는 자고 있을 때만 타이머를 새로 건다(이미 돌면 그대로) — 깨웠는지를 돌려준다. */
function intervalWhile(o){
  let id = null;
  function run(){
    if(o.idle()){ o.clearInterval(id); id = null; return; }
    o.step();
  }
  function wake(){
    if(id !== null) return false;
    id = o.setInterval(run, o.ms);
    return true;
  }
  return { wake, running: () => id !== null };
}

/* el 의 class 가 바뀔 때마다 fn() — 창을 여닫는 길이 여럿이어도(.on · .hidden) 한 곳에서 잡는다.
   MO 는 검사용(없으면 window.MutationObserver). el 이 없으면 아무것도 걸지 않고 null. */
function onClassChange(el, fn, MO){
  const M = MO || window.MutationObserver;
  if(!el) return null;
  const ob = new M(() => fn());
  ob.observe(el, { attributes: true, attributeFilter: ['class'] });
  return ob;
}

const api = { rafWhile, intervalWhile, onClassChange };
if(typeof window !== 'undefined') window.TwIdleGate = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
