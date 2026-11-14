/* ═══ 🎯 sim-seat-hit-targets.js — 좌석의 누를 수 있는 조각 · 히트 맵 새 판정(room/seat-hit-targets.js) ═══════════════
   진짜 three 로 좌석 넷을 짓고, 화면 점 격자 1만 개에서 «옛 통과 판정»(desktop-run.js 의 모든 좌석 광선 + 날아가는 몸 ·
   숨은 책상 빼기)과 새 판정(rebuild → pick)이 같은 답인지 본다. 거르기 규칙은 진짜 hidden-seats.js 를 쓴다.
   좌석: ① 앉음(뼈 대는 스킨 몸 · 책상 · 자리비움 그림 스프라이트 · raycast 를 끈 대역 · 선) ② 날아감 ③ 올라탐(책상 숨김) ④ 자리비움(몸 숨김)
   ・1절: 격자 1만 점 — 같은 답 · 맞는 점 · 사각형 안 못 맞는 점이 실제로 있음(헛판정 아님) · 화면 밀기 · 캔버스 자리
   ・2절: 찾을 때 만들기 — 그린 장만 있고 판정이 없으면 안 만듦 · 판정이 찾을 때 한 번 · 다시 그리면 새 장으로 · 결과 객체 재사용 ·
          못 만든 지도 → 전체 광선 · allowRay 거짓이면 광선 안 쏨 · 회사원 숨김 · 설정 화면 · 실행 화면 아님(deps) → 빈 지도 · 다를 때 줄 재료
   ・3절: 일부러 깨 보기 — 날아가는 몸을 지도에 · 스프라이트를 조각에서 뺌 · 숨은 책상 거르기 빠짐 · 매 장 만들기로 되돌림 ·
          장 번호 비교 빠짐 · 결과 객체를 판정마다 새로 · 못 만든 지도에서 전체 광선 빠짐
   [실행] 러너 스테이징(node checks/run.js seat-hit-targets) 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('room/seat-hit-targets.js'), HM = read('launcher/hit-map.js'), HS = read('room/hidden-seats.js');
if(!MOD || !HM || !HS){ say('  ? 원본 못 찾음 — seat-hit-targets.js · hit-map.js · hidden-seats.js'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(path.resolve(threePath));

const loadWin = (src, name, extra) => { const win = {}; new Function('window', 'module', 'localStorage', src)(win, undefined, extra); return win[name]; };
const LS = { getItem: () => null, setItem: () => {} };
const VP = { left: 13, top: 27, width: 800, height: 600 };

function mat(){ return new THREE.MeshBasicMaterial(); }
function box(w, h, d, x, y, z){ const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat()); m.position.set(x || 0, y || 0, z || 0); return m; }
/* 뼈 둘짜리 스킨 몸 — 팔 뼈를 돌려 묶음 자세와 다르게(경계 구는 묶음 자세 기준 — 지도도 광선도 같은 구를 본다) */
function skinned(){
  const g = new THREE.BoxGeometry(0.5, 1.0, 0.3, 2, 6, 2);
  const pos = g.attributes.position, idx = [], wt = [];
  for(let i = 0; i < pos.count; i++){ const top = pos.getY(i) > 0.1; idx.push(top ? 1 : 0, 0, 0, 0); wt.push(1, 0, 0, 0); }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
  const root = new THREE.Bone(), arm = new THREE.Bone(); arm.position.y = 0.1; root.add(arm);
  const m = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial({ skinning: true }));
  m.add(root); m.bind(new THREE.Skeleton([root, arm]));
  arm.rotation.z = 0.5;
  m.position.y = 0.6;
  return m;
}
function makeSeat(x, opt){
  const group = new THREE.Group(); group.position.x = x;
  const rig = new THREE.Group(); group.add(rig);
  const body = skinned(); rig.add(body);
  const head = box(0.4, 0.4, 0.4, 0, 1.35, 0); rig.add(head);
  const desk = new THREE.Group(); desk.add(box(0.9, 0.08, 0.5, 0, 0.45, 0.35)); desk.add(box(0.08, 0.45, 0.08, -0.4, 0.22, 0.5)); group.add(desk);
  const seat = { group, rig, desk, isMe: !!opt.me, remote: !opt.me };
  if(opt.sprite){ const sp = new THREE.Sprite(new THREE.SpriteMaterial()); sp.position.set(0.55, 1.6, 0); sp.scale.set(0.35, 0.35, 1); sp.center.set(0.2, 0.1); group.add(sp); seat.sprite = sp; }
  if(opt.stand){ const st = box(0.3, 1.6, 0.3, -0.6, 0.8, 0); st.userData.__origRaycast = st.raycast; st.raycast = function(){}; group.add(st); }   // 동물의 숨은 사람 대역
  if(opt.line){ const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.3, 1.9, 0), new THREE.Vector3(0.3, 1.9, 0)]), new THREE.LineBasicMaterial()); group.add(ln); }
  if(opt.noMat){ const nm = box(0.2, 0.2, 0.2, 0.3, 0.2, 0); nm.material = undefined; group.add(nm); }
  if(opt.fly){ seat.fly = true; rig.position.set(0.4, 0.9, 0.2); rig.rotation.z = 1.1; }
  if(opt.ride){ seat.ridingOn = 'x'; desk.visible = false; }
  if(opt.away){ body.visible = false; head.visible = false; seat._bodyOff = true; }
  if(opt.layer){ head.layers.set(3); }
  return seat;
}

