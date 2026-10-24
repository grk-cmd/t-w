/* ═══ 🩺 sim-native-peek.js — 감지 부품(uiohook-napi · node-window-manager)을 못 불러왔을 때 ═══════════════
   [무엇을 지키나] 설치 파일이 깨졌거나 보안 · 문서 암호화 프로그램이 바꾸면 부품이 «Invalid package config» 로 안 실린다.
     그때 ① 진단 기록에 그 package.json 의 크기 · 앞부분을 남기고 ② 부팅 때 «다시 설치» 안내를 띄우며
     ③ 키보드 안내(보안 프로그램 · 관리자 권한)는 띄우지 않는다 — 그 안내로는 안 고쳐진다.
   ・1절: native-peek.js peekUnpacked — 정상 JSON · 깨진 바이트 · 없음 · 설치 폴더 모름 · 경로
   ・2절: sysinput-win.js · sysinput-mac.js — 실패한 부품 이름(nativeLoadFailed) · 기록 한 줄에 peek · 다 실리면 빈 목록
   ・3절: main.js — 실패면 키보드 안내는 건너뛰고 «다시 설치» 안내(Windows · mac 문구) · 부팅 때 훅 건 바로 뒤에서 부름
   ・4절: 설치본에 native-peek.js 가 들어간다(package.json build.files)
   ・5절: 일부러 깨 보기
   [실행] node checks/run.js sim-native-peek */
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
const PEEK = read('native-peek.js'), WIN = read('sysinput-win.js'), MAC = read('sysinput-mac.js'), MAIN = read('main.js');
/* 앱 package.json — build.files 가 있는 것(루트 workspaces 판과 가른다) */
const PKG = (() => {
  const stack = ['.'];
  while(stack.length){
    const d = stack.shift();
    const f = path.join(d, 'package.json');
    if(fs.existsSync(f)){ try{ const j = JSON.parse(fs.readFileSync(f, 'utf8')); if(j.build && Array.isArray(j.build.files)) return j; }catch(_){} }
    for(const e of fs.readdirSync(d, { withFileTypes: true })) if(e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) stack.push(path.join(d, e.name));
  }
  return null;
})();

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
function loadPeek(src){
  const m = { exports: {} };
  new Function('require', 'module', 'exports', 'process', src)((n) => (n === 'path' ? path.posix : require(n)), m, m.exports, { resourcesPath: undefined });
  return m.exports;
}

function judgePeek(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let P; try{ P = loadPeek(src); }catch(e){ t(false, '싣다 던짐 — ' + String(e.message || e).slice(0, 80)); return r; }
  const files = {};
  const fakeFs = { readFileSync: (f) => { if(!(f in files)) { const e = new Error('nf'); e.code = 'ENOENT'; throw e; } return files[f]; } };
  const base = '/opt/tw/resources';
  const at = (n) => base + '/app.asar.unpacked/node_modules/' + n + '/package.json';
  files[at('uiohook-napi')] = Buffer.from('{"name":"uiohook-napi","version":"1.5.4"}');
  files[at('node-window-manager')] = Buffer.from([0x00, 0x01, 0xff, 0x44, 0x52, 0x4d, 0x0a, 0x7b]);
  const ok = P.peekUnpacked('uiohook-napi', { fs: fakeFs, resourcesPath: base });
  const bad = P.peekUnpacked('node-window-manager', { fs: fakeFs, resourcesPath: base });
  const none = P.peekUnpacked('koffi', { fs: fakeFs, resourcesPath: base });
  const nobase = P.peekUnpacked('uiohook-napi', { fs: fakeFs });
  t(ok === '풀린 package.json 41바이트 · 앞 «{"name":"uiohook-napi","»', '정상 JSON — 크기 · 앞 24바이트 그대로: ' + ok);
  t(bad === '풀린 package.json 8바이트 · 앞 «...DRM.{»', '★ 깨진 · 바뀐 바이트 — 글자 아닌 것은 점으로(보안 프로그램이 바꾼 것인지 가른다): ' + bad);
  t(none === '풀린 package.json 못 읽음(ENOENT)', '  파일 없음 — 까닭 코드: ' + none);
  t(nobase === '설치 폴더를 모름', '  설치 폴더를 모르면(개발 실행) 그렇게 적는다');
  return r;
}

