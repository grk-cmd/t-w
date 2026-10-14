/* ═══ 🪑 책상 아이템의 «처음 자리» — 생성기 5단계 «⟲ 이동·회전 초기화» 가 돌아갈 곳 ══════════════════
   [문제] 초기화가 x · y · z · rot 를 0 으로 박았다. 커스텀 아이템은 처음부터 y 가 0 이 아니고
     (ITEM_Y_START_OFFSET), 불러온 캐릭터의 아이템은 저장된 자리에 있으므로 «0» 은 처음 자리가 아니다
     — 누르면 책상 속으로 가라앉거나 엉뚱한 곳으로 갔다.
   [해법] 아이템 하나(pivot 인스턴스)마다 «이번 편집에서 처음 나타났을 때의» x · y · z · rot 를 적어 두고,
     초기화는 그 값으로 되돌린다. 크기(scale)는 건드리지 않는다(크기 초기화 버튼 몫).
   ★ 적는 때: 장착 직후(equipDeskItem) · 저장값을 덮어쓴 직후(applyDeskItemsTo — 장착보다 뒤라 덮어쓴다).
   ★ 지우는 때: 생성기를 닫거나 아이템을 다시 깔 때(clearCreatorItems). 적힌 게 없으면 예전처럼 0. */
(function(){
'use strict';

const KEYS = ['x', 'y', 'z', 'rot'];
const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : 0;

/* adj 에서 위치 · 회전만 떼어 낸 복사본(없는 칸은 0). */
function pickXf(adj){
  const a = adj || {}, o = {};
  KEYS.forEach(k=>{ o[k] = num(a[k]); });
  return o;
}

function createDeskItemOrigin(){
  let map = new Map();   // pivot → {x,y,z,rot}

  /* 지금 자리를 «처음 자리» 로 적는다(같은 pivot 이면 덮어쓴다 — 장착 직후 → 저장값 복원 순서). */
  function remember(pivot, adj){
    if(!pivot) return;
    map.set(pivot, pickXf(adj));
  }
  function originOf(pivot){
    const o = pivot && map.get(pivot);
    return o ? Object.assign({}, o) : null;
  }
  /* adj 의 x · y · z · rot 를 처음 자리로(없으면 0). scale 등 다른 칸은 그대로. 처음 자리가 있었는지 돌려준다. */
  function resetXf(pivot, adj){
    if(!adj) return false;
    const o = pivot && map.get(pivot);
    KEYS.forEach(k=>{ adj[k] = o ? o[k] : 0; });
    return !!o;
  }
  function clear(){ map = new Map(); }
  function size(){ return map.size; }

  return { remember, originOf, resetXf, clear, size };
}

const api = { pickXf, createDeskItemOrigin };
if(typeof window !== 'undefined') window.DeskItemOrigin = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
