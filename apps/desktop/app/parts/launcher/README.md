# launcher/ — 런처 · 앱 껍데기

모듈마다 절 하나. 모양은 모두 같다 — `window.TwXxx = { createXxx(deps) }`, app.js 가 원래 구역 자리에서 `const xMod = TwXxx.createXxx({ … })` 로 만든다.
deps 의 함수는 화살표(`(...a)=>f(...a)`), app.js 가 다시 대입하는 값은 읽는 함수(`()=>x`) · 쓰는 함수(`(v)=>{ x = v; }`)로 넘긴다.

## launcher-controls.js — 🎛️ 런처 컨트롤

- **책임**: 런처 카드의 버튼 — 슬롯 넘기기(◀ ▶ · 끝에서 감아 돈다) · 빈 칸 [＋] · 톱니 메뉴(수정 · 삭제 · 보관함 이동) · 미리보기 클릭 → 실행.
  삭제와 보관함 이동은 슬롯을 앞으로 당기고 «자리 추가» 번호도 같이 당긴다.
- **만드는 법**: `TwLauncherControls.createLauncherControls(deps)` — 만들 때 버튼에 핸들러를 건다.
  - 값: `CHAR_SLOT_MAX` · `slots`(같은 배열을 고쳐 쓴다) · `settingsMod`(자리 추가 번호 `extraSeatSlots` · `setExtraSeatSlots` · `_saveExtraSeatSlots`)
  - 읽는 함수: `curSlot` · `charsMod` · `racePickerMod` · `slotSaveMod` / 쓰는 함수: `setCurSlot`
  - 함수: `launchApp` · `openCreator` · `renderLauncher` · `saveCurSlot` · `toast`
- **내놓는 것**: `closeGearMenu()` — 톱니 메뉴를 닫고 삭제 되묻기도 취소한다. 런처를 다시 그릴 때(`renderLauncher`) · 설정 창 등이 부른다.
  ```js
  launcherCtlMod.closeGearMenu();
  ```
- **확장할 때**: 톱니 메뉴에 버튼을 더하면 되묻는 동안 숨길 목록(`['lcToBox','lcEdit','lcExport','lcGearSep','lcDelete']` — 두 곳)에도 넣는다.
  슬롯을 당기는 일이 하나 더 생기면 doDeleteCurSlot · doMoveCurSlotToBox 와 같은 모양(자리 추가 번호 · 현재 칸 정리)을 지킨다.
- **함정**: 네이티브 확인 대화상자를 쓰지 않는다(Electron 투명 창이 멈춘 것처럼 보인다 · audit 검사 4).
  보관함 이동은 기다린 뒤 번호가 아니라 그 캐릭터로 칸을 다시 찾는다 — 번호로 당기면 연타 · 동기화 때 엉뚱한 칸을 당긴다.
- **검사**: `checks/sim-launcher-controls.js` — 모듈 모양 · app.js 연결 · 깨 보기 · 버튼 동작(감아 돌기 · 당기기 · 자리 추가 번호 · 보관함 이동 실패 · 연타 막기).

## launcher-preview.js — 🖼️ 런처 미리보기 · 슬롯 섬네일

- **책임**: 런처 카드의 3D 미리보기 — 렌더러 · 씬 · 카메라(도트 느낌 저해상도), 칸 캐릭터 올리기(몸 기준 프레이밍 · 둥둥 · 깜빡임),
  다 그린 뒤 한 장 찍어 슬롯 섬네일(`def.thumb`) 갈아 끼우기.
- **만드는 법**: `TwLauncherPreview.createLauncherPreview(deps)` — 만들 때는 아무것도 그리지 않는다(`ensureLauncherPreview` 가 렌더러를 처음 한 번 만든다).
  - 값: `slots` · `CHAR_Z` · `RIG_TURN` · 조명 상수(`_MAIN_LIGHT_*` · `_KEY_LIGHT_MUL` · `_FILL_LIGHT_MUL`) · `scene` · `commSceneCache` · `FrameBudget`(프레임 상한) · `blinkTiming`(= `TwBlinkTiming`, 좌석과 같은 깜빡임 시간표)
  - 읽는 함수: `customItems` · `assetCodeMod` · `slotSaveMod`
  - 함수: 책상 · 파츠 · 모델 도우미 20개(`buildDesk` · `defToBase` · `applyEquippedPartsToSeat` · `setFaceMap` …)
