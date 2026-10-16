# creator/ — 캐릭터 생성기

모듈마다 절 하나. 모양은 모두 같다 — `window.TwXxx = { createXxx(deps) }`, app.js 가 원래 구역 자리에서 `const xMod = TwXxx.createXxx({ … })` 로 만든다.

**생성기 상태는 app.js 에 있다** — `cRenderer` · `cScene` · `cCam` · `cBase` · `creatorOpen` · 조명(`cAmb` · `cKey` · `cFill`) · 책상(`cDesk` · `cDeskMat` · `cFloor`) ·
카메라 궤도(`camDist` · `camYaw` · `camPitch` · `camTarget`) · 얼굴/몸 중심과 거리. 그리기 · 책상 세팅 · 기즈모 · `character/animal.js` 가 같이 읽고 쓰기 때문이다.
아래 세 모듈은 이것을 읽는 함수(`cBase: ()=>cBase`) · 쓰는 함수(`setCBase: (v)=>{ cBase = v; }`)로 받는다.
여는 입구 `openCreator(mode)` 도 app.js 에 남는다 — 여러 모듈이 부르고 동물 생성기로 되돌리는 연결 자리라 모듈로 옮기면 순환이 생긴다(sim-dep-cycles).

## creator-preview.js — 🧍 생성기 미리보기(3D)

- **책임**: 미리보기 렌더러 · 씬 · 조명 만들기(`ensureCreatorPreview` — 처음 한 번), 카메라 궤도(`updateCreatorCam` — 단계별 각도 기억), 캐릭터 크기 · 자리 맞춤(`fitCreator('edit'|'app')`),
  책상 프레이밍(`frameDeskCam`), 베이스 갈아끼우기(기본 · 커미션 · 🐾 동물), 팔 각도(`applyStaticHandRest`), 책상 아이템 · 파츠 걷기, 생성기 조명(`updateCreatorLights` · 원색 보기 `crFlatView`).
- **만드는 법**: `TwCreatorPreview.createCreatorPreview(deps)` — 생성기 상태 읽는 · 쓰는 함수, 조명 상수(`LIGHT_PRESET` · `FLAT_EMISSIVE` …), 3D 도우미(`instantiateBase` · `normalizeModel` · `measureCharBox` …), `matToneMod`.
- **내놓는 것**: 위 함수들 + `RIG_TURN`(앱 좌석과 같은 기본 바라보는 각도) · `crFlatView`(없으면 null) · `creatorLoop`.
  ```js
  creatorPrevMod.ensureCreatorPreview();
  creatorPrevMod.fitCreator(crStep<=4 ? 'edit' : 'app');
  creatorPrevMod.clearHolderDeskItems(seat);   // 실행 좌석 · 런처에도 쓴다
  ```
- **확장할 때**: 새 베이스 종류는 `swapCreatorBaseTo*` 와 같은 모양(옛 group 갈기 → 메쉬 참조 · 본 다시 뽑기 → 얼굴 기하 캐시 → normalize → applyCreatorXform).
  조명 세기는 `LIGHT_PRESET` · `_KEY_LIGHT_MUL` · `_FILL_LIGHT_MUL`(실행 화면과 같은 몫).
- **함정**: `fitCreator` 의 앞뒤(z) · 바닥 맞춤은 실행 화면 `fitModel` 과 짝이다 — 한쪽만 바꾸면 생성기와 실행 화면이 어긋난다.
  베이스를 갈면 메쉬 참조 · 본 · 얼굴 기하(대칭 붓의 축)를 반드시 다시 채운다. 파츠 걷기는 등록부를 먼저 비우고, `_equipSeq` 는 지우지 않는다.
- **검사**: `checks/sim-creator-preview.js` — 모양 · 연결 · 깨 보기 + 조명 세기 · 색 · 궤도 위치 · 단계별 각도 기억 · 팔 각도(사람 · 동물 · 타이핑) · 아이템 · 파츠 걷기.

