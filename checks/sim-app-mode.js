/* ═══ 🖥 sim-app-mode.js — 런처 ↔ 실행 화면 전환(launcher/app-mode.js · app.js 분리 M13) ═══════════════
   [왜] appMode · applyAppMode · launchApp · backToLauncher 를 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: applyAppMode — 모드별 화면 요소 · 제목 · 창 크기 맞춤 부르기
   ・2절: launchApp — 캐릭터 없음 · 좌석 다시 만들기 · edit/run 모드 · 방에 있을 때 친구 복원 · def 가 달라졌을 때만 방에 알림 · 솔로 자리 추가 복원 · Tab 힌트
   ・3절: backToLauncher — 모드 되돌리기 · 꾸미기 · 마이홈 닫기 · 서버 맞추기 셋
   ・4절: 연결 — html 순서 · 만드는 줄 · deps 모양(값 / 읽는 함수 / 함수) · appMode 를 읽는 자리(값의 주인은 launcher-state.js — 이 모듈은 바꾸기만)
   ・5절: mutation test
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('launcher/app-mode.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), LS = read('launcher/launcher-state.js');
if(!SRC || !APP || !HTML || !LS){ say('  ? 원본 못 찾음 — app-mode.js · launcher-state.js · app.js · desk-companion-prototype.html'); process.exit(2); }
/* 🧭 진짜 런처 상태(launcher-state.js) — 앱 모드 · 마이홈 열림을 이 모듈이 바꾸는지 그 값으로 본다 */
const mkLauncherState = () => { const w = {}; new Function('window', 'module', LS)(w, undefined); return w.TwLauncherState.createLauncherState(); };

function mkEl(){ const cl = new Set(); return { style: {}, textContent: '', classList: { add: (c) => cl.add(c), remove: (c) => cl.delete(c), contains: (c) => cl.has(c), has: (c) => cl.has(c) } }; }
function build(src, o){
  o = o || {};
  const log = [], els = {}, timers = [];
  const el = (id) => (id === 'toLauncher' && o.noButton) ? null : (els[id] = els[id] || mkEl());
  const bodyCl = new Set(o.bodyClasses || []);
  const document = { getElementById: el, body: { classList: { contains: (c) => bodyCl.has(c) } } };
  const slots = o.slots || [{ name: 'A' }, { name: 'B' }];
  const seats = o.seats || [];
  const st = { curSlot: o.curSlot || 0, hint: null, presence: o.presence || null, extra: o.extra || [] };
  const ls = mkLauncherState(); if(o.myHomeOpen) ls.setMyHomeOpen(true);
  const deps = {
    applyCharToSeat: (s, d) => log.push('apply:' + (d && d.name)), applyDesktopRunClass: () => log.push('runClass'), createSeat: () => ({ group: {}, id: 'me' }),
    curSlot: () => st.curSlot, myhomeStore: { flush: () => log.push('mhFlush') },
    layoutSeats: () => log.push('layout'), launcherState: ls,
    overheadMod: { removeSeatLabels: (s) => log.push('rmLabels') }, Presence: () => ({ active: () => !!st.presence, friendsObj: () => ({ f: 1 }), myDef: () => st.presence && st.presence.def, updateDef: (d) => log.push('updateDef:' + d.name) }),
    renderLauncher: () => log.push('renderLauncher'), rideBenchMod: { _resetIdeskRestore: () => log.push('resetIdesk'), unmountBench: () => {} },
    roomEntryMod: () => ({ syncFriendSeats: (f) => log.push('syncFriends') }), scene: { remove: (g) => log.push('sceneRemove') },
    seatPanelMod: { selectSeat: (s) => log.push('select'), renderSeatTabs: () => log.push('tabs'), setManual: (v) => log.push('manual:' + v) },
    seats, settingsMod: { extraSeatSlots: () => st.extra, addExtraSeat: (i) => log.push('extra:' + i), closeSettings: () => log.push('closeSettings') }, slots,
    statusChipMod: { _tabHintTimer: () => st.hint, setTabHintTimer: (t) => { st.hint = t; } },
    closeWardrobe: () => log.push('closeWardrobe'), commitMyHomePage: (f) => log.push('commitMyHome:' + f), _bgmDestroy: () => log.push('bgmDestroy'), _mhDsClose: () => log.push('dsClose'),
    toast: (m) => log.push('toast:' + m),
  };
  const win = {};
  const g = { _mhGbStopWatch: () => log.push('gbStop') };
  const names = ['window', 'document', 'console', 'module', 'setTimeout', 'clearTimeout', '_mhGbStopWatch'];
  const fakeSet = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  new Function(...names, src)(win, document, { log(){}, warn(){}, error(){} }, undefined, fakeSet, () => {}, g._mhGbStopWatch);
  const mod = win.TwAppMode.createAppMode(deps);
  return { mod, ls, log, els, st, seats, slots, timers, win, bodyCl };
}

