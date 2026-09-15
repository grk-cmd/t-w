# 핸드오프 — 플랫폼 분리 ③④⑤⑦ 완료, ⑥ 코드 완료·실측 대기

작성: 2026-09-12 · 갱신 2026-09-14(§3) · 갱신 2026-09-15(§7 — ⑥ 코드) · **갱신 2026-09-15(§8 — ⑦ electron 44)** ·
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
>
> **[2026-09-15] ⑦ `electron@31 → 44` 감사가 끝났다 — §8.** `main.js` 가 부르는 Electron API 를 전수로
> 32~44 의 깨짐 목록에 맞댔고 **코드 수정이 필요한 자리가 0곳**이다. 바뀐 파일은 `package.json` 한 줄과
> `mac-probe.yml` 뿐이다. ⚠️ **`package-lock.json` 은 아직 31 이다** — 이 세션은 오프라인이라 락을 못 만들었다.
> 순서는 §8-④. 그걸 건너뛰고 mac-probe 를 돌리면 ②-b 가 일부러 빨갛게 선다.
> ★ **[같은 날 저녁] ⑦ 닫혔다 — mac-probe #4 세 잡 초록**(`electron@44.3.0` · electron-builder 24 그대로 · arm64·x64 dmg/zip 나옴). §8 머리.
> **[2회차]** `preload.js`·`app.js`·`firebase-init.js` 까지 봤다 — 렌더러 갈래도 0곳. §8-⑥ 의 앞 둘이 닫혔다.

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

### ④ ✅ `electron@31` 이 지원 종료 — **닫혔다 (2026-09-15, §8)**

`devDependencies` 에 있지만 실제로는 **앱과 함께 나가는 런타임**이다. "빌드 도구라 설치본엔
안 들어간다" 로 넘길 수 있는 항목이 아니다. `npm audit` 에 30여 건이 떠 있고 31 은 지원이 끝났다.
31 → 44 는 그것만으로 한 세션이 필요한 크기다. **⑦ 이후 별건으로.**

`npm audit fix`(--force 없이)는 이미 돌렸다 — `js-yaml` · `protobufjs` 2건이 정리되어
`npm audit --omit=dev` 가 **0건**이다. `dependencies` 와 `package.json` 은 안 바뀌었고,
바뀐 락으로 mac-probe #2 를 다시 돌려 초록을 확인했다.

★ **`npm audit fix --force` 는 누르지 말 것.** `electron` · `electron-builder` 를 메이저로
갈아 끼워서 방금 확보한 "맥에서 붙는 조합" 이 깨진다.

★ **[2026-09-15] 진행 — §8.** 감사 끝·`package.json` 반영·락 재생성 대기. `electron-builder` 는
**24 그대로 둔다**(§8-③). 위 경고는 "둘을 한꺼번에" 에 대한 것이고, §8 은 하나씩 간다.

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

- **⑦ `electron@31 → 44`** — 하드웨어 불필요. ~~그것만으로 한 세션 크기다.~~
  ★ **[2026-09-15] 감사는 끝났다(§8). 남은 것은 락 재생성 → mac-probe → Windows 실기기 §8-⑤ 다.**
  ★ `npm audit fix --force` 는 누르지 말 것(§3-④).
- ~~**`release-notes-2026-09.md` 정리**~~ — ⚠️ **[2026-09-15] 그 파일은 저장소에 없다.** `git ls-files` 0건.
  §3-① 과 같은 종류(정본이라고 적힌 문서가 가리키는 파일이 없음). **새로 만들지 않았다** — 릴리즈 노트는
  실제 릴리즈(0.9.6, `npm run release`)의 GitHub Release 본문으로 쓴다. 그때 넣을 두 줄:
  「옛 설정값 자동 승격」(아래 근거) · **「macOS 13(Ventura) 이상」**(§8).
  원래 항목: 문구가 「갭 확대」가 아니라 **「옛 설정값 자동 승격」**이 되어야 한다. `handoff-overlay-video-blackout-4.md` 의 「닫음」 절을 **먼저** 읽을 것 —
  실제로 제보를 끊은 것은 레이어드 알파였다.