## creator-flow.js — 🧍 생성기 단계 · 닫기

- **책임**: 단계 이동(`gotoStep(n)` — 1 피부 · 2 표정 · 3 감은눈 · 4 색 · 5 책상 · 6 좌석: 보이는 칸 · 탭 잠금 · 카메라 각도 복원 · 커미션/동물 막기)과 닫기(`closeCreator` — 런처 복귀 판단).
- **만드는 법**: `TwCreatorFlow.createCreatorFlow(deps)` — 생성기 상태 읽는 · 쓰는 함수, `creatorPrevMod`(값), 그리기 쪽 함수(`isDrawStep` · `blit` · `setStampMode` …), `_editRoute`(편집 길).
- **내놓는 것**: `gotoStep(n)` · `closeCreator()`. 만들 때 [✕] 버튼에 `closeCreator` 를 건다.
- **확장할 때**: 단계를 늘리면 `crSteps` · `crStages` 탭 수, `n<6` · `n===6` 같은 끝 단계 판정, 카메라 기억(1~3 얼굴 · 5~6 책상 — creator-preview 의 `updateCreatorCam` 과 짝)을 같이 고친다.
- **함정**: 런처 복귀는 `kind` 가 아니라 openCreator 가 적어 둔 `cameFromLauncher` 로 가른다(`afterApp` 제외).
- **검사**: `checks/sim-creator-flow.js` — 모양 · 연결 · 깨 보기 + 단계마다 보이는 것 · 감은눈 복사 · 커미션 잠금 · 편집 길 · 각도 복원 · 닫기 · 런처 복귀.

## creator-save.js — 🧍 생성기 완료

- **책임**: 지금 상태 → def(`_creatorBuildDef` — 커미션 · 꾸미기 파츠 · 귀 · 동물 칸 이어받기, 기본값은 저장 안 함), 디자인 용량 재기(`_creatorSizeGrow` · `_defSizeFile` — def-size.js), [완료] 버튼(저장 칸 고르기 · 빈 얼굴 확인 · 실행 좌석 반영).
- **만드는 법**: `TwCreatorSave.createCreatorSave(deps)` — 생성기 상태 읽는 함수, `slots` · `CHAR_SLOT_MAX` · `roomSyncMod` · `creatorFlowMod`(값), 슬롯 · 좌석 함수.
- **내놓는 것**: `_creatorBuildDef(forSize)` · `_creatorSizeGrow(patch)` · `_defSizeFile(restDef, addBytes)` · `DEF_SIZE_TOAST_MS`. 만들 때 [완료] 버튼에 건다.
  ```js
  const sz = creatorSaveMod._creatorSizeGrow(d => { d.deskGlb = b64; });
  if(!sz.ok){ toast(sz.message, null, creatorSaveMod.DEF_SIZE_TOAST_MS); return; }
  ```
- **확장할 때**: def 에 새 칸을 더하면 `_creatorBuildDef` 의 이어받기 목록(사람 귀 · 동물 칸)과 slotToObj/loadSlots 를 1:1 로 맞춘다. 기본값이면 저장하지 않는 규칙도 지킨다.
- **함정**: 재기용(forSize) 결과를 저장에 쓰지 않는다(그림이 복사되지 않는다). 상한은 `CHAR_SLOT_MAX` — 숫자를 박지 않는다. `confirm()` 뒤 `window.focus()` 를 빼지 않는다(audit 검사 4).
- **검사**: `checks/sim-creator-save.js` — 모양 · 연결 · 깨 보기 + def 칸 · 기본값 생략 · 카탈로그/로컬 책상 · 커스텀 아이템 · 재기 복사본 · 저장 칸(정한 칸 · 빈 칸 · 꽉 참 · 상한 · 덮어쓰기 막기) · 실행 좌석 · 빈 얼굴 확인.
