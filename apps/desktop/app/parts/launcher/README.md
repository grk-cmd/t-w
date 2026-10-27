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
- 책임: «개인정보 처리방침» 옆 링크 둘(⚙️ 설정 › 정보 › 프로그램 정보 `#progOssLink` · 내 정보 맨 아래 `#miOssLink`)을 누르면 고정 크기 창(`OSS_WIN` 440×460 · 화면이 작으면 92vw / 80vh 안으로)에 목록을 보인다. 한 줄 = 이름(누르면 홈페이지) · 판 · 라이선스 칩 · [원문] 펼치기. 목록 · 원문은 창 안에서만 스크롤.
- deps: `document` · `window` · `links`(a 요소 목록 — 없는 것은 건너뜀) · `openUrl`(시스템 브라우저로 열기) · `escRegisterWindow`(ESC 스택) · `load`(검사용 — 기본은 `app/licenses/oss-notices.js` 를 처음 열 때 싣기).
- 내놓는 것: `open` · `close` · `isOpen` — 밖에서 부르는 곳 없음(app.js 가 program-settings 만드는 줄 바로 뒤에서 만들기만).
- 목록 만들기: `npm ci` 뒤 `node scripts/third-party-notices.js` → `app/licenses/oss-notices.js`(`window.TwOssNotices` · 손으로 고치지 않는다). 줄은 `VENDOR` + 앱이 직접 쓰는 npm 패키지, 하위 패키지는 그 줄 원문 안으로. 의존성을 바꾼 PR 에서 다시 돌린다 — `sim-oss-licenses.js` 가 lock 운영 패키지를 다 덮지 않으면 빨강.
- 함정: 창은 처음 열 때 한 번 만들고 숨기기만 한다(ESC 스택이 늘 있는 요소를 본다). 설정 창(정보 탭) 위에서 연 이 창 안 클릭이 설정을 닫지 않게 하는 예외는 `settings-panel.js` 의 바깥 클릭 예외 목록(`FS_KEEP_OPEN_SEL`). 이름 · 원문은 `textContent` 로만. npm 밖에서 넣은 것(app/vendor · 아이콘 · Electron)은 스크립트의 `VENDOR` 에 손으로 더한다.

## settings-panel.js — ⚙️ 설정 창 하나(런처 · 실행 화면 공용)
- **책임**: 설정 창(`#focusSettingsPanel`) 여닫기 · 탭 다섯(디스플레이 · 캐릭터 · 포커싱 · 방 연결 · 정보) · ⓘ 설명 접기 · 바깥 클릭 닫기, 그리고 디스플레이(모니터 · 표시 옵션 · 프로그램 크기 · 레벨/이름 크기 · 창 위치) · 캐릭터(교체 · 자리 추가 · 배율 · 좌석 간격 · 표시 옵션) · 포커싱(어플 칸) 칸의 동작 · 광고 배너.
  런처에서 열면(`isLauncherShown`) 가운데에 `.fs-in-launcher` 로 뜨고 실행 화면 전용 칸(`.fs-run-only` — 광고 · 캐릭터 교체 칸 · 아래 버튼)은 숨는다, 런처 전용 안내(`.fs-launcher-only`)가 보인다.
- **deps**: 함수 · 값 · 읽는 함수 · 쓰는 함수 — 목록은 `checks/sim-settings-panel.js` 의 `GLUE`. 이번에 더한 것: `isLauncherShown`(읽는 함수).
- **내놓는 것**: `onTabShown(fn(탭))` — 탭을 보일 때 부를 것을 건다(program-settings.js 가 건다 — 이 모듈은 그쪽을 모른다, 서로 부르면 순환) · `openSettings(탭?)` — 탭 `'display' | 'char' | 'focus' | 'room' | 'info'`, 안 정하면 이번 실행에서 마지막에 본 탭(처음은 디스플레이) · `closeSettings()` · `nameplateClamp` · `nameplatePct`(이름표 크기 규칙 — 10~26px, 기본 15px = 100%) · 자리 추가 · 광고 배너 이름들.
- **함정**: 다른 곳 버튼(런처 ⚙️ 설정 · 꾸미기 라이선스 안내)이 창을 연 그 클릭이 문서까지 올라와도 닫지 않게 «클릭 전에 열려 있었나» 를 캡처 단계에서 본다. 새 창을 만들었는데 그 창 위 클릭이 설정을 닫으면 안 되면 `FS_KEEP_OPEN_SEL` 에 더한다. 런처에선 끌기를 막는다(옮긴 자리가 실행 화면까지 따라간다).
- **검사**: `checks/sim-settings-panel.js` — 모듈 모양 · app.js 연결 · 여닫기 · 탭 기억 · ⓘ · 이름표 크기 경계 · 깨 보기.

## program-settings.js — ⚙️ 설정 창의 «프로그램» 칸
- **책임**: 설정 창 안의 테마 · 실행 화면 화질 · 자동 실행 · 회사원 · 피규어 모드 · 영상 겹침 실험 · 라이선스 · 프로그램 정보 칸 동작. 창 · 탭은 settings-panel.js 하나다.
- **deps**: `openSettings` · `closeSettings` · `onTabShown`(settings-panel.js) 외 목록은 `checks/sim-program-settings.js` 의 `GLUE`.
- **내놓는 것**: `refreshTab(탭)` — 탭을 보일 때 그 탭의 칸을 다시 그린다(만들 때 `onTabShown` 에 건다) · `openProgramSettings(탭?)` · `closeProgramSettings()` — 옛 탭 이름(`license` → 정보 · `display` · `system` → 디스플레이)도 받는다. twNav `PROGRAM_SETTINGS` · `PROGRAM_SETTINGS_CLOSE` 를 여기서 건다.
- **함정**: 영상 겹침 실험 칸은 통로가 있는 앱에서만 보인다 — 실험이 성공하면 칸 · 배선 · preload · main IPC 를 함께 걷는다.
- **검사**: `checks/sim-program-settings.js` — 모듈 모양 · 옛 탭 이름 · 탭 다시 그리기 · 버전 칸 · 깨 보기.