function world(opt){
  opt = opt || {};
  const scene = new THREE.Scene();
  const seats = [
    makeSeat(-2.2, opt.plain ? { me: true, sprite: true } : { me: true, sprite: true, stand: true, line: true, noMat: true }),
    makeSeat(-0.7, { fly: true }),
    makeSeat(0.8, { ride: true }),
    makeSeat(2.2, { away: true, sprite: true, layer: true }),
  ];
  seats.forEach(s => scene.add(s.group));
  const camera = new THREE.PerspectiveCamera(34, VP.width / VP.height, 0.1, 100);
  camera.position.set(0, 1.2, 8); camera.lookAt(0, 0.9, 0);
  if(opt.offset) camera.setViewOffset(1000, 700, 150, 40, 800, 600);
  camera.updateProjectionMatrix();
  const frame = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(); seats.forEach(s => s.group.traverse(o => { if(o.isSkinnedMesh) o.skeleton.update(); })); };
  frame();
  return { scene, seats, camera, frame };
}

function setup(src, w, opt){
  opt = opt || {};
  const HitMap = loadWin(HM, 'TwHitMap');
  const flyN = { n: 1 };
  const hidden = loadWin(HS, 'TwHiddenSeats', LS).createHiddenSeats({ _flyActive: () => flyN.n, seatFromObject: () => null, seats: w.seats });
  const clock = { t: 1000 };
  const ray = new THREE.Raycaster();
  const builds = [];
  const env = opt.env || {};
  const mod = loadWin(src, 'TwSeatHitTargets').createSeatHitTargets({
    THREE, hitMap: HitMap, seats: w.seats, camera: w.camera, ray,
    canvasRect: opt.canvasRect || (() => VP),
    officeHidden: () => !!env.office, configHidden: () => !!env.config, isRunmode: () => env.run !== false,
    partSkipped: opt.partSkipped || ((o) => hidden._partSkipped(o)),
    skipHits: (h) => hidden._skipUnhittable(h),
    now: () => clock.t,
    noteBuild: (ms, st, err) => builds.push({ ms, st: Object.assign({}, st), err }),
  });
  /* 옛 판정 — desktop-run.js _pointHitsInteractive 의 3D 몫 그대로 */
  const old = (x, y) => {
    ray.setFromCamera(new THREE.Vector2(((x - VP.left) / VP.width) * 2 - 1, -((y - VP.top) / VP.height) * 2 + 1), w.camera);
    const ix = hidden._skipHiddenDesk(hidden._skipFlyingRigs(ray.intersectObjects(w.seats.map(s => s.group), true)));
    return ix.length > 0;
  };
  const neu = (x, y, allow) => mod.pick(ray, x, y, allow !== false);   // old() 바로 뒤 — 같은 광선
  return { mod, old, neu, clock, builds, hidden, HitMap, ray, env };
}

function grid(S){
  const out = { n: 0, diff: 0, hit: 0, near: 0, far: 0, first: '' };
  for(let i = 0; i < 100; i++) for(let j = 0; j < 100; j++){
    const x = VP.left + (i + 0.5) * VP.width / 100, y = VP.top + (j + 0.5) * VP.height / 100;
    const o = S.old(x, y), p = S.neu(x, y);
    out.n++;
    if(o !== p.hit){ out.diff++; if(!out.first) out.first = '(' + Math.round(x) + ',' + Math.round(y) + ') 옛=' + o + ' 새=' + p.hit; }
    if(o) out.hit++; else if(p.inRect) out.near++; else out.far++;
  }
  return out;
}

