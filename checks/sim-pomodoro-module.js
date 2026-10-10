/* ═══ 🍅 sim-pomodoro-module.js — 뽀모도로 모듈 (2026-10-10 신설 · 앱 FSD 6번) ═══════════════
   app.js 의 «🍅 뽀모도로» 구역 앞머리(상태 · 구간 넘기기 · 서랍 그리기 · 버튼 연결)를 parts/pomodoro.js 로 옮겼다.
   동작은 그대로여야 한다. 마크업 · 구간 셈(함수를 떼어 시계를 돌림)은 sim-pomodoro 가 본다 — 여기서는 «옮긴 것» 을 통째로 굴린다.
   ・1절: 만들 때 — 저장된 설정 · 진행 읽기 · 1초 tick 하나 · 🍅 버튼 연결 · 첫 그리기 · window._pomoShowText 고리 · DOM 없으면 조용히
   ・2절: 서랍 — 🍅 를 누르면 열리고 👑 달성표 서랍은 닫는다(weeklyChal.open(false)) · 다시 누르면 닫힌다 · 창 자리 맞춤
   ・3절: 시작 · 일시정지 · 계속 · 멈춤 — 프리셋 · 직접 입력 · 소리 잠금 해제 · 머리 위 즉시 갱신 · 진행 저장
   ・4절: 한 사이클(가짜 시계 · 1초 tick) — 집중 → 휴식 → … → 4바퀴째 긴 휴식 → 새 사이클 · 소리 · 알림 · 버튼 남은 시간 · 미니미 줄
   ・5절: 건너뛰기 · 자동 시작 꺼짐 — 소리 없이 다음 구간 · 사람이 누른 건너뛰기는 바로 돈다
   ・6절: 재시작 이어짐 · 머리 위 고리 — 저장된 진행을 읽어 이어 간다 · 문구
   ・7절: app.js 배선 — 정의는 모듈에만 · createPomodoro 는 원래 자리 · deps 모양 · 빈 껍데기 · _focusShowConf 는 typeof 가드 · html 순서 · 전역 이름
   [실행] pomodoro.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['pomodoro.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = SRC['app.js'], HTML = SRC['desk-companion-prototype.html'], MOD = SRC['pomodoro.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const MIN = 60 * 1000;

/* DOM 칸 — classList · style · 이벤트는 진짜 */
function mkEl(id){
  const cls = new Set(), L = {};
  const el = {
    id: id || '', style: {}, dataset: {}, textContent: '', value: '', disabled: false, onclick: null,
    classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c),
      toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); }, _L: L,
    fire(t, ev){ (L[t] || []).forEach(fn => fn(ev || {})); },
    click(){ if(el.onclick) el.onclick(); },
    querySelectorAll: () => el._btns || [],
  };
  return el;
}

function mkEnv(opt){
  opt = opt || {};
  const env = { now: 1e12, toasts: [], pushes: [], plays: 0, primes: 0, chal: [], clamps: 0, intervals: [], ls: Object.assign({}, opt.ls || {}) };
  const els = {};
  const byId = id => (opt.noDom ? null : (els[id] || (els[id] = mkEl(id))));
  if(!opt.noDom){
    const seg = byId('pomoPresetSeg');
    seg._btns = ['25', '50', 'custom'].map(p => { const b = mkEl(); b.dataset.p = p; b.closest = (sel) => (sel === 'button[data-p]' ? b : null); return b; });
  }
  const ctx = {
    Math, JSON, String, Number, Array, Object, Boolean, parseInt, Error,
    Date: { now: () => env.now },
    console: { warn(){}, log(){} },
    document: { getElementById: byId, activeElement: null },
    localStorage: { getItem: k => (k in env.ls ? env.ls[k] : null), setItem: (k, v) => { env.ls[k] = String(v); }, removeItem: k => { delete env.ls[k]; } },
    setInterval: (fn, ms) => { env.intervals.push({ fn, ms }); return env.intervals.length; },
    _focusLogClamp: () => { env.clamps++; },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx, { filename: 'pomodoro.js' });
  env.ctx = ctx; env.els = els;
  env.mk = () => ctx.TwPomodoro.createPomodoro({
    toast: (m) => env.toasts.push(m),
    focusShowPush: (f) => env.pushes.push(f),
    weeklyChal: { open: (on) => env.chal.push(on) },
    pomoSnd: { play: () => { env.plays++; }, prime: () => { env.primes++; } },
  });
  env.tick = () => env.intervals[0].fn();
  return env;
}

