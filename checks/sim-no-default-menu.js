/* ═══ ⌨️ sim-no-default-menu.js — 일렉트론 기본 메뉴 단축키를 막는다 (개정 256 신설) ═══════════════════════
   [제보] 방명록 창에서 Ctrl+- 가 일렉트론 기본 메뉴의 Zoom Out 으로 들어가 방명록만 작아졌다. 기본 메뉴가 살아 있어
     Ctrl+R · Ctrl+Shift+I · F11 · Ctrl+W 도 모든 창에서 먹었다.
   ・1절: 자리 — 앱 시작 때 메뉴를 정하고(창보다 먼저 · 한 곳) · 자식 창마다 줌을 묶는다 · 메인 창 F12(devtools-gate) · applyUiZoom 은 그대로
   ・2절: main.js 원문(APP_MENU_TEMPLATE · _applyAppMenu)을 가짜 Menu 위에서 돌린다 — win32/linux 는 null ·
          darwin 은 앱 메뉴(quit) + editMenu 둘뿐
   ・3절: 원문(_zoomKeyOp · _lockChildZoom)을 가짜 webContents 에 걸고 가짜 입력을 넣는다 — 줌 키 · 휠은 막고 100% 로 되돌림 ·
          다른 키는 그대로 통과
   [실행] main.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
let MAIN = null; for(const p of ['main.js', path.join(__dirname, 'main.js')]){ try{ MAIN = fs.readFileSync(p, 'utf8'); break; }catch(_){} }
if(!MAIN){ say('  ? 원본 못 찾음 — main.js'); process.exit(2); }
const grab = (name) => { const i = MAIN.indexOf('function ' + name + '('); if(i < 0) return ''; let k = MAIN.indexOf('{', i), d = 0;
  for(; k < MAIN.length; k++){ if(MAIN[k] === '{') d++; else if(MAIN[k] === '}' && --d === 0) return MAIN.slice(i, k + 1); } return ''; };
const count = (re) => (MAIN.match(re) || []).length;

say('── 1. 자리');
chk(/const \{ app, BrowserWindow, BrowserView, Menu, /.test(MAIN), 'electron 에서 Menu 를 받는다');
chk(count(/Menu\.setApplicationMenu\(/g) === 1, 'Menu.setApplicationMenu 는 한 곳(지금 ' + count(/Menu\.setApplicationMenu\(/g) + ')');
const ready = (MAIN.match(/app\.whenReady\(\)\.then\(\(\) => \{[\s\S]*?\n  \}\);/) || [''])[0];
const iMenu = ready.indexOf('_applyAppMenu();'), iWin = ready.indexOf('createWindow();');
chk(iMenu > 0 && iWin > iMenu, 'whenReady 안에서 createWindow 보다 먼저 _applyAppMenu()');
chk(count(/_applyAppMenu\(\)/g) === 2, '  _applyAppMenu 는 정의 + 부름 한 번(지금 ' + count(/_applyAppMenu\(\)/g) + ')');
const dcw = (MAIN.match(/mainWindow\.webContents\.on\('did-create-window', \(win, details\)=>\{\n([^\n]*)/) || [, ''])[1];
chk(/^\s*_lockChildZoom\(win\);/.test(dcw), 'did-create-window 첫 줄에서 모든 자식 창에 _lockChildZoom(win)');
chk(count(/_lockChildZoom\(win\)/g) === 2, '  _lockChildZoom 은 정의 + 부름 한 번(지금 ' + count(/_lockChildZoom\(win\)/g) + ')');
const mainKey = (MAIN.match(/mainWindow\.webContents\.on\('before-input-event', \(event, input\) => \{[\s\S]*?\n  \}\);/) || [''])[0];
chk(/devtoolsGate\.attach\(mainWindow\.webContents\);/.test(MAIN), '메인 창 F12 개발자 도구 토글은 devtools-gate.js 가 맡는다(설치본은 관리자 모드만 — sim-devtools-gate.js)');
chk(/const zop = _zoomKeyOp\(input\);\s*if\(zop\)\{ event\.preventDefault\(\); applyUiZoom\(zop, 'key'\); \}/.test(mainKey), '메인 창 줌 키 → applyUiZoom 그대로');
chk(/mainWindow\.webContents\.on\('zoom-changed', \(event, dir\) => \{\s*event\.preventDefault\(\);\s*applyUiZoom\(dir === 'in' \? 'in' : 'out', 'wheel'\);/.test(MAIN), '메인 창 Ctrl+휠 → applyUiZoom 그대로');

say('── 2. 메뉴 — 가짜 Menu 에서 돌린다');
const tplSrc = (MAIN.match(/const APP_MENU_TEMPLATE = ([\s\S]*?);\n/) || [, ''])[1];
const applySrc = grab('_applyAppMenu');
chk(!!tplSrc && !!applySrc, 'APP_MENU_TEMPLATE · _applyAppMenu 를 찾았다');
if(!tplSrc || !applySrc){ say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); }
const runMenu = (platform) => {
  const got = [];
  const Menu = { setApplicationMenu: (m) => got.push(m), buildFromTemplate: (t) => ({ built: t }) };
  const f = new Function('process', 'app', 'Menu', 'const APP_MENU_TEMPLATE = ' + tplSrc + ';\n' + applySrc + '\n_applyAppMenu(); return null;');
  f({ platform }, { name: 'TW' }, Menu);
  return got;
};
for(const plat of ['win32', 'linux']){
  const g = runMenu(plat);
  chk(g.length === 1 && g[0] === null, plat + ' → setApplicationMenu(null) 한 번');
}
const gm = runMenu('darwin');
const t = gm[0] && gm[0].built;
chk(gm.length === 1 && Array.isArray(t), 'darwin → 만든 메뉴를 한 번 건다');
chk(Array.isArray(t) && t.length === 2, '  최상위 메뉴는 둘뿐(지금 ' + (t ? t.length : '-') + ')');
chk(Array.isArray(t) && t[0] && Array.isArray(t[0].submenu) && t[0].submenu.length === 1 && t[0].submenu[0].role === 'quit', '  앱 메뉴 = 종료(quit) 하나');
chk(Array.isArray(t) && t[1] && t[1].role === 'editMenu' && !t[1].submenu, '  둘째 = 편집 역할(editMenu) — Cmd+C/V/X/A/Z 유지');
const roles = JSON.stringify(t || []);
chk(!/reload|toggleDevTools|zoom|resetZoom|togglefullscreen|viewMenu|windowMenu|close/i.test(roles), '  새로고침 · 개발자 도구 · 줌 · 전체화면 · 창 닫기 역할이 없다');

say('── 3. 자식 창 — 가짜 입력');
const lockSrc = grab('_lockChildZoom'), keySrc = grab('_zoomKeyOp');
chk(!!lockSrc && !!keySrc, '_lockChildZoom · _zoomKeyOp 를 찾았다');
if(!lockSrc || !keySrc){ say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); }
const mkWc = () => {
  const L = {}; const wc = { z: 1.7, sets: [], on: (n, fn) => { (L[n] = L[n] || []).push(fn); },
    setZoomFactor: (z) => { wc.z = z; wc.sets.push(z); } };
  wc.fire = (n, ...a) => { const ev = { blocked: false, preventDefault(){ ev.blocked = true; } }; (L[n] || []).forEach(fn => fn(ev, ...a)); return ev.blocked; };
  wc.n = (n) => (L[n] || []).length;
  return wc;
};
const lock = new Function(keySrc + '\n' + lockSrc + '\nreturn _lockChildZoom;')();
const wc = mkWc(); lock({ webContents: wc });
chk(wc.z === 1 && wc.sets.length === 1, '열 때 setZoomFactor(1) 한 번(1.7 → ' + wc.z + ')');
chk(wc.n('zoom-changed') === 1 && wc.n('before-input-event') === 1, '  리스너는 휠 하나 · 키 하나');
const kd = (o) => Object.assign({ type: 'keyDown', control: false, meta: false, alt: false, shift: false, key: '', code: '' }, o);
const blockedKeys = [
  ['Ctrl+-', kd({ control: true, key: '-' })], ['Ctrl+=', kd({ control: true, key: '=' })],
  ['Ctrl+Shift++', kd({ control: true, shift: true, key: '+' })], ['Ctrl+0', kd({ control: true, key: '0' })],
  ['Ctrl+Numpad-', kd({ control: true, key: '-', code: 'NumpadSubtract' })], ['Cmd+-', kd({ meta: true, key: '-' })],
];
for(const [name, inp] of blockedKeys) chk(wc.fire('before-input-event', inp) === true, '  ' + name + ' 막음');
const passKeys = [
  ['Ctrl+C', kd({ control: true, key: 'c' })], ['Ctrl+V', kd({ control: true, key: 'v' })], ['그냥 -', kd({ key: '-' })],
  ['Ctrl+Alt+-', kd({ control: true, alt: true, key: '-' })], ['Ctrl+- 뗌(keyUp)', kd({ type: 'keyUp', control: true, key: '-' })],
  ['Enter', kd({ key: 'Enter' })], ['Escape', kd({ key: 'Escape' })],
];
for(const [name, inp] of passKeys) chk(wc.fire('before-input-event', inp) === false, '  ' + name + ' 통과');
wc.z = 0.5;
chk(wc.fire('zoom-changed', 'out') === true && wc.z === 1, 'Ctrl+휠(out) 막고 100% 로 되돌림');
chk(wc.fire('zoom-changed', 'in') === true && wc.z === 1, 'Ctrl+휠(in) 막고 100%');
chk((() => { try{ lock(null); lock({}); return true; }catch(_){ return false; } })(), '창 · webContents 가 없으면 조용히 넘어간다');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
