/* flying-chair.js — 🪑 플라잉체어 — 날릴 수 있는가 · 날기 시작 · 비행 상수 · 비행 중 수(앱 FSD · app.js 분리 M18)
   app.js 의 «플라잉체어» 구역(FLY_* 상수 · 시드 난수 · canFly · startFlight · 비행 중 수 _flyActive)을 글 그대로 옮긴 모듈이다. 동작은 옛 자리와 같다.
   ・책임: FLY_*(비행 시간 · 속도 · 각도 · 벽 · 해금 레벨 · 연속 · 쉬는 시간) · _flyRng(시드 난수 — 같은 시드면 같은 궤적) · flySeed · canFly(좌석을 날릴 수 있는가) · startFlight(날기 시작 — seat.fly 를 채우고 _flyActive 를 올림) · _flyActive(지금 날고 있는 좌석 수 — 프레임 상한이 비행 동안만 비켜 간다).
   ・내놓는 것: 상수 · flySeed · canFly · startFlight(값 · 함수 — app.js 는 같은 이름 const 로 받는다) · _flyActive(읽는 함수) · setFlyActive(쓰는 함수 — 나는 쪽 프레임 루프가 내린다).
   ⚠️ 이 안에서 Math.random() 을 부르지 않는다(flySeed 만) — 궤적은 시드 하나로 정해져야 남의 화면에서도 같다. 비행을 매 프레임 움직이는 쪽은 프레임 루프(launcher/frame-loop.js).
   검사: checks/sim-flying-chair.js */
