/* ═══ ⌨️ sysinput-mac.js — 전역 입력 훅 · 활성 창 (macOS) ══════════════════════
   [2026-09-15 신규 · 핸드오프 ⑥] `sysinput-win.js` 와 **똑같은 이름을 내보낸다.**
     하나라도 빠지면 darwin 에서 main.js 가 undefined 를 부른다(§1-④ 표).

   ⚠️ **핸들러 본문은 여기 없다.** win 판과 같은 경계다 — mousedown 안의 판정
     (_guardForeignInput·offOverlay)과 IPC 전송은 전부 main.js 에 남아 있다.
     클릭 통과(setIgnoreMouseEvents)도 오지 않는다(핸드오프 §4-②).
     `sim-sysinput.js` 4절이 이 경계를 지킨다.

   ═══ ★★ 이 파일의 핵심 — **판정 키는 번들 id 다** (§4-b 의 마지막 미정을 닫는다)

   [무엇이 문제였나] Windows 규칙(basename + 소문자)을 mac 경로에 그대로 대면
     `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` → `google chrome`.
     확장자가 없고 공백이 든다. 그런데 **진짜 문제는 그게 아니다.**
   ⚠️ **일렉트론으로 만든 앱은 실행 파일 이름이 죄다 `Electron` 이다.**
       /Applications/Visual Studio Code.app/Contents/MacOS/Electron  → `electron`
       (우리 앱도 개발 실행 때 같은 이름이다)
     즉 basename 규칙을 쓰면 서로 다른 앱 여러 개가 **한 키로 뭉친다.** 포커싱 어플이
     통째로 오작동하는 급이고, 실기기 없이 경로 문자열만으로 확정되는 사실이다.

   [세 후보 중 왜 번들 id 인가]
     A 실행파일 basename — 위 충돌. 탈락.
     B `.app` 번들 이름(`google chrome`) — 충돌은 없지만 **사용자가 .app 이름을 바꾸면 키가 깨진다.**
     C 번들 id(`com.google.chrome`) — 충돌 없음, 이름 변경·현지화에 안 흔들림. ← **이것**
   ★ C 를 고른 결정적 근거는 저장 위치다. `chalRec.cfg` 는 Firebase 로 동기화되어
     **계정을 따라다니고 회수가 안 된다**(§4-b 표). 여기서 흔들리는 키를 쓰면, 나중에
     어긋났을 때 되돌릴 방법이 없다 — §4-b 가 판정 키를 도입한 이유 그 자체다.

   [그래서 이 파일은 함수를 둘로 가른다]
     procNameOf(p)    → 'com.google.chrome'  ← **판정축.** focusKeyOf 가 이걸 받는다
     displayNameOf(p) → 'Google Chrome'      ← **표시용.** 설정 슬롯·달성표가 보여준다
     Windows 에서는 이 둘이 우연히 같은 문자열이었다(`chrome.exe`). mac 에서 갈라진다.
     ⚠️ `sysinput-win.js` 도 `displayNameOf` 를 내보내야 한다(win 판은 procNameOf 와 같은 값).
       모양이 어긋나면 main.js 가 darwin 에서만 죽는다.

   ── 활성 창 감지: node-window-manager 기반 (win 판과 같은 패키지) ──
     ⚠️ **프리빌드가 없어 설치 때마다 `lib/macos.mm` 을 컴파일한다**(핸드오프 §0-②).
       ⑤ 에서 macOS 26.6 / SDK 26.5 로 붙는 것을 확인했다(mac-probe #2).
     ⚠️ 권한이 없으면 **에러가 아니라 빈 값**이 온다 — 그 갈래를 아래 listWindows 가 가른다. */
'use strict';
const path = require('path');
const fs   = require('fs');
const { execFileSync } = require('child_process');

