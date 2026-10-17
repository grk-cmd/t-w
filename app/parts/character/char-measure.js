/* char-measure.js — 📐 캐릭터 실측 — 맨 몸 · 맨 머리 박스 · 발밑 깊이 · 피봇 보정 · 바닥 맞춤 · 바닥 진단
   책임: 캐릭터 · 파츠 wrapper 의 3D 박스를 재는 도우미 묶음 — 값을 재서 돌려주거나(박스 · 깊이 · 보정량) wrapper 하나를 바닥 위로 올린다. 좌석 배율 · 위치를 거는 일은 fitModel(app.js), 콘솔 진단은 floor-snap-diag.js.
   받는 deps: measureBodyBox(character/body-measure.js — 몸 박스 재기 한 규칙). 내보내는 것: measureCharBox · measureHeadBoxNoParts · headDecorMeshSet · measureUnderfootDepth · charFootFix · floorClampWrapper.
   app.js «FIT» 구역의 측정 몫을 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄임).
     맨 몸 · 맨 머리 · 발밑 깊이 · 가지 빼고 재기(_boxExcluding)는 measureBodyBox 에 옵션만 고른다(옛 글과 같은 박스 — checks/sim-body-measure.js).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 밖에서 부르는 이름: charFootFix · floorClampWrapper · headDecorMeshSet · measureCharBox · measureHeadBoxNoParts · measureUnderfootDepth — app.js 는 charMeasureMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCharMeasure — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-char-measure.js */
