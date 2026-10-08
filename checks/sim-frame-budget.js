/* ═══ 🔋 sim-frame-budget.js — 실행 화면 프레임 상한 · 해상도 배율 · 진단 줄 (frame-budget.js) ═══════════
   제보: RTX 3060 Ti · Windows — 앱을 켜 두면 크롬(트위터)이 많이 버벅인다.
   ・1절: pickFps 표 — 최대 60 · 손 안 대면 30(실행 화면 · 포커스 · 하는 중 아님) · 다른 창 20 · hot 이면 60
   ・2절: admit — 예정 시각을 쌓아 144 · 165 · 120 · 75 · 60Hz 에서 평균이 상한에 맞는다 · 멈춤 뒤 몰아 그리지 않는다
   ・3절: runPixelRatio — 플랫폼 상관없이 1.5 · 도트 렌더 1
   ・4절: 포커스 비율 · 진단 줄(짧게)
   ・5절: 배선 — html 이 app.js 앞에 싣는다 · app.js 가 runPixelRatio · 1분 진단을 쓴다
   [실행] frame-budget.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['frame-budget.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const win = {};
new Function('window', 'module', SRC['frame-budget.js'])(win, undefined);
const F = win.FrameBudget;

say('── 1. pickFps');
chk(F.FPS_ACTIVE === 60 && F.FPS_IDLE === 30 && F.FPS_UNFOCUSED === 20, '상한 셋: 60 · 30 · 20');
const idle = F.IDLE_AFTER_MS;
chk(F.pickFps({ focused:true, runMode:true, idleMs:0 }) === 60, '포커스 · 방금 손댐 → 60(상한 없음이 아니다)');
chk(F.pickFps({ focused:true, runMode:true, idleMs:idle - 1 }) === 60, '문턱 직전 → 60');
chk(F.pickFps({ focused:true, runMode:true, idleMs:idle }) === 30, '손 안 댄 지 ' + idle / 1000 + '초 → 30');
chk(F.pickFps({ focused:true, runMode:true, busy:true, idleMs:idle * 10 }) === 60, '하는 중이면 30 으로 안 내린다');
chk(F.pickFps({ focused:true, runMode:false, idleMs:idle * 10 }) === 60, '실행 화면이 아니면(런처) 30 으로 안 내린다');
chk(F.pickFps({ focused:false, runMode:true, idleMs:0 }) === 20, '다른 창 → 20');
chk(F.pickFps({ focused:false, runMode:true, busy:true, idleMs:0 }) === 20, '다른 창이면 «하는 중» 은 상한을 안 올린다(춤도 20 — 예전 그대로)');
chk(F.pickFps({ focused:false, hot:true }) === 60 && F.pickFps({ focused:true, hot:true, runMode:true, idleMs:idle * 10 }) === 60, 'hot(누름 · 끌기 · 비행) → 60');
chk(F.pickFps() === 20, '빈 값 → 20(안전 쪽)');
chk(idle >= 5000, '30 으로 내려가는 문턱이 5초 이상(오르내림이 잦지 않게)');

say('── 2. admit — 실제로 그린 장 수');
function count(fps, hz, ms){
  const B = F.createFrameBudget({ now: ()=>0 });
  let n = 0; const step = 1000 / hz;
  for(let t = 0; t < ms; t += step) if(B.admit(t, fps)) n++;
  return n;
}
for(const hz of [144, 165, 120, 75, 60]){
  const n = count(60, hz, 10000);
  chk(Math.abs(n - 600) <= 10, hz + 'Hz · 상한 60 → 10초에 ' + n + '장(≈600)');
}
for(const hz of [144, 60]){
  const n = count(30, hz, 10000), m = count(20, hz, 10000);
  chk(Math.abs(n - 300) <= 6 && Math.abs(m - 200) <= 6, hz + 'Hz · 상한 30 → ' + n + '장 · 20 → ' + m + '장');
}
{
  const B = F.createFrameBudget({ now: ()=>0 });
  chk(B.admit(0, 0) === true && B.admit(0.1, 0) === true, '상한 0 = 매번 그린다');
  B.admit(0, 60);
  let n = 0; for(let t = 5000; t < 5100; t += 1000 / 144) if(B.admit(t, 60)) n++;   // 5초 멈춘 뒤
  chk(n <= 7, '멈춘 뒤 밀린 몫을 몰아 그리지 않는다(0.1초에 ' + n + '장)');
  /* 상한이 낮아지면 마지막 장부터 새 간격 */
  const C = F.createFrameBudget({ now: ()=>0 });
  C.admit(0, 60);
  chk(C.admit(17, 30) === false && C.admit(34, 30) === true, '60 → 30 으로 바뀌면 마지막 장에서 33ms 뒤에 그린다');
}

