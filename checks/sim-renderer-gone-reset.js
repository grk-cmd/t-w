/* ═══ 🩺 sim-renderer-gone-reset.js — 렌더러가 죽으면 창부터 런처로 되돌린다 (main.js) ═══════════════
   [무엇을 지키나] 렌더러가 죽어 다시 불러오면 화면은 런처로 돌아오는데 창은 실행 화면(모니터 전체 · 클릭 통과 · 맨 위)으로
     남아, 덮인 채 아무것도 못 누르고 강제 종료해야 했다. 죽었다는 알림(render-process-gone)을 받으면 다시 불러오기 전에
     창을 런처 크기로 · 클릭 받기로 되돌린다. 다시 불러오기 횟수가 다 찼어도(죽은 화면) 덮인 채 두지 않는다.
   ・1절: _watchRendererHealth 의 render-process-gone 을 가짜 창 위에서 실제로 불러 본다 — 차례(되돌리기 → 다시 불러오기) ·
          두 번째 죽음(횟수 다 참)에도 되돌리기 · 정상 종료 · 사용자가 끈 것은 손대지 않음 · 다른 창은 손대지 않음
          · 화면이 스스로 다시 불러와도(did-navigate · WebGL 복구 — B-1114-5) 되돌리기 · 처음 로드 · 막힐 이동의 시작(did-start-navigation) · 해시 이동은 넘김 · 한 로드 사이 한 번만(launcher/reload-reset.js)
   ・2절: _resetWindowForReload — 런처 모드로 창 맞추기 · 클릭 통과 끄기 · 창이 없으면 아무것도 안 함
   ・3절: 일부러 깨 보기
   [실행] node checks/run.js sim-renderer-gone-reset */
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
const MAIN = (() => { const f = findUp('main.js'); return f ? fs.readFileSync(f, 'utf8') : ''; })();
const RR = (() => { const f = findUp('reload-reset.js'); return f ? fs.readFileSync(f, 'utf8') : ''; })();
const loadRR = (src) => { const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports); return m.exports; };

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
function grabFn(src, head){
  const i = src.indexOf(head);
  if(i < 0) return null;
  let k = src.indexOf('{', i + head.length - 1), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}

