/* sim-winlist.js — 🎮 포커싱 어플 «목록에서 고르기» 창 목록(sysinput-win.js listWindows) · 등록 진단 줄(main.js)
   실행:  node sim-winlist.js   (sysinput-win.js · main.js 가 있는 폴더에서)
   ★ 왜 — 제보 «며칠 전까지 게임 등록 · 감지가 됐는데 오늘부터 안 됨, 해제 후 재등록하려니 등록조차 안 됨. 게임 외 프로그램은 됨».
     안티치트가 붙은 게임은 관리자 권한으로도 창 제목(getTitle)이 빈 값으로 올 수 있는데, 목록은 제목 없는 창을 통째로 뺐다.
     게다가 무엇을 왜 뺐는지 · 무엇을 등록했는지가 진단 기록에 안 남아 제보를 가를 수 없었다.
   ・1절: 실물 listWindows 를 가짜 창 목록 · tasklist 로 돌린다 — 제목 없는 큰 창은 넣음(표시 글) · 작은 창은 뺌 · 같은 exe 의 제목 있는 창이 이김 ·
     경로 못 읽은 창은 tasklist 이름 · 진단 한 줄(뺀 까닭 · 개수 · 이름)
   ・2절: main.js 등록 진단 줄(자동 · 실패 · 목록에서) · 3절: mutation test
   ・4절: 파일 탐색기(B-1125-7) — explorer.exe 창을 클래스 이름으로 가른다(win-class.js · win-class-worker.js). 폴더 창은 목록 · 활성 창 답에
     folder, 바탕화면 · 작업표시줄은 desktop. 일꾼이 없거나 · 답이 늦거나 · 죽으면 예전 판정(셸 창). 진짜 worker_threads 로도 한 번 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'apps/desktop/' + f, '../' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('sysinput-win.js'), MAIN = read('main.js'), CLS = read('win-class.js'), CLSW = read('win-class-worker.js'), PKG = read('package.json');
if (!SRC || !MAIN || !CLS || !CLSW || !PKG) { say('  ? 원본 못 찾음 — sysinput-win.js · main.js'); process.exit(2); }

/* 모듈을 가짜 네이티브로 싣는다 — node-window-manager 의 창 목록 · tasklist 출력은 시험마다 바꾼다 */
/* 가짜 node-window-manager — 실제처럼 windowManager.getWindows() 는 **경로 빈 창을 버리고**(isWindow: path && addon.isWindow),
   addon.getWindows() 는 창 id 를 다 준다. Window(id) 는 id 로 창을 찾는다 */
function fakeNwm(wins){
  const byId = new Map(wins.map((w, i) => { w.id = i + 1; return [w.id, w]; }));
  function Window(id){ return byId.get(id); }
  return {
    windowManager: { getWindows: () => wins.filter(w => w.path) },
    addon: { getWindows: () => wins.map(w => w.id), isWindow: () => true },
    Window,
  };
}
const loadCls = (src) => { const m = { exports: {} }; new Function('require', 'module', 'exports', 'Buffer', src)(require, m, m.exports, Buffer); return m.exports; };
function loadMod(src, wins, tasklist, noAddon, WorkerCls, clsSrc){
  const nwm = fakeNwm(wins);
  if (noAddon) { delete nwm.addon; delete nwm.Window; }
  const fake = {
    'node-window-manager': nwm,
    'uiohook-napi': { uIOhook: { on(){}, start(){}, stop(){} }, UiohookKey: {} },
    './native-peek': { peekUnpacked: () => '' },
    './win-class': loadCls(clsSrc || CLS),
    'child_process': { execFile: (cmd, args, opt, cb) => setImmediate(() => cb(null, tasklist || '')) },
    'path': path.win32, 'worker_threads': WorkerCls ? { Worker: WorkerCls } : {},   // 실제로는 Windows 에서 돈다 — 역슬래시 경로를 그 규칙으로 자른다
  };
  const mod = { exports: {} };
  const proc = { execPath: 'C:\\Program Files\\Together Working\\Together Working.exe' };
  new Function('require', 'module', 'exports', '__dirname', 'process', src.replace(/^'use strict';/m, ''))(
    (n) => { if (n in fake) return fake[n]; throw new Error('모르는 require ' + n); }, mod, mod.exports, 'C:\\tw\\resources\\app.asar', proc);
  const logs = [];
  mod.exports.init({ log: (m) => logs.push(m) });
  return { M: mod.exports, logs };
}
/* 창 하나 — node-window-manager Window 모양(win32 경로 · 제목 · 보임 · 크기 · pid) */
const W = (p, title, w, h, opt) => Object.assign({ path: p, processId: (opt && opt.pid) || 0,
  getTitle(){ if (opt && opt.titleThrows) throw new Error('access denied'); return title; },
  isVisible(){ return !(opt && opt.hidden); }, getBounds(){ return { x: 0, y: 0, width: w, height: h }; } }, {});

