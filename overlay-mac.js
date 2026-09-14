/* ═══════════════════════════════════════════════════════════════════════════════
   overlay-mac.js — 오버레이의 **macOS 전용** 갈래.  [2026-09-15 신규 · 핸드오프 ⑥]

   [무엇을 하는 파일인가] `main.js` 는 부팅 때 한 줄로 이 파일과 `overlay-win.js` 중
     하나를 고른다. 그러므로 이 파일은 **`overlay-win.js` 와 똑같은 이름을 전부 내보내야
     한다.** 하나라도 빠지면 darwin 에서 main.js 가 undefined 를 부른다
     (handoff-platform-split.md §1-④).

   ★★ [이 파일의 제1원칙] **Windows 에서 나온 숫자를 하나도 가져오지 않는다.**
     `overlay-win.js` 의 값들(갭 12 · 레거시 [2,6] · 레이어드 알파 252)은 전부
     **Windows 크로미움의 "내 창이 가려졌나" 계산**에서 나온 값이다. macOS 는 그 계산
     자체가 다르다(`NSWindowOcclusionState`). 그래서 저쪽 상수를 여기로 베끼면
     **근거 없는 숫자가 근거 있는 숫자의 얼굴을 하고** 따라온다 — 핸드오프 §1-④ 가
     «macOS 갭을 12로 시작하지 말 것» 이라고 못박은 자리가 이것이다.
   ⇒ 갭은 **0에서 시작**하고, 레이어드 알파 통로는 **비어 있다.**

   ⚠️ **0 은 "괜찮다고 확인된 값"이 아니라 "아직 아무것도 측정하지 않았다"는 뜻이다.**
     Mac 에는 영상 검어짐 실측이 **0건**이다(handoff-platform-split.md §8: «Mac 에는 그
     실측 기록이 0건이다»). 그래서 이 파일이 하는 일은 **값을 정하는 것이 아니라 값을
     넣어 볼 수 있는 통로를 여는 것**이다 — 설정 파일의 `overlayBottomGap` 이 그대로 산다.
     실기기에서 영상 위에 겹쳐 보고, 검어지면 그때 숫자를 찾아 여기에 적는다.

   [안 옮겨온 것 — win 쪽과 같은 경계]
     ⚠️ 클릭 통과(setIgnoreMouseEvents)는 여기 없다. main.js 에 그대로 있다.
       uIOhook 커서 폴링과 한 몸이라 오버레이 축이 아니다(핸드오프 §4-②).
       ★ 그 통로의 **macOS 동작은 ⑥ 에서 제일 먼저 볼 것**으로 지목돼 있다
         (handoff-platform-split.md §7-1). 다르면 2초 얹기 통로를 새로 설계해야 한다.
         이 파일은 그 사안과 무관하다 — 여기를 고쳐서 풀 수 있는 문제가 아니다.
     ⚠️ setAlwaysOnTop · skipTaskbar · flashFrame 도 여기 없다(win 쪽과 동일).

   [실기기에서 확인할 것 — handoff-platform-split.md §7]
     ・3번: 오버레이가 Spaces·전체화면 위에 뜨는가(`setVisibleOnAllWorkspaces`).
       ⚠️ 그건 **창을 만드는 자리(main.js createWindow)의 일**이지 이 파일의 일이 아니다.
         여기에 끌어오지 말 것 — 갭·알파 축과 섞이면 다음에 또 못 가른다.
     ・4번: Retina(scaleFactor 2)에서 좌표·갭 산수. 아래 `overlayGapFor` 가 배율로 나누는
       그 산수다. `sim-overlay-gap.js` 가 배율 4까지 이미 정적으로 검사한다.
   ══════════════════════════════════════════════════════════════════════════════ */
'use strict';
const { screen } = require('electron');

/* ── 이음매 (main.js 가 init 으로 꽂아 준다) ─────────────────────────────────
   ⚠️ win 쪽과 **똑같은 모양**이어야 한다. main.js 의 호출부가 하나뿐이기 때문이다. */
