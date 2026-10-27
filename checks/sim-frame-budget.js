/* ═══ 🔋 sim-frame-budget.js — 실행 화면 프레임 상한 · 해상도 배율 · 진단 줄 (frame-budget.js) ═══════════
   제보: RTX 3060 Ti · Windows — 앱을 켜 두면 크롬(트위터)이 많이 버벅인다.
   ・1절: pickFps 표 — 최대 60 · 손 안 대면 30(실행 화면 · 포커스 · 하는 중 아님) · 다른 창 20 · hot 이면 60
   ・2절: admit — 예정 시각을 쌓아 144 · 165 · 120 · 75 · 60Hz 에서 평균이 상한에 맞는다 · 멈춤 뒤 몰아 그리지 않는다
   ・3절: runPixelRatio — 플랫폼 상관없이 1.5 · 도트 렌더 1 · 화질(선명하게 · 자동 · 가볍게) · antialiasFor · qualityFrom
   ・3-2절: createSlowWatch(«자동» 화질의 느림 감시) — 느린 PC 를 흉내 내 15초 뒤 한 번 낮춘다 · 잘 도는 PC · 쉼(창 가림) · 잠깐 튐은 안 낮춘다 · 깨 보기
   ・4절: 포커스 비율 · 진단 줄(짧게)
   ・5절: 배선 — html 이 app.js 앞에 싣는다 · app.js 가 runPixelRatio · 1분 진단을 쓴다 · 렌더러 antialias · 자동 감시 · 모니터 탭 칸
   [실행] frame-budget.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['frame-budget.js', 'app.js', 'desk-companion-prototype.html', 'program-settings.js'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP_RAW = SRC['app.js'];
SRC['app.js'] = require('./sim-renderer-src.js').joinRenderer(SRC['app.js']);   // 옮긴 모듈(seat-camera.js 등)을 «옮기기 전 app.js 글» 로 되살려 읽는다(판정 무변경)
const win = {};
new Function('window', 'module', SRC['frame-budget.js'])(win, undefined);
const F = win.FrameBudget;

say('── 1. pickFps');
chk(F.FPS_ACTIVE === 60 && F.FPS_IDLE === 30 && F.FPS_UNFOCUSED === 20, '상한 셋: 60 · 30 · 20');
chk(F.FPS_LAUNCHER === 30, '런처 미리보기 상한 30(주사율만큼 그리지 않는다)');
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
chk(F.runPixelRatio(2, false, 'sharp', true) === 1.5 && F.runPixelRatio(2, false, undefined, true) === 1.5, '★ 선명하게(기본)는 «낮춤» 이 와도 1.5 — 예전 그대로');
chk(F.runPixelRatio(2, false, 'auto', false) === 1.5 && F.runPixelRatio(2, false, 'auto', true) === 1, '★ 자동 — 낮추기 전 1.5 · 낮춘 뒤 1');
chk(F.runPixelRatio(2, false, 'light', false) === 1 && F.runPixelRatio(1.25, false, 'light', false) === 1, '★ 가볍게 — 늘 1');
chk(F.runPixelRatio(2, true, 'sharp', false) === 1, '  도트 렌더는 화질과 상관없이 1');
chk(F.qualityFrom('auto') === 'auto' && F.qualityFrom('light') === 'light' && F.qualityFrom('sharp') === 'sharp'
  && F.qualityFrom(null) === 'sharp' && F.qualityFrom('') === 'sharp' && F.qualityFrom('LIGHT') === 'sharp' && F.qualityFrom('1') === 'sharp', '저장값 → 화질 · 없음 · 모르는 값은 선명하게');
chk(F.antialiasFor('light') === false && F.antialiasFor('auto') === true && F.antialiasFor('sharp') === true && F.antialiasFor(null) === true, '★ 테두리 다듬기는 «가볍게» 만 끈다');
chk(F.QUALITY_KEY === 'tw.renderQuality', '저장 키 tw. 접두사');

say('── 3-2. createSlowWatch — «자동» 화질의 느림 감시');
{
  /* 상한 cap 으로 그려야 하는데 실제로는 fps 로만 그리는 PC 를 sec 초 흉내 — 낮춘 시각(초) 또는 null */
  const simulate = (S, fps, cap, sec, gapAt) => {
    const W = S.createSlowWatch(); let at = null, n = 0;
    for(let t = 0; t <= sec * 1000; t += 1000 / fps){
      let tt = t; if(gapAt != null && t >= gapAt * 1000) tt = t + 2000;   // gapAt 초에 2초 쉼(창이 가려짐)
      n++; if(W.note(tt, cap) && at == null) at = tt / 1000;
    }
    return { at, lowered: W.lowered(), n };
  };
  const slow = simulate(F, 12, 60, 40);
  chk(slow.at != null && slow.at >= 15 && slow.at < 16.5 && slow.lowered, '★ 60 상한에 12fps — 느린 구간 3번(약 15초) 뒤 한 번 낮춘다(' + slow.at + '초)');
  chk(simulate(F, 60, 60, 120).at === null, '  잘 도는 PC(60/60)는 안 낮춘다');
  chk(simulate(F, 20, 20, 120).at === null, '  다른 창 보는 중(상한 20 · 20fps)도 안 낮춘다 — 상한만큼 그리면 정상');
  chk(simulate(F, 40, 60, 120).at === null, '  경계 위 — 60 상한에 40fps(67%)는 안 낮춘다');
  chk(simulate(F, 30, 60, 120).at != null, '  경계 아래 — 60 상한에 30fps(50%)는 낮춘다');
  {
    const W = F.createSlowWatch(); let t = 0, hits = 0;
    for(; t < 12000; t += 100) if(W.note(t, 60)) hits++;     // 10fps 10초(느린 구간 두 번)
    t += 1500;                                               // 1.5초 쉼 — 창이 가려졌다 돌아옴
    for(const e = t + 12000; t < e; t += 100) if(W.note(t, 60)) hits++;
    chk(hits === 0 && !W.lowered(), '★ 1초 넘게 쉬면 새로 센다 — 쉼을 느림으로 치지 않는다(가려진 창 · 멈춘 rAF)');
    for(const e = t + 6000; t < e; t += 100) if(W.note(t, 60)) hits++;
    chk(hits === 1 && W.lowered(), '  쉼 뒤로 느린 구간이 다시 세 번 이어지면 낮춘다');
    for(const e = t + 30000; t < e; t += 100) if(W.note(t, 60)) hits++;
    chk(hits === 1, '  한 번 낮추면 다시 true 를 내지 않는다(이번 실행 내내 1)');
  }
  {
    const W = F.createSlowWatch(); let t = 0, hits = 0;
    for(let k = 0; k < 6; k++){
      for(const e = t + 5000; t < e; t += 100) if(W.note(t, 60)) hits++;          // 느린 5초
      for(const e = t + 5000; t < e; t += 1000 / 60) if(W.note(t, 60)) hits++;   // 잘 도는 5초
    }
    chk(hits === 0, '★ 잠깐 튀는 건 넘긴다 — 느림이 «이어질» 때만(느림 · 정상 번갈아 1분)');
  }
  chk(simulate(F, 12, 0, 60).at === null, '  상한 0(예산 없음)이면 세지 않는다');
  /* 깨 보기 — 규칙을 망가뜨리면 위 판정 중 하나가 빨강이 되는지 */
  const mut = (from, to) => { const src = SRC['frame-budget.js']; if(!src.includes(from)) return null; const w = {}; new Function('window', 'module', src.replace(from, to))(w, undefined); return w.FrameBudget; };
  const red = (S) => {
    if(!S) return false;
    const a = simulate(S, 12, 60, 40).at, b = simulate(S, 60, 60, 120).at, c = simulate(S, 40, 60, 120).at;
    const W = S.createSlowWatch(); let t = 0, h = 0;
    for(; t < 12000; t += 100) if(W.note(t, 60)) h++;
    t += 1500; for(const e = t + 12000; t < e; t += 100) if(W.note(t, 60)) h++;
    const A = S.createSlowWatch(); let ta = 0, ha = 0;
    for(let k = 0; k < 6; k++){
      for(const e = ta + 5000; ta < e; ta += 100) if(A.note(ta, 60)) ha++;
      for(const e = ta + 5000; ta < e; ta += 1000 / 60) if(A.note(ta, 60)) ha++;
    }
    return !(a != null && a >= 15 && a < 16.5) || b !== null || c !== null || h !== 0 || ha !== 0;
  };
  chk(red(mut('if(streak < SLOW_WINDOWS) return false;', 'if(streak < 1) return false;')), '깨 보기: 한 구간만 느려도 낮추면 빨강');
  chk(red(mut('const SLOW_SHARE = 0.6;', 'const SLOW_SHARE = 0.9;')), '깨 보기: 기준을 90% 로 올리면(40fps 도 낮춤) 빨강');
  chk(red(mut('if(last == null || t - last > SLOW_GAP_MS || !(cap > 0)){', 'if(last == null || !(cap > 0)){')), '깨 보기: 쉼을 느림으로 치면 빨강');
  chk(red(mut("streak = (frames < expected * SLOW_SHARE) ? streak + 1 : 0;", "streak = (frames < expected * SLOW_SHARE) ? streak + 1 : streak;")), '깨 보기: 정상 구간에서 이어짐을 안 끊으면 빨강');
}

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
  const lineQ = F.diagLine({ ms: 60000, frames: 600, focusedShare: 0, cap: 20, pr: 1, w: 1920, h: 1080, q: 'auto', lowered: true });
  chk(/ · 화질 auto\(낮춤\)$/.test(lineQ) && lineQ.length <= 80, '진단 줄에 화질 · 낮춤(' + lineQ.length + '자)');
  const line = F.diagLine(Object.assign(m, { cap: 30, pr: 1.5, w: 2880, h: 1620 }));
  say('    ' + line);
  chk(/^\[프레임\] 60초 1800장 30fps · 포커스 50% · 상한 30 · 배율 1\.5 · 2880x1620$/.test(line), '진단 줄 모양');
  chk(line.length <= 80, '짧다(' + line.length + '자 — 진단 파일은 256KB 에서 돌려 쓴다)');
}

