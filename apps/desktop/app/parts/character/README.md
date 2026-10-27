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
  사람 몫(얼굴 맵 · 평탄 조명)은 캐릭터 코어 `tone.ts` 를 부르고, 🐾 동물 귀 깜빡임만 여기에 있다(웹은 사람만이라 동물은 앱 몫). DOM · 씬 없이 재질 객체만 만진다.
- **만드는 법**: `TwMatTone.createMatTone({ tone: lightToneMod.toneCore })` — 코어 재질 톤(light-tone.js 가 만든 것) 하나만 받는다.
- **내놓는 것**:
  ```js
  matToneMod.setFaceMap(seat.faceMat, seat.blinkTex);      // 깜빡임 · 졸기 · 런처 · 복제 무대 — 귀도 같이 감긴다
  matToneMod.applyLightPresetToInstance(inst);             // 좌석 · 런처 · 종족 선택창 · 생성기가 새 모델을 올린 직후
  ```
  다른 모듈은 deps 로 받는다(`setFaceMap: (...a)=>matToneMod.setFaceMap(...a)`).
- **확장할 때**: 이름으로 갈리는 재질이 늘면(예: 새 기본 메쉬) 코어 `packages/char-core/src/tone.ts` 의 `applyLightPresetToInstance` face/up/lo/hat 줄과 같은 모양으로 더하고, 나머지는 `inst.litMats` 가 받는다.
  동물 귀 말고도 얼굴과 함께 갈아야 하는 재질이 생기면 `userData` 등록표를 늘린다(호출부에 넣지 않는다).
- **함정**: 깜빡임 스왑은 전부 `setFaceMap` 을 지나야 한다 — 호출부에서 `mat.map` 을 직접 갈면 귀만 뜬 채 남는다.
  텍스처 없는 메쉬도 평탄화해야 한다(건너뛰면 같은 흰색이 회색으로 보인다).
- **검사**: `checks/sim-mat-tone.js` — 코어 빌드 사본으로 만든 진짜 톤으로 돈다 · 모듈 모양 · 연결 · 깨 보기 + 가짜 재질로 입력 → 결과(맵 · emissiveMap 동기화 · 귀 감김/뜸 · 같은 그림이면 안 감 · 빠진 재질 건너뛰기 · 평탄화 배율 · 텍스처 없는 메쉬 · 색 없는 재질 · FLAT_EMISSIVE 0).


## catalog-source.js — 🔌 카탈로그 데이터 provider(서버 이관)

- **책임**: 카탈로그 도메인(`catalog-sync` · `catalog-glb` · `admin/admin-thumbs`)이 서버에 닿는 일을 도메인 이름으로 내놓는다 — 도메인은 `firebaseAPI` 를 직접 부르지 않는다. 지금은 Firebase 판(옛 길) 하나.
- **만드는 법**: app.js 에서 세 모듈보다 먼저 한 줄 — `const catalogSourceMod = TwCatalogSource.createCatalogSource({});` → 세 모듈에 `catalogSourceMod` 로 넘긴다. deps 0.
- **내보내는 것**
  - `catalogSrcReady(fn)` — 연결이 있으면 바로, 없으면 `firebase-ready` 를 한 번만 기다려 부른다.
  - `catalogSrcCan(op)` → bool — op: `items` · `desks` · `parts` · `customCats` · `catOverrides` · `migrateGacha` · `fetchGlb` · `publishPart`.
  - `catalogSrcSubscribe(kind, cb)` · `catalogSrcMigrateGacha()` · `catalogSrcFetchGlb(url)` · `catalogSrcPublishPart(id, data)` — 인자 · 돌려받는 값(약속)을 그대로 넘긴다. 입구에서 스스로 `catalogSrcCan` 을 본다 — 연결 · 함수가 없거나 모르는 종류 · 빈 인자(콜백 · url · id · data)면 요청 없이 `null`(던지지 않음).
  ```js
  if(!catalogSourceMod.catalogSrcCan('parts')) return;
  catalogSourceMod.catalogSrcSubscribe('parts', async obj => { … });
  ```
- **확장할 때 고칠 자리**: 서버 API 판은 같은 이름 여섯을 내놓는 provider 를 하나 더 만들고 app.js 의 고르는 줄만 바꾼다(room-server-gate.js 처럼). 새 서버 일은 `CATALOG_SRC_FB_OPS` 에 이름 하나 + 함수 하나.
- **함정**
  - `firebaseAPI` 는 부를 때마다 읽는다 — 만들 때 붙잡아 두면 부팅 뒤에 생긴 연결을 못 쓴다.
  - 부르는 쪽이 `catalogSrcCan` 을 먼저 묻는 자리는 옛 «함수가 없으면 조용히 건너뜀» 동작이다. 같은 가드가 provider 입구에도 있어서 빠뜨려도 던지거나 빈 요청을 보내지 않는다 — 새 provider 판도 같은 입구 가드를 둔다.
  - 검사: `checks/sim-catalog-source.js`(모양 · 연결 · 세 모듈 직접 호출 0 · 기다리기 · 넘기기 · 입구 가드 · 늦게 생긴 연결).

## catalog-glb.js — 🔗 카탈로그 GLB 해결(glbUrl → rec.glb)

- **책임**: 카탈로그 인덱스엔 `glbUrl` 만 오는데 앱 곳곳은 `rec.glb`(base64)를 본다 — 쓰는 때에 채운다. 차례: 세션 메모리 → 영구 캐시(`shared/glb-idb-cache.js`) → 서버(`catalogSourceMod.catalogSrcFetchGlb` — provider).
- **만드는 법**: `const catalogGlbMod = TwCatalogGlb.createCatalogGlb({ catalogSourceMod, glbIdbMod });`
- **내보내는 것**
  - `resolveCatalogGlb(rec)` → `Promise<b64 | null>` — 성공하면 `rec.glb` 도 채운다. `rec.glb` 가 이미 있으면 그것.
  - `resolveCatalogGlbAll(catalogObj)` → 같은 객체 — 스냅샷 전부를 나란히 채우고 영구 캐시 치우기를 부른다.
  ```js
  catalogSourceMod.catalogSrcSubscribe('parts', async obj => { await catalogGlbMod.resolveCatalogGlbAll(obj); merge(obj); });
  ```
