/* ride-tuning.js — 🎛️ 올라타기 · 묘기 튜닝 값 — 얹힘 높이 · 앞뒤 보정 · 묘기 자세 · 흔들림 · 와해 · 흡착 거리 · 탑 층수 · 공용 임시 벡터
   책임: 올라타기(ride-bench) · 상호작용 책상(interaction-desk) · 동작(app.js animateRig)이 같이 읽는 박힌 값 표 하나 — 계산 없이 값만.
     같이 쓰는 three 임시 벡터 · 쿼터니언(_rideWP 등 — 매 프레임 new 하지 않으려고 하나씩 돌려 쓴다)도 여기서 만든다.
   받는 deps: 없음. 내보내는 것: 아래 상수 · 임시 객체 전부(app.js 는 rideTuneMod.이름 으로 읽어 각 모듈 deps 로 넘긴다).
   ⚠️ 높이 · 깊이 보정 값은 «대상 크기 1 기준» 이고 쓰는 쪽이 × 대상 userScale 한다 — 작은 크기에서 맞춘 값을 박으면 크기 1 이 어긋난다.
   app.js «🪑 좌석 크기 평준화» 구역 안에 있던 올라타기 · 묘기 튜닝 값을 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 사이에 빈 줄 하나 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄임). 바뀐 코드 줄은 0줄.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 밖에서 부르는 이름: CIRCUS_ARM_DROP · CIRCUS_ARM_SPREAD · CIRCUS_DIZZY_MS · CIRCUS_FOOT_CENTER · CIRCUS_FOOT_SINK · CIRCUS_FOOT_Z · CIRCUS_FOOT_Z_FROM_TOP · CIRCUS_LEG_LIFT · CIRCUS_LEG_STAND · CIRCUS_LEG_WAG · CIRCUS_LEG_WAG_SPD · CIRCUS_MIN_DEPTH · CIRCUS_PANIC_MS · CIRCUS_PANIC_SLEEPERS · CIRCUS_SWAY_CALM · CIRCUS_SWAY_PANIC · CIRCUS_SWAY_SPEED · CIRCUS_TOP_SLAB · CIRCUS_TREMOR_AMP · CIRCUS_TREMOR_AT · CIRCUS_TREMOR_CALMDOWN · CIRCUS_TREMOR_SPD · CIRCUS_YAW_MAX · CIRCUS_YAW_MIN · CIRCUS_YAW_RANDOM · CIRCUS_Z_DEPTH_K_ON_ANIMAL · RIDE_ARM_SINK · RIDE_ARM_SINK_ON_ANIMAL · RIDE_ARM_SIZE_FOLLOW · RIDE_FOLLOW_HEAD_TILT · RIDE_HEAD_OFFSET_Y · RIDE_HEAD_OFFSET_Z · RIDE_HEAD_OFFSET_Z_ON_ANIMAL · RIDE_MAX_STACK · RIDE_PART_CENTER_MARGIN · RIDE_SNAP_DIST · RIDE_Z_DEPTH_K_ON_ANIMAL · _rideAwayP · _rideAwayS · _rideAxisY · _rideFootOff · _rideOff · _rideQC · _rideQD · _rideQP · _rideQR · _rideQSpin · _rideQY · _rideTmp · _rideWP — app.js 는 rideTuneMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwRideTuning — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-ride-tuning.js */
