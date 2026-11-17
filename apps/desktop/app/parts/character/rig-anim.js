/* rig-anim.js — 🕺 몸짓: 상태별 자세 목표 · 뼈 움직이기 · 클립 고르기(앱 FSD · app.js 분리 M15)
   app.js 의 ANIM 구역 앞쪽(STATES · targetFor · 뼈대 상수 · boneSide · setBone · animateRig · setClip)을 글 그대로 옮긴 모듈이다.
   동작은 옛 자리와 같다(다시 대입되거나 뒤에서 선언되는 값은 읽는 함수로 받는 줄만 달라진다).
   ・책임: STATES(상태 이름 · 색) · targetFor(상태 → 허리 · 호흡 · 눈 · 팔 목표) · animateRig(좌석 한 명의 뼈를 지금 시각에 맞춰 움직인다 — 타자 · 잠 · 흔들림 · 어지러움 · 춤 · 귀 까닥임 · 클릭 반응) · setClip(믹서 클립 바꾸기).
   ・내놓는 것: 같은 이름 const 로 받는 것(app.js · 다른 모듈이 부르는 이름) — 상수 · 함수 한 벌. 읽는 함수로 받은 값은 부를 때 읽는다.
   ⚠️ 부호(SPINE_AXIS 등 ±1)와 각도 상수는 움직임 방향을 정한다 — 숫자를 바꾸면 자세가 뒤집힌다.
   검사: checks/sim-rig-anim.js */
