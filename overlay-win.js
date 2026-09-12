/* ═══════════════════════════════════════════════════════════════════════════════
   overlay-win.js — 오버레이의 **Windows 전용** 갈래.

   [왜 이 파일이 생겼나] Mac 호환 1단계. 플랫폼 의존 코드를 한곳에 모아 얼린다.
     main.js 는 부팅 때 한 줄로 이 파일과 overlay-mac.js 중 하나를 고른다.
     ⚠️ 이 커밋의 목표는 **동작 변경 0** 이다. 아래 내용은 main.js 에서 통째로 옮겨온 것이고
       값도 조건도 주석도 한 글자 안 바꿨다. 옮기면서 뭔가 개선하고 싶어지면 참을 것 —
       그러면 나중에 "분리 때문인가 개선 때문인가" 를 못 가른다.

   [옮겨온 범위] 갭 · 레이어드 알파 · 기하 로그 둘. 그게 전부다.
     ⚠️ **클릭 통과(setIgnoreMouseEvents)는 여기 없다.** main.js 에 그대로 있다.
       그 통로는 uIOhook 커서 폴링과 한 몸이라 오버레이 축이 아니라 두 축의 접점이고,
       2026-09-12 듀얼 모니터 제보 대응으로 지금도 움직이는 중이다. 다음 커밋에서 가른다.
     ⚠️ setAlwaysOnTop · skipTaskbar · flashFrame 도 여기 없다. 한 덩어리가 아니라
       구글 로그인 창·색 대화상자·did-create-window·setConfigMode 에 흩어져 있어서,
       옮기는 게 아니라 **감싸는** 작업이다. 성격이 달라 따로 간다.

   [이음매] main.js 의 모듈 스코프를 직접 잡던 자리가 셋 있어서 주입으로 바꿨다.
     _getWin()     ← mainWindow
     _getDisplay() ← getRunDisplay()
     _log()        ← _diagLog()
     ⚠️ init() 을 안 부르면 로그·레이어드가 조용히 아무것도 안 한다. main.js 상단에서 부른다.

   [상태] 갭(현재값)과 알파는 **설정 파일로 바뀌는 값**이라 이 파일이 들고 있다.
     main.js 의 loadSettings/saveSettings 는 setGap()/gap()/setAlpha()/alpha() 로 오간다.
     ★ 값이 여기 사는 게 핵심이다 — overlay-mac.js 는 갭 기본값이 **0** 이다(§1-④).
       main.js 가 12 를 들고 있으면 Windows 에서 나온 숫자가 Mac 까지 따라간다.

   ★ 이 파일의 내용은 handoff-overlay-video-blackout-4.md 와 handoff-platform-split.md 가
     배경이다. 값을 건드리기 전에 그 둘을 먼저 읽을 것.
   ══════════════════════════════════════════════════════════════════════════════ */
'use strict';
const { screen } = require('electron');

/* ── 이음매 (main.js 가 init 으로 꽂아 준다) ───────────────────────────────── */
let _getWin     = () => null;
let _getDisplay = () => screen.getPrimaryDisplay();
let _log        = () => {};
function init(deps){
  if(deps && typeof deps.getWin     === 'function') _getWin     = deps.getWin;
  if(deps && typeof deps.getDisplay === 'function') _getDisplay = deps.getDisplay;
  if(deps && typeof deps.log        === 'function') _log        = deps.log;
}
/* 옮겨온 코드가 쓰던 이름 그대로 두기 위한 별칭 — 본문을 안 고치려고 남긴다. */
const _diagLog      = (msg) => _log(msg);
const getRunDisplay = ()    => _getDisplay();

