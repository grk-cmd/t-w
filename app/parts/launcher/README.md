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
  - 값: `slots` · `CHAR_Z` · `RIG_TURN` · `scene` · `commSceneCache` · `FrameBudget`(프레임 상한) · `blinkTiming`(= `TwBlinkTiming`, 좌석과 같은 깜빡임 시간표)
  - 읽는 함수: `customItems` · `assetCodeMod` · `slotSaveMod`
  - 함수: 책상 · 파츠 · 모델 도우미 20개(`buildDesk` · `defToBase` · `applyEquippedPartsToSeat` · `setFaceMap` …) · `addRunLights`(실행 화면 조명 — shared/light-tone.js)
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

## heartbeat-policy.js — 🩺 하트비트에 무거운 칸을 실을지

- **책임**: 렌더러 하트비트(`heartbeat.js` 의 `setInterval` 100ms → `companion.setCharBounds`)가 이번에 무거운 칸(`regions` = 우리 창 사각형 `__uiRegions` · `others` = 남의 좌석 원)을
  새로 잴지만 정한다. 순수 함수 — 창 보임 신호 · 시각은 부르는 쪽이 넘긴다. 하트비트 자체(생존 신호 · 캐릭터 좌표 · `moveAge` · `charBad`)는 늘 보낸다.
- **만드는 법**: 만들 것이 없다. html 이 app.js 보다 먼저 싣고 `heartbeat.js` 가 `TwHeartbeatPolicy.fullStep(...)` 을 부른다. 창 보임은 main 이 `companion:winShown`(preload `onWinShown`)으로
  minimize · restore · hide · show · focus · 불러오기 끝에 바뀔 때만 알린다 — `backgroundThrottling:false` 라 `document.hidden` 은 최소화에도 안 바뀐다.
- **내놓는 것**: `fullStep({ shown, sinceFull })` → true 면 잰다 · `HIDDEN_FULL_EVERY_MS`(1000 — 숨김 중에도 이 간격마다 한 번은 잰다).
- **함정**: «모름»(신호 전 · `null`)은 보임으로 친다 — 확인 못 한 채 빼면 클릭 통과 판정 재료가 낡는다. 칸을 빼면 main 은 마지막 값을 그대로 둔다(덮지 않음).
  런처에서는 `__uiRegions` 가 이미 빈 목록이라 여기서 따로 보지 않는다.
- **검사**: `checks/sim-heartbeat-policy.js` — 판단 표(경계값) · 하트비트(`heartbeat.js`)를 가짜 타이머로 돌려 «보임 → 숨김 → 복귀» · main 알림을 가짜 창으로 돌려 보기 · 깨 보기.

## heartbeat.js — 🩺 0.1초 하트비트

- **책임**: 100ms 마다 main 에 `companion.setCharBounds` 를 보낸다 — 캐릭터 원 · `moveAge`(mousemove 가 마지막으로 온 지) · 우리 창 사각형 · 남의 좌석 원 · `charBad`.
  main 은 이것을 렌더러 생존 신호 · 클릭 통과 회수 · 펜 근접 판정에 쓴다. 창 보임(`companion.onWinShown`)을 구독해 무거운 칸을 뺄지는 `heartbeat-policy.js` 에 묻는다.
- **만드는 법**: `TwHeartbeat.createHeartbeat(deps)` — app.js 원래 자리(`_twMoveSeenAt` · `runCost` 선언 바로 뒤)에서 만든다. 만들 때 구독 하나 · 타이머 하나를 건다.
  - 값: `runCost`(app.js 의 `TwRunCostDiag.page` 한 벌 — 프레임 · desktop-run · room-entry 와 같은 것)
  - 읽는 함수: `_charBoundsLatest` · `_charBadWhy`(status-chip.js 가 쓴다) · `_twMoveSeenAt`(desktop-run.js 가 쓴다)
  - 함수: `otherSeatCircles`(= `statusChipMod.otherSeatCircles`)
