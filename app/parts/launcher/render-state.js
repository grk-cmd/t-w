/* render-state.js — 🎚️ 실행 화면 그리기 상태: 화질(FrameBudget.QUALITY) · «자동» 이 이번 실행에서 배율을 낮췄는가 · 도트 렌더 켬 (app.js 분리 F6)
   app.js 맨 위 let 셋(_renderQuality · _runLowered · dotRenderEnabled)을 처음 값 그대로 모은 상태 파일이다. 동작은 옮기기 전과 같다.
   ・책임: 값을 들고 읽는 함수 · 쓰는 함수로 내놓는 것뿐 — 그리기 · 저장 · DOM 은 하지 않는다(저장은 바꾸는 쪽이 한다: 화질은 program-settings.js, 도트는 settings-panel.js).
   ・읽는 쪽: 좌석 카메라(room/seat-camera.js) · 프레임 한 장(frame-loop.js) · 1분 진단 줄(run-diag-minute.js) · 설정 창 둘.
     바꾸는 쪽: 화질 — 프로그램 설정 · «자동» 낮춤 — 프레임 상한(frame-pace.js) · 도트 — 설정 패널.
     바꾸는 쪽 하나에 두면 읽는 모듈이 그 모듈을 바라보고 그 모듈도 읽는 모듈을 불러 순환이 되므로 맨 아래 이 파일에 둔다(room-state.js 와 같은 까닭).
   ・받는 deps 없음 — 처음 값은 만들 때 localStorage 에서 한 번 읽는다(FrameBudget 은 shared/frame-budget.js 가 먼저 싣는다).
   ・내놓는 것: renderQuality · runLowered · dotRenderEnabled(읽는 함수) · setRenderQuality · setRunLowered · setDotRenderEnabled(쓰는 함수).
   ⚠️ antialias 는 WebGL 을 만들 때만 정해진다 — app.js 가 무대를 만들기 전에 이 모듈을 만들어 renderQuality() 로 정한다.
   app.js · 읽는 모듈보다 먼저 싣는 classic script. 검사: checks/sim-render-state.js */
(function(){

/**
 * @returns {{
 *   renderQuality: () => string, setRenderQuality: (v: string) => void,
 *   runLowered: () => boolean, setRunLowered: (v: boolean) => void,
 *   dotRenderEnabled: () => boolean, setDotRenderEnabled: (v: boolean) => void,
 * }}
 */
function createRenderState(){
let _renderQuality = FrameBudget.qualityFrom(localStorage.getItem(FrameBudget.QUALITY_KEY));
let _runLowered = false;   // «자동» 이 이번 실행에서 배율을 낮췄는가
let dotRenderEnabled = (localStorage.getItem('tw.dotRender')==='1');   // 기본 꺼짐
return {
  renderQuality: ()=>_renderQuality,   // 읽는 함수
  setRenderQuality: (v)=>{ _renderQuality = v; },   // 쓰는 함수 — 프로그램 설정 › 모니터
  runLowered: ()=>_runLowered,   // 읽는 함수
  setRunLowered: (v)=>{ _runLowered = v; },   // 쓰는 함수 — 프레임 상한의 «자동» 낮춤
  dotRenderEnabled: ()=>dotRenderEnabled,   // 읽는 함수
  setDotRenderEnabled: (v)=>{ dotRenderEnabled = v; },   // 쓰는 함수 — 설정 패널
};
}

const api = { createRenderState };
if(typeof window !== 'undefined') window.TwRenderState = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
