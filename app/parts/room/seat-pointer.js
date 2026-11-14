/* seat-pointer.js — 🖱 캔버스 누르기 · 끌기 · 흔들기 · 쓰다듬기 · 우클릭(앱 FSD · app.js 분리 M11)
   app.js DRAG / PET 구역을 글 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다(다시 대입되거나 뒤에서 선언되는 값을 읽는 함수로 받는 줄만 `이름()` 으로 달라짐).
   ・책임: 캔버스 contextmenu(드래그 중 우클릭 = 그 자리 고정 · 조준 취소 · 좌석 메뉴 열기) · pointerdown(좌석 잡기 · 조준 가로채기) · pointermove(흔들기 · 책상 끌기 슬롯 옮기기 · 어지러움 누적) ·
     pointerup(쓰다듬기 · 아이템 · 벤치 앉기 · 동물 얹기 · 어지러움 확정) · pointercancel · blur 안전망(clearDragStuck) · 이름표 끌기 시작(_beginLabelSlotDrag) · 전역 마우스 NDC(액자 고정 머리가 따라감).
     끄는 중 상태 `drag` 의 주인이다(다시 대입되는 let — 밖에서는 drag() 로 읽기만 한다).
   ・받는 deps 24 — 값: activeItemMixers · camera · canvas · hiddenSeatsMod · iDeskMod · overheadMod · rideBenchMod · seatLayoutMod · seatPanelMod · seats · sfxMod · tricksMod · triggerPet ·
     함수: _uiHot · layoutSeats · playItemIdle · toast · 읽는 함수: Presence · floatersMod · officeMode · roomSeatMode · seatMenuMod(뒤에서 만들어지거나 다시 대입된다) · suppressNextContextMenu · 쓰는 함수: setSuppressNextContextMenu.
   ・내놓는 것: ray · ndc · seatFromObject · drag() · mouseNdcX() · mouseNdcY() · _beginLabelSlotDrag — app.js 는 앞 셋을 같은 이름 const 로 받는다.
   ⚠️ pointerup 본문은 try/finally 로 감싸 `drag=null` 이 무슨 일이 있어도 실행된다 — 안 그러면 클릭 통과 판정 루프가 모든 mousemove 를 삼켜 앱이 유령이 된다(아래 주석).
   ⚠️ 우클릭 메뉴는 위 1~5 단계(preventDefault · _suppressNextContextMenu · drag · 레이캐스트 · 회사원 모드) **뒤**에 있어야 한다 — 앞에 붙이면 드래그 중 고정과 이동 확정이 깨진다.
   검사: checks/sim-seat-pointer.js */
