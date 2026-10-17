/* sim-paint-geom.js — ✏️ 그리기 공용 기하(shared/paint-geom.js) 동작 · 연결
   실행:  node sim-paint-geom.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 생성기 얼굴 칠하기와 꾸미기 파츠 그리기가 같은 선 긋기 · 거울 UV 를 쓴다. 한쪽에만 두면 둘이 서로를 부르게 되어
     아래층(shared)으로 내렸다(C 구역 떼기 w4). 수식이 흔들리면 두 그리기의 대칭이 같이 어긋난다.
   ・1절: strokeSeg — 첫 점(lx 없음)은 0.01 짧은 선 · 이어지는 점은 앞 점과 잇기
   ・2절: mirrorUVOn — 중심 cx 로 x 반전 · 거울 법선 바깥 0.6(off 있으면 그만큼)에서 표면 쪽으로 되쏘기 · castFn 이 없으면 메쉬를 직접 맞히기 ·
          법선이 없으면 카메라 쪽 · 맞은 곳 · 메쉬가 없으면 null
   ・3절: app.js 연결 · 4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('shared/paint-geom.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — paint-geom.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const near = (a, b) => Math.abs(a - b) < 1e-9;

class V3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(v) { return this.set(v.x, v.y, v.z); }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; } addScaledVector(v, k) { this.x += v.x * k; this.y += v.y * k; this.z += v.z * k; return this; }
  negate() { return this.set(-this.x, -this.y, -this.z); } normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; return this.set(this.x / l, this.y / l, this.z / l); }
  transformDirection(m) { return m && m.flipZ ? this.set(this.x, this.y, -this.z) : this; } }
class RC { constructor() { this.ray = { origin: new V3(), direction: new V3() }; } set(o, d) { this.ray.origin.copy(o); this.ray.direction.copy(d); }
  intersectObject(mesh, rec) { mesh._cast = { o: Object.assign({}, this.ray.origin), d: Object.assign({}, this.ray.direction), rec }; return mesh._hits || []; } }
const THREE = { Vector3: V3, Raycaster: RC };
const make = (src) => new Function('window', 'THREE', 'module', src + '\nreturn window.TwPaintGeom;')({}, THREE, undefined).createPaintGeom({});

function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let G = null, err = null;
  try { G = make(src); } catch (e) { err = e; }
  t(!err && G && Object.keys(G).sort().join() === 'mirrorUVOn,strokeSeg', '만들 때 던지지 않고 strokeSeg · mirrorUVOn 을 내놓는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!G) return r;
  const segs = []; let cur = null;
  const ctx = { beginPath() { cur = { n: 0 }; }, moveTo(x, y) { cur.x0 = x; cur.y0 = y; }, lineTo(x, y) { cur.x1 = x; cur.y1 = y; }, stroke() { segs.push(cur); } };
  G.strokeSeg(ctx, null, 5, 10, 20);
  t(segs.length === 1 && segs[0].x0 === 10 && segs[0].y0 === 20 && near(segs[0].x1, 10.01) && near(segs[0].y1, 20.01), 'strokeSeg — 앞 점이 없으면(lx null) 그 자리에 0.01 짧은 선(점)');
  G.strokeSeg(ctx, 3, 4, 10, 20);
  t(segs.length === 2 && segs[1].x0 === 3 && segs[1].y0 === 4 && segs[1].x1 === 10 && segs[1].y1 === 20, 'strokeSeg — 앞 점이 있으면 앞 점에서 이번 점까지');
  G.strokeSeg(ctx, 0, 0, 10, 20);
  t(segs.length === 3 && segs[2].x0 === 0, 'strokeSeg — 앞 점 0 은 «없음» 이 아니다');

  const mesh = { worldToLocal: (v) => v, localToWorld: (v) => v, matrixWorld: {} };
  const cam = { position: new V3(0, 0, 5) };
  const hit = { point: new V3(0.3, 1, 0.2), face: { normal: new V3(1, 0, 0) } };
  let got = null;
  let res = G.mirrorUVOn(hit, mesh, cam, 0.1, (ray, m) => { got = { o: Object.assign({}, ray.origin), d: Object.assign({}, ray.direction), m }; return { uv: { x: 0.7, y: 0.4 } }; });
  t(res && res.x === 0.7 && res.y === 0.4 && got && got.m === mesh, 'castFn 으로 되쏘아 맞힌 UV 를 돌려준다(메쉬도 넘긴다)');
  t(near(got.o.x, -0.1 - 0.6) && near(got.o.y, 1) && near(got.o.z, 0.2) && near(got.d.x, 1) && near(got.d.y, 0), '거울 표면점 = 중심 cx(0.1)로 x 반전(-0.1) · 거울 법선(-x) 바깥 0.6 에서 표면 쪽(+x)으로 쏜다');
  G.mirrorUVOn(hit, mesh, cam, 0.1, (ray) => { got = Object.assign({}, ray.origin); return null; }, 0.2);
  t(near(got.x, -0.1 - 0.2), 'off(0.2)를 주면 그만큼만 물러난다(옷처럼 겹친 파츠)');
  G.mirrorUVOn(hit, mesh, cam, 0.1, (ray) => { got = Object.assign({}, ray.origin); return null; }, -1);
  t(near(got.x, -0.1 - 0.6), 'off 가 0 이하면 기본 0.6');
  G.mirrorUVOn(hit, mesh, cam, undefined, (ray) => { got = Object.assign({}, ray.origin); return null; });
  t(near(got.x, -0.3 - 0.6), 'cx 가 없으면 0 을 중심으로');
  res = G.mirrorUVOn({ point: new V3(0.3, 1, 0.2) }, mesh, cam, 0, (ray) => { got = { o: Object.assign({}, ray.origin), d: Object.assign({}, ray.direction) }; return { uv: { x: 1, y: 1 } }; });
  const dz = 5 - 0.2, l = Math.hypot(0.3, 1, dz);   // 거울점(-0.3,1,0.2) → 카메라(0,0,5) — 되쏘는 방향은 그 반대
  t(near(got.d.x, -0.3 / l) && near(got.d.y, 1 / l) && near(got.d.z, -dz / l), '법선이 없으면 카메라 쪽을 바깥으로 본다');
  mesh._hits = [{ uv: { x: 0.25, y: 0.5 } }];
  res = G.mirrorUVOn(hit, mesh, cam, 0.1);
  t(res && res.x === 0.25 && mesh._cast && mesh._cast.rec === false, 'castFn 이 없으면 그 메쉬만(자식 빼고) 직접 맞힌다');
  mesh._hits = [{}];
  t(G.mirrorUVOn(hit, mesh, cam, 0.1) === null && G.mirrorUVOn(hit, mesh, cam, 0.1, () => ({})) === null, '맞은 곳에 UV 가 없으면 null');
  t(G.mirrorUVOn(null, mesh, cam) === null && G.mirrorUVOn(hit, null, cam) === null, '맞은 곳 · 메쉬가 없으면 null');
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  t(!/function _seg\b|function strokeSeg\b|function mirrorUVOn\b/.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  t(/const paintGeomMod = TwPaintGeom\.createPaintGeom\(\{\n\}\);/.test(app), '만드는 줄(가드 없이) · deps 0');
  t(/  strokeSeg: \(\.\.\.a\)=>paintGeomMod\.strokeSeg\(\.\.\.a\),/.test(app) && /  mirrorUVOn: \(\.\.\.a\)=>paintGeomMod\.mirrorUVOn\(\.\.\.a\),/.test(app), '꾸미기 파츠 그리기(part-paint)에는 paintGeomMod 의 두 함수를 넘긴다');
  const iM = html.indexOf('<script src="parts/shared/paint-geom.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — shared/paint-geom.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const B = behave(MOD);
B.forEach(([ok, msg], i) => { const s = { 0: '── 1. strokeSeg', 4: '── 2. mirrorUVOn' }; if (s[i]) say(s[i]); chk(ok, msg); });
say('── 3. app.js 연결');
wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
chk(!SMOKE || /PRELOAD\.push\('paint-geom\.js'\);/.test(SMOKE), 'smoke 가 paint-geom.js 를 먼저 싣는다');
say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['점 길이 0.01 → 0.1', (m) => m.replace('_seg(ctx,x,y,x+0.01,y+0.01)', '_seg(ctx,x,y,x+0.1,y+0.1)'), null, null],
  ['앞 점 0 을 없음으로', (m) => m.replace('if(lx==null)', 'if(!lx)'), null, null],
  ['되쏘기 0.6 → 0.5', (m) => m.replace('(off>0?off:0.6)', '(off>0?off:0.5)'), null, null],
  ['x 반전 중심 없앰', (m) => m.replace('_mp.x = 2*(cx||0) - _mp.x;', '_mp.x = - _mp.x;'), null, null],
  ['법선 x 를 안 뒤집음', (m) => m.replace('_mn.set(-n.x,n.y,n.z)', '_mn.set(n.x,n.y,n.z)'), null, null],
  ['자식까지 맞힘', (m) => m.replace('_mray.intersectObject(mesh,false)', '_mray.intersectObject(mesh,true)'), null, null],
  ['만들 때 던짐', (m) => m.replace('function createPaintGeom(deps){', 'function createPaintGeom(deps){ throw new Error("깨 봄");'), null, null],
  ['app.js 에 본문이 남음', null, (a) => a + '\nfunction strokeSeg(){}', null],
  ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/shared/paint-geom.js"></script>', '')],
];
for (const [name, fm, fa, fh] of breaks) {
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== APP || h2 !== HTML;
  let rows; try { rows = (fm ? behave(m2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 그리기 공용 기하는 shared/paint-geom.js 에서'));
process.exit(fail ? 1 : 0);