let _getWin     = () => null;
let _getDisplay = () => screen.getPrimaryDisplay();
let _log        = () => {};
function init(deps){
  if(deps && typeof deps.getWin     === 'function') _getWin     = deps.getWin;
  if(deps && typeof deps.getDisplay === 'function') _getDisplay = deps.getDisplay;
  if(deps && typeof deps.log        === 'function') _log        = deps.log;
}
const _diagLog      = (msg) => _log(msg);
const getRunDisplay = ()    => _getDisplay();

/* ═══ 📐 갭 — **0 에서 시작한다** ═══════════════════════════════════════════
   [왜 0 인가]
     Windows 의 12 는 electron#49024 의 증상(투명 창이 영상 창을 **완전히** 덮으면
     크로미움이 그리기를 멈춘다)에 대한 값이고, 그 증상은 Windows 에서 모드 A~I 아홉 개로
     가른 실측 위에 서 있다(overlay-win.js 상단). macOS 에서는
       ・가려짐 판정 주체가 다르다(`NSWindowOcclusionState`)
       ・제보가 **한 건도 없다**
     ⇒ 증상이 있는지도 모르는 채로 화면 맨 아래 띠를 잘라내면, **대가만 먼저 치른다**
       (그 띠에서 캐릭터 판정이 안 된다 — win 쪽 주석의 «유일한 대가»).
   ⇒ 그래서 기본은 0(=갭 갈래 끔)이고, 증상이 나오면 설정 파일로 값을 넣어 찾는다.

   ⚠️ **여기에 12 를 적어 넣고 싶어지면 참을 것.** 그 숫자가 맞는지 아닌지가 아니라,
     맞는지 아닌지를 **가를 수 없게 된다**는 것이 문제다. mac 에서 검어짐 제보가 오면
     그때 0 → N 으로 올린 것이 들었는지를 봐야 하는데, 처음부터 12 면 그 대조가 없다. */
let OVERLAY_GAP_PHYSICAL_PX = 0;
/* 🚚 마이그레이션(승격) 상수 — **mac 에서는 승격이 일어나면 안 된다.**
   [왜 빈 배열인가] 승격은 「옛 기본값 그대로인 파일을 새 기본값으로 올린다」는 장치다
     (handoff-platform-split.md §0-①: 개선이 기존 사용자에게 도달하지 않던 문제).
     그런데 **mac 빌드는 존재한 적이 없다.** 즉 "옛 mac 기본값" 이라는 것이 세상에 없다.
     여기에 숫자를 하나라도 넣으면, 사람이 진단하려고 손으로 넣은 값을 앱이 되돌린다.
   ⇒ `GAP_LEGACY` 는 빈 배열이다. main.js 의
       `fileVer < GAP_VER && GAP_LEGACY.indexOf(fileGap) >= 0`
     조건이 **영원히 거짓**이 되어 승격 경로를 아예 안 탄다(=`_gapMigratedFrom` 은 null).
   ⚠️ 나중에 mac 기본값을 0 → N 으로 올릴 때는 win 쪽 주석과 **같은 절차**를 밟을 것:
     ① `GAP_DEFAULT` 와 위 let 초기값을 N 으로  ② `GAP_LEGACY` 에 0 을 추가
     ③ `GAP_VER` 을 +1. 그래야 아직 안 옮긴 파일만 한 번 더 걸린다. */
const OVERLAY_GAP_DEFAULT = 0;           // 이 빌드의 기본값 — 위 let 의 초기값과 같아야 한다
const OVERLAY_GAP_LEGACY  = [];          // ★ mac 에는 "옛 기본값" 이 없다. 비워 둔다
const OVERLAY_GAP_VER     = 1;           // mac 파일의 1세대
/* 상한은 win 과 같은 64 로 둔다 — 이건 실측에서 나온 값이 아니라 **사람이 손으로 넣는 값의
   울타리**다(설정 파일을 직접 고쳐 진단할 때 오타로 9999 가 들어가는 것을 막는다).
   플랫폼 사정이 아니므로 여기서 다른 숫자를 고를 근거가 없다. */
const OVERLAY_GAP_MAX = 64;