- **⑥ 설계만** — mac 판정 키 생성 규칙을 무엇으로 할지(번들 id `com.google.Chrome` vs
  번들 이름). 코드 없이 결정만 가능하다. 근거는 `handoff-platform-split.md` §4-b.

### ② 올릴 것

| 하려는 것 | 올릴 것 |
|---|---|
| **⑥ (실기기 있음)** | 이 파일 · `handoff-platform-split.md` · `main.js` · `overlay-win.js` · `sysinput-win.js` · `checks/sim-sysinput.js` · `handoff-overlay-video-blackout-4.md` |
| ⑥ 설계만 | 이 파일 · `handoff-platform-split.md`(§4-b) |
| ⑦ electron 갱신 | 이 파일 · `package.json` · `package-lock.json` |
| 릴리즈노트 | 이 파일 · ~~`release-notes-2026-09.md`~~(**없음**, §6-①) · `handoff-overlay-video-blackout-4.md` |
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
- `release-notes-2026-09.md` — **존재한 적이 없다**(2026-09-15 `git ls-files` 0건). 이 문서가 가리키고 있었다.
  릴리즈 노트는 GitHub Release 본문이 정본이다(§6-①).
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
>
> ★★ **[2026-09-15] 4번이 닫혔다 — `keycheck` 잡 실측.** 아래가 그 숫자다.
> ```
> 1절  앱 202개 전수 일치 · 틀린 것 0 · 이름 대체(B안 낙하) 0건
> 2절  바이너리 plist 15개 · XML 187개   ← plutil 분기가 실제로 돌았다
> 3절  Simulator.app → com.apple.iphonesimulator (바깥 com.apple.dt.xcode 아님)
> 4절  C 가 A 보다 나쁜 자리 0곳 · 같은 앱 여러 판본이 한 키(Xcode×15)는 의도된 동작
> 5절  캐시 히트 202건에 0~1ms
> ```
> ⇒ **`procNameOf` 가 OS 가 아는 번들 id 와 202개 전부 일치했고, 대체 낙하가 0건이다.**
>   §7-① 의 C 안이 "경로 문자열만 보고 내린 결정" 에서 **실측**으로 올라섰다.
> ⚠️ 바이너리 plist 표본이 202 중 **15개뿐**이다. 0 이 아니니 분기는 확인됐지만 얇다.
>   ★ 사용자 기기의 서드파티 앱은 바이너리 비율이 훨씬 높다 — 이 15개로 「충분히 봤다」고 하지 말 것.
>
> ⚠️⚠️ **[정정] A 탈락은 실측이 아니라 여전히 논증이다.**
>   이 자리에 한때 «A 는 뭉치는데 C 는 가르는 자리 1곳: siri» 라고 적혀 있었다. **틀렸다.**
>   1회차 로그의 `siri = Siri.app / Siri.app` 를 보고 «둘이 서로 다른 번들 id 일 것» 이라고
>   **추정**한 것을 실측인 것처럼 적은 것이다. 2회차에서 둘은 **같은 번들 id** 로 밝혀졌다.
>   ⇒ **이 표본에는 A 탈락의 실증이 없다.** 근거는 여전히 경로 논증뿐이다 —
>     일렉트론 앱은 실행파일명이 죄다 `Electron` 이라 한 키로 뭉친다(우리 앱의 개발 실행도 그렇다).
>   ★ 러너에 일렉트론 앱이 안 깔려 있어서 실물이 안 나왔다. 실증이 필요하면
>     `node_modules/electron/dist/Electron.app` 를 표본에 넣는 길이 있는데, 그건 `npm ci` 를
>     타야 해서 **keycheck 가 40초인 이유를 버린다.** 지금은 안 한다.
>   ⚠️ **추정을 문서에 실측으로 적은 사고가 이 프로젝트에서 또 났다는 것이 요점이다**
>     (§3-① 의 「정본이라고 적힌 문서가 가리키는 파일이 없었다」와 같은 종류).
>     검사가 그걸 잡아냈다 — 2회차의 `·` 줄이 그 기록이다.
>
> ⚠️ **첫 실행은 빨갰고, 빨간 쪽이 코드가 아니라 검사였다.** 4절이 「번들 id 충돌 0건」을
>   조건으로 박았는데 러너에 Xcode 15 판본이 깔려 있어 전부 `com.apple.dt.xcode` 였다.
>   그건 **의도된 동작**이다(「Xcode 에서 3시간」을 세는 것이 목적이지 「Xcode 26.4 에서」가 아니다).
>   ⇒ 조건을 **「C 가 만든 충돌은 전부 A 도 만든 충돌이다」** 로 바꿨다. 한 번들 id 그룹 안에
>     basename 이 둘 이상 섞이면 그때가 진짜 빨강이다 — 그 갈래는 여전히 잡힌다.
>   ★ **초록으로 만들려고 무르게 푼 것이 아니다.** 무르게 푸는 것이었다면 그 항목을 지웠다.
>     같은 구분을 다음에 또 해야 할 것이다 — 「검사가 빨간가, 규칙이 빨간가」를 먼저 가를 것.
>
> ⚠️ **종료 코드 규칙도 같이 바뀌었다 — 「본론(1절)이 돌았는가」로 가른다.**
>   처음에는 `?` 가 하나라도 있으면 2 였는데(`sim-*.js` 관례), 위 A 탈락 항목이 `?` 를 내면서
>   **우리가 고칠 수 없는 이유로 CI 잡이 영구히 빨갰다.** 그건 `CHECKS.md` §13 이 경고한
>   「늘 켜진 경보 → 잡음」이다. 지금은 본론이 돌았으면 남은 `?` 는 관찰로 보고 0 을 낸다.
>   **`✗` 는 어느 경우에도 1 이다** — 빨강을 줄인 것이 아니라 빨강과 「못 봤다」의 선을 옮긴 것이다.
>
> 러너로 닫을 수 있는 나머지:
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

