/* window-mode.js — 🪟 창 모드 정하기 · 활성 앱 판정(앱 FSD · app.js 분리 M22)
   app.js 의 «활성 앱 판정(_applyActiveAppState)» 과 «데스크탑 실행 화면 — 창 크기»(myHomeOpen · applyDesktopRunClass)를 글 그대로 옮긴 모듈이다. 판단도 그대로다(창 모드를 한 값으로 모으는 F2 의 바탕 — 지금은 옛 판단 그대로 옮기기만).
   ・책임: _applyActiveAppState(포커싱 어플 폴링 결과로 누적 시간 · 게이트 · 자기 창 · 펜 앱을 갱신) · myHomeOpen(마이홈이 런처에서 열려 있는가) · applyDesktopRunClass(화면을 보고 runmode · config 클래스 · 바닥 · 그림자를 정하고 main 에 창 모드 — creator · myhome · launcher · run — 를 보낸다).
   ・내놓는 것: _applyActiveAppState · applyDesktopRunClass(함수 — app.js 는 같은 이름 const 로 받는다) · myHomeOpen(읽는 함수) · setMyHomeOpen(쓰는 함수).
   ⚠️ 이 함수는 «누군가 불러줘야» 한다 — 오버레이를 여는 새 길이 생기면 여기도 부를 것. 여는 쪽 플래그가 아니라 화면(오버레이의 .on)을 본다.
   검사: checks/sim-window-mode.js */
