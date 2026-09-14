# 핸드오프 — 플랫폼 분리 ③④⑤ 완료, ⑥ 코드 완료·실측 대기

작성: 2026-09-12 · 갱신 2026-09-14(§3) · **갱신 2026-09-15(§7 — ⑥ 코드)** ·
이전 문서: `handoff-platform-split.md`(5판)
커밋: `2033786` (main) · CI: `mac-probe #2` 초록

> **[2026-09-14] §3 의 다섯 중 셋이 닫혔다.** ① 검사 저장소 커밋 · ② `sim-sysinput` 6절 ·
> ⑤ 미커밋 작업물. **남은 것은 ③(주석 배치 결정)과 ④(`electron@31`)뿐이고 둘 다 ⑥ 을 안 막는다.**
> 각 절 머리의 ✅ 를 볼 것. 이 문서를 진행 상황의 머리로 계속 쓴다.
>
> **[2026-09-15] ⑥ 의 코드가 다 나왔다 — `overlay-mac.js` · `sysinput-mac.js` 신규.**
> **mac 판정 키 규칙도 정해졌다(번들 id).** 남은 것은 **실기기 실측 하나뿐**이고,
> 그 목록과 순서는 **§7** 에 있다. ⑥ 을 이어받는 사람은 §4 가 아니라 **§7 부터** 읽을 것 —
> §4 는 이제 "시작점" 이 아니라 "그때 무엇을 시작점으로 잡았는가" 의 기록이다.

---

## 0. 한 줄 요약

**맥이 붙는다.** §0-② 가 처음부터 걱정하던 "`node-window-manager@2.2.4` 의 `.mm` 이 최신
macOS SDK 에 붙을지 모른다" 는 미지수가 **해소됐다.** 이제 남은 것은 붙은 것을 **실제로 돌리는**
일(⑥)이고, 그건 성격이 다른 작업이다.

---

## 1. 이번 세션에서 끝난 것

### ③ `sysinput-win.js` 분리 (170줄 신규 · `main.js` 2892 → 2867)

훅 설치/해제와 창 열거만 가져갔다. **핸들러 본문은 `main.js` 에 남겼다** — §4-② 경계 그대로다.
`_guardForeignInput` · `offOverlay` 계산 · IPC 전송이 전부 제자리라 클릭 통과 축은 한 글자도
안 건드렸다.

내보내는 것: `init({log})` `startGlobalHooks(handlers)` `stopGlobalHooks()`
`getActiveWindow()` `listWindows()` `selfProcName()` `procNameOf(p)` `WINLIST_SKIP`

★ **`activeWin` 을 `const` 화살표로 바꾸지 말 것.** 원본이 함수 선언이라 호이스팅된다.
바꾸면 정의보다 앞에서 부르는 코드가 생기는 순간 조용히 TDZ 로 죽는다. 이유는 주석에 적어 뒀다.

`PEN_APPS` 는 `main.js` 에 남겼다 — §1-④ 표에는 sysinput 몫으로 적혀 있지만 뒤 결정인
§4-② · §5 가 범위를 "훅 설치/해제와 창 열거만" 으로 좁혔고, 실제 사용처가 폴링 판정부다.

### ④ 네이티브 require try/catch + mac 빌드 골격

두 네이티브 require 를 감쌌다. **이 컨테이너에 네이티브가 없어서 그게 그대로 실기기 노릇을 했고,
감싸기 전에는 require 에서 즉사, 감싼 뒤에는 `getActiveWindow → null` ·
`listWindows → enum-failed` · 훅은 진단 한 줄 남기고 없는 상태로 떨어지는 것까지 실측했다.**

★ **`init()` 에서 로드 실패 로그를 흘리면 안 된다.** `_diagLog` 첫 줄이
`if(!app.isReady()) return;` 이고 `init()` 은 모듈 평가 시점(app 준비 전)에 불린다.
거기서 흘리면 조용히 버려져서 감싼 보람이 없어진다. 그래서 `_flushBootLog()` 를 따로 두고
`startGlobalHooks()` (app 준비 뒤 첫 자리) 에서 한 번만 흘린다.

`package.json`: `build.mac` 추가(dmg+zip, arm64+x64, hardenedRuntime, entitlements),
`files` 에 `sysinput-win.js` · `oauth-config.js` 추가, 죽은 `extract-file-icon` asarUnpack 제거.
`build/entitlements.mac.plist` 신규 — `disable-library-validation` 이 핵심이다(서명 안 된
`.node` 가 막히면 그게 곧 ④ 의 require 실패 경로가 된다).

### 아이콘 한 벌

원본이 64×64 도트 그림이라 **16배가 정확히 떨어진다.** 니어리스트로 늘리면 한 점도 안 뭉갠다.

| 칸 | 그림 | 배율 |
|---|---|---|
| 16 | tw-mini | 28→16 (유일하게 정수배 아님) |
| 32 | tw-mini | 1:1 |
| 64 | tw-mini | 2배 |
| 128·256·512·1024 | tw-icon | 캔버스의 75% (여백) |

맥에서 64 는 "32pt 레티나" 라 **화면에서 차지하는 크기가 윈도우의 32px 과 같다.** 그래서
`main.js` 25–28줄의 윈도우 규칙(16·24·32 → mini)을 픽셀 수가 아니라 **눈에 보이는 크기**
기준으로 옮겨 mini 를 64까지 올렸다.