/* 죽음 알림을 차례로 보내 보고, 일어난 일을 순서대로 적는다 */
function runGone(main, reasons, opts, rrSrc){
  const o = opts || {};
  const watch = grabFn(main, 'function _watchRendererHealth(win){');
  if(!watch) throw new Error('_watchRendererHealth 를 못 찾음');
  const log = [];
  const handlers = {};
  const wc = { on: (ev, fn) => { handlers[ev] = fn; }, reload: () => log.push('reload') };
  const win = { webContents: wc, isDestroyed: () => false, on(){} };
  const timers = [];
  const env = {
    mainWindow: o.other ? { isDestroyed: () => false } : win,
    _resetWindowForReload: () => log.push('reset'),
    ReloadReset: loadRR(rrSrc || RR),
    _diagLog: () => {},
    _errorLog: { write(){} },   // 🧯 오류 기록(error-log.js) — 여기서는 적지 않는다
    app: { on(){} },
    setTimeout: (fn) => { timers.push(fn); },
  };
  const f = new Function(...Object.keys(env), 'let _rendererReloads = 0, _childGoneHooked = false; const RENDERER_AUTO_RELOAD_MAX = 1; const _unresponsiveSince = new WeakMap();\n'
    + watch + '\nreturn _watchRendererHealth;')(...Object.values(env));
  f(win);
  /* 'load' — 화면 로드 끝 · 'nav' — 메인 프레임이 실제로 새 문서로(다시 불러오기 — did-navigate) · 'nav-hash' — 같은 문서 안(did-navigate-in-page)
     'start-ext' · 'start-blob' — main 이 막을 이동이 시작만 됨(will-navigate · will-frame-navigate 가 막아 did-navigate 는 안 옴) · 그 밖은 죽음 이유 */
  const NAV = { nav: ['did-navigate', {}], 'nav-hash': ['did-navigate-in-page', {}],
    'start-ext': ['did-start-navigation', { url: 'https://example.com/', isMainFrame: true, isSameDocument: false }],
    'start-blob': ['did-start-navigation', { url: 'blob:file:///x', isMainFrame: true, isSameDocument: false }] };
  for(const r of reasons){
    if(r === 'load'){ if(handlers['did-finish-load']) handlers['did-finish-load'](); }
    else if(NAV[r]){ const [ev, arg] = NAV[r]; if(handlers[ev]) handlers[ev](arg); }
    else handlers['render-process-gone']({}, { reason: r, exitCode: 1 });
    while(timers.length) timers.shift()(); log.push('|');
  }
  return log.join(' ');
}
function judgeGone(main, rrSrc){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const g = (steps, o) => runGone(main, steps, o, rrSrc);
  try{
    t(g(['load', 'crashed']) === '| reset reload |', '★ 죽음 — 창부터 런처로 되돌리고 그다음 다시 불러온다(' + g(['load', 'crashed']) + ')');
    t(g(['load', 'crashed', 'load', 'oom']) === '| reset reload | | reset |', '★ 두 번째 죽음(다시 불러오기 횟수 다 참) — 다시 불러오진 않아도 창은 되돌린다');
    t(g(['load', 'crashed', 'nav', 'load']) === '| reset reload | | |', '  죽은 뒤 다시 불러오는 길(새 문서로 넘어감)에서는 한 번 더 되돌리지 않는다');
    t(g(['clean-exit']) === '|' && g(['killed']) === '|', '  앱이 닫히는 중 · 사용자가 끈 것은 손대지 않는다');
    t(g(['crashed'], { other: true }) === 'reload |', '  다른 창(마이홈 BGM 등)이 죽으면 큰 창은 그대로');
    t(g(['load', 'nav']) === '| reset |', '★ 화면이 스스로 다시 불러와도(WebGL 복구 등) 창부터 런처로 (B-1114-5)');
    t(g(['nav', 'load']) === '| |', '  처음 로드는 되돌리지 않는다(창이 이미 런처 크기)');
    t(g(['load', 'start-ext', 'start-blob', 'nav-hash']) === '| | | |', '★ 막힐 이동(바깥 https · blob:)이 시작만 되거나 해시만 바뀌면 창을 안 되돌린다(실행 화면이 끼지 않게)');
    t(g(['load', 'nav', 'load', 'nav']) === '| reset | | reset |', '  다시 불러올 때마다 한 번씩');
    t(g(['load', 'nav'], { other: true }) === '| |', '  다른 창의 이동은 큰 창과 상관없다');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}

function runReset(main, hasWin){
  const fn = grabFn(main, 'function _resetWindowForReload(){');
  if(!fn) throw new Error('_resetWindowForReload 를 못 찾음');
  const log = [];
  const st = { ignore: true };
  const env = {
    mainWindow: hasWin ? { isDestroyed: () => false } : null,
    _applyConfigMode: (isConfig, mode) => log.push('mode:' + isConfig + ':' + mode),
    _reapplyIgnoreMouse: () => log.push('ignore:' + st.ignore),
    _diagLog: () => log.push('log'),
  };
  new Function('st', ...Object.keys(env), 'let _lastIgnoreRequested = st.ignore;\n' + fn.replace(/_lastIgnoreRequested = false;/, '_lastIgnoreRequested = false; st.ignore = _lastIgnoreRequested;') + '\n_resetWindowForReload();')(st, ...Object.values(env));
  return log.join(' ');
}
function judgeReset(main){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const a = runReset(main, true);
    t(a === 'mode:true:launcher ignore:false log', '★ 런처 모드로 창 맞추기 → 클릭 통과 끄기 → 기록(' + a + ')');
    t(runReset(main, false) === '', '  창이 없으면 아무것도 안 한다');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}

say('── 1. 죽음 알림');
judgeGone(MAIN).forEach(([ok, msg]) => chk(ok, msg));
say('── 2. 창 되돌리기');
judgeReset(MAIN).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. 일부러 깨 보기');
const GONE_LINE = /\n {4}if\(win === mainWindow\)\{ try\{ reloadReset\.beforeReload\(\);[^\n]*/;
const breaks = [
  ['되돌리기를 안 부름', () => judgeGone(MAIN.replace(GONE_LINE, ''))],
  ['횟수 판정 뒤에서 되돌림(두 번째 죽음에 덮인 채)', () => { const line = (MAIN.match(GONE_LINE) || [''])[0];
    return judgeGone(MAIN.replace(line, '').replace('    _rendererReloads++;\n', '    _rendererReloads++;' + line + '\n')); }],
  ['다시 불러오기(did-navigate)를 안 들음', () => judgeGone(MAIN.replace("wc.on('did-navigate',", "wc.on('did-navigate-x',"))],
  ['이동 시작(did-start-navigation)에 되돌림 — 막힌 이동에도 끼임', () => judgeGone(MAIN.replace("wc.on('did-navigate',", "wc.on('did-start-navigation',"))],
  ['한 로드 사이에 두 번 되돌림', () => judgeGone(MAIN, RR.replace('    if(resetSinceLoad) return false;\n', ''))],
  ['처음 로드도 되돌림', () => judgeGone(MAIN, RR.replace('    if(!loadedOnce) return false;\n', ''))],
  ['클릭 통과를 안 끔', () => judgeReset(MAIN.replace('  _lastIgnoreRequested = false;\n  _reapplyIgnoreMouse();\n', ''))],
  ['런처가 아닌 모드로', () => judgeReset(MAIN.replace("_applyConfigMode(true, 'launcher');", "_applyConfigMode(false, 'run');"))],
];
for(const [name, run] of breaks){
  let rows; try{ rows = run(); }catch(_){ rows = [[false, '던짐']]; }
  chk(rows.some(([ok]) => !ok), name);
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