(function(){

function createRideTuning(deps){

/* 🐾 1층 올라타기 — 앵커는 동물의 '발' 이 아니라 '팔' 이다(얼굴 크기를 키우면 모델이 통째로 줄어 팔이 내려가 파묻히므로).
     발 = 머리본 + (대상 머리꼭대기 + RIDE_ARM_SINK) − 팔높이(_rideArmH · 올라탈 때 1회 실측 · 크기 1 기준) */
const RIDE_ARM_SIZE_FOLLOW = 1.0;  // ★ 동물 좌석 크기를 얹힘 높이에 얼마나 반영할지(0~1) — armH 가 크기 1 기준이라 기하학적으로 1.0 이 정답.
                                   //   0 이면 좌석을 줄일수록 파묻히고, 1 보다 크면 뜬다.
/* ★★ sink 세 상수(RIDE_ARM_SINK · RIDE_ARM_SINK_ON_ANIMAL · CIRCUS_FOOT_SINK)는 **대상 크기 1 기준값**이고 적용 시 × 대상 userScale.
   ⚠️ 숫자는 늘 «크기 1 에서 보이는 모습» 으로 맞춘다 — 작은 크기에서 맞춘 값을 박으면 크기 1 이 어긋난다. */
const RIDE_ARM_SINK      = 0.09;   // ★ 팔을 대상 '머리 꼭대기'에 얹는 기준에서의 미세조정(인간 대상, 크기 1 기준).
/* ↑ 머리 꼭대기는 정수리 한 점이고 팔이 닿는 곳은 그보다 낮은 곡면이라 0 이면 묻혀 보인다. 2층+(묘기)는 CIRCUS_FOOT_SINK 가 따로. */
/* ★ 대상이 '동물' 일 때 — 동물은 팔 높이가 전체의 38% 지점이라 인간과 같은 값이면 위로 솟아 떠 보인다. 음수일수록 더 파묻힌다. */
const RIDE_ARM_SINK_ON_ANIMAL = 0.04;   // (크기 1 기준 — 적용 시 × 대상 userScale)
/* 🎪 서커스 묘기 — 2층 이상은 '팔을 걸치는' 대신 '발로 딛고 선다'(대상 머리 꼭대기만 쓰므로 크기 · 귀 유무와 무관). 1층은 팔 걸치기 그대로. */
const CIRCUS_MIN_DEPTH   = 2;      // 이 층수부터 묘기 자세 (1=인간 위 1층도 포함)
/* ★ 발이 대상 머리에 파묻히는 정도(키우면 내려감). ⚠️ 머리 꼭대기 실측(measureHeadBoxNoParts)이 바뀌면 같이 다시 본다. */
const CIRCUS_FOOT_SINK   = 0.02;   // (크기 1 기준 — 적용 시 × 대상 userScale)
const CIRCUS_ARM_SPREAD  = 1.15;   // ★ 균형 잡는 팔 벌림(라디안). 0이면 평소 자세.
const CIRCUS_ARM_DROP    = 0.45;   // ★ 벌린 팔을 아래로 내리는 양(라디안). 벌림 폭은 그대로 두고 높이만 조절.
                                   //   키우면 더 내려가고, 0이면 만세에 가까워진다.
const CIRCUS_SWAY_CALM   = 0.035;  // ★ 평소 흔들림 세기(라디안) — 은은하게.
const CIRCUS_SWAY_PANIC  = 0.22;   // ★ 와해 직전 흔들림 세기 — 눈에 띄게.
const CIRCUS_SWAY_SPEED  = 1.6;    // 흔들림 속도
const CIRCUS_PANIC_SLEEPERS = 1;   // ★ 이 인원 이상이 sleep이면 흔들리기 시작 → 와해
const CIRCUS_PANIC_MS    = 40000;  // ★ 흔들리다 무너지기까지 시간(ms). 이 안에 깨어나면 와해되지 않고 유지.
/* 🎪 와해 직전 '부들부들' — 마지막 구간은 좌우 휘청임을 접고 제자리 잔떨림으로(무너지기 직전이라는 신호).
   TREMOR_AT 은 경과 비율이라 PANIC_MS 를 바꿔도 따라온다. */
const CIRCUS_TREMOR_AT        = 0.75;   // 이 비율만큼 경과하면 잔떨림 구간 진입
const CIRCUS_TREMOR_CALMDOWN  = 0.85;   // 그 구간에서 좌우 휘청임을 얼마나 줄일지(1=거의 멈춤)
const CIRCUS_TREMOR_AMP       = 0.014;  // 잔떨림 폭(라디안) — 작게. 크면 떠는 게 아니라 또 흔들리는 것처럼 보인다
const CIRCUS_TREMOR_SPD       = 34;     // 잔떨림 속도. 휘청임(1.6)보다 훨씬 빨라야 '떤다'로 읽힌다
const CIRCUS_DIZZY_MS    = 2500;   // 무너진 뒤 어지러움 지속(기존 dizzy와 동일)
/* ★ 묘기 자세에서 대상과 정면을 어긋나게 하는 각도 범위(좌석마다 한 번 랜덤). 🚫 CIRCUS_YAW_RANDOM = false 라 지금은 안 쓴다. */
const CIRCUS_YAW_MIN     = Math.PI/12;   // 15도
const CIRCUS_YAW_MAX     = Math.PI/4;    // 45도
/* 🎪 묘기 자세의 랜덤 Y축 회전(요청: 끄고 전부 정면).
   ⚠️ 꺼도 딛는 발은 좌우로 반걸음 치우치고 어느 발인지는 랜덤이다 — 접지점 보정(CIRCUS_FOOT_CENTER)은 켜 둔다. */
const CIRCUS_YAW_RANDOM  = false;
/* ★ 앞뒤 미세조정(2층 이상). 양수=앞으로, 음수=뒤로. 0이면 실측 머리 중심 그대로. */
const CIRCUS_FOOT_Z      = 0;
/* 🦶 '발판' 으로 볼 층의 두께 — 대상 박스 높이에 대한 비율(이 층에 걸치는 메쉬로 앞뒤 중심을 다시 잡는다). 0.2~0.3 이 안전하다. */
const CIRCUS_TOP_SLAB    = 0.25;
/* 🎩 머리 중앙 파츠 위에 얹기 — 파츠 박스가 머리 꼭대기 중심을 좌우 · 앞뒤 양쪽 다 이 비율 이상 덮어야 한다(비율이라 크기와 무관).
   ★ 관리자가 그 파츠에 '얹을 수 있음'(rec.rideTop)을 켠 경우에만 본다. ⚠️ 0 이면 가장자리에 걸친 파츠 위에도 선다. */
const RIDE_PART_CENTER_MARGIN = 0.15;
/* 🦶 위 실측값을 쓸지. false 로 두면 예전처럼 몸 전체 박스 중심을 쓴다(되돌리기용 스위치). */
const CIRCUS_FOOT_Z_FROM_TOP = true;
/* 🦶 딛는 발을 대상 머리 한가운데에 — 한 다리로 서면 접지점이 반걸음 치우치므로, 그 오프셋(ride-measure.js 가 1회 실측)만큼 좌석을 역으로 민다.
   ⚠️ 흔들림(rotateZ)까지 끝난 뒤 적용 · Y 는 안 건드린다(높이는 CIRCUS_FOOT_SINK). 0 이면 예전 동작, 0~1 로 조절. */
const CIRCUS_FOOT_CENTER = 1;
const _rideFootOff = new THREE.Vector3();

const CIRCUS_LEG_STAND   = 0.05;   // ★ 딛는 다리 각도(거의 곧게)
const CIRCUS_LEG_LIFT    = 0.75;   // ★ 드는 다리 각도(뒤로 들어올림)
const CIRCUS_LEG_WAG     = 0.18;   // ★ 든 발 까딱임 폭
const CIRCUS_LEG_WAG_SPD = 3.2;    // ★ 든 발 까딱임 속도
const RIDE_HEAD_OFFSET_Z = -0.3;   // ★ 1층(인간 머리 위) 앞뒤 보정. 음수=뒤로(머리 안쪽), 양수=앞으로.
const RIDE_HEAD_OFFSET_Z_ON_ANIMAL = -0.07;  // ★ 1층 중 '동물 머리 위'일 때의 앞뒤 보정 — 동물은 머리가 얇아 인간 값이면 뒤로 밀린다.
/* ★ 동물 대상 1층 앞뒤 — 박스 깊이에 대한 비율로 뒤로 민다(인간이 정상일 때의 깊이 대비 비율 0.345 를 그대로). 키우면 뒤로. */
const RIDE_Z_DEPTH_K_ON_ANIMAL = 0.345;
/* 🎪 2층 이상 동물 대상 앞뒤 — 몸 박스 중심에서 앞으로 당기는 비율. 1층 값과 부호가 반대라 따로 둔다(1층은 뒤로 · 2층은 머리 쪽으로).
   ★ 꼭대기 발판 실측(_headTopCenterZ)이 아무것도 못 골랐을 때(통메쉬 모델)만 쓴다. 뒤에 서면 키우고, 앞으로 튀어나오면 줄인다. */
const CIRCUS_Z_DEPTH_K_ON_ANIMAL = 0.28;
const RIDE_HEAD_OFFSET_Y = 0.35;   // 폴백 전용 — 손 본을 못 찾아 팔높이 실측이 실패했을 때만 쓰는 예전 방식 값.
const RIDE_FOLLOW_HEAD_TILT = true;   // true=고개 기울임까지 따라 기울어짐. 어색하면 false(위치만 따라감)
const RIDE_SNAP_DIST = 1.1;        // 이 거리(월드) 안에서 놓으면 흡착
const _rideWP = new THREE.Vector3(), _rideTmp = new THREE.Vector3(), _rideOff = new THREE.Vector3();
const _rideAwayP = new THREE.Vector3(), _rideAwayS = new THREE.Vector3();   // 🫧 대상이 자리비움 그림일 때 그 그림의 월드 위치·크기
const _rideQD = new THREE.Quaternion(), _rideQP = new THREE.Quaternion(), _rideQR = new THREE.Quaternion();
const _rideQC = new THREE.Quaternion(), _rideQY = new THREE.Quaternion();
const _rideAxisY = new THREE.Vector3(0,1,0);
const _rideQSpin = new THREE.Quaternion();   // 🌀 대상의 '제자리 회전 춤'을 위층에 전달할 때 쓰는 임시값

const RIDE_MAX_STACK = 4;   /* ★ 탑쌓기 최대 층수(맨 아래 대상 제외) — 인원이 아니라 '화면 위로 나가지 않는 높이' 기준. */

return {
  CIRCUS_ARM_DROP,
  CIRCUS_ARM_SPREAD,
  CIRCUS_DIZZY_MS,
  CIRCUS_FOOT_CENTER,
  CIRCUS_FOOT_SINK,
  CIRCUS_FOOT_Z,
  CIRCUS_FOOT_Z_FROM_TOP,
  CIRCUS_LEG_LIFT,
  CIRCUS_LEG_STAND,
  CIRCUS_LEG_WAG,
  CIRCUS_LEG_WAG_SPD,
  CIRCUS_MIN_DEPTH,
  CIRCUS_PANIC_MS,
  CIRCUS_PANIC_SLEEPERS,
  CIRCUS_SWAY_CALM,
  CIRCUS_SWAY_PANIC,
  CIRCUS_SWAY_SPEED,
  CIRCUS_TOP_SLAB,
  CIRCUS_TREMOR_AMP,
  CIRCUS_TREMOR_AT,
  CIRCUS_TREMOR_CALMDOWN,
  CIRCUS_TREMOR_SPD,
  CIRCUS_YAW_MAX,
  CIRCUS_YAW_MIN,
  CIRCUS_YAW_RANDOM,
  CIRCUS_Z_DEPTH_K_ON_ANIMAL,
  RIDE_ARM_SINK,
  RIDE_ARM_SINK_ON_ANIMAL,
  RIDE_ARM_SIZE_FOLLOW,
  RIDE_FOLLOW_HEAD_TILT,
  RIDE_HEAD_OFFSET_Y,
  RIDE_HEAD_OFFSET_Z,
  RIDE_HEAD_OFFSET_Z_ON_ANIMAL,
  RIDE_MAX_STACK,
  RIDE_PART_CENTER_MARGIN,
  RIDE_SNAP_DIST,
  RIDE_Z_DEPTH_K_ON_ANIMAL,
  _rideAwayP,
  _rideAwayS,
  _rideAxisY,
  _rideFootOff,
  _rideOff,
  _rideQC,
  _rideQD,
  _rideQP,
  _rideQR,
  _rideQSpin,
  _rideQY,
  _rideTmp,
  _rideWP,
};
}

const api = { createRideTuning };
if(typeof window !== 'undefined') window.TwRideTuning = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