★ 128 한 칸만 살짝 부드럽다. 75% 여백을 128 에 적용하면 아트가 96px = 1.5배라 정수배가 없다.
도트와 여백 중 여백을 택했다. 바꾸려면 그 칸만 2배(꽉 참)로 하면 된다.

`.icns` 는 손으로 조립했고 되읽어 검증했다(헤더 길이 일치, 10칸 PNG 파싱, Pillow 재열기).
**CI 가 `iconutil` 로 다시 조립해 덮으므로 실기기 검증은 CI 가 대신한다.**

### ⑤ Mac 첫 실측 — **arm64 · x64 양쪽 통과**

`.github/workflows/mac-probe.yml` (수동 실행 전용). 단계를 넷으로 쪼개 **빨간 단계 번호 하나가
곧 진단**이 되게 했다: ① `npm ci` ② 네이티브 로드 ③ `iconutil` ④ `electron-builder`.

```
macOS 26.6.2 / BuildVersion 25G83
Xcode 26.6 (17F113) / SDK 26.5
러너 arm64 / Node 20.20.2 / npm 10.8.2 / Python 3.14.7
3분 17초 · Together Working-0.9.5-{arm64,x64}.{dmg,zip} 4개 산출
```

★ **지금 나와 있는 가장 최신 SDK 에서 붙었다.** 그리고 arm64 러너에서 x64 도 나왔으므로
**러너를 아키텍처별로 나눌 필요가 없다.**

서명은 껐다(`CSC_IDENTITY_AUTO_DISCOVERY: false`). 나온 dmg 를 맥에서 열면
**"손상되었습니다" 가 뜨는 것이 정상이다** — §8 의 일이고, 여기서는 붙는지만 봤다.

### OAuth 값 분리 (계획에 없던 일 — 푸시가 막혀서)

GitHub 푸시 보호가 `main.js:1516–1517` 을 막았다. 저장소가 **공개**라 값을 뺐다.
`oauth-config.js`(gitignore) 로 옮기고 `main.js` 는 없으면 빈 값으로 떨어진다.

`sim-google-login.js` 194줄이 이미 "설정되지 않았어요" 안내 경로를 검사하고 있어서
**비워도 검사는 초록이고 앱도 안내를 띄운다.** `package.json build.files` 에 넣었으므로
**내 컴퓨터에서 만든 윈도우 설치본에는 값이 들어가고, CI 설치본에는 안 들어간다**(로그인만 안 됨).

---

## 2. 검사 현황 (분리 후)

| 검사 | 결과 | 비고 |
|---|---|---|
| `sim-sysinput.js` | 58 · 1 | ★ 실패 1은 **분리 전에도 똑같이 실패**. 아래 3-② |
| `sim-ghost-cache-sync.js` | 36 · 0 | |
| `sim-google-login.js` | 전부 통과 | |
| `smoke.js` | 통과 | |
| `sim-overlay-gap.js` | 20 · 7 · 4 | ★ 검사 판본이 낡음. 아래 3-① |
| `sim-overlay-layered.js` | 24 · 5 · 4 | ★ 같음 |
| `audit.py` | exit 1 | 분리 전후 **출력 동일** |

★ ③④ 의 근거는 "전부 초록" 이 아니라 **"분리 전후 출력이 동일하다"** 이다. 위 인접 검사
여섯 개를 분리 전 `main.js` 와 분리 후 `main.js` 로 각각 돌려 **바이트 단위로 같음**을 확인했다.

---

## 3. 넘기는 문제 — 먼저 처리할 것부터

### ① ✅ 검사 파일이 저장소에 없다 — **닫혔다 (2026-09-14)**

> **[닫음]** `checks/` 를 커밋했다. 고친 판 13개(`audit.py` · `smoke.js` · `sim-overlay-gap` ·
> `sim-overlay-layered` · `sim-purikura-deco` · `sim-purikura-stage` · `sim-chat-log-persist` ·
> `sim-slot-fit` · `sim-mh-sanitize` · `sim-part-color-entry` · `sim-seat-opacity` · `run.js` ·
> `CHECKS.md`)가 전부 미커밋이었다 — **HEAD 에 있던 것은 전부 낡은 판이었다.**
> 신규 둘(`sim-keysof-twin.js` · `tools/trapscan.js`)도 같이 올렸다.
>
> ```
> npm run check
> 정본 대조   54개 전부 일치
> 검사 54개 · 초록 53 · 빨강 0 · 원본없음 1 · 건너뜀 0
> 원본없음:   togetherland-ui-mockup.html  ← 투게더빌리지 보류분(CHECKS.md §11)
> ```
>
> ⇒ **어느 초록도 이제 근거로 쓸 수 있다.** 판을 가리는 자리는 `checks/CHECKS.md` §3 이고,
> `run.js` 가 돌기 전에 해시를 맞대 안 맞으면 「위 초록은 근거로 못 쓴다」를 찍는다.
>
> ★ **형제 문제도 같이 닫았다 — 핸드오프 문서 자체가 버전 관리 밖이었다.**
> `git ls-files *.md` 가 `README.md` 와 `checks/CHECKS.md` **둘뿐**이었다.
> `handoff-mac.md` 가 「정본은 `handoff-platform-split.md` 다(저장소에 있다)」라고 적었는데
> 없었다. 그래서 09-14 세션이 이 문서를 못 찾고 ③④⑤ 가 끝난 걸 모른 채
> **「다음은 ⑤」라는 틀린 지도**를 만들었다. 그 문서는 폐기했다.
> ⇒ 이 문서 · `handoff-platform-split.md`(5판) · `handoff-overlay-video-blackout-4.md` 를 커밋했다.
> `release-notes-2026-09.md` 는 릴리즈 산출물이라 손볼 때, `togetherland-handoff-4-full.md` 는
> 투게더빌리지 보류분이라 보류가 풀릴 때 넣는다.