/* 이 모니터에서 실제로 뺄 DIP 값 — 물리 픽셀 목표를 배율로 되돌린다.
   ★ 본문이 win 과 같은 것은 베낀 것이 아니라 **산수가 같기 때문**이다(물리 → DIP 환산).
     Retina 는 scaleFactor 2 라 이 식이 그대로 돈다 — §7-4 의 확인 항목.
   ⚠️ **`0 은 0 으로 돌려준다` 분기를 지울 것.** 이 분기는 win 에서 «있으면 좋은 것» 이었지만
     mac 에서는 **평상시 경로**다(기본값이 0 이므로 매번 여기를 탄다).
     [없으면 무슨 일이 나나 — win 쪽 실측 기록]
       `Math.max(1, …)` 이 0 을 1 로 올리면 요청 높이가 작업영역-1 이 되는데, 배율 1.5 에서
       1 DIP = 물리 1.5px 이라 OS 가 반올림으로 삼켜 **작업영역과 같은 크기**를 돌려준다.
       그러면 main.js `_winAlreadyIs` 의 rect 비교가 **영원히 거짓**이 되어, layoutSeats 가
       IPC 를 보낼 때마다 setBounds + setAlwaysOnTop 이 다시 나간다 — 9분에 417회(중앙값
       0.43초 간격)를 실측했다. Retina(정수배)에서는 안 걸리겠지만, 외장 모니터를 섞으면
       비정수 배율이 그대로 들어온다. */
function overlayGapFor(display){
  const sf = (display && display.scaleFactor > 0) ? display.scaleFactor : 1;
  if(!(OVERLAY_GAP_PHYSICAL_PX > 0)) return 0;
  return Math.max(1, Math.min(OVERLAY_GAP_MAX, Math.ceil(OVERLAY_GAP_PHYSICAL_PX / sf)));
}
/* run(전체화면 오버레이) 높이는 **반드시 이 함수를 거친다.** 크기를 정하는 자리가 두 곳이라
   (setConfigMode · moveToDisplay) 한 곳만 고치면 모니터를 옮기는 순간 조용히 원래대로 돌아간다.
   ★ 기본값 0 에서는 `h` 를 그대로 돌려준다 — 즉 **지금 mac 의 창 크기 계산은 분리 전과 같다.**
     이것이 이 파일이 «동작을 새로 만들지 않는다»는 뜻이다. */
function runOverlayHeight(h, display){ return Math.max(100, h - overlayGapFor(display)); }

/* ═══ 🎬 레이어드 알파 — **macOS 에는 이 통로가 없다** ═══════════════════════
   [왜 빈 값인가] win 쪽 장치는 Win32 확장 스타일 `WS_EX_LAYERED` + `LWA_ALPHA` 에
     정확히 걸려 있다. 크로미움의 `IsWindowVisibleAndFullyOpaque` 가
       `if (flags & LWA_ALPHA && alpha < 255) return false;`
     로 **알파가 255 미만인 창을 '가리는 창' 목록에서 빼 주는** 것을 이용한 우회다.
     macOS 에는 그 함수도, 그 플래그도, 그 예외 목록도 없다.
   ⇒ `setOpacity(252/255)` 를 여기서 부르면 **효과는 0 이고 캐릭터만 1.2% 흐려진다.**
     그래서 부르지 않는다. 빈 함수인 것이 이 파일의 답이다.

   ⚠️ 설정 → 시스템 → '영상 겹침 실험' 토글은 mac 에서 **켜지지 않는다**(눌러도 꺼짐으로 돌아온다).
     `LAYERED_ALPHA_ON` 이 0 이라 main.js 의 `setAlpha(on ? LAYERED_ALPHA_ON : 0)` 이
     어느 쪽이든 0 을 넣고, 그 다음 줄 `alpha()>0 && alpha()<255` 가 false 를 돌려주기 때문이다.
     ★ **이건 고장이 아니라 정직한 답이다.** mac 에 없는 장치를 켜진 것처럼 보여 주면,
       나중에 검어짐 제보가 왔을 때 "실험을 켜 봤는데 안 낫더라" 가 근거로 쓰이게 된다.
       그건 갈래를 하나 지우는 것이 아니라 **가짜 갈래를 하나 만드는 것**이다.
   ⚠️ macOS 용 우회가 필요해지면 여기에 알파를 넣지 말 것 — 다른 축이다.
     (`NSWindowOcclusionState` 는 우리 창의 투명도가 아니라 **상대 창의 가려짐 상태**를 보고,
      Electron 쪽 통로도 다르다. 새로 파야 하는 작업이지 이 값을 켜는 작업이 아니다) */
