/* sim-win-drag.js — 🖱 수동 창 끌기(win-drag.js · main.js 조립 · 렌더러 세 곳) — 제보 B-1122-2
   실행:  node checks/run.js sim-win-drag
   ★ 왜 — 배율이 다른 모니터 사이로 마이홈 · 실행 화면 손잡이를 끌면 창이 떨리고 크기가 변했다.
     렌더러 화면 좌표의 차(dx, dy)를 지금 창 사각형에 더하던 길이라, 좌표가 흔들리면 그대로 쌓이고 OS 가 반올림한 크기도 쌓였다.
   ・1절: win-drag.js 를 가짜 창 · 마우스로 돌린다 — 자리 = 시작 자리 + 마우스가 간 만큼 · 크기는 시작 크기 고정 · 끝 · 취소
   ・2절: main.js 의 조립(_winDrag · _refitConfigForZoom · _rememberPos …)을 떼어 와 돌린다 — 끄는 동안 자리 기억 · 끝나면 놓인 모니터에 맞춤
   ・3절: 배선(IPC · preload · 렌더러 세 곳 · 창 닫힘 · blur · setConfigMode 건너뛰기) · 4절: mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'apps/desktop/' + f, '../' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const WD = read('win-drag.js'), MAIN = read('main.js'), PRE = read('preload.js'), MHUI = read('myhome-ui.js'), MHDT = read('myhome-desktop.js'), RUN = read('desktop-run.js'), PKG = read('package.json');
const PAD = read('mh-pad-pos.js');
if (!WD || !MAIN || !PRE || !MHUI || !MHDT || !RUN || !PKG || !PAD) { say('  ? 원본 못 찾음 — win-drag.js · main.js · preload.js · myhome-ui.js · myhome-desktop.js · desktop-run.js · package.json · mh-pad-pos.js'); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports); return m.exports; };
const J = JSON.stringify;

/* 가짜 창 — drift: setBounds 를 받을 때마다 OS 가 크기를 1씩 키워 돌려준다(배율 경계의 반올림을 흉내) */
function stage(src, opt){
  const o = opt || {};
  const E = { cur: { x: 500, y: 400 }, win: { x: 100, y: 50, width: 800, height: 580 }, sets: [], moves: [], ends: [] };
  const D = load(src).createWinDrag({
    getCursor: () => ({ x: E.cur.x, y: E.cur.y }),
    getBounds: () => Object.assign({}, E.win),
    setBounds: (r) => { E.sets.push(Object.assign({}, r)); E.win = o.drift ? { x: r.x, y: r.y, width: r.width + 1, height: r.height + 1 } : Object.assign({}, r); },
    onMove: (r) => E.moves.push(Object.assign({}, r)),
    onEnd: (r) => E.ends.push(Object.assign({}, r)),
  });
  E.D = D; E.to = (x, y) => { E.cur = { x, y }; D.move(); };
  return E;
}

