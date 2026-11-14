/* ═══ 🧍 sim-rest-pose.js — 기본 자세로 재기(character/rest-pose.js · app.js fitModel · wardrobe.js 미리보기 카메라) ═══
   [왜] B-1109-9 — 다시 맞출 때(fitModel) 누워 떼쓰기 · 뼈에 붙은 리깅 안 된 파츠의 자세가 높이에 들어갈 수 있었고(막는다),
        미리보기 카메라는 리깅 파츠까지 통째로 재서(원본 박스가 몇 배) 캐릭터가 안 보였다. 제보의 공중부양 자체는 fit-watch.js 경고로 원인을 찾는다.
   ・1절: 진짜 사람 몸(base-glb.js) · 실제 몸 박스 규칙으로 — 누워 떼쓰기 · 뼈에 붙은 리깅 안 된 파츠가 enter 안에서 기본 자세 값 ·
          leave 뒤 그대로 · 기본 자세는 처음 본 모델에서 한 번 · 새 모델은 새로 · (사실) 스키닝 몸은 뼈 자세만으로는 안 뜬다
   ・2절: 배선 — fitModel 이 재기 전에 enter · finally 에서 leave · 미리보기 카메라는 measureCharBox · html · smoke 에 실림
   ・3절: 깨 보기
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');
const { joinRenderer } = require('./sim-renderer-src.js');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const pick = (list) => list.map((f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean) || null;
const at = (name, dirs) => dirs.map((d) => path.join(d, name));
const D = ['.', 'character', 'parts/character', 'app/parts/character', '../apps/desktop/app/parts/character'];
const MOD = pick(at('rest-pose.js', D)), BM = pick(at('body-measure.js', D)), CM = pick(at('char-measure.js', D));
const WD = pick(at('wardrobe.js', D));
const APP = pick(['app.js', 'parts/app.js', 'app/parts/app.js', '../apps/desktop/app/parts/app.js']);
const HTML = pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html', '../apps/desktop/app/desk-companion-prototype.html']);
const tp = ['vendor/three/three.min.js', 'three.min.js', 'app/vendor/three/three.min.js', '../apps/desktop/app/vendor/three/three.min.js'].find((p) => fs.existsSync(p));
for(const [n, v] of [['rest-pose.js', MOD], ['body-measure.js', BM], ['char-measure.js', CM], ['wardrobe.js', WD], ['app.js', APP], ['html', HTML], ['three', tp]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const THREE = require(path.resolve(tp));
const loadWin = (src, name, extra) => { const w = {}; new Function('window', 'module', 'THREE', src)(w, undefined, THREE); return w[name]; };
const bm = loadWin(BM, 'TwBodyMeasure').createBodyMeasure({});
const cm = loadWin(CM, 'TwCharMeasure').createCharMeasure({ measureBodyBox: (...a) => bm.measureBodyBox(...a) });

/* 진짜 사람 몸(base-glb.js)을 앱과 같은 사슬(group → bodyWrap → wrap → 모델)에 세운다.
   ⚠️ 몸 메시는 모두 스키닝 메시라 r128 박스는 스키닝 전 도형으로 잰다 — 뼈 자세만으로는 박스가 안 바뀐다(아래 «뼈만» 줄).
     이 수정이 막는 것은 둘이다: ① 누워 떼쓰기(bodyWrap 회전) 중에 다시 맞추기 ② 뼈에 직접 붙은(리깅 안 된) 파츠가 그 자세에서 발 아래로. */
