const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('companion', {
  // 설정 화면(런처/생성기) ↔ 실행 화면 전환. isConfig=true면 작은 창, false면 전체화면 투명.
  // mode: 'launcher'|'creator'|'run' — 화면별 창 크기 구분용
  setConfigMode(isConfig, mode) {
    ipcRenderer.send('companion:setConfigMode', !!isConfig, mode || 'launcher');
  },

  // 컨트롤 바 grip을 드래그해서 창을 옮길 때 (dx, dy = 이전 프레임 대비 이동량)
  moveWindow(dx, dy) {
    ipcRenderer.send('companion:moveWindow', dx, dy);
  },

  // 🔔 작업표시줄 버튼 깜빡임 — 초대가 왔을 때 on(true), 처리(수락/거절/닫기)했을 때 off(false).
  //   ⚠️ 반드시 짝으로 부를 것. true 만 부르면 유저가 창을 누를 때까지 계속 깜빡인다.
  //   ⚠️ main 이 isFocused() 를 보고 스스로 건너뛴다 — 여기서 판단하지 않는다.
  //     run 모드는 전체화면 투명 오버레이라 "보인다"와 "포커스가 있다"가 다르고,
  //     그림 도구에 포커스가 있을 때는 깜빡이는 게 맞다.
  flashFrame(on) {
    ipcRenderer.send('companion:flashFrame', !!on);
  },

  // 타이틀바 × 버튼 — 앱 완전 종료
  quitApp() {
    ipcRenderer.send('companion:quitApp');
  },

  // 🔁 앱 재시작 — 계정 연동 해제 / 구글 로그아웃이 부른다. 껐다 켜야 초대 게이트가 다시 돈다
  //   (게이트는 부팅 때 한 번만 도는 검사라, 세션 도중에 신원을 놓아도 화면은 그대로 남는다).
  // ⚠️ 구버전 앱에는 이 채널이 없다 — 부르는 쪽은 반드시 존재 여부를 확인하고,
  //   없으면 기존처럼 '지금 종료' 안내로 물러날 것.
  relaunchApp() {
    ipcRenderer.send('companion:relaunchApp');
  },

  // run 모드에서 캐릭터 크기에 맞춰 창 크기 조절 — 현재는 "전체화면 투명 오버레이" 방식이라
  // 창을 캐릭터 크기로 줄이면 전체화면 설정과 충돌해 깜빡임이 생김. 그래서 의도적으로 아무 것도 안 함.
  // (캐릭터는 CSS #scene{right:0;bottom:0}로 우측 하단에 고정됨)
  resizeWidget(w, h) {
    /* no-op: 전체화면 오버레이에서는 창 리사이즈하지 않음 */
  },

  // 클릭 통과 on/off. ignore=true면 마우스가 창을 통과해 뒤 창으로 감.
  // 👆 펜 앱에서 커서가 캐릭터 근처에 왔을 때 main이 정밀 히트테스트를 요청 (좌표 또는 null=벗어남)
  onPenHitTest(callback) {
    ipcRenderer.on('companion:penHitTest', (e, data) => callback(data));
  },
  setIgnoreMouse(ignore) {
    ipcRenderer.send('companion:setIgnoreMouse', !!ignore);
  },

  // 🖊️ 펜 활동 — WinTab 태블릿처럼 전역 클릭/키 훅에 안 잡히는 입력 보완.
  // 펜 앱이 활성일 때만, 커서가 실제로 움직였을 때 초당 최대 1회 호출됨. 인자 없음.
  onPenActivity(callback) {
    ipcRenderer.on('companion:penActivity', () => callback());
  },

  // 전역 마우스 클릭 감지 — 다른 앱에 포커스가 있어도 호출됨.
  // callback({x, y, button, exeName, isFocusedAppRegistered, hasAnyRegistered})
  onGlobalClick(callback) {
    ipcRenderer.on('companion:globalClick', (e, data) => callback(data));
  },

  // 전역 키보드 입력 감지 — 다른 앱에서 타이핑해도 호출됨.
  // callback({exeName, isFocusedAppRegistered, hasAnyRegistered})
  onGlobalKey(callback) {
    ipcRenderer.on('companion:globalKey', (e, data) => callback(data));
  },

  // 시스템 전체 유휴시간 — 전역 클릭/키 입력 시각을 기준으로 renderer(app.js)에서 자체 계산하는 게 더 간단해서
  // 여기서는 별도 구현 없이 onGlobalClick/onGlobalKey로 대체. (호출은 안전하게 받아만 둠)
  onIdle(callback) {
    // 사용하지 않음 — app.js가 onGlobalClick/onGlobalKey로 활동 시간을 직접 갱신함
  },

  // ---- 포커싱 어플 (전역감지를 특정 프로그램에서만 작동하게 제한) ----

  // idx(0~7) 슬롯에 "지금 막 포커스를 떠난 프로그램(설정 패널 열기 직전에 쓰던 프로그램)"을 등록.
  // 반환: {ok:true, app:{name,path,title}} 또는 {ok:false, reason}
  registerFocusApp(idx) {
    return ipcRenderer.invoke('companion:registerFocusApp', idx);
  },

  // 슬롯 해제
  clearFocusApp(idx) {
    ipcRenderer.send('companion:clearFocusApp', idx);
  },

  // 📋 지금 떠 있는 창 목록 조회: Promise<{ok:true, list:[{name,path,title}]} | {ok:false, reason}>
  //   자동 등록(registerFocusApp)이 '방금 전 활성 창'을 집는 것과 달리, 이건 지금 열려 있는 창을
  //   전부 돌려준다. 게임처럼 등록 직전에 다른 창이 한 번 끼어드는 경우에 사람이 직접 고르라고 쓴다.
  //   ⚠️ 관리자 권한으로 뜬 창은 목록에도 안 나온다(Windows UIPI) — 그건 OS 경계다.
  listWindows() {
    return ipcRenderer.invoke('companion:listWindows');
  },

  // 목록에서 고른 창을 idx 슬롯에 직접 등록: Promise<{ok:true, app}|{ok:false, reason}>
  setFocusApp(idx, app) {
    return ipcRenderer.invoke('companion:setFocusApp', idx, app);
  },

  // 현재 슬롯 상태 조회: Promise<[{name,path,title}|null, ...8개]>
  getFocusApps() {
    return ipcRenderer.invoke('companion:getFocusApps');
  },

  // 시스템 전체 유휴 시간(초) — 자동 자리비움 판정용. OS가 계산한 값이라 마우스 이동도 포함됨.
  // 실패 시 null.
  getIdleSeconds() {
    return ipcRenderer.invoke('companion:getIdleSeconds');
  },

  // ---- 멀티 모니터 ----

  // 연결된 디스플레이 목록 조회: Promise<[{id,label,isPrimary,isCurrent,bounds},...]>
  getDisplays() {
    return ipcRenderer.invoke('companion:getDisplays');
  },

  // 선택한 디스플레이로 run 모드 창 이동: Promise<{ok:true,id}|{ok:false,reason}>
  moveToDisplay(displayId) {
    return ipcRenderer.invoke('companion:moveToDisplay', displayId);
  },

  // 활성 프로세스 상태 실시간 구독 — callback({exeName, isFocusedAppRegistered, hasAnyRegistered})
  // 설정 패널에서 "지금 이 프로그램이 등록돼 있어요" 같은 표시나, sleep 판정에 사용.
  onActiveAppState(callback) {
    ipcRenderer.on('companion:activeAppState', (e, data) => callback(data));
  },

  // ---- 자동 업데이트 ----

  // 업데이트 상태 변화 구독 — callback({status, version?, percent?, message?})
  // status: 'checking' | 'available' | 'none' | 'downloading' | 'downloaded' | 'error'
  onUpdateStatus(callback) {
    ipcRenderer.on('companion:updateStatus', (e, data) => callback(data));
  },

  // 다운로드 완료된 업데이트를 지금 설치하며 앱 재시작
  installUpdate() {
    ipcRenderer.send('companion:installUpdate');
  },

  // 광고 배너·플레이리스트 우클릭 등 — URL을 **시스템 기본 브라우저**(크롬·웨일 등)로 연다.
  //   main.js 가 shell.openExternal 로 넘긴다(http/https 만 허용).
  //   ⚠️ 예전 주석이 "앱 안의 작은 창으로 연다"라고 돼 있었는데 그건 옛 구현이다. 앱 안에 뜨는
  //     작은 창은 이것이 아니라 BGM 자식창(openBgm / openPlaylistTrack)이다.
  openBrowser(url) {
    ipcRenderer.send('companion:openBrowser', url);
  },

  // ---- 마이홈 BGM (유튜브 임베드 자식창) ----
  // 유튜브 임베드 URL로 자식 BrowserWindow 열기(이미 열려있으면 URL 교체 = 곡 변경). title은 커스텀 타이틀바 표시용.
  openBgm(url, title) {
    ipcRenderer.send('companion:openBgm', url, title || '');
  },
  // BGM 자식창 닫기 (창 파괴 — 마이홈 종료 시에만 사용)
  closeBgm() {
    ipcRenderer.send('companion:closeBgm');
  },
  // 마이홈 창(#myHomeWin)의 현재 스크린 좌표를 main.js에 전달 — BGM 창이 그 뒤로 정확히 숨을 수 있게.
  //   renderer가 DOM 드래그로 마이홈을 옮길 때마다 호출. {x,y,w,h}는 뷰포트 좌표(window.screenX/Y 반영은
  //   main.js에서 mainWindow.getBounds()로 보정).
  setBgmBounds(rect) {
    ipcRenderer.send('companion:setBgmBounds', rect);
  },
  // ▐▐: 영상만 일시정지 (창은 그대로 유지)
  pauseBgm() {
    ipcRenderer.send('companion:pauseBgm');
  },
  // ▶ (창 있을 때): 일시정지된 영상 재개
  resumeBgm() {
    ipcRenderer.send('companion:resumeBgm');
  },
  // 🔊 음량 (0~1) — 🎵 플레이리스트의 음량 슬라이더. 마이홈 BGM과 창을 공유하므로 둘 다에 걸린다.
  //   창이 아직 없어도 main이 값을 기억해 두고, 다음에 곡을 열 때 그 음량으로 시작한다.
  //   ⚠️ main의 감시 루프가 매 tick마다 v.volume을 되돌리기 때문에, 실제 적용은 페이지 전역
  //     __bgmVol 을 거친다(main.js companion:setBgmVolume 참고). 여기서는 값만 넘긴다.
  setBgmVolume(v) {
    ipcRenderer.send('companion:setBgmVolume', v);
  },
  // 🔁 한 곡 반복 on/off — true 면 재생 창이 곡을 <video>.loop 로 되풀이한다(끝나도 TWPL:ended 를 안 보낸다).
  //   렌더러가 곡을 열기 직전과 반복 종류를 바꿀 때 부른다. 창이 없어도 main 이 값을 기억한다.
  //   ⚠️ 구버전 앱에는 이 채널이 없다 — 부르는 쪽은 존재 여부를 확인하고, 없으면 옛 방식
  //     (곡이 끝나면 같은 주소를 다시 연다)으로 물러날 것.
  setBgmLoop(on) {
    ipcRenderer.send('companion:setBgmLoop', !!on);
  },
  // BGM 자식창이 (유저가 × 눌러 등) 닫혔을 때 renderer에 알림 — ▐▐→▶ 아이콘 복귀 등에 사용
  onBgmClosed(callback) {
    ipcRenderer.on('companion:bgmClosed', ()=>callback());
  },
  // ---- 🎵 상태칩 플레이리스트 ----
  // 마이홈 BGM과 창을 하나 공유하되, 마이홈 좌표에 종속되지 않는 배치로 한 곡을 재생.
  // 소유권 규칙은 '나중에 튼 쪽이 이긴다' — 이걸 부르면 마이홈 BGM은 진다.
  openPlaylistTrack(url, title) {
    ipcRenderer.send('companion:openPlaylistTrack', url, title || '');
  },
  // 🎵 플레이리스트 패널(#myPlaylistBox)의 현재 위치를 main에 전달 — 재생 창이 그 뒤로 정확히 숨게.
  //   패널이 닫혀 있으면 null (숨을 곳이 없으므로 main이 창을 투명하게 만든다).
  setPlBounds(rect) {
    ipcRenderer.send('companion:setPlBounds', rect || null);
  },
  // 곡이 끝났거나 재생할 수 없을 때 — callback('ended' | 'err')
  onBgmTrackEnd(callback) {
    ipcRenderer.on('companion:bgmTrackEnd', (e, kind) => callback(kind));
  },
  // BGM 창 소유권이 바뀔 때 — callback('home' | 'playlist'). 진 쪽이 자기 재생표시를 내린다.
  onBgmMode(callback) {
    ipcRenderer.on('companion:bgmMode', (e, mode) => callback(mode));
  },
  // 방명록 창 blur-자동닫힘 잠시 유예 (파일 다이얼로그를 열기 직전에 호출)
  gbHold() {
    ipcRenderer.send('companion:gbHold');
  },
  // 👑 디자인 스튜디오 창 blur-자동닫힘 잠시 유예
  dsHold() {
    ipcRenderer.send('companion:dsHold');
  },
  // 🎨 OS 색 선택 대화상자를 여는 동안 '항상 위'를 잠시 비켜달라고 알림.
  //   open=true 로 열기 직전에, open=false 로 색을 고르거나 취소한 직후에 호출.
  //   (안 불러도 main이 포커스 복귀·90초 안전망으로 스스로 복구한다)
  colorDialog(open) {
    ipcRenderer.send('companion:colorDialog', !!open);
  },
  // 👑 네이티브 이미지 파일 선택 — dataURL 반환 (취소 시 null)
  pickImage() {
    return ipcRenderer.invoke('companion:pickImage');
  },

  // ---- 그림 도구 사용 중 캐릭터 근처 판정용 (스마트 감지) ----
  // 렌더러가 계산한 캐릭터 화면 좌표(mainWindow 클라이언트 좌표계)와 반경을 100ms throttle로 전달.
  // main.js가 이 값을 uIOhook mousemove와 비교해서, 펜 앱(클립스튜디오 등) 활성 중이더라도
  // 마우스가 캐릭터 근처에 오면 잠시 forward=true로 전환해서 hover/클릭 가능하게 함.
  setCharBounds(bounds) {
    ipcRenderer.send('companion:setCharBounds', bounds);
  },

  /* ❌ [폐기 2026-08-26] getNoActivate / setNoActivate / setTextInput 은 걷어냈다.
     '활성화되지 않는 창'(WS_EX_NOACTIVATE) 실험의 통로였는데, 그 창에서는 한/영 전환이
     원리적으로 불가능해서(IME 는 포그라운드 창에 묶인다) 실험 자체를 폐기했다.
     ⚠️ 다시 파지 말 것 — main.js 폐기 주석과 handoff-focus-steal-5.md §7 을 먼저 읽을 것. */
  // ---- 🎬 영상 겹침 실험 (설정 → 시스템) ----
  // 화면공유 영상이 검어지거나 깜빡이는 증상 대응. 오버레이 창에 반투명(알파 252)을 걸어
  // 크로미움의 '가리는 창' 판정에서 영구히 빠지게 한다 — main.js 의 OVERLAY_LAYERED_ALPHA 주석 참조.
  //   ⚠️ **알파만** 바꾼다. 아래틈(overlayBottomGap)은 안 건드린다 — 그건 최대화 창을 쓰는
  //     사용자의 방어라, 실험 때문에 뺏으면 안 된다.
  //   ⚠️ 구버전 앱에는 이 채널이 없다 — 부르는 쪽은 존재 여부를 확인하고, 없으면 토글을 숨길 것.
  // 현재 상태 조회: Promise<{on:boolean, alpha:number}>
  getLabVideo() {
    return ipcRenderer.invoke('companion:getLabVideo');
  },
  // 켜기/끄기: Promise<{ok:true, on:boolean}> — 재시작 없이 즉시 반영된다.
  setLabVideo(on) {
    return ipcRenderer.invoke('companion:setLabVideo', !!on);
  },

  // 🩺 진단 기록(tw-mouse-diag.log)이 있는 폴더를 파일 탐색기로 연다: Promise<{ok}>
  //   제보를 받을 때 "이 폴더의 파일을 보내주세요" 대신 버튼 하나로 끝내려는 것.
  openDiagFolder() {
    return ipcRenderer.invoke('companion:openDiagFolder');
  },

  // ---- 버전 게이트 ----
  // 현재 앱 버전 조회(예: "0.6.1"): Promise<string|null>. 방 입장 시 config/minRoomVer와 비교.
  getAppVersion() {
    return ipcRenderer.invoke('companion:getAppVersion');
  },

  // ---- 자동 시작 (로그인 시 실행) ----
  // 현재 자동 시작이 켜져 있는지 조회: Promise<boolean>
  getAutoLaunch() {
    return ipcRenderer.invoke('companion:getAutoLaunch');
  },
  // 자동 시작 켜기/끄기: Promise<boolean>  (실제 반영된 상태를 되돌려줌)
  setAutoLaunch(enable) {
    return ipcRenderer.invoke('companion:setAutoLaunch', !!enable);
  },

  // ---- 🔑 구글 로그인 (계정 연동) ----
  // 별도 창에서 구글 OAuth 를 돌리고 **ID 토큰만** 돌려준다:
  //   Promise<{ok:true, idToken} | {ok:false, reason}>
  //   렌더러는 이 토큰으로 firebase signInWithCredential 을 부른다(firebase-init.js).
  // ⚠️ 이름이 위의 setAutoLaunch("로그인 시 실행" = 윈도우 자동시작)와 헷갈리기 쉽다.
  //   저건 OS 자동시작, 이건 계정 로그인이다. 둘은 아무 관계가 없다.
  // ⚠️ 유저가 창을 그냥 닫으면 {ok:false, reason:'로그인이 취소됐어요'} 가 온다 —
  //   반드시 실패 경로를 처리할 것. 안 하면 버튼이 '눌러도 반응 없는' 상태로 남는다.
  signInWithGoogle() {
    return ipcRenderer.invoke('companion:signInWithGoogle');
  },
});