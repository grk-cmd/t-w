# 핸드오프 — main.js 플랫폼 분리 (Windows/macOS)

**범위:** 이 문서는 **플랫폼 분리 한 가지**만 다룬다. 릴리즈노트·에셋 라이선스는 별건이다.

> ⚠️ **[2026-09-14] 이 문서는 더 이상 진행 상황의 머리가 아니다.**
> ③④⑤ 가 끝난 뒤의 상태는 **`handoff-mac-runtime.md`** 에 있다. 거기가 머리다.
> 이 문서는 **왜 그렇게 설계했는가**를 담은 참고 문서로 남는다(§0 확정 사항 · §4-② 경계 ·
> §4-b 판정 키 · §7 실기기 확인 목록은 계속 유효하다).
> ★ 아래 §5 목록을 진행 상황으로 읽지 말 것 — 실제로 그렇게 읽은 세션이 있었고,
> 그 결과 이미 초록인 ⑤를 「다음 한 수」로 지목한 `handoff-mac.md` 가 나왔다(그 문서는 폐기).

**상태:** ①②③④⑤ 완료. 다음은 ⑥(맥 런타임) — `handoff-mac-runtime.md` §4 참조.

**개정 이력**
- 1판 — 설계만. §0(블랙아웃 해법 미확정)에 막혀 있었다.
- 2판 — main.js 2857줄 전수 확인. §0 해제, `sysinput` 축 발견, 전수 표 작성.
- 3판 — ⓪-b·①·② 완료. 실기기 확인 통과. ③의 위험과 남은 결정을 적었다.
- 4판 — §4의 결정 셋을 전부 끝냈다. `sim-sysinput.js` 신규, 판정 키 포맷 확정.
  ③ 의 범위가 좁아졌다(§4-② 참조). 실기기 확인 통과.
- **5판(이 문서) — 내용은 안 고쳤다. 세 군데만 손봤다:
  ① 머리 자리를 `handoff-mac-runtime.md` 에 넘겼다(위 경고).
  ② §4-b 의 «`sim-sysinput.js` 6절이 대조한다»가 **사실이 아니었다** — 정정하고
     `sim-keysof-twin.js` 로 대체했다.
  ③ §5 목록에 ③④⑤ 완료를 반영했다.**

---

## 0. ✅ 확정된 것 — 다시 논의하지 말 것

### ① 블랙아웃 해법은 **갭**이다

`OVERLAY_GAP_PHYSICAL_PX = 12` + 2026-08-26 마이그레이션(`GAP_DEFAULT`/`GAP_LEGACY`/`GAP_VER`).

- ★ **실제로 제보를 끊은 것은 12가 아니라 마이그레이션이다.** 진짜 사고는 *"개선이 기존
  사용자에게 도달하지 않던 문제"* 였다 — `loadSettings`가 파일 값으로 기본값을 덮으므로
  2 → 6 → 12 개선이 **한 번이라도 앱을 켜 본 사람 전원에게 안 갔다.**
  실측: 제보 PC 파일이 `overlayBottomGap: 2`.
- ⚠️ 기전 자체는 여전히 미확정이다(창모드에서 재발하지 않는 것이 설명되지 않는다).
  **주석의 설명이 아니라 실측을 근거로 삼을 것.**

| 나머지 후보 | 상태 |
|---|---|
| 레이어드 알파(252) | 구현돼 있으나 기본 **꺼짐**. 실기기 미검증 실험. 설정으로만 켠다 |
| `WS_EX_TOOLWINDOW` | **폐기** — `flashFrame`·Alt+Tab을 죽인다 |
| 2창 구조 | **보류 유지** — 오버레이가 포커스를 못 얻어 텍스트 입력이 죽는다 |
| `setFocusable(false)` (NOACTIVATE) | **폐기** — IME가 원리적으로 죽는다 |

⚠️ 뒤 셋은 `sim-overlay-layered.js` §8이 지키고 있다. **다시 파지 말 것.**

### ② 네이티브 모듈 — darwin 사정이 갈렸다 (2026-09-12 확인)