async function behave(src, noAddon){
  const r = {};
  const wins = [
    W('C:\\Games\\VALORANT-Win64-Shipping.exe', '', 1920, 1080),                 // 안티치트 게임 — 제목 빈 값
    W('C:\\Riot\\RiotClientServices.exe', '', 300, 200),                          // 제목 없는 작은 창 — 뺀다
    W('C:\\a\\chrome.exe', '', 1200, 800), W('C:\\a\\chrome.exe', 'Gmail', 1200, 800),   // 같은 exe — 제목 있는 쪽
    W('C:\\b\\notepad.exe', 'x', 900, 700), W('C:\\b\\notepad.exe', '', 900, 700),     // 제목 짧아도 있는 쪽이 이김
    W('', '', 1920, 1080, { pid: 4242 }),                                         // 경로 · 제목 둘 다 못 읽음 — tasklist 이름
    W('', 'Admin Tool', 800, 600, { pid: 5151 }),                                 // tasklist 에도 없음 — 뺀다
    W('C:\\Windows\\explorer.exe', '바탕 화면', 1920, 1080),
    W('C:\\c\\hidden.exe', 'h', 900, 700, { hidden: true }),
    W('C:\\d\\tray.exe', 't', 40, 20),
    W('C:\\e\\locked.exe', '', 1600, 900, { titleThrows: true }),                 // 제목 읽기가 던짐
  ];
  const { M, logs } = loadMod(src, wins, '"EasyAntiCheat_Game.exe","4242","Console","1","100 K"\r\n', noAddon);
  const res = await M.listWindows();
  const by = (n) => (res.list || []).find(x => x.name === n);
  r.ok = res.ok === true;
  r.game = !!by('valorant-win64-shipping.exe') && by('valorant-win64-shipping.exe').title === '(제목 없는 창)' && by('valorant-win64-shipping.exe').path.endsWith('VALORANT-Win64-Shipping.exe');
  r.smallOut = !by('riotclientservices.exe');
  r.titledWins = by('chrome.exe') && by('chrome.exe').title === 'Gmail' && by('notepad.exe') && by('notepad.exe').title === 'x' && res.list.filter(x => x.name === 'chrome.exe').length === 1;
  r.tasklist = !!by('easyanticheat_game.exe') && by('easyanticheat_game.exe').path === '';
  r.noName = !(res.list || []).some(x => x.title === 'Admin Tool');
  r.throws = !!by('locked.exe');
  r.rest = !by('explorer.exe') && !by('hidden.exe') && !by('tray.exe');
  const line = logs.find(l => l.indexOf('[목록]') === 0) || '';
  r.log = /창 12개 → \d+개\(경로 못 읽어 이름으로 1\)/.test(line) && /숨김 1/.test(line) && /제목 없는 작은 창 1/.test(line) && /이름 못 읽음 1\(pid 5151\)/.test(line)
    && /셸\/우리 앱 1/.test(line) && /작은 창 1/.test(line) && /제목 없이 넣음: .*valorant-win64-shipping\.exe/.test(line) && !/제목 없이 넣음: .*(chrome|notepad)/.test(line);   // 제목 있는 창이 이긴 것은 안 적는다
  r.line = line;
  return r;
}