- **확장할 때 고칠 자리**: 받는 길이 바뀌면 provider(`catalog-source.js`) 쪽 — 이 모듈은 그대로.
- **함정**
  - 메모리 · 영구 캐시에서 꺼낼 때도 `rec.glb` 를 채워야 한다 — 빠뜨리면 `rec.glb` 를 보는 곳이 «GLB를 불러올 수 없어요» 로 오탐한다.
  - 실패는 기억하지 않는다(다음에 다시 받는다) · 영구 캐시 넣기는 기다리지 않는다.
  - 검사: `checks/sim-catalog-glb.js`(4절 — 차례 · 실패 · 다른 rec 채우기 · 스냅샷 전부).

## catalog-sync.js — 🔄 카탈로그 실시간 동기화

- **책임**: 카탈로그 구독(provider `catalogSourceMod` 를 거친다 · 아이템 · 책상 · 파츠 · 커스텀 카테고리 · 기본 카테고리 이름 덮어쓰기)을 걸고, 스냅샷이 오면 저장 목록에 합친 뒤 떠 있는 좌석 · 생성기 · 런처 · 꾸미기 미리보기에 다시 반영한다.
  - 합치는 규칙(셋이 같이 쓰는 순수 함수 `mergeCatalogList`): 카탈로그 항목은 `fromCatalog:true` 로 서버판이 이기고 `order` 오름차순(없으면 9999) · `fromCatalog` 인데 목록에 없으면 관리자가 지운 것 → 좌석에서 내리고 목록에서 뺀다 · 카탈로그에 온 적 없는 로컬 항목은 뒤에 남긴다.
- **만드는 법**: app.js «🔄 카탈로그 실시간 동기화» 자리에서 `const catalogSyncMod = TwCatalogSync.createCatalogSync({ … });` — deps 40
  - 저장 목록: `commissionMod`(아이템 · 책상) · `premiumMod`(파츠 · 카테고리) · GLB 해결 `catalogGlbMod` · 서버 `catalogSourceMod`
  - 좌석에 입히기: `seats` · `customItems`(읽는 함수) · `equipDeskItem` · `clearHolderDeskItems` · `applyDeskItemsTo` · `loadSavedItemsIntoSession` · `applyDeskCatalogRefToSeat` · `swapDeskVisual` · `equipPartOnSeat` · `unequipPartFromSeat` · `applyClothVisibility` · `fitModel` · `layoutSeats` · `rideBenchMod`
  - 생성기 상태(읽는 함수): `creatorOpen` · `cBase` · `cDesk` · `cDeskColor` · `cDeskScale` · `cDeskGlbB64` · `cDeskTemplate` · `activeCustomDeskId` + 쓰는 함수 `setCDeskGlbB64` · `setCDeskTemplate`
  - 다시 그리기: `wardrobeMod` · `gachaMod` · `adminCategory` · `renderLauncher` · `renderCrItems` · `toast` · `isAdmin`
- **내보내는 것**: 없음 — 만들 때 구독을 건다(`catalogSourceMod.catalogSrcReady` — 연결이 아직 없으면 한 번 기다린다).
  - 안쪽 순수 함수 `mergeCatalogList(catalogObj, saved, norm?)` → `{ list, removedIds }` — 저장 목록은 안 바꾼다(세 합치기가 부른다 · 검사는 글을 뽑아 직접 돌린다).
- **확장할 때 고칠 자리**: 새 카탈로그 종류는 `mergeCatalogIntoSavedXxx` + `subscribeCatalogXxx` 한 벌 · 구독 걸기는 파일 끝 `catalogSourceMod.catalogSrcReady(…)` 줄 · 서버 쪽 이름은 provider 에 하나 더. 합치는 규칙을 바꿀 땐 `mergeCatalogList` 한 곳.
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
  - 크기를 GLB 에 굽지 않는다(원본 그대로 · 슬라이더만) — 새 책상만 자동 크기를 걸던 옛 코드는 지웠다. 다시 넣지 말 것(기본 책상과 크기가 갈린다).
  - 검사: `checks/sim-desk-visual.js`(4절 — 바꿔 끼기 · 되돌리기 · `_col` · 자리 맞춤 · 재생 세 모드 · 색 · 카탈로그 책상 · 라이선스 · 친구 좌석 · 풀기 실패).

꾸미기 창 · 파츠 · 동물 · 슬롯 · 코드 · 가챠 · 좌석 크기. app.js 가 deps 로 이어 주고, 이 폴더 모듈끼리는 서로의 속을 직접 부르지 않는다.
절은 모듈마다 하나 — 다른 사람이 만든 절은 건드리지 않고 자기 절만 더한다.

## desk-place.js — 📐 책상 자리 · 크기 · 책상 위 파츠 핀

- **책임**: 책상 그룹의 자리와 크기만 — 크기 · 길이, 위치 오프셋, 동물 배율 · 평준화로 캐릭터에서 뺀 몫을 책상이 지는 z 보정, «책상 위» 파츠 핀이 책상 위치 · 슬라이더 크기를 따라가지 않게 상쇄. 평준화 깃발은 모른다(평준화 때 파츠 가두기는 `seat-eq-clamp.js`).
- **만드는 법**: app.js «🪑 책상 · 아이템 등록 · 책상 모양 바꾸기 · 크기» 끝에서 `const deskPlaceMod = TwDeskPlace.createDeskPlace({ … });` — deps 5
  - 값: `CHAR_Z` · `DESK_SCALE_MIN` · `DESK_SCALE_MAX` · `DESK_SCALE_DEFAULT` · `crState`(생성기 상태 한 벌 — `cDesk` · `cDeskLenX` 를 그때그때 읽는다)