(async () => {
const sec = async (t, fn) => { say(t); try{ await fn(); }catch(e){ chk(false, '예외 — ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' / ')); } };

await sec('── 1. 만들 때', () => {
  const e = mkEnv({ ls: { 'tw.pomo': JSON.stringify({ preset: '50', f: 50, s: 10, l: 20, auto: false }) } });
  chk(typeof e.ctx.TwPomodoro.createPomodoro === 'function' && typeof e.ctx._pomoShowText === 'undefined', '싣기만 하면 window.TwPomodoro 뿐 — 고리는 만들 때 건다');
  const P = e.mk();
  chk(['showText', 'open', 'render', 'tick', 'cfg', 'run'].every(n => typeof P[n] === 'function'), '반환값 — showText · open · render · tick · cfg · run');
  chk(P.cfg().f === 50 && P.cfg().s === 10 && P.cfg().auto === false && P.cfg().every === 4 && P.cfg().sound === true, '저장된 설정(tw.pomo)을 읽는다 — 빠진 칸은 기본값');
  chk(P.run() === null, '진행(tw.pomoRun)이 없으면 안 돈다');
  chk(e.intervals.length === 1 && e.intervals[0].ms === 1000 && e.intervals[0].fn === P.tick, '1초 tick 하나(반환값 tick 과 같은 함수)');
  chk(typeof e.els.pomoBtn.onclick === 'function' && e.els.pomoBtn.textContent === '🍅 뽀모' && !e.els.pomoBtn.classList.contains('run'), '🍅 버튼 연결 · 첫 그리기 «🍅 뽀모»');
  chk(e.els.pomoMiniRow.style.display === 'none', '미니미 줄은 안 돌 때 숨김');
  chk(e.ctx._pomoShowText === P.showText && P.showText() === '', 'window._pomoShowText 고리 = showText · 안 돌면 빈 문구');
  chk(e.chal.length === 0 && e.pushes.length === 0 && e.toasts.length === 0 && e.plays === 0, '만들 때 달성표 · 머리 위 · 알림 · 소리는 안 건드린다');
  const n = mkEnv({ noDom: true }); const Q = n.mk();
  chk(n.intervals.length === 0 && typeof n.ctx._pomoShowText === 'function' && Q.showText() === '', 'DOM 이 없으면 조용히(tick 도 안 건다) — 고리는 건다');
  const b = mkEnv({ ls: { 'tw.pomo': '{깨짐', 'tw.pomoRun': JSON.stringify({ phase: 'focus', total: 0 }) } }); const R = b.mk();
  chk(R.cfg().f === 25 && R.run() === null, '깨진 설정 · 길이 0 진행은 버린다');
});

await sec('── 2. 서랍 — 👑 달성표와 하나만', () => {
  const e = mkEnv(); const P = e.mk(); const win = e.els.focusLogWin;
  e.els.pomoBtn.click();
  chk(win.classList.contains('pomo-on') && e.chal.length === 1 && e.chal[0] === false, '🍅 → 서랍 열림 · 달성표 서랍은 닫는다(weeklyChal.open(false))');
  chk(e.clamps === 1, '열고 닫을 때 창을 화면 안으로(window._focusLogClamp)');
  chk(e.els.pomoSetup.style.display === 'block' && e.els.pomoRun.style.display === 'none', '안 돌 때는 설정 화면');
  chk(e.els.pomoPresetSeg._btns[0].classList.contains('on') && e.els.pomoInFocus.value === '25' && e.els.pomoInFocus.disabled && !e.els.pomoInEvery.disabled, '프리셋 25 켜짐 · 숫자 칸은 직접 설정일 때만(바퀴 수는 늘)');
  e.els.pomoBtn.click();
  chk(!win.classList.contains('pomo-on') && e.chal.length === 1 && e.clamps === 2, '다시 🍅 → 닫힘(달성표는 또 안 건드림)');
  win.classList.add('chal-on'); P.open(true);
  chk(win.classList.contains('pomo-on') && e.chal.length === 2, 'open(true) 도 같은 길(달성표 닫기 부름)');
});

await sec('── 3. 시작 · 일시정지 · 계속 · 멈춤', () => {
  const e = mkEnv(); const P = e.mk(); const E = e.els;
  E.pomoBtn.click();
  E.pomoPresetSeg.fire('click', { target: E.pomoPresetSeg._btns[1] });
  chk(P.cfg().preset === '50' && P.cfg().f === 50 && P.cfg().s === 10 && P.cfg().l === 20 && JSON.parse(e.ls['tw.pomo']).f === 50, '프리셋 50 → 50 · 10 · 20 · 저장');
  E.pomoPresetSeg.fire('click', { target: E.pomoPresetSeg._btns[2] });
  chk(P.cfg().preset === 'custom' && P.cfg().f === 50 && !E.pomoInFocus.disabled, '직접 설정 → 숫자 칸이 풀린다(값은 그대로)');
  E.pomoInFocus.value = '999'; E.pomoInFocus.fire('change');
  chk(P.cfg().f === 50 && E.pomoInFocus.value === '50', '범위 밖 입력은 받지 않는다(이전 값으로 되돌림)');
  let stopped = 0; E.pomoInFocus.fire('keydown', { stopPropagation: () => { stopped++; } });
  chk(stopped === 1, '숫자 칸 키 입력은 단축키로 새지 않는다');
  E.pomoChkSound.click();
  chk(P.cfg().sound === false && !E.pomoChkSound.classList.contains('on'), '「끝날 때 소리」 끄기');
  E.pomoChkSound.click();
  E.pomoInFocus.value = '30';   // change 를 아직 안 쏜 칸 — 시작이 한 번 읽는다
  E.pomoStart.click();
  const r = P.run();
  chk(r && r.phase === 'focus' && r.total === 30 * MIN && !r.paused && r.endAt === e.now + 30 * MIN, '시작 → 집중 30분(입력 중인 칸도 읽음)');
  chk(e.primes === 1 && e.pushes.length === 1 && e.pushes[0] === true, '소리 잠금 해제(prime) · 머리 위 즉시 갱신(force)');
  chk(JSON.parse(e.ls['tw.pomoRun']).phase === 'focus', '진행 저장(tw.pomoRun)');
  chk(E.pomoSetup.style.display === 'none' && E.pomoRun.style.display === 'block' && E.pomoBig.textContent === '30:00' && E.pomoPhase.textContent === '🍅 집중 1 / 4', '진행 화면 — 30:00 · 🍅 집중 1 / 4');
  e.now += 10 * MIN; P.tick();
  chk(E.pomoBig.textContent === '20:00' && E.pomoBarFill.style.width === '33.3%' && P.showText() === '🍅 집중 20분', '10분 뒤 — 20:00 · 막대 33.3% · 머리 위 «🍅 집중 20분»');
  E.pomoPause.click();
  chk(P.run().paused && P.run().left === 20 * MIN && E.pomoPause.textContent === '▶ 계속' && /멈춤/.test(E.pomoPhase.textContent) && P.showText() === '🍅 일시정지', '일시정지 — 남은 20분 · «▶ 계속» · «멈춤»');
  e.now += 60 * MIN; P.tick();
  chk(E.pomoBig.textContent === '20:00' && P.run().phase === 'focus', '멈춘 동안 시간이 안 흐른다');
  E.pomoPause.click();
  chk(!P.run().paused && P.run().endAt === e.now + 20 * MIN && E.pomoPause.textContent === '⏸ 일시정지', '계속 — 남은 시간부터');
  E.pomoBtn.click();
  chk(E.pomoBtn.textContent === '🍅 20:00' && E.pomoBtn.classList.contains('run'), '서랍을 닫아도 버튼이 남은 시간을 보여 준다');
  E.pomoBtn.click();
  const p0 = e.pushes.length; E.pomoStop.click();
  chk(P.run() === null && !('tw.pomoRun' in e.ls) && e.pushes.length === p0 + 1 && E.pomoSetup.style.display === 'block' && P.showText() === '', '멈춤 — 진행 지움 · 머리 위 거둠 · 설정 화면');
});

await sec('── 4. 한 사이클(가짜 시계)', () => {
  const e = mkEnv(); const P = e.mk(); const E = e.els;
  E.pomoStart.click();
  e.now += 25 * MIN; e.tick();
  chk(P.run().phase === 'short' && P.run().done === 1 && P.run().total === 5 * MIN, '집중 25분 끝 → 짧은 휴식 5분 · 한 바퀴');
  chk(e.plays === 1 && e.toasts[0] === '🍅 집중 끝! 휴식 5분' && e.pushes[e.pushes.length - 1] === true, '소리 한 번 · 알림 · 머리 위 갱신');
  chk(E.pomoMiniRow.style.display === 'flex' && E.pomoMiniRow.classList.contains('rest') && E.pomoMiniLbl.textContent === '☕ 휴식' && E.pomoBtn.textContent === '☕ 05:00', '미니미 줄 · 버튼 — 휴식 표시');
  for(let i = 0; i < 3; i++){ e.now = P.run().endAt; e.tick(); e.now = P.run().endAt; e.tick(); }
  chk(P.run().phase === 'long' && P.run().done === 4 && P.run().total === 15 * MIN && e.toasts[e.toasts.length - 1] === '🍅 4바퀴 완료! 긴 휴식 15분', '4바퀴째 집중 끝 → 긴 휴식 15분');
  E.pomoBtn.click();
  chk(E.pomoDots.textContent === '🍅🍅🍅🍅' && E.pomoPhase.textContent === '☕ 긴 휴식', '서랍 — 🍅 넷 · 긴 휴식');
  e.now = P.run().endAt; e.tick();
  chk(P.run().phase === 'focus' && P.run().done === 0 && !P.run().paused && e.toasts[e.toasts.length - 1] === '☕ 휴식 끝! 다음 집중을 시작해요', '긴 휴식 끝 → 새 사이클 · 자동 시작');
  chk(e.plays === 8 && E.pomoDots.textContent === '⚪⚪⚪⚪', '구간 여덟 번 끝 → 소리 여덟 번 · 바퀴 표시 비움');
  const p = e.plays; e.now = P.run().endAt + 3 * 60 * MIN; e.tick();
  chk(P.run().phase === 'focus' && P.run().paused && P.run().done === 0 && e.plays === p + 1, '몇 시간 뒤 켜짐 → 한 번만 알리고 멈춘 채 새 집중');
});

await sec('── 5. 건너뛰기 · 자동 시작 꺼짐', () => {
  const e = mkEnv(); const P = e.mk(); const E = e.els;
  E.pomoChkAuto.click();
  chk(P.cfg().auto === false, '「자동 시작」 끄기');
  E.pomoStart.click();
  E.pomoSkip.click();
  chk(P.run().phase === 'short' && P.run().done === 1 && e.plays === 0 && P.cfg().sound === true, '집중 건너뛰기 → 휴식 · 바퀴는 센다 · 소리 없음(설정은 되돌림)');
  e.now = P.run().endAt; e.tick();
  chk(P.run().phase === 'focus' && P.run().paused && e.plays === 1 && e.toasts[e.toasts.length - 1] === '☕ 휴식 끝! ▶ 를 누르면 다음 집중이 시작돼요', '자동 시작 꺼짐 — 휴식 끝에 멈춘 채 대기 · 안내');
  E.pomoStart.click(); E.pomoSkip.click(); E.pomoSkip.click();
  chk(P.run().phase === 'focus' && !P.run().paused && P.run().endAt === e.now + P.run().total, '휴식 건너뛰기 → 사람이 누른 것이니 집중이 바로 돈다');
  P.run(); E.pomoStop.click(); E.pomoSkip.click(); E.pomoPause.click();
  chk(P.run() === null, '안 돌 때 건너뛰기 · 일시정지는 아무것도 안 한다');
});

await sec('── 6. 재시작 이어짐 · 머리 위 고리', () => {
  const run = { phase: 'short', total: 5 * MIN, done: 2, paused: false, left: 5 * MIN, endAt: 1e12 + 3 * MIN };
  const e = mkEnv({ ls: { 'tw.pomoRun': JSON.stringify(run) } }); const P = e.mk();
  chk(P.run().phase === 'short' && P.run().done === 2 && e.els.pomoBtn.textContent === '☕ 03:00', '저장된 진행을 읽어 이어 간다(벽시계 끝나는 시각 기준)');
  chk(e.ctx._pomoShowText() === '☕ 휴식 3분', '머리 위 «☕ 휴식 3분»(window 고리)');
  e.now += 3 * MIN; e.tick();
  chk(P.run().phase === 'focus' && P.run().done === 2 && e.ctx._pomoShowText() === '🍅 집중 25분', '휴식 끝 → 집중(바퀴 이어짐) · 문구 갱신');
});

await sec('── 7. app.js 배선', () => {
  const code = strip(APP);
  chk(!/function _pomo\w*\(|\b(var|let|const) (_pomoRun|_pomoCfg|POMO_KEY|POMO_RUN_KEY|POMO_PRESETS)\b|bindPomo/.test(code), '뽀모 정의는 app.js 에 없다(모듈에만)');
  chk(/window\.TwPomodoro = api/.test(MOD) && (code.match(/TwPomodoro\.createPomodoro\(/g) || []).length === 1, '모듈은 window.TwPomodoro · createPomodoro 는 한 곳');
  const iMk = APP.indexOf('TwPomodoro.createPomodoro('), iPrev = APP.indexOf('TwWeeklyChallenge.createWeeklyChallenge('), iNext = APP.indexOf('let myHomeOpen = false;');
  chk(iPrev > 0 && iMk > iPrev && iNext > iMk, '원래 자리 — 👑 달성표 연결 뒤 · myHomeOpen 앞');
  const iConf = APP.indexOf('function _focusShowConf('), iBind = APP.indexOf('(function bindFocusShow(){');
  chk(iConf > 0 && iBind > iConf && iMk > iBind && /const _pt = \(typeof _pomoShowText === 'function'\) \? _pomoShowText\(\) : '';/.test(APP),
    '★ _focusShowConf 는 만드는 줄보다 먼저 불린다(bindFocusShow) — typeof 가드로 window 고리만 본다(반환값 const 는 TDZ)');
  chk(/^window\._pomoShowText = _pomoShowText;$/m.test(MOD), '  모듈이 window._pomoShowText 고리를 건다');
  const call = (APP.match(/TwPomodoro\.createPomodoro\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  chk(deps.length === 4 && /^toast: \(\.\.\.a\)=>toast\(\.\.\.a\),$/.test(deps[0]) && /^focusShowPush: \(\.\.\.a\)=>_focusShowPush\(\.\.\.a\),$/.test(deps[1])
    && /^weeklyChal: weeklyChal,$/.test(deps[2]) && /^pomoSnd: _pomoSnd,$/.test(deps[3]), 'deps 4개 — 함수는 화살표 · weeklyChal · _pomoSnd 는 앞에 선언된 const 값 (' + deps.length + ')');
  const iWc = APP.indexOf('const weeklyChal = '), iSnd = APP.indexOf("const _pomoSnd = _mkSndPool('pomo'");
  chk(iWc > 0 && iWc < iMk && iSnd > 0 && iSnd < iMk && !/\b(weeklyChal|_pomoSnd)\s*=[^=]/.test(code.replace(/const (weeklyChal|_pomoSnd) = /g, '')), '  둘 다 만드는 줄보다 앞 · 다시 대입되지 않는다');
  const m = strip(MOD);
  chk(/const toast = deps\.toast;/.test(m) && /const _focusShowPush = deps\.focusShowPush;/.test(m) && /const weeklyChal = deps\.weeklyChal;/.test(m) && /const _pomoSnd = deps\.pomoSnd;/.test(m), '모듈은 받은 넷을 같은 이름으로(본문 글자 그대로)');
  const off = (APP.match(/const POMODORO_OFF = \{([^\n]*)\};/) || [])[1] || '';
  chk(['showText', 'open', 'render', 'tick', 'cfg', 'run'].every(n => new RegExp('\\b' + n + '\\s*(\\(|:)').test(off)) && /showText:\(\)=>''/.test(off), '빈 껍데기 POMODORO_OFF — 반환값 이름을 다 갖는다 · 문구는 빈 값');
  const iW = HTML.indexOf('<script src="parts/weekly-challenge.js"></script>'), iP = HTML.indexOf('<script src="parts/pomodoro.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iW > 0 && iP > iW && iA > iP, 'html — pomodoro.js 를 app.js 앞에 싣는다');
  chk(/^Tw[A-Z]/.test('TwPomodoro') && !/window\.Pomodoro\s*=/.test(MOD), '전역 이름은 Tw 접두사(#103 — 크로미움 내장 전역과 겹치지 않게)');
  /* 모듈이 없을 때 — 빈 껍데기 줄만 떼어 굴린다 */
  const wire = (APP.match(/const POMODORO_OFF = [\s\S]*?\n\}\);/) || [''])[0];
  const box = { toast(){}, _focusShowPush(){}, weeklyChal: {}, _pomoSnd: {} };
  let got = null; try{ got = vm.runInNewContext(wire + '\npomodoro;', box); }catch(_){}
  chk(!!got && got.showText() === '' && typeof got.open === 'function', '모듈이 안 실려도 그 자리는 서지 않는다(빈 껍데기)');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
/* 기다리던 약속이 영영 안 풀려 이벤트 고리가 비면 node 는 0 으로 조용히 끝난다 — 판정 줄 없이 끝나면 빨강 */
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다 — 기다리던 응답이 오지 않았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