<details><summary>닫히기 전 기록</summary>


`sim-*.js` 도 `audit.py` 도 **저장소에도 작업 폴더에도 없다.** Claude 프로젝트에 붙인 사본만
있다. 이 프로젝트의 규율 전체가 그 파일들에 얹혀 있는데 **어느 판이 진짜인지 가려 주는 자리가
없다.** 실제로 이번에 세 번 걸렸다:

- `sim-sysinput.js` — 받은 것은 **§4-b 이전 판**(49·1). 핸드오프가 말한 65·0 짜리가 아니다.
- `sim-overlay-gap.js` · `sim-overlay-layered.js` — **① 이전 판**. `overlay-win.js` 를 줘도
  "갭 상수를 `main.js` 에서 못 찾음" 으로 빨갛다. §2 가 말한 47·0 / 43·0 짜리가 아니다.

→ **⑥ 전에 검사 파일들을 저장소에 커밋할 것.** 그 전까지는 어떤 초록도 근거로 못 쓴다.

</details>

### ② ✅ `sim-sysinput.js` 6절이 낡았다 — **닫혔다**

> **[닫음]** 6절을 `keysOf` 대조로 갈아 **60 · 0** 이 됐다(`CHECKS.md` §4-①).
> 덤으로 「`.name`/`.key` 직접 비교가 없다」 항목이 생겨 §5 의 금지 하나를 검사가 처음 지킨다.
>
> ⚠️ **그러나 §4-b 가 말한 「두 벌 대조」는 6절에 없었다.** `sim-sysinput.js` 에는 `app.js` 라는
> 문자열이 **0건**이다 — `app.js` 를 옆에 두든 치우든 60·0 으로 똑같다. 6절은 `main.js` 쪽만 본다.
> §4-b 가 «제일 부서지기 쉽다»고 지목한 자리를 **지키는 것이 하나도 없었다.**
> ⇒ `sim-keysof-twin.js` 를 새로 만들어 메웠다(30·0 · `--selftest` 변이 9종 전부 잡힘).
> 상세는 `CHECKS.md` §14, 정정은 `handoff-platform-split.md` §4-b.


받은 판의 6절은 `f.name === exeName` (§4-b 이전 포맷)을 본다. `main.js` 는 이미 `keysOf`
한 통로로 갔으므로 **이 한 항목만 빨갛고, 분리 전에도 똑같이 빨갰다.** ③ 이 만든 빨강이 아니다.
핸드오프가 말한 새 판(6절이 `keysOf` 대조)으로 갈면 해소된다.

### ③ `start()` 근거 주석이 호출부에 남아 있다

try/catch 는 `sysinput-win.js` 로 갔는데 "백신·VC++·asarUnpack" 근거 주석은 `main.js`
호출부에 두었다. `sim-sysinput.js` 5절이 그 키워드를 **`main.js` 원문에서만** 찾기 때문이다.
검사가 파일을 잘못 보고 있는 쪽에 가깝고, §3 에서 겪은 것과 같은 종류다.
→ 검사를 고쳐 주석을 모듈로 보낼지, 지금 배치를 유지할지 **결정 필요.**
★ [2026-09-14] **지금 배치로 초록이다**(5절 통과). 급하지 않지만, 검사가 배치를 결정하고
  있는 상태라는 점은 그대로다.

### ④ `electron@31` 이 지원 종료 ★ 크다

`devDependencies` 에 있지만 실제로는 **앱과 함께 나가는 런타임**이다. "빌드 도구라 설치본엔
안 들어간다" 로 넘길 수 있는 항목이 아니다. `npm audit` 에 30여 건이 떠 있고 31 은 지원이 끝났다.
31 → 44 는 그것만으로 한 세션이 필요한 크기다. **⑦ 이후 별건으로.**

`npm audit fix`(--force 없이)는 이미 돌렸다 — `js-yaml` · `protobufjs` 2건이 정리되어
`npm audit --omit=dev` 가 **0건**이다. `dependencies` 와 `package.json` 은 안 바뀌었고,
바뀐 락으로 mac-probe #2 를 다시 돌려 초록을 확인했다.

★ **`npm audit fix --force` 는 누르지 말 것.** `electron` · `electron-builder` 를 메이저로
갈아 끼워서 방금 확보한 "맥에서 붙는 조합" 이 깨진다.

### ⑤ ✅ 미커밋 작업물 — **닫혔다 (2026-09-14)**

