/* sim-xmas-tree.js — 🎄 크리스마스 3D 트리(parts/xmas/xmas-tree.js · 일회성) — WebGL 없이 볼 수 있는 것
   실행: node checks/run.js sim-xmas-tree
   ・1절 기본 장식 그림 — 종류가 서버 · 규칙과 같다 · 다섯 가지 모두 16칸에 점을 찍는다 · 모르는 종류는 null
   ・2절 수명 — 닫을 때 rAF 를 멈추고 텍스처 · 지오메트리 · 렌더러 · 렌더 타깃을 버린다(창마다 WebGL 컨텍스트)
   ・3절 그리기 약속 — 장식은 화면 크기 고정 · 내 장식은 늘 앞 · 반짝임은 규칙(blinkOpacity) · 자리는 규칙(slotPositions)
   실제 그림은 브라우저에서 앱 three r128 로 그려 확인했다(PR 본문). */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (c) => c.find(p => fs.existsSync(p));
const TP = find(['xmas-tree.js', 'parts/xmas/xmas-tree.js', 'app/parts/xmas/xmas-tree.js', 'apps/desktop/app/parts/xmas/xmas-tree.js']);
const RP = find(['xmas-rules.js', 'parts/xmas/xmas-rules.js', 'app/parts/xmas/xmas-rules.js', 'apps/desktop/app/parts/xmas/xmas-rules.js']);
if (!TP || !RP) { say('  ? 원본 못 찾음 — xmas-tree.js · xmas-rules.js'); process.exit(2); }
const X = require(path.resolve(TP));
const R = require(path.resolve(RP));
const SRC = fs.readFileSync(TP, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

say('── 1절 기본 장식 그림');
chk(X.BASE_KINDS.slice().sort().join() === R.KINDS.slice().sort().join(), '기본 장식 종류가 규칙(=서버)과 같다 — ' + X.BASE_KINDS.join(' · '));
function fakeDoc(){
  return { createElement: () => { const px = []; const c = { width: 0, height: 0, px, getContext: () => ({ set fillStyle(v){ c._f = v; }, fillRect: (x, y, w, h) => px.push([x, y, c._f]) }) }; return c; } };
}
for (const k of R.KINDS){
  const c = X.baseCanvas(k, fakeDoc());
  chk(c && c.width === 16 && c.height === 16 && c.px.length > 10 && c.px.every(([x, y]) => x >= 0 && x < 16 && y >= 0 && y < 16), k + ' — 16칸 안에 점 ' + (c ? c.px.length : 0) + '개');
}
chk(X.baseCanvas('tree', fakeDoc()) === null, '모르는 종류는 null(창이 전구로 대신 그린다)');

say('── 2절 수명');
const close = (SRC.match(/function close\(\)\{[\s\S]*?\n  \}/) || [''])[0];
chk(/cancelAnimationFrame\(S\.raf\)/.test(close) && /S\.ro\.disconnect\(\)/.test(close) && /S\.off\.forEach/.test(close), '닫으면 rAF · 크기 감시 · 입력 연결을 끊는다');
chk(/clearOrnaments\(\)/.test(close) && /geometry\.dispose\(\)/.test(close) && /S\.renderer\.dispose\(\)/.test(close) && /S\.rt\.dispose\(\)/.test(close) && /S\.post\.dispose\(\)/.test(close), '  ↳ 텍스처 · 지오메트리 · 렌더러 · 렌더 타깃을 버린다');
chk(/S = null;/.test(close) && /if \(!S\) return;/.test(SRC.match(/function frame\(t\)\{[\s\S]*?\n  \}/)[0]), '  ↳ 닫힌 뒤 늦은 프레임은 아무것도 안 한다');
chk(/function open\(canvas\)\{\s*if \(S\) return;/.test(SRC), '이미 열려 있으면 다시 만들지 않는다(렌더러 두 개 금지)');

say('── 3절 그리기 약속');
chk(/sizeAttenuation: false/.test(SRC), '장식은 화면에서 늘 같은 크기(sizeAttenuation:false)');
chk(/depthTest: !o\.mine, depthWrite: !o\.mine/.test(SRC) && /s\.renderOrder = o\.mine \? 999 : 0/.test(SRC), '내 장식은 깊이를 안 보고 맨 나중에 — 늘 앞');
chk(/rules\.blinkOpacity\(t - s\.userData\.blinkAt\)/.test(SRC) && /rules\.slotPositions\(rules\.TREE_MAX\)/.test(SRC), '반짝임 · 자리는 규칙 모듈 한 벌(sim-xmas-rules 가 지킨다)');
chk(/rules\.createShake\(\)/.test(SRC) && /rules\.createTaps\(\)/.test(SRC), '흔들기 · 10번 누르기도 규칙 모듈');
chk(!/localStorage|firebaseAPI|fetch\(/.test(SRC), '저장 · 서버를 모른다(떨어진 장식은 이 화면에서만)');
chk(/ps1Dither\.BAYER4/.test(SRC), 'PS1 디더 표는 shared/ps1-dither.js 한 벌');

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
