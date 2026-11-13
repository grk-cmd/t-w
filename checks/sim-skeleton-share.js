/* ═══ 🦴 sim-skeleton-share.js — 같은 뼈대는 Skeleton 하나(shared/skeleton-share.js) ═══════════════════════
   진짜 three r128 · 진짜 기본 몸 GLB(base-glb.js) · 동물 GLB(animal-glb.js)로 «옛(메시마다 Skeleton)» 과 «새(함께 씀)» 를 짓고
   같은 자세에서 견준다. WebGL 없이 — 셰이더가 쓰는 뼈 행렬(skeleton.update 의 boneMatrices)과 꼭짓점 스킨 자리
   (광선 판정이 쓰는 boneTransform)를 JS 로 셈해 견준다. 그림 픽셀 대조는 PR 본문(헤드리스 크롬)에.
   ・1절: sameRig 경계 — 같은 객체 · 뼈 순서 · 길이 · 역행렬 한 칸 · -0 · NaN · 빈 값
   ・2절: 기본 몸 — app.js instantiateBase 를 그대로 떼어 돌려 메시 넷이 Skeleton 하나 · 뼈 행렬 · 스킨 자리가 옛과 같다
   ・3절: 리깅 파츠 — 역행렬이 같으면 몸과 함께(bindMatrix 가 달라도) · 다르면 따로(파츠 메시끼리만) · 입양 뼈 파츠는 따로
   ・4절: 한 장의 뼈대 갱신 수(three 의 skeleton.frame 거르기 그대로) · 숨긴 메시
   ・5절: 동물 몸 · 스티커사진식 복제 뒤 함께 쓰기
   ・6절: 깨 보기 — 역행렬 견주기를 뺀 판은 다른 파츠까지 합쳐 스킨 자리가 달라진다(이 검사가 빨강을 낸다)
   ・7절: 배선 — html 싣는 순서 · smoke PRELOAD
   [실행] skeleton-share.js · app.js · base-glb.js · animal-glb.js · desk-companion-prototype.html · smoke.js 가 있는 폴더에서.
     three 는 vendor/three/ 의 three.min.js · GLTFLoader.js · SkeletonUtils.js 를 쓴다. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['skeleton-share.js', 'app.js', 'base-glb.js', 'animal-glb.js', 'desk-companion-prototype.html', 'smoke.js'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const vendor = ['vendor/three', '.'].find(d => fs.existsSync(path.join(d, 'three.min.js')) && fs.existsSync(path.join(d, 'GLTFLoader.js')) && fs.existsSync(path.join(d, 'SkeletonUtils.js')));
if(!vendor){ say('  ? 원본 못 찾음 — three.min.js · GLTFLoader.js · SkeletonUtils.js'); process.exit(2); }
const THREE = require(path.resolve(vendor, 'three.min.js'));
new Function('THREE', fs.readFileSync(path.join(vendor, 'GLTFLoader.js'), 'utf8'))(THREE);
new Function('THREE', fs.readFileSync(path.join(vendor, 'SkeletonUtils.js'), 'utf8'))(THREE);

const loadShare = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };
const SS = loadShare(SRC['skeleton-share.js']);
const win = {};
new Function('window', 'module', SRC['base-glb.js'])(win);
new Function('window', 'module', SRC['animal-glb.js'])(win);
const parse = (b64) => new Promise((res, rej) => {
  const b = Buffer.from(b64, 'base64');
  new THREE.GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '', g => res(g.scene), rej);
});
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };

const skinned = (root) => SS.skinnedMeshesOf(root);
const skelCount = (root) => new Set(skinned(root).map(m => m.skeleton)).size;
/* 같은 자세 — 뼈 이름에서 정한 각도(옛 · 새가 똑같이) */
function pose(root, t){
  root.traverse(o => { if(!o.isBone) return; const h = o.name.length * 0.37;
    o.rotation.set(Math.sin(t * 1.3 + h) * 0.4, Math.cos(t * 0.9 + h) * 0.3, Math.sin(t * 0.7 + h * 2) * 0.25); });
  root.updateMatrixWorld(true);
}
/* 셰이더가 받는 뼈 행렬 — 메시마다(함께 쓰면 같은 배열) */
function boneMats(root){ const out = []; skinned(root).forEach(m => { m.skeleton.update(); out.push(Array.from(m.skeleton.boneMatrices.subarray(0, m.skeleton.bones.length * 16))); }); return out; }
/* 광선 판정이 쓰는 스킨 자리(boneTransform) — 메시마다 꼭짓점 전부, 월드 좌표 */
function skinPos(root){
  const out = [], v = new THREE.Vector3();
  skinned(root).forEach(m => { const n = m.geometry.attributes.position.count; const a = new Float64Array(n * 3);
    for(let i = 0; i < n; i++){ m.boneTransform(i, v); v.applyMatrix4(m.matrixWorld); a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; }
    out.push(a); });
  return out;
}
const maxDiff = (A, B) => { let d = 0; if(A.length !== B.length) return Infinity;
  for(let i = 0; i < A.length; i++){ if(A[i].length !== B[i].length) return Infinity; for(let k = 0; k < A[i].length; k++){ const e = Math.abs(A[i][k] - B[i][k]); if(!(e <= d)) d = e; } } return d; };