| 패키지 | 확인 결과 |
|---|---|
| `uiohook-napi@1.5.5` | ✅ `prebuilds/darwin-arm64` · `darwin-x64` **둘 다 동봉.** `libuiohook/src/darwin/` 소스도 포함 |
| `node-window-manager@2.2.4` | ⚠️ **프리빌드가 아예 없다.** darwin뿐 아니라 **win32도 없다** — 설치 때마다 소스를 컴파일한다. `lib/macos.mm`(10.3kB)는 존재 |

⇒ **Mac 빌드는 반드시 맥에서 만들어야 한다.** `.mm` 컴파일에 Xcode Command Line Tools가
필요하고 그건 macOS에만 있다. 윈도우 크로스 컴파일은 불가능하다.

⇒ ★ **GitHub Actions `macos-latest` 러너가 실질적인 빌드 머신이다.** 하드웨어를 안 사고
mac 빌드를 뽑는 유일한 길이다. 무료 러너는 arm64라 배포 대상과 아키텍처도 같다.

⚠️ 남은 위험: `2.2.4`가 오래된 판이라 최신 macOS SDK에서 `.mm`이 안 붙을 수 있다.
**CI를 한 번 돌리면 그 자리에서 갈린다.** 깨지면 `sysinput-mac` 대체 모듈 문제가 된다.

⚠️ 두 모듈 모두 최상단 `require`에 try/catch가 없다. 로드가 실패하면 앱이 통째로 안 켜진다.
`uIOhook.start()`에는 이미 catch가 있는데 require에는 없다. **④에서 감쌀 것.**

---

## 1. 결정된 사항

### ① `main.js`를 통째로 둘로 나누지 않는다

`main-win.js` / `main-mac.js` 방식은 **폐기.** IPC·설정·업데이터·로그인이 두 벌이 된다.

### ② 얇은 `main.js` + 플랫폼 모듈 **넷**

```js
const mac = process.platform === 'darwin';
const overlay  = mac ? require('./overlay-mac')  : require('./overlay-win');   // ✅ 완료
const sysinput = mac ? require('./sysinput-mac') : require('./sysinput-win');  // ③ 예정
```

⚠️ **두 축을 한 커밋에 섞지 말 것.** 검사 다섯 개가 `main.js`를 파일 이름으로 읽는다.

### ③ 이음매는 IPC **아래**에 둔다

채널명은 한 글자도 바꾸지 않는다. 렌더러(`app.js`)도 안 건드린다.
`sim-ghost-cache-sync.js`의 preload 무수정 규칙, `sim-google-login.js`의 채널 검사가 이걸 지킨다.

### ④ 인터페이스

**`overlay-win.js` — ✅ 구현됨.** `overlay-mac.js`는 **이 목록과 똑같은 이름**을 내보내야 한다.

| 내보내는 것 | win (현재) | mac (예정) |
|---|---|---|
| `init({getWin,getDisplay,log})` | 주입 — 안 부르면 로그·레이어드가 조용히 죽는다 | 동일 |
| `GAP_DEFAULT` / `GAP_LEGACY` / `GAP_VER` / `GAP_MAX` | 12 / [2,6] / 2 / 64 | **0에서 시작** |
| `gap()` / `setGap(px)` | 설정 파일과 왕복 | 동일 |
| `gapFor(display)` | 물리 12px을 배율로 환산 | 미정 |
| `runOverlayHeight(h, display)` | `h - gapFor()` | 동일 |
| `LAYERED_ALPHA_ON` / `alpha()` / `setAlpha(v)` / `layeredState()` | 252 / 기본 0 | **빈 값** |
| `applyLayered(where)` | `setOpacity` | **빈 함수** |
| `logGeometry(where)` / `logDisplayLayout()` | 진단 로그 | 동일 |

⚠️ **macOS 갭을 12로 시작하지 말 것.** 12는 Windows 크로미움의 가려짐 판정에서 나온 값이다.
macOS는 `NSWindowOcclusionState`로 다른 판정을 쓴다.

★ **갭 현재값과 알파가 모듈 안에 사는 것이 설계의 핵심이다.** main.js가 12를 들고 있으면
Windows에서 나온 숫자가 Mac까지 따라간다.

**`sysinput-win.js` / `sysinput-mac.js`** — ③에서 만든다

