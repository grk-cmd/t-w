/* ═══ 🍎 sim-mac-reopen.js — mac 에서 메인 창을 닫고 Dock 으로 다시 열어도 창이 동작한다 (2026-11-20 신설) ═══
   [버그] mac 은 메인 창을 닫아도 앱이 Dock 에 남는다(#1043). Dock 을 누르면 activate → createWindow 가 다시 도는데,
     IPC 처리를 createWindow 안에서 걸어서 두 번째에 «Attempted to register a second handler for 'companion:pickImage'» 로 던졌다.
   [고침] IPC · app · screen 듣기 · 전역 훅은 _setupMainOnce 가 실행마다 한 번만 건다. createWindow 는 창과 그 창의 듣기만 건다.
   ・1절: 글 — createWindow 안에 실행마다 한 번 걸 것(ipcMain · app.on · screen.on · powerMonitor · 전역 훅 · 폴링)이 없다 · _setupMainOnce 를 부른다
   ・2절: createWindow 를 가짜 Electron 위에서 두 번 돌린다 — 두 번째가 안 던지고 · 채널마다 처리기 하나 · app · screen 듣기 하나
   ・3절: 다시 연 창 — 처리기가 새 창을 쓴다(pickImage 부모 · flashFrame · moveWindow) · 창 모드가 런처 · 방명록 상태를 같이 본다
   ・4절: 끄기 붙잡기(진짜 quit-hold.js) — 창 닫기는 저장을 묻고 창만 닫는다 · 다시 연 창이 알린 뒤 Cmd+Q 를 또 붙잡는다 · 옛 창의 알림은 안 센다
   ・5절: mutation test — 진짜 main.js 글을 고쳐(등록을 createWindow 안으로 · 한 번 막기 빼기 · 모드 초기화 빼기 등) 빨강이 나는지
   [실행] 저장소 루트에서 node checks/run.js sim-mac-reopen */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

const read = (f) => { try{ return fs.readFileSync(path.join(__dirname, f), 'utf8'); }catch(_){ try{ return fs.readFileSync(f, 'utf8'); }catch(__){ return null; } } };
const MAIN0 = read('main.js'), QH = read('quit-hold.js');
if(!MAIN0 || !QH){ console.log('  ? 원본 못 찾음 — main.js · quit-hold.js'); process.exit(2); }

function fnText(src, name){
  const i = src.search(new RegExp('^function ' + name + '\\(', 'm'));
  if(i < 0) return null;
  const j = src.indexOf('\n}\n', i);
  return j < 0 ? null : src.slice(i, j + 2);
}
/* 공유 상태(let savedGbPos …)부터 _setupMainOnce 끝까지 — 이 덩어리를 그대로 돌린다 */
function blockText(src){
  const i = src.search(/^let savedGbPos = /m);
  const s = fnText(src, '_setupMainOnce');
  if(i < 0 || !s) return null;
  const j = src.indexOf(s) + s.length;
  return j > i ? src.slice(i, j) : null;
}

