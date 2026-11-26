/* ═══ ⌨️ sim-kb-blind.js — «키보드 입력이 전혀 안 잡힌다» 진단 안내 (2026-10-02 제보 · main.js) ═══════════════════════
   [제보] 업데이트 재설치 뒤로 키보드가 전혀 안 잡힌다 — 마우스만 잡혀서 타이핑하면 졸다가 자리비움(mac).
   [대응] 기록을 대신 쌓지 않는다. «OS 는 입력이 있었다는데 키 훅도 커서도 설명 못 하는» 순간을 세서
          부팅 5분 뒤 마지막 키 뒤로 누적 60초(500ms × 120)를 넘으면 먼저 훅을 다시 걸고, 또 넘으면
          (이번 실행에 키가 한 번도 없었을 때만) **고치는 법을 한 번** 알려 준다(mac = 입력 모니터링 설정 열기).
   ・1절: 배선(정적) — 500ms 폴링 안 순서 · 안내 문구/버튼 · «다시 보지 않기» · 활동으로 쓰지 않음.
   ・2절: 동작 — _kbReadHooks · _kbBlindTick 을 떼어 시계를 돌려 본다.
   ・3절: sysinput-win.js · sysinput-mac.js 의 restartGlobalHooks 를 가짜 uiohook 위에서 부른다.
   [실행] main.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('main.js', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const grabFn = (name) => { const i = SRC.indexOf('function ' + name + '('); if(i < 0) return ''; let k = SRC.indexOf('{', i), d = 0; for(; k < SRC.length; k++){ if(SRC[k] === '{') d++; else if(SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1); } return ''; };
const CODE = strip(SRC);
const READ = grabFn('_kbReadHooks'), TICK = grabFn('_kbBlindTick'), GUIDE = strip(grabFn('_kbShowGuide'));

say('── 1. 배선');
{
  chk(!!READ && !!TICK && !!GUIDE, '_kbReadHooks · _kbBlindTick · _kbShowGuide 를 찾았다');
  chk(/const KB_BLIND_MIN_UPTIME_MS = 5 \* 60 \* 1000;/.test(CODE) && /const KB_BLIND_TICKS = 120;/.test(CODE), '판정 기준 — 부팅 5분 뒤 · 설명 안 되는 입력 120회(×0.5초 = 60초)');
  const iR = CODE.indexOf('_kbReadHooks(Date.now());'), iC = CODE.indexOf('_reportCursorActivity(screen.getCursorScreenPoint()');
  const iD = CODE.indexOf('_inputDiagTick(Date.now());'), iB = CODE.indexOf('_kbBlindTick(Date.now());');
  chk(iR > 0 && iR < iD, '★ 훅 변화량은 _inputDiagTick(1분마다 0 으로) **앞**에서 읽는다 — 뒤면 그 1분 몫을 놓친다');
  chk(iB > iC && iC > 0, '판정은 커서 보고 **뒤** — 이번 표본의 커서 이동까지 본 다음 센다');
  chk(iR > 0 && iB > 0 && iB - iR < 800, '네 줄이 같은 500ms 폴링 안(새 타이머 없음)');
  chk(/_kbLastCursorAt = now;/.test(strip(grabFn('_reportCursorActivity'))), '커서 이동 보고가 «설명된 입력» 시각을 남긴다');
  chk(/x-apple\.systempreferences:com\.apple\.preference\.security\?Privacy_ListenEvent/.test(GUIDE), 'mac 안내 버튼 → 입력 모니터링 설정 바로 열기');
  chk(/입력 모니터링/.test(GUIDE) && /지운 뒤/.test(GUIDE) && /완전히 종료했다가 다시 실행/.test(GUIDE), 'mac 안내 — 재설치 뒤엔 «지웠다가 다시 추가 · 재실행» 을 말한다(켜져 보여도 안 먹는 경우)');
  chk(/TouchEn nxKey/.test(GUIDE) && /관리자 권한/.test(GUIDE), 'Windows 안내 — 키보드 보안 프로그램 · 관리자 권한 실행');
  chk(/자동 실행은 Windows 가 막아요/.test(GUIDE) && /진단 기록 폴더 열기[^\n]*tw-mouse-diag\.log/.test(GUIDE), '  관리자 권한이면 자동 실행이 막힌다는 안내 · 둘 다 아니면 진단 기록을 보내 달라는 안내');
  chk(/checkboxLabel: '다시 보지 않기'/.test(GUIDE) && /r\.checkboxChecked/.test(GUIDE) && /writeFileSync\(f/.test(GUIDE), '«다시 보지 않기» 를 고르면 userData/kb-guide-off 에 남긴다');
  chk(!/anyInput|_markActivity|activity\s*=|reportActivity/.test(strip(READ) + strip(TICK)), '★ 판정값을 활동으로 쓰지 않는다(OS 유휴시간 보정은 센서 떨림 때문에 걷어 낸 방식)');
  chk(/sysinput\.restartGlobalHooks\(\)/.test(strip(TICK)), '의심하면 먼저 sysinput.restartGlobalHooks() 로 훅을 다시 건다');
  chk(!/_inputDiag\.\w+\s*(\+\+|\+=|=)/.test(strip(READ)), '훅 카운터(_inputDiag)를 읽기만 한다 — 감싸기 줄은 sim-admin-active 가 모양까지 지킨다');
}

say('── 2. 동작');
{
  const env = {};
  const mk = () => new Function('env', `
    const KB_BLIND_MIN_UPTIME_MS = 5 * 60 * 1000, KB_BLIND_TICKS = 120;
    let _kbBootAt = env.boot, _kbKeyTotal = 0, _kbClickTotal = 0, _kbLastHookAt = 0, _kbLastCursorAt = 0;
    let _kbUnexplained = 0, _kbGuideShown = false;
    let _kbPrev = { click:0, wheel:0, key:0 };
    const _inputDiag = env.diag;
    const powerMonitor = { getSystemIdleTime: () => env.idle };
    const process = { platform: 'darwin' };
    const _diagLog = (x) => { env.logs.push(x); };
    const _kbGuideOffPath = () => '/u/kb-guide-off';
    const require = () => ({ existsSync: () => !!env.optOut });
    const _kbShowGuide = () => { env.shown++; };
    let _kbRearm = 0;
    const sysinput = { restartGlobalHooks: () => { env.rearms++; if(env.reviveOnRearm) env.alive = true; return true; } };
    ${READ}
    ${TICK}
    return { read: _kbReadHooks, tick: _kbBlindTick, cursor: (t) => { _kbLastCursorAt = t; }, n: () => _kbUnexplained };
  `)(env);
  const reset = (o = {}) => { Object.assign(env, { boot: 0, idle: 0, shown: 0, rearms: 0, logs: [], alive: false, reviveOnRearm: false, optOut: false, diag: { click:0, wheel:0, key:0, cursor:0 } }, o); return mk(); };
  /* 500ms 씩 `sec` 초 돌린다. each(t) 는 그 표본에서 일어날 일(훅 · 커서). */
  const run = (K, from, sec, each) => { let t = from; for(let i = 0; i < sec * 2; i++, t += 500){ if(each) each(t); K.read(t); K.tick(t); } return t; };

  let K = reset();
  run(K, 0, 10 * 60);
  chk(env.rearms === 1 && env.shown === 1, '★ mac 증상(OS 는 입력 있음 · 키 훅 0 · 커서 없음) → 부팅 5분 뒤 훅을 다시 걸고, 그래도 안 오면 안내가 뜬다');
  run(K, 10 * 60 * 1000, 30 * 60);
  chk(env.shown === 1, '실행당 한 번만 — 계속 안 잡혀도 다시 안 띄운다');

  K = reset();
  let t = run(K, 0, 4 * 60 + 50);
  chk(env.shown === 0, '부팅 5분 안에는 아무리 쌓여도 안 띄운다(켜자마자 겁주지 않는다)');
  run(K, t, 20);
  chk(env.rearms === 1 && env.shown === 0, '5분이 지나면 그동안 쌓인 것으로 바로 판정 — 먼저 훅을 다시 건다(안내는 아직)');
  run(K, t + 20000, 49);   // 다시 건 때(5:00) 뒤로 10초 + 49초
  chk(env.shown === 0, '다시 건 뒤 60초가 안 찼으면 안내를 아직 안 띄운다');
  run(K, t + 69000, 2);
  chk(env.shown === 1 && env.rearms === 1, '다시 건 뒤 또 60초 쌓이면 안내 — 다시 걸기는 한 번뿐');

  K = reset();
  run(K, 0, 10 * 60, (tt) => { if(tt % 30000 === 0) env.diag.key += 3; });
  chk(env.shown === 0 && env.rearms === 0, '키가 30초마다 들어오면(60초 안 참) 다시 걸지도 안내하지도 않는다');

  /* ★ 이번 제보 — 잘 들어오던 키가 도중에 끊긴다. 다시 걸면 살아나는 경우 · 안 살아나는 경우 */
  K = reset({ reviveOnRearm: true });
  env.alive = true;
  let t2 = run(K, 0, 10 * 60, (tt) => { if(env.alive && tt % 1000 === 0) env.diag.key++; });
  env.alive = false;
  t2 = run(K, t2, 70, (tt) => { if(env.alive && tt % 1000 === 0) env.diag.key++; });
  chk(env.rearms === 1, '★ 도중에 키가 끊기고 60초 쌓이면 훅을 다시 건다');
  run(K, t2, 10 * 60, (tt) => { if(env.alive && tt % 1000 === 0) env.diag.key++; });
  chk(env.rearms === 1 && env.shown === 0, '  다시 걸어 키가 돌아오면 그대로 — 안내도 더 걸기도 없음');
  env.alive = false;
  run(K, t2 + 10 * 60 * 1000, 70);
  chk(env.rearms === 2, '  돌아온 뒤 또 끊기면 다시 건다(키가 들어오면 처음으로 돌아간다)');

  K = reset();
  t2 = run(K, 0, 6 * 60, (tt) => { if(tt % 1000 === 0) env.diag.key++; });
  run(K, t2, 30 * 60);
  chk(env.rearms === 1 && env.shown === 0, '★ 키가 들어왔던 실행이면 다시 걸어도 안 와도 안내창은 없다(센서 떨림 오판 막기) · 다시 걸기도 한 번');
  chk(env.logs.filter(l => /다시 걸어도 키가 안 들어온다/.test(l)).length === 1, '  그때 «다시 걸어도 안 온다» 기록은 30분 동안 한 줄뿐(60초마다 되풀이하지 않는다)');

  K = reset();
  run(K, 0, 10 * 60, (tt) => K.cursor(tt));
  chk(env.shown === 0 && K.n() === 0, '커서 이동으로 설명되는 입력은 세지 않는다(마우스만 쓰는 사람)');

  K = reset();
  run(K, 0, 10 * 60, (tt) => { env.diag.click++; });
  chk(env.shown === 0 && K.n() === 0, '클릭 훅으로 설명되는 입력은 세지 않는다');

  K = reset({ idle: 3 });
  run(K, 0, 10 * 60);
  chk(env.shown === 0 && K.n() === 0, 'OS 도 입력이 없었다면(유휴 > 0) 세지 않는다 — 자리에 없는 사람');

  K = reset();
  run(K, 0, 10 * 60, (tt) => { if(tt % 1000 === 0) K.cursor(tt); });
  chk(env.shown === 0 && K.n() === 0, '1.5초 안에 커서가 움직였으면 그 사이 입력도 설명된 것으로 본다(1초마다 움직임)');
  K = reset();
  run(K, 0, 10 * 60, (tt) => { if(tt % 4000 === 0) K.cursor(tt); });
  chk(env.shown === 1, '커서가 띄엄띄엄(4초마다)이면 그 사이 입력은 설명 안 된 것 — 타이핑 중 가끔 마우스를 만지는 mac 증상도 잡는다');

  K = reset({ optOut: true });
  run(K, 0, 10 * 60);
  chk(env.shown === 0 && env.rearms === 1, '«다시 보지 않기» 를 골랐으면 안 띄운다(훅 다시 걸기는 한다)');

  /* 카운터가 1분마다 0 으로 돌아가도(_inputDiagTick) 변화량을 맞게 읽는다 */
  K = reset();
  env.diag.key = 5; K.read(1000); env.diag.key = 0; K.read(1500); env.diag.key = 2; K.read(2000);
  run(K, 2500, 10 * 60);
  chk(env.shown === 0, '카운터가 0 으로 돌아간 직후의 키도 «들어왔다» 로 센다(줄면 0 부터 다시)');
}

