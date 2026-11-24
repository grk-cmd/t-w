/* move-mode.js — ✥ 프로그램 이동 모드 · 🩺 캐릭터 화면 좌표(앱 FSD · app.js 분리 M19)
   app.js 의 «렌더러 생존 신호 · 캐릭터 화면 좌표» 값들(_charBoundsLatest · _charBadWhy · _charProjSane · _twMoveSeenAt)과 «프로그램 이동 모드»(moveMode 깃발 셋 · bindMoveMode)를 글 그대로 옮긴 모듈이다. 동작은 옛 자리와 같다(다시 대입되는 값은 읽는 함수 · 쓰는 함수로 내놓는다).
   ・책임: moveMode(이동 중인가) · _moveModeJustToggled(버튼 직후 — 시작점을 새로 잡게) · _suppressNextContextMenu(우클릭 확정 직후 contextmenu 1회 무시) · bindMoveMode(mousemove 로 카메라 pan 이동 · pointerdown(capture)으로 확정 · 위치 저장 · 상태칩 즉시 갱신) · _charBoundsLatest(마지막으로 계산된 내 캐릭터 화면 좌표 — 펜 근접 판정에 재사용) · _charBadWhy(좌표가 못 믿을 때의 이유 한 줄) · _charProjSane(투영 결과가 쓸 만한가) · _twMoveSeenAt(mousemove 도착 시각 — 하트비트로 main 에 보냄).
   ・내놓는 것: _charProjSane(함수) · 값 여섯은 읽는 함수(이름()) · 쓰는 함수(set이름) — app.js · 다른 모듈은 deps 로 읽는 · 쓰는 함수를 넘긴다.
   ⚠️ 모듈을 만들 때 mousemove · pointerdown 듣기가 한 번 걸린다(옛 자리와 같은 때). 확정 pointerdown 은 capture 로 클릭 통과 로직보다 먼저 잡는다 — 바꾸지 말 것.
   검사: checks/sim-move-mode.js */