/* ══════════════════════════════════════════════════════════════════════════════
   ★★ 동영상 검어짐 — **해결됨.** 실행 오버레이를 작업영역보다 아래로 몇 px 짧게 만든다.

   [증상] 브라우저에서 영상을 틀어 둔 채 캐릭터나 우리 창(마이홈·설정·꾸미기·포커스기록)을
     만지면 그 영상 영역이 검게(다크모드가 아니면 희게) 변한다. 커서를 빼면 돌아온다.

   [진짜 원인] MPO/DWM 이 아니었다(위 두 스위치가 안 들었던 이유다). **크로미움의 '내 창이
     가려졌나' 계산**이다. 크로미움은 자기 창이 다른 창에 완전히 덮이면 전력을 아끼려고 그리기를
     멈추는데, **위에 있는 창이 투명한지를 확인하지 않는다.** 그래서 우리 전체화면 투명
     오버레이가 클릭을 받는 상태(= 통과 속성이 벗겨진 상태)가 되는 순간, 브라우저는 자기가
     완전히 가려졌다고 판단하고 영상 그리기를 멈춘다 — 소리만 남고 화면이 검어진다.
     electron#49024 에 같은 증상이 그림과 함께 올라와 있다(Windows, 재현 gist 있음, not planned).

   [왜 이 한 줄로 끝나나] 그 계산은 **완전히 덮였을 때만** 성립한다. 일부만 덮이면 정상이다.
     그런데 우리 실행 창은 작업영역과 **정확히 같은 크기**이고 최대화된 브라우저도 작업영역과
     정확히 같아서, 딱 맞아떨어져 완전 차폐가 됐다. 몇 px 짧게 만들면 그 성립이 깨진다.

   [실측] 모드 A~I 아홉 개로 가른 결과다. 통과 속성이 붙은 상태(A·D·G2)는 전부 정상,
     벗겨진 상태로 화면을 완전히 덮은 경우(OFF·C·E·F·G3·G4·H)는 전부 블라인드,
     이 축소를 건 상태(I)는 유튜브·X·넷플릭스 전부 정상. 예외가 하나도 없다.

   ⚠️ **기전은 아직 미확정이다. 확정된 것은 실측뿐이다.**
     위 '완전 차폐' 설명대로라면 브라우저를 **창모드**로 띄웠을 때는 그 창이 오버레이 안에 통째로
     들어가므로 재발해야 한다(빈 틈은 화면 맨 아래에 있고 그 창은 가운데 있으니 값을 키워도
     안 풀린다). 그런데 **창모드에서도 정상이었다.** 즉 설명이 부족하거나 틀렸다.
     이 사안은 추론으로 원인을 좁히려는 시도가 네 번 연달아 틀린 이력이 있다 — 그러니
     **이 주석의 설명이 아니라 아래 실측을 근거로 삼을 것.**
   ★ 그래도 고치는 데는 지장이 없다. 값이 0 이면 재발하고 2 면 안 난다는 것은 실측으로 확정이다.
     ⇒ **창 크기 로직을 건드릴 때는 반드시 영상 위에서 실기기 재확인.** 코드만 보고 판단하지 말 것.
   ★ 이 길로 안 됐다면 다음 후보는 클릭 수신을 작은 창으로 분리하는 2창 구조였다. 그건 오버레이가
     포커스를 못 얻어 채팅·닉네임 등 텍스트 입력이 죽는 문제를 따로 풀어야 한다 — 지금은 불필요.

   ⚠️ 이 값을 0 으로 되돌리면 증상이 그대로 돌아온다. 캐릭터가 화면 맨 아래 이 띠 위에서는
     판정되지 않는 것이 유일한 대가이고, 작업표시줄 바로 윗줄이라 실질적으로 안 걸린다.
   ★ 배율에 따른 반올림은 아래 overlayGapFor 가 물리 픽셀로 되돌려 준다 — 값을 손으로 올릴 일이
     아니다(이 줄은 값이 DIP 였던 시절의 안내였다).
   ══════════════════════════════════════════════════════════════════════════════ */
let OVERLAY_GAP_PHYSICAL_PX = 12;
/* 🚚 [2026-08-26] 갭 기본값 마이그레이션 — **개선이 기존 사용자에게 도달하지 않던 문제.**
   [무엇이 났나] loadSettings 는 파일 값이 있으면 기본값을 덮고, saveSettings 는 저장할 때마다
     현재 값을 다시 쓴다. getRunDisplay 가 첫 부팅에 모니터 지문을 저장하므로, 사실상 모든
     사용자가 **첫 실행 시점의 기본값**을 파일에 박아 넣는다.
     ⇒ 2 → 6 → 12 로 올린 개선이 "한 번이라도 앱을 켜 본 사람" 전원에게 안 갔다.
       제보자는 정의상 기존 사용자다 — 12px 이 그들에게 간 적이 없다.
       실측: 제보 PC 의 파일이 `overlayBottomGap: 2` 였다(2026-08-26).
   [해법] 파일 값이 **옛 기본값 그대로**면 새 기본값으로 올린다. 그 외 값은 사람이 손으로 넣은
     것으로 보고 존중한다 — 진단하느라 직접 넣은 값을 앱이 되돌리면 그게 더 나쁘다.
   ⚠️ 다음에 기본값을 또 올릴 때는 **여기 두 줄만** 고칠 것:
     ・새 기본값을 OVERLAY_GAP_DEFAULT 에 쓰고
     ・직전 기본값을 OVERLAY_GAP_LEGACY 에 추가하고 OVERLAY_GAP_VER 을 +1 한다.
     버전이 올라가면 아직 안 옮긴 파일만 다시 한 번 걸린다(이미 옮긴 파일은 조용히 지나간다). */
