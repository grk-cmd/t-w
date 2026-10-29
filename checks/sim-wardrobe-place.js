/* 📐 sim-wardrobe-place.js — 꾸미기 창 · 미리보기 창 자리(wardrobe-place.js) — node checks/run.js wardrobe-place
   ・1절: 기억 없음 → 두 창을 묶어 가운데 · 미리보기는 꾸미기 창 왼쪽에 붙음 · 같은 높이
   ・2절: 기억한 자리 · 화면 밖이면 안으로 · 좁은 화면 · 이상한 저장값
   ・3절: 깨 보기 — 가운데 계산 · 붙이기 · 화면 안 당기기를 하나씩 깨면 빨강 */

const fs = require('fs');
const path = require('path');

const SRC_PATH = path.join(__dirname, 'wardrobe-place.js');
if(!fs.existsSync(SRC_PATH)){ console.log('✗ wardrobe-place.js 를 못 찾음 — node checks/run.js wardrobe-place 로 돌릴 것'); process.exit(2); }
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if(!ok) fail++; };
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };

const P = { w: 360, h: 520 }, V = { w: 320, h: 420 };
const base = () => ({ vw: 1920, vh: 1080, panel: P, preview: V, saved: null });

/* 경우마다 [이름, 입력, 판정] — 깨 보기에서 같은 표를 다시 돈다 */
const CASES = [
  ['기억 없음 → 묶음 가운데(왼쪽 여백 = 오른쪽 여백)', base(), (r) => { const L = r.preview.x, R = 1920 - (r.panel.x + P.w); return Math.abs(L - R) <= 1; }],
  ['  세로도 가운데(큰 창 기준)', base(), (r) => r.panel.y === Math.round((1080 - 520) / 2)],
  ['  미리보기는 꾸미기 창 왼쪽에 8px 띄워 붙고 같은 높이', base(), (r) => r.preview.x === r.panel.x - 8 - V.w && r.preview.y === r.panel.y],
  ['기억한 자리 그대로', { ...base(), saved: { x: 900, y: 100 } }, (r) => r.panel.x === 900 && r.panel.y === 100 && r.preview.x === 900 - 8 - 320],
  ['기억이 오른쪽 화면 밖 → 안으로', { ...base(), saved: { x: 5000, y: 100 } }, (r) => r.panel.x === 1920 - 360 - 8],
  ['기억이 왼쪽으로 너무 감 → 미리보기까지 화면 안', { ...base(), saved: { x: 0, y: 100 } }, (r) => r.preview.x === 8 && r.panel.x === 8 + 320 + 8],
  ['기억이 아래 화면 밖 → 안으로', { ...base(), saved: { x: 900, y: 5000 } }, (r) => r.panel.y === 1080 - 520 - 8],
  ['기억이 위 화면 밖 → 안으로', { ...base(), saved: { x: 900, y: -300 } }, (r) => r.panel.y === 8],
  ['좁은 화면(500px) → 꾸미기 창이 화면 안 · 미리보기도 화면 안(겹침)', { vw: 500, vh: 700, panel: P, preview: V, saved: null }, (r) => r.panel.x >= 8 && r.panel.x + 360 <= 500 - 8 && r.preview.x === 8],
  ['이상한 저장값(NaN) → 가운데로', { ...base(), saved: { x: NaN, y: 1 } }, (r) => { const L = r.preview.x, R = 1920 - (r.panel.x + P.w); return Math.abs(L - R) <= 1; }],
];
const runAll = (api) => CASES.map(([name, inp, ok]) => { let r = null; try{ r = api.placeGroup(inp); }catch(_){} return [name, !!r && ok(r), r]; });

console.log('=== 1 · 2. 자리 ===');
const api = load(SRC);
runAll(api).forEach(([name, ok, r]) => chk(ok, name + (ok ? '' : ' (받은 값: ' + JSON.stringify(r) + ')')));
chk(api.isPos({ x: 1, y: 2 }) && !api.isPos(null) && !api.isPos({ x: 1 }) && !api.isPos({ x: Infinity, y: 0 }), 'isPos — 유한한 x · y 둘 다 있을 때만');

console.log('\n=== 3. 깨 보기 ===');
const BREAKS = [
  ['가운데 계산을 왼쪽 끝으로', 'else { x = (o.vw - total) / 2 + vw + GAP;', 'else { x = 0;'],
  ['미리보기를 안 붙이고 0 에', 'const px = Math.max(MARGIN, x - GAP - vw);', 'const px = 0;'],
  ['화면 안으로 안 당김', 'x = clamp(x, minX, Math.max(minX, o.vw - pw - MARGIN));', ''],
];
BREAKS.forEach(([name, from, to]) => {
  const broken = SRC.replace(from, to);
  if(broken === SRC){ chk(false, '  ' + name + ' — 바꿀 줄을 못 찾음(코드가 바뀌었다)'); return; }
  const allOk = runAll(load(broken)).every(([, ok]) => ok);
  chk(!allOk, '  ' + name + ' → 빨강');
});

if(fail){ console.log('✗ 실패 ' + fail + '건'); process.exit(1); }
console.log('전부 통과 ✅');