- **내보내는 것**
  - `setDeskScale(deskGroup, scale?, lenX?)` — `scale` 을 안 주면 기억해 둔 원본(`userData.deskScaleBase`). 그룹 배율 = 원본 × `animCorr` × `eqK`(길이는 x 에만).
  - `setCreatorDeskScale(scale)` — 생성기 책상(`crState.cDesk`)에 생성기 길이로.
  - `setDeskPos(deskGroup, {x,y,z})` — 원본은 `userData.deskPosBase` 에(배율은 굽지 않는다).
  - `syncSeatDeskZ(deskGroup)` — z = base.z·a·k + CHAR_Z·(1 − a·k), 그리고 파츠 핀 상쇄.
  - `deskPartAnchorOf(seat)` · `syncDeskPartAnchor(deskGroup)` · `DESK_PART_ANCHOR_NAME`('__deskPartAnchor') — 핀 얻기 · 상쇄 다시 걸기.
  ```js
  deskPlaceMod.setDeskScale(seat.desk, def.deskScale || 1, def.deskLenX || 1);
  deskPlaceMod.setDeskPos(seat.desk, def.deskPos);
  const pin = deskPlaceMod.deskPartAnchorOf(seat); pin.add(partWrap);
  ```
- **확장할 때 고칠 자리**: 새 좌석 배율이 생기면 `seatDeskPosMul` · `seatDeskZCorr` · `setDeskScale` 의 곱셈 — 꾸미기 미리보기(`_wdDeskGrp`)도 같은 값을 직접 곱으니 함께.
- **함정**
  - 위치 곱셈은 네 자리가 한 벌 — 여기 셋(`setDeskPos` · `syncSeatDeskZ` · `syncDeskPartAnchor`) + 꾸미기 미리보기.
  - `deskPosBase` · `deskScaleBase` 에 보정 · 배율을 굽지 말 것(열 때마다 누적).
  - 크기 상쇄는 슬라이더 범위(`DESK_SCALE_MIN~MAX`) 안일 때만 — `def.deskScale||1` 의 1 은 «모름».
  - 평준화 깃발(`seatEqMod`)을 여기서 읽지 말 것 — seat-equalize 가 이 모듈을 부르므로 순환이 생긴다(sim-dep-cycles 빨강).
  - 검사: `checks/sim-desk-place.js`(4절 — 크기 · 원본 기억 · 경계 0 · 생성기 · z 보정 · 위치 배율과 경계 · 핀 상쇄 크기 · 위치) · 옛 검사 `sim-char-z` · `sim-desk-part-scale` · `sim-desk-floor-clamp` · `sim-seat-eq`.

## seat-equalize.js — 🪑 좌석 크기 평준화

- **책임**: 좌석 하나의 «실효 크기» 를 정하는 유일한 곳. 내 화면에서만 남의 좌석(자리추가 부캐 포함)을 내 캐릭터 크기에 맞춘다 — 배율 `k = 내 userScale ÷ 그 좌석 userScale`, 좌석 전체(캐릭터 · 책상 · 라벨 높이)에 같은 k. 켜고 끄는 깃발(`tw.seatEq`)도 이 모듈이 든다.
- **만드는 법**(app.js «🪑 좌석 크기 평준화» 자리):
  ```js
  const seatEqMod = TwSeatEqualize.createSeatEqualize({
    ANIMAL_RUN_SCALE, seats,                                              // 값
    clampCharY, findMySeat, fitModel, setDeskPos, setDeskScale, syncSeatDeskZ,   // 함수(화살표로)
  });
  ```
- **내보내는 것**
  - `seatScale(seat)` — 3D · 라벨 쪽에서 좌석 크기가 필요하면 **예외 없이** 이걸. 저장 · 생성기 UI(sScale · saveSeatXf · def 로드)는 반대로 raw `seat.userScale`.
  - `seatEqK(seat)` — 배율만(꺼짐 · 내 좌석 · 내 좌석 없음 · 이상한 값이면 1).
  - `charLiftWorld(seat)` — 캐릭터 높이(userY)가 월드에서 실제로 들어 올리는 양(× 동물 40% × k). 좌석을 월드 좌표로 직접 놓는 곳(올라타기)이 뺀다.
  - `syncSeatEqualize()` — k 가 바뀐 좌석에만 책상 배율 · 위치 · 앞뒤 보정 · fitModel 을 다시 건다. `layoutSeats` 첫머리가 부른다(직접 부르지 말고 layoutSeats 를).
  - `seatEqualizeOn()` · `setSeatEqualizeOn(v)` — 설정 창이 읽고 바꾼다(저장은 설정 창이 `tw.seatEq` 에).
  ```js
  seat.bodyWrap.scale.setScalar(seatEqMod.seatScale(seat));
  ```
- **확장할 때 고칠 자리**: «책상 줄까지 맞추기»(B안) · «원격만 맞추기» 는 `seatEqK` 한 곳(조건에 `|| seat.isExtra`).
- **함정**
  - `seat.userScale` 을 덮어쓰지 말 것 — 내 화면 배율이 상대 저장값으로 흘러가고 `applyCharToSeat` 때 평준화가 조용히 풀린다.
  - 동물 40%(`ANIMAL_RUN_SCALE`)는 여기 안 들어간다 — fitModel · setDeskScale 의 별개 곱셈.
  - `deskScaleBase` 가 없는 좌석(def 가 아직 안 얹힘)은 책상을 건드리지 않고 `eqK` 만 심는다.
  - 한 좌석에서 던지면 나머지 좌석을 그 바퀴에 건너뛴다 — `CONFIRM.md` 에 적어 둠.
  - 검사: `checks/sim-seat-equalize.js`(4절 — 깃발 · k · 이상한 값 · 부캐 · 들림 · 다시 걸기 · 재진입 · 던짐) · `sim-seat-eq` · `sim-char-z`(app.js 전체로).

## seat-eq-clamp.js — 🪑 평준화 가두기