---

## 8. ⑦ `electron@31 → 44` — ✅ 닫혔다 (2026-09-15)

> **[닫음]** 커밋 둘(44 승격 · ②-b 정정) → **mac-probe #4 세 잡 초록.** `electron@44.3.0`, `electron-builder`
> **24.13.3 그대로**, arm64·x64 양쪽 ④ 통과 = 리빌드가 안 죽었다 → §8-③-ⓐ 의 「죽으면 26」 갈래는 **안 탔다.**
> Windows 실기기 §8-⑤ 1·2·3·4·7 초록. `npm audit --omit=dev` 0건.
> ⚠️ **아직 안 한 것 둘 — 이건 ⑦ 이 아니라 배포의 일이다:**
> - **Windows 설치본을 44 로 아직 안 만들었다.** mac-probe 는 맥만 본다. `npm run pack` 한 번으로
>   NSIS 가 44 위에서 붙는지 보고, 그 설치본으로 §8-⑤ 8·9(자동 시작·`autoUpdater`)를 본다 —
>   둘 다 `app.isPackaged` 가 true 여야 진짜 경로를 탄다.
> - ~~`release-notes-2026-09.md` 에~~ **「macOS 13 이상」** — 그 파일은 없다(§6-①). 0.9.6 GitHub Release 본문에 넣는다.
>
> **여기가 ⑦ 의 머리였다.** §3-④ 는 "왜 해야 하나" 의 기록이고, 이 절이 "무엇을 봤고 무엇이 남았나" 다.
> ⚠️ **이 절은 코드를 한 줄도 안 고쳤다.** 고칠 데가 없어서다 — 그게 이 절의 결과다. 대신 아래 ②
> 표가 "안 고친 근거" 고, 그 표 없이 "44 로 올렸다" 만 남으면 §3-① 과 같은 종류의 문서가 된다.
>
> ⚠️ **이 세션은 오프라인이었다.** `npm install` 을 못 돌렸고, 그래서 **`package-lock.json` 은 여전히
> `electron@31.7.7` 을 가리킨다.** `package.json` 만 `^44.0.0` 이다. 이 둘이 어긋난 채로 `npm ci` 를
> 부르면 npm 이 거부한다(락과 package.json 불일치) — **먼저 §8-④ 의 1 번.**

