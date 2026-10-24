/* ride-bench.js — 🗼 올라타기(탑) · 벤치 좌석 자리 잡기 · 🪑 멀티좌석 책상(2·3인승 벤치 — 끌어서 슬롯에 앉히기)
   app.js «🗼 올라타기(탑) · 벤치 좌석 자리 잡기» · «🪑 멀티좌석 책상(2·3인승 벤치)» 두 구역의 본문을 그대로 옮긴 모듈이다(앱 FSD 30번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 6줄 —
     IDESK_ENABLED · INTERACTION_DESKS · Presence · savedParts 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 15개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _checkCircusBalance · _remeasureRideHeadTop · _resetIdeskRestore · _rideBottom · _rideDepth · _rideIsAbove · _rideLeaveTower · _rideRiders · _updateRideChains · attachBenchToSeat · findBenchSlot · mountBench · mountRide · restoreInteractionDesk · toggleIdeskInventory · unmountBench · unmountRide — app.js 는 rideBenchMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwRideBench — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-ride-bench.js */
(function(){

function createRideBench(deps){
const ANIMAL_RUN_SCALE = deps.ANIMAL_RUN_SCALE;
const CIRCUS_FOOT_CENTER = deps.CIRCUS_FOOT_CENTER;
const CIRCUS_FOOT_SINK = deps.CIRCUS_FOOT_SINK;
const CIRCUS_FOOT_Z = deps.CIRCUS_FOOT_Z;
const CIRCUS_FOOT_Z_FROM_TOP = deps.CIRCUS_FOOT_Z_FROM_TOP;
const CIRCUS_MIN_DEPTH = deps.CIRCUS_MIN_DEPTH;
const CIRCUS_PANIC_MS = deps.CIRCUS_PANIC_MS;
const CIRCUS_PANIC_SLEEPERS = deps.CIRCUS_PANIC_SLEEPERS;
const CIRCUS_SWAY_CALM = deps.CIRCUS_SWAY_CALM;
const CIRCUS_SWAY_PANIC = deps.CIRCUS_SWAY_PANIC;
const CIRCUS_SWAY_SPEED = deps.CIRCUS_SWAY_SPEED;
const CIRCUS_TOP_SLAB = deps.CIRCUS_TOP_SLAB;
const CIRCUS_TREMOR_AMP = deps.CIRCUS_TREMOR_AMP;
const CIRCUS_TREMOR_AT = deps.CIRCUS_TREMOR_AT;
const CIRCUS_TREMOR_CALMDOWN = deps.CIRCUS_TREMOR_CALMDOWN;
const CIRCUS_TREMOR_SPD = deps.CIRCUS_TREMOR_SPD;
const CIRCUS_YAW_MAX = deps.CIRCUS_YAW_MAX;
const CIRCUS_YAW_MIN = deps.CIRCUS_YAW_MIN;
const CIRCUS_YAW_RANDOM = deps.CIRCUS_YAW_RANDOM;
const CIRCUS_Z_DEPTH_K_ON_ANIMAL = deps.CIRCUS_Z_DEPTH_K_ON_ANIMAL;
const IDESK_ENABLED = deps.IDESK_ENABLED;   // 읽는 함수
const INTERACTION_DESKS = deps.INTERACTION_DESKS;   // 읽는 함수
const Presence = deps.Presence;   // 읽는 함수
const RIDE_ARM_SINK = deps.RIDE_ARM_SINK;
const RIDE_ARM_SINK_ON_ANIMAL = deps.RIDE_ARM_SINK_ON_ANIMAL;
const RIDE_ARM_SIZE_FOLLOW = deps.RIDE_ARM_SIZE_FOLLOW;
const RIDE_FOLLOW_HEAD_TILT = deps.RIDE_FOLLOW_HEAD_TILT;
const RIDE_HEAD_OFFSET_Y = deps.RIDE_HEAD_OFFSET_Y;
const RIDE_HEAD_OFFSET_Z = deps.RIDE_HEAD_OFFSET_Z;
const RIDE_HEAD_OFFSET_Z_ON_ANIMAL = deps.RIDE_HEAD_OFFSET_Z_ON_ANIMAL;
const RIDE_MAX_STACK = deps.RIDE_MAX_STACK;
const RIDE_PART_CENTER_MARGIN = deps.RIDE_PART_CENTER_MARGIN;
const RIDE_Z_DEPTH_K_ON_ANIMAL = deps.RIDE_Z_DEPTH_K_ON_ANIMAL;
const _collapseRideTower = deps._collapseRideTower;
const _deskDefById = deps._deskDefById;
const _measureAnimalArmH = deps._measureAnimalArmH;
const _measureCircusFootOff = deps._measureCircusFootOff;
const _rideAwayP = deps._rideAwayP;
const _rideAwayS = deps._rideAwayS;
const _rideAxisY = deps._rideAxisY;
const _rideBottom = deps._rideBottom;
const _rideFootOff = deps._rideFootOff;
const _rideHostSpinY = deps._rideHostSpinY;
const _rideOff = deps._rideOff;
const _rideQC = deps._rideQC;
const _rideQD = deps._rideQD;
const _rideQP = deps._rideQP;
const _rideQR = deps._rideQR;
const _rideQSpin = deps._rideQSpin;
const _rideQY = deps._rideQY;
const _rideTmp = deps._rideTmp;
const _rideWP = deps._rideWP;
const broadcastRide = deps.broadcastRide;
const charLiftWorld = deps.charLiftWorld;
const diagNote = deps.diagNote;   // 진단 기록(tw-mouse-diag.log) 한 줄 — 설치본은 콘솔을 못 보니 제보 때 이 파일로 높이 값을 본다
const getActiveInteractionDeskId = deps.getActiveInteractionDeskId;
const isDeskUnlocked = deps.isDeskUnlocked;
const isPartByRigOrName = deps.isPartByRigOrName;
const layoutSeats = deps.layoutSeats;
const matWood = deps.matWood;
const matWoodD = deps.matWoodD;
const measureBodyBox = deps.measureBodyBox;
const measureHeadBoxNoParts = deps.measureHeadBoxNoParts;
const savedParts = deps.savedParts;   // 읽는 함수
const seatScale = deps.seatScale;
const seatState = deps.seatState;
const seats = deps.seats;
const setActiveInteractionDeskId = deps.setActiveInteractionDeskId;
const toast = deps.toast;
function _checkCircusBalance(now){
  try{
    /* 🎪 흔들림 타이머 해제 — 바닥과 그 위 인원의 표식을 함께 지운다.
       ⚠️ **반드시 모든 이탈 경로에서 불러야 한다.** 아래 [사고] 참고. */
    const _calm = (bottom, members)=>{
      bottom._circusPanicAt = 0;
      if(members) members.forEach(m=>{ m._circusPanicAt = 0; });
    };
    // 맨 아래(자기는 안 타고, 위에 누가 탄) 좌석 = 탑의 바닥
    const bottoms = seats.filter(b=>!b.ridingOn && _rideRiders(b).length);
    /* 🎪 [사고 ②] "인간 머리 위 동물(1층) 위로 2층을 쌓으려는데 간혹 그 순간 무너진다"
       [원인] 아래 [사고 ①]의 대응은 '이 순회에 들어온 좌석'만 진정시킨다. 그런데 탑이 **완전히
         해체되면 바닥이던 좌석은 riders 가 0 이 되어 위 filter 에서 아예 빠진다** — 즉 순회 자체에
         들어오지 않아 `_circusPanicAt` 이 영원히 남는다. 바닥은 보통 인간이고, 인간은 올라탄 적이
         없으니 unmountRide 의 정리(그쪽은 올라탄 동물만 청소한다)도 거치지 않는다.
         그 뒤 같은 사람 머리에 다시 쌓으면, 2층이 되어 이 검사를 통과하는 순간
         `now - _circusPanicAt` 이 이미 40초를 넘겨 있어 예고 흔들림도 없이 즉시 와해된다.
       [대응] 순회에 걸린 좌석을 기록해 두고, **걸리지 않은 좌석의 표식은 전부 지운다.**
         '지금 탑에 속해 있지 않다'는 곧 '흔들릴 이유가 없다'는 뜻이므로 조건 없이 지워도 안전하다.
       ★ 흔들림 세기(_positionRideSeat)도 같은 값을 읽는다 — 남은 표식은 '와해 즉발' 말고도
         멀쩡한 탑이 처음부터 크게 휘청이는 증상으로 나타난다. 그쪽도 함께 사라진다. */
    const _inTower = new Set();
    bottoms.forEach(bottom=>{
      _inTower.add(bottom);
      const members = seats.filter(x=>x.ridingOn && _rideIsAbove(x, bottom) && x!==bottom);
      members.forEach(m=>_inTower.add(m));
      if(!members.length){ _calm(bottom, null); return; }
      /* 🎪 [사고] "1층 탑을 2층으로 올리려는 순간 간혹 탑이 저절로 무너진다"
         [원인] 예전엔 이 줄이 그냥 `return` 이었다 — **흔들림 표식을 안 지우고 빠져나갔다.**
           그래서 이런 순서가 성립한다:
             ① 2층 탑에 조는 사람이 하나라도 있으면(CIRCUS_PANIC_SLEEPERS=1) 그 순간 흔들림 타이머 시작
             ② 위층이 내려와 1층이 되면 여기서 걸려 return — bottom._circusPanicAt 은 **그대로 남는다**
             ③ 40초(CIRCUS_PANIC_MS)가 지난 뒤 다시 2층을 올리면, 이 검사를 통과하는 순간
                `now - _circusPanicAt` 이 이미 임계를 넘어 있어 **쌓자마자 즉시 와해**된다.
           흔들리는 예고 동작도 없이 갑자기 무너지므로 "자동으로 무너진다"로 보인다.
           ②를 거친 적이 있어야 하므로 매번은 아니다 — 제보의 "간혹"이 이것이다.
         [대응] 조건을 못 갖춘 상태로 빠져나갈 때도 표식을 지운다. 타이머는 조건이 갖춰진
           동안에만 흐르고, 조건이 깨지면 처음부터 다시 센다.
         ★ 층수는 members[0] 이 아니라 **최대 깊이**로 본다. members 는 seats 배열 순서라
           [0] 이 맨 위라는 보장이 없다 — 순서에 따라 판정이 흔들리던 자리다. */
      const _maxDepth = members.reduce((mx, m)=>Math.max(mx, _rideDepth(m)), 0);
      if(_maxDepth < CIRCUS_MIN_DEPTH && members.length < CIRCUS_MIN_DEPTH){ _calm(bottom, members); return; }
      // 탑 참여자(바닥 포함) 중 sleep 인원 세기
      const all = members.concat([bottom]);
      let sleepers = 0;
      all.forEach(m=>{ try{ if(seatState(m, now)==='sleep') sleepers++; }catch(_){} });
      if(sleepers >= CIRCUS_PANIC_SLEEPERS){
        if(!bottom._circusPanicAt){
          bottom._circusPanicAt = now;                      // 흔들리기 시작
          members.forEach(m=>{ m._circusPanicAt = now; });
        }else if(now - bottom._circusPanicAt >= CIRCUS_PANIC_MS){
          _collapseRideTower(bottom, now);                  // 시간이 다 되면 와해
        }
      }else{
        _calm(bottom, members);                             // 한 명이라도 깨어나면 진정
      }
    });
    // 🎪 위 [사고 ②] — 지금 어느 탑에도 속하지 않은 좌석의 흔들림 표식은 남겨두지 않는다.
    seats.forEach(s=>{ if(s && !_inTower.has(s) && s._circusPanicAt) s._circusPanicAt = 0; });
  }catch(_){}
}
function _updateRideChains(now){
  // 🪑 벤치에 앉은 좌석들을 슬롯 월드 위치로 이동 (ride와 독립).
  try{
    seats.filter(s=>s && s.seatedOn && !s.inPreview).forEach(seat=>{
      _positionBenchSeat(seat);
      try{ seat.group.updateMatrixWorld(true); }catch(_){}
    });
  }catch(_){}
  let list;
  try{ list = seats.filter(s=>s && s.ridingOn && !s.inPreview); }catch(_){ return; }
  if(!list.length) return;
  list.sort((a,b)=>_rideDepth(a)-_rideDepth(b));
  list.forEach(seat=>{
    _positionRideSeat(seat, now);
    try{ seat.group.updateMatrixWorld(true); }catch(_){}
  });
}
// 🪑 앉은 캐릭터를 벤치 슬롯의 월드 위치/방향에 배치. rig를 슬롯 기준으로 옮긴다.
const _benchWP = new THREE.Vector3(), _benchQ = new THREE.Quaternion(), _benchGP = new THREE.Vector3();
function _positionBenchSeat(seat){
  const host = seat.seatedOn;
  if(!host || !host.benchSlots) return;
  // ★ 흔들기/고정 중이면 슬롯 강제를 멈춤 — 흔들기가 위치를 제어하게. 놓으면 다시 슬롯으로 스냅.
  if(seat.beingShaken || seat.pinned) return;
  const slot = host.benchSlots[seat.seatSlot];
  if(!slot){ return; }
  // 슬롯이 사라졌거나(벤치 제거) 대상이 방을 나감 → 자동 하차
  if(!seats.includes(host) || !host.bench){ unmountBench(seat); return; }
  slot.getWorldPosition(_benchWP);
  slot.getWorldQuaternion(_benchQ);
  // 🪑 앉은 몸을 방석 높이에 얹기 — 다리를 접은 만큼 엉덩이가 내려앉게 살짝 낮춤(서 있는 것처럼 안 보이게).
  //   슬롯 월드 스케일을 반영해서 벤치 크기가 달라져도 자연스럽게 유지.
  const _ss = slot.getWorldScale(new THREE.Vector3()).y || 1;
  _benchWP.y -= 0.28 * _ss;
  // seat.group을 슬롯 위치로, rig는 원점으로(그룹이 이미 슬롯에 있으니).
  seat.group.position.copy(_benchWP);
  seat.group.quaternion.copy(_benchQ);
  // rig 로컬은 기본값으로 되돌림(그룹이 슬롯을 대신 표현). 흔들기 잔여 오프셋 제거.
  seat.rig.position.set(0, 0, 0);
}
function _positionRideSeat(seat, now){
    // 🐾 머리 위 올라타기 — 대상의 머리 본(없으면 headAnchor) 월드 위치를 따라감.
    //   고개를 흔들면 같이 흔들리도록 매 프레임 본 기준으로 갱신.
    const host=seat.ridingOn;
    const src=(host.bones && host.bones.head) ? host.bones.head : host.headAnchor;
    if(src){
      src.getWorldPosition(_rideWP);
      // 🐾 머리 '회전'까지 따라가기 — 본을 돌려도 본의 원점 좌표는 움직이지 않는다. 위치만 쫓으면
      //   고개를 저어도 동물이 제자리에 멈춰 있음(제보된 증상). rest 대비 월드 회전 변화량을 구해 오프셋에 적용.
      //   정지 상태에선 변화량이 항등이라 아래 오프셋 튜닝값이 그대로 유지된다.
      _rideQD.identity();
      const _restLocal = host.boneRest && host.boneRest.head;
      if(_restLocal && src.parent){
        src.parent.getWorldQuaternion(_rideQP);
        _rideQR.copy(_rideQP).multiply(_restLocal);         // rest 상태의 월드 회전
        src.getWorldQuaternion(_rideQC);                    // 현재 월드 회전
        _rideQD.copy(_rideQC).multiply(_rideQR.invert());   // 변화량 = 현재 × rest⁻¹
      }
      // 🐾 팔이 '대상 머리 꼭대기'에 오도록 발 위치를 역산한다.
      //     발 = 머리본 + (머리꼭대기 + RIDE_ARM_SINK) − 팔높이×동물크기
      //   목표를 상수가 아닌 실측 머리 높이로 두므로 대상 크기·동물 크기·얼굴 크기와 무관하게 맞는다.
      //   팔높이는 동물 자신의 월드 크기라 대상 크기를 곱하지 않는다.
      //   둘 중 하나라도 실측 실패면 예전 '발 기준' 방식으로 폴백.
      const _hs = seatScale(host)||1;          // 🪑 대상 좌석의 실효 크기(평준화 포함)
      // ★ armH는 이미 '크기 1' 기준으로 정규화된 값이다. 여기에 좌석 크기를 다시 곱하면
      //   좌석을 줄일수록 빼는 양이 줄어 발이 떠오른다(제보된 증상). 좌석 크기는 모델을 균일하게
      //   줄이는 것뿐이라 얹히는 지점이 달라질 이유가 없으므로 기본적으로 반영하지 않는다.
      //   (얼굴 크기 보정은 armH 값 자체가 바뀌는 것이라 이와 무관하게 계속 작동한다.)
      const _sizeMul = 1 + (seatScale(seat) - 1) * RIDE_ARM_SIZE_FOLLOW;   // 🪑 실효 크기
      const _armW = (seat._rideArmH!=null) ? seat._rideArmH*_sizeMul : null;
      // 🎪 2층 이상이면 '발로 딛고 서기' — 팔 높이(armH)를 쓰지 않고 대상 머리 꼭대기에 발을 놓는다.
      const _circus = (_rideDepth(seat) >= CIRCUS_MIN_DEPTH) && (seat._rideHeadTop!=null);
      /* 🔍 진단 재무장 — 자세가 1층↔묘기로 바뀌는 순간에 검증 로그를 한 번 더 찍는다.
         [경위] _rideDbgOnce 는 mountRide 직후 한 프레임에만 걸린다. 그런데 탑을 아래에서부터 쌓으면
           (동물에 먼저 얹고 그 동물을 사람에게 올리면) 얹는 순간에는 아직 1층이라, 정작 보고 싶은
           **묘기 자세의 수치가 로그에 한 번도 안 나온다**(제보 로그가 둘 다 circus=false 였던 이유).
         값이 흔들려서 매 프레임 찍히는 일은 없다 — 층수가 실제로 바뀔 때만 걸린다. */
      if(seat._circusOn !== undefined && seat._circusOn !== _circus) seat._rideDbgOnce = true;
      seat._circusOn = _circus;
      let _offY, _offZ;
      let _topUsed = null;   // 🫧 아래 갈래가 «꼭대기» 로 쓴 머리 높이(머리 본 기준) — 대상이 자리비움 그림이면 그림 꼭대기로 바꿔 끼운다
      if(_circus){
        // ★ sink는 '대상 크기 1' 기준으로 눈으로 맞춘 값이라 반드시 대상 크기를 곱한다(아래 1층 주석 참고).
        /* 🎪 발을 놓는 기준은 '귀 위'가 아니라 머리 꼭대기다(위 캐싱 주석 참고).
           옛 값만 있는 좌석(_rideHeadTopBare 미설정)은 예전 동작 그대로 떨어진다. */
        const _headTopForFeet = (seat._rideHeadTopBare != null) ? seat._rideHeadTopBare : seat._rideHeadTop;
        _offY = _headTopForFeet - CIRCUS_FOOT_SINK*_hs;
        _topUsed = _headTopForFeet;
        // 머리 박스 중심 실측 + 앞으로 당기는 보정(박스에 몸통·꼬리가 섞여 중심이 뒤로 치우침)
        // ★ 1층의 '깊이 비율만큼 뒤로'를 여기에 적용하면 안 된다 — 자세가 다르다.
        //   1층은 '팔을 머리에 걸치는' 자세라 몸이 뒤로 물러나야 하지만,
        //   2층+는 '머리 위에 발로 서는' 자세라 머리 박스 한가운데에 서야 한다.
        //   (같은 규칙으로 묶었더니 2층부터 뒤로 밀려났다.)
        /* ★ 기준은 '몸 전체 박스 중심'이 아니라 '꼭대기 발판의 중심'이다 —
             동물은 꼬리·엉덩이가 박스를 뒤로 늘려 몸 중심이 머리보다 한참 뒤에 잡힌다.
           ⚠️ 통메쉬 하나로 된 모델에서는 그 실측이 아무것도 골라내지 못한다(_headTopCenterZ=null).
             그때 몸 전체 중심으로 떨어지면 **반드시 뒤에 선다** — 제보의 그 증상이다.
             그래서 동물 대상은 1층과 같은 '깊이 비율' 방식으로, 다만 **앞으로**(+) 당긴다.
             (부호와 상수가 1층과 다른 이유는 CIRCUS_Z_DEPTH_K_ON_ANIMAL 주석 참고.)
           ⚠️ CIRCUS_FOOT_Z 로 때우지 말 것 — 그건 절대값이라 대상 모델마다 다시 어긋난다. */
        const _hostAnimal = !!(host.charDef && host.charDef.animal);
        let _fz;
        if(CIRCUS_FOOT_Z_FROM_TOP && host._headTopCenterZ != null){
          _fz = host._headTopCenterZ; seat._circusZSrc = '꼭대기실측';
        }else if(_hostAnimal && (host._headCenterZNoEar != null || host._headCenterZ != null)){
          /* 귀를 뺀 값이 있으면 그쪽을 쓴다 — 있는 쪽이 흔들리지 않는다(위 측정부 주석 참고). */
          const _useNoEar = (host._headCenterZNoEar != null && host._headDepthZNoEar != null);
          const _cz0 = _useNoEar ? host._headCenterZNoEar : host._headCenterZ;
          const _dz0 = _useNoEar ? host._headDepthZNoEar  : host._headDepthZ;
          _fz = _cz0 + (_dz0 || 0) * CIRCUS_Z_DEPTH_K_ON_ANIMAL;
          seat._circusZSrc = _useNoEar ? '동물폴백(귀제외)' : '동물폴백';
        }else{
          _fz = (host._headCenterZ != null) ? host._headCenterZ : 0; seat._circusZSrc = '몸중심';
        }
        _offZ = _fz + CIRCUS_FOOT_Z;
      }else{
        /* 대상이 동물이면 전용 보정값 사용(위 상수 주석 참고).
           ★ sink에는 반드시 대상 크기(_hs)를 곱한다.
             수식의 나머지 두 항(_rideHeadTop·_armW)은 둘 다 월드 실측값이라 크기에 비례하는데
             sink만 절대 상수였다 → 좌석을 줄일수록 그 상수만 상대적으로 커져 그만큼 떠 보였다.
             [실측] 대상=인간 hostScale 0.42에서 머리 높이가 0.2682인데 sink가 0.05 —
                    떠 보이는 양(0.0635)의 대부분이 sink였다. 크기 1이면 0.05/0.638 = 7.8%인데
                    크기 0.42에서는 18.6%가 된다(약 2.4배).
             ★ 크기 1에서는 곱이 1이라 예전과 완전히 동일하다 = 크기를 안 줄인 사용자에겐 회귀가 없다.
             ★ 앞뒤 보정(RIDE_HEAD_OFFSET_Z 계열)은 아래에서 이미 *_hs로 비례하고 있었다.
               Y만 상수로 남아 있던 것을 같은 규칙으로 맞추는 것이다. */
        /* 🐾 [2026-08 수정] 곱하는 크기 기준을 **대상(아래 캐릭터)**에서 **올라탄 동물 자신**으로 바꿨다.
           [제보] "인간 캐릭터가 커질수록 동물이 조금 떠 보인다."
           [원인] 이 값은 이름과 달리 위로 띄우는 양이다(_offY = 머리꼭대기 + _sink − 팔높이).
             여기에 대상 크기(_hs)를 곱하고 있었는데, 대상이 커져도 **동물은 같이 안 커진다.**
             그래서 동물 기준으로 본 간격만 계속 벌어졌다.
             실측(제보 로그): hostScale 0.57 → sink 0.0513. 동물 키가 0.16 남짓이라 그 3분의 1이 간격이었다.
           [왜 대상 크기가 답이 아닌가] 이 보정이 필요한 이유는 '정수리는 한 점이고 팔이 닿는 자리는
             그보다 낮은 곡면'이라서다. 그 낙차는 대략 (팔 벌린 폭)² ÷ (머리 반지름×2) —
             머리가 커질수록 **줄어야** 맞는데 옛 식은 반대로 키우고 있었다.
           [지금 식] 팔 벌린 폭은 동물 자신의 월드 크기로 정해지므로 그쪽에 비례시킨다.
             바로 아래 _armW 가 쓰는 배율과 같은 기준이 된다(_rideArmH 에 ANIMAL_RUN_SCALE 이 이미 들어있음).
           ⚠️ RIDE_ARM_SINK 상수의 '크기 1 기준'은 이제 **동물 크기 1** 기준이라는 뜻이다.
             더 파묻고 싶으면 상수를 낮추고, 더 띄우려면 올린다 — 대상 크기와는 무관해졌다. */
        const _riderW = ((seat.charDef && seat.charDef.animal) ? ANIMAL_RUN_SCALE : 1) * (seatScale(seat) || 1);
        const _sink = ((host.charDef && host.charDef.animal) ? RIDE_ARM_SINK_ON_ANIMAL : RIDE_ARM_SINK) * _riderW;
        /* 🎩 1층은 머리 중앙 파츠가 있으면 그 위에 얹는다 — 2층+(묘기)는 위 갈래라 여기 안 온다.
           값이 없으면(파츠가 없거나 판정 탈락) 예전 그대로 머리 꼭대기다.
           ★ 고르는 자리가 여기 하나뿐이어야 한다 — 측정 쪽에서 미리 고르면 얹은 뒤에 탑이
             다시 쌓일 때 캐시와 실제 층수가 어긋난다(귀에서 이미 겪은 사고). */
        const _headTopForArm = (seat._rideHeadTopPart != null) ? seat._rideHeadTopPart : seat._rideHeadTop;
        _offY = (_armW!=null && _headTopForArm!=null)
          ? (_headTopForArm + _sink - _armW)
          : (RIDE_HEAD_OFFSET_Y*_hs);
        if(_armW!=null && _headTopForArm!=null) _topUsed = _headTopForArm;
        // 동물 대상: 실측 머리 중심 + 미세조정. 실측 실패 시에만 예전 상수로 폴백.
        // 동물 대상: 실측 박스 중심에서 깊이 비율만큼 뒤로. 실측 실패 시에만 예전 상수로 폴백.
        _offZ = (host.charDef && host.charDef.animal)
          ? ((host._headCenterZ != null && host._headDepthZ != null)
              ? (host._headCenterZ - host._headDepthZ * RIDE_Z_DEPTH_K_ON_ANIMAL)
              : (RIDE_HEAD_OFFSET_Z_ON_ANIMAL * _hs))
          : (RIDE_HEAD_OFFSET_Z * _hs);
      }
      /* 🧍 올라탄 동안에는 캐릭터 높이를 상쇄한다 — 높이는 '바닥에서 얼마나 떠 있나' 이고,
         올라탄 좌석의 바닥은 대상의 머리다. 상쇄하지 않으면 그 값만큼 머리 위에서 공중부양한다.
         ★ 1층(팔 걸치기)·묘기(2층+)·폴백 세 경로에 한 줄로 걸린다 — 분기마다 넣으면 반드시 하나를 빠뜨린다.
         ★ 대상(host)의 높이는 여기서 손댈 필요가 없다. _rideHeadTop 이 '머리 본 기준 상대값'
           (_measureHostHeadTop 의 `_hb.max.y - _bp.y`)이고 _rideWP 도 그 머리 본의 월드 위치라,
           대상을 올리면 두 항이 같이 올라가 저절로 따라간다. */
      _offY -= charLiftWorld(seat);
      /* 🌀 대상이 제자리 회전 춤을 추는 중이면 앞뒤 오프셋(_offZ)도 그만큼 같이 돌려야 한다.
         돌리지 않으면 몸은 도는데 얹힌 좌석의 '머리 앞/뒤 치우침'만 월드 고정이라,
         반 바퀴 지점에서 반대쪽(뒤통수 쪽)으로 튀어나온다.
         ★ _spinY 가 0 이면 회전이 항등이라 아래 한 줄을 건너뛴다 — 평소 프레임에 비용이 없다. */
      const _spinY = _rideHostSpinY(host);
      _rideOff.set(0, _offY, _offZ);
      if(_spinY){ _rideQSpin.setFromAxisAngle(_rideAxisY, _spinY); _rideOff.applyQuaternion(_rideQSpin); }
      _rideOff.applyQuaternion(_rideQD);
      _rideWP.add(_rideOff);
      /* 🫧 [2026-10-02 제보 «자리비움 위로 올라가면 공중에 떠 있다»] 대상이 자리비움 그림으로 서 있으면 몸은 숨어 있고
         **그림이 몸 자리를 대신한다.** 그런데 위 계산은 숨은 몸의 머리 본을 따라가서, 그림(60~100px)보다 한참 위 —
         보이지 않는 머리 높이 — 에 떠 있었다.
         ⇒ 그림이 보이는 동안에는 «꼭대기» 를 **그림 윗변**으로 바꿔 끼운다. 자세별 보정(1층 팔 걸치기의 sink−팔높이 ·
           묘기의 발 sink · 내 캐릭터 높이 상쇄)은 위에서 계산한 그대로 쓴다 — _offY 에서 머리 높이(_topUsed)만 뺀 나머지.
           가로·앞뒤는 그림 한가운데(그림은 평평한 판이라 머리 앞뒤 보정이 뜻이 없다).
         ★ 그림 크기(60·80·100)가 바뀌면 그림 윗변이 따라 움직이므로 저절로 맞는다. 그림이 사라지면(복귀) 다음 프레임부터 예전 머리 기준.
         ⚠️ 그림은 _awayImgFrame 이 0.5초마다 다시 재므로 한 프레임 늦을 수 있다 — 눈에 안 띈다. */
      const _asp = host._awaySprite;
      if(_asp && _asp.visible){
        _asp.getWorldPosition(_rideAwayP);
        _asp.getWorldScale(_rideAwayS);
        const _picTop = _rideAwayP.y + _rideAwayS.y / 2;
        const _rest = (_topUsed != null) ? (_offY - _topUsed) : -charLiftWorld(seat);   // 자세 보정 + 높이 상쇄(이미 _offY 에 들어 있다)
        _rideWP.set(_rideAwayP.x, _picTop + _rest, _rideAwayP.z);
      }
      seat.group.position.copy(_rideWP);
      if(seat._rideDbgOnce){
        seat._rideDbgOnce = false;
        try{
          const _hp = new THREE.Vector3(); src.getWorldPosition(_hp);
          /* ★ host 를 같이 넘겨 **실제 경로와 같은 규칙**으로 잰다(기본 장식 메쉬 제외).
             안 넘기면 이 진단만 다른 값을 찍어서, 로그를 믿고 엉뚱한 데를 파게 된다. */
          const _hb2 = measureHeadBoxNoParts(host.gltfRoot, null, host);
          const _f2 = v => (v==null?'null':(+v).toFixed(4));
          // 숨은 메쉬·기본 장식까지 전부 포함했을 때의 꼭대기 — 위 값과의 차이가 이번 규칙이 깎아낸 양이다.
          let _hbAll = null;
          try{
            const _b = measureBodyBox(host.gltfRoot, RIDE_DIAG_ALL_OPTS);
            if(!_b.isEmpty()) _hbAll = _b.max.y;
          }catch(_){}
          console.log('[올라타기·검증] 적용된 offY=' + _f2(_offY) + ' circus=' + _circus
            + ' | 쓴headTop=' + _f2(_circus ? ((seat._rideHeadTopBare!=null)?seat._rideHeadTopBare:seat._rideHeadTop) : seat._rideHeadTop)
            + '(귀포함=' + _f2(seat._rideHeadTop) + ' 귀제외=' + _f2(seat._rideHeadTopBare) + ')'
            + ' | 머리본Y=' + _f2(_hp.y)
            + ' 대상머리꼭대기Y=' + _f2(_hb2 && !_hb2.isEmpty() ? _hb2.max.y : null)
            + ' 올라탄좌석Y(발)=' + _f2(seat.group.position.y)
            + ' → 발이 머리꼭대기보다 ' + _f2((_hb2 && !_hb2.isEmpty()) ? (seat.group.position.y - _hb2.max.y) : null) + ' 만큼 위'
            + ' | offZ=' + _f2(_offZ) + ' headCenterZ(몸전체)=' + _f2(host._headCenterZ)
            + ' 꼭대기중심Z=' + _f2(host._headTopCenterZ)
            + (_circus ? (' 2층Z출처=' + (seat._circusZSrc||'-')
                + ' 박스깊이=' + _f2(host._headDepthZ) + '(귀제외=' + _f2(host._headDepthZNoEar) + ')'
                + ' 중심Z=' + _f2(host._headCenterZ) + '(귀제외=' + _f2(host._headCenterZNoEar) + ')') : '')
            + ' 머리박스Z[' + _f2(_hb2 && !_hb2.isEmpty() ? _hb2.min.z : null) + '~' + _f2(_hb2 && !_hb2.isEmpty() ? _hb2.max.z : null) + ']'
            + ' 머리본Z=' + _f2(_hp.z) + ' 올라탄좌석Z=' + _f2(seat.group.position.z)
            + ' | 숨은메쉬·기본장식포함꼭대기Y=' + _f2(_hbAll)
            + (( _hbAll!=null && _hb2 && !_hb2.isEmpty() && _hbAll - _hb2.max.y > 0.001)
                ? ('  ⓘ 숨은 메쉬·기본장식(모자/탈/안경/날개)을 세면 ' + _f2(_hbAll - _hb2.max.y) + ' 만큼 높다 — 제외가 의도대로 걸린 상태') : '')
            /* 🐰 귀 union 분해 — 캐시된 headTop이 머리 박스보다 높을 때 '귀가 진짜 그 높이인가'를 가른다.
               귀union(보이는것) == 귀union(옛규칙) 이면 귀 안에 숨은 메쉬가 없다는 뜻 =
               부풀림의 범인은 귀가 아니고, 그 높이는 실제 귀 높이다(= '귀 위에 얹기' 사양대로 정상). */
            + ((host._earTopDbg!=null || host._earTopRawDbg!=null)
                ? (' | 귀union(보이는것)=' + _f2(host._earTopDbg)
                   + ' 귀union(옛규칙)=' + _f2(host._earTopRawDbg)
                   + ((host._earTopDbg!=null && host._earTopRawDbg!=null
                       && host._earTopRawDbg - host._earTopDbg > 0.001)
                       ? ('  ⚠️ 귀 하위의 숨은 메쉬가 ' + _f2(host._earTopRawDbg - host._earTopDbg) + ' 만큼 부풀리고 있었음')
                       : '  (귀 하위엔 숨은 메쉬 없음 — 이 높이는 실제 귀)'))
                : ''));
          /* 진단 기록 한 줄 — «파츠를 떼거나 캐릭터를 바꿔도 높이가 그대로» 제보를 가를 값만(200자 안) */
          diagNote('[올라타기] 대상=' + ((host.charDef && host.charDef.animal) ? '동물' : '사람') + ' ' + (_circus ? '묘기' : '1층')
            + ' 머리=' + _f2(seat._rideHeadTop) + ' 파츠=' + _f2(seat._rideHeadTopPart) + ' 팔=' + _f2(seat._rideArmH)
            + ' offY=' + _f2(_offY) + ' 발-머리꼭대기=' + _f2((_hb2 && !_hb2.isEmpty()) ? (seat.group.position.y - _hb2.max.y) : null));
        }catch(_){}
      }
      /* ★ UI(상태칩·메뉴·입력창) 전용 '흔들림 없는' 앵커를 따로 저장한다.
         group.position은 위에서 머리 본 실시간 위치 + 고개 회전(_rideQD)까지 섞여 매 프레임 흔들린다.
         칩이 그걸 그대로 쓰면 고개를 저을 때마다 같이 흔들린다(제보). 그래서 X는 흔들림 없는
         대상 바닥자리(host.targetX)를, 높이는 올라탄 만큼(_offY 반영)을 쓴 안정 좌표를 만든다. */
      try{
        if(!seat._uiAnchor) seat._uiAnchor = new THREE.Vector3();
        // X: 대상의 흔들림 없는 바닥자리. Y: 대상 바닥 높이 + 올라탄 상대높이(_offY) — 둘 다 고개 흔들림 성분이 없다.
        //    (group.position.y를 그대로 쓰면 대상이 끄덕이거나 흔들릴 때 y도 출렁인다.)
        const _hostBaseX = (host.targetX!=null) ? host.targetX
                          : (host.group ? host.group.position.x : seat.group.position.x);
        const _hostBaseY = host.group ? host.group.position.y : 0;   // 바닥 원점(라이드 중이 아니면 0 근처로 안정)
        seat._uiAnchor.set(_hostBaseX, _hostBaseY + _offY, 0);
        if(seat.group.parent){                       // 로컬→월드 (칩 배치는 월드 기준)
          seat.group.parent.localToWorld(seat._uiAnchor);
        }
      }catch(_){}
      if(_circus){
        // 🎪 대상과 정면을 어긋나게 — 묘기처럼 비스듬히 선 모습(Y축 회전).
        //   ★ 방향은 좌석에 한 번만 정해 저장한다(딛는 발과 동일한 방식).
        //     매 프레임 뽑으면 몸이 좌우로 튀고, swayPhase 같은 값에 의존하면 재조립 때 바뀐다.
        if(CIRCUS_YAW_RANDOM){
          if(seat._circusYawDir === undefined) seat._circusYawDir = (Math.random() < 0.5) ? -1 : 1;
          if(seat._circusYawAmt === undefined)
            seat._circusYawAmt = CIRCUS_YAW_MIN + Math.random()*(CIRCUS_YAW_MAX - CIRCUS_YAW_MIN);
        }else{
          // 요청: 어긋나지 않고 대상과 같은 방향(정면). 저장값도 0 으로 굳혀 둔다 —
          // undefined 로 두면 나중에 이 값을 읽는 곳이 생겼을 때 '아직 안 뽑음'과 구분이 안 된다.
          seat._circusYawDir = 1; seat._circusYawAmt = 0;
        }
        /* 🌀 `+ _spinY` — 대상이 도는 만큼 위층도 같이 돈다(/150 묘기 회전·오르골).
           묘기 자세의 '비스듬히 선 각'(_circusYawAmt)은 그대로 더해져 유지되므로,
           도는 동안에도 대상과의 상대 각도가 흐트러지지 않는다. */
        _rideQY.setFromAxisAngle(_rideAxisY, host.group.rotation.y + _spinY + seat._circusYawAmt*seat._circusYawDir);
        seat.group.quaternion.copy(_rideQD).multiply(_rideQY);
      } else if(RIDE_FOLLOW_HEAD_TILT){
        _rideQY.setFromAxisAngle(_rideAxisY, host.group.rotation.y + _spinY);
        seat.group.quaternion.copy(_rideQD).multiply(_rideQY);
      } else {
        seat.group.quaternion.identity(); seat.group.rotation.set(0, host.group.rotation.y + _spinY, 0);
      }
      seat.rig.position.set(0,0,0);   // 좌석 자체 오프셋 제거(머리 위에 그대로 얹힘)
      // 🎪 묘기 흔들림 — 발끝을 축으로. 잠든 직후엔 은은하고, 마감이 가까워질수록 커지다가
      //    마지막 구간에서는 큰 휘청임을 접고 제자리에서 부들부들 떤다(곧 무너진다는 신호).
      if(_circus){
        let amp = CIRCUS_SWAY_CALM, tremor = 0;
        if(seat._circusPanicAt){
          const k = Math.min(1, (now - seat._circusPanicAt) / CIRCUS_PANIC_MS);   // 0=잠든 순간, 1=와해
          amp = CIRCUS_SWAY_CALM + (CIRCUS_SWAY_PANIC - CIRCUS_SWAY_CALM) * k;
          if(k >= CIRCUS_TREMOR_AT){
            const t = (k - CIRCUS_TREMOR_AT) / (1 - CIRCUS_TREMOR_AT);            // 0→1
            amp *= (1 - t * CIRCUS_TREMOR_CALMDOWN);   // 좌우 휘청임은 잦아들고
            tremor = CIRCUS_TREMOR_AMP * t;            // 잔떨림이 커진다
          }
        }
        let sway = Math.sin(now/1000*CIRCUS_SWAY_SPEED + (seat.swayPhase||0)) * amp;
        // 위상에 ×3을 곱해 층마다 떠는 타이밍을 어긋나게 — 탑 전체가 한 몸처럼 떨면 기계적으로 보인다.
        if(tremor) sway += Math.sin(now/1000*CIRCUS_TREMOR_SPD + (seat.swayPhase||0)*3) * tremor;
        seat.group.rotateZ(sway);
        /* 🦶 딛는 발을 머리 한가운데로 — 회전이 전부 확정된 지금 적용한다(위 상수 주석 참고).
           좌석 원점이 아니라 '접지점'이 머리 중심에 오도록 원점을 반대로 민다. */
        if(CIRCUS_FOOT_CENTER && seat._circusFootOff === undefined){
          // rig 가 좌석 원점에 놓인 뒤(위 seat.rig.position.set) 첫 프레임에 1회만 잰다. 실패는 null 로 굳어 다시 안 잰다.
          seat._circusFootOff = _measureCircusFootOff(seat, seat._circusStandLeft);
        }
        if(CIRCUS_FOOT_CENTER && seat._circusFootOff){
          _rideFootOff.copy(seat._circusFootOff).applyQuaternion(seat.group.quaternion);
          seat.group.position.x -= _rideFootOff.x * CIRCUS_FOOT_CENTER;
          seat.group.position.z -= _rideFootOff.z * CIRCUS_FOOT_CENTER;
        }
      }
  }
}
function _rideDepth(seat){          // 이 좌석이 몇 층에 있는가 (바닥=0)
  let d=0, p=seat && seat.ridingOn, guard=0;
  while(p && guard++ < 16){ d++; p = p.ridingOn; }
  return d;
}
function _rideIsAbove(target, seat){ // target이 seat 위에 (직·간접으로) 올라타 있는가
  let p=target, guard=0;
  while(p && guard++ < 16){ if(p===seat) return true; p = p.ridingOn; }
  return false;
}
function _rideRiders(seat){          // 이 좌석 바로 위에 탄 좌석들
  try{ return seats.filter(x=>x.ridingOn===seat); }catch(_){ return []; }
}
/* 🐾 탑 바닥 찾기(_rideBottom)는 ride-chain.js(순수) — 좌석 줄 배치(seat-layout.js)도 같이 쓴다. 이 모듈은 deps 로 받아 예전처럼 내놓는다. */
/* 🎩 '머리 중앙에 얹을 수 있는 파츠'의 꼭대기(월드 Y). 없으면 null.
   [판정] ① 관리자가 그 파츠에 '얹을 수 있음'을 켰고
          ② 파츠 박스가 머리 꼭대기 층의 중심을 덮으며, 남는 여유가 좌우·앞뒤 둘 다
             RIDE_PART_CENTER_MARGIN 이상일 것.
   ★ 파츠는 measureHeadBoxNoParts 가 __partWrap_ 을 통째로 빼기 때문에 본체 측정에 안 들어온다.
     그래서 여기서 **동물 귀와 같은 방식으로** 따로 잰다. 그 규칙(파츠 제외)을 무르는 것이 아니라,
     조건을 통과한 파츠 하나만 예외로 재는 것이다.
   ⚠️ 숨은 메쉬는 뺀다 — 본체·귀와 같은 규칙. 안 빼면 안 보이는 것 위에 얹혀 뜬다.
   ⚠️ 여러 개가 통과하면 가장 높은 것을 쓴다(그 위에 얹혀야 파묻히지 않는다).
   ⚠️ 호출은 반드시 좌석 기울임을 지운 상태에서 — Box3 는 월드축 정렬이라 기울면 부푼다. */
function _partAllowsRideTop(partId){
  if(!partId) return false;
  try{
    const rec = (typeof savedParts() !== 'undefined') ? savedParts().find(p=>p.id===partId) : null;
    return !!(rec && rec.rideTop);
  }catch(_){ return false; }
}
/* 📏 재기는 measureBodyBox(character/body-measure.js) 옵션 둘.
   RIDE_WRAP_OPTS — 파츠 · 귀 wrapper 하나 안: 숨은 메쉬 · 리깅 파츠 스킨드메시만 뺀다(wrapper 자신의 숨김은 부르는 쪽이 본다 · 행렬은 안 세운다)
   RIDE_DIAG_ALL_OPTS — 진단 «숨은 메쉬 · 기본 장식까지 넣은 꼭대기»: 파츠(리깅 · 이름)와 리깅 스킨드메시만 뺀다 */
const RIDE_WRAP_OPTS = { excludeParts: 'skinned', visibleOnly: true, updateWorld: false };
const RIDE_DIAG_ALL_OPTS = { excludeParts: true, partTest: p => isPartByRigOrName(p), updateWorld: false };
function _measureRideablePartTop(hostSeat, slabBox){
  if(!hostSeat || !hostSeat.gltfRoot || !slabBox || slabBox.isEmpty()) return null;
  const headW = slabBox.max.x - slabBox.min.x;
  const headD = slabBox.max.z - slabBox.min.z;
  if(!(headW > 1e-6) || !(headD > 1e-6)) return null;
  const cx = (slabBox.min.x + slabBox.max.x)/2;
  const cz = (slabBox.min.z + slabBox.max.z)/2;
  const needX = headW * RIDE_PART_CENTER_MARGIN;
  const needZ = headD * RIDE_PART_CENTER_MARGIN;
  let best = null;
  hostSeat.gltfRoot.traverse(o=>{
    if(!(o.userData && o.userData.__twPartWrap)) return;
    if(o.visible === false) return;
    if(!_partAllowsRideTop(o.userData.partId)) return;
    const b = measureBodyBox(o, RIDE_WRAP_OPTS);
    if(b.isEmpty()) return;
    if(Math.min(cx - b.min.x, b.max.x - cx) < needX) return;   // 좌우로 중심을 덮는가
    if(Math.min(cz - b.min.z, b.max.z - cz) < needZ) return;   // 앞뒤로 중심을 덮는가
    if(best == null || b.max.y > best) best = b.max.y;
  });
  return best;
}
/* 🐾 대상의 '머리 꼭대기'가 머리 본보다 얼마나 위인지 실측한다(월드 단위).
   목표 팔 높이를 상수로 두면 대상 크기·모델마다 어긋나므로, 실제 머리 높이를 재서 거기에 얹는다.
   ★ 바운딩박스 기반이라 고개를 숙인 자세에서는 0.04 정도 낮게 잡힐 수 있다(올라타는 순간 값으로 캐싱).
     화면상 거의 보이지 않는 수준이라 현재는 그대로 두고, 문제가 되면 그때 다듬는다. */
function _measureHostHeadTop(hostSeat, headNode){
  try{
    if(!hostSeat || !headNode || !hostSeat.gltfRoot) return null;
    /* ★ 측정 직전에 대상의 '기울임'을 잠시 지운다.
       Box3·measureCharBox는 월드 축 정렬(AABB)이라 기울어진 물체를 재면 실제보다 크게 잡힌다.
       [실측] 인간 대상(회전 0) 0.3191 vs 동물 대상(40% 크기인데 회전 0.098) 0.3974 —
       동물이 훨씬 낮아야 하는데 오히려 24% 높게 나왔고, 그만큼 위 캐릭터가 떠올랐다.
       특히 탑쌓기에서는 아래 동물이 이미 머리 회전 보정을 받고 있어 항상 이 상태가 된다.
       같은 프레임 안에서 되돌리므로 화면에는 아무 변화가 없고, 측정은 올라탈 때 1회뿐이라 부담도 없다.
       인간 대상에도 적용 — 고개를 숙인 채 올렸을 때 값이 흔들리던 것도 함께 잡힌다. */
    const _g = hostSeat.group;
    const _savedQ = _g.quaternion.clone();
    _g.quaternion.identity();
    _g.updateMatrixWorld(true);
    // ★ 인간·동물 모두 '꾸미기 파츠 제외' 측정을 쓴다 — 머리 위 장식이 있으면 그 끝에 얹혀 떠 보였다.
    const _mBoxes = [];
    /* 🎩 hostSeat 를 같이 넘긴다 = 기본 장식 메쉬(모자·탈·안경·날개)를 가시성과 무관하게 제외.
       안 넘기면 모자 파츠를 낄 때마다 기본 모자가 숨어 꼭대기가 그만큼 낮아진다
       (HEAD_DECOR_MESH_KEYS 주석의 그 증상). */
    const _hb = measureHeadBoxNoParts(hostSeat.gltfRoot, _mBoxes, hostSeat);
    /* 🐰 동물 대상이면 '귀 위'에 얹는다(요청 사양) — 단 **1층에 얹힐 때만**.
       동물 귀는 별도 GLB를 머리 본에 붙인 부착물이고, wrap에 userData.rigged 표식이 있어
       measureHeadBoxNoParts가 통째로 걸러낸다(정규화 흔들림을 막으려고 일부러 붙여둔 표식이다).
       그래서 여기서 귀 박스만 따로 합친다 — 예전엔 걸러진 상태로 재서 귀 사이 머리통에 파묻혔다.

       ★ `!hostSeat.ridingOn` = 대상이 탑의 바닥이다 = 지금 얹는 좌석이 1층이 된다.
         2층부터는 묘기 자세(CIRCUS_MIN_DEPTH=2)로 한 발 딛고 서는 연출이라, 귀 끝까지 올리면
         발이 허공에 뜬 것처럼 보인다. 그래서 2층 이상은 예전대로 머리 꼭대기 기준을 쓴다.
         (mountRide가 탑 꼭대기를 찾아 hostSeat를 올려놓은 뒤 이 함수를 부르므로 이 판정이 정확하다)

       ・귀가 없는 동물은 합칠 게 없어 결과가 그대로 = 인간과 같은 '머리 꼭대기' 기준이 된다.
       ・아래로 처지는 강아지 귀는 머리통보다 낮아 union이 max.y를 안 올린다 — 자동으로 머리 기준.
       ・꾸미기 파츠(동물귀 파츠 등)는 __partWrap_ 라 계속 제외된다. 인간이 그대로인 이유다.
       ⚠️ 귀는 비동기로 붙는다. 붙기 전에 올리면 귀 없이 측정된 값이 캐싱되므로, 그 경우엔
          내렸다 다시 올리면 맞는다(측정은 올라탈 때 1회). */
    /* ★ 예전에는 여기 `&& !hostSeat.ridingOn` 이 붙어 있었다 — "대상이 탑의 바닥이면 지금 얹는
         좌석이 1층이다"라는 뜻이었는데, **얹은 뒤에 탑이 다시 쌓이면 그 전제가 깨진다.**
       [증상] 동물 위에 먼저 얹고(그때는 1층이라 귀 포함으로 캐싱) 그 동물을 다시 사람 머리에 올리면,
         위 좌석은 2층 묘기가 되는데 캐시는 '귀 꼭대기'라 귀 높이만큼 공중에 뜬다. 반대로 사람에게
         먼저 올린 뒤 그 위에 얹으면 귀가 빠진 값이 캐싱돼 파묻힌다 — **쌓는 순서에 따라 결과가 갈렸다.**
         (내가 쌓을 때와 원격 재현이 서로 다른 순서로 쌓아서 한쪽은 뜨고 한쪽은 파묻힌 이유가 이것이다.)
       [해법] 순서에 의존하는 판정을 없앤다. 여기서는 **귀 포함·미포함 둘 다** 재 두고,
         어느 쪽을 쓸지는 매 프레임 실제 자세(_circus)가 고른다. */
    /* 귀를 합치기 **전**의 박스. 높이(Y)뿐 아니라 앞뒤(Z)도 여기서 따로 뽑는다 — 아래 주석 참고. */
    let _bareBox = null;
    try{ if(!_hb.isEmpty()) _bareBox = _hb.clone(); }catch(_){ _bareBox = null; }
    const _bareTopY = _hb.isEmpty() ? null : _hb.max.y;
    /* 🐾 사람 귀(꾸미기 › 머리 › 귀)도 같은 규칙 — 동물 귀처럼 rigged 표식으로 본체 측정에서 빠져 있어서,
       여기서 합치지 않으면 귀 달린 사람 위에 얹을 때 귀 사이 머리통에 파묻힌다. 귀가 없는 사람은 합칠 게 없어 그대로다. */
    const _humanEarHost = !!(hostSeat.charDef && !hostSeat.charDef.animal && (hostSeat.charDef.earL || hostSeat.charDef.earR));
    if((hostSeat.charDef && hostSeat.charDef.animal) || _humanEarHost){
      /* ★ 귀 박스도 measureHeadBoxNoParts와 **같은 규칙**으로 잰다 — 숨은 메쉬 제외.
         Box3.setFromObject는 traverse(≠traverseVisible)라 wrap 하위의 안 보이는 메쉬까지 그대로 잰다.
         예전 코드는 wrap **자신**의 visible만 보고 그 안쪽은 못 봐서, 숨은 메쉬가 있으면
         머리 꼭대기가 부풀려지고 위 캐릭터가 그만큼 떴다(본체는 이미 숨은 메쉬를 제외하는데 귀만 안 했다).
         ⚠️ 귀 안에 숨은 메쉬가 없으면 값이 그대로다 = 이 수정만으로는 아무 변화가 없다.
            그 경우 헤드톱 부풀림의 범인은 귀가 아니므로, 아래 진단값(귀union)으로 확정할 것. */
      const _eb = new THREE.Box3();
      const _ebRaw = new THREE.Box3(), _etRaw = new THREE.Box3();   // 진단용 — 옛 규칙(숨은 메쉬 포함)
      hostSeat.gltfRoot.traverse(o=>{
        if(!(o.userData && (o.userData.animalEar || o.userData.humanEar))) return;
        if(o.visible === false) return;
        try{ _etRaw.setFromObject(o); if(!_etRaw.isEmpty()) _ebRaw.union(_etRaw); }catch(_){}
        _eb.union(measureBodyBox(o, RIDE_WRAP_OPTS));
      });
      if(!_eb.isEmpty()) _hb.union(_eb);
      // 진단 표식 — '귀가 진짜로 그 높이인가' vs '숨은 메쉬가 부풀린 것인가'를 로그 한 줄로 가른다.
      try{
        hostSeat._earTopDbg    = _eb.isEmpty()    ? null : _eb.max.y;
        hostSeat._earTopRawDbg = _ebRaw.isEmpty() ? null : _ebRaw.max.y;
      }catch(_){}
    }else{ try{ hostSeat._earTopDbg = hostSeat._earTopRawDbg = null; }catch(_){} }
    /* 🦶 '꼭대기 층' 박스 — 박스 꼭대기에서 CIRCUS_TOP_SLAB 비율만큼의 층에 걸치는 메쉬만 union.
       [왜 여기서 미리 잡는가] 쓰는 곳이 둘이다 — 묘기의 앞뒤 중심(_headTopCenterZ)과
         머리 중앙 파츠 판정(아래). 같은 '꼭대기 층'을 두 번 계산하면 언젠가 한쪽만 고쳐진다.
       ⚠️ 파츠 측정은 **기울임을 지운 지금** 해야 한다. 아래 _bp 를 잰 직후 회전이 복원되므로,
         그 뒤로 옮기면 기울어진 캐릭터에서 파츠 박스가 부풀어(AABB) 판정이 흔들린다. */
    let _topSlabBox = null;
    try{
      const _bh0 = _hb.isEmpty() ? 0 : (_hb.max.y - _hb.min.y);
      if(_bh0 > 1e-6 && _mBoxes.length){
        const _cut0 = _hb.max.y - _bh0 * CIRCUS_TOP_SLAB;
        const _tb0 = new THREE.Box3();
        _mBoxes.forEach(b => { if(b.max.y >= _cut0) _tb0.union(b); });
        if(!_tb0.isEmpty()) _topSlabBox = _tb0;
      }
    }catch(_){ _topSlabBox = null; }
    /* 🎩 머리 중앙 파츠 위에 얹기 — 조건을 통과한 파츠의 꼭대기를 따로 잰다.
       ★ 여기서 **고르지 않는다.** 값만 남기고 어느 쪽을 쓸지는 _positionRideSeat 가 매 프레임
         실제 층수로 고른다 — '얹는 시점의 상태'로 정하면 쌓는 순서에 따라 결과가 갈리던
         그 사고(위 [증상] 주석)가 그대로 재발한다.
       ★ 동물은 제외한다. 귀 union 규칙이 이미 걸려 있어 한 자리에서 규칙이 셋이 된다 —
         인간에서 기준이 굳은 뒤에 얹는다. */
    try{
      hostSeat._headTopPart = null;
      if(!(hostSeat.charDef && hostSeat.charDef.animal)){
        const _pTop = _measureRideablePartTop(hostSeat, _topSlabBox);
        if(_pTop != null && !_hb.isEmpty() && _pTop > _hb.max.y) hostSeat._headTopPart = _pTop;
      }
    }catch(_){ try{ hostSeat._headTopPart = null; }catch(__){} }
    const _bp = new THREE.Vector3(); headNode.getWorldPosition(_bp);
    // 회전 복원 — 반드시 측정이 끝난 뒤, 그리고 아래 어떤 경로로 빠져나가도 실행되게 여기서 바로 되돌린다.
    _g.quaternion.copy(_savedQ);
    _g.updateMatrixWorld(true);
    if(_hb.isEmpty()) return null;
    // 🎪 앞뒤(Z) 중심도 같이 기록 — 묘기 자세에서 대상 머리 한가운데에 서게 하기 위함.
    //   RIDE_HEAD_OFFSET_Z는 인간 머리 두께에 맞춘 절대값이라 얇은 동물 머리에선 뒤로 밀렸다.
    try{ hostSeat._headCenterZ = ((_hb.min.z + _hb.max.z)/2) - _bp.z; }catch(_){}
    // 앞뒤 보정을 '박스 깊이 비율'로 잡기 위해 깊이도 보관 — 절대 상수는 대상마다 어긋난다.
    try{ hostSeat._headDepthZ = (_hb.max.z - _hb.min.z); }catch(_){}
    /* 🎪 묘기(2층+)가 쓸 앞뒤 값은 **귀를 뺀 박스**에서 뽑는다.
       [경위] 같은 조합을 네 번 올린 제보 로그에서 박스깊이가 0.2155 / 0.3239 / 0.3107 / 0.2155 로
         50% 씩 흔들렸고, headCenterZ 도 0.0023 ↔ 0.0505 로 같이 흔들려 offZ 가 0.0626 ↔ 0.1412 가 됐다.
         2층이 올릴 때마다 앞이었다 뒤였다 한 이유가 이것이다.
       [범인] 귀다. 같은 로그에서 **귀를 뺀** 높이는 0.1673 / 0.1674 / 0.1680 / 0.1673 으로 거의 고정인데
         귀를 포함한 높이만 0.3778 / 0.3559 / 0.3601 / 0.3778 로 흔들렸다 — 15배 차이다.
         귀는 머리 본에 매달린 별도 GLB 라 머리 흔들림(animateRig)에 따라 앞뒤로 크게 휘둘리고,
         Box3 는 월드축 정렬(AABB)이라 그 휘둘림이 박스 깊이에 그대로 들어온다.
         (_g.quaternion.identity() 는 좌석 기울임만 지운다 — 본 포즈는 그대로다.)
       ⚠️ 1층(팔 걸치기)은 예전 값을 그대로 쓴다. RIDE_Z_DEPTH_K_ON_ANIMAL 이 귀 포함 깊이에 맞춰
         눈으로 튜닝된 상수라, 여기서 같이 바꾸면 잘 나오던 1층이 그만큼 어긋난다.
         1층도 같은 흔들림을 갖고 있으므로 언젠가 옮겨야 하지만, 그때는 K 를 다시 맞춰야 한다. */
    try{
      const _bb = (_bareBox && !_bareBox.isEmpty()) ? _bareBox : _hb;
      hostSeat._headCenterZNoEar = ((_bb.min.z + _bb.max.z)/2) - _bp.z;
      hostSeat._headDepthZNoEar  = (_bb.max.z - _bb.min.z);
    }catch(_){ try{ hostSeat._headCenterZNoEar = hostSeat._headDepthZNoEar = null; }catch(__){} }
    /* 🦶 '발판'의 앞뒤 중심 — 묘기 자세(2층+)가 설 자리다.
       [경위] 위의 _headCenterZ 는 이름과 달리 **몸 전체 박스**의 중심이다(measureHeadBoxNoParts 가
         gltfRoot 를 통째로 잰다). 인간은 몸이 얇아 티가 안 났지만, 동물은 꼬리·엉덩이가 뒤로 뻗어
         박스 중심이 머리보다 한참 뒤에 잡힌다 → 2층이 머리 중앙이 아니라 등 쪽에 선다.
         1층은 이미 이 사실을 알고 깊이 비율로 따로 보정하고 있었는데(RIDE_Z_DEPTH_K_ON_ANIMAL),
         2층+ 만 _headCenterZ 를 '머리 중심'으로 믿고 그대로 썼다.
       [해법] 박스 꼭대기에서 CIRCUS_TOP_SLAB 비율만큼의 층에 걸치는 메쉬만 골라 그 앞뒤 중심을 쓴다.
         발이 실제로 닿는 면이 그 층이므로, 꼬리·다리가 아무리 뒤로 뻗어도 끌려가지 않는다.
       ⚠️ 모델이 통메쉬 하나면 그 층에도 그 메쉬 하나뿐이라 결과가 예전과 같아진다 — 회귀는 없고
          이 수정의 효과도 없다. 그때는 CIRCUS_FOOT_Z 로 손보는 수밖에 없다.
       ⚠️ 값이 몸통 중심에서 깊이의 60% 넘게 떨어지면 측정 실패로 보고 버린다(폴백 = 예전 동작). */
    try{
      hostSeat._headTopCenterZ = null;
      if(_topSlabBox){
        const _topBox = _topSlabBox;
        {
          const _cz  = (_topBox.min.z + _topBox.max.z)/2 - _bp.z;
          const _cz0 = (_hb.min.z + _hb.max.z)/2 - _bp.z;
          const _dep = (_hb.max.z - _hb.min.z);
          /* ⚠️ 통메쉬 — 꼭대기 층을 잘라도 그 층에 그 메쉬 하나뿐이라 결과가 몸 전체 중심과 같아진다.
             그건 '머리 꼭대기를 쟀다'가 아니라 **아무것도 골라내지 못했다**는 뜻이므로 null 로 둔다.
             예전엔 그 값을 그대로 믿어 2층이 몸통 한가운데(=머리보다 뒤)에 섰다.
             null 이면 _positionRideSeat 의 동물 폴백(깊이 비율로 앞당김)이 대신 받는다.
             ★ 인간은 몸이 얇아 원래 두 값이 거의 같고, 폴백도 같은 _headCenterZ 라 결과가 안 바뀐다. */
          const _flat = Math.abs(_cz - _cz0) <= _dep * 0.02;
          if(_flat){
            console.warn('[묘기] 꼭대기 층이 몸 전체와 같음(통메쉬로 추정) — 깊이 비율 보정으로 갑니다');
          }else if(isFinite(_cz) && Math.abs(_cz - _cz0) <= _dep * 0.6){ hostSeat._headTopCenterZ = _cz; }
          else console.warn('[묘기] 꼭대기 중심 Z가 비정상(' + _cz.toFixed(4) + ' vs 몸중심 ' + _cz0.toFixed(4) + ') — 예전 방식으로 갑니다');
        }
      }
    }catch(_){ try{ hostSeat._headTopCenterZ = null; }catch(__){} }
    const h = _hb.max.y - _bp.y;
    /* 🎩 파츠 꼭대기도 **머리 본 기준 상대값**으로 바꾼다 — 다른 높이들과 단위가 같아야
       _positionRideSeat 가 한 줄에서 골라 쓸 수 있다(월드 절대값으로 두면 대상이 움직일 때 어긋난다). */
    try{
      if(hostSeat._headTopPart != null){
        const _hp = hostSeat._headTopPart - _bp.y;
        hostSeat._headTopPart = (isFinite(_hp) && _hp > 0) ? _hp : null;
      }
    }catch(_){ try{ hostSeat._headTopPart = null; }catch(__){} }
    /* 🎪 묘기(2층+)는 '귀 위'가 아니라 '머리 꼭대기'에 발을 놓는다 — 귀 끝까지 올리면 발이 허공에 뜬다.
       고를 수 있도록 귀를 뺀 높이도 같이 남긴다. 귀가 없거나 인간이면 두 값이 같다. */
    try{
      const hb = (_bareTopY != null) ? (_bareTopY - _bp.y) : h;
      hostSeat._headTopNoEar = (isFinite(hb) && hb > 0) ? hb : null;
    }catch(_){ try{ hostSeat._headTopNoEar = null; }catch(__){} }
    return (isFinite(h) && h > 0) ? h : null;
  }catch(_){ return null; }
}
/* 🐰 대상 머리 꼭대기를 **한 번 더** 재서 이미 올라타 있는 좌석들에 다시 심는다.
   [경위] 동물 귀는 별도 GLB 라 비동기로 붙는데, _measureHostHeadTop 은 mountRide 에서 **1회**만 돈다.
     귀가 붙기 전에 얹히면 귀 없는 높이가 캐시로 남아 위 캐릭터가 귀 사이에 파묻힌 채로 있고,
     런처로 나갔다 실행 화면을 다시 열어야(= 좌석이 재조립되며 다시 얹혀야) 맞았다.
     그래서 '귀가 실제로 등록되는 그 순간'에 딱 한 번 다시 잰다(_registerAnimalEarOn 에서 호출).
   ⚠️ 매 프레임 다시 재는 방식으로 바꾸지 말 것 — 이름표·말풍선이 이 높이를 보고 자리를 잡으므로
     값이 프레임마다 흔들리면 라벨이 같이 떤다. 부착 완료 시점의 1회여야 한다.
   ★ 값은 대상 좌석 하나의 성질이므로 한 번만 재서 올라탄 좌석 전부에 같이 심는다.
     측정이 실패하면(null) 옛 값을 그대로 둔다 — 덮으면 폴백 경로로 떨어져 오히려 더 어긋난다. */
function _remeasureRideHeadTop(hostSeat){
  if(!hostSeat) return;
  let riders = [];
  try{ riders = _rideRiders(hostSeat); }catch(_){ return; }
  if(!riders.length) return;   // 아무도 안 타고 있으면 잴 이유가 없다(다음 mountRide 가 잰다)
  try{
    const headNode = (hostSeat.bones && hostSeat.bones.head) ? hostSeat.bones.head : hostSeat.headAnchor;
    const v = _measureHostHeadTop(hostSeat, headNode);
    if(v == null){ diagNote('[올라타기] 다시 재기 실패 — 옛 높이 그대로'); return; }
    const vb = (hostSeat._headTopNoEar != null) ? hostSeat._headTopNoEar : v;   // 🎪 묘기용(귀 제외)
    const vp = (hostSeat._headTopPart != null) ? hostSeat._headTopPart : null;  // 🎩 머리 중앙 파츠 위
    riders.forEach(r=>{ try{ r._rideHeadTop = v; r._rideHeadTopBare = vb; r._rideHeadTopPart = vp; r._rideDbgOnce = true; }catch(_){} });   // 다음 프레임에 새 값으로 검증 한 줄
  }catch(_){}
}
/* 🐾 올라타기 — 동물 좌석을 대상 머리에 태우기/내리기 */
function mountRide(animalSeat, hostSeat){
  if(!animalSeat || !hostSeat || animalSeat===hostSeat) return false;
  /* 🐾 **머리 위에 올라갈 수 있는 것은 동물뿐이다** — 이 규칙을 여기 한 곳에 둔다.
     [왜 여기로 옮겼나] 예전엔 드래그 경로(pointerup)에만 `seat.charDef.animal` 검사가 있었다.
       그런데 mountRide 를 부르는 자리는 셋이다:
         ① 드래그로 놓기            — 검사 있음
         ② _applyRemoteRides        — 친구가 방송한 ridingOn 을 그대로 반영. **검사 없었음**
         ③ unmountRide 의 내려앉히기 — 아래층이 빠질 때 위층을 재부착. **검사 없었음**
       ②·③은 이미 얹힌 상태를 옮기는 자리라 "처음부터 잘못 얹힌" 것은 그대로 통과했다.
     [제보된 증상 — 인간 머리 위에 인간] 두 갈래가 겹쳐서 난다.
       ㉠ `charDef.animal` 은 **저장값**이다. 동물 GLB 파싱이 아직 안 끝났으면 buildAnimalBase 가
          null 을 돌려주고 좌석은 인간 모습으로 폴백된다(applyCharToSeat 의 `if(!inst)`).
          그 창에서 얹으면 저장값이 동물이라 ①의 검사를 통과하는데 화면에는 인간이 올라간다.
          부팅 직후·저사양 기기에서만 열리는 창이라 "어떻게 났는지 모르겠다"가 된다.
       ㉡ 그 상태는 ridingOn 으로 방송되고, 받는 쪽은 ②라서 검사 없이 그대로 재현한다.
          내 화면에서 잠깐 났던 것이 방 전체에 굳는다.
     ⇒ 저장값(charDef.animal)과 **실제 조립 결과**(_animalBuilt)를 둘 다 본다.
     ⚠️ _animalBuilt 가 undefined 인 좌석(모델이 아직 없는 미리보기 등)은 막지 않는다 —
       모르는 것을 거절하면 멀쩡한 올라타기가 조용히 실패한다. false 일 때만 거절한다. */
  if(!(animalSeat.charDef && animalSeat.charDef.animal)){
    if(!animalSeat.remote) toast('🐾 머리 위에는 동물만 올릴 수 있어요');
    return false;
  }
  if(animalSeat._animalBuilt === false){
    if(!animalSeat.remote) toast('🐾 동물 모습을 준비하는 중이에요 — 잠시 뒤 다시 올려주세요');
    return false;
  }
  /* ★ 대상에게 이미 누가 올라타 있으면 '그 위'로 올린다.
     예전엔 대상을 그대로 써서 같은 층에 둘이 겹쳤다 — 특히 2층을 쌓았다가 1층을 빼면
     위층이 1층으로 내려앉는데, 그 뒤 다시 머리에 얹으려 하면 둘 다 1층이 되어 겹쳐 보였다.
     탑의 꼭대기를 찾아 올라가면 자연스럽게 다음 층이 된다(순환·층수 검사는 아래에서 그대로 수행). */
  { let _g=0;
    while(_g++ < 16){
      const _up = _rideRiders(hostSeat).filter(r=>r!==animalSeat && !_rideIsAbove(r, animalSeat));
      if(!_up.length) break;
      hostSeat = _up[0];
    }
    if(animalSeat===hostSeat) return false; }
  // ★ 탑쌓기 지원 — 이미 남의 머리에 탄 캐릭터 위에도 올릴 수 있다. 단 두 가지를 막는다:
  //   ・ 순환: 내 위에 타고 있는 상대의 머리에 내가 다시 올라가면 무한 루프가 된다.
  //   ・ 층수: RIDE_MAX_STACK을 넘으면 화면 밖으로 나가고 계산도 무거워진다.
  if(_rideIsAbove(hostSeat, animalSeat)){
    if(!animalSeat.remote) toast('🐾 서로 위에 올라탈 수는 없어요');   // 안내는 내 조작일 때만(원격 데이터로 반복되면 sync마다 토스트가 뜸)
    return false;
  }
  if(_rideDepth(hostSeat) + 1 > RIDE_MAX_STACK){
    if(!animalSeat.remote) toast('🐾 '+RIDE_MAX_STACK+'층까지만 쌓을 수 있어요');
    return false;
  }
  animalSeat.ridingOn = hostSeat;
  /* 🎪 탑 모양이 바뀌었으니 흔들림 타이머를 **처음부터 다시 센다** — 바닥과 기존 참여자 전원.
     [왜] `_circusPanicAt` 은 '언제부터 흔들리기 시작했나'이고 판정은 바닥의 값 하나로 한다.
       한 층을 새로 올린 것은 균형을 다시 잡은 것이나 같은데, 이전 타이머가 남아 있으면
       올린 직후에 남은 시간부터 이어져 곧바로(혹은 즉시) 무너진다.
     ★ _checkCircusBalance 의 청소만으로도 '해체됐던 탑'은 막히지만, 조는 사람이 있어
       **타이머가 실제로 흐르는 중에** 한 층을 더 올리는 경우는 여기서만 막을 수 있다.
     ★ 조는 사람이 그대로면 다음 프레임에 타이머가 다시 시작된다 — 유예를 주는 것뿐, 판정을 없애지 않는다. */
  try{
    const _b = _rideBottom(hostSeat);
    if(_b) _b._circusPanicAt = 0;
    seats.forEach(x=>{ if(x && _rideIsAbove(x, _b)) x._circusPanicAt = 0; });
  }catch(_){}
  // 🎪 묘기 자세의 '방향'과 '딛는 발'을 매번 새로 뽑는다 — 안 지우면 좌석에 남아 다시 쌓아도 늘 같은 모습.
  //   (한 번 정해진 값은 올라타 있는 동안 고정되므로 매 프레임 튀지 않는다)
  animalSeat._circusYawDir = undefined;
  animalSeat._circusYawAmt = undefined;
  /* 🦶 딛는 발은 여기서 뽑는다 — 예전엔 undefined 로 두고 animateRig 가 첫 프레임에 뽑았는데,
     그러면 '어느 다리로 서는지'를 모르는 채로는 접지점 오프셋을 잴 수가 없다.
     매 마운트마다 새로 뽑는 것은 그대로다(같은 좌석을 다시 쌓아도 늘 같은 모습이 되지 않게).
     animateRig 의 `=== undefined` 폴백은 남겨 둔다 — 이 경로를 안 거친 좌석 대비. */
  animalSeat._circusStandLeft = (Math.random() < 0.5);
  animalSeat._circusFootOff = undefined;   // 🦶 '아직 안 잼' — 첫 묘기 프레임에서 잰다(위 함수 주석의 함정)
  animalSeat._rideArmH = _measureAnimalArmH(animalSeat);   // 동물 팔 높이 실측(1회)
  animalSeat._rideHeadTop = _measureHostHeadTop(hostSeat,
    (hostSeat.bones && hostSeat.bones.head) ? hostSeat.bones.head : hostSeat.headAnchor);   // 대상 머리 꼭대기 실측(1회)
  /* 🎪 묘기(2층+)가 쓸 '귀를 뺀' 높이도 같이 캐싱한다. 어느 쪽을 쓸지는 _positionRideSeat 가
     매 프레임 실제 층수로 고른다 — 얹은 뒤에 탑이 다시 쌓여도 값이 어긋나지 않게. */
  animalSeat._rideHeadTopBare = (hostSeat._headTopNoEar != null)
    ? hostSeat._headTopNoEar : animalSeat._rideHeadTop;
  /* 🎩 머리 중앙 파츠의 꼭대기도 같이 캐싱한다(없으면 null). 1층에서만 쓴다 —
     고르는 것은 _positionRideSeat 이고, 여기서는 값만 남긴다. */
  animalSeat._rideHeadTopPart = (hostSeat._headTopPart != null) ? hostSeat._headTopPart : null;
  // 🔍 진단 — "머리 위에 얹으면 뜬다"의 원인 항 특정용.
  //   ★ armH에는 반드시 _sizeMul(=RIDE_ARM_SIZE_FOLLOW 반영)을 곱한 값을 봐야 한다.
  //     앞서 이걸 빼고 찍는 바람에 실제보다 낮은 offY가 보고됐다.
  try{
    const _hostAnimal = !!(hostSeat.charDef && hostSeat.charDef.animal);
    // ★ sink는 '올라탄 동물 자신의 월드 크기'에 비례한다(_positionRideSeat 과 같은 식이어야 로그가 의미를 갖는다)
    const _sinkBase = _hostAnimal ? RIDE_ARM_SINK_ON_ANIMAL : RIDE_ARM_SINK;
    const _riderW = ((animalSeat.charDef && animalSeat.charDef.animal) ? ANIMAL_RUN_SCALE : 1) * (seatScale(animalSeat) || 1);
    const _sinkDbg = _sinkBase * _riderW;
    const _rs = seatScale(animalSeat) || 1;
    const _mul = 1 + (_rs - 1) * RIDE_ARM_SIZE_FOLLOW;
    const _armW = (animalSeat._rideArmH != null) ? animalSeat._rideArmH * _mul : null;
    const _off  = (animalSeat._rideHeadTop != null && _armW != null)
                ? (animalSeat._rideHeadTop + _sinkDbg - _armW) : null;
    const _f = v => (v == null ? 'null' : (+v).toFixed(4));
    console.log('[올라타기] 대상=' + (_hostAnimal ? '동물' : '인간')
      + ' headTop=' + _f(animalSeat._rideHeadTop)
      + ' armH(원본)=' + _f(animalSeat._rideArmH) + ' ×sizeMul ' + _f(_mul) + ' = ' + _f(_armW)
      + ' sink=' + _f(_sinkBase) + '×동물월드크기 ' + _f(_riderW) + ' = ' + _f(_sinkDbg) + ' → offY=' + _f(_off)
      + ' | hostScale=' + _f(seatScale(hostSeat) || 1) + ' riderScale=' + _f(_rs));
    // 다음 프레임에 '계산값 vs 실제 렌더 위치'를 1회 비교 — 공식이 맞는데도 떠 있다면 이후 단계가 범인.
    animalSeat._rideDbgOnce = true;
  }catch(_){}
  if(animalSeat.desk) animalSeat.desk.visible = false;   // 올라탄 동안 자기 책상 숨김(스펙)
  // ★ 안내와 전송은 '내 조작'일 때만. _applyRemoteRides가 친구 좌석을 여기로 통과시키는데,
  //   그때도 토스트가 뜨면 남의 행동을 내가 한 것처럼 알리고, broadcastRide까지 불려
  //   친구의 상태 변화마다 내 presence 쓰기가 한 번씩 더 나간다(불필요한 서버 비용·왕복).
  if(!animalSeat.remote){
    if(!_rideQuietToast) toast('🐾 머리 위에 올라탔어요! (다시 드래그하면 내려와요)');   // 🗼 탑이 내려앉으며 다시 태울 땐 조용히
    try{ broadcastRide(); }catch(_){}
  }
  /* 🐾 이 좌석은 이제 자리 계산에서 빠진다(layoutSeats 의 placed 주석) — 남은 좌석이 그 자리를
     메우도록 즉시 다시 깐다. 안 부르면 올라간 뒤에도 빈자리가 그대로 남는다. */
  try{ layoutSeats(); }catch(_){}
  return true;
}
/* 🗼 탑에서 이 좌석만 뺀다 — [2026-09-23 요청 · A안 «나만 빠지고 탑은 한 칸 내려앉음»]
   · 가운데·맨 위: unmountRide 본래 동작 — 내 위층들이 내 아래층 위로 내려앉는다(드래그로 내려올 때와 같다).
   · 맨 아래: 바로 위층이 새 바닥이 되고 그 위는 탄 채 남는다. unmountRide(위층) 은 위층의 승객을 «그 아래(=나)» 로
     옮겨 싣기 때문에 그대로 부르면 날아갈 나에게 다시 태운다 — 승객을 잠깐 떼었다가 위층 위로 다시 태운다.
   ★ 다시 태울 때 토스트는 끈다(_rideQuietToast) — 내가 한 조작이 아니다. 방송(broadcastRide)은 그대로 나간다. */
let _rideQuietToast = false;
function _rideLeaveTower(seat){
  if(!seat) return;
  _rideQuietToast = true;
  try{
    if(seat.ridingOn){ unmountRide(seat); return; }
    _rideRiders(seat).forEach(up=>{
      const upper = _rideRiders(up);
      upper.forEach(u=>{ u.ridingOn = null; });
      unmountRide(up);
      upper.forEach(u=>{
        try{ if(!mountRide(u, up)){ u.ridingOn = up; unmountRide(u); } }catch(_){}
      });
    });
  }catch(_){}
  finally{ _rideQuietToast = false; }
}
function unmountRide(animalSeat){
  if(!animalSeat || !animalSeat.ridingOn) return;
  const _below = animalSeat.ridingOn;
  animalSeat.ridingOn = null;
  // ★ 내 위에 타고 있던 좌석들은 '내가 있던 자리'(아래 대상)로 내려앉힌다.
  //   재부착이므로 팔 높이·머리 꼭대기를 다시 실측해야 한다 — 실패하면 그 좌석은 그냥 하차시켜
  //   허공에 남지 않게 한다(안전한 폴백).
  try{
    _rideRiders(animalSeat).forEach(up=>{
      up.ridingOn = null;
      if(_below && seats.includes(_below) && !_rideIsAbove(_below, up) && _rideDepth(_below)+1 <= RIDE_MAX_STACK){
        if(mountRide(up, _below)) return;
      }
      unmountRide(up);   // 내려앉힐 곳이 없으면 하차
    });
  }catch(_){}
  if(animalSeat.desk) animalSeat.desk.visible = true;
  /* 🎪 묘기 상태 해제 — _circusOn은 _positionRideSeat에서만 세팅되는데, 그 함수는 ridingOn이 있는
     좌석만 돈다. 내려놓으면 루프에서 빠지므로 마지막 값(true)이 그대로 남아 책상으로 돌아와도
     팔을 벌리고 다리를 든 묘기 자세가 유지됐다. 탑 붕괴 경로(_collapse)는 이미 같은 정리를 하고 있다.
     ★ 재조립 때 새로 뽑히도록 방향·딛는 발 난수도 함께 비운다(mountRide가 undefined를 보고 다시 뽑음). */
  animalSeat._circusOn = false;
  animalSeat._circusPanicAt = 0;
  animalSeat._rideHeadTop = null;
  animalSeat._rideArmH = null;
  animalSeat._circusYawDir = undefined;
  animalSeat._circusYawAmt = undefined;
  animalSeat._circusStandLeft = undefined;
  animalSeat._circusFootOff = null;   // 🦶 접지점 보정값도 함께 폐기 — 다음에 올라탈 때 다시 잰다
  // ★ 올라탈 때 group.position에 머리 월드좌표를 통째로 넣는데, 프레임 루프의 일반 분기는 group.position.x만
  //   되돌린다(y·z는 아무도 복원하지 않음). 그래서 내려놓으면 공중에 뜬 채로 남아 있었음 — 여기서 직접 복원.
  try{ if(animalSeat.group){ animalSeat.group.position.y = 0; animalSeat.group.position.z = 0;
       animalSeat.group.quaternion.identity(); animalSeat.group.rotation.set(0,0,0); } }catch(_){}   // 머리 회전을 따라가며 바뀐 자세도 원복
  if(!animalSeat.remote){ try{ broadcastRide(); }catch(_){} }   // 내 조작일 때만 전송(위 mountRide 주석 참고)
  /* ⚠️ 내려오면 자리가 **즉시** 돌아와야 한다 — ridingOn 만 끊고 재배치를 안 하면
     내려온 캐릭터가 남의 자리에 겹쳐 선다(자리 계산에서 빠져 있던 좌석이니 다시 끼워 넣어야 한다). */
  try{ layoutSeats(); }catch(_){}
}
/* 놓은 지점에서 가장 가까운 "머리"를 찾음 — 자기 자신·이미 탄 좌석 제외 */

const BENCH_SNAP_DIST = 0.9;   // 이 거리 안에서 놓으면 슬롯에 흡착
// 임시 프리미티브 벤치(GLB 준비 전 검증용) — seat_0/seat_1 위치를 코드로 지정.
//   실제 GLB로 교체 시 이 슬롯은 _readBenchSlots가 GLB의 seat_N Empty에서 자동 추출.
function buildPrimitiveBench(seatCount){
  const n = Math.max(2, Math.min(3, seatCount||2));
  const g = new THREE.Group(); g.name='benchRoot';
  const w = n===3 ? 1.9 : 1.3;                 // 벤치 폭 — 캐릭터를 가리지 않게 축소
  const seatY = 0.22, deskZ = 0.5, seatDepth = 0.42;
  // 방석(상판) — 낮고 얕게
  const topM = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, seatDepth), matWood);
  topM.position.set(0, seatY, deskZ); topM.castShadow=topM.receiveShadow=true; topM.name='benchSeat'; g.add(topM);
  // 등받이 — 낮게(캐릭터 상체를 안 가리게)
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.06), matWoodD);
  back.position.set(0, seatY+0.13, deskZ+seatDepth/2-0.03); back.castShadow=true; g.add(back);
  // 다리
  [[-w/2+0.1, deskZ-0.15],[w/2-0.1, deskZ-0.15],[-w/2+0.1, deskZ+0.15],[w/2-0.1, deskZ+0.15]].forEach(([x,z])=>{
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.07, seatY, 0.07), matWoodD);
    leg.position.set(x, seatY/2, z); leg.castShadow=true; g.add(leg);
  });
  // 좌석 슬롯 Empty(엉덩이가 닿을 지점). GLB의 seat_N과 같은 규칙으로 이름 지정.
  const spread = n===3 ? [ -0.6, 0, 0.6 ] : [ -0.35, 0.35 ];
  spread.forEach((x,i)=>{
    const e=new THREE.Group(); e.name='seat_'+i;
    e.position.set(x, seatY, deskZ);          // 방석 높이
    e.rotation.y = Math.PI;                    // -Z가 정면(카메라 쪽)
    g.add(e);
  });
  g.userData.benchSeatCount = n;
  return g;
}
// 벤치 오브젝트에서 seat_N Empty들을 읽어 슬롯 테이블 생성(로컬 좌표/회전).
function _readBenchSlots(benchObj){
  const slots=[];
  benchObj.traverse(o=>{
    const m = /^seat_(\d+)$/i.exec(o.name||'');
    if(m) slots[+m[1]] = o;
  });
  return slots.filter(Boolean);
}
// 좌석에 벤치를 부착 — 교체 방식: 개인 책상(seat.desk)을 숨기고 벤치를 그 자리에 놓는다.
function attachBenchToSeat(seat, seatCount, deskId){
  if(!seat) return;
  if(seat.bench){ seat.group.remove(seat.bench); seat.bench=null; seat.benchSlots=null; }
  const bench = buildPrimitiveBench(seatCount);   // (GLB 준비되면 여기서 GLB 로드로 교체)
  seat.group.add(bench);
  seat.bench = bench;
  seat.benchDeskId = deskId || null;
  seat.benchSlots = _readBenchSlots(bench);
  seat.benchOccupants = seat.benchOccupants || {};
  if(seat.desk) seat.desk.visible = false;   // 🪑 교체 — 개인 책상 숨김
  // 🪑 벤치 주인은 자동으로 slot_0에 앉는다. 자기 벤치는 자기 그룹의 자식이라(좌표 순환 회피)
  //   group을 옮기지 않고 rig를 슬롯 로컬 위치로 보내는 owner-sit 방식으로 처리(프레임 루프 참고).
  seat._benchOwnerSit = true;
  seat._benchSit = true;
  seat.benchOccupants[0] = seat;   // slot_0 점유(주인) — 친구는 slot_1부터 앉음
}
/* 🪑 내 상호작용 책상 장착/해제(교체 방식).
   equip: 내 책상을 벤치로 교체. unequip: 개인 책상으로 복귀. 둘 다 presence 전송. */
