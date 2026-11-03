/* status-chip.js — 📍 상태칩 자리 · 칩 클릭 · Tab 접기 · 📐 상태칩 팝업 · 입력창 자리 계산 · 🫧 상태 이모지 그림 · UI 아이콘
   app.js «📍 상태칩 자리 · 칩 클릭 · Tab 접기» · «📐 상태칩 팝업 · 입력창 자리 계산 · 캐릭터 실측» · «🫧 상태 이모지 그림 · UI 아이콘 · 책상 위 이모지» 세 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 36번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 33줄 —
     Presence · _charBadWhy · _charBoundsLatest · _danceCmdCooldownAt · _moveModeJustToggled · _officeHidden · chatUiMod · customStatusConf · moveMode · overheadMod · userStatus 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setCharBadWhy · setCharBoundsLatest · setDanceCmdCooldownAt · setMoveModeJustToggled · setMoveMode(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 11개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다). 마이홈 시작(initMyHome)은 여기서 안 부른다 — app.js INIT 에서 한 번.
     저장된 상태 불러오기 · 칩 첫 그리기 · 캐릭터 크기 복원도 여기서 안 부른다 — app.js 의 만드는 줄 바로 뒤에서(만드는 도중엔 statusChipMod 가 아직 없어 refreshMyStatusUI 가 던진다).
   ★ 밖에서 부르는 이름: _positionInputBelowChar · _repositionOpenChipPopups · _tabHintTimer · _wpTmp3 · hexToRgba · setSeatDeskEmoji · uiIconEl · updateMyStatusChipPosition — app.js 는 statusChipMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwStatusChip — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-status-chip.js */