say('── 3. runPixelRatio');
chk(F.RUN_MAX_PR === 1.5, '실행 화면 배율 상한 1.5(mac · Windows 같은 값)');
chk(F.runPixelRatio(2, false) === 1.5 && F.runPixelRatio(1.25, false) === 1.25 && F.runPixelRatio(1, false) === 1, 'DPR 2 → 1.5 · 1.25 · 1 은 그대로');
chk(F.runPixelRatio(2, true) === 1 && F.runPixelRatio(1.25, true) === 1, '도트 렌더면 1');
chk(F.runPixelRatio(undefined, false) === 1 && F.runPixelRatio(0, false) === 1, '배율을 못 읽으면 1');

say('── 4. 포커스 비율 · 진단 줄');
{
  const B = F.createFrameBudget({ now: ()=>0 });
  B.noteFocus(true, 0); B.noteFocus(false, 15000); B.noteFocus(true, 45000);
  for(let t = 0; t < 60000; t += 1000 / 60) B.admit(t, 30);
  const m = B.takeMinute(60000);
  chk(Math.abs(m.focusedShare - 0.5) < 1e-9 && m.ms === 60000, '포커스 15초 + 15초 / 60초 = 50%');
  chk(Math.abs(m.frames - 1800) <= 2, '그린 장 수 ' + m.frames + '(≈1800)');
  const m2 = B.takeMinute(120000);
  chk(m2.frames === 0 && Math.abs(m2.focusedShare - 1) < 1e-9, '다음 1분은 새로 센다 · 포커스가 이어지면 100%');
  const line = F.diagLine(Object.assign(m, { cap: 30, pr: 1.5, w: 2880, h: 1620 }));
  say('    ' + line);
  chk(/^\[프레임\] 60초 1800장 30fps · 포커스 50% · 상한 30 · 배율 1\.5 · 2880x1620$/.test(line), '진단 줄 모양');
  chk(line.length <= 80, '짧다(' + line.length + '자 — 진단 파일은 256KB 에서 돌려 쓴다)');
}

say('── 5. 배선');
{
  const H = SRC['desk-companion-prototype.html'];
  const a = H.indexOf('<script src="parts/frame-budget.js"></script>'), b = H.indexOf('<script src="parts/app.js"></script>');
  chk(a > 0 && b > a, 'html 이 frame-budget.js 를 app.js 앞에 싣는다');
  const code = SRC['app.js'].replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  chk(/FrameBudget\.runPixelRatio\(devicePixelRatio, dotRenderEnabled\)/.test(code), '실행 화면 배율을 runPixelRatio 로(한 곳)');
  chk(/return !_frameBudget\.admit\(now, _frameCap\(now\)\);/.test(code), '_frameCapped 가 admit 으로 판정');
  chk(/companion\.diagNote\(_FB\.diagLine\(m\)\);[\s\S]{0,40}\}, 60000\);/.test(code) && /if\(!document\.body\.classList\.contains\('runmode'\)\) return;/.test(code), '1분마다 · 실행 화면에서만 진단 줄');
  chk(!/requestAnimationFrame\([^)]*diag/i.test(code), '진단은 rAF 가 아니라 1분 타이머');
}

say('');
say(fail ? '✗ 실패 ' + fail + '건' : '✓ 전부 통과 (' + pass + ')');
process.exit(fail ? 1 : 0);