- **내놓는 것**: `ensureLauncherPreview()` · `setLauncherChar(def)`(그 캐릭터로 갈아 올림 · null 이면 비움) · `sizeLauncherPreview()`(창 크기가 바뀌면) ·
  `launcherLoop`(부팅 때 `requestAnimationFrame` 에 한 번) · 읽는 함수 `lRenderer()` · `lHolder()`(책상 아이템 크기 로그가 «런처» 인지 가른다).
  ```js
  launcherPrevMod.ensureLauncherPreview(); launcherPrevMod.sizeLauncherPreview(); launcherPrevMod.setLauncherChar(slots[curSlot]);
  ```
  칸 화면 토글(빈 칸 [＋] · 톱니 · 칸 번호)과 위 세 줄을 묶은 `renderLauncher()` 는 **app.js 에 남는다** — 여러 모듈이 부르고 초대장 · 톱니 · 연동 띠 모듈을 함께 부르는 연결 자리라
  이 모듈로 옮기면 순환이 생긴다(sim-dep-cycles).
- **확장할 때**: 구도는 `sizeLauncherPreview` 의 `FILL`(키가 세로를 채우는 몫) · 시선 오프셋, 도트 거칠기는 `PS1_PIXEL_SCALE`, 섬네일은 `LC_THUMB_SETTLE_MS` · `LC_THUMB_MAX`.
- **함정**: 캔버스에 px 를 박지 않는다(박은 값을 다시 읽어 크기가 굳는다). 섬네일은 render 와 같은 틱에서 복사한다(렌더러에 preserveDrawingBuffer 없음).
  `launcherLoop` 는 `FrameBudget.FPS_LAUNCHER`(30)까지만 그린다 — 상한을 빼면 주사율만큼 그려 런처 GPU 부하가 3~4배. 깜빡임 박자를 여기서 따로 세지 않는다(프레임 수로 세면 주사율 따라 달라진다 — `shared/blink-timing.js`).
  프레임 높이는 파츠를 뺀 몸 박스로 잰다 — 파츠까지 넣으면 파츠가 튈 때 캐릭터가 작아진다.
- **검사**: `checks/sim-launcher-preview.js` — 모듈 모양 · 연결 · 깨 보기 + 4절 런처 부하(120Hz 에서 30번 · 깜빡임 횟수 주사율 무관 · 후원 반짝임 steps).

## click-through-policy.js — 🖱 클릭 통과 판단 규칙 한 곳

- **책임**: «투명 전체화면 창을 클릭 통과(setIgnoreMouseEvents true)로 둘지 · 받기로 바꿀지» 의 판단만. 순수 함수 — 입력은 «무슨 일이 있었나» 사실,
  출력은 결정 문자열 · 작은 객체. DOM · IPC · 타이머 · 로그는 부르는 쪽(desktop-run.js · main.js)이 한다.
  예전엔 같은 판단이 네 길(렌더러 mousemove · 재판정 onPenHitTest · 고착 회복 사다리 `__mouseKick` / main 안전장치 ⓔ·ⓕ·ⓖ)에 흩어져 제보마다 한 길만 고쳤다.
- **만드는 법**: 만들 것이 없다(상태 없음). 렌더러는 `window.TwClickThroughPolicy`(html 이 desktop-run.js 보다 먼저 싣는다)를 app.js 가 `clickPolicy: TwClickThroughPolicy` 로 넘기고,
  desktop-run.js 는 `const clickPolicy = deps.clickPolicy;` 로 받는다. main.js 는 `require('./app/parts/launcher/click-through-policy')` — **같은 파일**이다(설치본은 `app/**/*` 로 들어간다).
