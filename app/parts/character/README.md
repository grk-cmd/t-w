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

## catalog-glb.js — 🔗 카탈로그 GLB 해결(glbUrl → rec.glb)

- **책임**: 카탈로그 인덱스엔 `glbUrl` 만 오는데 앱 곳곳은 `rec.glb`(base64)를 본다 — 쓰는 때에 채운다. 차례: 세션 메모리 → 영구 캐시(`shared/glb-idb-cache.js`) → 서버(`firebaseAPI.fetchCatalogGlb`).
- **만드는 법**: `const catalogGlbMod = TwCatalogGlb.createCatalogGlb({ glbIdbMod });`
- **내보내는 것**
  - `resolveCatalogGlb(rec)` → `Promise<b64 | null>` — 성공하면 `rec.glb` 도 채운다. `rec.glb` 가 이미 있으면 그것.
  - `resolveCatalogGlbAll(catalogObj)` → 같은 객체 — 스냅샷 전부를 나란히 채우고 영구 캐시 치우기를 부른다.
  ```js
  window.firebaseAPI.subscribeCatalogParts(async obj => { await catalogGlbMod.resolveCatalogGlbAll(obj); merge(obj); });
  ```
- **확장할 때 고칠 자리**: 받는 길이 늘면(다른 저장소) `resolveCatalogGlb` 의 서버 받기 줄 하나.
- **함정**
  - 메모리 · 영구 캐시에서 꺼낼 때도 `rec.glb` 를 채워야 한다 — 빠뜨리면 `rec.glb` 를 보는 곳이 «GLB를 불러올 수 없어요» 로 오탐한다.
  - 실패는 기억하지 않는다(다음에 다시 받는다) · 영구 캐시 넣기는 기다리지 않는다.
  - 검사: `checks/sim-catalog-glb.js`(4절 — 차례 · 실패 · 다른 rec 채우기 · 스냅샷 전부).

## catalog-sync.js — 🔄 카탈로그 실시간 동기화

- **책임**: Firebase 카탈로그 구독(아이템 · 책상 · 파츠 · 커스텀 카테고리 · 기본 카테고리 이름 덮어쓰기)을 걸고, 스냅샷이 오면 저장 목록에 합친 뒤 떠 있는 좌석 · 생성기 · 런처 · 꾸미기 미리보기에 다시 반영한다.
  - 합치는 규칙(셋 다 같다): 카탈로그 항목은 `fromCatalog:true` 로 서버판이 이기고 `order` 오름차순(없으면 9999) · `fromCatalog` 인데 목록에 없으면 관리자가 지운 것 → 좌석에서 내리고 목록에서 뺀다 · 카탈로그에 온 적 없는 로컬 항목은 뒤에 남긴다.
- **만드는 법**: app.js «🔄 카탈로그 실시간 동기화» 자리에서 `const catalogSyncMod = TwCatalogSync.createCatalogSync({ … });` — deps 40
  - 데이터 provider: `catalogNet`(읽는 함수 — 지금은 app.js 가 `()=>window.firebaseAPI` 를 넘긴다. 서버로 옮길 때 이 한 줄만 바꾼다 · 모듈은 `firebaseAPI` 를 직접 보지 않는다)
  - 저장 목록: `commissionMod`(아이템 · 책상) · `premiumMod`(파츠 · 카테고리) · GLB 해결 `catalogGlbMod`
  - 좌석에 입히기: `seats` · `customItems`(읽는 함수) · `equipDeskItem` · `clearHolderDeskItems` · `applyDeskItemsTo` · `loadSavedItemsIntoSession` · `applyDeskCatalogRefToSeat` · `swapDeskVisual` · `equipPartOnSeat` · `unequipPartFromSeat` · `applyClothVisibility` · `fitModel` · `layoutSeats` · `rideBenchMod`
  - 생성기 상태(읽는 함수): `creatorOpen` · `cBase` · `cDesk` · `cDeskColor` · `cDeskScale` · `cDeskGlbB64` · `cDeskTemplate` · `activeCustomDeskId` + 쓰는 함수 `setCDeskGlbB64` · `setCDeskTemplate`
  - 다시 그리기: `wardrobeMod` · `gachaMod` · `adminCategory` · `renderLauncher` · `renderCrItems` · `toast` · `isAdmin`
- **내보내는 것**: 없음 — 만들 때 구독을 건다(`catalogNet()` 이 아직 없으면 `firebase-ready` 를 한 번 기다린다 — 준비 신호도 나중에 provider 쪽으로).
- **확장할 때 고칠 자리**: 새 카탈로그 종류는 `mergeCatalogIntoSavedXxx` + `subscribeCatalogXxx` 한 벌 · 구독 걸기는 파일 끝 `if(catalogNet()) … else addEventListener('firebase-ready', …)` 줄. 합치는 규칙이 세 함수에 같은 글로 들어 있다 — 바꿀 땐 셋 다.
- **함정**
  - 아이템은 세션 등록(`loadSavedItemsIntoSession`)을 **기다린 뒤** 좌석을 다시 적용한다 — 순서를 바꾸면 옛 크기(0.8)로 다시 만든다.
  - 생성기에서 보던 책상 · 아이템의 위치 · 크기 조정값은 일부러 안 지킨다(자동 크기 계산을 바꿔도 보이게).
  - 파츠는 이미 붙은 것을 다시 붙이지 않는다 — 겹쳐 다는 파츠는 `stackedPartObjs` 로 판정. 새로 붙은 게 있을 때만 `fitModel` · `layoutSeats`.
  - 가챠 카탈로그 옮기기(`migrateGachaCatalog`)는 관리자 세션에서 한 번만(`window.__gachaMigrated`) · 실패하면 다음 콜백에서 다시.
  - 검사: `checks/sim-catalog-sync.js`(4절 — 구독 · firebase-ready · 세 합치기 · 좌석 · 생성기 다시 반영 · 가챠 옮기기 · 카테고리).

