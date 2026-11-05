/* seat-layout.js — 🪑 좌석 줄 배치 — 좌석마다 보이는 겉면 자리를 받아 자리(targetX)를 잡고 줄 가운데 · 폭을 카메라에 넘긴다
   책임: 좌석 줄 자리 계산 하나 — 평준화 반영 → 맨 오른쪽 고정 → 이동 오프셋 다시 검사 → 이웃 좌석의 보이는 겉면 사이가 «좌석 간격» 이 되게 targetX → 줄 가운데 · 폭을 캐시하고 카메라 모듈에 넘김.
   받는 deps: seats(값) · _rideBottom(ride-chain.js) · syncSeatEqualize · renderSeatTabs · clampDeskPan · seatExtent(좌석 자리 { left, right } — room/seat-extent.js)(함수) · ZOOM_HALF_CAP(값) · roomSeatMode · deskPanX/Y · SPACING · MULTIPLAYER_SPACING · seatCameraMod(읽는 함수) · setDeskPanX/Y · setCachedRowCenter/Span(쓰는 함수).
   내보내는 것: layoutSeatRow() — app.js 의 layoutSeats() 가 부른다 · seatHalfWidth(s) — 좌석 반폭(같은 자리 · 평준화 가두기가 받는다) · slotIndexAt(x, seat) — 책상 끌기가 그 좌석을 넣을 번호(칸마다 설 자리를 셈해 x 에서 가장 가까운 칸) · usesRoomGap() — 방용 간격을 쓰는가(설정 막대 · 평준화 가두기도 이것을 부른다 · #749).
   ⚠️ 이름이 layoutSeats 가 아닌 까닭: app.js 맨 아래 «데스크탑 창 크기» 가 layoutSeats 를 감싸 다시 대입한다(앱 FSD 32번). 그래서 app.js 에 같은 이름의 얇은 함수를 남겨 두고,
      모든 부르는 곳 · 다른 모듈 deps 는 예전처럼 그 이름을 본다 — 감싼 판이 그대로 불린다.
   ⚠️ 자리 폭에 여유 · 하한 같은 숫자를 덧대지 않는다 — 겉면이 틀리면 재는 곳(seat-extent.js)을 고친다(#755).
   ⚠️ document · window 등 브라우저 전역은 전역 이름으로 쓴다(app.js 앞에 싣는 classic script) · 전역 이름은 TwSeatLayout(#103).
   검사: checks/sim-seat-layout.js */