- **내놓는 것**: 없음.
- **함정**: `_charBoundsLatest` 객체에 칸을 덧붙이지 않는다 — 다음 주기에도 다시 쓰는 값이라 매번 새 객체로 보낸다. 주기 100ms 는 main 생존 신호의 기준이다.
- **검사**: `checks/sim-heartbeat.js` — 모듈 모양 · 만들 때 구독 · 타이머 · app.js 연결 · 깨 보기. 보내는 값은 `sim-heartbeat-policy.js` 2절이 돌려 본다.

## run-diag-minute.js — 🩺 1분 진단 줄

- **책임**: 1분마다 `companion.diagNote` 로 진단 기록(tw-mouse-diag.log)에 두 줄 — `[비용]`(그리기 밖 시간 · 좌석 · 방 종류) · `[프레임]`(그린 장 · 상한 · 배율 · 캔버스 · 화질 + GPU · JS 꼬리).
  실행 화면(`runmode`)일 때만 적지만, 1분 몫(`takeMinute` · `_gpuTimer.take` · `_frameJsStats.take` · `runCost.take`)은 늘 비운다.
- **만드는 법**: `TwRunDiagMinute.createRunDiagMinute(deps)` — app.js 원래 자리(프레임 상한 · 포커스 연결 뒤, `function frame` 앞)에서 만든다. 만들 때 60초 타이머 하나를 건다.
  - 값: `_FB`(FrameBudget) · `_frameBudget`(없으면 null — 그때는 아무것도 안 한다) · `_gpuTimer` · `_frameJsStats` · `runCost` · `hitShadow` · `renderer` · `canvas` · `scene` · `key` · `seats` · `Presence`
  - 읽는 함수: `_renderQuality` · `_runLowered`(program-settings · 자동 낮춤이 다시 대입한다)
  - 함수: `_frameCap` · `_bodyHidden`(= `hiddenSeatsMod._bodyHidden`)
- **내놓는 것**: 없음.
- **함정**: 줄 모양은 `frame-budget.js`(`diagLine`) · `gpu-timer.js`(`suffix`) · `run-cost-diag.js`(`line`) · `hit-shadow.js`(`lines`)가 정한다 — 여기서 글을 만들지 않는다. `[비용]` 줄은 `[프레임]` 줄 바로 앞에, `[지도]` 줄들은 `[프레임]` 뒤에 적는다.
- **검사**: `checks/sim-run-diag-minute.js` — 모듈 모양 · 가짜 타이머로 한 번 돌려 보기(실행 화면 아님 · 맞음 · 상한 모듈 없음 · 그림자) · app.js 연결 · 깨 보기. 줄 내용은 `sim-frame-budget` · `sim-gpu-timer` · `sim-run-cost-diag`.

## hit-map.js — 🗺️ 클릭 통과 히트 맵(순수 계산)

- **책임**: 좌석 조각의 경계 구(월드 가운데 · 반지름)를 화면 사각형(CSS px — 통과 판정이 ndc 를 만드는 캔버스 사각형 기준)으로 투영하고, 그 사각형들로 «이 점을 덮는 조각 · 좌석» 을 답한다. three r128 `Mesh.raycast` 가 첫 거르기로 쓰는 바로 그 구라 «사각형 밖 ⇒ 광선도 못 맞춤» 이 식으로 성립한다. 설계: tw-docs `design/app/hit-map.md`.
- **모양**: 순수 모듈 `window.TwHitMap` + `module.exports`(main 이 나중에 require — click-through-policy.js 와 같은 모양). THREE · DOM · 좌석을 모른다 — 숫자만 받는다.
- **내놓는 것**: `sphereRect` · `createMap` · `reset` · `addSphere` · `addFull` · `candidates` · `pointIn` · `fresh` · `skipWhy` · 상수 `HIT_MAP_PAD_PX`(8) · `HIT_MAP_STALE_MS`(250) · `EMPTY` · `RECT` · `FULL`.
- **함정**: 모르면 «전체»(카메라가 구 안 · 원근이 아닌 투영 · NaN · 캔버스 넓이 0) — «모른다» 를 «멀다» 로 바꾸지 않는다. 카메라 뒤 구만 «없음». 화면 밀기(`setViewOffset`)도 투영 행렬 모양 그대로 받는다.
- **검사**: `checks/sim-hit-map.js` — 진짜 three 로 구 위의 점 · 사각형 밖 광선 · 경계 · 깨 보기.