(function(){

function createRigAnim(deps){
const ANIMAL_HAND_REST = deps.ANIMAL_HAND_REST;
const camera = deps.camera;
const iDeskMod = deps.iDeskMod;
const rideTuneMod = deps.rideTuneMod;
const seatPointerMod = deps.seatPointerMod;
const userStatusMod = deps.userStatusMod;
const STATES={idle:{label:'평소',color:'#9dba8a'},focus:{label:'활동중',color:'#e0a050'},pet:{label:'쓰다듬',color:'#e89b9b'},sleep:{label:'잠듦',color:'#7fa0c4'},shaking:{label:'흔들림',color:'#d98e73'},dizzy:{label:'어지러움',color:'#c9a560'}};
function targetFor(s){switch(s){
  case 'focus':return{leanX:0.08,turnY:0,slumpY:0,breSpd:2.6,breAmp:0.018,eyeOpen:1,arm:1}; // 활동중 숙임도 0.12 -> 0.08로 줄임, 타이핑 사이클 살짝 느리게 (3.2→2.6)
  case 'pet':return{leanX:-0.03,turnY:0,slumpY:-0.03,breSpd:2.6,breAmp:0.025,eyeOpen:0.2,arm:0};
  case 'shaking':return{leanX:0,turnY:0,slumpY:0.02,breSpd:5,breAmp:0.04,eyeOpen:0.5,arm:0};   // 들려서 흔들리는 중 (rotation.z는 frame에서 velocity 기반)
  case 'dizzy':  return{leanX:0.35,turnY:0,slumpY:-0.30,breSpd:1.2,breAmp:0.025,eyeOpen:0.10,arm:0}; // 허리 살짝 세움, 머리는 DIZZY_HEAD_DROOP로 별도 숙임
// breAmp(호흡 진폭)를 0.045에서 0.015로 대폭 줄여서 얌전하게 숨 쉬도록 변경
case 'sleep':return{leanX:0.1,turnY:0.04,slumpY:-0.03,breSpd:0.9,breAmp:0.015,eyeOpen:0,arm:0};  default:return{leanX:0,turnY:0,slumpY:0,breSpd:2,breAmp:0.025,eyeOpen:1,arm:0};}}
const lerp=(a,b,t)=>a+(b-a)*t;
const SPINE_AXIS=1, HEAD_AXIS=1, HAND_AXIS=1;   // 움직임 반대면 부호 뒤집기
// ★ 상체를 덜 숙이게 하는 보정값(라디안). 인간·동물 공통으로 적용된다.
//   양수일수록 덜 숙임(허리를 폄), 0이면 예전 그대로, 음수면 더 숙임.
//   숨쉬기(breath)에는 영향을 주지 않고 기울임(leanX)만 완화하므로 호흡 애니메이션은 그대로 살아있다.
const SPINE_LEAN_RELIEF = 0.03;
// ★ 이 숫자가 0.0이면 팔이 안 올라가요! 0.4 나 -0.4 등으로 바꿔주셔야 적용됩니다.
const HAND_REST   = -1.0;         // 평소 손 기본각(아주 조금 올림). 더 올리려면 0쪽(예 -0.7), 내리려면 −쪽(예 -1.0)
// 🐾 동물 전용 팔 기본각(ANIMAL_HAND_REST)은 파일 앞쪽 '동물 상수 모음'으로 옮겼음 —
//   applyStaticHandRest(런처 미리보기)가 훨씬 위에서 이 값을 쓰기 때문(TDZ 회피).
const FOCUS_ARM_LIFT = -0.1;      // ★ 타이핑할 때 책상 위로 팔을 들어 올리는 각도 
                                  // (만약 팔이 척추 쪽으로 더 말려 들어간다면 +0.8 처럼 부호를 반대로 바꿔보세요!)
const HAND_TAP_AMP = 0.18;        // 타이핑(p.arm) 시 손 까딱 폭
const CLICK_TAP_DUR = 260;        // 마우스 클릭 반응 지속시간(ms) — 오른손 까딱 한 번의 길이
const CLICK_TAP_AMP = 0.35;       // 마우스 클릭 반응 오른손 까딱 폭(라디안)
const CLICK_LIFT_AMP = -0.15;     // 마우스 클릭 반응 시 오른손을 살짝 들어올리는 오프셋(책상에 안 박히게). 음수=위로
const LEG_SWING    = 0.06;        // 다리 idle 스윙 폭(라디안). 0이면 정지
// 귀 까닥임(랜덤, 가끔) — ear 본이 있는 캐릭터에서만 동작. 상태(idle/focus 등)와 무관하게 항상 독립적으로 발동.
const EAR_FLICK_AXIS = 1;         // 움직임 방향이 반대면 -1로 뒤집기
const EAR_FLICK_AMP  = 0.5;       // 까닥임 폭(라디안) — 크게 확 움직이는 느낌
const EAR_FLICK_DUR  = 220;       // 한 번 까닥이는 데 걸리는 시간(ms) — 짧고 빠르게
const EAR_FLICK_GAP_MIN = 4000, EAR_FLICK_GAP_MAX = 11000;   // 다음 까닥임까지 대기시간 범위(ms) — 랜덤, 자주는 안 움직임
const DIZZY_ARM_SPREAD = -0.5;  // 어지러움(엎드림) 때 팔을 양옆으로 벌리는 각도(Z축). 부호로 방향
const DIZZY_ARM_FORWARD = -0.1; // 어지러움 때 팔을 앞으로 뻗어 책상 위에 얹는 각도(X축). 음수=책상 위로 올라옴
const DIZZY_HEAD_DROOP = 0.3;   // 어지러움 때 머리를 앞으로 숙이는 각도(X축). spine leanX와 합산됨
const SHAKE_ARM_DROOP = 0.6;    // 흔들기 중 팔이 축 처져 내려오는 각도(X축)
function boneSide(n){
  if(/(^|[_.\s-])l$|left|handl$|arml$/.test(n))return 'l';     // Hand_L, Hand.L, HandL, ...Left
  if(/(^|[_.\s-])r$|right|handr$|armr$/.test(n))return 'r';     // Hand_R, Hand.R, HandR, ...Right
  return null; }
const _be=new THREE.Euler(), _bq=new THREE.Quaternion();
const _hp=new THREE.Vector3(), _hq=new THREE.Quaternion(), _hpq=new THREE.Quaternion();
function setBone(bone,rest,x,y,z){ if(!bone||!rest)return; _be.set(x,y,z,'XYZ'); _bq.setFromEuler(_be); bone.quaternion.copy(rest).multiply(_bq); }
function animateRig(seat,now,state){
  const b=seat.bones, r=seat.boneRest, p=seat.pose, t=now/1000;
  const us = seat.remote ? seat.remoteUserStatus : (seat.isMe ? userStatusMod.userStatus() : null);   // 활동 상태(밥먹는중 등) — head bob과 타이핑 속도 계산 둘 다에서 씀
  // dizzy 진입 시 1회: head 본의 현재 월드 높이를 읽어 얼굴이 책상에 닿도록 slumpY 보정값 계산
  // (커미션마다 spine/head 본 위치가 달라 고정 slumpY로는 얼굴 도달 위치가 제각각이라 자동 보정)
  // dizzy(어지러움): 추가 슬럼프로 얼굴이 책상에 더 가까이 박히도록 (측정 불안정으로 자동 보정 폐기, 고정값 사용)
  // 값이 더 음수일수록 더 깊이 박힘. 시각상 부족/과하면 이 상수만 조정.
  const DIZZY_EXTRA_SLUMP = 0;       // dizzy 시 상체 추가 슬럼프. 0이면 자세 그대로(가라앉지 않음). 더 박히려면 -0.1 등
  const _dizzyTarget = (state==='dizzy') ? DIZZY_EXTRA_SLUMP : 0;
  const _focusLock = (state==='focus');   // 빡일 중(집중): spine·head를 둥실거리지 않게 딱 고정
  // 정신차리기: 드래그 중 흔들다 멈춘 뒤 300~1300ms 동안(≈1초) 고개 좌우 흔들흔들 + blink
  const _stillMs = (seatPointerMod.drag() && seatPointerMod.drag().seat===seat && seatPointerMod.drag().lastMoveT) ? (now - seatPointerMod.drag().lastMoveT) : -1;
  const isRecovering = (state==='shaking') && seatPointerMod.drag() && seatPointerMod.drag().seat===seat
    && seatPointerMod.drag().dizzy > 30 && _stillMs > 300 && _stillMs < 1300;
  if(b.spine){ const breath = _focusLock ? 0 : Math.sin(seat.breathePhase)*(p.breAmp*1.6);
    setBone(b.spine, r.spine, SPINE_AXIS*(breath + p.leanX*0.8 - SPINE_LEAN_RELIEF), 0, 0); }
  if(b.head){
    let bob, look, droop, roll;
    if(seat.pinned){
      // 액자 고정: 머리가 마우스 포인터 따라감
      _hp.setFromMatrixPosition(seat.bodyWrap.matrixWorld);
      _hp.project(camera);   // 캐릭터 화면 NDC
      const dx = seatPointerMod.mouseNdcX() - _hp.x, dy = seatPointerMod.mouseNdcY() - _hp.y;
      look  = Math.max(-0.5, Math.min(0.5, dx * 1.0));    // 좌우(yaw)
      droop = Math.max(-0.25, Math.min(0.3, -dy * 0.6));  // 위아래(pitch, HEAD_AXIS와 결합)
      bob = 0; roll = 0;
    } else {
      // 🍚 밥 먹는 중: spine은 건드리지 않고 head 본만 빠르게 위아래로 까딱여서 씹는(먹는) 느낌을 냄.
      //   일반 bob(숨쉬기에 얹히는 잔잔한 흔들림)보다 훨씬 빠르고 뚜렷하게.
      const isMeal = (us==='meal' && state!=='shaking' && state!=='pet');
      bob  = isMeal ? Math.sin(t*9)*0.05
           : (_focusLock||state==='dizzy') ? 0 : Math.sin(t*1.3+seat.headPhase)*0.05;
      look = isRecovering ? Math.sin(t*24)*0.45
           // 어지러움: 서로 다른 속도를 섞어 불규칙하고 무겁게 비틀거리는 좌우 움직임
           : (state==='dizzy') ? Math.sin(t*2.0)*0.3 + Math.sin(t*5.3)*0.1 
           : _focusLock ? 0
           : isMeal ? 0
           : Math.sin(t*0.3+seat.headPhase)*0.10;
      droop= isMeal ? 0.10
           : isRecovering ? 0.40
           // 어지러움: 기본으로 푹 숙인 상태에서, 불규칙하게 고개가 앞으로 더 꺾이는 움직임
           : (state==='dizzy') ? DIZZY_HEAD_DROOP + Math.sin(t*1.7)*0.2 + Math.cos(t*4.1)*0.15 
           : (state==='sleep')?0.35:(state==='focus'?0.12:0);
      // 어지러움: 좌우/상하 움직임과 타이밍이 어긋나는 갸우뚱(Z축)을 추가해 균형을 잃은 느낌 강조
      roll = (!isMeal && state==='dizzy') ? Math.sin(t*2.2)*0.25 : 0;
    }
    setBone(b.head, r.head, HEAD_AXIS*(bob+droop), look, roll);
  }

  
  if(b.head && seat.headAnchor && seat.equipped && (seat.equipped.hair||seat.equipped.accessory)){
    b.head.updateWorldMatrix(true,false); seat.bodyWrap.updateWorldMatrix(true,false);
    _hp.setFromMatrixPosition(b.head.matrixWorld); seat.headAnchor.position.copy(seat.bodyWrap.worldToLocal(_hp));
    _hq.setFromRotationMatrix(b.head.matrixWorld); seat.bodyWrap.getWorldQuaternion(_hpq);
    seat.headAnchor.quaternion.copy(_hpq.invert().multiply(_hq));
  }
  
  const tap=p.arm;

  // 표준 리그 통합: 커미션 자동보정(armRestRot) 제거 — 손은 bind 자세 기준
  let baseArmRot = (seat.charDef && seat.charDef.animal) ? ANIMAL_HAND_REST : HAND_REST;   // 🐾 동물만 별도 기본각(인간 값은 그대로) — 묘기 자세에서 아래에 더해지므로 let
  let armSpread  = (state==='dizzy') ? DIZZY_ARM_SPREAD : 0;    // dizzy: 팔 양옆 펼침(Y축) — 묘기 자세에서 아래에 더해지므로 let
  // 팔 X축 추가 회전: dizzy면 책상 위로, shaking이면 축 처짐
  const armForward = (state==='dizzy')   ? DIZZY_ARM_FORWARD
                   : (state==='shaking') ? SHAKE_ARM_DROOP
                   : 0;

  // 빡일중(grind)일 때는 타이핑 속도를 2배(20)로, 평소엔 기본 속도(10)로 설정합니다.
  const tapSpeed = (us === 'grind') ? 20 : 10;
  
  // ★ 추가: 빡일중일 때는 허리를 숙인 만큼 팔을 위로 더 들어 올립니다.
  const extraLift = (us === 'grind') ? -0.2 : 0; 

  // 손: 평소 기본각 + 타이핑 시 들어 올리는 각도(FOCUS_ARM_LIFT) + 까딱거리는 타이핑 모션을 결합합니다.
  // X축=앞뒤 굽힘, Y축=비틀기(시각 변화 거의 없음), Z축=양옆 벌림 — armSpread는 Z로
  const liftAngle = (FOCUS_ARM_LIFT + extraLift) * tap;
  // 마우스 클릭 반응: 오른손만 짧게 까딱(타이핑 여부와 무관하게 독립적으로 더해짐), 왼손은 그동안 정지, 살짝 들어올려 책상에 안 박히게.
  // seat.clickTapAt(performance.now() 기준시각)으로부터 CLICK_TAP_DUR(ms) 동안 0→1→0 사인 펄스 한 번.
  let clickTapVal = 0;
  const _elapsed = seat.clickTapAt ? (performance.now() - seat.clickTapAt) : Infinity;
  if(_elapsed < CLICK_TAP_DUR){
    clickTapVal = Math.sin((_elapsed/CLICK_TAP_DUR) * Math.PI);   // 0→1→0 부드러운 펄스
  }
  const clicking = clickTapVal > 0.001;
  // 🎪 묘기 중이면 균형 잡듯 양팔을 옆으로 쫙 벌린다(_positionRideSeat가 seat._circusOn을 세움).
  if(seat._circusOn){
    armSpread -= rideTuneMod.CIRCUS_ARM_SPREAD;      // ★ 부호 — 반대로 꺾이면 +로 바꾸면 됨
    baseArmRot += rideTuneMod.CIRCUS_ARM_DROP;       // 벌린 상태에서 높이만 내림(양수 = 내려감)
  }
  const leftTapAmp = clicking ? 0 : HAND_TAP_AMP*tap;   // 클릭 반응 중엔 왼손 까딱 정지
  if(b.handL) setBone(b.handL, r.handL, baseArmRot + armForward + liftAngle + HAND_AXIS*Math.abs(Math.sin(t*tapSpeed))*leftTapAmp,    0,  armSpread);
  if(b.handR) setBone(b.handR, r.handR, baseArmRot + armForward + liftAngle + HAND_AXIS*Math.abs(Math.sin(t*tapSpeed+1.6))*HAND_TAP_AMP*tap + HAND_AXIS*CLICK_TAP_AMP*clickTapVal + HAND_AXIS*CLICK_LIFT_AMP*clickTapVal, 0, -armSpread);


  // 다리: spine 직속으로 매달려 좌우 교대 미세 스윙(로컬 X)
  if(seat._benchSit && !seat.beingShaken && !seat.pinned){
    // 🪑 벤치 앉기 — 허벅지를 앞으로 접어(무릎이 앞으로) 앉은 자세. 좌우로 아주 미세하게만 흔들어 자연스럽게.
    //   ★ 드래그(흔들기)/고정 중에는 앉기 포즈를 풀어 서 있는 다리로 — 들어올릴 때 다리가 접힌 채면 어색함.
    const SIT_THIGH = -1.35;  // 허벅지 굽힘(라디안). 음수=앞으로 접힘. |값| 키우면 더 깊이 앉음
    const wob = Math.sin(t*1.0 + seat.swayPhase)*0.03;   // 살짝살짝
    if(b.legL) setBone(b.legL, r.legL, SIT_THIGH+wob, 0, 0.05);
    if(b.legR) setBone(b.legR, r.legR, SIT_THIGH-wob, 0, -0.05);
  } else if(seat._circusOn){
    // ★ 딛는 발은 '좌석에 한 번 정해 저장'한다. 예전엔 swayPhase로 매번 계산했는데,
    //   그 값이 좌석 재조립 등으로 바뀌면 딛는 발도 같이 바뀌어 왼발↔오른발이 오갔다.
    if(seat._circusStandLeft === undefined) seat._circusStandLeft = (Math.random() < 0.5);
    const standLeft = seat._circusStandLeft;
    // 🎪 든 발 까딱임 — 정의가 빠져 있어 묘기 자세(3층+)에서 매 프레임 ReferenceError로 렉이 났음. 복원.
    const wag = Math.sin(t*rideTuneMod.CIRCUS_LEG_WAG_SPD + (seat.swayPhase||0)) * rideTuneMod.CIRCUS_LEG_WAG;
    const stand = rideTuneMod.CIRCUS_LEG_STAND, lift = rideTuneMod.CIRCUS_LEG_LIFT + wag;
    if(b.legL) setBone(b.legL, r.legL, standLeft ? stand : lift, 0, 0);
    if(b.legR) setBone(b.legR, r.legR, standLeft ? lift : stand, 0, 0);
  }else{
    const ls = Math.sin(t*1.1 + seat.swayPhase)*LEG_SWING;
    if(b.legL) setBone(b.legL, r.legL,  ls, 0, 0);
    if(b.legR) setBone(b.legR, r.legR, -ls, 0, 0);
  }

  // 💃 춤 — 위에서 설정한 spine/팔/다리를 덮어써서 스타일별 이모트 재생. 절차적이라 전 캐릭터 공통.
  //   스타일 전달: 내 좌석은 danceStyle, 친구 좌석은 remoteDanceStyle(페이로드로 수신).
  if(state==='dance'){
    const dstyle = seat.remote ? (seat.remoteDanceStyle||'sway') : (seat.danceStyle||'sway');
    /* ⏱ 이 춤이 언제 시작됐나 — **친구 화면에서도** 재야 하는 값이다.
       [왜 danceUntil 로 역산하지 않나] 그 값은 내 좌석에만 있다. 친구에게는 상태('dance')와
         스타일만 전달되므로, 남의 화면에서는 남은 시간을 알 방법이 없다. 회전 횟수를 세는 춤은
         시작점이 없으면 남의 화면에서만 바퀴 수가 어긋난다.
       ★ 스타일이 바뀌어도 다시 찍는다(댄스배틀로 춤이 교체되는 경우). */
    if(seat._danceAtStyle !== dstyle || !seat._danceStartAt){
      seat._danceStartAt = performance.now();
      seat._danceAtStyle = dstyle;
    }
    const dt = (performance.now() - seat._danceStartAt) / 1000;   // 이 춤이 시작된 뒤 흐른 초
    if(dstyle==='trick' || dstyle===iDeskMod.TRICK_TURBO_STYLE){
      /* 🤸 묘기 회전 — ①자세 잡기 ②제자리 5회전 ③처음 방향으로 복귀.
         🌀 터보(`/150`×3)면 같은 시간에 10바퀴 — 구간 시간은 그대로, 바퀴 수만 곱한다.
         ★ 회전각을 `t`(전역 시각)가 아니라 **진행률 × 바퀴 수**로 만든다. 그래서 프레임이 끊기거나
           춤을 늦게 본 사람의 화면에서도 정확히 그 바퀴만큼 돌고 원래 방향으로 선다
           (기존 spin 은 t 에 비례해 계속 도는 방식이라 끝나는 방향이 매번 달랐다).
         ★ 한 발 서기 자세는 탑쌓기(서커스)에서 왔지만 **든 발의 축만 다르다** — 탑쌓기는 남의 머리
           위라 뒤로 들고(X축), 이쪽은 정면에서 보이는 자세라 옆으로 뻗는다(Z축, TRICK_LEG_SIDE).
           각도 크기와 딛는 발은 CIRCUS_LEG_* 를 그대로 쓰므로 그쪽을 조정하면 여기도 따라온다. */
      seat._danceSpin = true;                                    // 끝난 뒤 잔여 회전 복원은 기존 경로가 맡는다
      const turns = iDeskMod._trickTurns(dstyle);
      const inE   = iDeskMod._trickEaseIn(dt);                                      // 0→1 자세 잡는 중(앞쪽에 몰아친다)
      const spinP = Math.min(1, Math.max(0, (dt - iDeskMod.TRICK_IN_S) / iDeskMod.TRICK_SPIN_S));  // 0→1 회전 진행률
      const ease  = spinP < 0.5 ? 2*spinP*spinP : 1 - Math.pow(-2*spinP + 2, 2)/2;  // 부드럽게 붙었다 떨어지게
      seat.rig.rotation.y = ease * Math.PI * 2 * turns;          // ★ 정확히 turns 바퀴 — 끝나면 2π 배수라 제자리
      // 회전이 붙을수록 살짝 몸을 세우고 발끝으로 서는 느낌
      const lift = inE * (0.6 + 0.4*Math.sin(Math.min(1, spinP*3)*Math.PI/2));
      if(seat.bodyWrap) seat.bodyWrap.position.y = 0.05 * lift;
      if(b.spine) setBone(b.spine, r.spine, SPINE_AXIS*0.02, 0, 0);
      if(b.head)  setBone(b.head,  r.head,  -0.08*inE, 0, 0);              // 시선 살짝 위로
      /* 양팔을 **좌우로 곧게** 뻗어 균형 — 위로 들어올리지 않는다.
         ★ 예전에는 X축(앞뒤 굽힘)에 -1.55 를 줘서 팔이 위를 향한 채 길게 뻗었다. 그러면 회전
           들어가기 전에 만세 자세가 한 박자 보여서 "묘기 자세"로 안 읽혔다.
         ★ 벌림 폭은 TRICK_ARM_SPREAD 하나가 정한다(탑쌓기와 분리) — 이쪽은 정면에서 도는
           자세라 같은 폭이면 좁아 보인다.
         ★ 높이는 TRICK_ARM_LIFT 하나로 조정한다 — 올리고 내릴 때 여기 말고 그 상수를 볼 것. */
      const armBase   = iDeskMod._trickArmBase(baseArmRot, seat._circusOn, inE);
      const armSpreadT = iDeskMod._trickArmSpread(inE);                   // 폭은 TRICK_ARM_SPREAD 로 조정한다
      if(b.handR) setBone(b.handR, r.handR, armBase, 0,  armSpreadT);
      if(b.handL) setBone(b.handL, r.handL, armBase, 0, -armSpreadT);
      // 한 발 서기 — 딛는 발은 좌석에 한 번 정해 저장한다(탑쌓기와 같은 규칙: 매번 계산하면 발이 오간다)
      if(seat._trickStandLeft === undefined) seat._trickStandLeft = (Math.random() < 0.5);
      const lp = iDeskMod._trickLegPose(seat._trickStandLeft, inE);       // 든 발은 옆으로(Z), 딛는 발만 X
      if(b.legL) setBone(b.legL, r.legL, lp.legL.x, 0, lp.legL.z);
      if(b.legR) setBone(b.legR, r.legR, lp.legR.x, 0, lp.legR.z);
    } else if(dstyle==='spin'){
      // 🎠 오르골 — 제자리에서 아주 천천히 도는 인형. 발은 거의 중앙에 모으고, 오른팔 만세·왼팔 살짝 벌림.
      seat._danceSpin = true;
      seat.rig.rotation.y = t*1.3 + (seat.swayPhase||0);        // 오르골처럼 느린 회전 (3.0 → 1.3)
      const bob = Math.sin(t*2.4)*0.02;                          // 아주 미세한 상하(오르골 느낌)
      if(seat.bodyWrap) seat.bodyWrap.position.y = Math.abs(bob);
      if(b.spine) setBone(b.spine, r.spine, SPINE_AXIS*0.03, 0, 0);          // 곧게 선 자세
      if(b.head)  setBone(b.head,  r.head,  0, Math.sin(t*1.3)*0.1, 0);
      const wing = Math.sin(t*2.4)*0.06;
      if(b.handR) setBone(b.handR, r.handR, baseArmRot - 1.9,  0,  0.3 + wing);   // 🙌 오른팔 만세
      if(b.handL) setBone(b.handL, r.handL, baseArmRot - 0.55, 0, -(0.7 + wing)); // 왼팔 살짝만 벌림(덜 내림)
      // 발 거의 중앙으로 모음 — 잔발 없이 가지런히
      if(b.legL) setBone(b.legL, r.legL, 0, 0, -0.015);
      if(b.legR) setBone(b.legR, r.legR, 0, 0,  0.015);
    } else if(dstyle==='tantrum'){
      // 😭 누워서 떼쓰기 — 등을 대고 누워(뒤로 젖힘) 팔다리를 파닥파닥. 아이가 바닥에서 떼쓰는 모션.
      const f = t*11;                                            // 파닥임 속도(빠르게)
      if(seat.bodyWrap) seat.bodyWrap.rotation.x = -1.5;         // 등 대고 누움(≈ -86°)
      seat._danceFlipActive = true;                             // 눕힘 적용 중(복원 로직 참고)
      if(b.spine) setBone(b.spine, r.spine, SPINE_AXIS*0.05, Math.sin(f*0.5)*0.12, 0);  // 몸통 살짝 뒤척
      if(b.head)  setBone(b.head,  r.head,  0.2, Math.sin(f*0.7)*0.25, 0);              // 머리 도리도리(칭얼)
      // 팔 파닥파닥 — 좌우 엇갈려 위아래로 마구
      if(b.handL) setBone(b.handL, r.handL, baseArmRot + Math.sin(f)*0.7,        0, -0.5 + Math.sin(f)*0.3);
      if(b.handR) setBone(b.handR, r.handR, baseArmRot + Math.sin(f+2.1)*0.7,    0,  0.5 - Math.sin(f+2.1)*0.3);
      // 다리 파닥파닥 — 팔과 엇박으로 버둥거림
      if(b.legL) setBone(b.legL, r.legL, -0.4 + Math.sin(f+1.0)*0.5, 0, -0.1);
      if(b.legR) setBone(b.legR, r.legR, -0.4 + Math.sin(f+3.2)*0.5, 0,  0.1);
    } else {
      // 🐱 happy cat — 팔을 위아래로 빠르게 파닥파닥. 좌우 아주 살짝 몸 흔들.
      const BPS = 2.4;                                   // 파닥임 속도(초당 박자)
      const beat = t*BPS + (seat.swayPhase||0)*0.3;
      const flap = Math.sin(beat*Math.PI*2);             // -1~1 위아래 파닥
      // 팔을 옆으로 어느 정도 벌린 상태(SPREAD)에서, 위아래(X축 baseArmRot)로 파닥파닥.
      const SPREAD = 0.7;                                 // 팔 벌림(고정) — 너무 좁지도 넓지도 않게
      const FLAP_AMP = 0.9;                               // 위아래 파닥 크기(클수록 크게 펄럭)
      if(b.handL) setBone(b.handL, r.handL, baseArmRot - 0.1 + flap*FLAP_AMP, 0, -SPREAD);
      if(b.handR) setBone(b.handR, r.handR, baseArmRot - 0.1 - flap*FLAP_AMP, 0,  SPREAD);  // 반대 위상 = 양팔 엇갈려 파닥(더 밈 같음)
      const sway = Math.sin(beat*Math.PI*0.5);           // 몸 좌우 아주 살짝
      if(b.spine) setBone(b.spine, r.spine, SPINE_AXIS*(Math.sin(seat.breathePhase)*0.02), sway*0.08, sway*0.1);
      const step = sway*0.12;
      if(b.legL) setBone(b.legL, r.legL,  step, 0, 0);
      if(b.legR) setBone(b.legR, r.legR, -step, 0, 0);
      if(b.head) setBone(b.head, r.head, Math.abs(flap)*0.05, sway*0.1, sway*0.08);   // 파닥에 맞춰 고개 까딱
    }
  }
  /* ⏱ 춤이 끝나면 시작 시각을 지운다 — 다음 춤이 처음부터 세도록.
     안 지우면 같은 스타일을 다시 췄을 때 이전 진행률을 이어받아, 자세를 잡기도 전에 회전이
     끝나 있거나 아예 안 도는 것처럼 보인다. */
  if(state!=='dance' && seat._danceStartAt){ seat._danceStartAt = 0; seat._danceAtStyle = null; }
  // 🌀 헤드스핀 잔여 회전 복원 — 춤이 끝나거나 다른 상태로 바뀌면 몸 Y 회전을 부드럽게 0으로.
  if(seat._danceSpin && state!=='dance'){
    let ry = seat.rig.rotation.y % (Math.PI*2);
    if(ry >  Math.PI) ry -= Math.PI*2;
    if(ry < -Math.PI) ry += Math.PI*2;
    ry *= 0.82;
    if(Math.abs(ry) < 0.03){ seat.rig.rotation.y = 0; seat._danceSpin = false; }
    else seat.rig.rotation.y = ry;
  }
  // 🤸 뒤집힌 몸(headspin) 복원 — 이번 프레임에 뒤집기를 적용 안 했으면 bodyWrap X회전을 0으로 수렴.
  //   (animateRig엔 dt가 없어 프레임당 고정 비율 감쇠 사용 — 약 0.75배씩)
  if(seat.bodyWrap && !seat._danceFlipActive && Math.abs(seat.bodyWrap.rotation.x) > 0.001){
    seat.bodyWrap.rotation.x *= 0.75;
    if(Math.abs(seat.bodyWrap.rotation.x) < 0.02) seat.bodyWrap.rotation.x = 0;
  }
  seat._danceFlipActive = false;   // 다음 프레임을 위해 리셋(헤드스핀 중이면 위에서 다시 true)

  // 귀 까닥임 — ear 본이 하나 이상 있을 때만
  // 완전히 무관하게 독립적으로 랜덤 발동. 다른 애니메이션이 건드리는 뼈와 안 겹쳐서 서로 절대 간섭 안 함.
  if(b.ear && b.ear.length){
    // ★ 예전엔 좌석 전체가 타이머 하나(seat.earFlickStart/earNextAt)를 공유해서, 귀 파츠가 여러 개면
    //   전부 똑같은 타이밍에 까닥여서 부자연스러웠음 — 귀 본(bone)마다 독립된 타이머를 갖도록 변경.
    //   배열 크기가 바뀌면(파츠 장착/해제) 새로 초기화하되, 처음부터 서로 다른 랜덤 대기시간을 줘서
    //   시작부터 타이밍이 어긋나게 함.
    if(!seat.earTimers || seat.earTimers.length !== b.ear.length){
      seat.earTimers = b.ear.map(()=>({ flickStart:null, nextAt: now + Math.random()*EAR_FLICK_GAP_MAX }));
    }
    b.ear.forEach((bone,i)=>{
      const timer = seat.earTimers[i];
      if(timer.flickStart==null && now >= timer.nextAt){ timer.flickStart = now; }
      if(timer.flickStart!=null){
        const el = now - timer.flickStart;
        if(el >= EAR_FLICK_DUR){
          // 까닥임 종료 — 다음 까닥임까지 랜덤 대기(이 본만)
          timer.flickStart = null;
          timer.nextAt = now + EAR_FLICK_GAP_MIN + Math.random()*(EAR_FLICK_GAP_MAX-EAR_FLICK_GAP_MIN);
          setBone(bone, r.ear[i], 0, 0, 0);   // 정지 상태로 복귀
        } else {
          const prog = el/EAR_FLICK_DUR;
          const amt = Math.sin(prog*Math.PI) * EAR_FLICK_AMP;   // 0→최대→0, 빠르고 확 움직이는 느낌
          setBone(bone, r.ear[i], EAR_FLICK_AXIS*amt, 0, 0);
        }
      }
    });
  }
}

function setClip(seat,state){ if(!seat.mixer)return; const a=seat.actions[state]||seat.actions.idle; if(!a||a===seat.current)return;
  if(seat.current)seat.current.fadeOut(0.3); a.reset().fadeIn(0.3).play(); seat.current=a;}

return {
  STATES,
  targetFor,
  lerp,
  SPINE_AXIS,
  HEAD_AXIS,
  HAND_REST,
  FOCUS_ARM_LIFT,
  SHAKE_ARM_DROOP,
  boneSide,
  setBone,
  animateRig,
  setClip,
};
}

const api = { createRigAnim };
if(typeof window !== 'undefined') window.TwRigAnim = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
