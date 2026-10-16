/* seat-layout.js — 🪑 좌석 줄 배치 — 책상 폭을 재서 좌석마다 자리(targetX)를 잡고 줄 가운데 · 폭을 카메라에 넘긴다
   책임: 좌석 줄 자리 계산 하나 — 평준화 반영 → 맨 오른쪽 고정 → 이동 오프셋 다시 검사 → 책상과 책상 사이 여백을 일정하게 targetX → 줄 가운데 · 폭을 캐시하고 카메라 모듈에 넘김.
   받는 deps: seats(값) · _rideBottom(ride-chain.js) · syncSeatEqualize · renderSeatTabs · clampDeskPan · seatDeskHalfWidth(함수) · roomSeatMode · deskPanX/Y · SPACING · MULTIPLAYER_SPACING · seatCameraMod(읽는 함수) · setDeskPanX/Y · setCachedRowCenter/Span(쓰는 함수).
   내보내는 것: layoutSeatRow() — app.js 의 layoutSeats() 가 부른다.
   ⚠️ 이름이 layoutSeats 가 아닌 까닭: app.js 맨 아래 «데스크탑 창 크기» 가 layoutSeats 를 감싸 다시 대입한다(앱 FSD 32번). 그래서 app.js 에 같은 이름의 얇은 함수를 남겨 두고,
      모든 부르는 곳 · 다른 모듈 deps 는 예전처럼 그 이름을 본다 — 감싼 판이 그대로 불린다.
   app.js «🪑 좌석 배치(layoutSeats) · 카메라 · 도트 텍스처 필터» 구역의 layoutSeats 본문을 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 함수 이름만 layoutSeats → layoutSeatRow · 옛 이야기형 주석은 «왜 · 함정» 으로 줄임). 바뀐 코드 줄은 6줄 — rideBenchMod._rideBottom 을 _rideBottom(ride-chain.js 를 deps 로 — 올라타기 모듈과 순환을 안 만들게)으로 부르고,
     MULTIPLAYER_SPACING · SPACING · deskPanX · deskPanY · roomSeatMode · seatCameraMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setCachedRowCenter · setCachedRowSpan · setDeskPanX · setDeskPanY(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 4개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: layoutSeatRow — app.js 는 seatLayoutMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwSeatLayout — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
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
const seatDeskHalfWidth = deps.seatDeskHalfWidth;
const seats = deps.seats;
const syncSeatEqualize = deps.syncSeatEqualize;
const setCachedRowCenter = deps.setCachedRowCenter;   // 쓰는 함수
const setCachedRowSpan = deps.setCachedRowSpan;   // 쓰는 함수
const setDeskPanX = deps.setDeskPanX;   // 쓰는 함수
const setDeskPanY = deps.setDeskPanY;   // 쓰는 함수
const ROW_SPAN_MIN = 1.2;   // 카메라 줌용 줄 폭 하한 — 혼자일 때도 이만큼은 비춘다
function layoutSeatRow(){
  /* 🪑 좌석 간격·카메라 줌은 바로 아래에서 **책상 폭을 실측**한다. 평준화로 책상이 커지거나
     작아졌다면 그 전에 반영돼 있어야 간격이 한 박자 늦지 않는다. 바뀐 좌석이 없으면 숫자 비교뿐이다. */
  syncSeatEqualize();
  // 🪑 맨 오른쪽 고정이면 방에서 나를 0번(맨 오른쪽)으로 — 다른 사람이 들어온 뒤에도(seat-pin.js)
  if(window.TwSeatPin && TwSeatPin.pinFirst(seats, roomSeatMode())) renderSeatTabs();
  // ★ 인원이 바뀔 때마다 이동 오프셋을 안전 범위로 다시 당긴다 — 구석에 걸어 둔 채 인원이 늘면 화면 밖으로 밀린다.
  { const _c = clampDeskPan(deskPanX(), deskPanY()); setDeskPanX(_c.x); setDeskPanY(_c.y); }
  const hasRemote = seats.some(s=>s.remote);   // 실제 친구가 있으면(멀티모드) 더 좁은 간격 사용
  const spacing = hasRemote ? MULTIPLAYER_SPACING() : SPACING();
  // ★ SPACING · MULTIPLAYER_SPACING 은 «책상과 책상 사이 여백» — 책상 반폭을 실측해 크기가 달라도 여백이 일정하다.
  /* 🐾 남의 머리에 올라탄 좌석(탑 사슬 전체)은 자리 계산에서 뺀다 — 숨긴 책상이 기본 폭 0.85 로 빈자리를 잡지 않게.
     실제 위치는 _positionRideSeat 이 매 프레임 덮어쓴다.
     ⚠️ seats 배열의 순서 · 내용은 건드리지 않는다(좌석 탭 · 슬롯 드래그가 인덱스를 쓴다). 카메라 줌도 같은 placed 목록을 본다. */
  const halfWidths = seats.map(seatDeskHalfWidth);
  const _hwOf = new Map(seats.map((s,i)=>[s, halfWidths[i]]));
  const placed = seats.filter(s=>!s.ridingOn);
  placed.forEach((s,i)=>{
    if(i===0){ s.targetX = 0; return; }   // 맨 오른쪽 고정
    const prev = placed[i-1];
    s.targetX = prev.targetX - (_hwOf.get(prev) + spacing + _hwOf.get(s));
  });
  /* 올라탄 좌석에는 자기 탑 바닥의 자리를 그대로 물려준다 — 옛 값이 남으면
     _positionRideSeat 의 UI 앵커(host.targetX 를 읽는다)가 엉뚱한 자리를 가리킨다. */
  seats.forEach(s=>{ if(s.ridingOn){ const b=_rideBottom(s); s.targetX = (b && b.targetX) || 0; } });
  const xs = placed.map(s=>s.targetX);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const rowCenter = (minX+maxX)/2;
  const leftIdx = xs.indexOf(minX), rightIdx = xs.indexOf(maxX);
  const halfWidthsForZoom = placed.map(s=>seatDeskHalfWidth(s, true));   // 카메라 줌은 상한선 적용된 값 사용(유난히 큰 책상 하나가 전체를 과하게 줌아웃시키지 않게)
  const rowSpan = Math.max(ROW_SPAN_MIN, (maxX-minX) + halfWidthsForZoom[leftIdx] + halfWidthsForZoom[rightIdx]);   // 카메라 줌 계산용 전체 폭(책상 폭까지 포함)
  setCachedRowCenter(rowCenter); setCachedRowSpan(rowSpan);   // 다음번 updateCameraOnly()가 재사용할 수 있게 캐시
  seatCameraMod().applyCameraAndCanvas(rowCenter, rowSpan);
}

return {
  layoutSeatRow,
};
}

const api = { createSeatLayout };
if(typeof window !== 'undefined') window.TwSeatLayout = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
