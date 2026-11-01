/* sim-figure-mode.js — 🧸 피규어 모드: 입력이 없어도 잠들지 않는다 · 포커스 시간은 쌓지 않는다
   ・1절: 진짜 seatState 를 가짜 환경에서 돌린다 — 피규어 모드면 입력이 8초 넘게 없어도 'idle'(잠 안 듦) ·
          꺼져 있으면 예전처럼 'sleep' · 자리비움 · 데스크톱 모드가 아닐 때는 예전 그대로.
   ・2절: 진짜 _applyActiveAppState 를 돌린다 — 피규어 모드면 등록한 포커싱 어플을 써도 · 폰이 켜져 있어도 안 쌓인다(👑 달성표 🎯집중도) ·
          켠 순간(직전 폴링이 «쌓는 중» 이어도)부터 멈춘다 · 끄면 예전처럼 쌓인다.
   ・3절: 깨 보기 — 고친 줄을 옛 모양으로 되돌리면 1 · 2절이 빨강이 되는지. */
'use strict';
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const APP = read('app.js');
if(!APP){ say('  ? 원본 못 찾음 — app.js'); process.exit(2); }
const SRC = APP;   // 두 함수는 app.js 에 그대로 있다 — 옮기기 전 글(joinRenderer)은 deps 이름을 되돌려 이 판과 안 맞는다

function grabFn(name, src){
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if(!m) return null;
  let i = src.indexOf('{', m.index), d = 0;
  for(let j = i; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d) return src.slice(m.index, j + 1); } }
  return null;
}
const SLEEP_M = /const FOCUS_MS=(\d+),SLEEP_MS=(\d+)/.exec(SRC);

/* seatState 를 돌릴 판 — 좌석 하나(내 것) · 입력 시각 · 깃발만 바꾼다 */
function seatEnv(fnSrc){
  const ctx = { env: {} };
  vm.createContext(ctx);
  vm.runInContext(`
    const FOCUS_MS=${SLEEP_M[1]}, SLEEP_MS=${SLEEP_M[2]}, PET_MS=2200;
    let lastActivity = 0, figureMode = false, focusGateSleep = false, desktopMode = true, windowFocused = false, userStatus = null;
    function focusWindowMs(){ return FOCUS_MS; }
    const seatPanelMod = { manual: () => null };
    const focusLevelMod = { _mobileOn: () => false };
    const _mobileOn = focusLevelMod._mobileOn;
    ${fnSrc}
    this.api = {
      st: (now) => seatState({ isMe: true, petStart: -1e9 }, now),
      set: (o) => { if('fig' in o) figureMode = o.fig; if('desk' in o) desktopMode = o.desk; if('gate' in o) focusGateSleep = o.gate;
                    if('us' in o) userStatus = o.us; if('act' in o) lastActivity = o.act; if('wf' in o) windowFocused = o.wf; } };`, ctx);
  return ctx.api;
}

/* _applyActiveAppState 를 돌릴 판 — 쌓인 초는 env.added */
function applyEnv(fnSrc){
  const env = { now: 100000, added: 0, chal: 0, mob: false };
  const ctx = { env, performance: { now: () => env.now } };
  vm.createContext(ctx);
  vm.runInContext(`
    let lastActivity = 0, figureMode = false, focusGateSleep = true, _penAppFocused = false;
    function focusWindowMs(){ return 1500; }
    const focusLevelMod = { _mobileOn: () => env.mob, addFocusSeconds: (d) => { env.added += d; } };
    const _mobileOn = focusLevelMod._mobileOn, addFocusSeconds = focusLevelMod.addFocusSeconds;
    const weeklyChal = { focusTick(s, d){ env.chal += d; }, setKeyPlatform(){} };
    let _focusLastTick = performance.now(), _focusWasActive = false;
    ${fnSrc}
    this.api = { apply: _applyActiveAppState, act: (t) => { lastActivity = t; }, fig: (v) => { figureMode = v; },
                 gate: () => focusGateSleep };`, ctx);
  return { A: ctx.api, E: env };
}
const REG = { hasAnyRegistered: true, isFocusedAppRegistered: true };
const NOT_REG = { hasAnyRegistered: true, isFocusedAppRegistered: false };
/* 1초 간격으로 n 번 폴링 — 매번 «방금 입력했다» */
function poll(A, E, state, n){ for(let i = 0; i < n; i++){ E.now += 1000; A.act(E.now); A.apply(state); } }

