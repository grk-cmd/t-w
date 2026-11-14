/* reload-reset.js — 🪟 메인 창 화면을 다시 불러오기 전에 창을 런처 크기로 되돌리는 판단 한 곳 (검사 sim-renderer-gone-reset.js)
   [왜] 화면을 다시 불러오면 런처부터 뜨는데 창은 실행 화면(모니터 전체 · 클릭 통과 · 맨 위)으로 남아, 런처 바탕이 모니터를 덮은 채
     아무것도 못 누르고 강제 종료해야 했다. 렌더러 사망 길만 되돌리고 있었고, 화면이 스스로 다시 불러온 길(WebGL 복구 등)은 빠져 있었다(B-1114-5).
   ★ main 은 «메인 프레임이 다른 문서로 실제로 넘어갔다»(did-navigate)를 보고 되돌린다. 시작만 알리는 did-start-navigation 은
     main 이 막는 이동(바깥 링크 · file:// 밖)에도 와서, 화면은 그대로인데 실행 화면이 런처 크기로 끼어 버린다 — 쓰지 말 것.
   ★ 렌더러 사망 길은 다시 불러오지 않을 때도 덮인 채 두지 않으려고 먼저 부르므로, 한 번 로드되는 사이에는 한 번만 되돌린다.
   ★ 순수 판단만 — 창 · 로그는 deps.reset 이 한다. main.js 가 require 한다(설치본은 app/** 로 들어간다).
   deps: reset() — 창을 런처로(main.js _resetWindowForReload) */
'use strict';

function createReloadReset(deps){
  let loadedOnce = false;     // 처음 로드(창이 이미 런처 크기)의 did-navigate 는 넘긴다
  let resetSinceLoad = false; // 이번 로드 사이에 이미 되돌렸다

  /* 메인 창 화면 로드가 끝났다(did-finish-load) */
  function onFinishLoad(){ loadedOnce = true; resetSinceLoad = false; }

  /* 다시 불러오기 직전 — 이번 로드 사이 처음일 때만 되돌린다. 되돌렸으면 true */
  function beforeReload(){
    if(resetSinceLoad) return false;
    resetSinceLoad = true;
    deps.reset();
    return true;
  }

  /* 메인 프레임이 다른 문서로 넘어갔다(did-navigate — 다시 불러오기에도 온다 · 해시 이동 · 막힌 이동에는 안 온다) */
  function onNavigate(){
    if(!loadedOnce) return false;
    return beforeReload();
  }

  return { onFinishLoad, beforeReload, onNavigate };
}

module.exports = { createReloadReset };
