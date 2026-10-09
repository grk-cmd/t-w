/* sim-unfocused-fps.js — 🔋 실행 화면 프레임 상한을 app.js 째로 돌려 본다 (frame-budget.js 와 함께)
   · 다른 창을 보는 동안 유휴면 20fps 로 절전한다(기존 그대로).
   · 내 창에 포커스가 있어도 60fps 를 넘지 않는다 — 144Hz 모니터에서도(크롬 버벅임 제보).
   · 포커스가 있어도 손을 안 댄 채 8초가 지나면 30fps. 누르기 · 키 · 휠이 오면 바로 60.
   · 캐릭터를 누르거나 끌거나 날고 있으면 비포커스여도 60 — 손을 떼고 창이 지나면 다시 20.
   · 마우스 이동은 «손댐» 이 아니다(_updateIgnore 🚫 주석 — 상한이 오르내리면 영상이 깜빡인다).
   실행: node sim-unfocused-fps.js  (app.js · frame-budget.js · smoke.js 와 같은 폴더에서) */
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
const cut = smokeSrc.indexOf('/* ── 실행');
smokeSrc = smokeSrc.slice(0, cut).split('\n')
  .filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

globalThis.setTimeout = (fn)=>0;
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};

/* 시계를 손으로 돌린다 — 상한 판정이 시간에만 의존하므로 이걸로 전부 재현된다 */
let CLOCK = 100000;
const _perf = globalThis.performance || {};
globalThis.performance = Object.assign({}, _perf, { now: ()=>CLOCK });

const probe = `
;globalThis.__P = {
  FB: _FB,
  HOT: UI_HOT_MS,
  capped: now=>_frameCapped(now),
  cap: now=>_frameCap(now),
  hot: ms=>_uiHot(ms),
  poke: t=>_frameBudget.poke(t),
  setFocus: v=>{ _appFocused = v; },
  setFly: n=>{ _flyActive = n; },
  setDrag: d=>{ drag = d; },
  setCreator: v=>{ creatorOpen = v; _fbBusyAt = -1e9; },
  hotUntil: ()=>_uiHotUntil,
  clearHot: ()=>{ _uiHotUntil = 0; },
};`;

const say = console.log; console.log = ()=>{}; console.warn = ()=>{};
let SRC_FB = null, SRC_APP = null;
try { SRC_FB = fs.readFileSync('frame-budget.js', 'utf8'); SRC_APP = fs.readFileSync('app.js', 'utf8'); }
catch (e) { console.log = say; say('? 원본 못 찾음 — frame-budget.js · app.js'); process.exit(2); }
try {
  vm.runInThisContext(SRC_FB, { filename: 'frame-budget.js' });   // html 처럼 app.js 보다 먼저
  vm.runInThisContext(SRC_APP + probe, { filename: 'app.js' });
}
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e).toString().split('\n').slice(0,5).join('\n')); process.exit(1); }
console.log = say;

/* 스텁은 querySelector 가 늘 무언가를 돌려주고 classList.contains 가 늘 false 다 — 여기서만 진짜처럼 */
const BODY = new Set();
document.body.classList = { add: c=>BODY.add(c), remove: c=>BODY.delete(c), toggle: (c, on)=>{ (on === undefined ? !BODY.has(c) : on) ? BODY.add(c) : BODY.delete(c); }, contains: c=>BODY.has(c), replace(){} };
document.querySelector = () => null;
document.activeElement = null;

const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const FB = P.FB;
if (!FB) { say('✗ app.js 가 FrameBudget 을 못 잡았다'); process.exit(1); }

/* 모니터 hz 로 ms 동안 rAF 를 흘려 실제로 그린 장 수를 센다(시계도 같이 간다) */
function run(ms, hz){
  const step = 1000 / hz, end = CLOCK + ms;
  let drawn = 0;
  for (; CLOCK < end; CLOCK += step) if (!P.capped(CLOCK)) drawn++;
  return drawn;
}
const near = (n, want, tol) => Math.abs(n - want) <= tol;
const setup = (focused)=>{
  P.setFocus(focused); P.setFly(0); P.setDrag(null); P.clearHot(); P.setCreator(false);
  BODY.clear(); BODY.add('desktop'); BODY.add('runmode');
  P.poke(CLOCK); run(200, 144);   // 상한 예정 시각을 지금으로 맞춘다
};

say('\n── 1. 다른 창을 보는 중(유휴)은 20fps — 기존 그대로');
{
  setup(false);
  chk(FB.FPS_UNFOCUSED === 20 && P.cap(CLOCK) === 20, '비포커스 상한 20');
  const n = run(1000, 144);
  chk(near(n, 20, 1), '144Hz 에서 1초에 ' + n + '장(≈20)');
  const n60 = run(1000, 60);
  chk(near(n60, 20, 1), '60Hz 에서 1초에 ' + n60 + '장(≈20)');
}