### ① 무엇을 봤나 — `main.js` 가 실제로 부르는 Electron API 전수

`main.js` 2900줄에서 `require('electron')` 이 꺼내는 것은 여덟이다:
`app` `BrowserWindow` **`BrowserView`** `screen` `ipcMain` `shell` `powerMonitor` `dialog`.
거기에 `electron-updater` 의 `autoUpdater`. 호출을 전부 뽑아 이름별로 세고(`grep -oE`), 32~44 의
Breaking Changes 문서·각 판 릴리즈 노트에 하나씩 맞댔다. **추정으로 넘긴 항목은 ② 표에 ⚠️ 로 남겼다.**

| 부류 | 쓰는 것 |
|---|---|
| 창 옵션 | `frame` `transparent` `alwaysOnTop` `skipTaskbar` `hasShadow` `resizable` `backgroundColor` `icon` · `webPreferences` 는 `preload` `contextIsolation:true` `nodeIntegration:false` `backgroundThrottling:false` `partition` |
| 창 메서드 | `setIgnoreMouseEvents`(6) `setAlwaysOnTop(…,'screen-saver')`(7) `setBounds`(11) `setOpacity`(3) `flashFrame`(3) `setMinimumSize`(2) |
| webContents | `send` `on` `executeJavaScript` `loadURL` `setAudioMuted` `setWindowOpenHandler` `setUserAgent` `session.webRequest.onBeforeRequest/onBeforeSendHeaders` `openDevTools` |
| webContents 이벤트 | `console-message` `did-create-window` `did-finish-load` `dom-ready` `will-navigate` `will-frame-navigate` `will-redirect` `before-input-event` |
| app | `whenReady` `getPath` `commandLine.appendSwitch`(4) `quit` `exit` `relaunch` `isPackaged` `getVersion` `requestSingleInstanceLock` `set/getLoginItemSettings` · 이벤트 `activate` `before-quit` `second-instance` `session-end` `window-all-closed` |
| 기타 | `screen.getCursorScreenPoint`(13) `getAllDisplays` `getDisplayNearestPoint` `display-metrics-changed` · `powerMonitor.getSystemIdleTime` · `shell.openExternal/openPath/showItemInFolder` · `dialog.showOpenDialog` |
| **안 쓰는 것** | `clipboard` `Notification` `nativeImage` `systemPreferences` `desktopCapturer` `protocol` `net` `utilityProcess` `navigationHistory` — **전부 0건.** 44 의 큰 변경 대부분이 여기 산다 |

### ② 32 → 44 깨짐 목록 × 우리 코드 — 대조표

