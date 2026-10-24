/* ═══ ⌨️ sim-hook-pause.js — 우리 창 입력칸에 치는 동안 mac 전역 훅 쉬기 ═══════════════
   [무엇을 지키나] mac 의 uiohook 은 키마다 메인 스레드에 글자를 물어 한글 조합을 깨뜨린다. 입력하는 동안만 훅을 내리되,
     키를 처리하는 도중에 내리면 훅 스레드와 메인이 서로 기다려 앱이 멈추므로 «조용할 때만» 내린다.
   ・1절: 판단 규칙(launcher/hook-pause-policy.js step) 표 — 조용할 때만 내림 · 앞에서 빠지면 바로 올림 · 칸 사이 옮김은 1초 기다림
   ・2절: sysinput-mac pause/resume 을 가짜 uiohook 위에서 — 내림 · 다시 걸기 · 두 번 부르기 · 끄기 · Windows 판은 아무것도 안 함 · export 이름 같음
   ・3절: main.js _syncHookPause 를 떼어 가짜 창 · 시계로 — 입력칸 들어감 → 키 멎음 → 내림 → 앱 전환 → 올림 · 진단 한 줄 · 키 중엔 안 내림
   ・4절: 렌더러 typing-focus.js — 입력칸 판정 · 알림은 바뀔 때만 · 내린 동안 입력 있음 채우기 · 지우기 키 없이 지워짐 진단
   ・5절: 일부러 깨 보기
   [실행] node checks/run.js sim-hook-pause */
'use strict';
const fs = require('fs');
const path = require('path');
function findUp(name){
  const stack = ['.'];
  while(stack.length){
    const d = stack.shift();
    const f = path.join(d, name);
    if(fs.existsSync(f)) return f;
    for(const e of fs.readdirSync(d, { withFileTypes: true })) if(e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) stack.push(path.join(d, e.name));
  }
  return null;
}
const read = (n) => { const f = findUp(n); return f ? fs.readFileSync(f, 'utf8') : ''; };
const POL = read('hook-pause-policy.js'), MAC = read('sysinput-mac.js'), WIN = read('sysinput-win.js'), MAIN = read('main.js'), TF = read('typing-focus.js');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const loadCjs = (src, req) => { const m = { exports: {} }; new Function('require', 'module', 'exports', '__dirname', 'process', src)(req || require, m, m.exports, '.', { platform: 'darwin', env: {}, versions: {}, resourcesPath: '/x' }); return m.exports; };
function grabFn(src, head){
  const i = src.indexOf(head);
  if(i < 0) return null;
  let k = src.indexOf('{', i + head.length - 1), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}

function judgePolicy(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let P; try{ P = loadCjs(src); }catch(e){ t(false, '싣다 던짐 — ' + e.message); return r; }
  const s = (o) => P.step(Object.assign({ typing: false, focused: true, paused: false, now: 10000, lastKeyAt: 0, typingOffAt: 0 }, o));
  t(s({ typing: true, lastKeyAt: 10000 - P.QUIET_MS }) === 'pause', '★ 입력칸 · 앞 · 키가 QUIET_MS 동안 없음 → 내림');
  t(s({ typing: true, lastKeyAt: 10000 - P.QUIET_MS + 1 }) === 'wait', '★ 키를 치는 도중엔 안 내리고 기다림(내리는 순간 키가 오면 앱이 멈춘다)');
  t(s({ typing: true, focused: false }) === 'keep' && s({ typing: false }) === 'keep', '  앞이 아니거나 입력칸이 아니면 할 일 없음');
  t(s({ paused: true, focused: false, typing: true, typingOffAt: 10000 }) === 'resume', '★ 쉬는 중 다른 앱으로 → 기다리지 않고 바로 올림');
  t(s({ paused: true, typing: false, typingOffAt: 10000 - 200 }) === 'wait' && s({ paused: true, typing: false, typingOffAt: 10000 - P.RESUME_DELAY_MS }) === 'resume', '  입력칸에서 나오면 RESUME_DELAY_MS 뒤에 올림(칸 사이 옮김에 내렸다 올렸다 안 함)');
  t(s({ paused: true, typing: true }) === 'keep', '  쉬는 중 계속 입력 → 그대로');
  return r;
}