- **내놓는 것**:
  - 렌더러 — `moveStep(f)` → `{act:'receive'|'keep'|'judge', stamp}` · `hitStep({hit, ignoring})` → `'receive'|'pass-later'|'keep'` · `pointerDownStep({ignoring})`
    · `pokeStep({pt, ignoreSent, dragging})` → `{resync, act, x, y}` · `clickMayKick(state)` · `kickStep(f)` → `{act:'none'|'skip-off'|'skip-pen'|'rearm'|'probe', stage}` · `holdForDrag(f)`
  - main — `mainArmed` · `stallStep`(ⓔ) · `staleCaptureStep`(ⓕ) · `foreignInputStep`(ⓖ → `{act:null|'recall'|'defer'|'wait', why, poke}`) · `deferExpiredStep`
  - 상수 — `PASS_DEBOUNCE_MS` · `KICK_PROBE_MS` · `RENDERER_STALL_MS` · `FWD_*` · `FGN_*` 등(파일 위 한 곳)
  ```js
  const k = clickPolicy.kickStep({ ignoreSent: _ignoreSent, offOverlay, penApp: _penAppFocused(), now,
    lastKickAt: _lastKickAt, lastMoveSeen: _lastMoveSeen, lastPokePen: _lastPokePen, lastPokeAt: _lastPokeAt, stage: _kickStage });
  if(k.act === 'probe'){ /* 0.8초 받아 보기 */ }
  ```
- **확장할 때**: 새 규칙은 해당 `*Step` 에 줄 하나 + 필요한 사실을 입력 칸으로. 부르는 쪽은 사실만 모아 넘긴다 — 새 길(이벤트 · 안전장치)을 만들 때도 여기 함수를 부른다.
  문턱을 바꾸면 `checks/sim-click-through-policy.js` 1절 상수 표도 같이 고친다(값이 곧 동작이다).
- **함정**: 같은 조건(`drag() && _ignoreSent` · `offOverlay === true` · `_isConfigMode || _lastIgnoreRequested` · `FWD_*` 상수 등)을 다른 파일에 다시 쓰면 검사 5절이 빨강이다.
  사다리는 펜 앱 · 다른 모니터 · 휠에서 돌지 않는다 — 3단계(받아 보기)가 남의 창 포커스를 뺏는 유일한 자리다. 통과를 임의로 «받기» 로 푸는 규칙은 넣지 않는다(예전 워치독 사고).
- **검사**: `checks/sim-click-through-policy.js` — 모양 · 상수 값 · 렌더러/main 표(상황 → 결정, 경계값) · 네 길 연결 · 같은 조건 재사용 금지(+깨 보기).
  동작 판정은 원래 검사들(`sim-ghost-cache-sync` · `sim-wheel-kick` · `sim-hover-poke` 등)도 그대로 본다.

## oss-licenses.js — 📄 오픈소스 라이선스 창
- 책임: «개인정보 처리방침» 옆 링크 둘(⚙️ 설정 › 시스템 › 프로그램 정보 `#progOssLink` · 내 정보 맨 아래 `#miOssLink`)을 누르면 고정 크기 창(`OSS_WIN` 440×460 · 화면이 작으면 92vw / 80vh 안으로)에 목록을 보인다. 한 줄 = 이름(누르면 홈페이지) · 판 · 라이선스 칩 · [원문] 펼치기. 목록 · 원문은 창 안에서만 스크롤.
- deps: `document` · `window` · `links`(a 요소 목록 — 없는 것은 건너뜀) · `openUrl`(시스템 브라우저로 열기) · `escRegisterWindow`(ESC 스택) · `load`(검사용 — 기본은 `app/licenses/oss-notices.js` 를 처음 열 때 싣기).
- 내놓는 것: `open` · `close` · `isOpen` — 밖에서 부르는 곳 없음(app.js 가 프로그램 설정 바로 뒤에서 만들기만).
- 목록 만들기: `npm ci` 뒤 `node scripts/third-party-notices.js` → `app/licenses/oss-notices.js`(`window.TwOssNotices` · 손으로 고치지 않는다). 줄은 `VENDOR` + 앱이 직접 쓰는 npm 패키지, 하위 패키지는 그 줄 원문 안으로. 의존성을 바꾼 PR 에서 다시 돌린다 — `sim-oss-licenses.js` 가 lock 운영 패키지를 다 덮지 않으면 빨강.
- 함정: 창은 처음 열 때 한 번 만들고 숨기기만 한다(ESC 스택이 늘 있는 요소를 본다). 프로그램 설정 위에서 연 이 창 안 클릭이 설정을 닫지 않게 하는 예외는 `shared/outside-close.js`. 이름 · 원문은 `textContent` 로만. npm 밖에서 넣은 것(app/vendor · 아이콘 · Electron)은 스크립트의 `VENDOR` 에 손으로 더한다.