/* ═══ ⚠️ 네이티브 모듈 로드 — 실패해도 앱은 켜져야 한다 (win 판과 같은 이유) ═══
   로드가 실패하면 그 자리에서 모듈 평가가 끊겨 **창이 하나도 안 뜬다.** mac 은 위험이 더 크다:
   node-window-manager 가 매 설치마다 소스를 컴파일하므로 Xcode CLT 가 없는 기기에서 통째로 빈다.
   ⚠️ 조용히 삼키지 않는다. 이 시점은 init(log) **전**이라 로그 통로가 없어서 쌓아 둔다. */
const _bootErrors = [];
let uIOhook = null, UiohookKey = null;
try{
  ({ uIOhook, UiohookKey } = require('uiohook-napi'));
}catch(err){
  _bootErrors.push('uiohook-napi 로드 실패 — 전역 클릭/키 감지 없음: ' + (err && err.message || err));
}
let windowManager = null;
try{
  ({ windowManager } = require('node-window-manager'));
}catch(err){
  _bootErrors.push('node-window-manager 로드 실패 — 활성 창 감지·창 목록 없음: ' + (err && err.message || err));
}

let _log = () => {};
function init(deps){
  const d = deps || {};
  if (typeof d.log === 'function') _log = d.log;
}
/* ★ 쌓아 둔 로드 실패는 **init 에서 흘리면 안 된다.** main.js 의 _diagLog 첫 줄이
     `if(!app.isReady()) return;` 이고 init 은 모듈 평가 시점(app 준비 전)에 불린다.
     거기서 흘리면 조용히 버려져서, 감싼 보람이 없어진다. */
function _flushBootLog(){
  while (_bootErrors.length) _log(_bootErrors.shift());
}

/* ═══ 🏷️ 번들 id 뽑아내기 ══════════════════════════════════════════════════
   [경로 → 번들] 실행 파일에서 위로 올라가며 **가장 가까운 `.app`** 을 찾는다.
     /Applications/Google Chrome.app/Contents/MacOS/Google Chrome → /Applications/Google Chrome.app
   ⚠️ **바깥쪽이 아니라 안쪽이다.** `.app` 안에 `.app` 이 들어 있는 구조가 흔한데
     (헬퍼 프로세스, Xcode 안의 Simulator 등), 지금 돌고 있는 실행 파일의 정체를 말하는 것은
     그 실행 파일을 품은 **가장 안쪽 번들의 Info.plist** 다. 바깥을 택하면 Simulator 를
     Xcode 로, 헬퍼를 본체로 둔갑시킨다.
   ⚠️ `.app` 이 없는 경로(순수 CLI 바이너리·데몬)도 있다. 그건 창을 가진 앱이 아니지만
     0 을 돌려주면 판정이 통째로 멎으므로 basename 으로 떨어뜨린다(아래 fallback). */
function _appBundleOf(p){
  let cur = String(p || '');
  if(!cur) return '';
  /* 경로 끝에서부터 올라간다. path.dirname 은 루트에서 자기 자신을 돌려주므로 그걸로 멈춘다. */
  for(let guard = 0; guard < 64; guard++){
    const parent = path.dirname(cur);
    if(parent === cur) break;            // 루트 도달
    cur = parent;
    if(cur.toLowerCase().endsWith('.app')) return cur;
  }
  return '';
}

/* [Info.plist → CFBundleIdentifier]
   ⚠️ **요즘 Info.plist 는 대개 바이너리 plist 다**(`bplist00` 으로 시작). 정규식으로 못 읽는다.
     그래서 두 갈래로 간다: XML 이면 정규식, 아니면 `/usr/bin/plutil` 로 뽑는다.
     plutil 은 macOS 기본 탑재라 따로 깔 것이 없고, `-extract … raw` 는 10.13+ 에서 돈다.
   ⚠️ **캐시가 필수다.** 이 함수는 500ms 폴링 판정부에서 불린다. 캐시가 없으면 초당 두 번씩
     프로세스를 띄우게 되고, 그건 우리가 몇 번이나 되돌린 종류의 사고다(로그 906줄·재적용 417회).
     ⇒ `.app` 경로별로 **성공도 실패도** 기억한다. 실패를 캐시하지 않으면 못 읽는 앱 하나가
       영원히 폴링마다 plutil 을 띄운다. */