| 함수 | win | mac |
|---|---|---|
| `startGlobalHooks(handlers)` / `stopGlobalHooks()` | `uIOhook` | 접근성 권한 필요 |
| `getActiveWindow()` / `listWindows()` | `windowManager` + `WINLIST_SKIP` | 화면 기록 권한 확인 필요 |
| `selfProcName()` | `basename(process.execPath)` | `.app` 번들 구조 보정 |
| `procNameOf(win)` / `SHELL_SKIP` / `PEN_APPS` | exe 이름 | 재작성 |

---

## 2. ✅ ①② 완료 보고 (2026-09-12)

### 무엇이 옮겨갔나

`overlay-win.js` 신규 — 갭 계열, 레이어드 알파 계열, 기하 로그 둘.
main.js **3036 → 2835줄.** 호출부 22곳을 이음매로, 옮겨간 자리를 가리키던 주석 5곳도 수정.

⚠️ **"잘라 붙이기만"은 안 됐다.** 셋이 모듈 스코프 `mainWindow`를 직접 잡고 있었다
(`_setOpacitySafe`·`_applyOverlayLayered`·`_logOverlayGeometry`).
각 함수 첫 줄에 `const mainWindow = _getWin();`를 넣어 **본문은 한 글자도 안 고치고** 통로만 바꿨다.
③에서도 같은 종류가 나올 것이라고 예상할 것.

### 무엇을 **안** 옮겼나 — 여기가 ③의 경계다

- **클릭 통과 일체** — `_forwardFor`·`_reapplyIgnoreMouse`·`_applyForwardOnly`·
  `_checkCursorNearChar`·`_sendHitTest`·고스트 감시. main.js에 그대로 있다.
- `setAlwaysOnTop`(실호출 5 + 해제 2) · `skipTaskbar` · `flashFrame` — 한 덩어리가 아니라
  구글 로그인 창·색 대화상자·`did-create-window`·`setConfigMode`에 흩어져 있다.
  **옮기는 게 아니라 감싸는 작업**이라 성격이 다르다.

### ★ `package.json`

`files` 배열에 `overlay-win.js`를 넣었다. **이게 빠지면 개발에선 멀쩡하고 설치본만 부팅 때 죽는다.**
⚠️ 앞으로 모듈을 더 만들 때마다 여기에 추가할 것. 잊으면 같은 방식으로 조용히 죽는다.

### 검증 — 정적 + 실기기 둘 다

| 검사 | 결과 |
|---|---|
| `sim-overlay-gap.js` | 통과 47 · 실패 0 · 검사못함 0 |
| `sim-overlay-layered.js` | 통과 43 · 실패 0 · 검사못함 0 |
| `sim-ghost-cache-sync.js` | 통과 36 · 실패 0 (**안 건드림**) |
| `sim-google-login.js` | 분리 전과 동일 (**안 건드림**) |
| `audit.py` | 분리 전후 출력 **완전히 동일** (**안 건드림**) |

- **동작 변경 0을 숫자로 확인.** 배율 1·1.25·1.5·1.75·2·2.5·3에서 `gapFor`·`runOverlayHeight`가
  분리 전과 **불일치 0건**. `setGap(0)`의 "0은 0으로 돌려준다" 분기, 알파 왕복, 창 없을 때
  안전 호출도 확인.
- **검사를 새 구조에 끼워맞추지 않았음을 확인.** 고친 두 검사를 **분리 전 원본 main.js**에
  돌려도 46·34로 통과한다.
- **실기기(Windows) 확인 통과** — 부팅, 진단 로그 두 줄(`[화면]`·`[오버레이] … 물리 12px`),
  설정 파일 왕복(승격 재발 없음), 모니터 변경, 레이어드 토글, **그리고 영상 위 재확인.**
  ★ 마지막 항목이 갭 주석이 요구한 유일한 실측 조건이다.

---

## 3. ★ 부산물 — `sim-overlay-gap.js`가 헛돌고 있었다

주석에 *"이게 이 파일의 핵심 검사다"* 라고 적힌 항목
(`setConfigMode`가 `runOverlayHeight`를 거치는가)이 **실제로는 아무것도 안 지키고 있었다.**

