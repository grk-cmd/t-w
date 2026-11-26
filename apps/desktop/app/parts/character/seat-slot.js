/* ═══ 🪑 좌석 자리 안에 «책상 위» 파츠 가두기 — 좌석 크기 평준화를 켰을 때 ══════════════════════════
   [문제] 좌석 간격(layoutSeats)은 책상 몸통만 재고 책상 위 파츠는 일부러 뺀다(seatDeskHalfWidth).
     그래서 바닥에 넓게 깐 파츠(러그 · 욕조 등)는 자리 계산에 안 잡히고, 평준화로 좌석이 커지면
     파츠가 옆 사람 자리로 넘어간다.
   [해법] 평준화가 켜져 있으면 파츠마다 **좌우(X)만** 자기 자리 안으로 민다. 자리 = 좌석 중심에서
     책상이 뻗은 거리 + 좌석 사이 여백의 절반(양옆 좌석이 각자 절반씩 쓰므로 서로 안 겹친다).
     자리보다 넓은 파츠는 가운데에 맞춘다(크기는 안 바꾼다).
   ★ 내 화면에서만 — 저장값(xf)은 건드리지 않는다. 평준화를 끄면 민 만큼 되돌린다.
   ★ applyPartXf 가 자리를 다시 잡으면(꾸미기 저장 등) 민 값은 사라진다 — 그래서 «내가 마지막으로 놓은
     자리» 를 기억해 두고, 그대로일 때만 민 몫을 빼서 원래 자리를 되찾는다.
   THREE 는 deps 로 받는다(검사에서 실제 three 로 돈다 — sim-seat-slot.js). */
(function(){
'use strict';

/* [min, max] 를 [lo, hi] 안으로 넣는 데 필요한 X 이동량. 자리보다 넓으면 가운데를 맞춘다. */
function clampShift(min, max, lo, hi){
  if(!(max >= min) || !(hi >= lo)) return 0;
  if(max - min > hi - lo) return (lo + hi) / 2 - (min + max) / 2;
  if(min < lo) return lo - min;
  if(max > hi) return hi - max;
  return 0;
}

function createSeatSlot(deps){
  const THREE = deps.THREE;
  const EPS = 1e-6;
  const _box = new THREE.Box3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

  /* 파츠가 원래(밀기 전) 있던 자리로 되돌린다. 남이 위치를 다시 잡았으면(applyPartXf) 이미 원래 자리다. */
  function _restore(w){
    const ud = w.userData, s = ud._slotShift, at = ud._slotPos;
    if(s && at && w.position.distanceToSquared(at) < EPS) w.position.sub(s);
    ud._slotShift = null; ud._slotPos = null;
  }

  /* 한 좌석의 파츠들을 자리 [cx - half, cx + half] (월드 X) 안으로. 민 파츠 수를 돌려준다. */
  function clampParts(wrappers, cx, half, on){
    let moved = 0;
    (wrappers || []).forEach(w=>{
      if(!w || !w.parent) return;
      _restore(w);
      if(!on || !(half > 0)) return;
      w.updateWorldMatrix(true, true);
      _box.setFromObject(w);
      if(_box.isEmpty()) return;
      const dx = clampShift(_box.min.x, _box.max.x, cx - half, cx + half);
      if(Math.abs(dx) < 1e-5) return;
      // 월드 X 이동 → 부모 로컬 이동(부모 사슬에 배율이 있다 — 책상 그룹 · 앵커 · 핀)
      w.getWorldPosition(_a);
      _b.copy(_a); _b.x += dx;
      w.parent.worldToLocal(_a); w.parent.worldToLocal(_b);
      const s = _b.sub(_a).clone();
      w.position.add(s);
      w.userData._slotShift = s;
      w.userData._slotPos = w.position.clone();
      moved++;
    });
    return moved;
  }

  return { clampParts };
}

const api = { clampShift, createSeatSlot };
if(typeof window !== 'undefined') window.SeatSlot = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
