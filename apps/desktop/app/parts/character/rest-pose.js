/* rest-pose.js — 🧍 기본 자세로 잠깐 되돌려 재기 (검사 sim-rest-pose.js)
   [왜] fitModel 은 캐릭터 크기 · 발바닥 보정 · 발밑 깊이를 «지금 자세» 로 잰다. 처음 입장할 때는 막 만든 모델이라
     기본 자세지만, 파츠 보관함(T) · 꾸미기를 닫거나 파츠가 늦게 붙어 다시 맞출 때는 앉기 · 졸기 · 춤 · 누워 떼쓰기 자세 그대로라
     그 자세의 박스로 높이가 정해져 캐릭터가 뜬 채 남았다(B-1109-9 — 런처에서 다시 입장하면 내려옴).
   ・enter(seat): 처음 본 모델(gltfRoot)의 뼈 자세를 기본 자세로 기억해 두고, 지금 자세를 담아 둔 뒤 뼈와 bodyWrap 회전을 기본으로 돌린다.
   ・leave(token): 담아 둔 지금 자세로 되돌린다 — 그리기 전이라 화면에는 안 보인다.
   ⚠️ 기본 자세는 그 모델을 처음 enter 할 때 잰다 — fitModel 의 첫 호출은 applyCharToSeat 가 모델을 막 만든 직후다.
     모델을 새로 만들면(새 gltfRoot) 새로 기억한다. 나중에 붙은 파츠의 뼈(자기 뼈대가 있는 파츠)는 건드리지 않는다.
   ⚠️ 순수 모듈 — three 없이 position · quaternion · scale 의 clone / copy 와 traverse 만 쓴다.
   window.TwRestPose = { createRestPose() } → { enter(seat), leave(token), restOf(root) } */
(function(){
'use strict';

const KEY = '_twRestPose';   // gltfRoot.userData 안 — 그 모델의 기본 자세

function createRestPose(){
  const grab = (o) => ({ o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
  const put = (r) => { r.o.position.copy(r.p); r.o.quaternion.copy(r.q); r.o.scale.copy(r.s); };

  /* 그 모델의 기본 자세 — 처음 부를 때 한 번 재 두고 그 뒤로는 같은 것 */
  function restOf(root){
    if(!root) return [];
    if(!root.userData) root.userData = {};
    if(!root.userData[KEY]){
      const list = [];
      root.traverse((o) => { if(o && o.isBone) list.push(grab(o)); });
      root.userData[KEY] = list;
    }
    return root.userData[KEY];
  }
  function enter(seat){
    if(!seat || !seat.gltfRoot) return null;
    const rest = restOf(seat.gltfRoot);
    const now = rest.map((r) => grab(r.o));
    rest.forEach(put);
    const bw = seat.bodyWrap || null;
    const rot = bw ? bw.rotation.clone() : null;
    if(bw) bw.rotation.set(0, 0, 0);
    return { now, bw, rot };
  }
  function leave(t){
    if(!t) return;
    t.now.forEach(put);
    if(t.bw && t.rot) t.bw.rotation.copy(t.rot);
  }
  return { enter, leave, restOf };
}

const api = { createRestPose, KEY };
if(typeof window !== 'undefined') window.TwRestPose = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