- 검사가 **주석 포함 원문**에서 첫 `setConfigMode`를 찾아 2500자를 훑는데, 첫 등장이 주석 안이었다.
  진짜 호출부는 거기서 **115,247자** 떨어져 있다.
- 그런데도 통과한 이유: 갭 주석의 `(setConfigMode · moveToDisplay)` 줄 **바로 다음 줄**이
  `function runOverlayHeight` 정의였다. **주석과 정의가 우연히 붙어 있어서 맞았을 뿐,
  호출부는 한 번도 본 적이 없다.**
- 분리로 그 주석이 `overlay-win.js`로 가면서 우연이 깨져 드러났다.

⇒ 이미 있던 주석 제거본(`code`)을 보도록 고쳤다. 이유는 파일 안에 적어 뒀다.

⚠️ **교훈 — 다른 검사도 같은 방식으로 헛돌고 있을 수 있다.** "문자열이 근처에 있는가"로
쓰인 항목은 전부 의심 대상이다. 특히 `src`(주석 포함)와 `code`(주석 제거)를 섞어 쓰는 자리.
③에서 검사를 손댈 때 이 관점으로 한 번 훑을 것.

---

## 4. ⚠️ ③은 ①과 성격이 다르다 — 같은 방식으로 밀면 안 된다

| | ① 오버레이 (완료) | ③ sysinput |
|---|---|---|
| 코드 배치 | 200줄 **연속 덩어리** | main.js **전체에 흩어짐** |
| 전용 검사 | `sim-overlay-gap` · `sim-overlay-layered` 둘 | **없다** |
| 검증 방법 | 순수 함수라 **숫자로 대조 가능** | OS 호출이라 정적 대조 불가 |
| 최근 변경 | 없음 | **2026-09-12(당일) 대응이 한복판에 들어감** |

★ **①이 안전했던 이유는 "검사 두 개가 지키는 순수 함수 덩어리"였기 때문이다.**
3판 시점에는 ③에 그 셋이 다 없었다. **그래서 셋을 먼저 만들었다** — 아래가 그 결과다.

### ✅ ③ 들어가기 전 결정 셋 — 전부 끝났다 (2026-09-12)

**① `focus-apps.json` 저장 포맷 — ✅ 확정. 판정 키를 도입했다**

⇒ 상세는 §4-b. 요약하면 판정 축이 `name`(exe 이름)에서 **`key`(플랫폼 접두사 + 이름)**로 옮겨갔다.

**② 듀얼 모니터 대응 — ✅ 해소. 다만 "안정화"가 아니라 "범위에서 뺀다"로 풀렸다**

`npm start` 실기기에서 정상 동작 확인. 그러나 근거는 그쪽이 아니다.

★ **③ 이 가져가는 것은 "훅을 걸고 푼다" 뿐이고, 핸들러 본문은 main.js 에 남긴다.**
`startGlobalHooks(handlers)` 모양이면 `mousedown` 안의 `_guardForeignInput` 호출, `offOverlay`
계산, IPC 전송이 전부 제자리에 있다. 그러면 `_checkCursorNearChar` → `_reportCursorActivity` →
`_applyForwardOnly` 통로는 **애초에 건드릴 일이 없다.**
⇒ 움직이는 코드를 쪼개는 문제가 아니라, 쪼개는 범위 밖에 두는 문제였다.
⚠️ `sim-sysinput.js` 4절이 이 경계를 지킨다. 클릭 통과 일체를 sysinput 으로 옮기려 들면 거기서 운다.

**③ `sysinput` 전용 검사 — ✅ `sim-sysinput.js` 신규. 쪼개기 *전에* 초록을 확인했다**

⇒ 상세는 §4-a.

---

---

## 4-a. `sim-sysinput.js` — ③의 판정 기준 (신규)

`main.js` 와 같은 폴더에서 `node sim-sysinput.js`. **분리 전 현재 상태에서 통과 65 · 실패 0 ·
검사못함 0.** `sysinput-win.js` 존재 여부로 단계를 스스로 판정하므로 **같은 파일이 분리 전후
양쪽에서 초록이어야 한다** — 그 초록이 곧 "동작 변경 0"의 근거다.

