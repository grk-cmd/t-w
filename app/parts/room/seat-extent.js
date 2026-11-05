/* seat-extent.js — 🪑 좌석 하나가 차지하는 가로 자리 — 보이는 겉면(책상 몸 · 캐릭터 몸 · 꾸미기 파츠)의 왼쪽 끝 · 오른쪽 끝
   책임: 좌석의 보이는 메시 점을 화면과 같은 자세로 재서 좌석 원점에서 왼쪽 · 오른쪽으로 얼마나 뻗었는지 낸다 · 모습이 그대로면 다시 재지 않는다.
   받는 deps: THREE · seatScale(좌석 → 평준화 배율 — 몸 감싸개의 쉬는 크기 · character/seat-equalize.js)(함수).
   내보내는 것: extentOf(seat) → { left, right }(모습이 그대로면 기억한 값) · measure(seat)(늘 새로 잼) · shapeKey(seat) · DEFAULT_HALF.
   [왜 점으로 재나] 상자(Box3.setFromObject)는 three r128 에서 뼈대 메시를 처음 저장된 자세(팔 벌림)로, 숨은 메시까지 넣어 잰다 —
     실제보다 넓게 나와서 그 오차를 여유 · 음수 간격으로 덧대 왔다(#755). 뼈대 메시는 boneTransform 으로 지금 자세의 점을 잰다.
   ⚠️ 책상 위 아이템 · 파츠 핀(deskAnchor)은 안 센다 — 평준화 가두기가 그 자리 안으로 민다(character/seat-eq-clamp.js).
   ⚠️ 날기 · 끌기 · 흔들기는 rig 를, 숨쉬기 · 춤 · 누움 · 스쿼시는 몸 감싸개(bodyWrap)를 매 프레임 바꾼다 — 잴 때만 쉬는 자세(rig 가로 0 · 기울기 0 · 감싸개 회전 0 · 크기 = 평준화 배율)로 되돌렸다가 돌려놓는다(B-1104-9).
   ⚠️ 모습 열쇠(shapeKey)에는 매 프레임 안 바뀌는 값만 넣는다(감싸개 대신 평준화 배율) — 타이핑 · 숨쉬기마다 다시 재지 않게.
   검사: checks/sim-seat-extent.js */