(function(){

function createCharMeasure(deps){
const measureBodyBox = deps.measureBodyBox;


// ★ 캐릭터 크기 측정 — 규칙은 character/body-measure.js 의 measureBodyBox 한 곳(아래 셋은 옵션만 고른다).
//   리깅 파츠는 r128 setFromObject 가 스키닝 전 원본 박스를 재 몇 배씩 커지므로 몸을 잴 때는 뺀다.
/* 🎩 '머리가 아니라 머리에 얹힌 것' — 기본 GLB 의 장식 메쉬들. 가시성과 무관하게 머리 꼭대기 측정에서 늘 뺀다
   (꾸미기 파츠를 끼면 숨겨지는데, 숨은 것만 빼면 파츠를 쓰고 벗을 때마다 위에 얹힌 캐릭터가 오르내린다).
   ⚠️ 목록은 이 한 벌만(_headTopAboveBone 도 이걸 쓴다) · 인간 · 동물 공통 · 측정은 올라탈 때 1회 캐싱이라 확인은 내렸다 다시 올려서. */
const HEAD_DECOR_MESH_KEYS = ['hatMesh','maskMesh','glassesMesh','wingMesh'];
const _EMPTY_MESH_SET = new Set();
function headDecorMeshSet(meshHost){
  if(!meshHost) return _EMPTY_MESH_SET;             // 좌석을 안 준 호출부는 예전 그대로 동작한다
  const s = new Set();
  HEAD_DECOR_MESH_KEYS.forEach(k=>{ if(meshHost[k]) s.add(meshHost[k]); });
  return s.size ? s : _EMPTY_MESH_SET;
}
/* 🎪 올라타기 · 상태칩 기준 '맨 머리' 박스 — 파츠 · 숨은 메시 · 기본 머리 장식(meshHost 를 주면)을 뺀다.
   outBoxes 를 주면 센 메시 하나하나의 박스를 담는다(꼭대기 근처 메시만 골라 앞뒤 중심을 다시 잡는 데 — _headTopCenterZ). */
function measureHeadBoxNoParts(root, outBoxes, meshHost){
  return measureBodyBox(root, { excludeParts: true, visibleOnly: true, skipMeshes: headDecorMeshSet(meshHost), outBoxes: outBoxes || null });
}
/* 키 정규화(fitModel · fitCreator) 분모와 센터링 기준 — 파츠를 세면 착용한 파츠에 따라 캐릭터가 줄었다 늘었다 한다.
   숨은 메시는 센다(옛 동작 그대로). ⚠️ fitCreator 도 이 함수를 쓴다 — 생성기 미리보기와 실행 화면이 함께 맞는다. */
function measureCharBox(root){
  return measureBodyBox(root, { excludeParts: true });
}
/* 🦶 발밑보다 아래로 내려간 깊이 — 욕조 · 방석처럼 발 아래 두는 파츠 때문에 바닥선이 제각각이 되는 것을 막는다(이만큼 들어 올린다).
   ★ 피봇이 발바닥이라는 전제 — 발 아래 아무것도 없으면 0 이라 기존 캐릭터는 안 움직인다(min.y 로 다시 잡지 않는다).
   ⚠️ 숨은 메쉬(옷 입으면 숨는 몸 · 자리비움 페이드) · 리깅 파츠(스키닝 전 박스)는 안 센다. 책상 파츠는 gltfRoot 밖이라 안 잡힌다. */
const FLOOR_SNAP_MAX = 1.2;      // 저작이 어긋난 파츠 하나 때문에 캐릭터가 하늘로 뜨는 것 방지(캐릭터 키가 1.45)
const FLOOR_SNAP_MIN = 0.005;    // 이보다 얕으면 수치 오차로 보고 안 건드린다
function measureUnderfootDepth(root){
  let bottom = 0;
  try{
    const b = measureBodyBox(root, { excludeParts: 'rigged', visibleOnly: true });   // 발밑 파츠는 센다 — 리깅 파츠만 뺀다
    if(!b.isEmpty() && b.min.y < bottom) bottom = b.min.y;
  }catch(_){ return 0; }
  const depth = -bottom;
  if(!(depth > FLOOR_SNAP_MIN)) return 0;
  if(depth > FLOOR_SNAP_MAX){
    console.warn('[바닥맞춤] 발밑 깊이가 비정상적으로 큼 — ' + depth.toFixed(2) + ' → ' + FLOOR_SNAP_MAX + ' 로 제한');
    return FLOOR_SNAP_MAX;
  }
  return depth;
}
/* 🦶 피봇 보정 — «피봇이 곧 발바닥» 이 아닌 모델(사람 GLB 는 0.048 아래)을 몸 박스(파츠 제외) 바닥이 원점에 오도록 되돌릴 양.
   ⚠️ 네 곳이 짝이다 — fitModel · fitCreator('edit') · fitCreator('app') · refreshWdPreviewChar. 박스는 그 객체가 y=0 일 때 잰 것.
   ⚠️ 키 대비 FOOT_FIX_MAX_RATIO 를 넘으면(여분 메쉬가 있는 커미션 GLB) 보정을 포기한다(0 · 예전 동작). */
const FOOT_FIX_MAX_RATIO = 0.12;   // 몸 높이의 12% — 사람의 실측값 0.048/1.45 ≒ 3.3% 의 세 배 남짓
function charFootFix(box){
  if(!box) return 0;
  if(typeof box.isEmpty === 'function' && box.isEmpty()) return 0;   // ⚠️ `box.isEmpty ||` 로 쓰면 **항상 0** 이 된다(메서드는 늘 truthy)
  const h = box.max.y - box.min.y;
  const d = -box.min.y;
  if(!isFinite(d) || d === 0) return 0;
  if(h > 1e-6 && Math.abs(d) > h * FOOT_FIX_MAX_RATIO){
    console.warn('[발바닥] 피봇과 메쉬 바닥 차이가 너무 큼 — ' + d.toFixed(4)
      + ' (키 ' + h.toFixed(3) + ') → 보정하지 않습니다');
    return 0;
  }
  return d;
}
/* 📐 root 의 월드 박스를 재되, skipSub 가 true 인 가지(와 숨은 가지)는 통째로 뺀다 — root 자신은 안 본다.
   바닥 클램프는 «잰 것» 과 «움직이는 것» 이 같아야 한다 — 다르면 매 프레임 다시 올리는 되먹임으로 하늘로 솟는다.
   재기는 measureBodyBox 의 skipBranch(파츠 · 리깅 규칙 없음 — 책상 · 아이템을 잰다). */
function _boxExcluding(root, skipSub){
  try{ return measureBodyBox(root, { skipBranch: o => o.visible === false || skipSub(o) }); }
  catch(_){ return new THREE.Box3(); }
}
/* 🪑🦶 wrapper 하나를 **월드 바닥(y=0)** 위로 끌어올린다 — 아래로 내려간 만큼만 움직인다.
   [어디서 쓰는가] 두 곳이며, 반드시 같은 식이어야 한다.
     ① applyPartXf — 부착·xf 적용 직후(미리보기·실행 양쪽이 이 경로를 지난다)
     ② syncWdGizmoToXf — 미리보기에서 기즈모를 드래그하는 동안. 여기서 걸어야 저장되는 xf 값이
        화면에 보이는 자리와 같아진다(안 걸면 "아래로 끌어도 안 내려가는데 숫자만 계속 줄어드는"
        상태가 되고, 다음에 열 때 그 숫자가 그대로 되살아난다).
   ★ 기준은 월드 y=0 이다. deskAnchor 기준이 아니다 — 책상 밑에 놓는 파츠(쓰레기통 등)는 앵커보다
     아래에 있는 게 맞고, 바닥보다 아래인 것만 잘못이다.
   ★ 이미 바닥에 맞춰 둔 파츠는 깊이가 0 이라 그대로다 — 어긋난 만큼만 움직인다.
   ⚠️ 월드에서 잰 깊이를 부모 배율로 환산해 로컬 y 에 더한다. deskAnchor 는 책상 그룹의 자식이라
     setDeskScale 배율(보통 0.175)을 물려받는다 — 환산을 빼먹으면 약 5.7배로 들어 올려 날아간다.
   @param hard 상한(FLOOR_SNAP_MAX)을 무시하고 **끝까지** 끌어올린다.
     기즈모 드래그처럼 사람이 직접 끌고 있는 경우에 쓴다 — 상한을 두면 1.2 를 넘게 끌어내린 순간
     클램프가 손을 놓아 바닥을 그대로 뚫고 지나간다(막으려던 바로 그 동작이 된다).
     상한은 '저작이 어긋난 파츠가 스스로 하늘로 뜨는 것' 을 막기 위한 것이므로 자동 경로에만 필요하다.
   @param skipSub 측정에서 뺄 가지를 고르는 함수. **w 를 올려도 같이 안 올라가는 것만** 뺀다
     (_boxExcluding 주석 참고). 안 넘기면 예전처럼 전부 잰다.
   @return 실제로 올린 로컬 y 양(0 이면 무동작) */
function floorClampWrapper(w, tag, hard, skipSub){
  if(!w) return 0;
  try{
    w.updateWorldMatrix(true, true);
    const b = skipSub ? _boxExcluding(w, skipSub) : new THREE.Box3().setFromObject(w);
    if(b.isEmpty()) return 0;
    const d = -b.min.y;                            // 바닥 아래로 내려간 깊이
    if(!(d > FLOOR_SNAP_MIN)) return 0;             // 오차 수준이면 안 건드린다
    if(!hard && d > FLOOR_SNAP_MAX){
      console.warn('[바닥맞춤·책상파츠] ' + (tag||'') + ' 깊이가 비정상 — ' + d.toFixed(2)
        + ' → ' + FLOOR_SNAP_MAX + ' 로 제한');
    }
    const _ws = new THREE.Vector3();
    (w.parent || w).getWorldScale(_ws);
    const k = (isFinite(_ws.y) && Math.abs(_ws.y) > 1e-6) ? _ws.y : 1;
    const dy = (hard ? d : Math.min(d, FLOOR_SNAP_MAX)) / k;
    w.position.y += dy;
    w.updateWorldMatrix(true, true);
    return dy;
  }catch(_){ return 0; }
}

return {
  charFootFix,
  floorClampWrapper,
  headDecorMeshSet,
  measureCharBox,
  measureHeadBoxNoParts,
  measureUnderfootDepth,
};
}

const api = { createCharMeasure };
if(typeof window !== 'undefined') window.TwCharMeasure = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
