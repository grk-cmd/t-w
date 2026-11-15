/* frame-pace.js — 🔋 프레임 상한 · rAF 멈춤 감시(앱 FSD · app.js 분리 M16)
   app.js 의 «절전 — 프레임 상한» 구역(FrameBudget 만들기 · 자동 화질 감시 · 그래픽 시간 재기 · 손댐 풀기 · «하는 중» 판정 · 상한 fps · 이번 프레임 건너뜀 · rAF 멈춤 감시 · 포커스 · 손댐 연결)을 글 그대로 옮긴 모듈이다.
   동작은 옛 자리와 같다(다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 받고 · 다시 대입하는 _runLowered 는 쓰는 함수로 받는 줄만 달라진다).
   ・책임: _frameBudget(상한 판정 · 손댐 · 포커스 기억) · _runSlowWatch(«자동» 화질) · _gpuTimer · _frameJsStats(1분 [프레임] 줄 꼬리) · _lowerRunQuality · _uiHot(상한 임시 해제) · _fbIsBusy(0.5초에 한 번만 DOM 을 본다) · _frameCap · _frameCapped · rAF 가 1초 넘게 안 오면 타이머가 frame() 을 대신 돌린다(_lastRafAt) · window focus · blur · pointerdown · keydown · wheel 연결.
   ・내놓는 것: _FB · _frameBudget · _runSlowWatch · _gpuTimer · _frameJsStats · _lowerRunQuality · _uiHot · _frameCap · _frameCapped(값 · 함수) · _lastRafAt(읽는 함수) · setLastRafAt(쓰는 함수) — app.js 는 값 · 함수를 같은 이름 const 로 받는다.
   ⚠️ 모듈을 만들 때 타이머 · 듣기가 한 번 걸린다(옛 자리와 같은 때). mousemove 는 «손댐» 으로 세지 않는다 — 클릭 통과 중에도 들어와 30 ↔ 60 이 오르내리고 영상이 깜빡인다.
   검사: checks/sim-frame-pace.js */
