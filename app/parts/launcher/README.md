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
  - 값: `slots` · `CHAR_Z` · `RIG_TURN` · 조명 상수(`_MAIN_LIGHT_*` · `_KEY_LIGHT_MUL` · `_FILL_LIGHT_MUL`) · `scene` · `commSceneCache`
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
  프레임 높이는 파츠를 뺀 몸 박스로 잰다 — 파츠까지 넣으면 파츠가 튈 때 캐릭터가 작아진다.
- **검사**: `checks/sim-launcher-preview.js` — 모듈 모양 · 연결 · 깨 보기 + 렌더러 한 번만 · 도트 배율 · 경계(0 · 아주 작은 칸) · 카메라 거리 역산 · 비우기.

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
