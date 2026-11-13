/* ═══ 🗺️ sim-hit-map.js — 클릭 통과 히트 맵의 순수 계산(launcher/hit-map.js) ═══════════════
   지도가 «사각형 밖 ⇒ 광선이 경계 구에 못 닿음» 을 지키는지 진짜 three(PerspectiveCamera · Raycaster)로 돌려 본다.
   ・1절: sphereRect — 구 위의 점 수천 개를 투영해 모두 사각형 안 · 사각형 밖 화면 점의 광선은 구에 안 닿음 ·
          화면 밀기(setViewOffset) · 캔버스 자리 · 카메라 뒤 → 없음 · 카메라가 구 안 → 전체 · 반지름 0 · NaN · 직교 → 전체 · 사각형이 너무 크지 않음
   ・2절: 지도 — candidates(경계 위 점 · 여유 0 · 음수 여유 · 좌석 30) · pointIn · fresh(249/250/251 · 없음 · 못 만듦) · skipWhy
   ・3절: 일부러 깨 보기 — 가운데 투영 ± 반지름 · 음수 여유 그대로 · 카메라 뒤 거르기 빠짐 · 신선도 경계 · 카메라 안 판정 빠짐
   [실행] 러너 스테이징(node checks/run.js hit-map) 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('launcher/hit-map.js');
if(!MOD){ say('  ? 원본 못 찾음 — hit-map.js'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(path.resolve(threePath));

function load(src){ const win = {}; new Function('window', 'module', src)(win, undefined); return win.TwHitMap; }

/* 정해진 씨앗의 난수 — 매번 같은 구 · 같은 점 */
function rng(seed){ let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const VP = { left: 13, top: 27, width: 800, height: 600 };
function cam(opt){
  const c = new THREE.PerspectiveCamera(34, VP.width / VP.height, 0.1, 100);
  c.position.set(opt.px || 0, opt.py || 0.6, opt.pz == null ? 5 : opt.pz);
  c.lookAt(opt.lx || 0, opt.ly || 0.4, 0);
  if(opt.offset) c.setViewOffset(1000, 700, 120, 60, 800, 600);
  c.updateProjectionMatrix(); c.updateMatrixWorld();
  return c;
}
/* 월드 점 → 판정과 같은 CSS px(ndc 를 캔버스 사각형으로) — 카메라 앞인 점만 */
function toPx(c, p){
  const v = p.clone().applyMatrix4(c.matrixWorldInverse);
  if(v.z >= 0) return null;
  const n = p.clone().project(c);
  return { x: VP.left + (n.x + 1) / 2 * VP.width, y: VP.top + (1 - n.y) / 2 * VP.height };
}
function rayAt(c, x, y){
  const r = new THREE.Raycaster();
  r.setFromCamera(new THREE.Vector2(((x - VP.left) / VP.width) * 2 - 1, -((y - VP.top) / VP.height) * 2 + 1), c);
  return r;
}

/* 1절 판정 — 구 여럿 × 카메라 여럿. 반환: { cover, rayOut, tight, total, rects } */
function judgeRects(H){
  const out = { coverBad: 0, rayBad: 0, tightBad: 0, points: 0, outs: 0, rects: 0, worst: '' };
  const R = rng(7);
  for(const opt of [{}, { offset: true }, { px: 1.4, py: 2, pz: 3.2, lx: -0.5 }, { pz: 2.2, offset: true }]){
    const c = cam(opt);
    const V = c.matrixWorldInverse.elements, P = c.projectionMatrix.elements;
    for(let k = 0; k < 40; k++){
      const ctr = new THREE.Vector3((R() - 0.5) * 6, (R() - 0.5) * 3, (R() - 0.5) * 4 - 1);
      const rad = 0.05 + R() * 1.2;
      const rc = {};
      const code = H.sphereRect(ctr.x, ctr.y, ctr.z, rad, V, P, VP, rc);
      if(code !== H.RECT) continue;
      out.rects++;
      let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity, front = true;
      for(let i = 0; i < 1500; i++){
        const u = R() * 2 - 1, th = R() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        const p = new THREE.Vector3(ctr.x + rad * s * Math.cos(th), ctr.y + rad * s * Math.sin(th), ctr.z + rad * u);
        const q = toPx(c, p);
        if(!q){ front = false; continue; }
        out.points++;
        if(q.x < rc.l - 1e-6 || q.x > rc.r + 1e-6 || q.y < rc.t - 1e-6 || q.y > rc.b + 1e-6){ out.coverBad++; if(!out.worst) out.worst = JSON.stringify({ q, rc }); }
        mnx = Math.min(mnx, q.x); mxx = Math.max(mxx, q.x); mny = Math.min(mny, q.y); mxy = Math.max(mxy, q.y);
      }
      /* 카메라 앞에 다 있는 구는 사각형이 표본 범위보다 크게 벗어나지 않는다(축마다 접선이 정확한 끝) */
      if(front && isFinite(rc.l) && isFinite(rc.r)){
        const slack = Math.max(mnx - rc.l, rc.r - mxx, mny - rc.t, rc.b - mxy);
        if(slack > Math.max(3, 0.03 * (rc.r - rc.l))) out.tightBad++;
      }
      /* 사각형 밖 1px 의 화면 점 — 광선이 구에 안 닿아야 한다 */
      const sph = new THREE.Sphere(ctr, rad);
      const xs = [rc.l - 1, (rc.l + rc.r) / 2, rc.r + 1], ys = [rc.t - 1, (rc.t + rc.b) / 2, rc.b + 1];
      for(const x of xs) for(const y of ys){
        if(x >= rc.l && x <= rc.r && y >= rc.t && y <= rc.b) continue;
        if(!isFinite(x) || !isFinite(y)) continue;
        out.outs++;
        if(rayAt(c, x, y).ray.intersectsSphere(sph)) out.rayBad++;
      }
    }
  }
  return out;
}

function judgeAll(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let H = null;
  try{ H = load(src); }catch(_){}
  t(H && typeof H.sphereRect === 'function', '불러온다 — window.TwHitMap');
  if(!H) return r;
  /* 1절 */
  let j = null; try{ j = judgeRects(H); }catch(e){ j = null; }
  t(j && j.rects >= 100 && j.coverBad === 0, '구 위의 점(' + (j ? j.points : 0) + '개 · 구 ' + (j ? j.rects : 0) + '개 · 화면 밀기 포함)은 모두 사각형 안' + (j && j.coverBad ? ' — 밖 ' + j.coverBad + ' ' + j.worst.slice(0, 120) : ''));
  t(j && j.outs > 200 && j.rayBad === 0, '사각형 밖 화면 점(' + (j ? j.outs : 0) + '개)의 광선은 구에 안 닿는다' + (j && j.rayBad ? ' — 닿음 ' + j.rayBad : ''));
  t(j && j.tightBad === 0, '사각형이 투영보다 크게 넓지 않다(축마다 접선 끝)' + (j && j.tightBad ? ' — ' + j.tightBad + '개' : ''));
  const c = cam({}), V = c.matrixWorldInverse.elements, P = c.projectionMatrix.elements, rc = {};
  t(H.sphereRect(0, 0.6, 9, 0.5, V, P, VP, rc) === H.EMPTY, '카메라 뒤 구 → 없음(광선이 못 닿음)');
  t(H.sphereRect(0, 0.6, 5.1, 0.5, V, P, VP, rc) === H.FULL && rc.l === -Infinity && rc.r === Infinity, '카메라가 구 안 → 전체');
  const rpt = {}; const cp = H.sphereRect(0.3, 0.2, 0, 0, V, P, VP, rpt);
  const q0 = toPx(c, new THREE.Vector3(0.3, 0.2, 0));
  t(cp === H.RECT && Math.abs(rpt.l - q0.x) < 1e-6 && Math.abs(rpt.r - q0.x) < 1e-6 && Math.abs(rpt.t - q0.y) < 1e-6, '반지름 0 → 그 점 하나(사각형 넓이 0)');
  t(H.sphereRect(NaN, 0, 0, 1, V, P, VP, rc) === H.FULL && H.sphereRect(0, 0, 0, NaN, V, P, VP, rc) === H.FULL && H.sphereRect(0, 0, 0, -1, V, P, VP, rc) === H.FULL, 'NaN · 음수 반지름 → 전체(모름)');
  const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100); oc.position.z = 5; oc.updateMatrixWorld();
  t(H.sphereRect(0, 0, 0, 0.1, oc.matrixWorldInverse.elements, oc.projectionMatrix.elements, VP, rc) === H.FULL, '원근이 아닌 투영 → 전체');
  t(H.sphereRect(0, 0, 0, 0.1, V, P, { left: 0, top: 0, width: 0, height: 600 }, rc) === H.FULL && H.sphereRect(0, 0, 0, 0.1, V, P, null, rc) === H.FULL, '캔버스 사각형이 없거나 넓이 0 → 전체');
  /* 2절 — 지도 */
  const m = H.createMap(); H.reset(m, 1000, '', VP);
  const R1 = { l: 100, t: 100, r: 200, b: 300 };
  H.addSphere(m, 0, 'rig', 0, 0.4, 0, 0.3, V, P, VP);
  const i1 = m.n; m.seat[i1] = 1; m.kind[i1] = 'base'; m.l[i1] = R1.l; m.t[i1] = R1.t; m.r[i1] = R1.r; m.b[i1] = R1.b; m.n++;
  const a = [];
  t(H.candidates(m, 200, 300, 0, a).includes(i1) && !H.candidates(m, 200.01, 300, 0, a).includes(i1), 'candidates — 경계 위 점은 안 · 바로 밖은 밖(여유 0)');
  t(H.candidates(m, 208, 150, 8, a).includes(i1) && !H.candidates(m, 208.01, 150, 8, a).includes(i1), '  여유 8px 은 그만큼만 넓힌다');
  t(H.candidates(m, 200, 150, -5, a).includes(i1) && !H.candidates(m, 200.5, 150, -5, a).includes(i1), '  음수 여유는 0 으로(좁히지도 넓히지도 않는다)');
  t(H.candidates(m, NaN, 150, 8, a).length === 0 && H.candidates(null, 1, 1, 8, a).length === 0, '  NaN 점 · 지도 없음 → 후보 없음');
  const m2 = H.createMap(); H.reset(m2, 0, '', VP);
  for(let s = 0; s < 30; s++){ const k = m2.n; m2.seat[k] = s; m2.kind[k] = 'rig'; m2.l[k] = s * 10; m2.t[k] = 0; m2.r[k] = s * 10 + 5; m2.b[k] = 5; m2.n++; }
  t(H.candidates(m2, 292, 2, 0, a).length === 1 && a[0] === 29, '  좌석 30 — 상한 없이 마지막 좌석까지 본다');
  const m3 = H.createMap(); H.reset(m3, 0, '', VP); H.addFull(m3, 4, 'base');
  t(H.candidates(m3, -99999, 99999, 0, a).length === 1 && m3.full === 1, '  모르는 조각(전체)은 어디서든 후보');
  const r0 = H.addSphere(m3, 5, 'rig', 0, 0.6, 9, 0.5, V, P, VP);
  t(r0 === -1 && m3.n === 1, '  카메라 뒤 구는 지도에 안 넣는다');
  const pm = H.createMap(); H.reset(pm, 0, '', VP);
  H.addSphere(pm, 2, 'rig', 0, 0.4, 0, 0.3, V, P, VP);
  const ctr = toPx(c, new THREE.Vector3(0, 0.4, 0));
  t(H.pointIn(pm, ctr.x, ctr.y, 0) === 2 && H.pointIn(pm, -5000, -5000, 8) === -1 && pm.seats[2] && pm.seats[2].rig && !pm.seats[2].base, 'pointIn — 좌석 번호 · 밖이면 -1 · 좌석마다 몸 / 그 밖 사각형');
  const fm = H.createMap(); H.reset(fm, 1000, '', VP);
  t(H.fresh(fm, 1249) && H.fresh(fm, 1250) && !H.fresh(fm, 1251), 'fresh — 249 · 250ms 는 믿고 251ms 는 낡음');
  const nm = H.createMap();
  t(!H.fresh(null, 0) && !H.fresh(nm, 0) && !H.fresh(H.reset(H.createMap(), -Infinity, 'error', null), 5) && !H.fresh(fm, 999), '  지도 없음 · 못 만듦(-∞) · 시계가 거꾸로 → 낡음');
  t(H.skipWhy({ officeHidden: true, runmode: true }) === 'office' && H.skipWhy({ officeHidden: false, runmode: false }) === 'notRun' && H.skipWhy({ officeHidden: false, runmode: true }) === null && H.skipWhy(null) === 'notRun', 'skipWhy — 회사원 숨김 · 실행 화면 아님이면 빈 지도, 아니면 만든다');
  t(H.HIT_MAP_PAD_PX === 8 && H.HIT_MAP_STALE_MS === 250, '상수 — 여유 8px · 낡음 250ms(설계 3-2)');
  return r;
}

const rows = judgeAll(MOD);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. sphereRect'); if(i === 10) say('── 2. 지도'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['사각형을 가운데 투영 ± 반지름으로', m => m.replace(/function ratioRange\(u, z, r\)\{[\s\S]*?\n\}/, 'function ratioRange(u, z, r){ if(z >= 0) return null; return [(u - r) / -z, (u + r) / -z]; }')],
  ['음수 여유를 그대로', m => m.replace('const p = pad >= 0 ? pad : 0;\n  for(let i = 0;', 'const p = pad;\n  for(let i = 0;')],
  ['카메라 뒤 거르기 빠짐', m => m.replace('if(hi <= -HALF_PI || lo >= HALF_PI) return null;', '')],
  ['신선도 경계를 < 로', m => m.replace('age <= HIT_MAP_STALE_MS', 'age < HIT_MAP_STALE_MS')],
  ['카메라가 구 안 판정 빠짐', m => m.replace('if(x * x + y * y + z * z <= rv * rv) return FULL;', '')],
];
for(const [name, fm] of breaks){
  let m2 = MOD; try{ m2 = fm(MOD); }catch(_){}
  let rows2; try{ rows2 = judgeAll(m2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(m2 !== MOD && rows2.some(([ok]) => !ok), name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