const GLTF = pick(['vendor/three/GLTFLoader.js', 'GLTFLoader.js', 'app/vendor/three/GLTFLoader.js', '../apps/desktop/app/vendor/three/GLTFLoader.js']);
const SKU = pick(['vendor/three/SkeletonUtils.js', 'SkeletonUtils.js', 'app/vendor/three/SkeletonUtils.js', '../apps/desktop/app/vendor/three/SkeletonUtils.js']);
const BASE = pick(['base-glb.js', 'parts/base-glb.js', 'app/parts/base-glb.js', '../apps/desktop/app/parts/base-glb.js']);
for(const [n, v] of [['GLTFLoader.js', GLTF], ['SkeletonUtils.js', SKU], ['base-glb.js', BASE]]){ if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); } }
global.self = global;
new Function('THREE', GLTF)(THREE); new Function('THREE', SKU)(THREE);
THREE.TextureLoader.prototype.load = function(){ return new THREE.Texture(); };   // 그림은 안 쓴다 — 박스만 잰다
const bw0 = {}; new Function('window', BASE)(bw0);
const glbBuf = Buffer.from(bw0.BASE_GLB_B64, 'base64');
const parsed = new Promise((ok, no) => new THREE.GLTFLoader().parse(glbBuf.buffer.slice(glbBuf.byteOffset, glbBuf.byteOffset + glbBuf.length), '', ok, no));

function body(gltf){
  const root = THREE.SkeletonUtils.clone(gltf.scene);
  const group = new THREE.Group(), bodyWrap = new THREE.Group(), wrap = new THREE.Group();
  wrap.add(root); bodyWrap.add(wrap); group.add(bodyWrap);
  const bones = []; root.traverse((o) => { if(o.isBone) bones.push(o); });
  return { group, bodyWrap, gltfRoot: wrap, bones };
}
const take = (s) => { s.group.updateWorldMatrix(true, true); const b = cm.measureCharBox(s.gltfRoot); return { lo: b.min.y, hi: b.max.y, foot: cm.charFootFix(b), under: cm.measureUnderfootDepth(s.gltfRoot) }; };
const same = (a, b) => ['lo', 'hi', 'foot', 'under'].every((k) => Math.abs(a[k] - b[k]) < 1e-6);

async function behave(src){
  const g = await parsed;
  const R = loadWin(src, 'TwRestPose').createRestPose(), r = {};
  const s = body(g);
  r.firstRest = R.restOf(s.gltfRoot).length === s.bones.length && s.bones.length > 0;
  const rest = take(s);
  s.bones.forEach((b) => { b.rotation.x += 0.8; b.position.y -= 0.1; });
  r.bonesOnly = same(take(s), rest);                                  // 스키닝 몸은 뼈 자세가 박스에 안 들어간다(사실 확인)
  s.bodyWrap.rotation.x = -1.5;                                       // 누워 떼쓰기
  const lying = take(s);
  r.lieDiffers = !same(lying, rest) && lying.under > 0.1;             // (전제) 누운 채 재면 키 · 발밑 깊이가 바뀐다
  let t = R.enter(s); r.lieRest = same(take(s), rest); R.leave(t);
  r.lieBack = s.bodyWrap.rotation.x === -1.5;
  s.bodyWrap.rotation.x = 0;
  /* 다리 뼈에 리깅 안 된 파츠(꾸미기 wrapper) — 뼈 자세에 따라 발 아래로 내려간다 */
  const leg = s.bones.find((b) => /leg/i.test(b.name)) || s.bones[0];
  const part = new THREE.Group(); part.userData.__twPartWrap = true;
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial());
  shoe.position.set(0, -0.9, 0); part.add(shoe); leg.add(part);
  const partRest = take(s).under;
  leg.rotation.x += 1.2; leg.position.y -= 0.5;                      // 앉기 · 떼쓰기 다리
  const posedQ = leg.quaternion.clone(), posedY = leg.position.y;
  r.partDeep = take(s).under > partRest + 0.05;                       // (전제) 그대로 재면 발밑 깊이 = 뜨는 양
  t = R.enter(s); r.partRest = Math.abs(take(s).under - partRest) < 1e-6; R.leave(t);
  r.back = leg.quaternion.equals(posedQ) && leg.position.y === posedY;
  t = R.enter(s); r.again = Math.abs(take(s).under - partRest) < 1e-6; R.leave(t);
  const s2 = body(g);
  r.perRoot = R.restOf(s2.gltfRoot)[0].o === s2.bones[0] && R.restOf(s.gltfRoot)[0].o === s.bones[0];
  r.empty = R.enter(null) === null && R.enter({}) === null && (R.leave(null), true);
  return r;
}