- **책임**: 좌석 크기 평준화가 켜졌을 때 «책상 위» 파츠가 옆 좌석으로 넘어가지 않게 자기 자리 반폭 안으로 미는 주기 작업 하나. 자리 반폭 = 책상이 뻗은 거리(`seatDeskHalfWidth`) + 좌석 사이 여백의 절반. 평준화를 끄면 다음 차례에 되돌린다. 계산(박스 재기 · 밀기)은 `seat-slot.js`, 이 모듈은 «언제 · 어느 좌석 · 반폭 얼마» 만.
- **왜 따로**: 책상 자리 · 크기(desk-place)가 평준화 깃발을 읽으면 desk-place ↔ seat-equalize 순환이 생긴다. 가두기는 평준화 몫이라 여기로 떼어 desk-place 는 seat-equalize 를 모른다(의존: seat-eq-clamp → seat-equalize · 파츠 핀 이름).
- **만드는 법**(app.js «📌 책상 위 파츠 앵커» 자리, `DESK_PART_ANCHOR_NAME` 바로 뒤):
  ```js
  const seatEqClampMod = TwSeatEqClamp.createSeatEqClamp({
    DESK_PART_ANCHOR_NAME, seatEqMod, seats,                   // 값
    MULTIPLAYER_SPACING: ()=>MULTIPLAYER_SPACING, SPACING: ()=>SPACING, seatSlot: ()=>seatSlot,   // 읽는 함수(다시 대입 · 뒤에서 선언)
    seatDeskHalfWidth,                                         // 함수(화살표로)
  });
  ```
- **내보내는 것**
  - `_clampSeatDeskParts(now?)` — 프레임 루프가 매 프레임 부른다(0.5초마다만 돈다 · `now` 를 안 주면 `performance.now()`).
  ```js
  seatEqClampMod._clampSeatDeskParts(now);
  ```
- **확장할 때 고칠 자리**: 주기는 `SEAT_SLOT_EVERY_MS` · 가두지 않을 좌석 조건은 `on` 한 줄(지금: 올라탄 좌석 · 책상이 숨은 좌석).
- **함정**
  - `seatSlot` 은 app.js 가 `SeatSlot` 이 있을 때만 만든다(없으면 아무것도 안 한다) — 만드는 줄보다 뒤에 선언돼 읽는 함수로 받는다.
  - 감싼 파츠(`userData.__twPartWrap`)만 민다 — 핀의 다른 자식은 그대로.
  - 한 좌석에서 던지면 경고만 하고 다음 좌석으로 간다.
  - 검사: `checks/sim-seat-eq-clamp.js`(4절 — 주기 · 경계 500ms · 멀티 간격 · 올라탄 · 숨은 책상 · 꺼짐 · 좌석 없음 · 계산 모듈 없음 · 던짐) · 옛 검사 `sim-seat-slot`(되살린 글로).

## deco-parts-visibility.js — 🎁 꾸미기 파츠 표시

- **책임**: «꾸미기 파츠 보이기» 깃발(`tw.decoParts`, 기본 켜짐) 하나와, 좌석 하나에 그 깃발을 거는 일. 끄면 내 화면에서만 모든 좌석의 꾸미기 파츠 wrapper 를 숨긴다(서버에 안 쓴다). 책상 위 카테고리(`bone:'desk'`)는 늘 보인다.
- **만드는 법**: `const decoPartsMod = TwDecoPartsVisibility.createDecoPartsVisibility({ premiumMod: ()=>premiumMod });`(premiumMod 는 뒤에서 만들어져 읽는 함수로).
- **내보내는 것**
  - `applyDecoPartsVisibility(seat)` — 파츠를 붙이거나 떼거나 좌석을 다시 조립한 뒤 부른다(app.js 의 파츠 붙이기 끝에서 늘 지난다).
  - `decoPartsVisible()` · `setDecoPartsVisible(v)` — 설정 창이 읽고 바꾼다(저장은 설정 창이 `tw.decoParts` 에). 바꾼 뒤 좌석마다 파츠를 다시 붙여야 보인다.
  ```js
  decoPartsMod.applyDecoPartsVisibility(seat);
  ```
- **확장할 때 고칠 자리**: 숨기지 않을 카테고리 규칙은 `_decoWrapperShow`(지금은 `premiumMod.isDeskPartCat`).
- **함정**
  - `wrapper.visible` 만 바꾼다 — 메시 · 투명도(setSeatOpacity)와 섞지 말 것. 파츠가 가리던 기본 메시는 `applyClothVisibility` 가 «파츠 없음» 으로 되돌린다.
  - 카테고리 표(`PART_CATS()`)가 아직 없으면 책상 위 파츠도 숨긴다(지금 동작).
  - 검사: `checks/sim-deco-parts-visibility.js`(4절) · `sim-deco-parts.js`.

## char-measure.js — 📐 캐릭터 실측

- **책임**: 캐릭터 · 파츠 wrapper 의 3D 박스를 재는 도우미 묶음. 값을 재서 돌려주거나(박스 · 깊이 · 보정량) wrapper 하나를 바닥 위로 올린다. 좌석 배율 · 위치를 거는 일은 app.js `fitModel`, 콘솔 진단은 `floor-snap-diag.js`.
- **만드는 법**: deps 하나 — `const charMeasureMod = TwCharMeasure.createCharMeasure({ measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a) });`. 맨 몸 · 맨 머리 · 발밑 깊이는 `measureBodyBox`(body-measure.js)에 옵션만 고른다.
- **내보내는 것**
  - `measureCharBox(root)` — 맨 몸 박스(스킨드 · 리깅 · 꾸미기 wrapper 제외). fitModel 의 키 정규화 분모.
  - `measureHeadBoxNoParts(root, outBoxes?, meshHost?)` — 맨 머리 박스(숨은 메쉬 · 꾸미기 파츠 제외, meshHost 를 주면 기본 장식 메쉬도). 올라타기 · 이름표 · 귀가 쓴다.
  - `headDecorMeshSet(meshHost)` — 기본 장식 메쉬(hatMesh · maskMesh · glassesMesh · wingMesh) Set.
  - `measureUnderfootDepth(root)` — 발 아래로 내려간 깊이(오차 0.005 이하면 0 · 상한 1.2).
  - `charFootFix(box)` — 피봇이 발바닥이 아닌 모델을 되돌릴 양(키의 12% 넘으면 0).
  - `floorClampWrapper(w, tag, hard?, skipSub?)` — wrapper 를 월드 바닥 위로(부모 배율로 환산) · 올린 로컬 y 를 돌려준다.
  ```js
  const box = charMeasureMod.measureCharBox(seat.gltfRoot);
  const fix = charMeasureMod.charFootFix(box);
  ```