## hit-shadow.js — 🗺️ 히트 맵 그림자 운행의 셈 · 1분 `[지도]` 줄

- **책임**: 0.12.4 는 통과 판정의 답을 옛 판정이 정하고, 새 판정(`room/seat-hit-targets.js` `pick`)을 옆에서 돌려 세기만 한다. 같음 · 지도만통과(옛 맞음 · 새 못 맞음 — 샘) · 지도만받기 · 건너뜀 · 전체(지도를 못 만들어 모든 좌석에 광선) · 오류 · 구간(먼 · 근처 · 위 — 옛 답 기준 횟수 · 옛 판정 시간) · 새 판정 시간(지도 만들기 포함) · 지도 만든 횟수 · 판정당 비율 · 만들기 시간 · 좌석 · 조각 · 삼각형 · 모르는 조각 · 더함 초당.
- **모양**: `window.TwHitShadow = { createHitShadow({ now }), line, detailLine, lines, … }`. app.js 가 하나 만들어(`hitShadow`) 지도 만들기(`noteBuild`) · desktop-run(`record` · `allow`) · 1분 진단(`take`)에 같은 것을 넘긴다.
- **함정**: 새 판정은 옛 판정을 한 번 더 도는 셈이라 광선 · 지도 만들기 몫은 1초 창마다 `BUDGET_MS`(10ms)까지만 쓰고 넘으면 건너뛴다(`allow` — 건너뛴 판정은 지도도 다시 안 만든다). 그림자는 받기 · 통과를 main 에 보낸 뒤 `_updateIgnore` 끝에서 돈다(desktop-run `_shadowArm` · `_hitShadowRun`) — 받기가 늦지 않고 `[비용]` 의 통과 시간에 안 든다(옛 판정만의 시간으로 0.12.4-beta.0 과 견준다). 다를 때 줄(`[지도✗]`)은 종류마다 1분에 첫 번째 하나. 줄은 200자 안.
- **끝내는 조건**: 설계 3-4 — 7일 · PC 10대 넘게 · 지도만통과 0 · 지도만받기 0 · 지도 만들기 평균(좌석 8) 0.2ms 아래. 설계와 다른 점: 지도를 판정이 찾을 때 만들어서 «낡음» 칸이 없고 «만듦 · 판정당 %» 를 적는다. 채우면 둘째 PR 에서 `pick` 이 답을 정한다.
- **검사**: `checks/sim-hit-shadow.js` — 셈 · 줄 모양 · 예산 · desktop-run 을 가짜 창에서 만들어 mousemove 로 «통과 결과는 옛 판정대로» · app.js 연결 · 깨 보기.

## oss-licenses.js — 📄 오픈소스 라이선스 창
- 책임: «개인정보 처리방침» 옆 링크 둘(⚙️ 설정 › 시스템 › 프로그램 정보 `#progOssLink` · 내 정보 맨 아래 `#miOssLink`)을 누르면 고정 크기 창(`OSS_WIN` 440×460 · 화면이 작으면 92vw / 80vh 안으로)에 목록을 보인다. 한 줄 = 이름(누르면 홈페이지) · 판 · 라이선스 칩 · [원문] 펼치기. 목록 · 원문은 창 안에서만 스크롤.
- deps: `document` · `window` · `links`(a 요소 목록 — 없는 것은 건너뜀) · `openUrl`(시스템 브라우저로 열기) · `escRegisterWindow`(ESC 스택) · `load`(검사용 — 기본은 `app/licenses/oss-notices.js` 를 처음 열 때 싣기).
- 내놓는 것: `open` · `close` · `isOpen` — 밖에서 부르는 곳 없음(app.js 가 프로그램 설정 바로 뒤에서 만들기만).
- 목록 만들기: `npm ci` 뒤 `node scripts/third-party-notices.js` → `app/licenses/oss-notices.js`(`window.TwOssNotices` · 손으로 고치지 않는다). 줄은 `VENDOR` + 앱이 직접 쓰는 npm 패키지, 하위 패키지는 그 줄 원문 안으로. 의존성을 바꾼 PR 에서 다시 돌린다 — `sim-oss-licenses.js` 가 lock 운영 패키지를 다 덮지 않으면 빨강.
- 함정: 창은 처음 열 때 한 번 만들고 숨기기만 한다(ESC 스택이 늘 있는 요소를 본다). 프로그램 설정 위에서 연 이 창 안 클릭이 설정을 닫지 않게 하는 예외는 `shared/outside-close.js`. 이름 · 원문은 `textContent` 로만. npm 밖에서 넣은 것(app/vendor · 아이콘 · Electron)은 스크립트의 `VENDOR` 에 손으로 더한다.