> **[닫음]** 네 커밋으로 정리했다.
> ① `.gitignore` 에 `app/parts/firebase-config.js` · `디자인/` · `*.tgz` · `checks.zip` 추가 +
>    `git rm --cached app/firebase-config.js`
> ② `app/` · `preload.js` · `firebase-database-rules.json` (57 files)
> ③ `checks/` ← 이것이 §3-①
> ④ 핸드오프 문서 셋
>
> ★ **푸시 차단은 안 났다** — 커밋 1 이 `firebase-config.js` 를 먼저 막았다.
> ⚠️ 다만 **`app/firebase-config.js` 는 이미 히스토리에 있다**(`D` 로 떴다 = 추적되던 파일).
> 저장소가 공개라, 서비스 계정 키가 들어 있었다면 gitignore 로는 못 지운다 — 콘솔에서 폐기할 것.
> ⚠️ `.gitattributes` 의 `checks/** -text` 가 실제로 일하는 것을 확인했다 — 커밋 2 에서
> CRLF 경고가 16줄 떴는데 `checks/` 파일은 **한 줄도 없었다.** 이게 빠지면 다음 클론에서
> §3 해시 54개가 전부 어긋난다.
> ★ `app/fx-preview.html` · `app/parts/mys-test.html` 이 `build.files` 의 `app/**/*` 로
> **설치본에 실린다.** 지금 막을 일은 아니고 ⑦ 이후 정리 목록.

<details><summary>닫히기 전 기록</summary>


`preload.js` 수정됨, `app/` 아래 다수 미추적(`app/assets/` 포함 — `APP_ICON` 이 그 안을 본다),
`디자인/`, tgz 찌꺼기 2개. ⑥ 전에 정리할 것.

★ `app/parts/firebase-config.js` 를 올릴 때 **OAuth 때와 같은 푸시 차단**이 난다. 같은 방식
(별도 파일 + gitignore + `build.files`)으로 빼면 된다.

</details>

---

## 4. ⑥ 맥 런타임 — 시작점

여기서부터가 다음 세션의 본 작업이다. ~~⑥ 전에 3-① 을 먼저 해결할 것.~~
★ **[2026-09-14] 3-① 은 닫혔다. ⑥ 을 막는 것은 이제 코드 밖 전제 둘뿐이다:**
**Mac 실기기**와 **Apple Developer Program(연 $99) + 공증**. 없으면 나온 dmg 가
「손상되었습니다」로 안 열린다 — `handoff-platform-split.md` §8.
남은 3-③(주석 배치)·3-④(`electron@31`)은 ⑥ 을 안 막는다.

1. **`sysinput-mac.js`** — `sysinput-win.js` 와 **똑같은 이름**을 내보내야 한다.
   `procNameOf` 와 `WINLIST_SKIP` 이 `main.js` 가 아니라 모듈에 사는 이유가 이것이다.
   mac 은 이름 규칙부터 다르다(확장자 없음, 공백 들어감 — §4-b).
2. **`overlay-mac.js`** — `main.js` 의 darwin 갈래가 지금 이걸 찾는다. 없으면 require 에서 죽고,
   그건 **의도된 상태다.**
3. **권한** — 접근성·화면 기록은 entitlement 로 못 연다. TCC 대화상자라 실행 중에 사용자가
   허용해야 하고, **거부했을 때의 동작은 실기기에서만 볼 수 있다**(§7-2).
   `listWindows` 가 `enum-failed` 를 돌려주는 경로를 살려 둔 것이 그때를 위한 것이다.
4. **`APP_ICON` 이 `.ico`** — 맥에서 `BrowserWindow` 아이콘은 무시되지만 확인은 필요하다.

`main.js` 의 mac 갈래는 이미 두 줄 다 있다(`overlay-mac` · `sysinput-mac`). 파일만 만들면 된다.

---

## 5. 손대면 안 되는 것 (이전 문서에서 계속 유효)

- `uIOhook.on('mousemove')` 부활 금지 — `activeWin()` 이 다시 null 만 뱉는다.
- `session-end` 의 훅 해제 — 빠지면 종료 시 `0x80000003`.
- 세션 종료는 `app.quit()` 아니라 `app.exit(0)`.
- `WINLIST_SKIP` 의 `explorer.exe` — "게임만 등록이 안 된다" 제보의 그 창.
- 등록 판정은 `keysOf` 한 통로로만. `.key` `.name` 직접 비교 금지.
- 클릭 통과(`setIgnoreMouseEvents`)는 uIOhook 커서 폴링과 한 몸 — 모듈로 쪼개지 말 것.

---

## 6. 새 세션을 여는 법 (2026-09-14 신설)

★ 이 표는 원래 `handoff-mac.md` §7 에 있었다. **그 문서는 폐기됐다**(§3-① 참조) —
틀린 지도였고, 그러면서 이 표까지 같이 사라졌다. 여기가 그 자리다.

### ① 먼저 정할 것 — 갈래가 여기서 갈린다

**Mac 실기기와 Apple Developer Program(연 $99)이 있는가?**

| | 다음 |
|---|---|
| **둘 다 있다** | **⑥ 맥 런타임.** §4 가 시작점이다 |
| 없거나 아직이다 | ⑥ 은 못 연다. 아래 셋 중 하나 |

⑥ 을 못 열 때 갈 수 있는 곳:

- **⑦ `electron@31 → 44`** — 하드웨어 불필요. 그것만으로 한 세션 크기다.
  ★ `npm audit fix --force` 는 누르지 말 것(§3-④).
- **`release-notes-2026-09.md` 정리** — 문구가 「갭 확대」가 아니라 **「옛 설정값 자동 승격」**이
  되어야 한다. `handoff-overlay-video-blackout-4.md` 의 「닫음」 절을 **먼저** 읽을 것 —
  실제로 제보를 끊은 것은 레이어드 알파였다.