- **확장할 때 고칠 자리**: 상한 `FLOOR_SNAP_MAX` · 오차 `FLOOR_SNAP_MIN` · 피봇 보정 상한 `FOOT_FIX_MAX_RATIO` · 장식 메쉬 목록 `HEAD_DECOR_MESH_KEYS`(한 벌만).
- **함정**
  - 측정에서 빼는 규칙(리깅 · 꾸미기 wrapper · 숨김)은 함수마다 조금씩 다르다 — 바꾸면 fitModel · fitCreator · 꾸미기 미리보기가 함께 움직인다.
  - `floorClampWrapper` 는 «잰 것» 과 «움직이는 것» 이 같아야 한다 — 같이 안 올라가는 가지만 skipSub 로 뺀다.
  - 검사: `checks/sim-char-measure.js`(4절 — 실제 three 로 박스 · 깊이 · 상한 · 보정 · 부모 배율 환산 · hard · skipSub).

## floor-snap-diag.js — 🩺 바닥 맞춤 진단

- **책임**: 진단 전용. 콘솔에서 `floorSnapReport()` 한 줄로 실행 화면 · 꾸미기 미리보기 좌석의 발밑 깊이와 파츠 wrapper 위치(바닥 아래인지 · 모델 안인지)를 나란히 적는다. 아무것도 고치지 않는다.
- **만드는 법**: `TwFloorSnapDiag.createFloorSnapDiag({ charMeasureMod, findMySeat, wardrobeMod: ()=>wardrobeMod });`(만들 때 `window.floorSnapReport` 를 건다).
- **내보내는 것**: 없음 — `window.floorSnapReport()` 만(돌려주는 글: «위 로그를 복사해서 보내주세요»).
- **확장할 때 고칠 자리**: 보는 좌석(실행 화면 · 미리보기) · 한 줄에 적는 값은 `push` 안 · 문턱값 `BELOW_FLOOR_EPS` · `DEPTH_MISMATCH_EPS` · `PARENT_CHAIN_MAX`.
- **함정**: 실제 좌석은 `gltfRoot`, 미리보기는 `root` 라 모델 노드 이름이 다르다(`modelOf`). 검사: `checks/sim-floor-snap-diag.js`.

## seat-model-load.js — 📦 좌석 모델 싣기

- **책임**: 파싱된 GLB 를 좌석 하나에 붙이고(보호 wrap · 기본 xf · 머리/몸 앵커 · 애니 클립 · 얼굴 머티리얼 · 본 찾기) 비우는 일. 개발용 파일 드롭(.glb · .dcc · 이미지)도 여기서 갈라 보낸다. 크기 · 바닥 맞춤은 app.js `fitModel` · `fitDesk`, 줄 다시 잡기는 `layoutSeats`.
- **만드는 법**(app.js «FILE LOADING» 자리):
  ```js
  const seatModelLoadMod = TwSeatModelLoad.createSeatModelLoad({
    loader,                                                              // GLTFLoader
    boneSide, fitDesk, fitModel, layoutSeats, setInfo, toast,            // 함수(화살표로)
    assetCodeMod: ()=>assetCodeMod, selected: ()=>selected, sliders: ()=>sliders,   // 읽는 함수
    asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),   // .dcc 비밀번호 — window.prompt 는 Electron 에서 안 뜬다
  });
  ```
- **내보내는 것**
  - `setupSeatModel(seat, root, animations, name)` — 좌석에 모델 붙이기(기본 xf 크기 1 · 높이 0 · 회전 π). 클립이 있으면 상태 넷(idle · pet · focus · sleep)에 고르고 없으면 절차적 본 애니.
  - `loadCharGLB(buf, name, seat)` · `handleFiles(files, seat)` · `resetSeat(seat)` · `prepBlink(seat)`.
  - `pickClip(clips, state)` — 순수: 상태별 낱말(`STATE_KW`)이 이름에 든 첫 클립(대소문자 무시) · 없으면 null.
  ```js
  seatModelLoadMod.setupSeatModel(seat, gltf.scene, gltf.animations, 'cat.glb');
  ```
- **확장할 때 고칠 자리**: 상태별 클립 낱말 `STATE_KW` · 본 이름 판정(spine · head · hand/arm · leg/thigh · ear) · 모듈 위 기본값(`DEFAULT_ROT` · `ANCHOR_TOP_Y` · `HEAD_ANCHOR_K` · `BODY_ANCHOR_K` · `PLACEHOLDER_*` · `FIRST_POSE_DT`).
- **함정**
  - fitModel 을 두 번 부른다 — 첫 애니 프레임(무릎 굽힘)을 반영한 뒤 바닥을 다시 맞추려고. 하나로 줄이면 파묻힌다.
  - 붙인 직후 책상 실측이 덜 확정돼 다음 두 프레임에 layoutSeats 를 다시 부른다.
  - .dcc 비밀번호를 `window.prompt` 로 묻는다 — Electron 에선 안 뜬다(`CONFIRM.md`).
  - 검사: `checks/sim-seat-model-load.js`(4절 — 실제 three 로 붙이기 · 클립 · 본 · 깜빡임 · 비우기 · 파일 고르기 · 실패 문구).

## seat-panel.js — 🎚️ 좌석 탭 · 상태 버튼

- **책임**: 실행 화면 좌석 패널의 그리기 — 좌석 탭(나 · 친구 이름 + 상태 이모지) · 좌석 고르기(안내 글 · 슬라이더 값 채움) · 상태 자동/수동 버튼(만들 때 버튼 줄에 클릭을 건다). 슬라이더 · 모델 파일 입력의 이벤트 연결은 app.js 에 둔다(모델 싣기 · layoutSeats 를 불러 모듈끼리 순환이 생기므로).
- **만드는 법**: `TwSeatPanel.createSeatPanel({ seats, activity, triggerPet, selected: ()=>selected, setSelected: (v)=>{ selected = v; } })`.
- **내보내는 것**
  - `renderSeatTabs()` · `selectSeat(seat)` · `setInfo(seat, html)`(고른 좌석일 때만 안내 글) · `setManual(state | null)`.
  - `manual()` — 수동으로 고른 상태(없으면 null). 프레임 루프가 본다.
  - DOM: `dot` · `stateLabel` · `sliders`.
  ```js
  seatPanelMod.selectSeat(seat); seatPanelMod.renderSeatTabs();
  ```
