/* ═══ 🕒 sim-focus-log.js — 포커스 기록 팝업 모듈 (2026-10-13 신설 · 앱 FSD 13번) ═══════════════
   app.js 의 «🕒 포커스 기록 팝업» 구역을 parts/focus/focus-log.js 로 옮겼다.
   동작은 그대로여야 한다 — 여기서는 «옮긴 것» 을 가짜 DOM 위에서 통째로 굴린다.
   ・1절: 만들 때 — 싣기만 하면 window.TwFocusLog 뿐 · 만들면 버튼 다섯 · 본문 누름 · ESC 등록 · window._focusLogClamp · 매초 갱신 · 끌기 연결 ·
           창 DOM 이 없으면 아무것도 안 건다
   ・2절: 열기 · 닫기 — 현재 기록부터 · 맨 앞으로 · ⚙️ 설정창 닫기 · 누적 ↔ 현재(오늘 기록 둘째 줄) · 다시 열면 현재 기록 · ✕ · ESC
   ・3절: 매초 갱신 — 열려 있을 때만 · 값은 부를 때마다 읽는다(누적 · 현재 · 오늘)
   ・4절: 미니미 — _ □ 저장(tw.focusLogMini) · 제목 · 짧은 라벨 · 열려 있으면 좌상단 고정 · 본문 누름 토글(미니미에서만) · 저장값으로 시작
   ・5절: 화면 안 가두기 · 끌기 — 중앙정렬 상태는 안 건드림 · 옮긴 뒤엔 가둠 · _ □ ✕ 위 누름은 끌기 아님
   ・6절: app.js 배선 — 정의는 모듈에만 · 만드는 곳 한 곳 · 원래 자리 · deps 모양(함수는 화살표 · let 은 읽는 함수) · 빈 껍데기 · html 순서 · 전역 이름
   ・7절: 일부러 깨 보기 — 모듈 글을 조금씩 망가뜨려 2~5절이 잡아내는지(이 검사가 헛돌지 않는지) 스스로 확인
   [실행] focus-log.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['focus-log.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ console.log('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = _joinRenderer(SRC['app.js']), HTML = SRC['desk-companion-prototype.html'], MOD = SRC['focus-log.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

const IDS = ['focusLogOverlay', 'focusLogWin', 'focusLogTitle', 'focusLogTime', 'focusLogCaption', 'fsFocusLogBtn', 'focusLogClose', 'focusLogOk',
  'focusLogTitleTxt', 'focusLogMin', 'focusLogMax', 'focusLogCaption2', 'focusLogBody', 'focusLogRow2', 'focusLogTime2', 'focusSettingsPanel'];

function mkEl(id, env){
  const L = {}, cls = new Set();
  const el = {
    id, style: {}, textContent: '', onclick: null, _L: L, _cls: cls,
    classList: {
      add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
      toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; },
    },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
    fire(t, ev){ (L[t] || []).slice().forEach(fn => fn(Object.assign({ preventDefault(){ ev && (ev._pd = true); }, stopPropagation(){}, target: { closest: () => null } }, ev || {}))); },
    get offsetWidth(){ return el.id === 'focusLogWin' ? (cls.has('mini') ? 118 : 230) : 0; },
    get offsetHeight(){ return el.id === 'focusLogWin' ? env.winH : 0; },
    getBoundingClientRect: () => ({ left: env.rect.left, top: env.rect.top, width: 230, height: env.winH }),
  };
  return el;
}

function mkEnv(opt){
  opt = opt || {};
  const env = {
    total: 3600, session: 65, today: 1800, rollCalls: 0, fronts: [], escs: [], timers: [], winL: {}, store: {}, sets: [],
    rect: { left: 300, top: 200 }, winH: 120,
  };
  if(opt.mini) env.store['tw.focusLogMini'] = '1';
  const els = {};
  if(!opt.noDom) IDS.forEach(id => { els[id] = mkEl(id, env); });
  if(els.focusSettingsPanel) els.focusSettingsPanel.classList.add('on');
  const ctx = {
    Math, JSON, String, Number, Array, Object, Boolean, parseFloat, parseInt, Error,
    console: { warn(){}, log(){} },
    innerWidth: 800, innerHeight: 600,
    document: { getElementById: (id) => els[id] || null },
    localStorage: {
      getItem: (k) => (k in env.store ? env.store[k] : null),
      setItem: (k, v) => { env.store[k] = String(v); env.sets.push([k, String(v)]); },
    },
    setInterval: (fn, ms) => { env.timers.push({ fn, ms }); return env.timers.length; },
    addEventListener: (t, fn) => { (env.winL[t] = env.winL[t] || []).push(fn); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(opt.src || MOD, ctx, { filename: 'focus-log.js' });
  env.ctx = ctx; env.els = els;
  env.mk = () => (env.api = ctx.TwFocusLog.createFocusLog({
    formatHMS: (s) => 'T' + s,
    rolloverFocusToday: () => { env.rollCalls++; return env.today; },
    bringWinToFront: (id) => env.fronts.push(id),
    escRegisterWindow: (w) => env.escs.push(w),
    focusTotalSec: () => env.total,
    focusSessionSec: () => env.session,
  }));
  env.tick = () => env.timers.forEach(t => t.fn());
  env.win = () => els.focusLogWin;
  env.on = () => els.focusLogOverlay.classList.contains('on');
  env.fireWin = (t, ev) => (env.winL[t] || []).forEach(fn => fn(ev || {}));
  return env;
}

/* 2~5절 — 7절(일부러 깨 보기)이 망가뜨린 글로 다시 굴린다 */
function behave(src){
  const E = (o) => mkEnv(Object.assign({ src }, o || {}));

  say('── 2. 열기 · 닫기');
  {
    const e = E(); e.mk();
    const w = e.win();
    e.els.fsFocusLogBtn.onclick();
    chk(e.on() && JSON.stringify(e.fronts) === '["focusLogOverlay"]', '[기록 열기] — 창이 뜨고 맨 앞으로(focusLogOverlay)');
    chk(!e.els.focusSettingsPanel.classList.contains('on'), '  ⚙️ 설정창은 닫는다');
    chk(e.els.focusLogCaption.textContent === '현재 기록' && e.els.focusLogTime.textContent === 'T65' && e.els.focusLogOk.textContent === '누적기록', '  현재 기록부터(이번 실행 시간) · 버튼은 «누적기록»');
    chk(e.els.focusLogRow2.style.display === 'none' && !w.classList.contains('total') && e.rollCalls === 0, '  둘째 줄(오늘 기록)은 숨김 · 오늘 기록은 안 읽는다');
    chk(e.els.focusLogTitleTxt.textContent === '포커스 기록' && !w.classList.contains('mini') && !e.sets.length, '  제목 «포커스 기록» · 미니미 아님 · 저장값은 안 쓴다');
    e.els.focusLogOk.onclick();
    chk(e.els.focusLogCaption.textContent === '누적 기록' && e.els.focusLogTime.textContent === 'T3600' && e.els.focusLogOk.textContent === '현재기록', '누적기록 — 누적 기록 · 버튼은 «현재기록»');
    chk(e.els.focusLogCaption2.textContent === '오늘 기록' && e.els.focusLogTime2.textContent === 'T1800' && e.els.focusLogRow2.style.display === 'flex' && w.classList.contains('total') && e.rollCalls === 1,
      '  둘째 줄 오늘 기록(자정 넘김 판정을 거쳐 읽음) · .total');
    e.els.focusLogOk.onclick();
    chk(e.els.focusLogCaption.textContent === '현재 기록' && e.els.focusLogRow2.style.display === 'none' && !w.classList.contains('total'), '한 번 더 — 현재 기록으로');
    e.els.focusLogOk.onclick();
    e.els.focusLogClose.onclick();
    chk(!e.on(), '✕ — 닫힘');
    e.els.fsFocusLogBtn.onclick();
    chk(e.els.focusLogCaption.textContent === '현재 기록' && e.fronts.length === 2, '누적에서 닫았어도 다시 열면 현재 기록부터 · 다시 맨 앞으로');
    const esc = e.escs[0];
    chk(e.escs.length === 1 && esc.key === 'focusLog' && esc.el === e.els.focusLogOverlay && esc.isOpen() === true, 'ESC 스택 — key focusLog · el 은 오버레이 · 열림을 DOM 으로 읽음');
    esc.close();
    chk(!e.on() && esc.isOpen() === false, '  ESC 로 닫힘');
  }

  say('── 3. 매초 갱신');
  {
    const e = E(); e.mk();
    chk(e.timers.length === 1 && e.timers[0].ms === 1000, '타이머 하나 · 1초');
    e.session = 70; e.tick();
    chk(e.els.focusLogTime.textContent === '', '닫혀 있으면 안 그린다');
    e.els.fsFocusLogBtn.onclick();
    e.session = 71; e.tick();
    chk(e.els.focusLogTime.textContent === 'T71', '열려 있으면 지금 값(현재 기록)을 다시 읽는다');
    e.els.focusLogOk.onclick();
    e.total = 3700; e.today = 0; e.tick();
    chk(e.els.focusLogTime.textContent === 'T3700' && e.els.focusLogTime2.textContent === 'T0', '  누적 탭이면 누적 · 오늘 기록(날짜 넘김 뒤 0)을 다시 읽는다');
    const n = e.rollCalls; e.els.focusLogClose.onclick(); e.tick();
    chk(e.rollCalls === n, '  닫힌 뒤엔 오늘 기록도 안 읽는다');
  }

  say('── 4. 미니미');
  {
    const e = E(); e.mk();
    const w = e.win();
    let stopped = 0;
    e.els.focusLogMin.onclick({ stopPropagation(){ stopped++; } });
    chk(w.classList.contains('mini') && e.store['tw.focusLogMini'] === '1' && stopped === 1, '_ — 미니미 · 저장(1) · 누름은 위로 안 올림(끌기 아님)');
    chk(e.els.focusLogTitleTxt.textContent === '기록' && w.style.transform === undefined, '  제목 «기록» · 닫혀 있으면 좌표는 안 건드린다');
    e.els.fsFocusLogBtn.onclick();
    chk(e.els.focusLogCaption.textContent === '현재' && e.sets.length === 1, '미니미로 열림 — 라벨 두 글자 · 열 때는 다시 저장 안 함');
    e.els.focusLogBody.fire('click');
    chk(e.els.focusLogCaption.textContent === '누적' && e.els.focusLogCaption2.textContent === '오늘', '미니미에서 본문 누름 — 누적 · 오늘 (짧은 라벨)');
    e.rect = { left: 410, top: 220 };
    e.els.focusLogMax.onclick({ stopPropagation(){ stopped++; } });
    chk(!w.classList.contains('mini') && e.store['tw.focusLogMini'] === '0' && stopped === 2, '□ — 원래 크기 · 저장(0)');
    chk(w.style.transform === 'none' && w.style.left === '410px' && w.style.top === '220px', '  열려 있으면 좌상단을 고정(오른쪽 · 아래로만 늘어남)');
    chk(e.els.focusLogCaption.textContent === '누적 기록' && e.els.focusLogTitleTxt.textContent === '포커스 기록', '  모드는 그대로 · 긴 라벨로');
    e.els.focusLogBody.fire('click');
    chk(e.els.focusLogCaption.textContent === '누적 기록', '원래 크기에선 본문 누름이 아무것도 안 한다');
    const m = E({ mini: true }); m.mk();
    m.els.fsFocusLogBtn.onclick();
    chk(m.win().classList.contains('mini') && m.els.focusLogTitleTxt.textContent === '기록' && !m.sets.length, '지난번 미니미였으면 미니미로 연다 · 다시 저장 안 함');
  }

  say('── 5. 화면 안 가두기 · 끌기');
  {
    const e = E(); e.mk();
    const w = e.win(), clamp = e.ctx._focusLogClamp;
    chk(typeof clamp === 'function', 'window._focusLogClamp — 👑 달성표 · 🍅 뽀모 서랍이 부른다');
    clamp();
    chk(w.style.left === undefined && w.style.top === undefined, '  한 번도 안 옮긴(중앙정렬) 창은 안 건드린다');
    w.style.transform = 'none'; w.style.left = '790px'; w.style.top = '-30px';
    clamp();
    chk(w.style.left === '570px' && w.style.top === '0px', '  옮긴 창은 화면 안으로(800−230 · 0)');
    e.els.fsFocusLogBtn.onclick();
    w.style.left = '700px'; e.els.focusLogMin.onclick({ stopPropagation(){} });
    chk(w.style.left === '300px', '  열린 채 미니미로 바꾸면 지금 자리(좌상단)로 다시 고정');
    e.els.focusLogMax.onclick({ stopPropagation(){} });
    const t = e.els.focusLogTitle;
    e.rect = { left: 100, top: 50 };
    const evX = { clientX: 10, clientY: 10, target: { closest: (s) => (s === '.flt-x' ? {} : null) } };
    t.fire('mousedown', evX);
    e.fireWin('mousemove', { clientX: 60, clientY: 60 });
    chk(w.style.left === '300px' && !evX._pd, '_ □ ✕ 위에서 누른 건 끌기가 아니다');
    const ev = { clientX: 10, clientY: 10 };
    t.fire('mousedown', ev);
    chk(w.style.transform === 'none' && w.style.left === '100px' && w.style.top === '50px' && ev._pd === true, '타이틀바 누름 — 지금 자리에서 절대좌표로');
    e.fireWin('mousemove', { clientX: 60, clientY: 40 });
    chk(w.style.left === '150px' && w.style.top === '80px', '  끄는 만큼 옮김');
    e.fireWin('mousemove', { clientX: 2000, clientY: -500 });
    chk(w.style.left === '570px' && w.style.top === '0px', '  화면 밖으로는 못 나감');
    e.fireWin('mouseup');
    e.fireWin('mousemove', { clientX: 20, clientY: 20 });
    chk(w.style.left === '570px', '  놓으면 끝');
  }
}

