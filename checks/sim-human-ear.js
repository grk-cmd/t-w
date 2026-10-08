/* ═══ 🐾 sim-human-ear.js — 사람 귀(꾸미기 › 머리 › 귀) 모듈 (2026-10-08 신설) ═══════════════════════
   동물 생성기의 귀 GLB 를 사람 캐릭터 머리에 붙이는 human-ear.js 를 본다.
   ・1절: 자리 상수 — ANIMAL_EAR_BONE · HEAD_TO_EAR 가 GLB(animal-glb.js · base-glb.js)의 실제 본 위치와 같다
   ・2절: 조정값 — 대칭 복사가 animal.js ⇆ 와 같은 결과 · 두 번 뒤집으면 제자리 · 방에서 온 값 거르기 · 귀 종류 거르기
   ・3절: 실제 three 로 — 사람 기본 뼈대에서 옮길 양 · 귀 본 없는 모델 · 정규화 배율과 무관
   ・4절: 붙이기 — head 본을 따라 움직인다 · 같은 쪽 콜백 두 번이면 하나만 · 늦게 온 콜백은 버린다 · 크기 측정 제외 표식
          · 움직이는 중에 달아도 바인드 기준 · readAdj 역함수
   ・5절: 배선 — html 로드 순서 · animal.js 가 귀 파서를 내준다
   [실행] human-ear.js · animal.js · base-glb.js · animal-glb.js · ears-glb.js · desk-companion-prototype.html 이 있는 폴더에서.
     three 는 vendor/three/three.min.js 를 쓴다. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['human-ear.js', 'animal.js', 'base-glb.js', 'animal-glb.js', 'ears-glb.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const threePath = ['vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(require('path').resolve(threePath));

const win = {};
const load = (f) => new Function('window', 'module', SRC[f])(win, undefined);
['base-glb.js', 'animal-glb.js', 'ears-glb.js', 'human-ear.js'].forEach(load);
const H = win.HumanEar;
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);
const nearV = (v, arr, e) => near(v.x, arr[0], e) && near(v.y, arr[1], e) && near(v.z, arr[2], e);
const fmt = (v) => '(' + [v.x, v.y, v.z].map(n => n.toFixed(3)).join(', ') + ')';

/* GLB 의 노드 트리를 three 객체로 — 본 이름 · 위치만 쓴다(메쉬 없이). */
function glbTree(b64){
  const buf = Buffer.from(b64, 'base64'), len = buf.readUInt32LE(12);
  const j = JSON.parse(buf.toString('utf8', 20, 20 + len));
  const jointIdx = new Set((j.skins || []).flatMap(s => s.joints));
  const objs = j.nodes.map((n, i) => {
    const o = jointIdx.has(i) ? new THREE.Bone() : new THREE.Object3D();
    o.name = n.name || '';
    if(n.translation) o.position.fromArray(n.translation);
    if(n.rotation) o.quaternion.fromArray(n.rotation);
    if(n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  j.nodes.forEach((n, i) => (n.children || []).forEach(c => objs[i].add(objs[c])));
  const root = new THREE.Group();
  objs.filter(o => !o.parent).forEach(o => root.add(o));
  root.updateMatrixWorld(true);
  return root;
}
const boneWorld = (root, name) => { let b = null; root.traverse(o => { if(!b && o.name === name) b = o; }); return b && b.getWorldPosition(new THREE.Vector3()); };

say('── 1. 자리 상수가 GLB 와 같다');
const animal = glbTree(win.ANIMAL_GLB_B64), human = glbTree(win.BASE_GLB_B64);
for(const s of ['L', 'R']){
  const a = boneWorld(animal, 'ear_' + s);
  chk(a && nearV(a, H.ANIMAL_EAR_BONE[s]), `ANIMAL_EAR_BONE.${s} = 동물 ear_${s} 본 ${a && fmt(a)}`);
  const he = boneWorld(human, 'ear_' + s), hh = boneWorld(human, 'head');
  const d = he && hh && he.clone().sub(hh);
  chk(d && nearV(d, H.HEAD_TO_EAR[s]), `HEAD_TO_EAR.${s} = 사람 head → ear_${s} ${d && fmt(d)}`);
}
chk(Array.isArray(win.ANIMAL_EAR_TYPES) && win.ANIMAL_EAR_TYPES.length >= 1, '귀 목록(ANIMAL_EAR_TYPES)이 있다 — ' + (win.ANIMAL_EAR_TYPES || []).map(t => t.key).join(','));
const missingGlb = (win.ANIMAL_EAR_TYPES || []).flatMap(t => ['L', 'R'].map(s => 'ear_' + t.key + '_' + s)).filter(k => !(win.ANIMAL_EARS && win.ANIMAL_EARS[k]));
chk(missingGlb.length === 0, '목록의 귀마다 좌·우 GLB 가 있다' + (missingGlb.length ? ' — 없음: ' + missingGlb.join(',') : ''));

say('── 2. 조정값');
/* animal.js ⇆ 의 받는 쪽 객체 리터럴을 그대로 떼어 와 같은 입력에 돌린다 */
const A = SRC['animal.js'];
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
const lit = /earAdj\[to\]=(\{ px:-a\.px[\s\S]*?\});/.exec(A);
chk(!!lit, 'animal.js ⇆ 대칭 복사 식을 찾았다');
if(lit){
  const animalMirror = new Function('a', grab(A, '_earScale') + '\n' + grab(A, '_earRot') + '\nconst _s=_earScale(a), _r=_earRot(a);\nreturn ' + lit[1] + ';');
  const samples = [
    { px:0.1, py:-0.2, pz:0.3, rot:0.4, rx:0.5, ry:-0.6, sc:1.2, scx:1.1, scy:0.9, scz:1.3 },
    { px:-0.05, py:0, pz:0, rot:0, sc:0.8 },                       // 옛 저장본(rx·ry·scx 없음)
    H.newAdj(),
  ];
  const same = samples.every(a => { const x = H.mirrorAdj(a), y = animalMirror(a); return Object.keys(y).every(k => near(x[k], y[k], 1e-12)); });
  chk(same, '대칭 복사 = animal.js ⇆ 와 같은 값(새 · 옛 저장본 · 기본값)');
  const a0 = samples[0], back = H.mirrorAdj(H.mirrorAdj(a0));
  chk(Object.keys(a0).every(k => near(back[k], a0[k], 1e-12)), '두 번 뒤집으면 제자리');
}
const dirty = H.cleanAdj({ px:'1', py:NaN, pz:Infinity, rot:0.3, evil:5, sc:2 });
chk(dirty.px === 0 && dirty.py === 0 && dirty.pz === 0 && dirty.rot === 0.3 && dirty.sc === 2 && !('evil' in dirty), '방에서 온 조정값 — 유한한 숫자 · 아는 키만');
chk(JSON.stringify(H.cleanAdj(null)) === JSON.stringify(H.EAR_ADJ_DEFAULT), '조정값이 없으면 기본값');

const parsed = {};   // key → 가짜 귀 scene 생성기
const fakeEarScene = (key) => {
  const side = key.slice(-1), g = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.2), new THREE.MeshBasicMaterial());
  // 귀 GLB 처럼 동물 귀 본 근처(조금 위)에 박아 둔다
  m.position.set(H.ANIMAL_EAR_BONE[side][0], H.ANIMAL_EAR_BONE[side][1] + 0.4, H.ANIMAL_EAR_BONE[side][2]);
  g.add(m); return g;
};
let pending = [];   // 비동기 파싱 흉내 — 쌓아 두었다가 flush 로 한꺼번에
const mk = (mode) => H.createHumanEar({ THREE, earTypes: () => win.ANIMAL_EAR_TYPES,
  parseEar: (key, cb) => { if(!win.ANIMAL_EARS[key]){ cb(null); return; } parsed[key] = (parsed[key] || 0) + 1;
    if(mode === 'async') pending.push(() => cb(fakeEarScene(key))); else cb(fakeEarScene(key)); } });
const flush = () => { const p = pending; pending = []; p.forEach(f => f()); };
const HE = mk('sync');
const st = HE.readDef({ earL:'cat', earR:'nope', earAdj:{ L:{ px:0.1 }, R:'x' } });
chk(st.L === 'cat' && st.R === null, '모르는 귀 종류는 «없음»');
chk(st.adj.L.px === 0.1 && st.adj.R.px === 0, '조정값을 쪽마다 거른다');
chk(!HE.hasEars({}) && HE.hasEars({ earR:'rabbit' }), 'hasEars — 한쪽만 있어도 참');

say('── 3. 옮길 양 (실제 three)');
const exp = [0, 3.8408 - 2.8279, 0.5162 - 0.4792];
const h1 = glbTree(win.BASE_GLB_B64);
const sL = HE.shiftFor(h1, 'L'), sR = HE.shiftFor(h1, 'R');
chk(sL && nearV(sL, exp, 2e-3) && sR && nearV(sR, exp, 2e-3), `사람 기본 모델 — 귀 본 기준 위로 1.01 ${sL && fmt(sL)}`);
const h2 = glbTree(win.BASE_GLB_B64); h2.scale.setScalar(0.37); h2.position.set(1, 2, 3); h2.updateMatrixWorld(true);
const s2 = HE.shiftFor(h2, 'L');
chk(s2 && nearV(s2, exp, 2e-3), '정규화 배율 · 위치가 있어도 같은 값(모델 원점 기준) ' + (s2 && fmt(s2)));
const h3 = glbTree(win.BASE_GLB_B64);
['ear_L', 'ear_R'].forEach(n => { h3.traverse(o => { if(o.name === n) o.name = 'xx_' + n; }); });
const s3 = HE.shiftFor(h3, 'R');
chk(s3 && nearV(s3, exp, 2e-3), '귀 본이 없으면 head 본 + HEAD_TO_EAR 로 같은 자리 ' + (s3 && fmt(s3)));
const h4 = new THREE.Group(); h4.add(new THREE.Object3D());
chk(HE.shiftFor(h4, 'L') === null, '본이 하나도 없으면 null');
const h5 = glbTree(win.BASE_GLB_B64); h5.traverse(o => { if(o.name === 'ear_L') o.name = 'earring_L'; });
chk(HE.shiftFor(h5, 'L') && nearV(HE.shiftFor(h5, 'L'), exp, 2e-3), "'earring' 이름은 귀 본으로 안 잡는다(폴백으로 같은 자리)");

say('── 4. 붙이기');
const r1 = glbTree(win.BASE_GLB_B64); r1.scale.setScalar(0.4); r1.updateMatrixWorld(true);
const attached = [];
HE.attachFromDef(r1, { earL:'cat', earR:'cat', earAdj:{ L:{ py:0.05 } } }, { onAttach: w => attached.push(w) });
const wL = HE.findWrap(r1, 'L'), wR = HE.findWrap(r1, 'R');
chk(!!wL && !!wR && attached.length === 2, '양쪽 귀가 붙었다');
const holder = wL && wL.parent;
chk(holder && holder.name === H.HOLDER_NAME && holder.userData.rigged === true, 'holder 에 크기 측정 제외 표식(rigged)');
chk(holder && holder.parent && holder.parent.isBone && holder.parent.name === 'head', 'holder 는 head 본 아래');
const toRoot = (o) => { r1.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(r1.matrixWorld).invert(); return o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv); };
const meshL = wL && wL.children[0] && wL.children[0].children[0];   // wrap ─ 복제 scene ─ 메쉬
const wantL = [H.ANIMAL_EAR_BONE.L[0] + exp[0], H.ANIMAL_EAR_BONE.L[1] + 0.4 + exp[1] + 0.05, H.ANIMAL_EAR_BONE.L[2] + exp[2]];
chk(meshL && nearV(toRoot(meshL), wantL, 2e-3), `왼귀 = 동물 자리 + 옮길 양 + 조정(py 0.05) ${meshL && fmt(toRoot(meshL))}`);
const before = meshL && toRoot(meshL);
let headBone = null; r1.traverse(o => { if(o.isBone && o.name === 'head') headBone = o; });
headBone.rotation.z += 0.3; const after = toRoot(meshL);
chk(before && after.distanceTo(before) > 0.1, '머리가 돌면 귀도 따라 움직인다');
headBone.rotation.z -= 0.3;
chk(nearV(toRoot(meshL), [before.x, before.y, before.z], 1e-4), '머리가 돌아오면 귀도 제자리');