| 절 | 지키는 것 |
|---|---|
| 1 | 네이티브 접촉면 8곳 보존. 분리 후엔 main.js 쪽 0곳 |
| 2 | 과거 사고가 남긴 조건(mousemove 훅 금지·start try/catch·session-end stop·`explorer.exe`·`enum-failed`) |
| 3 | 이름 정규화·창 목록 필터 (모델 재현) |
| 4 | **③의 경계** — 훅 핸들러 본문은 main.js 에 남는다 |
| 5 | 근거 주석 보존 |
| 6 | 판정 키가 `keysOf` 한 통로로만 나간다 (§4-b) — ⚠️ **`main.js` 쪽만이다.** `app.js` 의 `_chalKeysOf` 는 안 본다(`sim-keysof-twin.js` 몫) |

★ **헛돌지 않는 것을 확인했다.** 변이 8종(훅 제거·session-end stop 제거·`explorer.exe` 제외·
start try 풀기·mousemove 훅 부활·`enum-failed` 개명·8칸 로더 후퇴·`_guardForeignInput('key')`
누락)을 주입해 **전부 실패로 잡히는 것**을 확인했다. §3의 교훈에 대한 대응이다.

★ **분리 후 단계도 흉내 내 돌렸다** — 74개 통과. 검사가 이사를 막지 않는다.

⚠️ **`uIOhook.stop()` 을 개수로 세지 않는다.** 분리 전에는 `before-quit`·`session-end` 두 자리에서
각각 부르지만 분리 후에는 둘 다 `stopGlobalHooks()` 하나를 부르므로 네이티브 호출은 1곳으로
합쳐진다. 고정 2로 세면 **제대로 쪼갠 순간 거짓 실패**가 난다. 자리별로 본다.

---

## 4-b. ★ 판정 키 — `focus-apps.json` 포맷 결론 (§4-① 의 답)

### 무엇이 문제였나

판정이 `chrome.exe` 같은 **Windows 실행파일 이름**으로 이뤄지고 있었다. macOS 에서 같은
프로그램에 같은 규칙(basename + 소문자)을 대면 `google chrome` 이 나온다 — 확장자가 없고
공백이 든다. **어떤 문자열 규칙으로도 안 맞는다.**

★ **exe 이름이 사는 자리는 두 곳이었다.** 3판이 지목한 `focus-apps.json` 말고 하나 더 있다.

| 자리 | 저장소 | 되돌릴 수 있나 |
|---|---|---|
| `focusApps[i].name` | 로컬 `focus-apps.json` | 재등록하면 그만 |
| **`chalRec.cfg.exe`** (달성 조건) | **localStorage + Firebase** | **계정을 따라다닌다. 회수 불가** |

두 번째가 진짜 사안이었다. Windows 에서 건 조건을 Mac 에서 열면 `_chalFocusTick` 이 매번 조기
return 해 **에러 없이 0초씩 쌓이다 만다.** 사용자는 달성표가 고장 난 줄로만 안다.

### 결정 — 플랫폼 접두사 키, 저장은 스칼라 `key`, 읽기는 배열

```
focus-apps.json : { key:"win:chrome.exe", name:"chrome.exe", path:"...", title:"..." }
달성조건 cfg    : { key:"win:notepad.exe", exe:"notepad.exe", label:"notepad", hours:3 }
```

- `key` 가 **유일한 판정 축**이다. `name` 은 표시용(`.exe` 를 떼어 보여준다).
- 접두사가 있어야 **"안 맞는다"와 "다른 기기에서 등록한 것"이 구분된다.** 후자를 구분 못 하면
  침묵할 수밖에 없고, 그게 이 작업이 없애려던 증상이다. 지금은 설정 화면 안내문이 바뀐다.
- 한 슬롯이 여러 플랫폼 키를 드는 모양(`keys` 배열)은 **서버 병합 규칙**이 필요한데, mac 키 생성
  규칙 자체가 실측 0건이라 지금 정할 수 없다. 그래서 **저장은 `key` 하나, 읽기는 처음부터 배열을
  받아들인다**(`keysOf`). 나중에 넓힐 때 판정부는 한 글자도 안 바뀐다.
