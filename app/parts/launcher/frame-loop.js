/* frame-loop.js — 🎞 프레임 한 장 — 상한 · 좌석 한 명씩 상태 → 자세 → 라벨 · 그리기(앱 FSD · app.js 분리 M17)
   app.js 의 frame()(rAF 콜백)과 이전 시각 `prev` 를 글 그대로 옮긴 모듈이다. 동작은 옛 자리와 같다(뒤에서 선언되거나 다시 대입되는 값을 읽는 함수로 받는 줄만 달라진다).
   ・책임: frame(now, manual) — rAF 시각 알림(setLastRafAt) · 프레임 상한(_frameCapped) · dt · 좌석마다(상태 판정 · 자세 · 올라타기 · 벤치 · 자리비움 · 라벨 · 경험치 바 · 이름표 · 말풍선) · 3D 그리기 · 히트 맵 표시 · 비용 재기.
   ・내놓는 것: frame — app.js 는 같은 이름 const 로 받는다(첫 requestAnimationFrame(frame) 과 프레임 상한 모듈의 타이머 대행이 부른다).
   ⚠️ 좌석 한 명 몫(seat-frame)을 따로 떼는 일은 «차례를 안 바꾸는 글 그대로 옮기기» 로는 안 된다 — `continue` 를 `return` 으로 바꾸는 등 글이 달라져 R5(근본 고침) 몫으로 남긴다. 이 파일 안에서 순서를 바꾸지 말 것(이름표는 경험치 바 뒤 · 말풍선은 이름표 뒤).
   ⚠️ 모듈은 frame 을 부르지 않는다 — 첫 부름은 app.js INIT 의 requestAnimationFrame(frame).
   검사: checks/sim-frame-loop.js */