say('── 1. win-drag.js');
{
  const e = stage(WD);
  chk(e.D.active() === false, '처음엔 끌고 있지 않다');
  e.D.move(); e.D.end();
  chk(e.sets.length === 0 && e.ends.length === 0, '  시작 없이 온 move · end 는 아무것도 안 한다');
  e.D.start();
  chk(e.D.active() === true && e.sets.length === 0, '시작 — 창은 아직 안 움직인다');
  e.D.move();
  chk(e.sets.length === 0 && e.moves.length === 0, '  마우스가 그대로면 창을 건드리지 않는다');
  e.to(530, 390);
  chk(J(e.sets[0]) === J({ x: 130, y: 40, width: 800, height: 580 }) && J(e.moves[0]) === J(e.sets[0]), '★ 자리 = 시작 창 자리 + (지금 마우스 − 시작 마우스) · 크기는 시작 크기');
  e.to(530, 390);
  chk(e.sets.length === 1, '  같은 자리면 다시 놓지 않는다');
  e.to(-200, 900);
  chk(J(e.sets[1]) === J({ x: -600, y: 550, width: 800, height: 580 }), '  음수 좌표(왼쪽 모니터)도 같은 식');
  e.cur = { x: -190, y: 900 }; e.D.end();
  chk(e.D.active() === false && e.sets.length === 3 && e.sets[2].x === -590 && e.ends.length === 1 && J(e.ends[0]) === J(e.sets[2]), '★ 끝 — 마지막 마우스 자리로 한 번 더 놓고 onEnd(마지막 사각형) 한 번');
  e.to(0, 0); e.D.end();
  chk(e.sets.length === 3 && e.ends.length === 1, '  끝난 뒤의 move · end 는 무시');
}
{
  const e = stage(WD, { drift: true });
  e.D.start();
  for (let i = 1; i <= 40; i++) e.to(500 + i * 10, 400 + i);
  e.D.end();
  const lastSet = e.sets[e.sets.length - 1];
  chk(e.sets.length === 40 && e.sets.every(r => r.width === 800 && r.height === 580) && lastSet.x === 500 && lastSet.y === 90,
    '★ OS 가 크기를 조금씩 다르게 돌려줘도(배율 경계) 넣는 크기는 늘 시작 크기 · 자리도 밀리지 않는다 (' + lastSet.width + 'x' + lastSet.height + ' @' + lastSet.x + ',' + lastSet.y + ')');
}
{
  const e = stage(WD);
  e.D.start(); e.D.end();
  chk(e.ends.length === 0 && e.sets.length === 0, '누르기만 하고 뗌 — onEnd 없음(맞출 것이 없다)');
  e.D.start(); e.to(510, 400);
  e.cur = { x: 700, y: 700 }; e.win = { x: 0, y: 0, width: 300, height: 200 };   // 뗌 신호를 못 받은 채 다른 창 상태에서 다시 시작
  e.D.start();
  chk(e.ends.length === 1 && e.D.active() === true, '★ 끝 신호 없이 다시 시작 — 앞 끌기를 닫고(onEnd) 새로 시작');
  e.to(710, 700);
  chk(J(e.sets[e.sets.length - 1]) === J({ x: 10, y: 0, width: 300, height: 200 }) && e.sets.length === 2, '  앞 끌기를 닫을 때 창을 옮기지 않는다(튀지 않음) · 새 끌기는 새 시작점 기준');
  e.D.cancel();
  chk(e.D.active() === false && e.ends.length === 1, '★ cancel — 창을 건드리지 않고 끌기만 놓는다(onEnd 없음)');
  const n = e.sets.length; e.to(900, 900);
  chk(e.sets.length === n, '  cancel 뒤 move 는 무시');
}

