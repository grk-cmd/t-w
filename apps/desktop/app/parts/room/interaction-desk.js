/* interaction-desk.js — 🪑 상호작용 책상 카탈로그(INTERACTION_DESKS) · 💃 춤 목록(DANCE_MOVES) · 🌀 재주 자세 상수 · 🐾 올라탈 대상 찾기
   app.js «🪑 상호작용 책상 카탈로그(INTERACTION_DESKS)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 43번 — docs/APP_FSD_MAP.md).
   한 구역에 섞여 있던 춤 · 재주 · 올라타기 도우미도 같이 왔다 — 도메인 폴더로 나눌 때(구조 정리 3단계) 가른다.
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 10줄 —
     Presence · focusLevelMod · isAdmin 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 1개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: DANCE_MOVES · IDESK_ENABLED · INTERACTION_DESKS · TRICK_IN_S · TRICK_SPIN_S · TRICK_TURBO_STYLE · _danceCmdCooldownAt · _deskDefById · _lowestDanceReq · _parseDanceCmdChain · _pickUnlockedDance · _rideDenyToastAt · _trickArmBase · _trickArmSpread · _trickEaseIn · _trickLegPose · _trickTurns · findRideTarget · getActiveInteractionDeskId · isDanceUnlocked · isDeskUnlocked · setActiveInteractionDeskId · startMyDance — app.js 는 iDeskMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwInteractionDesk — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-interaction-desk.js */