function equipInteractionDesk(deskId){
  const def = _deskDefById(deskId);
  const me = seats.find(s=>s.isMe);
  if(!def || !me) return false;
  if(!isDeskUnlocked(def)){ toast('🔒 Lv.'+def.reqLevel+' 달성 시 해금돼요'); return false; }
  attachBenchToSeat(me, def.seats, def.id);
  setActiveInteractionDeskId(def.id);
  try{ broadcastRide(); }catch(_){}
  toast('🪑 '+def.name+'(으)로 바꿨어요');
  return true;
}
function unequipInteractionDesk(){
  const me = seats.find(s=>s.isMe); if(!me) return;
  seats.filter(s=>s.seatedOn===me).forEach(unmountBench);
  if(me.bench){ me.group.remove(me.bench); me.bench=null; me.benchSlots=null; me.benchDeskId=null; me.benchOccupants={}; }
  me._benchOwnerSit = false; me._benchSit = false;   // 앉기 해제
  if(me.desk) me.desk.visible = true;   // 개인 책상 복귀
  setActiveInteractionDeskId(null);
  try{ broadcastRide(); }catch(_){}
}
// 드래그로 놓은 rider가 앉을 가장 가까운 빈 슬롯을 찾는다.
function findBenchSlot(riderSeat){
  if(!riderSeat) return null;
  riderSeat.rig.getWorldPosition(_rideTmp);
  let best=null;
  seats.forEach(hostSeat=>{
    if(hostSeat===riderSeat || !hostSeat.bench || !hostSeat.benchSlots) return;
    hostSeat.benchSlots.forEach((slot, idx)=>{
      const occ = hostSeat.benchOccupants && hostSeat.benchOccupants[idx];
      if(occ && occ!==riderSeat) return;   // 이미 다른 사람이 앉음
      slot.getWorldPosition(_rideWP);
      const d=_rideWP.distanceTo(_rideTmp);
      if(d < BENCH_SNAP_DIST && (!best || d<best.d)){ best={host:hostSeat, slot:idx, d}; }
    });
  });
  return best;
}
// 슬롯에 앉히기 — ridingOn과 별개 필드(seatedOn/seatSlot)로 관리. 개인 책상은 숨김.
function mountBench(riderSeat, hostSeat, slotIndex){
  if(!riderSeat || !hostSeat || riderSeat===hostSeat) return false;
  if(!hostSeat.bench || !hostSeat.benchSlots || !hostSeat.benchSlots[slotIndex]) return false;
  hostSeat.benchOccupants = hostSeat.benchOccupants || {};
  // 그 슬롯에 앉아있던 다른 사람이 있으면(중복) 막음
  const prev = hostSeat.benchOccupants[slotIndex];
  if(prev && prev!==riderSeat) return false;
  // 내가 다른 곳에 앉아 있었으면 먼저 일어남
  if(riderSeat.seatedOn) unmountBench(riderSeat);
  riderSeat.seatedOn = hostSeat;
  riderSeat.seatSlot = slotIndex;
  riderSeat._benchSit = true;   // 앉기 모션 플래그 — animateRig의 다리 본 처리에서 무릎을 접는다
  hostSeat.benchOccupants[slotIndex] = riderSeat;
  if(riderSeat.desk) riderSeat.desk.visible = false;   // 개인 책상 숨김(동물 올라타기와 동일 스펙)
  if(!riderSeat.remote){
    toast('🪑 벤치에 앉았어요! (다시 드래그하면 일어나요)');
    try{ broadcastRide(); }catch(_){}
  }
  return true;
}
function unmountBench(riderSeat){
  if(!riderSeat || !riderSeat.seatedOn) return;
  const host = riderSeat.seatedOn, slot = riderSeat.seatSlot;
  if(host.benchOccupants && host.benchOccupants[slot]===riderSeat) delete host.benchOccupants[slot];
  riderSeat.seatedOn = null; riderSeat.seatSlot = null; riderSeat._benchSit = false;
  if(riderSeat.desk) riderSeat.desk.visible = true;    // 개인 책상 복구
  if(!riderSeat.remote){ try{ broadcastRide(); }catch(_){} }
}
// 내 벤치 제거 — 앉아있던 사람들 자동 하차 + 개인 책상 복귀.
function removeMyBench(){ unequipInteractionDesk(); }
/* 🔄 앱 재시작·재입장 시 저장된 상호작용 책상 복원 — 방에 들어와 내 좌석이 준비된 뒤 1회 호출.
   저장된 id가 있고 아직 해금 상태면 다시 장착. 미해금(레벨 하락 등)이면 조용히 해제. */
