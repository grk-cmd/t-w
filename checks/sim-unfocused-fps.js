/* sim-unfocused-fps.js — 🔥 비포커스 프레임 상한을 만지는 동안에만 푼다
   · 다른 창을 보는 동안 유휴면 20fps 로 절전한다(기존 그대로).
   · 캐릭터를 누르거나 커서를 올리면 그 순간부터 잠시 최대 프레임으로 돈다.
   · 손을 떼고 UI_HOT_MS 가 지나면 다시 절전으로 내려간다.
   실행: node sim-unfocused-fps.js  (app.js · smoke.js 와 같은 폴더에서) */
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
  CAP: FPS_UNFOCUSED,
  HOT: UI_HOT_MS,
  capped: now=>_frameCapped(now),
  hot: ms=>_uiHot(ms),
  setFocus: v=>{ _appFocused = v; },
  setLastFrame: t=>{ _lastFrameAt = t; },
  setFly: n=>{ _flyActive = n; },
  setDrag: d=>{ drag = d; },
  hotUntil: ()=>_uiHotUntil,
  clearHot: ()=>{ _uiHotUntil = 0; },
};`;

const say = console.log; console.log = ()=>{}; console.warn = ()=>{};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e).toString().split('\n').slice(0,5).join('\n')); process.exit(1); }
console.log = say;

const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const GAP = 1000 / P.CAP;          // 상한이 허용하는 프레임 간격(ms)
const setup = ()=>{ P.setFocus(false); P.setFly(0); P.setDrag(null); P.clearHot(); P.setLastFrame(CLOCK); };
/* "직전 프레임 바로 뒤에 온 프레임" — 상한이 있으면 건너뛰고, 풀려 있으면 그린다.
   ⚠️ _frameCapped 는 시각이 아니라 **직전 프레임과의 간격**을 보므로, 시각만 미루면
     간격이 벌어져 상한과 무관하게 통과한다(이 검증기가 처음에 그렇게 틀렸다). */
const soon = t => { P.setLastFrame(t - 1); return P.capped(t); };

say('\n── 1. 유휴일 때는 절전이 그대로다');
{
  setup();
  chk(P.CAP === 20, '비포커스 상한은 ' + P.CAP + 'fps (프레임 간격 ' + GAP + 'ms)');
  chk(P.capped(CLOCK + GAP * 0.5) === true, '간격의 절반 만에 온 프레임은 건너뛴다');
  chk(P.capped(CLOCK + GAP + 1) === false, '간격을 채우면 그린다');
}

say('\n── 2. 내 앱을 보는 중이면 상한이 없다');
{
  setup(); P.setFocus(true);
  chk(soon(CLOCK + 1) === false, '1ms 만에 온 프레임도 그린다');
}

say('\n── 3. ★ 캐릭터를 누르면 상한이 풀린다');
{
  setup();
  chk(soon(CLOCK + 1) === true, '누르기 전에는 건너뛴다');
  P.hot(3000);                       // canvas pointerdown 이 하는 일
  chk(soon(CLOCK + 1) === false, '★ 누른 뒤에는 곧바로 최대 프레임');
  chk(soon(CLOCK + 2900) === false, '3초 창 안에서는 계속 열려 있다');
  chk(soon(CLOCK + 3100) === true, '창이 지나면 다시 절전으로 내려간다');
}

say('\n── 4. 커서를 올리기만 해도 열린다 (곧 만질 자리)');
{
  setup();
  P.hot();                           // _updateIgnore 가 '앱 것' 이라고 답한 순간
  chk(soon(CLOCK + 1) === false, '기본 창 ' + P.HOT + 'ms 동안 최대 프레임');
  chk(soon(CLOCK + P.HOT - 50) === false, '창 안');
  chk(soon(CLOCK + P.HOT + 50) === true, '창 밖 — 절전 복귀');
}

say('\n── 5. 창은 앞으로만 늘어난다');
{
  setup();
  P.hot(3000);
  const far = P.hotUntil();
  P.hot(200);                        // 짧은 요청이 뒤에 와도
  chk(P.hotUntil() === far, '★ 이미 잡힌 긴 창을 짧은 요청이 줄이지 않는다');
  say('    (줄이면 드래그 도중에 상한이 도로 걸려 화면이 끊긴다)');
}

say('\n── 6. 끄는 중에는 무조건 열려 있다');
{
  setup();
  P.setDrag({ seat:{} });
  chk(soon(CLOCK + 1) === false, '★ 손에 붙어 있어야 하므로 상한을 안 건다');
  P.setDrag(null);
  chk(soon(CLOCK + 1) === true, '놓으면 다시 절전 판정으로');
}

say('\n── 7. 비행 예외는 그대로다');
{
  setup();
  P.setFly(1);
  chk(soon(CLOCK + 1) === false, '🪑 날고 있으면 상한 없음(기존 동작)');
  P.setFly(0);
  chk(soon(CLOCK + 1) === true, '착지하면 복귀');
}

say(fail ? '\n✗ 실패 ' + fail + '건' : '\n✓ 전부 통과');