/* 가짜 uiohook — start/stop 횟수 */
function mkHook(){ const h = { starts: 0, stops: 0, on(){}, start(){ this.starts++; }, stop(){ this.stops++; } }; return h; }
function loadMac(src, hook){
  const req = (n) => {
    if(n === 'uiohook-napi') return { uIOhook: hook, UiohookKey: {} };
    if(n === 'node-window-manager') return { windowManager: { requestAccessibility: () => true, getActiveWindow: () => null, getWindows: () => [] } };
    if(n === 'child_process') return { execFileSync(){ return ''; } };
    return require(n);
  };
  return loadCjs(src, req);
}
function judgeMac(src, win){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const hook = mkHook(); const M = loadMac(src, hook);
    t(M.pauseGlobalHooks() === false && hook.stops === 0, '걸기 전엔 쉬기 없음(false)');
    M.startGlobalHooks({});
    const p1 = M.pauseGlobalHooks(), p2 = M.pauseGlobalHooks();
    t(p1 === true && p2 === false && hook.stops === 1, '★ 쉬기 — 내리고 true · 두 번째는 아무것도 안 함');
    M.resumeGlobalHooks(); M.resumeGlobalHooks();
    t(hook.starts === 2, '★ 다시 걸기 — 한 번만 start');
    M.pauseGlobalHooks(); const s0 = hook.stops; M.stopGlobalHooks();
    t(hook.stops === s0, '  쉬는 중 끄기는 다시 stop 하지 않는다');
    const W = loadCjs(win, (n) => (n === 'uiohook-napi' ? { uIOhook: mkHook(), UiohookKey: {} } : n === 'node-window-manager' ? { windowManager: {} } : require(n)));
    t(W.pauseGlobalHooks() === false && typeof W.resumeGlobalHooks === 'function', '  Windows 판 — 쉬지 않음(false)');
    t(Object.keys(W).sort().join() === Object.keys(M).sort().join(), '  두 판의 export 이름이 같다');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}

