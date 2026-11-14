/* sim-run-rect.js — 🖥️ 실행 창 자리(run-rect.js) · 🧪 --tw-run-band 시험 스위치
   실행:  node checks/run.js sim-run-rect
   ★ 왜 이 검사가 있는가 — 실행 진입 · 모니터 바꾸기 · 표시 설정 바뀜 세 길이 같은 사각형을 써야 한다.
     시험 스위치는 «CPU 가 창 넓이에 따라 주는가» 를 재는 것이라, 스위치가 없을 때는 예전과 한 픽셀도 달라지면 안 된다.
   ・1절: parseBand — 없음 · 이상한 값 · 경계(0 · 1 · 하한) / runRect — 스위치 없음은 옛 식 그대로 · 띠는 아래 끝 고정
   ・2절: 연결 — main.js 세 자리가 _runRectOf 를 부르고, 그 밖에서 runOverlayHeight 로 사각형을 다시 만들지 않는다
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (...c) => c.find(f => fs.existsSync(f));
const MODF = find('run-rect.js', 'app/parts/launcher/run-rect.js'), MAINF = find('main.js');
if (!MODF || !MAINF) { say('  ? 원본 못 찾음 — run-rect.js · main.js'); process.exit(2); }
const MOD = fs.readFileSync(MODF, 'utf8'), MAIN = fs.readFileSync(MAINF, 'utf8');
const load = (src) => { const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports); return m.exports; };

function judge(src){
  const r = {};
  try {
    const R = load(src);
    const P = (a) => R.parseBand(['electron', '.', ...a]);
    r.parse = P([]) === 1 && P(['--tw-run-band=0.4']) === 0.4 && P(['--tw-run-band=abc']) === 1 && P(['--tw-run-band=']) === 1
      && P(['--tw-run-band=0']) === 1 && P(['--tw-run-band=-1']) === 1 && P(['--tw-run-band=1']) === 1 && P(['--tw-run-band=2']) === 1
      && P(['--tw-run-band=0.1']) === R.BAND_MIN && P(['--tw-run-band=0.25']) === 0.25 && P(['--other=0.4']) === 1
      && R.parseBand(undefined) === 1 && R.parseBand([null, 5]) === 1;
    const WA = { x: 2560, y: 71, width: 1920, height: 1040 };
    const full = R.runRect(WA, 1028, 1);
    r.same = JSON.stringify(full) === JSON.stringify({ x: 2560, y: 71, width: 1920, height: 1028 });   // 옛 식: { x, y, width, height: runOverlayHeight }
    const b = R.runRect(WA, 1028, 0.4);
    r.band = b.x === 2560 && b.width === 1920 && b.height === 411 && b.y + b.height === 71 + 1028;    // 아래 끝은 그대로 · 위만 내려온다
    const t = R.runRect({ x: 0, y: 0, width: 800 }, 100, R.BAND_MIN);
    r.tiny = t.height === 25 && t.y === 75 && Number.isInteger(t.y) && Number.isInteger(t.height);
    r.switchName = R.BAND_SWITCH === 'tw-run-band';
  } catch (e) { r.err = e && e.message; }
  return r;
}

say('── 1. 규칙(실제로 돌린다)');
const R = judge(MOD);
if (R.err) chk(false, '돌리다 멈춤 — ' + R.err);
chk(R.parse, 'parseBand — 없음 · 숫자 아님 · 0 이하 · 1 이상은 1(전체) · 하한 아래는 BAND_MIN · 다른 스위치는 무시');
chk(R.same, 'runRect — 스위치가 없으면 옛 식과 한 픽셀도 다르지 않다');
chk(R.band, '  0.4 띠 — 너비 · x 그대로 · 아래 끝 그대로 · 높이 40%');
chk(R.tiny, '  하한 띠도 정수 픽셀');
chk(R.switchName, '스위치 이름 tw-run-band');

say('── 2. 연결(main.js)');
{
  const code = MAIN.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const RunRect = require\('\.\/app\/parts\/launcher\/run-rect'\);/.test(code) && /const _runBand = RunRect\.parseBand\(process\.argv\);/.test(code), 'run-rect 를 싣고 명령줄에서 띠를 한 번 읽는다');
  chk(/function _runRectOf\(d\)\{ return RunRect\.runRect\(d\.workArea, overlay\.runOverlayHeight\(d\.workArea\.height, d\), _runBand\); \}/.test(code), '_runRectOf — 작업영역 · 깎은 높이 · 띠');
  const calls = (code.match(/_runRectOf\(/g) || []).length - 1;
  chk(calls === 3, '  실행 진입 · 모니터 바꾸기 · 표시 설정 바뀜 세 자리가 부른다(' + calls + ')');
  chk((code.match(/runOverlayHeight\(/g) || []).length === 1, '  main.js 에서 runOverlayHeight 로 사각형을 다시 만드는 곳이 없다(_runRectOf 하나)');
  chk(/RunRect\.BAND_SWITCH\]/.test(code), '  [GPU] 줄의 시험 스위치 목록에 들어 있다(켰는지 로그로 보인다)');
}

say('── 3. 깨 보기');
{
  const broke = (from, to) => { const m = MOD.replace(from, to); return m === MOD ? null : judge(m); };
  const b1 = broke('const full = Math.round(overlayHeight);', 'const full = Math.round(overlayHeight) - 1;');
  chk(b1 && !b1.same, '스위치가 없을 때 높이가 옛 식과 1px 라도 다르면 빨강');
  const b2 = broke("y: workArea.y + (full - h)", "y: workArea.y");
  chk(b2 && !b2.band, '띠를 위에 붙이면(아래 끝이 올라감) 빨강');
  const b3 = broke("if(!Number.isFinite(v) || v <= 0 || v >= 1) return 1;", "if(!Number.isFinite(v)) return 1;");
  chk(b3 && !b3.parse, '0 · 1 이상 값을 띠로 받으면 빨강');
  const b4 = broke('return Math.max(BAND_MIN, v);', 'return v;');
  chk(b4 && !b4.parse, '하한을 빼면 빨강');
}

say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