| 판 | 변경 | `main.js` 의 자리 | 판정 |
|---|---|---|---|
| 32 | `File.path` 제거 · `navigationHistory` 로 이전 | `main.js` 안 씀 · **`app.js` 의 파일 입력 5곳(8183·10669·13789·14024·14417)은 전부 `FileReader`** — `.path` 안 읽음 | ✓ |
| 32 | `console-message` 인자가 `(ev, level, message)` → `ev.message` | **2233** — `message` 문자열이면 그걸, 아니면 `ev.message` 를 받는다(2235 주석이 그 근거) | ✓ **이미 둘 다 받는다** |
| 33 | `document.execCommand("paste")` 폐기 예고 | `app.js` 의 `execCommand` 14곳은 전부 `copy`·`foreColor`·`backColor`·`removeFormat`·`unlink`·`styleWithCSS` — **`paste` 는 0건** | ✓ (2회차 확인) |
| 34 | Windows 전체화면에서 메뉴바 숨김 | 모든 창이 `frame:false`·메뉴 없음 | ✓ |
| 35 | `WebRequestFilter.urls: []` 가 "전체" 가 아니게 됨 | **2201·2209** 필터 인자 자체가 없다 | ✓ |
| 36 | `systemPreferences.isAeroGlassEnabled` 폐기 | 안 씀 | ✓ |
| 38 | **macOS 11 지원 종료** | — | 설치본 요건 |
| 40→44 | 렌더러의 `clipboard` 폐기 → **44 에서 제거** | `main.js` 0건 · **`preload.js` 가 꺼내는 것은 `contextBridge`·`ipcRenderer` 둘뿐** · `app.js` 의 `clipboard` 9곳은 전부 **`navigator.clipboard`**(웹 API — 44 가 권하는 바로 그 길) | ✓ (2회차 확인) |
| 42 | **postinstall 제거 → 지연 다운로드.** `npm ci` 가 바이너리를 안 받고 `npx electron` 첫 실행 때 받는다. `ELECTRON_SKIP_BINARY_DOWNLOAD` 제거 | 워크플로 | ✓ `mac-probe.yml` ②-b 로 흡수 |
| 42 | `@electron/get` 4.x → **Node ≥ 22.12 · ESM 전용** | 워크플로 | ✓ probe 잡 node 22 |
| 42 | macOS 알림이 `UNNotification` → **서명 없으면 안 뜸** | `Notification` 0건 | ✓ (서명은 어차피 §8 의 일) |
| 42 | `clearStorageData({quotas})` 제거 | 안 씀 | ✓ |
| 43 | 다운로드 기본 폴더 · `nativeImage` sRGB 정규화 · Linux 둥근 모서리 | 안 씀 / Linux 안 함 | ✓ |
| 44 | **macOS 12 지원 종료 → 최소 macOS 13(Ventura)** | — | **설치본 안내문·릴리즈노트에 적을 것** |
| 44 | `setLoginItemSettings` 의 `openAsHidden` · `getLoginItemSettings` 의 `openAsHidden/wasOpenedAsHidden/restoreState` 제거 | **2339·2350** — `{openAtLogin, path, args}` 만 넣고 `openAtLogin` 만 읽는다 | ✓ |
| 44 | Windows ia32 · Linux armv7l 빌드 제거 | `win.target.arch = ["x64"]` | ✓ |
| 44 | `clipboard` 가 비동기 W3C 꼴로 재설계 | 안 씀 | ✓ |
| 44 | `select-client-certificate` 의 `webContents` 가 null 일 수 있음 | 안 씀 | ✓ |
| 44 | ANGLE 정적 링크(`libEGL/libGLESv2` 미동봉) | 건드린 적 없음 | ✓ |
| 29~ | **`BrowserView` 폐기(deprecated)** — `WebContentsView` 로 | **2167 `new BrowserView` · 2218 `setBrowserView`** | ⚠️ **44 에도 살아 있다**(shim). 경고 한 줄 뜨고 동작한다 — **미교체**, §8-③ |
| 31→44 | 메인 프로세스 Node **20 → 24** | `fs` `path` `crypto` 만 쓴다 | ✓ |
| 31→44 | Chromium **126 → 152** | 오버레이 갭 12·레이어드 알파의 실측 근거가 **126 의 가려짐 판정**이다 | ⚠️ **실기기 재실측** — §8-⑤ |

★ **`app.commandLine.appendSwitch` 넷**(`enable-transparent-visuals` · `autoplay-policy` ·
`disable-backgrounding-occluded-windows` · `disable-renderer-backgrounding`)은 Chromium 스위치라
Electron 의 깨짐 목록에 안 실린다. 없어진 스위치는 조용히 무시된다 — **죽지는 않지만 효과가 사라졌는지는
실기기에서만 보인다.** `transparent` 창이 검게 뜨면 첫 번째 것을 의심할 것.

★ **2235 의 주석 «Electron 31은 … 상위 버전은 event.message 로 옮겼다 — 둘 다 받는다»** 는 이 세션이
쓴 게 아니다. **이미 그 자리에 있었다.** 예전에 누군가 다음 판을 내다보고 심어 둔 것이고, 그 덕에 ⑦ 에서
고칠 줄이 0 이 됐다. 같은 종류의 «미리 둘 다 받기» 가 다른 곳에도 있는지는 안 봤다.

### ③ 결정 셋 — 근거를 같이 적는다