function judgeMain(mainSrc, polSrc){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const fn = grabFn(mainSrc, 'function _syncHookPause(){');
  if(!fn){ t(false, 'main.js 에서 _syncHookPause 를 못 찾음'); return r; }
  try{
    const P = loadCjs(polSrc);
    const env = { now: 0, focused: true, paused: 0, resumed: 0, logs: [], timers: [], pauseOk: true };
    const S = new Function('HookPause', 'sysinput', 'mainWindow', '_inputDiag', '_diagLog', 'setTimeout', 'clearTimeout', 'Date',
      'const HOOK_PAUSE_TICK_MS = 100; const HOOK_PAUSE_LOG_GAP_MS = 600000;\n'
      + 'let _typingInOurWin = false, _typingOffAt = 0, _hooksPaused = false;\n'
      + 'let _hookKeySeen = 0, _hookKeyAt = 0, _hookPauseTimer = null, _hookPauseCount = 0, _hookPauseLoggedAt = -1e12;\n'
      + fn + '\nreturn { sync: _syncHookPause, setTyping(v){ _typingInOurWin = v; if(!v) _typingOffAt = Date.now(); _syncHookPause(); }, paused: () => _hooksPaused };')(
      P, { pauseGlobalHooks(){ if(!env.pauseOk) return false; env.paused++; return true; }, resumeGlobalHooks(){ env.resumed++; } },
      { isDestroyed: () => false, isFocused: () => env.focused }, env.diag = { key: 0 }, (m) => env.logs.push(m),
      (f, ms) => { env.timers.push(f); return env.timers.length; }, () => {}, { now: () => env.now });
    const tick = (ms) => { env.now += ms; const f = env.timers.shift(); if(f) f(); };
    env.diag.key = 5; S.setTyping(true);
    t(!S.paused() && env.timers.length === 1, '입력칸 들어감 — 막 친 키가 있으면 기다림');
    tick(100); env.diag.key = 6; tick(100); tick(100); tick(100);
    t(!S.paused(), '★ 키가 계속 오면 안 내린다');
    tick(100); tick(100); tick(100);
    t(S.paused() && env.paused === 1 && env.timers.length === 0, '★ 키가 멎고 QUIET_MS 지나면 내림 · 기다림 끝');
    env.focused = false; S.sync();
    t(!S.paused() && env.resumed === 1 && env.logs.length === 1 && /전역 훅 쉼 1번/.test(env.logs[0]), '★ 다른 앱으로 → 바로 올림 · 진단 한 줄');
    env.focused = true; env.pauseOk = false; env.timers.length = 0; env.now += 1000; S.sync();
    t(!S.paused() && env.timers.length === 0, '  쉬지 못하는 판(Windows · 훅 없음)이면 타이머를 돌리지 않는다');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}

/* 가짜 문서 */
function mkDoc(){
  const L = {};
  return { activeElement: null, addEventListener(t, f){ (L[t] = L[t] || []).push(f); }, fire(t, e){ (L[t] || []).forEach(f => f(e || {})); } };
}
function judgeTyping(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const m = { exports: {} }; new Function('window', 'module', src)(undefined, m);
    const T = m.exports;
    const inp = (type) => ({ tagName: 'INPUT', type });
    t(T.isTypingTarget(inp('text')) && T.isTypingTarget(inp('search')) && T.isTypingTarget({ tagName: 'TEXTAREA' }) && T.isTypingTarget({ tagName: 'DIV', isContentEditable: true }) && T.isTypingTarget({ tagName: 'INPUT' }),
      '입력칸 판정 — text · search · textarea · contenteditable · type 없는 input');
    t(!T.isTypingTarget(inp('range')) && !T.isTypingTarget(inp('checkbox')) && !T.isTypingTarget(inp('color')) && !T.isTypingTarget({ tagName: 'BUTTON' }) && !T.isTypingTarget(null),
      '  슬라이더 · 체크 · 색 · 버튼 · 없음은 아님');
    let now = 0; const sent = [], notes = []; let any = 0;
    const F = T.createTypingFocus({ send: (v) => sent.push(v), anyInput: () => any++, diagNote: (s) => notes.push(s), now: () => now });
    const doc = mkDoc(); F.attach(doc);
    t(sent.join() === 'false', '★ 붙일 때 «입력 아님» 을 한 번 보낸다(다시 불러온 화면)');
    doc.activeElement = inp('text'); doc.fire('focusin'); doc.fire('focusin');
    t(sent.join() === 'false,true', '★ 바뀔 때만 보낸다');
    doc.fire('keydown', { key: 'ㄱ' });
    t(any === 1, '  입력 중 키 → 입력 있음(훅이 쉬는 동안 자동 자리비움 판정)');
    doc.fire('compositionstart'); now = 1000;
    doc.fire('input', { inputType: 'deleteContentBackward' });
    doc.fire('keydown', { key: 'Backspace' }); doc.fire('input', { inputType: 'deleteContentBackward' });
    doc.fire('input', { inputType: 'deleteContentBackward', isComposing: true });
    doc.activeElement = null; doc.fire('focusout');
    t(sent.join() === 'false,true,false' && notes.length === 1 && /키 없이 글자가 지워짐 1번 · 한글 조합 1번/.test(notes[0]), '★ 나올 때 — 지우기 키 없이 지워짐 1번만 센다(지우기 키 뒤 · 조합 중은 뺌) · 진단 한 줄');
    doc.activeElement = inp('text'); doc.fire('focusin'); now = 2000; doc.fire('input', { inputType: 'deleteContentBackward' }); doc.activeElement = null; doc.fire('focusout');
    t(notes.length === 1, '  1분 안에 또 나와도 진단은 한 줄만');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}

say('── 1. 판단 규칙');
judgePolicy(POL).forEach(([ok, msg]) => chk(ok, msg));
say('── 2. sysinput 쉬기 · 다시 걸기');
judgeMac(MAC, WIN).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. main.js _syncHookPause');
judgeMain(MAIN, POL).forEach(([ok, msg]) => chk(ok, msg));
chk(/ipcMain\.on\('companion:setTyping'/.test(MAIN) && (MAIN.match(/_syncHookPause\(\);/g) || []).length >= 3, '  main — setTyping 알림 · 창 앞 · 뒤 바뀜에서 부른다');
say('── 4. 렌더러 typing-focus.js');
judgeTyping(TF).forEach(([ok, msg]) => chk(ok, msg));
say('── 5. 일부러 깨 보기');
const breaks = [
  ['키 중에도 내림', () => judgePolicy(POL.replace('return (f.now - f.lastKeyAt >= QUIET_MS) ? \'pause\' : \'wait\';', "return 'pause';"))],
  ['다른 앱으로 가도 안 올림', () => judgePolicy(POL.replace("if(!f.focused) return 'resume';", ''))],
  ['쉬기가 상태를 안 봄', () => judgeMac(MAC.replace('if(!uIOhook || !_hookOn) return false;', 'if(!uIOhook) return false;'), WIN)],
  ['Windows 판 이름 빠짐', () => judgeMac(MAC, WIN.replace('pauseGlobalHooks, resumeGlobalHooks,', ''))],
  ['main 이 키를 안 봄', () => judgeMain(MAIN.replace('if(_inputDiag.key !== _hookKeySeen){ _hookKeySeen = _inputDiag.key; _hookKeyAt = now; }', ''), POL)],
  ['바뀌지 않아도 보냄', () => judgeTyping(TF.replace('    if(on === typing) return;\n', ''))],
  ['지우기 키를 안 봄', () => judgeTyping(TF.replace("if(e.key === 'Backspace' || e.key === 'Delete') delKeyAt = now();", ''))],
];
for(const [name, run] of breaks){
  let rows; try{ rows = run(); }catch(_){ rows = [[false, '던짐']]; }
  chk(rows.some(([ok]) => !ok), name);
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