(function(){

function createFrameLoop(deps){
const _configHidesScene = deps._configHidesScene;
const _frameCap = deps._frameCap;
const _frameCapped = deps._frameCapped;
const _frameJsStats = deps._frameJsStats;
const _gpuTimer = deps._gpuTimer;
const _lowerRunQuality = deps._lowerRunQuality;
const _renderQuality = deps._renderQuality;   // 읽는 함수
const _runSlowWatch = deps._runSlowWatch;
const activeItemMixers = deps.activeItemMixers;
const animateRig = deps.animateRig;
const awayPicMod = deps.awayPicMod;   // 읽는 함수
const camera = deps.camera;
const desktopMode = deps.desktopMode;   // 읽는 함수
const dotRenderMod = deps.dotRenderMod;
const expBarMod = deps.expBarMod;   // 읽는 함수
const floatersMod = deps.floatersMod;
const focusLevelMod = deps.focusLevelMod;   // 읽는 함수
const framePaceMod = deps.framePaceMod;
const getDisplayName = deps.getDisplayName;
const hiddenSeatsMod = deps.hiddenSeatsMod;
const lerp = deps.lerp;
const matToneMod = deps.matToneMod;
const officeModeMod = deps.officeModeMod;   // 읽는 함수
const overheadMod = deps.overheadMod;
const Presence = deps.Presence;
const renderer = deps.renderer;
const rideBenchMod = deps.rideBenchMod;
const runCost = deps.runCost;
const scene = deps.scene;
const seatCharZ = deps.seatCharZ;
const seatEqClampMod = deps.seatEqClampMod;
const seatEqMod = deps.seatEqMod;
const seatHitMod = deps.seatHitMod;
const seatPanelMod = deps.seatPanelMod;
const seatPointerMod = deps.seatPointerMod;
const seats = deps.seats;
const seatsMod = deps.seatsMod;
const seatState = deps.seatState;
const seatStateMod = deps.seatStateMod;
const setClip = deps.setClip;
const setSeatOpacity = deps.setSeatOpacity;
const STATES = deps.STATES;
const statusChipMod = deps.statusChipMod;
const statusConfFor = deps.statusConfFor;
const targetFor = deps.targetFor;
const tricksMod = deps.tricksMod;
const updateActivePartPlayback = deps.updateActivePartPlayback;
const updateIdleItemPlayback = deps.updateIdleItemPlayback;
const updateItemHandTrackers = deps.updateItemHandTrackers;
const userStatusMod = deps.userStatusMod;
let prev=performance.now();
function frame(now, manual){
  if(!manual) framePaceMod.setLastRafAt(now);   // 브라우저가 실제로 rAF를 불러준 시각(아래 감시 장치가 씀)
  /* 상한(_frameCapped → FrameBudget) — 최대 60 · 포커스 있어도 손 안 대면 30 · 다른 창을 보는 중이면 20
     ★ 🪑 플라잉체어가 도는 동안은 60 으로 올린다. 20fps 에서는 dt 가 프레임당 0.05초로
       고정돼 빠르게 튕기는 캐릭터가 한 칸씩 순간이동하듯 끊겨 보인다(평소 앉아 있는 모션은
       느려서 20fps 로도 티가 안 났다). 최대 10초짜리 한시적 예외다. */
  if(_frameCapped(now)){
    if(!manual) requestAnimationFrame(frame);
    return;
  }
  const _frameT0 = performance.now();
  _gpuTimer.poll();
  const dt=Math.min((now-prev)/1000,0.05);prev=now;
  overheadMod.beginLabelFrame();   // 라벨이 쓰는 캔버스 사각형을 이번 프레임에 한 번만 잰다(room/label-measure.js)
  updateIdleItemPlayback();   // 어플 8: 자리비움 감지로 아이템 재생/정지 자동 전환
  updateActivePartPlayback();   // ▶ 파츠: animMode='active'인 것만 활동 중 재생/일시정지
  if(activeItemMixers.size) activeItemMixers.forEach(m=>m.update(dt));   // 클릭으로 재생 중인 아이템 idle 애니메이션 업데이트
  seatEqClampMod._clampSeatDeskParts(now);   // 🪑 평준화 중 «책상 위» 파츠를 자기 자리 안으로(띄엄띄엄 — seat-slot.js)
  const _tSeat = performance.now();
  seats.forEach(seat=>{
    const state=seatState(seat,now);
    if(seat.isMe && Presence.active()){ Presence.setState(seat.pinned ? 'idle' : state); Presence.setLevel(focusLevelMod().getFocusLevel()); }   // 액자 고정은 상대에겐 평상시로
    if(seat.remote && seat._lastTab!==seat.remoteState){ seat._lastTab=seat.remoteState; seatPanelMod.renderSeatTabs(); }  // 탭 상태 이모지 갱신
    const tg=targetFor(state),k=1-Math.pow(seat.smooth,dt);
    /* 활동 상태(userStatus): 본인=userStatus, 친구=remoteUserStatus */
    const us = seat.remote ? seat.remoteUserStatus : (seat.isMe ? userStatusMod.userStatus() : null);
    /* 🔥 빡일중: idle뿐 아니라 focus(타이핑) 상태도 더 격렬하게.
       idle은 spine 숙임 유지 + 호흡 진폭 거의 0 (안 흔들림). focus는 타이핑 빠르게. */
    if(us==='grind'){
      if(state==='idle'){
        tg.slumpY=-0.10; tg.breSpd=2.0; tg.breAmp=0.004; tg.leanX=0.09;
        // tg.arm = 1; 을 지워서 평소(idle)에는 가만히 모니터를 응시하도록 되돌립니다.
      } else if(state==='focus'){
        tg.slumpY=-0.10; tg.breSpd=7.0; 
        tg.leanX=0.25;   // ★ 타이핑(focus)을 할 때 허리(spine)를 앞으로 푹 숙이게 만듭니다. (더 깊이 숙이려면 0.35 등으로 올려보세요!)
      }
    } else if(us==='meal' && state!=='shaking' && state!=='pet'){
      // 🍚 밥 먹는 중: 마우스/타이핑 등 활동 감지와 무관하게(직접 쓰다듬거나 흔드는 중이 아니면 항상)
      //   먹는 모션만 보이게 함(요청사항) — 상체(spine)는 가만히 두고, 머리만 빠르게 까딱이는 건
      //   animateRig()의 head 본 처리에서 별도로 담당(아래 us==='meal' 분기 참고).
      tg.slumpY=-0.05;   // 고개 숙임 정도 — 더 숙이려면 음수로 더 크게(예: -0.08)
      tg.leanX=0;        // ★ 상체(spine)는 움직이지 않게 — 머리만 까딱이길 원하셔서 몸 기울임은 뺌
      tg.breSpd=2.0;
      tg.breAmp=0.004;   // ★ 숨쉬기로 인한 상체 흔들림도 최소화(거의 정지) — grind의 idle과 동일 수준
    }
    for(const kk in seat.pose) seat.pose[kk]=lerp(seat.pose[kk],tg[kk],k);
    /* slide to slot — group은 슬롯 위치만, rig는 흔들기 중이 아니면 항상 원점으로 복귀 */
    if(seat.inPreview){ seat.group.position.set(0,0,0); seat.rig.position.set(0,0,0); }
    else if(seat._benchOwnerSit && seat.bench && seat.benchSlots && seat.benchSlots[0]){
      // 🪑 벤치 주인 owner-sit — 자기 벤치(자기 group의 자식)의 slot_0 로컬 위치로 rig를 보낸다.
      //   group을 옮기면 슬롯도 같이 움직여 순환하므로, group은 원래 자리(targetX) 유지 + rig만 슬롯으로.
      //   ★ 단, 흔들기/고정 중에는 rig 강제를 멈춰서 흔들기가 먹히게 함(놓으면 다시 슬롯으로 수렴).
      const kSlide = Math.min(1, dt * 15);
      seat.group.position.x = lerp(seat.group.position.x, seat.targetX, kSlide);
      if(!seat.beingShaken && !seat.pinned){
        const s0 = seat.benchSlots[0];   // 벤치가 group 원점에 있으므로 s0.position이 곧 group 기준 로컬 오프셋
        const SIT_DROP = 0.28;
        seat.rig.position.x = lerp(seat.rig.position.x, s0.position.x, kSlide);
        seat.rig.position.y = lerp(seat.rig.position.y, s0.position.y - SIT_DROP, kSlide);
        seat.rig.position.z = lerp(seat.rig.position.z, s0.position.z, kSlide);
      }
    }
    else if(seat.seatedOn && !seats.includes(seat.seatedOn)){ rideBenchMod.unmountBench(seat); }   // 🪑 벤치 주인이 방을 나감 → 자동 하차
    else if(seat.seatedOn){ /* 위치는 _updateRideChains의 벤치 처리에서 슬롯 기준으로 배치 */ }
    else if(seat.ridingOn && !seats.includes(seat.ridingOn)){ rideBenchMod.unmountRide(seat); }   // 태운 대상이 방을 나감 → 자동 하차
    /* 🐾 **이미 잘못 얹혀 있는 좌석을 내린다.** mountRide 의 새 검사는 '앞으로 얹히는 것'만 막는다 —
       그 검사가 없던 때 얹혀서 지금 화면에 남아 있는 것(제보 사진)은 스스로 안 내려온다.
       ★ 동물 GLB 가 뒤늦게 파싱되면 rebuildAnimalSeats → applyCharToSeat 가 정리해 주지만,
         파싱이 끝내 실패하면 그 경로가 영영 안 온다. 그 경우를 여기서 받는다.
       ⚠️ _animalBuilt 는 조립 결과라 undefined(모델 없음)일 수 있다 — false 일 때만 내린다.
         mountRide 와 같은 기준이어야 내렸다 얹혔다 하는 깜빡임이 안 생긴다. */
    else if(seat.ridingOn && (!(seat.charDef && seat.charDef.animal) || seat._animalBuilt === false)){
      rideBenchMod.unmountRide(seat);
    }
    else if(seat.ridingOn){ /* 위치는 아래 _updateRideChains에서 체인 순서대로 일괄 처리 */ }
    else {
      const kSlide = Math.min(1, dt * 15);   // 슬롯/좌석 복귀 속도. 프레임당 비율(~24%@60fps). 약 0.4초 수렴
      // group.x는 슬롯 이동 중이 아닐 때만 lerp
      if(!(seatPointerMod.drag()&&seatPointerMod.drag().seat===seat&&seatPointerMod.drag().moved&&seatPointerMod.drag().mode==='slot')){
        seat.group.position.x = lerp(seat.group.position.x, seat.targetX, kSlide);
      }
      // rig.x/z는 shake 중이 아니면 항상 정상 위치로 lerp (rig 기본은 x=0, z=CHAR_Z)
      // 정상 상태에선 lerp(현재, 정상, k)가 현재≈정상이라 사실상 비용 없음
      if(!seat.beingShaken && !seat.pinned){
        seat.rig.position.x = lerp(seat.rig.position.x, 0, kSlide);
        seat.rig.position.z = lerp(seat.rig.position.z, seatCharZ(seat), kSlide);
      }
    }
    /* rig transforms */
    seat.swayPhase+=dt*0.8;
    /* idle 좌우 미세 sway — 빡일중일 땐 진폭을 0.02→0.005로 거의 제거 (집중 자세 고정 느낌) */
    const _swayAmp = (us==='grind' || us==='meal') ? 0.005 : 0.02;
    if(state==='shaking' && seatPointerMod.drag() && seatPointerMod.drag().seat===seat){
      // 흔들기 중: 마우스 가로 속도에 따라 캐릭터를 좌우로 기울임 (±0.55rad 한도)
      const tilt = Math.max(-0.55, Math.min(0.55, -seatPointerMod.drag().velX * 0.06));
      seat.rig.rotation.z = lerp(seat.rig.rotation.z, tilt, 0.35);
    } else if(state==='idle'){
      seat.rig.rotation.z = Math.sin(seat.swayPhase)*_swayAmp;
    } else {
      seat.rig.rotation.z = lerp(seat.rig.rotation.z, 0, k);
    }
    seat.rig.rotation.y=seat.pose.turnY;   // 기본 -0.28은 모델에 들어가 있음(센터링 정확)
    const lift=(seatPointerMod.drag()&&seatPointerMod.drag().seat===seat&&seatPointerMod.drag().moved&&seatPointerMod.drag().mode==='slot')?0.12:0;
    if(seat.beingShaken){
      /* shake 중 — pointermove가 rig.position을 직접 제어, 덮어쓰지 않음 */
    } else if(seat.pinned){
      /* 액자 고정 — 그 자리 그대로, 위치 lerp 안 함 */
    } else if(now-seat.petStart<seatStateMod.PET_MS){const e=now-seat.petStart;seat.rig.position.y=Math.sin(e*0.016)*0.07*Math.exp(-e*0.0026)+lift;}
    else seat.rig.position.y=lerp(seat.rig.position.y,lift,k);
    seat.breathePhase+=dt*seat.pose.breSpd;

const clipped=!seat.isPlaceholder&&seat.mixer;
    const rigged=!seat.isPlaceholder&&!seat.mixer&&seat.hasRig;
    if(clipped){
      seat.rig.rotation.x=lerp(seat.rig.rotation.x,0,k); 
      { const _bs=seatEqMod.seatScale(seat); seat.bodyWrap.scale.set(_bs,_bs,_bs); }   // [수정] 강제 1,1,1 초기화 방지 (🪑 평준화 배율 포함)
      seat.bodyWrap.position.y=0;
      setClip(seat,state); if(!hiddenSeatsMod._bodyHidden(seat)) seat.mixer.update(dt);   // 몸이 안 보이면(자리비움 · 숨김) 뼈대 계산을 건너뛴다
    } else if(rigged){
      seat.rig.rotation.x=lerp(seat.rig.rotation.x,0,k); 
      { const _bs=seatEqMod.seatScale(seat); seat.bodyWrap.scale.set(_bs,_bs,_bs); }   // [수정] 강제 1,1,1 초기화 방지 (🪑 평준화 배율 포함)
      seat.bodyWrap.position.y=0;
      if(!hiddenSeatsMod._bodyHidden(seat)) animateRig(seat,now,state);
    } else {
      seat.rig.rotation.x=seat.pose.leanX;
      const breathe=1+Math.sin(seat.breathePhase)*seat.pose.breAmp;
      // [수정] 기본 숨쉬기 애니메이션에 userScale을 곱해서 크기 유지
      /* ⚠️ 여기는 **매 프레임** bodyWrap.scale 을 다시 쓴다. raw userScale 로 두면 fitModel 이 얹은
         평준화 배율이 다음 프레임에 곧바로 지워진다 — 좌석 크기를 읽는 자리는 예외 없이 seatScale(). */
      const _bs = seatEqMod.seatScale(seat);
      seat.bodyWrap.scale.set(
        (1/Math.sqrt(breathe)) * _bs, 
        breathe * _bs, 
        (1/Math.sqrt(breathe)) * _bs
      );
      // dizzy면 추가 슬럼프(고정값)로 얼굴을 더 내림. 부드럽게 수렴.
      // ★ _dizzyTarget은 animateRig() 안에서만 선언된 지역변수라 여기(rig 없는 폴백 캐릭터 분기)에서
      //   그대로 쓰면 ReferenceError. 같은 계산식을 이 분기 안에서 직접 계산해야 함.
      const _dizzyTargetHere = (state==='dizzy') ? 0 : 0;   // DIZZY_EXTRA_SLUMP와 동일(현재 0) — animateRig와 값 일치시킴
      seat._dizzyAdjCur = (seat._dizzyAdjCur==null) ? _dizzyTargetHere : lerp(seat._dizzyAdjCur, _dizzyTargetHere, k);
      seat.bodyWrap.position.y=seat.pose.slumpY + seat._dizzyAdjCur;
    }
    /* 🪄 때리기 스쿼시 — 위 **세 분기(clipped·rigged·폴백)가 각자 써 놓은 scale 에 곱한다.**
       ⚠️ 분기 안이 아니라 분기 밖에서 한 번 부르는 것이 요점이다. 분기마다 복사하면 한 곳을
         빠뜨려 "어떤 캐릭터는 납작해지고 어떤 건 안 되는" 증상이 나고, 증상만 보면 원인을 못 찾는다.
       ⚠️ 여기보다 아래에서 bodyWrap.scale 을 다시 쓰는 코드가 생기면 이 곱셈이 지워진다. */
    tricksMod._bonkFrame(seat, now);
    /* blink */
    TwBlinkTiming.scheduleBlinks(seat.blink,now); const ca=TwBlinkTiming.eyeClose(seat.blink,now);   // 깜빡임 시간표는 blink-timing.js
    if(seat.isPlaceholder){
      const ey=Math.max(0.06,seat.pose.eyeOpen*(1-ca*0.95));
      seat.placeholder.eyeL.scale.y=ey; seat.placeholder.eyeR.scale.y=ey;
      if(seat.pose.arm>0.02){seat.placeholder.armL.position.y=0.10+Math.abs(Math.sin(seat.breathePhase*4.5))*0.05*seat.pose.arm;
        seat.placeholder.armR.position.y=0.10+Math.abs(Math.sin(seat.breathePhase*4.5+1.6))*0.05*seat.pose.arm;}
      else{seat.placeholder.armL.position.y=lerp(seat.placeholder.armL.position.y,0.10,k);seat.placeholder.armR.position.y=lerp(seat.placeholder.armR.position.y,0.10,k);}
    } else if(seat.faceMat&&seat.blinkTex){
      // blink는 "지금 빠르게 흔드는 중"일 때만 — lastFastT 기준 (느린 드래그는 lastFastT가 안 찍힘)
      // 정신차리기: 빠르게 흔든 뒤(dizzy>30) 멈춘 지 300~1300ms — 고개 좌우 흔들며 다시 눈 감음
      // ⚠ now는 rAF 타임스탬프, lastFastT/lastMoveT는 performance.now() — 시계 캡처 시점이 달라
      //    합쳐진 pointermove가 rAF 직전에 찍히면 (now - lastFastT)가 잠깐 음수가 됨 → 0으로 클램프
      const _moveAgo = seatPointerMod.drag() && seatPointerMod.drag().seat===seat && seatPointerMod.drag().lastMoveT ? Math.max(0, now - seatPointerMod.drag().lastMoveT) : -1;
      const _fastAgo = seatPointerMod.drag() && seatPointerMod.drag().seat===seat && seatPointerMod.drag().lastFastT ? Math.max(0, now - seatPointerMod.drag().lastFastT) : -1;
      const recentlyFast = _fastAgo >= 0 && _fastAgo < 220;   // 220ms 안에 빠른 흔들기가 있었으면 (반전 구간 흔들림 보정)
      const isRecovering = (state==='shaking') && seatPointerMod.drag() && seatPointerMod.drag().seat===seat
        && seatPointerMod.drag().dizzy > 30 && _moveAgo > 300 && _moveAgo < 1300;
      const shakingHard = (state==='shaking') && recentlyFast && seatPointerMod.drag() && seatPointerMod.drag().seat===seat;
      const wantClosed=(state==='sleep')||(state==='pet')||(state==='dizzy')||shakingHard||isRecovering||(ca>TwBlinkTiming.SHUT_AT);
      if(wantClosed!==seat.blink.closed){seat.blink.closed=wantClosed;matToneMod.setFaceMap(seat.faceMat, wantClosed?seat.blinkTex:seat.faceMapOrig);}
    }
    if(state==='sleep' && us!=='away' && us!=='meal' && now-(seat._lastZ||0)>900){seat._lastZ=now;floatersMod.spawnFloater('Z','#7fa8e0',seat);}
    if(state==='dizzy' && now-(seat._lastDizzy||0)>520){seat._lastDizzy=now;floatersMod.spawnFloater('💫','#f5a94f',seat);}

    /* 활동 상태 시각화 — 책상 위 이모지(모두), 머리 위 텍스트 말풍선(모두), 영혼 투명도(자리비움) */
    //   ✨ statusConfFor: 커스텀 상태(프리미엄)는 등록한 이모지/문구로 해석됨 (본인=내 등록값, 친구=전파받은 값).
    /* 📱 머리 위 «📱 앱» — 사용자가 고른 상태가 있으면 그게 먼저 · 없으면 🕒 오늘 기록보다 먼저(보내는 쪽 _statusOut 과 같은 순서). */
    const _mobApp = focusLevelMod()._seatMobileApp(seat);
    const _conf = (_mobApp && !us) ? null : statusConfFor(seat, us);
    /* 🙈 숨긴 좌석 — 캐릭터 · 머리 위 말풍선 · 책상 위 상태 이모지. 매 프레임 판정(_hiddenSeatIds 주석). */
    const _hidden = hiddenSeatsMod._seatHidden(seat);
    if(seat.rig && seat.rig.visible === _hidden) seat.rig.visible = !_hidden;
    /* 🫧 자리비움 그림 — 자리비움 · 안 숨김 · 회사원 모드 아님 · 그림이 실제로 올라왔을 때만 캐릭터 자리에 선다.
       그땐 책상 위 🫧 를 안 띄운다(그림이 곧 자리비움 표시). 못 불러오면 예전 모양(🫧) 그대로. */
    const _awayPic = awayPicMod()._awayPicFor(seat, us, _hidden);
    awayPicMod()._awayImgFrame(seat, _awayPic, now);
    statusChipMod.setSeatDeskEmoji(seat,  (_conf && us!=='grind' && !_hidden && !_awayPic) ? _conf.emo : null);   // 빡일중은 책상에 🔥 안 뜨게(다른 상태는 그대로)
    // 💬 채팅 말풍선 — 보낸 지 CHAT_BUBBLE_MS 안이면 상태 말풍선 대신 채팅 내용을 잠깐 띄움(그 뒤엔 자동으로 상태 말풍선으로 복귀).
    //   (📢 확성기는 제거됨 → 커스텀 상태로 대체. 상태 말풍선이 곧 "지금 뭐 하는지"를 보여줌.)
    setSeatOpacity(seat, (_conf && _conf.opacity!=null) ? _conf.opacity : 1);
    // 머리 위 레벨/이름 이름표 — 나 자신과 친구(멀티모드) 둘 다. 설정에서 끄면 setSeatNamePlate 내부에서 안 보이게 처리.
    // ⭐ 발밑 경험치 바도 같은 자리에서 갱신한다. 이름표를 끄면 바도 같이 숨는다(updateSeatExpBar 내부 처리).
    //    상대 좌석의 진행도(seat.friendExp)는 프리즌스 하트비트로 들어온다. 구버전 상대는 undefined라
    //    null을 넘겨 바를 안 그린다 — 0%로 그리면 "레벨업 직후"로 오해된다.
    /* ⚠️ 순서 주의 — 경험치 바가 **먼저**, 이름표가 나중이다(NAMEPLATE_BELOW_EXPBAR 주석 참고).
       이름표가 바 아래로 비키려면 바의 '이번 프레임' 위치를 알아야 한다. 예전 순서(이름표 → 바)
       그대로 두면 한 프레임 전 값을 보게 되어, 캐릭터가 움직일 때 이름표가 바를 파고든다. */
    /* 🌟 회차면 표시 레벨은 **이번 바퀴** 레벨이고 별이 붙는다. 해금 레벨(getFocusLevel · friendLevel)은 표시에만 안 쓴다 (개정 70). */
    if(seat.remote){
      const st = seat.friendStar || null, lv = st ? st.lv : (seat.friendLevel||1);
      expBarMod().updateSeatExpBar(seat, lv, (seat.friendExp==null ? null : seat.friendExp), st);
      overheadMod.setSeatNamePlate(seat, lv, seat.friendName||'(이름 없음)', st);
    }
    else if(seat.isMe){
      const st = focusLevelMod().myFocusShow(), lv = st ? st.lv : focusLevelMod().getFocusLevel();
      expBarMod().updateSeatExpBar(seat, lv, expBarMod().myExpCells(), st);
      overheadMod.setSeatNamePlate(seat, lv, getDisplayName(), st);
    }
    else if(seat.namePlateEl){ seat.namePlateEl.style.display='none'; if(seat.expBarEl) seat.expBarEl.style.display='none'; }   // 주캐릭터였다가 자리추가로 바뀐 좌석 — 이전 이름표가 남아있지 않게 숨김
    /* 💬 말풍선 — ★ 반드시 이름표·경험치 바 **뒤에** 갱신한다.
       반전 배치(캐릭터가 화면 위)에서는 이름표·바·말풍선이 전부 발밑 한 자리에 쌓이는데,
       비켜주는 쪽은 말풍선 하나다(서로 비키면 매 프레임 서로를 밀어내며 흘러내린다).
       비키려면 위 두 요소의 **이번 프레임 위치**를 알아야 하는데, 예전엔 말풍선이 먼저 돌아서
       한 프레임 전 값을 봤다 — 바가 그 사이에 움직이면 그대로 겹친 채로 남았다.
       ⚠️ 이 세 줄의 순서를 바꾸지 말 것. 순서가 곧 배치 규칙이다.
       (📢 확성기는 제거됨 → 커스텀 상태로 대체. 상태 말풍선이 곧 "지금 뭐 하는지"를 보여줌.) */
    /* 🏢 회사원 모드 — 상태 말풍선은 아예 안 뜬다(요청: 말풍선이 잠긴다).
       채팅만 머리 위 한 줄 라벨로 작게 남는다 — 모양 전환은 setSeatHeadBubble 이 담당한다.
       ⚠️ 이 세 갈래를 호출부에서 정하는 이유: '무엇을 보여줄지'는 여기가, '어떻게 보여줄지'는
          setSeatHeadBubble 이 정한다. 안쪽에서 상태/채팅을 다시 구분하려 들면 판정이 두 곳으로 갈린다. */
    const _chatting = !!(seat.chatBubbleUntil && now < seat.chatBubbleUntil);
    if(_hidden){ overheadMod.setSeatHeadBubble(seat, null); }   // 🙈 캐릭터 없이 말풍선만 뜨지 않게
    else if(officeModeMod().officeMode()){ overheadMod.setSeatHeadBubble(seat, _chatting ? seat.chatBubbleText : null); }
    else if(_chatting){ overheadMod.setSeatHeadBubble(seat, seat.chatBubbleText); }
    // 💭 상태 갈래만 '생각 말풍선'(동그라미 꼬리). 채팅은 뾰족 꼬리 그대로다.
    else{ overheadMod.setSeatHeadBubble(seat, _conf ? _conf.label : focusLevelMod()._mobileBubbleText(_mobApp), true); }
    updateItemHandTrackers(seat);   // 책상 아이템 안의 hand_L/hand_R 지점을 이번 프레임 손 위치로 갱신
  });

  /* selected ring follows selected seat */
// if(selected){selRing.position.x=lerp(selRing.position.x,selected.group.position.x,1-Math.pow(0.001,dt));selRing.visible=true;}
  /* state bar shows selected seat */
  runCost.since('seat', _tSeat);
  if(seatsMod.selected()){const st=seatState(seatsMod.selected(),now);const sc=STATES[st]||STATES.idle;seatPanelMod.dot.style.background=sc.color;seatPanelMod.stateLabel.textContent=sc.label;}

  for(let i=floatersMod.floaters.length-1;i>=0;i--){const f=floatersMod.floaters[i];f.userData.life+=dt;const p=f.userData.life/f.userData.dur;
    f.position.y+=dt*(f.userData.rise!=null?f.userData.rise:floatersMod.FLOATER_RISE);f.position.x+=f.userData.vx*dt;
    // 생애 60%까진 진하게 유지하다 마지막 40%에서만 빠르게 사라지게 — 오래 반투명 상태로 떠있으면서 탁해 보이는 구간을 최소화
    f.material.opacity=Math.max(0, p<0.6 ? 0.95 : 0.95*(1-(p-0.6)/0.4));
    f.scale.setScalar((f.userData.base!=null?f.userData.base:floatersMod.FLOATER_BASE_SCALE)*(1+p*0.4));
    if(p>=1){scene.remove(f);floatersMod.floaters.splice(i,1);}}

  rideBenchMod._checkCircusBalance(now);   // 🎪 묘기 균형 판정(흔들림 → 와해)
  rideBenchMod._updateRideChains(now);   // 🐾 올라탄(탑쌓기 포함) 좌석 위치를 아래층→위층 순으로 확정
  tricksMod._updateFlyingSeats(now, dt);   // 🪑 플라잉체어 — 날고 있는 캐릭터의 rig 좌표를 마지막에 덮어쓴다
  try{ awayPicMod()._awayImgFollow(); }catch(_){}   // 🩹 자리비움 그림이 rig 를 매 프레임 따라간다(비행 버벅임) — _awayImgFollow 주석
  dotRenderMod.sweepIfOn(now);   // 🕹️ 도트 켬 동안 켠 뒤 들어온 메쉬 · 텍스처에도 도트를 건다(0.5초에 한 번)
  if(desktopMode()){ renderer.clear(); }   // 투명 클리어 강제 — 프레임 사이 흰 잔상 방지
  /* 🍎 설정(런처) 화면에서는 #scene 이 display:none 이다(body.desktop.config) — 안 보이는 화면을 그리지 않는다.
     상태 계산은 위에서 그대로 돈다(돌아왔을 때 튀지 않게). 런처는 자기 루프(launcherLoop)가 따로 그린다. */
  /* 회사원 모드로 화면을 숨긴 동안도 그리지 않는다 — 안 보이는 3D 가 포토샵 등과 그래픽 카드를 나눠 쓰지 않게 */
  const _tDraw = performance.now();
  if(!officeModeMod()._officeHidden() && !_configHidesScene()){ _gpuTimer.begin(); renderer.render(scene,camera); _gpuTimer.end(); }
  runCost.since('render', _tDraw);
  seatHitMod.markRendered();   // 🗺️ 히트 맵 — 그린 장 표시만(지도는 판정이 찾을 때 만든다)
  statusChipMod.updateMyStatusChipPosition();   // 본인 상태 칩 위치를 자기 좌석 발 밑에 맞춤
  if(_renderQuality() === FrameBudget.QUALITY.AUTO && document.body.classList.contains('runmode') && _runSlowWatch.note(now, _frameCap(now))) _lowerRunQuality();
  _frameJsStats.add(performance.now() - _frameT0);
  runCost.since('frame', _frameT0);
  if(!manual) requestAnimationFrame(frame);
}

return {
  frame,
};
}

const api = { createFrameLoop };
if(typeof window !== 'undefined') window.TwFrameLoop = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