let _ideskRestored = false;
function restoreInteractionDesk(){
  try{
    if(typeof IDESK_ENABLED()!=='undefined' && !IDESK_ENABLED()){ _ideskRestored = true; return; }   // ⏸️ 비활성화 중엔 복원 안 함
    if(_ideskRestored) return;
    const me = seats.find(s=>s.isMe);
    if(!me) return;                       // 좌석 아직 준비 안 됨 — 다음 호출 때 재시도
    const id = getActiveInteractionDeskId();
    if(!id){ _ideskRestored = true; return; }
    const def = _deskDefById(id);
    if(def && isDeskUnlocked(def)){
      attachBenchToSeat(me, def.seats, def.id);
      try{ broadcastRide(); }catch(_){}
    } else {
      setActiveInteractionDeskId(null);   // 해금 아니면 저장값 정리
    }
    _ideskRestored = true;
  }catch(_){}
}
function _resetIdeskRestore(){ _ideskRestored = false; }   // 방을 나갈 때 호출 → 다음 입장에서 다시 복원
// 🛠️ 콘솔 백업(관리자 테스트용) — 인벤토리 UI가 주 경로. ⏸️ 이번 릴리스는 기능 비활성화라 콘솔도 막음.
window.spawnBench = function(seatCount){ if(typeof IDESK_ENABLED()!=='undefined' && !IDESK_ENABLED()){ console.log('상호작용 책상은 다음 업데이트에 공개됩니다.'); return; } equipInteractionDesk('bench2'); };
window.removeBench = function(){ if(typeof IDESK_ENABLED()!=='undefined' && !IDESK_ENABLED()) return; unequipInteractionDesk(); };

