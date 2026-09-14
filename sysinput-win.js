/* ═══ ⌨️ sysinput-win.js — 전역 입력 훅 · 활성 창 (Windows) ════════════════════
   [2026-09-12] main.js 에서 **훅을 걸고 푸는 일**과 **창을 열거하는 일**만 옮겨왔다.
     동작 변경 0 — 값도 조건도 순서도 그대로다. 배경은 handoff-platform-split.md §1-④.

   ⚠️ **핸들러 본문은 여기 없다.** mousedown 안의 판정(_guardForeignInput·offOverlay)과
     IPC 전송은 전부 main.js 에 남아 있다. 이 모듈은 "무엇을 할지"를 모르고 "언제 부를지"만 안다.
     클릭 통과(setIgnoreMouseEvents) 축은 uIOhook 커서 폴링과 한 몸이라 이쪽으로 오지 않는다
     — 핸드오프 §4-②. `sim-sysinput.js` 4절이 이 경계를 지킨다.

   ★ sysinput-mac.js 는 **이 파일과 똑같은 이름**을 내보내야 한다.
     mac 쪽 사정은 이름 규칙부터 다르다(확장자가 없고 공백이 든다 — 핸드오프 §4-b).
     그래서 `procNameOf` 와 `WINLIST_SKIP` 이 main.js 가 아니라 여기에 산다.
     Windows 에서 나온 문자열 규칙이 main.js 에 남으면 그대로 Mac 까지 따라간다.
   ★ [2026-09-15 · ⑥] **mac 판이 생겼다.** 판정 키 규칙은 번들 id 로 정해졌고
     (`com.google.chrome`), 그래서 판정명과 표시명이 갈라져 `displayNameOf` 가 늘었다.
     ⚠️ 이 파일에서 이름을 하나 늘리거나 줄이면 **sysinput-mac.js 도 같이 고칠 것.**
       main.js 는 어느 쪽이 실렸는지 모르는 채로 부르므로, 어긋나면 한쪽 OS 에서만 죽는다.
   ⚠️ 그때 «main.js 는 procNameOf 를 부르지 않고 path.basename 을 인라인으로 네 번 쓰고
     있었다» 는 것이 ⑥ 에서 드러나 같이 고쳐졌다. 되돌리지 말 것 — 되돌리면 이 파일이
     이름 규칙을 들고 있어도 **판정은 여전히 Windows 규칙으로 돈다.**

   ── 활성 창 감지: node-window-manager 기반 ──
     active-win이 이 시스템에서 어느 버전도 동작하지 않아 교체 (8.x는 조용히 undefined 반환,
     7.x는 ffi-napi 의존성이 최신 Node/Electron에서 설치 불가 — 사장된 패키지).
     node-window-manager는 native addon이라 신뢰성 높고 CommonJS 호환.
     기존 activeWin() 호출부와의 호환을 위해 같은 형태({ owner:{path,name}, title })를 반환하는
     어댑터로 감쌈 — 호출부 코드는 전부 기존 그대로 유지됨. */
'use strict';
const path = require('path');

/* ═══ ⚠️ 네이티브 모듈 로드 — 실패해도 앱은 켜져야 한다 ═════════════════════
   [왜 감싸는가] 둘 다 최상단 require 였고 try/catch 가 없었다. uiohook 은
     `uIOhook.start()` 에만 catch 가 붙어 있었지 **require 자체는 무방비**였다.
     로드가 실패하면 그 자리에서 모듈 평가가 끊겨 **창이 하나도 안 뜬다.** 설치본에서
     asarUnpack 경로가 어긋나거나, VC++ 런타임이 없거나, 네이티브가 안 붙은 빌드가
     그대로 나가면 사용자가 보는 것은 "눌러도 아무 일도 안 일어남" 하나뿐이다.
   ⚠️ node-window-manager 는 **프리빌드가 아예 없어서** 설치 때마다 소스를 컴파일한다
     (win32 도 없다 — 핸드오프 §0-②). 즉 로드 실패는 mac 만의 가정이 아니다.
   [대응] 로드 실패를 **기능 하나가 빠진 상태**로 떨어뜨린다. 전역 입력 감지가 죽거나
     창 목록이 비는 것은 되살릴 수 있는 고장이지만, 앱이 안 켜지는 것은 아니다.
   ⚠️ 조용히 삼키지 않는다. 이 시점은 init(log) 가 오기 **전**이라 로그 통로가 없다.
     쌓아 두었다가 주입된 뒤 한 번에 흘린다 — 안 남기면 §0-① 과 같은 종류의
     "개선도 고장도 아무 데도 안 남는" 상태가 된다. */
