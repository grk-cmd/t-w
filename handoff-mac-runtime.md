# 핸드오프 — 플랫폼 분리 ③④⑤ 완료, ⑥부터 이어감

작성: 2026-09-12 · **갱신 2026-09-14(§3 진행 상황)** · 이전 문서: `handoff-platform-split.md`(5판)
커밋: `2033786` (main) · CI: `mac-probe #2` 초록

> **[2026-09-14] §3 의 다섯 중 셋이 닫혔다.** ① 검사 저장소 커밋 · ② `sim-sysinput` 6절 ·
> ⑤ 미커밋 작업물. **남은 것은 ③(주석 배치 결정)과 ④(`electron@31`)뿐이고 둘 다 ⑥ 을 안 막는다.**
> 각 절 머리의 ✅ 를 볼 것. 이 문서를 진행 상황의 머리로 계속 쓴다.

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