(function(){

function createMoveMode(deps){
const charPlaceMod = deps.charPlaceMod;
const clampDeskPan = deps.clampDeskPan;
const layoutSeats = deps.layoutSeats;   // 함수
const saveCharPos = deps.saveCharPos;
const statusChipMod = deps.statusChipMod;
const toast = deps.toast;   // 함수
/* ═══ 🩺 렌더러 생존 신호 · 캐릭터 화면 좌표 ═══ */
// ── 스마트 감지용 throttle timestamp (companion.setCharBounds 호출 제한) ──
//   초당 60번 IPC보다 100ms 간격이 훨씬 가볍고, 판정 정확도는 그대로 유지됨(사람 마우스 이동 속도 대비 충분).
/* ── 🩺 렌더러 생존 신호 (main.js '클릭 고착 안전장치'가 이걸 본다) ─────────────────
   main은 companion.setCharBounds 가 4초 끊기면 "렌더러가 멈췄다"고 판단해 클릭을 통과로
   **강제 전환**한다(main.js _guardStuckClickCapture).

   [문제] 그 신호를 updateMyStatusChipPosition 안에서 보내고 있었는데, 그 함수는
     ・내 좌석이 아직 없거나(!me — 방 입장/좌석 재구성 순간)
     ・런처/생성기/프로그램 이동 중
   이면 맨 위에서 return 한다. 그래서 **렌더러가 멀쩡히 살아 있는데도** 신호가 끊기고,
   4초 뒤 통과로 전환된다. 커서를 캐릭터에 올려 겨우 되돌려도 또 4초 뒤에 같은 일이 반복된다
   — 제보된 "조금 조작하고 나면 금방 다시 클릭이 뒤로 뚫린다"의 형태가 정확히 이것이다.
   (창은 포커스를 못 얻으므로 focus 이벤트 복구 통로도 안 열린다)

   [대응] 신호를 rAF 루프에서 떼어내 타이머로 옮긴다. 이제 이 신호의 의미는
   "캐릭터가 그려지고 있는가"가 아니라 "렌더러의 이벤트 루프가 살아 있는가"이며,
   그게 원래 안전장치가 알고 싶어 하던 것이다.
   ⚠️ 좌표는 마지막으로 계산된 값을 그대로 재사용한다(펜 근접 판정 정확도는 그대로).
     캐릭터가 없으면 화면 밖 좌표 + 반경 0 으로 보내 근접 판정에는 절대 안 걸리게 한다. */
let _charBoundsLatest = null;
/* 🧭 [2026-09-01] 위 값이 못 믿을 상태일 때의 이유 한 줄 (하트비트에 얹어 main 진단 기록으로 보낸다).
   null 이면 정상. 문자열은 구간이 시작될 때 한 번만 만든다 — 만드는 자리는 updateMyStatusChipPosition. */
let _charBadWhy = null;
/* 투영 결과가 쓸 만한가. run 오버레이는 화면을 통째로 덮으므로, 내 캐릭터가 화면 한 장 밖으로
   나가 있다는 값은 클릭 통과 판정에 쓸 수 없는 값이다(그 자리에 클릭할 방법이 없다).
   ⚠️ 여기서 걸러진 값은 '보류'가 되지 그 자체로 고쳐지지는 않는다. 화면 안이면서 틀린 값은
     이 문지기를 그냥 통과한다 — 문지기는 폭주만 막는다. */
function _charProjSane(x, y, h){
  if(!isFinite(x) || !isFinite(y) || !isFinite(h)) return false;
  const mw = Math.max(1, innerWidth), mh = Math.max(1, innerHeight);
  if(h > mh * 2) return false;                     // 화면 두 장보다 큰 캐릭터는 없다
  return x > -mw && x < mw * 2 && y > -mh && y < mh * 2;
}
/* 🩺 mousemove 도착 시각(벽시계). 아래 하트비트에 실어 main 으로 보낸다.
   [왜 필요한가] main 의 기존 생존 신호(_lastCharBoundsAt)는 **이벤트 루프가 살아 있는가**만 말해준다.
     그런데 실제 사고는 "렌더러는 멀쩡한데 mousemove 만 안 오는" 형태로 난다 —
     Electron 의 forward 전달이 Windows 에서 끊기는 확인된 상류 버그가 있다
     (electron#30808 · #33281). 그러면 마지막 판정값이 그대로 굳는데, 그 값이 하필
     '클릭 받는 중'이면 전체화면 투명 오버레이가 계속 클릭을 가로챈다.
   ⚠️ 아래 _noteChannelAlive() 가 이 값을 갱신한다. 그쪽을 지우면 이 신호도 같이 죽는다. */
let _twMoveSeenAt = 0;
let moveMode=false;   // "프로그램 이동" 진행 중 여부 (true면 캐릭터가 마우스를 따라다니다 클릭으로 확정)
let _suppressNextContextMenu=false;   // 이동 모드를 우클릭으로 확정한 직후, 뒤이어 뜨는 contextmenu 1회를 무시하기 위한 플래그
let _moveModeJustToggled=false;   // 버튼 클릭 직후 신호 — bindMoveMode가 시작점을 새로 잡게 함
/* ═══ ✥ 프로그램 이동 모드 ═══ */
/* 프로그램 이동 모드 — 마우스를 따라 화면 전체(카메라 pan)가 이동, 클릭하면 확정.
   카메라 각도는 고정한 채 평행이동만 하므로 앵글이 안 흔들리고, 상태칩도 camera 기준 재계산이라 정확히 따라옴.
   deskPanX/Y는 화면 비율(단위 없음) — 마우스 이동 픽셀 ÷ 창 크기. 실행 화면 캔버스 = 창 크기라 월드 환산 없이 1:1 로 따라온다. */
(function bindMoveMode(){
  let startClientX=0, startClientY=0, startPanX=0, startPanY=0;
  let _moveStarted=false;
  window.addEventListener('mousemove', e=>{
    if(!moveMode) return;
    if(!_moveStarted || _moveModeJustToggled){
      _moveStarted=true; _moveModeJustToggled=false;
      startClientX=e.clientX; startClientY=e.clientY; startPanX=charPlaceMod.deskPanX(); startPanY=charPlaceMod.deskPanY();
      return;
    }
    const dxPix = e.clientX - startClientX, dyPix = e.clientY - startClientY;
    // 픽셀 이동량을 캔버스 크기 대비 "비율"로 변환 — 캐릭터 크기(focusCharScale)가 바뀌어도 위치 비율이 안 틀어짐.
    // run 모드는 canvasW===innerWidth, canvasH===innerHeight. 마우스 오른쪽/아래 → 캐릭터도 화면상 오른쪽/아래로 보이게 부호 반전.
    let nx = startPanX - dxPix/Math.max(1, innerWidth);
    let ny = startPanY + dyPix/Math.max(1, innerHeight);
    const _clamped = clampDeskPan(nx, ny);
    charPlaceMod.setDeskPanX(_clamped.x);
    charPlaceMod.setDeskPanY(_clamped.y);
    layoutSeats();
    statusChipMod.updateMyStatusChipPosition();   // 렌더 루프(frame) 대기 없이 즉시 갱신 — 도트렌더 등으로 프레임이 느려져도 상태칩은 안 밀리게
  });
  window.addEventListener('pointerdown', e=>{
    if(!moveMode) return;
    moveMode=false; _moveStarted=false;
    const moveBtn=document.getElementById('fsMoveBtn'); const moveHint=document.getElementById('fsMoveHint');
    if(moveBtn){ moveBtn.classList.remove('active'); moveBtn.textContent='프로그램 이동'; }
    if(moveHint) moveHint.style.display='none';
    const myMove=document.getElementById('myMoveBtn'); if(myMove) myMove.classList.remove('on');   // 상태칩의 이동 버튼 시각적 활성 해제
    // 우클릭으로 확정한 경우, 바로 뒤이어 뜨는 contextmenu 이벤트가 캐릭터 우클릭 동작(런처 이동 등)으로
    // 이어지지 않게 한 번 억제 — 안 그러면 확정 클릭이 그 자리의 캐릭터를 우클릭한 걸로도 처리돼버림.
    if(e.button===2) _suppressNextContextMenu = true;
    saveCharPos();   // ★ 껐다 켜도 유지되게 위치 확정 시 저장
    statusChipMod.updateMyStatusChipPosition();   // 상태칩 즉시 재표시
    toast('위치가 확정됐어요');
  }, true);   // capture: 클릭통과 로직보다 먼저 잡아서 이동 확정
  // 이동 시작 트리거는 moveBtn 클릭 시점(bindFocusSettings)에서 moveMode=true로 바뀌자마자 다음 mousemove에서 자동 시작됨
})();

return {
  _charBoundsLatest: ()=>_charBoundsLatest,
  setCharBoundsLatest: (v)=>{ _charBoundsLatest = v; },
  _charBadWhy: ()=>_charBadWhy,
  setCharBadWhy: (v)=>{ _charBadWhy = v; },
  _charProjSane,
  _twMoveSeenAt: ()=>_twMoveSeenAt,
  setTwMoveSeenAt: (v)=>{ _twMoveSeenAt = v; },
  moveMode: ()=>moveMode,
  setMoveMode: (v)=>{ moveMode = v; },
  _suppressNextContextMenu: ()=>_suppressNextContextMenu,
  setSuppressNextContextMenu: (v)=>{ _suppressNextContextMenu = v; },
  _moveModeJustToggled: ()=>_moveModeJustToggled,
  setMoveModeJustToggled: (v)=>{ _moveModeJustToggled = v; },
};
}

const api = { createMoveMode };
if(typeof window !== 'undefined') window.TwMoveMode = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