(function(){

function createInteractionDesk(deps){
const CIRCUS_ARM_DROP = deps.CIRCUS_ARM_DROP;
const CIRCUS_LEG_LIFT = deps.CIRCUS_LEG_LIFT;
const CIRCUS_LEG_STAND = deps.CIRCUS_LEG_STAND;
const Presence = deps.Presence;   // 읽는 함수
const RIDE_MAX_STACK = deps.RIDE_MAX_STACK;
const RIDE_SNAP_DIST = deps.RIDE_SNAP_DIST;
const _rideTmp = deps._rideTmp;
const _rideWP = deps._rideWP;
const focusLevelMod = deps.focusLevelMod;   // 읽는 함수
const isAdmin = deps.isAdmin;   // 읽는 함수
const rideBenchMod = deps.rideBenchMod;
const seats = deps.seats;
const toast = deps.toast;
const tricksMod = deps.tricksMod;
const INTERACTION_DESKS = [
  // seats: 좌석 수, reqLevel: 해금 레벨, glb/thumb: 번들 경로(준비되면 채움)
  { id:'bench2', name:'2인 벤치', seats:2, reqLevel:80, glb:null, thumb:null },
  // 예: { id:'table3', name:'3인 테이블', seats:3, reqLevel:90, glb:'assets/desks/table3.glb', thumb:'assets/desks/table3.png' },
];
// ⏸️ 상호작용 책상(I키 인벤토리) 기능 플래그 — 이번 릴리스 비활성화, 다음 업데이트에 true로.
const IDESK_ENABLED = false;

/* 💃 춤(이모트) 명령 — 투게더룸 채팅에서 해금 레벨을 명령어로 입력(/60 /80 /100).
   절차적 애니메이션(GLB 클립 불필요, 서버 비용 0). seatState가 'dance'를 반환하는 동안 재생되고,
   내 상태 전파(setState)를 그대로 타서 친구 화면의 내 캐릭터도 함께 춤춘다.
   해금: 내 레벨 ≥ reqLevel(관리자는 전부). style은 애니메이션 변형 여지용(지금은 sway 하나). */
const DANCE_MOVES = [
  /* egg — 같은 명령을 세 번 쓸 때 일어나는 일(💃💥 깜짝쇼). 'fly'=전원 폭발, 'turbo'=회전 두 배.
     빼면 그 명령은 세 번 써도 평범한 춤이다. 한 명령에 두 종류를 겹칠 수 없다. */
  { cmd:'80', reqLevel:80, name:'살랑살랑', dur:6000, style:'sway', egg:'fly' },
  /* 🤸 묘기 회전 — 한 발 서기 자세를 잡고 그 자리에서 **정확히 5바퀴** 돈 뒤 처음 방향으로 돌아온다.
     ★ dur 은 아래 TRICK_* 세 구간의 합이다(0.2 + 5.1 + 0.7 = 6.0초). 한쪽만 고치면 회전이 덜
       끝난 채 춤이 끝나거나, 다 돌고 나서 멀뚱히 서 있는 시간이 생긴다.
     ★ `/150` 을 세 번 쓰면 같은 6초 안에 **10바퀴**를 돈다(터보) — 시간이 아니라 바퀴 수가 두 배다. */
  { cmd:'150', reqLevel:150, name:'묘기 회전', dur:6000, style:'trick', egg:'turbo' },
  // ⏸️ 잠금(다음 업데이트에 공개) — 되살리려면 주석 해제. 애니메이션(spin/tantrum)은 코드에 그대로 있음.
  // { cmd:'80', reqLevel:80, name:'발레턴', dur:6000, style:'spin' },
  // { cmd:'100',reqLevel:100,name:'떼쓰기', dur:7000, style:'tantrum' },
];
/* 🤸 묘기 회전 구간(초) — 자세 잡기 · 회전 · 복귀. 위 dur(6000ms)과 반드시 짝이다.
   ★ 자세 잡기는 **짧게**(0.2초) 둔다 — 팔을 좌우로 뻗자마자 바로 돌기 시작하는 것이 사양이다.
     늘리면 벌리는 동작이 길어지면서 "뜸 들이다 돈다"가 된다. 늘릴 때는 SPIN 을 그만큼 줄여
     세 값의 합을 6.0초로 유지할 것.
   ★ 시간만 줄이면 부족하다 — 이 구간을 선형으로 훑으면 짧아도 "스르륵"으로 읽힌다.
     실제 템포는 `_trickEaseIn` 의 곡선이 만든다(앞쪽에 몰아친다). */
const TRICK_IN_S    = 0.2;
const TRICK_SPIN_S  = 5.1;
const TRICK_OUT_S   = 0.7;
const TRICK_TURNS   = 5;      // ★ 시간이 아니라 **횟수**로 돈다 — 그래서 시작 방향으로 정확히 돌아온다
/* 🌀 터보(`/150`×3) — 같은 6초 안에 바퀴 수만 두 배(10바퀴). 구간 시간은 건드리지 않는다.
   ★ 스타일 문자열을 따로 두는 이유: 춤 전파가 `dance:스타일` 한 칸이라, 스타일만 바꾸면
     친구 화면도 그대로 두 배로 돈다(새 필드·새 규칙 없음). 받는 쪽 DANCE_MOVES 에는 이 스타일이
     없어서 dur 은 기본값 6000 이 되는데, 원래 값과 같아서 문제가 없다.
   ★ 배수는 정수여야 한다 — 2π 의 배수로 끝나야 시작 방향으로 정확히 돌아온다. */
const TRICK_TURBO_STYLE = 'trickx2';
const TRICK_TURBO_MULT  = 2;
/* 이 스타일은 몇 바퀴인가 — 애니메이션이 이 한 곳에서만 바퀴 수를 가져간다(검증기도 여기를 본다). */
function _trickTurns(style){ return TRICK_TURNS * (style === TRICK_TURBO_STYLE ? TRICK_TURBO_MULT : 1); }
/* 🦵 든 다리를 **옆으로** 뻗는 각(Z축). 값 크기는 탑쌓기와 같지만 축이 다르다 — 탑쌓기는 남의 머리
   위에서 균형을 잡느라 뒤로 들고(X축), 묘기 회전은 정면에서 보이는 자세라 옆으로 뻗는다.
   ★ 상수를 따로 둔 이유가 이것이다. CIRCUS_LEG_LIFT 를 건드리면 탑쌓기 자세까지 같이 바뀐다. */
const TRICK_LEG_SIDE = CIRCUS_LEG_LIFT;
/* 💪 뻗은 팔 높이 — **여기 한 숫자만** 만지면 된다. 양수 = 조금 올림, 0 = 탑쌓기와 같은 높이.
   ★ 부호 주의: 팔의 X축은 **음수가 위**다(예전 만세 자세가 -1.55 였다). 그래서 올릴 때는 뺀다.
   ★ 어림값 — 0.10 ≈ 6°, 0.18 ≈ 10°(지금), 0.35 ≈ 20°. 0.5 를 넘기면 다시 만세로 읽히기 시작한다.
   ★ 벌림 폭(CIRCUS_ARM_SPREAD)과는 별개다 — 높이만 바뀌고 좌우로 뻗은 정도는 그대로다.
   ★ 이 값은 탑쌓기와 공유하지 않는다. 탑 위 자세는 CIRCUS_ARM_DROP 그대로다. */
const TRICK_ARM_LIFT = 0.18;
/* ↔️ 뻗은 팔 벌림 — **최종 각도 그 자체**(라디안). 다른 상수에 더하지 않으니 이 숫자만 보면 된다.
   [왜 바꿨나] 예전엔 CIRCUS_ARM_SPREAD 에 더하는 '넓히는 양'이었다. 그러면 0.15 를 0.05 로 줄여도
     실제 각도는 1.30 → 1.20 이라 4° 밖에 안 움직여서 "바꿔도 그대로"로 보인다. 지금은 여기 적은
     값이 곧 각도다.
   ★ 눈금 — 0.6 ≈ 34°(몸에 붙음) · 0.9 ≈ 52° · 1.15 ≈ 66°(탑쌓기와 같음) · 1.2 ≈ 69°(지금)
     · 1.4 ≈ 80° · **1.57(π/2) = 완전한 수평**. 넘기면 어깨선 위로 꺾여 다시 만세로 보인다.
   ★ 눈에 띄게 바꾸려면 0.15 이상(≈9°) 움직일 것. 0.02~0.05 는 화면에서 구분이 안 된다.
   ★ 높이(TRICK_ARM_LIFT)와는 별개다 — 폭만 바뀌고 올린 높이는 그대로다.
   ★ 탑쌓기(CIRCUS_ARM_SPREAD)와는 이제 완전히 분리돼 있다. 그쪽 자세는 따라 움직이지 않는다.
   ⚠️ 고쳤는데 화면이 그대로면 상수가 아니라 **파일이 안 실린 것**을 먼저 의심할 것.
     개발자도구 콘솔에 `TRICK_ARM_SPREAD` 를 쳐서 지금 실린 값이 무엇인지 확인하면 바로 갈린다. */
const TRICK_ARM_SPREAD = 1.5;
/* 뻗은 팔의 X각 — 애니메이션이 이 한 곳에서만 가져간다(검증기도 여기를 본다).
   ★ 탑 위에서 춤을 추면 base 에 CIRCUS_ARM_DROP 이 이미 더해져 있다 — 두 번 더하지 않는다. */
function _trickArmBase(base, circusOn, e){
  return base + (circusOn ? 0 : CIRCUS_ARM_DROP * e) - TRICK_ARM_LIFT * e;
}
/* 뻗은 팔의 벌림(Z각) — 애니메이션이 이 한 곳에서만 가져간다(검증기도 여기를 본다).
   ★ 수평(π/2)을 넘지 않게 막아 둔다. 상수를 크게 잡아도 팔이 어깨선 위로 꺾이지 않는다. */
function _trickArmSpread(e){
  return Math.min(Math.PI/2, TRICK_ARM_SPREAD) * e;
}
/* ⚡ 자세 잡기 템포 — 0→1 을 **앞쪽에 몰아서** 훑는다(1-(1-p)³). 첫 프레임에 이미 절반 넘게
   벌어지고 나머지가 짧게 잦아든다. 선형이면 같은 0.2초라도 "스르륵 벌어진다"로 읽힌다.
   ★ 팔·다리·몸 높이가 **모두 이 값 하나**를 쓴다 — 따로 쓰면 팔만 먼저 서고 다리가 늦게 따라온다. */
function _trickEaseIn(dt){
  const p = Math.min(1, Math.max(0, dt / TRICK_IN_S));
  return 1 - Math.pow(1 - p, 3);
}
/* 🦵 한 발 서기 — 딛는 발은 X축으로 거의 곧게, 든 발은 **Z축으로 옆으로**. 든 발의 X 는 0 이다
   (0 이 아니면 옆으로 뻗으면서 동시에 뒤로도 들려 비스듬해진다).
   ★ 부호 — 왼발은 -, 오른발은 + 로 각자 자기 쪽으로 나간다(팔과 같은 관례). 반대로 꺾이면 부호만 뒤집을 것. */
function _trickLegPose(standLeft, e){
  const stand = CIRCUS_LEG_STAND * e, side = TRICK_LEG_SIDE * e;
  return standLeft
    ? { legL:{ x:stand, z:0 }, legR:{ x:0, z: side } }
    : { legL:{ x:0, z:-side }, legR:{ x:stand, z:0 } };
}
function _danceByCmd(cmd){ return DANCE_MOVES.find(d=>d.cmd===cmd) || null; }
/* 🔗 춤 명령 한 줄 파싱 — `/80` 하나도, `/80/80/80` 이어쓰기도 여기서 받는다.
   돌려주는 repeat 이 곧 깜짝쇼 카운트다(`/80/80/80` → 3).
   ★ 섞인 줄(`/80/150`)과 춤이 아닌 숫자(`/999`)는 null 이다 — 예전처럼 평범한 채팅으로 흘러간다.
     '전부 같은 명령'을 여기서 닫아 두지 않으면, 아무 숫자나 이어 붙여도 터지게 된다. */
function _parseDanceCmdChain(text){
  if(typeof text !== 'string' || !/^(?:\/\d{1,3})+$/.test(text)) return null;
  const parts = text.slice(1).split('/');
  if(!parts.every(c => c === parts[0])) return null;
  const def = _danceByCmd(parts[0]);
  return def ? { def, cmd: parts[0], repeat: parts.length } : null;
}
let _danceCmdCooldownAt = 0;   // ⏳ 춤 명령 개인 쿨다운(10초) 타임스탬프
function isDanceUnlocked(def){
  if(!def) return false;
  if(typeof isAdmin()!=='undefined' && isAdmin()) return true;
  const lv=(typeof focusLevelMod().getFocusLevel==='function')?focusLevelMod().getFocusLevel():1;
  return lv >= (def.reqLevel||1);
}
/* 🎲 춤추기 버튼용 — **해금된 춤 중 하나를 무작위로** 고른다. 하나도 없으면 null.
   ★ 레벨이 오를수록 나올 수 있는 춤이 저절로 늘어난다. DANCE_MOVES 에 항목을 더하면
     여기도 자동으로 따라오므로, 새 춤을 넣을 때 이 함수는 건드릴 필요가 없다.
   ★ rnd 를 받는 이유는 검증기에서 순서를 고정해 돌리기 위해서다(평소엔 Math.random).
   ★ 명령(/80)과 달리 버튼은 **깜짝쇼를 세지 않는다** — startMyDance 에 cmd 를 넘기지 않는다.
     무작위로 뽑힌 춤이 남을 날려 버리면 누른 사람 입장에서는 사고다. */
function _pickUnlockedDance(rnd){
  const pool = DANCE_MOVES.filter(isDanceUnlocked);
  if(!pool.length) return null;
  const r = (typeof rnd === 'function') ? rnd() : Math.random();
  return pool[Math.max(0, Math.min(pool.length - 1, Math.floor(r * pool.length)))];
}
/* 아직 아무것도 못 여는 사람에게 보여줄 '가장 가까운 해금 레벨'. 안내 문구가 실제 표와 어긋나지 않게 표에서 뽑는다. */
function _lowestDanceReq(){
  return DANCE_MOVES.reduce((m, d)=>Math.min(m, d.reqLevel||1), Infinity) || 80;
}
/* 💃 내 춤 시작 — 내 좌석에 danceUntil을 세우고 상태 전파를 즉시 밀어 친구 화면에도 반영.
   재입력하면 시간 갱신(계속 추기). 이동/흔들기 중엔 seatState가 다른 상태를 우선하므로 자연히 중단됨. */
function startMyDance(def, opts){
  try{
    const me = (typeof seats!=='undefined') && seats.find(s=>s.isMe);
    if(!me) return;
    /* 💃💥 깜짝쇼 판정을 **춤을 세우기 전에** 한다 — 터보는 스타일 자체가 바뀌기 때문이다.
       ★ 어떤 깜짝쇼인지는 명령이 정한다(DANCE_MOVES 의 egg): /80 은 폭발('fly'), /150 은 터보('turbo').
       ★ opts.cmd 가 없으면(춤추기 버튼) 세지 않는다 — 버튼으로는 터지지 않는 것이 사양이다.
         부르는 쪽에서 cmd 를 넘기지 않으면 조용히 평범한 춤이 된다. */
    const eggKind = (def && def.egg) || null;
    const eggHit  = !!(eggKind && tricksMod._eggReadyFor(eggKind)
                       && tricksMod._eggCountCmd(opts && opts.cmd, opts && opts.repeat));
    const style = (eggHit && eggKind === 'turbo') ? TRICK_TURBO_STYLE : (def.style || 'sway');
    const dur = def.dur||6000;
    me.danceUntil = performance.now() + dur;
    me.danceStyle = style;   // 💃 스타일 저장 — animateRig가 분기, 페이로드로 친구에게도 전달
    const _inRoom = (typeof Presence()!=='undefined' && Presence().active());
    toast('💃 '+(_inRoom ? '다 같이 ' : '')+(def.name||'춤')+' !');
    // 상태 전파 즉시 — 다음 프레임 루프가 setState('dance')로 밀어주지만, 반응성을 위해 한 번 당겨줌.
    //   댄스배틀(춤 교체) 때는 state가 이미 'dance'라 setState가 no-op → broadcastRide로 스타일 변경을 반드시 밀어줌.
    if(typeof Presence()!=='undefined' && Presence().active()){
      if(Presence().setState) Presence().setState('dance');
      if(Presence().broadcastRide) try{ Presence().broadcastRide(); }catch(_){}
    }
    // 🕺 방 전원 동참 — 방의 각 친구를 poke('dance:스타일')로 찔러 각자 화면에서 그 캐릭터도 춤추게.
    //   (머리 위에 얹은 동물(ridingOn)은 수신 측에서 건너뛰어 타고 있는 자세 그대로 유지)
    /* 💥 폭발 깜짝쇼(/80×3)면 **춤 대신 폭발을 보낸다.** 나는 위에서 이미 춤을 시작했다.
       ★ 춤 poke 와 같이 보내지 않는다. 한 칸짜리 poke 자리를 두 값이 다투게 되고, 그러면
         받는 쪽에서 어느 쪽이 살아남을지가 배달 순서에 달린다 — 그건 예전에 고친 그 사고다.
       ★ 터보(/150×3)는 반대로 **평소 경로를 그대로 탄다** — 스타일 문자열 하나만 바뀌므로
         친구 화면도 같이 두 배로 돈다. poke 값이 두 개가 되지 않는다. */
    if(eggHit && eggKind === 'fly'){ tricksMod._eggFire(); return; }
    if(typeof Presence()!=='undefined' && Presence().active() && Presence().poke){
      seats.filter(s=>s.remote && s.friendId).forEach(s=>{
        if(s.ridingOn) return;                 // 남의 머리에 타고 있는 동물은 제외
        Presence().poke(s.friendId, 'dance:'+style);
      });
    }
  }catch(_){}
}
function _deskDefById(id){ return INTERACTION_DESKS.find(d=>d.id===id) || null; }
// 이 책상이 해금됐나 — 레벨 충족 or 관리자.
function isDeskUnlocked(def){
  if(!def) return false;
  if(typeof isAdmin()!=='undefined' && isAdmin()) return true;
  const lv = (typeof focusLevelMod().getFocusLevel==='function') ? focusLevelMod().getFocusLevel() : 1;
  return lv >= (def.reqLevel||1);
}
// 현재 내가 쓰는 상호작용 책상 id(교체 방식) — localStorage 보관.
const ACTIVE_IDESK_KEY = 'tw.activeInteractionDesk';
function getActiveInteractionDeskId(){ try{ return localStorage.getItem(ACTIVE_IDESK_KEY) || null; }catch(_){ return null; } }
function setActiveInteractionDeskId(id){ try{ if(id) localStorage.setItem(ACTIVE_IDESK_KEY, id); else localStorage.removeItem(ACTIVE_IDESK_KEY); }catch(_){} }

/* 🐾 "남의 캐릭터는 못 올려요" 토스트 스로틀 — 드래그를 연달아 시도해도 토스트가 쌓이지 않게. */
let _rideDenyToastAt = 0;
function findRideTarget(animalSeat){
  if(!animalSeat) return null;
  animalSeat.rig.getWorldPosition(_rideTmp);
  let best=null, bestD=RIDE_SNAP_DIST;
  seats.forEach(h=>{
    // 탑쌓기: 이미 탄 좌석도 후보. 단 내 위에 있는 좌석(순환)·층수 초과는 제외.
    if(h===animalSeat) return;
    if(rideBenchMod._rideIsAbove(h, animalSeat)) return;
    if(rideBenchMod._rideDepth(h) + 1 > RIDE_MAX_STACK) return;
    const src=(h.bones && h.bones.head) ? h.bones.head : h.headAnchor;
    if(!src) return;
    src.getWorldPosition(_rideWP);
    const d=_rideWP.distanceTo(_rideTmp);
    if(d<bestD){ bestD=d; best=h; }
  });
  return best;
}

return {
  DANCE_MOVES,
  IDESK_ENABLED,
  INTERACTION_DESKS,
  TRICK_IN_S,
  TRICK_SPIN_S,
  TRICK_TURBO_STYLE,
  _danceCmdCooldownAt: ()=>_danceCmdCooldownAt,   // 읽는 함수
  setDanceCmdCooldownAt: (v)=>{ _danceCmdCooldownAt = v; },   // 쓰는 함수 — app.js 가 비운다
  _deskDefById,
  _lowestDanceReq,
  _parseDanceCmdChain,
  _pickUnlockedDance,
  _rideDenyToastAt: ()=>_rideDenyToastAt,   // 읽는 함수
  setRideDenyToastAt: (v)=>{ _rideDenyToastAt = v; },   // 쓰는 함수 — app.js 가 비운다
  _trickArmBase,
  _trickArmSpread,
  _trickEaseIn,
  _trickLegPose,
  _trickTurns,
  findRideTarget,
  getActiveInteractionDeskId,
  isDanceUnlocked,
  isDeskUnlocked,
  setActiveInteractionDeskId,
  startMyDance,
};
}

const api = { createInteractionDesk };
if(typeof window !== 'undefined') window.TwInteractionDesk = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
