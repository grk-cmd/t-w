/* user-local.js — 🗂️ 이 계정이 이 PC 에서 고른 것을 계정 칸에서 읽어 채우는 한 칸 (검사 sim-user-local.js)
   [왜] 모듈이 «만들 때» 계정 값을 PC 칸에서 읽으면 로그인 전에 앞 사람 값이 메모리에 올라온다. 계정 칸은 확인 전엔 닫혀 있어(읽기 null) 만들 때 읽을 수 없다.
     그래서 모듈은 처음엔 빈 값(기본값)으로 만들고, 여기 `start` 가 계정 칸이 열린 뒤(app-boot STEPS 맨 앞 `userLocal`) 각 모듈의 `load` 를 불러 채운다.
     세션이 끝나면(`session.onReset`) 각 모듈의 `reset` 이 빈 값으로 되돌린다 — 다음 로그인 때 앞 사람 값이 남지 않는다.
   [조각] `parts` 는 { name, load, reset } 의 목록이다. load 는 계정 칸에서 읽어 메모리에 앉히고 화면을 다시 그리는 일까지, reset 은 처음 값으로 되돌리는 일이다.
     한 조각이 던져도 다음 조각은 돈다(콘솔 경고). 조각을 더하는 곳은 app.js 한 곳.
   classic script — window.TwUserLocal. app.js 보다 먼저 싣는다. */
(function(){
'use strict';

/** @param {{ parts: Array<{ name: string, load: () => void, reset: () => void }> }} deps */
function createUserLocal(deps){
  const parts = deps.parts;
  for(const p of parts){
    if(!p || !p.name || !(p.load instanceof Function) || !(p.reset instanceof Function)) throw new Error('[user-local] 조각은 { name, load, reset } 이어야 해요');
  }
  const names = parts.map(p => p.name);
  if(new Set(names).size !== names.length) throw new Error('[user-local] 같은 이름의 조각이 둘이에요');
  function run(p, what){
    try{ p[what](); }catch(e){ console.warn('[user-local] ' + p.name + ' ' + what + ' 실패', e); }
  }
  /** 계정 칸이 열린 뒤 한 번 — 조각마다 읽어 채우고, 세션이 끝나면 되돌리는 일을 세션에 맡긴다. */
  function start(session){
    for(const p of parts) run(p, 'load');
    session.onReset(() => { for(const p of parts.slice().reverse()) run(p, 'reset'); });
  }
  return { start, names };
}

window.TwUserLocal = { createUserLocal };
})();
