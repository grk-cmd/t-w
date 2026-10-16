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