function judgeAll(src, variant){
  variant = variant || {};
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 1절 */
  let w = world(), S = null, g = null;
  try{ S = setup(src, w, variant.setup ? variant.setup(w) : null); S.mod.markRendered(); g = grid(S); }catch(e){ g = null; t(false, '던짐 — ' + String(e.message || e).slice(0, 80)); }
  t(g && g.diff === 0, '격자 ' + (g ? g.n : 0) + '점 — 옛 판정과 새 판정이 같다' + (g && g.diff ? ' — 다름 ' + g.diff + ' ' + g.first : ''));
  let gp = null;
  try{ const wp = world({ plain: true }); const Sp = setup(src, wp, variant.setup ? variant.setup(wp) : null); Sp.mod.markRendered(); gp = grid(Sp); }catch(_){}
  t(gp && gp.diff === 0 && gp.hit > 200 && gp.near > 50 && gp.far > 1000, '  모르는 조각이 없는 방 — 같고, 맞는 점 · 사각형 안 못 맞는 점 · 먼 점이 다 있다(헛판정 아님) — ' + (gp ? gp.hit + ' · ' + gp.near + ' · ' + gp.far + (gp.diff ? ' 다름 ' + gp.diff : '') : '-'));
  const b = S && S.builds[S.builds.length - 1];
  t(b && !b.err && b.st.seats === 4 && b.st.parts > 10 && b.st.tris > 100 && b.st.full >= 2, '  지도 한 장 — 좌석 4 · 조각 · 삼각형 · 모르는 조각(끈 raycast · 선) 셈 — ' + (b ? JSON.stringify(b.st) : '-'));
  let g2 = null;
  try{ const w2 = world({ offset: true }); const S2 = setup(src, w2, variant.setup ? variant.setup(w2) : null); S2.mod.markRendered(); g2 = grid(S2); }catch(_){}
  t(g2 && g2.diff === 0 && g2.hit > 100, '  화면 밀기(setViewOffset) 카메라에서도 같다' + (g2 && g2.diff ? ' — 다름 ' + g2.diff + ' ' + g2.first : ''));
  /* 2절 — 판정이 찾을 때만 만든다 */
  let lz = null;
  try{
    const w3 = world(); const S3 = setup(src, w3, variant.setup ? variant.setup(w3) : null);
    for(let k = 0; k < 30; k++) S3.mod.markRendered();
    const b0 = S3.builds.length;
    const x0 = VP.left + 160, y0 = VP.top + 330;
    S3.old(x0, y0); const p1 = S3.neu(x0, y0); const built1 = p1.built;
    S3.old(x0, y0); const p2 = S3.neu(x0, y0); const built2 = p2.built;
    const b1 = S3.builds.length;
    w3.seats[0].group.position.x += 0.9; w3.seats[2].group.position.y += 0.5; w3.frame(); S3.mod.markRendered();   // 몸을 옮기고 다시 그림
    const g3 = grid(S3);
    lz = { b0, b1, built1, built2, same: p1 === p2, g3, b2: S3.builds.length };
  }catch(_){}
  t(lz && lz.b0 === 0, '그린 장만 있고 판정이 없으면 지도를 안 만든다(비용 0) — 30장에 만듦 ' + (lz ? lz.b0 : '-'));
  t(lz && lz.b1 === 1 && lz.built1 === true && lz.built2 === false, '  판정이 찾을 때 한 번 · 같은 장의 다음 판정은 그 지도를 쓴다');
  t(lz && lz.g3.diff === 0 && lz.g3.hit > 200 && lz.b2 === 2, '  몸을 옮겨 다시 그리면 다음 판정이 새 장으로 만들고 같은 답' + (lz && lz.g3.diff ? ' — 다름 ' + lz.g3.diff : ''));
  t(lz && lz.same, '  pick 결과는 같은 객체를 다시 쓴다(판정마다 새 객체 없음)');
  let er = null;
  try{
    const w4 = world(); const S4 = setup(src, w4, { canvasRect: () => { throw new Error('깨 봄'); } }); S4.mod.markRendered();
    const p = (S4.old(VP.left + 100, VP.top + 300), S4.neu(VP.left + 100, VP.top + 300));
    er = { bb: S4.builds[0], stale: p.stale, g: grid(S4) };
  }catch(_){}
  t(er && er.bb.err === true && er.stale === true && er.g.diff === 0, '지도를 못 만들면(던짐) 실패를 세고 전체 광선으로 같은 답');
  let sk = null;
  try{
    const w5 = world(); const S5 = setup(src, w5); S5.mod.markRendered();
    let calls = 0; const realI = S5.ray.intersectObjects.bind(S5.ray);
    const x = VP.left + 160, y = VP.top + 330; S5.old(x, y);
    const p0 = S5.neu(x, y, true); const b0 = S5.builds.length;
    S5.ray.intersectObjects = (...a) => { calls++; return realI(...a); };
    const p1 = S5.neu(x, y, false); const sk1 = p1.skipped, in1 = p1.inRect;
    S5.mod.markRendered(); const p2 = S5.neu(x, y, false);
    sk = { calls, sk1, in1, sk2: p2.skipped, built2: p2.built, b: S5.builds.length - b0 };
  }catch(_){}
  t(sk && sk.calls === 0 && sk.sk1 && sk.in1 && sk.sk2 && !sk.built2 && sk.b === 0, 'allowRay 거짓(예산 넘음) — 광선을 안 쏘고 · 새 장이어도 지도를 안 만들고 건너뜀(지도 안인지는 알려 줌)');
  const emptyWhy = (env) => { const w6 = world(); const S6 = setup(src, w6, { env }); S6.mod.markRendered();
    let any = 0; for(let i = 0; i < 40; i++){ const x = VP.left + i * 20, y = VP.top + 300; S6.old(x, y); const p = S6.neu(x, y); if(p.hit || p.inRect || p.stale) any++; }
    return { any, why: S6.mod.map().why, n: S6.mod.map().n }; };
  let of = null;
  try{ of = [emptyWhy({ office: true }), emptyWhy({ config: true }), emptyWhy({ run: false })]; }catch(_){}
  t(of && of.every(x => x.any === 0 && x.n === 0) && of.map(x => x.why).join() === 'office,config,notRun', '회사원 숨김 · 설정 화면 · 실행 화면 아님(deps) → 빈 지도 — ' + (of ? of.map(x => x.why).join(' · ') : '-'));
  let ds = null;
  try{
    const w7 = world(); const S7 = setup(src, w7); S7.mod.markRendered(); S7.old(1, 1); S7.neu(1, 1);
    ds = S7.mod.describe(w7.seats[2].desk.children[0], 5, 6, { drag: true });
    const d2 = S7.mod.describe(w7.seats[0].rig.children[1], 1, 2);
    ds = { a: ds, b: d2 };
  }catch(_){}
  t(ds && ds.a.seat === 2 && ds.a.kind === 'base' && ds.a.ride && ds.a.drag && ds.a.oldWhy === 'char:other#2' && ds.b.kind === 'rig' && ds.b.oldWhy === 'char:me' && ds.b.rect && isFinite(ds.b.rect.l) && ds.b.age === 0,
    'describe — 좌석 · 몸/책상 · 좌석 사각형 · 그린 뒤 시간 · 상태(탐 · 끌) · 옛 이유');
  return r;
}

