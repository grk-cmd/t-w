/* ═══ 📐 sim-fit-model.js — 몸 · 책상 맞춤(character/fit-model.js · app.js 분리 M8) ═══════════════
   [왜] app.js FIT 구역(fitModel · fitDesk)을 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: fitModel 사람 — 진짜 three · 진짜 body-measure · char-measure 로 키 정규화(1.45) · x 가운데 · 발바닥 · 사용자 x · y(높이 상한) · 크기(userScale 로 나눔)
   ・2절: fitModel 동물 · 커미션 — 동물은 정해진 배율 · 이동량에 동물 배율 · 커미션 보정
   ・3절: 되돌리기 — 재는 동안 옮긴 rig · bodyWrap · group 을 원래대로 · bodyWrap 에 평준화 배율 · 월드 행렬을 세워 두고 나감 · 리깅 파츠 xf 다시 구움
   ・4절: fitDesk — 책상 높이 0.6 에 맞춤 · 가운데 · 바닥 · 앞으로 0.45 · 좌석 자리 되돌림
   ・5절: 빈 입력 — 몸 · 책상이 없으면 그대로 · 빈 박스는 크기를 안 건드림
   ・6절: 연결 — html · 만드는 줄 · 옛 이름 · app.js 에 맞춤 함수가 남지 않음
   ・7절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. three 는 vendor/three/three.min.js. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => process.stdout.write(s + '\n');
console.log = console.warn = () => {};   // 발바닥 보정 안내 줄(char-measure 의 진단)이 섞이지 않게
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/fit-model.js'), BM = read('character/body-measure.js'), CM = read('character/char-measure.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !BM || !CM || !APP || !HTML){ say('  ? 원본 못 찾음 — fit-model.js · body-measure.js · char-measure.js · app.js · html'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(path.resolve(threePath));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-5);
const bw = {}; new Function('THREE', 'window', 'module', BM)(THREE, bw, undefined);
const BMOD = bw.TwBodyMeasure.createBodyMeasure({});
const cw = {}; new Function('THREE', 'window', 'module', CM)(THREE, cw, undefined);
const CMOD = cw.TwCharMeasure.createCharMeasure({ measureBodyBox: (...a) => BMOD.measureBodyBox(...a) });
const clampCharY = (v) => { const n = +v; return (isFinite(n) && n > 0) ? Math.min(n, 0.6) : 0; };

function build(src, o){
  o = o || {};
  const log = { refresh: [], seatScale: [], rest: [], notes: [] };
  const win = {};
  new Function('THREE', 'window', 'module', src)(THREE, win, undefined);
  const mod = win.TwFitModel.createFitModel({
    ANIMAL_RUN_SCALE: 0.4, COMMISSION_SCALE_CORRECTION: o.comm == null ? 1 : o.comm,
    charMeasureMod: CMOD, clampCharY, seatEqMod: { seatScale: (s) => { log.seatScale.push(s); return o.eq == null ? 0.8 : o.eq; } },
    refreshRiggedPartsXf: (s) => log.refresh.push(s),
    creatorPrevMod: () => ({ RIG_TURN: 0.5 }),
    restPoseMod: { enter: (s) => { log.rest.push('enter'); return { rot: null, s }; }, leave: (r) => { log.rest.push('leave:' + (r && r.s ? 'seat' : '-')); } },
    fitWatchMod: { note: (s, got, ctx) => { log.notes.push({ s, got, ctx }); } },
  });
  return { mod, log };
}
/* 좌석 — 몸(box w × h × d, 원점이 중심) · 책상 · rig · bodyWrap · group */
function seat(o){
  o = o || {};
  const group = new THREE.Group(); group.position.set(3, 0, 1);
  const rig = new THREE.Group(); rig.position.set(0, 0, -0.47); rig.rotation.y = 0.3; group.add(rig);
  const bodyWrap = new THREE.Group(); bodyWrap.position.set(0.1, 0.2, 0.3); bodyWrap.scale.setScalar(2); rig.add(bodyWrap);
  const root = new THREE.Group(); bodyWrap.add(root);
  if(!o.noMesh){ const m = new THREE.Mesh(new THREE.BoxGeometry(o.w || 1, o.h || 2.9, o.d || 0.5)); m.position.set(o.cx || 0, o.cy == null ? 1.45 : o.cy, 0); root.add(m); }
  const s = Object.assign({ group, rig, bodyWrap, gltfRoot: o.noRoot ? null : root, userRot: Math.PI, userScale: 1, userX: 0, userY: 0, userZ: 0, charDef: o.def || null }, o.extra || {});
  group.updateMatrixWorld(true);
  return s;
}
const worldBox = (obj) => { obj.updateMatrixWorld(true); return new THREE.Box3().setFromObject(obj); };

