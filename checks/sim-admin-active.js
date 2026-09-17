/* ═══ 🛡️ sim-admin-active.js — 관리자 권한 창도 판정한다 · 훅 수신 진단 (E 추가 제보 · 2026-09-17) ═══════
   [무엇을 지키나] 「관리자 권한 게임클라 앞에서 캐릭터는 포커싱인데 타이머가 안 쌓인다 · 창모드도 같다」.
     node-window-manager 는 관리자 권한 프로세스의 `path` 를 못 읽어 빈 문자열을 주고, sysinput 이 그때 null 을
     돌려주면 main.js 폴링이 일찍 return → activeAppState 가 안 나가 렌더러의 누적 tick(_applyActiveAppState) 이
     서는데, 커서 이동 신호는 finally 에서 계속 나가 캐릭터만 포커싱 포즈로 남는다 — 제보 그대로.
   ・1절: sysinput-win.js getActiveWindow — 경로가 비면 pid 로 tasklist 이름을 받아 `{owner:{path:'', name}}` 를 돌려준다.
          실제로 돌려 본다(가짜 windowManager · 가짜 child_process). 캐시·2초 상한·30초 미스 캐시·실패 1회 기록.
   ・2절: sysinput-win.js listWindows — 경로 없는 창도 이름으로 목록에 오른다(예전엔 통째로 빠져 «목록에 게임이 안 뜬다»).
   ・3절: main.js — [활성] 줄에 `경로=없음` 표식 · [입력] 1분 진단(등록 앱 앞에서만 · 훅 3종+커서 이동 카운터 · 새 타이머 0).
   ・4절: mac 쌍둥이 내보내기 이름이 그대로다(이 통로는 win 안에서만 산다).
   [실행] main.js · sysinput-win.js · sysinput-mac.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const path = require('path');
const MAIN = fs.readFileSync('main.js', 'utf8');
const SYS  = fs.readFileSync('sysinput-win.js', 'utf8');
const MAC  = fs.existsSync('sysinput-mac.js') ? fs.readFileSync('sysinput-mac.js', 'utf8') : null;

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* sysinput-win.js 를 가짜 네이티브·가짜 child_process 위에 올린다 */
function loadSys(env){
  const fakeReq = (name) => {
    if(name === 'path') return path.win32;   // 원본은 Windows 에서 돈다 — 검사가 Linux 에서 돌아도 같은 규칙으로
    if(name === 'child_process') return { execFile: (cmd, args, opt, cb) => { env.spawns.push([cmd, args]); setTimeout(() => cb(env.tlErr || null, env.tasklist), 0); } };
    if(name === 'uiohook-napi') return { uIOhook: { on(){}, start(){}, stop(){} }, UiohookKey: {} };
    if(name === 'node-window-manager') return { windowManager: env.wm };
    throw new Error('unexpected require ' + name);
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'process', 'setTimeout', SYS)(fakeReq, mod, mod.exports, { execPath: 'C:\\tw\\Together Working.exe' }, setTimeout);
  mod.exports.init({ log: (m) => env.logs.push(m) });
  return mod.exports;
}
const csv = (rows) => rows.map(([n, pid]) => `"${n}","${pid}","Console","1","1,000 K"`).join('\r\n');
const win = (o) => ({ path: o.path || '', processId: o.pid, getTitle: () => o.title || '', isVisible: () => true, getBounds: () => ({ width: 800, height: 600 }) });