/* 🪑 상호작용 책상 인벤토리 (I키) — 방 안에서만. */
function _ideskInRoom(){ return (typeof Presence()!=='undefined' && Presence().active()); }
function renderIdeskInventory(){
  const grid = document.getElementById('ideskInvGrid'); if(!grid) return;
  const activeId = getActiveInteractionDeskId();
  grid.innerHTML = '';
  INTERACTION_DESKS().forEach(def=>{
    const unlocked = isDeskUnlocked(def);
    const cell = document.createElement('div');
    cell.className = 'idesk-cell' + (unlocked?'':' locked') + (activeId===def.id?' active':'');
    // 썸네일: 번들 PNG(thumb)가 있으면 이미지, 없으면 이모지 플레이스홀더
    if(def.thumb){
      const img=document.createElement('img'); img.className='idesk-thumb'; img.src=def.thumb; img.alt=def.name; grid.appendChild(cell);
      cell.appendChild(img);
    } else {
      const ph=document.createElement('div'); ph.className='idesk-ph'; ph.textContent='🪑'; cell.appendChild(ph);
    }
    const nm=document.createElement('div'); nm.className='idesk-name'; nm.textContent=def.name; cell.appendChild(nm);
    if(!unlocked){
      const lock=document.createElement('div'); lock.className='idesk-lock'; lock.textContent='🔒'; cell.appendChild(lock);
      const req=document.createElement('div'); req.className='idesk-req'; req.textContent='Lv.'+def.reqLevel; cell.appendChild(req);
    }
    cell.onclick = ()=>{
      if(!unlocked){ toast('🔒 Lv.'+def.reqLevel+' 달성 시 해금돼요'); return; }
      if(activeId===def.id){ unequipInteractionDesk(); }   // 이미 쓰는 걸 다시 누르면 기본으로
      else equipInteractionDesk(def.id);
      renderIdeskInventory();
    };
    grid.appendChild(cell);
  });
}
function openIdeskInventory(){
  if(!_ideskInRoom()){ toast('방에 있을 때 사용할 수 있어요'); return; }
  const ov=document.getElementById('ideskInvOverlay'); if(!ov) return;
  renderIdeskInventory();
  ov.style.display='block';
  _restoreIdeskPos();   // 과거 이동값 복원
}
function closeIdeskInventory(){ const ov=document.getElementById('ideskInvOverlay'); if(ov) ov.style.display='none'; }
function _ideskOpen(){ const ov=document.getElementById('ideskInvOverlay'); return !!(ov && ov.style.display==='block'); }
function toggleIdeskInventory(){ if(_ideskOpen()) closeIdeskInventory(); else openIdeskInventory(); }

