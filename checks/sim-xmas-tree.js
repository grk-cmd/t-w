/* sim-xmas-tree.js — 🎄 크리스마스 3D 트리(parts/xmas/xmas-tree.js · 일회성) — WebGL 없이 볼 수 있는 것
   실행: node checks/run.js sim-xmas-tree
   ・1절 기본 장식 그림 — 종류가 서버 · 규칙과 같다 · 다섯 가지 모두 16칸에 점을 찍는다 · 모르는 종류는 null
   ・2절 수명 — 닫을 때 rAF 를 멈추고 텍스처 · 지오메트리 · 렌더러 · 렌더 타깃을 버린다(창마다 WebGL 컨텍스트)
   ・3절 그리기 약속 — 장식은 화면 크기 고정 · 내 장식은 늘 앞 · 반짝임은 규칙(blinkOpacity) · 자리는 규칙(slotPositions) · 우클릭 신고는 남의 장식만
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
{ const off = X.dotsOffset, eq = (o, x, y) => o.x === x && o.y === y;
  chk(eq(off(['....##..', '....##..'], 8), -1, 3) && eq(off(['##', '##'], 4), 1, 1) && eq(off(['....'], 4), 0, 0), 'dotsOffset — 한쪽에 치우친 점 그림을 가운데로(남는 칸이 홀수면 왼쪽 · 위) · 빈 그림은 그대로');
  for (const k of R.KINDS){
    const c = X.baseCanvas(k, fakeDoc()); const xs = c.px.map(p => p[0]), ys = c.px.map(p => p[1]);
    const l = Math.min(...xs), r = 15 - Math.max(...xs), t = Math.min(...ys), b = 15 - Math.max(...ys);
    chk(Math.abs(l - r) <= 1 && Math.abs(t - b) <= 1, k + ' — 16칸 가운데(좌 ' + l + ' · 우 ' + r + ' · 위 ' + t + ' · 아래 ' + b + ')');
  } }

say('── 2절 수명');
const close = (SRC.match(/function close\(\)\{[\s\S]*?\n  \}/) || [''])[0];
chk(/cancelAnimationFrame\(S\.raf\)/.test(close) && /S\.ro\.disconnect\(\)/.test(close) && /S\.off\.forEach/.test(close), '닫으면 rAF · 크기 감시 · 입력 연결을 끊는다');
chk(/clearOrnaments\(\)/.test(close) && /geometry\.dispose\(\)/.test(close) && /S\.renderer\.dispose\(\)/.test(close) && /S\.rt\.dispose\(\)/.test(close) && /S\.post\.dispose\(\)/.test(close), '  ↳ 텍스처 · 지오메트리 · 렌더러 · 렌더 타깃을 버린다');
chk(/S = null;/.test(close) && /if \(!S\) return;/.test(SRC.match(/function frame\(t\)\{[\s\S]*?\n  \}/)[0]), '  ↳ 닫힌 뒤 늦은 프레임은 아무것도 안 한다');
chk(/function open\(canvas\)\{\s*if \(S\) return;/.test(SRC), '이미 열려 있으면 다시 만들지 않는다(렌더러 두 개 금지)');

{ // 장식 깊이 당김 — three(r128) 스프라이트 셰이더에 실제로 들어가야 한다(replace 는 못 찾으면 말없이 넘어간다)
  const VP = find(['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'apps/desktop/app/vendor/three/three.min.js']);
  if (!VP) { say('  ? three.min.js 못 찾음'); process.exit(2); }
  const THREE = require(path.resolve(VP));
  const sh = { vertexShader: THREE.ShaderLib.sprite.vertexShader };
  X.popOut(sh);
  const v = sh.vertexShader, at = v.indexOf('twPop'), gp = v.indexOf('gl_Position = projectionMatrix * mvPosition;');
  chk(at > 0 && gp > 0 && at > gp && /\bscale\b/.test(v.slice(0, gp)), '★ 장식 깊이 당김이 스프라이트 셰이더 gl_Position 뒤에 들어간다(three r' + THREE.REVISION + ')');
  chk(/mat\.onBeforeCompile = popOut;/.test(SRC), '  ↳ 장식 재질마다 같은 popOut(프로그램 하나)');
  const m = { vertexShader: THREE.ShaderLib.sprite.vertexShader.replace(/#include <logdepthbuf_vertex>/g, '') }; X.popOut(m);
  chk(!/twPop/.test(m.vertexShader), '  ↳ mutation — 끼울 자리가 없으면 안 들어간다(이 검사가 잡는다)');
}
{ // 트리 위 기본 장식 모양 — 자리 번호로 정한다(모든 사람 화면에서 같은 모양)
  const SL = [...Array(300).keys()];
  const same = SL.every(n => ['sock', 'bulb', 'cane', 'gift', 'star'].every(k => JSON.stringify(X.ornLook(k, n)) === JSON.stringify(X.ornLook(k, n))));
  chk(same, '같은 자리면 늘 같은 모양');
  const T = Math.PI / 6, rots = (k) => new Set(SL.map(n => Math.round(X.ornLook(k, n).rot / T)));
  chk(new Set(SL.map(n => X.ornLook('sock', n).flip)).size === 2 && [...rots('sock')].sort().join() === '-1,0,1', '★ 양말 — 좌우 뒤집기 둘 다 · −30 · 0 · +30도');
  chk([...rots('cane')].sort().join() === '-1,0,1' && SL.every(n => !X.ornLook('cane', n).flip), '★ 사탕 지팡이 — −30 · 0 · +30도(뒤집기 없음)');
  for (const k of ['bulb', 'gift']){
    const tints = new Set(SL.map(n => X.ornLook(k, n).tint));
    chk(tints.size === X.ORN_TINTS[k].length, '★ ' + k + ' — 색 ' + X.ORN_TINTS[k].length + '가지가 다 나온다 (' + tints.size + ')');
    const pics = X.ORN_TINTS[k].map((_, t) => X.baseCanvas(k, fakeDoc(), t).px.map(p => p.join(',')).join('|'));
    chk(new Set(pics).size === pics.length, '  ↳ ' + k + ' — 색마다 그림이 다르다(덮는 글자가 그림에 있다)');
  }
  chk(SL.every(n => { const l = X.ornLook('star', n); return !l.flip && l.rot === 0 && l.tint === 0; }), '별 — 그대로');
  const px = (k, t) => X.baseCanvas(k, fakeDoc(), t).px.map(p => p.join(',')).join('|');
  chk(px('sock', 0) === px('sock', 3) && px('star', 0) === px('star', 2), '색 번호 — 색표 없는 장식은 무시');
  chk(/map\.repeat\.x = -1; map\.offset\.x = 1;/.test(SRC) && /rotation: look\.rot/.test(SRC) && /baseCanvas\(o\.k, doc, look\.tint\)/.test(SRC), '트리 장식이 ornLook 을 쓴다(뒤집기 · 기울기 · 색)');
}
{ // 장식 크기 — 수가 많을 때만 작게
  const M = 300, sc = (n) => X.ornScale(n, M);
  chk(sc(0) === 1 && sc(1) === 1 && sc(60) === 1, '★ 60개까지는 그대로(1)');
  chk(Math.abs(sc(M) - 0.7) < 1e-9 && sc(M + 50) === sc(M), '★ 꽉 차면(300) 0.7 · 넘어도 더 줄지 않는다');
  let mono = true; for (let n = 1; n <= M; n++) if (sc(n) > sc(n - 1)) mono = false;
  chk(mono && sc(180) < 1 && sc(180) > 0.7, '  ↳ 늘수록 조금씩 작아진다(커지지 않음)');
  chk(X.ornScale(NaN, M) === 1 && X.ornScale(100, 60) === 0.7, '  ↳ 이상한 값 · 상한이 작을 때');
  chk(/const size = ORN_SIZE \* ornScale\(all\.length, rules\.TREE_MAX\);/.test(SRC) && /s\.scale\.setScalar\(size\);/.test(SRC), '트리가 걸린 수로 크기를 정해 모든 장식에 같은 크기');
}
{ // 뒤로 넘어간 남의 장식은 숨긴다 — 깊이 당김(popOut) 때문에 옆 · 뒤 장식이 잎 위로 비쳐 보였다
  const f = X.faceZ, near = (a, b) => Math.abs(a - b) < 1e-9;
  chk(near(f(0, 1, 0), 1) && near(f(0, -1, 0), -1) && near(f(1, 0, 0), 0), '★ 돌지 않은 트리 — 카메라 쪽(+z) 1 · 뒤 -1 · 옆 0');
  chk(near(f(1, 0, -Math.PI / 2), 1) && near(f(1, 0, Math.PI / 2), -1), '  ↳ 트리가 돌면 같은 장식도 앞 · 뒤가 바뀐다(three rotation.y 방향)');
  chk(f(0, 0, 1.3) === 1 && f(NaN, 1, 0) === 1, '  ↳ 축 위 · 이상한 값은 보이게(1)');
  chk(X.BACK_HIDE < 0 && X.BACK_HIDE > -0.5, '  ↳ 숨기는 경계는 옆보다 조금 뒤(' + X.BACK_HIDE + ')');
  /* 실제 자리 300칸 × 36방향 — 숨긴 것은 모두 트리 축 뒤편, 앞쪽 반(0.2 넘게)은 하나도 안 숨김 */
  const P = require(path.resolve(RP)).slotPositions(300);
  let wrong = 0, hidden = 0;
  for (let k = 0; k < 36; k++){ const yaw = k * Math.PI / 18;
    for (const p of P){ const z = f(p.x, p.z, yaw), hide = !(z > X.BACK_HIDE);
      if (hide) hidden++;
      const wz = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
      if ((hide && wz > 0) || (!hide && z < X.BACK_HIDE)) wrong++; } }
  chk(wrong === 0 && hidden > 300 * 36 * 0.35 && hidden < 300 * 36 * 0.6, '★ 실제 자리 · 36방향 — 뒤편만 숨김(숨김 ' + (hidden / 36).toFixed(0) + '/300 · 틀림 ' + wrong + ')');
  chk(/if \(s\.userData\.mine\)\{[^}]*continue; \}/.test(SRC) && /if \(s\.parent !== S\.tree\) continue;[^\n]*\n\s*s\.visible = faceZ\(s\.position\.x, s\.position\.z, S\.yaw\) > BACK_HIDE;/.test(SRC), '그리기 — 내 장식은 늘 보이고 · 떨어진 장식은 그대로 · 나머지는 faceZ 로');
  chk(/if \(!s\.visible && s === S\.sel\) hideSay\(\);/.test(SRC), '★ 한마디를 띄운 장식이 뒤로 넘어가면 라벨도 닫는다');
  { const d = SRC.slice(SRC.indexOf('function dropOne'), SRC.indexOf('S.scene.attach(o)'));
    chk(/o\.visible = true;/.test(d), '★ 뒤편이라 숨겨 둔 장식도 떨어지면 보인다(장면에 붙이기 전에 되살림)'); }
  chk(/S\.tree\.children\.filter\(o => o\.isSprite && o\.visible\)/.test(SRC), '누르기 — 숨긴 장식은 누르지 않는다');
}
say('── 3절 그리기 약속');
chk(/sizeAttenuation: false/.test(SRC), '장식은 화면에서 늘 같은 크기(sizeAttenuation:false)');
chk(/depthTest: !o\.mine, depthWrite: !o\.mine/.test(SRC) && /s\.renderOrder = o\.mine \? 999 : 0/.test(SRC), '내 장식은 깊이를 안 보고 맨 나중에 — 늘 앞');
chk(/rules\.blinkOpacity\(t - s\.userData\.blinkAt\)/.test(SRC) && /rules\.slotPositions\(rules\.TREE_MAX\)/.test(SRC), '반짝임 · 자리는 규칙 모듈 한 벌(sim-xmas-rules 가 지킨다)');
chk(/rules\.createShake\(\)/.test(SRC) && /rules\.createTaps\(\)/.test(SRC), '흔들기 · 10번 누르기도 규칙 모듈');
chk(!/localStorage|firebaseAPI|fetch\(/.test(SRC), '저장 · 서버를 모른다(떨어진 장식은 이 화면에서만)');
chk(/ps1Dither\.BAYER4/.test(SRC), 'PS1 디더 표는 shared/ps1-dither.js 한 벌');
chk(/if \(e && e\.button !== 0\)\{ downAt = null; return; \}/.test(SRC), '우클릭은 한마디 라벨을 띄우지 않는다(신고 창만)');
chk(/hitAt\(e\.clientX, e\.clientY, true\)\.orn/.test(SRC) && /othersOnly \? hits\.find\(x => !x\.object\.userData\.mine\)/.test(SRC), '신고는 남의 장식만 — 내 장식이 앞에 겹쳐도 뒤의 것을 고른다');
chk(!/MeshLambertMaterial\(\{[^}]*flatShading/.test(SRC), 'Lambert 에 없는 flatShading 을 넘기지 않는다(콘솔 경고)');

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