(async () => {
say('── 1. 동작 — 진짜 사람 몸(base-glb.js) · 실제 몸 박스 규칙');
const b = await behave(MOD);
chk(b.firstRest, '  처음 본 모델의 뼈 자세를 기본으로 기억한다');
chk(b.bonesOnly, '  (사실) 스키닝 몸은 뼈 자세만으로는 박스가 안 바뀐다 — 졸기 · 춤 자체로는 뜨지 않는다');
chk(b.lieDiffers, '  (전제) 누운 채(bodyWrap -1.5) 재면 키 · 발밑 깊이가 바뀐다');
chk(b.lieRest && b.lieBack, '★ 누워 떼쓰기 중에 다시 맞춰도 enter 안에서는 기본 자세 값 · leave 뒤 다시 누움');
chk(b.partDeep, '  (전제) 다리 뼈에 붙은 리깅 안 된 파츠가 그 자세로 발 아래로 내려가면 깊이가 생긴다');
chk(b.partRest, '★ enter 안에서는 그 파츠도 기본 자세 자리 — 발밑 깊이가 기본 자세 값');
chk(b.back, '  leave 뒤에는 지금 자세(뼈 회전 · 위치) 그대로');
chk(b.again, '  다시 enter 해도 처음 기억한 기본 자세');
chk(b.perRoot, '  모델마다 따로 기억한다');
chk(b.empty, '  좌석 · 모델이 없으면 null · leave(null) 은 아무 일 없음');

say('── 2. 배선');
const SRC = joinRenderer(APP);
const cut = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let d = 0; for(let k = src.indexOf('{', i); k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
function wired(app){
  const f = cut(app, 'fitModel');
  const iE = f.indexOf('const _rest = restPoseMod.enter(seat);'), iT = f.indexOf('try{', iE), iM = f.indexOf('measureCharBox(m)'),
        iL = f.indexOf('}finally{ restPoseMod.leave(_rest); }'), iU = f.indexOf('measureUnderfootDepth(m)'), iR = f.indexOf('seat.rig.position.copy(sR)');
  return /const restPoseMod = TwRestPose\.createRestPose\(\);/.test(app) && iE > 0 && iT > iE && iM > iT && iU > iM && iL > iU && iR > iL;
}
chk(wired(SRC), '★ fitModel — 재기 전에 enter · 크기 · 발바닥 · 발밑 깊이를 잰 뒤 finally 에서 leave · 그다음 rig 되돌리기');
const camOk = (src) => { const f = cut(src, 'refreshWdPreviewChar'); return /let box=measureCharBox\(g\);/.test(f) && !/const box=new THREE\.Box3\(\)\.setFromObject\(g\);/.test(f); };
chk(camOk(WD), '★ 미리보기 카메라는 맨 몸(measureCharBox)으로 — 파츠까지 통째로 재지 않는다');
chk(/parts\/character\/rest-pose\.js[\s\S]*parts\/app\.js/.test(HTML.slice(HTML.indexOf('rest-pose.js') - 40)), '  html 에 app.js 보다 먼저 싣는다(smoke 는 html 목록을 그대로 싣는다)');

say('── 3. 깨 보기');
chk(!(await behave(MOD.replace('t.now.forEach(put);', ''))).back, 'leave 가 자세를 안 되돌리면 위 «leave 뒤 그대로» 가 빨강');
chk(!(await behave(MOD.replace('if(!root.userData[KEY]){', 'if(true){'))).partRest, '기본 자세를 매번 새로 재면(지금 자세를 기본으로) 위 ★ 가 빨강');
chk(!(await behave(MOD.replace('if(bw) bw.rotation.set(0, 0, 0);', ''))).lieRest, '눕힘 되돌리기를 빼면 위 «누워 떼쓰기» ★ 가 빨강');
chk(!wired(SRC.replace('const _rest = restPoseMod.enter(seat);', 'const _rest = null;')), 'fitModel 에서 enter 를 빼면 위 2절 ★ 가 빨강');
chk(!camOk(WD.replace('let box=measureCharBox(g);', 'let box=new THREE.Box3().setFromObject(g);')), '카메라를 통째로 재면 위 2절 ★ 가 빨강');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch((e) => { chk(false, '던짐 — ' + (e && e.stack || e)); process.exit(1); });
