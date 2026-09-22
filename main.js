const { app, BrowserWindow, BrowserView, screen, ipcMain, shell, powerMonitor, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
// ── 전역 입력 훅·활성 창 감지는 sysinput-win.js 로 옮겼다 ──
//   갈래와 주입은 아래 오버레이 갈래 옆에 있다(activeWin 도 거기서 온다).
const { autoUpdater } = require('electron-updater');

/* 🪟 앱 아이콘 — **창/작업표시줄에 뜨는** 아이콘. 안 주면 일렉트론 기본(원자 모양)이 그대로 나온다.
   .ico 안에 크기별로 다른 그림이 들어 있고 윈도우가 알아서 골라 쓴다:
     16·24·32px → tw-mini(TW 로고)  /  48·64·128·256px → tw-icon(창 그림)
     64px 원본을 32px 이하로 줄이면 창 안의 글자가 뭉개져서, 작은 칸은 미니 로고로 갈아 끼운 것.
   ⚠️ **설치본(.exe)과 설치 마법사 아이콘은 이 값이 아니다** — 그건 package.json 의
     build.win.icon(build/icon.ico)이 정한다. 아이콘을 바꿀 땐 두 곳을 같이 갱신할 것.
   ⚠️ asar 안에서도 읽힌다(일렉트론이 asar 경로를 처리). 경로만 맞으면 개발/설치본 둘 다 동작. */
const APP_ICON = path.join(__dirname, 'app', 'assets', 'icon', 'tw-icon.ico');

// 투명 창 지원 활성화 (이건 가벼움 — GPU 합성은 유지해서 렉 없음)
app.commandLine.appendSwitch('enable-transparent-visuals');
/* ★★ 동영상(유튜브·넷플릭스) 위에 캐릭터가 겹치면 그 영역이 검게 나오는 문제 대응.
   원인: 윈도우는 동영상을 '하드웨어 오버레이 평면(MPO)'에 직접 올리는데, 그 위에 DirectComposition으로
   합성되는 투명 창이 겹치면 DWM이 합성 경로를 못 잡아 검게 표시된다.
   이 스위치는 '창을 화면에 올리는 방식'만 예전 방식으로 되돌린다 — GPU 래스터화(3D 렌더링)는 그대로라
   disableHardwareAcceleration()처럼 앱이 느려지지 않는다.
   ※ 되돌리려면 이 한 줄만 주석 처리하면 된다.
   ※ 일부 GPU·드라이버에서 투명 창이 깨질 수 있어(검은 배경·테두리) 반드시 실기기 확인 필요. */
// app.commandLine.appendSwitch('disable-direct-composition');
//   ↑ 시도했으나 효과 없음(2026-07-23). 검은 화면은 '크롬 쪽' 합성에서 생기는데 이 스위치는 우리
//     프로세스에만 적용되기 때문. 투명도·성능에 해는 없었지만 일부 GPU에서 투명 창이 깨질 위험만
//     남아 비활성화. 같은 시도를 반복하지 않도록 기록만 남겨둠.
/* ★ [실험 기록 2026-07-25] 브라우저 스크롤 시 화면이 멈췄다 클릭해야 갱신되는 문제.
   ① disable-gpu-compositing → 증상 해결되나 창 합성이 CPU로 넘어가 앱이 매우 무거워짐. 비활성.
   ② FPS_UNFOCUSED를 12로 낮춤(app.js) → 앱은 가벼워지나 스크롤 멈춤은 그대로. 프레임 수 무관 확인.
   → 원인은 '전체화면 투명 오버레이가 GPU 합성 표면을 점유'하는 것 자체. NVIDIA+Electron의 알려진
     상호작용(NVIDIA 포럼 2년째 미해결, electron#43122). 우리 앱 버그가 아님.
   ③ [시도중] disable-features=EnableTransparentHwndEnlargement — 투명 창을 화면 전체로 '확장'하는
     Chromium 기능만 끈다. 전체 합성을 CPU로 넘기지 않아 ①보다 가벼울 것으로 기대(codex#20413 제안).
     효과/부작용 없으면 이 줄만 지우면 원복. 실기기 확인 필수(앱 완전 재시작). */
// app.commandLine.appendSwitch('disable-features', 'EnableTransparentHwndEnlargement');  // ③ 효과 없음(2026-07-25)
/* ═══ 🪟 오버레이 플랫폼 갈래 ══════════════════════════════════════════════════
   [2026-09-12] 갭 · 레이어드 알파 · 기하 로그 둘을 overlay-win.js 로 옮겼다.
     동작 변경 0 — 값도 조건도 주석도 그대로다. 배경은 handoff-platform-split.md §1-④.
   ⚠️ **클릭 통과(setIgnoreMouseEvents)는 안 옮겼다.** 이 파일에 그대로 있다 —
     uIOhook 커서 폴링과 한 몸이라 오버레이 축이 아니라 두 축의 접점이다.
   ⚠️ overlay-mac.js 가 생기기 전까지 darwin 에서는 이 require 가 실패한다. 의도된 상태다
     (핸드오프 ⑤ 이전에는 Mac 코드를 한 줄도 쓰지 않는다). */
const overlay = process.platform === 'darwin'
  ? require('./overlay-mac')
  : require('./overlay-win');
/* 주입 — 셋 다 함수 선언이라 호이스팅되므로 여기서 불러도 안전하다(값이 아니라 통로를 넘긴다). */
overlay.init({
  getWin:     () => mainWindow,
  getDisplay: () => getRunDisplay(),
  log:        (msg) => _diagLog(msg),
});
/* ═══ ⌨️ 전역 입력·활성 창 플랫폼 갈래 ═══════════════════════════════════════
   [2026-09-12] 훅을 걸고 푸는 일과 창 열거를 sysinput-win.js 로 옮겼다.
     동작 변경 0 — 값도 조건도 순서도 그대로다. 배경은 handoff-platform-split.md §1-④.
   ⚠️ **핸들러 본문은 안 옮겼다.** 판정과 IPC 전송은 이 파일에 그대로 있다(아래 앱 준비 구간).
     클릭 통과(setIgnoreMouseEvents)도 마찬가지다 — 핸드오프 §4-②.
   ⚠️ sysinput-mac.js 가 생기기 전까지 darwin 에서는 이 require 가 실패한다. 의도된 상태다. */
const sysinput = process.platform === 'darwin'
  ? require('./sysinput-mac')
  : require('./sysinput-win');
sysinput.init({
  log: (msg) => _diagLog(msg),
});
/* 호출부 17곳의 이름·형태를 그대로 두기 위한 이음매 — 본문은 모듈에 있다.
   ⚠️ 화살표 상수가 아니라 **함수 선언**이다. 원래가 그랬고(호이스팅), 여기서 모양을 바꾸면
     정의보다 앞선 자리에서 부르는 코드가 생겼을 때 조용히 TDZ 로 죽는다. */
async function activeWin(){ return sysinput.getActiveWindow(); }
let _gapMigratedFrom = null;             // 승격이 일어났으면 옛 값 — 부팅 로그에 한 줄 남긴다

/* 🔁 **같은 요청을 다시 적용하지 않는다** — setConfigMode 중복 억제.

   [실측] 제보자 로그 30분치에 `[오버레이] run 진입` 이 **906줄** 찍혔다.
     ・평균 분당 30회, 최다 분당 57회, 그중 **355건은 앞 줄과 100ms 이내**
     ・그런데 창 rect 는 906번 **전부 동일**했다(1920x1020@638,1202). 바뀐 게 하나도 없다.
   [왜 이렇게 자주 오나] 렌더러의 applyDesktopRunClass 가 조건 없이 이 IPC 를 보내고,
     그 함수는 layoutSeats 래퍼 끝에 붙어 있다 — 호출부가 38곳 + resize 리스너다.
     친구 입장·채팅·presence 갱신마다 도니, 사용자가 다른 프로그램을 쓰는 내내 초당 1회꼴로 온다.
   [무엇이 나빴나] 한 번마다 세 가지가 같이 나갔다.
     ⓐ setBounds + setAlwaysOnTop — 크로미움은 **창 이동·리사이즈·포그라운드 변경 훅**에서
        가려짐(occlusion)을 16ms 뒤 재계산한다. 그 훅을 초당 한 번씩 두들긴 셈이라,
        뒤에서 재생 중인 영상이 그 주기로 다시 합성돼 **깜빡깜빡**으로 보인다.
     ⓑ overlay.logGeometry(overlay-win.js) → _diagLog → **fs.appendFileSync** (메인 프로세스 동기 디스크 쓰기).
        906회가 로그 상한 256KB 를 채워, 정작 필요한 클릭고착 기록이 그 시점부터 끊겼다.
     ⓒ setAlwaysOnTop 이 2초마다 불리니 [포커스] 진단의 `raise=` 가 **언제 봐도 최근**이 되어,
        "우리가 창을 올렸는가" 를 판정할 수 없게 됐다(신호가 잡음에 묻힘).

   [해법] **창의 실제 현재 상태**와 비교해서 같으면 아무것도 하지 않는다.
     ⚠️ 캐시한 '직전에 보낸 값' 이 아니라 mainWindow.getBounds() 를 본다 — 사용자가 grip 으로
       창을 옮겼거나 OS 가 크기를 조정했으면 캐시는 거짓말을 한다. 실제 상태를 보면 그때는
       자동으로 다시 적용된다(자가 복구).
     ⚠️ _isConfigMode 갱신은 이 판정보다 **먼저** 끝난다 — 안전장치들이 보는 플래그라
       한 번이라도 건너뛰면 안 된다.
     ★ 생략한 횟수는 다음 실제 적용 때 한 줄로 같이 남긴다. 이 수정이 듣는지를 다음 로그의
       `run 진입` 줄 수로 바로 검증할 수 있게. */
let _ovSkipped = 0;
function _sameRect(a, b){
  return !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
function _winAlreadyIs(rect, wantAlwaysOnTop){
  if(!mainWindow || mainWindow.isDestroyed()) return false;
  try{
    if(mainWindow.isAlwaysOnTop() !== !!wantAlwaysOnTop) return false;
    const now = mainWindow.getBounds();
    if(_sameRect(now, rect)) return true;            // 원하는 그대로다 — 평상시 경로
    /* 🩺 [2026-08-26] **OS 가 요청과 다른 크기를 돌려주는 경우가 있다.**
       (고정 크기 제약·배율 반올림·작업영역 스냅 등. 실측: 갭 0 + 배율 1.5 에서 1 DIP 이 삼켜짐)
       그때 위 비교는 영원히 거짓이라, 같은 요청이 초당 여러 번 다시 나가고 그 setBounds 하나하나가
       크로미움의 가려짐 재계산 훅이 된다 — 고치려던 깜빡임을 우리 손으로 만드는 자리다.
       ⇒ "같은 요청을 이미 걸었고, 그 뒤로 창이 스스로 움직이지도 않았다"면 다시 걸어도 결과가
         같으므로 생략한다.
       ⚠️ 캐시만 믿지 않는다는 원래 원칙은 지킨다 — `got` 는 **적용 직후 관측한 실제 값**이고,
         지금 실제 값과 대조한다. 사용자가 grip 으로 창을 옮기면 `now` 가 달라져 자동 재적용된다. */
    if(_lastApplied
       && _lastApplied.top === !!wantAlwaysOnTop
       && _sameRect(_lastApplied.req, rect)
       && _sameRect(_lastApplied.got, now)) return true;
    return false;
  }catch(_){ return false; }
}
/* 창을 실제로 맞춘 직후에 부른다 — 요청값과 OS 가 돌려준 값을 짝으로 기억한다.
   ⚠️ 크기를 정하는 자리마다 반드시 같이 부를 것. 빠뜨리면 그 경로에서만 억제가 죽는다
     (sim-overlay-gap.js 가 자리 수를 센다). */
let _lastApplied = null;   // { req, got, top }
function _noteApplied(rect, wantAlwaysOnTop){
  try{ _lastApplied = { req: rect, got: mainWindow.getBounds(), top: !!wantAlwaysOnTop }; }
  catch(_){ _lastApplied = null; }
}

// ★ 마이홈 BGM(유튜브 임베드) 소리 재생 — Chromium 기본 정책은 file:// 원본에서 오디오 자동재생을
//   차단(음소거로 재생). 이 스위치로 유저 gesture 없이도 자동재생 허용 → 유튜브 IFrame API의
//   unMute()+playVideo()가 정상 동작.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
/* ★ 가끔 캐릭터가 멈췄다가 클릭하면 다시 움직이는 문제 대응.
   webPreferences.backgroundThrottling:false 는 이미 켜져 있지만, 그것과 별개로 Chromium은
   '다른 창에 완전히 가려진(occluded) 창'과 '오래 비활성인 렌더러'를 자체 판단으로 재우는 경로가 있다.
   이 두 스위치가 그 판단 자체를 끈다(렌더링만 계속 시킬 뿐이라 위험도 낮음). */
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

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

/* ── 🍎 맥은 자동 업데이트를 안 한다 (0.9.7~) ───────────────────────────────
   맥판은 **애플 서명·공증이 없다.** electron-updater 의 맥 갈래는 서명된 zip + `latest-mac.yml`
   을 전제로 하므로, 올려 봐야 설치 단계에서 실패한다. 그래서 릴리즈에 맥용 yml 을 아예 안 올리고
   **dmg 직접 받기**로 간다(arm64 = 애플 실리콘 · x64 = 인텔).
   ⇒ `checkForUpdates()` 를 맥에서 부르면 켤 때마다 yml 404 로 실패해 'error' 만 쌓인다.
     아래 `startUpdateCheck()` 가 플랫폼을 갈라 **맥에서는 부르지 않는다.**
   대신 릴리즈의 최신 태그만 읽어서 새 버전이면 «받으러 가기» 안내를 렌더러에 보낸다 —
   내려받기·설치는 사용자가 브라우저에서 한다(renderer 의 `#updateReadyBanner` 재활용).
   ★ 나중에 애플 개발자 프로그램으로 서명·공증을 하면 이 갈래를 지우고 zip + `latest-mac.yml` 을
     릴리즈에 함께 올리면 원래대로 돌아온다. 지울 곳은 여기와 `startUpdateCheck()` 두 군데뿐. */

/* 릴리즈 주소는 package.json 의 build.publish 에서 읽는다 — 저장소 이름을 여기 또 적으면
   저장소를 옮길 때 한쪽만 바뀐다(맥 안내만 옛 저장소를 가리키는 조용한 고장). */
function githubRepoInfo(){
  try{
    const pub = require('./package.json').build.publish;
    const gh = (Array.isArray(pub) ? pub : [pub]).find(p => p && p.provider === 'github');
    if(gh && gh.owner && gh.repo) return { owner: gh.owner, repo: gh.repo };
  }catch(_){}
  return null;
}

/* '0.9.7' · 'v0.10.0' → 숫자 비교. 자리 수가 다르면 없는 자리를 0 으로 본다.
   ⚠️ 문자열 비교로 하면 '0.10.0' < '0.9.7' 이 된다 — 두 자리 마이너가 나오는 순간 조용히 틀린다. */
function isNewerVersion(tag, cur){
  const pick = (s) => String(s || '').replace(/^v/i, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
  const a = pick(tag), b = pick(cur);
  for(let i = 0; i < Math.max(a.length, b.length); i++){
    const x = a[i] || 0, y = b[i] || 0;
    if(x !== y) return x > y;
  }
  return false;
}

/* 맥: 최신 릴리즈 태그만 한 번 읽는다. 실패하면 조용히 넘어간다(안내가 없을 뿐, 앱은 그대로 돈다).
   ⚠️ 주기적으로 다시 읽지 않는다 — 새 타이머를 만들면 그것대로 관리 대상이 하나 는다.
     켤 때 한 번이면 «새 버전 나왔다» 를 알리기에 충분하다. */
function checkMacUpdate(){
  const info = githubRepoInfo();
  if(!info) return;
  const opt = {
    host: 'api.github.com',
    path: `/repos/${info.owner}/${info.repo}/releases/latest`,
    headers: { 'User-Agent': 'together-working', 'Accept': 'application/vnd.github+json' },
    timeout: 8000,
  };
  let req;
  try{
    req = require('https').get(opt, (res) => {
      if(res.statusCode !== 200){ res.resume(); return; }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; if(body.length > 262144) req.destroy(); });
      res.on('end', () => {
        try{
          const j = JSON.parse(body);
          const tag = j && (j.tag_name || j.name);
          if(!tag || !isNewerVersion(tag, app.getVersion())) return;
          /* 주소도 응답에서 받은 것만 쓴다(직접 조립하지 않는다). https 가 아니면 안 보낸다 —
             렌더러는 이 값을 그대로 openBrowser 에 넘긴다. */
          const url = (j.html_url && /^https:\/\//i.test(j.html_url)) ? j.html_url : null;
          if(!url) return;
          sendUpdateStatus('mac-available', { version: String(tag).replace(/^v/i, ''), url });
        }catch(_){}
      });
    });
  }catch(_){ return; }
  req.on('timeout', () => { try{ req.destroy(); }catch(_){} });
  req.on('error', () => {});
}

/* 업데이트 확인의 **유일한 입구.** 플랫폼 갈래를 여기 한 곳에만 둔다 —
   호출부에 `process.platform` 을 흩어 놓으면 나중에 한 군데를 빠뜨린다. */
function startUpdateCheck(){
  if(process.platform === 'darwin'){ checkMacUpdate(); return; }
  autoUpdater.checkForUpdates().catch(() => {});
}

// 사용자가 타이틀바를 드래그해서 옮긴 창 위치 — 모드(launcher/creator)별로 각각 기억해뒀다가
// 다음에 같은 모드로 돌아올 때 재사용. (run 모드는 항상 화면을 꽉 채우므로 대상 아님)
let savedPos = { launcher: null, creator: null };   // { x, y } | null

// 현재 창 크기가 어느 모드에 해당하는지 판별 (launcher/creator 크기가 다르므로 크기로 구분 가능)
// ★ 정확히 같은 픽셀이 아니라 오차범위(TOL) 안이면 매칭 — 디스플레이 배율(125%/150% 등)에서
//   setBounds→getBounds를 오가며 1~2px 반올림 오차가 생기는 경우가 있어서, 그 오차 때문에
//   sizeToMode가 null을 반환해 "creator로 갈 때 현재 위치 유지" 로직이 깨지고 화면 중앙으로
//   튀어버리는 문제가 있었음(캐릭터 생성 버튼만 눌러도 이 경로를 타서 재현됨).
const SIZE_MATCH_TOL = 3;
/* 📐 [2026-09-15 제보 1·2] 모드별로 **실제로 맞춘 크기**. MODE_SIZE 보다 작을 수 있다 — 아래
     _fitConfigRect 가 작업영역에 안 들어가는 창을 줄였을 때. sizeToMode 는 이 값도 그 모드로
     인정해야 한다. 안 그러면 줄어든 런처를 옮겨도 'moved' 가 위치를 안 남기고, creator 진입이
     «run 에서 왔다» 로 오판해 중앙으로 튄다. */
const _fittedSize = {};   // mode → { w, h }
function sizeToMode(w, h){
  const close = (a,b) => Math.abs(a-b) <= SIZE_MATCH_TOL;
  for(const m of ['launcher','creator','animal','myhome']){
    const sz = MODE_SIZE[m], fit = _fittedSize[m];
    if(!(close(w, sz.w) || (fit && close(w, fit.w)))) continue;
    if(close(h, sz.h) || (fit && close(h, fit.h))) return m;
  }
  return null;
}

/* ═══ 📐 [2026-09-15 제보 1·2] 런처 창이 잘린 채 뜬다 (첫 부팅 · 주모니터 변경) ═══════════
   [증상] 런처(380×680 고정)가 위 또는 아래가 잘린 채 뜨고, 실행 모드로 들어가면 정상.
   [원인] 크기가 **작업영역보다 크다.** 1920×1080 을 배율 150% 로 쓰면 화면이 1280×720 DIP 이고
     작업표시줄을 빼면 680 언저리 아래로 내려간다. 그러면
       ① 중앙 계산 (wa.height − 680)/2 가 음수 → y 가 작업영역 위로 나가 위가 잘리고,
       ② 그게 아니어도 OS 가 창 높이를 깎아 아래가 잘린다(_noteApplied 주석의 «OS 가 크기를 깎아도»).
     주모니터를 배율이 다른 모니터로 바꾸면 같은 조건이 되고, 실행 모드는 전체화면이라 거기서 풀린다.
     ⚠️ savedPos 는 메모리 변수라 «지난 세션 좌표가 남았다» 는 원인이 아니다 — 첫 부팅은 늘 중앙이다.
   [대응] 크기를 정하는 자리는 전부 이 함수를 지난다.
     ・크기: min(MODE_SIZE, 작업영역). 배율이 몇이든 조건은 하나(작업영역 < 창)라 배율별 분기가 없다.
     ・위치: 기억한 자리가 있으면 그 자리가 **있는 모니터**(getDisplayMatching)의 작업영역 안으로
       클램프. 사용자가 다른 모니터로 옮겨 둔 자리를 원래 모니터로 끌어오지 않기 위해서다.
       기억이 없으면 준 display 의 중앙.
     ・줄인 크기는 _fittedSize 에 남긴다(sizeToMode 가 본다). 작업영역이 다시 커지면 min 이
       원래 크기를 돌려주므로 따로 복구 코드가 없다.
   ✅ 받는 쪽: 런처 HTML 이 창보다 긴 카드를 스크롤할 수 있어야 한다(#launcher overflow · .lc-card margin:auto). */
function _fitConfigRect(mode, sz, display, remembered){
  let wa = display.workArea;
  if(remembered){
    try{ wa = screen.getDisplayMatching({ x: remembered.x, y: remembered.y, width: sz.w, height: sz.h }).workArea; }catch(_){}
  }
  const w = Math.min(sz.w, wa.width);
  const h = Math.min(sz.h, wa.height);
  let x = remembered ? remembered.x : Math.round(wa.x + (wa.width  - w) / 2);
  let y = remembered ? remembered.y : Math.round(wa.y + (wa.height - h) / 2);
  x = Math.max(wa.x, Math.min(x, wa.x + wa.width  - w));
  y = Math.max(wa.y, Math.min(y, wa.y + wa.height - h));
  _fittedSize[mode] = { w, h };
  return { x, y, width: w, height: h };
}

// run 모드(캐릭터 실행)를 띄울 디스플레이 id. null이면 주 모니터.
// 설정에서 "모니터 N" 버튼을 누르면 그 디스플레이 id로 세팅되고, run 모드면 즉시 창을 옮긴다.
// ★ 재시작해도 유지되도록 tw-settings.json(사용자 데이터 폴더)에 저장/복원함(아래 loadSettings/saveSettings).
let runDisplayId = null;
/* ★ 재부팅 후 설정이 풀리던 원인 —
   Electron의 display.id는 OS가 주는 값이라 "이 모니터의 영구 식별자"가 아니다. 재부팅·드라이버 갱신,
   특히 Windows에서 주 모니터를 바꾸면 id가 통째로 재발급된다. 그러면 저장해둔 runDisplayId와
   일치하는 디스플레이가 없어서 getRunDisplay가 조용히 주 모니터로 폴백했다(설정은 파일에 멀쩡히
   남아 있는데 화면만 원래대로 돌아온 것처럼 보임).
   그래서 id와 별개로 "해상도·위치·회전·배율" 지문을 함께 저장해두고, id가 안 맞으면 지문으로 찾는다. */
let runDisplayKey = null;
function _displayKey(d){
  if(!d) return null;
  const b = d.bounds || {};
  return [b.width + 'x' + b.height, b.x + ',' + b.y,
          d.rotation || 0, Math.round((d.scaleFactor || 1) * 100)].join('|');
}
function _displaySize(d){ const b = (d && d.bounds) || {}; return b.width + 'x' + b.height; }

// 설정 저장 파일 경로 — app.getPath('userData')는 'ready' 이후에만 안전하게 값이 나오므로
// app.whenReady() 안에서 한 번 초기화한 뒤 사용.
let SETTINGS_PATH = null;

// 저장된 설정(runDisplayId + 지문) 불러오기. 파일이 없거나(최초 실행) 손상돼 있으면 조용히 기본값(주 모니터) 유지.
function loadSettings(){
  try{
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const data = JSON.parse(raw);
    if(typeof data.runDisplayId === 'number') runDisplayId = data.runDisplayId;
    if(typeof data.runDisplayKey === 'string') runDisplayKey = data.runDisplayKey;
    /* ★ 동영상 검어짐 틈 — 빌드 없이 조절하는 통로. 제보자에게 "이 파일의 이 숫자만 바꿔서
       다시 켜 보세요" 라고 할 수 있다. 값을 넣은 적이 없으면 위 기본값을 그대로 쓴다.
       (설정 UI 에 안 내놓는다 — 사용자가 만질 값이 아니라 진단용이다) */
    if(typeof data.overlayBottomGap === 'number' && isFinite(data.overlayBottomGap)){   // ★ 물리 픽셀 단위
      const fileGap = Math.max(0, Math.min(overlay.GAP_MAX, Math.round(data.overlayBottomGap)));
      const fileVer = (typeof data.overlayGapVer === 'number') ? data.overlayGapVer : 0;
      /* 🚚 옛 세대 파일이고 값이 **옛 기본값 그대로**면 새 기본값으로 올린다(위 상수 주석).
         손으로 넣은 값(0 이나 20 같은 것)은 목록에 없으므로 그대로 존중된다. */
      if(fileVer < overlay.GAP_VER && overlay.GAP_LEGACY.indexOf(fileGap) >= 0){
        overlay.setGap(overlay.GAP_DEFAULT);
        _gapMigratedFrom = fileGap;
      } else {
        overlay.setGap(fileGap);
      }
    }
    /* 🎬 레이어드 알파 — 설정 → 시스템 → '영상 겹침 실험' 토글이 쓰는 값(켜짐 252 / 꺼짐 0).
       ⚠️ 갭과 **별개 통로**다. 토글은 갭을 건드리지 않는다 — 갭 0 은 "최대화 방어를 끈다"는
         뜻이라 제보자에게는 순손해이고, 우리가 갈래를 가를 때만 파일로 직접 넣는 값이다. */
    if(typeof data.overlayLayeredAlpha === 'number' && isFinite(data.overlayLayeredAlpha)){
      overlay.setAlpha(Math.max(0, Math.min(255, Math.round(data.overlayLayeredAlpha))));
    }
    /* 🔍 전체 화면 크기 — 없거나 깨졌으면 100%. 창이 아직 없을 수 있으므로 값만 들고 있다가
       createWindow 의 did-finish-load 에서 applyUiZoom 이 실제로 건다. */
    if(typeof data.uiZoom === 'number' && isFinite(data.uiZoom)) uiZoom = _clampZoom(data.uiZoom);
    /* 🗑️ [2026-08-26] `overlayNoActivate` 는 **읽지 않는다.** 아래 saveSettings 도 안 쓴다.
       NOACTIVATE 실험이 폐기됐기 때문이다(핸드오프5 §7). 옛 파일에 값이 남아 있어도 그냥 무시되고,
       다음 저장 때 키가 사라진다 — 실험을 켠 채로 제보한 사용자가 앱만 새로 받으면 복구된다. */
  }catch(e){ /* 최초 실행 등으로 파일이 없을 수 있음 — 무시 */ }
}
// 현재 설정을 파일에 저장. 실패해도(권한 등) 앱 동작에는 지장 없음 — 다음 실행에서 주 모니터로 뜨는 정도.
/* ⚠️ [2026-08-26] 예전에는 실패를 `catch(e){ /* 무시 *\/ }` 로 통째로 삼켰다. 그래서
     "설정 파일이 왜 없느냐"를 제보로 받아도 **저장을 시도했는데 실패한 것인지, 애초에
     시도조차 안 한 것인지** 구분할 방법이 없었다. 실제로 답은 후자였다(_ensureSettingsFile 주석).
   ⇒ 실패를 로그에 남기고 성공 여부를 돌려준다. 로그는 한 번만 — 매 저장마다 찍으면 로그가 덮인다. */
/* ═══ 🔍 전체 화면 크기(렌더러 줌) — 한 값 한 통로 [2026-09-16 제보 3-2 · F-1] ═══════════════
   [경위] 확대/축소 통로가 둘이었다. 설정 › 캐릭터 › 화면 크기는 아바타존만 키우고(app.js _charScaleMap),
     Ctrl+Shift++ / Ctrl+- 는 **우리 코드에 없는** 일렉트론 기본 메뉴 가속기가 렌더러 전체를 키웠다.
     그래서 «몇 %인지 알 방법이 없고 되돌릴 기준도 없었다». 팝업이 앞 팝업의 절반만 따라오는 제보(F-2)도
     이 줌과 좌표계(CSS px ↔ DIP)가 한 번 어긋났을 때 나오는 모양이다.
   [원칙] **줌은 이 파일의 `applyUiZoom` 한 곳만 바꾼다.** 단축키(before-input-event)·Ctrl+휠(zoom-changed)·
     설정 버튼(IPC) 셋이 전부 여기로 온다. 기본 줌을 막지 않고 «같은 값에 묶는다» — 되던 것이 계속 되고,
     숫자는 거짓말을 안 한다. 값은 tw-settings.json 에 저장돼 다음 부팅에 그대로다. 초기화 = 100%.
   ★ 좌표계: 렌더러는 CSS px 로 살고, 이 파일은 DIP 로 산다. 줌이 z 면 **DIP = CSS × z** 다.
     · 렌더러 → main (setCharBounds 의 캐릭터 원·창 사각형): 받을 때 × z  (_zoomIn)
     · main → 렌더러 (_sendHitTest 의 커서 좌표):           보낼 때 ÷ z  (_zoomOut)
     이 둘을 빼면 줌을 켠 순간 클릭 통과 판정(ⓕ·ⓖ·펜 근접)이 전부 z 배 어긋난다 — 제보 3-1 의 «넓은 영역이
     클릭을 먹는다» 와 같은 모양이 **줌만으로도** 난다. 채널을 늘리지 않고 값만 환산한다.
   ⚠️ 모니터별로 나누지 않는다 — `_charScaleMap` 은 아바타존 크기라 모니터마다 다르게 두는 뜻이 있지만,
     렌더러 줌은 창 하나에 한 값이다(webContents 단위). 나눌 이유가 생기면 그때 키를 늘린다. */
const UI_ZOOM_MIN = 0.5, UI_ZOOM_MAX = 2.0, UI_ZOOM_STEP = 0.1;
let uiZoom = 1;
function _clampZoom(z){
  const n = Number(z);
  if(!isFinite(n) || n <= 0) return 1;
  return Math.round(Math.max(UI_ZOOM_MIN, Math.min(UI_ZOOM_MAX, n)) * 100) / 100;
}
/* op: 'in' | 'out' | 'reset' | 숫자(배율) | 'get' */
function _zoomStep(cur, op){
  if(op === 'in')    return _clampZoom(cur + UI_ZOOM_STEP);
  if(op === 'out')   return _clampZoom(cur - UI_ZOOM_STEP);
  if(op === 'reset') return 1;
  if(typeof op === 'number') return _clampZoom(op);
  return _clampZoom(cur);
}
function applyUiZoom(op, why){
  const next = _zoomStep(uiZoom, op);
  const changed = next !== uiZoom;
  uiZoom = next;
  if(mainWindow && !mainWindow.isDestroyed()){
    try{ mainWindow.webContents.setZoomFactor(uiZoom); }catch(_){}
    /* 렌더러가 설정 창의 숫자를 맞추게 알려 준다. 구버전 preload(onUiZoom 없음)는 그냥 무시한다. */
    try{ mainWindow.webContents.send('companion:uiZoom', uiZoom); }catch(_){}
  }
  if(changed){ saveSettings(); _diagLog('[줌] ' + Math.round(uiZoom * 100) + '% (' + (why || op) + ')'); }
  return uiZoom;
}
const _zoomIn  = v => v * uiZoom;   // CSS px → DIP
const _zoomOut = v => v / uiZoom;   // DIP → CSS px
/* 단축키 — 일렉트론 기본 메뉴의 zoomIn/zoomOut/resetZoom 가속기를 **가로채** 위 한 통로로 보낸다.
   ⚠️ `input.key` 는 Ctrl+Shift+= 이면 '+', Ctrl+= 이면 '=' 다. 넷 다 잡아야 «되던 조합»이 다 된다.
   ⚠️ meta(Cmd)도 본다 — mac 판(핸드오프 §4). Alt 가 섞이면 다른 뜻이므로 놔둔다. */
function _zoomKeyOp(input){
  if(!input || input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return null;
  const k = input.key;
  if(k === '=' || k === '+' || input.code === 'NumpadAdd') return 'in';
  if(k === '-' || k === '_' || input.code === 'NumpadSubtract') return 'out';
  if(k === '0' || input.code === 'Numpad0') return 'reset';
  return null;
}
let _saveFailLogged = false;
function saveSettings(){
  if(!SETTINGS_PATH) return false;
  try{
    /* 📁 폴더가 없으면 writeFileSync 는 ENOENT 로 죽는다. userData 는 보통 Electron 이 만들어
       두지만, 그 한 갈래 때문에 "파일이 왜 없나"를 또 못 가르는 일이 없도록 여기서 확정한다.
       (_diagLog 도 같은 폴더를 쓴다 — 폴더가 없으면 로그조차 안 남아 관찰 자체가 막힌다) */
    try{ fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true }); }catch(_){}
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ runDisplayId, runDisplayKey,
      overlayBottomGap: overlay.gap(),
      overlayGapVer: overlay.GAP_VER,          // 🚚 이 값을 적어야 승격이 두 번 일어나지 않는다
      overlayLayeredAlpha: overlay.alpha(),
      uiZoom }));                              // 🔍 전체 화면 크기 — applyUiZoom 만 바꾼다
    _saveFailLogged = false;
    return true;
  }catch(e){
    if(!_saveFailLogged){
      _saveFailLogged = true;
      _diagLog('[설정] 저장 실패 — ' + ((e && e.code) ? e.code + ' ' : '')
        + (e && e.message ? e.message : '?') + ' | ' + SETTINGS_PATH);
    }
    return false;
  }
}