say('── 5. 배선');
{
  const H = SRC['desk-companion-prototype.html'];
  const a = H.indexOf('<script src="parts/shared/frame-budget.js"></script>'), b = H.indexOf('<script src="parts/app.js"></script>');
  chk(a > 0 && b > a, 'html 이 frame-budget.js 를 app.js 앞에 싣는다');
  const code = SRC['app.js'].replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  chk(/FrameBudget\.runPixelRatio\(devicePixelRatio, dotRenderEnabled, renderQuality, runLowered\)/.test(code), '실행 화면 배율을 runPixelRatio 로(한 곳 · 화질 · 낮춤을 같이)');
  const raw = APP_RAW.replace(/\/\*[\s\S]*?\*\//g, ' ');
  chk(/let _renderQuality = FrameBudget\.qualityFrom\(localStorage\.getItem\(FrameBudget\.QUALITY_KEY\)\);/.test(raw)
    && /const _renderAA = FrameBudget\.antialiasFor\(_renderQuality\);/.test(raw) && /new THREE\.WebGLRenderer\(\{canvas,antialias:_renderAA,/.test(raw), '★ 렌더러 antialias 는 저장된 화질에서(도트 렌더 값을 안 본다)');
  chk(!/antialias:\s*!?\s*[^,]*dot/i.test(raw), '  antialias 를 도트 렌더 값으로 정하지 않는다(옛 «안 보이는 끔» 버그)');
  chk(/if\(_renderQuality === FrameBudget\.QUALITY\.AUTO && document\.body\.classList\.contains\('runmode'\) && _runSlowWatch\.note\(now, _frameCap\(now\)\)\) _lowerRunQuality\(\);/.test(raw), '★ 자동일 때 · 실행 화면에서만 그린 장마다 감시');
  const lower = (raw.match(/function _lowerRunQuality\(\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(/_runLowered = true;/.test(lower) && /seatCameraMod\.updateCameraOnly\(\);/.test(lower) && /diagNote/.test(lower), '  낮추면 배율을 바로 다시 맞추고 진단 로그에 한 줄');
  const fr = raw.slice(raw.indexOf('function frame(now, manual){'));
  chk(fr.indexOf('_runSlowWatch.note') > fr.indexOf('if(_frameCapped(now)){'), '  감시는 상한을 통과해 실제로 그린 장에서만');
  const PS = SRC['program-settings.js'];
  chk(/_lsSet\(FrameBudget\.QUALITY_KEY, q\);/.test(PS) && /applyRunPixelRatio\(\);/.test(PS) && /FrameBudget\.qualityFrom\(b\.dataset\.q\)/.test(PS), '모니터 탭 — 고르면 저장(_lsSet · 실패 알림) · 배율 바로 다시 맞춤 · 모르는 값은 선명하게');
  const qRow = (H.match(/<div class="fs-monitors" id="progQualityRow">([\s\S]*?)<\/div>/) || [, ''])[1];
  const qs = [...qRow.matchAll(/data-q="(\w+)"/g)].map(m => m[1]);
  chk(qs.join(',') === 'sharp,auto,light' && qs.every(q => F.qualityFrom(q) === q), 'html — 모니터 탭에 선명하게 · 자동 · 가볍게(규칙이 아는 값만)');
  chk(H.indexOf('id="progQualityRow"') > H.indexOf('id="fsTabDisplay"') && H.indexOf('id="progQualityRow"') < H.indexOf('id="fsTabSize"'), '  칸은 설정 › 디스플레이 탭 안');
  chk(/return !_frameBudget\.admit\(now, _frameCap\(now\)\);/.test(code), '_frameCapped 가 admit 으로 판정');
  chk(/companion\.diagNote\(_FB\.diagLine\(m\)\);[\s\S]{0,40}\}, 60000\);/.test(code) && /if\(!document\.body\.classList\.contains\('runmode'\)\) return;/.test(code), '1분마다 · 실행 화면에서만 진단 줄');
  chk(!/requestAnimationFrame\([^)]*diag/i.test(code), '진단은 rAF 가 아니라 1분 타이머');
  chk(/if\(!_officeHidden && !\(document\.body\.classList\.contains\('desktop'\) && document\.body\.classList\.contains\('config'\)\)\) renderer\.render\(scene,camera\);/.test(code)
    && (code.match(/renderer\.render\(scene,camera\)/g) || []).length === 1, '회사원 모드로 화면을 숨긴 동안은 3D 를 안 그린다(그리기 자리는 한 곳)');
}

say('');
say(fail ? '✗ 실패 ' + fail + '건' : '✓ 전부 통과 (' + pass + ')');
process.exit(fail ? 1 : 0);