const OVERLAY_LAYERED_ALPHA_ON = 0;      // ★ 0 = 통로 없음. 252 를 여기 적지 말 것(위 주석)
let   OVERLAY_LAYERED_ALPHA    = 0;      // 설정 파일과 왕복은 살아 있다 — 값만 안 쓴다
/* 진단 로그가 이 문자열을 같이 남긴다. **옛 빌드/win 빌드/mac 빌드를 로그 한 줄로 가르는 자리**다.
   ⚠️ win 쪽 `_applyOverlayLayered` 도 `process.platform !== 'win32'` 일 때 'n/a(win32 아님)' 을
     넣는다. 문자열을 일부러 다르게 둔다 — 이 줄이 뜨면 **mac 갈래가 실제로 실렸다**는 뜻이고,
     'n/a(win32 아님)' 이 뜨면 mac 에서 **win 모듈이 실린** 것이라 갈래 자체가 틀린 것이다. */
let _layeredState = 'n/a(mac — 이 플랫폼에 레이어드 통로 없음)';

/* 빈 함수. 상태 문자열만 들고 있고 창에는 아무것도 하지 않는다.
   ★ 로그 한 줄은 남긴다 — win 쪽과 **같은 자리에서 같은 모양**으로 찍혀야,
     제보 로그를 받았을 때 "이 줄이 없다 = 옛 빌드" 판정이 양쪽에서 똑같이 선다. */
function _applyOverlayLayered(where){
  if(where) _diagLog('[오버레이] 레이어드 알파 ' + where + ' — ' + _layeredState);
}

/* 🩺 실제로 틈이 생겼는가 — **지정한 크기와 OS 가 준 크기는 다를 수 있다.**
   제보를 다시 받았을 때 추측 대신 이 줄을 먼저 본다.
   (기록 위치는 _diagLog 와 같다 — mac 은 ~/Library/Application Support/Together Working/) */
function _logOverlayGeometry(where){
  const mainWindow = _getWin();
  if(!mainWindow || mainWindow.isDestroyed()) return;
  try{
    const d = getRunDisplay();
    const wa = d.workArea;
    const b  = mainWindow.getBounds();
    const gap = (wa.y + wa.height) - (b.y + b.height);          // 실제로 벌어진 틈(DIP)
    const phys = Math.round(gap * (d.scaleFactor || 1));
    /* ★★ 경고 문구가 win 과 **다르다.** 여기가 이 함수에서 유일하게 갈리는 곳이다.
       win 은 `phys > 0` 이 아니면 «틈이 없다 — 이 상태면 영상이 검어진다» 를 붙인다.
       그건 Windows 실측에서 나온 결론이다. mac 은 **기본이 0 이라 항상 틈이 없고**,
       그 문구를 그대로 두면 정상 상태에서 매번 «영상이 검어진다» 가 찍힌다.
       ⇒ 로그가 아직 재료가 아니라 **판정**을 말하게 되고, 그게 이 프로젝트에서 여덟 번
         되돌린 그 실수다(«이 줄은 판정이 아니라 재료다» — win 쪽 _logDisplayLayout 주석).
       ⇒ mac 에서 경고를 붙이는 조건은 하나뿐이다: **갭을 달라고 했는데 안 나온 경우.**
         그건 우리 요청이 OS 에 안 먹혔다는 뜻이라 실제로 이상한 상태다. */
    const asked = OVERLAY_GAP_PHYSICAL_PX;
    const note = (asked > 0 && phys <= 0)
      ? '  ⚠️ 물리 ' + asked + 'px 을 요청했는데 틈이 0 이다 — setBounds 가 안 먹었다'
      : (asked > 0 ? '' : '  (갭 갈래 꺼짐 — mac 기본값)');
    _diagLog('[오버레이] ' + where
      + ' | 작업영역 ' + wa.width + 'x' + wa.height + '@' + wa.x + ',' + wa.y
      + ' | 창 ' + b.width + 'x' + b.height + '@' + b.x + ',' + b.y
      + ' | 아래틈 DIP ' + gap + ' = 물리 ' + phys + 'px (목표 물리 ' + asked + ')'
      + ' | 배율 ' + d.scaleFactor + ' | 해상도 ' + d.size.width + 'x' + d.size.height
      + ' | 레이어드 ' + _layeredState
      + note);
  }catch(_){}
}