## desk-items.js — 🧸 책상 위 아이템 등록부

- **책임**: 카탈로그 · 코드로 받은 아이템 GLB 를 세션 등록부 `customItems` 에 올리고, 기본 내장 아이템(`DESK_ITEMS`)과 합친 목록을 준다.
- **만드는 법**: app.js «🪑 책상 · 아이템 등록» 자리에서 `const deskItemsMod = TwDeskItems.createDeskItems({ DESK_ITEMS, _applyItemMatTone, commissionMod, customItems: ()=>customItems });`
  - `customItems` 는 읽는 함수 — 생성기를 새로 열 때 app.js 가 `customItems={}` 로 다시 대입한다.
- **내보내는 것**
  - `registerCustomItem(id, name, glbB64, template, icon, animations, attachTo, autoPlay, defaultSize, glow, licenseOnly, playMode)` — `customItems[id]` 에 `{ …메타, build() }`. 인자로 안 온(null) 메타는 같은 id 의 저장 레코드에서 채우고, 그래도 없으면 기본값(`attachTo 'desk'` · `playMode 'click'`(autoPlay 면 `'auto'`) · `defaultSize 0.8`).
  - `allDeskItems()` — 커스텀이 앞 · 같은 id 의 기본 아이템은 빠진다(관리자가 기본 아이템을 같은 id 로 바꿔 낄 수 있다). `deskItemDef(id)` — 없으면 `null`.
  ```js
  deskItemsMod.registerCustomItem(rec.id, rec.name, rec.glb, scene, rec.icon||'', animations);   // 메타는 저장 레코드에서
  const def = deskItemsMod.deskItemDef('cup');
  ```
- **확장할 때 고칠 자리**: 새 메타 칸은 `registerCustomItem` 의 메타 채우기 블록과 `customItems[id]={…}` 두 곳. 기본 크기 0.8 도 여기.
- **함정**
  - `build()` 는 메쉬마다 머티리얼을 복제한다 — 빼면 친구 좌석 아이템과 색을 같이 쓴다. 본 있는 모델은 `SkeletonUtils.clone`.
  - 저장 목록 등록(`loadSavedItemsIntoSession`)은 app.js 에 있다 — 부팅 초반, 이 모듈을 만드는 줄보다 앞에서 부르기 때문.
  - 검사: `checks/sim-desk-items.js`(4절 — 기본값 · 인자 우선 · 저장 레코드로 메타 채우기 · 저장 목록 못 읽음 · build 복제 · 합친 목록).

## desk-visual.js — 🪑 책상 모양(바꿔 끼기 · 색 · 좌석 책상)

- **책임**: 책상 그룹(`deskGroup`)의 모양만 — 기본 책상 메쉬를 숨기고 커스텀 GLB 로 바꿔 끼기(톤 · `_col` 색 메쉬 모으기 · 애니메이션 재생 모드), `_col` 색, 좌석 def 의 카탈로그 책상을 찾아 그리기. 크기 · 자리는 `setDeskScale`(deps)이 맡는다.
- **만드는 법**: `const deskVisualMod = TwDeskVisual.createDeskVisual({ … });` — deps 12: `commissionMod` · `assetCodeMod` · `b64ToBuf` · `_applyItemMatTone` · `_setDeskMatColor` · `activeItemMixers` · `_idleItemPivots` · `setDeskScale` · `toast` · `DEFAULT_DESK_OVERRIDE_ID` (값 · 함수) · `isPremium` · `isAdmin` (읽는 함수)
- **내보내는 것**
  - `swapDeskVisual(deskGroup, template, isDefaultOverride, animations, playMode)` — `template` 이 `null` 이면 기본 책상으로 되돌린다. `playMode`: `'auto'`(바로 반복) · `'idle'`(`_idleItemPivots` 에 넣어 프레임 루프가 정함 — 부르기 전에 `deskGroup.userData.__seat` 를 심는다) · 그 밖(`'click'` — 한 번 · 끝에서 멈춤).
  - `applyDeskColorToCustom(deskGroup, color)` — 모아 둔 `_col` 머티리얼만.
  - `applyDeskCatalogRefToSeat(seat, def)` → `Promise` — `def.deskCatalogId` 레코드를 찾아 그린다. 없으면 기본 책상.
  ```js
  deskVisualMod.swapDeskVisual(cDesk, sc); deskVisualMod.applyDeskColorToCustom(cDesk, cDeskColor);
  await deskVisualMod.applyDeskCatalogRefToSeat(seat, seat.charDef);
  ```
- **확장할 때 고칠 자리**: 새 재생 모드는 `swapDeskVisual` 의 `playMode` 분기 · 자리 맞춤(바닥 + 0.15 · 앞뒤 0.6)은 `normalizeDeskObj`.
- **함정**
  - 라이선스 전용 책상은 **내 좌석에서만** 막는다(`!seat.remote`) — 친구 좌석에서 막으면 남이 쓴 책상이 기본 책상으로 보인다.
  - 크기를 GLB 에 굽지 않는다(원본 그대로 · 슬라이더만) — `autoScaleDeskToTarget` · `DESK_SIZE_OFFSET` 은 지금 안 쓰는 옛 몫(CONFIRM.md).
  - 검사: `checks/sim-desk-visual.js`(4절 — 바꿔 끼기 · 되돌리기 · `_col` · 자리 맞춤 · 재생 세 모드 · 색 · 카탈로그 책상 · 라이선스 · 친구 좌석 · 풀기 실패).