/* sysinput 을 가짜 require 로 싣는다 — fail 에 든 부품은 던진다 */
function loadSys(src, failSet){
  const logs = [];
  const req = (n) => {
    if(n === 'path') return path.win32;
    if(n === 'child_process') return { execFile(){} };
    if(n === 'fs') return require('fs');   // mac 판이 번들 정보를 읽는 데 쓴다(여기선 부르지 않는다)
    if(n === './native-peek') return { peekUnpacked: (name) => 'PEEK:' + name };
    if(n === 'uiohook-napi'){ if(failSet.has(n)) throw new Error('Invalid package config X'); return { uIOhook: { on(){}, start(){}, stop(){} }, UiohookKey: {} }; }
    if(n === 'node-window-manager'){ if(failSet.has(n)) throw new Error('Invalid package config Y'); return { windowManager: { getActiveWindow(){ return null; }, getWindows(){ return []; } } }; }
    throw new Error('no ' + n);
  };
  const m = { exports: {} };
  new Function('require', 'module', 'exports', 'Buffer', 'process', src)(req, m, m.exports, Buffer, { execPath: 'C:\\tw\\Together Working.exe', platform: 'win32' });
  m.exports.init({ log: (x) => logs.push(x) });
  try{ m.exports.startGlobalHooks({ mousedown(){}, wheel(){}, keydown(){} }); }catch(_){}
  return { mod: m.exports, logs };
}
function judgeSys(src, label){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const a = loadSys(src, new Set(['uiohook-napi', 'node-window-manager']));
    const fl = a.mod.nativeLoadFailed();
    t(fl.join() === 'uiohook-napi,node-window-manager', label + ' — 못 실은 부품 이름 둘(' + fl.join() + ')');
    t(a.logs.some(l => /uiohook-napi 로드 실패.*Invalid package config X \| PEEK:uiohook-napi/.test(l)) && a.logs.some(l => /node-window-manager 로드 실패.*\| PEEK:node-window-manager/.test(l)), '  ★ 진단 기록 한 줄에 설치 파일 상태(peek)가 붙는다');
    fl.push('x');
    t(a.mod.nativeLoadFailed().length === 2, '  돌려준 목록을 바꿔도 모듈 안은 그대로(사본)');
    const b = loadSys(src, new Set());
    t(b.mod.nativeLoadFailed().length === 0 && !b.logs.some(l => /로드 실패/.test(l)), '  다 실리면 빈 목록 · 실패 기록 없음');
  }catch(e){ t(false, label + ' 싣다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}

function judgeMain(main){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const kb = grabFn(main, 'function _kbShowGuide(){');
  const nv = grabFn(main, 'function _nativeShowGuide(){');
  if(!kb || !nv){ t(false, 'main.js 에서 _kbShowGuide · _nativeShowGuide 를 못 찾음'); return r; }
  const run = (fnSrc, name, failed, platform) => {
    const shown = [];
    const dialog = { showMessageBox: (a, b) => { shown.push(b || a); return Promise.resolve({ response: 0, checkboxChecked: false }); } };
    const proc = { platform };
    new Function('sysinput', 'dialog', 'mainWindow', 'shell', '_kbGuideOffPath', 'process', fnSrc + '\n' + name + '();')({ nativeLoadFailed: () => failed.slice() }, dialog, null, { openExternal(){} }, () => null, proc);
    return shown;
  };
  try{
    t(run(kb, '_kbShowGuide', ['uiohook-napi'], 'win32').length === 0, '★ 부품을 못 실은 판 — 키보드 안내(보안 프로그램 · 관리자 권한)는 띄우지 않는다');
    const k2 = run(kb, '_kbShowGuide', [], 'win32');
    t(k2.length === 1 && /키보드 입력이 감지되지 않고 있어요/.test(k2[0].message), '  부품이 다 실린 판 — 예전 키보드 안내 그대로');
    const w = run(nv, '_nativeShowGuide', ['uiohook-napi'], 'win32')[0];
    const m = run(nv, '_nativeShowGuide', ['uiohook-napi'], 'darwin')[0];
    t(w && /감지 부품을 불러오지 못했어요/.test(w.message) && /설정 › 앱/.test(w.detail) && /다시 설치/.test(w.detail) && /예외로 등록/.test(w.detail), '★ «다시 설치» 안내(Windows) — 제거 · 다시 설치 · 회사 PC 예외 등록');
    t(m && /응용 프로그램 폴더/.test(m.detail) && !/설정 › 앱/.test(m.detail), '  mac 문구는 응용 프로그램 폴더');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  t(/\n {4}keydown: {3}\(e\) => \{ _inputDiag\.key\+\+; {3}_onGlobalKeyDown\(e\); \},\n {2}\}\);\n {2}if\(sysinput\.nativeLoadFailed\(\)\.length\) _nativeShowGuide\(\);/.test(main), '부팅 때 훅을 건 바로 뒤(로드 실패 기록이 흐른 뒤)에서 «다시 설치» 를 부른다');
  return r;
}
function judgePkg(pkg){
  return [[!!(pkg && pkg.build.files.includes('native-peek.js')), '설치본 build.files 에 native-peek.js(빠지면 sysinput 이 실리지 않아 창이 안 뜬다)']];
}

say('── 1. peekUnpacked');
judgePeek(PEEK).forEach(([ok, msg]) => chk(ok, msg));
say('── 2. sysinput — 못 실은 부품');
judgeSys(WIN, 'sysinput-win.js').forEach(([ok, msg]) => chk(ok, msg));
judgeSys(MAC, 'sysinput-mac.js').forEach(([ok, msg]) => chk(ok, msg));
say('── 3. main.js 안내');
judgeMain(MAIN).forEach(([ok, msg]) => chk(ok, msg));
say('── 4. 설치본');
judgePkg(PKG).forEach(([ok, msg]) => chk(ok, msg));
say('── 5. 일부러 깨 보기');
const breaks = [
  ['글자 아닌 바이트를 그대로 둠', () => judgePeek(PEEK.replace("(b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.'", 'String.fromCharCode(b)'))],
  ['못 읽음 까닭을 버림', () => judgePeek(PEEK.replace("'풀린 package.json 못 읽음(' + ((e && (e.code || e.message)) || '?') + ')'", "'못 읽음'"))],
  ['win 이 실패 이름을 안 남김', () => judgeSys(WIN.replace("  _nativeFailed.push('uiohook-napi');", ''), 'win')],
  ['mac 기록에 peek 이 없음', () => judgeSys(MAC.replace(" + ' | ' + peekUnpacked('uiohook-napi')", ''), 'mac')],
  ['키보드 안내가 실패를 안 봄', () => judgeMain(MAIN.replace(/\n {2}if\(sysinput\.nativeLoadFailed\(\)\.length\) return;[^\n]*/, ''))],
  ['부팅 때 안 부름', () => judgeMain(MAIN.replace(/\n {2}if\(sysinput\.nativeLoadFailed\(\)\.length\) _nativeShowGuide\(\);[^\n]*/, ''))],
  ['설치본에서 빠짐', () => judgePkg(PKG && { build: { files: PKG.build.files.filter(f => f !== 'native-peek.js') } })],
];
for(const [name, run] of breaks){
  let rows; try{ rows = run(); }catch(_){ rows = [[false, '던짐']]; }
  chk(rows.some(([ok]) => !ok), name);
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