- ⚠️ **`key` 와 `keys` 를 둘 다 저장하지 말 것.** 진실의 출처가 둘이 되면 어긋났을 때 누가 이기는지를
  또 정해야 한다. 저장은 언제나 하나다.

### ★ 승격은 `'win:'` 고정이다 — `KEY_PLATFORM` 이 아니다

`key` 가 없는 저장물은 **Windows 에서만 쓰인 적이 있다**(mac 빌드가 존재한 적이 없다).
mac 에서 읽었다고 `mac:` 을 붙이면 남의 기기 기록이 이 기기 것으로 둔갑해 조용히 시간이 쌓인다.
로더 승격은 `GAP_VER` 와 같은 자리·같은 모양이다 — **개선이 기존 사용자에게 도달하지 않는 것**이
§0-① 의 진짜 사고였고, 여기서 안 채우면 등록해 둔 사람 전원이 재등록 전까지 새 축을 못 받는다.

### ⚠️ `cfg.exe` 는 남겼다 — "저장은 하나" 원칙에서 의도적으로 벗어난 자리

`chalRec` 은 Firebase 로 동기화돼서 **아직 옛 판본을 쓰는 기기**가 같은 기록을 읽는다. 거기서
`cfg.exe` 가 비면 그 기기의 달성이 조용히 멎는다 — 없애려던 증상 그대로다.
⇒ `key` 에서 **파생되는 값**이지 두 번째 진실이 아니다. 새 코드는 판정에 쓰지 않는다.
★ **옛 판본이 전부 사라지면 이 줄을 지울 것.** 그때까지는 남는다.

### ⚠️ `key` 없는 cfg 는 앞으로도 계속 생긴다 — 고장이 아니다

[자동] 되살리기(`chalRec.last` / `lastWe`)는 저장된 cfg 를 손대지 않고 통째로 현역에 올린다
(app.js `_chalStart(last.kind, last.cfg, …)`). `arcWd`·`arcWe` 의 보관본도 마찬가지다.
판정이 `keysOf` 한 통로로만 나가므로 옛 모양이 남아도 새는 데가 없다.
**`key` 없는 기록을 보고 "승격이 안 걸렸다"고 판단하지 말 것.** 여기서 나온 것일 수 있다.

### ⚠️ `keysOf` 는 두 벌이다

`main.js` 의 `keysOf` 와 `app.js` 의 `_chalKeysOf`. 렌더러가 main 을 require 할 수 없고, 새 IPC
채널을 파면 preload 를 고쳐야 하기 때문이다(`sim-ghost-cache-sync.js` 의 preload 무수정 규칙).
**한쪽만 고치면 안 된다.** `sim-keysof-twin.js` 가 두 벌을 대조한다 — 본문 문자열, 우선순위
(`keys → key → exe → name`), `'win:'` 리터럴 고정, 그리고 **실제로 두 함수를 돌려 입력 19종의
답이 같은지**까지 본다.

> ⚠️ **[2026-09-14 정정] 4판은 이 자리에 «`sim-sysinput.js` 6절이 대조한다»고 적었다. 틀렸다.**
> `sim-sysinput.js` 에는 `app.js` 라는 문자열이 한 건도 없다 — `app.js` 를 옆에 두든 치우든
> 결과가 60·0 으로 똑같다. 6절은 `main.js` 쪽 통로만 본다. 즉 이 절이 «제일 부서지기 쉽다»고
> 지목한 자리를 **지키는 것이 실제로는 하나도 없었다.** 문서에만 있고 파일에 없던 경우다.
> ⇒ `sim-keysof-twin.js` 를 새로 만들어 메웠다(30·0·0, `--selftest` 변이 9종 전부 잡힘).
>   `sim-sysinput.js` 6절에 끼우지 않은 이유는 §4-a 의 판본 문제다 — 같은 이름으로 65·0 /
>   58·1 / 60·0 세 숫자가 돌아다니는 판에 하나를 더 만들면 어느 초록이 진짜인지 못 가린다.

### 검증