/* 📄 [2026-08-26] 설정 파일이 없으면 부팅 때 만든다.
   [왜 안 생겼나 — 버그가 아니라 설계였다]
     파일을 만드는 유일한 자리가 getRunDisplay 안의 저장이었는데, 그 함수는
       if(!found) return screen.getPrimaryDisplay();
     로 **먼저 빠져나간다.** runDisplayId·runDisplayKey 가 둘 다 null 인 사람(=설정에서 모니터를
     한 번도 고른 적 없는 사람)은 found 가 null 이라 저장 줄에 **영원히 도달하지 못한다.**
     ⇒ 모니터를 고른 적 있는 사람만 파일이 생겼다. 그게 "파일이 없는 사람" 의 정체다.
   [왜 만들어야 하나]
     ⚠️ **이것으로 영상 블라인드가 낫지는 않는다.** 파일이 없으면 기본값(현재 12)을 쓰는데,
       그건 파일이 있는 사람의 옛 값(2·6)보다 오히려 큰 값이다. 갭 갈래로는 설명이 안 된다.
     만드는 이유는 진단이다:
       ・제보를 받을 때 "이 파일을 보내주세요"가 성립한다(지금은 없어서 막힌다)
       ・"이 숫자만 바꿔 보세요" 안내가 성립한다(없는 파일은 고칠 수 없다)
       ・overlayGapVer 가 기록되어 다음 기본값 승격이 이 사람에게도 걸린다
   ⚠️ 값은 **아무것도 바꾸지 않는다.** 지금 메모리에 있는 값을 그대로 적을 뿐이다.
     여기서 기본값을 손보면 파일 없던 사람의 동작이 조용히 달라진다. */
/* ⚠️ [2026-08-26 추가] **파일이 있을 때도 반드시 한 줄 남긴다.** 만들 때만 남기면
     "코드가 안 돌았다(옛 빌드)"와 "이미 있어서 안 만들었다"가 로그에서 구분되지 않는다.
     ⇒ 줄이 아예 없다 = 옛 빌드. 그 판단을 **줄의 부재가 아니라 줄의 내용으로** 하려고 앱
       버전도 같이 적는다(핸드오프6 §6-2 1·2번이 하려던 일을 한 줄로 끝낸다). */
function _ensureSettingsFile(){
  if(!SETTINGS_PATH) return;
  let ver = '?';
  try{ ver = app.getVersion(); }catch(_){}
  let exists = false;
  try{ exists = fs.existsSync(SETTINGS_PATH); }catch(_){}
  if(exists){
    /* 🚚 승격(§2-2)이 일어났어도 **여기서 저장하지 않는다.** createWindow 가 승격 로그를 찍고
       그 자리에서 saveSettings() 를 부른 뒤 플래그를 지운다 — 이미 닫혀 있는 구멍이다.
       (2026-08-27 에 "안 닫혀 있다"고 잘못 보고 여기에 저장을 한 번 넣었다가 되돌렸다.
        createWindow 쪽을 먼저 확인할 것 — 그쪽이 없어지면 sim 의 해당 검사가 ✗ 를 낸다) */
    _diagLog('[설정] 파일 있음 — 앱 ' + ver
      + ' | 아래틈 ' + overlay.gap() + ' | 알파 ' + overlay.alpha()
      + (_gapMigratedFrom != null ? ' | 승격 대기 ' + _gapMigratedFrom : ''));
    return;
  }
  const okSave = saveSettings();
  _diagLog('[설정] 파일이 없어 새로 만듦 — ' + (okSave ? '성공' : '실패') + ' | 앱 ' + ver
    + ' | 아래틈 ' + overlay.gap() + ' | 알파 ' + overlay.alpha());
}

/* ═══ ❌ [폐기 2026-08-26] '활성화되지 않는 창'(WS_EX_NOACTIVATE) — 다시 만들지 말 것 ═══
   `setFocusable(false)` 로 오버레이를 '클릭은 받되 포그라운드가 안 되는 창'으로 만들면
   포커스 뺏김이 원리적으로 사라진다. GitHub 사례(electron#5994·#23106, openai/codex#26577)도 그렇게 한다.
   **그래서 실제로 만들어 봤고, 실패해서 여기서 통째로 걷어냈다.**

   ⛔ 벽은 IME 다. Windows 의 한/영 전환은 **포그라운드 창의 입력 컨텍스트**에 묶인다.
      WS_EX_NOACTIVATE 는 정의상 "포그라운드가 되지 않는 창"이다 — 두 요구가 **서로 배타적**이라
      코드로 우회할 수 있는 종류의 문제가 아니다. 영문만 입력되고 한/영 전환이 죽었던 이유가 이것이다.
      단축키(document 레벨 keydown)도 같이 죽었다. 승격(setFocusable(true)+focus())으로 살리려 했지만
      실제 포그라운드가 만들어지지 않아 끝내 안 먹었다.

   ⛔ 이미 실패한 시도 — 반복 금지: 상시 적용 / 입력칸(focusin)만 예외 / 우리 UI 클릭 시 승격 /
      자기 blur 무시 / 전역 키 훅으로 단축키 재구현(IME 는 애초에 못 만든다) / hover 시 미리 승격.
   ⇒ 자세한 경위는 handoff-focus-steal-5.md §7. 원인 치료는 이 길이 아니라 **UI 영역 공유**다
     (아래 _lastRegions·_ptOnOurUI). 그쪽은 §7 과 완전히 독립이고, 지금 켜져 있다.
   ⇒ 정말 다시 손대야 한다면 남은 길은 **2창 구조**뿐이다(핸드오프4 §4-4): 큰 오버레이는 통과 고정,
     클릭·입력은 캐릭터 크기의 작은 **평범한** 창이 받는다. 그 창은 IME 가 정상 동작한다. */

/* runDisplayId(또는 지문)에 해당하는 디스플레이를 반환. 못 찾으면 주 모니터.
   순서대로 세 번 시도한다 — 뒤로 갈수록 느슨하지만, 애매하면 주 모니터로 안전하게 물러난다.
     1) id 정확히 일치            — 재부팅 안 했으면 여기서 끝
     2) 지문 정확히 일치          — id만 재발급된 경우(재부팅 등)
     3) 해상도가 같은 게 딱 하나  — 주 모니터가 바뀌어 좌표까지 밀린 경우.
        같은 해상도가 둘 이상이면 어느 쪽인지 알 수 없으므로 추측하지 않고 주 모니터로 간다. */
function getRunDisplay(){
  const all = screen.getAllDisplays();
  let found = null;
  if(runDisplayId != null) found = all.find(d => d.id === runDisplayId) || null;
  if(!found && runDisplayKey) found = all.find(d => _displayKey(d) === runDisplayKey) || null;
  if(!found && runDisplayKey){
    const wantSize = runDisplayKey.split('|')[0];
    const sameSize = all.filter(d => _displaySize(d) === wantSize);
    if(sameSize.length === 1) found = sameSize[0];
  }
  if(!found) return screen.getPrimaryDisplay();
  // ★ 지문으로 찾아냈다면 새로 발급된 id로 갱신해 저장 — 다음 실행부터는 1번에서 바로 걸린다.
  if(found.id !== runDisplayId || _displayKey(found) !== runDisplayKey){
    runDisplayId = found.id; runDisplayKey = _displayKey(found);
    if(SETTINGS_PATH) saveSettings();
  }
  return found;
}

/* ═══ 🔑 판정 키 — "같은 프로그램인가"를 가르는 **유일한 축** ═══════════════════
   [왜 exe 이름을 그대로 안 쓰나 — handoff-platform-split.md §4-①]
     지금까지 판정은 `chrome.exe` 같은 **Windows 실행파일 이름**으로 했다. 그런데 macOS 에서
     같은 프로그램의 경로는 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` 이라
     같은 규칙(basename + 소문자)을 대면 `google chrome` 이 나온다 — 확장자가 없고 공백이 든다.
     **어떤 문자열 규칙으로도 `chrome.exe` 와 안 맞는다.**
   ⇒ 키에 플랫폼을 접두사로 박는다. 그러면 "안 맞는다"와 **"다른 플랫폼에서 등록한 것이라
     여기서는 셀 수 없다"** 가 구분된다. 후자를 구분 못 하면 달성 조건이 **조용히** 0초씩
     쌓이다 마는데, 에러도 안 나고 사용자는 왜 안 되는지 알 길이 없다. 그게 이 작업의 목적이다.

   [지금은 스칼라 `key`, 나중에 배열 `keys`]
     한 슬롯이 여러 플랫폼 키를 드는 모양(`keys`)은 서버 병합 규칙이 필요한데, mac 키 생성
     규칙 자체가 아직 실측 0건이라 지금 정할 수 없다. 그래서 **저장은 `key` 하나**로 하되
     **읽기는 처음부터 배열을 받아들인다**(keysOf). 나중에 넓힐 때 판정부는 한 글자도 안 바뀐다.
   ⚠️ `key` 와 `keys` 를 **둘 다 저장하지 말 것.** 진실의 출처가 둘이 되면 어긋났을 때
     누가 이기는지를 또 정해야 한다. 저장은 언제나 하나다.

   ⚠️ **판정은 반드시 keysOf 를 거칠 것.** 여기 말고 다른 데서 `.key` 나 `.name` 을 직접
     비교하면, 나중에 `keys` 로 넓힐 때 그 자리만 조용히 옛 모양으로 남는다
     (sim-overlay-gap.js 가 헛돌던 것과 같은 종류의 사고 — 핸드오프 §3). */
const KEY_PLATFORM = process.platform === 'darwin' ? 'mac' : 'win';
/* 프로세스 이름 → 이 기기의 판정 키. 빈 값은 빈 키로 — 던지면 활성 창 판정이 통째로 멎는다. */
function focusKeyOf(procName){
  const n = String(procName || '').trim().toLowerCase();
  return n ? (KEY_PLATFORM + ':' + n) : '';
}
/* 슬롯·달성조건 레코드에서 판정 키를 꺼내는 유일한 통로.
   ★ 승격은 반드시 'win:' 이다 — KEY_PLATFORM 이 아니다. `key` 가 없는 저장물은
     **Windows 에서만 쓰인 적이 있는 파일**이므로(mac 빌드가 존재한 적이 없다),
     mac 에서 읽었다고 'mac:' 을 붙이면 남의 기기 기록이 이 기기 것으로 둔갑한다. */
function keysOf(rec){
  if(!rec) return [];
  if(Array.isArray(rec.keys)) return rec.keys.filter(Boolean);   // ← 나중에 여기로 들어온다
  if(rec.key)  return [rec.key];                                  // ← 지금 쓰는 모양
  if(rec.exe)  return ['win:' + String(rec.exe).toLowerCase()];    // 옛 달성조건(서버)
  if(rec.name) return ['win:' + String(rec.name).toLowerCase()];   // 옛 focus-apps.json
  return [];
}

// "포커싱 어플" 등록 슬롯 — 최대 8개. { key, name, path, title } 형태로 저장
//   key  = 판정 축(예: 'win:chrome.exe'). 비교는 오직 이것으로 한다.
//   name = 표시용 원본 프로세스명(예: 'chrome.exe'). 설정 슬롯·달성표가 `.exe` 를 떼어 보여준다.
// ★ 예전엔 메모리에만 있어서 앱을 껐다 켜면 초기화되던 문제가 있었음 — 이제 파일로 저장해서 재시작해도 유지됨.
// app.getPath('userData')는 'ready' 이후에만 안전하므로, SETTINGS_PATH와 동일하게 app.whenReady() 안에서 초기화.
const FOCUS_APP_SLOTS = 8;
let FOCUS_APPS_FILE = null;
function emptyFocusApps(){ return new Array(FOCUS_APP_SLOTS).fill(null); }
function loadFocusApps(){
  try{
    const raw = fs.readFileSync(FOCUS_APPS_FILE, 'utf8');
    const arr = JSON.parse(raw);
    // ★ 4칸 → 8칸 확장. 기존 사용자의 저장 파일은 길이가 4라서 예전처럼 length===4만 통과시키면
    //   전부 버려지고 등록이 초기화된다. 길이와 상관없이 받아 8칸으로 맞춘다(넘치면 자르고 모자라면 null 채움).
    if(Array.isArray(arr)){
      const out = emptyFocusApps();
      for(let i=0; i<Math.min(arr.length, FOCUS_APP_SLOTS); i++) out[i] = arr[i] || null;
      /* ★ 승격 — `key` 가 없는 옛 저장물에 판정 키를 채운다.
           overlay 쪽 GAP_VER 승격과 같은 자리다: **개선이 기존 사용자에게 도달하지 않는 것**이
           진짜 사고였다(핸드오프 §0-①). 여기서 안 채우면 등록해 둔 사람 전원이 한 번
           해제했다 다시 등록하기 전까지 새 판정 축을 못 받는다.
         ⚠️ 'win:' 고정인 이유는 keysOf 주석 참고. 여기서 KEY_PLATFORM 을 쓰면 안 된다. */
      for(let i=0; i<out.length; i++){
        const a = out[i];
        if(a && !a.key && !Array.isArray(a.keys) && a.name){
          a.key = 'win:' + String(a.name).toLowerCase();
        }
      }
      return out;
    }
  }catch(e){}
  return emptyFocusApps();
}
function saveFocusApps(){
  try{ if(FOCUS_APPS_FILE) fs.writeFileSync(FOCUS_APPS_FILE, JSON.stringify(focusApps)); }catch(e){}
}
let focusApps = emptyFocusApps();   // app.whenReady() 안에서 loadFocusApps()로 실제 값 복원됨

// 우리 앱 자신의 실행 파일 경로 — active-win 결과에서 자신을 걸러내기 위함
// ⚠️ 이름 규칙(basename + 소문자)은 플랫폼마다 다르다. 그래서 값이 아니라 모듈에서 받는다.
const SELF_EXE = sysinput.selfProcName();

// (PowerShell fallback은 제거됨 — 셸 실행 순간 자기 자신(powershell.exe)이 활성 창으로 잡히는 결함.
//  활성 창 감지 실패의 근본 원인은 uiohook mousemove 전역 훅과 active-win의 간섭으로 판단되어
//  mousemove 훅을 제거하고 Electron 내장 screen.getCursorScreenPoint 폴링으로 교체함. 아래 참고.)

// ── 그림 도구/펜 태블릿 앱 화이트리스트 ────────────────────────────────
// 클립스튜디오·포토샵 등에서 선이 직선이 되거나 트래킹이 버벅이는 문제:
//   원인은 mainWindow.setIgnoreMouseEvents(true, {forward:true})의 forward 옵션 — 오버레이 창이
//   mousemove를 계속 렌더러로 전달하면서 태블릿/펜 앱의 이벤트 큐가 이중 경로로 처리돼 스무딩이 어긋남.
// 대응:
//   1) 이 화이트리스트에 있는 앱이 활성 창이면 forward를 자동으로 끔 — 이벤트가 오버레이를 완전히 통과.
//   2) 트레이드오프: forward가 꺼진 상태에서는 캐릭터 hover 감지가 안 됨(=마우스 얹어도 통과 상태 유지).
//      그림 그리는 동안엔 어차피 캐릭터를 만질 일이 없으니 자연스러움. 다른 창으로 전환하면 자동 복귀.
const PEN_APPS = new Set([
  // Clip Studio Paint — 실행 파일이 여러 개다. 어느 게 활성이든 펜 앱으로 치는 게 안전하다:
  //   틀리면 그 앱에서 펜 활동 감지가 통째로 안 도는데, 반대로 넉넉히 넣어서 생기는 손해는
  //   그 창을 쓰는 동안 캐릭터 hover가 스마트 감지(_penMouseNearChar) 경유로만 되는 정도라 미미하다.
  'clipstudiopaint.exe',   // 그림 (실제 캔버스)
  'clipstudio.exe',        // 런처/포털
  'clipstudiomodeler.exe', // 3D 모델러
  'clipstudioaction.exe',  // 애니메이션
  // Adobe
  'photoshop.exe', 'illustrator.exe', 'animate.exe', 'fresco.exe',
  // 오픈소스/무료 페인트 앱
  'krita.exe', 'firealpaca.exe', 'medibangpaintpro.exe', 'ibispaintx.exe',
  // PaintTool SAI
  'sai.exe', 'sai2.exe', 'painttoolsai.exe',
  // 3D / DCC
  'blender.exe', 'zbrush.exe', 'zbrushcore.exe',
  // Corel / Affinity
  'coreldraw.exe', 'painter.exe',
  'affinityphoto.exe', 'affinitydesigner.exe', 'affinitypublisher.exe',
]);
// 현재 forward를 꺼야 하는 상태(=펜 앱이 활성 창)와 마지막으로 renderer가 요청한 ignore 값을 함께 저장.
// 폴링에서 pen 앱 진입/이탈이 감지되면 이 두 값으로 setIgnoreMouseEvents를 재호출해 forward만 동적으로 바꿈.
let _penAppActive = false;
let _lastIgnoreRequested = false;
/* ═══ 클릭 고착 안전장치 ═══════════════════════════════════════════════
   [증상] 다른 프로그램을 쓰는 중인데 화면 아무 데나 클릭하면 이 앱이 튀어나옴.
   [원인] 렌더러의 통과/해제 판정은 오직 mousemove에만 걸려 있다(app.js의 _updateIgnore).
          렌더러가 멈추면 판정도 멈추고, 마지막 값이 ignore=false였다면 전체화면 투명 창이
          계속 클릭을 받는 상태로 굳는다. rAF 워치독은 그리기만 되살리고 이 판정은 안 건드린다.
   [대응] 렌더러 생존 신호(setCharBounds, 평소 10Hz)가 끊기고 창이 포커스도 없는데
          클릭을 받는 상태라면 → 통과로 강제 전환한다.
   ※ 예전에 제거된 워치독과 방향이 정반대다. 그건 "통과를 해제"해서 이 증상을 만들었고,
     이건 "통과를 설정"한다. 오판해도 다음 마우스 움직임에 즉시 정상 복구된다. */
let _isConfigMode = true;        // 런처/생성기(작은 창)면 true — 그때는 이 장치를 끈다
let _lastCharBoundsAt = 0;       // 렌더러 생존 신호를 마지막으로 받은 시각
let _lastActiveKeyLogged = null; // 🩺 [E] 마지막으로 진단 로그에 적은 활성 창 키 — 바뀔 때만 한 줄
/* 🩺 [2026-09-17 · E 추가 제보] 전역 훅 **수신 여부**를 앞창별로 1분에 한 줄.
   [왜] «관리자 권한 게임클라 앞에서 캐릭터는 포커싱인데 타이머가 안 쌓인다» — 활성 창 판정이 죽은 것(sysinput-win.js
     tasklist 보조 통로로 대응)과 별개로, 관리자 권한 창이 앞에 있으면 **일반 권한 프로세스의 저수준 훅(uIOhook)은
     UIPI 에 막혀 클릭·키를 못 본다.** 그때 남는 활동 신호는 커서 이동(_reportCursorActivity)뿐이라 키보드만 쓰는
     게임은 누적이 서고 캐릭터도 idle 로 간다. 로그에 «등록=예 인데 클릭=0 키=0 커서이동>0» 이 찍히면 그 갈래다.
   ⚠️ 등록 앱이 앞에 있을 때만 적는다 — 그 밖의 시간은 진단 가치가 없고 회전(256KB)만 당긴다.
   ⚠️ 새 타이머를 만들지 않는다 — 500ms 활성 창 폴링의 finally 에 얹는다(커서 이동 보고와 같은 자리). */
const INPUT_DIAG_MS = 60 * 1000;
let _inputDiagAt = 0;
const _inputDiag = { click: 0, wheel: 0, key: 0, cursor: 0 };
function _inputDiagTick(now){
  if(!_inputDiagAt){ _inputDiagAt = now; return; }
  if(now - _inputDiagAt < INPUT_DIAG_MS) return;
  _inputDiagAt = now;
  const c = { ..._inputDiag };
  _inputDiag.click = _inputDiag.wheel = _inputDiag.key = _inputDiag.cursor = 0;
  if(!lastActiveState.isFocusedAppRegistered) return;   // 등록 앱 앞에서만 — 위 ⚠️
  _diagLog('[입력] 앞창=' + (lastActiveState.key || '(없음)') + ' 등록=예 60초 수신 클릭=' + c.click
    + ' 휠=' + c.wheel + ' 키=' + c.key + ' 커서이동=' + c.cursor
    + ((c.click + c.wheel + c.key) === 0 ? ' ⚠️훅 미수신' : ''));
}
let _forcedPassthrough = false;  // 강제 전환이 걸려 있는 중인지(중복 발동 방지)
/* ★ 이 시간 이상 생존 신호가 끊기면 '멈췄다'고 본다.
   [4000 → 12000 으로 올린 근거 — 실제 제보 로그]
     [05:31:43] 발동 — 렌더러 무응답 **4239ms** … pen=true
     [05:32:10] 해제 — 렌더러 응답 재개
   4239ms 는 죽은 게 아니라 **딸꾹질**이다(임계값을 239ms 넘겼을 뿐이고 그 뒤 스스로 돌아왔다).
   렌더러가 몇 초씩 멈추는 정상 구간이 실제로 있다 — 도트 썸네일 렌더·GLB 파싱 같은 무거운
   동기 작업이 대표적이다(app.js 에도 "도트렌더 등으로 프레임이 느려져도"라는 주석이 있다).
   그 딸꾹질마다 통과로 전환되면 그때부터 유령이 되고, 사용자가 커서를 캐릭터에 올려주기
   전까지 안 돌아온다 — 위 로그의 26초가 그 시간이다.
   [트레이드오프] 임계값을 올리면 '진짜로 죽은' 경우에 통과 전환이 그만큼 늦어져서, 그 사이
     화면 전체를 덮는 투명 창이 클릭을 계속 가로챈다. 하지만 진짜 죽음은 영구적이라 몇 초 늦는
     손해가 작고, 딸꾹질 오판은 매번 유령을 만든다 — 비대칭이 크다.
   ⚠️ 렌더러 메인 스레드가 진짜로 막히면 app.js 쪽 하트비트 타이머(setInterval)도 같이 멈춘다.
     같은 단일 스레드라서 그렇다. 그러니 이 임계값은 "타이머로도 못 막는 경우"의 마지막 방어선이다. */
const RENDERER_STALL_MS = 12000;
let _forcedAt = 0;                      // 강제 전환이 걸린 시각 — 유령 지속 시간 기록용
const HICCUP_LOG_MIN_MS = 2000;         // 이만큼 지연되면 '딸꾹질'로 보고 기록만 한다(전환은 안 함)
const HICCUP_LOG_GAP_MS = 60000;        // 딸꾹질 기록 최소 간격 — 로그가 발동 기록을 덮지 않게
let _hiccupLoggedAt = 0;
// ── 스마트 감지: 펜 앱 활성 중이라도 마우스가 캐릭터 근처에 있으면 잠시 forward=true로 전환 ──
//   렌더러가 setCharBounds로 캐릭터 화면 좌표(클라이언트 좌표계)와 반경을 100ms throttle로 전달.
//   uIOhook mousemove 이벤트로 절대 좌표를 받아 클라이언트 좌표로 변환해 원형 반경 판정.
let _lastCharBounds = null;   // {x, y, r} — 캐릭터 중심 클라이언트 좌표 + 반경(px). null = 좌표 판정 보류
let _charBadSince = 0;        // 🧭 렌더러가 '좌표 못 믿음'을 알려온 구간의 시작 시각(0=정상)
let _penMouseNearChar = false;
// mainWindow의 스크린 좌표를 캐시(mousemove 콜백에서 매번 getContentBounds 호출 안 하도록).
// 창이 이동/리사이즈될 때만 갱신 — 실제로는 전체화면 오버레이라 거의 안 바뀜.
let _mainWinScreenBounds = null;
/* 📐 [2026-08-26] 렌더러가 알려주는 "우리 창들의 사각형" (클라이언트 좌표).

   [왜 생겼나] 이 파일의 회수 안전장치(ⓕ·ⓖ)와 펜 근접 판정은 지금까지 `_lastCharBounds`,
     즉 **내 캐릭터 하나**만 보고 "이 클릭이 우리를 노린 것인가"를 판단했다. 그런데 렌더러는
     대화창·상태칩·마이홈 등 **50여 개 창 전부**를 클릭 대상으로 친다. 두 기준이 어긋나서,
     사용자가 대화창(캐릭터에서 1800px)에 손을 대면 이런 왕복이 났다:
       렌더러 "내 창 위다" → main "캐릭터에서 멀다, 틀렸다" → 회수 → 0.38초 뒤 렌더러가 되돌림
     제보자 로그 기준 24분에 53회. 그 사이 클릭 한 번은 이미 우리 창에 꽂혀 앞 창이 죽는다.
   ⇒ **판정 재료를 맞춘다.** 이제 렌더러가 자기 창 좌표를 같이 보내고, 여기서는 그것까지 본다.
   ⚠️ 렌더러가 이 값을 안 보내는 구버전이면 배열이 비고, 그때는 예전처럼 캐릭터만 본다
     (동작이 옛날로 돌아갈 뿐 깨지지 않는다). */
let _lastRegions = [];
/* 점이 '우리 UI' 위인가 — 캐릭터 원 또는 창 사각형 중 하나라도 걸리면 참.
   margin 은 경계에서 렌더러와 다투지 않으려는 여유다(기존 FGN_CHAR_MARGIN 과 같은 뜻). */
function _ptOnOurUI(cx, cy, margin){
  const m = (typeof margin === 'number') ? margin : 1;
  if(_lastCharBounds){
    const dx = cx - _lastCharBounds.x, dy = cy - _lastCharBounds.y;
    const r = _lastCharBounds.r * m;
    if((dx*dx + dy*dy) < (r*r)) return true;
  }
  const pad = Math.round((m - 1) * 40);   // 사각형은 반경이 없으니 여유를 픽셀로 준다
  for(let i = 0; i < _lastRegions.length; i++){
    const g = _lastRegions[i];
    if(cx >= g.x - pad && cx <= g.x + g.w + pad &&
       cy >= g.y - pad && cy <= g.y + g.h + pad) return true;
  }
  return false;
}
/* 🪟 [제보] 최소화 → 복귀 뒤 화면이 통과된다. **원인은 이 함수였다.**
   [기전] Windows 는 최소화한 창을 (-32000,-32000) 에 파킹한다. 그때 'move' 가 떠서
     이 캐시가 그 자리표로 덮인다. 복귀하면 창 사각형이 최소화 전과 **완전히 같아서**
     'resize' 도 'move' 도 뜨지 않는다 — 캐시가 그대로 남는다.
   [그러면] 아래 좌표 판정이 전부 32,000px 어긋난다. `_ptOnOurUI` 는 cx≈32,400 을 받아
     모든 region 과 캐릭터 원 밖이라고 답하고, ⓖ 는 그걸 「캐릭터에서 먼 클릭 = 판정이 틀렸다」로
     읽어 통과로 회수한다. 캐릭터·창을 못 누르는데 단축키만 듣는 상태가 여기서 나온다
     (키보드는 좌표 경로를 안 탄다). 껐다 켜야 끝나는 것도 시작 시 1회 갱신이 유일한 복구라서다.
   [실측] 제보 로그 3줄을 이 식으로 역산하면 캐릭터가 (663,674)·(664,674)·(664,672) —
     1.5초·4초 간격의 독립된 세 줄이 2px 안에서 같은 점을 가리킨다.
   ★ 고침은 «값을 고쳐 넣기»가 아니라 «못 믿을 값을 안 받기»다. 낡은 좌표가 남는 편이
     자리표가 들어오는 것보다 항상 낫다 — 낡은 값은 몇 px 어긋나지만 자리표는 판정을 통째로 뒤집는다.
   ⚠️ 문턱을 -30000 으로 둔 이유: 자리표는 -32000 이지만 배율·작업영역 보정으로 몇 px 흔들린다.
     실제 멀티모니터 배치가 -30000 까지 가는 일은 없다(가상 화면 좌표는 보통 ±수천). */
function _refreshMainWinBounds(){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  try{
    if(mainWindow.isMinimized()) return;            // 최소화 중 — 지금 좌표는 자리표다
    const b = mainWindow.getContentBounds();
    if(!b || b.x <= -30000 || b.y <= -30000){
      /* 안전망 — isMinimized() 가 아직 false 인데 좌표만 먼저 자리표가 된 순간이 있다.
         이 줄이 로그에 뜨면 위 isMinimized() 만으로는 부족했다는 뜻이다. */
      _diagLog('[창] 자리표 좌표 무시 — ' + (b ? (b.x + ',' + b.y) : 'null')
        + ' | 캐시 유지 ' + (_mainWinScreenBounds
            ? (_mainWinScreenBounds.x + ',' + _mainWinScreenBounds.y) : 'null'));
      return;
    }
    _mainWinScreenBounds = b;
  }catch(_){}
}
/* 📺 [2026-08-27] 이 점이 **오버레이 창 안**인가 (스크린 DIP 좌표).
   [왜 필요한가 — 제보 로그로 확정] 아래 ⓕ·ⓖ 는 `_rendererMoveAge`(렌더러에 mousemove 가
     마지막으로 온 뒤 경과 ms)를 "판정이 굳었다"의 증거로 쓴다. 그런데 Electron 의 forward 는
     커서가 **창 클라이언트 사각형 안**일 때만 WM_MOUSEMOVE 를 보낸다(MouseHookProc 의 PtInRect).
     ⇒ 멀티모니터에서 다른 모니터로 커서를 옮기면 mousemove 가 안 오는 것이 **정상**인데,
       moveAge 는 그걸 고장으로 읽는다.
     실측: 제보자 로그(듀얼, 오버레이는 2560x1440 쪽)에서 ⓕ 발동 10건 중 5건의 커서 x 가
       2560 을 넘었다 — 오버레이가 아예 없는 모니터다. 08:27:12~56 의 44초 동안 렌더러
       사다리(kick3)가 10번 발동한 구간도 커서 x 가 3421~3642 였다.
   ⇒ 커서가 창 밖이면 moveAge 로 아무 판단도 하지 않는다. 창이 없는 곳의 클릭은 우리 창에
     들어갈 수 없으므로, 회수할 것도 없다.
   ⚠️ 좌표계는 스크린 DIP 다(screen.getCursorScreenPoint 와 같은 계). 클라이언트 좌표로
     바꾸기 **전**의 값을 넣을 것. */
function _ptOnOverlayWindow(pt){
  const b = _mainWinScreenBounds;
  if(!b || !pt) return true;          // 알 수 없으면 예전처럼 동작한다(막지 않는다)
  return pt.x >= b.x && pt.x < b.x + b.width && pt.y >= b.y && pt.y < b.y + b.height;
}
/* ★ forward 결정 — '클릭 통과(ignore=true)' 중에는 forward를 절대 끄지 않는다.
   [고착 버그] forward가 꺼지면 렌더러가 mousemove를 못 받는데, 렌더러의 통과/해제 판정은 오직
   mousemove에만 걸려 있다. 그래서 'ignore=true + forward=false' 조합이 되는 순간 렌더러가 스스로
   깨어날 방법이 사라져, 앱을 강제 종료하기 전까지 마우스가 영영 먹지 않았다
   (키보드·렌더링·포커싱어플은 별개 경로라 정상 동작 — 제보된 증상과 정확히 일치).
   ignore=true면 어차피 클릭이 창을 통과하므로 forward를 켜도 펜 앱 작업에 방해가 없다.
   즉 이 한 줄로 고착 조합 자체가 성립 불가능해진다. */