- **확장할 때 고칠 자리**: 탭 상태 이모지 표(`emo`) · 탭 이름 규칙(나 / friendName / 친구i).
- **함정**: `selected` 는 app.js 가 든 값 — 이 모듈은 읽는 · 쓰는 함수로만 만진다. 검사: `checks/sim-seat-panel.js`(4절 — 가짜 DOM 으로 탭 · 고르기 · 안내 · 수동/자동 · 쓰다듬기 버튼).

## body-measure.js — 📏 캐릭터 몸 박스 재기 한 규칙

- **책임**: root 아래 메시들의 월드 박스를 «무엇을 셀지» 옵션 하나로 잰다(꾸미기 파츠 · 리깅 파츠 · 숨은 메시 · 기본 머리 장식 빼기). 그리지도 옮기지도 않는다.
- **만드는 법**: app.js 맨 앞(SETUP)에서 `const bodyMeasureMod = TwBodyMeasure.createBodyMeasure({\n});` — 빈 deps. 다른 도메인(tricks · status-chip · away-pic · launcher-preview · ride-bench)은 deps `measureBodyBox`(ride-bench 는 `isPartByRigOrName` 도)로 받는다.
- **내보내는 것**
  - `measureBodyBox(root, opts, out)` — 옵션: `excludeParts`(`true` = 파츠 wrapper(`rigged` · `__partWrap_` 이름 · `__twPartWrap` 표식) 하위와 리깅 스킨드메시(`_origBind`) 빼기 · `'rigged'` = 리깅만 빼기 · `'skinned'` = 리깅 스킨드메시만 빼기) · `partTest`(excludeParts:true 의 «파츠 wrapper 인가» 판정 바꾸기) · `visibleOnly`(자기 · 조상 숨김 빼기, root 자신은 안 봄) · `skipMeshes`(Set) · `skipBranch`(함수 — 참인 가지 통째로 빼기, root 자신은 안 봄) · `frame`(노드 — 그 노드 좌표계로, 메시 자기 도형 × 역행렬) · `updateWorld`(false 면 행렬 안 세움) · `selfOnly`(메시 자기 도형만) · `outBoxes`(배열). 옵션이 없으면 `setFromObject(root)` 그대로.
  - `countsAsBody(mesh, root, opts)` · `isPartNode(node)` · `isPartByRigOrName(node)`(옛 판정 — 리깅 · 이름만, 표식은 안 봄) · `PART_WRAP_PREFIX`
  ```js
  measureCharBox(root)          // = measureBodyBox(root, { excludeParts: true })                       키 정규화 · 센터링 · 날기 벽(tricks — gltfRoot 를 재고 비면 rig 째 옵션 없음)
  measureHeadBoxNoParts(r,o,h)  // = { excludeParts: true, visibleOnly: true, skipMeshes: 장식 }         올라타기 · 맨 머리
  measureUnderfootDepth(root)   // = { excludeParts: 'rigged', visibleOnly: true } 의 min.y            발밑 파츠 바닥 맞춤
  _boxExcluding(root, skipSub)  // = { skipBranch: o => o.visible === false || skipSub(o) }            책상 바닥 맞춤(파츠 핀 빼기)
  measureBodyBox(o, RIDE_WRAP_OPTS)  // = { excludeParts: 'skinned', visibleOnly: true, updateWorld: false }  올라타기 — 파츠 · 귀 wrapper 하나 안
  ```
- **어디서 무엇을 재나**(대상 · 좌표계 · 빼는 것 — 묶은 곳은 옵션만 다르다)

  | 쓰임 | 대상 | 좌표계 | 빼는 것 | 묶음 |
  |---|---|---|---|---|
  | `measureCharBox`(키 정규화 · 센터링) | 캐릭터 root | 월드 | 파츠 · 리깅 스킨드 (숨은 것은 셈) | ✓ 1차 |
  | `measureHeadBoxNoParts`(올라타기 · 맨 머리) | gltfRoot | 월드 | 파츠 · 리깅 스킨드 · 숨김 · 장식 메시 | ✓ 1차 |
  | `measureUnderfootDepth`(발밑 바닥 맞춤) | 모델 | 월드 min.y | 리깅만 · 숨김 | ✓ 1차 |
  | 날기 벽 · 이동 여백 · 상태칩 · 자리비움 | rig · group · bodyWrap | 월드 | 옵션별 | ✓ 1차 |
  | launcher-preview `_lcBodyBox`(런처 프레임) | 미리보기 group | 월드 | `'__part'` 접두 · 리깅 · 리깅 스킨드 (숨은 것은 셈) — 비면 전체 | ✓ `partTest` |
  | `_measureBodyBoxInLocal`(머리 공간 진단 로그) | 모델 | 지정 노드 로컬 | 리깅 · `__partWrap_` 이름 · 리깅 스킨드 · 숨김 | ✓ `frame` · `isPartByRigOrName` |
  | `_headTopAboveBone`(동물 머리 파츠 보정) | 모델 | 모델 로컬 · 메시마다 max.y | 위와 같음 + 장식 메시 | ✓ `frame` · `outBoxes` |
  | `_boxExcluding`(책상 바닥 맞춤 · char-measure.js) | 책상 wrapper | 월드 | 숨은 가지 · 파츠 핀 가지 (파츠 규칙 없음 · root 는 안 봄) | ✓ `skipBranch` |
  | ride-bench 머리 파츠 · 귀 박스 | 파츠 · 귀 wrapper 하나 | 월드(행렬 안 세움) | 숨김 · 리깅 스킨드 (wrapper 자신의 숨김은 부르는 쪽이 먼저 거름) | ✓ `'skinned'` |
  | ride-bench 검증 로그 `_hbAll` | gltfRoot | 월드(행렬 안 세움) | 리깅 · 이름 · 리깅 스킨드 (숨김 · 장식은 셈) | ✓ `partTest` |
  | 스티커사진 `_pkBodyBox` · `_pkVisibleBox` | **복제본** | 월드 | 원본 짝 표(`srcOf`)로 판정 | ✗ 아래 |
  | `_floorSnapProbe`(바닥 맞춤 진단 · floor-snap-diag.js) | 모델 | 메시마다 | 바닥 맞춤과 같은 규칙 + «왜 뺐나» 글 | ✗ 아래 |
  | 생성기 카메라 맞춤 `setFromObject(inst.root)` | 생성기 모델 | 월드 | 없음 | ✗ 아래 |
  | `_charBoneBindInverses` | 모델의 스킨드메시 | — | 박스가 아니라 본 모음 | ✗ 아래 |