- **⑥ 설계만** — mac 판정 키 생성 규칙을 무엇으로 할지(번들 id `com.google.Chrome` vs
  번들 이름). 코드 없이 결정만 가능하다. 근거는 `handoff-platform-split.md` §4-b.

### ② 올릴 것

| 하려는 것 | 올릴 것 |
|---|---|
| **⑥ (실기기 있음)** | 이 파일 · `handoff-platform-split.md` · `main.js` · `overlay-win.js` · `sysinput-win.js` · `checks/sim-sysinput.js` · `handoff-overlay-video-blackout-4.md` |
| ⑥ 설계만 | 이 파일 · `handoff-platform-split.md`(§4-b) |
| ⑦ electron 갱신 | 이 파일 · `package.json` · `package-lock.json` |
| 릴리즈노트 | 이 파일 · `release-notes-2026-09.md` · `handoff-overlay-video-blackout-4.md` |
| 검사 쪽 | `checks/CHECKS.md` + 대상 검사 파일 |

★ **전부 저장소에 있다.** 2026-09-14 커밋으로 핸드오프·검사가 전부 버전 관리 안에 들어왔다 —
Claude 프로젝트 사본이 아니라 **저장소에서 꺼낸 것**을 올릴 것. 그게 §3-① 의 요점이다.

### ③ 이 세션이 남긴 함정 — 같은 데서 또 걸리지 말 것

- **판본.** 같은 이름의 검사가 여러 판으로 돌아다녔다. 판을 가리는 자리는 `checks/CHECKS.md` §3
  해시 표 하나뿐이다. `npm run check` 가 돌기 전에 대조하고, 안 맞으면 「위 초록은 근거로 못 쓴다」를
  찍는다. ⚠️ **`findstr` 로 확인하지 말 것** — 주석이 전부 한글이라 콘솔에서 깨지고 첫 줄에서 끊긴다.
  `certutil -hashfile <파일> SHA256` 을 쓸 것.
- **경로.** `app.js` 는 루트가 아니라 **`app/parts/app.js`** 다. 검사들은 평평한 폴더를 가정하므로
  `checks/run.js` 가 임시 폴더에 한 층으로 모아 돌린다. 2번째 바퀴(`mallang.js`·`purikura-net.js`·
  `firebase-init.js` 를 깊은 자리에서 끌어올림)는 임시방편이 아니라 **상시 필요한 단계**다.
- **문서.** 「정본은 저쪽이다」라고 적힌 문서가 가리키는 파일이 실제로 없던 것이 이 모든 일의 시작이었다.
  ⇒ **문서를 새로 만들기 전에 이 파일에 한 절을 더할 수 없는지 먼저 볼 것.**

### ④ 찾지 말 것 (헛품이다)

- `handoff-mac.md` — **폐기했다.** 내용은 이 파일과 `handoff-platform-split.md` 에 다 있다.
- `handoff-mac-runtime.md` 를 「못 찾겠다」 — 저장소 루트에 있다. 이 파일이다.
- `sim-sysinput.js` 의 **「65·0 판」** — `CHECKS.md` §3 이 확인했다. **실물이 나온 적 없다.**
  지금 정본은 60·0 이다.
- `sim-char-sheet.js` · `sim-char-slots.js` · `sim-house-layout.js` · `sim-report-gate.js` —
  투게더랜드 핸드오프가 언급하지만 어디에도 없다. **보류 해제 때 같이 본다**(`CHECKS.md` §11).
- `togetherland-ui-mockup.html` — 유일한 「원본없음 1」이지만 **메울 구멍이 아니다.** 보류분이다.

---

## 7. ⑥ 맥 런타임 — 코드 완료 (2026-09-15)

> **여기가 지금의 머리다.** §4 는 시작점이었고, 이 절이 그 결과다.
> 남은 것은 **실기기 실측뿐**이다(§7-5). 코드로 더 할 수 있는 일은 §7-6 의 둘밖에 없다.

### ① ★ mac 판정 키 규칙 — **번들 id 로 확정** (§4-b 의 마지막 미정)

`platform-split.md` §4-b 가 «mac 키 생성 규칙 자체가 실측 0건이라 지금 정할 수 없다» 며
넘긴 자리다. 실측 없이 **경로 문자열만으로 갈렸다.**

| | A 실행파일 basename | B `.app` 번들 이름 | **C 번들 id ← 채택** |
|---|---|---|---|
| Google Chrome | `google chrome` | `google chrome` | `com.google.chrome` |
| **VS Code** | **`electron`** ⚠️ | `visual studio code` | `com.microsoft.vscode` |
| 사용자가 `.app` 이름 변경 | 안 흔들림 | **키가 깨짐** | 안 흔들림 |
| I/O | 없음 | 없음 | `Info.plist` 읽기 (캐시) |

★ **A 는 실측 없이 탈락한다.** macOS 에서 일렉트론으로 만든 앱은 실행 파일 이름이 죄다
`Electron` 이다(`/Applications/Visual Studio Code.app/Contents/MacOS/Electron`).
basename 규칙은 **서로 다른 앱 여러 개를 한 키로 뭉친다.** 우리 앱도 개발 실행 때 같은 이름이다.

