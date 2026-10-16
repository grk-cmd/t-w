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