(async () => {
const sec = (t, fn) => { say(t); try{ fn(); }catch(e){ chk(false, '예외 — ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' / ')); } };

sec('── 1. 만들 때', () => {
  const e = mkEnv();
  chk(Object.keys(e.ctx.TwFocusLog).join() === 'createFocusLog' && typeof e.ctx.TwFocusLog.createFocusLog === 'function', '싣기만 하면 window.TwFocusLog(createFocusLog) 하나뿐');
  chk(!e.escs.length && !e.timers.length && !e.els.fsFocusLogBtn.onclick && !('_focusLogClamp' in e.ctx), '  싣기만 해서는 아무것도 안 건다');
  const api = e.mk();
  chk(api && typeof api === 'object' && !Object.keys(api).length, '만들면 빈 객체 — 밖에서 부르는 이름 없음');
  chk(['fsFocusLogBtn', 'focusLogClose', 'focusLogMin', 'focusLogMax', 'focusLogOk'].every(id => typeof e.els[id].onclick === 'function'), '  버튼 다섯 연결([기록 열기] · ✕ · _ · □ · 누적기록)');
  chk((e.els.focusLogBody._L.click || []).length === 1 && (e.els.focusLogTitle._L.mousedown || []).length === 1, '  본문 누름 · 타이틀바 누름');
  chk((e.winL.mousemove || []).length === 1 && (e.winL.mouseup || []).length === 1, '  window mousemove · mouseup');
  chk(e.escs.length === 1 && e.timers.length === 1 && typeof e.ctx._focusLogClamp === 'function', '  ESC 등록 · 매초 타이머 · window._focusLogClamp');
  chk(!e.on() && !e.sets.length, '  만들기만 해서는 안 열리고 저장값도 안 쓴다');
  const n = mkEnv({ noDom: true });
  const r = n.mk();
  chk(r && !Object.keys(r).length && !n.escs.length && !n.timers.length && !('_focusLogClamp' in n.ctx) && !n.winL.mousemove, '창 DOM 이 없으면 아무것도 안 건다(예전 if(!overlay||!win) return)');
});

try{ behave(MOD); }catch(e){ chk(false, '예외 — ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' / ')); }

sec('── 6. app.js 배선', () => {
  const code = strip(APP);
  const defs = /function bindFocusLog\(|MINI_KEY='tw\.focusLogMini'|function (clampWin|setMini|refreshTime|openLog|closeLog)\(/;
  chk(!defs.test(code) && defs.test(MOD), '포커스 기록 팝업 정의는 모듈에만');
  chk(/window\.TwFocusLog = api/.test(MOD) && (code.match(/TwFocusLog\.createFocusLog\(/g) || []).length === 1, '모듈은 window.TwFocusLog · 만드는 곳은 한 곳');
  const iHead = APP.indexOf('/* ═══ 🕒 포커스 기록 팝업 ═══ */'), iMk = APP.indexOf('TwFocusLog.createFocusLog('), iNext = APP.indexOf('/* ═══ ✥ 프로그램 이동 모드 ═══ */');
  const iPrev = APP.lastIndexOf('})();', iHead);
  /* 광고 배너 설정 묶음은 settings-panel.js 로 옮겼다(앱 FSD 27번) — 그 뒤엔 app.js 에서 설정 패널 모듈 만드는 줄이 바로 앞이다 */
  const RAW = SRC['app.js'], rHead = RAW.indexOf('/* ═══ 🕒 포커스 기록 팝업 ═══ */'), rPrev = RAW.lastIndexOf('\n});', rHead);
  const afterSettings = rHead > 0 && rPrev > 0 && /^\s*$/.test(RAW.slice(rPrev + 4, rHead)) && /TwSettingsPanel\.createSettingsPanel\(/.test(RAW.slice(RAW.lastIndexOf('\nconst ', rPrev), rPrev));
  const afterBanner = /^\s*\n\s*$/.test(APP.slice(iPrev + 5, iHead)) && /refreshFsAdBanner/.test(APP.slice(iPrev - 600, iPrev));
  chk(iHead > 0 && iMk > iHead && iNext > iMk && (afterBanner || afterSettings),
    '원래 자리 — 광고 배너 설정 묶음(지금은 설정 패널 모듈 만드는 줄) 뒤 · 구역 머리 아래 · ✥ 프로그램 이동 모드 앞');
  const call = (APP.match(/TwFocusLog\.createFocusLog\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  const want = [
    /^formatHMS: \(\.\.\.a\)=>formatHMS\(\.\.\.a\),$/, /^rolloverFocusToday: \(\.\.\.a\)=>_rolloverFocusToday\(\.\.\.a\),$/,
    /^bringWinToFront: \(\.\.\.a\)=>bringWinToFront\(\.\.\.a\),$/, /^escRegisterWindow: \(\.\.\.a\)=>escRegisterWindow\(\.\.\.a\),$/,
    /^focusTotalSec: \(\)=>_focusTotalSec,$/, /^focusSessionSec: \(\)=>_focusSessionSec,$/,
  ];
  const bad = want.map((re, i) => re.test(deps[i] || '') ? null : (i + ':' + (deps[i] || '없음'))).filter(Boolean);
  chk(deps.length === want.length && !bad.length, 'deps 6개 — 함수는 화살표 · let 은 읽는 함수 (' + deps.length + (bad.length ? ' · 어긋남 ' + bad[0] : '') + ')');
  const iT = APP.indexOf('let _focusTotalSec='), iS = APP.indexOf('let _focusSessionSec=');
  chk(iT > iMk && iS > iMk && /[^.\w]_focusTotalSec\s*=[^=]/.test(code.replace(/let _focusTotalSec=/, '')) && /[^.\w]_focusSessionSec\s*[+-]?=[^=]/.test(code.replace(/let _focusSessionSec=/, '')),
    '  _focusTotalSec · _focusSessionSec 는 만드는 줄보다 뒤에 선언 · 다시 대입되는 let — 그래서 읽는 함수(값이면 TDZ)');
  const m = strip(MOD);
  chk(/formatHMS\(_focusTotalSec\(\)\)/.test(m) && /formatHMS\(_focusSessionSec\(\)\)/.test(m) && !/formatHMS\(_focus(Total|Session)Sec\)/.test(m), '모듈은 누적 · 현재 기록을 그릴 때마다 읽는다');
  chk(!/[^.\w]_focus(Total|Session|Today)Sec\s*[+-]?=[^=]/.test(m.replace(/const _focus(Total|Session)Sec = deps\.focus(Total|Session)Sec;/g, '')), '  모듈은 포커스 시간에 쓰지 않는다');
  const off = (APP.match(/const FOCUS_LOG_OFF = (\{[^\n]*?\});/) || [])[1];
  chk(!/\bFOCUS_LOG_OFF\b/.test(APP), '빈 껍데기 FOCUS_LOG_OFF 없음 — 모듈은 늘 싣는다(가드 걷기 3차)');
  const iR = HTML.indexOf('<script src="parts/room/room-invite-ui.js"></script>'), iF = HTML.indexOf('<script src="parts/focus/focus-log.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iR > 0 && iF > iR && iA > iF, 'html — focus-log.js 를 app.js 앞에 싣는다');
  chk(/^Tw[A-Z]/.test('TwFocusLog') && !/window\.FocusLog\s*=/.test(MOD), '전역 이름은 Tw 접두사(#103 — 크로미움 내장 전역과 겹치지 않게)');
  const wire = (APP.match(/const FOCUS_LOG_OFF = [\s\S]*?\n\}\);/) || [''])[0];
  let got = null; try{ got = vm.runInNewContext(wire + '\nfocusLog;', {}); }catch(_){}
  chk(/^const focusLog = TwFocusLog\.createFocusLog\(\{/m.test(APP), '만드는 줄에 «없으면 빈 껍데기» 가드가 없다 — 모듈이 안 실리면 그 줄에서 멈춘다(가드 걷기 3차)');
});

sec('── 7. 일부러 깨 보기 — 이 검사가 헛돌지 않는가', () => {
  const CASES = [
    ['누적 기록을 값으로', s => s.replace('formatHMS(_focusTotalSec())', 'formatHMS(_focusTotalSec)')],
    ['현재 기록을 값으로', s => s.replace('formatHMS(_focusSessionSec())', 'formatHMS(_focusSessionSec)')],
    ['열 때 현재 기록부터 안 함', s => s.replace("logMode='session';   // 열 때마다", "// logMode='session';   // 열 때마다")],
    ['맨 앞으로 안 올림', s => s.replace("bringWinToFront('focusLogOverlay');", ';')],
    ['설정창 안 닫음', s => s.replace("if(panel) panel.classList.remove('on');", '')],
    ['미니미 저장 키', s => s.replace("MINI_KEY='tw.focusLogMini'", "MINI_KEY='focusLogMini'")],
    ['열 때 다시 저장', s => s.replace('setMini(miniOn, {persist:false});', 'setMini(miniOn);')],
    ['좌상단 고정 빠짐', s => s.replace("win.style.transform='none'; win.style.left=r.left+'px'; win.style.top=r.top+'px';\n    }\n    win.classList.toggle", "}\n    win.classList.toggle")],
    ['미니미 아닌데 본문 누름 토글', s => s.replace("if(!win.classList.contains('mini')) return;", '')],
    ['닫혀도 매초 갱신', s => s.replace("if(overlay.classList.contains('on')) refreshTime();", 'refreshTime();')],
    ['중앙정렬 창도 가둠', s => s.replace("if(win.style.transform==='none' && win.style.left){", 'if(true){')],
    ['끌기 가두기 빠짐', s => s.replace("win.style.left=Math.max(0,Math.min(innerWidth-win.offsetWidth, baseX+e.clientX-startX))+'px';", "win.style.left=(baseX+e.clientX-startX)+'px';")],
    ['✕ 위 누름도 끌기', s => s.replace("if(e.target.closest && e.target.closest('.flt-x')) return;", '')],
    ['놓아도 계속 끌림', s => s.replace('window.addEventListener(\'mouseup\', ()=>{ dragging=false; });', '')],
    ['오늘 기록 라벨', s => s.replace("cap2El.textContent = mini?'오늘':'오늘 기록'", "cap2El.textContent = mini?'오늘':'오늘'")],
    ['ESC 닫기 다른 함수', s => s.replace('close:closeLog,', 'close:()=>{},')],
    ['_focusLogClamp 안 검', s => s.replace('try{ window._focusLogClamp = clampWin; }catch(_){}', '')],
  ];
  for(const [name, mut] of CASES){
    const bent = mut(MOD);
    if(bent === MOD){ chk(false, name + ' — 망가뜨릴 글을 못 찾음(본문이 바뀌었다)'); continue; }
    quiet = true; qfail = 0;
    try{ behave(bent); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 잡힘(' + qfail + ')');
  }
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
/* 판정 줄 없이 끝나면 빨강 */
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