- **묶지 않은 곳 · 이유**
  - 스티커사진 `_pkBodyBox`: 복제본은 `userData` 가 비어 있어 판정을 **원본 노드**(복제 · 원본 짝 표)로 하고, root 위 조상까지 끝까지 올라가 보며, 잴 게 없으면 `null`(빈 박스가 아니라 «옛 규칙으로 다시 재라»). 옵션 셋(짝 표 · 조상 끝까지 · 잰 메시 수)을 더 늘려야 해서 그대로 둔다. `_pkVisibleBox` 도 조상 끝까지 · 파츠 밑 스킨드메시만 빼는 다른 규칙.
  - `_floorSnapProbe`: 박스가 아니라 메시마다 «왜 뺐나» 를 적는 진단이고, 박스 값은 이미 `measureUnderfootDepth` 를 부른다. 대신 센 · 뺀 메시 수가 `countsAsBody({ excludeParts: 'rigged', visibleOnly: true })` 와 같은지 `sim-body-measure.js` 2-b 가 본다.
  - 생성기 카메라 맞춤: «몸» 이 아니라 화면에 올라간 전부(파츠 · 숨은 것 포함)를 프레임에 넣는 것이 목적 — 다른 측정이다.
  - `_charBoneBindInverses`: 박스를 재지 않는다(캐릭터 본의 바인드 역행렬 모음 — 파츠 리그는 뺀다).
- **확장할 때 고칠 자리**: 새 «파츠» 표식은 `isPartNode` 한 곳. 새 쓰임은 손으로 traverse 하지 말고 옵션을 골라 부른다.
- **함정**
  - three r128 `setFromObject` 는 숨은 메시도 세고, 리깅 메시는 **스키닝 전 원본** 박스를 잰다(리깅 모자 원본 y 2.18~5.31). «몸» 을 재려면 `excludeParts` 를 켠다.
  - `checks/sim-body-measure.js` 4절이 body-measure.js 밖의 `setFromObject(좌석.rig · bodyWrap · gltfRoot · 좌석.group)` 를, 3-b절이 메시를 훑으며 `_origBind` 를 손으로 거르는 곳(남긴 `_pkBodyBox` · `_charBoneBindInverses` 말고)을 빨강으로 잡는다.
  - 옛 규칙을 지키느라 판정이 조금씩 다르다 — 런처는 `'__part'` 접두(`__part_` 도)를 빼고 숨은 것은 센다 · 진단 · 머리 여유 · 검증 로그는 표식 `__twPartWrap` 을 안 본다(`isPartByRigOrName`). 지금은 이름 · 표식이 함께 붙어 결과가 같다. 하나로 맞추려면 동작 변경이라 따로 승인받는다.
  - `skipBranch` · `partTest` 는 순수 함수만 넘긴다(던지면 measureBodyBox 밖으로 나간다 — `_boxExcluding` 은 던지면 빈 박스).

## gacha-tx.js — 🎰 가챠 트랜잭션 한 길

- **책임**: 가챠 노드(`users/{uid}/gacha`)를 트랜잭션으로 고치는 단 한 길. 뽑기 · 합치기(`gacha.js`)가 «지금 서버 값 → 새 값» 함수(apply)를 넘긴다. 통째 set 은 없다(다른 PC 의 뽑기를 지운다).
- **만드는 법**: ESM — `firebase-init.js` 가 `import { createGachaTx } from "./character/gacha-tx.js"` 로 들이고 `createGachaTx({ db, ref, get, runTransaction, waitConnected, whenAuthReady })` 로 만든다. Firebase 를 직접 import 하지 않는다.
- **내보내는 것**: `updateGacha(uid, apply, opt)` → `{ ok:true, committed, value }` | `{ ok:false, reason:'offline'|'timeout'|'denied'|'error' }`(firebase-init 의 `firebaseAPI.updateGacha` 가 그대로 건넨다) · `gachaFailReason(e)` · 상수 `GACHA_TX_TIMEOUT_MS`(10초) · `GACHA_CONNECT_WAIT_MS`(3초).
- **함정**
  - 첫 시도의 `cur=null` 은 «빈 노드» 가 아닐 수 있다 — 사전 get 값(pre)으로 센다.
  - 시간 상한은 사전 get 부터 저장까지 덮는다. 넘긴 뒤 늦게 committed 되면 `opt.onLate(값)` 로만 알린다(부르는 쪽이 사본에 합친다).
  - apply 는 재시도마다 다시 불린다 — 부작용 없이 값만 돌려줄 것(gacha.js 는 마지막 실행의 결과만 쓴다).
  - 검사: `checks/sim-gacha-tx.js`(연결 · 가짜 SDK · 깨 보기).

## gacha-server.js — 🎰 가챠 서버 길