(function(){

function createSeatLayout(deps){
const MULTIPLAYER_SPACING = deps.MULTIPLAYER_SPACING;   // 읽는 함수
const SPACING = deps.SPACING;   // 읽는 함수
const _rideBottom = deps._rideBottom;
const clampDeskPan = deps.clampDeskPan;
const deskPanX = deps.deskPanX;   // 읽는 함수
const deskPanY = deps.deskPanY;   // 읽는 함수
const renderSeatTabs = deps.renderSeatTabs;
const roomSeatMode = deps.roomSeatMode;   // 읽는 함수
const seatCameraMod = deps.seatCameraMod;   // 읽는 함수
const seatExtent = deps.seatExtent;   // 좌석 → { left, right } 보이는 겉면 자리(room/seat-extent.js — 모습이 그대로면 다시 안 잼)
const ZOOM_HALF_CAP = deps.ZOOM_HALF_CAP;   // 카메라 줌에만 거는 끝 좌석 반폭 상한 — 유난히 큰 책상 하나가 줄 전체를 과하게 멀리 비추지 않게
const seats = deps.seats;
const syncSeatEqualize = deps.syncSeatEqualize;
const setCachedRowCenter = deps.setCachedRowCenter;   // 쓰는 함수
const setCachedRowSpan = deps.setCachedRowSpan;   // 쓰는 함수
const setDeskPanX = deps.setDeskPanX;   // 쓰는 함수
const setDeskPanY = deps.setDeskPanY;   // 쓰는 함수
const ROW_SPAN_MIN = 1.2;   // 카메라 줌용 줄 폭 하한 — 혼자일 때도 이만큼은 비춘다
/* 방용 간격을 쓰는가 — 화면에 친구 좌석이 있으면. 설정 막대 · 줄 배치 · 평준화 가두기가 이 하나를 본다(셋이 따로 고르면 막대가 안 먹는다 — #749). */
function usesRoomGap(){ return seats.some(s=>s.remote); }
function rowSpacing(){ return usesRoomGap() ? MULTIPLAYER_SPACING() : SPACING(); }
const _extMemo = new WeakMap();   // 마지막 줄 배치에서 받은 자리 — 끌기 중 pointermove 마다 모습 열쇠를 다시 만들지 않게
function extOf(s){
  let e = _extMemo.get(s);
  if(!e){ e = seatExtent(s); _extMemo.set(s, e); }
  return e;
}
/* 좌석 반폭 — 평준화 가두기(character/seat-eq-clamp.js)가 받는다. 가두기는 좌우 같은 폭으로 미니 더 뻗은 쪽. */
function seatHalfWidth(s){ const e = seatExtent(s); return Math.max(e.left, e.right); }
/* 줄 배치 규칙 한 벌 — layoutSeatRow(실제 자리)와 slotIndexAt(끌기 — 넣으면 설 자리)가 같이 쓴다.
   ⚠️ 두 곳이 따로 셈하면 한쪽만 고쳤을 때 끌기가 두 칸을 오가며 떨린다.
   row 순서대로 좌석 x — 0번(맨 오른쪽)이 0, 다음은 «앞 좌석 x − (앞 좌석 왼쪽 끝 + 간격 + 내 오른쪽 끝)». 올라탄 좌석은 자리가 없어 건너뛴다(Map 에 없음). */
function rowTargets(row, spacing){
  const out = new Map();
  let prevX = 0, prevL = 0, first = true;
  row.forEach((s)=>{
    if(s.ridingOn) return;
    const e = extOf(s);
    const tx = first ? 0 : prevX - (prevL + spacing + e.right);
    out.set(s, tx); first = false; prevX = tx; prevL = e.left;
  });
  return out;
}
/* 책상을 끌어 자리 바꾸기 — 끄는 좌석을 seats 몇 번에 넣을지(빼고 다시 넣는 splice 번호).
   끄는 좌석을 뺀 나머지 순서는 끄는 동안 그대로라, 칸 k 마다 «k 번에 넣으면 설 자리» 를 rowTargets 로 내고 x 에서 가장 가까운 칸을 고른다
   — 답이 x 로만 정해져 왔다갔다하지 않는다.
   ⚠️ 지금 targetX 중 가장 가까운 것을 고르면 안 된다: 폭이 다른 책상이 섞이면 옮길 때마다 다른 자리들도 움직여 두 칸을 끝없이 오간다.
   ⚠️ 간격으로 나누면 안 된다: 한 칸 너비는 좌석마다 다르다. */
function slotIndexAt(x, dragSeat){
  if(!dragSeat || seats.indexOf(dragSeat) < 0) return 0;
  const rest = seats.filter(s=>s!==dragSeat);
  const spacing = rowSpacing();
  let best = 0, bestD = Infinity;
  for(let k = 0; k <= rest.length; k++){
    const at = rowTargets(rest.slice(0, k).concat([dragSeat], rest.slice(k)), spacing).get(dragSeat);
    if(at === undefined) continue;
    const d = Math.abs(at - x);
    if(d < bestD){ bestD = d; best = k; }
  }
  return best;
}
function layoutSeatRow(){
  /* 🪑 좌석 간격·카메라 줌은 바로 아래에서 **책상 폭을 실측**한다. 평준화로 책상이 커지거나
     작아졌다면 그 전에 반영돼 있어야 간격이 한 박자 늦지 않는다. 바뀐 좌석이 없으면 숫자 비교뿐이다. */
  syncSeatEqualize();
  // 🪑 맨 오른쪽 고정이면 방에서 나를 0번(맨 오른쪽)으로 — 다른 사람이 들어온 뒤에도(seat-pin.js)
  if(window.TwSeatPin && TwSeatPin.pinFirst(seats, roomSeatMode())) renderSeatTabs();
  // ★ 인원이 바뀔 때마다 이동 오프셋을 안전 범위로 다시 당긴다 — 구석에 걸어 둔 채 인원이 늘면 화면 밖으로 밀린다.
  { const _c = clampDeskPan(deskPanX(), deskPanY()); setDeskPanX(_c.x); setDeskPanY(_c.y); }
  // ★ SPACING · MULTIPLAYER_SPACING 은 «이웃 좌석의 보이는 겉면 사이» — 0 이면 맞닿는다.
  /* 🐾 남의 머리에 올라탄 좌석(탑 사슬 전체)은 자리 계산에서 뺀다 — 실제 위치는 _positionRideSeat 이 매 프레임 덮어쓴다.
     ⚠️ seats 배열의 순서 · 내용은 건드리지 않는다(좌석 탭 · 슬롯 드래그가 인덱스를 쓴다). 카메라 줌도 같은 placed 목록을 본다. */
  seats.forEach(s=>{ if(!s.ridingOn) _extMemo.set(s, seatExtent(s)); });   // 배치마다 받는다(모습이 그대로면 seat-extent 가 다시 안 잼) — 끌기는 이 값을 다시 쓴다
  const placed = seats.filter(s=>!s.ridingOn);
  const tx = rowTargets(seats, rowSpacing());
  placed.forEach(s=>{ s.targetX = tx.get(s); });
  /* 올라탄 좌석에는 자기 탑 바닥의 자리를 그대로 물려준다 — 옛 값이 남으면
     _positionRideSeat 의 UI 앵커(host.targetX 를 읽는다)가 엉뚱한 자리를 가리킨다. */
  seats.forEach(s=>{ if(s.ridingOn){ const b=_rideBottom(s); s.targetX = (b && b.targetX) || 0; } });
  const xs = placed.map(s=>s.targetX);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const rowCenter = (minX+maxX)/2;
  const leftS = placed[xs.indexOf(minX)], rightS = placed[xs.indexOf(maxX)];
  const zl = leftS ? Math.min(extOf(leftS).left, ZOOM_HALF_CAP) : 0, zr = rightS ? Math.min(extOf(rightS).right, ZOOM_HALF_CAP) : 0;
  const rowSpan = Math.max(ROW_SPAN_MIN, (maxX-minX) + zl + zr);   // 카메라 줌 계산용 전체 폭(양 끝 좌석의 겉면까지 · 줌 상한)
  setCachedRowCenter(rowCenter); setCachedRowSpan(rowSpan);   // 다음번 updateCameraOnly()가 재사용할 수 있게 캐시
  seatCameraMod().applyCameraAndCanvas(rowCenter, rowSpan);
}

return {
  layoutSeatRow,
  seatHalfWidth,
  slotIndexAt,
  usesRoomGap,
};
}

const api = { createSeatLayout };
if(typeof window !== 'undefined') window.TwSeatLayout = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