## reload-reset.js — 🪟 화면을 다시 불러오기 전에 창을 런처로

- **책임**: 메인 창 화면이 다시 불러와질 때(렌더러가 죽어 다시 불러옴 · 화면이 스스로 다시 불러옴 등 어느 길이든) 창을 먼저 런처 크기로 되돌릴지 정한다(순수 판단 · main.js 가 require). 창 맞추기 자체는 main.js `_resetWindowForReload`.
- **만드는 법**: main.js `_watchRendererHealth` 가 창마다 `ReloadReset.createReloadReset({ reset })` 한 벌.
- **내놓는 것**: `onFinishLoad()`(did-finish-load) · `onNavigate()`(did-navigate — 메인 프레임이 실제로 다른 문서로 넘어감 · 다시 불러오기 포함) · `beforeReload()`(렌더러 사망 길 — 다시 불러오지 않을 때도 덮인 채 두지 않게).
- **함정**
  - `did-start-navigation` 을 쓰지 않는다 — main 이 막는 이동(바깥 링크 · file:// 밖 · blob:)에도 시작은 와서, 화면은 그대로인데 실행 화면이 런처 크기로 끼어 버린다.
  - 처음 로드 · 해시 이동(did-navigate-in-page)은 되돌리지 않는다.
  - 한 로드 사이에는 한 번만 되돌린다 — 사망 길이 먼저 되돌리고 이어서 다시 불러와도 두 번 안 한다.
  - 검사: `checks/sim-renderer-gone-reset.js`(죽음 · 다시 불러오기 · 막힐 이동의 시작 차례를 가짜 창에서 실제로 돌림 · 깨 보기).

## app-mode.js — 🖥 런처 ↔ 실행 화면 전환

- **책임**: `appMode`(run · editseat) · `applyAppMode`(좌석 슬라이더 · 상태 미리보기 · 제목 · 창 크기 맞춤 부르기) · `launchApp`(내 좌석 다시 만들기 · 방 친구 복원 · 방에 나간 def 와 달라졌을 때만 새 def 를 방에 보냄 · 솔로 자리 추가 복원 · Tab 힌트) · `backToLauncher`(꾸미기 · 마이홈 닫아 저장 · 포커스 · 달성표 · 가챠 서버 맞추기) · «런처로» 버튼.
- **만드는 법**: `TwAppMode.createAppMode({ … 21개 })` — 읽는 함수 6(`curSlot` · `focusLevelMod` · `gachaMod` · `Presence` · `roomEntryMod` · `weeklyChal`) · 함수 3(`applyDesktopRunClass` · `toast` · `layoutSeats`) · 쓰는 함수 1(`setMyHomeOpen`) · 값 11. 원래 자리(설정 패널 «캐릭터» 탭 안내 뒤)에서 만든다.
- **내보내는 것**: `appMode`(읽는 함수 — app.js 는 `appModeMod.appMode()`) · `showEl` · `applyAppMode` · `launchApp` · `backToLauncher`.
- **함정**: `layoutSeats` 는 맨 아래에서 감싸 다시 대입되므로 `(...a)=>layoutSeats(...a)` 로 넘긴다(값으로 넘기면 감싸기 전 함수가 굳는다). 검사: `checks/sim-app-mode.js`.

## office-mode.js — 🏢 데스크탑 · 피규어 · 회사원 모드 깃발

- **책임**: `desktopMode` · `figureMode` · `officeMode`(저장 키 `tw.figureMode` · `tw.officeMode`) · `setOfficeHidden`(body.office-hidden · ■ 버튼 표시 · 칩 팝업 닫기) · `refreshOfficeChipUI` · 상태칩 ■ 우클릭 연결 · `window.__officeDiag`(읽기만).
- **만드는 법**: `TwOfficeMode.createOfficeMode({ chipPopupsMod })` — 값 하나. 원래 자리(데스크탑 모드 구역)에서 만든다.
- **내보내는 것**: `desktopMode` · `FIGURE_MODE_KEY` · `OFFICE_MODE_KEY` · `refreshOfficeChipUI`(값 · 함수) · `figureMode` · `officeMode` · `_officeHidden`(읽는 함수) · `setFigureMode` · `setOfficeMode`(쓰는 함수).
- **함정**: 만들 때 깃발을 읽고 `refreshOfficeChipUI()` 를 부른다 — 깃발을 최상위에서 읽는 app.js 줄(`focusGateSleep` 등)은 만드는 줄 아래에 둔다(TDZ — `checks/smoke.js` 가 잡는다). 검사: `checks/sim-office-mode.js`.

## frame-pace.js — 🔋 프레임 상한 · rAF 멈춤 감시

- **책임**: `FrameBudget` 만들기 · «자동» 화질 감시 · `_gpuTimer`(1분 `[프레임]` 줄 꼬리) · `_uiHot`(손댐 상한 해제) · `_fbIsBusy`(입력칸 · 꾸미기 · 춤 · 생성기 — 0.5초에 한 번만 DOM 을 봄) · `_frameCap` · `_frameCapped` · rAF 가 1초 넘게 안 오면 타이머가 `frame()` 을 대신 돌림 · 포커스 · 손댐 듣기.
- **만드는 법**: `TwFramePace.createFramePace({ … 8개 })` — 읽는 함수 2(`_flyActive` · `creatorOpen`) · 함수 1(`frame`) · 쓰는 함수 1(`setRunLowered`) · 값 4. 원래 자리에서 만든다 — 타이머 · 듣기가 이때 걸린다.
- **내보내는 것**: `_FB` · `_frameBudget` · `_runSlowWatch` · `_gpuTimer` · `_frameJsStats` · `_lowerRunQuality` · `_uiHot` · `_frameCap` · `_frameCapped` · `_lastRafAt`(읽는 함수) · `setLastRafAt`.
- **함정**: `mousemove` 는 «손댐» 으로 세지 않는다(클릭 통과 중에도 들어와 30 ↔ 60 이 오르내림). `frame()`(app.js)이 rAF 가 실제로 온 시각을 `setLastRafAt` 으로 알린다. 검사: `checks/sim-frame-pace.js`.

## frame-loop.js — 🎞 프레임 한 장

- **책임**: `frame(now, manual)`(rAF 콜백)과 `prev` — rAF 시각 알림 · 프레임 상한 건너뜀 · dt · 좌석마다(상태 판정 → 자세 → 올라타기 · 벤치 · 자리비움 → 라벨 · 경험치 바 · 이름표 · 말풍선) · 3D 그리기 · 히트 맵 표시 · 상태칩 위치 · 비용 재기.
- **만드는 법**: `TwFrameLoop.createFrameLoop({ … 50개 })` — 읽는 함수 여섯(`_renderQuality` · `awayPicMod` · `desktopMode` · `expBarMod` · `focusLevelMod` · `officeModeMod`) · 나머지는 값. 원래 자리에서 만든다 — 만들기만 하고 부르지 않는다.
- **내보내는 것**: `frame` — app.js 는 같은 이름 const 로 받는다. 첫 `requestAnimationFrame(frame)` 은 app.js INIT, 타이머 대행은 `frame-pace.js`.
- **함정**: 좌석 한 명 몫(`seat-frame`)을 따로 떼는 일은 글 그대로 옮기기로는 안 된다(`continue` → `return` 등) — R5 로 남김. 이름표는 경험치 바 뒤 · 말풍선은 이름표 뒤 순서를 바꾸지 말 것. 검사: `checks/sim-frame-loop.js`.

## move-mode.js — ✥ 프로그램 이동 모드 · 🩺 캐릭터 화면 좌표

- **책임**: `moveMode` · `_moveModeJustToggled` · `_suppressNextContextMenu` 깃발 · `bindMoveMode`(mousemove 로 카메라 pan 이동 · pointerdown(capture)으로 확정 · 위치 저장) · `_charBoundsLatest` · `_charBadWhy` · `_charProjSane` · `_twMoveSeenAt`(하트비트로 main 에 보냄).
- **만드는 법**: `TwMoveMode.createMoveMode({ … 6개 })` — 값 넷 · 함수 둘(`layoutSeats` · `toast`). 원래 자리에서 만든다 — 듣기가 이때 걸린다.
- **내보내는 것**: `_charProjSane`(함수) · 값 여섯은 읽는 함수 `이름()` + 쓰는 함수 `set이름(v)`.
- **함정**: 확정 pointerdown 은 capture 로 클릭 통과 로직보다 먼저 잡는다. 검사: `checks/sim-move-mode.js`.

## window-mode.js — 🪟 창 모드 정하기 · 활성 앱 판정

- **책임**: `_applyActiveAppState`(포커싱 어플 폴링 결과로 누적 시간 · 게이트 · 달성표 · 자기 창 · 펜 앱을 갱신) · `myHomeOpen`(마이홈이 런처에서 열려 있는가) · `applyDesktopRunClass`(화면을 보고 `runmode` · `config` 클래스 · 바닥 · 그림자를 정하고 main 에 창 모드 creator · myhome · launcher · run 을 보낸다). 판단은 옛 그대로(F2 의 바탕).
- **만드는 법**: `TwWindowMode.createWindowMode({ … 12개 })` — 읽는 함수 하나(`creatorOpen`) · 쓰는 함수 하나(`setFocusGateSleep`) · 값 열. 원래 자리(데스크탑 실행 화면 구역 머리 앞)에서 만든다.
- **내보내는 것**: `_applyActiveAppState` · `applyDesktopRunClass`(app.js 가 같은 이름 const 로) · `myHomeOpen()` · `setMyHomeOpen(v)`.
- **함정**: `applyDesktopRunClass` 는 «누군가 불러줘야» 한다 — 오버레이를 여는 새 길이 생기면 여기도 부를 것. 여는 쪽 플래그가 아니라 화면(오버레이 `.on`)을 본다. 검사: `checks/sim-window-mode.js`.

## run-boot.js — 🚀 켜는 차례 표

- **책임**: app.js INIT 덩이의 차례를 표(`STEPS`) 한 곳으로 모은다 — 좌석 탭 → 앱 모드 → 관리자 UI → 라이선스 글 → 마이홈 시작 → 기본 몸 불러오기 → 프레임 루프 → 런처 루프 → 얼굴 복구 점검 → 창 크기 맞춤. 앱 FSD 분리 F3 · 0.13 `launcher/app-boot.js` 와 같은 모양(계정 없이 도는 몫만 — 계정 기능의 만들기 · 시작은 0.13 몫).
- **만드는 법**: `TwRunBoot.createRunBoot({ starts, baseBody })` — `starts` 는 표에서 `baseBody` 를 뺀 아홉 이름마다 시작 함수 하나(없거나 남으면 만들 때 던진다), `baseBody` 는 `{ load, loadSkins, loadSlots, renderLauncher, onFailed }`. app.js 가 INIT 자리에서 만들고 `runBoot.begin()` 을 한 번 부른다.
- **함정**: 만들 때는 일하지 않는다 — `begin` 이 부를 때만 돈다(두 번째 `begin` 은 아무것도 안 하고 false). 한 칸이 던져도 다음 칸은 돈다(예전엔 INIT 한 줄이 던지면 뒤 줄이 통째로 안 돌았다). 기본 몸을 못 읽으면(`load` 가 false) 안내(`E-SYS-08`)를 한 번 띄우고 대신 몸으로 이어 간다 · 읽다 던져도 런처는 그린다. INIT 위치를 옮기지 말 것 — 뒤에서 만드는 모듈(투게더룸 초대 UI · 서버 모듈 감시견)은 INIT 이 안 부른다. 검사: `checks/sim-run-boot.js`.
