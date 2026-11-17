/* ═══ 🪟 sim-window-mode.js — 창 모드 정하기 · 활성 앱 판정(launcher/window-mode.js · app.js 분리 M22) ═══════════════
   ・1절: applyDesktopRunClass — 데스크탑이 아니면 아무 일 없음 · 화면을 보고 모드(run · launcher · creator · myhome) · runmode · config 클래스 · 바닥 · 그림자 · main 에 보내는 값
   ・2절: myHomeOpen — 읽는 · 쓰는 함수 · 오버레이 .on 이 곧 «마이홈이 떠 있다»
   ・3절: _applyActiveAppState — 상태 없음 · 누적(조건 · 상한) · 집중 끝남 알림 · 달성표 · 플랫폼 · 게이트(focus-gate.js 규칙) · 자기 창 · 펜 앱
   ・4절: 연결 — 옛 이름 · deps 모양 · 만드는 줄
   ・5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('launcher/window-mode.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
const GATE_SRC = read('focus/focus-gate.js');
if(!SRC || !APP || !HTML || !GATE_SRC){ say('  ? 원본 못 찾음'); process.exit(2); }
const FOCUS_GATE = (() => { const w = {}; new Function('window', 'module', GATE_SRC)(w, undefined); return w.TwFocusGate; })();   // 진짜 «창이 앞이면 안 잠듦» 규칙
function mkEl(){ const cl = new Set(); return { classList: { add: (c) => cl.add(c), remove: (c) => cl.delete(c), contains: (c) => cl.has(c), toggle: (c, on) => { on ? cl.add(c) : cl.delete(c); } } }; }
function build(src, o){
  o = o || {};
  const els = { launcher: mkEl(), myHomeOverlay: mkEl(), inviteOverlay: mkEl() }; const body = mkEl(); const sent = [];
  if(o.launcherOn) els.launcher.classList.add('on'); if(o.mhOn) els.myHomeOverlay.classList.add('on'); if(o.lobbyOn) els.inviteOverlay.classList.add('on');
  const doc = { getElementById: (i) => els[i] || null, body };
  const t = { now: 0 }; const log = [];
  const st = { creator: !!o.creator, mode: o.appMode || 'run', gate: null, fig: !!o.fig, mob: !!o.mob, last: 0, self: null, pen: null, secs: 0, chal: [], plat: undefined, ended: 0 };
  const deps = { appModeMod: { appMode: () => st.mode }, creatorOpen: () => st.creator, desktopMode: o.desktop !== false, floor: { visible: true }, focusGate: FOCUS_GATE, focusProgressMod: () => ({ focusEnded: () => { st.ended++; } }), setFocusGateSleep: (v) => { st.gate = v; },
    focusLevelMod: { _mobileOn: () => st.mob, addFocusSeconds: (d) => { st.secs += d; } }, focusWindowMs: () => 1500, key: { castShadow: null }, mhStLayoutMod: { _mhStickerOverhang: () => 'EXTRA' },
    officeModeMod: { figureMode: () => st.fig }, seatStateMod: { lastActivity: () => st.last, setSelfAppActive: (v) => { st.self = v; }, setPenAppFocused: (v) => { st.pen = v; } },
    weeklyChal: { focusTick: (s, d) => st.chal.push(d), setKeyPlatform: (p) => { st.plat = p; } } };
  const win = { companion: o.noCompanion ? undefined : { setConfigMode: (c, m, e) => sent.push([c, m, e]) } };
  const g = { window: win, document: doc, performance: { now: () => t.now }, FrameBudget: { castShadowFor: (r) => 'shadow:' + r }, companion: win.companion, module: undefined };
  const names = Object.keys(g);
  new Function(...names, src)(...names.map(n => g[n]));
  const mod = win.TwWindowMode.createWindowMode(deps);
  return { mod, els, body, sent, st, t, deps, log };
}
say('§1 applyDesktopRunClass');
{
  let b = build(SRC, { desktop: false, launcherOn: true }); b.mod.applyDesktopRunClass();
  chk(b.sent.length === 0 && !b.body.classList.contains('config'), '데스크탑이 아니면 아무 일도 없다');
  b = build(SRC, {}); b.mod.applyDesktopRunClass();
  chk(b.body.classList.contains('runmode') && !b.body.classList.contains('config') && b.deps.floor.visible === false && b.deps.key.castShadow === 'shadow:true' && b.sent[0].join() === 'false,run,', '실행 화면 — runmode · 바닥 숨김 · 그림자 규칙 · main 에 (false, run)');
  b = build(SRC, { launcherOn: true }); b.mod.applyDesktopRunClass();
  chk(!b.body.classList.contains('runmode') && b.body.classList.contains('config') && b.deps.floor.visible === true && b.sent[0][0] === true && b.sent[0][1] === 'launcher', '런처 — config · 바닥 보임 · (true, launcher)');
  b = build(SRC, { creator: true }); b.mod.applyDesktopRunClass();
  chk(b.sent[0][1] === 'creator' && b.sent[0][0] === true, '생성기가 열려 있으면 creator(런처 여부와 무관)');
  b = build(SRC, { launcherOn: true, mhOn: true }); b.mod.applyDesktopRunClass();
  chk(b.sent[0][1] === 'myhome' && b.sent[0][2] === 'EXTRA', '★ 런처에서 마이홈이 떠 있으면(오버레이 .on) myhome · 넘친 스티커 값을 같이 보낸다');
  b = build(SRC, { mhOn: true }); b.mod.applyDesktopRunClass();
  chk(b.sent[0][1] === 'run', '실행 화면 안에서 연 마이홈은 창 크기를 안 키운다(run 그대로)');
  b = build(SRC, { launcherOn: true, lobbyOn: true }); b.mod.applyDesktopRunClass();
  chk(b.sent[0][1] === 'myhome' && b.sent[0][2] === null, '★ 런처에서 방 찾기 · 만들기(로비)가 떠 있으면 마이홈 크기 — 넘친 스티커 값은 마이홈일 때만');
  b = build(SRC, { launcherOn: true, creator: true, mhOn: true }); b.mod.applyDesktopRunClass();
  chk(b.sent[0][1] === 'creator', '우선순위 — creator > myhome > launcher > run');
  b = build(SRC, { appMode: 'editseat' }); b.mod.applyDesktopRunClass();
  chk(!b.body.classList.contains('runmode') && b.sent[0][0] === false && b.sent[0][1] === 'run', '좌석 세팅 모드는 runmode 클래스를 안 켠다(창 모드는 run)');
  b = build(SRC, { noCompanion: true, launcherOn: true }); let th = null; try{ b.mod.applyDesktopRunClass(); }catch(e){ th = e; }
  chk(!th && b.body.classList.contains('config'), 'companion 이 없어도 던지지 않고 클래스는 정한다');
}
say('§2 myHomeOpen');
{
  const b = build(SRC, { launcherOn: true });
  chk(b.mod.myHomeOpen() === false, '처음엔 닫힘');
  b.mod.setMyHomeOpen(true); b.mod.applyDesktopRunClass();
  chk(b.mod.myHomeOpen() === true && b.sent[0][1] === 'myhome', '깃발만 켜져도(오버레이 확인 전) 런처에서는 myhome');
  const b2 = build(SRC, {}); b2.mod.setMyHomeOpen(true); b2.mod.applyDesktopRunClass();
  chk(b2.sent[0][1] === 'run', '런처가 아니면 깃발이 켜져도 run');
}
say('§3 _applyActiveAppState');
{
  let b = build(SRC, {}); b.mod._applyActiveAppState(null);
  chk(b.st.gate === null && b.st.self === null, '상태가 없으면 아무 일 없음');
  b = build(SRC, {}); b.t.now = 1000; b.st.last = 900;
  b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true });
  chk(b.st.secs === 0 && b.st.gate === false, '첫 폴링은 누적 안 함(직전에 «활동 중» 이 아니었음) · 게이트 열림(등록 앱이 활성)');
  b.t.now = 2000; b.st.last = 1900;
  b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true });
  chk(Math.abs(b.st.secs - 1) < 1e-9 && b.st.chal.length === 2 && Math.abs(b.st.chal[1] - 1) < 1e-9, '직전에 활동 중이고 입력이 최근이면 흐른 시간(1초)을 쌓는다 · 달성표는 «등록 앱이 활성이었나» 와 무관하게 입력이 최근이면 매 폴링 센다(첫 폴링 포함 2번)');
  b.t.now = 4000; b.st.last = 100;
  b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true });
  chk(Math.abs(b.st.secs - 1) < 1e-9, '입력이 오래전이면(캐릭터가 idle) 안 쌓는다');
  b.t.now = 4000 + 31000; b.st.last = 34990;
  b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true });
  chk(Math.abs(b.st.secs - 1) < 1e-9, '폴링이 30초 넘게 끊겼으면(dt ≥ 30) 건너뛴다');
  b = build(SRC, { fig: true }); b.t.now = 1000; b.st.last = 900; b.mod._applyActiveAppState({ hasAnyRegistered: false });
  b.t.now = 2000; b.st.last = 1900; b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true });
  chk(b.st.secs === 0 && b.st.chal.length === 0 && b.st.gate === false, '★ 피규어 모드면 쌓지 않고 달성표도 안 센다 · 게이트는 늘 열림');
  b = build(SRC, {}); b.mod._applyActiveAppState({ hasAnyRegistered: false });
  chk(b.st.gate === true, '등록된 앱이 없으면 게이트 닫힘(잠듦)');
  b = build(SRC, {}); b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: false });
  chk(b.st.gate === true, '등록 앱이 있지만 지금 활성이 아니면 닫힘');
  b = build(SRC, { mob: true }); b.mod._applyActiveAppState({ hasAnyRegistered: false });
  chk(b.st.gate === false, '📱 폰이 켜져 있으면 게이트 열림');
  b = build(SRC, {}); b.mod._applyActiveAppState({ key: 'win:chrome.exe', isSelf: true, isPenApp: true, hasAnyRegistered: true, isFocusedAppRegistered: false });
  chk(b.st.plat === 'win' && b.st.self === true && b.st.pen === true && b.st.gate === null, '플랫폼 접두사 · 자기 창 · 펜 앱을 알린다 · 투게더워킹 창이 앞이면 게이트는 직전 값 그대로(focus-gate nextGateSleep null)');
  b = build(SRC, {}); b.mod._applyActiveAppState({ isSelf: true, hasAnyRegistered: true, isFocusedAppRegistered: true });
  chk(b.st.self === false && b.st.gate === false, '  자기를 포커싱 어플로 등록했으면 «등록 앱» 으로 본다(자기 창 아님 · 게이트 열림)');
  b = build(SRC, {}); b.t.now = 1000; b.st.last = 900; b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true });
  b.t.now = 2000; b.st.last = 1900; b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true });
  chk(b.st.ended === 0, '쌓는 동안에는 집중 끝남 알림이 없다');
  b.t.now = 3000; b.st.last = 2900; b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: false });
  b.t.now = 4000; b.st.last = 3900; b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: false });
  b.t.now = 5000; b.st.last = 4900; b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: false });
  chk(b.st.ended === 1, '  쌓다가 멈추면 집중 끝남을 한 번만 알린다(focus-progress focusEnded)');
  b = build(SRC, {}); b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true });
  chk(b.st.plat === undefined && b.st.self === false && b.st.pen === false, '구버전 main(key · isSelf 없음)은 플랫폼을 안 정하고 자기 창 false');
}
say('§4 연결');
{
  const iM = HTML.indexOf('<script src="parts/launcher/window-mode.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iM > 0 && iA > iM, 'html — window-mode.js 를 app.js 보다 먼저 싣는다');
  const code = stripC(APP);
  const pairs = depPairs(APP, 'windowModeMod', 'TwWindowMode', 'createWindowMode');
  const shape = (n, v) => n === 'creatorOpen' ? v === '()=>creatorOpen' : n === 'focusProgressMod' ? v === '()=>focusProgressMod' : n === 'focusGate' ? v === 'TwFocusGate' : n === 'setFocusGateSleep' ? v === '(v)=>{ focusGateSleep = v; }' : v === n;
  chk(!!pairs && pairs.length === 14 && pairs.every(([n, v]) => shape(n, v)), '★ deps 14개 모양 — 읽는 함수 둘(creatorOpen · focusProgressMod) · 쓰는 함수 하나 · 게이트 규칙 TwFocusGate · 값 열(이미 만들어진 것)');
  const bad = pairs ? pairs.map(([n, v]) => n === 'creatorOpen' ? [n, 'creatorOpen'] : [n, v]) : [];
  chk(!bad.every(([n, v]) => shape(n, v)), '  깨 보기: 읽는 함수를 값으로 넘기면 빨강');
  chk(/^const _applyActiveAppState = windowModeMod\._applyActiveAppState;/m.test(code) && /^const applyDesktopRunClass = windowModeMod\.applyDesktopRunClass;/m.test(code) && !/function (_applyActiveAppState|applyDesktopRunClass)\b/.test(code) && !/^let myHomeOpen\b/m.test(code), '옛 이름 둘을 const 로 받고 본문 · let 이 안 남음');
  chk(/setMyHomeOpen: \(v\)=>\{ windowModeMod\.setMyHomeOpen\(v\); \}/.test(code) && (code.match(/windowModeMod\.myHomeOpen\(\)/g) || []).length >= 3, 'myHomeOpen 은 읽는 · 쓰는 함수로 읽고 쓴다');
  const iMk = code.indexOf('const windowModeMod = TwWindowMode'), iDr = code.indexOf('const desktopRunMod = TwDesktopRun');
  chk(iMk > 0 && iDr > iMk, '만드는 줄이 desktop-run 만드는 줄보다 앞(_applyActiveAppState 를 deps 로 넘기기 전)');
}
say('§5 일부러 깨 보기');
{
  const brk = (a, c) => { const m = SRC.replace(a, c); return m === SRC ? null : m; };
  const m1 = brk("const mode = creatorOpen() ? 'creator' : (showMyHomeSized ? 'myhome' : (launcherOn ? 'launcher' : 'run'));", "const mode = creatorOpen() ? 'creator' : (launcherOn ? 'launcher' : 'run');");
  chk(!!m1 && (() => { const b = build(m1, { launcherOn: true, mhOn: true }); b.mod.applyDesktopRunClass(); return b.sent[0][1] === 'launcher'; })(), 'myhome 모드를 빼면 빨강');
  const m2 = brk("!notFocusingNow && dt>0 && dt<30;", "!notFocusingNow && dt>0;");
  chk(!!m2 && (() => { const b = build(m2, {}); b.t.now = 1000; b.st.last = 900; b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true }); b.t.now = 35000; b.st.last = 34900; b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true }); return b.st.secs > 30; })(), 'dt 상한(30초)을 빼면 빨강');
  const m3 = brk("if(!desktopMode) return;", "");
  chk(!!m3 && (() => { const b = build(m3, { desktop: false, launcherOn: true }); b.mod.applyDesktopRunClass(); return b.sent.length === 1; })(), '데스크탑 확인을 빼면 빨강');
  const m4 = brk("{ figureMode: officeModeMod.figureMode(), mobOn }", "{ figureMode: false, mobOn }");
  chk(!!m4 && (() => { const b = build(m4, { fig: true }); b.mod._applyActiveAppState({ hasAnyRegistered: false }); return b.st.gate === true; })(), '피규어 모드 게이트를 빼면 빨강');
  const m5 = brk("  else if(_focusAccruedLast) focusProgressMod().focusEnded();", "");
  chk(!!m5 && (() => { const b = build(m5, {}); b.t.now = 1000; b.st.last = 900; b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true }); b.t.now = 2000; b.st.last = 1900; b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: true }); b.t.now = 3000; b.mod._applyActiveAppState({ hasAnyRegistered: true, isFocusedAppRegistered: false }); return b.st.ended === 0; })(), '집중 끝남 알림을 빼면 빨강');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);