(function(){

function createStatusChip(deps){
const CUSTOM_STATUS_MAXLEN = deps.CUSTOM_STATUS_MAXLEN;
const Presence = deps.Presence;   // 읽는 함수
const _CHIP_POPUPS = deps._CHIP_POPUPS;
const _charBadWhy = deps._charBadWhy;   // 읽는 함수
const _charBoundsLatest = deps._charBoundsLatest;   // 읽는 함수
const _charProjSane = deps._charProjSane;
const _closeChipPopups = deps._closeChipPopups;
const _danceCmdCooldownAt = deps._danceCmdCooldownAt;   // 읽는 함수
const _lowestDanceReq = deps._lowestDanceReq;
const _moveModeJustToggled = deps._moveModeJustToggled;   // 읽는 함수
const _officeHidden = deps._officeHidden;   // 읽는 함수
const _pickUnlockedDance = deps._pickUnlockedDance;
const _premiumOn = deps._premiumOn;
const _rollRoulette = deps._rollRoulette;
const backToLauncher = deps.backToLauncher;
const camera = deps.camera;
const chatUiMod = deps.chatUiMod;   // 읽는 함수
const customStatusConf = deps.customStatusConf;   // 읽는 함수
const measureBodyBox = deps.measureBodyBox;
const moveMode = deps.moveMode;   // 읽는 함수
const overheadMod = deps.overheadMod;   // 읽는 함수
const renderer = deps.renderer;
const rideBenchMod = deps.rideBenchMod;
const saveCustomStatusConf = deps.saveCustomStatusConf;
const seats = deps.seats;
const setUserStatus = deps.setUserStatus;
const startMyDance = deps.startMyDance;
const toast = deps.toast;
const userStatus = deps.userStatus;   // 읽는 함수
const setCharBadWhy = deps.setCharBadWhy;   // 쓰는 함수
const setCharBoundsLatest = deps.setCharBoundsLatest;   // 쓰는 함수
const clickPolicy = deps.clickPolicy;   // 클릭 통과 판단 규칙(click-through-policy.js) — 캐릭터 영역을 main 에 보낼지
const setDanceCmdCooldownAt = deps.setDanceCmdCooldownAt;   // 쓰는 함수
const setMoveModeJustToggled = deps.setMoveModeJustToggled;   // 쓰는 함수
const setMoveMode = deps.setMoveMode;   // 쓰는 함수
function hexToRgba(hex,a){ const n=hex.replace('#',''); const r=parseInt(n.substr(0,2),16),g=parseInt(n.substr(2,2),16),b=parseInt(n.substr(4,2),16); return `rgba(${r},${g},${b},${a})`; }
/* ── 세로 배열 A안 팝업 위치 계산 ──────────────────────────────────────
   상태·더보기 캐스케이드 메뉴는 세로 툴바 옆으로 튀어나옴. 툴바가 캐릭터 좌/우 어디에 있든
   자연스럽게 캐릭터 반대편(=화면에서 여유가 있는 쪽)으로 열리도록 "여유 넓은 쪽 우선" 로직.
   채팅·알림 입력창은 캐릭터 발 밑에 좌우 반전 없이 배치 — 상태칩 왼쪽 가장자리부터 캐릭터를 아우르는 폭.
   ── 모두 hidden 체크로 early return → 매 프레임 호출해도 오버헤드 없음. */
function _positionCascade(menuEl, anchorBtn, preferSide){
  if(!menuEl || !anchorBtn) return;
  if(menuEl.classList.contains('hidden')) return;
  const btnRect = anchorBtn.getBoundingClientRect();
  const menuW = menuEl.offsetWidth  || 150;
  const menuH = menuEl.offsetHeight || 100;
  const spaceLeft  = btnRect.left;
  const spaceRight = innerWidth - btnRect.right;
  let placement;
  if(preferSide === 'right' || preferSide === 'left'){
    // 😊 선호 방향 고정 모드 — 항상 그쪽에 열고, 벽에 닿아 공간이 부족할 때만 반대편으로 반전.
    //   히스테리시스: 한 번 반전되면 원래 방향에 여유(menuW+30)가 다시 생겨야 복귀 —
    //   캐릭터가 경계에서 움직일 때 팔레트가 좌우로 파닥거리지 않게(상태칩의 _lastChipPlaceRight와 같은 기법).
    const wantR = (preferSide === 'right');
    const primary  = wantR ? spaceRight : spaceLeft;
    const opposite = wantR ? spaceLeft  : spaceRight;
    let flipped = menuEl._cascadeFlipped === true;
    if(!flipped && primary < menuW + 6 && opposite >= menuW + 6) flipped = true;
    else if(flipped && primary >= menuW + 30) flipped = false;
    menuEl._cascadeFlipped = flipped;
    placement = (wantR !== flipped) ? 'right' : 'left';
  } else {
    // 기존 동작(여유가 넓은 쪽 우선) — 상태/더보기 메뉴는 그대로.
    placement = (spaceRight >= spaceLeft) ? 'right' : 'left';
    if(placement === 'right' && spaceRight < menuW + 6 && spaceLeft >= menuW + 6) placement = 'left';
    else if(placement === 'left' && spaceLeft < menuW + 6 && spaceRight >= menuW + 6) placement = 'right';
  }
  const left = (placement === 'left') ? (btnRect.left - menuW - 2) : (btnRect.right + 2);
  // top: 버튼과 나란히, 화면 아래로 넘치면 위로 올림
  let top = btnRect.top;
  if(top + menuH > innerHeight - 8) top = innerHeight - menuH - 8;
  if(top < 8) top = 8;
  menuEl.style.left = left + 'px';
  menuEl.style.top  = top + 'px';
  menuEl.style.right = 'auto';
  menuEl.style.bottom = 'auto';
}
/* 🎪 화면 UI(상태칩·메뉴·입력창)가 쓸 '기준 위치'.
   상태칩 → 열려있는 상태/더보기 메뉴(_positionCascade) → 채팅·커스텀상태 입력창이 모두 이 값을 기준으로
   매 프레임 다시 배치된다(_repositionOpenChipPopups가 updateMyStatusChipPosition 끝에서 호출됨). */
/* ★ 올라탄 동안 상태칩·메뉴·입력창이 캐릭터를 따라 올라갈지.
   true  = 따라감(요청사항). 머리 위로 올라간 자리에 칩이 붙는다.
   false = 예전 동작. 바닥의 원래 자리(targetX)에 고정.
   되돌리려면 이 값만 false로. */
const UI_FOLLOW_WHILE_RIDING = true;
/* 📏 상태칩 배치용 캐릭터 실측 — 좌석 원점(발밑) 기준 키(topY)와 반폭(halfW)을 월드 단위로 잰다.
   ・책상은 빼고 몸(bodyWrap)만 잰다 — 책상을 포함하면 칩이 책상 폭만큼 밀려난다.
   ・Box3.setFromObject는 매 프레임 돌리기엔 무거워서 400ms 캐시.
   ・숨쉬기·흔들기 애니메이션으로 값이 미세하게 떠는 걸 막으려고 4% 이내 변화는 이전 값을 유지한다. */
const _CHIP_METRIC_MS = 400;
/* 줄어든 측정값을 받아들이기까지의 유예(ms).
   ⚠️ **애니메이션 한 주기보다 길어야 한다.** 짧으면 느린 숨쉬기 모션에서 값이 다시 오르내린다
      (하네스 실측: 유예 1600ms일 때 주기 2000·3000ms 모션이 그대로 진동했다).
   반대로 이 시간만큼은 '실제로 작아진' 것도 늦게 반영된다. 월드 단위 측정이라 캐릭터 크기
   슬라이더(focusCharScale)는 여기 영향을 주지 않고, 실제 축소는 파츠를 뺄 때 정도라 4초 지연은 무해하다. */
const CHIP_METRIC_HOLD_MS = 4000;
const _chipOriginTmp = new THREE.Vector3();
const _chipBoxTmp = new THREE.Box3();
/* ★ 보이는 '몸' 메시만 잰다(measureBodyBox — 숨은 것 · 꾸미기 파츠 · 리깅 파츠 빼기).
   bodyWrap 에는 숨은 기본 도형 placeholder 가 남아 있고(r128 setFromObject 는 숨은 것도 센다),
   잘못 붙은 파츠가 늘어나면 그 박스가 "캐릭터 크기" 가 되어 상태칩이 구석으로 날아갔다.
   selfOnly · updateWorld:false — 400ms 마다 도는 옛 방식 그대로(메시 자기 도형만 · 행렬은 렌더가 세운 값). */
const CHIP_BODY_OPTS = { excludeParts: true, visibleOnly: true, selfOnly: true, updateWorld: false };
function _chipCharMetrics(seat){
  const now = performance.now();
  const prev = seat._chipMetrics;
  if(prev && now - prev.t < _CHIP_METRIC_MS) return prev;
  let topY = 1.45, halfW = 0.30;   // 한 번도 못 재봤을 때만 쓰는 폴백(기존 상수와 동일)
  let measured = false;
  try{
    const target = seat.bodyWrap || seat.rig || seat.gltfRoot;
    if(target){
      const box = _chipBoxTmp.makeEmpty();
      if(target.visible !== false) measureBodyBox(target, CHIP_BODY_OPTS, box);   // 숨긴 몸은 통째로 빈다(아래 «직전 값 유지»)
      if(!box.isEmpty()){
        /* ★ 원점(seat.group)을 빼는 대신 **박스 자신의 크기**로 잰다.
           캐릭터를 드래그(shake)하면 pointermove 가 seat.rig.position 만 움직이고 seat.group 은
           제자리에 남는다. 그 상태에서 group 기준으로 재면 박스가 통째로 떨어져 나간 것처럼 보여
           topY/halfW 가 폭주하고, 바로 아래 상한(2.0 / topY*0.6)에 걸린다 ⇒ 상태칩이 화면 끝으로
           날아가고 경험치 바가 최대 길이로 늘어난다(바 폭도 halfW로 계산된다).
           높이·폭은 평행이동에 영향받지 않으므로 이렇게 재면 드래그 중에도 값이 그대로다.
           ⚠️ 정지 상태 값은 기존과 사실상 같다 — 발이 seat 원점에 있어 box.min.y ≈ origin.y 이고,
              halfW 도 좌우 대칭인 캐릭터에서는 동일하다. 그래서 눈으로 맞춘 상수(GAP 등)는
              재보정할 필요가 없다(1-3). */
        topY  = Math.max(0.2,  box.max.y - box.min.y);
        halfW = Math.max(0.05, (box.max.x - box.min.x) * 0.5);
        measured = true;
      }
    }
  }catch(_){}
  /* ★ 못 쟀을 때는 폴백 상수로 **내려가지 말고 직전 값을 그대로 유지**한다.
     🫧 자리비움은 setSeatOpacity가 몸 메쉬의 visible을 false로 만드는데(영혼 연출),
     몸 재기는 안 보이는 노드를 통째로 건너뛰므로 박스가 빈다. 예전엔 그 순간
     폴백 1.45/0.30 으로 튀면서 상태칩과 경험치 바가 이동했다 — 사람은 우연히 값이 비슷해
     티가 덜 나지만 동물·치비 캐릭터는 크게 어긋난다. 자리비움이 풀리면 다시 재기 시작한다. */
  if(!measured && prev){ prev.t = now; return prev; }
  // ★ 안전장치 — 파츠가 잘못 리깅돼 메쉬가 비정상적으로 늘어나면 바운딩박스가 폭주해서
  //   상태칩이 화면 밖으로 날아간다. 캐릭터가 취할 수 있는 현실적인 범위로 자른다.
  //   (사람 ≈ 1.45 / 동물 ≈ 0.56, 모자·날개 여유를 감안해도 2.2를 넘을 일은 없다.)
  //   이제 '몸'만 재므로 상한을 현실적인 값으로 좁힐 수 있다(사람 ≈1.45 / 동물 ≈0.56).
  topY  = Math.min(topY, 2.0);
  halfW = Math.min(halfW, topY * 0.6);   // 키 대비 반폭이 60%를 넘는 캐릭터는 없다
  /* ★ 떨림 억제 — 바운딩박스는 **애니메이션에 따라 매 프레임 달라진다**(숨쉬기·팔 흔들기·드래그·춤).
     예전의 4% 데드밴드로는 못 막았다. 실제 진폭이 그보다 커서, 400ms마다 큰 값과 작은 값을
     번갈아 채택하며 상태칩이 좌우로 흔들리고 경험치 바 길이가 늘었다 줄었다 했다
     (바 폭도 halfW로 계산된다 — 두 증상의 원인이 하나다).

     그래서 '피크 유지 + 유예 후 하향'으로 바꾼다:
       · 커지는 쪽 — 즉시 반영. 파츠를 달거나 크기를 키우면 바로 따라가야 한다.
         (단 2% 미만의 미세 증가는 무시 — 그것도 떨림이다)
       · 작아지는 쪽 — CHIP_METRIC_HOLD_MS 동안은 이전 값을 유지. 팔 흔들기 한 주기보다 길어서
         동작 중에는 값이 고정되고, 캐릭터가 **실제로** 작아졌으면 그 시간 뒤에 따라 내려간다.
     ⚠️ 측정 자체(무엇을 어떻게 재는가)는 그대로다 — 시간축 평활만 바꿨다. 그래서 GAP 같은
        눈으로 맞춘 상수는 재보정할 필요가 없다(1-3). 값이 '순간값'에서 '최근 최대값'이 될 뿐이다. */
  let topT = now, halfT = now;
  if(prev){
    if(topY >= prev.topY * 0.99){
      // ★ '피크에 다시 닿았는가'로 판정하는 게 핵심(1% 오차 허용). 진동이 매 주기 피크를 찍을 때
      //   유예 타이머가 갱신돼야 주기가 유예시간보다 길어도 값이 안 내려간다.
      //   '>' 나 '>=' 로 딱 맞춰 비교하면 피크값이 매번 미세하게 달라서 몇 주기에 한 번씩 툭 떨어진다
      //   (node 하네스로 실측 확인 — 1-12).
      if(topY < prev.topY * 1.02) topY = prev.topY;          // 미세 증가는 무시
    }else if(now - prev.topT < CHIP_METRIC_HOLD_MS){
      topY = prev.topY; topT = prev.topT;                     // 잠깐 작아진 것 — 유지
    }
    if(halfW >= prev.halfW * 0.99){
      if(halfW < prev.halfW * 1.02) halfW = prev.halfW;
    }else if(now - prev.halfT < CHIP_METRIC_HOLD_MS){
      halfW = prev.halfW; halfT = prev.halfT;
    }
  }
  seat._chipMetrics = { t: now, topY, halfW, topT, halfT };
  return seat._chipMetrics;
}
/* ★ 올라탄 동안 상태칩·메뉴·입력창의 기준 좌석.
   [경위] 예전엔 캐릭터를 따라 머리 위까지 같이 올라갔다. 그런데 올라탄 쪽은 대개 동물이고,
     생성기에서 좌석 크기를 줄여 쓰는 경우가 많다. 칩은 CSS 픽셀 고정이라 캐릭터가 작아져도
     안 줄어들어서, 작은 동물 옆에 붙은 칩이 탑 전체를 덮어버렸다(가로·세로 배치 둘 다 · 제보).
   [지금] 탑에 속해 있으면 **그 탑의 바닥 캐릭터**를 기준으로 놓는다. 바닥은 보통 사람이라
     칩이 들어갈 폭이 나오고, 탑은 그 위로 뻗으므로 서로 안 겹친다.
     탑에 안 속해 있으면 예전과 완전히 같다(= 혼자 있을 때 동작은 하나도 안 바뀐다).
   ⚠️ 위치뿐 아니라 **실측(_chipCharMetrics)도 같은 좌석으로 맞춰야** 한다. 위치만 바닥으로 옮기고
     폭을 올라탄 동물 기준으로 재면, 사람 몸 위에 칩이 겹쳐 놓인다. */
function _uiAnchorSeat(seat){
  if(!seat) return seat;
  return (UI_FOLLOW_WHILE_RIDING && seat.ridingOn) ? rideBenchMod._rideBottom(seat) : seat;
}
function _uiAnchorWorld(seat, out){
  const base = _uiAnchorSeat(seat);
  if(seat && seat.ridingOn){
    if(!UI_FOLLOW_WHILE_RIDING){
      // 예전 동작 — 바닥의 원래 자리에 고정.
      out.set(seat.targetX || 0, 0, 0);
      if(seat.group && seat.group.parent) seat.group.parent.localToWorld(out);
      return out;
    }
    if(base && base !== seat && base.group){ base.group.getWorldPosition(out); return out; }
    if(seat._uiAnchor){ out.copy(seat._uiAnchor); return out; }   // 바닥을 못 찾았을 때의 폴백
  }
  seat.group.getWorldPosition(out);
  return out;
}
function _positionInputBelowChar(inputEl){
  if(!inputEl) return;
  if(inputEl.classList.contains('hidden')) return;
  // 캐릭터 발 밑 화면 좌표 — me.group을 project (상태칩 위치 계산과 동일 방식, 여기선 y 오프셋 없이 원점 근처).
  const me = seats.find(s=>s.isMe);
  if(!me) return;
  _uiAnchorWorld(me, _wpTmp);   // 올라탄 동안엔 제자리 기준(위 헬퍼 주석 참고)
  _wpTmp.y -= 0.05;   // 발 아래 살짝
  _wpTmp.project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  const cx = rect.left + (_wpTmp.x * 0.5 + 0.5) * rect.width;
  const cy = rect.top + (-_wpTmp.y * 0.5 + 0.5) * rect.height;
  // ★ 캐릭터 중심(cx)에 좌우 정렬 — 상태칩 왼쪽 기준이었을 때 캐릭터 오른쪽으로 튀어나가던 문제 수정.
  //   레벨/닉네임 이름표 바로 아래에 오도록 캐릭터 중앙에 위치.
  const inputW = inputEl.offsetWidth  || 220;
  const inputH = inputEl.offsetHeight || 34;
  let left = cx - inputW/2;
  if(left + inputW > innerWidth - 8) left = innerWidth - inputW - 8;
  if(left < 8) left = 8;
  let top = cy + 8;
  if(top + inputH > innerHeight - 8) top = innerHeight - inputH - 8;
  if(top < 8) top = 8;
  inputEl.style.left = left + 'px';
  inputEl.style.top  = top + 'px';
  inputEl.style.right = 'auto';
  inputEl.style.bottom = 'auto';
}
/* 캐스케이드 메뉴 배치 — **열릴 때와 창 크기가 바뀔 때만** 부른다.
   ⚠️ 매 프레임 부르면 안 된다. 상태칩은 캐릭터 발 밑을 매 프레임 따라가고, 캐릭터는 가만히 서
      있어도 숨쉬기 모션 때문에 화면 좌표가 계속 미세하게 흔들린다. 열려 있는 메뉴까지 그 좌표를
      다시 받으면 메뉴가 캐릭터와 함께 떨린다(실제로 그렇게 보였다). 메뉴는 열린 자리에 서 있어야 한다.
      캐릭터를 따라가야 하는 것은 상태칩 자신과 '발 밑' 입력창뿐 — 그건 _repositionOpenChipInputs 로 분리했다. */
function _repositionOpenChipPopups(){
  const statusBtn = document.getElementById('myStatusChipBtn');
  const moreBtn   = document.getElementById('myChipMoreBtn');
  _positionCascade(document.getElementById('myStatusMenu'), statusBtn);
  _positionCascade(document.getElementById('myChipMore'),   moreBtn, 'right');   // ▼ 더보기 — 우측 우선, 벽 근처에서만 좌측 반전
  _positionCascade(document.getElementById('myDemojiBox'),  document.getElementById('myDemojiBtn'), 'right');   // 😊 팔레트 — 우측 우선, 벽 근처에서만 좌측 반전
  // 🎵 플레이리스트는 유저가 타이틀바로 옮겨둔 자리가 있으면 그 자리를 쓴다(캐스케이드로 덮으면 옮긴 게 튕겨나간다).
  //   _plHasSavedPos/_plApplyPos 는 playlist.js 가 만들 때 거는 window 고리다 — 만들기 전(이 함수가 더 위에 선언)이면 typeof 로 건너뛴다.
  if(typeof _plHasSavedPos === 'function' && _plHasSavedPos()) _plApplyPos();
  else _positionCascade(document.getElementById('myPlaylistBox'), document.getElementById('myPlBtn'), 'right');
  _repositionOpenChipInputs();
}
/* 매 프레임용 — 캐릭터 발 밑에 붙는 입력창만. 이건 '발 밑'이 기준이라 따라가는 게 맞는 동작이다. */
function _repositionOpenChipInputs(){
  _positionInputBelowChar(document.getElementById('myChatBox'));
  _positionInputBelowChar(document.getElementById('myCustomStatusBox'));
}
// 창 크기가 바뀌면 열려 있는 메뉴가 화면 밖으로 밀릴 수 있으므로 그때는 다시 잡아준다.
addEventListener('resize', ()=>{ try{ _repositionOpenChipPopups(); }catch(_){} });

let _lastChipPlaceRight = true;   // 상태칩 좌우 반전 히스테리시스 — 방향이 매 프레임 튀지 않게 마지막 판정을 기억

/* 칩 위치를 매 프레임 자기 좌석 발 밑(화면 좌표)에 맞춤. 설정 패널이 열려있으면 그 위치도 같이 갱신. */
const _wpTmp=new THREE.Vector3();
const _wpTmp2=new THREE.Vector3();
const _wpTmp3=new THREE.Vector3();
/* 🖊️ 남의 좌석 자리(화면 원) — main 이 펜 앱이 앞일 때 «우리 창 근처» 를 판단하는 재료(_checkCursorNearChar).
   펜 앱에서는 forward 를 꺼서 렌더러가 mousemove 를 못 받으므로, 이 원이 없으면 남의 캐릭터 · 책상을 펜으로 눌러도 클릭이 펜 앱으로 샌다.
   내 캐릭터 원과 같은 방식(발밑 · 머리 끝 투영 · 실측 키 캐시)이고 책상까지 덮게 반경은 키의 1.2배. 투영이 터진 좌석은 뺀다. */
const OTHER_SEAT_MAX = 24;   // 하트비트(10Hz)에 싣는 수 상한
const _osTmp = new THREE.Vector3(), _osTmp2 = new THREE.Vector3();
function otherSeatCircles(){
  if(!clickPolicy.charHittable({ officeHidden: _officeHidden() })) return [];
  const rect = renderer.domElement.getBoundingClientRect();
  const out = [];
  for(let i = 0; i < seats.length && out.length < OTHER_SEAT_MAX; i++){
    const s = seats[i];
    if(s.isMe || !s.group || s.group.visible === false) continue;
    _uiAnchorWorld(s, _osTmp);
    const m = _chipCharMetrics(_uiAnchorSeat(s) || s);
    _osTmp2.copy(_osTmp); _osTmp2.y += m.topY;
    _osTmp.project(camera); _osTmp2.project(camera);
    const x = rect.left + (_osTmp.x * 0.5 + 0.5) * rect.width;
    const yFeet = rect.top + (-_osTmp.y * 0.5 + 0.5) * rect.height;
    const yTop = rect.top + (-_osTmp2.y * 0.5 + 0.5) * rect.height;
    const h = Math.abs(yFeet - yTop), y = (yFeet + yTop) / 2;
    if(!_charProjSane(x, y, h)) continue;
    out.push({ x: Math.round(x), y: Math.round(y), r: Math.round(Math.max(110, h * 1.2)) });
  }
  return out;
}
/* ★ 세로 배치 상태칩의 높이 조절점 — 이 값 하나.
   캐릭터 '머리 끝'에서 키의 몇 %를 내려온 지점을 툴바 맨 위로 삼는다.
   줄이면 올라가고(0 = 머리 끝과 같은 높이), 키우면 내려간다.
   ★ 비율이라 커미션·동물·파츠로 덩치가 달라져도 같은 자리로 보인다 —
     px 상수로 바꾸면 캐릭터 크기를 키울 때마다 어긋난다(예전에 그 문제로 실측 방식으로 바꿨다).
   (가로 배치 높이는 경험치 바 아래에 자동으로 붙으므로 EXP_BAR_GAP으로 조절한다) */
const CHIP_VERT_TOP_RATIO = 0.25;   // 0.41(어깨) → 0.32로 조금 올림
/* ★ 캐릭터와 칩 사이 여백을 **캐릭터 실측 반폭의 몇 %**로 잡는다 — 이 값 하나.
   [경위] 여백이 6px 고정이라 캐릭터를 키우면 그 6px 만 안 커졌다. 크기 슬라이더(focusCharScale)는
     모델을 키우는 게 아니라 **카메라를 당기므로**(applyCameraAndCanvas 의 dist / focusCharScale)
     화면상 캐릭터가 커진 만큼 실루엣도 같이 커지는데, 여백만 그대로라 상대적으로 붙는다.
     게다가 실측 박스는 **파츠를 일부러 뺀 '몸'만**이므로(CHIP_BODY_OPTS) 모자·머리카락·날개는
     그 밖으로 튀어나온다. 몸 옆 6px 자리는 작을 땐 몇 px 만 물리지만 크면 그만큼 크게 물린다 —
     그게 "좌석이 커지면 칩이 캐릭터를 가린다"의 정체다.
   ⚠️ px 상수로 되돌리지 말 것. 크기·동물·커미션마다 다시 어긋난다(CHIP_VERT_TOP_RATIO 와 같은 이유).
   ⚠️ 이 비율은 **캐릭터 대 칩**에만 쓴다. 이름표·경험치 바를 비키는 여백은 DOM 대 DOM 이고
     그쪽은 글꼴 px 고정이라 같이 키우면 큰 캐릭터에서 칩만 멀리 날아간다 — 거기는 GAP 그대로다.
   📐 0.15 는 기본 크기(사람 반폭 ≈ 40px)에서 지금과 같은 ≈6px 이 나오는 값이다. 눈으로 맞춘
     지금 모양을 그대로 두고 커질 때만 벌어지게 한 것 — 여전히 물리면 이 숫자만 올릴 것. */
const CHIP_GAP_CHAR_RATIO = 0.15;
function updateMyStatusChipPosition(){
  const chip=document.getElementById('myStatusChip'); if(!chip)return;
  const me=seats.find(s=>s.isMe);
  // 런처(메인 화면 가림)·생성기 등에서는 숨김
  const launcherOn=document.getElementById('launcher'); const launcherVisible=launcherOn&&launcherOn.classList.contains('on');
  const creatorOn=document.getElementById('creatorOverlay'); const creatorVisible=creatorOn&&creatorOn.classList.contains('on');
  // ⭐ 경험치 바는 이제 좌석별(seat.expBarEl)이라 여기서 숨기지 않는다.
  //    런처가 뜨면 렌더 루프의 setSeatNamePlate 구간이 안 돌거나 nameplateEnabled 판정에 걸려 자동으로 숨는다.
  if(!me || launcherVisible || creatorVisible || moveMode()){
    chip.style.display='none';
    setCharBoundsLatest(null);   // 캐릭터 없음 — 생존 신호는 타이머가 계속 보낸다(위 주석 참고)
    setCharBadWhy(null);         // 🧭 '없다'는 정상이다 — 고장으로 기록하지 않는다
    return;
  }
  chip.style.display='flex';
  // ★ 캐릭터 위치를 그대로 투영 → 화면(픽셀) 단위로 오프셋. 원근 드리프트 0.
  //   [세로 배열 A안 재구성] 예전 가로 배열용 오프셋(캐릭터 왼쪽 아래 발밑 근처)은 세로 툴바가 아래로 뻗으면서
  //   화면 좌하단으로 밀려나는 문제가 있었음. 이제 캐릭터 몸통 옆(왼쪽/오른쪽 자동)에 붙는 방식.
  _uiAnchorWorld(me, _wpTmp);   // 올라탄 동안엔 탑 바닥 캐릭터 기준(_uiAnchorSeat 주석 참고)
  // ★ 예전엔 캐릭터를 "키 1.45 / 반폭 0.4 월드유닛"으로 가정한 상수로 칩 위치를 잡았다.
  //   실제 모델은 커미션·동물·파츠에 따라 이보다 작아서, 그 오차가 화면 크기 배율(focusCharScale)에
  //   같이 곱해지며 오프셋처럼 커졌다 = "크기를 키울수록 칩이 멀어지는" 증상.
  //   이제 캐릭터의 실제 바운딩박스를 재서 반폭·키를 그대로 쓴다 — 어떤 모델·어떤 배율이든 간격이 일정.
  // ⚠️ 위치와 같은 좌석을 재야 한다. 위치만 탑 바닥으로 옮기고 폭을 올라탄 동물로 재면 칩이 사람 몸에 겹친다.
  const _m = _chipCharMetrics(_uiAnchorSeat(me) || me);
  _wpTmp2.copy(_wpTmp); _wpTmp2.y += _m.topY;               // 발밑 → 머리 끝
  _wpTmp.project(camera);
  _wpTmp2.project(camera);
  const rect=renderer.domElement.getBoundingClientRect();
  const cx     =rect.left+(_wpTmp.x*0.5+0.5)*rect.width;
  const cyFeet =rect.top +(-_wpTmp.y*0.5+0.5)*rect.height;   // 발밑 화면 y
  const cyTop  =rect.top +(-_wpTmp2.y*0.5+0.5)*rect.height;  // 머리 끝 화면 y
  const charPxH = Math.max(1, Math.abs(cyFeet - cyTop));     // 화면상 캐릭터 키(px)
  const pxPerUnit = charPxH / Math.max(0.01, _m.topY);       // 1 world unit = 몇 px
  // 세로 배치 기준 높이 — 머리 끝에서 키의 몇 %를 내려온 지점을 툴바 top으로 쓴다(0.41 ≈ 어깨).
  const cy = cyTop + charPxH * CHIP_VERT_TOP_RATIO;
  const CHAR_HALF_PX = pxPerUnit * _m.halfW;                 // 실측 반폭(px)
  // ★ 칩과 캐릭터 사이 고정 여백(px). 반폭을 실측하므로 이제 이 숫자 하나만 조절하면 된다.
  //   동물 보정(ANIMAL_CHIP_GAP_EXTRA)은 실측으로 대체돼 불필요 — 제거됨.
  const GAP = 6;
  /* 캐릭터 옆에 붙일 때만 쓰는 여백 — 캐릭터가 커지면 같이 벌어진다(CHIP_GAP_CHAR_RATIO 주석).
     ⚠️ 최소값은 GAP 이다. 작은 동물에서 여백이 2~3px 로 쪼그라들면 칩이 몸에 닿아 보인다. */
  const GAP_CHAR = Math.max(GAP, CHAR_HALF_PX * CHIP_GAP_CHAR_RATIO);
  // 실측 툴바 폭 (없으면 기본 32)
  const chipRect0 = chip.getBoundingClientRect();
  const chipW0 = chipRect0.width || 32;
  const chipH0 = chipRect0.height || 108;
  // 기본은 오른쪽. 캐릭터가 화면 우측 끝에 붙어 오른쪽에 툴바 폭+여유가 안 들어가면 왼쪽으로 반전.
  // ★ 반전 판정을 캐릭터별로 "안정"하게 유지 —
  //   솔로에서 자리 추가로 캐릭터가 여러 개일 때, 자리간격 조절/창 이동으로 순간적으로 우측 여유가
  //   부족해지면 매 프레임 반전이 튀는 문제(왼쪽↔오른쪽 진동)가 있었음.
  //   히스테리시스(마지막 방향)를 도입 — 한 번 정한 방향은 확실히 반대쪽이 나을 때만 뒤집힘.
  let placeRight = (_lastChipPlaceRight !== false);   // 기본 오른쪽
  // ⚠️ 아래 px0 이 실제로 쓰는 여백과 **같은 값**으로 재야 한다. 여기만 GAP 으로 남겨두면
  //   "오른쪽에 들어간다"고 판정해놓고 실제로는 그보다 더 밖에 놓여 화면 끝을 넘는다.
  const rightSpace = innerWidth - (cx + CHAR_HALF_PX + GAP_CHAR);
  const leftSpace  = cx - CHAR_HALF_PX - GAP_CHAR;
  if(placeRight){
    // 지금 오른쪽인데 오른쪽 공간이 툴바+여유(12)에도 부족하고 왼쪽에는 여유가 있으면 반전
    if(rightSpace < chipW0 + 12 && leftSpace > chipW0 + 24) placeRight = false;
  } else {
    // 지금 왼쪽인데 오른쪽에 여유가 확실히 회복(툴바+여유*2) 되면 되돌림
    if(rightSpace > chipW0 + 24) placeRight = true;
  }
  _lastChipPlaceRight = placeRight;
  //  가로 배치: 캐릭터 옆이 아니라 '발 밑에 가로로' 놓는다. 세로 툴바를 그대로 가로로 눕히면
  //   캐릭터 옆으로 길게 튀어나가 화면을 많이 먹고, 머리 위는 레벨/이름표와 겹치기 때문.
  //   좌우는 캐릭터 중앙 정렬, 세로는 발 밑(어깨 기준 cy에서 캐릭터 높이만큼 내려간 지점).
  /* 🏷️ 발밑 라벨 띠(경험치 바 + Lv./닉네임 이름표)를 칩이 덮지 않게 비킨다.
     [경위] 예전엔 경험치 바만 봤다. 그런데 이름표는 그 바로 아래에 있어서
       (NAMEPLATE_BELOW_EXPBAR), 가로 배치에서는 칩 줄이 이름표와 같은 높이에 앉아 닉네임을
       통째로 덮었고, 세로 배치에서는 칩 기둥이 발밑까지 내려와 이름표 끝을 잘라먹었다(제보 사진).
     ★ 두 요소 다 이 함수보다 **먼저** 배치된다(프레임 순서: 바 → 이름표 → … → 칩).
       그래서 다시 계산하지 않고 실제 렌더된 사각형을 그대로 읽는다 —
       두 곳에서 따로 계산하면 반드시 어긋난다.
     ⚠️ **비키는 쪽은 칩 하나뿐이어야 한다.** 라벨도 칩을 피하게 만들면 매 프레임 서로를
       밀어내며 화면 아래로 흘러내린다(setSeatNamePlate 주석의 그 함정).
       라벨 쪽 코드는 칩을 절대 쳐다보지 않는다 — 그대로 둘 것.
     라벨이 둘 다 숨겨져 있으면(이름표 끔 등) labelBottom===cyFeet 이라 예전 동작과 완전히 같다. */
  const _labels = [];
  [me.expBarEl, me.namePlateEl].forEach(_el => {
    if(!_el || _el.style.display === 'none') return;
    const _r = _el.getBoundingClientRect();
    if(_r.height) _labels.push(_r);
  });
  let labelBottom = cyFeet;
  _labels.forEach(_r => { labelBottom = Math.max(labelBottom, _r.bottom); });
  let px0, py0;
  if(overheadMod().chipHorizontal()){
    px0 = cx - chipW0/2;
    py0 = labelBottom + GAP;      // 바 아래가 아니라 '이름표 아래'
  }else{
    px0 = placeRight ? (cx + CHAR_HALF_PX + GAP_CHAR) : (cx - CHAR_HALF_PX - GAP_CHAR - chipW0);
    py0 = cy;   // 툴바 top = 어깨 화면 좌표
    /* 세로 배치에서는 칩 기둥이 어깨부터 발밑 라벨 띠까지 내려온다. 위로 올리면 머리 위로
       솟구치므로(기둥이 캐릭터보다 길다) **옆으로** 비킨다 — 이름표는 캐릭터보다 조금 넓을
       뿐이라 몇 px 만 밀면 된다. 세로로 안 겹치는 라벨은 애초에 상관이 없다. */
    _labels.forEach(_r => {
      if(_r.bottom < py0 || _r.top > py0 + chipH0) return;
      if(placeRight) px0 = Math.max(px0, _r.right + GAP);
      else           px0 = Math.min(px0, _r.left - GAP - chipW0);
    });
  }
  // 화면 밖으로 나가지 않게 clamp — 실제 렌더된 크기를 재서 여유를 둠
  const chipRect = chip.getBoundingClientRect();
  const chipW = chipRect.width || chipW0, chipH = chipRect.height || chipH0;
  const px=Math.max(8, Math.min(innerWidth-chipW-8, px0));
  const py=Math.max(8, Math.min(innerHeight-chipH-8, py0));
  // 캐릭터 위치(투영결과+오프셋)를 따라감 — "프로그램 이동"으로 캐릭터를 옮겨도 정확히 따라옴
  chip.style.left=px+'px';
  chip.style.right='auto';
  chip.style.top = py+'px';
  // ── 스마트 감지: 캐릭터 화면 좌표를 기록만 해둔다 (실제 전송은 위 100ms 타이머가 담당) ──
  //   반경은 캐릭터 세로 크기의 1.2배 정도로 넉넉히 — 상태칩까지 포함하고, 마우스가 근처에 오는 순간 즉시 클릭 가능.
  //   ★ 여기서 직접 보내지 않는 이유는 위 '렌더러 생존 신호' 주석 참고.
  /* 🧭 [2026-09-01] **터진 투영값은 main 으로 내보내지 않는다.** — 제보 로그로 확정된 자리

     [무엇이 났나] 제보 로그에서 이 값이 실제 캐릭터 자리와 **45,000px** 어긋난 구간이 세 번 있었다.
       그 구간에서는 렌더러의 레이캐스트가 `char:me` 로 캐릭터를 정확히 맞히는데도(=사람 눈에는
       캐릭터가 멀쩡히 그 자리에 있다) main 이 받은 좌표만 화면 밖 저 멀리였다.
     [그래서 무슨 일이 벌어지나] main 의 `_ptOnOurUI` 는 이 좌표로 원을 그린다. 원이 화면 밖이면 —
       · 유령 감시(_guardGhostPassthrough)가 **캐릭터 위에서는 영영 발동하지 않는다**
         ⇒ 사용자가 알고 있는 복구법인 "캐릭터 위에 2초 얹기"가 **아무 일도 일으키지 않는다.**
       · 펜 근접 판정(_checkCursorNearChar)도 같은 원을 보므로, 펜 앱에서의 전용 복구 통로도 죽는다
         ⇒ 판타블렛 사용자는 두 개뿐인 복구 통로를 **동시에** 잃는다.
       · ⓖ 는 "캐릭터에서 먼 클릭 = 판정이 틀렸다"로 읽어 통과로 회수한다 ⇒ 유령을 **만든다.**
       실제로 세 구간 모두 앱을 껐다 켜야만 끝났다 — 제보 문구 그대로다.
     ⇒ 못 믿을 값이면 **아무 말도 하지 않는다**(null). main 은 그때 좌표 판정을 보류하고
       창 사각형(regions)만 본다. 틀린 좌표로 단정하는 것보다 모른다고 하는 편이 항상 안전하다.
     ⚠️ 원인(왜 투영이 터지는가)은 아직 못 찾았다. 이건 **막는 장치**이고, 아래 _charBadWhy 가
       다음 로그에서 범인을 지목하라고 붙여 둔 것이다. 원인을 찾아도 이 문지기는 남길 것. */
  if(!clickPolicy.charHittable({ officeHidden: _officeHidden() })){
    /* 회사원 모드로 숨겼다 — 칩(■ 버튼 — 숨김을 푸는 하나뿐인 입구)은 그대로 두고, main 에 보내는 캐릭터 영역만 비운다 */
    setCharBoundsLatest(null);
    setCharBadWhy(null);
  } else if(_charProjSane(cx, cy, charPxH)){
    setCharBoundsLatest({ x: cx, y: cy, r: Math.max(110, charPxH) });
    setCharBadWhy(null);
  } else {
    setCharBoundsLatest(null);
    if(!_charBadWhy()){   // 문자열은 구간당 한 번만 만든다 — 이 함수는 매 프레임 돈다
      setCharBadWhy('투영 폭주 cx=' + Math.round(cx) + ' cy=' + Math.round(cy)
        + ' 키=' + Math.round(charPxH) + 'px | 창=' + innerWidth + 'x' + innerHeight
        + ' 캔버스=' + Math.round(rect.width) + 'x' + Math.round(rect.height)
        + '@' + Math.round(rect.left) + ',' + Math.round(rect.top)
        + ' | 좌석=' + seats.length + ' 올라탐=' + (me.ridingOn ? 'y' : 'n')
        + ' 앵커=' + (_uiAnchorSeat(me) === me ? '자기' : '탑바닥'));
      console.warn('[클릭통과] 캐릭터 투영이 터졌다 — main 에 좌표를 보내지 않는다: ' + _charBadWhy());
    }
  }
  // ── 세로 배열 A안 전환: flip-up(위로 열림) 로직은 폐기.
  //    상태·더보기 캐스케이드는 좌우로 자동 반전(_positionCascade), 채팅·알림 입력창은 캐릭터 발 밑에 고정(_positionInputBelowChar).
  //    각 함수는 hidden 체크로 early return하므로 매 프레임 호출해도 오버헤드 없음.
  _repositionOpenChipInputs();   // ★ 캐스케이드 메뉴는 여기서 건드리지 않는다 — 열린 메뉴가 캐릭터와 함께 떨린다
  // 💬 채팅 버튼 — 🚫 채널 개편으로 투게더룸(채널1)에서는 채팅 제거 (일에 집중).
  //   코드는 지우지 않고 숨김만 함 — 채널2(채팅룸)를 만들 때 window._activeChannel===2 조건으로 재활성 예정.
  const chatBoxEl=document.getElementById('myChatBox');
  const chatBtnEl=document.getElementById('myChatBtn');
  if(chatBtnEl){
    const chatAllowed = (window._activeChannel === 2);   // 채널2에서만 채팅 허용 (지금은 항상 false)
    const inRoom = (typeof Presence()!=='undefined' && Presence().active());
    chatBtnEl.style.display = (inRoom && chatAllowed) ? 'inline-flex' : 'none';
    if((!inRoom || !chatAllowed) && chatBoxEl && !chatBoxEl.classList.contains('hidden')){ chatBoxEl.classList.add('hidden'); chatBtnEl.classList.remove('on'); }
    // 💬 안 읽은 개수 뱃지 — 방 안 + 채팅 허용 + 대화창이 닫혀 있을 때만 얇게 구독
    if(typeof chatUiMod()._syncChatBadgeSub==='function') chatUiMod()._syncChatBadgeSub(inRoom && chatAllowed);
  }
  // 😊 기본 이모티콘 버튼 — 채팅이 잠긴 방(워킹룸=채널1)에서만 표시. 라이선스 불필요.
  //   투게더룸(채널2)은 채팅창이 demoji 명령(/ㅃ 등)을 이미 지원하므로 버튼을 숨겨 중복을 피함.
  {
    const demojiBtnEl=document.getElementById('myDemojiBtn');
    const demojiBoxEl=document.getElementById('myDemojiBox');
    if(demojiBtnEl){
      const inRoomD = (typeof Presence()!=='undefined' && Presence().active());
      const showD = inRoomD && (window._activeChannel !== 2);
      demojiBtnEl.style.display = showD ? 'inline-flex' : 'none';
      if(!showD && demojiBoxEl && !demojiBoxEl.classList.contains('hidden')){ demojiBoxEl.classList.add('hidden'); demojiBtnEl.classList.remove('on'); }
    }
  }

  // 설정 패널 — 캐릭터 머리 위 중앙에 오도록, 상태칩과 별개로 "오프셋 없는" 캐릭터 중앙 x 사용
  const panel=document.getElementById('focusSettingsPanel');
  if(panel && panel.classList.contains('on') && !window._fsPanelDragged){   // ✥ 드래그로 옮긴 뒤엔 머리 위 자동 따라가기 중단
    _uiAnchorWorld(me, _wpTmp2); _wpTmp2.y = 1.55; _wpTmp2.project(camera);   // 올라탄 동안엔 제자리 기준
    let cx=rect.left+(_wpTmp2.x*0.5+0.5)*rect.width;
    let cy=rect.top +(-_wpTmp2.y*0.5+0.5)*rect.height;
    // 화면 밖으로 잘리지 않게 — 끌어 옮길 때 · 크기가 바뀔 때와 같은 규칙(shared/panel-fit.js)
    const fit = TwPanelFit.fitBottomCenter(cx, cy, panel.offsetWidth || 240, panel.offsetHeight || 260, innerWidth, innerHeight, 8);
    panel.style.left=fit.x+'px';
    panel.style.top =fit.y+'px';
  }
}
/* 칩 이벤트 바인딩 — 클릭하면 상태 메뉴 토글 (드래그 이동 기능은 설정 패널의 "프로그램 이동"으로 이전됨) */
(function bindMyStatusChip(){
  const btn=document.getElementById('myStatusChipBtn'); const menu=document.getElementById('myStatusMenu');
  if(!btn||!menu)return;
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    /* 🏢 숨김 중에는 상태 메뉴를 열지 않는다 — 메뉴 자체가 CSS 로 숨겨져 있어서
       열어봐야 아무것도 안 뜨는 '죽은 클릭'이 된다. 되돌리는 손짓은 우클릭이다. */
    if(_officeHidden()) return;
    const willOpen = menu.classList.contains('hidden');
    if(willOpen) _closeChipPopups('myStatusMenu');   // 상태 메뉴를 열 땐 다른 칩 팝업은 모두 닫음(겹침 방지)
    menu.classList.toggle('hidden');
    // 열릴 때만 즉시 위치 계산 — 매 프레임 갱신도 되지만 첫 프레임 깜빡임 방지.
    if(!menu.classList.contains('hidden')){ btn.classList.add('on'); _positionCascade(menu, btn); }
    else btn.classList.remove('on');
  });
  document.addEventListener('click',e=>{ if(!menu.contains(e.target)&&e.target!==btn){ menu.classList.add('hidden'); btn.classList.remove('on'); } });
  menu.addEventListener('click',e=>{
    const b = e.target.closest('.stItem'); if(!b) return;
    /* ✨ 커스텀 상태 항목은 '상태 고르기'가 아니라 '문구 입력창 열기'다 — 전용 핸들러가 따로 있다.
       여기서 먼저 집어가면 setUserStatus(null) 이 돼 상태가 조용히 온라인으로 풀린다. */
    if(!b.hasAttribute('data-st')) return;
    setUserStatus(b.dataset.st || null);
    menu.classList.add('hidden');
  });
  // 런처2 (요청): [▼] 드롭다운 — 꾸미기·설정·이동 3개 버튼을 하나로 축약.
  const moreBtn=document.getElementById('myChipMoreBtn'), more=document.getElementById('myChipMore');
  if(moreBtn && more){
    moreBtn.addEventListener('click', e=>{
      e.stopPropagation();
      const willOpen = more.classList.contains('hidden');
      if(willOpen) _closeChipPopups('myChipMore');   // 더보기를 열 땐 다른 칩 팝업은 모두 닫음(겹침 방지)
      // 💃 춤추기 버튼 — 투게더룸(채널2)에선 채팅 /80으로 대체되므로 숨김. 워킹룸·혼자 모드에서만 노출.
      const danceBtn = document.getElementById('myDanceBtn');
      if(danceBtn) danceBtn.style.display = (window._activeChannel === 2) ? 'none' : '';
      /* 🔫 러시안룰렛 — 투게더룸(채널2)에선 숨긴다(2026-09-23 요청). 거기선 대화창 🎲 가 같은 일을 한다
         (하나라도 1이면 굴린 사람이 날아간다 · _rollDice). 워킹룸·혼자 모드에는 그 🎲 가 없어서 버튼이 필요하다. */
      const rouletteBtn = document.getElementById('myRouletteBtn');
      if(rouletteBtn) rouletteBtn.style.display = (window._activeChannel === 2) ? 'none' : '';
      more.classList.toggle('hidden');
      if(!more.classList.contains('hidden')){ moreBtn.classList.add('on'); _positionCascade(more, moreBtn, 'right'); }
      else moreBtn.classList.remove('on');
    });
    // 바깥 클릭 시 닫힘 — 안쪽 버튼(꾸미기 등)을 눌러 각 기능이 열리는 순간에도 드롭다운은 자동 닫힘.
    document.addEventListener('click', e=>{
      if(!more.contains(e.target) && e.target!==moreBtn){ more.classList.add('hidden'); moreBtn.classList.remove('on'); }
    });
    more.addEventListener('click', e=>{
      // 안쪽 버튼 클릭이면 드롭다운 닫음(각 기능은 원래 핸들러가 실행됨)
      if(e.target.closest('button')){ more.classList.add('hidden'); moreBtn.classList.remove('on'); }
    });
    /* 🪟 [2026-08-29] **다른 프로그램을 누르면 닫는다.** — 요청

       [왜 위 document click 으로는 안 됐나] 실행 화면은 전체화면 투명 오버레이라, 커서 아래에
         클릭 받을 것이 없으면 앱이 마우스를 아예 안 받고 뒤 창으로 흘려보낸다
         (app.js 클릭통과 블록의 _pointHitsInteractive). 그러면 바깥을 눌러도 **이 창에는
         이벤트가 오지 않는다** — 리스너는 멀쩡히 달려 있는데 부를 사람이 없는 상태였다.

       [왜 blur 면 되나] 이 메뉴는 ▼ 를 눌러야 열리고, 그 클릭이 우리 창을 활성화한다. 즉
         메뉴가 떠 있는 동안 우리 창은 **반드시 포커스를 쥐고 있다.** 다른 프로그램을 누르는
         순간 그 포커스를 잃으므로 blur 한 번이면 정확히 그 경우만 잡힌다.

       ★ 좌석 우클릭 메뉴가 쓰는 투명 뒷판(.seat-ctx-backdrop) 방식은 **일부러 피했다.**
         그 판은 pointer-events 를 받으므로 _uiRegions 가 화면 전체 사각형을 main 에 보내고,
         그동안 main 의 굳은 클릭받기 회수(ⓕ·ⓖ)가 "어디를 눌러도 우리 UI"로 읽어 통째로 멈춘다.
         마우스 고착 제보를 고치는 중에 같은 안전장치를 다시 무력화할 이유가 없다.
       ★ 이 패턴은 이 파일에 이미 둘 있다 — 꾸미기 창과 🎰 가챠 보관함이 같은 이유로 blur 를
         본다. 그 둘은 파일 선택 다이얼로그 때문에 modalOpen 가드를 달았는데, 여기는 필요 없다:
         이 메뉴는 안쪽 버튼을 누르는 순간 스스로 닫히므로(위 more click 핸들러) 모달이 열릴
         시점에는 이미 사라져 있다.
       ⚠️ 대상은 이 ▼ 메뉴 하나다. 상태 메뉴·이모티콘 팔레트도 같은 모양이라 넓히고 싶어지지만,
         채팅 입력창·플레이리스트·꾸미기창까지 같이 닫으면 "다른 창 보러 갔다 오니 치던 글이
         날아갔다"가 된다. 넓힐 때는 _CHIP_POPUPS 의 keep 표를 먼저 볼 것.
       ⚠️ BGM 자식창·OS 색 선택 대화상자가 뜰 때도 blur 가 난다. 그때 메뉴가 닫히는 것은
         무해하므로 따로 예외를 두지 않는다. */
    window.addEventListener('blur', ()=>{
      if(more.classList.contains('hidden')) return;
      more.classList.add('hidden'); moreBtn.classList.remove('on');
    });
  }

  // 상태칩의 이동 버튼(✥) — 기존 설정 패널의 "프로그램 이동" 버튼과 동일한 기능.
  // 클릭하면 moveMode를 켜고, 화면 클릭으로 위치를 확정. 확정 로직은 window pointerdown 리스너가 처리.
  /* 💃 춤추기 버튼 — 방에 있으면 전원 동참, 혼자면 나만 춤.
     🎲 **해금된 춤 중 무작위**로 나온다. 예전에는 살랑살랑 하나로 고정이라, Lv.150 을 찍어도
       버튼으로는 묘기 회전을 볼 방법이 없었다(채팅 /150 은 투게더룸 전용인데 이 버튼은 반대로
       투게더룸에서 숨는다 — 워킹룸에서는 새 춤을 아예 못 보는 상태였다).
     🔒 레벨 게이트는 그대로다. 해금된 것이 하나도 없으면 가장 낮은 해금 레벨을 안내한다. */
  const myDanceBtn=document.getElementById('myDanceBtn');
  if(myDanceBtn){
    myDanceBtn.addEventListener('click', e=>{
      e.stopPropagation();
      const def = _pickUnlockedDance();
      if(!def){ toast('🔒 Lv.'+_lowestDanceReq()+' 달성 시 사용할 수 있어요'); return; }
      // 개인 쿨다운 5초 (채팅 명령과 공유)
      const nowMs = Date.now();
      if(nowMs - _danceCmdCooldownAt() < 5000){ toast('⏳ 춤은 5초에 한 번!'); return; }
      setDanceCmdCooldownAt(nowMs);
      startMyDance(def);
      // 더보기 메뉴 닫기
      const more=document.getElementById('myChipMore'); if(more) more.classList.add('hidden');
      const moreBtn=document.getElementById('myChipMoreBtn'); if(moreBtn) moreBtn.classList.remove('on');
    });
  }

  /* 🔫 러시안룰렛 — 채널 게이트 없음(모든 채널에서 보인다). 본체는 _rollRoulette. */
  const myRouletteBtn=document.getElementById('myRouletteBtn');
  if(myRouletteBtn){
    myRouletteBtn.addEventListener('click', e=>{
      e.stopPropagation();
      _rollRoulette();
      const more=document.getElementById('myChipMore'); if(more) more.classList.add('hidden');
      const moreBtn=document.getElementById('myChipMoreBtn'); if(moreBtn) moreBtn.classList.remove('on');
    });
  }

  const myMoveBtn=document.getElementById('myMoveBtn');
  if(myMoveBtn){
    myMoveBtn.addEventListener('click', e=>{
      e.stopPropagation();
      setMoveMode(!moveMode());
      setMoveModeJustToggled(true);   // 다음 mousemove에서 시작점을 새로 잡도록 신호
      myMoveBtn.classList.toggle('on', moveMode());
      const moveHint=document.getElementById('fsMoveHint');
      if(moveHint) moveHint.style.display = moveMode() ? 'block' : 'none';
      // 설정 패널이 열려있다면 시야 확보를 위해 닫기 (기존 동작과 동일)
      const panel=document.getElementById('focusSettingsPanel');
      if(moveMode() && panel) panel.classList.remove('on');
      // ★ 이동 모드를 켜는 순간 클릭 통과(click-through)를 즉시 강제 해제 — 마우스를 옮기지 않고
      //   바로 확정 클릭해도 그 클릭이 뒤 창(작업표시줄 등)으로 새지 않게 함.
      if(moveMode() && window.companion && companion.setIgnoreMouse) companion.setIgnoreMouse(false);
      updateMyStatusChipPosition();   // 상태칩 즉시 숨김
    });
  }

  // 런처2 후속: [«] 런처 복귀 버튼 — 실행 화면에서 상태칩 [▼] 드롭다운 안. backToLauncher()는 기존 함수 재사용.
  const myBackBtn=document.getElementById('myBackToLauncherBtn');
  if(myBackBtn){
    myBackBtn.addEventListener('click', e=>{
      e.stopPropagation();
      backToLauncher();
    });
  }

  // 💬 채팅 버튼 — 멀티모드 전용. 클릭하면 입력창 토글, Enter로 전송(140자 제한), Esc로 취소.
  const myChatBtn=document.getElementById('myChatBtn');
  const chatBox=document.getElementById('myChatBox');
  const chatInput=document.getElementById('myChatInput');
  const chatCount=document.getElementById('myChatCount');
  if(myChatBtn && chatBox && chatInput){
    myChatBtn.addEventListener('click', e=>{
      e.stopPropagation();
      // ★ 채널 개편 — 💬 버튼은 이제 '대화 기록창'을 연다(아래 말풍선 입력창 대신).
      //   말풍선 표시(showChatBubble) 자체는 유지되고, 대화창에서 보낸 메시지가 말풍선으로도 뜬다.
      /* 🔁 **토글이다** — 열려 있으면 닫는다.
         예전엔 누를 때마다 openChatWindow() 만 불러서, 이미 떠 있는 창을 다시 여는 헛동작이 됐다
         (닫는 길이 창의 ✕ 과 Esc 뿐이라 "버튼으로 껐다 켰다"가 안 됐다).
         ⚠️ 최소화(▁)는 '닫힘'이 아니다 — 접혀 있어도 열린 것으로 보고 여기서 닫는다.
           closeChatWindow 가 접힘을 먼저 풀어 주므로 다음에 열 때 원래 크기로 뜬다. */
      if(typeof chatUiMod().openChatWindow==='function'){
        if(typeof chatUiMod()._chatWindowIsOpen==='function' && chatUiMod()._chatWindowIsOpen()){
          if(typeof chatUiMod().closeChatWindow==='function') chatUiMod().closeChatWindow();
        } else {
          chatUiMod().openChatWindow();
        }
        return;
      }
      // 폴백(대화창 함수가 없을 때만) — 기존 말풍선 입력창
      const willOpen = chatBox.classList.contains('hidden');
      if(willOpen) _closeChipPopups('myChatBox');
      chatBox.classList.toggle('hidden');
      myChatBtn.classList.toggle('on', willOpen);
      if(willOpen){
        chatInput.value=''; if(chatCount) chatCount.textContent='0/140';
        _positionInputBelowChar(chatBox);
        chatInput.focus();
      }
    });
    document.addEventListener('click', e=>{
      if(!chatBox.contains(e.target) && e.target!==myChatBtn){ chatBox.classList.add('hidden'); myChatBtn.classList.remove('on'); }
    });
    chatInput.addEventListener('input', ()=>{ if(chatCount) chatCount.textContent = chatInput.value.length+'/140'; });
    chatInput.addEventListener('keydown', e=>{
      e.stopPropagation();   // Tab 등 전역 단축키가 입력 중에 반응하지 않게(이중 안전장치)
      if(e.isComposing || e.keyCode === 229) return;   // ⌨️ 한글 조합 중 Enter 는 확정용 — 대화창 입력칸 주석(Mac 끝 글자 중복)
      if(e.key==='Enter'){
        const text=chatInput.value.trim();
        if(text && typeof chatUiMod().sendMyChat==='function') chatUiMod().sendMyChat(text);
        chatInput.value=''; if(chatCount) chatCount.textContent='0/140';
        chatBox.classList.add('hidden'); myChatBtn.classList.remove('on');
      } else if(e.key==='Escape'){
        chatInput.value=''; chatBox.classList.add('hidden'); myChatBtn.classList.remove('on');
      }
    });
  }

  // ✨ 커스텀 상태 (프리미엄) — 확성기(📢)를 대체.
  //   상태 메뉴의 "커스텀 상태" 항목을 누르면 곧바로 입력창이 캐릭터 발 밑에 뜸(등록·수정 겸용).
  //   이모지는 선택(비우면 문구만), 문구는 최대 12자. Enter로 저장하는 즉시 그 상태가 적용됨.
  const customStatusBox     = document.getElementById('myCustomStatusBox');
  const customStatusEmoIn   = document.getElementById('myCustomStatusEmo');
  const customStatusTextIn  = document.getElementById('myCustomStatusText');
  const customStatusCount   = document.getElementById('myCustomStatusCount');
  function _closeCustomStatusBox(){ if(customStatusBox) customStatusBox.classList.add('hidden'); }
  function _openCustomStatusBox(){
    if(!customStatusBox) return;
    if(!_premiumOn()){ toast('✨ 커스텀 상태는 프리미엄 전용이에요'); return; }
    _closeChipPopups('myCustomStatusBox');   // 다른 칩 팝업(상태 메뉴·더보기·채팅)은 닫고 이것만 띄움
    // 지금 등록돼 있는 값을 입력창에 미리 채워둠 (수정하기 편하게)
    if(customStatusEmoIn)  customStatusEmoIn.value  = customStatusConf().emo  || '';
    if(customStatusTextIn) customStatusTextIn.value = customStatusConf().text || '';
    if(customStatusCount)  customStatusCount.textContent = (customStatusConf().text||'').length + '/' + CUSTOM_STATUS_MAXLEN;
    customStatusBox.classList.remove('hidden');
    _positionInputBelowChar(customStatusBox);   // 캐릭터 발 밑에 배치
    if(customStatusTextIn) customStatusTextIn.focus();
  }
  function _commitCustomStatus(){
    const text = (customStatusTextIn ? customStatusTextIn.value : '').trim();
    const emo  = (customStatusEmoIn  ? customStatusEmoIn.value  : '').trim();   // 비워두면 이모지 없이 문구만
    saveCustomStatusConf(emo, text);
    // 문구를 등록했으면 바로 그 상태로 전환, 지웠으면 상태 해제
    if(text) setUserStatus('custom');
    else if(userStatus()==='custom') setUserStatus(null);
    _closeCustomStatusBox();
  }
  window._openCustomStatusBox = _openCustomStatusBox;
  const customStatusBtn = document.getElementById('myCustomStatusBtn');
  if(customStatusBtn){
    customStatusBtn.addEventListener('click', e=>{
      e.stopPropagation();
      // 입력창이 열려 있으면 그냥 닫기
      if(customStatusBox && !customStatusBox.classList.contains('hidden')){ _closeCustomStatusBox(); return; }
      // 이미 커스텀 상태를 쓰는 중(버튼 활성)이면 → 상태 해제(온라인으로 복귀). 등록해둔 문구는 그대로 남음.
      if(userStatus() === 'custom'){
        setUserStatus(null);
        _closeChipPopups(null);   // 혹시 열려 있던 다른 팝업도 정리
        return;
      }
      _openCustomStatusBox();
    });
  }
  if(customStatusBox && customStatusTextIn){
    document.addEventListener('click', e=>{
      // 편집창 바깥을 누르면 닫음. 단, 커스텀 상태 버튼 클릭은 여는 동작이므로 제외.
      if(customStatusBox.contains(e.target)) return;
      if(e.target.closest && e.target.closest('#myCustomStatusBtn')) return;
      _closeCustomStatusBox();
    });
    customStatusTextIn.addEventListener('input', ()=>{
      if(customStatusCount) customStatusCount.textContent = customStatusTextIn.value.length + '/' + CUSTOM_STATUS_MAXLEN;
    });
    const onKey = e=>{
      e.stopPropagation();
      if(e.key==='Enter') _commitCustomStatus();
      else if(e.key==='Escape') _closeCustomStatusBox();
    };
    customStatusTextIn.addEventListener('keydown', onKey);
    if(customStatusEmoIn) customStatusEmoIn.addEventListener('keydown', onKey);
  }

  // 접기/펼치기 — 버튼 대신 Tab 키로 토글 (세션 유지는 그대로 localStorage)
  // ★ 요청사항 변경: 기본값(한 번도 안 건드렸을 때)은 "펼침" — 명시적으로 접어둔 적('1')이 저장돼 있을 때만 접힌 채로 시작.
  const chip=document.getElementById('myStatusChip');
  if(chip){
    const collapsed = localStorage.getItem('tw.chipCollapsed')==='1';
    if(collapsed) chip.classList.add('collapsed');
  }
})();

/* Tab 키 = 상태칩 접기/펼치기. 조합키(Ctrl/Alt/Shift)나 입력창 포커스 중엔 무시(브라우저 기본 포커스 이동과 충돌 방지). */
let _tabHintTimer=null;   // launchApp 진입 시 예약되는 "Tab 눌러보세요" 안내 토스트 타이머 — 미리 발견하면 취소
document.addEventListener('keydown', e=>{
  if(e.key!=='Tab') return;
  if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey) return;
  const tag=(e.target&&e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea') return;
  const chip=document.getElementById('myStatusChip');
  if(!chip || chip.style.display==='none') return;   // 칩이 안 보이는 화면(런처/생성기 등)에서는 무시
  e.preventDefault();
  if(_tabHintTimer){ clearTimeout(_tabHintTimer); _tabHintTimer=null; }   // 이미 스스로 찾았으니 안내 토스트는 취소
  const collapsed = chip.classList.toggle('collapsed');
  try{ localStorage.setItem('tw.chipCollapsed', collapsed?'1':'0'); }catch(err){}
  // 세로 A안 전환: 상태 메뉴뿐 아니라 더보기·채팅·알림 팝업도 함께 닫음(접힌 상태에서 유령처럼 떠 있는 팝업 방지).
  /* 🎵 단, 꺼내 둔 창(_CHIP_POPUPS 의 keep)은 남긴다 — 판단 기준을 그 표 하나로 모은다.
     [경위] 여기만 규칙을 모른 채 목록을 따로 들고 있었다. 그래서 드롭메뉴를 열어도 안 닫히던
       플레이리스트가 Tab 한 번에는 같이 사라졌다(제보). Tab 은 '음악은 틀어둔 채 화면만 접는'
       손짓이라 창까지 닫으면 곡을 고를 때마다 다시 펼쳐야 한다.
     ★ 창은 접힌 뒤에도 그대로 보인다 — #myPlaylistBox 는 #myChipGroup 밖에 있어서
       `.collapsed` 의 페이드 대상이 아니다. 제목줄의 ✕ 로 언제든 닫을 수 있다.
     ⚠️ 다루는 범위는 예전 그대로 여섯 개다. 목록을 통째로 _CHIP_POPUPS 로 갈아끼우면 🔔 알림창까지
       새로 닫히기 시작한다 — 그건 이 요청과 무관한 동작 변경이다. */
  const _tabKeep = id => _CHIP_POPUPS.some(p => p.box === id && p.keep);
  [['myStatusMenu','myStatusChipBtn'], ['myChipMore','myChipMoreBtn'], ['myChatBox','myChatBtn'],
   ['myCustomStatusBox',null], ['myDemojiBox','myDemojiBtn'], ['myPlaylistBox','myPlBtn']].forEach(pair=>{
    const boxId = pair[0], btnId = pair[1];
    if(_tabKeep(boxId)) return;
    const el = document.getElementById(boxId); if(el) el.classList.add('hidden');
    if(btnId){ const b = document.getElementById(btnId); if(b) b.classList.remove('on'); }
  });
});

const _emojiTexCache={};
/* 🫧 상태 이모지 중 일부는 시스템 글리프 대신 **번들 그림**으로 굽는다 (책상 스프라이트 전용).
   ★ 그림을 파일이 아니라 data: URL 로 박아 둔 이유가 둘 있다.
     ① file:// 에서 캔버스가 오염(taint)된다. 이 앱은 file:// 로도 뜨는데 그때 브라우저는 로컬
        이미지를 교차출처로 취급하고, 그걸 그린 캔버스를 WebGL 로 올리는 순간 SecurityError 가
        난다 — 자리비움에 들어가는 것만으로 렌더가 죽는다. data: 는 항상 동일출처라 그 경로가
        통째로 없어진다. (CSP 의 img-src 에 data: 가 이미 있으므로 정책은 손댈 필요 없다.)
     ② 파일이면 다 받기 전 한 프레임 흰 사각형이 스친다. 아래는 캔버스를 **투명한 채로** 먼저
        텍스처로 만들고 그림은 도착하는 대로 그 위에 덮는다 — 늦어도 빈 자리로 보일 뿐이다.
        (setSeatDeskEmoji 는 동기 함수라 여기서 기다릴 수가 없다.)
   ⚠️ 키는 **이모지 문자 그 자체**다. USER_STATUSES.away.emo 를 바꾸면 이 키도 같이 바꿀 것 —
     안 맞으면 조용히 아래 글리프 경로로 떨어진다(표시가 사라지지는 않으니 알아채기 어렵다).
   ⚠️ 이 표는 **책상 스프라이트에만** 걸린다. 머리 위 말풍선에 뜨는 것은 emo 가 아니라
     USER_STATUSES 의 label('자리비움') 글자이므로(프레임 루프의 setSeatHeadBubble 호출부 참고)
     거기는 아무 영향이 없다. 말풍선에도 그림을 넣고 싶으면 그건 [demoji:] 마커 쪽 일이다.
   ⚠️ 프리즌스로 오가는 것은 상태 키('away')뿐이고 emo 는 각자 로컬에서 찾는다. 그래서 구버전
     상대는 예전대로 🫧 글리프를 보고 이쪽만 그림으로 보인다 — 호환이 깨지지 않는다.
   ⚠️ 128px 인 것은 아래 캔버스 크기와 맞춘 값이다. 더 선명하게 하려면 **둘 다** 키워야 한다. */
const EMOJI_TEX_IMG = {
  '🫧': 'data:image/png;base64,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'
};
/* 🔔💬🫧 화면(DOM)에 쓰는 아이콘 — 시스템 이모지 글리프를 대신한다.
   ★ 그림을 HTML 이 아니라 여기 모아 두는 이유가 둘이다.
     ① 같은 그림이 여러 자리에 쓰인다(🔔 은 칩 버튼 · 알림창 제목 · D-day 뱃지 셋). HTML 에
        data: URL 을 박으면 그 base64 가 자리마다 통째로 복사된다.
     ② 자리비움은 **책상 스프라이트와 같은 그림**이어야 한다. 아래처럼 EMOJI_TEX_IMG 의 값을
        그대로 나눠 쓰면 한쪽만 바뀌어 어긋나는 일이 없다.
   ★ HTML 쪽에는 이모지를 **그대로 남겨 둔다**. _applyUiIcons 가 부팅 때 갈아끼우는 구조라,
     이 스크립트가 죽어도 예전 이모지가 보일 뿐 빈칸이 되지 않는다.
   ⚠️ data: 인 이유는 BONK_BUBBLE_IMG 와 같다 — file:// 에서도 확실히 뜨고, CSP 의 img-src 에
     data: 가 이미 있어 정책을 손댈 필요가 없다.
   ⚠️ 그림은 96px 로 넣고 자리마다 11~40px 로 줄여 쓴다. 가장 큰 자리(채널 카드 40px)의 2배가
     넘으므로 고밀도 화면에서도 뭉개지지 않는다. */
const UI_ICON = {
  bell: 'data:image/png;base64,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',
  chat: 'data:image/png;base64,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',
  away: EMOJI_TEX_IMG['🫧'],
};
const UI_ICON_ALT = { bell:'알림', chat:'채팅', away:'자리비움' };

/* 아이콘 <img> 하나를 만든다. px 는 **화면에 보일 크기**다(원본은 96px).
   ⚠️ alt 를 비우면 스크린리더가 아무것도 못 읽는다 — 이름이 없으면 UI_ICON_ALT 에서 가져온다. */
function uiIconEl(name, px, alt){
  const im = document.createElement('img');
  im.src = UI_ICON[name] || '';
  im.alt = alt || UI_ICON_ALT[name] || '';
  im.className = 'ui-ic-img';
  im.width = px; im.height = px;
  return im;
}

/* HTML 에 박아 둔 이모지를 그림으로 갈아끼운다.
   대상은 data-ic 를 단 스팬뿐이고, 크기는 자리마다 data-px 로 따로 준다(없으면 16).
   ⚠️ 여러 번 불려도 안전해야 한다 — 이미 <img> 가 들어간 자리는 건너뛴다.
   ⚠️ 모르는 이름(data-ic 오타 등)은 **손대지 않고 그냥 둔다** — 지워 버리면 빈칸이 되어
     무엇이 잘못됐는지도 안 보인다. 이모지가 남아 있으면 눈으로 바로 찾는다. */
function _applyUiIcons(root){
  const scope = root || document;
  scope.querySelectorAll('[data-ic]').forEach(el=>{
    const name = el.getAttribute('data-ic');
    if(!UI_ICON[name] || el.firstElementChild) return;
    const px = parseInt(el.getAttribute('data-px'), 10) || 16;
    el.textContent = '';
    el.appendChild(uiIconEl(name, px));
  });
}
try{ window._applyUiIcons = _applyUiIcons; }catch(_){}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>_applyUiIcons(), { once:true });
else _applyUiIcons();

