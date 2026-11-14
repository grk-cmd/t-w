/* seat-state.js — 🫧 좌석 활동 판정 seatState · 활동 시각 · 쓰다듬기 시작(앱 FSD · app.js 분리 M10)
   app.js 캐릭터 투명도 · 활동 판정 구역의 seatState 묶음을 글 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다(다시 대입되는 값을 읽는 함수로 받는 줄만 `이름()` 으로 달라짐).
   ・책임: 좌석 하나의 지금 상태 키(idle · focus · sleep · pet · shaking · dizzy · dance) 정하기(seatState) · 활동 시각 lastActivity(타이핑 모션 판정용 — 포커싱 게이트에 걸림) · lastAnyInput(자동 자리비움용 «실제 입력» — 어떤 앱을 쓰든 기록) ·
     창 포커스 windowFocused · 펜 앱 · 투게더워킹 창 자신이 맨 앞인지 · 쓰다듬기 시작(triggerPet). mousemove · keydown · wheel · visibilitychange · blur · focus 듣기는 만들 때 한 번 건다.
   ・받는 deps 5 — 값: userStatusMod · 읽는 함수: desktopMode · figureMode · focusGateSleep · focusLevelMod(모듈을 만드는 줄보다 뒤에서 선언되거나 app.js 가 다시 대입한다).
   ・내놓는 것: manual() · setManual(v)(손으로 고른 상태 — 좌석 패널 버튼이 쓴다) · FOCUS_MS · SLEEP_MS · PET_MS · PEN_FOCUS_MS · focusWindowMs · activity · anyInput · seatState · triggerPet · lastActivity() · lastAnyInput() · setLastActivity(v) · setLastAnyInput(v) · setPenAppFocused(v) · penAppFocused() · setSelfAppActive(v)
     — app.js 는 시각 · 펜 앱은 `seatStateMod.이름()` 으로 읽고(다시 대입되는 let), 나머지는 같은 이름 const 로 받는다.
   ⚠️ lastActivity 는 포커싱 게이트(focusGateSleep)에 걸려 «타이핑 모션» 판정에만 쓴다 — 자동 자리비움은 lastAnyInput. 합치지 말 것.
   ⚠️ 옛 `lastZ`(app.js 에서 선언만 하고 아무도 안 읽던 값)는 옮기지 않았다.
   검사: checks/sim-seat-state.js */