**ⓐ `electron-builder` 는 24.13.3 그대로 둔다.**
§3-④ 의 경고는 «둘을 한꺼번에 메이저로» 였다. 하나씩 가면 죽었을 때 어느 쪽인지 안다.
24 로 44 가 붙을 것이라는 근거는 락에 있다: `app-builder-lib@24.13.3` 의 의존성에 **`node-abi` 가 없다**
(`@electron/notarize` · `osx-sign` · `universal` 셋뿐). 리빌드는 Go 바이너리(`app-builder-bin`)가
`node-gyp rebuild --dist-url` 로 직접 돌리므로 ABI 표 갱신이 필요 없다. 그리고 네이티브 둘 다 **N-API** 다
(`uiohook-napi` = `node-gyp-build` 프리빌드 · `node-window-manager` = `node-addon-api@2` + `node-gyp-build`) —
Node ABI 가 20→24 로 뛰어도 다시 컴파일할 이유가 없다.
⇒ ④ 에서 `rebuilding native dependencies` 단계가 죽으면 **그때** 26 을 별도 커밋으로 올린다.
26 은 `@electron/rebuild` + `node-abi` 로 바뀌어 다른 종류의 문제(ABI 표 판본)가 생기므로 미리 안 간다.

**ⓑ `BrowserView` 는 안 바꾼다.**
44 문서에 `BrowserView` 페이지가 "Deprecated" 표기로 **아직 있다.** 제거 예고 판본이 없다. 이 세션의 목적은
«31 의 지원 종료를 벗어나 붙는 조합을 다시 잡는 것» 이고, 뷰 교체는 유튜브 주입(`console-message` 를
채널로 쓰는 1972~2240)의 동작을 통째로 다시 재야 하는 **별건 크기**다. 경고 한 줄을 안고 간다 — §8-⑥.

**ⓒ mac-probe 는 probe 잡만 node 22.**
근거는 ② 표의 42 항목. keycheck 는 electron 을 안 부르니 20 그대로 — **초록인 잡에 변수를 안 얹는다**
(§7-5 가 "검사가 빨간가, 규칙이 빨간가" 를 가르라고 한 그 원칙).

### ④ 순서 — 커밋 단위로

| # | 할 것 | 초록의 모양 | 어디서 |
|---|---|---|---|
| 1 | `package.json` 반영본으로 **`npm install`** (`ci` 아님) → `package-lock.json` 갱신 | `npm ls electron` 이 `electron@44.x` · `git diff --stat package-lock.json` 이 electron 과 그 하위(`@electron/get` 4.x 등)만 | 로컬(온라인) |
| 2 | `npm audit --omit=dev` | 0건 유지(§3-④ 에서 이미 0 이었다 — 44 로 늘면 안 된다) | 로컬 |
| 3 | `npm start` 첫 실행 — **여기서 바이너리를 받는다**(42+ 지연 다운로드) | `[오버레이] 부팅 …` 로그 · Windows 이면 `레이어드 …` 줄 | **Windows 실기기** |
| 4 | §8-⑤ 표 | 전부 초록 | Windows 실기기 |
| 5 | `mac-probe` 수동 실행 | **세 잡 초록 + ②-b 가 `v44.x`** | Actions |
| 6 | 커밋 하나: `package.json` · `package-lock.json` · `.github/workflows/mac-probe.yml` · 이 문서 | — | — |
| 7 | ~~`release-notes-2026-09.md` 에~~ **「macOS 13 이상」** 한 줄 → 파일 없음(§6-①). **0.9.6 GitHub Release 본문**에 | — | 릴리즈 때 |

⚠️ **1 을 건너뛰고 5 로 가면 ②-b 가 일부러 빨갛다.** 그건 검사가 일한 것이다(`v31.7.7` 이 찍힌다).