(function(){

function createWindowMode(deps){
const appModeMod = deps.appModeMod;
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const desktopMode = deps.desktopMode;
const floor = deps.floor;
const focusGate = deps.focusGate;   // 😴 «투게더워킹 창이 앞이면 안 잠듦» 규칙(focus/focus-gate.js)
const focusProgressMod = deps.focusProgressMod;   // 읽는 함수 — 집중이 끝나면 못 올린 몫을 올린다
const setFocusGateSleep = deps.setFocusGateSleep;   // 쓰는 함수
const focusLevelMod = deps.focusLevelMod;
const focusWindowMs = deps.focusWindowMs;
const key = deps.key;
const mhStLayoutMod = deps.mhStLayoutMod;
const officeModeMod = deps.officeModeMod;
const seatStateMod = deps.seatStateMod;
const weeklyChal = deps.weeklyChal;
let _focusLastTick=performance.now(), _focusWasActive=false, _focusAccruedLast=false;
function _applyActiveAppState(state){
  if(!state) return;
  const now=performance.now(), dt=(now-_focusLastTick)/1000; _focusLastTick=now;
  // 직전 폴링 시점에 "등록된 포커스 앱을 실제로 쓰고 있었다"면 그 사이 흐른 시간만큼 누적.
  // dt가 비정상적으로 크면(창 최소화·컴퓨터 절전 등으로 폴링이 끊겼던 경우) 오차 누적 방지로 건너뜀.
  // ★ 기록 정지 기준 = 캐릭터가 idle로 바뀌는 순간(FOCUS_MS). 예전엔 sleep(SLEEP_MS=8초) 기준이라
  //   손을 뗀 뒤 캐릭터가 이미 idle인데도 8초까진 기록이 계속 쌓였다. 이제 마지막 입력 후 FOCUS_MS가
  //   지나 캐릭터가 '집중(focus) 포즈'를 벗어나면(=idle 진입) 즉시 누적을 멈춘다.
  //   → "실제로 입력하며 집중하는 동안"만 시간이 쌓임. 입력이 재개되면 다음 폴링부터 다시 누적.
  /* 📱 폰 켜짐이면 PC 입력 조건을 건너뛴다 — PC 입력이 없는 게 정상이라 그대로 두면 한 초도 안 쌓인다(요구: PC 와 똑같이). */
  const mobOn = focusLevelMod._mobileOn();
  const pcNotFocusing = (now - seatStateMod.lastActivity()) > focusWindowMs();
  const notFocusingNow = mobOn ? false : pcNotFocusing;
  /* 🧸 피규어 모드면 쌓지 않는다 — 직전 폴링 값(_focusWasActive)이 아니라 지금 값을 봐서, 켠 순간부터 멈춘다. */
  const accruing = !officeModeMod.figureMode() && _focusWasActive && !notFocusingNow && dt>0 && dt<30;
  if(accruing) focusLevelMod.addFocusSeconds(dt);
  else if(_focusAccruedLast) focusProgressMod().focusEnded();   // 집중 → 쉼 · 자리비움 — 못 올린 몫이 60초 이상이면 올린다
  _focusAccruedLast = accruing;
  /* 👑 달성표 🎯집중 — "오늘 그 앱을 몇 초 썼나"를 같은 dt 로 여기서 센다.
     ★ 새 타이머를 만들지 않는 이유: dt 는 _focusLastTick 을 소비해서 나온다. 밖에서 따로 재면
       같은 구간을 두 번 세거나 서로 _focusLastTick 을 리셋해서 둘 다 틀린다.
     ★ _focusWasActive(=등록된 포커스 앱이 활성)를 조건에 안 거는 이유: 그건 평생 누적치용 게이트다.
       달성표는 사용자가 고른 exe 하나만 보므로, 그 앱이 포커싱 어플 슬롯에서 빠져도 계속 세야 한다. */
  if(!officeModeMod.figureMode() && dt>0 && dt<30 && !pcNotFocusing) weeklyChal.focusTick(state, dt);   // 📱 폰 시간은 안 넣는다(exe 기준 · 이번 범위 밖)
  /* 이 기기의 플랫폼 접두사를 main 이 보낸 키에서 배운다 — 렌더러가 스스로 판단하지 않는다.
     구버전 main 은 key 를 안 보내므로 null 로 남고, 그때는 플랫폼 판정을 아예 안 한다. */
  if(state.key) weeklyChal.setKeyPlatform(String(state.key).split(':')[0] || null);
  seatStateMod.setSelfAppActive(focusGate.selfFront(state));
  seatStateMod.setPenAppFocused(!!state.isPenApp);   // 🖊️ 펜 앱이면 기록 창을 4초로 넓힘(focusWindowMs)
  const nextGate = focusGate.nextGateSleep(state, { figureMode: officeModeMod.figureMode(), mobOn });   // null = 투게더워킹 창이 앞 — 직전 값을 둔다
  if(nextGate !== null) setFocusGateSleep(nextGate);
  _focusWasActive = !!(state.hasAnyRegistered && state.isFocusedAppRegistered) || mobOn;
}
let myHomeOpen = false;   // ★ 마이홈 팝업이 "런처에서" 열려있는지 — 이때만 창 크기를 생성기처럼 키움
                          //   (실행 화면은 이미 전체화면이라 그 안에서 여는 건 그대로 둬도 잘 맞음)
function applyDesktopRunClass(){ if(!desktopMode) return;
  const launcherOn = document.getElementById('launcher').classList.contains('on');
  /* 🪟 **여는 쪽 플래그가 아니라 화면을 본다.** 예전엔 myHomeOpen 만 봤는데, 그 플래그를 세우는
     자리가 셋(open · openFriendHomeView · 런처 복귀)이라 한 곳만 어긋나도 창 크기가 갈렸다.
     실제로 openFriendHomeView 가 이 함수를 안 불러서 마이홈이 380px 창 밖으로 나갔다(제보).
     오버레이의 .on 이 곧 "지금 마이홈이 떠 있다"이므로 그걸 직접 본다 — 새 진입 경로가 생겨도
     플래그를 세우는 것을 잊었다는 이유로 창 크기가 틀리는 일이 없어진다.
     ⚠️ 그래도 이 함수는 **누군가 불러줘야** 한다. 오버레이를 여는 새 경로를 만들면 여기도 부를 것. */
  const mhOv = document.getElementById('myHomeOverlay');
  const mhOn = !!(mhOv && mhOv.classList.contains('on')) || myHomeOpen;
  /* 🗂️ 방 찾기 · 만들기(로비)도 런처의 좁은 창에 갇히지 않게 마이홈 크기로 연다(창 자리도 마이홈과 같이 기억) */
  const lobbyOv = document.getElementById('inviteOverlay');
  const lobbyOn = !!(lobbyOv && lobbyOv.classList.contains('on'));
  const showMyHomeSized = (mhOn || lobbyOn) && launcherOn;
  const config = launcherOn || creatorOpen();
  const runOverlay = appModeMod.appMode()==='run' && !config;
  document.body.classList.toggle('runmode', runOverlay);
  document.body.classList.toggle('config', config);   // 런처/생성기 열림 여부 — CSS에서 #scene 숨김에 사용
  if(typeof floor!=='undefined') floor.visible = !runOverlay;        // 투명 오버레이일 땐 바닥 숨김(데스크톱 비침)
  key.castShadow = FrameBudget.castShadowFor(runOverlay);   // 바닥이 없으니 그림자도 안 만든다(frame-budget.js)
  // 화면 종류에 따라 창 크기가 달라야 함: 생성기는 넓게, 마이홈(런처에서 열렸을 때)도 넓게, 런처는 카드 크기, 실행은 전체화면
  const mode = creatorOpen() ? 'creator' : (showMyHomeSized ? 'myhome' : (launcherOn ? 'launcher' : 'run'));
  // 🎨 런처 마이홈 — 창 밖으로 나간 스티커만큼 창을 넓혀 달라고 같이 보낸다(_mhStickerOverhang)
  const extra = (mode === 'myhome' && mhOn) ? mhStLayoutMod._mhStickerOverhang() : null;
  if(window.companion&&companion.setConfigMode) companion.setConfigMode(config, mode, extra);
}

return {
  _applyActiveAppState,
  myHomeOpen: ()=>myHomeOpen,
  setMyHomeOpen: (v)=>{ myHomeOpen = v; },
  applyDesktopRunClass,
};
}

const api = { createWindowMode };
if(typeof window !== 'undefined') window.TwWindowMode = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
