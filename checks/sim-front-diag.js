/* sim-front-diag.js — 🩺 앞 창 진단(front-diag.js · main.js 배선 · sysinput bounds)
   실행:  node sim-front-diag.js   (front-diag.js · main.js · sysinput-win.js · sysinput-mac.js 가 있는 폴더에서)
   ★ 왜 — «앱을 켜 두면 게임 · 영상이 버벅인다» 제보를 로그 한 장으로 가르려면 1분 [프레임] 줄에 그때 앞 창과
     그 창이 모니터를 꽉 채웠는지가 같이 있어야 한다. 줄이 틀리면(최대화를 전체화면으로 · 창 제목 적힘) 판단이 틀린다.
   ・1절: coversDisplay — 꽉 채움 · 최대화(작업표시줄) · 반올림 오차 · 빈 값
   ・2절: createFrontWatch — 비율 · 가장 많이 앞에 있던 exe · take 뒤 새로 셈 · 오래된 표본 버림 · 이름 길이 상한
   ・3절: suffix · isFrameLine — 꼬리 모양 · 표본 없음 · [프레임] 줄만
   ・4절: 깨 보기 — 갈래를 하나씩 지운 모듈로 1 · 2절을 다시 돌려 빨강이 나는지
   ・5절: 배선 — main 이 싣고 폴링에서 note · diagNote 에서 [프레임] 줄에만 붙임 · 창 제목 안 넘김 · sysinput 둘 다 bounds */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/shared/' + f, 'app/parts/shared/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('front-diag.js'), MAIN = read('main.js'), SWIN = read('sysinput-win.js'), SMAC = read('sysinput-mac.js');