/* app.js equipPartOnSeat 의 리깅 다시 묶기 그대로(캐릭터 뼈로 갈아 끼우고 역행렬은 파츠 값) + xf 를 bindMatrix 에 굽기 */
function equipRigged(S, charRoot, partScene, keep, share, xf){
  const charBones = {}; charRoot.traverse(o => { if(o.isBone && !o.userData._partAdopted && !charBones[o.name]) charBones[o.name] = o; });
  const obj = THREE.SkeletonUtils.clone(partScene);
  const drop = []; obj.traverse(o => { if(o.isSkinnedMesh && keep.indexOf(o.name) < 0) drop.push(o); });
  drop.forEach(o => o.parent.remove(o));
  const sms = skinned(obj);
  sms.forEach(sm => {
    sm.userData._origBind = sm.bindMatrix.clone();
    const src = sm.skeleton;
    const mapped = src.bones.map(b => {
      if(charBones[b.name]) return charBones[b.name];
      let host = null, p = b.parent;
      while(p){ if(p.isBone && charBones[p.name]){ host = charBones[p.name]; break; } p = p.parent; }
      (host || charBones.spine).add(b); b.userData._partAdopted = true; return b;
    });
    sm.bind(new THREE.Skeleton(mapped, src.boneInverses.map(m => m.clone())), sm.bindMatrix);
    if(xf) sm.bindMatrix.copy(xf).multiply(sm.userData._origBind);
  });
  if(share) S.shareSkeletons(sms, S.skinnedMeshesOf(charRoot));
  const wrap = new THREE.Group(); wrap.name = '__partWrap_x'; wrap.add(obj); charRoot.add(wrap);
  return wrap;
}

