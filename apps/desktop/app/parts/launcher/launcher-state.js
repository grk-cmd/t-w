/* launcher-state.js — 🧭 런처 공용 상태: 앱 모드(run · editseat) · 마이홈이 런처 위에 열려 있나 (검사 sim-launcher-state.js)
   달성표(chal-store · weekly-challenge) · 창 모드(window-mode) · 마이홈 창 · 페이지 · 구경 · 시작 · 친구 관리가 읽는 값이라 맨 아래 이 파일에 둔다.
   바꾸는 쪽(app-mode.js · window-mode.js)에 두면 읽는 모듈이 모두 그 모듈을 바라보게 되고, 그 모듈도 읽는 모듈을 부르므로 순환이 된다(checks/sim-dep-cycles.js).
   ★ 바꾸는 곳: 앱 모드는 app-mode.js(launchApp · backToLauncher) 하나, 마이홈 열림은 마이홈 창(myhome-ui.js) · 친구 홈 구경(myhome-visit.js) · 런처 복귀(app-mode.js).
   app.js · 읽는 모듈보다 먼저 싣는 classic script — app.js 는 맨 앞(SETUP)에서 만든다(읽는 모듈을 만드는 줄보다 먼저 있게). */
(function(){

/** @typedef {'run'|'editseat'} AppMode */

/** 앱 모드 · 마이홈 열림 한 벌. 받는 것이 없다 — 처음 값만 여기 한 곳. */
function createLauncherState(){
/** @type {AppMode} */
let appMode = 'run';
let myHomeOpen = false;   // 마이홈 팝업이 «런처에서» 열려 있나 — 이때만 창을 마이홈 크기로 키운다(window-mode.js)

return {
  /** @returns {AppMode} */
  appMode: ()=>appMode,
  /** @param {AppMode} v */
  setAppMode: (v)=>{ appMode = v; },
  /** @returns {boolean} */
  myHomeOpen: ()=>myHomeOpen,
  /** @param {boolean} v */
  setMyHomeOpen: (v)=>{ myHomeOpen = v; },
};
}

const api = { createLauncherState };
if(typeof window !== 'undefined') window.TwLauncherState = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