## `notice-api.js` · `notice-feed.js` — 📢 공지 한 판(소식 · 업데이트 공지 · 런처 배너)

**책임** — 공지의 원본은 서버다. `GET /v1/notices`(공개 · ETag — 같으면 304) 한 번에 소식(고정 + 최신 30) · 업데이트 공지 · 런처 배너를 받는다.
`notice-api.js` 는 서버 모양(대문자 `tag` · `publishedAt` · `imageUrl` · `linkUrl`)을 화면 모양(소문자 tag · `ts` ms · `img` · `link`)으로 맞추는 provider 한 곳이고, 관리자 소식 쓰기(올리기 `POST /v1/admin/notices/broadcasts` · 📌 `PATCH` · 내리기 `DELETE`)도 여기다.
`notice-feed.js` 는 받아 들고 있는 한 벌 — 받는 중 · 받음 · 못 받음, realtime `notices` 알림이 오면(오래 끊겼다 붙을 때 포함) 다시 받기, 받는 쪽마다 `onChange`.
옛 장치는 걷었다: 버전 확인 + 이 PC 캐시(`broadcast-cache.js`) · 배너를 `localStorage('tw.adBanner')` 에 옮겨 적기 · 확성기의 `ts + duration` 계산.

**만드는 법** — app.js 의 마이홈 처음 준비 만드는 줄 앞에서:

```js
const noticeFeed = TwNoticeFeed.createNoticeFeed({
  api: TwNoticeApi.createNoticeApi({ get: (path)=>TwApi.authed.get(path), write: TwApi.authed, pending: TwRequestId.createPending(), warn: (...a)=>console.warn(...a) }),
  rt: TwRtHub.store, notifyError: (...a)=>TwErrorCodes.notify(...a),
});
TwNetReady.whenNetReady(()=>noticeFeed.start());   // 켤 때 한 번
```

**내놓는 것** — `notice-feed`: `start()` · `refresh()` · `status()` · `ready()` · `broadcasts()` · `hasMore()` · `updateNotice()` · `banner()` · `onChange(fn)` · `sendBroadcast(o)` · `togglePin(id)` · `remove(id)`.
쓰는 곳: 알림함 «소식» 칸(`myhome-inbox.js` · `myhome-init.js` 가 새 소식 토스트) · 런처 배너(`ad-banner.js` · 설정 패널 배너 `settings-panel.js`) · 업데이트 공지 팝업(app.js — 처음 받았을 때 한 번).
확성기는 이 한 판에 없다 — realtime `announce` 메시지를 `room/overhead.js` 가 받는다(서버가 60초 안에서 보낸다).

**오류 번호** — `E-MH-09`(받기 실패 · 이어지는 동안 한 번) · `E-MH-12`(관리자 올리기 · 고정 · 내리기 — 409 는 다시 받고 알린다).

**함정**
- 소식 읽음은 서버에 없다 — 이 PC(`tw.inboxBcRead`)에 남는다. 계정이 바뀌어도 같은 PC 면 같은 읽음이다(계정별 저장은 A2 몫).
- 업데이트 공지의 «다시 보지 않기» 는 공지 시각(ms)을 기억한다 — 서버 시각으로 바뀌어 Firebase 시절 기억값과는 달라 한 번 더 뜰 수 있다.
- 관리자 편집 창(`admin/`)은 아직 Firebase 로 쓴다 — 서버 길로 옮기기 전에는 거기서 올린 확성기 · 업데이트 공지 · 배너가 앱에 안 보인다(관리자 묶음 몫).
검사: `checks/sim-notice-api.js` · `checks/sim-notice-feed.js`(입력 → 출력 · 상태 · 409 · 깨 보기) · `checks/sim-ad-banner.js`(배너 그리기).