(async () => {
const BASE = await parse(win.BASE_GLB_B64);
const ANIMAL = await parse(win.ANIMAL_GLB_B64);
const PART_SAME = await parse(win.BASE_GLB_B64);
const PART_DIFF = await parse(win.BASE_GLB_B64);
const PART_ADOPT = await parse(win.BASE_GLB_B64);
{ // 따로 저작한 파츠 — 역행렬 값이 몸과 조금 다르다(메시 둘은 같은 값)
  const T = new THREE.Matrix4().makeTranslation(0, 0.03, 0.01);
  PART_DIFF.traverse(o => { if(o.isSkinnedMesh) o.skeleton.boneInverses.forEach(m => m.premultiply(T)); });
}
PART_ADOPT.traverse(o => { if(o.isBone && o.name === 'ear_L') o.name = 'tail_x'; });   // 캐릭터에 없는 뼈 → 입양

say('── 1. sameRig 경계');
{
  const b = [new THREE.Bone(), new THREE.Bone()];
  const inv = () => [new THREE.Matrix4().makeTranslation(1, 2, 3), new THREE.Matrix4()];
  const s1 = new THREE.Skeleton(b, inv()), s2 = new THREE.Skeleton(b, inv());
  chk(SS.sameRig(s1, s1), '같은 객체 → 같음');
  chk(SS.sameRig(s1, s2), '같은 뼈 · 같은 값의 다른 역행렬 객체 → 같음');
  chk(!SS.sameRig(s1, new THREE.Skeleton([b[1], b[0]], inv())), '뼈 순서가 다르면 → 다름');
  chk(!SS.sameRig(s1, new THREE.Skeleton([b[0], new THREE.Bone()], inv())), '이름 없이 다른 뼈 객체면 → 다름');
  chk(!SS.sameRig(s1, new THREE.Skeleton([b[0]], [inv()[0]])), '뼈 수가 다르면 → 다름');
  const i3 = inv(); i3[1].elements[15] = 1 + 1e-12;
  chk(!SS.sameRig(s1, new THREE.Skeleton(b, i3)), '역행렬 한 칸이 1e-12 만 달라도 → 다름');
  const i4 = inv(); i4[1].elements[1] = -0;
  chk(!SS.sameRig(s1, new THREE.Skeleton(b, i4)), '-0 과 0 도 가른다(비트가 같은 값만)');
  const i5 = inv(); i5[0].elements[0] = NaN; const i6 = inv(); i6[0].elements[0] = NaN;
  chk(SS.sameRig(new THREE.Skeleton(b, i5), new THREE.Skeleton(b, i6)), 'NaN 끼리는 같은 값(어차피 같은 결과)');
  chk(!SS.sameRig(s1, null) && !SS.sameRig(null, s1) && !SS.sameRig({}, s1), '빈 값 → 다름');
  chk(SS.shareSkeletons([]) === 0 && SS.shareSkeletons(null) === 0 && SS.shareSkeletons([null, {}]) === 0, '빈 목록 · 스킨 메시 아님 → 바꾼 것 0');
  chk(SS.skinnedMeshesOf(null).length === 0, 'skinnedMeshesOf(null) → 빈 목록');
}

say('── 2. 기본 몸 — app.js instantiateBase 그대로');
const instSrc = grab(SRC['app.js'], 'instantiateBase');
chk(!!instSrc, 'app.js 에서 instantiateBase 를 찾았다');
const mkInst = (S) => new Function('THREE', 'BASE_SCENE', 'skelShare', '_fixGlbMatLighting', instSrc + '\nreturn instantiateBase;')(THREE, BASE, S, () => {});
const noShare = { shareSkeletons: () => 0, skinnedMeshesOf: SS.skinnedMeshesOf };   // 옛 동작(함께 쓰지 않음)
const oldInst = mkInst(noShare)(), newInst = mkInst(SS)();
chk(skinned(newInst.root).length === 4, '기본 몸 스킨 메시 4개(face · hat · lower · upper) — ' + skinned(newInst.root).map(m => m.name).join(','));
chk(skelCount(oldInst.root) === 4 && skelCount(newInst.root) === 1, `Skeleton 수 옛 ${skelCount(oldInst.root)} → 새 ${skelCount(newInst.root)}`);
chk(!!(newInst.faceMesh && newInst.upMesh && newInst.loMesh && newInst.hatMesh), '얼굴 · 상의 · 하의 · 모자 메시 분류는 그대로');
chk(skelCount(BASE) === 4 && skinned(BASE).every(m => m.skeleton.bones[0].parent && !m.skeleton.bones.some(b => skinned(newInst.root)[0].skeleton.bones.includes(b))),
  '원본 GLB 장면의 Skeleton 은 건드리지 않는다(넷 그대로 · 복제 뼈와 안 섞임)');
for(const t of [0, 0.37, 1.9]){
  pose(oldInst.root, t); pose(newInst.root, t);
  chk(maxDiff(boneMats(oldInst.root), boneMats(newInst.root)) === 0, `t=${t} 뼈 행렬이 옛과 비트까지 같다`);
  chk(maxDiff(skinPos(oldInst.root), skinPos(newInst.root)) === 0, `t=${t} 스킨 자리(광선 판정)가 옛과 같다`);
}

say('── 3. 리깅 파츠');
const xf = new THREE.Matrix4().compose(new THREE.Vector3(0.02, 0.05, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.2, 0.1)), new THREE.Vector3(1.1, 1.1, 1.1));
function seatWithParts(S, share){
  const body = mkInst(share ? SS : noShare)().root;
  body.updateMatrixWorld(true);
  const same = equipRigged(S, body, PART_SAME, ['upper', 'lower'], share, xf);
  const diff = equipRigged(S, body, PART_DIFF, ['upper', 'hat003'], share, null);
  const adopt = equipRigged(S, body, PART_ADOPT, ['hat003', 'face'], share, null);
  return { body, same, diff, adopt };
}
const O = seatWithParts(SS, false), N = seatWithParts(SS, true);
const bodySk = skinned(N.body).find(m => !m.userData._origBind).skeleton;
chk(skinned(N.same).every(m => m.skeleton === bodySk), '역행렬이 몸과 같은 파츠 → 몸 Skeleton 과 함께');
chk(skinned(N.same).some(m => !m.bindMatrix.equals(skinned(N.body)[0].bindMatrix)), '…그 파츠의 bindMatrix(xf 굽기)는 몸과 다르다 — 그래도 함께 써도 된다(메시 것)');
chk(skinned(N.diff).every(m => m.skeleton !== bodySk) && new Set(skinned(N.diff).map(m => m.skeleton)).size === 1, '역행렬이 다른 파츠 → 몸과 따로, 파츠 메시 둘끼리만 하나');
chk(skinned(N.adopt).every(m => m.skeleton !== bodySk) && new Set(skinned(N.adopt).map(m => m.skeleton)).size === 1, '입양 뼈가 든 파츠 → 몸과 따로, 파츠 메시끼리만 하나');
chk(skelCount(O.body) === 10 && skelCount(N.body) === 3, `좌석 Skeleton 수 옛 ${skelCount(O.body)} → 새 ${skelCount(N.body)}`);
for(const t of [0, 0.37, 1.9, 4.25]){
  pose(O.body, t); pose(N.body, t);
  chk(maxDiff(boneMats(O.body), boneMats(N.body)) === 0, `t=${t} 몸 + 파츠 셋의 뼈 행렬이 옛과 같다`);
  chk(maxDiff(skinPos(O.body), skinPos(N.body)) === 0, `t=${t} 몸 + 파츠 셋의 스킨 자리가 옛과 같다`);
}
{ // 떼고 붙이기 — 함께 쓰던 파츠를 떼고 다시 붙여도 같다
  [O, N].forEach((s, i) => { s.body.remove(s.same); s.same = equipRigged(SS, s.body, PART_SAME, ['lower'], i === 1, null); });
  pose(O.body, 2.2); pose(N.body, 2.2);
  chk(maxDiff(skinPos(O.body), skinPos(N.body)) === 0 && skinned(N.same)[0].skeleton === bodySk, '떼고 다시 붙여도 스킨 자리가 같고 몸 Skeleton 과 함께');
}

say('── 4. 한 장의 뼈대 갱신 수');
/* three r128 projectObject: 보이는 스킨 메시마다 skeleton.frame !== render.frame 이면 update — 그 거르기를 그대로 */
function frameUpdates(root, frame){
  let n = 0;
  (function walk(o){ if(!o.visible) return;
    if(o.isSkinnedMesh && o.skeleton.frame !== frame){ o.skeleton.update(); o.skeleton.frame = frame; n++; }
    o.children.forEach(walk); })(root);
  return n;
}
chk(/skeleton\.frame!==\w+\.render\.frame&&\(\w+\.skeleton\.update\(\),\w+\.skeleton\.frame=\w+\.render\.frame\)/.test(fs.readFileSync(path.join(vendor, 'three.min.js'), 'utf8')),
  'three.min.js 가 Skeleton 객체마다 한 장에 한 번만 update 한다(아래 셈의 전제)');
const uo = frameUpdates(O.body, 1), un = frameUpdates(N.body, 1);
chk(uo === 9 && un === 3, `좌석(몸 4 + 파츠 셋) 한 장 update 옛 ${uo} → 새 ${un}`);
{ // 옷 숨김 — 몸 상의를 숨겨도 같은 Skeleton 을 보이는 메시가 갱신한다
  const up = (r) => skinned(r).find(m => m.name === 'upper' && !m.userData._origBind);
  up(O.body).visible = false; up(N.body).visible = false;
  pose(O.body, 3.3); pose(N.body, 3.3);
  const a = frameUpdates(O.body, 2), b = frameUpdates(N.body, 2);
  const vis = (r) => skinned(r).filter(m => { for(let o = m; o; o = o.parent) if(!o.visible) return false; return true; });
  const bm = (r) => vis(r).map(m => Array.from(m.skeleton.boneMatrices.subarray(0, m.skeleton.bones.length * 16)));
  chk(a === 8 && b === 3 && maxDiff(bm(O.body), bm(N.body)) === 0, `상의 숨김 — update 옛 ${a} → 새 ${b} · 보이는 메시의 뼈 행렬 같음`);
}

say('── 5. 동물 몸 · 스티커사진식 복제');
{
  const ao = THREE.SkeletonUtils.clone(ANIMAL), an = THREE.SkeletonUtils.clone(ANIMAL);
  SS.shareSkeletons(SS.skinnedMeshesOf(an));
  chk(skelCount(ao) === 5 && skelCount(an) === 1, `동물 몸(body + face1~4) Skeleton 옛 ${skelCount(ao)} → 새 ${skelCount(an)}`);
  pose(ao, 1.1); pose(an, 1.1);
  chk(maxDiff(boneMats(ao), boneMats(an)) === 0 && maxDiff(skinPos(ao), skinPos(an)) === 0, '동물 — 뼈 행렬 · 스킨 자리 같음');
  // 스티커사진: 방 좌석(함께 쓰는 중)을 통째 복제 → 복제가 메시마다 다시 가른다 → 다시 함께
  const wrapN = new THREE.Group(); wrapN.add(N.body);
  pose(N.body, 0.8);
  const cl = THREE.SkeletonUtils.clone(wrapN);
  const split = skelCount(cl);
  SS.shareSkeletons(SS.skinnedMeshesOf(cl));
  cl.updateMatrixWorld(true);
  chk(split > 3 && skelCount(cl) === 3, `스티커사진 복제 Skeleton 복제 직후 ${split} → 함께 쓴 뒤 ${skelCount(cl)}`);
  chk(maxDiff(skinPos(wrapN), skinPos(cl)) < 1e-6, '복제본의 스킨 자리가 원본 좌석과 같다');
  chk(skinned(cl).every(m => m.skeleton.bones.every(b => { let p = b; while(p.parent) p = p.parent; return p === cl; })), '복제본 Skeleton 은 복제본 뼈만 본다(원본과 안 섞임)');
}

say('── 6. 깨 보기');
{ // 역행렬 견주기를 뺀 판 — 뼈만 같으면 합친다
  const broken = SRC['skeleton-share.js'].replace(/for\(let i = 0; i < n; i\+\+\)\{\n\s*const x = a\.boneInverses[\s\S]*?\n  \}\n/, '');
  chk(broken !== SRC['skeleton-share.js'], '깨 보기 판을 만들었다(역행렬 견주기 뺌)');
  const BS = loadShare(broken);
  const bo = seatWithParts(BS, false), bn = seatWithParts(BS, true);
  const bodySkB = skinned(bn.body).find(m => !m.userData._origBind).skeleton;
  chk(skinned(bn.diff).every(m => m.skeleton === bodySkB), '…깨진 판은 역행렬이 다른 파츠까지 몸과 합친다');
  pose(bo.body, 0.37); pose(bn.body, 0.37);
  const d = maxDiff(skinPos(bo.body), skinPos(bn.body));
  chk(d > 1e-3, `…그러면 스킨 자리가 옛과 달라진다(최대 ${d.toFixed(4)}) — 2 · 3절의 대조가 빨강을 낸다`);
  // 뼈 순서 견주기를 뺀 판
  const broken2 = SRC['skeleton-share.js'].replace('for(let i = 0; i < n; i++){ if(a.bones[i] !== b.bones[i]) return false; }', '');
  chk(broken2 !== SRC['skeleton-share.js'] && loadShare(broken2).sameRig(new THREE.Skeleton([new THREE.Bone()], [new THREE.Matrix4()]), new THREE.Skeleton([new THREE.Bone()], [new THREE.Matrix4()])),
    '뼈 객체 견주기를 뺀 판은 남의 뼈끼리 «같음» 이라 한다(1절이 빨강)');
}

say('── 7. 배선');
{
  const H = SRC['desk-companion-prototype.html'];
  const at = (f) => H.indexOf('<script src="' + f + '"');
  const iS = at('parts/shared/skeleton-share.js');
  chk(iS > at('vendor/three/SkeletonUtils.js') && at('vendor/three/SkeletonUtils.js') > 0, 'html — skeleton-share.js 가 SkeletonUtils.js 뒤');
  chk(iS > 0 && ['parts/app.js', 'parts/character/animal.js', 'parts/purikura/purikura-ui.js'].every(f => at(f) > iS), 'html — app.js · animal.js · purikura-ui.js 보다 먼저');
  chk(/PRELOAD\.push\('skeleton-share\.js'\);/.test(SRC['smoke.js']), 'smoke.js 가 app.js 앞에 싣는다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 예외 ' + (e && e.stack || e)); process.exit(1); });
