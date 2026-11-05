/* ═══ 🪑 sim-seat-extent.js — 좌석 겉면 자리(room/seat-extent.js)를 실제 three 로 잰다 (#755) ═══
   ・1절: 재는 것 — 책상 몸 · 몸 · 파츠는 세고, 숨은 메시 · 책상 위 아이템(deskAnchor)은 안 센다 · 치우친 책상은 왼쪽 · 오른쪽이 다르다
   ・2절: 자세 — 뼈대 메시는 지금 자세의 점으로(처음 저장된 팔 벌린 자세가 아니다) · 날기 · 끌기(rig)는 잴 때만 되돌리고 돌려놓는다
   ・3절: 기억 — 모습이 그대로면 다시 안 잰다 · 책상 크기 · 메시 목록 · 파츠 자리가 바뀌면 다시 잰다 · 뼈대만 움직이면 그대로
   ・4절: 경계 — 잴 것이 없으면 기본 반폭 · 좌석이 없어도 던지지 않는다
   ・5절: 일부러 깨 보기 — 모듈 글을 망가뜨려 위 판정이 빨강이 되는지
   [실행] seat-extent.js 와 three.min.js(vendor/three) 가 있는 폴더에서(러너 스테이징). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const MOD = ['seat-extent.js', 'parts/room/seat-extent.js', 'app/parts/room/seat-extent.js'].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — seat-extent.js'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'three.min.js', 'app/vendor/three/three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(require('path').resolve(threePath));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-4);

function load(src){
  const win = {};
  new Function('window', 'module', src)(win, undefined);
  return win.TwSeatExtent.createSeatExtent({ THREE });
}
const box = (w, h, d, x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h || 0.1, d || 0.1), new THREE.MeshBasicMaterial()); if(x) m.position.x = x; return m; };
/* 뼈대 메시 — 처음 저장된 자세는 팔 끝 점이 x = ±1(팔 벌림) · 몸 점은 ±0.2. 팔 뼈를 z 로 90° 돌리면 팔 끝이 위아래로 가서 가로 폭은 몸(0.2)만 남는다 */
function skinned(){
  const pos = [ -1, 0, 0,  1, 0, 0,  -0.2, 0, 0,  0.2, 0, 0 ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([1,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0], 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], 4));
  const root = new THREE.Bone(), arm = new THREE.Bone();
  root.add(arm);
  const mesh = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial());
  mesh.add(root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([root, arm]));
  return { mesh, arm };
}
/* 좌석 — group(x=3) → desk(책상 몸 폭 1.7 · 아이템 핀 deskAnchor 에 폭 6 아이템) · rig → bodyWrap → gltfRoot(뼈대 몸 · 숨은 큰 판) */
function seatOf(o){
  o = o || {};
  const group = new THREE.Group(); group.position.x = 3;
  const desk = new THREE.Group(); group.add(desk);
  desk.add(box(1.7));
  const anchor = new THREE.Group(); anchor.name = 'deskAnchor'; anchor.add(box(6)); desk.add(anchor);
  const rig = new THREE.Group(); group.add(rig);
  const bodyWrap = new THREE.Group(); rig.add(bodyWrap);
  const gltfRoot = new THREE.Group(); bodyWrap.add(gltfRoot);
  const sk = skinned(); gltfRoot.add(sk.mesh);
  if(!o.armsOut) sk.arm.rotation.z = Math.PI / 2;   // 기본은 앉은 자세(팔 내림 — 몸 폭 0.2)
  const hidden = box(9); hidden.visible = false; gltfRoot.add(hidden);
  return { group, desk, rig, bodyWrap, gltfRoot, arm: sk.arm, skin: sk.mesh, hidden, anchor };
}

say('── 1. 재는 것');
let E = load(MOD);
let s = seatOf();
let e = E.measure(s);
chk(near(e.left, 1.7 / 2) && near(e.right, 0.85), '책상 몸 폭 1.7 → 왼쪽 · 오른쪽 0.85 — 책상 위 아이템(폭 6) · 숨은 판(폭 9)은 안 센다');
s.anchor.children[0].visible = true; s.hidden.visible = true;
e = E.measure(s);
chk(near(e.left, 4.5), '  숨은 판을 보이게 하면 센다(4.5) — 숨김 판정이 실제로 갈린다');
s = seatOf(); s.desk.position.x = 0.5;
e = E.measure(s);
chk(near(e.left, 0.35) && near(e.right, 1.35), '치우친 책상(+0.5) — 왼쪽 0.35 · 오른쪽 1.35 로 따로');
s = seatOf(); s.desk.children[0].visible = false;
e = E.measure(s);
chk(near(e.left, 0.2, 1e-3) && near(e.right, 0.2, 1e-3), '책상 몸이 숨으면(책상 없음) 몸만 — 0.2');
const part = box(2.4); part.name = '__partWrap_wing'; s.gltfRoot.add(part);
e = E.measure(s);
chk(near(e.left, 1.2) && near(e.right, 1.2), '꾸미기 파츠(폭 2.4)도 겉면에 든다');