(function(){

const DEFAULT_HALF = 0.85;          // 잴 것이 하나도 없을 때(초기화 중) — 기본 책상 반폭
const DESK_ITEMS_NAME = 'deskAnchor';   // 책상 위 아이템 · 파츠 핀을 담는 노드(app.js buildDesk)
const PART_WRAP_PREFIX = '__partWrap_';

function createSeatExtent(deps){
const THREE = deps.THREE;
const seatScale = deps.seatScale;
const _v = new THREE.Vector3(), _inv = new THREE.Matrix4(), _m = new THREE.Matrix4();
const _memo = new WeakMap();   // seat → { key, ext }

function _shown(o, stop){
  for(let p = o; p && p !== stop; p = p.parent){ if(p.visible === false) return false; }
  return true;
}
function _inDeskItems(o, desk){
  for(let p = o; p && p !== desk; p = p.parent){ if(p.name === DESK_ITEMS_NAME) return true; }
  return false;
}
/* 재는 메시 — 책상(아이템 빼고) · 몸 감싸개(몸 · 파츠 · 아직 안 풀렸으면 임시 몸) 아래에서 보이는 것만 */
function _meshes(seat){
  const out = [];
  const add = (root, skipItems) => {
    if(!root) return;
    root.traverse(o => {
      if(!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      if(skipItems && _inDeskItems(o, root)) return;
      if(!_shown(o, seat.group)) return;
      out.push(o);
    });
  };
  add(seat.desk, true);
  add(seat.bodyWrap, false);
  return out;
}
function _isPartWrap(p){
  return !!(p.userData && (p.userData.__twPartWrap || p.userData.rigged)) || (typeof p.name === 'string' && p.name.indexOf(PART_WRAP_PREFIX) === 0);
}
const _tf = (n) => n ? [n.position.x, n.position.y, n.position.z, n.rotation.x, n.rotation.y, n.rotation.z, n.scale.x, n.scale.y, n.scale.z].map(v => +(+v || 0).toFixed(4)).join(',') : '-';
/* 모습 열쇠 — 보이는 메시 목록 · 책상 · 몸 크기 · 방향 · 파츠 자리. 뼈대 자세 · rig(날기 · 끌기)는 안 넣는다 */
function shapeKey(seat){
  if(!seat) return '';
  const parts = _meshes(seat).map(o => {
    let w = null;
    for(let p = o.parent; p && p !== seat.bodyWrap; p = p.parent){ if(_isPartWrap(p)){ w = p; break; } }
    return o.uuid + (w ? '@' + _tf(w) : '');
  });
  return parts.join('|') + '#' + [seat.desk, seat.gltfRoot].map(_tf).join(';') + '#' + (+seatScale(seat) || 1).toFixed(4);
}
/* 늘 새로 잰다 — 좌석 원점에서 왼쪽(−x) · 오른쪽(+x)으로 뻗은 거리 */
function measure(seat){
  const g = seat && seat.group;
  if(!g) return { left: DEFAULT_HALF, right: DEFAULT_HALF };
  const rig = seat.rig, bw = seat.bodyWrap;
  const px = rig ? rig.position.x : 0, rz = rig ? rig.rotation.z : 0;
  const bRot = bw ? bw.rotation.clone() : null, bScale = bw ? bw.scale.clone() : null;
  if(rig){ rig.position.x = 0; rig.rotation.z = 0; }
  if(bw){ const k = +seatScale(seat) || 1; bw.rotation.set(0, 0, 0); bw.scale.set(k, k, k); }
  try{
    /* 남이 남긴 행렬에 기대지 않는다 — 조상부터 자손까지 여기서 세운다(fitModel 이 group 을 옮겼다 값만 되돌린 직후도 있다).
       ⚠️ 자손은 updateMatrixWorld 로 — 뼈대 메시의 bindMatrixInverse 는 그 안에서만 다시 맞춰진다(updateWorldMatrix 는 건너뛴다). */
    g.updateWorldMatrix(true, false);
    g.updateMatrixWorld(true);
    _inv.copy(g.matrixWorld).invert();
    let lo = Infinity, hi = -Infinity;
    for(const o of _meshes(seat)){
      _m.multiplyMatrices(_inv, o.matrixWorld);
      const pos = o.geometry.attributes.position;
      const skin = !!(o.isSkinnedMesh && o.skeleton && o.geometry.attributes.skinIndex);
      for(let i = 0; i < pos.count; i++){
        if(skin) o.boneTransform(i, _v); else _v.fromBufferAttribute(pos, i);
        _v.applyMatrix4(_m);
        if(_v.x < lo) lo = _v.x;
        if(_v.x > hi) hi = _v.x;
      }
    }
    if(!(hi >= lo)) return { left: DEFAULT_HALF, right: DEFAULT_HALF };
    return { left: Math.max(0, -lo), right: Math.max(0, hi) };
  }finally{
    if(bw){ bw.rotation.copy(bRot); bw.scale.copy(bScale); }
    if(rig){ rig.position.x = px; rig.rotation.z = rz; }
    if(rig || bw) g.updateMatrixWorld(true);
  }
}
/* 모습이 그대로면 기억한 값 · 바뀌었으면 다시 잰다 */
function extentOf(seat){
  if(!seat) return { left: DEFAULT_HALF, right: DEFAULT_HALF };
  const key = shapeKey(seat);
  const m = _memo.get(seat);
  if(m && m.key === key) return m.ext;
  const ext = measure(seat);
  _memo.set(seat, { key, ext });
  return ext;
}

return {
  DEFAULT_HALF,
  extentOf,
  measure,
  shapeKey,
};
}

const api = { createSeatExtent };
if(typeof window !== 'undefined') window.TwSeatExtent = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
