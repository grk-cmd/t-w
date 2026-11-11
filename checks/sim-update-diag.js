/* ═══ 🩺 sim-update-diag.js — 업데이트 진단(apps/desktop/update-diag.js · main.js 배선) ═══════════════
   [왜] «업데이트를 받기 시작하면 먹통» 제보(B-1110-6)를 진단 기록 한 장으로 가르게 — electron-updater 의 자기 기록 · 받는 % · 오류를 남긴다.
   ・1절: 모듈을 불러 돌린다 — logger 세 갈래 · debug 버림 · 홈 폴더 → ~ · 줄바꿈 · 길이 상한 · 진행은 10% 칸마다 · reset
   ・2절: 배선 — main.js 가 autoUpdater.logger 를 걸고 진행 · 새 판에서 부른다 · 설치 목록(package.json files)
   ・3절: 깨 보기
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', '..', path.join('..', 'apps', 'desktop')];
const read = (f) => { for(const d of DIRS){ const p = path.join(d, f); if(fs.existsSync(p)) return fs.readFileSync(p, 'utf8'); } return null; };
const MOD = read('update-diag.js'), MAIN = read('main.js'), PKG = read('package.json');
for(const [n, v] of [['update-diag.js', MOD], ['main.js', MAIN], ['package.json', PKG]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const HMP = (() => { for(const d of DIRS){ const p = path.resolve(d, 'home-mask.js'); if(fs.existsSync(p)) return p; } return null; })();
if(!HMP){ say('  ? 원본 못 찾음 — home-mask.js'); process.exit(2); }
const req = (m) => (m === './home-mask' ? require(HMP) : require(m));   // 모듈이 부르는 이웃 파일을 찾은 자리에서
const load = (src) => { const m = { exports: {} }; new Function('module', 'require', src)(m, req); return m.exports; };

const HOME = 'C:\\Users\\홍길동';
function behave(src){
  const M = load(src), lines = [], r = {};
  const d = M.createUpdateDiag({ log: (m) => lines.push(m), home: HOME });
  d.logger.info('Download block maps (old: x, new: y)');
  d.logger.warn('Cannot download differentially, fallback to full download');
  d.logger.error(new Error('net::ERR_CONNECTION_RESET'));
  d.logger.debug('아주 많은 줄');
  r.levels = lines.length === 3 && /^\[업데이트\] Download block maps/.test(lines[0]) && /^\[업데이트\] ⚠ Cannot/.test(lines[1]) && /^\[업데이트\] ✗ net::ERR_CONNECTION_RESET$/.test(lines[2]);
  lines.length = 0;
  d.logger.info('New version 0.12.3 has been downloaded to ' + HOME + '\\AppData\\Local\\together-working-updater\\pending\\x.exe');
  r.home = lines.length === 1 && !lines[0].includes('홍길동') && lines[0].includes('~\\AppData\\Local\\together-working-updater');
  lines.length = 0;
  d.logger.info('줄\n바꿈\r\n' + 'x'.repeat(1000));
  r.clean = lines.length === 1 && !/[\n\r]/.test(lines[0]) && lines[0].length <= '[업데이트] '.length + M.MSG_MAX;
  lines.length = 0;
  const seq = [0, 3, 9.9, 10, 15, 47, 50, 99.9, 100, 100];
  const wrote = seq.map((pc) => d.progress({ percent: pc, transferred: pc * 1048576, total: 100 * 1048576, bytesPerSecond: 2048 }));
  r.step = JSON.stringify(wrote) === JSON.stringify([true, false, false, true, false, true, true, true, true, false]) && lines.length === 6;
  r.text = /^\[업데이트\] 받는 중 40% · 47\.0\/100\.0MB · 2KB\/s$/.test(lines[2]);
  d.reset(); lines.length = 0;
  r.reset = d.progress({ percent: 0 }) === true && /받는 중 0% · 0\/0MB · 0KB\/s$/.test(lines[0]);
  r.edge = d.progress(null) === false && d.progress({ percent: 250 }) === true && /받는 중 100%/.test(lines[1]);
  return r;
}

say('── 1. 모듈 동작');
const b = behave(MOD);
chk(b.levels, '★ logger — info · warn(⚠) · error(✗, Error 는 message) 한 줄씩 · debug 는 버린다');
chk(b.home, '★ 홈 폴더(사용자 이름)를 ~ 로 바꾼다 — 기록 파일을 그대로 보내도 이름이 안 나간다');
chk(b.clean, '  줄바꿈은 한 줄로 · 길이 상한');
chk(b.step, '★ 진행은 10% 칸에 새로 들어설 때만 한 줄');
chk(b.text, '  받은 양 · 전체 · 속도를 적는다');
chk(b.reset, '  새 판을 찾으면(reset) 0% 부터 다시 적는다');
chk(b.edge, '  빈 값은 0 · 100 넘는 값은 100');

say('── 2. 배선');
chk(/require\('\.\/update-diag'\)/.test(MAIN) && /autoUpdater\.logger = _updateDiag\.logger;/.test(MAIN), "★ main.js — autoUpdater.logger 를 진단 기록으로");
chk(/autoUpdater\.on\('download-progress', \(p\) => \{ _updateDiag\.progress\(p\);/.test(MAIN), '  받는 중마다 progress');
chk(/autoUpdater\.on\('update-available', \(info\) => \{ _updateDiag\.reset\(\);/.test(MAIN), '  새 판을 찾으면 reset');
chk(/createUpdateDiag\(\{ log: \(m\) => _diagLog\(m\), home: require\('os'\)\.homedir\(\) \}\)/.test(MAIN), '  기록은 _diagLog · 홈 폴더를 넘긴다');
chk(/"update-diag\.js"/.test(PKG), '설치 목록(package.json files)에 update-diag.js — 빠지면 설치본이 켜지지 않는다');

say('── 3. 깨 보기');
chk(!behave(MOD.replace('s = maskHome(s, home);', '')).home, '홈 폴더 가리기를 빼면 위 1절 «~» 가 빨강');
chk(!behave(MOD.replace('if(step === lastStep) return false;', '')).step, '칸 검사를 빼면 위 1절 «10% 칸마다» 가 빨강');
chk(!behave(MOD.replace('debug: () => {},', 'debug: (m) => log(TAG + clean(m)),')).levels, 'debug 를 적으면 위 1절 logger 가 빨강');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