(function(){

function createSeatPointer(deps){
const Presence = deps.Presence;   // 읽는 함수
const _uiHot = deps._uiHot;
const activeItemMixers = deps.activeItemMixers;
const camera = deps.camera;
const canvas = deps.canvas;
const floatersMod = deps.floatersMod;   // 읽는 함수
const hiddenSeatsMod = deps.hiddenSeatsMod;
const iDeskMod = deps.iDeskMod;
const layoutSeats = deps.layoutSeats;
const officeMode = deps.officeMode;   // 읽는 함수
const overheadMod = deps.overheadMod;
const playItemIdle = deps.playItemIdle;
const rideBenchMod = deps.rideBenchMod;
const roomSeatMode = deps.roomSeatMode;   // 읽는 함수
const seatLayoutMod = deps.seatLayoutMod;
const seatMenuMod = deps.seatMenuMod;   // 읽는 함수
const seatPanelMod = deps.seatPanelMod;
const seats = deps.seats;
const setSuppressNextContextMenu = deps.setSuppressNextContextMenu;   // 쓰는 함수
const sfxMod = deps.sfxMod;
const suppressNextContextMenu = deps.suppressNextContextMenu;   // 읽는 함수
const toast = deps.toast;
const tricksMod = deps.tricksMod;
const triggerPet = deps.triggerPet;
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-0.4);
let drag=null; // {seat, startX/Y, moved, mode:'slot'|'shake', targetType, grabX(slot), grabPlane/grabOffset(shake), lastX/Y/T, velX/Y, dizzy}
function seatFromObject(o){let p=o;while(p){if(p.userData&&p.userData.seat)return p.userData.seat;p=p.parent;}return null;}
function worldX(e){const r=canvas.getBoundingClientRect();ndc.x=((e.clientX-r.left)/r.width)*2-1;ndc.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc,camera);const pt=new THREE.Vector3();ray.ray.intersectPlane(dragPlane,pt);return pt?pt.x:0;}

/* ─── 캐릭터 흔들기 — 시메지 컨셉
   · 캐릭터(rig 안의 mesh) 드래그 → 흔들기, 책상(desk/그림자/슬래브) 드래그 → 슬롯 이동
   · 클릭만 하고 6px 미만이면 → 쓰다듬(pet) 유지 */
const SHAKE_DIZZY_TRIGGER = 60;
// "빠른 흔들기"로 인정하는 최소 속도(px/ms). 이 이상으로 움직여야 dizzy 누적 + blink.
// 느린 좌우 드래그는 이 값보다 느려서 blink/dizzy가 안 생김. 더 둔감하게 하려면 키우세요.
const SHAKE_FAST_SPEED = 1.0;
const _ndV3 = new THREE.Vector3();
/* hit한 객체가 캐릭터 영역(rig 하위)이면 'char', 그 외(책상/그림자/슬래브)면 'desk' */
function classifyHit(seat, obj){
  let p = obj;
  while(p && p !== seat.group){
    if(p === seat.rig) return 'char';
    if(p.userData && p.userData.isDeskItemPivot) return {type:'item', pivot:p};
    p = p.parent;
  }
  return 'desk';
}
// 우클릭 → 내 캐릭터 수정(생성기 열기). 친구(remote) 좌석은 남의 캐릭터라 수정 못 하게 막음.
canvas.addEventListener('contextmenu', e=>{
  e.preventDefault();
  if(suppressNextContextMenu()){ setSuppressNextContextMenu(false); return; }   // 이동 모드를 우클릭으로 막 확정한 경우 — 이어서 캐릭터 우클릭 동작으로 안 이어지게
  if(drag){
    // 드래그(흔들기/이동) 중에 우클릭 = 그 자리에 고정(핀) — 편집창은 안 뜸
    if(drag.mode==='shake'){
      const seat=drag.seat;
      seat.beingShaken=false;
      seat.pinned=true;          // seatState가 항상 'idle' 반환 → 호흡·blink만, 상태 변경/pet 무시
      seat._pinPosY=seat.rig.position.y;   // 떨림 방지용 기준 y
    }
    drag=null;
    return;
  }
  /* 🎯 조준 중 우클릭 = 취소. **메뉴를 열지 않는다** — 취소와 메뉴가 같은 클릭에 겹치면
     "취소했어요" 토스트 뒤로 메뉴가 남는다.
     ⚠️ _flyAiming 쪽 취소는 자기 window 리스너가 이미 하므로 여기서는 열지 않기만 한다(2중 취소 방지). */
  if(tricksMod._bonkAiming()){ tricksMod.setBonkAiming(false); return; }
  if(tricksMod._flyAiming()) return;
  const r=canvas.getBoundingClientRect();ndc.x=((e.clientX-r.left)/r.width)*2-1;ndc.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(seats.map(s=>s.group),true);
  if(!hit.length) return;
  const seat=seatFromObject(hit[0].object); if(!seat) return;
  /* 🏢 회사원 모드 — 상대 캐릭터 우클릭으로 마이홈이 열리지 않는다.
     ⚠️ 토스트도 띄우지 않는다. 요청이 "잠겨서 반응이 없도록" 이라, 회사에서 화면에 글자가
        튀어나오면 모드의 목적 자체가 깨진다.
     ★ 내 캐릭터 우클릭(아래 openCreator = 편집창)은 막지 않는다 — 요청 문구가 "상대 캐릭터"다.
        내 편집창까지 막을지는 별도 판단이 필요하다. */
  if(officeMode() && seat.remote) return;
  /* 🪄 여기서 메뉴를 띄운다 — 예전에는 이 자리에서 **즉시** 마이홈/편집창이 열렸다.
     ★ 동작 변경이다: 상대 캐릭터도 내 캐릭터도 클릭이 한 번 늘어난다. 릴리스 노트에 적을 것.
     ⚠️ 위의 1~5(preventDefault · _suppressNextContextMenu · drag · 레이캐스트 · 회사원 모드)보다
       **뒤**에 있어야 한다. 메뉴를 앞에 붙이면 드래그 중 고정과 이동 확정이 깨진다. */
  seatMenuMod()._seatCtxMenu(e, seat);
});

canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0) return;
  _uiHot(3000);   // 🔥 누르는 동안엔 비포커스 상한을 푼다(반응이 한 박자 늦게 그려지지 않게)
  if(tricksMod._flyAiming()){ tricksMod._flyAimClick(e); return; }   // 🎯 조준 중에는 드래그·쓰다듬 대신 표적 선택
  /* 🪄 때리기 조준도 같은 자리에서 가로챈다 — 여기보다 뒤에 두면 드래그(흔들기)가 먼저 잡고,
     때린 캐릭터가 마우스에 끌려간다. 말풍선 숨김(dismissSeatHeadBubble)도 pointerup 쪽이라 비켜 간다. */
  if(tricksMod._bonkAiming()){ tricksMod._bonkAimClick(e); return; }
  const r=canvas.getBoundingClientRect();ndc.x=((e.clientX-r.left)/r.width)*2-1;ndc.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc,camera);
  const hit=hiddenSeatsMod._preferVisibleHit(hiddenSeatsMod._skipHiddenDesk(hiddenSeatsMod._hitsSkipHidden(ray.intersectObjects(seats.map(s=>s.group),true))));   // 🙈 숨긴 캐릭터는 잡히지 않는다(흔들기·쓰다듬기) · 보이는 것 먼저(#7)
  if(!hit.length) return;
  const seat=seatFromObject(hit[0].object); if(!seat) return;
  if(!TwSeatLabelDrag.canGrabSeat(seat)) return;   // 이름표 끌기와 같은 판단 한 줄(room/seat-label-drag.js)
  const targetType = classifyHit(seat, hit[0].object);
  // shake용 평면 — 캐릭터(rig)의 world position 기준 (책상 고정, 캐릭터만 움직임)
  const camDir = camera.getWorldDirection(new THREE.Vector3()).negate();
  const rigWP = new THREE.Vector3(); seat.rig.getWorldPosition(rigWP);
  const grabPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, rigWP);
  const grabPt = new THREE.Vector3(); ray.ray.intersectPlane(grabPlane, grabPt);
  const grabOffset = grabPt.clone().sub(rigWP);
  /* 🐾 타고 있던 동물을 다시 드래그하면 내려옴(스펙) — 단 **내 캐릭터만**.
     남이 내 머리에 얹어둔 동물은 그 사람 것이라 내가 내릴 수 없다(요청 사양).
     내려도 그 사람이 방송하는 상태 때문에 다음 sync에 곧바로 다시 올라와 깜빡이기만 했다. */
  if(seat.ridingOn && !seat.remote) rideBenchMod.unmountRide(seat);
  /* 🩹 [2026-10-02 제보 #7] groupWP 는 **내린 뒤에** 잰다.
     [원인] 예전엔 내리기 전에 쟀다. unmountRide 가 group 을 제자리(머리 위 → 자기 자리)로 되돌리는데
       흔들기 계산(rig = 커서 − grabOffset − groupWP)은 옛 groupWP 를 계속 써서, 그 차이만큼 캐릭터가
       커서에서 옆으로 빠져 따라왔다. 그러면 놓는 자리 판정(findRideTarget)도 엉뚱한 곳을 본다.
     ★ grabPlane·grabOffset 은 내리기 **전** 값을 그대로 쓴다 — 잡은 지점(머리 위 그 자리)과 손잡이 위치가
       유지되어, 내린 캐릭터가 커서 바로 아래로 따라온다. */
  seat.group.updateMatrixWorld(true);
  const groupWP = new THREE.Vector3(); seat.group.getWorldPosition(groupWP);
  drag={
    seat, startX:e.clientX, startY:e.clientY, moved:false, mode:null, targetType,
    grabX: worldX(e) - seat.group.position.x,
    grabPlane, grabOffset, groupWP,
    lastX:e.clientX, lastY:e.clientY, lastT:performance.now(),
    velX:0, velY:0, dizzy:0
  };
  seatPanelMod.selectSeat(seat); canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(!drag)return;
  const now=performance.now();
  const dx=e.clientX-drag.startX, dy=e.clientY-drag.startY;
  if(!drag.moved){
    if(Math.hypot(dx,dy) > 6){
      drag.moved = true;
      if(drag.seat.pinned) drag.seat.pinned = false;   // 드래그 시작 → 액자 고정 해제
      // 새 규칙: 캐릭터 클릭→흔들기, 책상 클릭→슬롯 이동
      drag.mode = (drag.targetType === 'char') ? 'shake' : 'slot';
      if(drag.mode==='shake'){ drag.seat.beingShaken = true; drag.seat._wasShaken = true; }
    } else return;
  }
  const dt = Math.max(1, now - drag.lastT);
  drag.velX = (e.clientX - drag.lastX) / dt;
  drag.velY = (e.clientY - drag.lastY) / dt;
  drag.lastX = e.clientX; drag.lastY = e.clientY; drag.lastT = now;

  if(drag.mode==='slot'){
    const wx=worldX(e)-drag.grabX; drag.seat.group.position.x=wx;
    let idx=seatLayoutMod.slotIndexAt(wx, drag.seat);   // 칸마다 설 자리를 셈해 가장 가까운 칸 — 간격으로 나누면 음수 간격에서 방향이 뒤집힌다
    if(window.TwSeatPin) idx = TwSeatPin.dragIndex(idx, drag.seat, seats, roomSeatMode());   // 🪑 맨 오른쪽 고정이면 내 자리는 그대로
    const cur=seats.indexOf(drag.seat);
    if(idx!==cur){seats.splice(cur,1);seats.splice(idx,0,drag.seat);layoutSeats();seatPanelMod.renderSeatTabs();}
  } else if(drag.mode==='shake'){
    const r2=canvas.getBoundingClientRect();ndc.x=((e.clientX-r2.left)/r2.width)*2-1;ndc.y=-((e.clientY-r2.top)/r2.height)*2+1;
    ray.setFromCamera(ndc,camera);
    if(ray.ray.intersectPlane(drag.grabPlane, _ndV3)){
      // 마우스 광선이 가리키는 rig의 새 world 좌표 = 교차점 - 잡은 offset
      // rig의 local position = (world target) - (group의 world position)
      drag.seat.rig.position.x = _ndV3.x - drag.grabOffset.x - drag.groupWP.x;
      drag.seat.rig.position.y = _ndV3.y - drag.grabOffset.y - drag.groupWP.y;
      drag.seat.rig.position.z = _ndV3.z - drag.grabOffset.z - drag.groupWP.z;
    }
    const speed = Math.abs(drag.velX) + Math.abs(drag.velY);
    const fast = speed > SHAKE_FAST_SPEED;                  // 지금 "빠르게" 흔드는 중인가
    if(speed > 0.2) drag.lastMoveT = performance.now();     // 움직임 시각 (정신차리기 판정용)
    if(fast)        drag.lastFastT = performance.now();     // 마지막으로 빠르게 흔든 시각 (blink용)
    // dizzy: 빠른 흔들기일 때만 누적, 그 외(느린 드래그/정지)엔 감소 → 천천히 끌어선 안 쌓임
    drag.dizzy = Math.max(0, Math.min(120, drag.dizzy + (fast ? (speed - SHAKE_FAST_SPEED)*4 : 0) - dt*0.06));
    if(drag.dizzy > 30 && Math.random() < 0.08) floatersMod().spawnFloater('💫','#f5a94f', drag.seat);
  }
});
canvas.addEventListener('pointerup',e=>{
 /* 🚑 [고침] 이 본문 전체를 try/finally 로 감싼다 — **drag=null 이 무슨 일이 있어도 실행되게.**
    [무엇이 문제였나] `drag=null` 이 본문 **맨 끝**에 있는데, 그 앞에서 던질 수 있는 호출이 여럿이다
      (Presence.poke · triggerPet · findBenchSlot · mountBench · 애니메이션 재생).
      특히 `Presence.poke` 는 서버가 끊긴 동안 던진다 — CSP 사고 때가 정확히 그 상태였다.
    [무슨 일이 벌어지나] 한 번 던지면 `drag` 가 영원히 남고, 클릭 통과 판정 루프의
      `if(drag) return;` 이 **모든 mousemove 를 삼킨다.** 그 뒤로는 커서를 캐릭터·상태칩·채팅창
      어디에 올려도 판정이 안 돌아, 앱이 통째로 '유령'이 된다 — 껐다 켜기 전엔 안 돌아온다.
      창이 클릭을 못 받으니 포커스도 못 얻어 blur 안전망(clearDragStuck)까지 같이 막힌다.
    ⚠️ 중간의 조기 return 들도 finally 를 지나므로 그대로 동작한다(이미 drag=null 을 하고 있어 무해). */
 try{
  if(!drag)return;
  const seat = drag.seat;
  if(!drag.moved){
    if(drag.targetType==='label'){
      // 🏷️ 이름표 · 경험치 바를 누르기만 했다 — 쓰다듬지 않는다(끌어야 자리 바꾸기)
    } else if(drag.targetType && typeof drag.targetType==='object' && drag.targetType.type==='item'){
      playItemIdle(drag.targetType.pivot);   // 아이템 클릭 — idle 애니메이션 한 번 재생
    } else if(drag.targetType==='desk' && seat.desk && seat.desk.userData.deskIdleAction && seat.desk.userData.deskPlayMode==='click'){
      // 책상 클릭 — 클릭 재생 모드 책상은 여기서 한 번 재생
      const a = seat.desk.userData.deskIdleAction;
      const m = seat.desk.userData.deskMixer;
      a.reset(); a.play(); if(m) activeItemMixers.add(m);
    } else if(!seat.pinned){   // 액자 고정 캐릭터는 pet도 무시
      /* 🖱 클릭음 — **반응이 있는 클릭에만** 난다(액자 고정은 위 조건에서 이미 빠졌다).
         소리만 나고 캐릭터는 가만히 있으면 "눌렸는데 왜 반응이 없지"가 된다.
         ★ 여기는 '끌지 않고 눌렀다 뗀' 자리다(drag.moved 가 false). 흔들거나 옮기는 동안에는
           안 울린다 — 드래그마다 소리가 나면 시끄럽다.
         ★ 막지 않는다(쓰로틀 없음) — 연타하면 연타한 만큼 들리는 것이 요청이다. 풀이 5벌이라
           앞 소리를 끊지 않고 겹친다. */
      if(!window.__noClickSnd) sfxMod._clickSnd.play();   // 📏 A/B 확인용 — 콘솔에서 __noClickSnd=true 로 잠시 끈다
      triggerPet(seat); for(let i=0;i<floatersMod().FLOATER_BURST;i++) setTimeout(()=>floatersMod().spawnFloater('♥','#f2607d',seat),i*320);
      overheadMod.dismissSeatHeadBubble(seat);   // 말풍선 떠 있으면 클릭으로 숨김
      if(seat.remote && seat.friendId && Presence().active()) Presence().poke(seat.friendId, 'pet');   // 남의 캐릭터 쓰다듬으면 그 사람에게 알림
      /* 💗 [2026-10-08 제보 #12] **내 캐릭터**를 쓰다듬은 것도 방에 알린다 — 예전엔 남의 캐릭터만 알려서
         내가 내 캐릭터(동물 포함)를 눌러도 상대 화면에는 하트가 안 떴다.
         ★ 0.5초 쓰로틀 — 연타하면 쓰기가 그만큼 늘어난다. 로컬 하트는 위에서 매번 그대로 뜬다.
         ★ 자리추가 좌석(isExtra)은 내 화면에만 있는 것이라 알리지 않는다.
         ★ 내 노드로 돌아오는 에코는 수신부(_myPetLocalAt)에서 건너뛴다 — 안 그러면 내 화면 하트가 두 번이다. */
      else if(seat.isMe && !seat.isExtra && Presence().active() && Presence().pokeSelf){
        const _t = performance.now();
        floatersMod().setMyPetLocalAt(_t);
        if(_t - floatersMod()._myPetSentAt() >= floatersMod().MY_PET_SEND_GAP_MS){ floatersMod().setMyPetSentAt(_t); Presence().pokeSelf('pet'); }
      }
    }
  } else if(drag.mode==='shake'){
    seat.beingShaken = false;
    // 🪑 벤치 슬롯 근처에서 놓으면 앉기 — 캐릭터 종류(동물/사람) 무관.
    //   이미 앉아 있던 캐릭터를 다시 드래그해서 놓으면, 벤치 밖이면 일어나고 다른 슬롯이면 옮겨 앉음.
    {
      const bs = rideBenchMod.findBenchSlot(seat);
      if(bs){
        if(rideBenchMod.mountBench(seat, bs.host, bs.slot)){
          drag=null; canvas.releasePointerCapture&&canvas.releasePointerCapture(e.pointerId);
          return;
        }
      } else if(seat.seatedOn){
        rideBenchMod.unmountBench(seat);   // 벤치에서 멀리 떨어뜨려 놓음 → 일어남
      }
    }
    // 🐾 동물을 머리 근처에서 놓으면 흡착 — 이후 머리 본을 따라다님
    /* ★ 내 캐릭터만 얹을 수 있다(요청 사양) — seat.remote면 남의 캐릭터다.
       기능 제한이기도 하지만 애초에 동작하지도 않았다: 올라탄 상태는 `_myRidingOn()`으로
       **자기 좌석만** 방송하므로, 남의 동물을 내 화면에서 얹어도 그 사람 화면엔 안 보이고
       다음 sync에서 `_applyRemoteRides`가 want=null로 보고 곧바로 내려버린다(내 화면에서만 깜빡).
       ⚠️ 반대 방향(내 동물을 남의 머리에 얹기)은 그대로 둔다 — 움직이는 건 내 캐릭터이고,
          그건 `_myRidingOn`이 정상적으로 방송하는 기존 기능이다. */
    if(seat.charDef && seat.charDef.animal && !seat.remote){
      const host=iDeskMod.findRideTarget(seat);
      if(host && rideBenchMod.mountRide(seat, host)){
        drag=null; canvas.releasePointerCapture&&canvas.releasePointerCapture(e.pointerId);
        return;
      }
    }else if(seat.remote && seat.charDef && seat.charDef.animal && iDeskMod.findRideTarget(seat)){
      // 왜 안 되는지 알려준다 — 아무 반응 없이 제자리로 돌아가면 버그로 보인다. 연타 시 토스트가 쌓이지 않게 스로틀.
      const _now = performance.now();
      if(!iDeskMod._rideDenyToastAt() || _now - iDeskMod._rideDenyToastAt() > 1500){
        iDeskMod.setRideDenyToastAt(_now);
        toast('🐾 남의 캐릭터는 그 사람만 올릴 수 있어요');
      }
    }
    // 정신차리기 도리도리는 멈춘 뒤 300ms부터 시작 — 그 시점 이후에 손을 놓으면
    // "이미 정신차림"으로 보고 dizzy 좌석 모션을 건너뜀.
    // (참고: "고정"은 이제 드래그 중 우클릭으로 처리됨 — contextmenu 핸들러 참고)
    const stillMs = drag.lastMoveT ? (performance.now() - drag.lastMoveT) : 0;
    if(drag.dizzy >= SHAKE_DIZZY_TRIGGER && stillMs < 300){
      seat.dizzyUntil = performance.now() + 2500;
      for(let i=0;i<floatersMod().FLOATER_BURST;i++) setTimeout(()=>floatersMod().spawnFloater('💫','#f5a94f',seat),i*300);
      if(seat.remote && seat.friendId && Presence().active()) Presence().poke(seat.friendId, 'dizzy');   // 남의 캐릭터 흔들어 dizzy 만들면 그 사람에게 알림
    }
  }
  drag=null;
 }finally{
  /* ★ 위에서 무엇이 던지든 여기는 반드시 지난다. drag 가 남으면 앱이 유령이 된다(위 주석). */
  drag=null;
 }
});
/* 안전망 — pointerup 누락 시 stuck 회복 (캡처 해제/포커스 잃음 등) */
function clearDragStuck(){
  if(drag){
    if(drag.seat){ drag.seat.beingShaken=false; }
    drag=null;
  }
  // 혹시 잔존한 beingShaken 보정
  seats.forEach(s=>{ if(s.beingShaken) s.beingShaken=false; });
}
canvas.addEventListener('pointercancel', clearDragStuck);
window.addEventListener('blur', clearDragStuck);
/* 🏷️ 이름표 · 경험치 바를 눌러 끌면 책상 끌기와 같은 자리 바꾸기 — 시작 판단은 room/seat-label-drag.js.
   ★ 같은 drag 상태를 쓰고 캔버스가 포인터를 잡는다 — 위 pointermove · pointerup 이 책상 끌기(slot)로 그대로 처리한다. */
function _beginLabelSlotDrag(e, seat){
  if(drag) return false;
  _uiHot(3000);
  drag={ seat, startX:e.clientX, startY:e.clientY, moved:false, mode:null, targetType:'label',
    grabX: worldX(e) - seat.group.position.x,
    lastX:e.clientX, lastY:e.clientY, lastT:performance.now(), velX:0, velY:0, dizzy:0 };
  seatPanelMod.selectSeat(seat);
  try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
  return true;
}
/* 전역 마우스 NDC — 액자 고정 캐릭터의 머리가 마우스 따라가도록 */
let mouseNdcX = 0, mouseNdcY = 0;
window.addEventListener('mousemove', e=>{
  const r = canvas.getBoundingClientRect();
  mouseNdcX = ((e.clientX-r.left)/r.width)*2-1;
  mouseNdcY = -((e.clientY-r.top)/r.height)*2+1;
});

return {
  ray,
  ndc,
  seatFromObject,
  drag: ()=>drag,
  mouseNdcX: ()=>mouseNdcX,
  mouseNdcY: ()=>mouseNdcY,
  _beginLabelSlotDrag,
};
}

const api = { createSeatPointer };
if(typeof window !== 'undefined') window.TwSeatPointer = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