const rows = judgeAll(MOD);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 격자 1만 점'); if(i === 4) say('── 2. 찾을 때 만들기 · 못 만듦 · 건너뜀 · 빈 지도 · 다를 때 재료'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['날아가는 몸을 지도에 넣기', MOD, { setup: (w) => { const h = loadWin(HS, 'TwHiddenSeats', LS).createHiddenSeats({ _flyActive: () => 0, seatFromObject: () => null, seats: w.seats }); return { partSkipped: (o) => h._partSkipped(o) }; } }],
  ['스프라이트를 조각에서 빼기', MOD.replace('if(rc === NO_RC) return;', 'if(rc === NO_RC || o.isSprite) return;'), null],
  ['숨은 책상 거르기 빼기', MOD, { setup: (w) => { const h = loadWin(HS, 'TwHiddenSeats', LS).createHiddenSeats({ _flyActive: () => 1, seatFromObject: () => null, seats: w.seats.map(s => Object.assign({}, s, { desk: null })) }); return { partSkipped: (o) => h._partSkipped(o) }; } }],
  ['매 장 만들기로 되돌림', MOD.replace('function markRendered(){ seq++; renderedAt = now(); }', 'function markRendered(){ seq++; renderedAt = now(); rebuild(); }'), null],
  ['장 번호 비교 빠짐(한 번 만든 지도를 계속 씀)', MOD.replace('const need = mapSeq !== seq;', 'const need = mapSeq < 0;'), null],
  ['결과 객체를 판정마다 새로', MOD.replace('if(!allowRay){ res.skipped = true; return res; }\n    _pickObjs', 'if(!allowRay){ res.skipped = true; return Object.assign({}, res); }\n    _pickObjs').replace('    return res;\n  }\n\n', '    return Object.assign({}, res);\n  }\n\n'), null],
  ['예산을 넘어도 지도를 만듦', MOD.replace('if(need && !allowRay){', 'if(false){'), null],
  ['못 만든 지도에서 전체 광선 빠짐', MOD.replace('const stale = !isFinite(map.at);', 'const stale = false;'), null],
];
for(const [name, m2, v] of breaks){
  const changed = m2 !== MOD || !!v;
  let rows2; try{ rows2 = judgeAll(m2, v || {}); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