(function(){

function createFramePace(deps){
const _flyActive = deps._flyActive;   // 읽는 함수
const setRunLowered = deps.setRunLowered;   // 쓰는 함수
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const frame = deps.frame;   // 함수
const renderer = deps.renderer;
const seatCameraMod = deps.seatCameraMod;
const seatPointerMod = deps.seatPointerMod;
const seats = deps.seats;
/* 🔋 절전 — 프레임 상한은 frame-budget.js(FrameBudget)가 정한다. 요약: 최대 60 · 포커스 있어도 손 안 대면 30 ·
   다른 창을 보는 중이면 20. 이 창은 화면 전체를 덮는 투명 WebGL 오버레이라, 많이 그릴수록 크롬 스크롤 · 영상처럼
   GPU 합성을 쓰는 작업과 경합한다(제보: RTX 3060 Ti · 고주사율 모니터에서 크롬이 버벅임).
   캐릭터는 계속 움직여야 하므로 멈추지는 않고 상한만 둔다(dt는 그만큼 커져 속도는 그대로 유지).
   ※ 브라우저 스크롤 '멈춤'(GPU 합성 표면 점유)은 프레임 수와 무관함이 실험으로 확인됨(2026-07-25) —
     그건 오버레이가 표면을 잡는다는 사실 자체가 원인이다. 상한은 '버벅임'(GPU 부하) 쪽을 줄인다.
   ★ frame-budget.js 는 HTML 이 app.js 보다 먼저 싣는다 — 가드 없이 바로 쓴다. */
const _FB = FrameBudget;
const _frameBudget = _FB ? _FB.createFrameBudget({ now: ()=>performance.now() }) : null;
/* 🐢 «자동» 화질 — 그린 장 수가 상한에 한참 못 미치는 게 이어지면 배율을 1 로(이번 실행만 · 진단 로그에 한 줄) */
const _runSlowWatch = FrameBudget.createSlowWatch();
/* 🩺 한 장에 그래픽 칩 · JS 가 쓴 시간 — 1분 [프레임] 줄 꼬리(shared/gpu-timer.js · 노트북 블루스크린 · 버벅임 제보) */
const _gpuTimer = TwGpuTimer.createGpuTimer(renderer.getContext(), renderer.capabilities.isWebGL2);
const _frameJsStats = TwGpuTimer.createStats();
function _lowerRunQuality(){
  setRunLowered(true);
  seatCameraMod.updateCameraOnly();
  if(window.companion && companion.diagNote) companion.diagNote('[화질] 자동 — 그린 장 수가 상한에 못 미쳐 배율 1 로 낮춤');
}
let _appFocused = true;
/* 🔥 상한 임시 해제 — **만지는 동안에는 비포커스여도 60fps(FrameBudget.FPS_ACTIVE)로 돌린다.**
   [제보] "다른 브라우저를 띄워 둔 채 캐릭터를 클릭하면 앱이 무겁고 버벅인다. 앱을 활성화하면 멀쩡하다."
   [원인] 위 상한이 20fps 다. 다른 창을 보고 있으면 프레임 간격이 50ms 라, 그 상태에서 캐릭터를
     누르거나 끌면 반응이 한 박자씩 늦게 그려진다 — 앱이 느려진 것처럼 읽힌다. 절전은 **유휴일 때**
     하자는 장치인데, 만지는 순간까지 절전이 걸려 있던 것이 문제다.
   ★ 이미 같은 예외가 하나 있다(_flyActive) — 20fps 에서 나는 캐릭터가 순간이동하듯 끊겨서 뚫어 둔
     구멍이다. 클릭·드래그도 정확히 같은 이유이므로 그 선례를 그대로 따른다.
   ★ 마지막으로 만진 뒤 UI_HOT_MS 동안만 열어 둔다. 손을 떼면 다시 20fps 로 내려가 절전이 살아난다.
   ⚠️ 켜는 자리는 **판정이 '이 점은 앱 것'이라고 답한 순간**(커서가 캐릭터·UI 위)과 캐릭터를 누른
     순간이다. mousemove 마다 무조건 켜면 화면 아무 데나 스쳐도 상한이 풀려 절전이 사실상 사라진다. */
const UI_HOT_MS = 1500;
let _uiHotUntil = 0;
function _uiHot(ms){ const t = performance.now() + (ms || UI_HOT_MS); if(t > _uiHotUntil) _uiHotUntil = t; }
/* 포커스가 있을 때 30 으로 내려가지 않게 막는 «하는 중» — 춤 · 입력칸 · 꾸미기/생성기.
   DOM 을 보므로 0.5초에 한 번만 다시 잰다(매 프레임 querySelector 를 안 부르게). */
let _fbBusyAt = -1e9, _fbBusy = false;
function _fbIsBusy(now){
  if(now - _fbBusyAt < 500) return _fbBusy;
  _fbBusyAt = now;
  let b = false;
  try{
    if(creatorOpen()) b = true;
    else if(seats.some(s=>s._danceStartAt)) b = true;
    else {
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) b = true;
      else if(document.querySelector('#wardrobePanel.on, #wdPreviewPanel.on')) b = true;
    }
  }catch(_){}
  return (_fbBusy = b);
}
/* 지금 상한 fps — 상한 판정을 한 곳에 모은다(검증기도 여기를 본다). 0 = 상한 없음 */
function _frameCap(now){
  if(!_frameBudget) return 0;
  return _FB.pickFps({
    hot: !!_flyActive() || !!seatPointerMod.drag() || now < _uiHotUntil,   // 🪑 비행 · 끄는 중 · 방금 누름
    focused: _appFocused,
    runMode: document.body.classList.contains('runmode'),
    busy: _appFocused && _fbIsBusy(now),
    idleMs: _frameBudget.idleMs(now),
  });
}
/* 이번 프레임을 건너뛸 것인가. 그린다고 답하면 다음 예정 시각이 잡힌다(admit). */
function _frameCapped(now){
  if(!_frameBudget) return false;
  return !_frameBudget.admit(now, _frameCap(now));
}
/* 🩺 화면 멈춤 감시 — 창이 가려지거나 오래 방치되면 브라우저가 requestAnimationFrame 호출을
   아예 멈추는 경우가 있다(클릭하면 다시 움직이던 그 현상). main.js 쪽 절전 해제 스위치로도
   전부 막지 못했다. setTimeout 계열 타이머는 그때도 계속 도니, rAF가 한동안 안 오면
   타이머가 대신 한 프레임을 진행시켜 화면이 멈춘 것처럼 보이지 않게 한다.
   ★ 수동 진행일 땐 새 rAF를 걸지 않는다 — 원래 걸어둔 콜백이 아직 대기 중이라, 그것까지
     쌓이면 나중에 한꺼번에 터진다. 브라우저가 정상으로 돌아오면 그 콜백이 살아나 이어진다. */
let _lastRafAt = 0;
const RAF_STALL_MS = 1000;   // ★ 이 시간 이상 rAF가 안 오면 멈춘 것으로 본다
try{
  setInterval(()=>{
    const t = performance.now();
    if(!_lastRafAt){ _lastRafAt = t; return; }
    if(t - _lastRafAt < RAF_STALL_MS) return;
    try{ frame(t, true); }catch(_){}
  }, 400);
}catch(_){}
try{
  _appFocused = document.hasFocus();
  if(_frameBudget) _frameBudget.noteFocus(_appFocused, performance.now());
  window.addEventListener('focus', ()=>{ _appFocused = true;  if(_frameBudget){ const t = performance.now(); _frameBudget.noteFocus(true, t); _frameBudget.poke(t); } });
  window.addEventListener('blur',  ()=>{ _appFocused = false; if(_frameBudget) _frameBudget.noteFocus(false, performance.now()); });
  /* «손댐» = 내 창에 온 누르기 · 키 · 휠. ⚠️ mousemove 는 세지 않는다 — 클릭 통과 중에도 들어와서
     크롬 위로 커서만 지나가도 30 ↔ 60 이 오르내린다(영상 깜빡임 — _updateIgnore 🚫 주석). */
  if(_frameBudget){
    const _fbPoke = ()=>_frameBudget.poke(performance.now());
    for(const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, _fbPoke, { capture: true, passive: true });
  }
}catch(_){}

return {
  _FB,
  _frameBudget,
  _runSlowWatch,
  _gpuTimer,
  _frameJsStats,
  _lowerRunQuality,
  _uiHot,
  _frameCap,
  _frameCapped,
  _lastRafAt: ()=>_lastRafAt,
  setLastRafAt: (v)=>{ _lastRafAt = v; },
};
}

const api = { createFramePace };
if(typeof window !== 'undefined') window.TwFramePace = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