const OVERLAY_GAP_DEFAULT = 12;          // 이 빌드의 기본값 — 위 let 의 초기값과 같아야 한다
const OVERLAY_GAP_LEGACY  = [2, 6];      // 지금까지 기본값이었던 적이 있는 숫자들
const OVERLAY_GAP_VER     = 2;           // 파일에 적어 두는 세대 번호
/* ★ [2026-08-24] 6 → 12. **문턱을 찾은 게 아니라 여유를 준 값이다.**
   실측으로 확정된 것은 두 점뿐이다 — 물리 3px 은 정상(4K·150%), 물리 2~3px 은 재발(QHD 제보자).
   둘이 거의 붙어 있어서 문턱이 그 사이 어딘가라는 것만 알고, 6 이 안전한지는 **실기기에서
   확인된 적이 없다.** 그래서 문턱 탐색은 나중으로 미루고 폭을 두 배로 벌린다.
   ⚠️ 12 로도 제보가 다시 오면 **숫자를 더 키우지 말 것.** 그건 이 길(=틈으로 완전 차폐를 깨는 것)이
     틀렸다는 신호이고, 핸드오프의 다른 갈래(WS_EX_TOOLWINDOW · 2창 구조)로 넘어가야 한다는 뜻이다.
   ⚠️ 대가: 화면 맨 아래 물리 12px 이 창 밖이 되어 그 띠에서 캐릭터 판정이 안 된다. 작업표시줄
     바로 윗줄이라 실사용에서는 거의 안 걸리지만, 100% 배율에서 캐릭터가 6px 위로 올라온다.
   ★ 근거·다음 갈래는 handoff-overlay-video-blackout-4.md 참조.

   ★ **DIP 가 아니라 물리 픽셀 기준이다.** 이게 "어떤 PC 는 되고 어떤 PC 는 안 된다" 의 답이었다.

   `setBounds` 는 DIP(배율 적용 전 좌표) 기준이라, 코드에 2 라고 적어도 실제로 벌어지는 틈은
     ・100% 배율 → 물리 2픽셀
     ・150% 배율 → 물리 3픽셀
   로 **환경마다 달라진다.** 실제로 3840x2160·150% 에서는 2 로 멀쩡했고(=물리 3px),
   QHD 제보자에게서는 같은 2 로 재발했다. 숫자는 같은데 틈이 달랐던 것이다.
   ⇒ 물리 픽셀로 고정하고, 배율은 모니터마다 나눠서 되돌린다(overlayGapFor).
     모니터마다 배율이 다른 멀티모니터에서도 각자 맞는 값이 나온다.

   ⚠️ 배율 말고는 자동으로 못 맞춘다. "지금 검어졌는가" 는 **남의 프로세스가 그리는 픽셀**이라
     우리가 볼 수 없다 — 되먹임이 없으니 스스로 값을 찾아갈 수 없다. 그래서 남은 조정은
     아래 로그(_logOverlayGeometry)와 설정 파일(overlayBottomGap)로 사람이 한다.
   ⚠️ 값을 키우면 화면 맨 아래 그만큼이 창 밖이 되어 캐릭터 판정이 안 된다. 작업표시줄 바로
     윗줄이라 실사용에서 안 걸리지만, 물리 32px 을 넘겨야 한다면 그건 이 길이 아니라는 신호다.
   ★ 근거 이슈: electron#49024 (Windows, 투명 창이 영상 창을 **완전히** 덮으면 영상이 안 나온다). */