const _bootErrors = [];
/* ⚠️ UiohookKey 는 지금 어디에서도 안 쓰인다(main.js 시절부터 그랬다). 이사는 "옮기는 것"이라
   여기서 정리하지 않고 그대로 데려왔다 — 떼는 건 별건이다. */
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

/* 주입 — 안 부르면 훅 기동 실패도, 위 로드 실패도 조용히 사라진다. */
let _log = () => {};
function init(deps){
  const d = deps || {};
  if (typeof d.log === 'function') _log = d.log;
}

/* ★ 쌓아 둔 로드 실패는 **init 에서 흘리면 안 된다.**
     main.js 의 _diagLog 는 첫 줄이 `if(!app.isReady()) return;` 이고, init 은 모듈 평가 시점
     — 즉 app 준비 **전** — 에 불린다. 거기서 흘리면 조용히 버려져서, 감싼 보람이 없어진다
     (로드 실패가 안 남는 것이 애초에 고치려던 증상이다).
   ⇒ app 이 준비된 뒤에 처음 불리는 자리에서 흘린다. 한 번만 흘리고 비운다. */
function _flushBootLog(){
  while (_bootErrors.length) _log(_bootErrors.shift());
}

/* ── 이름 규칙 ─────────────────────────────────────────────────────────────
   ★ 판정에 쓰는 이름은 반드시 이 두 함수를 거친다. basename + 소문자 하나로 정한 규칙이고,
     그 규칙이 mac 에서 깨지는 것이 핸드오프 §4-b(판정 키)의 출발점이다. */
function selfProcName(){ return path.basename(process.execPath).toLowerCase(); }
function procNameOf(p){ return path.basename(p || '').toLowerCase(); }
/* ★ [2026-09-15 · ⑥] 사람에게 보여 줄 이름. **Windows 에서는 판정명과 같은 문자열이다**
     (`chrome.exe`) — 그래서 지금까지 이 함수가 없었고, main.js 는 한 값을 두 용도로 썼다.
   ⚠️ mac 에서 둘이 갈라진다: 판정은 번들 id(`com.google.chrome`), 표시는 번들 이름
     (`Google Chrome`). 그래서 **mac 판이 생기면서 win 판에도 같은 이름이 필요해졌다** —
     main.js 는 어느 쪽이 실렸는지 모르는 채로 이 이름을 부른다(§1-④ «똑같은 이름»).
   ★ 값이 procNameOf 와 같으므로 **Windows 동작은 한 글자도 안 바뀐다.** 이 줄의 목적은
     기능이 아니라 인터페이스를 맞추는 것이다. 여기서 `.exe` 를 떼는 등 손보지 말 것 —
     떼는 일은 app.js(표시부)가 이미 하고 있고, 두 곳에서 하면 한 번 더 떼어진다. */
function displayNameOf(p){ return procNameOf(p); }

/* 📋 셸 계열 — "목록에서 직접 고르기"에서 거르는 창들.
   ⚠️ Windows 실행 파일 이름이다. mac 판은 이 목록을 통째로 다시 써야 한다. */
const WINLIST_SKIP = new Set([
  'explorer.exe',            // 바탕화면·작업표시줄 — 게임에서 빠져나올 때 잡히는 그 창이다
  'applicationframehost.exe','systemsettings.exe','searchhost.exe','searchapp.exe',
  'startmenuexperiencehost.exe','shellexperiencehost.exe','textinputhost.exe',
  'lockapp.exe','sihost.exe','dwm.exe','widgets.exe','widgetboard.exe',
]);