/* 실행마다 한 번 걸어야 하는 것 — createWindow 안에 있으면 다시 열 때 두 번 걸린다 */
const ONCE_PATTERNS = [
  [/ipcMain\.(handle|on|once)\(/, 'ipcMain 처리'],
  [/\bapp\.(on|once)\('(?!gpu-info-update')/, 'app 듣기'],
  [/\bscreen\.(on|once)\(/, 'screen 듣기'],
  [/powerMonitor\.(on|once)\(/, 'powerMonitor 듣기'],
  [/autoUpdater\.(on|once)\(/, 'autoUpdater 듣기'],
  [/globalShortcut\.register/, '전역 단축키'],
  [/sysinput\.startGlobalHooks\(/, '전역 훅'],
  [/startActiveWinPolling\(/, '활성 창 폴링'],
  [/\bsetInterval\(/, 'setInterval'],
  [/new Tray\(/, '트레이'],
];

/* ── 가짜 Electron ── */
const STUB = (() => {
  let s;
  const f = function(){ return s; };
  s = new Proxy(f, {
    get(t, k){ if(k === Symbol.toPrimitive) return (h) => h === 'number' ? 0 : ''; if(k === 'then' || k === Symbol.iterator) return undefined; return s; },
    apply(){ return s; }, construct(){ return s; },
  });
  return s;
})();
const withStub = (o) => new Proxy(o, { get(t, k){ return k in t ? t[k] : STUB; } });
function mkEmitter(){
  const L = {};
  return {
    L,
    on(ev, fn){ (L[ev] = L[ev] || []).push(fn); return this; },
    once(ev, fn){ const w = (...a) => { this.removeListener(ev, w); fn(...a); }; w.orig = fn; return this.on(ev, w); },
    removeListener(ev, fn){ L[ev] = (L[ev] || []).filter(x => x !== fn && x.orig !== fn); return this; },
    emit(ev, ...a){ (L[ev] || []).slice().forEach(fn => fn(...a)); },
    count(ev){ return (L[ev] || []).length; },
  };
}
function sandbox(src){
  const block = blockText(src);
  if(!block) return null;
  const E = { wins: [], calls: [], timers: [], dialogParents: [] };
  const ipcHandlers = {};
  const ipcOn = mkEmitter();
  const ipcMain = {
    handle(ch, fn){ if(ipcHandlers[ch]) throw new Error("Attempted to register a second handler for '" + ch + "'"); ipcHandlers[ch] = fn; },
    on(ch, fn){ ipcOn.on(ch, fn); }, once(ch, fn){ ipcOn.once(ch, fn); },
  };
  const appEm = mkEmitter();
  const app = withStub({ on: appEm.on.bind(appEm), once: appEm.once.bind(appEm), removeListener: appEm.removeListener.bind(appEm), quit: () => E.calls.push('quit') });
  const scrEm = mkEmitter();
  const screen = withStub({ on: scrEm.on.bind(scrEm), once: scrEm.once.bind(scrEm) });
  class BrowserWindow {
    constructor(opts){
      const em = mkEmitter(), wcEm = mkEmitter();
      const w = this;
      Object.assign(w, em);
      w.opts = opts; w.destroyed = false; w.flashes = []; w.bounds = []; w.top = false; w.closes = 0;
      w.webContents = withStub(Object.assign(wcEm, {
        sent: [], isDestroyed: () => w.destroyed, isCrashed: () => false,
        send(ch){ this.sent.push(ch); }, setWindowOpenHandler(fn){ w.openHandler = fn; },
      }));
      E.wins.push(w);
      w.proxy = withStub(w);
      return w.proxy;
    }
    static getAllWindows(){ return E.wins.filter(w => !w.destroyed); }
  }
  Object.assign(BrowserWindow.prototype, {
    isDestroyed(){ return this.destroyed; }, destroy(){ if(this.destroyed) return; this.destroyed = true; this.emit('closed'); },
    close(){ this.closes++; if(this.destroyed) return; let stop = false; this.emit('close', { preventDefault(){ stop = true; } }); if(!stop) this.destroy(); },
    getBounds(){ return { x: 10, y: 20, width: 300, height: 200 }; }, setBounds(b){ this.bounds.push(b); },
    flashFrame(on){ this.flashes.push(on); }, isFocused(){ return false; }, isMinimized(){ return false; },
    isAlwaysOnTop(){ return this.top; }, setAlwaysOnTop(on){ this.top = !!on; }, loadFile(){}, focus(){},
  });
  const dialog = withStub({ showOpenDialog: (a, b) => { E.dialogParents.push(b ? a : null); return Promise.resolve({ canceled: true }); } });
  const sysinput = withStub({ startGlobalHooks: () => E.calls.push('hooks'), nativeLoadFailed: () => [], stopGlobalHooks: () => E.calls.push('stopHooks') });
  const overlay = withStub({ layeredState: () => 'blocked(test)', alpha: () => 128, applyLayered(){}, TOP_LEVEL: 'screen-saver' });
  const mod = { exports: {} };
  new Function('module', 'exports', QH)(mod, mod.exports);
  const V = { mainWindow: null, _mainWindowCreated: false, _curMode: 'launcher', _isConfigMode: true, _lastIgnoreRequested: false };
  const quitHold = mod.exports.createQuitHold({ getWindow: () => V.mainWindow, ipcMain, quit: () => E.calls.push('quit'), platform: 'darwin',
    setTimeout: (fn) => { E.timers.push(fn); return E.timers.length; }, clearTimeout(){} });
  const _applyConfigMode = (isConfig, mode) => { E.calls.push('mode ' + mode); V._curMode = isConfig ? mode : 'run'; V._isConfigMode = !!isConfig; };
  const _reapplyIgnoreMouse = () => E.calls.push('ignore ' + V._lastIgnoreRequested);
  const _resetWindowToLauncher = (why) => { E.calls.push('reset ' + why); _applyConfigMode(true, 'launcher'); V._lastIgnoreRequested = false; _reapplyIgnoreMouse(); };   // 본문은 sim-cfg-fit · sim-renderer-gone-reset 이 진짜로 돌린다
  const own = { ipcMain, app, screen, BrowserWindow, dialog, sysinput, overlay, _quitHold: quitHold, _applyConfigMode, _reapplyIgnoreMouse, _resetWindowToLauncher,
    setTimeout: (fn) => { E.timers.push(fn); return E.timers.length; }, clearTimeout(){}, setInterval: () => 0, clearInterval(){}, console: { warn(){}, log(){} } };
  /* 모르는 맨 위 이름(devtoolsGate · _watchRendererHealth 등)은 빈 함수 — 창이나 그 webContents 를 받아 불리면 그 창에 이름을 적는다(창마다 한 번 걸어야 할 것) */
  const winOf = (a) => a && E.wins.find((w) => a === w || a === w.proxy || a === w.webContents);
  const rec = (name) => new Proxy(function(){}, {
    get(t, k){ if(k === Symbol.toPrimitive) return (h) => h === 'number' ? 0 : ''; if(k === 'then' || k === Symbol.iterator) return undefined; return rec(name + '.' + String(k)); },
    apply(t, self, args){ for(const a of args){ const w = winOf(a); if(w) (w.ext = w.ext || []).push(name); } return rec(name + '()'); },
    construct(){ return rec(name + '#'); },
  });
  const scope = new Proxy({}, {
    has(t, k){ return typeof k === 'string' && (k in own || k in V || !(k in globalThis)); },
    get(t, k){ if(k === Symbol.unscopables) return undefined; if(k in V) return V[k]; if(k in own) return own[k]; return rec(String(k)); },
    set(t, k, v){ V[k] = v; return true; },
  });
  const api = new Function('S', 'with(S){ return (function(){\n' + block + '\nreturn { createWindow, setupDone: () => _mainSetupDone, gb: () => gbWin };\n})(); }')(scope);
  return Object.assign(E, api, { V, ipcHandlers, ipcOn, appEm, scrEm, CH: mod.exports.CH });
}

async function judge(MAIN){
  say('── 1. 글 — createWindow 는 창마다 · 등록은 _setupMainOnce 에서 한 번');
  const cw = fnText(MAIN, 'createWindow') || '';
  const once = fnText(MAIN, '_setupMainOnce') || '';
  chk(!!cw && !!once, 'createWindow · _setupMainOnce 가 있다');
  for(const [re, what] of ONCE_PATTERNS) chk(!re.test(cw), '  createWindow 안에 ' + what + ' 없음');
  chk(/\n {2}_setupMainOnce\(\);\n\}$/.test(cw), 'createWindow 끝에서 _setupMainOnce() — 첫 창 뒤에 한 번(순서는 예전과 같다)');
  chk(/^function _setupMainOnce\(\) \{\n {2}if\(_mainSetupDone\) return;\n {2}_mainSetupDone = true;/.test(once), '  _setupMainOnce 는 맨 앞에서 한 번만 막는다');
  const handles = (MAIN.match(/ipcMain\.handle\('[^']+'/g) || []).map(s => s.slice(15));
  chk(handles.length > 10 && new Set(handles).size === handles.length, 'ipcMain.handle 채널 이름이 겹치지 않는다(' + handles.length + '개)');
  chk(/app\.on\('gpu-info-update', _layOnGpu\);\n\s+mainWindow\.once\('closed', \(\)=>\{ _layDone = true; app\.removeListener\('gpu-info-update', _layOnGpu\); \}\);/.test(cw),
    '  createWindow 의 gpu-info-update 재시도는 창이 닫히면 듣기를 뗀다(창마다 한 벌)');

  say('── 2. createWindow 두 번 — 가짜 Electron');
  let S = null;
  try{ S = sandbox(MAIN); }catch(e){ chk(false, '덩어리를 싣다 던짐 — ' + String(e && e.message).slice(0, 120)); }
  chk(!!S, 'main.js 에서 공유 상태 · createWindow · _setupMainOnce 를 떼어 돌릴 수 있다');
  if(!S) return;
  let err1 = null, err2 = null;
  try{ S.createWindow(); }catch(e){ err1 = e; }
  chk(!err1, '첫 createWindow 가 안 던진다' + (err1 ? ' — ' + err1.message : ''));
  const win1 = S.V.mainWindow;
  chk(!!win1 && S.setupDone(), '  창이 서고 등록이 끝났다');
  /* 창마다 거는 것 한 장 — 창 · webContents 이벤트별 듣기 수와 창을 받아 부른 바깥 함수. 다시 연 창도 같아야 한다 */
  const perWin = (w) => JSON.stringify({
    win: Object.keys(w.L).filter((k) => w.count(k)).sort().map((k) => k + ':' + w.count(k)),
    wc: Object.keys(w.webContents.L).filter((k) => w.webContents.count(k)).sort().map((k) => k + ':' + w.webContents.count(k)),
    ext: (w.ext || []).slice().sort(),
  });
  const win1Per = win1 ? perWin(win1) : '';
  chk(!S.calls.some(c => c.startsWith('mode ')), '  첫 창은 모드를 다시 맞추지 않는다(켤 때 동작은 예전과 같다)');
  if(!win1) return;
  const nHandle = Object.keys(S.ipcHandlers).length, ipcCounts = JSON.stringify(Object.keys(S.ipcOn.L).map(k => [k, S.ipcOn.count(k)]));
  const win1Close = win1.count('close');

  /* 색 대화상자를 연 채로 창을 닫는다 — 닫힌 창 때문에 남은 대화상자 상태가 다시 연 창의 요청을 막으면 3절 colorDialog 가 빨강 */
  win1.top = true;
  S.ipcOn.emit('companion:colorDialog', {}, true);
  chk(win1.top === false && win1.count('closed') >= 2, '색 대화상자를 열면 «항상 위» 를 내리고, 창이 닫힐 때 되돌릴 고리를 건다');
  /* 저장을 묻고 창만 닫는 mac 창 닫기(#1043) — 렌더러가 알리고 · 답한다 */
  S.ipcOn.emit(S.CH.READY, { sender: win1.webContents });
  win1.close();
  chk(!win1.destroyed && win1.webContents.sent.includes(S.CH.ASK), '창 닫기 — 저장을 먼저 묻고 붙잡는다');
  S.ipcOn.emit(S.CH.DONE, {});
  chk(win1.destroyed && S.V.mainWindow === null && !S.calls.includes('quit'), '  답이 오면 창만 닫힌다(앱은 남음 · mainWindow = null)');
  chk(S.appEm.count('gpu-info-update') === 0, '  닫힌 창의 gpu-info-update 재시도 듣기가 떨어졌다');

  S.V._curMode = 'run'; S.V._isConfigMode = false; S.V._lastIgnoreRequested = true;   // 실행 화면(클릭 통과)이던 창을 닫았다
  try{ S.createWindow(); }catch(e){ err2 = e; }
  chk(!err2, '★ 두 번째 createWindow(Dock 누르기)가 안 던진다' + (err2 ? ' — ' + err2.message : ''));
  const win2 = S.V.mainWindow;
  chk(!!win2 && win2 !== win1, '  새 창이 섰다');
  if(!win2) return;
  chk(Object.keys(S.ipcHandlers).length === nHandle, '  ipcMain.handle 수 그대로(' + nHandle + ')');
  chk(JSON.stringify(Object.keys(S.ipcOn.L).map(k => [k, S.ipcOn.count(k)])) === ipcCounts, '  ipcMain.on 채널마다 듣기 수 그대로');
  chk(Object.keys(S.ipcOn.L).filter(k => k.startsWith('companion:')).every(k => S.ipcOn.count(k) === 1), '  ipcMain.on 채널마다 하나');
  chk(S.appEm.count('before-quit') === 1 && S.appEm.count('session-end') === 0, '  app before-quit 듣기 하나 · app 에는 session-end 가 없다(창 이벤트 — 창마다 하나)');
  chk(['display-metrics-changed', 'display-added', 'display-removed'].every(ev => S.scrEm.count(ev) === 1), '  screen 듣기 하나씩');
  chk(S.calls.filter(c => c === 'hooks').length === 1, '  전역 훅은 한 번만 건다');
  chk(win1.count('close') === win1Close, '  옛 창에 듣기가 더 붙지 않았다');
  chk(win2.count('close') === 1 && win2.count('closed') >= 1 && win2.count('focus') >= 1 && win2.count('minimize') >= 2 && win2.count('session-end') === 1 && win2.count('query-session-end') === 1, '  새 창에 창 듣기(close · closed · focus · minimize · 윈도우 세션 종료 둘)가 붙었다');
  chk(typeof win2.openHandler === 'function', '  새 창에 window.open 처리기');
  const win2Per = perWin(win2);
  chk(win2Per === win1Per, '★ 다시 연 창에 붙은 것(창 · webContents 이벤트별 듣기 수 · 창을 받아 부른 함수)이 첫 창과 같다' + (win2Per === win1Per ? '' : ' — 첫 ' + win1Per + ' / 다시 ' + win2Per));
  chk(JSON.parse(win1Per).ext.some((n) => /devtoolsGate\.attach/.test(n)) && JSON.parse(win1Per).wc.length > 3, '  (견주는 장이 비어 있지 않다 — devtoolsGate.attach · webContents 듣기가 잡힌다)');

  say('── 3. 다시 연 창 — 처리기가 새 창을 쓴다');
  await S.ipcHandlers['companion:pickImage']();
  chk(S.dialogParents[S.dialogParents.length - 1] === win2, 'pickImage — 파일 대화상자 부모가 새 창');
  S.ipcOn.emit('companion:flashFrame', {}, true);
  chk(win2.flashes.join() === 'true' && win1.flashes.length === 0, 'flashFrame — 새 창이 깜빡인다');
  S.ipcOn.emit('companion:moveWindow', {}, 5, 6);
  chk(win2.bounds.length === 1 && win2.bounds[0].x === 15 && win1.bounds.length === 0, 'moveWindow — 새 창이 움직인다');
  win2.top = true;
  S.ipcOn.emit('companion:colorDialog', {}, true);
  chk(win2.top === false, '★ colorDialog — 새 창의 «항상 위» 를 내린다(옛 창에서 연 대화상자 상태가 창 닫기로 풀렸다)');
  const c0 = win2.count('closed');
  S.ipcOn.emit('companion:colorDialog', {}, false);
  chk(win2.count('closed') === c0 - 1, '  대화상자를 닫으면 창 닫힘 고리를 뗀다(열 때마다 쌓이지 않게)');
  win2.top = true;
  S.ipcOn.emit('companion:colorDialog', {}, true);
  chk(win2.top === false && win2.count('closed') === c0, '  다시 열면 또 내린다 — 상태가 풀려 있다(고리는 하나)');
  S.ipcOn.emit('companion:colorDialog', {}, false);
  chk(S.V._curMode === 'launcher' && S.V._isConfigMode === true && S.V._lastIgnoreRequested === false && S.calls.includes('ignore false'),
    '★ 새 창은 _applyConfigMode 로 런처 · 클릭 받기(닫힌 창의 실행 화면 값이 남지 않는다)');
  const child = withStub(Object.assign(mkEmitter(), { closed: 0, isDestroyed(){ return false; }, close(){ this.closed++; } }));
  win2.webContents.emit('did-create-window', child, { frameName: 'mhGuestbook1' });
  chk(S.gb() === child, '방명록 창 — 새 창의 did-create-window 가 공유 상태(gbWin)에 적는다');
  win2.emit('minimize');
  chk(child.closed === 1, '  새 창을 내리면 방명록이 닫힌다(공유 상태를 같이 본다)');

  say('── 4. 다시 연 창의 Cmd+Q — 끄기 붙잡기');
  const bq = (S.appEm.L['before-quit'] || [])[0];
  const ev = () => { const e = { stopped: false, preventDefault(){ e.stopped = true; } }; return e; };
  S.ipcOn.emit(S.CH.READY, { sender: win1.webContents });
  let e1 = ev(); bq(e1);
  chk(!e1.stopped && !win2.webContents.sent.includes(S.CH.ASK), '옛 창이 보낸 «답할 수 있다» 는 안 센다 — 다시 연 창이 알리기 전엔 안 붙잡는다');
  /* 위 끄기는 «물을 상대 없음» 으로 done 이 됐다 — 새 판으로 다시 */
  const S2 = sandbox(MAIN);
  S2.createWindow();
  const a = S2.V.mainWindow;
  S2.ipcOn.emit(S2.CH.READY, { sender: a.webContents }); a.close(); S2.ipcOn.emit(S2.CH.DONE, {});
  S2.createWindow();
  const b = S2.V.mainWindow;
  S2.ipcOn.emit(S2.CH.READY, { sender: b.webContents });
  const bq2 = (S2.appEm.L['before-quit'] || [])[0];
  const e2 = ev(); bq2(e2);
  chk(e2.stopped && b.webContents.sent.includes(S2.CH.ASK), '★ 다시 연 창이 알린 뒤 Cmd+Q — 붙잡고 새 창에 저장을 묻는다');
  chk(!S2.calls.includes('stopHooks'), '  붙잡는 동안 훅 · 타이머를 아직 안 끈다');
  S2.ipcOn.emit(S2.CH.DONE, {});
  chk(S2.calls.includes('quit'), '  답이 오면 끈다');
}

const BREAKS = [
  [(m) => { const k = m.indexOf("  ipcMain.handle('companion:pickImage',"); const end = m.indexOf('\n  });\n', k) + 7; if(k < 0 || end < 7) return null;
    const blk = m.slice(k, end); m = m.slice(0, k) + m.slice(end); return m.replace('\n  _setupMainOnce();\n}\n', '\n' + blk + '  _setupMainOnce();\n}\n'); },
    'pickImage 처리를 createWindow 안으로 되돌림(0.13 이전 모양)'],
  [(m) => m.replace('  if(_mainSetupDone) return;\n', ''), '_setupMainOnce 의 한 번 막기를 뺌'],
  [(m) => { const re = /\n  app\.on\('before-quit', [^\n]*\n/; const l = (m.match(re) || [])[0]; if(!l) return null;
    return m.replace(l, '\n').replace('\n  _setupMainOnce();\n}\n', l + '  _setupMainOnce();\n}\n'); }, "app.on('before-quit') 를 createWindow 안으로"],
  [(m) => { const l = "  screen.on('display-added', _onDisplaysChanged);\n"; if(m.indexOf(l) < 0) return null;
    return m.replace(l, '').replace('\n  _setupMainOnce();\n}\n', "\n  screen.on('display-added', () => {});\n  _setupMainOnce();\n}\n"); }, 'screen 듣기를 createWindow 안으로'],
  [(m) => m.replace('\n  _setupMainOnce();\n}\n', '\n}\n'), 'createWindow 가 _setupMainOnce 를 안 부름'],
  [(m) => m.replace("  if(_mainWindowCreated) _resetWindowToLauncher('mac 에서 다시 열어');\n", ''), '다시 연 창의 모드 맞추기를 뺌'],
  [(m) => m.replace("  if(_mainWindowCreated) _resetWindowToLauncher(", "  if(true) _resetWindowToLauncher("), '첫 창에서도 모드를 다시 맞춤(켤 때 동작이 바뀜)'],
  [(m) => m.replace(/\n {4}mainWindow\.once\('closed', \(\)=>\{ _layDone = true;[^\n]*/, ''), '닫힌 창의 gpu-info-update 재시도 듣기를 안 뗌'],
  [(m) => { const l = "  mainWindow.on('close', (e) => { _quitHold.windowClose(e); });"; const i = m.indexOf(l); if(i < 0) return null;
    const line = m.slice(i, m.indexOf('\n', i) + 1); return m.replace(line, '').replace('  _mainSetupDone = true;\n', '  _mainSetupDone = true;\n' + line); },
    "창 'close'(끄기 붙잡기)를 _setupMainOnce 로 옮김 — 다시 연 창엔 안 붙음"],
  [(m) => m.replace(/\nlet gbWin = null;\n/, '\n').replace("  const _isChildDoc = ", '  let gbWin = null;\n  const _isChildDoc = '), 'gbWin 을 createWindow 안 지역 변수로 되돌림'],
  [(m) => { const l = '  devtoolsGate.attach(mainWindow.webContents);'; const i = m.indexOf(l); if(i < 0) return null;
    const line = m.slice(i, m.indexOf('\n', i) + 1); return m.replace(line, '').replace('  _mainSetupDone = true;\n', '  _mainSetupDone = true;\n' + line); },
    '창마다 거는 devtoolsGate.attach(설치본 F12 막기)를 _setupMainOnce 로 옮김 — 다시 연 창엔 안 붙음'],
  [(m) => { const re = /\n  mainWindow\.webContents\.on\('did-create-window', /; const i = m.search(re); const c = '  _mainWindowCreated = true;\n';
    if(i < 0 || m.indexOf(c) < 0 || m.indexOf(c) > i) return null;
    const m2 = m.slice(0, i + 1) + '  if(_firstW) ' + m.slice(i + 3);   // 등록 줄 앞에서 «첫 창인가» 를 따로 잡아 둔다(_mainWindowCreated 는 그 줄보다 먼저 참이 된다)
    return m2.replace(c, '  const _firstW = !_mainWindowCreated; _mainWindowCreated = true;\n'); },
    "webContents 'did-create-window' 를 첫 창에만 검"],
  [(m) => m.replace("    try{ if(mw && !mw.isDestroyed()) mw.once('closed', restore); }catch(_){}\n", ''), '색 대화상자 상태를 창이 닫힐 때 안 풂 — 다시 연 창의 요청을 90초 무시'],
  [(m) => m.replace("      try{ if(mw && !mw.isDestroyed()) mw.removeListener('closed', restore); }catch(_){}\n", ''), '색 대화상자를 닫아도 창 닫힘 고리를 안 뗌 — 열 때마다 쌓임'],
];

(async () => {
  await judge(MAIN0);
  say('── 5. mutation test — 진짜 main.js 글을 고쳐 본다');
  const caught = [];
  for(const [mut, what] of BREAKS){
    const m = mut(MAIN0);
    if(!m || m === MAIN0){ chk(false, '고칠 자리를 못 찾음 — ' + what); continue; }
    quiet = true; qfail = 0;
    try{ await judge(m); }catch(_){ qfail++; }
    quiet = false;
    caught.push([what, qfail]);
    chk(qfail > 0, '빨강 — ' + what);
  }
  chk(caught.length === BREAKS.length && caught.every(([, n]) => n > 0), '고쳐 본 ' + BREAKS.length + '가지를 다 잡는다');
  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