function sec1(fnSrc, quiet){
  const r = [];
  const S = seatEnv(fnSrc);
  const SL = Number(SLEEP_M[2]);
  S.set({ fig: true, gate: false, act: 0 });
  r.push(['피규어 모드 · 입력이 8초 넘게 없음 → 잠들지 않고 쉬는 자세(idle)', S.st(SL + 1) === 'idle']);
  r.push(['  한참(1시간) 지나도 idle', S.st(3600 * 1000) === 'idle']);
  r.push(['  경계 — 입력 직후는 집중 포즈(focus)', S.st(100) === 'focus']);
  S.set({ us: 'away' });
  r.push(['피규어 모드여도 자리비움이면 잔다', S.st(SL + 1) === 'sleep']);
  S.set({ us: null, fig: false });
  r.push(['피규어 모드 꺼짐 · 입력 8초 넘게 없음 → 예전처럼 잠듦', S.st(SL + 1) === 'sleep']);
  r.push(['  경계 — 꺼짐 · 딱 8초는 아직 idle', S.st(SL) === 'idle']);
  S.set({ fig: true, desk: false, wf: true });
  r.push(['데스크톱 모드가 아니면(브라우저) 예전 그대로 잠듦', S.st(SL + 1) === 'sleep']);
  if(!quiet){ say('── 1. seatState (진짜 함수를 돌린다)'); r.forEach(([m, ok]) => chk(ok, m)); }
  return r.every(x => x[1]);
}

function sec2(fnSrc, quiet){
  const r = [];
  { const { A, E } = applyEnv(fnSrc);
    A.fig(true); A.apply(REG); poll(A, E, REG, 5);
    r.push(['피규어 모드 · 등록한 포커싱 어플을 계속 씀 → 한 초도 안 쌓인다', E.added === 0]);
    r.push(['  👑 달성표 🎯집중도 안 센다', E.chal === 0]);
    r.push(['  게이트는 예전처럼 열림(깨어 있음)', A.gate() === false]); }
  { const { A, E } = applyEnv(fnSrc);
    A.fig(true); E.mob = true; A.apply(NOT_REG); poll(A, E, NOT_REG, 3);
    r.push(['피규어 모드 · 폰 켜짐 → 안 쌓인다', E.added === 0]); }
  { const { A, E } = applyEnv(fnSrc);
    A.apply(REG); poll(A, E, REG, 2);
    r.push(['피규어 모드 꺼짐 · 등록 앱 사용 → 예전처럼 쌓인다(2초)', Math.abs(E.added - 2) < 1e-6]);
    r.push(['  👑 달성표 🎯집중도 예전처럼 센다(2초)', Math.abs(E.chal - 2) < 1e-6]);
    A.fig(true); poll(A, E, REG, 3);
    r.push(['  쌓던 중에 켜면 바로 다음 폴링부터 멈춘다', Math.abs(E.added - 2) < 1e-6 && Math.abs(E.chal - 2) < 1e-6]);
    A.fig(false); poll(A, E, REG, 2);
    r.push(['  다시 끄면 다시 쌓인다', Math.abs(E.added - 4) < 1e-6 && Math.abs(E.chal - 4) < 1e-6]); }
  if(!quiet){ say('── 2. _applyActiveAppState (진짜 함수를 돌린다)'); r.forEach(([m, ok]) => chk(ok, m)); }
  return r.every(x => x[1]);
}

const SS = grabFn('seatState', SRC), AP = grabFn('_applyActiveAppState', SRC);
chk(!!SS && !!AP && !!SLEEP_M, 'seatState · _applyActiveAppState · FOCUS_MS/SLEEP_MS 를 찾았다');
if(SS && AP && SLEEP_M){
  sec1(SS);
  sec2(AP);
  say('── 3. 깨 보기');
  const ssOld = SS.replace(/if\(idle>SLEEP_MS && !\(desktopMode && figureMode\)\)return 'sleep';/, "if(idle>SLEEP_MS)return 'sleep';");
  chk(ssOld !== SS && !sec1(ssOld, true), '피규어 모드 조건을 빼면(옛 모양) 1절이 빨강');
  const apOld = AP.replace(/if\(!figureMode && _focusWasActive/, 'if(_focusWasActive');
  chk(apOld !== AP && !sec2(apOld, true), '쌓기 조건에서 피규어 모드를 빼면(옛 모양) 2절이 빨강');
  const apChal = AP.replace(/if\(!figureMode && dt>0 && dt<30 && !pcNotFocusing\) weeklyChal/, 'if(dt>0 && dt<30 && !pcNotFocusing) weeklyChal');
  chk(apChal !== AP && !sec2(apChal, true), '달성표 조건에서 피규어 모드를 빼면(옛 모양) 2절이 빨강');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