★ **B 대신 C 인 결정적 근거는 저장 위치다.** `chalRec.cfg` 는 Firebase 로 동기화되어
**계정을 따라다니고 회수가 안 된다**(§4-b 표). B 는 사용자가 `.app` 이름을 한 번 바꾸면 그 계정의
달성 기록이 조용히 안 맞게 된다 — §4-b 가 없애려던 증상과 **같은 모양**이다.
⇒ 되돌릴 수 없는 저장물에는 흔들리지 않는 축을 쓴다.

⚠️ **C 가 실패했을 때의 대체값은 B 다**(`Info.plist` 를 못 읽는 경우). 이건 **다른 모양의 키**라,
같은 앱이 실행마다 C 와 B 를 오가면 등록이 조용히 풀린다.
⇒ 대체로 떨어질 때마다 `[입력] 번들 id 를 못 읽어 이름으로 대체 — …` 를 로그에 남긴다.
**그 줄이 한 번이라도 뜨면 그 앱은 C 가 아니다.** §7-5 의 확인 항목이다.

### ② ★ 판정명과 표시명이 갈라졌다 — `displayNameOf` 신설

Windows 에서는 판정축과 표시명이 **우연히 같은 문자열**이었다(`chrome.exe`). 그래서 지금까지
한 값이 두 일을 했다. mac 에서 갈라진다:

```
procNameOf(p)    → 'com.google.chrome'   ← 판정축. focusKeyOf 가 받는다
displayNameOf(p) → 'Google Chrome'       ← 표시용. 설정 슬롯·달성표가 보여준다
```

⚠️ **`sysinput-win.js` 에도 `displayNameOf` 를 넣었다**(값은 `procNameOf` 와 동일).
§1-④ 의 «똑같은 이름을 내보내야 한다» 때문이다. **Windows 동작은 한 글자도 안 바뀐다** —
이 줄의 목적은 기능이 아니라 인터페이스를 맞추는 것이다.

### ③ ★ 부산물 — `main.js` 가 `procNameOf` 를 한 번도 안 부르고 있었다

③ 이 이름 규칙을 모듈로 옮기면서 근거를 이렇게 적어 뒀다:
«`procNameOf` 와 `WINLIST_SKIP` 이 main.js 가 아니라 여기에 사는 이유가 이것이다».
**그런데 `main.js` 는 그 함수를 부르지 않았다.** 같은 규칙이 인라인으로 네 곳에 박혀 있었다:

```
780   폴링 판정부        path.basename(w.owner.path || w.owner.name || '').toLowerCase()
1728  blur 후 활성창 갱신  (동일)
2357  등록 fallback 재시도 (동일)
2370  등록 실패 진단 문구  (동일)
```

⇒ **규칙은 모듈에 있고 판정은 옛 자리에서 돌았다.** 모듈에 무엇을 적어도 mac 판정에 닿지 않는
상태였고, 어떤 검사도 이걸 안 봤다(`sim-sysinput.js` 3절은 모델로만 재현한다).
⑥ 에서 네 자리를 전부 `sysinput.procNameOf` 로 갈았다.

★ **`sim-overlay-gap.js` 가 헛돌던 것과 같은 종류다**(`platform-split.md` §3).
「옮겼다」고 적혀 있는데 **호출부가 안 따라온** 경우다. 다른 이사에도 같은 관점으로 한 번 볼 것.

### ④ `setFocusApp` 의 키 생성도 같이 고쳤다 — 안 고치면 조용히 어긋난다

옛 줄은 `key: focusKeyOf(appInfo.name)` 였다. `name` 이 이제 표시명이라, **목록에서 고른 슬롯만**
`mac:google chrome` 이 되어 폴링이 만드는 `mac:com.google.chrome` 과 **영영 안 맞는다.**
에러는 없고 집중 시간만 0 으로 쌓인다 — §4-b 가 없애려던 증상 그대로다.
⇒ 목록 항목이 들고 온 **경로**에서 판정축을 다시 만든다.

⚠️ `listWindows` 항목이 `key` 도 실어 보내지만 **판정에 그 필드를 믿지 않는다.**
렌더러를 거쳐 온 값을 판정축으로 쓰면, 옛 렌더러가 필드를 떨어뜨렸을 때 조용히 빈 키가 된다.
⇒ **렌더러는 한 글자도 안 고쳤다**(§1-③ 그대로).

### ⑤ 나온 파일과 값

| 파일 | 내용 |
|---|---|
| `overlay-mac.js` 신규 | 갭 **0 에서 시작** · `GAP_LEGACY` **빈 배열**(mac 에 "옛 기본값" 이 없다 → 승격 경로를 아예 안 탄다) · `GAP_VER` 1 · 레이어드 알파 **빈 통로**(`LAYERED_ALPHA_ON` 0) |
| `sysinput-mac.js` 신규 | 번들 id 판정 · `.app` 경로별 캐시(성공·실패 둘 다) · `WINLIST_SKIP` 13개 재작성 · 접근성 권한 요청 · 화면 기록 권한 거부 갈래 |
| `main.js` 수정 | 인라인 basename 4자리 + `setFocusApp` 키 생성 |
| `sysinput-win.js` 수정 | `displayNameOf` 추가(동작 변경 0) |

