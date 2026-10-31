/* sim-winlist.js — 🎮 포커싱 어플 «목록에서 고르기» 창 목록(sysinput-win.js listWindows) · 등록 진단 줄(main.js)
   실행:  node sim-winlist.js   (sysinput-win.js · main.js 가 있는 폴더에서)
   ★ 왜 — 제보 «며칠 전까지 게임 등록 · 감지가 됐는데 오늘부터 안 됨, 해제 후 재등록하려니 등록조차 안 됨. 게임 외 프로그램은 됨».
     안티치트가 붙은 게임은 관리자 권한으로도 창 제목(getTitle)이 빈 값으로 올 수 있는데, 목록은 제목 없는 창을 통째로 뺐다.
     게다가 무엇을 왜 뺐는지 · 무엇을 등록했는지가 진단 기록에 안 남아 제보를 가를 수 없었다.
   ・1절: 실물 listWindows 를 가짜 창 목록 · tasklist 로 돌린다 — 제목 없는 큰 창은 넣음(표시 글) · 작은 창은 뺌 · 같은 exe 의 제목 있는 창이 이김 ·
     경로 못 읽은 창은 tasklist 이름 · 진단 한 줄(뺀 까닭 · 개수 · 이름)
   ・2절: main.js 등록 진단 줄(자동 · 실패 · 목록에서) · 3절: 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'apps/desktop/' + f, '../' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('sysinput-win.js'), MAIN = read('main.js');
if (!SRC || !MAIN) { say('  ? 원본 못 찾음 — sysinput-win.js · main.js'); process.exit(2); }

/* 모듈을 가짜 네이티브로 싣는다 — node-window-manager 의 창 목록 · tasklist 출력은 시험마다 바꾼다 */
function loadMod(src, wins, tasklist){
  const fake = {
    'node-window-manager': { windowManager: { getWindows: () => wins } },
    'uiohook-napi': { uIOhook: { on(){}, start(){}, stop(){} }, UiohookKey: {} },
    './native-peek': { peekUnpacked: () => '' },
    'child_process': { execFile: (cmd, args, opt, cb) => setImmediate(() => cb(null, tasklist || '')) },
    'path': path.win32, 'worker_threads': {},   // 실제로는 Windows 에서 돈다 — 역슬래시 경로를 그 규칙으로 자른다
  };
  const mod = { exports: {} };
  const proc = { execPath: 'C:\\Program Files\\Together Working\\Together Working.exe' };
  new Function('require', 'module', 'exports', '__dirname', 'process', src.replace(/^'use strict';/m, ''))(
    (n) => { if (n in fake) return fake[n]; throw new Error('모르는 require ' + n); }, mod, mod.exports, '/x', proc);
  const logs = [];
  mod.exports.init({ log: (m) => logs.push(m) });
  return { M: mod.exports, logs };
}
/* 창 하나 — node-window-manager Window 모양(win32 경로 · 제목 · 보임 · 크기 · pid) */
const W = (p, title, w, h, opt) => Object.assign({ path: p, processId: (opt && opt.pid) || 0,
  getTitle(){ if (opt && opt.titleThrows) throw new Error('access denied'); return title; },
  isVisible(){ return !(opt && opt.hidden); }, getBounds(){ return { x: 0, y: 0, width: w, height: h }; } }, {});

async function behave(src){
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
  const { M, logs } = loadMod(src, wins, '"EasyAntiCheat_Game.exe","4242","Console","1","100 K"\r\n');
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
  r.log = /창 12개 → \d+개/.test(line) && /숨김 1/.test(line) && /제목 없는 작은 창 1/.test(line) && /이름 못 읽음 1\(pid 5151\)/.test(line)
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
  chk(b.tasklist, '경로 · 제목 둘 다 못 읽은 큰 창도 tasklist 이름으로(경로는 빈 채)');
  chk(b.noName, '  tasklist 에도 없으면 뺀다');
  chk(b.throws, '  제목 읽기가 던져도 큰 창이면 넣는다');
  chk(b.rest, '셸 · 숨김 · 작은 창은 그대로 뺀다');
  chk(b.log, '★ 진단 한 줄 — 전체 · 넣은 수 · 뺀 까닭별 수 · 못 읽은 pid · 제목 없이 넣은 이름 (' + b.line.slice(0, 160) + ')');

  say('\n── 2절: main.js 등록 진단 줄');
  chk(/_diagLog\('\[등록\] 슬롯 ' \+ \(idx \+ 1\) \+ ' 자동 등록 실패 — ' \+ diag\);/.test(MAIN), '자동 등록 실패 — 까닭(diag)을 남긴다');
  chk(/_diagLog\('\[등록\] 슬롯 ' \+ \(idx \+ 1\) \+ ' ← ' \+ focusApps\[idx\]\.key \+ ' «' \+ focusApps\[idx\]\.name \+ '» 자동\(직전 창\)'\);/.test(MAIN), '자동 등록 — 무엇을(키 · 이름)');
  chk(/' «' \+ focusApps\[idx\]\.name \+ '» 목록에서' \+ \(pickedPath \? '' : ' \(경로 못 읽음 — 이름으로\)'\)\);/.test(MAIN), '목록에서 고름 — 무엇을 · 경로를 못 읽었는지');

  say('\n── 3절: 깨 보기');
  const old = await behave(SRC.replace("      if(!title && !big){ skip.untitledSmall++; continue; }", "      if(!title){ skip.untitledSmall++; continue; }"));
  chk(old.game === false, '제목 없는 창을 통째로 빼면(옛 동작) 1절 «안티치트 게임도 목록에» 가 빨강');
  const noLen = await behave(SRC.replace("(prev.title === UNTITLED_LABEL ? 0 : prev.title.length)", "prev.title.length"));
  chk(noLen.titledWins === false, '표시 글 길이로 비교하면 1절 «제목 있는 창이 이김» 이 빨강');

  say(`\n결과: ${pass}·${fail}`);
  process.exit(fail ? 1 : 0);
})();
