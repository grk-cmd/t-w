const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const activeWin = require('active-win');
const { autoUpdater } = require('electron-updater');

// 투명 창 지원 활성화 (이건 가벼움 — GPU 합성은 유지해서 렉 없음)
app.commandLine.appendSwitch('enable-transparent-visuals');

let mainWindow = null;

// ---- 자동 업데이트 (electron-updater + GitHub Releases) ----
// package.json의 build.publish에 설정된 GitHub 저장소(grk-cmd/t-w)의 Releases를 확인해서,
// 새 버전이 있으면 백그라운드로 내려받고, renderer(설정 패널 등)에 상태를 알려서 사용자가 재시작 버튼을
// 누르면 설치가 적용되게 함. 다운로드까지는 자동, "지금 재시작해서 적용"은 사용자 확인을 받음(작업 중 갑자기
// 꺼지는 것 방지).
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;   // 사용자가 명시적으로 재시작 버튼을 눌러야 설치되게(예상치 못한 종료 방지)

function sendUpdateStatus(status, extra){
  if(mainWindow && !mainWindow.isDestroyed()){
    mainWindow.webContents.send('companion:updateStatus', { status, ...extra });
  }
}
autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
autoUpdater.on('update-available', (info) => sendUpdateStatus('available', { version: info.version }));
autoUpdater.on('update-not-available', () => sendUpdateStatus('none'));
autoUpdater.on('download-progress', (p) => sendUpdateStatus('downloading', { percent: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', (info) => sendUpdateStatus('downloaded', { version: info.version }));
autoUpdater.on('error', (e) => sendUpdateStatus('error', { message: String(e && e.message || e) }));

// 사용자가 타이틀바를 드래그해서 옮긴 런처 창 위치 (기억해뒀다가 다음에 config 모드로 돌아올 때 재사용)
let savedLauncherPos = null;   // {x, y}

// run 모드(캐릭터 실행)를 띄울 디스플레이 id. null이면 주 모니터.
// 설정에서 "모니터 N" 버튼을 누르면 그 디스플레이 id로 세팅되고, run 모드면 즉시 창을 옮긴다.
// (세션 한정 — 재시작하면 주 모니터로 초기화)
let runDisplayId = null;

// runDisplayId에 해당하는 디스플레이 객체를 반환. 없거나 못 찾으면 주 모니터.
function getRunDisplay(){
  const all = screen.getAllDisplays();
  if(runDisplayId != null){
    const found = all.find(d => d.id === runDisplayId);
    if(found) return found;
  }
  return screen.getPrimaryDisplay();
}

// "포커싱 어플" 등록 슬롯 — 최대 4개. { name, path } 형태로 저장(name=프로세스명, 예: chrome.exe)
// 세션 한정(재시작하면 초기화). 영구 저장하려면 나중에 파일/localStorage 연동 가능.
let focusApps = [null, null, null, null];

// 우리 앱 자신의 실행 파일 경로 — active-win 결과에서 자신을 걸러내기 위함
const SELF_EXE = path.basename(process.execPath).toLowerCase();

// 마지막으로 "우리 앱이 아닌 다른 창"에 포커스가 있었을 때의 정보. 설정 패널에서 1~4번 버튼을
// 누르면 이 값을 그 슬롯에 등록한다(=버튼 누르기 직전까지 쓰고 있던 프로그램).
let lastForeignWindow = null;   // { name, path, title }

// uiohook 전역 클릭/키 이벤트에 실어 보낼, 매 순간의 "활성 프로세스 판정" 캐시.
// (500ms 폴링에서 갱신 — uiohook 이벤트마다 activeWin()을 새로 부르면 느리므로 캐시 재사용)
let lastActiveState = { exeName:'', isFocusedAppRegistered:false, hasAnyRegistered:false };

// 현재 활성 창이 우리 앱이 아니면 lastForeignWindow를 갱신 — 500ms 주기로 폴링.
// (active-win 자체가 폴링 기반 API라 이벤트 리스너가 없음)
let _pollTimer = null;
function startActiveWinPolling(){
  if(_pollTimer) return;
  _pollTimer = setInterval(async ()=>{
    try{
      const w = await activeWin();
      if(!w || !w.owner) return;
      const exeName = path.basename(w.owner.path || w.owner.name || '').toLowerCase();
      if(exeName && exeName !== SELF_EXE){
        lastForeignWindow = { name: exeName, path: w.owner.path || '', title: w.title || '' };
      }
      const isFocusedAppRegistered = !!(exeName && focusApps.some(f => f && f.name === exeName));
      lastActiveState = { exeName, isFocusedAppRegistered, hasAnyRegistered: focusApps.some(Boolean) };
      if(mainWindow && !mainWindow.isDestroyed()){
        mainWindow.webContents.send('companion:activeAppState', lastActiveState);
      }
    }catch(e){ /* active-win이 가끔 실패할 수 있음(권한 등) — 무시하고 다음 폴링 */ }
  }, 500);
}

// 모드별 창 크기.
// launcher: 세로로 긴 카드 (lc-card 320px + 여백)
// creator : 가로로 넓은 모달 (creatorModal 680px + 여백)
// run     : 전체화면 (아래에서 workAreaSize로 처리)
const MODE_SIZE = {
  launcher: { w: 380, h: 680 },
  creator:  { w: 740, h: 620 },
};
const CONFIG_WIDTH = MODE_SIZE.launcher.w;
const CONFIG_HEIGHT = MODE_SIZE.launcher.h;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: CONFIG_WIDTH,        // 시작은 config 모드 크기로 (런처가 먼저 뜨니까)
    height: CONFIG_HEIGHT,
    x: Math.round((width - CONFIG_WIDTH) / 2),
    y: Math.round((height - CONFIG_HEIGHT) / 2),
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,          // 네이티브 드래그(-webkit-app-region:drag) 허용 명시
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,   // 창이 뒤로 가도 렌더링 계속 (흰 화면/멈춤 방지)
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'app', 'desk-companion-prototype.html'));

  // 네이티브 드래그(app-region:drag)로 창이 실제 움직였을 때 위치 기억 — 런처 크기일 때만.
  // (전체화면/생성기 크기일 때는 기억 안 함 — 다음 번 런처 열 때 그 자리 그대로 쓰기 위함)
  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const b = mainWindow.getBounds();
    if (b.width === MODE_SIZE.launcher.w && b.height === MODE_SIZE.launcher.h) {
      savedLauncherPos = { x: b.x, y: b.y };
    }
  });

  // mainWindow.webContents.openDevTools({ mode: 'detach' });
  // F12로 개발자도구 토글 (frame:false 창은 기본 메뉴/단축키가 없어서 직접 등록해야 함)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  startActiveWinPolling();

  // 창이 뜨고 나서 업데이트 확인 시작 (초기 로딩과 겹치지 않게 살짝 지연).
  // 개발 중(npm start)엔 electron-updater가 "패키징 안 된 앱"이라며 에러를 내는 게 정상이라 무시해도 됨 —
  // 실제 설치된 exe에서만 정상 동작함.
  setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}); }, 3000);

  // 렌더러가 "지금 재시작해서 설치" 버튼을 눌렀을 때 — 다운로드 완료된 업데이트를 설치하며 앱 재시작
  ipcMain.on('companion:installUpdate', () => { autoUpdater.quitAndInstall(); });

  // ---- IPC: "포커싱 어플" 슬롯 관리 ----

  // 슬롯에 lastForeignWindow(직전에 쓰던 프로그램)를 등록. idx: 0~3
  ipcMain.handle('companion:registerFocusApp', (e, idx) => {
    if(idx<0 || idx>3) return { ok:false, reason:'bad-index' };
    if(!lastForeignWindow) return { ok:false, reason:'no-window' };
    focusApps[idx] = { ...lastForeignWindow };
    return { ok:true, app: focusApps[idx] };
  });

  // 슬롯 해제
  ipcMain.on('companion:clearFocusApp', (e, idx) => {
    if(idx>=0 && idx<=3) focusApps[idx] = null;
  });

  // 현재 슬롯 상태 조회 (설정 패널 열 때 등)
  ipcMain.handle('companion:getFocusApps', () => focusApps);

  // ---- IPC: 멀티 모니터 ----

  // 연결된 모든 디스플레이 목록 반환. renderer가 설정 패널에 "모니터 N" 버튼을 그리는 데 사용.
  // 반환: [{ id, label, isPrimary, isCurrent, bounds:{x,y,width,height} }, ...]
  ipcMain.handle('companion:getDisplays', () => {
    const all = screen.getAllDisplays();
    const primaryId = screen.getPrimaryDisplay().id;
    const curId = getRunDisplay().id;
    return all.map((d, i) => ({
      id: d.id,
      label: `모니터 ${i+1}` + (d.id === primaryId ? ' (주)' : ''),
      isPrimary: d.id === primaryId,
      isCurrent: d.id === curId,
      bounds: d.bounds,
    }));
  });

  // 선택한 디스플레이로 run 모드 창을 옮긴다. id는 getDisplays가 준 값.
  // run 모드가 아니면(런처/생성기) 선택만 기억해뒀다가 다음 run 진입 때 반영.
  ipcMain.handle('companion:moveToDisplay', (e, displayId) => {
    const all = screen.getAllDisplays();
    const target = all.find(d => d.id === displayId);
    if(!target) return { ok:false, reason:'not-found' };
    runDisplayId = displayId;
    // 지금 run 모드(전체화면 오버레이 크기)라면 즉시 그 모니터로 이동
    if(mainWindow && !mainWindow.isDestroyed()){
      const b = mainWindow.getBounds();
      const isRunSize = (b.width !== MODE_SIZE.launcher.w && b.width !== MODE_SIZE.creator.w);
      if(isRunSize){
        const wa = target.workArea;
        mainWindow.setBounds({ x: wa.x, y: wa.y, width: wa.width, height: wa.height });
      }
    }
    return { ok:true, id: displayId };
  });

  // ---- IPC: renderer(preload)에서 오는 요청 처리 ----

  // config 모드(런처/생성기) ↔ run 모드(캐릭터 실행) 전환
  // mode: 'launcher' | 'creator' | 'run'
  ipcMain.on('companion:setConfigMode', (e, isConfig, mode) => {
    if (!mainWindow) return;
    const display = getRunDisplay();
    const wa = display.workAreaSize;
    const waPos = display.workArea;   // {x, y, width, height} — 전역 좌표계에서의 작업영역(멀티모니터 대응)
    if (isConfig) {
      // 설정 화면: mode에 따라 크기 다름. 사용자가 옮긴 적 있으면 그 위치, 없으면 선택된 모니터 중앙.
      const sz = MODE_SIZE[mode] || MODE_SIZE.launcher;
      mainWindow.setResizable(true);
      const useX = (mode==='launcher' && savedLauncherPos) ? savedLauncherPos.x : Math.round(waPos.x + (wa.width - sz.w) / 2);
      const useY = (mode==='launcher' && savedLauncherPos) ? savedLauncherPos.y : Math.round(waPos.y + (wa.height - sz.h) / 2);
      mainWindow.setBounds({ x: useX, y: useY, width: sz.w, height: sz.h });
      mainWindow.setResizable(false);
    } else {
      // 실행 화면: 선택된 모니터를 꽉 채우는 전체화면 투명 오버레이 (전역 좌표 x/y 포함 → 2번 모니터도 정확히 이동)
      mainWindow.setBounds({ x: waPos.x, y: waPos.y, width: wa.width, height: wa.height });
    }
  });

  // 창 드래그 이동 (run 모드 deskBar grip 등, 수동 dx/dy 방식이 필요한 경우용)
  ipcMain.on('companion:moveWindow', (e, dx, dy) => {
    if (!mainWindow) return;
    const b = mainWindow.getBounds();
    mainWindow.setBounds({ x: b.x + dx, y: b.y + dy, width: b.width, height: b.height });
  });

  // 타이틀바 X 버튼 — 앱 완전 종료
  ipcMain.on('companion:quitApp', () => { app.quit(); });

  // run 모드에서 캐릭터 크기에 맞춰 창 크기 조절
  // 현재는 전체화면 오버레이 방식이라 미사용(preload에서 no-op). 나중에 "작은 창" 방식으로
  // 되돌릴 경우를 대비해 핸들러만 남겨둠.
  ipcMain.on('companion:resizeWidget', (e, w, h) => {
    // 의도적으로 비활성. 필요해지면 아래 주석 해제.
    // if (!mainWindow) return;
    // const b = mainWindow.getBounds();
    // mainWindow.setBounds({ x: b.x, y: b.y, width: Math.max(1, w), height: Math.max(1, h) });
  });

  // 클릭 통과 토글: ignore=true면 마우스가 창을 통과해 뒤 창으로 감.
  // forward:true 덕분에 무시 중에도 mousemove 이벤트는 계속 renderer로 들어와서
  // "캐릭터 위로 마우스가 돌아왔는지"를 판정할 수 있음.
  ipcMain.on('companion:setIgnoreMouse', (e, ignore) => {
    if (!mainWindow) return;
    mainWindow.setIgnoreMouseEvents(!!ignore, { forward: true });
  });

  // ---- 전역 입력 감지 (uiohook-napi) ----
  // 창에 포커스가 없어도(다른 앱 사용 중이어도) 마우스 클릭/키보드 입력을 감지해 renderer로 전달.
  // 캐시된 최신 활성 프로세스 판정(lastActiveState, 500ms 폴링)을 함께 실어 보내서
  // renderer가 "등록된 앱을 쓰는 중일 때만 반응"하도록 필터링할 수 있게 함.
  uIOhook.on('click', (e) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('companion:globalClick', { x: e.x, y: e.y, button: e.button, ...lastActiveState });
  });
  uIOhook.on('keydown', (e) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('companion:globalKey', { ...lastActiveState });
  });
  uIOhook.start();
  app.on('before-quit', () => { try { uIOhook.stop(); } catch (_) {} });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});