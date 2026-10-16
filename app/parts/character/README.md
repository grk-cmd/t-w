# character/ — 캐릭터 · 꾸미기

캐릭터 · 꾸미기 도메인 모듈. app.js(입구)가 `createXxx(deps)` 로 만들어 이어 주고, 이 폴더 모듈끼리는 서로의 속을 직접 부르지 않는다.
절은 모듈마다 하나 — 다른 사람이 만든 절은 건드리지 않고 자기 절만 더한다.

## part-scene.js — 🧊 파츠 GLB 파싱 캐시 · 도트 썸네일

- **책임**: 카탈로그 파츠 레코드(`rec`)의 GLB 를 id 마다 한 번만 파싱해 들고 있고, 그 씬으로 32×32 도트 썸네일을 굽는다. 관리자 콘솔 다시 굽기는 `admin/admin-thumbs.js`.
- **만드는 법**: app.js «🧊 파츠 GLB 파싱 캐시 · 썸네일» 자리에서 `const partSceneMod = TwPartScene.createPartScene({ … });`
  - 톤 예산 상수 `TONE_FRONT_TOTAL` · `FLAT_EMISSIVE` · `_MAIN_LIGHT_INT` · `_MAIN_LIGHT_COL` · `_KEY_LIGHT_MUL` (값)
  - `_applyPartMatTone` · `b64ToBuf` · `resolveCatalogGlb` (함수) · `assetCodeMod` (값)
- **내보내는 것**
  - `getPartScene(rec)` → `Promise<{ scene, animations }>` — 캐시에 없으면 `rec.glb`(없고 `glbUrl` 만 있으면 먼저 받음)를 파싱. GLB 를 못 찾으면 `파츠 GLB를 찾을 수 없어요: <id>` 로 던진다.
  - `partSceneCache` — `Map(id → { scene, animations })`. 관리자가 GLB 를 바꾸면 `partSceneMod.partSceneCache.delete(id)` 로 비운다.
  - `generatePartThumbnail(rec)` → `Promise<dataURL | null>` — 실패하면 던지지 않고 `null`.
  - `_forceOpaqueAlphaOutput(mat)` — 빈 함수(옛 부르는 자리 호환).
  ```js
  const { scene } = await partSceneMod.getPartScene(rec);
  const url = await partSceneMod.generatePartThumbnail(rec);   // 등록 창 · 책상 아이템 카드
  ```
- **확장할 때 고칠 자리**: 썸네일 크기 `THUMB_SIZE` · 여백 `maxDim * 0.55` · 키 라이트 자리 `(1, 2.5, 2)` · 광량은 `THUMB_FRONT_TOTAL`(지금은 장착 화면과 같은 `TONE_FRONT_TOTAL`).
- **함정**
  - 캐시 원본 씬을 직접 물들이지 말 것 — 썸네일 · 장착은 복제본 머티리얼에만 톤을 먹인다.
  - 썸네일은 등록 때 구워 둔 것이다. 톤 · 조명 값을 바꾸면 `generateAllPartThumbnails(true)` 로 다시 구워야 보인다.
  - 관리자 모듈(`adminPartReg`)을 deps 로 받지 말 것 — 등록 모듈이 이 모듈을 부르므로 서로 부르는 순환이 된다(`sim-dep-cycles`). 관리자 몫은 `admin/` 에.
  - 검사: `checks/sim-part-scene.js`(4절 — 캐시 · 받기 · 실패 · 광량 공식 경계 · 프레이밍).

모듈마다 절 하나. 모양은 모두 같다 — `window.TwXxx = { createXxx(deps) }`, app.js 가 원래 구역 자리에서 `const xMod = TwXxx.createXxx({ … })` 로 만든다.

## mat-tone.js — 💡 재질 톤

- **책임**: 캐릭터 재질 두 가지 손질 — 얼굴 텍스처 갈아끼우기(`setFaceMap` · 🐾 동물 귀 함께) · 생성기와 같은 평탄 조명(`applyLightPresetToInstance` — 텍스처 색을 emissive 로 평탄화).
  DOM · 씬 없이 재질 객체만 만진다.
- **만드는 법**: `TwMatTone.createMatTone({ FLAT_EMISSIVE })` — 평탄 조명 배율(값) 하나만 받는다.
- **내놓는 것**:
  ```js
  matToneMod.setFaceMap(seat.faceMat, seat.blinkTex);      // 깜빡임 · 졸기 · 런처 · 복제 무대 — 귀도 같이 감긴다
  matToneMod.applyLightPresetToInstance(inst);             // 좌석 · 런처 · 종족 선택창 · 생성기가 새 모델을 올린 직후
  ```
  다른 모듈은 deps 로 받는다(`setFaceMap: (...a)=>matToneMod.setFaceMap(...a)`).
- **확장할 때**: 이름으로 갈리는 재질이 늘면(예: 새 기본 메쉬) `applyLightPresetToInstance` 의 face/up/lo/hat 줄과 같은 모양으로 더하고, 나머지는 `inst.litMats` 가 받는다.
  동물 귀 말고도 얼굴과 함께 갈아야 하는 재질이 생기면 `userData` 등록표를 늘린다(호출부에 넣지 않는다).
- **함정**: 깜빡임 스왑은 전부 `setFaceMap` 을 지나야 한다 — 호출부에서 `mat.map` 을 직접 갈면 귀만 뜬 채 남는다.
  텍스처 없는 메쉬도 평탄화해야 한다(건너뛰면 같은 흰색이 회색으로 보인다).
- **검사**: `checks/sim-mat-tone.js` — 모듈 모양 · 연결 · 깨 보기 + 가짜 재질로 입력 → 결과(맵 · emissiveMap 동기화 · 귀 감김/뜸 · 같은 그림이면 안 감 · 빠진 재질 건너뛰기 · 평탄화 배율 · 텍스처 없는 메쉬 · 색 없는 재질 · FLAT_EMISSIVE 0).