HE.applyAdj(wL, H.mirrorAdj(H.newAdj()));
chk(nearV(toRoot(meshL), [wantL[0], wantL[1] - 0.05, wantL[2]], 2e-3), 'applyAdj 는 조정값을 통째로 덮는다(py 가 남지 않음)');

const HA = mk('async');
const r2 = glbTree(win.BASE_GLB_B64);
HA.attachSide(r2, 'L', 'cat', H.newAdj());
HA.attachSide(r2, 'L', 'bear', H.newAdj());
flush();
let cntL = 0; r2.traverse(o => { if(o.userData && o.userData.humanEar === 'L') cntL++; });
chk(cntL === 1, '같은 쪽 콜백이 둘 와도 귀는 하나 (' + cntL + ')');
let stale = true;
const r3 = glbTree(win.BASE_GLB_B64);
HA.attachSide(r3, 'R', 'cat', H.newAdj(), { isStale: () => stale });
flush();
chk(!HA.findWrap(r3, 'R'), '그사이 종류가 바뀌었으면(isStale) 늦게 온 귀를 안 붙인다');
const r4 = glbTree(win.BASE_GLB_B64);
HE.attachFromDef(r4, { earL:'cat' });
HE.attachFromDef(r4, { earL:null });
chk(!HE.findWrap(r4, 'L'), '«없음» 으로 바꾸면 떨어진다');
const r5 = glbTree(win.BASE_GLB_B64);
HE.attachFromDef(r5, {});
let hasHolder = false; r5.traverse(o => { if(o.name === H.HOLDER_NAME) hasHolder = true; });
chk(!hasHolder, '귀가 없는 캐릭터에는 아무것도 안 만든다');