const OVERLAY_GAP_MAX = 64;
/* 이 모니터에서 실제로 뺄 DIP 값 — 물리 픽셀 목표를 배율로 되돌린다. */
function overlayGapFor(display){
  const sf = (display && display.scaleFactor > 0) ? display.scaleFactor : 1;
  /* 🩺 [2026-08-26] 0 은 0 으로 돌려준다 — 예전에는 여기서 `Math.max(1, …)` 이 0 을 1 로 올렸다.
     [무엇이 났나] 제보용 실험 조합(`overlayBottomGap: 0`)에서 요청 높이가 작업영역-1 이 되는데,
       배율 1.5 에서 1 DIP = 물리 1.5px 이라 OS 가 반올림으로 삼켜 **작업영역과 같은 크기**를
       돌려줬다. 그러면 `_winAlreadyIs` 의 `getBounds() === rect` 비교가 **영원히 거짓**이 되어
       layoutSeats 가 IPC 를 보낼 때마다 setBounds + setAlwaysOnTop 이 다시 나갔다.
       실측: 9분에 417회(중앙값 0.43초 간격). 핸드오프4 §4-2 의 906회/30분 사고와 같은 모양이다.
     ⇒ 0 을 요청하면 "갭 갈래를 끈다"는 뜻이다. 1 로 올려 주는 친절이 실험을 오염시킨다.
     ⚠️ 기본값(12)에서는 이 분기를 타지 않는다 — 평상시 동작은 그대로다. */
  if(!(OVERLAY_GAP_PHYSICAL_PX > 0)) return 0;
  return Math.max(1, Math.min(OVERLAY_GAP_MAX, Math.ceil(OVERLAY_GAP_PHYSICAL_PX / sf)));
}
/* run(전체화면 오버레이) 높이는 **반드시 이 함수를 거친다.** 크기를 정하는 자리가 두 곳이라
   (setConfigMode · moveToDisplay) 한 곳만 고치면 모니터를 옮기는 순간 조용히 원래대로 돌아간다. */
function runOverlayHeight(h, display){ return Math.max(100, h - overlayGapFor(display)); }

/* ═══ 🎬 [2026-08-26] 레이어드 알파 — '가리는 창'에서 빠지는 **세 번째 통로** ═══════════
   핸드오프5 §1-2 는 예외 목록을 `WS_EX_TRANSPARENT` 와 `WS_EX_TOOLWINDOW` 둘로 적어 뒀다.
   이번에 `IsWindowVisibleAndFullyOpaque` **원문 전체**를 읽었더니 그 뒤에 한 갈래가 더 있다:

     if (exStyles & WS_EX_LAYERED) {
       if (!GetLayeredWindowAttributes(...)) return false;   // 속성이 없으면 '투명한 것으로 친다'
       if (flags & LWA_ALPHA && alpha < 255) return false;   // 알파가 255 미만이면 제외
       if (flags & LWA_COLORKEY)            return false;
     }

   ⇒ **알파를 255 미만으로 한 번 걸어 두면 우리 창은 영구히 '가리는 창'이 아니다.**

   [왜 이게 지금까지 안 걸렸나 — 여기가 핵심이다]
     Electron `SetIgnoreMouseEvents` 는 (native_window_views.cc)
       ignore=true  → ex_style |= (WS_EX_TRANSPARENT | WS_EX_LAYERED)
       ignore=false → ex_style &= ~(WS_EX_TRANSPARENT | WS_EX_LAYERED)
       그 직후       → if (layered_) ex_style |= WS_EX_LAYERED
     즉 **클릭받기로 바뀌는 순간 LAYERED 까지 같이 벗겨진다.** 그래서 지금 우리 창은
     ignore 를 뒤집을 때마다 예외 목록에서 통째로 빠져나온다 — 핸드오프5 §3-1(후보 A)의
     0.38초 핑퐁이 그대로 암전/복구의 리듬이 되는 이유다.
     `layered_` 는 `SetOpacity()` 가 켜 준다. **그러니 setOpacity 한 번이 곧 LAYERED 고정이다.**

   [왜 TOOLWINDOW(§4-2) 대신 이쪽인가]
     TOOLWINDOW 는 작업표시줄 버튼을 없애서 `flashFrame`(초대 알림)과 Alt+Tab 을 죽인다
     — preload 주석이 짝 호출을 못박아 둔 기능이다. 이쪽은 창의 그 무엇도 바꾸지 않는다:
     포커스·IME·클릭 수신·작업표시줄 전부 그대로다. 값도 252/255 = 98.8% 라 눈에 안 보인다.

   ⚠️ **이건 아직 실기기 검증 전이다.** 근거는 원본 소스 두 개(크로미움 포팅본 · Electron)이지
     실측이 아니다. 이 사안은 추론이 네 번 틀린 이력이 있다(핸드오프4 §0).
     ⇒ 그래서 **설정 파일로 껐다 켤 수 있게** 만들었다. 빌드 없이 A/B 를 돌리라는 뜻이다.
       `%APPDATA%/Together Working/settings.json` 의 `overlayLayeredAlpha`
         252 (기본) = 켬 · 0 = 끔 · 255 = 끔(알파가 255면 예외에 안 걸린다)
     ★ 실험 순서: **갭을 0 으로 내리고**(`overlayBottomGap: 0`) 이 값만 켠 채로 볼 것.
       갭을 그대로 두면 무엇 덕분에 나았는지 안 갈린다(핸드오프4 §4-1 의 경고 그대로).
   ⚠️ 알려진 위험 하나: 투명 창(transparent:true)에 LWA_ALPHA 를 거는 조합이
     일부 GPU/드라이버에서 창이 검게 그려진다는 제보 계열이 있다(electron#40515).
     **그건 "우리 창이 검어지는" 것이고 이 사안(남의 창이 검어짐)과 반대 방향이다.**
     캐릭터 주변에 검은 사각형이 보인다는 제보가 오면 이 값을 0 으로 내려 확인할 것.
   ⚠️ 값을 1~254 안에서 더 낮추지 말 것. 낮춰도 판정은 똑같이(alpha<255) 걸리고
     캐릭터만 흐려진다. 이 값은 문턱이 아니라 **불투명(255)을 벗어나기만 하면 되는 표식**이다. */