if (!MOD || !MAIN || !SWIN || !SMAC) { say('  ? 원본 못 찾음 — front-diag.js · main.js · sysinput-win.js · sysinput-mac.js'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwFrontDiag; };

const D = { width: 1920, height: 1080 };
function runCovers(F){
  const r = [];
  r.push(F.coversDisplay({ x: 0, y: 0, width: 1920, height: 1080 }, D) === true);        // 0 전체화면 게임
  r.push(F.coversDisplay({ width: 1920, height: 1040 }, D) === false);                   // 1 최대화(작업표시줄 40)
  r.push(F.coversDisplay({ width: 1919, height: 1079 }, D) === true);                    // 2 배율 나눗셈 반올림
  r.push(F.coversDisplay({ width: 2560, height: 1440 }, D) === true);                    // 3 더 큰 창
  r.push(F.coversDisplay(null, D) === false && F.coversDisplay({ width: 1920, height: 1080 }, null) === false);   // 4 빈 값
  r.push(F.coversDisplay({ width: 0, height: 0 }, { width: 0, height: 0 }) === false);   // 5 0 크기(최소화)
  return r;
}
function runWatch(F){
  const r = [];
  const w = F.createFrontWatch();
  for (let i = 0; i < 80; i++) w.note(i * 500, 'Discord.exe', true);
  for (let i = 80; i < 100; i++) w.note(i * 500, 'chrome.exe', false);
  const m = w.take(50000);
  r.push(m.samples === 100 && Math.abs(m.fullShare - 0.8) < 1e-9);                     // 0 비율
  r.push(m.exe === 'Discord.exe');                                                      // 1 가장 많이 앞에 있던 것
  const m2 = w.take(60000);
  r.push(m2.samples === 0 && m2.fullShare === 0 && m2.exe === '');                     // 2 take 뒤 새로 셈
  const ws = F.createFrontWatch();
  ws.note(0, 'old.exe', true);
  ws.note(F.STALE_MS + 1, 'new.exe', false);
  const m3 = ws.take(F.STALE_MS + 2);
  r.push(m3.samples === 1 && m3.exe === 'new.exe' && m3.fullShare === 0);              // 3 오래된 표본 버림
  w.note(0, 'x'.repeat(200), false);
  r.push(w.take(1).exe.length === F.EXE_MAX);                                          // 4 이름 길이 상한
  w.note(0, '', true); w.note(1, '', true);
  const m5 = w.take(2);
  r.push(m5.samples === 2 && m5.fullShare === 1 && m5.exe === '');                     // 5 이름 못 읽은 표본도 분모
  return r;
}
const COVER_MSG = ['꽉 채운 창(전체화면 게임 · 영상) → 전체화면', '최대화(작업표시줄만큼 작음) → 아님', '배율 나눗셈 반올림(-1px) → 전체화면', '모니터보다 큰 창 → 전체화면', '빈 값 → 아님', '0 크기(최소화) → 아님'];
const WATCH_MSG = ['1분 100표본 중 80 전체화면 → 80%', 'exe 는 가장 오래 앞에 있던 것', 'take 뒤 새로 센다', '[프레임] 줄이 안 오면 2분 넘은 표본은 버린다', 'exe 이름 길이 상한', '이름 못 읽은 표본도 비율 분모에 든다'];

const F = load(MOD);
say('── 1. coversDisplay');
runCovers(F).forEach((ok, i) => chk(ok, COVER_MSG[i]));
say('── 2. createFrontWatch');
runWatch(F).forEach((ok, i) => chk(ok, WATCH_MSG[i]));

say('── 3. suffix · isFrameLine');
chk(F.suffix({ samples: 100, fullShare: 0.85, exe: 'Discord.exe' }) === ' · 앞 창 Discord.exe · 전체화면 85%', '꼬리 모양: « · 앞 창 Discord.exe · 전체화면 85%»');
chk(F.suffix({ samples: 0, fullShare: 0, exe: '' }) === ' · 앞 창 모름' && F.suffix(null) === ' · 앞 창 모름', '표본 없음 → « · 앞 창 모름»(0% 로 속이지 않는다)');
chk(F.suffix({ samples: 3, fullShare: 0, exe: '' }) === ' · 앞 창 모름 · 전체화면 0%', '이름만 못 읽음 → 비율은 적는다');
chk(F.isFrameLine('[프레임] 60초 1200장 20fps') === true, '[프레임] 줄 → 붙인다');
chk(F.isFrameLine('[GL] 복구') === false && F.isFrameLine('x [프레임]') === false && F.isFrameLine(null) === false, '다른 줄 · 중간에 든 것 · 빈 값 → 안 붙인다');
{
  const fbSrc = read('frame-budget.js');
  if (fbSrc) {
    const w = {}; new Function('window', 'module', fbSrc)(w, undefined);
    const line = w.FrameBudget.diagLine({ ms: 60000, frames: 1200, focusedShare: 0, cap: 20, pr: 1.5, w: 2880, h: 1620, q: 'sharp' });
    chk(F.isFrameLine(line) && (line + F.suffix({ samples: 120, fullShare: 1, exe: 'game.exe' })).length <= 200, 'frame-budget 의 진짜 [프레임] 줄을 알아보고 꼬리를 붙여도 짧다(로그 회전 256KB)');
  } else chk(false, 'frame-budget.js 못 찾음');
}

say('── 4. 깨 보기');
const breaks = [
  ['크기 비교를 «작업 영역 아무거나» 로(최대화도 전체화면)', MOD.replace('return w >= dw - FULL_TOL && h >= dh - FULL_TOL;', 'return w >= dw - FULL_TOL;'), 'covers'],
  ['오차를 0 으로', MOD.replace('const FULL_TOL = 2;', 'const FULL_TOL = 0;'), 'covers'],
  ['take 가 새로 세지 않음', MOD.replace('    reset(t);\n    return out;', '    return out;'), 'watch'],
  ['오래된 표본을 안 버림', MOD.replace('if(since == null || t - since > STALE_MS) reset(t);', 'if(since == null) reset(t);'), 'watch'],
  ['이름 길이 상한 없음', MOD.replace('.slice(0, EXE_MAX)', ''), 'watch'],
];
for (const [name, src, which] of breaks) {
  if (src === MOD) { chk(false, '깨 보기 «' + name + '» — 바꿀 글을 못 찾음(모듈이 바뀌었다)'); continue; }
  const r = which === 'covers' ? runCovers(load(src)) : runWatch(load(src));
  chk(r.some(ok => !ok), '깨면 빨강 — ' + name);
}

say('── 5. 배선');
chk(/const FrontDiag = require\('\.\/app\/parts\/shared\/front-diag'\);/.test(MAIN), 'main 이 front-diag 를 싣는다');
chk(/const _frontWatch = FrontDiag\.createFrontWatch\(\);/.test(MAIN), 'main — 감시 하나');
const poll = (MAIN.match(/function startActiveWinPolling\(\)\{[\s\S]*?\n\}/) || [''])[0];
chk(/FrontDiag\.coversDisplay\(w\.bounds, /.test(poll) && /_frontWatch\.note\(Date\.now\(\), exeName, frontFull\);/.test(poll), '활성 창 폴링에서 앞 창 크기 · exe 를 센다');
chk(!/getRunDisplay\(\)/.test(poll), '폴링에서 getRunDisplay 를 안 부른다(저장 · 로그가 딸림)');
const dn = (MAIN.match(/ipcMain\.on\('companion:diagNote'[\s\S]*?\n  \}\);/) || [''])[0];
chk(/if\(FrontDiag\.isFrameLine\(line\)\) line \+= FrontDiag\.suffix\(_frontWatch\.take\(Date\.now\(\)\)\);/.test(dn), 'diagNote — [프레임] 줄에만 꼬리');
chk(/e\.sender !== mainWindow\.webContents\) return;/.test(dn) && /_diagLog\('\[렌더러\] ' \+ line\);/.test(dn), 'diagNote — 메인 창에서 온 것만 · 머리표 그대로');
chk(!/title/.test(MOD.replace(/\/\*[\s\S]*?\*\//g, '')) && !/_frontWatch\.note\([^)]*title/.test(MAIN), '창 제목은 진단에 안 들어간다(실행 파일 이름만)');
const gaw = (src) => (src.match(/async function getActiveWindow\(\)\{[\s\S]*?\n\}/) || [''])[0];
chk(/bounds = w\.getBounds\(\)/.test(gaw(SWIN)) && (gaw(SWIN).match(/title, bounds \}/g) || []).length === 2, 'sysinput-win — 두 갈래(경로 있음 · 관리자 권한) 모두 bounds');
chk(/bounds = w\.getBounds\(\)/.test(gaw(SMAC)) && /title, bounds \}/.test(gaw(SMAC)) && !/w\.getTitle\(/.test(gaw(SMAC).replace(/\/\/.*$/gm, '')), 'sysinput-mac — bounds(getTitle 금지는 그대로)');

say('\n' + (fail ? '✗' : '✓') + ' sim-front-diag: ' + pass + ' 통과 · ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
