/* ═══ 🧍 sim-rest-pose.js — 기본 자세로 재기(character/rest-pose.js · app.js fitModel · wardrobe.js 미리보기 카메라) ═══
   [왜] B-1109-9 — 파츠 보관함(T)을 닫으면 fitModel 이 졸기 · 춤 · 눕기 자세 그대로 재서 그 박스만큼 캐릭터가 뜬 채 남았고,
        미리보기 카메라는 리깅 파츠까지 통째로 재서(원본 박스가 몇 배) 캐릭터가 안 보였다.
   ・1절: 실제 three · 실제 몸 박스 규칙(body-measure · char-measure)으로 — 자세 때문에 발밑 깊이가 생겨도 enter 안에서는 0 ·
          bodyWrap 눕힘도 0 · leave 뒤 지금 자세 그대로 · 기본 자세는 처음 본 모델에서 한 번(다시 enter 해도 같은 것) · 새 모델은 새로
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

/* 좌석 하나 — group → bodyWrap → gltfRoot → 엉덩이 뼈(y 0.5) → 다리 메시(뼈 아래 0.5 길이). 기본 자세에서 다리 끝이 바닥(0)에 닿는다. */
function rig(){
  const group = new THREE.Group(), bodyWrap = new THREE.Group(), root = new THREE.Group();
  const hip = new THREE.Bone(); hip.position.set(0, 0.5, 0);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), new THREE.MeshBasicMaterial());
  leg.position.set(0, -0.25, 0);
  hip.add(leg); root.add(hip); bodyWrap.add(root); group.add(bodyWrap);
  group.updateWorldMatrix(true, true);
  return { group, bodyWrap, gltfRoot: root, hip };
}
const depth = (s) => { s.group.updateWorldMatrix(true, true); return cm.measureUnderfootDepth(s.gltfRoot); };

function behave(src){
  const R = loadWin(src, 'TwRestPose').createRestPose(), r = {};
  const s = rig();
  r.firstRest = R.restOf(s.gltfRoot).length === 1;                 // 기본 자세를 처음 봤을 때 잰다(뼈 하나)
  s.hip.rotation.x = 0.4;                                           // 졸기 · 춤 같은 자세 — 뼈가 돌고
  s.hip.position.y = 0.3;                                           // 엉덩이가 내려가 다리 끝이 바닥 아래로
  const posedQ = s.hip.quaternion.clone(), posedY = s.hip.position.y;
  r.posedDeep = depth(s) > 0.05;                                    // 그대로 재면 발밑 깊이가 생긴다(= 뜨는 양)
  let t = R.enter(s);
  r.inRest = depth(s) === 0;
  R.leave(t);
  r.back = s.hip.quaternion.equals(posedQ) && s.hip.position.y === posedY;
  t = R.enter(s); r.again = depth(s) === 0; R.leave(t);              // 두 번째도 처음 기억한 기본 자세
  s.bodyWrap.rotation.x = -1.5;                                     // 누워 떼쓰기
  t = R.enter(s); r.lieZero = s.bodyWrap.rotation.x === 0; R.leave(t);
  r.lieBack = s.bodyWrap.rotation.x === -1.5;
  const s2 = rig(); s2.hip.rotation.x = 0.3; R.restOf(s2.gltfRoot);  // 새 모델은 새로 기억한다(다른 모델의 자세를 안 씀)
  r.perRoot = R.restOf(s2.gltfRoot)[0].o === s2.hip && R.restOf(s.gltfRoot)[0].o === s.hip;
  r.empty = R.enter(null) === null && R.enter({}) === null && (R.leave(null), true);
  return r;
}

say('── 1. 동작 — 실제 three · 실제 몸 박스 규칙');
const b = behave(MOD);
chk(b.firstRest, '  처음 본 모델의 뼈 자세를 기본으로 기억한다');
chk(b.posedDeep, '  (전제) 지금 자세 그대로 재면 발밑 깊이가 생긴다 — 이 양만큼 캐릭터가 떴다');
chk(b.inRest, '★ enter 안에서는 기본 자세라 발밑 깊이 0');
chk(b.back, '★ leave 뒤에는 지금 자세(뼈 회전 · 위치) 그대로');
chk(b.again, '  다시 enter 해도 처음 기억한 기본 자세(지금 자세를 기본으로 덮지 않는다)');
chk(b.lieZero && b.lieBack, '  누운 bodyWrap 회전도 재는 동안만 0 · 뒤에 되돌린다');
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
chk(!behave(MOD.replace('t.now.forEach(put);', '')).back, 'leave 가 자세를 안 되돌리면 위 «leave 뒤 그대로» 가 빨강');
chk(!behave(MOD.replace('if(!root.userData[KEY]){', 'if(true){')).inRest, '기본 자세를 매번 새로 재면(지금 자세를 기본으로) 위 ★ 가 빨강');
chk(!wired(SRC.replace('const _rest = restPoseMod.enter(seat);', 'const _rest = null;')), 'fitModel 에서 enter 를 빼면 위 2절 ★ 가 빨강');
chk(!camOk(WD.replace('let box=measureCharBox(g);', 'let box=new THREE.Box3().setFromObject(g);')), '카메라를 통째로 재면 위 2절 ★ 가 빨강');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