say('\n── 2. ★ 내 창에 포커스가 있어도 60 을 넘지 않는다 (예전엔 상한 없음 = 144장)');
{
  setup(true);
  P.poke(CLOCK);
  chk(P.cap(CLOCK) === 60, '포커스 · 방금 손댐 → 상한 60');
  const n = run(1000, 144);
  chk(near(n, 60, 2), '144Hz 에서 1초에 ' + n + '장(≈60 · 48 로 떨어지지 않게 예정 시각을 쌓는다)');
  P.poke(CLOCK);
  const n165 = run(1000, 165);
  chk(near(n165, 60, 2), '165Hz 에서 1초에 ' + n165 + '장(≈60)');
  P.poke(CLOCK);
  const n60 = run(1000, 60);
  chk(n60 >= 58, '60Hz 모니터에서는 한 장도 안 빠진다(' + n60 + '장)');
}

say('\n── 3. ★ 포커스가 있어도 손을 안 대면 30 · 손대면 바로 60');
{
  setup(true);
  P.poke(CLOCK);
  run(FB.IDLE_AFTER_MS - 500, 144);
  chk(P.cap(CLOCK) === 60, (FB.IDLE_AFTER_MS / 1000 - 0.5) + '초 — 아직 60(바로 안 내려간다)');
  run(1000, 144);
  chk(P.cap(CLOCK) === 30, (FB.IDLE_AFTER_MS / 1000 + 0.5) + '초 — 30');
  const n = run(1000, 144);
  chk(near(n, 30, 2), '144Hz 에서 1초에 ' + n + '장(≈30)');
  P.poke(CLOCK);   // 누르기 · 키 · 휠
  chk(P.cap(CLOCK) === 60, '손대면 그 자리에서 60');
  const n2 = run(1000, 144);
  chk(near(n2, 60, 2), '그다음 1초 ' + n2 + '장');
}

say('\n── 4. 하는 중이면 30 으로 내려가지 않는다 — 생성기 · 꾸미기 · 춤 · 입력칸');
{
  setup(true);
  P.setCreator(true);
  run(FB.IDLE_AFTER_MS + 1000, 60);
  chk(P.cap(CLOCK) === 60, '생성기를 연 채 손을 안 대도 60');
  P.setCreator(false);
  run(600, 60);   // 0.5초마다 다시 잰다
  chk(P.cap(CLOCK) === 30, '닫으면 30');
  BODY.delete('runmode');
  chk(P.cap(CLOCK) === 60, '실행 화면이 아니면(런처) 30 으로 안 내린다');
}

say('\n── 5. ★ 캐릭터를 누르면 비포커스여도 60 · 창이 지나면 20');
{
  setup(false);
  P.hot(3000);                       // canvas pointerdown 이 하는 일
  chk(P.cap(CLOCK) === 60, '누른 뒤 상한 60(예전엔 상한 없음)');
  const n = run(2900, 144);
  chk(near(n, 174, 4), '3초 창 안 2.9초 동안 ' + n + '장(≈174 = 60fps)');
  run(200, 144);
  chk(P.cap(CLOCK) === 20, '창이 지나면 20');
}

say('\n── 6. 창은 앞으로만 늘어난다');
{
  setup(false);
  P.hot(3000);
  const far = P.hotUntil();
  P.hot(200);
  chk(P.hotUntil() === far, '★ 이미 잡힌 긴 창을 짧은 요청이 줄이지 않는다');
}

say('\n── 7. 끄는 중 · 날고 있는 중은 60');
{
  setup(false);
  P.setDrag({ seat:{} });
  chk(P.cap(CLOCK) === 60, '끄는 중 60');
  P.setDrag(null);
  chk(P.cap(CLOCK) === 20, '놓으면 20');
  P.setFly(1);
  chk(P.cap(CLOCK) === 60, '🪑 날고 있으면 60');
  P.setFly(0);
  chk(P.cap(CLOCK) === 20, '착지하면 20');
}

say('\n── 8. 배선 — 손댐은 누르기 · 키 · 휠만, 마우스 이동은 아니다');
{
  const code = SRC_APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  chk(/for\(const ev of \['pointerdown', 'keydown', 'wheel'\]\) window\.addEventListener\(ev, _fbPoke/.test(code), '누르기 · 키 · 휠에서 poke');
  chk(!/'mousemove'[^\n]*_fbPoke|_fbPoke[^\n]*'mousemove'/.test(code) && !/'pointermove'[^\n]*_fbPoke/.test(code), '★ mousemove 로는 poke 하지 않는다(통과 중에도 들어온다 → 30 ↔ 60 깜빡임)');
  const ui = code.indexOf('function _updateIgnore('), uiSeg = code.slice(ui, ui + 600);
  chk(ui > 0 && !/_uiHot\(|\.poke\(/.test(uiSeg), '_updateIgnore(커서가 앱 위)에서 상한을 풀지 않는다');
  chk(!/_lastFrameAt|MAC_RUN_MAX_PR|_IS_MAC_RENDER/.test(code), '옛 상한 · mac 전용 배율 변수가 남지 않았다');
}

say(fail ? '\n✗ 실패 ' + fail + '건' : '\n✓ 전부 통과');