function _forwardFor(){
  if(_lastIgnoreRequested) return true;              // 통과 중 → 무조건 forward 유지(복구 통로 확보)
  return !_penAppActive || _penMouseNearChar;        // 클릭 받는 중 → 기존 로직 그대로
}
function _reapplyIgnoreMouse(){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  const forward = _forwardFor();
  mainWindow.setIgnoreMouseEvents(!!_lastIgnoreRequested, { forward });
  // 펜 앱 활성 상태에 맞춰 커서 감시 타이머 시작/중지
  _syncCursorWatcher();
}

// ── 스마트 감지: 커서 위치 폴링 (Electron 내장 API) ──
//   ★ 예전엔 uIOhook.on('mousemove') 전역 훅으로 구현했는데, 이 저수준 훅이 active-win의 활성 창
//     감지와 간섭해 activeWin()이 계속 null을 반환하는 문제 발생 (포커싱 어플 등록·감지 전체 고장).
//   → Electron 내장 screen.getCursorScreenPoint()를 100ms 간격 폴링으로 교체.
//     - 훅이 아니라서 다른 라이브러리와 간섭 없음
//     - 반환 좌표가 처음부터 DIP라 screenToDipPoint 변환도 불필요
//     - 펜 앱 활성일 때만 타이머가 돌아서 평소 오버헤드 0
let _cursorWatchTimer = null;
function _syncCursorWatcher(){
  const shouldWatch = _penAppActive && mainWindow && !mainWindow.isDestroyed();
  if(shouldWatch && !_cursorWatchTimer){
    _cursorWatchTimer = setInterval(_checkCursorNearChar, 50);   // 50ms — 펜 앱에서 캐릭터로 커서를 옮겼을 때 클릭이 새지 않도록 빠르게 깨움
  } else if(!shouldWatch && _cursorWatchTimer){
    clearInterval(_cursorWatchTimer);
    _cursorWatchTimer = null;
  }
}
function _checkCursorNearChar(){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  let pt;
  try{ pt = screen.getCursorScreenPoint(); }catch(_){ return; }   // DIP 좌표
  // ★ 캐릭터 좌표를 아직 못 받았어도 펜 활동 감지는 돌아야 한다 — 아래 early return보다 먼저 호출.
  _reportCursorActivity(pt, PEN_MOVE_MIN_PX);
  /* 🧭 [2026-09-01] 캐릭터 좌표가 없어도(=투영이 터져 보류 중) **창 사각형으로는 계속 판정한다.**
     예전엔 여기서 통째로 물러났는데, 그러면 펜 앱에서의 유일한 복구 통로가 같이 죽는다 —
     판타블렛 제보가 정확히 그 상태였다(setCharBounds 의 '좌표 판정 보류' 주석). */
  if(!_mainWinScreenBounds || (!_lastCharBounds && !_lastRegions.length)){
    if(_penMouseNearChar){ _penMouseNearChar = false; _applyForwardOnly(); }
    return;
  }
  const cx = pt.x - _mainWinScreenBounds.x;
  const cy = pt.y - _mainWinScreenBounds.y;
  /* 📐 캐릭터 원만 보던 것을 '우리 창 전부'로 넓혔다.
     ⚠️ 이게 없으면 **태블릿 펜으로 대화창 입력칸을 못 누른다.** 펜 앱이 앞이면 forward
       mousemove 가 끊겨서 렌더러가 스스로 판정할 기회가 이 penHitTest 뿐인데, 그 신호가
       캐릭터 반경 안에서만 왔기 때문이다. 실제 제보로 확인된 자리다. */
  const near = _ptOnOurUI(cx, cy);
  if(near !== _penMouseNearChar){
    _penMouseNearChar = near;
    _applyForwardOnly();
    // ★ 펜 앱(클립스튜디오·블렌더 등)에서는 forward가 꺼져 있어 렌더러가 mousemove를 못 받는다.
    //   펜 태블릿은 이동 없이 곧바로 탭하는 경우가 많아, mousemove를 기다리면 첫 클릭이 뒤 프로그램으로 샌다.
    //   → 근접이 감지되는 순간 렌더러에 커서 좌표를 보내 "여기 클릭 대상이 있는지" 정밀 판정을 직접 시킨다.
    try{
      /* 🚑 pen 표식을 같이 보낸다 — 렌더러의 고착 회복 사다리가 "이 재판정 통로가 정상 통로인가"를
         판단하는 근거다(app.js _notePoke 주석). 펜 앱일 때는 mousemove 가 원래 안 오는 게 정상이라
         재판정이 곧 생존 신호지만, 그 밖에서는 오히려 "고착 중이라 main 이 구조하러 왔다"는 뜻이다.
         ⚠️ '벗어남' 신호도 null 대신 객체로 보낸다 — 그래야 pen 표식이 같이 간다.
           렌더러는 null 과 {left:true} 를 똑같이 다룬다(구버전 호환). */
      _sendHitTest(near ? { x: cx, y: cy } : { left: true });
    }catch(_){}
  }
}
/* ═══ 🖊️ 펜 활동 감지 ═══════════════════════════════════════════════════
   [증상] WinTab 모드 태블릿으로 클립스튜디오에서 그리는 동안 포커스 기록이 안 쌓인다.
   [원인] 렌더러의 활동 판정(lastActivity)은 uiohook 전역 클릭/키에만 걸려 있는데, WinTab은
          펜 입력을 드라이버가 앱에 직접 넘기면서 표준 마우스 메시지를 억제하는 경우가 있다.
          → 저수준 훅에 아무것도 안 들어와서 "손 뗀 상태"로 판정된다.
   [대응] 펜 앱 활성 중에만 도는 커서 폴링(_checkCursorNearChar, 50ms)에서 좌표 이동량을 본다.
   ★ 예전에 powerMonitor 유휴시간으로 보정했다가 되돌린 적이 있다(센서 미세 떨림·펜 호버에도
     리셋돼서 아무것도 안 하는데 기록이 쌓임). 그래서 여기선 'OS가 판단한 입력 유무'가 아니라
     '커서가 실제로 이동한 픽셀'만 본다 — 펜을 들어 가만히 두면 좌표가 안 변해서 기록이 멈춘다. */
/* ═══ 🖱 [2026-09-12 제보] 듀얼 모니터에서 «움직이기만 하는 마우스»가 안 잡힌다 ═══════
   [증상] 오버레이가 떠 있는 모니터에서는 키·클릭·이동이 전부 활동으로 잡히는데,
     오버레이가 없는 모니터에서는 키·클릭·휠만 잡히고 **마우스 이동만 하는 동작**은 안 잡힌다.
     → 등록한 포커싱 어플을 그 모니터에서 쓰면서 마우스만 움직이면 캐릭터가 잠들고 기록이 멈춘다.
   [원인] 활동 신호의 출처가 둘인데 범위가 다르다.
     ・키·클릭·휠 = uIOhook 전역 훅 → **모든 모니터**에서 온다.
     ・이동       = 렌더러의 DOM mousemove(app.js) → `setIgnoreMouseEvents(forward:true)` 로
                    들어오는 것이라 **오버레이 창 위에서만** 온다. 다른 모니터엔 창이 없으니 안 온다.
                    (이건 고장이 아니라 정상이다 — 이 파일 여러 곳의 '다른 모니터면 mousemove 가
                     안 오는 게 정상' 주석과 같은 사실이다.)
   [대응] 커서 좌표 폴링은 이미 있다 — 펜 앱 전용이던 것을 **모든 앱**으로 넓힌다.
     활성 창 폴링(500ms, startActiveWinPolling)에 얹으므로 새 타이머가 늘지 않는다.
   ★ powerMonitor 유휴시간으로 되돌리는 것이 아니다. 그건 센서 떨림·펜 호버도 '입력 있음'으로
     쳐서 아무것도 안 하는데 기록이 쌓였고, 그래서 한 번 제거된 방식이다(아래 원주석).
     여기서는 **커서 좌표가 실제로 몇 px 움직였는가**만 본다.
   ⚠️ 채널 이름은 'companion:penActivity' 그대로 둔다 — preload·app.js 가 같이 쓰는 이름이라
     바꾸면 세 파일을 함께 고쳐야 하고, 받는 쪽 처리(anyInput + focusGate 통과 시 activity)는
     펜이든 일반 마우스든 **이미 똑같다.**
   ✅ 받는 쪽: app.js 의 companion.onPenActivity 핸들러(수정 불필요) */
const PEN_MOVE_MIN_PX = 3;          // 1~2px 센서 떨림은 안 움직인 것으로 친다 (50ms 표본 — 펜 앱)
/* 🖱 500ms 표본용 임계값. 펜(3px)보다 크게 잡는다 — 표본 간격이 10배라 그 사이에 떨림이
   더 많이 누적될 수 있다. 8px 은 '사람이 마우스를 옮겼다'에는 충분히 작고, 광학 센서가
   가만히 있을 때 내는 흔들림보다는 충분히 크다. */
const CURSOR_MOVE_MIN_PX = 8;
const PEN_ACTIVITY_MIN_MS = 1000;   // 렌더러로 보내는 빈도 상한 (초당 1회면 충분 — FOCUS_MS가 초 단위)
let _penLastPt = null;
let _penActivitySentAt = 0;
/* @param minPx 이만큼 움직여야 «움직였다»로 친다. 부르는 쪽의 표본 간격에 맞춰 준다. */
function _reportCursorActivity(pt, minPx){
  const th = (typeof minPx === 'number' && minPx > 0) ? minPx : PEN_MOVE_MIN_PX;
  if(!_penLastPt){ _penLastPt = { x: pt.x, y: pt.y }; return; }
  const dx = pt.x - _penLastPt.x, dy = pt.y - _penLastPt.y;
  // 임계값 미만이면 기준점을 갱신하지 않는다 — 떨림은 한 점 주위를 오가서 절대 누적되지 않고,
  // 진짜 느린 이동은 몇 프레임 뒤 임계값을 넘겨서 정상적으로 잡힌다.
  if((dx*dx + dy*dy) < (th*th)) return;
  _penLastPt = { x: pt.x, y: pt.y };
  const now = Date.now();
  if(now - _penActivitySentAt < PEN_ACTIVITY_MIN_MS) return;
  _penActivitySentAt = now;
  _inputDiag.cursor++;   // 🩺 [입력] 진단 — 훅과 무관한 유일한 활동 신호가 이것이다
  if(mainWindow && !mainWindow.isDestroyed()){
    try{ mainWindow.webContents.send('companion:penActivity'); }catch(_){}
  }
}

// forward 옵션만 재적용 (타이머 sync 없이 — _checkCursorNearChar 내부용, 재귀 방지)
function _applyForwardOnly(){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setIgnoreMouseEvents(!!_lastIgnoreRequested, { forward: _forwardFor() });
}

/* 📮 [2026-08-31] 재판정 신호는 **반드시 이 함수로만** 보낸다 — `ig`(지금 main 이 통과 중인가)를
     같이 실어야 하기 때문이다.

   [무엇이 났나 — 제보] "고스트(클릭이 전부 뒤 창으로 통과)에서 캐릭터 위에 2초 얹는 방법으로
     빠져나오곤 했는데, 오늘은 그것도 안 듣는다. 껐다 켜야만 눌린다."

   [왜 2초 얹기가 안 듣나] 그 방법이 듣는 원리는 이렇다 —
     _guardGhostPassthrough 가 penHitTest 로 찌른다 → 렌더러가 그 좌표를 다시 판정한다 →
     "우리 UI 위다" → `_sendIgnore(false)` 로 클릭받기 복귀.
     그런데 렌더러의 `_sendIgnore` 는 **마지막으로 보낸 값과 같으면 IPC 를 아예 안 보낸다**(중복 방지).
     그래서 렌더러 캐시가 `false`(=클릭받는 중이라고 믿음)인 채로 main 만 통과로 넘어가 있으면,
     몇 번을 찔러도 렌더러는 "이미 false 를 보냈다"며 침묵한다. **찌르는 통로 자체가 죽는다.**

   [그 어긋남을 누가 만드나 — main 이다] ⓔ·ⓕ·ⓖ 세 안전장치는 렌더러에게 물어보지 않고
     `_lastIgnoreRequested = true` 로 **혼자 통과로 되돌린다.** 그 직후 penHitTest(null) 을 보내
     렌더러 캐시를 맞추려 했지만, 그 신호는 렌더러에서 150ms 디바운스를 타므로
     그 사이에 mousemove 한 번이 캐릭터 위에 떨어지면 예약이 취소되고 캐시는 `false` 로 남는다.
     ⇒ 그때부터가 '2초 얹기가 안 듣는 유령'이다. 사다리(app.js __mouseKick)도 첫 줄이
       `if(_ignoreSent !== true) return;` 이라 같은 이유로 안 돈다 — **복구 경로가 전부 막힌다.**

   ⇒ 해법: 찌를 때마다 **내 실제 상태를 같이 보낸다.** 렌더러는 자기 캐시가 그것과 다르면
     캐시를 버리고 다시 판정한다(app.js onPenHitTest). 어긋남이 어떤 경로로 생겼든 한 번에 풀린다.
   ⚠️ 예전 두 곳에서 보내던 `null` 도 객체로 바꾼다 — 그래야 ig 를 실을 수 있다.
     렌더러는 `!pt || pt.left` 를 같게 다루므로 구버전 렌더러와도 짝이 맞는다.
   ⚠️ 새 IPC 채널을 파지 않았다. 파면 preload 를 고쳐야 하고, 그러면 구버전 preload 와 어긋난다
     (이 파일이 줄곧 지켜온 규칙 — setCharBounds 에 진단을 얹은 것과 같은 이유). */
function _sendHitTest(payload){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  const p = payload ? Object.assign({}, payload) : { left: true };
  /* 🔍 렌더러가 elementFromPoint 에 넣을 좌표다 — DIP 를 CSS px 로(applyUiZoom 주석 ★ 좌표계). */
  if(typeof p.x === 'number') p.x = _zoomOut(p.x);
  if(typeof p.y === 'number') p.y = _zoomOut(p.y);
  p.ig = !!_lastIgnoreRequested;                       // ★ 이 한 줄이 이 함수의 존재 이유다
  if(p.pen === undefined) p.pen = !!_penAppActive;
  try{ mainWindow.webContents.send('companion:penHitTest', p); }catch(_){}
}

// 마지막으로 "우리 앱이 아닌 다른 창"에 포커스가 있었을 때의 정보. 설정 패널에서 1~4번 버튼을
// 누르면 이 값을 그 슬롯에 등록한다(=버튼 누르기 직전까지 쓰고 있던 프로그램).
let lastForeignWindow = null;   // { key, name, path, title } — key 가 판정 축이다(focusKeyOf)

// uiohook 전역 클릭/키 이벤트에 실어 보낼, 매 순간의 "활성 프로세스 판정" 캐시.
// (500ms 폴링에서 갱신 — uiohook 이벤트마다 activeWin()을 새로 부르면 느리므로 캐시 재사용)
let lastActiveState = { exeName:'', isFocusedAppRegistered:false, hasAnyRegistered:false, isPenApp:false };

// 현재 활성 창이 우리 앱이 아니면 lastForeignWindow를 갱신 — 500ms 주기로 폴링.
// (active-win 자체가 폴링 기반 API라 이벤트 리스너가 없음)
let _pollTimer = null;
/* ★ active-win이 계속 실패하는 환경이 있다(관리자 권한으로 뜬 창이 활성일 때, 일부 보안 소프트,
   원격 데스크톱 세션 등). 예전엔 실패하면 콜백에서 그냥 return 했는데, 그러면 아래 있는
   _guardStuckClickCapture()까지 같이 건너뛰어 '마우스가 영영 안 먹는' 상태를 풀어줄 안전장치가
   통째로 죽는다 — 소수 유저만 겪는 마우스 먹통 제보의 유력 후보. 이제는 무슨 일이 있어도 부른다. */
let _activeWinFailStreak = 0;
function startActiveWinPolling(){
  if(_pollTimer) return;
  _pollTimer = setInterval(async ()=>{
    try{
      const w = await activeWin();
      if(!w || !w.owner){
        _activeWinFailStreak++;
        // 20회(=10초) 연속 실패면 한 번만 남긴다 — 이 환경에선 포커싱 어플/펜 앱 판정도 같이 죽어 있다.
        if(_activeWinFailStreak === 20) _diagLog('active-win 연속 실패 — 활성 창 판정 불가(펜앱·포커싱어플 감지 정지)');
        return;
      }
      _activeWinFailStreak = 0;
      /* ★ [2026-09-15 · ⑥] 이름 규칙은 **반드시 sysinput 모듈을 거친다.**
           [무엇이 문제였나] ③ 이 procNameOf 를 모듈로 옮겼는데 **여기는 안 바꿨다.**
             그래서 규칙은 모듈에 있고 판정은 옛 자리에서 돌았다 — 모듈에 무엇을 적어도
             mac 판정에 닿지 않는 상태였다.
           [왜 basename 이면 안 되나] mac 에서 일렉트론으로 만든 앱은 실행 파일 이름이
             죄다 `Electron` 이다(VS Code 등). basename 규칙은 그것들을 **한 키로 뭉친다.**
         ⇒ 판정은 번들 id(procNameOf), 표시는 번들 이름(displayNameOf). 둘이 갈라졌다.
         ⚠️ Windows 에서는 두 함수가 같은 문자열을 돌려준다 — 동작 변경 0 이다. */
      const ownerPath = w.owner.path || w.owner.name || '';
      const exeName = sysinput.procNameOf(ownerPath);
      if(exeName && exeName !== SELF_EXE){
        lastForeignWindow = { key: focusKeyOf(exeName), name: sysinput.displayNameOf(ownerPath), path: w.owner.path || '', title: w.title || '' };
      }
      /* ★ 등록 판정은 keysOf 한 통로로만 나간다 — 이름을 직접 비교하지 말 것.
           여기서 `f.name === exeName` 로 되돌리면 mac 에서 조용히 전부 미등록이 된다. */
      const activeKey = focusKeyOf(exeName);
      const isFocusedAppRegistered = !!(activeKey && focusApps.some(f => keysOf(f).includes(activeKey)));
      /* 🩺 [2026-09-16 제보 1 · E] 활성 창 키가 **바뀔 때마다** 진단 로그에 한 줄 — 콘솔을 못 보는 환경용.
         [왜] 게임 클라이언트를 등록했는데 카운팅이 안 되는 제보. 목록에 뜨고 등록도 되는데 안 잡히면
           «등록된 키와 활성 창 키가 서로 다른 문자열» 이 가장 유력하다(런처 exe ≠ 실제 프로세스).
           이 줄이 있으면 로그 파일에서 `활성=<키>` 와 `등록=[…]` 을 나란히 보고 어긋남을 바로 가른다.
         ⚠️ 바뀔 때만 적는다 — 폴링이 500ms 라 매번 적으면 로그가 진단을 덮는다(_diagLog 회전 주석). */
      if(activeKey !== _lastActiveKeyLogged){
        _lastActiveKeyLogged = activeKey;
        try{
          const regKeys = focusApps.map(f => keysOf(f).join('|')).filter(Boolean).join(', ');
          /* 경로=없음 — 관리자 권한 창이라 sysinput 이 tasklist 이름으로 판정한 경우(sysinput-win.js). */
          _diagLog('[활성] 활성=' + (activeKey || '(없음)') + ' 등록=' + (isFocusedAppRegistered ? '예' : '아니오')
            + ' 표시=' + sysinput.displayNameOf(ownerPath) + (w.owner.path ? '' : ' 경로=없음(관리자권한)')
            + ' | 등록키=[' + regKeys + ']');
        }catch(_){}
      }
      // 펜 앱 활성 상태 변화 감지 — 진입/이탈 시 forward 옵션을 즉시 재적용해 태블릿 스무딩을 방해하지 않게.
      const penNow = PEN_APPS.has(exeName);
      // ★ isPenApp을 렌더러까지 실어 보낸다 — 그림 작업은 한 획이 몇 초씩 걸려서
      //   렌더러의 1.5초(FOCUS_MS) 기록 창이 너무 좁다. 펜 앱일 때만 그 창을 넓히는 데 쓴다.
      /* ⚠️ 전용 채널을 파지 않는다 — 필드 하나를 얹는 방식이라 구버전 preload/렌더러와도 짝이 맞는다
         (모르는 필드는 그냥 무시된다). offOverlay 를 얹을 때와 같은 규약이다. */
      lastActiveState = { exeName, key: activeKey, isFocusedAppRegistered, hasAnyRegistered: focusApps.some(Boolean), isPenApp: penNow };
      if(penNow !== _penAppActive){
        _penAppActive = penNow;
        if(!_penAppActive){
          _penMouseNearChar = false;   // 이탈 시 near 상태 초기화 — 남아있으면 다음 진입 시 오작동
          _penLastPt = null;           // 펜 활동 기준점도 초기화 — 다음 진입 첫 표본이 튀는 것 방지
        }
        _reapplyIgnoreMouse();
      }
      if(mainWindow && !mainWindow.isDestroyed()){
        mainWindow.webContents.send('companion:activeAppState', lastActiveState);
      }
    }catch(e){ /* active-win이 가끔 실패할 수 있음(권한 등) — 무시하고 다음 폴링 */ }
    finally{
      // ★ 위에서 어떤 이유로 빠져나왔든(활성 창 판정 실패·예외) 안전장치만은 반드시 돈다.
      //   이게 안 돌면 렌더러가 멈춘 뒤 클릭을 계속 가로채는 상태에서 스스로 빠져나올 길이 없다.
      try{ _guardStuckClickCapture(); }catch(_){}
      try{ _guardStaleCapture(); }catch(_){}   // ⓕ — forward 가 죽어 굳은 '클릭 받는 중' 회수
      /* 🖱 [2026-09-12] 마우스 «이동만» 하는 활동 — **모니터를 가리지 않는다.**
         렌더러의 DOM mousemove 는 오버레이 창 위에서만 오므로, 오버레이가 없는 모니터에서
         마우스만 움직이면 활동이 통째로 안 잡혔다(제보). 커서 좌표는 창과 무관하게 읽히므로
         여기서 본다 — 자세한 경위는 _reportCursorActivity 위 주석.
         ★ 여기(활성 창 폴링)에 얹은 이유: 이미 500ms 로 도는 유일한 상시 타이머다.
           타이머를 하나 더 만들면 유휴 시 깨우는 횟수만 늘고 얻는 게 없다.
         ⚠️ 펜 앱일 때는 _checkCursorNearChar(50ms)가 3px 로 더 촘촘히 같은 일을 한다.
           둘이 기준점(_penLastPt)과 전송 간격(PEN_ACTIVITY_MIN_MS)을 공유하므로 겹쳐도
           신호가 두 벌이 되지 않는다. */
      try{ _reportCursorActivity(screen.getCursorScreenPoint(), CURSOR_MOVE_MIN_PX); }catch(_){}
      try{ _inputDiagTick(Date.now()); }catch(_){}   // 🩺 [입력] 1분에 한 줄 — 선언부 주석 참고
    }
  }, 500);
}

/* ═══ 클릭 고착 안전장치 본체 ═══════════════════════════════════════════
   500ms 폴링에서 매번 호출된다. 아래 네 조건을 "전부" 만족할 때만 발동한다.
     1) 전체화면 오버레이(run) 상태          — 런처/생성기는 창 전체가 UI라 제외
     2) 지금 창이 클릭을 받는 상태(ignore=false)
     3) 창에 포커스가 없음                   — 다른 프로그램을 쓰는 중 = 제보 상황
     4) 렌더러 생존 신호가 RENDERER_STALL_MS 이상 끊김
   발동하면 통과로 전환하고, 렌더러에는 penHitTest(null)을 보내 판정 캐시를 맞춘다.
   (캐시를 안 맞추면 렌더러는 여전히 "클릭 받는 중"이라 믿어 다음 신호를 안 보내고 교착된다.
    penHitTest는 이미 있는 채널이라 preload는 손대지 않아도 된다.) */
function _guardStuckClickCapture(){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  let focused = false;
  try{ focused = mainWindow.isFocused(); }catch(_){ return; }
  const quietFor = _lastCharBoundsAt ? (Date.now() - _lastCharBoundsAt) : 0;
  const stuck = !_isConfigMode && !_lastIgnoreRequested && !focused
             && _lastCharBoundsAt > 0 && quietFor > RENDERER_STALL_MS;

  if(stuck && !_forcedPassthrough){
    _forcedPassthrough = true;
    _forcedAt = Date.now();
    _lastIgnoreRequested = true;          // 통과로 전환 (_forwardFor가 forward:true를 유지해줌)
    _reapplyIgnoreMouse();
    _sendHitTest(null);
    _diagLog('발동 — 렌더러 무응답 ' + quietFor + 'ms, 클릭 통과로 강제 전환');
    return;
  }
  /* 🩺 임계값 아래의 '딸꾹질'도 남긴다 — 이게 이 로그의 진짜 쓸모다.
     제보 로그에서 4239ms 가 나왔는데, 그게 예외적인 한 번인지 평소에도 3~4초씩 멈추는지에 따라
     RENDERER_STALL_MS 를 다시 잡을지 렌더러 쪽 무거운 작업을 쪼갤지가 갈린다.
     ⚠️ 1분에 한 줄로 묶는다. 매번 남기면 파일 상한(256KB)을 금방 채워 정작 필요한 발동 기록이
       안 남는다 — 진단이 진단을 덮는 상황을 만들면 안 된다. */
  if(!_forcedPassthrough && !_isConfigMode && quietFor > HICCUP_LOG_MIN_MS){
    const now = Date.now();
    if(now - _hiccupLoggedAt > HICCUP_LOG_GAP_MS){
      _hiccupLoggedAt = now;
      _diagLog('딸꾹질 — 렌더러 신호 ' + quietFor + 'ms 지연(임계 ' + RENDERER_STALL_MS + 'ms 미만, 전환 안 함)');
    }
  }
  // 생존 신호가 돌아왔으면 해제 표시만 풀어둔다.
  // 실제 통과/해제 값은 렌더러가 다음 mousemove에서 스스로 다시 정한다.
  if(_forcedPassthrough && quietFor <= RENDERER_STALL_MS){
    _forcedPassthrough = false;
    // ★ 유령이었던 시간 — 사용자가 실제로 못 누른 시간이다. 이 숫자가 길면 복구 경로를 봐야 한다.
    _diagLog('해제 — 렌더러 응답 재개 (유령 상태 ' + (_forcedAt ? (Date.now() - _forcedAt) : 0) + 'ms 지속)');
    _forcedAt = 0;
  }
  _guardGhostPassthrough(quietFor);
}

/* ═══ 반대 방향 복구 — "유령이 됐다" ═══════════════════════════════════
   [증상] 창은 멀쩡히 보이는데 클릭도 단축키도 안 먹고, 클릭이 전부 뒤 프로그램으로 간다.
          앱을 껐다 켜기 전에는 못 돌아온다.
   [왜 스스로 못 빠져나오나] 렌더러의 통과/해제 판정은 mousemove 에만 걸려 있다. 그래서
     ・렌더러가 어떤 이유로든 그 순간의 판정을 놓쳤거나
     ・main 과 렌더러의 상태가 어긋난 채로 굳었거나
   하면, 커서를 캐릭터 위에 올려둬도 아무 일도 안 일어난다. 창이 클릭을 안 받으니
   포커스도 못 얻어 renderer 의 focus 이벤트 복구 통로까지 같이 막힌다.
   [대응] main 이 "커서가 캐릭터 반경 안에 있는데도 통과 상태"를 GHOST_MS 이상 보면,
     렌더러에 그 좌표로 정밀 재판정을 시킨다(이미 있는 penHitTest 채널 — preload 무수정).
   ★ main 이 통과를 **직접 풀지 않는다.** 여기서 ignore=false 를 걸어버리면 화면 전체를 덮는
     투명 창이 클릭을 가로채, 다른 프로그램을 쓰다가 아무 데나 눌러도 이 앱이 튀어나온다
     (예전에 제거된 워치독이 정확히 그 사고를 냈다). 판단은 끝까지 렌더러가 한다 —
     캐릭터 위가 아니면 렌더러가 다시 통과로 확정하므로 오발동해도 손해가 없다.
   ⚠️ 이 장치가 자주 발동한다면 그 자체가 신호다. 진단 로그에 발동 기록이 쌓이면
     근본 원인(렌더러가 왜 판정을 놓쳤는가)을 따로 찾아야 한다. */
const GHOST_MS = 2000;          // 커서가 캐릭터 위에 이만큼 머물렀는데도 통과면 재판정 요청
const GHOST_REPOKE_MS = 3000;   // 재판정 요청 최소 간격(연달아 쏘지 않게)
/* ★ [2026-08-25] 포기 한도. **이 장치가 렌더러의 자가 회복을 눌러 앉히고 있었다.**
     렌더러의 고착 회복 사다리(app.js __mouseKick)는 "mousemove 가 3초 이상 없다"를 발동 조건으로
     쓰는데, 여기서 3초마다 찌르면 그 시계가 3초마다 되감긴다 — 사다리가 3단계(유일하게 실제로
     클릭받기를 되살리는 단계)에 **영영 도달하지 못한다.**
     제보 로그가 그 모양 그대로였다: 2002 → 5008 → 8019 → 11039 → 14042ms, 정확히 3초 간격,
     14초 동안 미복구. 제보 문구는 "프로그램 자체가 먹통이 되어버립니다".
   ⇒ 두 가지로 끊는다.
     ・app.js 쪽(근본): 재판정 수신을 mousemove 생존 신호로 치지 않는다(_notePoke).
     ・여기(안전망): 이만큼 찔러도 안 살아나면 **물러난다.** 그러면 렌더러 시계가 늙어 사다리가 돈다.
   ⚠️ GHOST_REPOKE_MS 와 app.js 의 사다리 게이트가 같은 값(3000)인 것이 이 사고의 뿌리다.
     둘 중 하나를 바꿀 때는 반드시 다른 쪽을 같이 볼 것 — sim-ghost-kick-ladder.js 가 지킨다. */
const GHOST_MAX_POKES = 3;
let _ghostSince = 0, _ghostPokedAt = 0, _ghostPokes = 0;
function _guardGhostPassthrough(quietFor){
  // 렌더러가 죽어 있거나(위 안전장치 담당) run 모드가 아니면 대상 아님
  /* 🧭 캐릭터 좌표가 보류 중이어도 창 사각형(상태칩·대화창 등)만으로 계속 감시한다 —
     그게 없으면 '2초 얹기' 통로가 통째로 사라진다(setCharBounds 의 보류 주석). */
  if(_isConfigMode || !_lastIgnoreRequested || !_mainWinScreenBounds
     || (!_lastCharBounds && !_lastRegions.length)
     || quietFor > RENDERER_STALL_MS){
    _ghostSince = 0; _ghostPokes = 0; return;   // 통과가 풀렸거나 대상이 아님 = 상황 종료 → 포기 카운터도 초기화
  }
  let pt; try{ pt = screen.getCursorScreenPoint(); }catch(_){ _ghostSince = 0; return; }
  // 📐 캐릭터뿐 아니라 대화창 등 우리 창 위에서도 유령을 풀어야 한다(_ptOnOurUI 주석).
  if(!_ptOnOurUI(pt.x - _mainWinScreenBounds.x, pt.y - _mainWinScreenBounds.y)){
    _ghostSince = 0; _ghostPokes = 0; return;   // 우리 UI 위가 아님 — 통과가 정상
  }
  const now = Date.now();
  if(!_ghostSince){ _ghostSince = now; return; }
  if(now - _ghostSince < GHOST_MS) return;
  if(now - _ghostPokedAt < GHOST_REPOKE_MS) return;
  const cx = pt.x - _mainWinScreenBounds.x, cy = pt.y - _mainWinScreenBounds.y;
  /* 🛑 포기 — 여기서 물러나야 렌더러 사다리가 돈다(위 GHOST_MAX_POKES 주석).
     ⚠️ 계속 찌르는 쪽이 '더 열심히'처럼 보이지만, 실제로는 유일한 복구 경로를 막는 것이다. */
  if(_ghostPokes >= GHOST_MAX_POKES){
    if(_ghostPokes === GHOST_MAX_POKES){
      _ghostPokes++;   // 이 줄은 한 번만 남긴다
      /* 🩺 여기까지 왔다는 것은 "렌더러가 재판정을 받고도 통과라고 답한다"는 뜻이다.
         남은 갈래가 셋이라(좌표 어긋남 · 히트테스트 실패 · 렌더러 정지) 판정 재료를 같이 남긴다.
         · 커서와 캐릭터 좌표가 멀쩡한데 통과면 → 히트테스트 쪽
         · 창 좌표가 실제 화면과 안 맞으면 → _mainWinScreenBounds 캐시가 낡은 것 */
      _diagLog('유령 회복 포기 — ' + GHOST_MAX_POKES + '회 재판정 요청에도 통과 유지'
        + ' | 커서(창기준)=(' + cx + ',' + cy + ')'
        + ' | 캐릭터=' + (_lastCharBounds
            ? ('(' + _lastCharBounds.x + ',' + _lastCharBounds.y + ') r=' + _lastCharBounds.r)
            : '좌표보류(창 ' + _lastRegions.length + '개로 판정)')
        + ' | 창=' + _mainWinScreenBounds.width + 'x' + _mainWinScreenBounds.height
        + '@' + _mainWinScreenBounds.x + ',' + _mainWinScreenBounds.y
        + ' | 머문시간 ' + (now - _ghostSince) + 'ms');
    }
    return;
  }
  _ghostPokedAt = now;
  _ghostPokes++;
  try{
    _sendHitTest({ x: cx, y: cy });
  }catch(_){}
  _diagLog('유령 의심 — 커서가 캐릭터 위에 ' + (now - _ghostSince) + 'ms 머물렀는데 통과 중, 렌더러에 재판정 요청'
    + ' (' + _ghostPokes + '/' + GHOST_MAX_POKES + ')');
}