(async () => {
/* ── 1. getActiveWindow ── */
say('── 1. sysinput-win.js getActiveWindow — 경로 없는(관리자 권한) 창은 tasklist 이름으로 판정한다');
{
  const env = { spawns: [], logs: [], tasklist: csv([['game.exe', 4242], ['chrome.exe', 100]]), wm: { getActiveWindow: () => null, getWindows: () => [] } };
  const sys = loadSys(env);
  env.wm.getActiveWindow = () => win({ path: 'C:\\x\\chrome.exe', pid: 100, title: 'Tab' });
  let r = await sys.getActiveWindow();
  chk(r && r.owner.path === 'C:\\x\\chrome.exe' && r.owner.name === 'chrome.exe' && env.spawns.length === 0, '① 경로가 있으면 예전 모양 그대로 · tasklist 안 띄움(동작 변경 0)');
  env.wm.getActiveWindow = () => win({ path: '', pid: 4242, title: 'Game' });
  r = await sys.getActiveWindow();
  chk(r && r.owner.path === '' && r.owner.name === 'game.exe' && r.title === 'Game', '★ ② 경로 빈 창: {owner:{path:\'\', name:\'game.exe\'}} — path 는 빈 채로 둔다(있는 척 안 한다)');
  chk(env.spawns.length === 1 && env.spawns[0][0] === 'tasklist' && env.spawns[0][1].join(' ') === '/FO CSV /NH', '  tasklist /FO CSV /NH 한 번');
  chk(!!r && sys.procNameOf(r.owner.path || r.owner.name) === 'game.exe', '  main.js 가 읽는 식(path || name → procNameOf) 으로 판정 키가 나온다');
  chk(env.logs.some(l => /경로 못 읽음/.test(l) && /pid=4242/.test(l)), '  진단 로그 한 줄(pid 포함)');
  const n0 = env.logs.length;
  for(let i = 0; i < 5; i++) r = await sys.getActiveWindow();
  chk(env.spawns.length === 1 && !!r && r.owner.name === 'game.exe' && env.logs.length === n0, '  같은 pid 반복(폴링 500ms): 캐시 — 프로세스 0회 · 로그 0줄');
  /* 모르는 pid — 표에 없다 */
  env.wm.getActiveWindow = () => win({ path: '', pid: 7777, title: 'Gone' });
  r = await sys.getActiveWindow();
  chk(r === null && env.spawns.length === 1, '  표에 없는 pid · 2초 안: 다시 안 띄우고 null(예전과 같은 답 → main 실패 streak)');
  /* 2초 상한을 넘긴 뒤에는 다시 받는다 — 시계를 돌리는 대신 상한을 우회할 수 없으므로 상수만 본다 */
  chk(/PIDMAP_MIN_MS\s*=\s*2000/.test(SYS) && /PIDMAP_MISS_MS\s*=\s*30000/.test(SYS), '  상한 상수: 재조회 2초 · 미스 캐시 30초');
  chk(/_pidMapBusy\)\s*return\s*_pidMapBusy/.test(SYS), '  겹치는 요청은 진행 중인 하나에 붙는다');
  chk(/windowsHide:\s*true/.test(SYS) && /timeout:\s*3000/.test(SYS), '  창 없이 · 3초 타임아웃');
  /* 실패 */
  const env2 = { spawns: [], logs: [], tlErr: new Error('ENOENT'), wm: { getActiveWindow: () => win({ path: '', pid: 1 }), getWindows: () => [] } };
  const sys2 = loadSys(env2);
  r = await sys2.getActiveWindow();
  chk(r === null && env2.logs.filter(l => /tasklist 실패/.test(l)).length === 1, '  tasklist 실패: null · 기록 1줄');
  await sys2.getActiveWindow();
  chk(env2.logs.filter(l => /tasklist 실패/.test(l)).length === 1, '  실패 기록은 한 번만');
}

/* ── 2. listWindows ── */
say('── 2. sysinput-win.js listWindows — 경로 없는 창도 목록에 오른다');
{
  const env = { spawns: [], logs: [], tasklist: csv([['game.exe', 4242]]), wm: { getActiveWindow: () => null, getWindows: () => [
    win({ path: '', pid: 4242, title: 'Game main' }),
    win({ path: '', pid: 4242, title: 'Game' }),
    win({ path: 'C:\\x\\chrome.exe', pid: 100, title: 'Tab' }),
    win({ path: '', pid: 9999, title: 'Unknown' }),
  ] } };
  const sys = loadSys(env);
  const r = await sys.listWindows();
  chk(r && r.ok === true && Array.isArray(r.list), 'ok 목록');
  const g = r.list.find(i => i.name === 'game.exe');
  chk(!!g && g.path === '' && g.title === 'Game main', '★ 관리자 권한 창이 name=game.exe · path=\'\' · 긴 제목으로 한 줄');
  chk(r.list.filter(i => i.name === 'game.exe').length === 1, '  같은 exe 두 창 → 한 줄(이름 키로 중복 제거)');
  chk(r.list.some(i => i.name === 'chrome.exe' && i.path === 'C:\\x\\chrome.exe'), '  경로 있는 창은 예전 그대로');
  chk(!r.list.some(i => i.title === 'Unknown'), '  이름을 못 받은 창은 예전처럼 빠진다');
  chk(env.spawns.length === 1, '  창 여럿이어도 tasklist 는 한 번');
  /* main.js 등록부가 path 없는 항목을 name 으로 받는 길이 살아 있다 */
  const set = MAIN.slice(MAIN.indexOf("ipcMain.handle('companion:setFocusApp'"), MAIN.indexOf("ipcMain.handle('companion:setFocusApp'") + 2500);
  chk(/pickedPath\s*\?\s*focusKeyOf\(sysinput\.procNameOf\(pickedPath\)\)\s*:\s*focusKeyOf\(appInfo\.name\)/.test(set), '  main.js setFocusApp: path 없으면 name 으로 키를 만든다(그 길이 이제 실제로 쓰인다)');
}

/* ── 3. main.js 진단 ── */
say('── 3. main.js — [활성] 경로 표식 · [입력] 1분 훅 수신 진단');
{
  const code = strip(MAIN);
  chk(/경로=없음\(관리자권한\)/.test(MAIN) && /w\.owner\.path \? '' : ' 경로=없음/.test(MAIN), '[활성] 줄에 경로=없음 표식(관리자 권한 판정이 걸렸는지 로그로 갈린다)');
  chk(/_inputDiag\.click\+\+/.test(code) && /_inputDiag\.wheel\+\+/.test(code) && /_inputDiag\.key\+\+/.test(code) && /_inputDiag\.cursor\+\+/.test(code), '카운터 4개(클릭·휠·키·커서이동)가 실제 통로에 붙어 있다');
  const reg = code.slice(code.indexOf('sysinput.startGlobalHooks({'), code.indexOf('sysinput.startGlobalHooks({') + 400);
  chk(/mousedown:\s*\(e\)\s*=>\s*\{\s*_inputDiag\.click\+\+;\s*_onGlobalMouseDown\(e\);/.test(reg)
    && /wheel:\s*\(e\)\s*=>\s*\{\s*_inputDiag\.wheel\+\+;\s*_onGlobalWheel\(e\);/.test(reg)
    && /keydown:\s*\(e\)\s*=>\s*\{\s*_inputDiag\.key\+\+;\s*_onGlobalKeyDown\(e\);/.test(reg),
    '  훅 3종은 등록 자리에서 감싸 센다 — 핸들러 본문은 안 건드린다(sim-wheel-kick 이 본문을 떼어 돌린다)');
  for(const n of ['_onGlobalMouseDown', '_onGlobalWheel', '_onGlobalKeyDown']){
    const b0 = code.indexOf('const ' + n + ' = ('); const body = code.slice(b0, code.indexOf('\n  };', b0));
    chk(!/_inputDiag/.test(body), '  ' + n + ' 본문에 _inputDiag 없음');
  }
  const rca = MAIN.slice(MAIN.indexOf('function _reportCursorActivity('), MAIN.indexOf('function _reportCursorActivity(') + 900);
  chk(rca.indexOf('_inputDiag.cursor++') > rca.indexOf('_penActivitySentAt = now'), '  커서 이동은 실제로 보낸 것만 센다(1초 상한 뒤)');
  const fin = MAIN.slice(MAIN.indexOf('try{ _reportCursorActivity(screen.getCursorScreenPoint(), CURSOR_MOVE_MIN_PX)'), MAIN.indexOf('try{ _reportCursorActivity(screen.getCursorScreenPoint(), CURSOR_MOVE_MIN_PX)') + 200);
  chk(/_inputDiagTick\(Date\.now\(\)\)/.test(fin), '  tick 은 500ms 폴링 finally 에 얹었다 — 새 타이머 0');
  chk((code.match(/_inputDiagTick\(/g) || []).length === 2, '  _inputDiagTick 호출 1곳(선언 제외)');
  /* 실제로 돌려 본다 */
  const i0 = MAIN.indexOf('const INPUT_DIAG_MS');
  const i1 = MAIN.indexOf('\n}\n', MAIN.indexOf('function _inputDiagTick')) + 3;
  const block = MAIN.slice(i0, i1);
  const env = { logs: [], st: { isFocusedAppRegistered: false, key: 'win:game.exe' } };
  const run = new Function('env', "const _diagLog = (m) => env.logs.push(m); const lastActiveState = env.st;\n" + block + "\nreturn { tick: _inputDiagTick, c: _inputDiag };")(env);
  run.tick(1000);                       // 첫 호출 — 기준 시각만 잡는다
  run.tick(1000 + 61000);
  chk(env.logs.length === 0, '① 등록 앱이 앞에 없으면 안 적는다');
  env.st.isFocusedAppRegistered = true;
  run.c.cursor = 7;
  run.tick(1000 + 61000 + 30000);
  chk(env.logs.length === 0, '  1분이 안 찼으면 안 적는다');
  run.tick(1000 + 61000 + 60000);
  chk(env.logs.length === 1 && /\[입력\] 앞창=win:game\.exe 등록=예/.test(env.logs[0]) && /클릭=0 휠=0 키=0 커서이동=7/.test(env.logs[0]) && /훅 미수신/.test(env.logs[0]), '★ ② 등록=예 · 훅 0 · 커서만 7 → «훅 미수신» 표식 — 이 줄이 UIPI 갈래의 증거다');
  chk(run.c.cursor === 0 && run.c.click === 0, '  카운터는 적은 뒤 0 으로');
  run.c.click = 3; run.c.key = 12;
  run.tick(1000 + 61000 + 120000);
  chk(env.logs.length === 2 && /클릭=3 휠=0 키=12/.test(env.logs[1]) && !/훅 미수신/.test(env.logs[1]), '  훅이 오면 표식 없음');
  chk(/INPUT_DIAG_MS\s*=\s*60\s*\*\s*1000/.test(MAIN), '  간격 60초');
}

/* ── 4. mac 쌍둥이 ── */
say('── 4. sysinput-mac.js — 내보내는 이름이 그대로(이 통로는 win 내부다)');
if(!MAC) huh('sysinput-mac.js 없음 — 같은 폴더에 두고 다시 돌릴 것');
else {
  const names = (src) => { const m = /module\.exports\s*=\s*\{([\s\S]*?)\};/.exec(src); return m ? m[1].split(',').map(s => s.trim()).filter(Boolean).sort() : null; };
  const a = names(SYS), b = names(MAC);
  chk(a && b && a.join() === b.join(), '내보내기 ' + (a ? a.length : '?') + '개가 두 파일에서 같다: ' + (a ? a.join(' ') : '?'));
  chk(!/tasklist/.test(strip(MAC)), '  mac 쪽엔 tasklist 가 없다(번들 id 는 권한과 무관하게 읽힌다)');
}

say('\n결과: 통과 ' + pass + ' · 실패 ' + fail + (huhs ? ' · 못봄 ' + huhs : ''));
process.exit(fail ? 1 : (huhs ? 2 : 0));
})();