say('§1 applyAppMode');
{
  const b = build(SRC);
  b.mod.applyAppMode();
  chk(b.ls.appMode() === 'run' && b.els.seatEditor.style.display === 'none' && b.els.statePrev.style.display === 'none' && b.els.runHint.style.display === '' && b.els.devHint.style.display === 'none', 'run — 좌석 슬라이더 · 상태 미리보기 · dev 힌트를 숨기고 run 힌트를 보인다');
  chk(b.els.devFiles.style.display === 'none' && b.els.appTitle.textContent === '🪴 책상 친구들' && b.log.includes('runClass'), '  GLB 교체 도구는 늘 숨김 · 제목 · 창 크기 맞춤(applyDesktopRunClass)을 부른다');
  const b2 = build(SRC, { seats: [{ group: {} }] }); b2.mod.launchApp({ mode: 'edit' });
  chk(b2.ls.appMode() === 'editseat' && b2.els.seatEditor.style.display === '' && b2.els.statePrev.style.display === '' && b2.els.appTitle.textContent === '🪑 좌석 세팅' && b2.els.runHint.style.display === 'none', 'editseat — 좌석 슬라이더 · 상태 미리보기를 보이고 제목이 바뀐다');
}
say('§2 launchApp');
{
  { const bs = build(SRC, { slots: [{ name: 'A' }] }); bs.mod.launchApp(); chk(bs.log.includes('closeSettings'), '⚙️ 런처에서 연 설정 창(가운데)을 닫고 실행 화면으로 간다'); }
  let b = build(SRC, { slots: [] }); b.mod.launchApp();
  chk(b.log.length === 1 && b.log[0].startsWith('toast:먼저 캐릭터를') && b.ls.appMode() === 'run', '슬롯에 캐릭터가 없으면 안내만 하고 돌아간다(좌석 · 화면을 안 건드림)');
  b = build(SRC, { slots: [null, { name: 'B' }] }); b.mod.launchApp();
  chk(b.log.includes('apply:B'), '고른 칸이 비면 처음 있는 슬롯을 쓴다');
  const old = [{ group: { id: 1 } }, { group: { id: 2 } }];
  b = build(SRC, { seats: old.slice(), curSlot: 1 }); b.mod.launchApp();
  chk(b.log.filter(l => l === 'sceneRemove').length === 2 && b.log.filter(l => l === 'rmLabels').length === 2 && b.seats.length === 0 + b.seats.length && b.seats.every(s => !old.includes(s)), '옛 좌석을 씬에서 빼고 라벨도 지운다');
  chk(b.log.includes('apply:B') && b.log.includes('select') && b.log.includes('tabs') && b.log.includes('manual:null') && b.log.includes('layout'), '내 좌석에 고른 칸의 def 를 입히고 좌석 탭 · 배치를 다시 한다');
  chk(!b.els.launcher.classList.contains('on') && b.ls.appMode() === 'run', '런처를 닫는다(on 클래스 제거)');
  // 방에 있을 때
  const def = { name: 'A' };
  b = build(SRC, { slots: [def], presence: { def } }); b.mod.launchApp();
  chk(b.log.includes('syncFriends') && !b.log.some(l => l.startsWith('updateDef')), '방에 있으면 친구 좌석을 복원하고, 방에 나간 def 와 같으면 아무것도 안 보낸다');
  b = build(SRC, { slots: [def], presence: { def: { name: 'OLD' } } }); b.mod.launchApp();
  chk(b.log.includes('updateDef:A'), '★ 방에 나간 def 와 달라졌으면 새 def 를 방에 보낸다');
  b = build(SRC, { slots: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], curSlot: 0, extra: [0, 1, 5] }); b.mod.launchApp();
  chk(b.log.filter(l => l.startsWith('extra:')).join() === 'extra:1' && !b.log.includes('syncFriends'), '솔로 — 저장해 둔 자리 추가 중 주캐릭터 칸과 겹치는 것 · 비어 있는 칸은 빼고 복원한다');
  // Tab 힌트
  b = build(SRC); b.mod.launchApp();
  chk(b.timers.length === 1 && b.timers[0].ms === 1200 && b.st.hint !== null, 'run — 1.2초 뒤 Tab 힌트 타이머를 건다');
  b.bodyCl.add('runmode'); b.els.myStatusChip = mkEl(); b.els.myStatusChip.classList.add('collapsed'); b.timers[0].fn();
  chk(b.st.hint === null && b.log.includes('toast:상태칩이 안 보이면 Tab 키를 눌러보세요'), '  칩이 접혀 있으면 안내하고 타이머 표시를 비운다');
  b = build(SRC); b.mod.launchApp(); b.bodyCl.add('runmode'); b.els.myStatusChip = mkEl(); b.timers[0].fn();
  chk(!b.log.some(l => l.startsWith('toast:상태칩')), '  칩이 펼쳐져 있으면 안내하지 않는다');
  b = build(SRC); b.mod.launchApp({ mode: 'edit' });
  chk(b.timers.length === 0, 'edit 모드는 Tab 힌트를 안 건다');
}
say('§3 backToLauncher');
{
  let b = build(SRC); b.mod.launchApp({ mode: 'edit' }); b.log.length = 0;
  b.els.launcher.classList.remove('on'); b.els.wardrobePanel = mkEl(); b.els.wardrobePanel.classList.add('on'); b.els.wdPreviewPanel = mkEl(); b.els.wdPreviewPanel.classList.add('on');
  b.els.myHomeOverlay = mkEl(); b.els.myHomeOverlay.classList.add('on'); b.ls.setMyHomeOpen(true);
  b.mod.backToLauncher();
  chk(b.ls.appMode() === 'run' && b.els.launcher.classList.contains('on'), '모드를 run 으로 되돌리고 런처를 켠다');
  chk(b.log.includes('closeSettings'), '⚙️ 실행 화면에서 연 설정 창(머리 위)을 닫는다 — 런처 위에 남지 않게');
  chk(b.log.includes('closeWardrobe') && !b.els.wardrobePanel.classList.contains('on') && !b.els.wdPreviewPanel.classList.contains('on'), '꾸미기 창이 켜져 있으면 closeWardrobe 로 닫아 저장하고 미리보기도 끈다');
  chk(b.log.includes('commitMyHome:true') && b.log.indexOf('mhFlush') === b.log.indexOf('commitMyHome:true') + 1 && !b.els.myHomeOverlay.classList.contains('on') && b.ls.myHomeOpen() === false && b.log.includes('gbStop') && b.log.includes('bgmDestroy') && b.log.includes('dsClose'), '마이홈이 켜져 있으면 저장하고(못 올린 고침은 상태 주인 flush 한 번) 닫는다(방명록 감시 · BGM · 스튜디오 정리 포함)');
  chk(b.log.includes('resetIdesk') && b.log.includes('renderLauncher') && !b.log.some(l => /Sync:/.test(l)) && b.log[b.log.length - 1] === 'runClass', '런처를 다시 그린 뒤 창 크기를 맞춘다(포커스 · 달성표 · 가챠는 서버가 원본 — 런처 경계에서 맞추지 않는다)');
  b = build(SRC); b.mod.backToLauncher();
  chk(!b.log.some(l => l === 'closeWardrobe' || l.startsWith('commitMyHome') || l === 'mhFlush'), '꾸미기 · 마이홈이 안 켜져 있으면 닫기 부름이 없다');
  b = build(SRC, { seats: [] }); b.st.hint = 77; b.mod.backToLauncher();
  chk(b.st.hint === null, 'Tab 힌트 타이머가 남아 있으면 지운다');
}
say('§4 연결');
{
  const iM = HTML.indexOf('<script src="parts/launcher/app-mode.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iM > 0 && iA > iM, 'html — app-mode.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  const mk = (APP.match(/const appModeMod = TwAppMode\.createAppMode\(\{\n([\s\S]*?)\n\}\);/) || [])[1];
  chk(!!mk, 'app.js — 만든다');
  chk(['showEl', 'applyAppMode', 'launchApp', 'backToLauncher'].every(n => new RegExp('^const ' + n + ' = appModeMod\\.' + n + ';', 'm').test(code)), '  옛 이름 넷을 const 로 받는다');
  chk(!/function (showEl|applyAppMode|launchApp|backToLauncher)\b|^let appMode\b/m.test(code), '  app.js 에 본문이 안 남음');
  const pairs = (mk || '').split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]]);
  const READ = ['curSlot', 'Presence', 'roomEntryMod'], FN = ['applyDesktopRunClass', 'toast', 'layoutSeats', 'closeWardrobe', 'commitMyHomePage', '_bgmDestroy', '_mhDsClose'];
  const shape = (n, v) => n === 'launcherState' ? v === 'launcherStateMod' : n === 'myhomeStore' ? v === 'myhomeStoreMod' : READ.includes(n) ? v === '()=>' + n : FN.includes(n) ? (v === '(...a)=>' + n + '(...a)' || v === '(...a)=>window.' + n + '(...a)') : v === n;
  chk(pairs.length === 23 && pairs.every(([n, v]) => shape(n, v)), '★ deps 23개 모양 — 읽는 함수 셋은 ()=>이름 · 함수 일곱(window 고리 넷 포함)은 (...a)=>…(...a) · 쓰는 함수 하나 · 상태 주인 myhomeStore · 값은 이름 그대로' + (pairs.length === 23 ? '' : ' — ' + pairs.length + '개'));
  const bad = (mk || '').replace('  curSlot: ()=>curSlot,', '  curSlot: curSlot,');
  const p2 = bad.split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]]);
  chk(!p2.every(([n, v]) => shape(n, v)), '  mutation test: 읽는 함수를 값으로 넘기면 빨강');
  const WM = (read('launcher/window-mode.js') || '').replace(/\/\*[\s\S]*?\*\//g, ' ');
  chk((code.match(/launcherStateMod\.appMode\(\)/g) || []).length >= 2 && /launcherState\.appMode\(\)==='run'/.test(WM) && !/appModeMod\.appMode\b/.test(code + WM), '  읽는 자리(app.js · window-mode.js)가 런처 상태 launcherStateMod.appMode() 를 부른다(함수째 비교하는 실수 방지 · app-mode 를 바라보지 않음)');
  const S = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(!/\blet appMode\b|(?<!const )\bappMode\s*=[^=]|^  appMode:/m.test(S) && /^const launcherState = deps\.launcherState;/m.test(S), '  app-mode.js 는 앱 모드를 들지도 내놓지도 않는다 — 주인은 launcher-state.js(바꾸기만 setAppMode)');
}
say('§5 mutation test');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk("launcherState.setAppMode((opts.mode==='edit') ? 'editseat' : 'run');", "launcherState.setAppMode('run');");
  chk(!!m1 && (() => { const b = build(m1); b.mod.launchApp({ mode: 'edit' }); return b.ls.appMode() === 'run'; })(), 'edit 모드를 못 가리면 빨강');
  const m2 = brk("if(Presence().myDef() !== myDef) Presence().updateDef(myDef);", "Presence().updateDef(myDef);");
  chk(!!m2 && (() => { const def = { name: 'A' }; const b = build(m2, { slots: [def], presence: { def } }); b.mod.launchApp(); return b.log.some(l => l.startsWith('updateDef')); })(), '같은 def 도 방에 보내면 빨강');
  const m3 = brk("  launcherState.setAppMode('run');\n  settingsMod.closeSettings();", "  settingsMod.closeSettings();");
  chk(!!m3 && (() => { const b = build(m3); b.mod.launchApp({ mode: 'edit' }); b.mod.backToLauncher(); return b.ls.appMode() !== 'run'; })(), '런처로 돌아갈 때 모드를 되돌리지 않으면 빨강');
  const m3s = brk("  settingsMod.closeSettings();   // ⚙️ 실행 화면에서 연 설정 창(머리 위)이 런처 위에 남지 않게\n", "");
  chk(!!m3s && (() => { const b = build(m3s); b.mod.backToLauncher(); return !b.log.includes('closeSettings'); })(), '런처로 돌아갈 때 설정 창을 안 닫으면 빨강');
  const m4 = brk(" myhomeStore.flush();", "");
  chk(!!m4 && (() => { const b = build(m4); b.els.myHomeOverlay = mkEl(); b.els.myHomeOverlay.classList.add('on'); b.mod.backToLauncher(); return !b.log.includes('mhFlush'); })(), '마이홈 닫을 때 상태 주인 flush 를 빼면 빨강');
  const m5 = brk("closeWardrobe(); }catch(_){} }", "}catch(_){} }");
  chk(!!m5 && (() => { const b = build(m5); b.els.wardrobePanel = mkEl(); b.els.wardrobePanel.classList.add('on'); b.mod.backToLauncher(); return !b.log.includes('closeWardrobe'); })(), '꾸미기 창을 closeWardrobe 로 닫지 않으면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