- **동작 변경 0** — 옛 판정과 새 판정을 대조. 실제 파이프라인에서 나올 수 있는 입력으로
  등록 판정 42건·달성 판정 35건 **전부 일치.** 대문자를 섞은 이론상의 입력에서만 5건이 갈리는데
  전부 `옛 false → 새 true` 방향이다(되던 게 안 되는 경우 없음).
- **실기기(Windows) 확인 통과**
  - 승격: `focus-apps.json` 6칸에 `key` 부착 확인. ★ **필드 순서로 두 경로가 갈린다** —
    승격된 슬롯은 `key` 가 맨 뒤(나중에 얹으므로), 새로 등록한 슬롯은 맨 앞(통째로 만드므로).
  - 등록 판정: 집중 시간 정상 누적.
  - 달성 판정 **옛 기록 갈래**: `cfg` 가 `{exe:'whale.exe', …}`(key 없음)인 상태에서 2분 사용에
    `today.sec` 4689 → 4836. **기존 사용자 전원이 들고 있는 모양이라 이 갈래가 제일 중요하다.**
  - 달성 판정 **새 기록 갈래**: 앱을 새로 고르면 `_chalDraft.cfg` 에 `key` 와 `exe` 가 둘 다 박힌다.

⚠️ **"다른 기기에서 등록한 조건" 안내문은 Mac 빌드가 생겨야 실제로 볼 수 있다.** 지금은 정적
확인뿐이다. ⑥ 의 확인 항목이다.

---

## 5. 남은 일 — 순서를 지킬 것

- ⓪ ✅ 블랙아웃 해법 확정
- ⓪-b ✅ 네이티브 모듈 darwin 확인 (§0-②)
- ① ✅ `overlay-win.js` 분리 — 동작 변경 0
- ② ✅ 검사 다섯 개 초록 확인
- **③-준비 ✅ `sim-sysinput.js` 신규(§4-a) · 판정 키 포맷 확정(§4-b) · ③ 범위 축소(§4-②)**
- ③ ✅ `sysinput-win.js` 분리 (170줄) — 훅 설치/해제와 창 열거만. 핸들러 본문은 안 옮겼다
- ④ ✅ 네이티브 `require` try/catch + `package.json` mac 빌드 골격 (§6) + `.icns` 한 벌
- ⑤ ✅ GitHub Actions `macos-latest` — **arm64 · x64 양쪽 통과.** `mac-probe #2` 초록.
  `node-window-manager@2.2.4` 의 `.mm` 이 **지금 나와 있는 가장 최신 SDK 에서 붙었다**
- ⑥ `overlay-mac.js` / `sysinput-mac.js` + mac 판정 키 생성 규칙 결정(§4-b) ← **다음**

★ ③④⑤ 의 상세와 그 뒤 남은 문제는 **`handoff-mac-runtime.md`** 에 있다.

**★ ③~⑤는 Mac 실기기 없이 전부 할 수 있다.** ⑥부터가 실기기 영역이다.

---

## 6. `package.json` — mac 빌드 골격 (④)

- `build.mac` 블록 **없음.** `target`은 win-nsis 하나뿐, `arch`는 x64뿐
- ★ `asarUnpack`에 `extract-file-icon`이 있는데 **`dependencies`에 그 패키지가 없다.**
  지금 윈도우 빌드에서도 죽은 줄이다 — mac과 무관하게 정리 대상
- `APP_ICON`이 `.ico` — mac은 `.icns`(빌드) + 창 아이콘 별도
- `publish`가 github 하나 — mac 아티팩트가 붙으면 `electron-updater` 쪽도 봐야 한다
- ⚠️ `files` 배열에 새 모듈을 **매번** 추가할 것 (§2 참조)

---

## 7. Mac 실기기에서 먼저 확인할 것 (⑥ 이후)

1. **★ `setIgnoreMouseEvents(ignore, {forward:true})`의 macOS 동작.**
   고스트 감시 통로 3단(`_guardGhostPassthrough` → `penHitTest` → `_sendIgnore(false)`)이
   통째로 이 위에 얹혀 있다. 다르면 **2초 얹기 통로를 새로 설계해야 한다.** 제일 먼저 볼 곳.