/* ═══ [진단] 마우스 활성화 제보 추적 ══════════════════════════════════
   며칠간 동일 제보가 없으면 이 블록과 위쪽의 _diagLog(...) 호출 두 줄만 지우면 된다.
   (안전장치 본체는 남겨둘 것 — 진단이 아니라 실제 방어다.)
   기록 위치: %APPDATA%/Together Working/tw-mouse-diag.log (직전 분량은 .1)

   ★ [2026-08-25] 상한에 닿으면 **조용히 멈추던 것을 회전으로 바꿨다.**
   [무슨 일이 있었나] 제보자 로그가 8월 17일 13:49 에서 끊겨 있었다. 파일이 262,231 bytes —
     상한을 87 bytes 넘긴 채로 멈춘 것이다. 그 뒤로 무엇을 물어봐도 답이 안 남았다.
     "갭을 2로 바꿔 보세요" 도, "신티크를 빼 보세요" 도 전부 확인할 수 없는 부탁이었다.
   [왜 그렇게 찼나] 1,501줄이 **전부 한 종류**였다 — `유령 의심`. 한 번의 고착이 83회까지
     같은 줄을 찍었다(최장 253초). 진단 하나가 256KB 를 통째로 먹고 나머지를 다 덮었다.
   ⇒ 상한은 그대로 두되, 닿으면 **직전 분량을 .1 로 밀어내고 새로 시작**한다.
     최근 기록은 항상 살아 있고, 디스크는 최대 2배(512KB)로 묶인다.
   ⚠️ 세 줄짜리 변경이지만 이게 없으면 다음 조사도 같은 자리에서 막힌다. 지우지 말 것.
   ⚠️ 이건 로그가 넘치는 것에 대한 **대비**이지 해결이 아니다. 같은 줄이 83번 찍히는 것 자체는
     GHOST_MAX_POKES(위 유령 감시)가 막는다. 여기가 조용해졌다고 그쪽을 되돌리면 안 된다. */
const DIAG_MAX_BYTES = 256 * 1024;
function _diagLog(msg){
  try{
    if(!app.isReady()) return;
    const f = path.join(app.getPath('userData'), 'tw-mouse-diag.log');
    /* 상한을 넘겼으면 .1 로 밀고 새 파일로 시작한다(실패해도 기록은 계속 — 회전은 편의지 필수가 아니다). */
    try{
      if(fs.existsSync(f) && fs.statSync(f).size > DIAG_MAX_BYTES){
        const old = f + '.1';
        try{ if(fs.existsSync(old)) fs.unlinkSync(old); }catch(_){}
        fs.renameSync(f, old);
      }
    }catch(_){}
    const line = '[' + new Date().toISOString() + '] ' + msg
      + ' | config=' + _isConfigMode + ' ignore=' + _lastIgnoreRequested
      + ' pen=' + _penAppActive + '\n';
    fs.appendFileSync(f, line, 'utf8');
    console.log('[클릭고착]', msg);
  }catch(_){}
}

/* ═══ ⓕ 대응 — 굳어버린 '클릭 받는 중'을 회수한다 ═════════════════════════
   [증상] 게임(파판14 창 모드) 도중 캐릭터를 만지지도 않았는데 게임 창이 비활성화된다.

   [메커니즘] 통과/해제 판정은 렌더러의 mousemove 에만 걸려 있다(app.js _updateIgnore).
     그 mousemove 는 `setIgnoreMouseEvents(true,{forward:true})` 의 forward 로 들어오는데,
     Windows 에서 이 전달이 끊기는 확인된 상류 버그가 있다 —
       · electron#30808 mouseleave/:hover 가 forward 아래서 불안정 (메인테이너 재현 확인)
       · electron#33281 특정 비-Electron 창이 포그라운드면 mousemove 가 아예 안 온다
     끊긴 순간의 마지막 값이 '클릭 받는 중(ignore=false)'이면, **전체화면 투명 오버레이가
     계속 클릭을 가로채는 상태로 굳는다.** 그 상태에서 게임 안을 누르면 그 클릭이 우리 창으로
     들어가고, Windows 는 클릭받은 창을 활성화하므로 게임이 비활성화된다.

   [기존 안전장치로 왜 안 잡히나] _guardStuckClickCapture 는 `_lastCharBoundsAt`(100ms 하트비트)을
     본다. 그건 "이벤트 루프가 살아 있는가"라서, 렌더러가 멀쩡한 이 사고에서는 계속 갱신된다.
     그래서 quietFor 가 0 근처에 머물러 발동 조건에 영영 못 닿는다. 이게 구멍이었다.

   [발동 조건 — 다섯 개를 전부 만족할 때만]
     1) run 모드                     — 런처/마이홈은 창 전체가 UI라 제외
     2) 지금 클릭을 받는 상태        — 통과 중이면 사고가 성립하지 않는다
     3) 우리 창에 포커스가 없음      — 즉 사용자는 다른 프로그램(게임)을 쓰는 중
     4) 렌더러에 mousemove 가 STALE_MS 이상 안 옴 — 판정이 굳었다는 증거
     5) 그런데 **커서는 실제로 움직이고 있다** — main 이 직접 잰다
   ★ 5번이 핵심 안전장치다. 커서가 가만히 있을 때는 mousemove 가 안 오는 게 정상이므로,
     4번만으로 발동시키면 "채팅 버튼 위에 커서를 얹어둔 채 누르려던" 사용자의 클릭을 뒤로
     흘려보내게 된다. 움직이는데도 안 온다 = forward 가 죽었다, 로 좁힌다.

   [오발동해도 잃는 것이 없다] 우리가 하는 일은 **통과로 되돌리는 것**뿐이다. 이 방향은
     이 파일이 줄곧 지켜온 원칙이고(위 _guardGhostPassthrough 주석), 다음 mousemove 가
     한 번만 와도 렌더러가 정상 판정으로 즉시 되돌린다. 반대 방향(임의로 클릭을 받게 하는 것)은
     예전 워치독이 사고를 낸 자리라 여기서도 절대 하지 않는다. */
const FWD_STALE_MS    = 1200;   // 이만큼 mousemove 가 없으면 판정이 굳은 것으로 본다
const FWD_MOVE_MIN_PX = 60;     // 같은 동안 커서가 이만큼은 움직였어야 '움직이는데도 안 온다'가 성립
const FWD_REFIRE_MS   = 2000;   // 연속 발동 간격 하한
let _rendererMoveAge = -1;      // 렌더러가 하트비트에 실어 보낸 "mousemove 마지막 도착 후 경과 ms"
let _fwdLastPt = null, _fwdFiredAt = 0;
function _guardStaleCapture(){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  let pt; try{ pt = screen.getCursorScreenPoint(); }catch(_){ return; }
  const prev = _fwdLastPt;
  _fwdLastPt = { x: pt.x, y: pt.y };   // ★ 어느 분기로 빠지든 표본은 항상 갱신한다

  if(_isConfigMode || _lastIgnoreRequested) return;          // 1) 2)
  let focused = true;
  try{ focused = mainWindow.isFocused(); }catch(_){ return; }
  if(focused) return;                                         // 3)
  /* 📺 커서가 오버레이 창 밖(=다른 모니터)이면 mousemove 가 안 오는 것이 정상이다 —
     여기서 moveAge 로 판단하면 전부 헛발동이다(_ptOnOverlayWindow 주석, 제보 로그 5/10건). */
  if(!_ptOnOverlayWindow(pt)) return;
  if(_rendererMoveAge < 0 || _rendererMoveAge < FWD_STALE_MS) return;   // 4)
  if(!prev) return;
  const dx = pt.x - prev.x, dy = pt.y - prev.y;
  if((dx*dx + dy*dy) < (FWD_MOVE_MIN_PX*FWD_MOVE_MIN_PX)) return;       // 5)

  const now = Date.now();
  if(now - _fwdFiredAt < FWD_REFIRE_MS) return;
  _fwdFiredAt = now;
  _lastIgnoreRequested = true;      // 통과로 회수 (_forwardFor 가 forward:true 를 유지해준다)
  _reapplyIgnoreMouse();
  // 렌더러 판정 캐시도 맞춘다 — 안 맞추면 "이미 통과 중"이라 믿고 다음 신호를 안 보내 교착된다.
  _sendHitTest(null);
  _fdLog('[포커스] 🔧 굳은 클릭받기 회수 — mousemove ' + _rendererMoveAge + 'ms 없음인데 커서는 이동'
    + ' | 앞창=' + (lastForeignWindow ? lastForeignWindow.name : '?')
    + ' 커서=(' + pt.x + ',' + pt.y + ')');
}

/* ═══ ⓖ 다른 앱 입력으로 굳은 판정 회수 ═════════════════════════════════
   [왜 ⓕ 만으로는 부족한가] ⓕ 의 발동 조건 5번은 **커서가 500ms 안에 60px 이상 움직였을 것**이다.
     그런데 실제 제보 두 건이 정확히 그 조건을 비껴간다.

     · 파이널판타지14 — 키보드 위주 조작이라 **마우스가 가만히 있다.** 판정이 굳어도 회수가 안 돈다.
     · 클립스튜디오   — 태블릿 펜은 **절대좌표**다. 캔버스와 캐릭터 사이를 순간이동하고,
                        펜을 들면 커서가 마지막 자리에 **멈춘 채로 남는다.** 그 자리가 캐릭터 위였다면
                        `ignore=false` 로 굳고, 커서는 안 움직이니 ⓕ 도 안 깨운다.

   [이 장치가 보는 증거] 전역 훅은 이미 다 깔려 있다(uIOhook mousedown/keydown, 아래 앱 준비 구간).
     우리 창에 포커스가 없는데 그쪽에서 입력이 들어온다 = **사용자는 다른 앱을 실제로 쓰는 중**이다.
     그런데 우리가 클릭 받을 준비를 하고 있다면 그 판정은 틀렸다.

     · 키 입력  — 다른 앱에 타자를 치고 있다. 커서 이동보다 오히려 강한 증거다(그 앱이 포커스를 쥐고 있다).
                  단, mousemove 가 정상 도착 중이면 렌더러가 스스로 고칠 수 있으므로 건드리지 않는다.
     · 클릭     — 좌표가 같이 온다. **캐릭터에서 확실히 먼 곳**을 눌렀다면 그건 우리 창을 노린 클릭이
                  아니다. 이땐 mousemove 상태를 따질 것도 없이 판정이 틀린 게 확정이다.

   ⚠️ **그 클릭 자체는 못 막는다.** uIOhook 은 감시만 하고 가로채지 않으므로, 이 함수가 도는 시점엔
     이미 그 한 번은 우리 창에 들어간 뒤다. 이 장치가 없애는 것은 **반복**이다 —
     지금은 한 번 굳으면 사용자가 커서를 캐릭터에 올려줄 때까지 누를 때마다 계속 튀어나온다.

   [방향] ⓕ 와 똑같이 **통과로 되돌리는 것만** 한다. 반대(임의로 클릭을 받게)는 예전 워치독이
     사고를 낸 자리라 여기서도 절대 안 한다. 오판해도 다음 mousemove 한 번이면 정상 복구된다. */
const FGN_CHAR_MARGIN   = 1.5;    // 캐릭터 반경의 이 배율 **밖**이어야 '확실히 먼 곳'으로 친다(경계에서 렌더러와 다투지 않게)
const FGN_BOUNDS_FRESH_MS = 3000; // 캐릭터 좌표가 이보다 오래됐으면 좌표 판정을 믿지 않는다
/* 🛡️ [2026-08-27] **렌더러가 방금 DOM 히트로 켰다면, 회수하지 말고 다시 물어본다.**

   [왜 필요한가] 이 함수의 좌표 판정 재료(_lastRegions)는 렌더러가 100ms 하트비트로 보내주는
     사각형 목록이다. 사각형은 근사치고, 렌더러의 `elementFromPoint` 는 정확하다. 둘이 어긋나면
     **정확한 쪽이 이겨야 한다.** 제보 로그에서 이게 정확히 뒤집혀 있었다 —
     ⓖ 회수 32건 중 28건이 `이유=dom:myStatusChip` 직후 중앙값 0.64초에 났다.
     (근본 원인은 app.js _uiRegions 가 상태칩 안의 position:fixed 팝업을 안 보내던 것이고
      그쪽은 고쳤다. 여기는 **같은 종류의 어긋남이 또 생겼을 때를 위한 그물**이다.)

   [어떻게] 회수 대신 그 좌표로 penHitTest 를 보내 렌더러에게 정밀 재판정을 시킨다.
     · 렌더러가 "통과다" 라고 답하면 → setIgnoreMouse(true) 가 와서 상황이 끝난다.
     · 렌더러가 "우리 UI 다" 라고 판단하면 → 이미 클릭받기 상태라 IPC 를 안 보낸다(무응답).
     그래서 무응답만으로는 '살아서 맞다고 답함'과 '죽어서 못 답함'이 안 갈린다.
     ⇒ 유예가 끝나면 **하트비트로** 그걸 가른다. 렌더러가 살아 있으면 그 판단을 믿고 물러나고,
       신호가 끊겼으면 원래대로 통과로 회수한다.
   ⚠️ 유예는 상황당 **한 번**이다. 이게 없으면 "매 클릭마다 유예"가 되어 이 장치가 사실상 꺼진다
     (파판14 건이 그대로 돌아온다 — 핸드오프4 §5). */
const FGN_TRUST_MS  = 2000;   // 렌더러의 '클릭받기 이유'를 이 시간까지만 최신으로 친다
const FGN_DEFER_MS  = 600;    // 재판정을 기다리는 시간
let _fgnDeferAt = 0;          // 마지막으로 유예한 시각 — 연속 유예 방지
function _fgnRecall(why){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  if(_isConfigMode || _lastIgnoreRequested) return;
  _fwdFiredAt = Date.now();
  _lastIgnoreRequested = true;      // 통과로 회수 (_forwardFor 가 forward:true 를 유지해준다)
  _reapplyIgnoreMouse();
  // 렌더러 판정 캐시도 맞춘다 — 안 맞추면 "이미 통과 중"이라 믿고 다음 신호를 안 보내 교착된다.
  _sendHitTest(null);
  _fdLog('[포커스] 🔧 굳은 클릭받기 회수(ⓖ) — ' + why
    + ' | 앞창=' + (lastForeignWindow ? lastForeignWindow.name : '?'));
}
function _guardForeignInput(kind){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  if(_isConfigMode || _lastIgnoreRequested) return;   // run 모드 + 지금 클릭을 받는 상태일 때만
  let focused = true;
  try{ focused = mainWindow.isFocused(); }catch(_){ return; }
  if(focused) return;                                 // 우리 창을 보고 있으면 정상이다

  let why = null, poke = null;
  if(kind === 'key'){
    /* 📺 커서가 오버레이 창 밖(=다른 모니터)이면 mousemove 가 안 오는 것이 정상이라
       moveAge 로 아무것도 판단할 수 없다(_ptOnOverlayWindow 주석). */
    let kpt; try{ kpt = screen.getCursorScreenPoint(); }catch(_){ kpt = null; }
    if(kpt && !_ptOnOverlayWindow(kpt)) return;
    // mousemove 가 살아 있으면 렌더러가 스스로 고친다 — 굳은 경우만 건드린다.
    if(_rendererMoveAge < 0 || _rendererMoveAge < FWD_STALE_MS) return;
    why = '다른 앱에 키 입력, mousemove ' + _rendererMoveAge + 'ms 없음';
  } else {
    // 클릭 — 좌표로 판단한다. 캐릭터를 노린 클릭이면 우리가 받는 게 맞으므로 건드리지 않는다.
    if(!_lastCharBounds || !_mainWinScreenBounds) return;
    if(Date.now() - _lastCharBoundsAt > FGN_BOUNDS_FRESH_MS) return;   // 좌표가 낡았다 — 판단 보류
    let pt; try{ pt = screen.getCursorScreenPoint(); }catch(_){ return; }
    /* 📺 오버레이가 아예 없는 모니터의 클릭이다 — 우리 창에 들어갔을 리 없으니 회수할 것도 없다. */
    if(!_ptOnOverlayWindow(pt)) return;
    const cx = pt.x - _mainWinScreenBounds.x, cy = pt.y - _mainWinScreenBounds.y;
    /* 📐 ★ 여기가 이번 제보의 자리다. 예전엔 '캐릭터에서 먼가'만 봤다 — 그래서 사용자가
       대화창에 손을 대면(캐릭터에서 1800px) 매번 "틀린 판정"으로 몰아 회수했고, 0.38초 뒤
       렌더러가 되돌리는 핑퐁이 났다(24분에 53회). 이제 우리 창 **전부**를 본다. */
    if(_ptOnOurUI(cx, cy, FGN_CHAR_MARGIN)) return;    // 우리 UI 위 — 정상 동작이다
    const dx = cx - _lastCharBounds.x, dy = cy - _lastCharBounds.y;
    why = '다른 앱에서 우리 UI 밖 클릭(캐릭터와 ' + Math.round(Math.sqrt(dx*dx+dy*dy))
        + 'px, 창 ' + _lastRegions.length + '개)';
    poke = { x: cx, y: cy };
  }

  const now = Date.now();
  if(now - _fwdFiredAt < FWD_REFIRE_MS) return;

  /* 🛡️ 그물 — 렌더러가 방금 'dom:' 판정으로 켰는데 내 좌표 판정이 '밖'이라면, 어긋난 쪽은
     **십중팔구 내 사각형**이다. 회수하지 말고 그 자리에서 다시 물어본다(위 주석). */
  if(poke && _hitWhyAt && (now - _hitWhyAt) < FGN_TRUST_MS
     && String(_lastHitWhy).indexOf('dom:') === 0){
    /* ⚠️ **유예 중에는 다음 클릭도 회수하지 않는다.** 재판정 요청만 연타 방지로 묶는다.
       여기서 '요청을 보낸 그 한 번'만 봐주면, 0.2초 뒤 두 번째 클릭이 그대로 회수를 부른다 —
       제보 로그의 회수 간격이 0.2~2.0초였으니 그물이 사실상 없는 것과 같아진다.
       ★ 그래도 무한정 봐주지는 않는다: _hitWhyAt 은 렌더러가 **전환할 때만** 갱신되므로
         FGN_TRUST_MS 가 지나면 이 분기가 저절로 닫히고 원래대로 회수가 돈다. */
    if((now - _fgnDeferAt) > FWD_REFIRE_MS){
      _fgnDeferAt = now;
      _sendHitTest({ x: poke.x, y: poke.y });
      _fdLog('[포커스] 🛡️ 회수 유예 — 렌더러가 ' + (now - _hitWhyAt) + 'ms 전에 ' + _lastHitWhy
        + ' 로 켰다, 재판정 요청 | ' + why);
      setTimeout(() => {
        if(_lastIgnoreRequested) return;                                // 렌더러가 스스로 통과로 갔다 — 끝
        // 무응답이다. 렌더러가 살아 있으면 그 판단(=우리 UI 위)을 믿고 물러난다.
        if(Date.now() - _lastCharBoundsAt <= FGN_BOUNDS_FRESH_MS) return;
        _fgnRecall(why + ' [재판정 무응답 + 렌더러 정지]');
      }, FGN_DEFER_MS);
    }
    return;
  }

  _fgnRecall(why);
}

/* ═══ [진단] 게임 중 창이 스스로 활성화되는 제보 추적 ═════════════════════
   (handoff-game-focus-steal.md §5 1단계. 원인이 확정되면 이 블록만 통째로 지운다.)

   ⚠️ **핸드오프의 `new Error().stack` 안(案)은 성립하지 않는다.**
     `mainWindow.on('focus')` 는 Electron이 OS 메시지 루프에서 비동기로 올려주는 이벤트다.
     핸들러 안에서 스택을 떠도 이벤트 디스패치 지점까지만 나오고, `focus()` 를 부른
     **호출자는 스택에 남아 있지 않다.** 그래서 방향을 뒤집었다 —
     **활성화를 일으킬 수 있는 호출 쪽에 표식을 심고**, focus 이벤트가 올라온 순간
     "직전에 우리가 뭘 불렀는가"를 나이(ms)와 함께 남긴다.

   [이 로그 한 줄로 갈리는 것]
     · raise=focus()@…ms  → 우리 코드가 부른 것. ⓐ(BGM move/resize) · ⓓ(second-instance).
     · raise=없음 + ignore=false
         → 우리가 부른 적 없는데 활성화됐고, 그 순간 **전체화면 투명 오버레이가 클릭을
           받는 상태**였다. 즉 게임 안에서 누른 클릭을 우리 창이 먹은 것이다.
           핸드오프에 없던 경로다(아래 §ⓕ 메모). 커서 좌표가 같이 남으니 화면 어디였는지 바로 나온다.
     · raise=없음 + ignore=true → 우리도 안 불렀고 클릭도 안 받았는데 활성화됨.
           그때만 ⓑ(setAlwaysOnTop·스타일 토글 z-order 경쟁)가 남는다. style@…ms 로 대조한다.

   ★ run 모드에서만 남긴다. 런처·마이홈(config)의 활성화는 정상이라 노이즈일 뿐이다.
   ★ 줄 수 상한을 따로 둔다 — 이 진단이 클릭고착 기록을 밀어내면 안 된다. */
const FOCUSDIAG_MAX_LINES = 800;
let _fdLines = 0;
let _fdRaise = null;   // { via, at }  창을 올리는 계열 호출 (focus/show/moveTop/restore/alwaysOnTop)
let _fdStyle = null;   // { via, at }  스타일 토글 계열 (setIgnoreMouseEvents)
let _fdFocusAt = 0, _fdBlurAt = 0, _fdCount = 0;

function _fdLog(msg){
  if(_fdLines > FOCUSDIAG_MAX_LINES) return;
  _fdLines++;
  if(_fdLines === FOCUSDIAG_MAX_LINES){ _diagLog('[포커스] 기록 상한 도달 — 이후 생략'); return; }
  _diagLog(msg);
}
function _fdAge(rec){ return rec ? (Date.now() - rec.at) + 'ms전 ' + rec.via : '없음'; }

/* 창을 올리거나 스타일을 건드리는 메서드에 표식을 심는다.
   ⚠️ 동작은 바꾸지 않는다 — 기록만 하고 원래 메서드를 그대로 부른다. */
function _fdInstrument(win){
  if(!win || win.__fdPatched) return;
  win.__fdPatched = true;
  const raiseNames = ['focus', 'show', 'showInactive', 'moveTop', 'restore', 'setAlwaysOnTop'];
  const styleNames = ['setIgnoreMouseEvents'];
  const patch = (name, slot)=>{
    const orig = win[name];
    if(typeof orig !== 'function') return;
    win[name] = function(){
      const rec = { via: name + '()', at: Date.now() };
      if(slot === 'raise') _fdRaise = rec; else _fdStyle = rec;
      return orig.apply(this, arguments);
    };
  };
  raiseNames.forEach(n => patch(n, 'raise'));
  styleNames.forEach(n => patch(n, 'style'));
}

/* ⚠️ bgmAlive 를 인자로 받는다 — `bgmWin` 은 createWindow 안의 지역 변수라 이 함수에서 못 본다.
   (모듈 스코프에서 바로 참조하면 ReferenceError 로 focus 핸들러가 통째로 죽는다.) */
function _fdOnFocus(bgmAlive){
  if(_isConfigMode) return;   // run 모드만 — config 모드 활성화는 정상
  const now = Date.now();
  _fdCount++;
  let cur = '';
  try{ const p = screen.getCursorScreenPoint(); cur = ' 커서=(' + p.x + ',' + p.y + ')'; }catch(_){}
  _fdFocusAt = now;
  _fdLog('[포커스] ON #' + _fdCount
    + ' | raise=' + _fdAge(_fdRaise)
    + ' | style=' + _fdAge(_fdStyle)
    + ' | 직전OFF로부터=' + (_fdBlurAt ? (now - _fdBlurAt) + 'ms' : '없음')
    + ' | 뺏은대상=' + (lastForeignWindow ? lastForeignWindow.name : '?')
    + ' | bgm창=' + (bgmAlive ? '있음' : '없음')
    + cur);
}
function _fdOnBlur(){
  if(_isConfigMode) return;
  const now = Date.now();
  _fdBlurAt = now;
  _fdLog('[포커스] OFF (활성 유지 ' + (_fdFocusAt ? (now - _fdFocusAt) : 0) + 'ms)');
}

/* ⓕ 메모 — 핸드오프에 없던 경로. 이것만 별도로 남긴다.
   렌더러가 "지금 클릭을 받겠다(ignore=false)"고 요청하는 순간, 우리 창이 **활성이 아니라면**
   그건 곧 "다른 프로그램을 쓰는 중인데 전체화면 투명 오버레이가 클릭을 가로챌 준비를 했다"는 뜻이다.
   이 상태에서 사용자가 게임 안 아무 곳이나 누르면 그 클릭이 우리 창으로 들어가 **게임이 비활성화된다.**
   커서 좌표를 같이 남기므로 화면 어느 자리가 판정을 참으로 만들었는지(#myStatusChip 묶음·캐릭터 등)
   바로 대조할 수 있다. — 자주 뜨는 로그가 아니다(포커스 없는 상태에서의 전환만 잡는다). */
let _lastIgnoreWhy = '?';   // 🩺 렌더러가 마지막으로 알려준 '클릭받기 전환 이유' (setCharBounds 에 얹혀 온다)
/* 🛡️ 위 값의 **소비하지 않는 사본** + 도착 시각. ⓖ 의 회수 유예(_guardForeignInput)가 이걸 본다.
   ⚠️ `_lastIgnoreWhy` 를 그대로 쓸 수 없다 — 그건 _fdOnIgnoreOff 가 한 줄 찍고 '?' 로 **비운다**.
     진단용으로는 그게 맞지만(옛 이유가 다음 전환에 따라붙지 않게), 판단 재료로는 비면 안 된다. */
let _lastHitWhy = '?', _hitWhyAt = 0;
function _fdOnIgnoreOff(){
  if(_isConfigMode) return;
  let focused = true;
  try{ focused = mainWindow.isFocused(); }catch(_){ return; }
  if(focused) return;   // 우리 창을 쓰는 중이면 정상
  let cur = '';
  /* 🩺 커서만으로는 갈래가 안 갈린다 — **캐릭터에서 얼마나 떨어졌는지**를 같이 찍는다.
     제보 로그 459건에서 커서 좌표의 94%가 캐릭터 근처가 아니었는데, 그게 '판정이 맞는데 자리가
     멀었다'인지 '자리와 무관하게 눈 감고 켰다'인지 구분할 수가 없었다. 거리와 이유를 같이 보면
     한 줄로 갈린다: 이유=kick3 이면 사다리, 이유=dom:xxx 면 그 창이 화면을 덮고 있는 것. */
  try{
    const p = screen.getCursorScreenPoint();
    cur = ' 커서=(' + p.x + ',' + p.y + ')';
    if(_lastCharBounds && _mainWinScreenBounds){
      const dx = (p.x - _mainWinScreenBounds.x) - _lastCharBounds.x;
      const dy = (p.y - _mainWinScreenBounds.y) - _lastCharBounds.y;
      cur += ' 캐릭터거리=' + Math.round(Math.sqrt(dx*dx + dy*dy)) + 'px(r=' + _lastCharBounds.r + ')';
    }else{
      /* 🧭 거리를 못 찍는 것도 정보다 — 이 줄이 뜨는 동안은 좌표 판정이 보류 상태다.
         (예전엔 이 칸이 조용히 사라져서, 45,000px 짜리 값이 왜 나오는지 찾는 데 로그 한 판을 썼다) */
      cur += ' 캐릭터거리=보류';
    }
  }catch(_){}
  _fdLog('[포커스] ⚠ 비활성 상태에서 클릭받기 전환(ignore=false) — 다음 클릭이 이 창으로 들어갈 수 있음'
    + ' | 이유=' + _lastIgnoreWhy
    + ' | 앞창=' + (lastForeignWindow ? lastForeignWindow.name : '?') + cur);
  _lastIgnoreWhy = '?';   // 한 번 쓰고 비운다 — 다음 전환에 옛 이유가 따라붙지 않게
}

