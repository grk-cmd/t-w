/* desktop-run.js — 🖥️ 데스크탑 실행 화면 — 업데이트 배너 · 활성 앱 · 전역 입력 · 클릭 통과 · 하트비트
   app.js «🖥️ 데스크탑 실행 화면» 구역의 `if(desktopMode){…}` 덩이를 그대로 옮긴 모듈이다(앱 FSD 32번 — docs/APP_FSD_MAP.md).
   만들 때 한 번 돈다(옛 자리에서 부팅 때 한 번 돌던 것과 같다). 창 크기 맞추기(applyDesktopRunClass) · layoutSeats 감싸기는 화면 핵심이라 app.js 에 남겼다. 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 18줄 —
     _charBoundsLatest · _penAppFocused · _twMoveSeenAt · drag · focusGateSleep · lastActivity · lastAnyInput · moveMode 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setTwMoveSeenAt · setLastActivity · setLastAnyInput(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 클릭 통과로 바꿀지(mousemove · 재판정 · 고착 회복 사다리 · pointerdown)의 판단은 click-through-policy.js(deps.clickPolicy)가 한다 —
     여기서는 사실을 모아 부르고, 결정대로 IPC · 타이머 · 로그만 한다. 같은 조건을 여기 다시 쓰지 않는다.
   ★ app.js 함수 6개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwDesktopRun — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-desktop-run.js */