// 📍 창 위치 저장/복원 (설정창과 동일한 방식)
const IDESK_POS_KEY = 'tw.ideskInvPos';
function _saveIdeskPos(){
  try{ const w=document.getElementById('ideskInvWin'); if(!w) return;
    localStorage.setItem(IDESK_POS_KEY, JSON.stringify({left:w.style.left, top:w.style.top})); }catch(_){}
}
function _restoreIdeskPos(){
  try{
    const w=document.getElementById('ideskInvWin'); if(!w) return;
    const raw=localStorage.getItem(IDESK_POS_KEY);
    if(!raw){ return; }   // 저장값 없으면 CSS 기본(화면 중앙) 유지
    const p=JSON.parse(raw);
    if(p && p.left && p.top){
      w.style.transform='none';   // 절대좌표로 전환
      w.style.left=p.left; w.style.top=p.top;
      // 화면 밖이면 다시 안쪽으로 당김
      const r=w.getBoundingClientRect();
      if(r.right<40 || r.bottom<40 || r.left>innerWidth-40 || r.top>innerHeight-40){
        w.style.left=''; w.style.top=''; w.style.transform='translate(-50%,-50%)';
      }
    }
  }catch(_){}
}
(function bindIdeskInventory(){
  const ov=document.getElementById('ideskInvOverlay');
  const win=document.getElementById('ideskInvWin');
  const head=document.getElementById('ideskInvHead');
  const closeBtn=document.getElementById('ideskInvClose');
  const noneBtn=document.getElementById('ideskInvNone');
  if(closeBtn) closeBtn.addEventListener('click', e=>{ e.stopPropagation(); closeIdeskInventory(); });
  if(noneBtn) noneBtn.onclick=()=>{ unequipInteractionDesk(); renderIdeskInventory(); };
  // 🖱️ 헤더 드래그로 창 이동 (설정창과 동일 방식: transform 중앙정렬 → left/top 절대좌표 전환 후 저장)
  if(head && win){
    let dragging=false, offX=0, offY=0;
    head.addEventListener('pointerdown', e=>{
      if(e.target.closest && e.target.closest('#ideskInvClose')) return;   // × 버튼은 드래그 아님
      dragging=true;
      const r=win.getBoundingClientRect();
      offX=e.clientX-r.left; offY=e.clientY-r.top;
      win.style.transform='none'; win.style.left=r.left+'px'; win.style.top=r.top+'px';
      try{ head.setPointerCapture(e.pointerId); }catch(_){}
      e.preventDefault();
    });
    head.addEventListener('pointermove', e=>{
      if(!dragging) return;
      const w=win.offsetWidth, h=win.offsetHeight;
      const x=Math.max(0, Math.min(innerWidth-w,  e.clientX-offX));
      const y=Math.max(0, Math.min(innerHeight-h, e.clientY-offY));
      win.style.left=x+'px'; win.style.top=y+'px';
    });
    const endDrag=e=>{ if(!dragging) return; dragging=false; try{ head.releasePointerCapture(e.pointerId); }catch(_){} _saveIdeskPos(); };
    head.addEventListener('pointerup', endDrag);
    head.addEventListener('pointercancel', endDrag);
  }
  // ⎋ Esc로 닫기
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && _ideskOpen()){ e.stopPropagation(); closeIdeskInventory(); } });
})();

return {
  _checkCircusBalance,
  _remeasureRideHeadTop,
  _resetIdeskRestore,
  _rideBottom,
  _rideDepth,
  _rideIsAbove,
  _rideLeaveTower,
  _rideRiders,
  _updateRideChains,
  attachBenchToSeat,
  findBenchSlot,
  mountBench,
  mountRide,
  restoreInteractionDesk,
  toggleIdeskInventory,
  unmountBench,
  unmountRide,
};
}

const api = { createRideBench };
if(typeof window !== 'undefined') window.TwRideBench = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