⚠️ **[mac-probe #3, 2026-09-15] 5 의 첫 판이 빨갰고 — 빨간 쪽은 검사였다.** keycheck 초록, probe 둘 다
②-b 에서 `electron 판본이 44 가 아니다: Downloading Electron binary...`. 첫 실행이 판본 **앞에** 안내 줄을
한 줄 찍는데 그 줄을 판본으로 읽은 것이다(로컬 `npm start` 첫 줄에 이미 같은 문구가 있었다 — 그때 못 봤다).
⇒ `npx install-electron` 으로 다운로드를 먼저 끝내고, 판본은 마지막 줄만 본다. **실물은 44 였다** —
무르게 푼 것이 아니라 읽는 줄을 바로잡은 것이다. §7-5 의 「검사가 빨간가, 규칙이 빨간가」 그대로다.
★ 이 워크플로가 ③④ 까지 간 적이 아직 없다 — **44 에서 붙는가는 #4 가 처음 답한다.**
⚠️ **3·4 를 5 뒤로 미루지 말 것.** mac-probe 는 "붙는가" 만 보고 Windows 는 안 본다. 44 의 실사용자는
전부 Windows 다.

### ⑤ Windows 실기기 확인 — ⑦ 의 실측

> §7-5 와 같은 원칙: **제일 비싼 미지수를 먼저.** 아래 1·2 가 나쁘면 44 를 못 올린다.
>
> ★ **[2026-09-15 실측 — `electron@44.3.0` · Windows · 디스플레이 2개 배율 1.5]** 1·2·3·4·7 초록.
> 부팅 세 줄(설정 승격·레이어드·화면)이 31 과 같은 모양, 클릭 통과 왕복(`char:me` ↔ `whale.exe`) 동일,
> BGM 재생·다음곡·음소거 됨, 검어짐 없음, 종료·로그오프 `0x80000003` 없음. §8-④ 1·2 도 닫힘
> (`npm ls electron` = 44.3.0 · `npm audit --omit=dev` = 0건 — 8건은 전부 빌드 도구 쪽).
> 새로 뜬 줄 둘, 둘 다 막을 일 아님:
> - `'console-message' arguments are deprecated` — 2233 이 `ev.message` 를 이미 받는다(§8-② 32 항목의 실물).
> - `MaxListenersExceededWarning: 11 did-stop-loading listeners` — `main.js` 에 그 이벤트가 없다.
>   Electron 이 `loadURL()` 프로미스 안에서 붙이는 리스너가 곡 넘김의 `loadURL` 겹침으로 쌓인 것.
>   **31 에서도 있었는지는 안 가려졌다.** 곡을 넘길수록 느는지 보고, 늘면 §8-⑥ 별건.
> 5·6·8·9 는 이 실측에서 따로 안 봤다(4 가 초록이라 5·6 은 사실상 같이 본 셈이나 표에는 안 적는다).
>
> ★ **[같은 날, `npm run pack`]** Windows x64 도 붙었다 — 네이티브 셋(`extract-file-icon` · `node-window-manager` ·
> `uiohook-napi`) 리빌드 통과, `dist\win-unpacked` 실행에서 부팅 세 줄·클릭 통과·BGM 동일.
> `app-update.yml` ENOENT 는 `--dir` 빌드의 정상 — 9번(`autoUpdater`)은 진짜 릴리즈 때.
> **8번(자동 시작)을 보다가 별건이 하나 나왔다 — 44 와 무관한 개발 모드 버그.**
> 레지스트리 `Run` 에 인자 없는 `electron.app.Electron` 찌꺼기가 있어 지웠더니, `npm start` 의 토글이
> «켜도 꺼진 채» 가 됐다. 원인은 2331~2353: set 에는 `path`+`args` 를 넣고 get 은 빈손으로 불러서,
> Windows 의 `getLoginItemSettings` 가 args 붙은 등록을 못 찾았다. 찌꺼기 줄이 그걸 true 로 가려 주고 있었다.
> ⇒ `_loginItemOpts()` 하나로 읽기·쓰기를 통일(커밋 `4dcea81`). **설치본은 `undefined` 를 받아 동작 변화 0.**
> `npm run check` 54개 전후 동일(`sim-sysinput` 60·0). 설치본 쪽 8번(`dist\win-unpacked` 경로로 등록·해제)은
> 이 수정 뒤에 한 번 더 볼 것.

| # | 볼 것 | 초록의 모양 | 빨강이면 |
|---|---|---|---|
| 1 | **클릭 통과 + 2초 얹기** (`setIgnoreMouseEvents(…,{forward:true})` + uIOhook 커서 폴링, §5 «한 몸») | 캐릭터 위에서 잡히고, 밖에서는 아래 창이 받는다 | Chromium 152 가 `forward` 를 다르게 다루는 것 — 440 의 그 사고가 되살아난 모양. **44 보류** |
| 2 | **`session-end` 훅 해제** (2857) | 로그오프·종료 때 `0x80000003` 없음 | §5 의 두 번째 줄 그대로 |
| 3 | uIOhook 로드 (`sysinput-win.js` 의 try/catch) | 부팅 로그에 로드 실패 문구 없음 | N-API 인데 죽으면 프리빌드가 44 의 Node 24 와 안 맞는 것 — `uiohook-napi` 판 확인 |
| 4 | `node-window-manager` 활성창 판정 | 등록 슬롯 `key` 가 `win:…` 로 선다 | 3 과 같은 갈래 |
| 5 | **오버레이 검어짐** — 갭 12 · 레이어드 알파 | 유튜브 재생 중 캐릭터가 안 검어진다 | 126 의 가려짐 판정으로 잡은 값이다. 152 에서 다시 재야 하면 `handoff-overlay-video-blackout-4.md` 의 «닫음» 절부터 |
| 6 | `transparent` 창 | 검은 사각형 없음 | `enable-transparent-visuals` 무시 의심(§8-② 별표) |
| 7 | BGM `BrowserView` 유튜브 주입 (`TWPL:` 신호) | 재생·다음곡·광고 음소거 | 폐기 경고만 뜨고 동작해야 한다. 동작이 다르면 §8-⑥ 의 별건이 앞당겨진 것 |
| 8 | 자동 시작 토글 (2331~2353) | 켜고 끄면 시작프로그램에 붙고 떨어진다 | `openAsHidden` 은 안 쓰니 44 제거의 영향은 없어야 한다 |
| 9 | `autoUpdater` (`electron-updater@6`) | `checking-for-update` 로그 | electron-updater 는 electron 본체와 따로 판을 가진다 — 여기서 죽으면 electron-updater 쪽 |

### ⑥ ⑦ 이 남긴 별건

- ~~**`preload.js` · `app/` 의 `clipboard` 사용 여부**~~ — **닫혔다 (2026-09-15 2회차).** `preload.js` 1행이
  `require('electron')` 에서 꺼내는 것은 `contextBridge`·`ipcRenderer` 둘뿐이고(`shell` 은 146행 주석에서만
  나온다 — 실제 호출은 `main.js`), `app.js` 의 `clipboard` 9곳은 전부 `navigator.clipboard` 다.
  `firebase-init.js` 는 `electron` 을 한 번도 안 부른다(gstatic ESM import 만). ⇒ 렌더러 갈래에 44 가 닿는 자리 없음.
- **`BrowserView` → `WebContentsView`** — §8-③-ⓑ. 제거 예고가 뜨면 그때 한 세션.
- **`electron-builder` 24 → 26** — ④ 가 리빌드에서 죽을 때만.
- ~~**`document.execCommand("paste")`**~~ — **닫혔다 (2회차).** `app.js` 의 14곳 중 `paste` 는 0건. 리치 텍스트
  툴바(13960~13987)의 `foreColor`·`backColor` 등은 33 의 폐기 대상이 아니다 — 폐기된 것은 **동기 붙여넣기 하나**다.
- **`enable-transparent-visuals`** — 152 에서도 뜻이 있는지. 없으면 지운다(⑤-6 이 답).
- **`did-stop-loading` 리스너 누적** — §8-⑤ 실측 메모. 곡 넘김마다 느는 것이 확인되면 BGM `loadURL` 을
  앞 로드가 끝난 뒤에 부르게 직렬화한다. 44 의 새 증상인지 31 에도 있던 것인지부터 가릴 것.
- **`app/fx-preview.html` · `app/parts/mys-test.html`** — §3-⑤ 가 «⑦ 이후 정리» 로 미뤄 둔 것. 이제 그 «이후» 다.