say('§1 사람');
{
  const b = build(SRC); const s = seat({ h: 2.9, cx: 0.4 });
  b.mod.fitModel(s);
  const m = s.gltfRoot;
  chk(near(m.scale.x, 1.45 / 2.9) && near(m.scale.y, m.scale.x), '키를 1.45 로 정규화(2.9 → 배율 0.5)');
  chk(near(m.rotation.y, Math.PI + 0.5), '방향 = userRot + 생성기 리그 방향');
  const clean = build(SRC, { eq: 1 }); const cs = seat({ h: 2.9, cx: 0.4 });
  cs.group.position.set(0, 0, 0); cs.rig.position.set(0, 0, 0); cs.rig.rotation.set(0, 0, 0); cs.bodyWrap.position.set(0, 0, 0); cs.bodyWrap.scale.set(1, 1, 1); cs.group.updateMatrixWorld(true);
  clean.mod.fitModel(cs);
  const w = worldBox(cs.gltfRoot);
  chk(near(w.max.y - w.min.y, 1.45, 1e-3) && near((w.min.x + w.max.x) / 2, 0, 1e-3), '정규화한 몸의 높이 1.45 · x 가운데(한가운데에서 재서 가운데로 옮김)');
  const sx = seat({ h: 2.9, extra: { userX: 0.2 } }); const sx0 = seat({ h: 2.9 });
  b.mod.fitModel(sx); b.mod.fitModel(sx0);
  chk(near(sx.gltfRoot.position.x - sx0.gltfRoot.position.x, 0.2), '사용자 x 는 그대로 더한다(userScale 1)');
  const su = seat({ h: 2.9, extra: { userX: 0.2, userScale: 2 } }); b.mod.fitModel(su);
  chk(near(su.gltfRoot.position.x - sx0.gltfRoot.position.x, 0.1), '★ userScale 로 나눈 만큼(0.2 / 2) — 몸 틀 배율이 곱해져도 월드 이동량이 같게');
  const sy0 = seat({ h: 2.9 }), sy1 = seat({ h: 2.9, extra: { userY: 0.3 } }), sy2 = seat({ h: 2.9, extra: { userY: 9 } }), sy3 = seat({ h: 2.9, extra: { userY: -1 } });
  [sy0, sy1, sy2, sy3].forEach(x => b.mod.fitModel(x));
  chk(near(sy1.gltfRoot.position.y - sy0.gltfRoot.position.y, 0.3) && near(sy2.gltfRoot.position.y - sy0.gltfRoot.position.y, 0.6) && near(sy3.gltfRoot.position.y, sy0.gltfRoot.position.y), '높이 — userY 만큼 · 상한 0.6 · 음수는 0');
  const sz = seat({ h: 2.9, extra: { userZ: 0.5 } }); b.mod.fitModel(sz);
  chk(near(sz.gltfRoot.position.z - sx0.gltfRoot.position.z, 0.5), 'userZ 는 코드가 아직 더한다(폐기 값이지만 항은 남아 있다)');
  const flat = seat({ h: 0.00001, w: 1 }); b.mod.fitModel(flat);
  chk(isFinite(flat.gltfRoot.scale.x) && near(flat.gltfRoot.scale.x, 1), '높이가 거의 0(1e-4 이하)이면 배율 1(0 으로 나누지 않는다)');
}
say('§2 동물 · 커미션');
{
  const b = build(SRC);
  const a = seat({ h: 0.56, def: { animal: true } }); b.mod.fitModel(a);
  chk(near(a.gltfRoot.scale.x, (1.45 / (1.4 * 0.4)) * 0.4), '동물 — 정해진 배율 (1.45 / 0.56) × 0.4');
  const a0 = seat({ h: 0.56, def: { animal: true } }), ax = seat({ h: 0.56, def: { animal: true }, extra: { userX: 0.5, userY: 0.3 } });
  b.mod.fitModel(a0); b.mod.fitModel(ax);
  chk(near(ax.gltfRoot.position.x - a0.gltfRoot.position.x, 0.5 * 0.4) && near(ax.gltfRoot.position.y - a0.gltfRoot.position.y, 0.3 * 0.4), '동물은 x · y 이동량에 동물 배율 0.4 를 곱한다(생성기는 100% 로 보여주기 때문)');
  const bc = build(SRC, { comm: 1.15 });
  const c0 = seat({ h: 2.9 }), c1 = seat({ h: 2.9, def: { isCommission: true } });
  bc.mod.fitModel(c0); bc.mod.fitModel(c1);
  chk(near(c1.gltfRoot.scale.x / c0.gltfRoot.scale.x, 1.15), '커미션 캐릭터는 보정 배율을 더 곱한다');
  const cx = seat({ h: 2.9, def: { animal: false, isCommission: false } }), c00 = seat({ h: 2.9 });
  b.mod.fitModel(cx); b.mod.fitModel(c00);
  chk(near(cx.gltfRoot.scale.x, c00.gltfRoot.scale.x), 'def 가 있어도 동물 · 커미션이 아니면 사람과 같다');
}
say('§3 되돌리기');
{
  const b = build(SRC); const s = seat({ h: 2.9 });
  b.mod.fitModel(s);
  chk(near(s.rig.position.z, -0.47) && near(s.rig.rotation.y, 0.3) && near(s.bodyWrap.position.x, 0.1) && near(s.bodyWrap.position.y, 0.2) && near(s.bodyWrap.position.z, 0.3), '재는 동안 옮긴 rig 위치 · 방향 · bodyWrap 위치를 원래대로');
  chk(near(s.group.position.x, 3) && near(s.group.position.z, 1), '좌석 group 자리도 원래대로');
  chk(near(s.bodyWrap.scale.x, 0.8) && b.log.seatScale.length === 1 && b.log.seatScale[0] === s, '★ bodyWrap 배율은 평준화 배율(seatScale) 하나 — 재는 동안은 1');
  chk(b.log.refresh.length === 1 && b.log.refresh[0] === s, '끝에서 리깅 파츠 xf 를 다시 굽는다(한 번)');
  chk(b.log.rest.join() === 'enter,leave:seat', '기본 자세로 들어가 재고(rest-pose) 끝나면 되돌린다(한 쌍)');
  chk(b.log.notes.length === 1 && b.log.notes[0].s === s && near(b.log.notes[0].got.y, s.gltfRoot.position.y), '다시 맞춘 높이를 한 번 알린다(fit-watch — 마지막 y 그대로)');
  const nr = build(SRC); const ns = seat({ noMesh: true }); nr.mod.fitModel(ns);
  chk(nr.log.rest.join() === 'enter,leave:seat' && nr.log.notes.length === 0, '  몸 박스가 비어도 자세는 되돌리고 · 알림은 안 한다');
  const wm = new THREE.Vector3(); s.group.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3());
  s.group.matrixWorld.elements.slice(12, 15).forEach((v, i) => { wm.setComponent(i, v); });
  chk(near(wm.x, 3) && near(wm.z, 1), '★ 월드 행렬도 원래 자리로 세워 두고 나간다(옛 행렬로 남지 않음)');
}
say('§4 fitDesk');
{
  const b = build(SRC);
  const s = seat({}); const d = new THREE.Group(); const dm = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 1)); dm.position.set(5, 7, 2); d.add(dm); s.deskGltf = d;
  b.mod.fitDesk(s);
  const box = new THREE.Box3().setFromObject(d);
  chk(near(d.scale.x, 0.3) && near(box.max.y - box.min.y, 0.6), '책상 높이를 0.6 에 맞춘다(2 → 배율 0.3)');
  chk(near(box.min.y, 0, 1e-4) && near((box.min.x + box.max.x) / 2, 0, 1e-4) && near((box.min.z + box.max.z) / 2, 0.45, 1e-4), '바닥이 y=0 · x 가운데 · z 는 앞으로 0.45');
  chk(near(s.group.position.x, 3) && near(s.group.position.z, 1), '좌석 자리는 되돌린다');
  const flat = new THREE.Group(); const s3 = seat({}); s3.deskGltf = flat;
  let th = false; try{ b.mod.fitDesk(s3); }catch(_){ th = true; }
  chk(!th && flat.scale.x === 1, '빈 책상(박스 없음)은 크기를 안 건드린다');
}
say('§5 빈 입력');
{
  const b = build(SRC);
  const s = seat({ noRoot: true }); const before = s.rig.position.clone();
  b.mod.fitModel(s);
  chk(s.rig.position.equals(before) && b.log.refresh.length === 0 && b.log.seatScale.length === 0, '몸이 아직 없으면(gltfRoot 없음) 아무것도 안 건드린다');
  const s2 = seat({}); b.mod.fitDesk(s2);
  chk(near(s2.group.position.x, 3), '책상이 아직 없으면(deskGltf 없음) 그대로');
  const e = seat({ noMesh: true }); b.mod.fitModel(e);
  chk(e.gltfRoot.scale.x === 1 && near(e.group.position.x, 3) && b.log.refresh.length === 1, '빈 박스는 크기를 안 건드리되 좌석은 원래대로 · xf 는 굽는다');
}
say('§6 연결');
{
  const iF = HTML.indexOf('<script src="parts/character/fit-model.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iF > 0 && iA > iF, 'html — fit-model.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const fitModelMod = TwFitModel\.createFitModel\(\{[\s\S]*?creatorPrevMod: \(\)=>creatorPrevMod,[\s\S]*?seatEqMod: seatEqMod,[\s\S]*?\}\);/.test(code), 'app.js — 만들고 더 아래에서 만들어지는 creatorPrevMod 는 읽는 함수로 넘긴다');
  chk(/^const fitModel = fitModelMod\.fitModel;/m.test(code) && /^const fitDesk = fitModelMod\.fitDesk;/m.test(code), '  옛 이름 둘을 const 로 받는다');
  chk(!/function (fitModel|fitDesk)\b/.test(code), '  app.js 에 맞춤 함수가 남아 있지 않다');
}
say('§7 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk('1.45/size.y:1', '1.5/size.y:1');
  chk(!!m1 && (() => { const b = build(m1); const s = seat({ h: 2.9 }); b.mod.fitModel(s); return !near(s.gltfRoot.scale.x, 0.5); })(), '키 1.45 를 바꾸면 빨강');
  const m2 = brk('const _lift = clampCharY(seat.userY) * _animPos / _uz;', 'const _lift = clampCharY(seat.userY) / _uz;');
  chk(!!m2 && (() => { const b = build(m2); const a = seat({ h: 0.56, def: { animal: true }, extra: { userY: 0.3 } }), a0 = seat({ h: 0.56, def: { animal: true } }); b.mod.fitModel(a); b.mod.fitModel(a0); return !near(a.gltfRoot.position.y - a0.gltfRoot.position.y, 0.12); })(), '동물 높이에 배율을 안 곱하면 빨강');
  const m3 = brk('m.position.x+=((seat.userX||0)*_animPos)/_uz;', 'm.position.x+=((seat.userX||0)*_animPos)/seatEqMod.seatScale(seat);');
  chk(!!m3 && (() => { const b = build(m3); const su = seat({ h: 2.9, extra: { userX: 0.2, userScale: 2 } }), s0 = seat({ h: 2.9 }); b.mod.fitModel(su); b.mod.fitModel(s0); return !near(su.gltfRoot.position.x - s0.gltfRoot.position.x, 0.1); })(), 'raw userScale 대신 실효값으로 나누면 빨강');
  const m4 = brk('seat.bodyWrap.scale.setScalar(seatEqMod.seatScale(seat));', '');
  chk(!!m4 && (() => { const b = build(m4); const s = seat({ h: 2.9 }); b.mod.fitModel(s); return !near(s.bodyWrap.scale.x, 0.8); })(), '평준화 배율을 안 걸면 빨강');
  const m5 = brk('refreshRiggedPartsXf(seat);', '');
  chk(!!m5 && (() => { const b = build(m5); const s = seat({ h: 2.9 }); b.mod.fitModel(s); return b.log.refresh.length === 0; })(), '리깅 파츠 xf 를 안 구우면 빨강');
  const m6 = brk('d.position.z+=0.45;', 'd.position.z+=0.4;');
  chk(!!m6 && (() => { const b = build(m6); const s = seat({}); const d = new THREE.Group(); d.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))); s.deskGltf = d; b.mod.fitDesk(s); return !near(new THREE.Box3().setFromObject(d).max.z - 0.5, 0.45, 1e-4); })(), '책상 앞으로 밀기를 바꾸면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