const OVERLAY_LAYERED_ALPHA_ON = 252;    // 토글을 켰을 때 쓰는 값 (0<alpha<255 이기만 하면 된다)
/* ★ [2026-08-26] 기본은 **꺼짐**이다. 예전 판은 252 로 전원에게 켰는데, 되돌렸다.
   이유 둘:
     ① 아직 실기기에서 효과가 확인되지 않았다. 확인 안 된 창 스타일 변경을 전원에게 거는 것은
        이 사안의 이력(추론 네 번 연속 오답)에 비추어 과하다.
     ② electron#40515 계열 — 투명 창에 LWA_ALPHA 를 거는 조합이 일부 GPU 에서 **우리 창**을
        검게 그린다는 제보가 있다(약 5%). 증상이 없는 사용자까지 그 위험을 질 이유가 없다.
   ⇒ 증상이 있는 사람만 설정 → 시스템 → '영상 겹침 실험' 으로 켠다. */
let OVERLAY_LAYERED_ALPHA = 0;
/* 실제로 걸렸는지 — 진단 로그가 이 값을 같이 남긴다(옛 빌드/꺼진 빌드 구분용). */
let _layeredState = 'off';
function _setOpacitySafe(v){
  const mainWindow = _getWin();   // ← 이음매: 옮겨온 본문이 쓰던 이름을 그대로 유지한다
  try{ mainWindow.setOpacity(v); return true; }catch(_){ return false; }
}
function _applyOverlayLayered(where){
  const mainWindow = _getWin();   // ← 이음매: 옮겨온 본문이 쓰던 이름을 그대로 유지한다
  if(!mainWindow || mainWindow.isDestroyed()) return;
  if(process.platform !== 'win32'){ _layeredState = 'n/a(win32 아님)'; return; }
  const a = OVERLAY_LAYERED_ALPHA;
  if(a > 0 && a < 255){
    /* → Electron 이 WS_EX_LAYERED + LWA_ALPHA 를 걸고 layered_=true 로 고정한다.
         그 뒤로는 setIgnoreMouseEvents 가 몇 번을 왕복하든 LAYERED 가 다시 붙는다. */
    _layeredState = _setOpacitySafe(a / 255) ? ('on(alpha ' + a + ')') : 'fail';
  } else {
    /* 끄기 — 알파를 255(불투명)로 되돌리면 예외 목록의 `alpha < 255` 에 안 걸린다.
       ⚠️ WS_EX_LAYERED 비트 자체는 남는다(Electron 의 layered_ 를 끄는 통로가 없다). 그래도
         GetLayeredWindowAttributes 가 alpha=255 를 돌려주므로 판정상으로는 확실히 꺼진 것이다. */
    _layeredState = _setOpacitySafe(1) ? 'off' : 'fail';
  }
  if(where) _diagLog('[오버레이] 레이어드 알파 ' + where + ' — ' + _layeredState);
}