2. 전역 훅·창 목록의 **권한 대화상자**(접근성/화면 기록). 거부했을 때의 동작이
   Windows의 "백신이 훅을 차단" 경로와 같은 자리다 — 그 try/catch를 재사용할 수 있는지 볼 것.
   ⚠️ `windowManager.requestAccessibility()`를 우리는 **한 번도 안 부른다.** 권한 없이 title이
   빈 문자열로 오면 `listWindows`가 **조용히 빈 목록**을 돌려준다(포커싱 어플이 "아무것도 안 뜨는" 상태).
3. 오버레이가 Spaces·전체화면 위에 뜨는가 (`setVisibleOnAllWorkspaces`)
4. Retina(scaleFactor 2)에서 좌표·갭 산수. `sim-overlay-gap.js`는 배율 4까지 이미 검사한다.
5. `smoke.js` 240행이 `navigator.platform: 'Win32'`로 고정 — Mac 경로가 생기면 여기도 봐야 한다.
6. **판정 키(§4-b)** — mac 키 생성 규칙을 무엇으로 할지(번들 id `com.google.Chrome` vs 번들 이름).
   그리고 `win:` 조건을 열었을 때 **"다른 기기에서 등록한 거예요" 안내문이 실제로 뜨는지.**
   지금은 정적 확인뿐이라 Mac 빌드가 생겨야 처음 보인다.

---

## 8. 코드 밖의 전제

- **Mac 실기기.** Retina + 비Retina 둘이면 좋다.
  ⚠️ 핸드오프 4에 **"추론으로 원인을 좁히려는 시도가 네 번 연달아 틀렸다"**고 적혀 있다.
  Mac에는 그 실측 기록이 **0건**이다.
- **Apple Developer Program (연 $99) + 공증 파이프라인.** 없으면 유저가 "손상되었습니다"를 보고
  못 연다. 계정·빌드 인프라 문제라 우회로가 없다.

---

## 9. 안 건드린 것

- `preload.js` · `desk-companion-prototype.html` — 이 작업의 범위 밖이다(§1-③).
- ⚠️ **`app.js` 는 건드렸다.** §4-b(판정 키)가 달성 판정·표시를 손댔기 때문이다.
  **§1-③ 의 "렌더러 무수정"은 플랫폼 분리에 걸린 약속이고, 포맷 변경은 그 범위 밖이다.**
  ★ 그래도 **③ 과 같은 커밋에 섞지 말 것** — 섞으면 `sim-google-login.js` 의 채널 검사가
  무엇 때문에 움직였는지 못 가린다. IPC 채널명은 한 글자도 안 바꿨다(필드 하나를 얹었을 뿐).
- `sim-ghost-cache-sync.js` · `sim-google-login.js` · `audit.py` — 대상이 `main.js`에 그대로
  남아 있어 수정이 필요 없었다. **③에서는 필요해진다** — 클릭 통과·고스트 감시가 옮겨가면
  `sim-ghost-cache-sync.js`가 대상을 잃는다. 그때 `huh()` 규약을 나머지에도 퍼뜨릴 것.
  ⚠️ ③ 의 범위를 §4-② 대로 좁히면 클릭 통과는 안 옮겨가므로 이 셋은 계속 무사할 수 있다.
- `package.json` — ③ 에서 `sysinput-win.js` 를 `files` 배열에 **반드시** 넣을 것 (§2 참조).
- `overlay-mac.js` · `sysinput-*.js` — 아직 없다. darwin에서 main.js는 require에서 죽는다.
  **의도된 상태다**(⑥ 이전에는 Mac 코드를 한 줄도 쓰지 않는다).
- 렌더러의 나머지(three.js·UI·Firebase·마이홈·친구)는 플랫폼 무관하다.

---

## 10. 곁다리 — 같이 처리할 것

`release-notes-2026-09.md`의 **2부 A절(검어짐 미검증)과 E절 1·2번**이 낡았다.
§0에서 해법이 확정됐으므로 1부로 올리고 부록에서 지울 것.
문구는 **"갭 확대"가 아니라 "옛 설정값 자동 승격"**이 되어야 한다 — 실제로 제보를 끊은 것이
그쪽이고, 기존 사용자에게 전달되는 의미도 다르다.