say('── 3. sysinput restartGlobalHooks — 가짜 uiohook 위에서 실제로 부른다');
{
  const path = require('path');
  const load = (file, hook) => {
    const src = fs.readFileSync(file, 'utf8'), logs = [];
    const req = (n) => {
      if(n === 'path') return path.win32;
      if(n === 'child_process') return { execFile(){} };
      if(n === 'fs') return fs;
      if(n === './native-peek') return { peekUnpacked: () => '' };
      if(n === 'uiohook-napi'){ if(!hook) throw new Error('no addon'); return { uIOhook: hook, UiohookKey: {} }; }
      if(n === 'node-window-manager') return { windowManager: { getActiveWindow(){ return null; }, getWindows(){ return []; } } };
      throw new Error('no ' + n);
    };
    const m = { exports: {} };
    new Function('require', 'module', 'exports', 'Buffer', 'process', src)(req, m, m.exports, Buffer, { execPath: 'C:\\tw\\tw.exe', platform: 'win32' });
    m.exports.init({ log: (x) => logs.push(x) });
    return { mod: m.exports, logs };
  };
  const fake = (o = {}) => { const calls = []; return { calls,
    on(ev){ calls.push('on:' + ev); }, stop(){ calls.push('stop'); },
    start(){ calls.push('start'); if(o.failSecond && calls.filter(c => c === 'start').length > 1) throw new Error('UIOHOOK_ERROR_SET_WINDOWS_HOOK_EX'); } }; };
  const H = { mousedown(){}, wheel(){}, keydown(){} };

  let h = fake(), S = load('sysinput-win.js', h);
  S.mod.startGlobalHooks(H);
  const ons = h.calls.filter(c => c.startsWith('on:')).length;
  const r = S.mod.restartGlobalHooks();
  const tail = h.calls.slice(-2).join();
  chk(r === true && tail === 'stop,start', 'win — 내렸다(stop) 다시 건다(start) · true');
  chk(h.calls.filter(c => c.startsWith('on:')).length === ons, 'win — 처리기를 다시 걸지 않는다(키 하나가 두 번 세지지 않게)');
  h = fake({ failSecond: true }); S = load('sysinput-win.js', h);
  S.mod.startGlobalHooks(H);
  chk(S.mod.restartGlobalHooks() === false && S.logs.some(l => /uIOhook\.start 실패/.test(l)), 'win — 다시 걸기가 실패하면 false · «uIOhook.start 실패» 기록');
  S = load('sysinput-win.js', null);
  chk(S.mod.restartGlobalHooks() === false, 'win — uiohook 을 못 실었으면 false(부를 것이 없다)');

  h = fake(); S = load('sysinput-mac.js', h);
  S.mod.startGlobalHooks(H);
  const n0 = h.calls.length;
  chk(S.mod.restartGlobalHooks() === null && h.calls.length === n0, 'mac — 다시 걸지 않는다(null · 네이티브 호출 없음 — 실행 도중 권한 창이 또 뜨지 않게)');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
