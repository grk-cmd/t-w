/* skeleton-share.js — 🦴 같은 뼈대를 쓰는 스킨 메시는 Skeleton 객체 하나를 함께 쓴다
   ・내놓는 것: sameRig(a, b) · shareSkeletons(meshes, anchors) · skinnedMeshesOf(root)
   ・왜: three 는 Skeleton 객체마다 한 장에 한 번 뼈 행렬을 셈하고 뼈 텍스처를 올린다(skeleton.frame).
     SkeletonUtils.clone 과 리깅 파츠 다시 묶기는 스킨 메시마다 Skeleton 을 따로 만들어 같은 뼈를 메시 수만큼 셈했다.
   ・함께 쓰는 조건: 같은 뼈 객체를 같은 순서로 · 역행렬 값이 모두 같다. 뼈 행렬 = 뼈 월드 × 역행렬 이라 값이 그대로다.
     bindMatrix · bindMatrixInverse 는 메시 것이다(셰이더 유니폼 · 광선의 boneTransform 모두 메시에서 읽음) — 달라도 함께 쓴다.
   ⚠️ 복제 · 묶기 바로 뒤, 그리기 전에만 부른다. 그린 적 있는 메시를 옮기면 옛 Skeleton 의 뼈 텍스처가 그래픽 메모리에 남는다.
   ⚠️ 함께 쓰는 Skeleton 은 뼈 · 역행렬을 바꾸지 않는다는 전제다(지금 바꾸는 곳 없음 — 다시 묶을 땐 bind(new Skeleton)).
   three 객체 모양만 안다 — 도메인을 모른다(shared). 검사: checks/sim-skeleton-share.js */
(function(){

/** 두 Skeleton 의 뼈 행렬이 늘 같은가 — 같은 뼈 객체 · 같은 순서 · 역행렬 16칸이 모두 같은 값 */
function sameRig(a, b){
  if(a === b) return true;
  if(!a || !b || !a.bones || !b.bones || !a.boneInverses || !b.boneInverses) return false;
  const n = a.bones.length;
  if(b.bones.length !== n || a.boneInverses.length !== n || b.boneInverses.length !== n) return false;
  for(let i = 0; i < n; i++){ if(a.bones[i] !== b.bones[i]) return false; }
  for(let i = 0; i < n; i++){
    const x = a.boneInverses[i] && a.boneInverses[i].elements, y = b.boneInverses[i] && b.boneInverses[i].elements;
    if(!x || !y) return false;
    for(let k = 0; k < 16; k++){ if(!Object.is(x[k], y[k])) return false; }
  }
  return true;
}

/** meshes 가운데 같은 뼈대를 쓰는 것을 Skeleton 하나로 모은다. anchors 의 Skeleton 은 바꾸지 않고 먼저 맞춰 볼 후보로만 쓴다.
    돌려주는 값: Skeleton 을 바꾼 메시 수 */
function shareSkeletons(meshes, anchors){
  const pool = [];
  for(const m of (anchors || [])){
    if(m && m.isSkinnedMesh && m.skeleton && pool.indexOf(m.skeleton) < 0) pool.push(m.skeleton);
  }
  let joined = 0;
  for(const m of (meshes || [])){
    if(!m || !m.isSkinnedMesh || !m.skeleton) continue;
    const hit = pool.find(s => sameRig(s, m.skeleton));
    if(!hit){ pool.push(m.skeleton); continue; }
    if(hit !== m.skeleton){ m.skeleton = hit; joined++; }
  }
  return joined;
}

/** root 아래 스킨 메시(root 포함) — 나무 순서 */
function skinnedMeshesOf(root){
  const out = [];
  if(root && root.traverse) root.traverse(o => { if(o.isSkinnedMesh) out.push(o); });
  return out;
}

const api = { sameRig, shareSkeletons, skinnedMeshesOf };
if(typeof window !== 'undefined') window.TwSkeletonShare = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