say('── 2. main.js 조립 — 끄는 동안 자리 기억 · 끝나면 놓인 모니터에 맞춤');
function grabFn(src, name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}
const DRAG_DEF = (MAIN.match(/const _winDrag = createWinDrag\(\{[\s\S]*?\n\}\);/) || [''])[0];
const NAMES = ['_refitConfigForZoom', '_rememberPos', '_mhPadDip', '_modeSize', '_fitConfigRect', '_sameRect', '_cfgModeForZoom', '_configModeNow'];
function mainStage(mainSrc, wdSrc){
  const def = (mainSrc.match(/const _winDrag = createWinDrag\(\{[\s\S]*?\n\}\);/) || [''])[0];
  const parts = NAMES.map(n => grabFn(mainSrc, n));
  if (!def || parts.some(x => !x)) return null;
  /* 모니터 둘 — 왼쪽 큰 것(0..2560), 오른쪽 작은 것(2560..3840 · 높이 700: 마이홈 580 은 들어가고 런처 680 은 꽉 참) */
  const DISP = [{ workArea: { x: 0, y: 0, width: 2560, height: 1400 } }, { workArea: { x: 2560, y: 0, width: 1280, height: 500 } }];
  const E = { cur: { x: 400, y: 300 }, win: null, sets: [], logs: [], saves: 0 };
  const api = new Function('createWinDrag', 'MhPadPos', 'E', 'DISP',
    'let uiZoom = 1, _mhPad = { x: 0, y: 0 }, _mhPadApplied = { x: 0, y: 0 }, _curMode = "myhome", _isConfigMode = true; const savedPos = {};\n'
    + 'const MODE_SIZE = { launcher:{ w:380, h:680 }, myhome:{ w:800, h:580 } };\n'
    + 'const screen = { getCursorScreenPoint: () => ({ x: E.cur.x, y: E.cur.y }), getDisplayMatching: (r) => (r.x + r.width / 2 >= 2560 ? DISP[1] : DISP[0]) };\n'
    + 'const _noteApplied = () => {}, _diagLog = (m) => E.logs.push(m), _saveLauncherPosSoon = () => { E.saves++; };\n'
    + 'const mainWindow = { isDestroyed: () => false, getBounds: () => Object.assign({}, E.win), setResizable(){}, setBounds(r){ E.win = Object.assign({}, r); E.sets.push(E.win); } };\n'
    + parts.join('\n') + '\n' + def
    + '\nreturn { drag: _winDrag, saved: savedPos, mode(m){ _curMode = m; _isConfigMode = m !== "run"; }, pad(p){ _mhPad = p; _mhPadApplied = p; } };')(load(wdSrc || WD).createWinDrag, load(PAD), E, DISP);
  E.api = api;
  E.dragTo = (x, y) => { api.drag.start(); E.cur = { x, y }; api.drag.move(); };
  return E;
}
{
  const e = mainStage(MAIN);
  if (!e) chk(false, 'main.js 에서 _winDrag 조립 · 함수들을 못 찾음');
  else {
    e.win = { x: 200, y: 100, width: 800, height: 580 };
    e.dragTo(700, 350);
    chk(J(e.api.saved.myhome) === J({ x: 500, y: 150 }), '★ 끄는 동안 그 모드의 자리를 기억한다(끌기 도중 · 뒤의 setConfigMode 가 옛 자리로 되돌리지 않게)');
    e.api.drag.end();
    chk(J(e.win) === J({ x: 500, y: 150, width: 800, height: 580 }) && !e.logs.some(l => /끌기 끝/.test(l)), '  같은 모니터 · 작업영역 안이면 끝에서 더 건드리지 않는다');
    /* 오른쪽 작은 모니터(높이 500)로 — 580 이 안 들어간다 → 끝에서 크기 · 자리를 그 작업영역에 맞춘다 */
    e.cur = { x: 700, y: 350 };
    e.dragTo(3000, 380);
    const mid = Object.assign({}, e.win);
    e.api.drag.end();
    chk(mid.height === 580 && J(e.win) === J({ x: 2800, y: 0, width: 800, height: 500 }) && J(e.api.saved.myhome) === J({ x: 2800, y: 0 }) && e.logs.some(l => /끌기 끝 — myhome 창 크기 맞춤 800x500/.test(l)),
      '★ 작업영역이 작은 모니터에 놓으면 끝에서 한 번 맞춘다(끄는 동안은 시작 크기) · 맞춘 자리를 기억 (' + J(e.win) + ')');
    /* 마이홈 스티커 여백 — 기억은 여백을 뺀 자리 */
    e.api.pad({ x: 40, y: 20 });
    e.win = { x: 300, y: 300, width: 880, height: 620 }; e.cur = { x: 600, y: 600 };
    e.dragTo(650, 600); e.api.drag.end();
    chk(J(e.api.saved.myhome) === J({ x: 390, y: 320 }), '  마이홈은 여백을 뺀 자리로 기억(_rememberPos 한 곳)');
    /* 런처 — 다음 실행 자리 저장도 같은 길 */
    e.api.pad({ x: 0, y: 0 }); e.api.mode('launcher');
    e.win = { x: 100, y: 100, width: 380, height: 680 }; e.cur = { x: 200, y: 200 };
    const s0 = e.saves; e.dragTo(260, 210); e.api.drag.end();
    chk(J(e.api.saved.launcher) === J({ x: 160, y: 110 }) && e.saves > s0, '  런처도 같은 길(다음 실행 자리 저장)');
    /* 실행 화면(run) — 옮기기만 한다 */
    e.api.mode('run');
    e.win = { x: 0, y: 0, width: 2560, height: 1400 }; e.cur = { x: 10, y: 10 };
    const before = J(e.api.saved), n = e.logs.length;
    e.dragTo(60, 40); e.api.drag.end();
    chk(J(e.win) === J({ x: 50, y: 30, width: 2560, height: 1400 }) && J(e.api.saved) === before && e.logs.length === n, '★ 실행 화면은 옮기기만 — 자리 기억 · 맞춤 없음');
  }
}