/* ── 활성 창 ─────────────────────────────────────────────────────────────── */
async function getActiveWindow(){
  if(!windowManager) return null;   // 로드 실패 — 아래 catch 와 같은 답(null)을 낸다
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
   거르는 **순서가 뜻을 가진다**: 빈 값·비가시·빈 제목 → 자기/셸 → 너무 작은 창 →
   같은 exe 중복(제목 긴 쪽). 순서를 바꾸면 같은 입력에 다른 답이 나온다.
   ⚠️ 실패를 빈 목록으로 삼키지 않는다 — enum-failed 로 돌려준다. mac 에서 권한을 거부하면
     title 이 빈 문자열로 와서 **조용한 빈 목록**이 되는데, 그 갈래를 나중에 가르려면
     실패 경로가 지금 살아 있어야 한다(핸드오프 §7-2). */
async function listWindows(){
  /* 로드 실패도 열거 실패다 — 빈 목록으로 내려보내면 "아무것도 안 떠 있음"과 구분이 안 된다. */
  if(!windowManager) return { ok:false, reason:'enum-failed', message:'node-window-manager 로드 실패' };
  const SELF_EXE = selfProcName();
  const out = [];
  try{
    const wins = windowManager.getWindows() || [];
    const seen = new Map();   // exe 경로 → 항목 (같은 프로그램의 창이 여러 개여도 한 줄만)
    for(const w of wins){
      let p = '', title = '', vis = true, bounds = null;
      try{ p = w.path || ''; }catch(_){}
      try{ title = (w.getTitle() || '').trim(); }catch(_){}
      try{ vis = (typeof w.isVisible === 'function') ? w.isVisible() : true; }catch(_){}
      try{ bounds = (typeof w.getBounds === 'function') ? w.getBounds() : null; }catch(_){}
      if(!p || !vis || !title) continue;
      const name = procNameOf(p);
      if(name === SELF_EXE || WINLIST_SKIP.has(name)) continue;
      // 크기가 0에 가까운 창은 실제 화면에 없는 보조 창(트레이·메시지 전용)이다.
      if(bounds && ((bounds.width|0) < 80 || (bounds.height|0) < 60)) continue;
      const prev = seen.get(p);
      // 같은 exe 가 여러 창이면 제목이 긴 쪽을 남긴다 — 보통 그쪽이 본 창이다.
      if(prev && prev.title.length >= title.length) continue;
      const item = { name, path: p, title: title.slice(0, 80) };
      if(prev){ Object.assign(prev, item); } else { seen.set(p, item); out.push(item); }
    }
  }catch(err){
    return { ok:false, reason:'enum-failed', message: (err && err.message) || String(err) };
  }
  out.sort((a,b)=> a.name.localeCompare(b.name));
  return { ok:true, list: out };
}

/* ── 전역 훅 ───────────────────────────────────────────────────────────────
   handlers 는 main.js 가 준 함수를 **그대로** 건다. 여기서 가공하지 않는다 —
   무엇을 판정하고 어디로 보낼지는 호출부의 일이다(위 ⚠️ 참고).
   ⚠️ mousemove 는 없다. 없는 것이 조건이다 — 이유는 main.js 호출부 주석에 적혀 있다.
   ⚠️ start() 가 던지는 환경이 있다. 삼키되 반드시 기록을 남긴다 — 근거도 같은 자리에 있다. */
const _noop = () => {};
function startGlobalHooks(handlers){
  _flushBootLog();   // ★ app 준비 뒤 첫 자리 — 위 주석 참고
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

/* ⚠️ 분리 전에는 before-quit·session-end 두 자리에서 각각 uIOhook.stop() 을 불렀다.
   이제 두 자리가 이 함수 하나를 부르므로 **네이티브 호출은 1곳으로 합쳐진다.**
   개수로 세면 제대로 쪼갠 순간 거짓 실패가 난다 — sim-sysinput.js 1절 주석 참고. */
function stopGlobalHooks(){
  if(!uIOhook) return;
  try{ uIOhook.stop(); }catch(_){}
}

module.exports = {
  init,
  startGlobalHooks, stopGlobalHooks,
  getActiveWindow, listWindows,
  selfProcName, procNameOf, displayNameOf,
  WINLIST_SKIP,
};