(function(){

function createSeatState(deps){
const desktopMode = deps.desktopMode;
const figureMode = deps.figureMode;
const focusGateSleep = deps.focusGateSleep;
const focusLevelMod = deps.focusLevelMod;
const userStatusMod = deps.userStatusMod;
const FOCUS_MS=1500,SLEEP_MS=8000,PET_MS=2200;
/* 🖊️ 펜 앱(클립스튜디오·포토샵 등)이 활성일 때만 쓰는 넓은 기록 창.
   그림은 한 획이 몇 초씩 이어져서 그 사이 클릭·키 입력이 하나도 없다. 1.5초 기준으로는
   선 하나 긋는 동안 캐릭터가 idle로 빠지고 기록도 뚝뚝 끊긴다. 펜 앱일 때만 4초로 넓힌다.
   (main.js가 activeAppState.isPenApp으로 알려줌 — 목록은 main.js의 PEN_APPS 한 곳에만 둔다) */
const PEN_FOCUS_MS=4000;
let _penAppFocused=false;
/* 투게더워킹 창 자신이 맨 앞인가(main.js activeAppState.isSelf) — 등록 앱이 아니어도 잠들지 않게 seatState 가 본다. */
let _selfAppActive=false;
function focusWindowMs(){ return _penAppFocused ? PEN_FOCUS_MS : FOCUS_MS; }
let lastActivity=performance.now(),windowFocused=!document.hidden;
function activity(){lastActivity=performance.now();}

/* ★ 자동 자리비움 전용 "실제 입력" 타임스탬프.
   lastActivity는 focusGateSleep(등록한 포커싱 어플을 쓰는 중인가)에 걸려서, 포커싱 어플을 아예 등록하지
   않았거나 다른 앱을 쓰는 중이면 갱신되지 않음 — 그건 "타이핑 모션" 판정용이라 그게 맞음.
   하지만 자동 자리비움은 어떤 앱을 쓰든 "사람이 컴퓨터를 만지고 있는가"만 보면 되므로 별도로 기록함. */
let lastAnyInput = performance.now();
function anyInput(){ lastAnyInput = performance.now(); }
window.addEventListener('mousemove',activity);window.addEventListener('keydown',activity);window.addEventListener('wheel',activity);
document.addEventListener('visibilitychange',()=>windowFocused=!document.hidden);
window.addEventListener('blur',()=>windowFocused=false); window.addEventListener('focus',()=>{windowFocused=true;activity();anyInput();});
/* 손으로 고른 상태(좌석 패널 버튼) — 값은 여기가 갖고 패널은 setManual 로 쓴다(패널이 이 모듈을, 이 모듈이 패널을 부르는 순환을 막으려고 옮겼다). */
let manual=null;
function seatState(seat,now){
  if(seat.pinned) return 'shaking';   // 액자 고정: 드래그된 자세(팔 처짐) + 호흡·blink 유지
  // 사용자 인터랙션 — 흔들기/회복(dizzy)/쓰다듬기(pet)가 모든 자동·수동·remote보다 우선
  if(seat.beingShaken) return 'shaking';
  if(seat.dizzyUntil && now < seat.dizzyUntil) return 'dizzy';
  if(now-seat.petStart<PET_MS) return 'pet';   // remote(친구) 좌석도 쓰다듬으면 반응 보이게(원래 remote 분기보다 아래에 있어서 무시되던 버그)
  // 💃 춤 — 자리비움/자동 상태보다 우선(단, 흔들기·dizzy·pet보다는 아래). 내 좌석은 danceUntil, 친구 좌석은 remoteState로 전달됨.
  if(seat.danceUntil && now < seat.danceUntil && !seat.remote) return 'dance';
  // 자리비움(본인/친구) → 자동·수동과 무관하게 sleep 모션 강제 (영혼 컨셉)
  const us = seat.remote ? seat.remoteUserStatus : (seat.isMe ? userStatusMod.userStatus() : null);
  if(us==='away') return 'sleep';
  if(seat.remote) return seat.remoteState||'idle';   // 친구 좌석: 공유받은 상태 사용
  if(manual)return manual;
  if(!desktopMode() && !windowFocused)return 'sleep';   // 데스크톱 모드에선 다른 프로그램 쓰는 게 정상이라 이 체크 제외(포커싱 게이트가 대신함)
  // 포커싱 어플 게이트: 데스크톱 모드에서, 등록된 앱이 없거나 등록된 앱을 안 쓰는 중이면
  // (직접 쓰다듬기·흔들기 등은 위에서 이미 처리됐으므로) 자동 idle/focus 판정은 sleep으로 대체.
  /* 투게더워킹 창을 쓰는 중이면 등록 앱이 아니어도 깨어 있는다(평소 자세). 손을 뗀 지 SLEEP_MS 가 넘으면 예전처럼 잔다.
     ⚠️ lastActivity 만 보면 안 된다 — 전역 키 · 클릭은 게이트가 닫혀 있으면 lastAnyInput 만 올린다. */
  if(desktopMode() && focusGateSleep() && _selfAppActive) return (now-Math.max(lastActivity,lastAnyInput)>SLEEP_MS) ? 'sleep' : 'idle';
  if(desktopMode() && focusGateSleep()) return 'sleep';
  if(seat.isMe && focusLevelMod()._mobileOn()) return 'focus';   // 📱 폰에서 그리는 중 — 집중 포즈
  const idle=now-lastActivity;
  if(idle<focusWindowMs())return 'focus';
  /* 🧸 피규어 모드는 «항상 깨어 있음» 이다 — 입력이 끊겨도(생각하는 동안 · 키 훅이 막힌 앱) 잠들지 않고 쉬는 자세. 자리비움은 위에서 잔다. */
  if(idle>SLEEP_MS && !(desktopMode() && figureMode()))return 'sleep';
  return 'idle'; }
function triggerPet(seat){ const now=performance.now(); seat.petStart=now; if(seat.blink) seat.blink.pulses.push({start:now,dur:240}); }

return {
  FOCUS_MS, SLEEP_MS, PET_MS, PEN_FOCUS_MS,
  focusWindowMs, activity, anyInput, seatState, triggerPet,
  lastActivity: ()=>lastActivity,
  lastAnyInput: ()=>lastAnyInput,
  setLastActivity: (v)=>{ lastActivity = v; },
  setLastAnyInput: (v)=>{ lastAnyInput = v; },
  manual: ()=>manual,
  setManual: (v)=>{ manual = v; },
  penAppFocused: ()=>_penAppFocused,
  setPenAppFocused: (v)=>{ _penAppFocused = v; },
  setSelfAppActive: (v)=>{ _selfAppActive = v; },
};
}

const api = { createSeatState };
if(typeof window !== 'undefined') window.TwSeatState = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