say('── 3. 배선');
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const mainC = code(MAIN);
chk(/const \{ createWinDrag \} = require\('\.\/win-drag'\);/.test(MAIN) && !!DRAG_DEF, 'main 이 win-drag 를 싣고 끌기 하나를 만든다');
chk(/getCursor: \(\) => screen\.getCursorScreenPoint\(\)/.test(DRAG_DEF), '★ 마우스 자리는 main 이 읽는다(렌더러 화면 좌표를 받지 않는다)');
{
  const h = (MAIN.match(/ipcMain\.on\('companion:dragWindow', \(e, phase\) => \{[\s\S]*?\n  \}\);/) || [''])[0];
  chk(/if \(!mainWindow \|\| mainWindow\.isDestroyed\(\)\) return;/.test(h) && /phase === 'start'\) _winDrag\.start\(\);/.test(h) && /phase === 'move'\) _winDrag\.move\(\);/.test(h) && /else _winDrag\.end\(\);/.test(h),
    'IPC companion:dragWindow — start · move · 그 밖은 end(창이 없으면 무시)');
}
chk(!/companion:moveWindow/.test(mainC) && !/moveWindow/.test(code(PRE)) && /dragWindow\(phase\) \{\s*ipcRenderer\.send\('companion:dragWindow', phase\);/.test(PRE), '옛 길(moveWindow — dx · dy 더하기)은 없다 · preload 는 dragWindow(phase)');
{
  const am = grabFn(MAIN, '_applyConfigMode') || '';
  const iSkip = am.indexOf('if(_winDrag.active()) return;'), iPad = am.indexOf("if(mode==='myhome') _mhPad = _mhPadOf(extra);"), iRem = am.indexOf('let remembered = savedPos[mode];'), iMode = am.indexOf('_curMode = isConfig');
  chk(iSkip > 0 && iMode >= 0 && iMode < iSkip && iPad >= 0 && iPad < iSkip && iSkip < iRem && am.indexOf('mainWindow.setBounds(cfgRect)') > iSkip,
    '★ 같은 모드로 끄는 동안 setConfigMode(config)는 창을 건드리지 않는다 — 모드 · 여백은 먼저 적고, 자리 계산 · setBounds 앞에서 돌아간다(실제로 돌리는 것은 sim-cfg-fit 3-c)');
}
chk(/mainWindow\.on\('closed', \(\) => \{\s*_winDrag\.cancel\(\);/.test(MAIN), '★ 창이 닫히면 끌기를 놓는다(새 창의 setConfigMode 가 막히지 않게)');
chk(/mainWindow\.on\('blur', \(\) => \{\s*try\{ _winDrag\.end\(\); \}catch\(_\)\{\}/.test(MAIN), '★ 다른 창으로 넘어가면(blur) 끌기를 닫는다(뗌 신호를 못 받아도)');
for (const [name, src] of [['myhome-ui.js', MHUI], ['myhome-desktop.js', MHDT], ['desktop-run.js', RUN]]) {
  const c = code(src);
  chk(/companion\.dragWindow\('start'\)/.test(c) && /companion\.dragWindow\('move'\)/.test(c) && /companion\.dragWindow\('end'\)/.test(c) && !/moveWindow/.test(c),
    name + ' — 누름 start · 움직임 move · 뗌 end 를 보낸다(옛 moveWindow 없음)');
}
chk(!/screenX|screenY/.test(code(RUN).slice(code(RUN).indexOf("#deskBar .grip"), code(RUN).indexOf("getElementById('deskGear')"))), '  실행 화면 손잡이는 화면 좌표(screenX)를 쓰지 않는다');
chk(/lostpointercapture', endDrag\)/.test(MHUI) && /lostpointercapture', end\)/.test(MHDT) && /const end=e=>\{ if\(!dragging\) return; if\(osMove\) companion\.dragWindow\('end'\);/.test(MHDT), '★ 마이홈 두 곳 — 포인터 잡기를 잃어도(lostpointercapture — 끄는 중 창 닫힘 · 다시 그림) end · 두 번 보내지 않는다');
chk(/pointercancel', endDrag\)/.test(MHUI) && /if\(dragMovesOsWindow\) companion\.dragWindow\('end'\);/.test(MHUI) && /pointercancel', end\)/.test(MHDT),
  '  마이홈 두 곳 — 뗌 · 취소(pointercancel) 모두 end');
{ let pk = {}; try { pk = JSON.parse(PKG).build || {}; } catch (_) {}
  chk((pk.files || []).includes('win-drag.js'), '설치본 — win-drag.js 가 build.files 에'); }

say('── 4. mutation test');
const mut = (name, a, b, bad) => {
  const src = WD.replace(a, b);
  if (src === WD) { chk(false, 'mutation test — ' + name + ' (바꿀 글을 못 찾음)'); return; }
  let r = false; try { r = bad(src); } catch (_) { r = true; }
  chk(r, 'mutation test — ' + name + ' → 빨강');
};
mut('지금 창 크기를 다시 넣으면(옛 길) 크기가 쌓인다', 'width: from.rect.width, height: from.rect.height };', 'width: getBounds().width, height: getBounds().height };',
  (s) => { const e = stage(s, { drift: true }); e.D.start(); for (let i = 1; i <= 40; i++) e.to(500 + i * 10, 400); return e.sets[e.sets.length - 1].width !== 800; });
mut('시작점이 아니라 앞 자리에 더하면 OS 반올림이 쌓인다', 'x: from.rect.x + (c.x - from.cx)', 'x: getBounds().x + (c.x - from.cx)',
  (s) => { const e = stage(s); e.D.start(); e.to(510, 400); e.to(520, 400); return e.sets[1].x !== 120; });
mut('끝에서 놓지 않으면(active 남음) setConfigMode 가 계속 건너뛴다', '    from = null; last = null;\n    if(moved) onEnd(moved);', '    last = null;\n    if(moved) onEnd(moved);',
  (s) => { const e = stage(s); e.D.start(); e.to(510, 400); e.D.end(); return e.D.active() === true; });
mut('다시 시작할 때 앞 끌기를 지금 마우스 자리로 옮기면 창이 튄다', '    if(from) close();', '    if(from) end();',
  (s) => { const e = stage(s); e.D.start(); e.to(510, 400); e.cur = { x: 900, y: 900 }; e.D.start(); return e.sets.length !== 1; });
mut('안 움직였는데 onEnd 를 부르면 누를 때마다 창을 맞춘다', 'if(moved) onEnd(moved);', 'onEnd(moved || from);',
  (s) => { const e = stage(s); e.D.start(); e.D.end(); return e.ends.length !== 0; });
mut('다시 시작할 때 앞 끌기를 안 닫으면 onEnd 가 빠진다', '    if(from) close();', '',
  (s) => { const e = stage(s); e.D.start(); e.to(510, 400); e.D.start(); return e.ends.length === 0; });
{
  const noRem = MAIN.replace("  onMove: (r) => { const m = _cfgModeForZoom(); if(m) _rememberPos(m, r); },", '  onMove: () => {},');
  const e = noRem !== MAIN ? mainStage(noRem) : null;
  let bad = false;
  if (e) { e.win = { x: 200, y: 100, width: 800, height: 580 }; e.dragTo(700, 350); bad = e.api.saved.myhome === undefined; }
  chk(!!e && bad, 'mutation test — 끄는 동안 자리 기억을 빼면 기억이 비어 있다 → 빨강');
  const noFit = MAIN.replace("  onEnd: () => { const m = _cfgModeForZoom(); if(m) _refitConfigForZoom(m, '끌기 끝'); },", '  onEnd: () => {},');
  const f = noFit !== MAIN ? mainStage(noFit) : null;
  let bad2 = false;
  if (f) { f.win = { x: 200, y: 100, width: 800, height: 580 }; f.dragTo(3000, 380); f.api.drag.end(); bad2 = f.win.height === 580; }
  chk(!!f && bad2, 'mutation test — 끝 맞춤을 빼면 작은 모니터에서 창이 작업영역을 넘는다 → 빨강');
}

say('\n' + (fail ? '✗' : '✓') + ' sim-win-drag: ' + pass + ' 통과 · ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