/* holder 를 바인드 자세에서 만들어 두면, 나중에(머리가 돌아간 채) 귀를 달아도 바인드 기준 자리에 붙는다 */
const r6 = glbTree(win.BASE_GLB_B64);
let head6 = null; r6.traverse(o => { if(o.isBone && o.name === 'head') head6 = o; });
HE.ensureHolder(r6);
head6.rotation.z += 0.5; head6.rotation.x -= 0.3;
HE.attachSide(r6, 'L', 'cat', H.newAdj());
head6.rotation.z -= 0.5; head6.rotation.x += 0.3;
const m6 = HE.findWrap(r6, 'L').children[0].children[0];
r6.updateMatrixWorld(true);
const want6 = [wantL[0], wantL[1] - 0.05, wantL[2]];
chk(nearV(m6.getWorldPosition(new THREE.Vector3()), want6, 2e-3), '머리가 돌아간 채 귀를 달아도 바인드 자세 기준 자리(holder 가 옮길 양을 미리 잰다)');
const w7 = HE.findWrap(r6, 'L');
const a7 = { px:0.1, py:-0.2, pz:0.05, rot:0.3, rx:-0.2, ry:0.1, sc:1.2, scx:1.2, scy:0.9, scz:1.1 };
HE.applyAdj(w7, a7); const b7 = HE.readAdj(w7);
chk(['px','py','pz','rot','rx','ry','scx','scy','scz'].every(k => near(b7[k], a7[k], 1e-6)), 'readAdj = applyAdj 의 역함수(기즈모 → 조정값)');

say('── 5. 배선');
const HTML = SRC['desk-companion-prototype.html'];
const iH = HTML.indexOf('<script src="parts/human-ear.js">'), iApp = HTML.indexOf('<script src="parts/app.js">');
chk(iH > 0 && iH < iApp, 'html — human-ear.js 가 app.js 보다 먼저');
chk(/\nwindow\.parseAnimalEar=_parseEar;/.test(A), 'animal.js 가 귀 파서(parseAnimalEar)를 내준다 — 파싱 캐시 공유');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