/* 🖥️ 연결된 디스플레이 **전체**를 한 줄로 남긴다 — 부팅 때 한 번만.
   ★ 본문이 win 과 같은 것은 베낀 것이 아니라 **Electron `screen` API 만 쓰기 때문**이다.
     플랫폼 의존이 한 줄도 없다. 그래도 이 파일에 사본을 두는 이유는 §1-② 의 모양 때문이다 —
     main.js 는 두 모듈 중 하나만 require 하므로, 공용 파일을 새로 파면 모듈이 셋이 된다.
   ⚠️ 부팅 때 한 번만 찍는다. 로그를 늘리면 정작 필요한 발동 기록을 덮는다(그 사고가 실제로 났다).
   ⚠️ 여기서 나온 배율 조합을 원인으로 **단정하지 말 것.** 이 줄은 판정이 아니라 재료다. */
function _logDisplayLayout(){
  try{
    const all = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    const run = getRunDisplay();
    const parts = all.map((d, i) => {
      const b = d.bounds || {};
      return '#' + (i + 1) + ' ' + b.width + 'x' + b.height + '@' + b.x + ',' + b.y
        + ' 배율' + (d.scaleFactor || 1)
        + (d.id === primary.id ? ' 주' : '')
        + (d.id === run.id ? ' (오버레이 여기)' : '');
    });
    const scales = [...new Set(all.map(d => d.scaleFactor || 1))];
    _diagLog('[화면] 디스플레이 ' + all.length + '개'
      + (scales.length > 1 ? ' | ⚠️ 배율 혼합 ' + scales.join('/') : ' | 배율 단일 ' + scales[0])
      + ' | ' + parts.join(' | '));
  }catch(_){}
}

/* ═══ 밖으로 내보내는 것 ══════════════════════════════════════════════════════
   ⚠️ **`overlay-win.js` 의 목록과 한 글자도 다르면 안 된다.** main.js 는 어느 쪽이 실렸는지
     모르는 채로 이 이름들을 부른다. 하나라도 빠지면 darwin 에서 undefined 호출로 죽는다.
     (handoff-platform-split.md §1-④ 의 표가 이 목록이다) */
module.exports = {
  init,

  /* ── 갭 ── */
  GAP_DEFAULT: OVERLAY_GAP_DEFAULT,
  GAP_LEGACY:  OVERLAY_GAP_LEGACY,
  GAP_VER:     OVERLAY_GAP_VER,
  GAP_MAX:     OVERLAY_GAP_MAX,
  gap()        { return OVERLAY_GAP_PHYSICAL_PX; },
  setGap(px)   { OVERLAY_GAP_PHYSICAL_PX = px; },
  gapFor:            overlayGapFor,
  runOverlayHeight:  runOverlayHeight,

  /* ── 레이어드 알파 (빈 통로 — 위 주석) ── */
  LAYERED_ALPHA_ON: OVERLAY_LAYERED_ALPHA_ON,
  alpha()      { return OVERLAY_LAYERED_ALPHA; },
  setAlpha(v)  { OVERLAY_LAYERED_ALPHA = v; },
  layeredState(){ return _layeredState; },
  applyLayered: _applyOverlayLayered,

  /* ── 진단 로그 ── */
  logGeometry:      _logOverlayGeometry,
  logDisplayLayout: _logDisplayLayout,
};