say('── 2. 자세');
s = seatOf({ armsOut: true }); s.desk.children[0].visible = false;
e = E.measure(s);
chk(near(e.left, 1, 1e-3) && near(e.right, 1, 1e-3), '팔을 벌린 자세면 팔 끝 ±1');
s.arm.rotation.z = Math.PI / 2;
e = E.measure(s);
const bindBox = new THREE.Box3().setFromObject(s.skin);
chk(near(e.left, 0.2, 1e-3) && near(e.right, 0.2, 1e-3), '뼈대 메시는 지금 자세로 — 팔을 내리면 몸 폭 0.2(처음 자세 ±1 이 아니다)');
chk(bindBox.max.x - 3 > 0.9, '  (같은 메시를 상자로 재면 처음 자세 폭 ±1 — 예전 방식이 넓게 나온 까닭)');
s.rig.position.x = 4; s.rig.rotation.z = 1.2;
e = E.measure(s);
chk(near(e.left, 0.2, 1e-3) && near(e.right, 0.2, 1e-3), '날기 · 끌기(rig 옮김 · 기울임) 중에도 앉은 자리로 잰다');
chk(s.rig.position.x === 4 && s.rig.rotation.z === 1.2, '  잰 뒤 rig 는 그대로 돌려놓는다');

say('── 3. 기억');
E = load(MOD);
s = seatOf();
const a1 = E.extentOf(s);
s.desk.children[0].geometry = new THREE.BoxGeometry(4, 0.1, 0.1);   // 모습 열쇠에 안 드는 변화(같은 메시) — 기억한 값을 쓴다
chk(E.extentOf(s) === a1, '모습이 그대로면 다시 안 잰다(같은 값)');
s.desk.scale.x = 2;
const a2 = E.extentOf(s);
chk(a2 !== a1 && near(a2.right, 4), '책상 크기가 바뀌면 다시 잰다');
s.arm.rotation.z = 0.7;
chk(E.extentOf(s) === a2, '  뼈대만 움직이면(타이핑 · 숨쉬기) 다시 안 잰다');
s.gltfRoot.add(box(1));
chk(E.extentOf(s) !== a2, '  메시가 늘면(파츠 · 책상 바뀜) 다시 잰다');
const w = new THREE.Group(); w.name = '__partWrap_hat'; w.add(box(0.5)); s.gltfRoot.add(w);
const a3 = E.extentOf(s);
w.position.x = 3;
chk(E.extentOf(s) !== a3, '  파츠 자리를 옮기면 다시 잰다');

say('── 4. 경계');
E = load(MOD);
const empty = { group: new THREE.Group(), desk: new THREE.Group(), rig: new THREE.Group(), bodyWrap: new THREE.Group() };
e = E.measure(empty);
chk(e.left === E.DEFAULT_HALF && e.right === E.DEFAULT_HALF, '잴 메시가 없으면 기본 반폭(' + E.DEFAULT_HALF + ')');
let threw = null; try{ e = E.extentOf(null); }catch(x){ threw = x; }
chk(!threw && e.left === E.DEFAULT_HALF, '좌석이 없어도 던지지 않는다');

say('── 5. 일부러 깨 보기');
function judge(src){
  const r = [];
  try{
    const X = load(src);
    let q = seatOf(); r.push(near(X.measure(q).left, 0.85));
    q = seatOf({ armsOut: true }); q.desk.children[0].visible = false; q.arm.rotation.z = Math.PI / 2; r.push(near(X.measure(q).left, 0.2, 1e-3));
    q.rig.position.x = 4; q.rig.rotation.z = 1.2; const m = X.measure(q); r.push(near(m.left, 0.2, 1e-3) && q.rig.position.x === 4);
    q = seatOf(); const b1 = X.extentOf(q); q.desk.scale.x = 2; r.push(X.extentOf(q) !== b1);
  }catch(_){ r.push(false); }
  return r.every(Boolean);
}
chk(judge(MOD), '고치지 않은 글은 판정 통과');
const breaks = [
  ['뼈대 자세 무시(처음 자세 점)', m => m.replace('if(skin) o.boneTransform(i, _v); else _v.fromBufferAttribute(pos, i);', '_v.fromBufferAttribute(pos, i);')],
  ['숨김 안 봄', m => m.replace('if(!_shown(o, seat.group)) return;', '')],
  ['책상 위 아이템 셈', m => m.replace('if(skipItems && _inDeskItems(o, root)) return;', '')],
  ['rig 안 되돌림', m => m.replace('if(rig){ rig.position.x = 0; rig.rotation.z = 0; }', '')],
  ['뼈대 되돌림 행렬 안 맞춤', m => m.replace('    g.updateMatrixWorld(true);', '    g.updateWorldMatrix(true, true);')],
  ['열쇠에 책상 크기 빠짐', m => m.replace('[seat.desk, seat.bodyWrap, seat.gltfRoot].map(_tf)', '[seat.bodyWrap, seat.gltfRoot].map(_tf)')],
];
for(const [name, f] of breaks){
  const m2 = f(MOD);
  chk(m2 !== MOD && !judge(m2), name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