(async () => {
  say('\n── 1절: 실물 listWindows');
  const b = await behave(SRC);
  chk(b.ok, '열거 성공');
  chk(b.game, '★ 제목을 못 읽은 큰 창(안티치트 게임)도 목록에 — 제목 자리는 «(제목 없는 창)»');
  chk(b.smallOut, '  제목 없는 작은 창(400×300 미만 — 보조 창)은 예전처럼 뺀다');
  chk(b.titledWins, '  같은 exe 에 제목 있는 창이 있으면 그쪽(짧아도) — 한 줄만');
  chk(b.tasklist, '★ 경로 · 제목 둘 다 못 읽은 큰 창(안티치트 · 보호 프로세스)도 tasklist 이름으로(경로는 빈 채) — 라이브러리 getWindows 는 이 창을 버린다');
  const noAddon = await behave(SRC, true);
  chk(noAddon.ok && noAddon.game && !noAddon.tasklist, '  addon 이 없는 판은 옛 경로(경로 빈 창은 라이브러리가 버림) — 던지지 않는다');
  chk(b.noName, '  tasklist 에도 없으면 뺀다');
  chk(b.throws, '  제목 읽기가 던져도 큰 창이면 넣는다');
  chk(b.rest, '셸 · 숨김 · 작은 창은 그대로 뺀다');
  chk(b.log, '★ 진단 한 줄 — 전체 · 넣은 수 · 뺀 까닭별 수 · 못 읽은 pid · 제목 없이 넣은 이름 (' + b.line.slice(0, 160) + ')');

  say('\n── 2절: main.js 등록 진단 줄');
  chk(/_diagLog\('\[등록\] 슬롯 ' \+ \(idx \+ 1\) \+ ' 자동 등록 실패 — ' \+ diag\);/.test(MAIN), '자동 등록 실패 — 까닭(diag)을 남긴다');
  chk(/_diagLog\('\[등록\] 슬롯 ' \+ \(idx \+ 1\) \+ ' ← ' \+ focusApps\[idx\]\.key \+ ' «' \+ focusApps\[idx\]\.name \+ '» 자동\(직전 창\)'\);/.test(MAIN), '자동 등록 — 무엇을(키 · 이름)');
  chk(/' «' \+ focusApps\[idx\]\.name \+ '» 목록에서' \+ \(pickedPath \? '' : ' \(경로 못 읽음 — 이름으로\)'\)\);/.test(MAIN), '목록에서 고름 — 무엇을 · 경로를 못 읽었는지');

  say('\n── 3절: mutation test');
  const old = await behave(SRC.replace("      if(!title && !big){ skip.untitledSmall++; continue; }", "      if(!title){ skip.untitledSmall++; continue; }"));
  chk(old.game === false, '제목 없는 창을 통째로 빼면(옛 동작) 1절 «안티치트 게임도 목록에» 가 빨강');
  const noLen = await behave(SRC.replace("(prev.title === UNTITLED_LABEL ? 0 : prev.title.length)", "prev.title.length"));
  chk(noLen.titledWins === false, '표시 글 길이로 비교하면 1절 «제목 있는 창이 이김» 이 빨강');

  const libOnly = await behave(SRC.replace("  if(nwmAddon && typeof nwmAddon.getWindows === 'function'", "  if(false && nwmAddon && typeof nwmAddon.getWindows === 'function'"));
  chk(libOnly.tasklist === false, '라이브러리 getWindows 로 되돌리면(경로 빈 창을 버림) 1절 «경로 못 읽은 큰 창도» 가 빨강 — 검증에서 잡힌 구멍');

  say('\n── 4절: 파일 탐색기 — explorer.exe 창의 갈래');
  const C = loadCls(CLS);
  chk(C.explorerKind('CabinetWClass').folder === true && C.explorerKind('CabinetWClass').desktop === false && C.explorerKind('ExploreWClass').folder === true,
    '★ 폴더 창 클래스(CabinetWClass · ExploreWClass) → folder');
  chk(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'XamlExplorerHostIslandWindow'].every(c => C.explorerKind(c).desktop === true && C.explorerKind(c).folder === false),
    '★ 그 밖의 explorer 창(바탕화면 · 작업표시줄 · 작업 전환) → desktop');
  chk(C.explorerKind('').folder === false && C.explorerKind('').desktop === false && C.explorerKind(undefined).desktop === false, '  클래스를 못 읽으면 둘 다 false(예전 판정으로)');
  /* 읽기 — 가짜 koffi(GetClassNameW 가 버퍼에 UTF-16 으로 적고 글자 수를 돌려준다) */
  const protos = [], asked = [];
  const koffiOf = (table) => ({ load: (dll) => ({ func: (proto) => { protos.push(dll + ' ' + proto); return (h, buf, max) => {
    asked.push([h, max]);
    const v = table[h]; if (v === undefined) return 0; if (typeof v === 'number') return v; if (v === 'THROW') throw new Error('x');
    return buf.write(v, 0, 'utf16le') / 2;
  }; } }) });
  const rlogs = [];
  const R = C.createClassReader({ requireKoffi: () => koffiOf({ 7: 'CabinetWClass', 8: 'Progman', 9: 9999, 10: 'THROW', 11: '탐색기Class' }), log: (m) => rlogs.push(m) });
  chk(R.usable() === true && R.read(7) === 'CabinetWClass' && R.read(8) === 'Progman' && R.read(11) === '탐색기Class', '★ GetClassNameW 답을 글자 수만큼 UTF-16 으로 읽는다(앞 답의 꼬리가 섞이지 않음)');
  chk(protos.length === 1 && /^user32\.dll /.test(protos[0]) && /GetClassNameW\(uintptr_t hWnd, void \*lpClassName, int nMaxCount\)/.test(protos[0]) && asked[0][1] === 256, '  user32 의 GetClassNameW 를 한 번만 묶는다 · 상한 256자');
  const n0 = asked.length;
  chk(R.read(0) === '' && R.read(-1) === '' && R.read('x') === '' && R.read(undefined) === '' && asked.length === n0, '  창 핸들이 없으면 부르지 않고 빈 값');
  chk(R.read(12) === '' && R.read(9) === '' && R.read(10) === '', '  실패(0) · 상한 밖 길이 · 던짐 → 빈 값');
  const blogs = [];
  const RB = C.createClassReader({ requireKoffi: () => { throw new Error('no koffi'); }, log: (m) => blogs.push(m) });
  chk(RB.usable() === false && RB.read(7) === '' && RB.read(7) === '' && blogs.length === 1, '  koffi 를 못 불러오면 못 씀 · 빈 값 · 기록 한 번');

  /* 일꾼 파일 — 가짜 parentPort */
  const runWorker = (koffi) => {
    const posts = []; let onMsg = null;
    const req = (n) => {
      if (n === 'worker_threads') return { parentPort: { postMessage: (m) => posts.push(m), on: (t, f) => { if (t === 'message') onMsg = f; } } };
      if (n === './win-class') return C;
      if (n === 'koffi') { if (!koffi) throw new Error('no koffi'); return koffi; }
      throw new Error('no ' + n);
    };
    new Function('require', CLSW)(req);
    return { posts, send: (m) => onMsg && onMsg(m), listening: () => !!onMsg };
  };
  const wk = runWorker(koffiOf({ 7: 'CabinetWClass' }));
  wk.send({ id: 3, hwnd: 7 }); wk.send({ id: 4, hwnd: 99 }); wk.send({ hwnd: 7 }); wk.send(null);
  chk(wk.posts.length === 2 && wk.posts[0].id === 3 && wk.posts[0].cls === 'CabinetWClass' && wk.posts[1].id === 4 && wk.posts[1].cls === '', '★ 일꾼 — { id, hwnd } 에 { id, cls } 로 답한다(못 읽으면 빈 값 · id 없는 요청은 무시)');
  const wk0 = runWorker(null);
  chk(wk0.listening() === false && wk0.posts.length === 2 && typeof wk0.posts[0].log === 'string' && wk0.posts[1].off === true, '  못 쓰는 PC — 까닭 기록 · «끝남» 을 보내고 받지 않는다');

  /* sysinput-win.js — 가짜 Worker 위에서 */
  const mkWorker = (mode, spawned, classes) => class {
    constructor(file){ if (mode === 'ctor') throw new Error('못 띄움'); this.file = file; this.L = {}; this.unrefd = false; this.asked = []; this.classes = classes || {}; spawned.push(this); }
    on(t, f){ (this.L[t] = this.L[t] || []).push(f); return this; }
    unref(){ this.unrefd = true; this.unrefAfter = Object.keys(this.L).length; }
    emit(t, v){ (this.L[t] || []).forEach(f => f(v)); }
    postMessage(m){
      this.asked.push(m.hwnd);
      if (mode === 'silent') return;
      if (mode === 'die') { setImmediate(() => { this.emit('error', new Error('죽음')); this.emit('exit', 1); }); return; }
      if (mode === 'off') { setImmediate(() => { this.emit('message', { log: '창 클래스 읽기 없음' }); this.emit('message', { off: true }); this.emit('exit', 0); }); return; }
      setImmediate(() => this.emit('message', { id: m.id, cls: this.classes[m.hwnd] || '' }));
    }
  };
  /* 창 id(hwnd)는 fakeNwm 이 순서대로 1.. 을 준다 */
  const scene = () => [
    W('C:\\Windows\\explorer.exe', 'Program Manager', 1920, 1080),   // 1 바탕화면
    W('C:\\Windows\\explorer.exe', '', 1920, 480),                    // 2 작업표시줄(제목 없음 · 큼)
    W('C:\\Windows\\explorer.exe', '문서', 1000, 700),                // 3 폴더 창
    W('C:\\a\\chrome.exe', 'Gmail', 1200, 800),                       // 4
    W('C:\\Windows\\System32\\ApplicationFrameHost.exe', '설정', 900, 700),   // 5 다른 셸 — 그대로 뺀다
  ];
  const CLASSES = { 1: 'Progman', 2: 'Shell_TrayWnd', 3: 'CabinetWClass', 5: 'CabinetWClass' };
  const runList = async (mode, src, clsSrc) => {
    const spawned = [];
    const { M, logs } = loadMod(src || SRC, scene(), '', false, mkWorker(mode, spawned, CLASSES), clsSrc);
    const t = Date.now();
    const res = await M.listWindows();
    return { res, ms: Date.now() - t, spawned, logs, M, ex: (res.list || []).filter(x => x.name === 'explorer.exe') };
  };
  const ok = await runList('ok');
  chk(ok.res.ok && ok.ex.length === 1 && ok.ex[0].title === '문서' && /explorer\.exe$/i.test(ok.ex[0].path), '★ 목록 — 파일 탐색기 폴더 창이 오른다(제목은 폴더 창 것 · 바탕화면 «Program Manager» 가 아님)');
  chk(!ok.res.list.some(x => x.name === 'applicationframehost.exe') && ok.res.list.some(x => x.name === 'chrome.exe'), '  다른 셸 창은 클래스가 무엇이든 그대로 뺀다 · 일반 창은 그대로');
  const w0 = ok.spawned[0];
  chk(ok.spawned.length === 1 && w0.asked.join(',') === '1,2,3' && w0.file === 'C:\\tw\\resources\\app.asar.unpacked\\win-class-worker.js' && w0.unrefd && w0.unrefAfter === 3,
    '★ explorer.exe 창만 묻는다(1,2,3) · 일꾼은 하나 · asar 밖 · 리스너를 붙인 뒤 unref (' + (w0 && w0.asked.join(',')) + ')');
  chk(/셸\/우리 앱 3/.test(ok.logs.find(l => l.indexOf('[목록]') === 0) || ''), '  진단 줄 — 뺀 셸 창 3(바탕화면 · 작업표시줄 · 설정)');
  /* 활성 창 */
  /* getActiveWindow 는 windowManager.getActiveWindow() 를 부른다 — 창 하나를 심어 따로 싣는다 */
  const loadAct = (win, mode, cls, src) => {
    const spawned = []; win.id = 1;
    const fake = {
      'node-window-manager': { windowManager: { getActiveWindow: () => win, getWindows: () => [] } },
      'uiohook-napi': { uIOhook: { on(){}, start(){}, stop(){} }, UiohookKey: {} },
      './native-peek': { peekUnpacked: () => '' }, './win-class': C,
      'child_process': { execFile: (c, a, o, cb) => setImmediate(() => cb(null, '"explorer.exe","77","Console","1","1 K"\r\n')) },
      'path': path.win32, 'worker_threads': { Worker: mkWorker(mode, spawned, { 1: cls }) },
    };
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', '__dirname', 'process', (src || SRC).replace(/^'use strict';/m, ''))((n) => { if (n in fake) return fake[n]; throw new Error('모르는 require ' + n); }, mod, mod.exports, '/x', { execPath: 'C:\\tw\\tw.exe' });
    mod.exports.init({ log: () => {} });
    return mod.exports.getActiveWindow().then(r => ({ r, spawned }));
  };
  const aF = await loadAct(W('C:\\Windows\\explorer.exe', '문서', 1000, 700), 'ok', 'CabinetWClass');
  chk(aF.r && aF.r.folder === true && aF.r.desktop === false && aF.r.owner.name === 'explorer.exe' && aF.r.title === '문서' && !!aF.r.bounds, '★ 활성 창 — 폴더 창이면 folder(나머지 칸은 그대로)');
  const aD = await loadAct(W('C:\\Windows\\explorer.exe', '', 1920, 48), 'ok', 'Shell_TrayWnd');
  chk(aD.r && aD.r.folder === false && aD.r.desktop === true, '★ 활성 창 — 작업표시줄 · 바탕화면이면 desktop');
  const aC = await loadAct(W('C:\\a\\chrome.exe', 'Gmail', 1200, 800), 'ok', 'CabinetWClass');
  chk(aC.r && aC.r.folder === false && aC.r.desktop === false && aC.spawned.length === 0, '★ explorer.exe 가 아니면 묻지도 · 일꾼을 띄우지도 않는다');
  const aAdm = await loadAct(W('', '문서', 1000, 700, { pid: 77 }), 'ok', 'CabinetWClass');
  chk(aAdm.r && aAdm.r.owner.path === '' && aAdm.r.folder === true, '  경로를 못 읽어 tasklist 이름으로 판정한 explorer 도 같은 갈래');
  const aU = await loadAct(W('C:\\Windows\\explorer.exe', '문서', 1000, 700), 'ok', '');
  chk(aU.r && aU.r.folder === false && aU.r.desktop === false, '  클래스를 못 읽으면 둘 다 false — 예전 판정(셸 창 · 등록했으면 집중)');

  /* 일꾼이 없거나 · 늦거나 · 죽어도 목록은 끝난다(예전처럼 explorer 는 빠진다) */
  const silent = await runList('silent');
  chk(silent.res.ok && silent.ex.length === 0 && silent.ms >= 250 && silent.ms < 3000 && silent.res.list.some(x => x.name === 'chrome.exe'), '★ 일꾼이 답이 없으면 시간 초과 뒤 예전 판정 — 목록은 끝난다(' + silent.ms + 'ms)');
  const die = await runList('die');
  chk(die.res.ok && die.ex.length === 0 && die.ms < 250 && die.spawned.length === 1 && die.spawned[0].asked.length === 1 && die.logs.filter(l => /창 클래스 일꾼 멈춤/.test(l)).length === 1,
    '★ 일꾼이 죽으면 기다리던 답을 바로 풀고 · 기록 한 번 · 다시 띄우지도 묻지도 않는다(' + die.ms + 'ms)');
  const off = await runList('off');
  chk(off.res.ok && off.ex.length === 0 && off.ms < 250 && off.logs.filter(l => /창 클래스/.test(l)).length === 1, '  못 쓰는 PC — 까닭 한 줄만 · 예전 판정');
  const ctor = await runList('ctor');
  chk(ctor.res.ok && ctor.ex.length === 0 && ctor.logs.filter(l => /창 클래스 일꾼을 못 띄움/.test(l)).length === 1, '  일꾼을 못 띄우면 기록 한 번 · 예전 판정');
  const b0 = await behave(SRC);
  chk(b0.rest && b0.log, '  worker_threads 가 없는 판에서도 1절 그대로(explorer 는 빠짐)');

  /* 진짜 worker_threads — 임시 폴더에 가짜 koffi 를 두고 그대로 띄운다. 답을 받은 뒤 프로세스가 스스로 끝나야 한다 */
  const realRun = (winSrc) => {
    const os = require('os'), cp = require('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-cls-'));
    try {
      fs.writeFileSync(path.join(dir, 'sysinput-win.js'), winSrc);
      fs.writeFileSync(path.join(dir, 'win-class.js'), CLS);
      fs.writeFileSync(path.join(dir, 'win-class-worker.js'), CLSW);
      fs.writeFileSync(path.join(dir, 'native-peek.js'), read('native-peek.js'));
      fs.mkdirSync(path.join(dir, 'node_modules', 'koffi'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'node_modules', 'koffi', 'index.js'),
        "module.exports = { load: () => ({ func: () => (h, buf) => buf.write(h === 5 ? 'CabinetWClass' : 'Progman', 0, 'utf16le') / 2 }) };\n");
      fs.mkdirSync(path.join(dir, 'node_modules', 'node-window-manager'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'node_modules', 'node-window-manager', 'index.js'),
        /* 경로는 이름만 — 이 무대는 검사 PC(리눅스일 수 있다)의 진짜 path 로 돌아 역슬래시를 못 자른다 */
        "let id = 5; const w = () => ({ id, path: 'explorer.exe', processId: 1, getTitle: () => 't', getBounds: () => ({ x: 0, y: 0, width: 900, height: 700 }) });\n" +
        "module.exports = { windowManager: { getActiveWindow: () => w(), getWindows: () => [] }, _set: (n) => { id = n; } };\n");
      fs.writeFileSync(path.join(dir, 'c.js'),
        "const S = require('./sysinput-win.js'); const N = require('node-window-manager'); S.init({ log: () => {} });\n" +
        "(async () => { const a = await S.getActiveWindow(); N._set(6); const b = await S.getActiveWindow(); console.log('KIND ' + a.folder + a.desktop + b.folder + b.desktop); })();\n");
      const env = Object.assign({}, process.env); delete env.NODE_PATH;
      const r = cp.spawnSync(process.execPath, [path.join(dir, 'c.js')], { timeout: 5000, encoding: 'utf8', env });
      return { ended: r.status === 0, kind: (String(r.stdout).match(/KIND (\S+)/) || [])[1] };
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  };
  const real = realRun(SRC);
  chk(real.ended && real.kind === 'truefalsefalsetrue', '★ 진짜 일꾼 — 폴더 창 · 바탕화면을 가르고(' + real.kind + ') 프로세스가 스스로 끝난다(앱 종료를 붙잡지 않음)');
  {
    const UNREF = "  /* 일꾼이 앱 종료를 붙잡지 않게 — 리스너를 다 붙인 뒤에 부른다(게임패드 일꾼과 같은 까닭) */\n  _clsWorker.unref();\n";
    const bad = SRC.includes(UNREF) ? SRC.replace(UNREF, '') : SRC;
    chk(bad !== SRC && realRun(bad).ended === false, 'mutation test — 창 클래스 일꾼의 unref 를 빼면 프로세스가 안 끝난다 → 빨강');
  }
  let pk = {}; try { pk = JSON.parse(PKG).build || {}; } catch (_) {}
  chk(['win-class.js', 'win-class-worker.js'].every(f => (pk.files || []).includes(f) && (pk.asarUnpack || []).includes(f)), '★ 설치본 — 두 파일은 build.files · asarUnpack 에');
  chk(!/require\('koffi'\)/.test(SRC) && /require\('koffi'\)/.test(CLSW) && !/require\('koffi'\)/.test(CLS), '  koffi 는 일꾼 파일만 싣는다(main 쪽 · 규칙 파일은 아님)');

  /* mutation test */
  const mut = async (name, a, b, judge, clsMut) => {
    const src = clsMut ? SRC : SRC.replace(a, b), cls = clsMut ? CLS.replace(a, b) : CLS;
    if (src === SRC && cls === CLS) { chk(false, 'mutation test — ' + name + ' (바꿀 글을 못 찾음)'); return; }
    let bad = false; try { bad = await judge(src, cls); } catch (_) { bad = true; }
    chk(bad, 'mutation test — ' + name + ' → 빨강');
  };
  await mut('폴더 창 예외를 빼면 목록에 안 오른다', " && !(await _explorerKindOf(name, w)).folder", '', async (s) => (await runList('ok', s)).ex.length === 0);
  await mut('모든 셸 창에 예외를 주면 «설정» 이 오른다', "  if(name !== EXPLORER_EXE) return explorerKind('');\n", '', async (s) => (await runList('ok', s)).res.list.some(x => x.name === 'applicationframehost.exe'));
  await mut('시간 초과를 빼면 답 없는 일꾼에서 목록이 안 끝난다', "    const timer = setTimeout(() => _clsAnswer(id, ''), CLASS_WAIT_MS);\n", '    const timer = 0;\n',
    async (s) => { const r = await Promise.race([runList('silent', s).then(() => 'done'), new Promise(res => setTimeout(() => res('hang'), 800))]); return r === 'hang'; });
  await mut('죽은 일꾼의 기다림을 안 풀면 시간 초과까지 기다린다', "  for(const id of Array.from(_clsWait.keys())) _clsAnswer(id, '');\n", '', async (s) => (await runList('die', s)).ms >= 250);
  await mut('바탕화면을 폴더 창으로 치면 목록 제목이 바뀐다', "new Set(['CabinetWClass', 'ExploreWClass'])", "new Set(['CabinetWClass', 'ExploreWClass', 'Progman'])",
    async (s, c) => { const r = await runList('ok', s, c); return !(r.ex.length === 1 && r.ex[0].title === '문서'); }, true);
  await mut('못 읽은 클래스를 바탕화면으로 치면 예전 판정이 깨진다', "  if(!cls) return NOT_EXPLORER;\n", '', async (s, c) => loadCls(c).explorerKind('').desktop === true, true);

  say(`\n결과: ${pass}·${fail}`);
  process.exit(fail ? 1 : 0);
})();
