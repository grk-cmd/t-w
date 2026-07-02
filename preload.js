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

  // 타이틀바 × 버튼 — 앱 완전 종료
  quitApp() {
    ipcRenderer.send('companion:quitApp');
  },

  // run 모드에서 캐릭터 크기에 맞춰 창 크기 조절 — 현재는 "전체화면 투명 오버레이" 방식이라
  // 창을 캐릭터 크기로 줄이면 전체화면 설정과 충돌해 깜빡임이 생김. 그래서 의도적으로 아무 것도 안 함.
  // (캐릭터는 CSS #scene{right:0;bottom:0}로 우측 하단에 고정됨)
  resizeWidget(w, h) {
    /* no-op: 전체화면 오버레이에서는 창 리사이즈하지 않음 */
  },

  // 클릭 통과 on/off. ignore=true면 마우스가 창을 통과해 뒤 창으로 감.
  setIgnoreMouse(ignore) {
    ipcRenderer.send('companion:setIgnoreMouse', !!ignore);
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

  // idx(0~3) 슬롯에 "지금 막 포커스를 떠난 프로그램(설정 패널 열기 직전에 쓰던 프로그램)"을 등록.
  // 반환: {ok:true, app:{name,path,title}} 또는 {ok:false, reason}
  registerFocusApp(idx) {
    return ipcRenderer.invoke('companion:registerFocusApp', idx);
  },

  // 슬롯 해제
  clearFocusApp(idx) {
    ipcRenderer.send('companion:clearFocusApp', idx);
  },

  // 현재 슬롯 상태 조회: Promise<[{name,path,title}|null, ...4개]>
  getFocusApps() {
    return ipcRenderer.invoke('companion:getFocusApps');
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
});