// 모드별 창 크기.
// launcher: 세로로 긴 카드 (lc-card 320px + 여백)
// creator : 가로로 넓은 모달 (creatorModal 680px + 여백)
// run     : 전체화면 (아래에서 workAreaSize로 처리)
const MODE_SIZE = {
  launcher: { w: 380, h: 680 },
  creator:  { w: 740, h: 620 },
  animal:   { w: 860, h: 440 },   // 🐾 동물 생성기 — 미리보기 360px + 우측 500px, 낮고 넓은 레이아웃
  myhome:   { w: 800, h: 580 },   // ★ 마이홈 팝업이 런처의 좁은 창에 잘리던 문제 — 생성기처럼 별도 창 크기로 전환
                                    //   (친구탭 3단 레이아웃 + 컬럼 간격 확보 위해 620→760px로 재확대한 콘텐츠에 맞춰 800으로 조정)
};
const CONFIG_WIDTH = MODE_SIZE.launcher.w;
const CONFIG_HEIGHT = MODE_SIZE.launcher.h;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  /* 📐 [2026-09-15 제보 1·2] 첫 창도 같은 규칙 — 작업영역 원점을 더하고, 높이는 작업영역에 맞춘다.
     예전엔 workAreaSize 만 보고 (0,0) 기준으로 중앙을 잡았다 — 작업표시줄이 위에 있으면 그만큼 어긋난다. */
  const initRect = _fitConfigRect('launcher', MODE_SIZE.launcher, primaryDisplay, null);

  mainWindow = new BrowserWindow({
    width: initRect.width,      // 시작은 config 모드 크기로 (런처가 먼저 뜨니까)
    height: initRect.height,
    x: initRect.x,
    y: initRect.y,
    icon: APP_ICON,             // 작업표시줄/Alt+Tab 아이콘 — 안 주면 일렉트론 기본 아이콘이 나온다
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: false,   // 시작은 런처(설정) 모드라 항상위 불필요 — run 모드 진입 시 setConfigMode가 true로 켜줌
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

  /* 🎬 창을 만들자마자 한 번만 건다 — overlay-win.js 의 OVERLAY_LAYERED_ALPHA 주석 참조.
     ⚠️ **여기서 한 번이면 끝이다.** Electron 이 `layered_` 플래그를 들고 있어서,
       그 뒤 `setIgnoreMouseEvents` 가 몇 번을 왕복하든 WS_EX_LAYERED 를 다시 붙여 준다.
       주기적으로 다시 부르지 말 것 — 스타일 변경 자체가 크로미움의 가려짐 재계산 훅을
       두들겨서(핸드오프4 §4-2 의 906회 사고) 고치려던 깜빡임을 우리 손으로 만들게 된다. */
  overlay.applyLayered('부팅');
  /* 🚚 갭 승격이 일어났으면 한 줄 남긴다 — 제보 로그에서 "이 사람은 옛 값을 쓰고 있었다"가
     바로 보여야 한다. loadSettings 시점에는 app 이 아직 ready 가 아니라 여기서 찍는다. */
  if(_gapMigratedFrom != null){
    _diagLog('[오버레이] 갭 승격 — 옛 기본값 ' + _gapMigratedFrom + ' → ' + overlay.GAP_DEFAULT + ' (설정 파일 세대 갱신)');
    try{ saveSettings(); }catch(_){}
    _gapMigratedFrom = null;
  }

  _fdInstrument(mainWindow);   // 🩺 [진단] 활성화 원인 추적 — 창을 올리는 메서드에 표식만 심는다(동작 불변)

  mainWindow.loadFile(path.join(__dirname, 'app', 'desk-companion-prototype.html'));

  // ★ renderer의 window.open 요청 처리 — 방명록('mhGuestbook…')은 Win98풍 프레임리스 독립 창으로.
  //   frameName을 매번 고유하게 만들어 열기 때문에(prefix 매칭) "닫았다 다시 열면 안 나오는" 문제
  //   (닫힌 이름있는 창의 프록시 재사용 이슈)가 없음. 유저가 옮겨둔 위치는 savedGbPos로 기억.
  let savedGbPos = null;   // { x, y } | null — 방명록 창을 옮겨둔 위치(세션 동안 기억)
  let savedDsPos = null;   // { x, y } | null — 👑 디자인 스튜디오 창 위치 기억
  mainWindow.webContents.setWindowOpenHandler(({ frameName })=>{
    if(frameName && frameName.startsWith('mhGuestbook')){
      const opts = {
        width: 320, height: 560, frame: false, resizable: false,
        /* ★ [2026-09-16 제보 5 후속] 모서리는 **OS(DWM)에 맡긴다** — 네 모서리 8px.
             [경위] «버블에서 아래 모서리까지 둥글다»를 고치려고 roundedCorners:false 를 넣어 봤으나,
               DWM 은 «네 모서리» 아니면 «없음» 두 가지뿐이라 위까지 같이 사각이 됐다(실기기 확인).
               이 창은 불투명 창이라 페이지 CSS 의 border-radius 는 창 배경색 위에 그려질 뿐 창 모양을
               못 바꾼다 — 마이홈·플레이리스트가 둥근 것은 그것들이 창이 아니라 **투명한 메인 창 안의 div**
               이기 때문이다. 위만 둥글게 하려면 이 창도 transparent:true 로 가야 하고, 그건 이 프로젝트에
               전례가 있는 위험(handoff-overlay-video-blackout-4.md)이라 지금은 안 간다.
             ⇒ roundedCorners 를 건드리지 않는다(기본값 = OS 라운드). 타이틀바 디자인(여백 제거·그림자·
               위 모서리)은 그대로 살아 있고, 창 바닥만 OS 가 깎는다. */
        // ★ 실행 모드에선 메인 창이 alwaysOnTop:true라 자식창이 그 뒤로 가려짐 → 방명록 창도 alwaysOnTop 켬
        //   ⚠️ 여기 alwaysOnTop:true 는 기본 단계('floating')다. 메인은 'screen-saver'라 이것만으로는
        //      부족하고, 실제 단계 승격은 did-create-window 에서 setAlwaysOnTop(true,'screen-saver')로 한다.
        skipTaskbar: true, backgroundColor: '#c0c0c0', alwaysOnTop: true,
        /* ★ parent — "방명록을 드래그·클릭·입력창 클릭만 해도 마이홈 뒤로 들어간다"의 해결.
           단계('screen-saver')를 맞춰도 같은 단계 안에서의 순서는 OS가 그때그때 다시 정하는데,
           메인 오버레이는 setAlwaysOnTop 재적용·스타일 토글 등으로 수시로 밴드 맨 위로 다시 올라온다.
           그때마다 형제 창인 방명록이 그 밑으로 깔렸다(포커스는 방명록에 남아 있어 blur-닫힘도 안 걸리고,
           "열려는 있는데 마이홈에 가려진" 상태 — 제보 증상). Windows는 owned window(자식)를 owner(메인)보다
           항상 위에 유지하므로, 부모로 묶으면 메인이 어떤 경로로 올라오든 방명록이 같이 따라 올라온다.
           디자인 스튜디오(mhDesign)가 이미 같은 방식이고 같은 증상이 없다.
           메인 최소화 시 자식이 같이 숨는 부작용은 아래 minimize 핸들러가 어차피 방명록을 닫으므로 무해. */
        parent: mainWindow,
      };
      if(savedGbPos){ opts.x = savedGbPos.x; opts.y = savedGbPos.y; }
      return { action:'allow', overrideBrowserWindowOptions: opts };
    }
    if(frameName && frameName.startsWith('mhDesign')){
      const opts = {
        width: 340, height: 580, frame: false, resizable: false,
        skipTaskbar: true, backgroundColor: '#c0c0c0', alwaysOnTop: true,   // 동일 이유
        parent: mainWindow,   // ★ 메인 창의 자식으로 — 메인이 최소화되면 OS가 이 창도 함께 내림
      };
      if(savedDsPos){ opts.x = savedDsPos.x; opts.y = savedDsPos.y; }
      return { action:'allow', overrideBrowserWindowOptions: opts };
    }
    return { action:'allow' };   // 그 외(광고 배너 target=_blank 등)는 기존 기본 동작 유지
  });

  /* 🔒 메인 창은 **로컬 앱 문서 밖으로 절대 이동하지 않는다.**
     [왜] 이 창에는 preload 로 companion API 가 붙어 있다. 어떤 경로로든(마크업 주입, a[href],
       location 대입, 잘못 만든 링크) 원격 페이지로 넘어가면 그 API 를 원격 스크립트가 그대로 쓴다.
       contextIsolation 이 켜져 있어도 '노출하기로 한 것'은 노출된 채로 넘어간다.
     [무엇을 하나] file:// 이 아닌 이동은 막고, http(s) 면 **기본 브라우저로 돌린다** —
       유저가 누른 링크가 조용히 죽지 않게(외부 링크는 원래 openBrowser 로 가야 하는 것들이다).
     ⚠️ 이건 방어선이지 정상 경로가 아니다. 앱 안에서 외부 주소를 열 일이 생기면
       companion.openBrowser 를 쓸 것 — 여기까지 오면 그건 실수라는 뜻이다. */
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if(url && url.startsWith('file://')) return;   // 앱 문서 내 이동(해시·리로드 등)은 허용
    e.preventDefault();
    console.warn('[보안] 메인 창의 외부 이동을 막았습니다 —', String(url).slice(0, 120));
    if(url && /^https?:\/\//i.test(url)) shell.openExternal(url);
  });
  // 첨부/드래그로 들어온 파일이 창을 통째로 덮어쓰는 경로도 같이 막는다(같은 이유).
  mainWindow.webContents.on('will-frame-navigate', (e) => {
    const u = e.url || '';
    if(u.startsWith('file://')) return;
    e.preventDefault();
  });

  // ★ 방명록 창 추적 — window.open으로 만들어진 자식 창은 Windows에서 opener 창이 최소화되면 같이
  //   숨는데, 복원 때 같이 안 돌아오는 경우가 있음(창은 살아있는데 안 보이는 상태 → 버튼을 다시 눌러도
  //   renderer의 _gbWin.closed가 false라 focus만 시도하고 끝나서 "안 나옴"처럼 보임).
  //   main에서 창 참조를 들고 있다가 메인 창이 복원/표시될 때 방명록 창도 같이 다시 보여줌.
  let gbWin = null;
  let dsWin = null;
  let gbHoldUntil = 0;   // 이 시각 전까지는 방명록 blur-닫힘을 무시 (파일 다이얼로그 등)
  ipcMain.on('companion:gbHold', ()=>{ gbHoldUntil = Date.now() + 6000; });
  let dsHoldUntil = 0;   // 👑 디자인 스튜디오 blur-닫힘 유예 (컬러 팝업/기타 대화상자에서 사용)
  ipcMain.on('companion:dsHold', ()=>{ dsHoldUntil = Date.now() + 3000; });

  /* 🎨 OS 색 선택 대화상자 동안 '항상 위'를 잠시 비켜준다 ─────────────────────────────
     [증상] 👑 디자인 스튜디오에서 '직접 선택'을 누르면 색 선택 대화상자가 창 뒤로 깔려 안 보인다.
     [원인] 창 순서 문제다. 스튜디오 창은 alwaysOnTop(=WS_EX_TOPMOST)이고 mainWindow는 run 모드에서
            'screen-saver' 레벨까지 올려둔다. 그런데 <input type="color">가 띄우는 대화상자는
            평범한 창이라, Windows가 topmost 창들을 무조건 그 위에 유지한다.
            말랑이 파일 다이얼로그와 같은 종류지만, 그건 부모 창을 넘겨 모달로 붙일 수 있었고
            이건 렌더러가 만드는 대화상자라 부모를 지정할 방법이 없다.
     [대응] 대화상자가 열려 있는 동안만 topmost를 내린다. 끄기 전 상태를 창마다 기억해서 그대로
            되돌리므로, 런처 모드(원래 false)에서 켜져버리는 일은 없다.
     [복귀 신호 3중] ① 렌더러가 색을 고르거나 취소하면 open=false 를 보낸다
                     ② 대화상자가 닫히면 포커스가 우리 창으로 돌아온다 → 'focus' 1회 구독
                     ③ 위 둘이 다 안 오는 경우(다른 앱으로 전환 등)를 위해 90초 안전망
            어느 쪽이 먼저 오든 한 번만 복구되고(_colorDlgRestore=null) 나머지는 무시된다. */
  let _colorDlgRestore = null;
  ipcMain.on('companion:colorDialog', (e, open) => {
    if(!open){ if(_colorDlgRestore) _colorDlgRestore(); return; }
    if(_colorDlgRestore) return;                       // 이미 열려 있는 중 — 중복 진입 방지
    const lowered = [];
    [dsWin, mainWindow].forEach(w=>{
      try{
        if(w && !w.isDestroyed() && w.isAlwaysOnTop()){ w.setAlwaysOnTop(false); lowered.push(w); }
      }catch(_){}
    });
    dsHoldUntil = Date.now() + 120000;                 // 그동안 스튜디오가 blur로 닫히지 않게
    let done = false;
    const restore = ()=>{
      if(done) return; done = true; _colorDlgRestore = null;
      dsHoldUntil = Date.now() + 3000;                 // 평소 값으로 되돌림
      lowered.forEach(w=>{
        try{
          if(!w || w.isDestroyed()) return;
          // ★ 전부 'screen-saver'로 되돌린다. 예전엔 mainWindow만 최고 단계로, 나머지는 기본 단계로
          //   복원했는데, 그러면 색을 한 번 고른 뒤부터 스튜디오·방명록이 메인 뒤로 깔린다
          //   (= 여기서 고친 것과 똑같은 증상이 대화상자를 쓴 뒤에만 재발한다).
          w.setAlwaysOnTop(true, 'screen-saver');
        }catch(_){}
      });
    };
    _colorDlgRestore = restore;
    lowered.forEach(w=>{ try{ w.once('focus', restore); }catch(_){} });
    setTimeout(restore, 90000);
  });
  // 👑 네이티브 이미지 파일 선택 — 별도 창(디자인 스튜디오 등)에서 <input type=file>.click()이
  //   사용자 제스처 문제로 무시되는 경우가 있어, OS 파일 대화상자를 직접 띄우고 dataURL로 돌려줌.
  ipcMain.handle('companion:pickImage', async ()=>{
    try{
      // ★ 부모 창을 반드시 넘긴다. mainWindow가 alwaysOnTop 오버레이라, 부모 없는 다이얼로그는
      //   그 뒤로 깔려서 "말랑이 불러오기 창이 마이홈보다 뒤에 뜬다"는 증상이 된다.
      //   부모를 주면 모달로 붙어 항상 앞에 뜬다. (창이 없으면 기존처럼 부모 없이 호출)
      const _parent = (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : null;
      const _opts = {
        title: '이미지 선택',
        properties: ['openFile'],
        filters: [{ name: '이미지', extensions: ['png','jpg','jpeg','gif','webp','bmp'] }],
      };
      const r = _parent ? await dialog.showOpenDialog(_parent, _opts)
                        : await dialog.showOpenDialog(_opts);
      if(r.canceled || !r.filePaths || !r.filePaths[0]) return null;
      const fp = r.filePaths[0];
      const buf = require('fs').readFileSync(fp);
      const ext = (fp.split('.').pop()||'png').toLowerCase();
      const mime = ext==='jpg'||ext==='jpeg' ? 'image/jpeg'
                 : ext==='gif' ? 'image/gif'
                 : ext==='webp' ? 'image/webp'
                 : ext==='bmp' ? 'image/bmp' : 'image/png';
      return 'data:'+mime+';base64,'+buf.toString('base64');
    }catch(e){ return null; }
  });

  /* ═══════════════ 🔑 구글 로그인 (계정 연동) ═══════════════
     [왜 main 에서 하는가] 렌더러(app.js)는 file:// 로 뜬다. 구글 로그인은 http 오리진을 요구하고,
       이 앱의 CSP 는 frame-src 'none' 이라 팝업도 iframe 도 못 쓴다. 그래서 **별도 창**에서
       OAuth 를 돌리고 결과(ID 토큰)만 렌더러로 넘긴다. BGM 자식창과 같은 방식이다.
     ⚠️ 이 창에는 preload 를 붙이지 않는다. companion API 가 구글 페이지에 노출되면
       위 will-navigate 방어선(“메인 창은 file:// 밖으로 안 나간다”)이 막으려던 그 상황이 된다.

     [흐름] 인가 코드 + PKCE
       1) verifier/challenge 를 만들고 구글 인가 화면을 연다
       2) 구글이 redirect_uri 로 돌려보낼 때 **실제로 이동하기 전에 가로채서** code 를 꺼낸다
          (그래서 로컬 서버를 띄울 필요가 없다 — 127.0.0.1 에 듣는 것이 없어도 된다)
       3) 토큰 엔드포인트에서 code 를 id_token 으로 바꾼다 (Node 쪽 fetch — 렌더러 CSP 와 무관)
       4) 렌더러가 그 id_token 으로 firebase signInWithCredential 을 부른다
     ★ 암묵적 흐름(response_type=id_token)을 쓰지 않은 이유: 구글이 신규 클라이언트에서 막는
       방향으로 가고 있다. 코드+PKCE 는 데스크톱 앱의 표준 경로다.

     ⚠️ 설정 두 가지를 먼저 해야 동작한다 (코드로는 못 한다):
       · Google Cloud → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID → **데스크톱 앱**
         으로 만들고 아래 두 상수를 채운다.
       · Firebase 콘솔 → Authentication → Sign-in method → **Google** 사용 설정.
     ⚠️ 데스크톱 앱 클라이언트의 secret 은 이름과 달리 **비밀이 아니다.** 구글 문서가 그렇게 규정하고
       있고, PKCE 가 그 자리를 대신한다. asar 안에 들어가는 것을 걱정하지 않아도 된다.
       (X 의 OAuth 1.0a 가 consumer secret 노출로 곤란해지는 것과 다른 지점이다) */
  /* ⚠️ 값은 **저장소에 두지 않는다.** 공개 저장소라 그대로 커밋하면 누구나 이 클라이언트 ID 로
       우리 앱 이름을 단 동의 화면을 띄울 수 있고, GitHub 푸시 보호도 막는다.
       실제 값은 oauth-config.js 에 있고 그 파일은 .gitignore 에 있다.
     ⚠️ 파일이 없으면 빈 값으로 떨어진다 — 죽지 않고 아래 '설정되지 않았어요' 안내로 간다.
       CI 가 만든 설치본이 바로 그 상태다(값이 없으니 로그인만 안 된다).
     ⚠️ 내 컴퓨터에서 만든 설치본에는 값이 들어간다 — package.json build.files 에 넣어 뒀다. */
  let _oauthCfg = {};
  try{ _oauthCfg = require('./oauth-config'); }catch(_){}
  const GOOGLE_OAUTH_CLIENT_ID     = _oauthCfg.clientId     || '';
  const GOOGLE_OAUTH_CLIENT_SECRET = _oauthCfg.clientSecret || '';
  /* 가로채기용 주소. 실제로 여기 듣는 서버는 없다 — 이동 직전에 가로채기 때문이다.
     ⚠️ 구글 콘솔의 '승인된 리디렉션 URI' 에 이 주소를 그대로 넣어야 한다. */
  const GOOGLE_OAUTH_REDIRECT = 'http://127.0.0.1:52736/tw-oauth';
  let googleAuthWin = null;

  ipcMain.handle('companion:signInWithGoogle', async ()=>{
    if(!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET){
      return { ok:false, reason:'구글 로그인이 아직 설정되지 않았어요 (main.js 의 OAuth 상수)' };
    }
    /* 이미 열려 있으면 그 창을 앞으로 올리고 끝낸다 — 창이 둘 열리면 나중 것만 결과를 받고
       먼저 것의 invoke 는 영영 안 끝난다(버튼이 죽는다). */
    if(googleAuthWin && !googleAuthWin.isDestroyed()){
      try{ googleAuthWin.focus(); }catch(_){}
      return { ok:false, reason:'로그인 창이 이미 열려 있어요' };
    }

    const crypto = require('crypto');
    const b64url = b => b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const verifier  = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state     = b64url(crypto.randomBytes(16));

    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
      + '?client_id='     + encodeURIComponent(GOOGLE_OAUTH_CLIENT_ID)
      + '&redirect_uri='  + encodeURIComponent(GOOGLE_OAUTH_REDIRECT)
      + '&response_type=code'
      + '&scope='         + encodeURIComponent('openid email profile')
      + '&code_challenge=' + challenge
      + '&code_challenge_method=S256'
      + '&state='         + state
      /* select_account — 안 넣으면 이미 브라우저에 로그인된 계정으로 조용히 통과해서,
         '다른 계정으로 로그인'이 불가능해진다. 한 컴퓨터를 나눠 쓸 때 이게 필요하다. */
      + '&prompt=select_account';

    return await new Promise(resolve=>{
      let settled = false;
      const finish = r => {
        if(settled) return; settled = true;
        try{ if(googleAuthWin && !googleAuthWin.isDestroyed()) googleAuthWin.destroy(); }catch(_){}
        googleAuthWin = null;
        resolve(r);
      };

      googleAuthWin = new BrowserWindow({
        width: 480, height: 640,
        icon: APP_ICON,          // 이 창은 프레임이 있어서 타이틀바에도 아이콘이 보인다
        title: '구글 계정으로 로그인',
        parent: (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : undefined,
        modal: false,
        autoHideMenuBar: true,
        backgroundColor: '#ffffff',
        webPreferences: {
          // ★ preload 를 주지 않는다. 구글 페이지에 companion API 가 붙으면 안 된다.
          contextIsolation: true,
          nodeIntegration: false,
          partition: 'persist:googleauth',   // 메인 세션과 쿠키를 섞지 않는다
        },
      });
      /* run 모드의 메인 창은 alwaysOnTop('screen-saver') 이라, 같은 단계로 올리지 않으면
         로그인 창이 그 뒤로 깔려 '버튼을 눌렀는데 아무 일도 없다'가 된다(방명록 창의 선례와 같다). */
      try{ googleAuthWin.setAlwaysOnTop(true, 'screen-saver'); }catch(_){}

      const handle = (e, url)=>{
        if(!url || url.indexOf(GOOGLE_OAUTH_REDIRECT) !== 0) return;
        /* 여기서 막지 않으면 창이 127.0.0.1 로 이동해 '연결할 수 없음' 오류 페이지를 띄운다.
           유저에게는 로그인이 실패한 것처럼 보인다. */
        try{ e.preventDefault(); }catch(_){}
        let q = null;
        try{ q = new URL(url).searchParams; }catch(_){}
        if(!q){ finish({ ok:false, reason:'로그인 응답을 읽지 못했어요' }); return; }
        if(q.get('error')){ finish({ ok:false, reason:'로그인이 취소됐어요' }); return; }
        if(q.get('state') !== state){ finish({ ok:false, reason:'로그인 응답이 올바르지 않아요' }); return; }
        const code = q.get('code');
        if(!code){ finish({ ok:false, reason:'로그인 응답에 코드가 없어요' }); return; }

        fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_OAUTH_CLIENT_ID,
            client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
            code, code_verifier: verifier,
            grant_type: 'authorization_code',
            redirect_uri: GOOGLE_OAUTH_REDIRECT,
          }),
        })
        .then(res => res.json())
        .then(j => {
          if(j && j.id_token) finish({ ok:true, idToken: j.id_token });
          else finish({ ok:false, reason:'구글 토큰을 받지 못했어요' + (j && j.error ? (' (' + j.error + ')') : '') });
        })
        .catch(()=> finish({ ok:false, reason:'네트워크 오류 — 연결을 확인해 주세요' }));
      };
      googleAuthWin.webContents.on('will-redirect', handle);
      googleAuthWin.webContents.on('will-navigate', handle);
      /* 유저가 × 로 닫은 경우 — 이걸 안 걸면 invoke 가 영영 안 끝나서 로그인 버튼이 죽는다. */
      googleAuthWin.on('closed', ()=>{ googleAuthWin = null; finish({ ok:false, reason:'로그인이 취소됐어요' }); });

      googleAuthWin.loadURL(authUrl).catch(()=> finish({ ok:false, reason:'로그인 화면을 열지 못했어요' }));
    });
  });

  mainWindow.webContents.on('did-create-window', (win, details)=>{
    if(details && details.frameName && details.frameName.startsWith('mhGuestbook')){
      gbWin = win;
      /* ★ 창 레벨을 메인과 같은 단계까지 올린다 — 이게 "방명록이 마이홈 뒤로 숨는다"의 원인이었다.
         생성 옵션의 alwaysOnTop:true 는 기본 단계('floating')다. 반면 mainWindow는 run 모드에서
         setAlwaysOnTop(true,'screen-saver')로 최고 단계를 쓴다. OS는 단계를 먼저 정렬하고 그 안에서만
         포커스 순서를 보므로, 단계가 낮은 자식 창은 renderer에서 focus()를 몇 번 부르든 앞으로 못 온다
         (실제로 app.js의 open()에는 focus()가 두 번 들어가 있었는데 소용이 없었다).
         메인 오버레이는 투명이라 '뒤에 있어도' 대개는 보이지만, 마이홈 패널처럼 불투명한 DOM이
         그려진 자리에서는 그 픽셀이 방명록 창을 그대로 덮는다 — 제보된 증상이 정확히 이것이다.
         ⚠️ 색 선택 대화상자(companion:colorDialog)가 topmost를 잠시 내렸다 되돌리므로,
            그쪽 복원도 같은 단계로 맞춰야 한다(아래 restore 참고). */
      try{ win.setAlwaysOnTop(true, 'screen-saver'); }catch(_){}
      // 옮긴 위치 기억 — 다음에 열 때 같은 자리에 뜨게. ('moved'는 이동 완료 시 1회, 'move'는 연속 발생 —
      //  둘 다 걸어서 어느 환경에서든 확실히 기록)
      const remember = ()=>{ try{ const b=win.getBounds(); savedGbPos={ x:b.x, y:b.y }; }catch(e){} };
      win.on('moved', remember);
      win.on('move', remember);
      // ★ 요청사항: 방명록 창은 "바깥 클릭(포커스 잃음)" 시 자동으로 닫힘 — 버튼을 누르면 기억된 자리에 재오픈.
      //   (최소화 후 복원 시 위치 리셋/뒤에 숨는 문제를 복잡하게 고치는 대신, 깔끔하게 닫고 다시 여는 UX로)
      //   단, 웹박수 이미지 등록처럼 파일 다이얼로그를 여는 동작은 blur가 나도 닫으면 안 되므로
      //   renderer가 미리 gbHold를 보내두면 잠시(6초) 동안은 blur를 무시함.
      win.on('blur', ()=>{
        if(Date.now() < gbHoldUntil) return;   // 파일 선택 등 의도된 포커스 이탈 — 닫지 않음
        try{ if(!win.isDestroyed()) win.close(); }catch(e){}
      });
      win.on('closed', ()=>{ if(gbWin===win) gbWin=null; });
    }
    // 👑 디자인 스튜디오 창 — 위치 기억. blur로는 닫지 않음(바깥 클릭·파일 선택 시 창이 사라지지 않도록).
    //   완료(dsDone)/닫기(dsClose) 버튼 또는 메인 창 최소화로만 닫힘.
    if(details && details.frameName && details.frameName.startsWith('mhDesign')){
      dsWin = win;
      // 방명록과 같은 이유 — 기본 'floating' 단계로는 마이홈 패널이 그려진 자리에서 뒤로 깔린다.
      try{ win.setAlwaysOnTop(true, 'screen-saver'); }catch(_){}
      const rememberDs = ()=>{ try{ const b=win.getBounds(); savedDsPos={ x:b.x, y:b.y }; }catch(e){} };
      win.on('moved', rememberDs);
      win.on('move', rememberDs);
      win.on('closed', ()=>{ if(dsWin===win) dsWin=null; });
    }
  });
  // 프로그램(메인 창)을 내리면 스튜디오도 자동으로 닫힘 (다음 열기 때 기억된 위치에 재오픈)
  mainWindow.on('minimize', ()=>{
    if(dsWin && !dsWin.isDestroyed()){ try{ dsWin.close(); }catch(e){} }
  });
  // 프로그램(메인 창)을 내리면 방명록도 자동으로 닫힘
  mainWindow.on('minimize', ()=>{
    if(gbWin && !gbWin.isDestroyed()){ try{ gbWin.close(); }catch(e){} }
  });

  // 네이티브 드래그(app-region:drag)로 창이 실제 움직였을 때 위치 기억 — 런처/생성기 모드 각각.
  // (run 모드=전체화면 크기일 때는 해당 없음 — sizeToMode가 null 반환)
  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const b = mainWindow.getBounds();
    const m = sizeToMode(b.width, b.height);
    if (m) {
      savedPos[m] = { x: b.x, y: b.y };
    }
  });

  // mainWindow.webContents.openDevTools({ mode: 'detach' });
  // F12로 개발자도구 토글 (frame:false 창은 기본 메뉴/단축키가 없어서 직접 등록해야 함)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
    /* 🔍 Ctrl(+Shift)+= / Ctrl+- / Ctrl+0 — 기본 가속기가 먹기 전에 가로채 한 통로로 보낸다(applyUiZoom 주석). */
    const zop = _zoomKeyOp(input);
    if(zop){ event.preventDefault(); applyUiZoom(zop, 'key'); }
  });
  /* 🔍 Ctrl+휠·핀치 — 기본 동작을 막고 같은 통로로. 방향만 온다(값은 우리가 정한다). */
  mainWindow.webContents.on('zoom-changed', (event, dir) => {
    event.preventDefault();
    applyUiZoom(dir === 'in' ? 'in' : 'out', 'wheel');
  });
  /* 🔍 저장된 줌을 건다 — 파일 로드가 끝난 뒤가 확실하다(그 전에 걸면 로드가 되돌린다). */
  mainWindow.webContents.on('did-finish-load', () => { try{ applyUiZoom(uiZoom, 'boot'); }catch(_){} });

  mainWindow.on('closed', () => {
    // BGM 자식창을 수동으로 정리 (parent를 안 쓰기 때문에 자동 소멸이 없음)
    if(bgmWin && !bgmWin.isDestroyed()){ try{ bgmWin.destroy(); }catch(e){} }
    bgmWin = null; bgmView = null; bgmMainMoveHandler = null;
    mainWindow = null;
  });

  // ── active-win 폴링 실패 대응: 앱이 다른 창에 blur되는 순간을 별도 경로로 잡기 ──
  //   폴링이 activeWin-returned-null 등으로 lastForeignWindow를 갱신 못하는 경우에도, 사용자가 다른 창을
  //   클릭하는 순간엔 우리 창이 blur 이벤트를 받음. 그 순간 100ms 지연 후 activeWin 재호출하면 이미
  //   다른 창이 활성이 된 상태라 안정적으로 잡힘. 폴링과 무관한 백업 경로.
  /* ★ 우리 창이 포커스를 얻으면 펜 앱 상태를 풀고 마우스 설정을 다시 적용한다.
     _penAppActive는 500ms 창 폴링으로만 해제되는데, 폴링이 펜 앱 종료를 놓치거나 activeWin()이
     잠깐 실패하면 true로 남아버린다. 유저가 작업표시줄에서 앱을 고르는 순간 확실히 복구되게 하는 안전망. */
  mainWindow.on('focus', () => {
    /* 🩺 [진단] 반드시 맨 앞에서 — 아래 _reapplyIgnoreMouse()가 스타일 표식을 덮어쓰기 전에
       "활성화된 그 순간"의 상태(ignore 값·직전 호출)를 그대로 남겨야 한다. */
    try{ _fdOnFocus(!!(bgmWin && !bgmWin.isDestroyed())); }catch(_){}
    _penAppActive = false;
    _penMouseNearChar = false;
    _reapplyIgnoreMouse();
    /* 🔔 안전망 — 유저가 창을 본 순간 깜빡임을 끈다. 렌더러의 끄는 호출이 유실돼도
       여기서 정리되므로 "영원히 깜빡이는" 상태가 남지 않는다.
       ⚠️ 켜는 쪽은 여기 없다. 켜기는 초대가 왔을 때 renderer 가 시킬 때만이다. */
    try{ mainWindow.flashFrame(false); }catch(_){}
  });
  mainWindow.on('blur', () => {
    try{ _fdOnBlur(); }catch(_){}   // 🩺 [진단] 활성 유지 시간 — "뚝뚝 끊긴다"의 리듬이 여기서 나온다
    setTimeout(async () => {
      try{
        const w = await activeWin();
        if(!w || !w.owner) return;
        /* 이름 규칙은 sysinput 모듈 통로로만 — 근거는 startActiveWinPolling 쪽 주석. */
        const ownerPath = w.owner.path || w.owner.name || '';
        const exeName = sysinput.procNameOf(ownerPath);
        if(exeName && exeName !== SELF_EXE){
          lastForeignWindow = { key: focusKeyOf(exeName), name: sysinput.displayNameOf(ownerPath), path: w.owner.path || '', title: w.title || '' };
        }
      }catch(_){}
    }, 100);
  });

  startActiveWinPolling();

  // 창이 뜨고 나서 업데이트 확인 시작 (초기 로딩과 겹치지 않게 살짝 지연).
  // 개발 중(npm start)엔 electron-updater가 "패키징 안 된 앱"이라며 에러를 내는 게 정상이라 무시해도 됨 —
  // 실제 설치된 exe에서만 정상 동작함.
  // 🍎 맥은 autoUpdater 를 안 탄다 — 갈래는 startUpdateCheck() 안에 있다(위 주석).
  setTimeout(() => { startUpdateCheck(); }, 3000);

  // 렌더러가 "지금 재시작해서 설치" 버튼을 눌렀을 때 — 다운로드 완료된 업데이트를 설치하며 앱 재시작
  ipcMain.on('companion:installUpdate', () => { autoUpdater.quitAndInstall(); });

  // 광고 배너 클릭 등 — 시스템 기본 브라우저(크롬/웨일 등 사용자가 설정한 기본 브라우저)로 URL 열기.
  ipcMain.on('companion:openBrowser', (e, url) => {
    if(!url || !/^https?:\/\//i.test(url)) return;   // http/https만 허용(잘못된 스킴으로 로컬파일 등 여는 것 방지)
    shell.openExternal(url);
  });

  // ---- IPC: 마이홈 BGM 자식창 ----
  // 유튜브 임베드를 renderer의 file:// origin에서 재생하면 Referer 검증 실패로 Error 153이 뜨는 이슈가
  // 있어서, 아예 별도 BrowserWindow(진짜 https:// origin으로 유튜브 로드)를 자식창으로 띄워 재생.
  // ★ OS 네이티브 프레임 대신 frame:false + Win98풍 회색 타이틀바(커스텀 크롬)를 직접 그리고,
  //   그 아래 BrowserView에 유튜브를 붙임. 기본 크기는 타이틀바만 "빼꼼" 보이는 240x30.
  //   마이홈이 움직이면 같이 따라 움직이고, 마이홈이 닫히면 자동 소멸.
  let bgmWin = null, bgmView = null;
  let bgmMainMoveHandler = null;
  const BGM_CHROME_H = 30;   // 커스텀 타이틀바(베벨 포함) 높이
  let bgmRenderRect = null;   // renderer가 전달한 마이홈(#myHomeWin) DOM 사각형 — 있으면 이 좌표를 우선 사용
  /* 🎵 BGM 창 모드 — 마이홈 BGM과 상태칩 플레이리스트가 이 창 **하나를 공유**한다.
       'home'     : 마이홈 위젯. #myHomeWin 뒤에 숨고 마이홈을 따라 움직인다(기존 동작 그대로).
       'playlist' : 상태칩 플레이리스트. 마이홈과 무관하게 화면 우하단 작은 창으로 뜬다.
     규칙은 **나중에 튼 쪽이 이긴다.** 모드가 바뀌면 renderer에 알려서 진 쪽이 자기 표시를 내린다.
     ⚠️ 창을 둘로 나누면 소리가 겹쳐 나온다 — 그래서 하나로 유지하고 소유권만 넘긴다. */
  let bgmMode = 'home';
  /* 🔊 음량 0~1 — 플레이리스트 슬라이더가 정한다.
     ⚠️ 감시 루프(bgmForcePlay)가 매 tick마다 v.volume 을 강제로 되돌리기 때문에, 여기서 한 번
       set 하는 것만으로는 1초 안에 지워진다. 그래서 페이지 전역 __bgmVol 을 두고 루프가 그 값을
       쓰게 한다. 곡이 바뀌면 페이지가 새로 뜨므로, 주입 시점의 bgmVolume 이 초기값으로 박힌다. */
  let bgmVolume = 0.8;
  /* 🏠 [2026-09-17] 마이홈 BGM 은 **60% 로 줄여서** 튼다. 플레이리스트(playlist 모드)는 슬라이더 값 그대로.
       [왜] 마이홈에 곡을 걸어 두는 사람은 «배경» 으로 두는 것이라 작업 중 소리가 크다는 요청.
       [어떻게] bgmVolume 은 **페이지에 심는 값**이고, 슬라이더가 정한 원값은 bgmSliderVol 에 따로 둔다.
         입력이 바뀌는 두 자리(setBgmVolume IPC · bgmOpen 의 모드 전환)에서 bgmVolume = 원값 × (home 이면 0.6) 로
         다시 계산한다. 주입부(감시 루프·선점·광고 게이트 7곳)는 한 글자도 안 바뀐다 — sim-pl-loop 가 bgmForcePlay 를
         오려 «bgmVolume» 만 있는 무대에서 돌리므로, 거기에 새 이름을 두면 그 검사가 깨진다.
       ⚠️ bgmSliderVol(슬라이더 저장값)은 안 건드린다 — 마이홈에서 60% 로 줄였다고 플레이리스트가 같이 줄면 안 된다. */
  const HOME_BGM_GAIN = 0.6;
  let bgmSliderVol = bgmVolume;
  function bgmRecalcVolume(){ bgmVolume = (bgmMode === 'home') ? Math.round(bgmSliderVol * HOME_BGM_GAIN * 1000) / 1000 : bgmSliderVol; }
  bgmRecalcVolume();
  /* 🔁 플레이리스트 «한 곡 반복» — true 면 PL 모드에서도 <video>.loop 로 되풀이한다(렌더러가 setBgmLoop 로 정한다).
     [왜] 9/11 제보 「한 곡 반복이 안 넘어가다 멈춘다」. 옛 방식은 곡이 끝날 때마다 **같은 주소를 loadURL** 로
       다시 열었는데, 그때 페이지가 새로 뜨는지가 확인되지 않은 채였다(핸드오프 §1 갈래 ①/②).
       loop 로 붙이면 같은 주소를 다시 열 일 자체가 없어서 **어느 갈래든 상관없다.** 광고 게이트를 매번
       다시 지나지 않으니 곡도 끊김 없이 이어진다.
     ⚠️ 기본값 false. 구버전 app.js 는 이 값을 안 보내므로 옛 동작(끝나면 TWPL:ended) 그대로다.
     ⚠️ 1곡짜리 목록의 «목록 반복·셔플»은 여기 안 들어온다 — 렌더러가 한 곡 반복일 때만 켠다. */
  let bgmPlLoop = false;
  // 🎵 renderer가 알려준 플레이리스트 패널(#myPlaylistBox)의 DOM 사각형 — 그 뒤에 창을 숨긴다.
  //   null이면 패널이 닫힌 것 = 숨을 곳이 없다.
  let bgmPlRect = null;
  function bgmSendMode(){
    try{
      if(mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed())
        mainWindow.webContents.send('companion:bgmMode', bgmMode);
    }catch(_){}
  }
  /* 플레이리스트 모드 배치 — 마이홈이 #myHomeWin 뒤에 숨는 것과 **같은 방식**으로
     상태칩 플레이리스트 패널(#myPlaylistBox) 뒤에 숨는다.
     ⚠️ alwaysOnTop을 켜면 안 된다 — run 모드의 mainWindow가 alwaysOnTop:'screen-saver'라서,
        이 창이 그 위로 올라가면 패널에 가려지지 않고 그대로 보인다. 아래에 둬야 가려진다.
     ⚠️ 패널이 닫히면 숨을 곳이 없다. 패널은 display:none이 아니라 opacity:0으로 닫히므로
        '패널 뒤'라는 자리 자체가 안 가려준다 → 그때는 창을 투명(setOpacity 0)하게 만든다.
        창을 숨기거나(hide) 1px로 줄이면 유튜브가 재생을 멈출 수 있어서 소리만 남기는 이 방법을 쓴다. */
  function bgmPositionBehindPlaylist(){
    if(!bgmWin || bgmWin.isDestroyed() || !mainWindow || mainWindow.isDestroyed()) return;
    if(!bgmPlRect){
      try{ bgmWin.setOpacity(0); bgmWin.setIgnoreMouseEvents(true); }catch(_){}
      return;
    }
    try{ bgmWin.setOpacity(1); bgmWin.setIgnoreMouseEvents(false); }catch(_){}
    const cb = mainWindow.getContentBounds ? mainWindow.getContentBounds() : mainWindow.getBounds();
    // 패널보다 가로·세로 20% 작게 만들어 패널 한가운데에 놓는다 — 어느 가장자리도 삐져나오지 않는다.
    const SHRINK = 0.8;
    const w = bgmPlRect.w * SHRINK, h = bgmPlRect.h * SHRINK;
    const x = cb.x + bgmPlRect.x + (bgmPlRect.w - w) / 2;
    const y = cb.y + bgmPlRect.y + (bgmPlRect.h - h) / 2;
    // 메인창 밖으로는 나가지 않게 클리핑(마이홈 배치와 같은 이유 — 창 밖은 데스크탑이라 그대로 노출된다)
    const left   = Math.max(x, cb.x);
    const top    = Math.max(y, cb.y);
    const right  = Math.min(x + w, cb.x + cb.width);
    const bottom = Math.min(y + h, cb.y + cb.height);
    bgmWin.setBounds({ x:Math.round(left), y:Math.round(top),
                       width:Math.round(Math.max(1, right-left)), height:Math.round(Math.max(1, bottom-top)) });
  }
  // 모드에 맞는 창 속성·위치를 적용. 소유권이 넘어갈 때마다 부른다.
  function bgmApplyMode(){
    if(!bgmWin || bgmWin.isDestroyed()) return;
    if(bgmMode === 'playlist'){
      // 생성 시 최소 크기(180x30)가 패널의 80%보다 크면 창이 안 줄어들어 가장자리가 비어져 나온다.
      try{ bgmWin.setMinimumSize(80, 20); }catch(_){}
      bgmPositionBehindPlaylist();
    }else{
      try{ bgmWin.setMinimumSize(180, BGM_CHROME_H); }catch(_){}
      try{ bgmWin.setOpacity(1); bgmWin.setIgnoreMouseEvents(false); }catch(_){}
      bgmPositionRelativeToMain();
    }
    bgmLayoutView();
  }
  // renderer → main: 플레이리스트 패널 위치/크기 알림 (닫히면 null)
  ipcMain.on('companion:setPlBounds', (e, rect)=>{
    bgmPlRect = (rect && typeof rect.x === 'number') ? rect : null;
    if(bgmMode === 'playlist'){ bgmPositionBehindPlaylist(); bgmLayoutView(); }
  });
  function bgmPositionRelativeToMain(){
    if(bgmMode === 'playlist') return;   // 🎵 플레이리스트 창은 마이홈을 따라가지 않는다
    if(!bgmWin || bgmWin.isDestroyed() || !mainWindow || mainWindow.isDestroyed()) return;
    const mb = mainWindow.getBounds();
    // ★ renderer가 마이홈의 DOM 사각형을 알려줬으면(=마이홈 창이 열려있고 위치를 알 수 있으면) 그 뒤에
    //   완전히 숨도록 그 좌표로 BGM 창 배치. 안 알려줬으면(초기 진입 순간 등) 예전처럼 메인창 전체를 덮음.
    if(bgmRenderRect){
      const INSET = 4;   // 마이홈 창 안쪽으로 살짝 여유
      // ★ BGM 창 좌표(스크린 절대)를 우선 계산
      let x = mb.x + bgmRenderRect.x + INSET;
      let y = mb.y + bgmRenderRect.y + INSET;
      let w = bgmRenderRect.w - INSET*2;
      let h = bgmRenderRect.h - INSET*2;
      // ★ 마이홈이 런처 메인 창(작은 창) 경계를 넘어 잘리면 그 잘린 만큼 데스크탑이 보이는데,
      //   BGM 창은 데스크탑 좌표라 그 데스크탑 영역까지 그대로 나타남 → 마이홈 잘린 부분이
      //   유튜브로 채워져 보이는 문제. 그래서 BGM 창을 mainWindow(런처 메인) 클라이언트 영역으로 클리핑.
      const [cx, cy] = mainWindow.getContentBounds ? [mainWindow.getContentBounds().x, mainWindow.getContentBounds().y] : [mb.x, mb.y];
      const cw = mainWindow.getContentBounds ? mainWindow.getContentBounds().width : mb.width;
      const ch = mainWindow.getContentBounds ? mainWindow.getContentBounds().height : mb.height;
      const left = Math.max(x, cx);
      const top  = Math.max(y, cy);
      const right  = Math.min(x + w, cx + cw);
      const bottom = Math.min(y + h, cy + ch);
      x = left; y = top;
      w = Math.max(180, right - left);
      h = Math.max(BGM_CHROME_H, bottom - top);
      bgmWin.setBounds({ x:Math.round(x), y:Math.round(y), width:Math.round(w), height:Math.round(h) });
      return;
    }
    // ★ BGM 창은 마이홈보다 조금 작게 만들어 안쪽에 완전히 숨김 — 마이홈보다 크면 가장자리가 삐져나옴.
    //   Windows의 getBounds가 창 그림자/프레임 여유를 포함해 실제 콘텐츠보다 살짝 큰 값을 반환하는 경우가
    //   있어서, 여기서 명시적으로 20px 안쪽으로 인셋해서 확실히 마이홈에 가려지도록 함.
    const INSET = 20;
    bgmWin.setBounds({
      x: mb.x + INSET,
      y: mb.y + INSET,
      width: Math.max(180, mb.width - INSET*2),
      height: Math.max(BGM_CHROME_H, mb.height - INSET*2)
    });
  }
  // renderer → main: 마이홈 창 위치/크기 알림
  ipcMain.on('companion:setBgmBounds', (e, rect)=>{
    if(bgmMode === 'playlist') return;   // 🎵 플레이리스트가 창을 쓰는 동안은 마이홈 좌표를 무시
    if(rect && typeof rect.x==='number'){ bgmRenderRect = rect; bgmPositionRelativeToMain(); bgmLayoutView(); }
    else { bgmRenderRect = null; }
  });
  function bgmLayoutView(){
    if(!bgmWin || bgmWin.isDestroyed() || !bgmView) return;
    const b = bgmWin.getBounds();
    // 크롬(타이틀바) 아래 영역 전체를 유튜브 뷰로. 창이 타이틀바 높이뿐이면 1px만 남겨 오디오 유지.
    bgmView.setBounds({ x: 2, y: BGM_CHROME_H, width: Math.max(1, b.width - 4), height: Math.max(1, b.height - BGM_CHROME_H - 2) });
  }
  function bgmChromeHtml(title){
    const safe = String(title || 'YouTube BGM').replace(/[<>&"]/g, '');
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(
      '<!doctype html><html><head><meta charset="utf-8"></head>'+
      '<body style="margin:0;overflow:hidden;background:#c0c0c0;font-family:Tahoma,sans-serif;height:100vh;box-sizing:border-box;'+
      'border:2px solid;border-color:#ffffff #404040 #404040 #ffffff;">'+
      '<div style="height:22px;margin:2px;padding:0 5px;display:flex;align-items:center;justify-content:space-between;'+
      'background:linear-gradient(90deg,#7a7a7a,#a8a8a8);color:#fff;font-size:11px;font-weight:bold;user-select:none;">'+
      '<span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">'+safe+'</span>'+
      '<button onclick="window.close()" style="width:16px;height:14px;font-size:9px;line-height:1;cursor:pointer;padding:0;flex-shrink:0;'+
      'background:#c0c0c0;border:1px solid;border-color:#fff #404040 #404040 #fff;color:#000;">\u2715</button>'+
      '</div></body></html>'
    );
  }
  // 유튜브 페이지의 <video>를 강제로 unmute + play — 자동재생이 음소거/대기 상태로 시작하는 것 방지.
  // watch URL은 유튜브 정식 페이지(비디오 요소 + 큰 재생버튼)를 그대로 로드하므로 selector가 다양함.
  // ★ 광고 처리 전략:
  //   1) URL 차단으로 대부분의 광고를 원천 차단
  //   2) 그래도 흘러나온 광고는 광고 감지 후 배속+mute, 스킵 버튼 있으면 클릭
  //   3) 광고가 끝나면 배속·볼륨을 확실히 정상화 (매 tick에서 광고 아니면 항상 정상 상태 강제)
  //   4) 반복재생 — ended 이벤트 + 폴링 안전장치로 다음 영상 이동 차단
  // ★ 광고 소리 0초 누출 방지 — 페이지 내 스크립트는 로드 완료 후에야 주입돼서 첫 광고 소리가 잠깐
  //   새는데, Electron의 setAudioMuted(OS 레벨 음소거)를 로드 시작 순간부터 걸어두고 main에서 광고
  //   여부를 250ms마다 물어봐 광고가 아닐 때만 음소거를 풀면 광고 소리가 한 순간도 안 들림.
  /* ★ [2026-09-16 제보 7 후속 ②] «첫 소리는 맞는데 3초쯤 뒤 한 번 크게 튄다»의 정체.
       <video>.volume 을 우리가 넣어도 유튜브 플레이어(#movie_player)는 **자기 저장값**(localStorage
       `yt-player-volume`, 보통 100)을 초기화가 끝나는 시점에 다시 <video> 에 밀어 넣는다. 그 순간이 곡 시작
       2~3초 뒤이고, 다음 폴(250ms)이 되돌릴 때까지 100% 로 들린다.
     [그래서] ① dom-ready 에서 `yt-player-volume` 을 우리 값으로 먼저 써 둔다 — 플레이어가 초기화 때 읽는 값이
       곧 우리 값이 되어 밀어 넣을 것이 없다. ② 플레이어 API(setVolume)가 생기면 그쪽으로도 맞춘다 —
       <video> 만 고치면 플레이어 내부 상태는 여전히 100 이라 다음 기회에 또 밀어 넣는다. */
  const BGM_SET_VOL_JS =
    'function __twSetVol(want){'+
    '  var v=document.querySelector("video");'+
    '  if(v){ try{ if(Math.abs(v.volume-want)>0.005) v.volume=want; }catch(_){} }'+
    '  var p=document.querySelector("#movie_player");'+
    '  if(p&&typeof p.setVolume==="function"&&typeof p.getVolume==="function"){'+
    '    try{ var w=Math.round(want*100); if(Math.abs(p.getVolume()-w)>0.5) p.setVolume(w); }catch(_){} }'+
    '  try{ var now=Date.now(); localStorage.setItem("yt-player-volume", JSON.stringify({data:JSON.stringify({volume:Math.round(want*100),muted:false}),expiration:now+2592000000,creation:now})); }catch(_){}'+
    '}';
  /* 🔊 [2026-09-16 제보 7 후속 · «곡 시작에 음량이 확 커졌다 줄어든다»]
       bgmPrimeVolume(dom-ready) 이 있어도 새 <video> 가 1.0(100%) 으로 **먼저 소리를 내는 틈**이 남는다 —
       유튜브는 DOMContentLoaded 앞뒤로 플레이어를 띄우고, 게이트 폴은 «광고가 아니다» 하나만 보고
       음소거를 풀었다. 그래서 첫 250ms~수백 ms 는 100% 로 들리고 그 뒤 __bgmVol 로 떨어졌다.
     [그래서] 음소거를 푸는 조건에 **«<video> 의 volume 이 기억한 음량과 같다»** 를 더한다. 같아질 때까지는
       OS 레벨 음소거를 유지하고, 폴 자체가 그 tick 에 음량을 넣어 준다(주입이 늦어도 여기서 잡힌다).
       <video> 가 아직 없으면 어차피 소리도 없으므로 음소거를 유지해도 잃는 것이 없다.
     ⚠️ 이 뷰는 유튜브 전용(bgmUrlAllowed)이라 <video> 는 반드시 생긴다 — 다른 도메인을 허용하게 되면
       이 조건이 «영영 음소거»가 되므로 그때는 도메인별로 갈라야 한다.
     ⚠️ muted·play 는 여기서도 안 건드린다 — bgmForcePlay 가 주인(위 규칙 그대로). volume 만 본다. */
  let bgmAdPoll = null;
  function bgmStartAdGate(){
    if(!bgmView) return;
    bgmView.webContents.setAudioMuted(true);   // 로드 시작부터 무조건 음소거
    if(bgmAdPoll) clearInterval(bgmAdPoll);
    bgmAdPoll = setInterval(()=>{
      if(!bgmView || bgmView.webContents.isDestroyed()){ clearInterval(bgmAdPoll); bgmAdPoll=null; return; }
      bgmView.webContents.executeJavaScript(
        '(function(){var p=document.querySelector("#movie_player,.html5-video-player");'+
        'var isAd=!!((p&&p.classList&&p.classList.contains("ad-showing"))||'+
        'document.querySelector(".ytp-ad-player-overlay,.ytp-ad-preview-container,.ytp-ad-text"));'+
        'var want=(typeof window.__bgmVol==="number")?window.__bgmVol:'+bgmVolume+';'+
        BGM_SET_VOL_JS+
        'var v=document.querySelector("video"); var volOk=false;'+
        'if(v){ try{ __twSetVol(want); volOk=(Math.abs(v.volume-want)<=0.005); }catch(_){} }'+
        'return {isAd:isAd, volOk:volOk};})()'
      ).then(r=>{
        if(!bgmView || bgmView.webContents.isDestroyed()) return;
        const isAd = !!(r && r.isAd), volOk = !!(r && r.volOk);
        bgmView.webContents.setAudioMuted(isAd || !volOk);   // 광고이거나 음량이 아직 안 맞으면 계속 음소거
      }).catch(()=>{});
    }, 250);
  }
  /* 🔊 **음량 선점** — 곡이 바뀌는 순간의 "처음 2초만 원래 크기로 들린다"를 막는 자리.
     [무슨 일이 있었나] 다음 곡은 같은 자식창이 **새 페이지를 다시 읽는** 것이다. 새 페이지의
       window 는 비어 있으므로 __bgmVol 도 없고, 새로 생긴 <video> 는 기본값 1.0(=100%)으로
       소리를 내기 시작한다. 음량을 넣어주는 곳은 아래 감시 루프(bgmForcePlay)뿐인데 그것은
         ① did-finish-load — 유튜브 watch 페이지는 하위 리소스까지 다 받아야 뜨는 이벤트라 늦고
         ② 그 뒤 setInterval 의 **첫 tick 이 500ms 뒤**
       라서, 그 합만큼 100% 로 들린다. 20% 로 줄여둔 사람에게는 다섯 배다.
     [그래서] DOM 이 준비되는 즉시(=did-finish-load 보다 한참 이르다) main 이 기억한 음량을
       페이지에 심고, <video> 가 생기자마자 50ms 안에 그 값을 넣는 짧은 루프를 걸어둔다.
     ⚠️ 여기서 muted·play 는 **건드리지 않는다.** 음소거는 광고 게이트(bgmStartAdGate)가,
       재생 유지는 bgmForcePlay 가 주인이다. 주인이 둘이 되면 광고 소리가 새는 쪽으로 무너진다.
     ⚠️ 예전에는 «bgmForcePlay 를 여기서 또 부르면 안 된다 — 주입이 두 벌이 되면 TWPL:ended 도
       두 번 가서 곡이 한 번에 두 개씩 넘어간다» 였다. 지금은 주입 스크립트에 **페이지 플래그
       (__twplArmed)** 가 있어 두 벌이 될 수 없다. 그래서 아래 did-finish-load 와 함께
       dom-ready 에서도 감시를 붙인다 — did-finish-load 가 안 오는 경우가 이 제보의 원인이었다.
       ⚠️ 그래도 이 함수 자체는 음량만 본다. 음소거는 광고 게이트가, 재생 유지는 bgmForcePlay 가
         주인이라는 규칙은 그대로다. */
  function bgmPrimeVolume(){
    if(!bgmView || bgmView.webContents.isDestroyed()) return;
    bgmView.webContents.executeJavaScript(
      '(function(){ window.__bgmVol='+bgmVolume+';'+
      BGM_SET_VOL_JS+
      '  __twSetVol(window.__bgmVol);'+   // 저장값을 플레이어 초기화보다 먼저 써 둔다
      // 페이지가 새로 뜨면 이 플래그도 같이 사라진다 — 곡마다 딱 한 벌만 돈다.
      '  if(window.__bgmVolPrimed) return; window.__bgmVolPrimed=true;'+
      '  var n=0, t=setInterval(function(){'+
      '    __twSetVol(window.__bgmVol);'+
      '    if(++n>120) clearInterval(t);'+   // 50ms × 120 = 6초. 그 뒤는 bgmForcePlay·광고 게이트가 이어받는다
      '  }, 50); })()'
    ).catch(()=>{});
  }
  /* ★ 플레이리스트 모드에서는 loop을 걸지 않고, 곡이 끝나면 console.log('TWPL:ended')로 알린다.
     🔁 [9/11] 단 «한 곡 반복»(bgmPlLoop)이면 PL 모드에서도 loop 을 건다 — 아래 bgmPlLoop 주석 참조.
     BrowserView는 renderer와 IPC로 직접 이어지지 않아서 main이 콘솔을 채널처럼 쓴다(아래 console-message 훅).
     ⚠️ 임베드 IFrame API(enablejsapi)를 쓰지 않은 이유: 이 앱이 유튜브를 **watch 페이지**로 띄우는 것은
        file:// 원본 임베드가 Error 153으로 거부됐기 때문이다(위 주석). 임베드로 되돌리면 그 위험을 다시 진다.
        반면 <video> 요소 하나를 보는 이 주입 방식은 광고 음소거·강제재생으로 이미 앱 전체가 의존하고 있다. */
  /* 🐕 이번 곡에서 주입 스크립트의 신호를 한 번이라도 들었는가. 곡이 바뀔 때 false 로 되돌린다.
     [왜 필요한가] dom-ready·did-finish-load 를 둘 다 걸어도 «둘 다 안 오는» 경우가 남는다.
       그때는 아무도 감시를 안 붙이고, 렌더러는 영영 아무 소식도 못 듣는다.
       이 플래그와 아래 타이머가 **main 쪽 마지막 보루**다 — 조용하면 직접 다시 심는다.
     ★ 다시 심어도 안전하다: 주입 스크립트가 __twplArmed 로 두 벌을 막으므로,
       이미 붙어 있으면 새 주입은 즉시 물러난다. */
  let _twplHeard = false;
  let _twplRearmTimers = [];
  function _twplClearRearm(){ _twplRearmTimers.forEach(clearTimeout); _twplRearmTimers = []; }
  /* 곡을 새로 읽을 때마다 부른다. 조용하면 8초·20초에 한 번씩 다시 심어 본다.
     ⚠️ 무한히 재시도하지 않는다 — 두 번으로 안 되면 페이지 쪽 문제이고, 그때는
       렌더러의 감시견(_plNext)이 곡을 넘긴다. 여기서 계속 심으면 그 판단을 가린다. */
  function _twplArmRearm(){
    _twplClearRearm();
    _twplHeard = false;
    [8000, 20000].forEach(ms => _twplRearmTimers.push(setTimeout(()=>{
      if(_twplHeard) return;
      if(!bgmView || bgmView.webContents.isDestroyed()) return;
      console.warn('[BGM] ' + ms + 'ms 동안 TWPL 신호 없음 — 감시를 다시 심는다');
      bgmForcePlay();
    }, ms)));
  }
  function bgmForcePlay(){
    if(!bgmView) return;
    const PL = (bgmMode === 'playlist');
    bgmView.webContents.executeJavaScript(
      /* 🔁 loop 여부는 **무장 검사보다 먼저** 심는다 — 이미 감시가 붙은 페이지에 다시 주입해도 값은 갱신돼야 한다.
         ★ 감시 루프는 이 값을 매 tick **읽는다**(주입 때 박지 않는다). 재생 중에 반복 종류를 바꾸면
           setBgmLoop IPC 가 이 전역만 바꾸고, 다음 tick 부터 따른다. */
      '(function(){ window.__twplLoop='+(bgmPlLoop?'true':'false')+';'+
      '  var n=0; var boundV=null; var TWPL_MAX=28800; var PL='+(PL?'true':'false')+'; var lastT=-1;'+
      /* 🐕 [제보] "간혹 노래가 끝나도 다음 곡으로 안 넘어간다" — 이 감시가 **아예 안 붙는** 경우가
         있었다. 붙이는 곳이 did-finish-load 하나뿐인데, 그건 유튜브 watch 페이지의 하위 리소스를
         다 받아야 뜨는 이벤트라 하나만 걸려도 안 온다. 그때 곡은 멀쩡히 들린다(음량은 dom-ready 의
         bgmPrimeVolume 이, 재생은 유튜브 autoplay 가 하므로) — 그래서 끝날 때가 되어서야 티가 난다.
         ⇒ dom-ready 에서도 붙인다. 두 벌이 되지 않게 **페이지 플래그**로 막는다
           (bgmPrimeVolume 의 __bgmVolPrimed 와 같은 수법. 페이지가 새로 뜨면 같이 사라진다). */
      '  if(window.__twplArmed === PL) return; window.__twplArmed = PL;'+
      // 한 페이지(=한 곡)에서 종료 신호는 한 번만. 두 번 보내면 두 곡이 한꺼번에 넘어간다.
      '  var sent=false; function twplSay(m){ if(sent) return; sent=true; try{ console.log("TWPL:"+m); }catch(_){} }'+
      /* 💓 하트비트 — «신호가 안 온다»를 렌더러가 알아채는 유일한 근거다. 종료 신호와 달리 반복해서 보낸다.
         ★ 5초에 한 번만 보낸다. 매 tick(0.5초) 보내면 유튜브 자신의 콘솔 로그에 섞여 채널이 시끄러워진다.
         ★ 시각이 아니라 **재생 위치**를 보낸다 — 렌더러는 «시간이 얼마나 흘렀나»가 아니라
           «앞으로 나아가고 있나»로 판정해야 한다. 시간으로 자르면 40분짜리 믹스가 중간에 끊긴다. */
      '  function twplBeat(v, paused){ try{ console.log("TWPL:hb:" + Math.floor(v.currentTime||0)'+
      '    + "|" + (isFinite(v.duration) ? Math.floor(v.duration) : -1) + "|" + (paused?1:0)); }catch(_){} }'+
      /* ⚠️ 첫 tick 을 500ms 기다리지 않는다 — 그 0.5초가 곡이 바뀔 때 "소리가 잠깐 커지는" 구간에
         그대로 얹혔다. 아래에서 tick() 을 한 번 먼저 부르고 그 다음 setInterval 로 넘긴다.
         (그때 t 는 아직 null 이지만 clearInterval(null) 은 아무 일도 하지 않는다 —
          첫 호출에서 n 은 1 이라 애초에 그 가지로 가지도 않는다.) */
      '  var t=null; var tick=function(){'+
      // 모드가 바뀌어 새 감시가 붙었으면 낡은 쪽은 조용히 물러난다(신호가 두 벌이 되지 않게).
      '  if(window.__twplArmed !== PL){ clearInterval(t); return; }'+
      // 🔁 이번 tick 의 반복 방식. 마이홈 BGM(PL 아님)은 예전처럼 늘 loop 이다.
      '  var LOOP = PL && window.__twplLoop === true; var WANT_LOOP = !PL || LOOP;'+
      '  var v=document.querySelector("video");'+
      '  if(!v){ if(++n>TWPL_MAX) clearInterval(t); return; }'+
      // 광고 감지 먼저 — 광고 판정을 앞으로 옮겨 아래 loop 바인딩이 광고 video에 걸리지 않게.
      '  var player = document.querySelector("#movie_player, .html5-video-player");'+
      '  var isAd = !!(player && player.classList && player.classList.contains("ad-showing"))'+
      '           || !!document.querySelector(".ytp-ad-player-overlay, .ytp-ad-preview-container, .ytp-ad-text");'+
      // ★ 마이홈5-1: 광고가 아닐 때만 loop 재바인딩 — 광고용 video 요소를 우리가 새로 잡고 loop을 걸어
      //   같은 광고를 무한 재생시키던 버그 방지. ended 리스너도 같은 조건에서 한 번만.
      '  if(!isAd && boundV !== v){'+
      '    try{ v.loop = WANT_LOOP; }catch(_){}'+
      // ⚠️ 리스너 안에서는 LOOP 를 **다시 읽는다** — 바인딩한 뒤에 반복 종류가 바뀔 수 있다.
      '    v.addEventListener("ended", function(){ try{ if(v!==boundV) return;'+
      '      if(PL && window.__twplLoop !== true){ twplSay("ended"); return; }'+
      '      v.currentTime=0; var p=v.play(); if(p&&p.catch)p.catch(function(){});'+
      '    }catch(_){} });'+
      '    boundV = v;'+
      /* 🔁 매 tick loop 을 원하는 값에 맞춘다. 예전엔 «PL 아닌데 loop 이 꺼졌으면 켠다» 한 방향뿐이었다.
         ⚠️ 광고 중에는 손대지 않는다(위 마이홈5-1 — 광고 video 에 loop 이 걸리면 같은 광고가 무한 재생된다). */
      '  } else if(!isAd && v.loop !== WANT_LOOP){ try{ v.loop = WANT_LOOP; }catch(_){} }'+
      // 재생할 수 없는 영상(비공개·삭제·지역차단·임베드 금지) — 다음 곡으로 넘기라고 알린다
      '  if(PL && document.querySelector(".ytp-error")) twplSay("err");'+
      // ★ 자동재생 다음 영상 꺼두기 — YouTube 계정 설정과 무관하게 클라이언트 사이드로 확실히 OFF.
      '  var autoplayBtn = document.querySelector(".ytp-autonav-toggle-button[aria-checked=true]");'+
      '  if(autoplayBtn) try{ autoplayBtn.click(); }catch(_){}'+
      '  if(isAd){'+
      // 광고 중: mute + 배속 + 스킵 버튼 자동 클릭
      '    try{ v.muted=true; v.playbackRate=16; }catch(_){}'+
      '    var skip=document.querySelector(".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button[class*=\\"skip\\"]");'+
      '    if(skip) skip.click();'+
      '  } else {'+
      // 광고 아님(=본 영상): 매 tick마다 정상 상태 강제 (unmute+정상속도+80% 볼륨)
      '    try{ if(typeof window.__bgmVol!=="number") window.__bgmVol='+bgmVolume+';'+
      '         v.muted=false; if(Math.abs(v.volume-window.__bgmVol)>0.005) v.volume=window.__bgmVol;'+
      '         if(v.playbackRate!==1) v.playbackRate=1; }catch(_){}'+
      '  }'+
      // 재생 상태 유지 — pause 상태면 다시 play
      /* ⚠️ 단, 플레이리스트 모드에서 '끝에 다다른' 영상은 되살리지 않는다.
         영상이 끝나면 v.paused 가 true 가 되는데, 여기서 무조건 play() 하면 처음부터 다시 재생되고
         currentTime 이 0 으로 리셋된다. 그러면 바로 아래 안전장치(duration-0.4 도달 검사)가
         영영 못 걸려서, ended 이벤트를 한 번 놓치면 그 곡에서 영구히 멈춘다. */
      /* ⚠️ isFinite 를 반드시 본다. 라이브 스트림은 duration 이 Infinity 라 truthy 로 통과하는데
         currentTime >= Infinity - 0.4 는 영원히 false 다 — 옛 코드는 이 검사가 통과하는 줄 알았지만
         실제로는 라이브에서 **안전장치가 통째로 죽어 있었다.** */
      '  var atEnd = !isAd && isFinite(v.duration) && v.duration > 0 && v.currentTime >= v.duration - 0.4;'+
      // 💓 5초에 한 번. 광고 중에도 보낸다 — 광고가 길어도 «멈춘 것»으로 오해받지 않게.
      '  if(n % 10 === 0) twplBeat(v, !!window.__bgmPaused);'+
      /* 🔁 한 바퀴 돌았다 — 재생 위치가 **뒤로 크게 뛰었다**.
         ① TWPL_MAX 를 되감는다. loop 는 **한 페이지가 무한히 이어진다** — 곡마다 페이지가 새로 뜨던 옛 방식과 달리
            4시간 뒤 감시가 꺼지고, 렌더러 감시견이 그걸 실패로 세서 1곡 목록이면 바로 멈춘다(공부용 한 곡 반복이
            정확히 이 경우). 상한의 뜻은 «잊힌 페이지»인데, 도는 중인 페이지는 잊힌 게 아니다.
         ② 렌더러에 TWPL:loop 를 알린다 — 곡이 제대로 나왔다는 증거라 연속 실패를 끊는다. twplSay 가 아니다
            (그건 페이지당 한 번뿐이다). ⚠️ 렌더러는 이 신호로 곡을 넘기면 안 된다.
         ★ lastT 는 아래 안전장치가 currentTime 을 0 으로 되감기 **전에** 적는다. 뒤에 적으면 되감긴 0 이 적혀 못 알아챈다.
         ⏱️ [2026-09-12] 예전엔 «lastT 가 끝에서 1.5초 안»이라는 조건이 함께 붙어 있었다. 그건 **직전 tick 이
            반드시 그 1.5초 창 안에 들어왔다**는 가정인데, tick 이 한 번이라도 늦으면(스로틀링·무거운 페이지)
            그 창을 건너뛰어 한 바퀴를 통째로 놓친다. 그러면 n 이 안 되감겨 4시간 뒤 감시가 죽고,
            연속 실패도 안 끊긴다. 「반복 재생이 중단된다」 제보의 남은 갈래가 여기였다.
            ⇒ 창을 없애고 «뒤로 1초 넘게 뛰었다» 하나만 본다. 되감기는 어차피 한 바퀴에 한 번뿐이라
              이 신호도 한 바퀴에 한 번이다.
         ⚠️ 사람이 BGM 창에서 뒤로 감아도 여기 걸린다. 그래도 안전하다 — 이 신호가 하는 일은
           «n 되감기 + 연속 실패 0» 둘뿐이고, 둘 다 곡이 살아 있다는 사실과 모순되지 않는다.
           (렌더러가 이 신호로 곡을 넘기지 않는 것이 그 안전의 근거다 — app.js 의 kind==='loop' 분기) */
      '  if(LOOP && !isAd && lastT >= 0 && v.currentTime < lastT - 1){'+
      '    n = 0; try{ console.log("TWPL:loop"); }catch(_){}'+
      '  }'+
      '  lastT = isAd ? -1 : (v.currentTime || 0);'+
      '  if(v.paused && !window.__bgmPaused && !(PL && !LOOP && atEnd)){ var p2=v.play(); if(p2&&p2.catch)p2.catch(function(){}); }'+
      // 안전장치: 종료 근처면 처음으로 되감기 (ended가 놓쳐지는 경우 대비). 광고 중엔 안 함.
      '  if(atEnd){'+
      '    if(PL && !LOOP) twplSay("ended"); else { try{ v.currentTime=0; }catch(_){} }'+
      '  }'+
      // 큰 재생 버튼(로드 직후 재생이 안 걸린 경우)
      '  var big=document.querySelector(".ytp-large-play-button, button[aria-label*=\\"재생\\"], button[aria-label*=\\"Play\\"]");'+
      '  if(big && v.paused && !window.__bgmPaused) big.click();'+
      /* ⏱ 감시 지속 시간. 옛 값은 3600(=30분)이었는데, **30분이 넘는 곡에서 안전장치를 잃었다** —
         ended 를 놓치면 그 곡에서 영영 멈춘다. 로파이 믹스·강의 녹화가 딱 이 구간이라 흔하다.
         4시간으로 늘린다. tick 하나는 querySelector 몇 번이라 비용이 사실상 없다.
         ⚠️ 무한으로 두지는 않는다 — 페이지가 살아 있는 채로 잊히면 도는 것을 멈출 방법이 없다. */
      '  if(++n>TWPL_MAX) clearInterval(t);'+
      '};'+
      '  tick(); t=setInterval(tick, 500); })()'
    ).catch(()=>{});
  }
  ipcMain.on('companion:openBgm', (e, url, title) => { bgmOpen(url, title, 'home'); });
  // 🎵 상태칩 플레이리스트 — 같은 창을 쓰지만 마이홈에 종속되지 않는 배치로 한 곡을 재생한다.
  ipcMain.on('companion:openPlaylistTrack', (e, url, title) => { bgmOpen(url, title, 'playlist'); });
  /* 🔒 BGM 창에 띄울 수 있는 곳 — 유튜브 임베드뿐이다.
     [왜] 이 창은 남이 정한 주소로도 열린다(남의 마이홈을 구경하면 그 사람의 BGM 이 내 앱 안에서
       열린다). 스킴만 보면 원격 유저가 내 화면에 임의 사이트를 띄울 수 있다 — 광고·피싱 화면을
       '내 앱 안'에 올릴 수 있다는 뜻이라, 스킴 검사만으로는 부족하다.
     ⚠️ 호스트를 **정확히** 비교한다. includes('youtube.com') 로 하면
       `evil-youtube.com` · `youtube.com.attacker.net` 이 통과한다.
     ⚠️ 여기를 넓히면 그만큼 남이 내 화면에 띄울 수 있는 것도 넓어진다. 늘릴 때는 그 대가를 알고 늘릴 것. */
  const BGM_ALLOWED_HOSTS = new Set([
    'www.youtube.com', 'youtube.com', 'm.youtube.com',
    'www.youtube-nocookie.com', 'youtube-nocookie.com',
    'youtu.be',
  ]);
  function bgmUrlAllowed(url){
    try{
      const u = new URL(url);
      if(u.protocol !== 'https:' && u.protocol !== 'http:') return false;
      return BGM_ALLOWED_HOSTS.has(u.hostname.toLowerCase());
    }catch(_){ return false; }
  }
  function bgmOpen(url, title, mode){
    if(!url || !/^https?:\/\//i.test(url)) return;
    if(!bgmUrlAllowed(url)){
      console.warn('[보안] 유튜브가 아닌 주소라 BGM 창을 열지 않았습니다 —', String(url).slice(0, 120));
      return;
    }
    const modeChanged = (mode !== bgmMode);
    bgmMode = mode;
    bgmRecalcVolume();   // 🏠 home 이면 60% — 곡이 새로 뜨면서 이 값이 심긴다
    if(bgmWin && !bgmWin.isDestroyed()){
      // 이미 열려있으면 곡만 교체: 유튜브 뷰 URL 바꾸고 타이틀바 텍스트도 갱신
      if(bgmView){ bgmView.webContents.loadURL(url); bgmStartAdGate(); _twplArmRearm(); }   // 곡 변경 시에도 음소거 게이트 재가동
      bgmWin.webContents.loadURL(bgmChromeHtml(title));
      if(modeChanged){ bgmApplyMode(); bgmSendMode(); }
      return;
    }
    bgmWin = new BrowserWindow({
      // ★ parent:mainWindow를 쓰면 Windows에서 자식 창이 항상 부모 위에 강제로 올라옴 — BGM을 뒤로
      //   숨길 수 없게 됨. 그래서 parent는 안 쓰고, 아래 bgmWin.on('closed')와 mainWindow의 close 훅으로
      //   생명주기를 수동 관리.
      width: 240, height: BGM_CHROME_H,
      minWidth: 180, minHeight: BGM_CHROME_H,
      frame: false,             // ★ OS 프레임 제거 — Win98풍 커스텀 타이틀바 사용
      movable: false,           // 유저가 이 창은 드래그 못 하게 (부모 따라 이동만)
      resizable: true,          // 유저가 아래로 늘려서 영상/컨트롤 볼 수 있게
      minimizable: false,
      maximizable: false,
      alwaysOnTop: false,
      skipTaskbar: true,
      backgroundColor: '#c0c0c0',
    });
    bgmWin.loadURL(bgmChromeHtml(title));
    bgmView = new BrowserView({
      webPreferences: {
        // ★ Electron 기본 User-Agent에는 "Electron/xx.x.x"가 포함돼 있어서 유튜브가 임베드를 거부(Error 153).
        //   순수 Chrome UA로 위장해 정상 임베더로 인식되게 함.
        // (버전 문자열은 Chromium 최신 안정판을 흉내내는 값 — 너무 낮으면 오히려 차단됨)
        /* ⏱️ [2026-09-12] 이 창은 **일부러 숨긴다** — 플레이리스트 패널 뒤로 밀거나 setOpacity(0) 로
           투명하게 만든다(bgmPositionBehindPlaylist). 그래서 Chromium 이 이 페이지를 «보이지 않는
           페이지»로 보고 타이머를 늦출 수 있다(백그라운드 스로틀링: 1회/초, 5분 넘게 숨어 있으면 1회/분).
           그런데 곡 진행·종료·반복을 보는 감시 루프(bgmForcePlay)가 **500ms setInterval** 이다.
           늦춰지면 무슨 일이 벌어지나 —
             ・하트비트(5초에 한 번)가 몇 분에 한 번으로 벌어진다 → 렌더러 감시견의 25초 기준에 걸려
               멀쩡히 나오는 곡을 «멈췄다»로 읽고 넘긴다.
             ・끝 근처(duration-0.4) tick 을 통째로 건너뛴다 → 한 바퀴 판정(TWPL:loop)을 놓친다.
           소리가 나는 동안에는 Chromium 이 스로틀링을 면제하지만, 광고 게이트가 setAudioMuted 로
           음소거하는 구간에는 그 면제가 보장되지 않는다. 감시가 늦어도 되는 창이 아니므로 아예 끈다.
           ⚠️ 비용은 숨어 있는 동안에도 500ms tick 이 계속 도는 것뿐이다(querySelector 몇 번).
             어차피 소리를 내려고 살려 두는 페이지라 실질적인 추가 부담이 없다. */
        backgroundThrottling: false,
      }
    });
    const fakeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    bgmView.webContents.setUserAgent(fakeUA);
    // 🚫 유튜브 광고 차단 — ★보수적으로: 확실한 광고 전용 도메인/경로만 차단.
    //   (이전엔 'ad_type=' 'ad_break' 같은 넓은 문자열 패턴도 막았는데, 본 영상 스트림 URL(googlevideo.com)의
    //    쿼리 파라미터에 우연히 매칭돼서 영상 데이터 자체가 차단 → 광고 후 무음이 되는 버그가 있었음.
    //    스트리밍/통계 관련 엔드포인트는 절대 건드리지 않음.)
    const AD_HOSTS = [
      'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
      'googletagservices.com',
    ];
    const AD_URL_PATTERNS = [
      'youtube.com/pagead/', 'youtube.com/ptracking', 'youtube.com/get_midroll_info',
      'youtube.com/api/stats/ads',
    ];
    bgmView.webContents.session.webRequest.onBeforeRequest((details, cb)=>{
      const u = details.url;
      if(AD_HOSTS.some(h => u.includes(h))){ cb({ cancel:true }); return; }
      if(AD_URL_PATTERNS.some(p => u.includes(p))){ cb({ cancel:true }); return; }
      cb({});
    });
    // 유튜브가 요구하는 신뢰 가능한 Referer(https://) 를 세션 요청 헤더에 강제 삽입 —
    // BrowserView가 file:// 페이지에서 열리면 Referer가 비거나 file:// 로 붙어서 검증 실패.
    bgmView.webContents.session.webRequest.onBeforeSendHeaders((details, cb)=>{
      const h = details.requestHeaders;
      if(/^https:\/\/(www\.)?youtube(-nocookie)?\.com/.test(details.url) || /googlevideo\.com/.test(details.url)){
        h['Referer'] = 'https://www.youtube.com/';
        h['Origin']  = 'https://www.youtube.com';
        h['User-Agent'] = fakeUA;
      }
      cb({ requestHeaders: h });
    });
    bgmWin.setBrowserView(bgmView);
    bgmLayoutView();
    bgmView.webContents.loadURL(url);
    bgmStartAdGate();   // ★ 로드 시작과 동시에 OS 레벨 음소거 + 광고 감시 시작 (광고 소리 0초 누출)
    _twplArmRearm();    // 🐕 첫 곡도 같은 보루를 둔다
    /* 🔊 음량 선점이 먼저다 — dom-ready 는 did-finish-load 보다 이르고, 이 둘의 간격이 곧
       "다음 곡 초반에 소리가 커지는" 구간이었다. 이 자리는 곡을 바꿀 때마다(loadURL 마다) 다시 온다. */
    bgmView.webContents.on('dom-ready', bgmPrimeVolume);
    /* 🐕 감시를 **두 이벤트 모두**에서 붙인다. did-finish-load 는 하위 리소스를 다 받아야 오므로
       하나만 걸려도 안 온다 — 그때 감시가 통째로 안 붙어 곡이 끝나도 아무도 모른다(이 제보의 원인).
       주입 스크립트의 __twplArmed 가 두 벌을 막으므로 둘 다 걸어도 안전하다. */
    bgmView.webContents.on('dom-ready', bgmForcePlay);
    bgmView.webContents.on('did-finish-load', bgmForcePlay);
    /* 🎵 곡 종료·재생불가 신호 수신 — 주입 스크립트의 console.log('TWPL:…')를 renderer로 넘긴다.
       유튜브 자신도 콘솔에 로그를 잔뜩 찍으므로 접두어로 걸러낸다. */
    bgmView.webContents.on('console-message', (ev, level, message)=>{
      if(bgmMode !== 'playlist') return;
      // Electron 31은 (event, level, message, …) 인자를 주지만 상위 버전은 event.message 로 옮겼다 — 둘 다 받는다.
      const msg = (typeof message === 'string') ? message
                : (ev && typeof ev.message === 'string' ? ev.message : '');
      if(msg.indexOf('TWPL:') !== 0) return;
      _twplHeard = true;   // 🐕 신호가 오고 있다 — 아래 재주입 타이머의 근거
      try{
        if(mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed())
          mainWindow.webContents.send('companion:bgmTrackEnd', msg.slice(5));
      }catch(_){}
    });
    bgmWin.on('resize', bgmLayoutView);
    bgmWin.on('move', bgmLayoutView);   // ★ 마이홈 따라 위치가 바뀔 때도 뷰 크기 재계산 (누락돼 있어 창이 계속 커 보이던 버그)
    bgmPositionRelativeToMain();
    bgmLayoutView();
    // ★ BGM 창을 마이홈 뒤로 밀기 — 새 창은 자동으로 포커스를 뺏어가는데, 페이지 로드 도중에도
    //   창이 앞에 노출될 수 있어서 로드가 안정될 때까지 여러 번 반복해서 마이홈에 포커스를 되돌림.
    const pushBehind = ()=>{
      if(mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
    };
    [50, 200, 500, 1000, 2000].forEach(t=>setTimeout(pushBehind, t));
    // 마이홈이 움직이면 BGM 창도 같이 따라 움직임 + 그 뒤에 계속 깔린 상태 유지
    bgmMainMoveHandler = ()=>{
      // 두 모드 모두 메인창 기준 좌표라 메인창이 움직이면 같이 옮겨야 한다.
      if(bgmMode === 'playlist') bgmPositionBehindPlaylist(); else bgmPositionRelativeToMain();
      // 마이홈이 움직인 뒤 z-order가 흐트러질 수 있어서 매번 마이홈에 포커스 반환.
      if(mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
    };
    mainWindow.on('move', bgmMainMoveHandler);
    mainWindow.on('resize', bgmMainMoveHandler);
    bgmApplyMode();   // ★ 모드별 창 속성·위치 확정 (playlist면 우하단 독립 배치 + alwaysOnTop)
    bgmSendMode();
    bgmWin.on('closed', ()=>{
      if(mainWindow && !mainWindow.isDestroyed() && bgmMainMoveHandler){
        mainWindow.removeListener('move', bgmMainMoveHandler);
        mainWindow.removeListener('resize', bgmMainMoveHandler);
      }
      bgmWin = null;
      bgmView = null;
      bgmMainMoveHandler = null;
      if(bgmAdPoll){ clearInterval(bgmAdPoll); bgmAdPoll=null; }
      // renderer에 알림(▐▐ → ▶ 아이콘 복귀) — mainWindow의 webContents가 이미 destroyed 됐을 수도 있어서 try 감쌈
      try{
        if(mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()){
          mainWindow.webContents.send('companion:bgmClosed');
        }
      }catch(e){ /* 앱 종료 중이면 무시 */ }
    });
  }
  // ▐▐: 창은 그대로 두고 영상만 일시정지 (다음 ▶ 클릭 시 같은 창에서 즉시 재개)
  //   ★ 감시 루프(bgmForcePlay)가 "paused면 다시 play"를 하기 때문에, 페이지 전역 플래그(__bgmPaused)를
  //     세워서 유저가 의도한 일시정지는 루프가 건드리지 않게 함.
  ipcMain.on('companion:pauseBgm', () => {
    if(!bgmView || bgmView.webContents.isDestroyed()) return;
    bgmView.webContents.executeJavaScript(
      '(function(){window.__bgmPaused=true; var v=document.querySelector("video"); if(v)v.pause();})()'
    ).catch(()=>{});
  });
  // ▶ (창이 이미 열려있는 상태): 일시정지된 영상 재개 — 새로 로드 안 함
  ipcMain.on('companion:resumeBgm', () => {
    if(!bgmView || bgmView.webContents.isDestroyed()) return;
    bgmView.webContents.executeJavaScript(
      '(function(){window.__bgmPaused=false; var v=document.querySelector("video"); if(v){v.muted=false;v.volume=(typeof window.__bgmVol==="number"?window.__bgmVol:'+bgmVolume+'); var p=v.play(); if(p&&p.catch)p.catch(function(){});}})()'
    ).catch(()=>{});
  });
  /* 🔊 음량 (0~1) — 플레이리스트 슬라이더. 창이 아직 없어도 값은 기억해 두고,
     다음에 곡을 열 때 주입 스크립트가 그 값으로 시작한다. */
  ipcMain.on('companion:setBgmVolume', (e, v) => {
    const n = Math.max(0, Math.min(1, Number(v)));
    if(!isFinite(n)) return;
    bgmSliderVol = n; bgmRecalcVolume();   // 🏠 home 이면 60% 로 심긴다
    if(!bgmView || bgmView.webContents.isDestroyed()) return;
    bgmView.webContents.executeJavaScript(
      '(function(){window.__bgmVol='+bgmVolume+'; '+BGM_SET_VOL_JS+' __twSetVol('+bgmVolume+'); var v=document.querySelector("video"); if(v){ if('+bgmVolume+'>0) v.muted=false; }})()'
    ).catch(()=>{});
  });
  /* 🔁 한 곡 반복 on/off — 렌더러가 곡을 열기 직전과 반복 종류를 바꿀 때 보낸다.
     값은 기억해 두고(다음 주입이 심는다), 창이 있으면 지금 페이지의 전역도 바로 바꾼다 —
     감시 루프가 매 tick 그 전역을 읽으므로 재생 중에 바꿔도 다음 tick 부터 따른다. */
  ipcMain.on('companion:setBgmLoop', (e, on) => {
    bgmPlLoop = !!on;
    if(!bgmView || bgmView.webContents.isDestroyed()) return;
    bgmView.webContents.executeJavaScript('window.__twplLoop=' + (bgmPlLoop ? 'true' : 'false') + ';').catch(()=>{});
  });
  // ✕ (BGM 창 닫힘) 또는 마이홈 종료: 실제로 창을 파괴
  ipcMain.on('companion:closeBgm', () => {
    if(bgmWin && !bgmWin.isDestroyed()) bgmWin.close();
  });

  // ---- IPC: 자동 시작 (윈도우 로그인 시 실행) ----
  // Electron 표준 API인 app.setLoginItemSettings 사용 — Windows에서는 시작 프로그램 등록,
  // macOS에서는 Login Items 등록으로 처리됨. 개발 중(npm start)엔 executable이 electron.exe라
  // 실제 배포 앱과 다르게 동작할 수 있지만, 빌드된 설치본에서는 정확히 작동함.
  // 🚪 버전 게이트 — renderer가 자기 앱 버전을 알 수 있게(방 입장 시 minRoomVer와 비교용).
  ipcMain.handle('companion:getAppVersion', () => {
    try{ return app.getVersion(); }catch(e){ return null; }
  });
  // ★ 개발 모드(npm start)에서는 electron.exe를 인자 없이 그냥 등록하면, 시작프로그램으로 실행될 때
  //   "어떤 앱을 열어야 할지" 몰라서 Electron 기본 안내 화면이 뜸. 앱 폴더 경로를 인자로 명시해서
  //   실제 우리 앱이 열리게 함. 정식 배포(설치) 버전은 app.isPackaged가 true가 되고, electron.exe
  //   자체가 우리 앱 실행파일이라 이 처리가 필요 없음(오히려 건드리면 안 됨) — 그래서 개발 모드일
  //   때만 조건부로 적용.
  // ⚠️ [2026-09-15] **쓸 때와 읽을 때가 같은 path·args 여야 한다.** Windows 의 getLoginItemSettings 는
  //   path·args 가 똑같은 등록만 openAtLogin=true 로 친다. 예전엔 set 에만 args 를 넣고 get 은 빈손으로
  //   불러서, 개발 모드 토글이 "켜도 꺼진 채로" 보였다(등록은 됐는데 못 읽음). 찌꺼기로 남아 있던 인자 없는
  //   `electron.app.Electron` 레지스트리 줄이 그걸 true 로 가려 주고 있었고, 그 줄을 지우자 드러났다.
  //   설치본은 path·args 를 안 넣으니 이 함수가 undefined 를 돌려 준다 — 설치본 동작은 한 글자도 안 바뀐다.
  function _loginItemOpts(){
    return app.isPackaged ? undefined : { path: process.execPath, args: [path.resolve(__dirname)] };
  }
  /* 🔍 설정 › 화면표시 › 전체 화면 크기 — 버튼 셋(−·+·초기화)과 현재 배율 조회가 이 하나로 온다.
     op: 'in' | 'out' | 'reset' | 'get'. 돌려주는 값은 적용된 배율(1 = 100%). */
  ipcMain.handle('companion:uiZoom', (e, op) => {
    if(op === 'get') return uiZoom;
    return applyUiZoom(op, 'settings');
  });
  ipcMain.handle('companion:getAutoLaunch', () => {
    try{
      const s = app.getLoginItemSettings(_loginItemOpts());
      return !!s.openAtLogin;
    }catch(e){ return false; }
  });
  ipcMain.handle('companion:setAutoLaunch', (e, enable) => {
    try{
      const settings = Object.assign({ openAtLogin: !!enable }, _loginItemOpts() || {});
      app.setLoginItemSettings(settings);
      const s = app.getLoginItemSettings(_loginItemOpts());
      return !!s.openAtLogin;
    }catch(err){ return false; }
  });

  // ---- IPC: "포커싱 어플" 슬롯 관리 ----

  // 슬롯에 lastForeignWindow(직전에 쓰던 프로그램)를 등록. idx: 0~7
  //   lastForeignWindow가 아직 없으면(폴링 첫 결과 전 or 앱만 계속 활성이었음) 즉시
  //   activeWin()을 여러 번 재시도. 그래도 없으면 진단 정보(diag)를 함께 반환.
  ipcMain.handle('companion:registerFocusApp', async (e, idx) => {
    if(idx<0 || idx>=FOCUS_APP_SLOTS) return { ok:false, reason:'bad-index' };
    // ── Fallback: lastForeignWindow가 null이면 즉시 activeWin 최대 3번 재시도 (200ms 간격) ──
    for(let attempt=0; attempt<3 && !lastForeignWindow; attempt++){
      if(attempt > 0) await new Promise(r=>setTimeout(r, 200));
      try{
        const w = await activeWin();
        if(w && w.owner){
          /* 이름 규칙은 sysinput 모듈 통로로만 — 근거는 startActiveWinPolling 쪽 주석. */
          const ownerPath = w.owner.path || w.owner.name || '';
          const exeName = sysinput.procNameOf(ownerPath);
          if(exeName && exeName !== SELF_EXE){
            lastForeignWindow = { key: focusKeyOf(exeName), name: sysinput.displayNameOf(ownerPath), path: w.owner.path || '', title: w.title || '' };
          }
        }
      }catch(_){}
    }
    if(!lastForeignWindow){
      // ── 진단 ──
      let diag = 'no-active';
      try{
        const w = await activeWin();
        if(w && w.owner){
          /* 진단 문구도 판정과 **같은 값**을 보여야 한다 — 다르면 로그를 보고 왜 안 걸렸는지 못 가린다. */
          const name = sysinput.procNameOf(w.owner.path || w.owner.name || '');
          diag = name === SELF_EXE ? `self-active(${name})` : `foreign-but-null(${name})`;
        } else if(w){
          diag = 'no-owner';
        } else {
          diag = 'activeWin-returned-null';
        }
      }catch(err){
        diag = 'activeWin-error:' + (err && err.message || String(err)).slice(0, 60);
      }
      return { ok:false, reason:'no-window', diag, self: SELF_EXE };
    }
    focusApps[idx] = { ...lastForeignWindow };
    saveFocusApps();
    return { ok:true, app: focusApps[idx] };
  });

  /* 📋 실행 중인 창 목록 — "목록에서 직접 고르기"용.
     [왜 필요한가] 자동 등록은 '방금 전까지 활성이던 창'(lastForeignWindow)을 집는다. 대부분은 맞지만
       **게임에서는 거의 항상 틀린다.** 게임을 쓰다가 투게더워킹 패널을 누르려면 게임에서 빠져나와야 하고,
       그 사이에 바탕화면(explorer.exe)·런처·오버레이가 한 번 활성이 된다. 500ms 폴링이 그걸 잡아
       lastForeignWindow 를 덮어쓰므로, 등록되는 건 게임이 아니라 그 중간 창이다
       (제보: "게임 빼고는 다 정상적으로 등록됨" — 중간 창이 안 끼는 프로그램만 맞았다는 뜻).
     → '지금 활성인 것'이 아니라 '지금 떠 있는 것 전부'를 보여주고 사람이 고르게 한다.
     ⚠️ 관리자 권한으로 뜬 창은 여기에도 안 나온다(UIPI). 그건 OS 경계라 목록으로도 못 넘는다. */
  /* ⚠️ 거르는 규칙(셸 목록·최소 크기·같은 exe 중복)과 실패 경로(enum-failed)는
     sysinput 모듈에 있다 — 전부 **Windows 실행 파일 이름에 매인 규칙**이라 여기 두면
     그대로 Mac 까지 따라간다. 여기는 채널만 잇는다. */
  ipcMain.handle('companion:listWindows', async () => sysinput.listWindows());

  // 목록에서 고른 창을 슬롯에 그대로 넣는다 — 자동 감지를 거치지 않는다.
  ipcMain.handle('companion:setFocusApp', async (e, idx, appInfo) => {
    if(idx<0 || idx>=FOCUS_APP_SLOTS) return { ok:false, reason:'bad-index' };
    if(!appInfo || !appInfo.name) return { ok:false, reason:'bad-app' };
    /* ★ [2026-09-15 · ⑥] **키를 `name` 에서 만들지 않는다.**
         [무엇이 문제였나] mac 에서 `name` 은 이제 표시명(`Google Chrome`)이고 판정축은
           번들 id(`com.google.chrome`)다. 옛 줄대로 `focusKeyOf(appInfo.name)` 을 쓰면
           목록에서 고른 슬롯만 `mac:google chrome` 이 되어, 폴링이 만드는
           `mac:com.google.chrome` 과 **영영 안 맞는다.** 에러는 없고 집중 시간만 0 으로
           쌓인다 — §4-b 가 없애려던 증상 그대로다.
       ⇒ 목록 항목이 들고 온 **경로**에서 판정축을 다시 만든다. 경로가 없을 때만 옛 길로 떨어진다.
       ⚠️ 렌더러는 한 글자도 안 고친다 — listWindows 항목을 그대로 되돌려 주므로 path 가 온다.
         (listWindows 는 `key` 도 실어 보내지만 여기서 그걸 믿지 않는다. 렌더러를 거쳐 온 값을
          판정축으로 쓰면, 옛 렌더러가 그 필드를 떨어뜨렸을 때 조용히 빈 키가 된다) */
    const pickedPath = String(appInfo.path || '');
    focusApps[idx] = {
      key:   pickedPath ? focusKeyOf(sysinput.procNameOf(pickedPath)) : focusKeyOf(appInfo.name),
      name:  pickedPath ? sysinput.displayNameOf(pickedPath) : String(appInfo.name).toLowerCase(),
      path:  pickedPath,
      title: String(appInfo.title || ''),
    };
    saveFocusApps();
    return { ok:true, app: focusApps[idx] };
  });

  // 슬롯 해제 — 뒤 슬롯들을 앞으로 당겨옴(선입선출). 예: 1번 해제하면 2→1, 3→2, ... 8→7
  ipcMain.on('companion:clearFocusApp', (e, idx) => {
    if(idx<0 || idx>=FOCUS_APP_SLOTS) return;
    for(let i=idx; i<focusApps.length-1; i++){ focusApps[i]=focusApps[i+1]; }
    focusApps[focusApps.length-1]=null;
    saveFocusApps();
  });

  // 현재 슬롯 상태 조회 (설정 패널 열 때 등)
  ipcMain.handle('companion:getFocusApps', () => focusApps);

  // ── 시스템 유휴 시간(초) — 자동 자리비움 판정용 ──
  //   powerMonitor는 OS가 알려주는 진짜 유휴 시간이라 마우스 "이동"까지 포함됨.
  //   (렌더러가 uiohook으로 잡는 건 클릭/키 입력뿐이라 마우스만 움직이는 경우를 놓침)
  ipcMain.handle('companion:getIdleSeconds', () => {
    try{ return powerMonitor.getSystemIdleTime(); }catch(_){ return null; }
  });

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

  // 선택한 디스플레이로 창을 즉시 옮긴다. id는 getDisplays가 준 값.
  // - run 모드(전체화면 오버레이)면 그 모니터를 꽉 채우도록 이동.
  // - 런처/생성기(config 크기)여도 그 모니터의 중앙으로 이동해서, 프로그램 설정에서 모니터를
  //   눌렀을 때 창이 그 모니터로 바로 따라가는 걸 사용자가 체감할 수 있게 함.
  //   (모드별 savedPos도 초기화 — 새 모니터로 옮겼는데 예전 저장 위치가 이전 모니터 좌표라
  //   다음 진입 때 다시 예전 모니터로 튀는 걸 방지.)
  ipcMain.handle('companion:moveToDisplay', (e, displayId) => {
    const all = screen.getAllDisplays();
    const target = all.find(d => d.id === displayId);
    if(!target) return { ok:false, reason:'not-found' };
    runDisplayId = displayId;
    runDisplayKey = _displayKey(target);   // ★ id가 재발급돼도 이 지문으로 같은 모니터를 다시 찾는다
    saveSettings();   // ★ 재시작해도 유지되도록 즉시 저장
    if(mainWindow && !mainWindow.isDestroyed()){
      const b = mainWindow.getBounds();
      const curMode = sizeToMode(b.width, b.height);   // 'launcher'|'creator'|null(=run 크기)
      const wa = target.workArea;
      if(curMode){
        // 런처/생성기: 선택 모니터 중앙으로 옮기고 그 위치를 새 기준으로 저장
        const sz = MODE_SIZE[curMode];
        const nx = Math.round(wa.x + (wa.width - sz.w)/2);
        const ny = Math.round(wa.y + (wa.height - sz.h)/2);
        mainWindow.setBounds({ x: nx, y: ny, width: sz.w, height: sz.h });
        savedPos[curMode] = { x: nx, y: ny };
      } else {
        // run(전체화면): 그 모니터 작업영역 꽉 채움
        // ★ 높이는 overlay.runOverlayHeight 를 거친다 — 동영상 검어짐 대응(근거는 overlay-win.js 상단). 원래 크기로 되돌리지 말 것.
        const mvRect = { x: wa.x, y: wa.y, width: wa.width, height: overlay.runOverlayHeight(wa.height, target) };
        mainWindow.setBounds(mvRect);
        _noteApplied(mvRect, mainWindow.isAlwaysOnTop());
        overlay.logGeometry('모니터 변경');
      }
    }
    return { ok:true, id: displayId };
  });

  // ---- IPC: renderer(preload)에서 오는 요청 처리 ----

  // config 모드(런처/생성기) ↔ run 모드(캐릭터 실행) 전환
  // mode: 'launcher' | 'creator' | 'run'
  ipcMain.on('companion:setConfigMode', (e, isConfig, mode) => {
    _isConfigMode = !!isConfig;   // ★ 안전장치는 전체화면 오버레이(run)에서만 동작해야 함
    if (!mainWindow) return;
    // ★ 마이홈은 "런처가 지금 떠 있는 모니터" 기준으로 중앙 계산 — 캐릭터 실행용 모니터(getRunDisplay)와
    //   다르게 지정해둔 듀얼 모니터 환경에서, 런처와 동떨어진 엉뚱한 모니터에 뜨던 문제를 방지.
    let display;
    if(mode==='myhome'){
      const b = mainWindow.getBounds();
      const centerPoint = { x: b.x + Math.round(b.width/2), y: b.y + Math.round(b.height/2) };
      display = screen.getDisplayNearestPoint(centerPoint);
    } else {
      display = getRunDisplay();
    }
    const wa = display.workAreaSize;
    const waPos = display.workArea;   // {x, y, width, height} — 전역 좌표계에서의 작업영역(멀티모니터 대응)
    if (isConfig) {
      // 설정 화면: mode에 따라 크기 다름. 사용자가 옮긴 적 있으면 그 위치, 없으면 선택된 모니터 중앙.
      const sz = MODE_SIZE[mode] || MODE_SIZE.launcher;
      /* ⚠️ setResizable(true) 는 아래 '같은 상태면 생략' 판정 **뒤로** 옮겼다.
         고정 크기 창에 setBounds 를 걸면 OS 가 크기를 깎을 수 있어 잠깐 풀어줘야 하는데,
         그걸 판정 전에 부르면 isResizable() 이 항상 true 가 되어 판정이 영영 성립하지 않는다.
         (여기서 순서를 되돌리면 억제가 조용히 죽는다 — sim-overlay-apply-dedupe.js 가 지킨다.) */
      let remembered = savedPos[mode];
      // ★ creator(캐릭터 생성)로 전환할 때는 "지금 창이 있던 자리"를 그대로 이어받도록 강제.
      //   사용자가 런처를 옮겨둔 자리에서 캐릭터 생성을 누르면 그 자리에서 열리길 원함(중앙으로 튀거나
      //   이전 creator 세션의 좌표로 되돌아가지 않게). launcher → creator, run → creator 전환 모두 대응.
      if(mode==='creator'){
        const b = mainWindow.getBounds();
        // 현재가 launcher/creator/myhome 크기면 그 좌상단을 그대로. run(전체화면)이면 그 모니터 중앙으로.
        const curMode = sizeToMode(b.width, b.height);
        if(curMode){ remembered = { x: b.x, y: b.y }; }
        else       { remembered = null; }   // run에서 진입한 경우엔 아래 중앙 계산 사용
        savedPos[mode] = remembered;
      } else if(mode==='myhome'){
        // ★ 마이홈 위치 기억(요청사항) — 유저가 옮겨둔 위치가 있으면 거기로, 없으면(첫 열기) 런처가 있는
        //   모니터 중앙. 'moved' 핸들러가 sizeToMode('myhome')로 위치를 계속 기록해줌.
        remembered = savedPos.myhome || null;
      }
      /* 📐 [2026-09-15 제보 1·2] 크기·위치를 작업영역에 맞춘다 — 근거는 _fitConfigRect 위 주석.
         예전 «remembered ? 그대로 : 중앙» 은 그 함수 안에 그대로 있다. 여기서 직접 계산으로 되돌리지 말 것. */
      const cfgRect = _fitConfigRect(MODE_SIZE[mode] ? mode : 'launcher', sz, display, remembered);
      /* 🔁 여기도 같은 억제 — 마이홈이 열려 있는 동안에도 layoutSeats 가 이 IPC 를 계속 보낸다
         (applyDesktopRunClass 는 마이홈이면 mode='myhome' 으로 부른다). 위 savedPos 기록은
         이미 끝난 뒤라 건너뛰어도 위치 기억은 그대로다 — 건너뛰는 것은 창 조작뿐이다. */
      let cfgSame = false;
      try{ cfgSame = _winAlreadyIs(cfgRect, false) && mainWindow.isResizable() === false; }catch(_){}
      if(cfgSame){ _ovSkipped++; return; }
      mainWindow.setResizable(true);      // ★ 고정 크기 상태로 setBounds 하면 크기가 깎인다 — 잠깐 풀었다 닫는다
      mainWindow.setBounds(cfgRect);
      mainWindow.setResizable(false);
      mainWindow.setAlwaysOnTop(false);   // 런처/생성기에서는 다른 프로그램 작업을 방해하지 않게 항상위 해제
      _noteApplied(cfgRect, false);       // 🩺 OS 가 크기를 깎아도 같은 요청이 반복되지 않게
    } else {
      // 실행 화면: 선택된 모니터를 꽉 채우는 전체화면 투명 오버레이 (전역 좌표 x/y 포함 → 2번 모니터도 정확히 이동)
      // ★ 높이는 overlay.runOverlayHeight 를 거친다 — 동영상 검어짐 대응(근거는 overlay-win.js 상단). 원래 크기로 되돌리지 말 것.
      const runRect = { x: waPos.x, y: waPos.y, width: wa.width, height: overlay.runOverlayHeight(wa.height, display) };
      /* 🔁 이미 그 상태면 아무것도 하지 않는다(_winAlreadyIs 주석 — 실측 906회/30분).
         setBounds·setAlwaysOnTop 을 다시 부르는 것 자체가 뒤 창의 합성을 흔든다. */
      if(_winAlreadyIs(runRect, true)){ _ovSkipped++; return; }
      mainWindow.setBounds(runRect);
      overlay.logGeometry('run 진입' + (_ovSkipped ? ' (같은 요청 ' + _ovSkipped + '건 생략 후)' : ''));   // 🩺 실제 틈이 생겼는지 기록(제보 재확인용)
      _ovSkipped = 0;
      // 실행 중엔 캐릭터가 항상 보여야 하니 항상위 유지 — level을 'screen-saver'(가장 높은 단계)로
      // 줘서, 다른 프로그램(게임 오버레이, RGB 제어 소프트웨어 등)이 자기도 "항상 위"로 떠 있으려 할 때
      // 그쪽이 우리보다 더 높은 단계를 쓰면 우리 캐릭터가 가려질 수 있음 — 최고 단계를 써서 그런 경우를 최소화.
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      _noteApplied(runRect, true);        // 🩺 위와 같은 이유. 실측 417회/9분을 만든 자리다
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

  /* 🔁 앱 재시작 — 계정 연동 해제 / 구글 로그아웃이 부른다.
     [왜 재시작인가] 게이트(checkInviteGate)는 **부팅 때 한 번만** 도는 검사다. 그래서 세션 도중에
       신원을 놓아도 화면은 그대로 남는다 — 이미 그려진 마이홈, 이미 걸린 방·친구 구독, 메모리의
       옛 유저 코드가 전부 살아 있다. 그 상태로 계속 쓰면 getMyUserId() 가 그 자리에서 **새 유저
       코드를 만들어** 아무도 모르는 계정 앞으로 기록이 쌓인다.
     ★ 구독을 하나씩 걷어내고 게이트만 다시 띄우는 길도 있지만, 걷어낼 자리가 앱 전역에 흩어져
       있어서 한 곳만 빠뜨려도 두 계정이 섞인다. 재시작은 그 위험이 구조적으로 없다.
     ⚠️ relaunch() 는 '다음에 켤 것'을 예약할 뿐이다. quit() 을 반드시 이어 불러야 실제로 껐다 켜진다. */
  ipcMain.on('companion:relaunchApp', () => {
    try{ app.relaunch(); }catch(e){ console.warn('[재시작] relaunch 실패 — 종료만 합니다', e); }
    app.quit();
  });

  /* 🔔 작업표시줄 버튼 깜빡임 (카카오톡 방식). Windows FlashWindowEx 를 Electron 이 감싼 것.
     [전제] mainWindow 는 skipTaskbar:false 라 작업표시줄 버튼이 있다(위 createWindow 참고).
       자식창들은 skipTaskbar:true 라 깜빡일 대상이 없다 — 그래서 대상은 항상 mainWindow 다.
     ⚠️ 판정 기준은 '보이는가'가 아니라 isFocused() 다. run 모드는 전체화면 투명 오버레이라
       화면에 보이면서도 포커스는 다른 앱(그림 도구 등)에 있는 것이 정상 상태다.
       그림 그리는 중에 초대를 받으면 **깜빡이는 게 맞다.**
     ⚠️ flashFrame(true) 는 유저가 창을 누를 때까지 멈추지 않는다. 끄는 짝(false)이 반드시
       같이 불려야 한다 — 렌더러가 팝업을 닫을 때 부른다. 그 짝이 빠지면 이미 처리한 초대
       때문에 앱을 껐다 켜야 멈추는 종류의 버그가 된다.
     ★ 그래서 안전망을 하나 더 둔다: 창에 포커스가 들어오면 무조건 끈다. 렌더러 쪽에서
       끄는 호출이 유실돼도(예외·창 전환 중 언마운트) 유저가 창을 누른 순간 정리된다. */
  ipcMain.on('companion:flashFrame', (e, on) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      if (on) {
        if (mainWindow.isFocused()) return;   // 이미 보고 있는 창을 깜빡일 이유가 없다
        mainWindow.flashFrame(true);
      } else {
        mainWindow.flashFrame(false);
      }
    } catch (_) { /* 플랫폼이 지원 안 하면(일부 리눅스 WM) 조용히 넘어간다 */ }
  });

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
  // 단, 펜 앱(_penAppActive)이 활성 창일 땐 forward를 꺼서 태블릿 이벤트 중복 처리를 방지.
  //   → 스마트 감지: 마우스가 캐릭터 근처에 오면 잠시 forward를 다시 켬(_penMouseNearChar 판정, uIOhook mousemove에서).
  ipcMain.on('companion:setIgnoreMouse', (e, ignore) => {
    if (!mainWindow) return;
    const prev = _lastIgnoreRequested;
    _lastIgnoreRequested = !!ignore;
    // 🩺 [진단] 통과 → 클릭받기 전환만 본다(같은 값 반복은 무시). 위 _fdOnIgnoreOff 주석 참고.
    if(prev && !_lastIgnoreRequested){ try{ _fdOnIgnoreOff(); }catch(_){} }
    /* 🩺 [2026-08-31] **재판정이 실제로 들었는지**를 남긴다.
       지금까지 로그에는 '유령 의심'(찔렀다)과 '유령 회복 포기'(3번 찔러도 안 됨)만 있어서,
       그 사이 — 찔렀는데 풀렸다 — 가 안 보였다. 그래서 제보를 받아도 "2초 얹기가 원래 듣는데
       이번만 안 든 것"인지 "그 통로가 죽은 것"인지 갈릴 수가 없었다. 이 한 줄이 그걸 가른다. */
    if(prev && !_lastIgnoreRequested && _ghostPokes > 0){
      try{ _diagLog('유령 해제 — 재판정 ' + _ghostPokes + '회째에 렌더러가 클릭받기로 복귀'
        + ' (이유=' + _lastIgnoreWhy + ')'); }catch(_){}
      _ghostSince = 0; _ghostPokes = 0;
    }
    _reapplyIgnoreMouse();
  });

  /* 🎬 '영상 겹침 실험' 토글 — 설정 → 시스템.
     읽기: Promise<{on:boolean, alpha:number}>  ·  쓰기: Promise<{ok, on}>
     ⚠️ **알파만** 다룬다. 갭(overlayBottomGap)은 절대 건드리지 않는다 — 이유는 loadSettings 주석.
     ⚠️ 이 토글은 **성공하면 지운다.** 레이어드 알파가 실기기에서 효과가 확인되면 기본 동작으로
       올리고 이 통로와 UI 를 함께 걷어낼 것. 한 번 내보낸 토글은 켜 둔 사용자가 생겨서
       나중에 지우기 어려워진다 — 폐기된 🧪 실험실 칸이 정확히 그 이유로 위험해졌다. */
  ipcMain.handle('companion:getLabVideo', () => {
    return { on: overlay.alpha() > 0 && overlay.alpha() < 255, alpha: overlay.alpha() };
  });
  ipcMain.handle('companion:setLabVideo', (e, on) => {
    overlay.setAlpha(on ? overlay.LAYERED_ALPHA_ON : 0);
    try{ saveSettings(); }catch(_){}
    /* 즉시 반영한다 — 재시작을 요구하지 않는다. 스타일 변경은 재계산 훅이지만 이건 사람이
       버튼을 누른 순간 한 번뿐이라, 주기 호출 금지 원칙(위 주석)에 어긋나지 않는다. */
    overlay.applyLayered(on ? '토글 켜기' : '토글 끄기');
    return { ok: true, on: overlay.alpha() > 0 && overlay.alpha() < 255 };
  });

  /* 🩺 진단 기록 폴더 열기 — 제보를 받을 때 "이 경로의 파일을 보내주세요" 대신 버튼 하나로.
     ⚠️ 파일을 여는 게 아니라 **폴더를 열고 그 파일을 선택**한다(showItemInFolder). 로그를
       메모장으로 열어 버리면 유저가 내용을 복사해서 붙여넣게 되는데, 그러면 잘려서 온다. */
  ipcMain.handle('companion:openDiagFolder', () => {
    try{
      const f = path.join(app.getPath('userData'), 'tw-mouse-diag.log');
      if(fs.existsSync(f)){ shell.showItemInFolder(f); return { ok: true }; }
      shell.openPath(app.getPath('userData'));   // 아직 기록이 없으면 폴더만 연다
      return { ok: false };
    }catch(_){ return { ok: false }; }
  });

  // 렌더러가 캐릭터 화면 좌표(클라이언트) + 반경을 100ms throttle로 전달 — 스마트 감지의 판정 기준.
  ipcMain.on('companion:setCharBounds', (e, bounds) => {
    if(!bounds || typeof bounds.x!=='number' || typeof bounds.y!=='number') return;
    /* 🧭 [2026-09-01] **'캐릭터 좌표를 모른다'와 '캐릭터가 저 멀리 있다'는 다르다.**
       렌더러는 캐릭터가 없거나(런처·프로그램 이동) 투영이 터졌을 때 화면 밖 자리표(-99999)를 보낸다.
       예전에는 그걸 그대로 좌표로 받아서 ⓖ 가 "캐릭터에서 100,000px 떨어진 클릭이니 판정이 틀렸다"고
       읽고 통과로 회수했다 — 즉 **모른다는 말을 확신으로 바꿔** 유령을 만들었다.
       ⇒ 이제 null 로 둔다. `_ptOnOurUI` 는 캐릭터 원을 건너뛰고 창 사각형만 보고,
         ⓖ 의 좌표 분기는 `!_lastCharBounds` 에서 스스로 물러난다(=판단 보류). */
    /* 🔍 렌더러 좌표는 CSS px 다 — 줌을 곱해 DIP 로 바꿔 둔다(applyUiZoom 주석 ★ 좌표계). 100% 면 그대로다. */
    _lastCharBounds = (bounds.x <= -99999)
      ? null
      : { x: _zoomIn(bounds.x), y: _zoomIn(bounds.y), r: _zoomIn(Math.max(40, +bounds.r||120)) };
    _lastCharBoundsAt = Date.now();   // ★ 렌더러 생존 신호 — 위 안전장치가 이 시각을 본다
    /* 🩺 좌표를 못 믿는 구간의 **시작과 끝만** 기록한다. 하트비트는 10Hz 라 매번 남기면
       진단이 진단을 덮는다(로그 회전 주석 참고). 이 두 줄이 다음 조사에서 범인을 지목한다. */
    if(typeof bounds.charBad === 'string' && bounds.charBad){
      if(!_charBadSince){
        _charBadSince = Date.now();
        _diagLog('캐릭터 좌표 못 믿음 — ' + bounds.charBad
          + ' | 좌표 판정 보류(유령 감시·펜 근접·ⓖ 회수가 창 사각형만 본다)');
      }
    } else if(_charBadSince){
      _diagLog('캐릭터 좌표 복구 — ' + (Date.now() - _charBadSince) + 'ms 만에 정상');
      _charBadSince = 0;
    }
    // 🩺 mousemove 가 마지막으로 렌더러에 도착한 지 몇 ms 됐나 (-1 = 아직 한 번도 없음).
    //   _guardStaleCapture() 가 이 값을 본다. 예전 빌드의 렌더러는 안 보내므로 undefined 면 -1로.
    _rendererMoveAge = (typeof bounds.moveAge === 'number') ? bounds.moveAge : -1;
    /* 🩺 [2026-08-26] 렌더러가 "왜 클릭받기로 바꾸는지"를 여기 얹어 보낸다(app.js _pushIgnoreWhy).
       바로 뒤에 오는 companion:setIgnoreMouse 를 받을 때 _fdOnIgnoreOff 가 이 값을 찍는다.
       ⚠️ 전용 채널을 안 판 이유는 preload 무수정이다 — 구버전 렌더러는 이 필드를 안 보내므로
         그때는 값이 안 바뀌고 '?' 로 남는다(동작에는 영향 없음). */
    if(typeof bounds.ignoreWhy === 'string' && bounds.ignoreWhy){
      _lastIgnoreWhy = bounds.ignoreWhy;
      _lastHitWhy = bounds.ignoreWhy; _hitWhyAt = Date.now();   // 🛡️ ⓖ 회수 유예가 보는 사본(위 선언부 주석)
    }
    // 📐 우리 창들의 사각형. 안 보내는 구버전이면 건드리지 않는다(예전처럼 캐릭터만 보게 된다).
    if(Array.isArray(bounds.regions))
      _lastRegions = bounds.regions.map(g => ({ x: _zoomIn(g.x), y: _zoomIn(g.y), w: _zoomIn(g.w), h: _zoomIn(g.h) }));   // 🔍 CSS px → DIP
  });

  // 창 이동/리사이즈 시 스크린 좌표 캐시 갱신 — 실제로는 전체화면 오버레이라 거의 안 바뀜.
  mainWindow.on('move', _refreshMainWinBounds);
  mainWindow.on('resize', _refreshMainWinBounds);
  /* ★ [제보] 최소화→복귀 경로에는 이 둘이 **없었다.** 복귀해도 창 사각형이 최소화 전과 같아
     'move'·'resize' 가 안 뜨므로, 이 두 줄이 없으면 캐시가 자리표(-32000)인 채로 남는다.
     ⚠️ 'restore' 만으로는 부족하다 — 트레이/작업표시줄에서 show() 로 되살아나는 갈래가 따로 있다. */
  mainWindow.on('restore', _refreshMainWinBounds);
  mainWindow.on('show', _refreshMainWinBounds);
  _refreshMainWinBounds();

  /* 📐 [2026-08-26] 해상도·배율·작업영역이 바뀌면 run 오버레이를 다시 맞춘다 — 핸드오프5 §4-3.
     [무엇이 문제였나] 이 핸들러가 **없었다.** 갭(overlay.gapFor)은 배율로 나눠서 계산하는데,
       배율이 바뀌어도 창은 옛 크기 그대로 남는다. 그러면 아래 틈이 물리 0px 이 되어
       (=완전 차폐가 다시 성립) 영상이 검어진다. 화면 공유는 표시 설정이 흔들리기 쉬운 상황이라
       — 해상도 변경·모니터 연결/해제·원격 세션 — 실제로 걸릴 수 있는 자리다.
     ⚠️ **정확히 필요할 때만 부른다.** setBounds 자체가 크로미움의 가려짐 재계산 훅이라
       (핸드오프4 §4-2) 여기서 헤프게 부르면 고치려던 깜빡임을 우리가 만든다. 그래서 셋을 건다:
         1) run 모드일 때만 (config 창은 갭과 무관)
         2) 400ms 로 묶는다 — 배율 변경 한 번에 이 이벤트가 여러 발 온다
         3) `_winAlreadyIs` 로 이미 그 크기면 아무것도 안 한다 */
  let _dmTimer = null;
  screen.on('display-metrics-changed', () => {
    if(_dmTimer) return;
    _dmTimer = setTimeout(() => {
      _dmTimer = null;
      if(!mainWindow || mainWindow.isDestroyed()) return;
      /* 📐 [2026-09-15 제보 2] 런처·생성기 상태에서 주모니터나 배율이 바뀌면 지금 자리를 새 작업영역에
         다시 맞춘다. 예전엔 여기서 그냥 return 이라 실행 모드에 들어갔다 나와야 풀렸다.
         ⚠️ 갭 재계산(아래 run 분기)과는 다른 일이다 — config 창은 갭과 무관하고, 그래서 setBounds 가
           헤퍼도 합성을 흔들 뒤 창이 없다. 그래도 같으면 안 건드린다. */
      if(_isConfigMode){
        try{
          const b = mainWindow.getBounds();
          const m = sizeToMode(b.width, b.height);
          if(!m) return;
          const rect = _fitConfigRect(m, MODE_SIZE[m], screen.getDisplayMatching(b), { x: b.x, y: b.y });
          if(_sameRect(rect, b)) return;
          mainWindow.setResizable(true);    // 고정 크기 상태로 setBounds 하면 크기가 깎인다 — setConfigMode 와 같은 순서
          mainWindow.setBounds(rect);
          mainWindow.setResizable(false);
          _noteApplied(rect, false);
          savedPos[m] = { x: rect.x, y: rect.y };
          _diagLog('[창] 표시설정 변경 — ' + m + ' 창을 작업영역에 다시 맞춤 ' + rect.x + ',' + rect.y + ' ' + rect.width + 'x' + rect.height);
        }catch(_){}
        return;
      }
      try{
        const d = getRunDisplay();
        const wa = d.workArea;
        const rect = { x: wa.x, y: wa.y, width: wa.width, height: overlay.runOverlayHeight(wa.height, d) };
        if(_winAlreadyIs(rect, true)) return;   // 이미 맞다 — 건드리지 않는다
        mainWindow.setBounds(rect);
        _noteApplied(rect, true);
        _refreshMainWinBounds();
        overlay.logGeometry('표시설정 변경');
      }catch(_){}
    }, 400);
  });

  // ---- 전역 입력 감지 (uiohook-napi) ----
  // 창에 포커스가 없어도(다른 앱 사용 중이어도) 마우스 클릭/키보드 입력을 감지해 renderer로 전달.
  // 캐시된 최신 활성 프로세스 판정(lastActiveState, 500ms 폴링)을 함께 실어 보내서
  // renderer가 "등록된 앱을 쓰는 중일 때만 반응"하도록 필터링할 수 있게 함.
  /* ★ 'click'이 아니라 'mousedown'을 듣는다 ─────────────────────────────
     libuiohook의 CLICKED 이벤트는 '누른 자리에서 그대로 뗐을 때'만 발생한다.
     즉 누른 뒤 커서가 조금이라도 움직이면 드래그로 분류돼 click이 아예 안 나온다.
     → 포토샵에서 브러시로 긋는 동안(=드래그) 마우스 입력이 통째로 안 잡히던 원인.
       펜 탭도 손떨림으로 1~2px은 움직여서 같은 이유로 자주 누락된다.
     mousedown은 누르는 순간 무조건 나오므로 click의 완전한 상위집합이다 — 놓치는 경우가 없다.
     (버튼 정보는 그대로 실어 보내므로 렌더러 쪽은 손댈 필요 없음) */
  /* 📺 [2026-08-27] `offOverlay` — 이 클릭이 **오버레이가 없는 모니터**에서 났는가.
     렌더러의 고착 회복 사다리(app.js __mouseKick)가 이 값을 본다. 그 사다리의 발동 조건은
     "mousemove 가 3초 이상 없음" 인데, 다른 모니터에서는 forward 가 원래 안 오므로
     **가만히 있어도 무조건 조건이 성립한다.** 실제로 제보 로그의 08:27:12~56 구간에서
     사다리 3단계(kick3)가 44초에 10번 발동했고, 그 커서 x 는 전부 3421~3642 —
     오버레이(2560 폭) 밖이었다. 3단계는 0.8초간 클릭을 가로채므로, 그게 곧
     "다른 앱 쓰는데 투게더워킹이 튀어나온다" 가 된다.
     ⚠️ 전용 채널을 파지 않는다 — preload 의 onGlobalClick 은 payload 를 그대로 넘기므로
       필드 하나를 얹으면 구버전 preload 와도 짝이 맞는다(모르는 필드는 그냥 무시된다). */
  /* ⚠️ 아래 세 함수가 **핸들러 본문**이다. sysinput 모듈로 따라가지 않는다 —
     판정(_guardForeignInput)·offOverlay 계산·IPC 전송은 플랫폼과 무관한 우리 규칙이고,
     특히 ⓖ 회수는 클릭 통과 축과 맞물려 있어 어느 모듈로도 깨끗하게 안 떨어진다(핸드오프 §4-②). */
  const _onGlobalMouseDown = (e) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    _guardForeignInput('click');   // ⓖ 굳은 클릭받기 회수 — 캐릭터에서 먼 클릭이면 판정이 틀린 것이다
    let offOverlay = false;
    try{ offOverlay = !_ptOnOverlayWindow(screen.getCursorScreenPoint()); }catch(_){}
    mainWindow.webContents.send('companion:globalClick',
      { x: e.x, y: e.y, button: e.button, ...lastActiveState, offOverlay });
  };
  /* 휠 스크롤도 '사람이 그 앱을 쓰는 중'이다 — 브라우저·문서에서 읽기만 하는 동안
     클릭도 키도 없어서 통째로 자리비움으로 빠지던 구간을 메운다.
     ★ 휠은 한 칸 돌릴 때마다 이벤트가 나와서 빠르게 스크롤하면 초당 수십 개가 된다.
       판정에 필요한 건 '최근에 입력이 있었나' 하나뿐이라 200ms로 솎아낸다. */
  let _lastWheelSentAt = 0;
  /* 🛞 [2026-09-17 제보 3-1 · C] `wheel:true` 표식을 얹는다 — **휠은 고착 회복 사다리(app.js __mouseKick)를 올리면 안 된다.**
       [로그가 보여준 것] 제보자 진단 로그의 kick3 212건 중 206건이 커서가 **다른 모니터**에 있을 때(chrome 205건),
         나머지는 커서가 캐릭터 옆 여백에 **가만히 있을 때** 3초 간격으로 셋(09-15 14:30:56~59, (1327,782) 고정).
         전부 «크롬을 스크롤하는 중» 이다. 스크롤은 마우스를 안 움직이므로 mousemove 가 3초 없는 것이
         정상인데, 이 이벤트가 클릭과 같은 채널·같은 모양으로 가서 사다리가 «mousemove 가 죽었다» 로 읽고
         1.5초마다 3단계(0.8초 클릭받기)를 반복했다 → 그 0.8초마다 투명 전체화면 창이 휠·클릭을 먹는다
         = «여백에 커서를 두면 뒤의 크롬이 스크롤·클릭이 안 된다» 그대로. 마우스를 움직이면(다른 모니터로
         갔다 오면) mousemove 가 와서 단계가 0 으로 풀린다 — 제보의 «갔다 오면 풀린다» 도 그것이다.
       [왜 offOverlay 가 못 막았나] 클릭 쪽(_onGlobalMouseDown)에만 실려 있었다. 휠 페이로드에는 없어서
         렌더러가 «구버전 main» 으로 읽고 막지 않았다 — 그래서 다른 모니터 스크롤이 206건이다.
       ⚠️ 새 채널을 파지 않는다 — 필드 하나를 얹는 규약(offOverlay 와 같다). 구버전 렌더러는 무시한다.
       ⚠️ 휠은 여전히 '활동' 이다(anyInput·activity) — 사다리만 안 탄다. 읽기만 하는 동안 자리비움으로
         빠지던 구간을 메운 원래 목적은 그대로다. */
  const _onGlobalWheel = (e) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const now = Date.now();
    if (now - _lastWheelSentAt < 200) return;
    _lastWheelSentAt = now;
    let offOverlay = false;
    try{ offOverlay = !_ptOnOverlayWindow(screen.getCursorScreenPoint()); }catch(_){}
    mainWindow.webContents.send('companion:globalClick', { x: e.x, y: e.y, button: 0, ...lastActiveState, wheel: true, offOverlay });
  };
  const _onGlobalKeyDown = (e) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    _guardForeignInput('key');     // ⓖ 다른 앱에 타자를 치는 중이면 우리 판정이 굳은 것이다(파판14 경로)
    mainWindow.webContents.send('companion:globalKey', { ...lastActiveState });
  };
  // ── 스마트 감지 mousemove 감시는 제거됨 ──
  //   ★ uIOhook.on('mousemove') 저수준 전역 훅이 active-win의 활성 창 감지와 간섭해서
  //     activeWin()이 계속 null을 반환하는 문제 발생 (포커싱 어플 등록·감지 전체 고장).
  //   → Electron 내장 screen.getCursorScreenPoint() 100ms 폴링으로 교체 (_syncCursorWatcher /
  //     _checkCursorNearChar, 파일 상단). 펜 앱 활성일 때만 타이머가 돌아 오버헤드 동일 이하이고
  //     좌표도 처음부터 DIP라 변환 불필요. click/keydown 훅은 mousemove보다 빈도가 훨씬 낮아 유지.
  /* ★ uIOhook.start()가 던지는 환경이 있다(백신이 저수준 훅을 차단, VC++ 런타임 누락,
     asarUnpack 경로 문제 등). 예전엔 감싸지 않아서 던지면 이 뒤의 before-quit 정리까지
     통째로 건너뛰었고, 무엇보다 "왜 안 되는지" 흔적이 아무 데도 안 남았다.
     실패해도 앱 나머지는 정상 동작해야 하므로 삼키되, 진단 로그에는 반드시 남긴다.
     (이 경우 전역 클릭/키 감지가 죽어서 활동 감지·자리비움 판정이 어긋난다) */
  /* ⚠️ 훅 세 개를 거는 것도, start() 를 삼키고 기록하는 것도 모듈 안에서 일어난다.
     여기서 넘기는 것은 위 세 함수뿐이다 — 모듈은 그것을 그대로 건다. */
  /* 🩺 [2026-09-17 · E] 수신 카운트는 **핸들러 본문 밖**에서 센다 — 세 본문은 sim-wheel-kick 등이 그대로 떼어
     사막에서 돌리므로 안에 이름을 하나 더 두면 그 검사들이 깨진다. 여기서 감싸면 «훅이 왔다» 는 사실은 같게 세고,
     본문(판정·offOverlay·IPC)은 한 글자도 안 바뀐다. 휠은 200ms 솎기 앞에서 세어진다 — 수신 여부가 목적이다. */
  sysinput.startGlobalHooks({
    mousedown: (e) => { _inputDiag.click++; _onGlobalMouseDown(e); },
    wheel:     (e) => { _inputDiag.wheel++; _onGlobalWheel(e); },
    keydown:   (e) => { _inputDiag.key++;   _onGlobalKeyDown(e); },
  });
  app.on('before-quit', () => { try { sysinput.stopGlobalHooks(); } catch (_) {} if(_cursorWatchTimer){ clearInterval(_cursorWatchTimer); _cursorWatchTimer = null; } });
  /* ═══ 🖥️ 윈도우 세션 종료(로그오프·재시작·종료) ══════════════════════════
     [제보] 컴퓨터를 끄려 하면 "이 앱 때문에 종료할 수 없습니다"가 뜨고, [확인]을 눌러야
       종료된다. 그때 'unknown software exception (0x80000003)' 오류창이 같이 뜬다.
     [원인] 0x80000003 은 STATUS_BREAKPOINT — 정상 종료 코드가 아니라 '정리 도중에 끊겼다'는 뜻이다.
       Windows는 WM_QUERYENDSESSION 을 보내고 짧은 시간 안에 창이 사라지길 기다리는데,
       이 앱은 그 경로에 아무 처리가 없어서
         ・전체화면 always-on-top 오버레이 + BGM 자식창이 제 시간에 안 닫히고 → '종료를 막는 앱'
         ・그 상태로 OS가 프로세스를 끊는 순간 저수준 전역 훅(uIOhook)·창 관리 네이티브 모듈이
           스레드가 살아 있는 채로 뜯겨 나가며 브레이크포인트 예외
       가 된다. 종료 순간에만 나므로 평소 사용에는 흔적이 안 남는다.
     [대응] 세션 종료 신호를 받으면 **기다릴 것 없이 즉시** 끝낸다.
       ・네이티브 훅과 타이머를 먼저 정리 — 뜯기기 전에 우리가 먼저 내려놓는다
       ・모든 창을 destroy — close 이벤트/blur 자동닫힘 등 비동기 경로를 타지 않는다
       ・app.exit(0) — before-quit/will-quit 을 건너뛰고 그 자리에서 종료 코드 0으로 끝낸다
         (app.quit()은 창을 하나씩 닫으며 이벤트를 도는데, 그 시간이 곧 '종료를 막는 앱'이 된다)
     ⚠️ 이 경로에서는 저장을 하지 않는다. 설정은 바뀔 때마다 이미 파일에 쓰고 있으므로
       여기서 추가로 쓸 것이 없고, 쓰기를 넣으면 다시 같은 문제(느려서 종료를 막음)가 된다. */
  app.on('session-end', () => {
    try{ sysinput.stopGlobalHooks(); }catch(_){}
    try{ if(_cursorWatchTimer){ clearInterval(_cursorWatchTimer); _cursorWatchTimer = null; } }catch(_){}
    try{ if(_pollTimer){ clearInterval(_pollTimer); _pollTimer = null; } }catch(_){}
    try{ BrowserWindow.getAllWindows().forEach(w=>{ try{ if(!w.isDestroyed()) w.destroy(); }catch(_){} }); }catch(_){}
    try{ app.exit(0); }catch(_){}
  });
}

// 앱 중복 실행 방지 — 이미 하나 켜져있는데 또 실행하면(바탕화면 아이콘 재클릭 등),
// 새 인스턴스는 바로 종료하고 기존 창을 활성화/최상위로 끌어올림.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    SETTINGS_PATH = path.join(app.getPath('userData'), 'tw-settings.json');
    loadSettings();   // ★ 이전에 선택해둔 모니터 등 복원
    /* 📄 없으면 지금 만든다 — 반드시 loadSettings **뒤**에 부를 것. 앞에서 부르면 파일에 들어
       있던 값을 읽기 전에 기본값으로 덮어써 버린다. */
    _ensureSettingsFile();
    FOCUS_APPS_FILE = path.join(app.getPath('userData'), 'focus-apps.json');
    focusApps = loadFocusApps();   // ★ 이전에 등록해둔 포커싱 어플 복원
    createWindow();
    /* 🖥️ 화면 구성을 한 줄 남긴다 — createWindow 뒤에 부른다(그래야 오버레이가 어디에 뜨는지 함께 나온다).
       제보자마다 배율·화면 수를 물어보지 않아도 되게 하는 것이 목적이다. */
    overlay.logDisplayLayout();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}