- **책임**: 서버가 뽑고 서버가 저장하는 길(`GET /v1/me/gacha` · `POST /v1/me/gacha/draws`). 확률 · 풀 · 시즌 · 남은 횟수는 서버가 정한다. 이 PC 에만 있는 뽑기는 올리지 않는다(서버 값만 원본).
- **고르기**: `gacha.js` 가 `deps.gachaSource()`(원격 설정 `sources.gacha` · `shared/source-switch.js`)가 `'server'` 일 때만 이 길을 탄다. 칸이 없으면 옛 길(`gacha-tx.js` 트랜잭션 · 앱이 뽑기).
- **deps**: `get` · `post`(로그인 API 통로 — `firebaseAPI.apiGetAuthed` · `apiPostAuthed`) · `newRequestId`(뽑기마다 새 이름 — 그물망 재전송이 겹쳐도 서버가 두 번 굴리지 않게 · 앱은 시간 초과면 다시 보내지 않고 상태를 다시 받는다).
- **내보내는 것**: `createGachaServer(deps)` → `{ load() → 상태 | 던짐, draw(n) → { ok:true, out, state } | { ok:false, reason } }` · 순수 `stateOf` · `resultsOf` · `reasonOf` · `clampCount`.
- **함정**
  - 실패해도 옛 길로 넘기지 않는다 — 넘기면 서버가 정하는 뜻이 없어진다. 실패하면 `gacha.js` 가 서버 값을 다시 받는다(시간 초과 뒤 서버엔 들어갔을 수 있다).
  - 서버 길에서 보유분은 **갈아 끼운다**(합치지 않음). 못 받으면 아무것도 안 바꾸고 착용도 안 벗긴다.
  - 컷오버 전까지 옛 앱이 `users/*/gacha` 를 직접 쓴다 — 조작을 막는 건 규칙을 닫는 날이다.
  - 검사: `checks/sim-gacha-server.js`(요청 모양 · 응답 씻기 · 실패 · 깨 보기) · `checks/sim-gacha.js` 3-2절(서버 길로 굴리기).

## gacha-album.js — 📚 도감 규칙

- **책임**: 꾸미기 창 «📚 도감» 탭의 줄 · 쪽 규칙(순수 함수 · DOM · firebase 없음). 도감 = «⭐ 상시» + 시즌(봄 · 여름 · 가을 · 겨울) — 파츠가 하나라도 있는 것만 줄을 세운다. 그리기는 `gacha.js`.
- **만드는 법**: classic script(`window.TwGachaAlbum`) — html 이 `gacha.js` 앞에 싣고, `gacha.js` 가 `const gachaAlbum = TwGachaAlbum;` 로 받는다.
- **내놓는 것**: `ALBUM_KEYS` · `ALBUM_LABEL` · `ALBUM_THUMBS`(3) · `isAlbumKey` · `albumParts(parts, key)` · `albumList(parts, count)` → `[{ key, label, owned, total, thumbs }]` · `albumPct` · `pageCount` · `clampPage` · `pageOf`.
- **함정**:
  - 줄 그림은 **뽑은 파츠에서만** 고른다 — 안 뽑은 파츠는 도감 안에서도 «???» 다.
  - 모르는 시즌 이름(rec.season)은 어느 도감에도 넣지 않는다 — 뽑기 풀도 아는 시즌만 돈다.
  - 도감 화면 흐름: 꾸미기 창(`wardrobe.js`)이 «도감» 탭을 그릴 때 `#gachaInvHost` 를 만들고 `gachaMod.renderGachaInv()` 를 부른다 · 탭이 보이기 시작하면 `gachaMod.onAlbumShow()`(서버와 한 번 맞춤). 단축키는 F2(꾸미기 창) 하나 — 따로 T 키는 없다 · 뽑기 창 [도감으로] 는 창 열기 통로(`twNav.NAV.WARDROBE_ALBUM`).
  - 라이선스가 없으면 꾸미기 창은 «도감» 탭만 연다(다른 탭은 잠금 안내 · [라이선스 등록하러 가기]). 뽑은 가챠 파츠는 카테고리 칸에도 🎰 로 보인다.
  - 검사: `checks/sim-gacha-album.js`(규칙 · 연결 · 깨 보기) · `checks/sim-gacha.js` 5절(도감 화면) · `checks/sim-wardrobe.js` 2-2절(탭 · 라이선스) · `checks/sim-wardrobe-panel.js` 2-2절(T · [도감으로]).

## face-heal.js — 🛡️ 얼굴 · 좌석 그림 자동 복구

- **책임**: 그래픽 리셋 등으로 캔버스가 비면 같은 캔버스에 다시 그린다. `repairBlankFaces` — 내 사람 칸(저장본 `LS_KEY` 로). `repairSeatTextures` — 남의 사람 좌석(방 동기화가 남긴 `faceUrl` · `blinkUrl`)과 동물 좌석(내 것 포함 · `animal.js` 가 텍스처에 남긴 `userData.twSrc` · `twFill`). `reportGlReset` — WebGL 이 돌아온 직후(`gl-recover.js` `afterRestore`) 빈 좌석 그림 수를 진단 기록에 한 줄 남기고 바로 고친다.
- **deps**: 캔버스 · 좌석 값(`seats` · `slots` · `skinCanvases` …) · `_isBlankDraw` · `loadImg`(저장본) · `loadImgCors`(남의 주소 — room-sync `_loadImgCors`) · `diagNote` · `toast`. app.js 가 4초마다(`FACE_WATCH_MS`) 두 복구를 부른다.
- **함정**
  - 판정은 «합성 텍스처가 투명» 하나다 — 피부가 깔린 합성본 · 흰 바탕을 먼저 칠한 동물 텍스처는 정상이면 투명하지 않다. 받은 얼굴(`def.face`) 이 빈 것만 보면 얼굴을 안 그린 친구를 매번 잡는다.
  - 새로 받지 않는다 — 이미 받은 주소 · 원본만(캐시). 원본이 없거나 받기 실패면 처음 바탕색만 칠해 둔다(다시 투명이 아니라 헛돌지 않는다).
  - 피부 캔버스가 비었으면 남의 좌석은 그 차례를 건너뛴다(피부 없는 얼굴이 굳는다) — 피부는 `repairBlankFaces` 가 먼저 메운다.
  - 검사: `checks/sim-face-heal.js` 4절(가짜 캔버스에서 실제로 돌림 · 깨 보기) · `checks/sim-gl-recover.js`.