⚠️ **`overlay-mac.js` 의 0 은 "괜찮다고 확인된 값" 이 아니라 "아직 아무것도 측정하지 않았다"** 는
뜻이다. Windows 의 12 는 크로미움의 가려짐 판정에서 나온 값이고 macOS 는 `NSWindowOcclusionState`
로 다른 판정을 쓴다. mac 에는 검어짐 실측이 **0건**이다 — 증상이 있는지도 모르는 채로 화면 맨 아래
띠를 잘라내면 **대가만 먼저 치른다.** 설정 파일의 `overlayBottomGap` 통로는 살려 뒀다.

⚠️ **레이어드 토글은 mac 에서 안 켜진다**(눌러도 꺼짐으로 돌아온다). 고장이 아니다 —
`WS_EX_LAYERED` + `LWA_ALPHA` 는 Win32 고유고 macOS 에 그 예외 목록이 없다.
켜진 것처럼 보여 주면 나중에 «실험을 켜 봤는데 안 낫더라» 가 근거로 쓰인다.
그건 갈래를 지우는 게 아니라 **가짜 갈래를 만드는 것**이다.

### ⑥ 검증 — 근거는 「초록」이 아니라 **「전후 동일」**

기준선을 먼저 뜨고(`sim-sysinput.js` SHA256 `03256a7a…` = `CHECKS.md` §4-① 정본, 60·0) 맞댔다.

| 검사 | 전 | 후 |
|---|---|---|
| `sim-sysinput.js` | 60 · 0 · 0 | 60 · 0 · 0 — **출력 바이트 단위 동일** |
| `sim-overlay-gap.js` | 50 · 0 · 0 · 1 | 동일 |
| `sim-overlay-layered.js` | 39 · 0 · 0 · 3 | 동일 |
| `audit.py` | — | 출력 동일 |
| `trapscan.js tokens` | 코드꼴 68 / 8 | 코드꼴 68 / 8 — 주석함정 증가 0 |

★ `overlay-mac.js` · `sysinput-mac.js` 를 같은 폴더에 둬도 세 검사 결과가 그대로다 —
**어느 검사도 mac 파일을 읽지 않는다.** 단계 판정이 전부 `*-win.js` 이름에 걸려 있기 때문이다.
⇒ **mac 파일에는 지금 지켜 주는 것이 하나도 없다.** 실측이 끝나면 검사를 하나 붙일 것(§7-6).

### ⑦ ⚠️ 반드시 같이 할 것 — `package.json`

**`files` 배열에 `overlay-mac.js` · `sysinput-mac.js` 둘 다 추가.**
빠지면 **개발에선 멀쩡하고 mac 설치본만 부팅 때 죽는다**(`platform-split.md` §2).
⑥ 시점에는 이 파일이 안 올라와 있어 반영하지 못했다. **빌드 전에 이것부터 확인할 것.**

---

## 7-5. 실기기 확인 — 순서가 뜻을 가진다

> ⚠️ **[2026-09-15] 이 절은 아직 한 줄도 실행되지 않았다. 실기기가 없다.**
> §6-① 의 갈래에서 「없거나 아직이다」쪽이다. ⑥ 의 코드가 다 나온 것과 **⑥ 이 닫힌 것은
> 다르다** — 이 절이 비어 있는 한 mac 은 «붙는다» 까지만 확인된 상태다(§0).
> ★ 이 표를 **진행 상황으로 읽지 말 것.** `platform-split.md` 머리의 경고와 같은 종류다.
>
> **하드웨어 없이 여기까지는 갈 수 있다 — GitHub Actions `macos-latest` 러너다**(§0-②).
> 러너는 진짜 macOS 라, 사람이 없어도 되는 항목은 CI 로 닫을 수 있다:
> - ★ **4번(판정축)의 핵심** — 러너에 실제로 깔린 `.app` 들(Safari·Xcode 등)에 `procNameOf` 를
>   대 보면 **바이너리 `Info.plist` 읽기와 `plutil` 경로가 진짜 번들에서 도는지**가 갈린다.
>   §7-① 의 C 가 실측 0건인 이유가 이거였고, 이건 사람 없이 없앨 수 있는 미지수다.
> - 1번의 절반(모듈이 실제로 로드되는가) · `displayNameOf` 두 모듈 일치 · `selfProcName`
>
> **끝까지 CI 로 못 가는 것** — 전부 TCC 대화상자나 사람 눈이 필요하다:
> 2번(클릭 통과) · 3번(권한 승인/거부) · 5번(화면 기록 거부 갈래) · 6·7번(등록·안내문) ·
> 8번(Retina·Spaces). ★ **그중 2번이 제일 비싸다** — 답이 나쁘면 설계를 다시 해야 하는데,
> 그 답은 **하드웨어를 구하기 전까지 절대 안 나온다.** ⑥ 을 「거의 다 됐다」로 취급하지 말 것.


★ **순서의 원칙: 제일 비싼 미지수를 제일 먼저 죽인다.** ②·③ 은 답이 나쁘면 설계를 다시 해야 해서
뒤에 두면 그 뒤 작업이 통째로 헛일이 된다.

로그 자리: `~/Library/Application Support/Together Working/tw-mouse-diag.log` (직전 분량은 `.1`)

