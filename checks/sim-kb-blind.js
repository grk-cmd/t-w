/* ═══ ⌨️ sim-kb-blind.js — «키보드 입력이 전혀 안 잡힌다» 진단 안내 (2026-10-02 제보 · main.js) ═══════════════════════
   [제보] 업데이트 재설치 뒤로 키보드가 전혀 안 잡힌다 — 마우스만 잡혀서 타이핑하면 졸다가 자리비움(mac).
   [대응] 기록을 대신 쌓지 않는다. «OS 는 입력이 있었다는데 키 훅도 커서도 설명 못 하는» 순간을 세서
          부팅 5분 뒤 누적 60초(500ms × 120)를 넘으면 **고치는 법을 한 번** 알려 준다(mac = 입력 모니터링 설정 열기).
   ・1절: 배선(정적) — 500ms 폴링 안 순서 · 안내 문구/버튼 · «다시 보지 않기» · 활동으로 쓰지 않음.
   ・2절: 동작 — _kbReadHooks · _kbBlindTick 을 떼어 시계를 돌려 본다.
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
  chk(/checkboxLabel: '다시 보지 않기'/.test(GUIDE) && /r\.checkboxChecked/.test(GUIDE) && /writeFileSync\(f/.test(GUIDE), '«다시 보지 않기» 를 고르면 userData/kb-guide-off 에 남긴다');
  chk(!/anyInput|_markActivity|activity\s*=|reportActivity/.test(strip(READ) + strip(TICK)), '★ 판정값을 활동으로 쓰지 않는다(OS 유휴시간 보정은 센서 떨림 때문에 걷어 낸 방식)');
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
    const _diagLog = () => {};
    const _kbGuideOffPath = () => '/u/kb-guide-off';
    const require = () => ({ existsSync: () => !!env.optOut });
    const _kbShowGuide = () => { env.shown++; };
    ${READ}
    ${TICK}
    return { read: _kbReadHooks, tick: _kbBlindTick, cursor: (t) => { _kbLastCursorAt = t; }, n: () => _kbUnexplained };
  `)(env);
  const reset = (o = {}) => { Object.assign(env, { boot: 0, idle: 0, shown: 0, optOut: false, diag: { click:0, wheel:0, key:0, cursor:0 } }, o); return mk(); };
  /* 500ms 씩 `sec` 초 돌린다. each(t) 는 그 표본에서 일어날 일(훅 · 커서). */
  const run = (K, from, sec, each) => { let t = from; for(let i = 0; i < sec * 2; i++, t += 500){ if(each) each(t); K.read(t); K.tick(t); } return t; };

  let K = reset();
  run(K, 0, 10 * 60);
  chk(env.shown === 1, '★ mac 증상(OS 는 입력 있음 · 키 훅 0 · 커서 없음) → 부팅 5분 뒤 안내가 뜬다');
  run(K, 10 * 60 * 1000, 30 * 60);
  chk(env.shown === 1, '실행당 한 번만 — 계속 안 잡혀도 다시 안 띄운다');

  K = reset();
  let t = run(K, 0, 4 * 60 + 50);
  chk(env.shown === 0, '부팅 5분 안에는 아무리 쌓여도 안 띄운다(켜자마자 겁주지 않는다)');
  run(K, t, 20);
  chk(env.shown === 1, '5분이 지나면 그동안 쌓인 것으로 바로 판정');

  K = reset();
  run(K, 0, 10 * 60, (tt) => { if(tt % 30000 === 0) env.diag.key += 3; });
  chk(env.shown === 0, '★ 키가 한 번이라도 들어오면 그 실행 동안은 안 본다(훅이 살아 있다는 확증)');

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
  chk(env.shown === 0, '«다시 보지 않기» 를 골랐으면 안 띄운다');

  /* 카운터가 1분마다 0 으로 돌아가도(_inputDiagTick) 변화량을 맞게 읽는다 */
  K = reset();
  env.diag.key = 5; K.read(1000); env.diag.key = 0; K.read(1500); env.diag.key = 2; K.read(2000);
  run(K, 2500, 10 * 60);
  chk(env.shown === 0, '카운터가 0 으로 돌아간 직후의 키도 «들어왔다» 로 센다(줄면 0 부터 다시)');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