/* 🩺 실제로 틈이 생겼는가 — **지정한 크기와 OS 가 준 크기는 다를 수 있다.**
   제보를 다시 받았을 때 추측 대신 이 줄을 먼저 본다. 기록 위치는 _diagLog 와 같다.
   (%APPDATA%/Together Working/tw-mouse-diag.log) */
function _logOverlayGeometry(where){
  const mainWindow = _getWin();   // ← 이음매: 옮겨온 본문이 쓰던 이름을 그대로 유지한다
  if(!mainWindow || mainWindow.isDestroyed()) return;
  try{
    const d = getRunDisplay();
    const wa = d.workArea;
    const b  = mainWindow.getBounds();
    const gap = (wa.y + wa.height) - (b.y + b.height);          // 실제로 벌어진 틈(DIP)
    const phys = Math.round(gap * (d.scaleFactor || 1));         // ★ 실제 의미가 있는 값은 이쪽이다
    _diagLog('[오버레이] ' + where
      + ' | 작업영역 ' + wa.width + 'x' + wa.height + '@' + wa.x + ',' + wa.y
      + ' | 창 ' + b.width + 'x' + b.height + '@' + b.x + ',' + b.y
      + ' | 아래틈 DIP ' + gap + ' = 물리 ' + phys + 'px (목표 물리 ' + OVERLAY_GAP_PHYSICAL_PX + ')'
      + ' | 배율 ' + d.scaleFactor + ' | 해상도 ' + d.size.width + 'x' + d.size.height
      + ' | 레이어드 ' + _layeredState   // 🎬 이 줄이 없으면 옛 빌드다 — 갈래를 가르기 전에 먼저 확인할 것
      + (phys > 0 ? '' : '  ⚠️ 틈이 없다 — 이 상태면 영상이 검어진다'));
  }catch(_){}
}

/* 🖥️ 연결된 디스플레이 **전체**를 한 줄로 남긴다 — 부팅 때 한 번만.
   [왜 필요한가] 위 _logOverlayGeometry 는 **오버레이가 뜬 한 대**만 기록한다. 그런데 제보를
     가르는 변수가 나머지 화면 쪽에 있었다 — 액정 태블릿(신티크)을 듀얼로 쓰는 사람들이었고,
     시스템에 배율이 섞여 있었다. 그 사실을 알아내는 데 제보자에게 한 명씩 물어봐야 했다.
   ⇒ 배율·해상도·배치·주 모니터 여부, 그리고 오버레이가 어디에 떴는지를 자동으로 남긴다.
   ★ 부팅 때 한 번만 찍는다. 로그를 늘리면 정작 필요한 발동 기록을 덮는다(그 사고가 실제로 났다).
   ⚠️ 여기서 나온 배율 조합이 원인이라고 **단정하지 말 것.** 지금까지 상관물을 원인으로 오해해
     되돌린 가설이 여덟 번이다. 이 줄은 판정이 아니라 재료다. */
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
    /* 배율이 섞였는지는 사람이 세지 않아도 되게 앞에서 미리 말해준다. */
    const scales = [...new Set(all.map(d => d.scaleFactor || 1))];
    _diagLog('[화면] 디스플레이 ' + all.length + '개'
      + (scales.length > 1 ? ' | ⚠️ 배율 혼합 ' + scales.join('/') : ' | 배율 단일 ' + scales[0])
      + ' | ' + parts.join(' | '));
  }catch(_){}
}

/* ═══ 밖으로 내보내는 것 ══════════════════════════════════════════════════════
   ⚠️ overlay-mac.js 는 **이 목록과 똑같은 이름**을 내보내야 한다. 하나라도 빠지면
     main.js 가 darwin 에서 undefined 를 부른다. (handoff-platform-split.md §1-④) */
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

  /* ── 레이어드 알파 ── */
  LAYERED_ALPHA_ON: OVERLAY_LAYERED_ALPHA_ON,
  alpha()      { return OVERLAY_LAYERED_ALPHA; },
  setAlpha(v)  { OVERLAY_LAYERED_ALPHA = v; },
  layeredState(){ return _layeredState; },
  applyLayered: _applyOverlayLayered,

  /* ── 진단 로그 ── */
  logGeometry:      _logOverlayGeometry,
  logDisplayLayout: _logDisplayLayout,
};