function makeEmojiTexture(em){
  if(_emojiTexCache[em])return _emojiTexCache[em];
  const cv=document.createElement('canvas'); cv.width=cv.height=128;
  const x=cv.getContext('2d');
  const src=EMOJI_TEX_IMG[em];
  if(!src){
    x.font='100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.textAlign='center'; x.textBaseline='middle';
    x.fillText(em, 64, 72);
  }
  const t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; t.needsUpdate=true;
  if(src){
    /* ⚠️ needsUpdate 를 다시 켜지 않으면 캔버스만 바뀌고 텍스처는 투명한 채로 남는다.
       ⚠️ 실패(onerror)는 일부러 비워 둔다 — 투명하게 안 뜨는 편이 낫고, 여기서 글리프로
         되돌리려면 이미 캐시에 들어간 텍스처를 갈아끼워야 해서 일이 커진다. */
    const img=new Image();
    img.onload=()=>{ x.drawImage(img,0,0,128,128); t.needsUpdate=true; };
    img.src=src;
  }
  _emojiTexCache[em]=t; return t;
}
/* ── 책상 위 이모지 (deskAnchor에 부착, sprite — 항상 카메라 향함) ── */
// 💬 이모지 높이 미세조정: 값을 키우면 책상에서 더 위로 뜨고, 줄이면 책상 표면에 더 가깝게 붙음.
const DESK_EMOJI_Y_OFFSET = 1.6;   // 책상 위 40cm
const DESK_EMOJI_Z_OFFSET = 0.1;   // 카메라 쪽으로 10cm
// 💬 이모지 크기: 값을 키우면 이모지가 커지고, 줄이면 작아짐. (스프라이트 스케일 — 캐릭터/책상과 무관)
const DESK_EMOJI_SIZE = 1.4;
function ensureSeatDeskEmoji(seat){
  if(seat.deskEmojiSprite) return seat.deskEmojiSprite;
  if(!seat.deskAnchor) return null;
  /* depthTest:false — 동물은 책상이 작아져(약 40%) 이모지가 머리 · 귀 안쪽 높이에 놓여 몸에 가려졌다. renderOrder 만으로는 불투명 몸의 깊이를 못 이긴다. */
  const mat=new THREE.SpriteMaterial({map:null, transparent:true, depthTest:false, depthWrite:false});
  const sp=new THREE.Sprite(mat); sp.scale.set(DESK_EMOJI_SIZE,DESK_EMOJI_SIZE,1); sp.visible=false; sp.renderOrder=850;
  sp.position.set(0, DESK_EMOJI_Y_OFFSET, DESK_EMOJI_Z_OFFSET);
  seat.deskAnchor.add(sp);
  seat.deskEmojiSprite=sp; return sp;
}
function setSeatDeskEmoji(seat, em){
  if(seat._lastDeskEmo===em) return;
  seat._lastDeskEmo=em;
  const sp=ensureSeatDeskEmoji(seat); if(!sp) return;
  if(!em){ sp.visible=false; return; }
  sp.material.map=makeEmojiTexture(em); sp.material.needsUpdate=true; sp.visible=true;
}

return {
  _positionInputBelowChar,
  _repositionOpenChipPopups,
  _tabHintTimer: ()=>_tabHintTimer,   // 읽는 함수
  setTabHintTimer: (v)=>{ _tabHintTimer = v; },   // 쓰는 함수 — app.js 가 비운다
  _wpTmp3,
  hexToRgba,
  otherSeatCircles,   // 🖊️ 하트비트(app.js)가 main 에 싣는다
  setSeatDeskEmoji,
  uiIconEl,
  updateMyStatusChipPosition,
};
}

const api = { createStatusChip };
if(typeof window !== 'undefined') window.TwStatusChip = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