const _bundleIdCache = new Map();   // .app 경로 → 판정에 쓸 문자열 (실패 시 대체값)
const _fallbackLogged = new Set();  // 대체값으로 떨어진 번들 — 로그를 한 번만 남기려고
function _bundleIdOf(appDir){
  if(!appDir) return '';
  const hit = _bundleIdCache.get(appDir);
  if(hit !== undefined) return hit;

  /* 대체값 = B안(번들 이름). 'Google Chrome.app' → 'google chrome'
     ⚠️ 이건 **다른 모양의 키**다. 같은 앱이 실행마다 C 와 B 를 오가면 등록이 조용히 풀린다.
       그래서 실패는 반드시 로그에 남긴다 — 그 로그가 곧 "이 기기에서 C 가 안 선다"는 신호다. */
  const fallback = path.basename(appDir).replace(/\.app$/i, '').trim().toLowerCase();

  let id = '';
  const plist = path.join(appDir, 'Contents', 'Info.plist');
  try{
    const buf = fs.readFileSync(plist);
    if(buf.slice(0, 8).toString('latin1') === 'bplist00'){
      /* 바이너리 — plutil 로 넘긴다. timeout 을 반드시 둔다(디스크가 잠긴 볼륨에서 멎는다). */
      id = execFileSync('/usr/bin/plutil',
        ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', plist],
        { timeout: 1500, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } else {
      const m = buf.toString('utf8')
        .match(/<key>\s*CFBundleIdentifier\s*<\/key>\s*<string>([^<]*)<\/string>/);
      if(m) id = (m[1] || '').trim();
    }
  }catch(_){ /* 아래 대체값으로 간다 */ }

  const out = id ? id.toLowerCase() : fallback;
  if(!id && fallback && !_fallbackLogged.has(appDir)){
    _fallbackLogged.add(appDir);
    /* ★ 이 줄이 뜨면 그 앱의 키는 번들 id 가 아니라 번들 이름이다. 사용자가 .app 이름을
         바꾸면 그 앱만 등록이 풀린다 — 제보를 받으면 여기를 먼저 볼 것. */
    _log('[입력] 번들 id 를 못 읽어 이름으로 대체 — ' + appDir + ' → ' + fallback);
  }
  _bundleIdCache.set(appDir, out);
  return out;
}

/* ── 이름 규칙 ─────────────────────────────────────────────────────────────
   ★ 판정에 쓰는 이름은 반드시 이 함수를 거친다. main.js 가 `path.basename` 을 직접 부르면
     **Windows 규칙이 그대로 mac 까지 따라온다** — 그게 이 함수가 모듈에 사는 이유다.
   ⚠️ 여기가 `focusKeyOf` 의 입력이다. 돌려주는 문자열이 바뀌면 이미 등록된 키가 전부 어긋난다. */
function procNameOf(p){
  const s = String(p || '');
  if(!s) return '';
  const appDir = _appBundleOf(s);
  if(appDir) return _bundleIdOf(appDir);
  /* `.app` 이 아닌 실행 파일 — 창을 가진 앱은 거의 없지만, 빈 값을 돌려주면 활성 창 판정이
     통째로 멎으므로(win 판 주석과 같은 이유) basename 으로 떨어뜨린다. */
  return path.basename(s).toLowerCase();
}
/* 사람에게 보여 줄 이름. 판정에 **절대 쓰지 말 것** — 현지화·이름 변경에 흔들린다.
   ⚠️ 소문자로 만들지 않는다. 'Google Chrome' 을 'google chrome' 으로 보여 줄 이유가 없다
     (win 판은 `chrome.exe` 라 소문자가 원본이었고, app.js 가 `.exe` 만 떼어 쓴다). */
function displayNameOf(p){
  const s = String(p || '');
  if(!s) return '';
  const appDir = _appBundleOf(s);
  if(appDir) return path.basename(appDir).replace(/\.app$/i, '');
  return path.basename(s);
}
/* 우리 앱 자신 — main.js 의 SELF_EXE 가 이 값을 쓴다.
   ★ procNameOf 와 **같은 함수를 거치는 것이 요점이다.** 규칙이 갈리면 자기 자신을 못 걸러낸다.
   ⚠️ 개발 실행(`npm start`)에서는 Electron.app 의 번들 id(`com.github.electron`)가 나온다.
     설치본과 값이 다르지만 둘 다 "자기 자신"을 정확히 가리키므로 동작은 같다. */
function selfProcName(){ return procNameOf(process.execPath); }

/* 📋 셸 계열 — "목록에서 직접 고르기"에서 거르는 창들.
   ⚠️ **win 판 목록을 번역한 것이 아니라 새로 쓴 것이다.** 여기 값은 exe 이름이 아니라
     위 procNameOf 가 내놓는 것과 같은 축, 즉 **번들 id** 다. 섞이면 한 줄도 안 걸린다.
   ★ com.apple.finder 가 win 의 explorer.exe 자리다 — 게임에서 빠져나올 때 잡히는 그 창.
     ⚠️ 대가가 있다: **Finder 를 포커싱 어플로 등록할 수 없다.** win 에서 explorer.exe 를
       거를 때 받아들인 것과 같은 대가이고, 파일 탐색에 집중 시간을 걸 사람은 드물다고 봤다.
       제보가 오면 이 한 줄만 빼면 된다 — 그때는 "게임 등록이 또 깨진다"를 같이 볼 것.
   ⚠️ 이 목록은 **실측 0건이다.** 실기기에서 창 목록을 한 번 찍어 보고 빠진 것을 채울 것
     (핸드오프 §7-2 의 확인 항목에 같이 묶인다). */
const WINLIST_SKIP = new Set([
  'com.apple.finder',                 // 바탕화면·파인더 — win 의 explorer.exe 자리
  'com.apple.dock',                   // Dock (미션 컨트롤·Launchpad 포함)
  'com.apple.systemuiserver',         // 메뉴 막대 오른쪽
  'com.apple.controlcenter',          // 제어 센터
  'com.apple.notificationcenterui',   // 알림 센터
  'com.apple.spotlight',              // Spotlight 검색창
  'com.apple.loginwindow',            // 로그인·로그아웃 화면
  'com.apple.windowmanager',          // Stage Manager
  'com.apple.wallpaper.agent',        // 배경화면
  'com.apple.textinputmenuagent',     // 입력 소스 메뉴 — win 의 textinputhost.exe 자리
  'com.apple.screencaptureui',        // 스크린샷 도구 막대
  'com.apple.coreservices.uiagent',   // 시스템 경고 대화상자
  'com.apple.systempreferences',      // 시스템 설정 (Ventura+ 도 번들 id 는 이 이름 그대로다)
]);

/* ── 활성 창 ───────────────────────────────────────────────────────────────
   win 판과 **같은 모양**({ owner:{path,name}, title })을 돌려준다. 호출부는 이 모양을 안다.
   ⚠️ owner.name 은 basename 그대로 둔다 — 판정은 main.js 가 owner.path 를 procNameOf 에
     넣어서 하고, 이 필드는 진단 문구에만 쓰인다. 여기서 번들 id 를 넣으면 두 축이 섞인다.
   ⚠️ 접근성 권한이 없으면 예외가 아니라 **null 또는 빈 path** 가 온다. 그때도 null 을
     돌려주는 것은 win 판과 같다 — main.js 의 `_activeWinFailStreak` 20회(=10초) 경고가
     그 상태를 로그로 드러낸다. */
async function getActiveWindow(){
  if(!windowManager) return null;
  try{
    const w = windowManager.getActiveWindow();
    if(!w) return null;
    const p = w.path || '';
    if(!p) return null;
    let title = '';
    try{ title = w.getTitle() || ''; }catch(_){}
    return { owner: { path: p, name: path.basename(p) }, title };
  }catch(_){ return null; }
}

/* ── 창 목록 ───────────────────────────────────────────────────────────────
   거르는 **순서가 뜻을 가진다**(win 판과 동일): 빈 값·비가시·빈 제목 → 자기/셸 →
   너무 작은 창 → 같은 번들 중복(제목 긴 쪽). 순서를 바꾸면 같은 입력에 다른 답이 나온다.

   ★★ [mac 만의 갈래 — 핸드오프 §7-2 가 예고한 자리]
     화면 기록 권한이 없으면 macOS 는 **에러를 주지 않는다.** 창은 다 열거되는데 `getTitle()`
     이 전부 빈 문자열로 온다. 그러면 위 "빈 제목" 필터에 전부 걸려 **조용한 빈 목록**이 된다
     — 사용자가 보는 것은 "목록에 아무것도 안 뜸" 하나뿐이고, 권한 때문인지 정말 창이 없는지
     구분할 길이 없다.
   ⇒ 창은 있는데 **제목이 하나도 없으면** 그것을 권한 문제로 보고 enum-failed 로 돌려준다.
     ⚠️ 오판 가능성: 제목 없는 창만 떠 있는 경우. 그때 사용자가 보는 것은 "빈 목록" 대신
       "권한을 확인하세요" 인데, 어느 쪽도 고를 것이 없는 건 같고 후자는 확인할 것이 있다.
       비대칭이 크므로 이쪽을 택한다. */
async function listWindows(){
  if(!windowManager) return { ok:false, reason:'enum-failed', message:'node-window-manager 로드 실패' };
  const SELF = selfProcName();
  const out = [];
  let sawWindow = 0, sawTitle = 0;
  try{
    const wins = windowManager.getWindows() || [];
    const seen = new Map();   // 번들 경로 → 항목 (같은 프로그램의 창이 여러 개여도 한 줄만)
    for(const w of wins){
      let p = '', title = '', vis = true, bounds = null;
      try{ p = w.path || ''; }catch(_){}
      try{ title = (w.getTitle() || '').trim(); }catch(_){}
      try{ vis = (typeof w.isVisible === 'function') ? w.isVisible() : true; }catch(_){}
      try{ bounds = (typeof w.getBounds === 'function') ? w.getBounds() : null; }catch(_){}
      if(p) sawWindow++;
      if(title) sawTitle++;
      if(!p || !vis || !title) continue;
      const name = procNameOf(p);
      if(name === SELF || WINLIST_SKIP.has(name)) continue;
      // 크기가 0에 가까운 창은 실제 화면에 없는 보조 창(상태 항목·메시지 전용)이다.
      if(bounds && ((bounds.width|0) < 80 || (bounds.height|0) < 60)) continue;
      /* ⚠️ 중복 판정 키가 win 과 다르다. win 은 exe 경로로 묶었지만 mac 은 **번들 id** 로 묶는다.
         같은 앱이 아키텍처·업데이트로 경로가 갈리는 일이 있고, 사용자에게는 한 줄이면 된다. */
      const prev = seen.get(name);
      if(prev && prev.title.length >= title.length) continue;
      const item = { name: displayNameOf(p), key: name, path: p, title: title.slice(0, 80) };
      if(prev){ Object.assign(prev, item); } else { seen.set(name, item); out.push(item); }
    }
  }catch(err){
    return { ok:false, reason:'enum-failed', message: (err && err.message) || String(err) };
  }
  /* ★ 위 ★★ 주석의 갈래 — 창은 있는데 제목이 0건이면 권한이다. */
  if(sawWindow > 0 && sawTitle === 0){
    return { ok:false, reason:'enum-failed',
      message: '창 ' + sawWindow + '개가 모두 제목이 비어 있다 — 화면 기록 권한이 없을 때의 모양이다'
             + ' (시스템 설정 → 개인정보 보호 및 보안 → 화면 기록)' };
  }
  out.sort((a,b)=> a.name.localeCompare(b.name));
  return { ok:true, list: out };
}

/* ── 전역 훅 ───────────────────────────────────────────────────────────────
   uiohook-napi 는 darwin-arm64 · darwin-x64 프리빌드를 **둘 다 동봉한다**(핸드오프 §0-② 표).
   그래서 이 절은 win 판과 같은 코드로 돈다 — 다른 것은 권한뿐이다.
   ⚠️ mousemove 는 없다. 없는 것이 조건이다 — 이유는 main.js 호출부 주석에 있다.

   ★ [mac 만의 한 줄] 접근성 권한을 여기서 요청한다.
     [왜 필요한가] macOS 는 저수준 입력 훅과 창 정보 접근을 TCC 로 막는다. entitlement 로는
       못 연다 — **실행 중에 사용자가 대화상자에서 허용해야 한다**(핸드오프 §4-3).
       요청을 안 하면 uIOhook.start() 가 **던지지도 않고** 이벤트만 영영 안 온다.
       그게 이 앱에서 제일 나쁜 모양이다(에러도 없고 기능만 죽는 상태).
     ⚠️ 핸드오프 §7-2 가 «requestAccessibility() 를 우리는 한 번도 안 부른다» 고 적어 둔
       그 자리다. mac 에서는 부른다.
     ⚠️ 이 호출은 대화상자를 띄운다 — 부팅 때 한 번. 거슬리면 이 한 줄만 빼면 되지만,
       빼면 사용자가 스스로 시스템 설정을 찾아가야 한다는 뜻이다.
     ⚠️ 권한을 **거부했을 때의 동작은 실기기에서만 볼 수 있다.** 거부 뒤 어떤 값이 오는지가
       §7-2 의 확인 항목이고, 그 답에 따라 아래 로그 문구를 고치게 된다. */
const _noop = () => {};
function startGlobalHooks(handlers){
  _flushBootLog();   // ★ app 준비 뒤 첫 자리 — 위 주석 참고
  if(windowManager && typeof windowManager.requestAccessibility === 'function'){
    try{
      const granted = windowManager.requestAccessibility();
      if(granted === false) _log('접근성 권한 없음 — 허용 전까지 전역 입력·창 제목이 오지 않는다');
    }catch(err){
      _log('접근성 권한 요청 실패: ' + (err && err.message || err));
    }
  }
  if(!uIOhook){ _log('전역 훅을 걸 수 없다 — uiohook-napi 가 로드되지 않았다'); return; }
  const h = handlers || {};
  uIOhook.on('mousedown', h.mousedown || _noop);
  uIOhook.on('wheel',     h.wheel     || _noop);
  uIOhook.on('keydown',   h.keydown   || _noop);
  try{
    uIOhook.start();
  }catch(err){
    _log('uIOhook.start 실패 — 전역 클릭/키 감지 없음: ' + (err && err.message || err));
  }
}

/* ⚠️ before-quit·session-end 두 자리가 이 함수 하나를 부른다 — 네이티브 호출은 1곳이다.
   개수로 세면 거짓 실패가 난다(sim-sysinput.js 1절 주석).
   ★ session-end 는 Windows 신호라 mac 에서는 안 온다. 그래도 이 함수는 양쪽에서 불려야 한다 —
     main.js 가 두 자리에 다 걸어 두었고, 안 오는 신호는 그냥 안 올 뿐이다. */
function stopGlobalHooks(){
  if(!uIOhook) return;
  try{ uIOhook.stop(); }catch(_){}
}

/* ⚠️ UiohookKey 는 지금 어디에서도 안 쓰인다 — win 판과 같은 상태로 맞춰 둔다. */
void UiohookKey;

module.exports = {
  init,
  startGlobalHooks, stopGlobalHooks,
  getActiveWindow, listWindows,
  selfProcName, procNameOf, displayNameOf,
  WINLIST_SKIP,
};