(function(){

function createFlyingChair(deps){
const seats = deps.seats;
const toast = deps.toast;   // 함수
/* ═══════════════════════════ 🪑 플라잉체어 ═══════════════════════════
   💣 를 누르면 캐릭터가 자리에서 튀어나가 화면 가장자리에 튕기다 돌아온다.

   ★ 의자·책상은 자리에 남고 **캐릭터(rig)만** 날아간다.
     seat.group 에는 책상(desk)과 캐릭터(rig)가 함께 들어 있다. group 을 옮기면 책상까지
     따라가고, layoutSeats 가 잡아 둔 자리(targetX)와도 싸우게 된다. 그래서 rig 만 건드린다.
     — 흔들기(beingShaken)가 이미 같은 방식이다.

   ★ 벽 판정은 **화면 좌표(NDC)** 로 한다. 월드 좌표로 경계를 잡으면 카메라 줌이 인원수마다
     달라지므로(applyCameraAndCanvas) 2명일 때와 8명일 때 튕기는 자리가 달라진다.
     매 프레임 캐릭터를 카메라에 투영해서 화면 밖으로 나가려 할 때만 속도를 뒤집는다.

   ★ 아래 경계(yLo)만 시작 위치 기준으로 잡는다. 위·좌·우는 화면 끝이지만 아래로는 책상 줄이
     있어서, 화면 끝까지 내려가면 남의 책상을 뚫고 지나간다.

   ★ 궤적은 **시드 하나로 정해진다.** 지금은 내 화면에서만 도는 로컬 기능이지만, 남에게
     전파할 때 {from,to,seed} 만 실어 보내면 모든 화면이 같은 궤적을 그린다.
     ⚠️ 그래서 이 안에서 Math.random() 을 부르면 안 된다 — 반드시 _flyRng(seed) 를 쓸 것.

   ⚠️ 이름표·경험치 바는 seat.group 기준으로 찍히므로 **책상 자리에 그대로 남는다.**
     흔들기도 같은 동작이라 일부러 맞춰 뒀다. 캐릭터를 따라가게 하려면 setSeatNamePlate 의
     기준을 group → rig 로 바꿔야 하는데, 그건 흔들기·올라타기 표시까지 같이 바뀌는 변경이다. */
const FLY_MS        = 10000;   // 비행 시간(ms)
const FLY_SPEED     = 9.5;     // 기준 속도(월드 단위/초). 좌석 하나가 대략 1.7 단위다
const FLY_SPEED_VAR = 0.2;     // 개체차 ±20% — 시드에서 뽑는다(Math.random 아님)
/* 발사 각도(수평에서 잰 도) — **사선 대역만** 쓴다.
   위쪽 반원 전체에서 뽑으면 90°에 가까운 각이 섞여 "위로 솟았다 그대로 내려오는" 판이 나오고,
   0°에 가까운 각은 옆으로만 미끄러진다. 둘 다 튕기는 맛이 없어서 가운데 대역만 남겼다. */
const FLY_ANG_MIN   = 32;
const FLY_ANG_MAX   = 58;
const FLY_SPIN      = 3.2;     // 회전 속도(라디안/초)
const FLY_EDGE_X    = 0.90;    // 좌우 벽(NDC)
const FLY_EDGE_TOP  = 0.90;    // 위 벽(NDC)
const FLY_DROP      = 0.18;    // 아래 벽 = 시작 지점보다 이만큼만 아래(NDC). 책상 줄을 안 뚫게
const FLY_RETURN_MS = 450;     // 자리로 돌아오는 시간
const FLY_DIZZY_MS  = 2500;    // 착지 후 어지러움 — 흔들기 dizzy 와 같은 값
/* 🎯 남을 날리기 — 해금·연속·쉬는 시간
   ★ 연속 횟수를 세는 것은 **맞는 쪽**이다. 던지는 쪽에서 세면 B·C·D 가 각각 따로 세어
     "방 인원이 A 를 연속 3번" 이라는 규칙 자체가 성립하지 않는다.
   ⚠️ FLY_STREAK_MS('연속'이 무엇으로 끊기는가)는 **아직 확정된 규칙이 아니다.** 지금은
     시간으로만 끊는다. "다른 사람이 맞으면 초기화" 안은 넣지 않았다 — 그러려면 방 전원의
     피격을 각자가 알아야 해서 전파가 한 겹 더 늘어난다. 30초를 써 보고 정할 것. */
const FLY_MIN_LEVEL = 100;     // 💣 해금 레벨 (포커싱 어플로 쌓은 레벨)
const FLY_STREAK    = 3;       // 이만큼 연속으로 맞으면 쉬어간다
const FLY_STREAK_MS = 30000;   // 마지막 피격 후 이 시간이 지나면 연속이 끊긴다
const FLY_COOL_MS   = 60000;   // 쉬는 시간 — 이 동안은 표적이 되지 않는다

/* 시드 난수(mulberry32) — 같은 시드면 언제 어디서 돌려도 같은 수열 */
function _flyRng(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function flySeed(){ return (Math.random() * 0xFFFFFFFF) >>> 0; }
/* 지금 날고 있는 좌석 수. frame() 의 비포커스 프레임 상한(FrameBudget.FPS_UNFOCUSED)을 비행 동안만
   비켜 가는 데 쓴다 — 20fps 로는 빠르게 튕기는 움직임이 뚝뚝 끊겨 보인다.
   ★ seats 를 매 프레임 훑지 않고 세어 두는 이유: 이 값은 상한 검사보다 **먼저** 읽히고,
     그 검사는 rAF 가 올 때마다(초 60회) 돈다. */
let _flyActive = 0;
/* 지금 이 좌석을 날릴 수 있는가. 여기서 걸러지는 것이 곧 규칙이다.
   ★ 막는 이유가 전부 "그 좌석의 위치를 이미 다른 코드가 매 프레임 정하고 있다"는 것이다.
     올라타기(_updateRideChains)·벤치·흔들기가 그렇다. 둘이 같이 돌면 캐릭터가 두 좌표
     사이에서 떨린다. */
/* 🗼 allowTower — [2026-09-23 요청 · A안] 룰렛·🎲 로 **나를** 날릴 때는 탑 안에 있어도 된다.
   날리기 **직전에** 탑에서 뺀다(_rideLeaveTower · applyRemoteFly). 탑 계산과 비행이 같이 도는 일은 여전히 없다.
   ★ 💣(남을 겨눔)은 지금처럼 막는다 — 표적 판정(_flyTargetCheck)은 이 인자를 안 넘긴다. */
function canFly(seat, allowTower){
  if(!seat)                                    return {ok:false, why:'좌석이 없어요'};
  if(seat.fly)                                 return {ok:false, why:'이미 날아가는 중이에요'};
  if(seat.isPlaceholder)                       return {ok:false, why:'아직 캐릭터가 없어요'};
  if(seat.inPreview)                           return {ok:false, why:'미리보기 중에는 안 돼요'};
  if(seat.beingShaken || seat.pinned)          return {ok:false, why:'지금은 날릴 수 없어요'};
  if(!allowTower && (seat.ridingOn || seats.some(s=>s.ridingOn===seat)))
                                               return {ok:false, why:'올라타 있는 동안에는 못 날아가요'};
  if(seat.seatedOn || seat._benchOwnerSit)     return {ok:false, why:'벤치에 앉아 있을 땐 못 날아가요'};
  return {ok:true};
}

/* 날리기 시작. seed 를 안 주면 새로 뽑는다(전파할 때는 뽑은 값을 같이 실어 보낼 것).
   quiet=true 면 실패해도 토스트를 안 띄운다 — 남의 화면에서 재생하는 경로에서 쓴다.
   (던진 사람의 화면에도 같은 방송이 돌아오는데, 거기서 "이미 날아가는 중" 토스트가 뜨면 곤란하다) */
function startFlight(seat, seed, quiet){
  const c = canFly(seat);
  if(!c.ok){ if(!quiet) toast(c.why); return false; }
  seed = (seed == null) ? flySeed() : (seed >>> 0);
  const r = _flyRng(seed);
  /* 방향만 무작위이고 **속력은 항상 spd** 다.
     예전엔 전방위에서 각도를 뽑고 위로 뜨는 힘을 따로 더했는데, 아래로 뽑힌 각도에서 두 항이
     서로 상쇄돼 실제 속력이 절반 이하로 떨어졌다 — 어떤 판은 휙 날고 어떤 판은 굼떴다. */
  const side = (r() < 0.5) ? -1 : 1;                                     // 왼쪽/오른쪽
  const deg  = FLY_ANG_MIN + r() * (FLY_ANG_MAX - FLY_ANG_MIN);          // 수평에서 잰 올라가는 각
  const ang  = deg * Math.PI / 180;
  const spd  = FLY_SPEED * (1 - FLY_SPEED_VAR + r() * FLY_SPEED_VAR * 2);
  seat.fly = {
    seed, t0: performance.now(), dur: FLY_MS, phase: 'air',
    x: 0, y: 0,
    vx: side * Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,                     // 대역이 위쪽이라 언제나 양수
    spin: (r() < 0.5 ? -1 : 1) * FLY_SPIN * (0.7 + r() * 0.6),
    yLo: null,                                   // 아래 경계 — 첫 프레임에 시작 위치를 재서 정한다
    probeY: null,                                // 몸통 중심 높이 — 첫 프레임에 실측
    fromX: 0, fromY: 0, backAt: 0
  };
  _flyActive++;
  return true;
}

return {
  FLY_MS,
  FLY_EDGE_X,
  FLY_EDGE_TOP,
  FLY_DROP,
  FLY_RETURN_MS,
  FLY_DIZZY_MS,
  FLY_MIN_LEVEL,
  FLY_STREAK,
  FLY_STREAK_MS,
  FLY_COOL_MS,
  flySeed,
  _flyActive: ()=>_flyActive,
  setFlyActive: (v)=>{ _flyActive = v; },
  canFly,
  startFlight,
};
}

const api = { createFlyingChair };
if(typeof window !== 'undefined') window.TwFlyingChair = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
