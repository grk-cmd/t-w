/* run-diag-minute.js — 🩺 1분 진단 줄(tw-mouse-diag.log) — [비용] 줄 · [프레임] 줄 · [지도] 줄(히트 맵 그림자 운행 — hit-shadow.js)
   app.js 에 있던 1분 타이머 덩이를 그대로 옮긴 모듈이다. 만들 때 한 번 돈다(60초 타이머) — 옛 자리에서 부팅 때 한 번 돌던 것과 같다.
   ★ 본문은 app.js 에 있던 글 그대로다. 바뀐 줄은 둘 — _renderQuality · _runLowered 는 다시 대입되는 값이라 이름() 으로 읽고,
     좌석 몸 숨김 판정은 숨김 모듈을 직접 부르지 않고 deps._bodyHidden 으로 받는다.
   ★ 줄 모양은 frame-budget.js(diagLine) · gpu-timer.js(suffix) · run-cost-diag.js(line) · hit-shadow.js(lines) 가 정한다 — 여기서는 모아서 적기만.
   ★ 밖에서 부르는 이름: 없음.
   검사: checks/sim-run-diag-minute.js · 줄 내용은 sim-frame-budget · sim-gpu-timer · sim-run-cost-diag */
(function(){

function createRunDiagMinute(deps){
const Presence = deps.Presence;
const _FB = deps._FB;   // FrameBudget
const _bodyHidden = deps._bodyHidden;
const _frameBudget = deps._frameBudget;   // 없으면 null(frame-budget.js 못 실음)
const _frameCap = deps._frameCap;
const _frameJsStats = deps._frameJsStats;
const _gpuTimer = deps._gpuTimer;
const hitShadow = deps.hitShadow;   // 🗺️ 히트 맵 그림자 운행의 셈(launcher/hit-shadow.js)
const _renderQuality = deps._renderQuality;   // 읽는 함수
const _runLowered = deps._runLowered;   // 읽는 함수
const canvas = deps.canvas;
const key = deps.key;   // 그림자 만드는 빛
const renderer = deps.renderer;
const runCost = deps.runCost;
const scene = deps.scene;
const seats = deps.seats;
/* 🩺 1분마다 진단 한 줄(tw-mouse-diag.log) — 실제로 그린 장 수 · 포커스 비율 · 상한 · 배율 · 캔버스 크기.
   «앱 켜면 다른 프로그램이 버벅인다» 제보 때 로그만 받아서 우리 몫이 얼마인지 본다. 실행 화면에서만 적는다. */
try{
  setInterval(()=>{
    if(!_frameBudget) return;
    const t = performance.now();
    const m = _frameBudget.takeMinute(t);
    const cost = { gpu: _gpuTimer.take(), js: _frameJsStats.take() }, run = runCost.take();   // 실행 화면이 아니어도 1분마다 비운다
    const hitMapMin = hitShadow.take();
    if(!document.body.classList.contains('runmode')) return;
    if(!(window.companion && companion.diagNote)) return;
    m.cap = _frameCap(t); m.pr = renderer.getPixelRatio(); m.w = canvas.width; m.h = canvas.height; m.q = _renderQuality(); m.lowered = _runLowered();
    cost.calls = renderer.info.render.calls; cost.casters = key.castShadow ? TwGpuTimer.countCasters(scene) : 0;   // 빛이 그림자를 안 만들면 그림자 그리기도 없다
    companion.diagNote(TwRunCostDiag.line(run, TwRunCostDiag.countSeats(seats, _bodyHidden), TwRunCostDiag.roomKind(Presence.roomCode(), window._activeChannel, !!Presence.serverProvider())));   // 🩺 그리기 밖 시간 — 창을 내려도(runmode 그대로) 남는다
    companion.diagNote(_FB.diagLine(m) + TwGpuTimer.suffix(cost));
    for(const l of TwHitShadow.lines(hitMapMin)) companion.diagNote(l);   // 🗺️ [지도] 줄 — 판정이 없던 분은 안 적는다
  }, 60000);
}catch(_){}

return {

};
}

const api = { createRunDiagMinute };
if(typeof window !== 'undefined') window.TwRunDiagMinute = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