(function(){

function createDesktopRun(deps){
const _applyActiveAppState = deps._applyActiveAppState;
const _charBoundsLatest = deps._charBoundsLatest;   // 읽는 함수
const _penAppFocused = deps._penAppFocused;   // 읽는 함수
const _skipFlyingRigs = deps._skipFlyingRigs;
const _skipHiddenDesk = deps._skipHiddenDesk;
const _twMoveSeenAt = deps._twMoveSeenAt;   // 읽는 함수
const activity = deps.activity;
const anyInput = deps.anyInput;
const backToLauncher = deps.backToLauncher;
const camera = deps.camera;
const clickPolicy = deps.clickPolicy;   // 클릭 통과 판단 규칙(click-through-policy.js)
const desktopMode = deps.desktopMode;
const drag = deps.drag;   // 읽는 함수
const focusGateSleep = deps.focusGateSleep;   // 읽는 함수
const lastActivity = deps.lastActivity;   // 읽는 함수
const lastAnyInput = deps.lastAnyInput;   // 읽는 함수
const moveMode = deps.moveMode;   // 읽는 함수
const ray = deps.ray;
const renderer = deps.renderer;
const seats = deps.seats;
const setTwMoveSeenAt = deps.setTwMoveSeenAt;   // 쓰는 함수
const setLastActivity = deps.setLastActivity;   // 쓰는 함수
const setLastAnyInput = deps.setLastAnyInput;   // 쓰는 함수
if(desktopMode){
  document.body.classList.add('desktop');
  try{ renderer.setClearColor(0x000000,0); }catch(e){}
  // 시스템 전체 유휴 시간으로 활동 상태 판정 (창에 포커스 없어도 동작) — 현재 미사용(no-op)
  if(window.companion&&companion.onIdle){ companion.onIdle(sec=>{ setLastActivity(performance.now()-Math.max(0,sec)*1000); }); }
  // 활성 프로세스 상태 실시간 구독 (500ms 폴링 기반) — 포커싱 어플 게이트 갱신
  if(window.companion&&companion.onActiveAppState){ companion.onActiveAppState(_applyActiveAppState); }
  // ---- 자동 업데이트 상태 알림 ----
  // 다운로드 완료('downloaded')되면 재시작 버튼이 달린 알림을 계속 띄워둠(사용자가 직접 확인하고 눌러야 설치됨).
  // 그 외 상태(checking/available/downloading/none)는 조용히 무시 — 매번 토스트 띄우면 방해될 수 있어서
  // "설치 준비 완료"만 눈에 띄게 알림.
  if(window.companion&&companion.onUpdateStatus){
    companion.onUpdateStatus((info)=>{
      const {status, version} = info || {};
      // ★ 모든 상태를 콘솔에 남긴다 — 예전엔 'downloaded'만 처리하고 나머지(특히 error)를 조용히 버려서
      //   업데이트가 왜 안 뜨는지 개발자도 확인할 방법이 없었다. main 프로세스 이벤트라 F12로도 안 보였음.
      try{ console.log('[업데이트]', status, JSON.stringify(info||{})); }catch(_){ console.log('[업데이트]', status); }
      if(status==='error') console.warn('[업데이트] 실패:', (info&&info.message)||'(메시지 없음)');
      if(status==='downloaded') showUpdateReadyBanner(version);
      // 🍎 맥은 서명이 없어 자동 설치가 안 된다(main.js 의 맥 갈래 주석). 내려받기만 사람이 한다 —
      //   같은 배너에 «받으러 가기» 만 달아서 릴리즈 페이지를 시스템 브라우저로 연다.
      if(status==='mac-available') showUpdateReadyBanner(version, info&&info.url);
    });
  }
  /* downloadUrl 이 있으면 «받으러 가기»(맥 — 브라우저로 릴리즈 페이지), 없으면 «지금 재시작»(윈도우 — 자동 설치).
     ★ 배너를 새로 만들지 않고 이 한 칸을 같이 쓴다 — 자리·테마·중복 방지가 이미 여기에 있다. */
  function showUpdateReadyBanner(version, downloadUrl){
    if(document.getElementById('updateReadyBanner')) return;   // 중복 방지
    const b=document.createElement('div');
    b.id='updateReadyBanner';
    b.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;'
      +'background:var(--win-face, #d4d0c8);border:2px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);'
      +'box-shadow:2px 2px 0 rgba(0,0,0,.3);padding:8px 10px;display:flex;align-items:center;gap:8px;'
      +'font-size:12px;color:#222;-webkit-app-region:no-drag;';
    const ver=version?(' v'+version):'';
    b.innerHTML='<span>'+(downloadUrl?('🍎 새 버전'+ver+'이 나왔어요'):('🔄 새 버전'+ver+'이 준비됐어요'))+'</span>'
      +'<button id="updateReadyBtn" style="padding:4px 8px;font-weight:bold;cursor:pointer;">'
      +(downloadUrl?'받으러 가기':'지금 재시작')+'</button>'
      +'<button id="updateLaterBtn" style="padding:4px 8px;cursor:pointer;">나중에</button>';
    document.body.appendChild(b);
    document.getElementById('updateReadyBtn').onclick=()=>{
      if(downloadUrl){
        // 앱 안에서 열면 안 된다 — 로그인·다운로드가 file:// 창에서 막힌다. 시스템 기본 브라우저로.
        if(window.companion&&companion.openBrowser) companion.openBrowser(downloadUrl);
        b.remove();
        return;
      }
      if(window.companion&&companion.installUpdate) companion.installUpdate();
    };
    document.getElementById('updateLaterBtn').onclick=()=>{ b.remove(); };
  }
  // 전역 키보드 입력 — 등록된 포커싱 어플을 쓰는 중일 때만 활동시간 갱신 (타이핑 모션 유도)
  if(window.companion&&companion.onGlobalKey){
    companion.onGlobalKey(state=>{ _applyActiveAppState(state); anyInput(); if(!focusGateSleep()) activity(); });
  }
  // 🖊️ 타블렛 펜 보완 — 펜으로 그리는 입력은 전역 클릭/키 훅(uiohook)에 안 잡히는 드라이버가 있음.
  //   ⚠️ 예전엔 OS 유휴시간(powerMonitor)을 1초마다 읽어 lastActivity를 되살렸는데, OS 유휴시간은
  //   마우스 센서 미세 떨림·펜 호버 같은 "유령 움직임"에도 리셋돼서, 아무것도 안 하는데 캐릭터가
  //   안 자고 포커스 기록이 계속 쌓이는 문제가 있었다(실사용 보고). 그래서 이 보정을 제거함.
  //   → 이제 기록/잠들기는 오직 실제 키·클릭(펜 탭 포함, uiohook이 잡음)에만 반응한다.
  //   펜 스트로크는 시작점이 '펜 다운=클릭'이라 대부분 잡히므로 실질적으로 문제되지 않음.
  //   혹시 순수 호버 드로잉만 하는 환경에서 시간이 안 쌓이면, 아래 USE_OS_IDLE_FOR_FOCUS를 켜되
  //   드리프트 위험을 감수하는 방식으로 되살릴 수 있음.
  const USE_OS_IDLE_FOR_FOCUS = false;
  /* 🖊️ 펜 활동 수신 — main이 '펜 앱 활성 + 커서가 실제로 3px 이상 이동'일 때만 초당 1회 보낸다.
     위 OS 유휴시간 방식과 결정적으로 다른 점: OS는 호버·센서 떨림도 '입력 있음'으로 치지만
     이건 커서 좌표가 실제로 변해야만 온다. 펜을 들어 가만히 두면 안 오고, 기록도 정상적으로 멈춘다.
     처리는 전역 클릭과 똑같이 — 단, '오른손 까딱' 펄스는 붙이지 않는다(그리는 중엔 계속 오므로 산만함). */
  if(window.companion && companion.onPenActivity){
    companion.onPenActivity(()=>{
      anyInput();                          // 자동 자리비움 판정 — 어떤 앱이든 사람이 만지고 있다는 사실
      if(!focusGateSleep()) activity();      // 기록·집중 포즈 — 등록한 포커싱 어플을 쓰는 중일 때만
    });
  }
  /* 🎮 게임패드 — 버튼 · 스틱 값이 실제로 바뀌었을 때만(parts/gamepad-activity.js). 처리는 펜 활동과 같다.
     창이 뒤에 있을 때 값이 안 들어오는 OS 면 신호가 없을 뿐이다(모듈 주석). */
  if(window.TwGamepadActivity && navigator.getGamepads){
    try{
      TwGamepadActivity.createGamepadActivity({
        getPads: ()=>navigator.getGamepads(),
        onActivity: ()=>{ anyInput(); if(!focusGateSleep()) activity(); },
      }).start();
    }catch(_){}
  }
  if(USE_OS_IDLE_FOR_FOCUS && window.companion && companion.getIdleSeconds){
    setInterval(async ()=>{
      try{
        if(focusGateSleep()) return;
        const sec = await companion.getIdleSeconds();
        if(sec==null) return;
        const ts = performance.now() - sec*1000;
        if(ts > lastActivity()){ setLastActivity(ts); if(ts > lastAnyInput()) setLastAnyInput(ts); }
      }catch(_){}
    }, 1000);
  }
  // 전역 마우스 클릭 — 등록된 포커싱 어플을 쓰는 중일 때만 반응 (오른손 까딱)
  if(window.companion&&companion.onGlobalClick){
    companion.onGlobalClick(({x,y,button,...state})=>{
      /* 🚑 클릭 고착 감시 — 이 훅은 OS 전역이라 **클릭 통과 중에도 들어온다.**
         통과 상태에서 유일하게 살아 있는 통로라, 여기서 "mousemove 가 끊겼는지"를 본다.
         판단·조치는 전부 __mouseKick 안에 있다(클릭통과 블록 참고). */
      /* ★ 순서 주의 — _applyActiveAppState 가 **먼저**다.
         그 안에서 _penAppFocused 가 갱신되고, __mouseKick 의 펜 앱 게이트가 그 값을 본다.
         반대로 두면 이 클릭 시점의 판정이 아니라 최대 500ms 전(직전 폴링) 값으로 판단하게 된다 —
         펜 앱으로 막 전환한 직후의 첫 탭들이 정확히 그 구멍으로 샜다. */
      _applyActiveAppState(state);
      /* 📺 offOverlay = 이 클릭이 **오버레이가 없는 모니터**에서 났다(main 이 판단해 실어 보낸다).
         그때는 forward mousemove 가 안 오는 것이 정상이라 사다리를 돌리면 안 된다 — 아래 __mouseKick 주석.
         🛞 [2026-09-17 제보 3-1 · C] **휠(wheel:true)은 사다리를 아예 안 탄다.** 스크롤은 마우스를 안 움직이므로
           mousemove 가 없는 것이 정상이다 — 그걸 «통로가 죽었다» 로 읽어 1.5초마다 kick3 를 반복한 것이
           «여백에 커서를 두면 뒤의 크롬이 스크롤이 안 된다» 의 정체였다(main.js _onGlobalWheel 주석에 로그 근거).
           구버전 main 은 이 필드를 안 보내므로 undefined = 예전처럼 탄다. */
      if(window.__mouseKick && clickPolicy.clickMayKick(state)) try{ window.__mouseKick(state && state.offOverlay); }catch(_){}
      anyInput();   // 자동 자리비움 판정용 — 어떤 앱을 쓰든 입력이 있었다는 사실만 기록
      if(!focusGateSleep()){
        activity();
        const me=seats.find(s=>s.isMe);
        if(me) me.clickTapAt = performance.now();   // 오른손 까딱 펄스 시작 (animateRig에서 소비)
      }
    });
  }
  // 컨트롤 바: 드래그 이동 + 런처 + 잠깐 숨기기
  const grip=document.querySelector('#deskBar .grip');
  if(grip&&window.companion&&companion.moveWindow){ let dragging=false,px=0,py=0;
    grip.addEventListener('mousedown',e=>{dragging=true;px=e.screenX;py=e.screenY;e.preventDefault();});
    window.addEventListener('mousemove',e=>{ if(!dragging)return; companion.moveWindow(e.screenX-px,e.screenY-py); px=e.screenX;py=e.screenY; });
    window.addEventListener('mouseup',()=>dragging=false);
  }
  const dg=document.getElementById('deskGear'); if(dg) dg.onclick=()=>backToLauncher();
  const dh=document.getElementById('deskHide'); if(dh) dh.onclick=()=>{ const c=document.getElementById('scene'); c.style.visibility=(c.style.visibility==='hidden'?'visible':'hidden'); };

  /* ❌ [폐기 2026-08-26] 글자 입력 중에만 창 활성화를 허용하던 focusin/focusout 배선(setTextInput)은
     걷어냈다. NOACTIVATE 실험이 없어졌으므로 받는 쪽이 없고, 남겨 두면 다음 사람이 "이 통로가
     왜 있지" 하며 실험을 되살릴 실마리가 된다. 자세한 경위는 handoff-focus-steal-5.md §7. */

  /* ---- 클릭 통과 (click-through) ----
     run 모드(전체화면 투명 오버레이)일 때, 마우스가 캐릭터나 보이는 UI 위에 있으면 클릭을 받고,
     그 외 빈 공간이면 창을 통과시켜 뒤 창(브라우저 등)을 조작할 수 있게 한다. */
  if(window.companion && companion.setIgnoreMouse){
    const _cvEl = document.getElementById('scene');
    const _ndcHit = new THREE.Vector2();
    /* 🎯 클릭을 받아야 하는 UI 목록 — **한 곳에서만 정의한다.**
       [왜 상수로 뺐나] 이 목록을 쓰는 곳이 둘이 됐다.
         ① _pointHitsInteractive — 커서가 지금 이 위에 있는가 (렌더러 판정)
         ② 아래 _uiRegions()     — 이 창들이 화면 어디를 차지하는가 (main 에게 알려줄 좌표)
       두 곳에 따로 적어 두면 새 창을 추가할 때 한쪽만 고치게 되고, 그러면 main 과 렌더러가
       서로 다른 것을 보며 싸운다 — 그게 이번 제보의 정체였다(핸드오프5 §1-4).
       ⇒ body 에 붙는 팝업을 새로 만들면 **여기 한 곳에만** 추가하면 된다. */
    const UI_HIT_SEL = '#myStatusChip, #wardrobePanel, #wdPreviewPanel, .wd-color-palette, .mh-color-pop, #deskBar, .toast, #creatorOverlay, #launcher, #focusSettingsPanel, #programSettingsOverlay, #adminPassOverlay, #licenseGenOverlay, #announceOverlay, #adBannerOverlay, #gameCfgOverlay, #mobLinkOverlay, #raceOverlay, #partRegOverlay, #deskRegOverlay, #exportOverlay, #glbEncOverlay, #glbLoadOverlay, #assetGenOverlay, #assetImpOverlay, #chatOverlay, #inviteOverlay, #inviteIssuedOverlay, #inviteGrantOverlay, #commGenOverlay, #updateReadyBanner, #focusLogOverlay, #myHomeOverlay, #mhPromptOverlay, #mhStickerAnimOverlay, #mhStickerMgrOverlay, .mh-sticker-handle, #mhDesignWin, .seat-bubble-dom, .seat-announce, #bellWin, #categoryManageOverlay, #codeOverlay, #codeModal, #appVerGateOverlay, #inviteGateOverlay, #deviceSessionOverlay, #existingSignupOverlay, #signupDoneOverlay, #needLoginOverlay, #charsLinkedOverlay, #mhDesignOverlay, #updateNoticeAdminOverlay, #updateNoticeUserOverlay, #mhGbOverlay, #totalStatsOverlay, #roomInvitePickOverlay, #ideskInvOverlay, #gachaInvOverlay, #gachaDrawOverlay, #pkOverlay, .cr-preset-ctx, .seat-ctx-backdrop, .app-popup-ov, #friendPicker, .seat-nameplate';
    /* 📐 지금 화면에 떠 있는 "우리 창"들의 사각형 — main 에게 보낸다.

       [왜 필요한가 — 이번 제보의 뿌리] main 의 회수 안전장치(ⓕ·ⓖ)와 펜 근접 판정은 지금까지
         `_lastCharBounds`, 즉 **내 캐릭터 하나**만 알고 있었다. 그런데 렌더러는 위 UI_HIT_SEL 의
         창들 **전부**를 클릭 대상으로 친다. 두 기준이 어긋나 있어서 이런 일이 벌어졌다.
           · 사용자가 대화창(캐릭터에서 1800px 떨어져 있다)에 커서를 얹는다
           · 렌더러: "내 창 위다" → 클릭 받기
           · main:   "캐릭터에서 1800px? 판정이 틀렸다" → 통과로 회수
           · 0.38초 뒤 렌더러가 다시 되돌린다 … 무한 핑퐁, 그 사이 클릭 한 번이 우리 창에 꽂힌다
         제보자 로그에서 이 왕복이 24분에 53번이었고, `이유=dom:chatOverlay` 26건의 커서 좌표가
         높이 380px 짜리 두 덩어리로 뭉쳤다 — #chatWindow 크기 그대로다. 렌더러가 맞았다.

       [펜에서 더 나쁘다] 펜 앱이 앞에 있으면 forward mousemove 가 끊겨서, 렌더러가 스스로
         판정할 기회가 main 의 penHitTest 뿐이다. 그런데 그 신호도 **캐릭터 반경 안에서만** 왔다.
         ⇒ 태블릿 펜으로는 대화창 입력칸을 눌러도 클릭이 뒤로 새서 **글자를 칠 수가 없었다.**

       ⚠️ 좌표계는 setCharBounds 와 같은 **클라이언트 좌표**다(창 좌상단 기준). main 이
         _mainWinScreenBounds 로 커서를 같은 좌표계로 옮겨서 비교한다. 바꾸지 말 것.
       ⚠️ 선택자 한 번, getBoundingClientRect 만 돈다. 100ms 하트비트에 얹으므로 레이캐스트처럼
         초당 100번 돌지 않는다. */
    const UI_REGION_MAX = 20;          // 이보다 많으면 앞쪽만 — IPC 를 살찌우지 않는다
    const UI_REGION_DEPTH = 4;         // 통과 껍데기를 몇 겹까지 파고들 것인가
    /* ★★ [2026-08-27] **자기 사각형을 담은 뒤에도 자식을 마저 훑는다.** — 제보 로그로 확정된 구멍.

       [무엇이 났나] 예전 push 는 `pointer-events:auto` 인 요소를 만나면 자기 사각형만 담고
         **거기서 멈췄다.** 그런데 `#myStatusChip`(pointer-events:auto) 안에 든 팝업 넷 —
         #myStatusMenu · #myDemojiBox · #myChipMore · #myPlaylistBox — 은 전부 `position:fixed` 라
         **부모의 getBoundingClientRect() 에 안 들어간다.** 결과가 이랬다:
           · 렌더러: elementFromPoint → 팝업 → closest('#myStatusChip') 성립 → "우리 UI다"
           · main  : 칩 본체(폭 28px 세로 컬럼) 사각형 하나만 받음 → "밖이다" → 통과로 회수
         제보자 로그 5.2시간에서 ⓖ 회수 32건 중 **28건**이 `이유=dom:myStatusChip` 직후
         **중앙값 0.64초**에 났고, 그때 회수 지점은 캐릭터에서 209~1712px — 전부 팝업 자리다.
         (칩 본체는 캐릭터 발밑 ~150px 안이라 그 거리가 나올 수 없다.)
         회수 직후 main 이 penHitTest(null) 로 렌더러 캐시까지 맞추므로, 마우스를 안 움직이면
         그대로 통과로 남는다 → **다음 클릭이 뒤 창(바탕화면)으로 샌다.** 제보 문구 그대로다.

       ⇒ 규칙을 하나 더 둔다: **부모 사각형 밖으로 나가는 자식은 자기 자리를 따로 주장한다.**
         부모 안에 완전히 들어가는 자식은 담지 않는다 — 그건 이미 부모가 대표하고 있다.
       ⚠️ 이 두 상수가 비용을 묶는다. 담긴 사각형 안쪽을 무한정 파고들면 마이홈처럼 자식이
         수백 개인 창에서 하트비트(10Hz)마다 getComputedStyle 이 수백 번 돈다.
         · ESCAPE_DEPTH — 사각형을 담은 뒤로는 이 깊이까지만. 실제로 튀어나오는 팝업은
           전부 **직계 자식**이다(칩 팝업 넷 · #chatOverlay > #chatEmojiWin). 1 이면 충분하고 2 는 여유다.
         · NODE_MAX    — 한 번 호출에서 살펴볼 노드 총량 상한. 어떤 DOM 이 와도 비용이 묶인다.
       ⚠️ 새 팝업을 `position:fixed`/`absolute` 로 만들어 화이트리스트 요소 **안에** 넣는 것은
         이제 안전하다. 다만 부모에서 두 겹 넘게 깊이 넣으면 다시 안 보인다 — 직계로 둘 것.
         (sim-ui-regions.js 가 이 자리를 지킨다) */
    const UI_REGION_ESCAPE_DEPTH = 2;  // 사각형을 담은 뒤 '튀어나온 자식'을 찾을 깊이
    const UI_REGION_NODE_MAX  = 120;   // 화이트리스트 항목 하나당 살펴볼 노드 상한
    const UI_REGION_TOTAL_MAX = 600;   // 한 번 호출 전체 상한 (10Hz 로 도는 하트비트다)

    /* ★★ [2026-08-26 · 2] `pointer-events:none` 인 껍데기는 **자기 사각형을 주장하지 않는다.**

       [이 줄이 없으면 고친 게 아니라 더 나빠진다]
         화이트리스트에는 `position:fixed; inset:0; pointer-events:none` 인 **전면 껍데기**가 여럿 있다 —
         #chatOverlay · #myHomeOverlay · #raceOverlay · #focusLogOverlay · #mhGbOverlay · #mhPromptOverlay ·
         #mhDesignOverlay · #exportOverlay 묶음(#glbEncOverlay·#assetGenOverlay·#inviteOverlay·#partRegOverlay…).
         전부 자식 창을 화면 가운데 띄우려고 깔아 둔 껍데기고, 클릭은 그대로 통과시킨다.
         그래서 `_pointHitsInteractive` 의 `elementFromPoint` 에는 **절대 안 걸린다.**
         그런데 `getBoundingClientRect()` 는 그 껍데기를 **화면 전체**로 돌려준다.

         그 값을 그대로 main 에 보내면 대화창을 하나 여는 순간 `_lastRegions` 에 전체화면 사각형이
         들어가고, main 의 `_ptOnOurUI()` 가 **화면 어느 점에서나 참**이 된다. 결과는:
           · ⓖ 굳은 클릭받기 회수가 통째로 죽는다 → 파판14 건이 그대로 되돌아온다(핸드오프4 §5)
           · ⓕ 스테일 회수도 같이 죽는다
           · 펜 근접 판정(_checkCursorNearChar)이 늘 '근처'가 되어 forward 가 상시 켜진다
         **main 과 렌더러의 기준을 맞추는 것**이 이 배선의 목적인데, 정반대로 더 크게 어긋난다.
         (제보 로그에서 `이유=dom:chatOverlay` 가 우세했던 그 상황 = 대화창을 열어 둔 상황이다.
          즉 이 함정은 예외가 아니라 **제보가 나는 바로 그 상태**에서 걸린다.)

       ⇒ 규칙은 하나다: **`elementFromPoint` 가 집을 수 있는 것만 보낸다.**
         통과 껍데기는 자기 자리를 포기하고 자식에게 넘긴다(#chatOverlay → #chatWindow 430×380).
       ⚠️ 화면 밖으로 걸친 창은 **보이는 부분만 잘라서** 보낸다. 안 자르면 창을 화면 밖으로 끌어낸 만큼
         main 쪽 사각형이 화면 밖까지 부풀어 같은 종류의 헛참이 생긴다. */
    function _uiRegions(){
      const out = [];
      const seen = new Set();          // 같은 사각형을 두 번 담지 않는다(껍데기 자식이 화이트리스트에도 있는 경우)
      /* 노드 예산은 **화이트리스트 항목마다 따로** 준다. 하나로 묶으면 메시지가 수백 줄
         쌓인 대화창 하나가 예산을 다 먹고, 문서 뒤쪽에 있는 창(마이홈·초대 등)이 통째로
         목록에서 빠진다 — 고치려던 것과 같은 종류의 구멍이 생긴다. */
      let nodes = 0, total = 0;
      // 화면 안으로 자른 사각형. 화면 밖이거나 너무 얇으면 null.
      const rectOf = (el) => {
        const r = el.getBoundingClientRect();
        const x0 = Math.max(0, r.left),           y0 = Math.max(0, r.top);
        const x1 = Math.min(innerWidth, r.right), y1 = Math.min(innerHeight, r.bottom);
        if(x1 - x0 < 2 || y1 - y0 < 2) return null;
        return { x: Math.round(x0), y: Math.round(y0),
                 w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
      };
      // g 가 o 안에 완전히 들어가는가 — 들어가면 o 가 이미 대표하므로 따로 담지 않는다
      const inside = (g, o) => !!o && g.x >= o.x && g.y >= o.y
                            && g.x + g.w <= o.x + o.w && g.y + g.h <= o.y + o.h;
      /* owned = 조상이 이미 담은 사각형(없으면 null).
         depth = 앞으로 더 내려갈 깊이. */
      const push = (el, depth, owned) => {
        if(!el || el.nodeType !== 1 || out.length >= UI_REGION_MAX) return;
        if(++nodes > UI_REGION_NODE_MAX || ++total > UI_REGION_TOTAL_MAX) return;
        let st; try{ st = getComputedStyle(el); }catch(_){ return; }
        // 숨어 있으면 자식도 같이 숨어 있다 — 여기서 가지째 끊는다
        if(st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) return;

        let mine = owned;
        if(st.pointerEvents !== 'none'){
          /* 클릭을 받는 요소다 — 자기 자리를 주장한다.
             단 조상이 담은 사각형 안에 완전히 들어가면 담지 않는다(중복이다). */
          const g = rectOf(el);
          if(g){
            if(!inside(g, owned)){
              const key = g.x + ',' + g.y + ',' + g.w + ',' + g.h;
              if(!seen.has(key)){ seen.add(key); out.push(g); }
              mine = g;
            }
            /* ★ 담은 뒤에도 **멈추지 않는다.** position:fixed/absolute 자식은 이 사각형
               밖에 그려질 수 있고, 그게 이 파일이 고친 바로 그 구멍이다(위 상수 주석).
               다만 깊이는 여기서 줄인다 — 튀어나오는 팝업은 직계 자식이다. */
            if(depth > UI_REGION_ESCAPE_DEPTH) depth = UI_REGION_ESCAPE_DEPTH;
          }
        }
        if(depth <= 0) return;
        const kids = el.children;
        for(let i = 0; i < kids.length && out.length < UI_REGION_MAX; i++) push(kids[i], depth - 1, mine);
      };
      try{
        if(!document.body.classList.contains('runmode')) return out;
        const els = document.querySelectorAll(UI_HIT_SEL);
        for(let i = 0; i < els.length && out.length < UI_REGION_MAX; i++){
          nodes = 0;                                  // 항목마다 예산을 새로 준다(위 주석)
          if(total > UI_REGION_TOTAL_MAX) break;
          push(els[i], UI_REGION_DEPTH, null);
        }
      }catch(_){}
      return out;
    }
    window.__uiRegions = _uiRegions;   // 하트비트가 쓴다(아래 setCharBounds 타이머)

    let _ignoring = null;   // 현재 무시 상태 (중복 IPC 방지)
    /* 🩺 판정이 '클릭 받음'으로 기운 **이유**. 아래 _sendIgnore 가 main 으로 실어 보낸다.
       화면 전체를 덮는 투명 창이라, 여기서 참이 나온 자리가 곧 "다음 클릭을 우리가 가져가는 자리"다. */
    let _hitWhy = '';

    // 지정 화면좌표(clientX/Y)에 클릭 받을 대상이 있는지 판정
    let _pointHitsInteractive = function(cx, cy){
      // run 모드가 아니면(런처/생성기 등) 창 전체가 UI이므로 항상 클릭 받음
      if(!document.body.classList.contains('runmode')){ _hitWhy = 'notRunmode'; return true; }
      // "프로그램 이동" 중엔 마우스가 어디 있든 클릭을 받아야 위치 확정 클릭이 씹히지 않음
      if(moveMode()){ _hitWhy = 'moveMode'; return true; }
      // 상태칩·꾸미기 버튼 등 화면 위 DOM UI 위인지
      /* ⚠️ document.body 에 직접 붙는 팝업은 창 id(#myHomeOverlay 등)로 커버되지 않는다 —
         closest()는 조상만 보므로 body 형제로 뜬 팝업은 화이트리스트에 '자기 선택자'가 있어야 한다.
         실제 사고: 마이홈 bio/게시글의 글자색·바탕색 팝업(.mh-color-pop)이 빠져 있어서, 팝업은
         떠도 커서가 그 위로 가면 클릭이 뒤 창으로 뚫려 색을 고를 수 없었다(팝업도 안 닫힘).
         꾸미기 자유색 픽커는 .wd-free-picker 에 .wd-color-palette 를 함께 달아 우연히 살아 있었다.
         두 번째 사고: 좌석 우클릭 메뉴(.cr-preset-ctx.seat-ctx)도 body 형제로 떠서 같은 증상이 났다 —
         메뉴는 보이는데 커서를 올리면 클릭이 뒤 창으로 뚫려 "잘 안 눌린다"가 된다.
         세 번째: 그 메뉴의 투명 뒷판(.seat-ctx-backdrop). 이건 '보이는 것'이 아니라 **바깥 클릭을
         받아 내려고 까는 판**이라, 목록에 없으면 판을 깔아 둔 의미 자체가 없다(클릭이 그대로 뚫린다).
         ⇒ body에 붙는 팝업을 새로 만들면 그 선택자를 아래 목록에 반드시 추가할 것. */
      const el = document.elementFromPoint(cx, cy);
      const _elHit = (el && el.closest) ? el.closest(UI_HIT_SEL) : null;
      if(_elHit){
        /* 🩺 어느 창이 걸렸는지까지 남긴다 — '화면 어디를 눌러도 앱이 튀어나온다'의 범인이
           전체를 덮는 창(채팅·마이홈 등)이면 여기 이름이 그대로 찍힌다. */
        _hitWhy = 'dom:' + (_elHit.id || _elHit.className || _elHit.tagName || '?');
        return true;
      }
      // 3D 캐릭터 위인지 (raycast)
      if(_cvEl && seats.length){
        const r = _cvEl.getBoundingClientRect();
        if(cx>=r.left && cx<=r.right && cy>=r.top && cy<=r.bottom){
          _ndcHit.x = ((cx - r.left)/r.width)*2 - 1;
          _ndcHit.y = -((cy - r.top)/r.height)*2 + 1;
          ray.setFromCamera(_ndcHit, camera);
          /* ⚡ 대상 배열을 **재사용**한다 — 이 함수는 통과 상태에서 초당 100번까지 불린다.
             `seats.map(...)` 은 부를 때마다 새 배열을 만들어서, 그 자체가 초당 100개의 쓰레기다.
             판정 결과는 예전과 완전히 같다(같은 객체, 같은 순서). */
          _hitObjs.length = 0;
          for(let i = 0; i < seats.length; i++) _hitObjs.push(seats[i].group);
          /* 🩺 **어느 좌석에 맞았는지**까지 남긴다 — 이게 갈래를 가른다.
             렌더러는 `seats` **전부**를 맞히지만, main 의 회수 판정(ⓕ·ⓖ)은 `_lastCharBounds`
             = **내 좌석 하나**만 안다. 그래서 남의 캐릭터 위에서는 두 쪽 판정이 구조적으로 어긋난다 —
             렌더러는 "맞았다", main 은 "캐릭터에서 1200px 이나 떨어졌으니 틀렸다" 하며 서로를 덮어쓴다.
             제보 로그가 정확히 그 모양이었다(회수 53회, 매번 0.38초 뒤 렌더러가 되돌림).
             ⚠️ 여기서 seat 를 못 찾아도 판정 결과는 예전과 **완전히 같다** — 이유 문자열만 거칠어진다. */
          const _ix0 = ray.intersectObjects(_hitObjs, true);
          /* 🩹 #7 — 올라탄 동물 좌석의 숨긴 책상이 머리 위 허공에 떠서 다른 앱 클릭을 가로챘다(_hitInHiddenDesk 주석).
             ⚡ 맞은 게 없으면 거르지 않는다 — 대부분의 호출(빈 공간)은 추가 비용 0 이다. */
          const _ix = _skipHiddenDesk(_skipFlyingRigs(_ix0));   // 🪑 날아가는 몸은 누를 일이 없다(_skipFlyingRigs 주석)
          if(_ix.length){
            let _si = -1;
            for(let o = _ix[0].object; o && _si < 0; o = o.parent){
              for(let i = 0; i < seats.length; i++) if(seats[i].group === o){ _si = i; break; }
            }
            _hitWhy = (_si < 0) ? 'char:?'
                    : (seats[_si].isMe ? 'char:me' : 'char:other#' + _si);
            return true;
          }
        }
      }
      return false;
    };
    /* 📏 판정 비용 계측 — 콘솔에서 `__hitStats()` 로 본다. 껐다 켜는 스위치가 아니라
       **지금 얼마나 불리고 있는지**를 보는 창구다(초당 횟수 · 한 번에 걸리는 시간).
       ★ 다른 프로그램이 앞에 있을 때 앱이 무거워지는 원인을 가릴 때 쓴다. 이 값이 크면
         판정이 원인이고, 작으면 원인은 다른 곳(예: 클릭음·렌더 스로틀)이다. */
    const _hitObjs = [];
    const _hitPerf = { n:0, ms:0, since: performance.now(), maxMs:0 };
    const _pointHitsInteractiveRaw = _pointHitsInteractive;
    _pointHitsInteractive = function(cx, cy){
      const t0 = performance.now();
      const r = _pointHitsInteractiveRaw(cx, cy);
      const d = performance.now() - t0;
      _hitPerf.n++; _hitPerf.ms += d;
      if(d > _hitPerf.maxMs) _hitPerf.maxMs = d;
      return r;
    };
    window.__hitStats = function(reset){
      const sec = Math.max(0.001, (performance.now() - _hitPerf.since) / 1000);
      const out = {
        잰시간: Math.round(sec) + '초',
        판정횟수: _hitPerf.n,
        초당: Math.round(_hitPerf.n / sec),
        평균ms: Math.round(_hitPerf.ms / Math.max(1, _hitPerf.n) * 100) / 100,
        최대ms: Math.round(_hitPerf.maxMs * 100) / 100,
        총점유율: Math.round(_hitPerf.ms / (sec * 1000) * 1000) / 10 + '%',
        통과중: _ignoreSent === true,
      };
      if(reset !== false){ _hitPerf.n = 0; _hitPerf.ms = 0; _hitPerf.maxMs = 0; _hitPerf.since = performance.now(); }
      return out;
    };

    /* ★ 클릭 고착 버그 수정 — 판정 캐시(_ignoring)와 '실제로 main에 보낸 값'(_ignoreSent)을 분리한다.

       [제보] 클립스튜디오로 그리다 태블릿 펜으로 투게더워킹을 톡 터치하면 그 뒤로 앱이 안 눌린다.
              앱을 껐다 켜야 돌아온다.
       [원인] 통과 전환은 150ms 디바운스로 예약되는데, pointerdown 핸들러가 그 예약을 **취소하지 않고**
              _ignoring만 false로 바꿨다. 그래서 이 순서가 성립한다:
                t=0    펜이 근접했지만 레이캐스트는 빈 공간 → _ignoring=true, 150ms 뒤 '통과' 예약
                t=30   펜이 캐릭터를 탭 → pointerdown → _ignoring=false, setIgnoreMouse(false)
                t=150  살아남은 예약이 발사 → setIgnoreMouse(true)
              결과: main은 '통과', 렌더러는 '클릭 받는 중'. 이후 커서를 캐릭터에 올려도
              shouldIgnore(false) === _ignoring(false) 이라 IPC를 아예 안 보내서 **영구 고착**된다.
              마우스로는 hover가 mousemove를 흘려 상태가 자주 갱신돼 재현이 어렵고, 펜 탭은
              이동 없이 곧바로 down/up이라 150ms 창에 정확히 들어간다 — 제보가 펜에서만 나온 이유.
       [대응] ① 보내는 함수를 하나로 모아 예약을 항상 취소한다.
              ② 비교 기준을 '의도'가 아니라 '마지막으로 보낸 값'으로 바꾼다 —
                 어떤 이유로 어긋나도 다음 판정에서 스스로 맞춰진다(main의 안전장치가 임의로
                 통과를 걸어버리는 경우까지 포함). 고착이 성립할 수 없는 구조로 만드는 게 목적. */
    let _ignoreDebounce = null;
    let _ignoreSent = null;   // main에 마지막으로 실제 전달한 값 (= main의 현재 상태)
    /* 🩺 [2026-08-26] **왜 클릭받기로 바꿨는지**를 main 으로 같이 보낸다.
       제보자 진단 로그(374시간·148회 포커스 뺏김)에서 막힌 자리가 정확히 여기였다 —
       로그에는 "비활성 상태에서 클릭받기 전환(ignore=false)" 이 459번 찍혀 있는데
       **누가 그 전환을 요청했는지가 안 적혀 있어** 갈래를 못 갈랐다. 커서 좌표는 94%가
       캐릭터 근처가 아니었으므로 '커서가 캐릭터 위' 계열은 아니고, 후보가 넷이나 남는다.
       ⚠️ 전용 IPC 를 새로 파지 않는다 — preload 를 고쳐야 하고, 그러면 구버전 preload 와
         짝이 안 맞는다. 이미 있는 하트비트 채널(setCharBounds)에 얹어 보낸다.
         같은 렌더러→main 파이프라 **순서가 보장**되므로, 바로 뒤에 오는 setIgnoreMouse 를
         main 이 받을 때 이 값이 먼저 도착해 있다.
       ⚠️ 좌표는 하트비트와 **똑같은 방식**으로 실어야 한다(main 이 x/y 없으면 그냥 버린다).
         _charBoundsLatest 를 덧쓰지 말 것 — 그 객체는 다음 주기에도 재사용된다. */
    let _lastIgnoreWhy = '';
    function _pushIgnoreWhy(why){
      try{
        if(!(window.companion && companion.setCharBounds)) return;
        const _b = _charBoundsLatest() || { x:-99999, y:-99999, r:0 };
        companion.setCharBounds({ x:_b.x, y:_b.y, r:_b.r,
          moveAge: _twMoveSeenAt() ? (Date.now() - _twMoveSeenAt()) : -1,
          regions: _uiRegions(), ignoreWhy: why });
      }catch(_){}
    }
    function _sendIgnore(v, why){
      if(_ignoreDebounce){ clearTimeout(_ignoreDebounce); _ignoreDebounce = null; }
      if(_ignoreSent === v) return;
      _ignoreSent = v;
      if(v === false){ _lastIgnoreWhy = why || '?'; _pushIgnoreWhy(_lastIgnoreWhy); }
      companion.setIgnoreMouse(v);
    }

    /* 🚑 클릭 고착 자동 회복 — 통과 중 forward mousemove 가 끊기면 판정이 한 번도 안 돌아 영원히 통과로 남는다.
       전역 클릭 훅(onGlobalClick)은 통과 중에도 오므로 거기서 사다리를 한 칸씩 올린다. 판단 규칙은 click-through-policy.js kickStep.
       ⚠️ 통과를 임의로 풀지 않는다(예전 워치독 사고) — 1·2단계는 통과를 유지한 채 재무장, 3단계만 잠깐 받아 본다. */
    let _lastMoveSeen = 0;      // mousemove 가 마지막으로 도착한 시각 (= forward 생존 신호)
    let _kickStage    = 0;      // 연속 몇 번째 구조 시도인가 (mousemove 가 오면 0으로 리셋)
    let _lastKickAt   = 0;
    let _probeTimer   = null;

    function _noteChannelAlive(){        // 통로가 살아 있다는 증거가 들어왔다
      _lastMoveSeen = performance.now();
      setTwMoveSeenAt(Date.now());        // 🩺 main 하트비트에 실어 보낼 벽시계 사본 (위 선언부 주석 참고)
      _kickStage = 0;
    }

    /* 재판정 수신은 mousemove 가 아니다 — 예전에 _noteChannelAlive() 로 기록해 main 유령 찌르기(3초)가 사다리를 눌러 앉혔다.
       펜 앱 재판정(pen 표식)만 헛구조 방지용 생존 신호로 친다(kickStep). main 하트비트(_twMoveSeenAt)는 여기서도 갱신한다. */
    let _lastPokeAt = 0, _lastPokePen = false;
    function _notePoke(isPenApp){
      _lastPokeAt  = performance.now();
      _lastPokePen = !!isPenApp;
      setTwMoveSeenAt(Date.now());        // main 하트비트만 갱신 — _lastMoveSeen·_kickStage 는 건드리지 않는다
    }

    /* ⚠️ 펜 앱 건너뛰기를 지우려면 먼저 main 이 펜 앱 활성 중 주기적으로 penHitTest 를 보내게 고칠 것 — 그리는 중 포커스 뺏김 제보가 돌아온다.
       구버전 main 은 offOverlay 를 안 보낸다 — undefined 면 예전처럼 돈다. */
    let _penSkipLoggedAt = 0, _offSkipLoggedAt = 0;
    window.__mouseKick = function(offOverlay){
      const now = performance.now();
      const k = clickPolicy.kickStep({ ignoreSent: _ignoreSent, offOverlay, penApp: _penAppFocused(), now,
        lastKickAt: _lastKickAt, lastMoveSeen: _lastMoveSeen, lastPokePen: _lastPokePen, lastPokeAt: _lastPokeAt, stage: _kickStage });
      if(k.act === 'skip-off'){
        if(now - _offSkipLoggedAt > 10000){
          _offSkipLoggedAt = now;
          console.warn('[클릭통과] 커서가 오버레이 밖(다른 모니터) — 고착 회복 사다리를 건너뛴다');
        }
        return;
      }
      if(k.act === 'skip-pen'){
        if(now - _penSkipLoggedAt > 10000){
          _penSkipLoggedAt = now;
          console.warn('[클릭통과] 펜 앱이 활성 — 고착 회복 사다리를 건너뛴다(그리는 중 포커스 뺏김 방지)');
        }
        return;
      }
      if(k.act === 'none') return;
      _lastKickAt = now;
      _kickStage = k.stage;

      if(k.act === 'rearm'){
        /* 1·2단계 — 통과는 그대로 두고 같은 값을 한 번 더 보내 forward 를 다시 켠다.
           ★ _sendIgnore 는 같은 값이면 안 보내므로 보낸 기록을 비워 강제로 재전송한다. */
        _ignoreSent = null; _ignoring = null;
        _sendIgnore(true);
        console.warn('[클릭통과] mousemove 가 ' + Math.round(now - (_lastMoveSeen||0)) +
                     'ms 째 없음 — forward 재무장 시도 (' + _kickStage + '/2)');
        return;
      }

      /* 3단계 — 잠깐 클릭을 받아 본다. 그 사이 mousemove 가 오면 정상 판정이 이어받고, 안 오면 통과로 되돌린다.
         토스트는 띄우지 않는다(사용자가 할 일이 없는 알림) — 흔적은 console.warn 으로. */
      const before = _lastMoveSeen;
      _ignoring = null;
      _sendIgnore(false, 'kick3');   // 🩺 사다리 3단계 — 커서 위치와 무관한 '눈 감고' 전환이다
      console.warn('[클릭통과] 재무장 실패 — 0.8초간 클릭 받기로 전환해 확인');
      if(_probeTimer) clearTimeout(_probeTimer);
      _probeTimer = setTimeout(()=>{
        _probeTimer = null;
        if(_lastMoveSeen !== before) return;   // 살아났다 — 정상 판정이 이어받는다
        _sendIgnore(true);                     // 여전히 죽어 있다 — 클릭을 가로채지 않도록 되돌린다
      }, clickPolicy.KICK_PROBE_MS);
    };

    /* 🔎 콘솔 진단 — 실행 화면에서는 창이 투명해 열기 어렵지만, 런처/생성기 화면에서는 쓸 수 있다.
       자동 회복이 실제로 어느 단계에서 듣는지 확인할 때 쓴다. */
    window.__mouseDiag = function(){
      return {
        runmode      : document.body.classList.contains('runmode'),
        moveMode     : moveMode(),
        드래그중      : !!drag(),
        판정캐시      : _ignoring,     // 렌더러가 생각하는 상태
        main에보낸값  : _ignoreSent,   // main 의 실제 상태 (true = 클릭 통과 중)
        통과예약대기  : !!_ignoreDebounce,
        mousemove나이 : _lastMoveSeen ? Math.round(performance.now() - _lastMoveSeen) + 'ms' : '한 번도 없음',
        구조시도단계  : _kickStage,
        펜앱활성      : _penAppFocused(),   // true 면 사다리는 통째로 멈춰 있는 게 정상이다
        마지막클릭받기이유 : _lastIgnoreWhy,
        재판정나이    : _lastPokeAt ? Math.round(performance.now() - _lastPokeAt) + 'ms' : '한 번도 없음'
      };
    };
    window.__mouseFix = function(){
      _ignoring = null; _ignoreSent = null; _kickStage = 0;
      if(_ignoreDebounce){ clearTimeout(_ignoreDebounce); _ignoreDebounce = null; }
      _lastIgnoreWhy = 'manualFix'; _pushIgnoreWhy(_lastIgnoreWhy);
      companion.setIgnoreMouse(false); _ignoreSent = false;
      return '클릭 받기로 되돌렸습니다 — 마우스를 캐릭터 위로 움직여 보세요';
    };
    function _updateIgnore(cx, cy){
      const h = clickPolicy.hitStep({ hit: _pointHitsInteractive(cx, cy), ignoring: _ignoring });
      if(h === 'receive'){
        /* 🚫 여기서 _uiHot() 을 부르지 않는다 — 통과 중에도 초당 100번 돌아 상한이 오르내리면 뒤 영상이 깜빡인다.
           반응이 굼떠 보이면 UI_HOT_MS · FrameBudget.FPS_UNFOCUSED 부터 손볼 것(sim-unfocused-fps.js 검사 8).
           ★ 받기로는 지연 없이 즉시 — 늦추면 캐릭터로 옮겨 바로 누른 클릭이 뒤 프로그램으로 샌다. */
        _ignoring = false;
        _sendIgnore(false, _hitWhy || 'hit?');
        return;
      }
      if(h === 'pass-later'){
        // 통과로 돌아갈 때만 늦춘다 — 경계를 스치듯 지날 때 IPC 가 연달아 불리지 않게.
        _ignoring = true;
        if(_ignoreDebounce) clearTimeout(_ignoreDebounce);
        _ignoreDebounce = setTimeout(()=>{ _ignoreDebounce = null; _sendIgnore(true); }, clickPolicy.PASS_DEBOUNCE_MS);
      }
    }

    // forward:true 덕분에 무시 중에도 mousemove는 계속 들어옴. 매 프레임 raycast는 부담이라 살짝 throttle.
    let _lastCheck = 0;
    window.addEventListener('mousemove', e=>{
      /* 🚑 어느 분기로 빠지든 도착 사실을 먼저 남긴다 — 이 값이 안 갱신되는 것이 «forward 가 죽었다» 이고 사다리의 근거다. */
      _noteChannelAlive();
      const now = performance.now();
      const m = clickPolicy.moveStep({ moveMode: moveMode(), ignoring: _ignoring, ignoreSent: _ignoreSent,
        dragging: drag(), sinceCheck: now - _lastCheck });
      if(m.stamp) _lastCheck = now;
      if(m.act === 'receive'){ _ignoring=false; _sendIgnore(false, 'moveMode'); return; }
      if(m.act === 'judge') _updateIgnore(e.clientX, e.clientY);
    });
    // 드래그 중엔 캐릭터 밖으로 벗어나도 계속 잡아야 하므로, 드래그 동안은 무시 해제 유지
    //   ★ _sendIgnore가 대기 중인 '통과' 예약까지 취소한다 — 이게 없어서 펜 탭 뒤 앱이 안 눌렸다(위 주석 참고).
    window.addEventListener('pointerdown', ()=>{ if(clickPolicy.pointerDownStep({ ignoring: _ignoring }) === 'receive'){ _ignoring=false; requestAnimationFrame(()=>_sendIgnore(false, 'pointerdown')); } });
    // 드래그 끝나면 현재 위치 기준으로 다시 판정
    window.addEventListener('pointerup', e=>{ setTimeout(()=>_updateIgnore(e.clientX, e.clientY), 0); });

    /* ★ [제거됨] 고착 방지 워치독 — '통과 중인데 4초간 mousemove가 없으면 통과를 해제'하던 코드.
       이 창은 화면 전체를 덮는 투명 창이라, 통과를 해제하면 '화면 어디를 클릭해도 이 앱이 활성화'된다.
       마우스를 안 움직이고 타자만 쳐도 4초는 금방 지나서, 다른 프로그램을 쓰다가 클릭하면
       투게더워킹이 튀어나오는 증상이 됐다(제보된 문제).
       원래 목적(마우스 고착 복구)은 main.js의 _forwardFor()가 근본적으로 막고 있으므로 이 장치는 불필요하다.
       ※ 창이 포커스를 얻었을 때도 통과를 강제로 풀지 않는다 — 대신 캐시만 비워서
         다음 마우스 움직임에 정상 판정이 다시 적용되게 한다. */
    window.addEventListener('focus', ()=>{
      // 판정 캐시만 초기화(강제 해제 아님). _ignoreSent도 비워서, 다음 판정이 값이 같더라도
      // main에 한 번 다시 알리게 한다 — main 쪽 안전장치가 임의로 통과를 걸어둔 경우의 재동기화 통로.
      _ignoring = null; _ignoreSent = null;
      if(_ignoreDebounce){ clearTimeout(_ignoreDebounce); _ignoreDebounce = null; }
    });

    // 👆 펜 앱(클립스튜디오·블렌더 등) 전용 — main이 커서 근접을 감지하면 mousemove 없이도 즉시 정밀 판정.
    //   펜 태블릿은 이동 없이 곧바로 탭하는 경우가 많아 mousemove를 기다리면 첫 클릭을 놓친다.
    if(companion.onPenHitTest){
      companion.onPenHitTest(pt=>{
        try{
          _notePoke(pt && pt.pen);   // mousemove 와 다르게 기록한다 — 사다리 시계를 되감지 않게(_notePoke 주석)
          /* 🔑 main 이 알려 준 실제 상태(ig)가 내 캐시를 이긴다 — main ⓔ·ⓕ·ⓖ 가 혼자 통과로 되돌리면 캐시가 어긋나
             재판정 · 사다리 · focus 통로가 전부 침묵한다(옛 penHitTest(null) 은 150ms 디바운스를 타 가끔만 들었다).
             판단 규칙은 pokeStep — 끄는 동안은 mousemove 와 같은 끌기 보호(holdForDrag)를 정정 뒤 값으로 본다. */
          const p = clickPolicy.pokeStep({ pt, ignoreSent: _ignoreSent, dragging: drag() });
          if(p.resync){
            console.warn('[클릭통과] 캐시 불일치 — main=' + (pt.ig ? '통과' : '클릭받기')
                       + ' / 내가 보낸 값=' + (_ignoreSent ? '통과' : '클릭받기') + ' → 캐시 버리고 재판정');
            if(_ignoreDebounce){ clearTimeout(_ignoreDebounce); _ignoreDebounce = null; }
            _ignoring = null; _ignoreSent = null;
          }
          if(p.act === 'keep') return;
          _updateIgnore(p.x, p.y);   // 근처에서 벗어남(left · 구버전 null)은 화면 밖 좌표로 와서 통과 판정
        }catch(_){}
      });
    }
  }
}

return {

};
}

const api = { createDesktopRun };
if(typeof window !== 'undefined') window.TwDesktopRun = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