| # | 볼 것 | 초록의 모양 | 빨강이면 |
|---|---|---|---|
| 0 | `package.json` `files` 에 mac 모듈 둘 | — | 빌드해도 설치본만 죽는다(§7-⑦) |
| 1 | 첫 부팅 로그 두 줄 | `[화면] 디스플레이 N개…` · `[오버레이] 부팅 … (갭 갈래 꺼짐 — mac 기본값)` | 줄이 없으면 mac 갈래가 안 실렸다. `레이어드 n/a(win32 아님)` 이 뜨면 **win 모듈이 실린 것** |
| 2 | **§7-1 클릭 통과** `setIgnoreMouseEvents(ignore,{forward:true})` | 캐릭터에 커서를 얹으면 잡히고, 밖에서는 아래 창이 클릭을 받는다 | **2초 얹기 통로를 새로 설계해야 한다.** 여기서 갈리면 ③ 이후는 의미가 줄어든다 |
| 3 | 접근성 권한 대화상자 | 부팅 때 한 번 뜬다 | 안 뜨면 `requestAccessibility` 가 안 불린 것. **거부했을 때의 동작도 반드시 볼 것**(이게 §7-2 가 예고한 미지수다) |
| 4 | 활성 창 판정축 | 다른 앱을 쓰다 등록하면 슬롯 `key` 가 `mac:com.…` | `[입력] 번들 id 를 못 읽어 이름으로 대체` 가 **한 줄이라도 뜨면** 그 앱은 C 가 아니라 B 다(§7-①) |
| 5 | 창 목록 + **화면 기록 권한 거부** | 거부 상태에서 「창 N개가 모두 제목이 비어 있다」로 `enum-failed` | 조용한 빈 목록이 나오면 그 갈래가 안 선 것(§7-2 의 바로 그 증상) |
| 6 | 등록 → 집중 시간 누적 | **자동 등록·목록 등록 둘 다** 해 볼 것. 두 경로가 다른 키를 만들면 여기서 갈린다 | 시간이 0 으로 쌓이면 §7-④ 를 먼저 볼 것 |
| 7 | `win:` 조건 안내문 | Windows 에서 건 달성 조건을 mac 에서 열면 **「다른 기기에서 등록한 거예요」** | §4-b 가 «Mac 빌드가 생겨야 처음 보인다» 고 남긴 마지막 미확인 항목이다 |
| 8 | Retina·Spaces | 배율 2 에서 좌표·갭 산수 · 전체화면 위에 오버레이가 뜨는가 | 갭은 지금 0 이라 산수가 안 돈다 — `overlayBottomGap` 에 값을 넣어 한 번 돌려 볼 것 |

⚠️ **서명이 없으면 dmg 가 「손상되었습니다」로 안 열린다**(§8). 확인용으로만 여는 길은
`xattr -dr com.apple.quarantine <경로>` 다. **배포에는 못 쓴다** — 그건 공증 파이프라인의 일이다.

⚠️ **4·6·7 은 저장물을 만든다.** 키 규칙이 틀린 채로 등록하면 `focus-apps.json` 은 지우면 되지만
**달성 조건은 Firebase 로 계정을 따라간다**(§4-b). 4 에서 `[입력] … 대체` 로그를 먼저 확인하고
6·7 로 갈 것.

## 7-6. 코드로 아직 할 수 있는 둘

- **mac 모듈을 지키는 검사** — §7-⑥ 대로 지금은 하나도 없다.
  ★ **[2026-09-15] 절반 메웠다 — `checks/tools/mac-bundleid-probe.js` 신규.**
    `mac-probe.yml` 에서 돌려 §7-5 의 **4번(판정축)을 사람 없이 닫는다.** 러너에 실제로 깔린
    `.app` 수십 개에 `procNameOf` 를 대고, 오라클로 `/usr/bin/defaults` 를 쓴다
    (검증에 또 `plutil` 을 쓰면 같은 도구로 같은 답을 확인하는 셈이라 아무것도 증명 못 한다).
    ⚠️ **2절이 이 도구의 안전장치다** — 표본이 전부 XML plist 였다면 `plutil` 분기는 한 번도
      안 돈 채로 1절이 초록이 된다. 바이너리가 표본에 있었는지를 같이 센다.
    ⚠️ 6·7절은 **OS 무관**이라 리눅스/윈도우에서도 돈다(합성 표본 · 내보내기 이름 대조).
      맥이 없는 동안 mac 모듈의 회귀를 잡아 주는 유일한 자리다. 변이 4종(바깥 번들 선택·
      표시명 소문자화·낙하 로그 제거·`displayNameOf` 미내보내기)을 주입해 전부 잡히는 것을 확인했다.
    ⚠️ 맥 밖에서는 종료 코드 **2**(검사못함)다. `checks/` 바로 밑에 두면 빨강이 영구히 박힌다 —
      `trapscan.js` 와 같은 사정이라 `checks/tools/` 다. 해시는 §3 표 아래 **도구 칸**에 적을 것.
    ★ **이 도구가 초록이어도 ⑥ 은 안 닫힌다.** 2·3·5·6·7·8번은 사람이 필요하다(§7-5).
- **`PEN_APPS` mac 판** — `main.js` 에 Windows exe 이름으로 남아 있어 mac 에서는 한 번도 안 맞는다.
  §1-④ 가 「재작성」으로 잡아 둔 별건이고, 어떤 앱을 넣을지가 실측 영역이라 ⑥ 에서 손대지 않았다.
  ★ 이제 키가 번들 id 이므로 **목록도 번들 id 로 써야 한다**(`com.celsys.clipstudiopaint` 등).
