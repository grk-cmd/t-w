# character/ — 캐릭터 · 꾸미기

캐릭터 · 꾸미기 도메인 모듈. app.js(입구)가 `createXxx(deps)` 로 만들어 이어 주고, 이 폴더 모듈끼리는 서로의 속을 직접 부르지 않는다.
절은 모듈마다 하나 — 다른 사람이 만든 절은 건드리지 않고 자기 절만 더한다.

## part-scene.js — 🧊 파츠 GLB 파싱 캐시 · 도트 썸네일

- **책임**: 카탈로그 파츠 레코드(`rec`)의 GLB 를 id 마다 한 번만 파싱해 들고 있고, 그 씬으로 32×32 도트 썸네일을 굽는다. 관리자 콘솔 다시 굽기는 `admin/admin-thumbs.js`.
- **만드는 법**: app.js «🧊 파츠 GLB 파싱 캐시 · 썸네일» 자리에서 `const partSceneMod = TwPartScene.createPartScene({ … });`
  - 톤 예산 상수 `TONE_FRONT_TOTAL` · `FLAT_EMISSIVE` (값)
  - `_applyPartMatTone` · `addRunLights` · `runLightAt1`(조명 — shared/light-tone.js) · `b64ToBuf` · `resolveCatalogGlb` (함수) · `assetCodeMod` (값)
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
- **검사**: `checks/sim-mat-tone.js` — 코어 빌드 사본으로 만든 진짜 톤으로 돈다 · 모듈 모양 · 연결 · mutation test + 가짜 재질로 입력 → 결과(맵 · emissiveMap 동기화 · 귀 감김/뜸 · 같은 그림이면 안 감 · 빠진 재질 건너뛰기 · 평탄화 배율 · 텍스처 없는 메쉬 · 색 없는 재질 · FLAT_EMISSIVE 0).


## catalog-api.js — 🧩 카탈로그 서버 한 벌 받기(`GET /v2/catalog`)

- **책임**: 파츠 · 책상 · 아이템을 서버 한 벌 `GET /v2/catalog`(ETag · `no-cache`)에서 받아 앱이 아는 목록(`parts` · `items` · `desks` — id → 레코드 맵 · `categories` · `unlocks`)으로 **한 번 펼친다**. 이 모양 바꾸기는 이 모듈 한 곳(`unfoldCatalog`)이다 — 서버 `parts` + 가챠(`listing.acquisition.GACHA`)는 `parts`(gacha:true · season) · 서버 `deskProps` 는 `items` · 서버 `desks` 는 `desks`. 파일은 해시만 오므로 `glbUrl` · `thumbUrl` 은 한 벌의 `files`(해시 → Firebase Storage 다운로드 URL)에 맞는 URL 이 있으면 그것을, 없거나 틀리면 `GET /v2/catalog/assets/{해시}.{glb|png}` 주소로 채운다(`files` 가 없는 옛 서버도 이 endpoint). `files` 의 URL 은 https · 호스트 `firebasestorage.googleapis.com` · 이 앱의 버킷 하나(`deps.storageBucket()` = `firebaseAPI.storageBucket` = `firebase-config.js` 의 storageBucket — 운영 앱은 운영 · dev 앱은 dev) · 경로 `assets%2F{같은 해시}.{확장자}` · `alt=media` 가 다 맞을 때만 쓴다(`storageUrlOf`). 맵에 있는데 틀린 URL 은 앱 실행마다 한 번 `console.warn`(해시만 · URL 은 찍지 않음) 하고 옛 endpoint 로 받는다. 주소가 바뀌면 GLB 영구 캐시(IndexedDB — 키가 URL)는 한 번 새로 받는다. 서버 카테고리 표는 운영이 더한 것(`customCats`) · 처음 값에서 바뀐 기본 카테고리의 이름 · 아이콘(`catOverrides`)으로, 해금 표는 `{ 종류: { 열쇠: { level · label } } }` 로 푼다(동물 해금 레벨 = `ANIMAL_CHARACTER` · `animal`). 레코드마다 `version` · `modelHash` · `thumbHash` · `listingAccess` 를 싣는다(관리자가 고쳐 쓸 때 되돌려 보낸다).
- **로그인 뒤에만 · 두 칸**: 로그인 통로(`TwApi.authed`)로 받는다 — 서버가 보는 사람마다 «못 고르는 것» 을 `locked` 로 정해 준다. 책상 · 소품 레코드의 `locked` = 서버 값 그대로(막을 때 쓴다 — `licenseAssetBlocked` 는 이 칸 하나만 본다) · `licenseOnly` = 진열 `access.kind === 'entitlement'` 인 «라이선스 전용 분류»(꾸미기 «전용 책상» 탭 · 관리자 칸 — 어디에 그릴지 정하는 칸 채우기이고 판정이 아니다). 파츠 응답에도 서버는 `locked` 를 싣지만 앱이 아직 읽지 않는다.
- **만드는 법**: classic script(`window.TwCatalogApi`) — app.js 가 `const catalogApiMod = TwCatalogApi.createCatalogApi({ api: TwApi.authed, rt: TwRtHub.store, notifyError, fetch, storageBucket })` 로 한 번 만들어(`storageBucket` = `()=>firebaseAPI.storageBucket()` — 이 앱의 Storage 버킷 · files URL 검사에 쓴다) `catalog-sync` · `catalog-glb` · 관리자 쓰기(`catalogAdmin`)에 `catalogApiMod` 로 넘긴다. Firebase 를 거치지 않는다.
- **내보내는 것**: `subscribe(kind, onData)` → 해제 함수(kind: `parts` · `items` · `desks` · `categories` · `unlocks` — 모르는 종류는 던진다) · `load()` · `current()`(마지막으로 받은 서버 한 벌 — 관리자 쓰기가 `version` 을 읽는다) · `fetchGlb(url)`(파일 → base64 · 웹 캐시를 거치지 않는다) · `unfoldCatalog(data, assetUrl, files)`(`files` = `{ bucket, onBad }` — 이 앱의 버킷 · 맵에 있는데 틀린 URL 의 해시를 받는 함수 · 안 넘기면 늘 서버 파일 endpoint). 넘기는 값은 늘 새 객체(받는 쪽이 `glb` 를 채운다) · 지난번과 같은 종류는 다시 안 넘긴다.
- **세션 한 번이 값을 쥔다**: 첫 구독이 받기를 시작하고, 마지막 구독자가 빠지면(로그인이 끝남) 받은 값 · 알림 구독 · 받는 중인 요청을 모두 비운다 — 다음 로그인이 앞 사람의 `locked` 를 받지 않고, 늦게 온 앞 로그인의 답은 버린다.
- **버전 알림**: Firebase `catalogMeta` 는 걷었다(설계 `contexts/catalog.md` §2 · `d13-e-finish` §9). 바뀜 알림 = realtime `catalog` · 내 라이선스가 바뀌면 `license`(서버가 정하는 `locked` 가 바뀐다) — 다시 묻기 = ETag(304 면 같은 객체라 넘기지 않음). IndexedDB 24시간 캐시도 같이 걷었다.
- **함정**: 못 받으면 Firebase 로 물러나지 않는다 — `E-CHAR-26` 으로 알리고 지난 목록은 그대로 둔다. 타이머로 다시 두드리지 않고, 알림 · 연결 복구(`ready`) 때 다시 받는다. 카테고리 · 해금 레벨도 같은 한 벌에서 받는다 — 추가 요청 없음.
- 검사: `checks/sim-catalog-api.js`(펼치기 표 · 받기 · 알림 · 실패 · 비우기 · mutation test). 길이 서버에 있는지는 `checks/sim-api-routes.js`.

## catalog-glb.js — 🔗 카탈로그 GLB 해결(glbUrl → rec.glb)

- **책임**: 카탈로그 인덱스엔 `glbUrl` 만 오는데 앱 곳곳은 `rec.glb`(base64)를 본다 — 쓰는 때에 채운다. 차례: 세션 메모리 → 영구 캐시(`shared/glb-idb-cache.js`) → 서버(`catalogApiMod.fetchGlb`).
  영구 캐시 열쇠는 내용 해시(`sha256:` + `rec.modelHash`) — 주소가 바뀌어도 같은 파일은 다시 받지 않는다. 찾을 때 옛 판의 주소 열쇠(지금 `glbUrl` · 0.13 서버 endpoint `catalogApiMod.legacyGlbUrl(해시)`)도 보고, 찾으면 해시 열쇠로 옮겨 적는다.
- **만드는 법**: `const catalogGlbMod = TwCatalogGlb.createCatalogGlb({ catalogApiMod, glbIdbMod });`
- **내보내는 것**
  - `resolveCatalogGlb(rec)` → `Promise<b64 | null>` — 성공하면 `rec.glb` 도 채운다. `rec.glb` 가 이미 있으면 그것.
  - `resolveCatalogGlbCached(rec)` → 메모리 · 영구 캐시에서만(네트워크 없음).
  - `resolveCatalogGlbAll(recs, cachedOnly)` → 새로 채운 수 — 스냅샷(객체 · 배열) 전부를 나란히 채우고 영구 캐시 치우기를 부른다. `cachedOnly` 면 서버로 안 나간다.
  - `glbFailWhy(url)` → 글 — 그 주소의 마지막 받기 실패 이유(`net-fail … Nms`(연결이 안 되거나 받는 도중 끊김 — 차단 · DNS · 연결) · `fail … 403 Nms`(응답 번호) · 실패한 적 없으면 빈 글). 책상 카드(만들기 E-CHAR-14 · 꾸미기 책상 탭 E-CHAR-13)가 진단 기록에 싣는다 — 주소 · 토큰은 담지 않는다.
  ```js
  catalogApiMod.subscribe('items', async obj => { await catalogGlbMod.resolveCatalogGlbAll(obj, true); merge(obj); });   // 첫 화면 전 — 캐시만
  ```
- **확장할 때 고칠 자리**: 받는 길이 바뀌면 `catalog-api.js` 의 `fetchGlb` 쪽 — 이 모듈은 그대로.
- **함정**
  - 메모리 · 영구 캐시에서 꺼낼 때도 `rec.glb` 를 채워야 한다 — 빠뜨리면 `rec.glb` 를 보는 곳이 «GLB를 불러올 수 없어요» 로 오탐한다.
  - 실패는 기억하지 않는다(다음에 다시 받는다 — `glbFailWhy` 는 이유만 적어 둘 뿐 막지 않고, 받으면 지운다) · 영구 캐시 넣기는 기다리지 않는다.
  - 검사: `checks/sim-catalog-glb.js`(4절 — 차례 · 실패 · 다른 rec 채우기 · 스냅샷 전부 · 캐시만 · 해시 열쇠 · 옛 주소 열쇠 옮기기).

## catalog-sync.js — 🔄 카탈로그 실시간 동기화

- **책임**: 카탈로그 구독(`catalogApiMod` — 아이템 · 책상 · 파츠 · 커스텀 카테고리 · 기본 카테고리 이름 덮어쓰기)을 걸고, 스냅샷이 오면 저장 목록에 합친 뒤 떠 있는 좌석 · 생성기 · 런처 · 꾸미기 미리보기에 다시 반영한다.
  - 합치는 규칙(셋이 같이 쓰는 순수 함수 `mergeCatalogList`): 카탈로그 항목은 `fromCatalog:true` 로 서버판이 이기고 `order` 오름차순(없으면 9999) · `fromCatalog` 인데 목록에 없으면 관리자가 지운 것 → 좌석에서 내리고 목록에서 뺀다 · 카탈로그에 온 적 없는 로컬 항목은 뒤에 남긴다.
- **만드는 법**: app.js «🔄 카탈로그 실시간 동기화» 자리에서 `const catalogSyncMod = TwCatalogSync.createCatalogSync({ … });` — deps 40
  - 저장 목록: `commissionMod`(아이템 · 책상) · `premiumMod`(파츠 · 카테고리) · GLB 해결 `catalogGlbMod` · 서버 `catalogApiMod`
  - 좌석에 입히기: `seats` · `customItems`(읽는 함수) · `equipDeskItem` · `clearHolderDeskItems` · `applyDeskItemsTo` · `loadSavedItemsIntoSession` · `applyDeskCatalogRefToSeat` · `swapDeskVisual` · `equipPartOnSeat` · `unequipPartFromSeat` · `applyClothVisibility` · `fitModel` · `layoutSeats` · `rideBenchMod`
  - 생성기 상태(읽는 함수): `creatorOpen` · `cBase` · `cDesk` · `cDeskColor` · `cDeskScale` · `cDeskGlbB64` · `cDeskTemplate` · `activeCustomDeskId` + 쓰는 함수 `setCDeskGlbB64` · `setCDeskTemplate`
  - 다시 그리기: `wardrobeMod` · `gachaMod` · `adminCategory` · `renderLauncher` · `renderCrItems` · `toast` · `isAdmin`
- **내보내는 것**: `start(session)` — 로그인 뒤 app-boot 차례 `catalog`(저장 목록이 읽힌 뒤)가 한 번 부른다. 구독 다섯을 세션에 맡기고(`session.on`), 세션이 끝나면 풀린다. 만들 때는 요청 · 구독이 없다.
  - `session.onReset(clearCatalogShare)` — 세션이 끝나면 저장 목록 셋과 `customItems` 에서 카탈로그 몫(`fromCatalog`)을 한 곳에서 뺀다(다음 계정이 앞 계정의 `locked` 로 시작하지 않게).
  - 책상 · 아이템 카탈로그가 도착하면 `restoreLicenseHeldAssets`(서버 `locked` 가 풀린 접어 둔 것 되돌리기)를 부른 뒤 좌석을 다시 그리고 `pruneUnownedLicenseAssets` 를 부른다 — 되돌리기 · 접기를 부르는 곳은 여기 한 곳이다(라이선스가 바뀌면 realtime `license` → 다시 받기).
  - 안쪽 순수 함수 `mergeCatalogList(catalogObj, saved, norm?)` → `{ list, removedIds }` — 저장 목록은 안 바꾼다(세 합치기가 부른다 · 검사는 글을 뽑아 직접 돌린다).
- **확장할 때 고칠 자리**: 새 카탈로그 종류는 `mergeCatalogIntoSavedXxx` + `subscribeCatalogXxx` 한 벌 · 구독 걸기는 `start(session)` 에 한 줄 · 새 종류는 `catalog-api.js` `CATALOG_KINDS` 에 하나 더. 합치는 규칙을 바꿀 땐 `mergeCatalogList` 한 곳.
- **함정**
  - 아이템은 세션 등록(`loadSavedItemsIntoSession`)을 **기다린 뒤** 좌석을 다시 적용한다 — 순서를 바꾸면 옛 크기(0.8)로 다시 만든다.
  - 생성기에서 보던 책상 · 아이템의 위치 · 크기 조정값은 일부러 안 지킨다(자동 크기 계산을 바꿔도 보이게).
  - 파츠는 이미 붙은 것을 다시 붙이지 않는다 — 겹쳐 다는 파츠는 `stackedPartObjs` 로 판정. 새로 붙은 게 있을 때만 `fitModel` · `layoutSeats`.
  - 가챠 카탈로그 옮기기는 걷었다(D11-2) — 서버 카탈로그가 `listing.acquisition` 으로 가른다.
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
- **만드는 법**: `const deskVisualMod = TwDeskVisual.createDeskVisual({ … });` — deps 13: `commissionMod` · `assetCodeMod` · `b64ToBuf` · `_applyItemMatTone` · `_setDeskMatColor` · `activeItemMixers` · `_idleItemPivots` · `setDeskScale` · `toast` · `DEFAULT_DESK_OVERRIDE_ID` · `NO_DESK_ID` (값 · 함수) · `isPremium` · `isAdmin` (읽는 함수)
- **내보내는 것**
  - `swapDeskVisual(deskGroup, template, isDefaultOverride, animations, playMode)` — `template` 이 `null` 이면 기본 책상으로 되돌린다. `playMode`: `'auto'`(바로 반복) · `'idle'`(`_idleItemPivots` 에 넣어 프레임 루프가 정함 — 부르기 전에 `deskGroup.userData.__seat` 를 심는다) · 그 밖(`'click'` — 한 번 · 끝에서 멈춤).
  - `applyDeskColorToCustom(deskGroup, color)` — 모아 둔 `_col` 머티리얼만.
  - `deskBodyPlan(def, gated)` — 캐릭터 def 를 그대로 받아 어떤 책상 몸을 그리나: `none`(책상 없음) · `builtin`(내장 기본 책상 · 라이선스로 막혔으면 `blocked`) · `glb`(`rec` · `isDefaultOverride`) · `legacyGlb`(옛 def 에 박힌 `deskGlb`). 책상을 안 골랐으면 옛 `deskGlb` 가 먼저, 없으면 관리자가 바꿔 둔 기본 책상을 찾는다. 좌석 · 꾸미기 미리보기가 같이 쓴다.
  - `drawDeskLegacyGlb(deskGroup, glb, alive)` — 옛 def 의 책상 GLB 를 끼운다(끼움 true · 그 사이 바뀜 null).
  - char-apply 는 캐릭터 def 를 그대로 넘겨 `applyDeskCatalogRefToSeat` 한 줄만 부른다. 받는 사이 다른 책상으로 바뀌면 늦게 온 GLB 는 끼우지 않는다(옛 `deskGlb` 도 같다).
  - `drawDeskGlb(deskGroup, rec, isDefaultOverride, playMode, alive)` — GLB 를 받아 끼운다(끼움 true · 못 받음 false · 그 사이 바뀜 null). `playMode` 를 안 주면 mixer 를 만들지 않는다.
  - `deskColorMats(seat)` — 그 좌석 책상에서 색을 받는 재질(GLB 책상은 `_col` 메쉬 · 내장 기본 책상은 `seat.deskMat` · «책상 없음» 은 빈 목록). 꾸미기 책상 탭이 «책상 색» 칸을 보일지 이것으로 정한다.
  - `applyDeskColor(seat, color)` — 그 목록을 칠한다(꾸미기 책상 탭의 색 조절 · 책상 바꾸기).
  - `applyDeskCatalogRefToSeat(seat, def)` → `Promise` — `deskBodyPlan` 이 고른 몸을 그린다(고른 책상 · 옛 `deskGlb` · 관리자가 바꿔 둔 기본 책상 · 내장 기본 책상). `NO_DESK_ID`(`'__no_desk__'`)면 `hideDeskBody`.
  - `hideDeskBody(deskGroup)` — 🚫 책상 없음: 책상 몸(기본 · 커스텀)만 숨기고 `deskAnchor`(책상 위 아이템)는 그대로 · `userData.noDesk = true`(좌석 간격이 몸 폭으로 — `room/seat-layout.js`). `swapDeskVisual` 이 부르면 표시를 내린다.
  ```js
  deskVisualMod.swapDeskVisual(cDesk, sc); deskVisualMod.applyDeskColorToCustom(cDesk, cDeskColor);
  await deskVisualMod.applyDeskCatalogRefToSeat(seat, seat.charDef);
  ```
- **확장할 때 고칠 자리**: 새 재생 모드는 `swapDeskVisual` 의 `playMode` 분기 · 자리 맞춤(바닥 + 0.15 · 앞뒤 0.6)은 `normalizeDeskObj`.
- **함정**
  - «책상 없음» 은 새 칸이 아니라 `deskCatalogId` 의 예약 값이다 — 옛 앱 · 방 서버는 모르는 책상으로 보고 기본 책상을 그린다(깨지지 않음). 고르는 곳은 꾸미기 › 책상(`wardrobe.js`) · 생성기 5단계(`creator/desk-setup.js`), 저장은 `creator/creator-save.js` · 프리셋 `creator/desk-preset.js`.
  - 라이선스 전용 책상은 **내 좌석에서만** 막는다(`!seat.remote`) — 친구 좌석에서 막으면 남이 쓴 책상이 기본 책상으로 보인다.
  - 크기를 GLB 에 굽지 않는다(원본 그대로 · 슬라이더만) — 새 책상만 자동 크기를 걸던 옛 코드는 지웠다. 다시 넣지 말 것(기본 책상과 크기가 갈린다).
  - 검사: `checks/sim-desk-visual.js`(4절 — 바꿔 끼기 · 되돌리기 · `_col` · 자리 맞춤 · 재생 세 모드 · 색 · 카탈로그 책상 · 라이선스 · 친구 좌석 · 풀기 실패).

꾸미기 창 · 파츠 · 동물 · 슬롯 · 코드 · 가챠 · 좌석 크기. app.js 가 deps 로 이어 주고, 이 폴더 모듈끼리는 서로의 속을 직접 부르지 않는다.
절은 모듈마다 하나 — 다른 사람이 만든 절은 건드리지 않고 자기 절만 더한다.

## `wd-desk-preview.js` — 🪑 꾸미기 미리보기의 책상 몸 · 책상 위치
- **책임**: 꾸미기 미리보기 장면에 «책상 몸» 그룹 하나를 세우고(내장 기본 책상 · GLB 책상 · 옛 `deskGlb` · 책상 없음), 기즈모가 옮긴 자리를 `def.deskPos`(100% 단위)로 바꿔 준다. 미리보기 책상의 크기 식 · deskPos 를 얹는 식도 여기 한 곳이다. 저장 · 방 전파 · 실제 좌석 책상 옮기기 · 기즈모 붙이기는 `wardrobe.js`.
- **만드는 법**: app.js 가 꾸미기 창보다 먼저 `TwWdDeskPreview.createWdDeskPreview({ buildDesk, deskBodyPlan, drawDeskGlb, drawDeskLegacyGlb, hideDeskBody, applyDeskColor, syncDeskPartAnchor })` → wardrobe deps `deskPreview`.
- **내놓는 것**: `scaleOf(def, anim)` · `placeDeskPos(group, base0, pos, anim)`(wardrobe.js 의 빈 그룹도 이 둘을 부른다) · `rebuild({ scene, def, anchorGroup, base0, anim })` · `dispose()` · `setShown(on)` · `tune(def)` · `body()` · `readPos()` · `resetPos()` · `isZero(pos)`.
- **함정**: 미리보기의 책상 그룹은 둘이다 — wardrobe.js 의 빈 그룹(anchorGroup · «책상 위» 파츠 자리)과 이 모듈의 몸 그룹. deskPos 를 빼고 남는 자리(base0 — −CHAR_Z · xf 보정)만 wardrobe.js 가 정해 넘기고, 크기 · deskPos 얹기는 둘 다 이 모듈의 식을 쓴다. 몸 그룹에 `setDeskScale` · `setDeskPos` 를 부르면 좌석 규약(z 보정)으로 자리가 깨진다. `deskPosBase` 에는 배율을 곱하지 않는다(파츠 핀이 따로 곱한다). 높이는 0 아래로 못 가지만 이미 0 아래로 저장된 값은 그 값까지 둔다. 책상 묶음 탭(책상 · 책상 위)에서만 보이고, 손잡이는 책상 탭 · 라이선스가 있을 때만 붙는다.
- 검사: `sim-wd-desk-preview.js` · `sim-wardrobe.js` 5-2절

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

- **책임**: 좌석 크기 평준화가 켜졌을 때 «책상 위» 파츠가 옆 좌석으로 넘어가지 않게 자기 자리 반폭 안으로 미는 주기 작업 하나. 자리 반폭 = 좌석 반폭(`seatHalfWidth` — `room/seat-layout.js` 가 내놓는 줄 배치와 같은 규칙: 책상 · 🚫 책상 없음 · 몸 폭) + 좌석 사이 여백의 절반. 평준화를 끄면 다음 차례에 되돌린다. 계산(박스 재기 · 밀기)은 `seat-slot.js`, 이 모듈은 «언제 · 어느 좌석 · 반폭 얼마» 만.
- **왜 따로**: 책상 자리 · 크기(desk-place)가 평준화 깃발을 읽으면 desk-place ↔ seat-equalize 순환이 생긴다. 가두기는 평준화 몫이라 여기로 떼어 desk-place 는 seat-equalize 를 모른다(의존: seat-eq-clamp → seat-equalize · 파츠 핀 이름).
- **만드는 법**(app.js «📌 책상 위 파츠 앵커» 자리, `DESK_PART_ANCHOR_NAME` 바로 뒤):
  ```js
  const seatEqClampMod = TwSeatEqClamp.createSeatEqClamp({
    DESK_PART_ANCHOR_NAME, seatEqMod, seats,                   // 값
    MULTIPLAYER_SPACING: ()=>MULTIPLAYER_SPACING, SPACING: ()=>SPACING, seatSlot: ()=>seatSlot,   // 읽는 함수(다시 대입 · 뒤에서 선언)
    seatHalfWidth: (...a)=>seatLayoutMod.seatHalfWidth(...a),  // 좌석 반폭 — 줄 배치와 같은 규칙
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
  - `measurePreviewBox(root)` — 꾸미기 미리보기 카메라 구도. 보이는 몸 · 보이는 일반 파츠는 세고 리깅 파츠(스키닝 전 원본 박스가 몇 배씩 크다) · 숨은 메시는 뺀다. 아무것도 안 잡히면 통째로. ⚠️ 통째로(setFromObject) 재면 리깅 파츠 하나에 카메라가 물러나 캐릭터가 점처럼 보인다.
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

## rest-pose.js — 🧍 기본 자세로 잠깐 되돌려 재기

- **책임**: fitModel 이 캐릭터 크기 · 발바닥 보정 · 발밑 깊이를 **기본 자세**로 재게, 재는 동안만 뼈와 `bodyWrap` 회전을 기본으로 돌리고 끝나면 지금 자세로 되돌린다. 몸은 스키닝 메시라 뼈 자세가 박스에 안 들어가지만, 누워 떼쓰기(`bodyWrap` 회전) · 뼈에 직접 붙은 리깅 안 된 파츠는 자세가 높이에 들어가 캐릭터가 뜬 채 남을 수 있었다.
- **만드는 법**: deps 없음 — `const restPoseMod = TwRestPose.createRestPose();`(app.js `charMeasureMod` 바로 뒤).
- **내보내는 것**: `enter(seat)` → 되돌릴 표(없으면 null) · `leave(표)` · `restOf(root)`(그 모델의 기본 자세 — 처음 부를 때 잰다).
  ```js
  const _rest = restPoseMod.enter(seat);
  try{ /* 재기 */ }finally{ restPoseMod.leave(_rest); }
  ```
- **함정**
  - 기본 자세는 그 모델(`gltfRoot`)을 처음 `enter` 할 때 잰다 — fitModel 의 첫 호출이 모델을 막 만든 직후라 그때가 기본 자세다. 다른 곳에서 먼저 부르면 그 자세가 기본이 된다.
  - 나중에 붙은 파츠의 뼈(자기 뼈대가 있는 파츠)는 건드리지 않는다.
  - 검사: `checks/sim-rest-pose.js`.

## fit-watch.js — 🩺 다시 맞춘 높이 경고

- **책임**: fitModel 이 높이를 정하는 값(크기 · 발바닥 보정 · 높이 슬라이더 · 발밑 깊이)을 모델마다 지난번과 견주어, 파츠 · 슬라이더로 설명되지 않게 바뀌었거나 다시 맞출 때 rig 가 떠 있으면 `console.warn('[높이] …')` 한 줄 — 오류 기록(`tw-error.log`)에 WARN 으로 모인다(B-1109-9 원인 찾기).
- **만드는 법**: `const fitWatchMod = TwFitWatch.createFitWatch({ warn: (m)=>console.warn(m) });`(app.js `restPoseMod` 바로 뒤).
- **내보내는 것**: `note(seat, { scale, foot, lift, under, y }, { userY, rigY, groupY, wrapRotX, pinned, riding, animal })` → `'first' | 'same' | 'warn' | 'held' | null` — `lift` 는 fitModel 이 실제로 더한 슬라이더 몫(동물 배율 · 캐릭터 크기 반영). · `TwFitWatch.partsKey(seat)` — 붙은 파츠 묶음 표시(칸 + partId · 쌓기 칸:id + 저장된 착용 목록).
- **함정**: 새 모델의 첫 값은 견줄 것이 없어 적기만 한다 · 슬라이더 몫은 날값이 아니라 **실제로 더한 값**으로 견준다(날값이면 동물 · 크기 ≠ 1 에서 거짓 경고) · 발밑 깊이가 «파츠 묶음 그대로 · 슬라이더 몫으로 설명 안 될 때만» 높이 경고 대신 `[높이 · 발밑]` 한 줄 · 묶음 표시에 wrapper uuid 를 쓰지 않는다(같은 파츠도 다시 붙일 때마다 wrapper 가 새로 생긴다) · 한 번 경고하면 «그대로» 가 될 때까지 다시 안 적음 · rig 뜸은 바뀌었을 때만 · 기준 `TOL_Y`(0.01) · `TOL_SCALE`(1%) · `RIG_LIFT`(0.05).
- 검사: `checks/sim-fit-watch.js`.

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
  measurePreviewBox(root)       // = measureBodyBox(root, { excludeParts: 'rigged', visibleOnly: true }) 꾸미기 미리보기 카메라 구도(비면 통째로)
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

## gacha-api.js — 🎰 가챠 api provider

- **책임**: 서버가 원본인 가챠의 읽기 · 뽑기(`GET /v2/me/collection` · `GET /v2/me/gacha` · `POST /v2/me/gacha/draws`). 확률 · 풀 · 시즌 · 남은 횟수 · 색 해금(다 모았나)은 서버가 정한다. 이 PC 에 보유분 사본을 두지 않는다(0.12 의 `gacha-tx.js` 트랜잭션 · 합치기 · 10분 맞추기는 걷었다).
- **deps**: `authed`(로그인 API 통로 `TwApi.authed`) · `newRequestId`(뽑기마다 새 이름 — 그물망 재전송이 겹쳐도 서버가 두 번 굴리지 않게).
- **내보내는 것**: `createGachaApi(deps)` → `{ load() → 상태 | 던짐, draw(n) → { ok:true, out, state } | { ok:false, reason }, reset() }` · 상태 = `{ owned, unlocked, earned, bonus, left, season }` · 순수 `stateOf` · `resultsOf` · `reasonOf` · `clampCount`.
- **함정**
  - 읽기가 실패하면 던진다(못 읽음 ≠ 빈 보유분). 뽑기는 읽은 토큰의 주인과 묶는다(`expectOwner`) — 읽기 전에는 보내지 않는다.
  - 뽑기가 시간 초과여도 같은 요청을 다시 보내지 않는다. 서버엔 들어갔을 수 있어 사용자가 보관함을 여는 때 다시 받는다.
  - 서버 신호 `collection`(본인)이 오면 `gacha.js` 가 다시 받는다 — 달성표 보상(`bonus`)도 이 길로 온다.
  - 검사: `checks/sim-gacha-api.js`(요청 모양 · 응답 씻기 · 실패 · 계정 묶기 · mutation test) · `checks/sim-gacha.js`(받기 · 뽑기 · 보관함).

## closet-api.js — 🧬 옷장 api provider

- **책임**: 내 캐릭터 옷장(슬롯 5칸 · 보관함 20 · 휴지통)의 서버 endpoint(`/v2/me/avatars…`) — 옷장 받기(슬롯 캐릭터 def 까지 한 번에) · 캐릭터 하나 읽기 · 만들기 · 고치기 · 슬롯 ↔ 보관함 옮기기 · 휴지통 보내기 · 휴지통 목록 · 되살리기 · 첫 실행 올리기(legacy-sync). 칸 수 · 상한 · 휴지통 기한은 서버가 정한다.
- **deps**: `authed`(`TwApi.authed`) · `newRequestId`.
- **내보내는 것**: `createClosetApi(deps)` → `{ load, fetchOne, create, update, move, trash, trashPage, restore, legacySync, reset }` · 순수 `headOf` · `closetOf` · `trashOf` · `failOf`.
- **함정**: 읽은 토큰 주인과 쓰기를 묶는다(읽기 전엔 쓰지 않음) · 고치기는 받은 판(baseVersion)을 싣는다 — 낡은 판이어도 서버가 받고 앞 모습을 휴지통 «연동 교체» 로 남긴다(409 가 아니다) · 실패는 서버 code 그대로 던지고 혼자 다시 보내지 않는다 · 옷장 응답은 슬롯 칸과 def 짝이 맞아야 쓴다(모자라면 «못 읽음»). 검사: `checks/sim-closet-api.js`.

## closet.js — 🧬 옷장 (서버 원본)

- **책임**: 화면의 `slots[]` 를 서버 옷장과 잇는다. 시작할 때(`startCloset` — 계정 확인 뒤 app-boot) 받아 앉히고, 서버 신호 `avatars` 에 다시 받고, 고치면 3초 묶음으로 바뀐 칸만 쓰고(새 칸은 만들기 · 있는 칸은 고치기), 슬롯 ↔ 보관함 · 휴지통 · 되살리기는 동작 하나에 요청 하나로 한다. 0.13 첫 실행의 옛 캐릭터 올리기(`legacyStep`)도 여기.
- **이 PC 에 없는 것**: 캐릭터 저장본 · 보관함 사본 · 고친 시각 · 백업 · 충돌 판정 · 주기 맞추기 · 부팅 지연 타이머(0.12 의 `slot-sync.js` · `chars.js` 를 걷었다).
- **deps**: `closetApi` · `codec`(slot-codec) · `roomFaceCache` · `slots` · `slotSave`(applySlotObjs · lastOut · onSaved · pullForward · _relinkSeatsToSlots · slotsReplaced) · `getMyUserId` · `rtOn` · `toast` · `notifyError` · `renderLauncher` · `creatorOpen` · `storage`.
- **내놓는 것**: `startCloset(session)` · `useSession(session)`(저장 모으기 타이머를 세션에 — 시작이 부른다) · `pullCloset(notify)` · `resetCloset` · `state()`(`idle|loading|ready|failed`) · `boxItems()`(받기 전 null) · `boxCount` · `boxFull` · `moveToBox` · `boxToSlot` · `trashSlot` · `trashBox` · `trashRows` · `restore` · `moveMsg` · `deleteWords` · `unsavedCount` · `flushSlots` · `flushUnsaved`(앱 끄기 전 — 못 올린 고침이 있을 때만 올림 · 없으면 null) · `waitFlush`(줄에 선 일이 다 끝나기를 기다림) · `legacyStep` · `onChange`.
- **함정**
  - 받기 전(idle · loading · failed)에는 아무것도 쓰지 않는다. 실패 뒤 혼자 되풀이하지 않는다(다시 받는 길 = «다시 시도» · 서버 신호). 오류 번호 E-CHAR-16 은 사용자가 누른 받기에서만, 저장 실패(17~19)는 같은 실패를 한 번만.
  - 내가 아직 못 올린 고침이 있는 칸은 받기가 덮지 않는다(올릴 때 서버가 앞 모습을 남긴다). 생성기가 열려 있으면 칸 갈아 끼우기를 건너뛴다.
  - 화면에서 칸이 비었다고 서버 캐릭터를 지우지 않는다 — 지우기는 휴지통 이동(`trashSlot`)뿐. 서버가 된 뒤에만 `pullForward` 로 칸을 당긴다.
  - 새 캐릭터는 보관함이 가득 차 있어도 슬롯에 만든다(서버가 보관함 문턱을 보지 않는다 — 20 은 보관함으로 옮길 때 · 복원할 때).
  - 서버 일은 한 줄(lane)로 하나씩 돈다 — 받기 · 쓰기 · 옮기기 · 휴지통 · 되살리기 · 첫 실행 올리기. 받는 사이 칸이 당겨지거나 쓰는 사이 받은 판이 바뀌는 엇갈림을 이 한 줄이 막는다. 새 서버 일도 `inLane` 으로 세우고, 줄 안에서 다른 줄 일을 기다리지 않는다(동작 안의 쓰기는 `flushNow` 를 바로 부른다).
  - 받은 옷장은 칸 그림을 다 받은 뒤에만 판(known) · 칸 차지 표시 · 머리 목록을 적는다 — 한 칸이라도 못 받으면 아무것도 바꾸지 않는다.
  - 보관함 → 슬롯 앞에서 못 올린 새 캐릭터를 먼저 올린다(서버는 첫 빈 칸에 넣는데 그 칸이 새 캐릭터 칸일 수 있다). 못 올리면 옮기지 않는다(`why: 'dirty'`).
  - 계정 바뀜: `resetCloset` 이 세대(gen)를 올리고 줄을 새로 시작한다 — 옛 계정 일은 gen 이 달라 아무것도 적지 않고 끝난다. 첫 실행 올리기는 내 코드까지 같은지 본다(다른 계정 옷장에 넣지 않는다).
  - 검사: `checks/sim-closet.js` · 화면 쪽 `checks/sim-my-info-box.js` · `checks/sim-launcher-controls.js`.

## slot-codec.js — 🧬 캐릭터 한 칸 ↔ 서버 def

- **책임**: 화면의 저장 모양(그림 dataURL · GLB base64)을 서버 def(그림 · GLB 는 우리 Storage 주소)로, 그 반대로 바꾼다. 올리는 이름은 «종류_내용해시» 라 같은 그림은 한 번만 올라가고 올린 주소는 이 PC 올리기 캐시(`tw.slotGlbUrls`)에 기억한다 — 맞추기 사본이 아니라 중복 올리기 막이다.
- **내놓는 것**: `_slotToServerObj`(하나라도 못 올리면 null) · `_slotFromServerObj`(얼굴 · 감은눈이 없으면 던짐) · GLB 캐시 읽기 · 쓰기 · `SLOT_JSON_MAX`(150000자). 검사: `checks/sim-slot-codec.js`.

## slot-save.js — 💾 슬롯 저장 · 받아 앉히기

- **책임**: 서버에서 받은 칸을 화면 캐릭터로 앉히고(`applySlotObjs(arr, which)`), `saveSlots` 가 «지금 화면 → 저장 모양» 직렬화 결과(`lastOut`)와 달라졌는지를 알린다(`onSaved`). 이 PC 에 저장하지 않는다. 빈 그림 방어 · 이미지 복원 실패 칸(`_imgBroken`) 저장 제외는 직전 직렬화 결과 기준.
- **함정**: `which` 로 고른 칸만 앉히면 나머지 칸의 캐릭터 객체는 그대로다(책상 위 좌석이 붙들고 있다). `pullForward(i)` 는 서버가 휴지통 · 보관함 이동 뒤 당기는 것과 같은 규칙. 검사: `checks/sim-slot-save.js`.

## gacha-album.js — 📚 도감 규칙

- **책임**: 꾸미기 창 «📚 도감» 탭의 줄 · 쪽 규칙(순수 함수 · DOM · firebase 없음). 도감 = «⭐ 상시» + 시즌(봄 · 여름 · 가을 · 겨울) — 파츠가 하나라도 있는 것만 줄을 세운다. 그리기는 `gacha.js`.
- **만드는 법**: classic script(`window.TwGachaAlbum`) — html 이 `gacha.js` 앞에(그리고 `shared/paging.js` 뒤에) 싣고, `gacha.js` 가 `const gachaAlbum = TwGachaAlbum;` 로 받는다.
- **내놓는 것**: `ALBUM_KEYS` · `ALBUM_LABEL` · `ALBUM_THUMBS`(3) · `isAlbumKey` · `albumParts(parts, key)` · `albumList(parts, count)` → `[{ key, label, owned, total, thumbs }]` · `albumPct` · `pageCount` · `clampPage`(둘은 `shared/paging.js` 것을 그대로 다시 내놓음) · `pageOf`.
- **함정**:
  - 줄 그림은 **뽑은 파츠에서만** 고른다 — 안 뽑은 파츠는 도감 안에서도 «???» 다.
  - 모르는 시즌 이름(rec.season)은 어느 도감에도 넣지 않는다 — 뽑기 풀도 아는 시즌만 돈다.
  - 도감 화면 흐름: 꾸미기 창(`wardrobe.js`)이 «도감» 탭을 그릴 때 `#gachaInvHost` 를 만들고 `gachaMod.renderGachaInv()` 를 부른다 · 탭이 보이기 시작하면 `gachaMod.onAlbumShow()`(서버와 한 번 맞춤). 단축키는 F2(꾸미기 창) 하나 — 따로 T 키는 없다 · 뽑기 창 [도감으로] 는 창 열기 통로(`twNav.NAV.WARDROBE_ALBUM`).
  - 라이선스가 없으면 꾸미기 창은 «도감» 탭만 연다(다른 탭은 잠금 안내 · [라이선스 등록하러 가기]). 뽑은 가챠 파츠는 카테고리 칸에도 🎰 로 보인다.
  - 검사: `checks/sim-gacha-album.js`(규칙 · 연결 · mutation test) · `checks/sim-gacha.js` 5절(도감 화면) · `checks/sim-wardrobe.js` 2-2절(탭 · 라이선스) · `checks/sim-wardrobe-panel.js` 2-2절(F2 · T 고리 없음 · [도감으로]).

## wardrobe-place.js — 📐 꾸미기 창 · 미리보기 창 자리

- **책임**: 🎨 꾸미기 창(`#wardrobePanel`)과 👀 미리보기 창(`#wdPreviewPanel`)을 어디에 둘지(순수 함수 · DOM · 저장 없음). 두 창은 한 몸 — 미리보기는 늘 꾸미기 창 왼쪽에 붙는다. 기억이 없으면 둘을 묶어 화면 가운데.
- **만드는 법**: classic script(`window.TwWardrobePlace`) — html 이 `wardrobe.js` 앞에 싣고, `wardrobe.js` 가 `TwWardrobePlace.placeGroup` 을 부른다.
- **내놓는 것**: `GAP`(8) · `MARGIN`(8) · `isPos(s)` · `placeGroup({ vw, vh, panel:{w,h}, preview:{w,h}, saved })` → `{ panel:{x,y}, preview:{x,y} }`.
- **함정**:
  - 자리 기억은 꾸미기 창 왼쪽 위 하나(`tw.wdWinPos` — `wardrobe.js` 가 읽고 쓴다). 어느 쪽 제목줄을 끌어도 같이 움직인다.
  - 화면이 좁아 둘이 다 안 들어가면 꾸미기 창을 먼저 화면 안으로 · 미리보기는 겹쳐도 화면 안으로만.
  - 검사: `checks/sim-wardrobe-place.js`.

## wardrobe-paging.js — 📄 꾸미기 창 파츠 칸 페이지 · 이름 찾기

- **책임**: 꾸미기 창 파츠 칸의 줄 · 페이지 · 찾기 규칙(순수 함수 · DOM · 저장 없음). 칸 한 줄은 «기본 캐릭터» 묶음([안 함] + 기본 파츠) 다음 «커미션 전용» 묶음 — 페이지는 이 한 줄을 `PAGE_SIZE`(16 = 4열 × 4줄)씩 자른다. 그리기 · 기억한 페이지(분류마다 · 이 화면에서만)는 `wardrobe.js`.
- **deps**: 없음(실릴 때 `TwPaging` 을 읽는다 — `shared/paging.js` 를 먼저 싣는다). **만드는 법**: classic script(`window.TwWardrobePaging` · `module.exports`) — html · `checks/smoke.js` PRELOAD 가 `wardrobe.js` · app.js 앞에 싣고, app.js 가 `createWardrobe({ paging: TwWardrobePaging })` 로 넘긴다.
- **내놓는 것**: `PAGE_SIZE` · `PAGER_ALL_MAX`(7) · `normQuery(q)`(앞뒤 공백 떼고 소문자) · `matchName(name, q)` · `buildCells({ defaultList, commissionList, withDefault, query })` → `[{ section:'default'|'commission', kind:'none'|'part', rec }]` · `pageCount(n, size)` · `clampPage(page, n, size)`(둘은 `shared/paging.js` 것을 그대로 다시 내놓음 — 도감과 같은 한 벌) · `pageView(cells, page, size)` → `{ page, pages, groups:[{ section, cells }] }` · `pagerItems(page, pages)` → 번호(0 부터)와 `'…'`.
- **함정**:
  - 페이지 번호는 0 부터 — 화면에 쓸 때만 +1.
  - 묶음 머리(«기본 캐릭터» · «커미션 전용»)는 그 페이지에 칸이 걸친 묶음에만 그린다(`groups`). 묶음마다 따로 페이지를 나누지 않는다 — 한 페이지 칸 수가 늘 16 이하라 창 높이가 정해진다.
  - 찾는 중에는 [안 함] 을 뺀다(파츠가 아니다) · 이름이 없는 파츠는 안 걸린다(화면의 «파츠» 는 대신 쓰는 글이다).
  - 기억한 페이지는 그릴 때마다 `clampPage` 로 맞춘다 — 목록이 줄어 그 페이지가 없으면 마지막 페이지.
  - 열 수(4)는 html `.wd-grid` 와 같이 고친다.
  - 화면 쪽(`wardrobe.js` renderWardrobe): 찾는 말은 분류를 바꾸면 비운다 · 찾는 중의 페이지는 보던 페이지와 따로 둔다(비우면 보던 페이지로). 입력칸은 다시 만들지 않고 칸 목록(`.wd-cat-body`)만 다시 그린다 — 입력칸을 다시 만들면 한글 조합이 끊긴다. 상세조정 중인 칸이 안 보이는 페이지로 가면 조정을 닫는다.
  - 검사: `checks/sim-wardrobe-paging.js`(경계값 · 배선 · mutation test) · `checks/sim-wardrobe.js` 2-2절(실제 renderWardrobe 위에서 페이지 · 찾기).

## face-heal.js — 🛡️ 얼굴 · 좌석 그림 자동 복구

- **책임**: 그래픽 리셋 등으로 캔버스가 비면 같은 캔버스에 다시 그린다. `repairBlankFaces` — 내 사람 칸(저장본 `LS_KEY` 로). `repairSeatTextures` — 남의 사람 좌석(방 동기화가 남긴 `faceUrl` · `blinkUrl`)과 동물 좌석(내 것 포함 · `animal.js` 가 텍스처에 남긴 `userData.twSrc` · `twFill`). `reportGlReset` — WebGL 이 돌아온 직후(`gl-recover.js` `afterRestore`) 빈 좌석 그림 수를 진단 기록에 한 줄 남기고 바로 고친다.
- **deps**: 캔버스 · 좌석 값(`seats` · `slots` · `skinCanvases` …) · `_isBlankDraw` · `loadImg`(저장본) · `loadImgCors`(남의 주소 — room-sync `_loadImgCors`) · `diagNote` · `toast`. app.js 가 4초마다(`FACE_WATCH_MS`) 두 복구를 부른다.
- **함정**
  - 판정은 «합성 텍스처가 투명» 하나다 — 피부가 깔린 합성본 · 흰 바탕을 먼저 칠한 동물 텍스처는 정상이면 투명하지 않다. 받은 얼굴(`def.face`) 이 빈 것만 보면 얼굴을 안 그린 친구를 매번 잡는다.
  - 새로 받지 않는다 — 이미 받은 주소 · 원본만(캐시). 원본이 없거나 받기 실패면 처음 바탕색만 칠해 둔다(다시 투명이 아니라 헛돌지 않는다).
  - 피부 캔버스가 비었으면 남의 좌석은 그 차례를 건너뛴다(피부 없는 얼굴이 굳는다) — 피부는 `repairBlankFaces` 가 먼저 메운다.
  - 검사: `checks/sim-face-heal.js` 4절(가짜 캔버스에서 실제로 돌림 · mutation test) · `checks/sim-gl-recover.js`.

## glow.js — ✨ 빛나는 스프라이트 · 재질 발광

- **책임**: 오브젝트 옆에 반투명 원형 스프라이트를 깔고(`addGlowSprite`), 재질 emissive 를 밝히는(`applyGlowToMesh`) 규칙. 화면 전체 후처리(Bloom)는 이 앱(투명 배경 오버레이)과 안 맞아 쓰지 않는다. 앱 FSD 분리 M1 — app.js SETUP 에서 글 그대로 옮겼다.
- **만드는 법**: `const glowMod = TwGlow.createGlow({});` — 받는 deps 없음(THREE 는 전역).
- **내보내는 것**: `getGlowSpriteTexture()` · `addGlowSprite(obj)` · `applyGlowToMesh(mesh)` · `applyGlowEffect(obj)` · `GLOW_SIZE_MUL` · `GLOW_COLOR` · `GLOW_EMISSIVE_BOOST`
- **함정**
  - 지금 **부르는 곳이 없다** — 아이템 발광(`equipDeskItem` 의 `applyGlowEffect`)은 «발광 없는 게 나음» 요청으로 주석 처리돼 있다. 되살리려면 그 줄을 `glowMod.applyGlowEffect(obj)` 로 바꿔 부른다(app.js 에 옛 이름이 없다).
  - 스프라이트 텍스처는 첫 부름에 한 번만 만든다(캔버스 128×128 방사형 그라디언트).
  - 검사: `checks/sim-glow.js`(진짜 three 오브젝트로 크기 · 자리 · 재질 · 실패 길 · mutation test).

## human-ear-attach.js — 🐾 사람 귀 붙이기

- **책임**: `human-ear.js`(귀 규칙)를 만들고, 사람 귀를 뼈대에 붙이는 배선 — 귀 재질(흰색 · 양면 · 플랫 조명) · 귀 그림(`def.earPicL · R`) 입히기 · 붙은 귀를 좌석 귀 목록(`seat.bones.ear`)에 올려 까닥이게 하기 · 떨어진 옛 귀 걷기 · def 에 맞게 붙이기. 앱 FSD 분리 M2 — app.js «사람 귀» 구역을 글 그대로 옮겼다.
- **만드는 법**: `const humanEarAttachMod = TwHumanEarAttach.createHumanEarAttach({ _registerAnimalEarOn, lightToneMod, seats, partPaintMod, wardrobeMod, rideBenchMod })` — 뒤의 넷은 app.js 에서 더 아래에 만들어지므로 읽는 함수(`()=>seats` …)로 넘긴다.
- **내보내는 것**: `humanEar`(모듈이 없으면 `null`) · `_humanEarMat()` · `_humanEarPic(wrap, def)` · `_syncHumanEarRig(seat)` · `_attachHumanEars(root, def)` — app.js 는 같은 이름 const 로 받는다(꾸미기 · 파츠 그림 모듈이 deps 로 받는 옛 이름).
- **함정**
  - 바인드 자세(조립 직후 · 애니메이션 전)에 불러야 한다 — holder 와 옮길 양을 이때 잰다. 귀가 없어도 holder 는 만든다.
  - 귀는 늦게 붙는다 — 이 좌석 머리 위에 이미 누가 타 있으면 그 «머리 꼭대기» 는 귀 없던 값이라 `onAttach` 가 다시 잰다.
  - 사람 기본 모델의 ear 본은 웨이트가 없어 본만 돌리면 안 움직인다 — 부착물 자체를 돌려야 해서 동물 귀 등록을 같이 쓴다.
  - 검사: `checks/sim-human-ear-attach.js`(가짜 귀 모듈 · 진짜 three 로 재질 · 등록 · 붙이기 · 실패 길 · mutation test).

## part-anim.js — ▶ 파츠 · 책상 아이템 애니메이션 재생

- **책임**: 파츠 클립 고르기(`_pickPartClip` — **실제로 움직이는** 클립이 이름보다 먼저, `idle` 정확 일치가 포함보다 먼저) · 귀 파츠 클립에서 까닥임이 맡은 본 트랙 걷기(`_stripPartClipOwnedTracks`) · 파츠 믹서 세우기 / 걷기(`_setupPartIdleAnim` · `_teardownPartIdleAnim`) · «활동 중에만 재생» 파츠(`updateActivePartPlayback`) · 아이템 idle 재생(`updateIdleItemPlayback`) · 손 본 따라가기(`updateItemHandTrackers`) · 아이템 눌러 재생(`playItemIdle`). 앱 FSD 분리 M4 — app.js BUILDERS 에서 글 그대로 옮겼다.
- **만드는 법**: `const partAnimMod = TwPartAnim.createPartAnim({ isAdmin, seatState, seats, toast, userStatus })` — `isAdmin` · `userStatus` 는 다시 대입되는 let 이고 `seats` 는 더 아래에서 선언돼 읽는 함수(`()=>isAdmin` …)로 넘긴다. app.js 는 열두 이름을 옛 이름 const 로 받는다.
- **내보내는 것**: `activeItemMixers`(매 프레임 돌릴 믹서 Set — `frame()` 이 돌린다) · `_idleItemPivots` · `_clipHasMotion` · `_pickPartClip` · `_partAnimNotice` · `_stripPartClipOwnedTracks` · `_setupPartIdleAnim` · `_teardownPartIdleAnim` · `updateActivePartPlayback` · `updateIdleItemPlayback` · `updateItemHandTrackers` · `playItemIdle`
- **함정**
  - 멈출 때 `stop()` 이 아니라 `paused = true` — stop 은 0프레임으로 되감아 파츠가 툭 튄다. 재생 판정은 `seatState(holder) === 'focus'` 일 때만(꾸미기 미리보기는 좌석이 아니라 늘 재생).
  - 옛 글의 `typeof isAdmin` · `typeof seats` 는 읽는 함수로 바뀌며 걷었다(앱이 돌기 시작한 뒤에만 불리므로 같은 뜻).
  - `_partAnimNotice` 는 첫 줄 `return` 으로 꺼져 있다(장착할 때마다 뜨던 토스트 잡음). 진단은 `console.log` 의 `[파츠 애니]` 로 본다.
  - 검사: `checks/sim-part-anim.js`(진짜 three AnimationMixer · 클립 · 상태 표로 재생 판정 · mutation test).

## desk-item-equip.js — 🪑 책상 위 아이템 장착

- **책임**: 아이템 하나를 좌석 · 생성기 미리보기(`holder`)에 올리고 내리기(`equipDeskItem` — 라이선스 전용 막기 · 손 본 부착 · `_col` 색 그룹 · `hand_L/R` 손 따라가는 지점 · 재생 방식 등록 · 커스텀 GLB 크기 맞춤 · 해제 전 위치 · 색 기억) · 저장된 아이템 한 벌 입히기(`applyDeskItemsTo` — 저장 당시 «자동 크기 대비 비율» 환산) · 모으기(`collectDeskItems`) · 켜고 끌 때 바로 저장(`autoSaveDeskItemsNow`) · 색 반영(`_applyItemColor`) · 생성기 «처음 나타난 자리» 기억(`deskItemOrigin`). 앱 FSD 분리 M5 — app.js 에서 글 그대로 옮겼다.
- **만드는 법**: `TwDeskItemEquip.createDeskItemEquip({ activeItemMixers, _idleItemPivots, lightToneMod, toast, commissionMod, crState, crXformMod, customItems, deskItemsMod, deskSetupMod, launcherPrevMod, licenseAssetBlocked, slotSaveMod })` — 앞 넷은 값(part-anim.js 가 먼저 만든 재생 목록 · 이미 있는 것), `licenseAssetBlocked` 는 함수(account-state.js — 전용 자산을 막아야 하나), 나머지 아홉은 읽는 함수(`()=>crState` …)다. 더 아래에서 만들어지거나 다시 대입되는 let 이어서다.
- **내보내는 것**: `applyDeskAdj` · `deskItemOrigin`(처음 자리 모듈이 없으면 `null`) · `equipDeskItem` · `collectDeskItems` · `autoSaveDeskItemsNow` · `applyDeskItemsTo` · `_applyItemColor` — app.js 는 같은 이름 const 로 받는다.
- **함정**
  - 라이선스 전용 막기는 **친구 좌석(`holder.remote`)에는 걸지 않는다** — 보는 사람의 라이선스로 친구가 올린 아이템이 내 화면에서만 사라진다. 내 좌석은 카탈로그 기록(`savedItems`)의 서버 `locked` 만 본다(`def.licenseOnly` 는 분류라 안 본다). 커스텀 아이템인데 기록이 아직 없으면 `locked` 를 모르는 것이라 막는다(소리 없이) — 카탈로그가 오면 `catalog-sync` 가 좌석 아이템을 다시 적용해 `locked` 로 다시 판정한다.
  - 생성기(`crState.cBase`)일 때만 선택 표시 · 처음 자리 기억 · 기즈모 해제를 한다.
  - 색 그룹이 있으면 비어 있어도 `colors` 를 항상 저장한다 — «초기화한 상태» 를 기록해야 옛 색이 안 남는다.
  - 검사: `checks/sim-desk-item-equip.js`(진짜 three 로 장착 · 해제 · 복원 · 재생 방식 · 색 · 저장 · 환산 · mutation test).

## fit-model.js — 📐 몸 · 책상 맞춤

- **책임**: `fitModel(seat)` — 캐릭터를 좌석 키에 맞춘다(몸을 재어 높이 1.45 로 정규화 · 동물은 정해진 배율 · 커미션 보정 · 몸 x 가운데 · 발바닥 맞춤 · 사용자 x · y(높이 상한) · 평준화 배율 · 리깅 파츠 xf 다시 굽기) / `fitDesk(seat)` — 책상 GLB 를 높이 0.6 에 맞추고 바닥 · 가운데 · 앞으로 0.45. 앱 FSD 분리 M8 — app.js FIT 구역을 글 그대로 옮겼다.
- **만드는 법**: `TwFitModel.createFitModel({ ANIMAL_RUN_SCALE, COMMISSION_SCALE_CORRECTION, charMeasureMod, clampCharY, seatEqMod, refreshRiggedPartsXf, creatorPrevMod, restPoseMod, fitWatchMod })` — 앞 다섯 · 뒤 둘(`restPoseMod` 기본 자세로 재기 · `fitWatchMod` 설명 안 되는 높이 경고)은 값, `refreshRiggedPartsXf` 는 함수, `creatorPrevMod` 는 더 아래에서 만들어져 읽는 함수.
- **내보내는 것**: `fitModel` · `fitDesk` — app.js 는 같은 이름 const 로 받는다.
- **함정**
  - 사용자 x · y 는 **raw `seat.userScale`** 로 나눈다(실효값 아님) — `bodyWrap.scale` 이 userScale × 평준화 k 라 raw 로 나눠야 이동량의 월드 값이 책상과 같은 배율로 따라온다. 실효값으로 나누면 평준화한 좌석에서 캐릭터가 책상을 파고든다.
  - 동물은 x · y 이동량에 `ANIMAL_RUN_SCALE`(0.4)을 곱한다 — 생성기는 100% 로, 실행 화면은 40% 로 그리는데 이동량만 절대값이면 실행 화면에서 2.5배 크게 들려 보인다(`charLiftWorld` 도 같이 바꿀 것).
  - 재는 동안 옮긴 `rig` · `bodyWrap` · `group` 은 값을 되돌린 뒤 **월드 행렬도 다시 세워 두고** 나간다 — 옛 행렬로 남으면 바로 뒤 `layoutSeats` 가 원점 근처에 있는 것처럼 읽는다.
  - 앞뒤(z) 재센터링은 하지 않는다(미리보기가 정답 기준). 되돌리려면 주석에 적힌 한 줄.
  - 검사: `checks/sim-fit-model.js`(진짜 three · body-measure · char-measure 로 정규화 · 이동량 · 동물 · 커미션 · 되돌리기 · 책상 · mutation test).

## char-apply.js — 🧬 캐릭터 def 를 좌석에 입히기

- **책임**: `applyCharToSeat(seat, def)` — 좌석에 저장된 캐릭터(def)를 입힌다(라이드 정리 · 옛 파츠 비우기 · 책상 배율(동물 60%) · 평준화 k 지움 · 커미션 / 동물 / 기본 몸 조립 · 크기 · 높이 넣기 · 파츠 · 책상 · 아이템 · 클릭 판정). 곁에 `_purgeSeatParts` · `refreshRiggedPartsXf` · `_setPlaceholderPickable` · `_registerAnimalEarOn`(동물 · 사람 귀 공용 등록) · `_sweepAnimalEars`. 앱 FSD 분리 M12 — app.js 에서 글 그대로 옮겼다.
- **만드는 법**: `TwCharApply.createCharApply({ … 37개 })` — 값 19 · 함수 11 · 읽는 함수 7(`BASE_ANIMS` · `assetCodeMod` · `curSlot` · `customItems` · `deskItemsMod` · `deskPlaceMod` · `deskVisualMod`). 원래 자리에서 만든다.
- **내보내는 것**: `applyCharToSeat` · `_purgeSeatParts` · `refreshRiggedPartsXf` · `_registerAnimalEarOn` — app.js 는 같은 이름 const 로 받는다.
- **함정**
  - `window.rebuildAnimalSeats`(동물 GLB 파싱 뒤 좌석 다시 입히기) · `window.registerAnimalEar`(귀가 붙을 때)는 **이 모듈을 만들 때** 건다 — `animal.js` 가 `window.` 로 부른다. 지우면 동물 귀가 안 붙고 동물이 인간으로 남는다. 반대로 이 모듈은 `window.buildAnimalBase`(animal.js)를 부른다 — 서로 부르는 고리라 `sim-dep-cycles` 기준선에 4건 올랐다(이슈 #903).
  - 커미션 GLB 가 캐시에 없으면 파싱만 걸고 `return` 한다. 그 앞에서 책상 배율 · z 를 한 번 맞춰 두는 까닭(한 화면 옛 z 로 그려짐)이 주석에 있다 — 순서를 바꾸지 말 것.
  - `seat._animalBuilt` 는 조건 밖에서 갱신한다 — 안 그러면 동물 GLB 파싱 전 인간 폴백일 때 직전 캐릭터의 판정이 남는다.
  - 검사: `checks/sim-char-apply.js`(파츠 비우기 · 리깅 xf · 귀 등록 · window 고리 · 입히기 갈래 · mutation test).

## rig-anim.js — 🕺 몸짓

- **책임**: `STATES` · `targetFor`(상태 → 허리 · 호흡 · 눈 · 팔 목표) · `animateRig`(좌석 한 명의 뼈를 지금 시각에 맞춰 움직임 — 타자 · 잠 · 흔들림 · 어지러움 · 춤 · 귀 까닥임 · 클릭 반응) · `setClip`(믹서 클립) · 뼈대 상수 · `boneSide` · `setBone`.
- **만드는 법**: `TwRigAnim.createRigAnim({ … 6개 })` — 모두 값(`ANIMAL_HAND_REST` · `camera` · `iDeskMod` · `rideTuneMod` · `seatPointerMod` · `userStatusMod`). 원래 자리에서 만든다.
- **내보내는 것**: 상수 · 함수 열둘을 같은 이름 const 로 받는다(`lerp` 포함 — 다른 구역이 쓴다).
- **함정**: 부호(`SPINE_AXIS` 등)와 각도 상수는 움직임 방향을 정한다 — 숫자를 바꾸면 자세가 뒤집힌다. 검사: `checks/sim-rig-anim.js`.

## cloth-visibility.js — 👕 옷 겹침

- **책임**: `_unequipClothCat`(옷 카테고리 충돌 정리 — def 는 안 건드림) · `applyClothVisibility`(착용 파츠의 `hides` 로 기본 상 · 하의 · 모자 · 안경 · 날개 · 손 메시를 보이거나 숨김). 앱 FSD 분리 T4 — app.js 글을 그대로 옮겼다(0.13 app.js 의 같은 글).
- **만드는 법**: `TwClothVisibility.createClothVisibility({ decoPartsMod, premiumMod, rideBenchMod, unequipPartFromSeat })` — 값 3 · 함수 1. app.js 가 원래 자리(파츠 붙이기 · 떼기 바로 앞)에서 만들고 두 이름을 const 로 받는다.
- **함정**
  - 자리비움 중(`mesh.userData._prevVisible` 있음)에는 `visible` 을 직접 쓰지 않고 `_prevVisible` 에 적는다 — `setSeatOpacity`(`room/seat-opacity.js`)와 같은 한 표식이다.
  - 끝의 `rideBenchMod._remeasureRideHeadTop(seat)` 가 «기본 메시 가시성이 확정된 순간» 의 머리 꼭대기 재측정이다 — `unequipPartFromSeat` 안으로 옮기지 말 것(그 함수가 끝난 뒤에 이 함수가 가시성을 되돌린다).
  - 검사: `checks/sim-cloth-visibility.js`.

## base-body.js — 🧍 기본 몸 모델 공급 · 복제 · 크기

- **책임**: 사람 몸(기본 GLB) 읽기 · 복제 · 크기는 캐릭터 코어(`createBody`)가 하고, 이 모듈은 코어 몸 만들기 · 몸 모델 자산(`window.BASE_GLB_B64`) 공급(`loadBaseGLB`) · 복제 뒤 같은 뼈대 하나로(`instantiateBase`) · 커미션 GLB 파싱 캐시(`getCommissionScene`) · 얼굴 텍스처(`mkFaceTex`) · 크기(`normalizeModel`). 앱 FSD 분리 T2 — 0.13 app.js 글 그대로(옛 `measureBaseGeometry` · `calcMeshBox` · `BASE_MESH_*` 는 선언만 있고 안 읽혀 코어로 걷음).
- **만드는 법**: `TwBaseBody.createBaseBody({ loader, skelShare, _fixGlbMatLighting, setFaceMap, applyLightPreset, assetCodeMod })` — 값 2 · 함수 3 · 읽는 함수 1(`assetCodeMod`). app.js 가 원래 자리에서 만들고 아홉 이름을 const 로 받는다. 몸 장면 · 애니메이션은 `bodyCore.baseScene()` · `baseAnims()`.
- **함정**: #830 줄(`skelShare.shareSkeletons`)이 `instantiateBase` 안에 있다 — 지우면 몸 복제마다 Skeleton 이 따로 생긴다(`sim-skeleton-share`). 몸 모델이 아직 안 읽혔으면 `baseScene()` 은 없음 — 부르는 쪽(`_baseHeadTopAboveBone` 등)이 그 값을 본다. 검사: `checks/sim-base-body.js`.

## part-xf.js — 🎀 파츠 저작 오프셋 · xf 적용

- **책임**: 파츠를 캐릭터 본에 붙일 때의 저작 오프셋(`_computePartAuthorOffset` — 바인드 자세 역행렬 `_charBoneBindInverses` 로 환산) · 머리 계열 파츠 실측 진단(`_diagPartHeadSpace`) · 동물 머리 파츠 세로 보정(`_computeAnimalHeadDy` · `_headTopAboveBone` · `_baseHeadTopAboveBone`) · 옛 보정 판별(`_isLegacyAuthorCompensation`) · wrapper 에 xf 적용(`_applyXfToWrapper` · `applyPartXf` — 본체 · 다중 파츠 extras · stackable · 책상 위 파츠 바닥 맞춤). 앱 FSD 분리 T5 — 0.13 app.js 글 그대로. 계산 본문은 코어 `createParts`(`packages/char-core/src/parts.ts`).
- **만드는 법**: `TwPartXf.createPartXf({ partsCore, PART_DEFAULT_OFFSET, premiumMod, partPaintMod, lightToneMod, bodyMeasureMod, charMeasureMod, instantiateBase })` — 값 7 · 함수 1. 코어 파츠(`partsCore = TwCharCore.createParts({…})`)는 app.js 가 모듈보다 먼저 만들어 넘긴다(`part-equip.js` 도 받는다). app.js 는 밖에서 부르는 여섯 이름을 const 로 받는다.
- **함정**: `_computePartAuthorOffset` 의 `bb` 는 `equipPartOnSeat`(`part-equip.js`)가 피봇용으로 만든 것과 «같은» 박스여야 한다 — 한쪽만 고치면 피봇과 실제 위치가 어긋난다. 검사: `checks/sim-part-xf.js`.

## part-equip.js — 🎀 파츠 붙이기 · 떼기 · def 대조

- **책임**: 꾸미기 파츠를 좌석 본에 붙이는 일의 좌석 몫 — `equipPartOnSeat`(옷 겹침 정리 · GLB 받기 · 리깅 판정 · 장착 차례 · 귀 까닥임 · 애니메이션 · 진단) · 떼기(`unequipPartFromSeat` · `unequipStackablePart` · 비동기 장착 무효화 `_invalidatePendingEquip` · 유령 wrapper 청소 `_sweepOrphanPartWrappers` · 다시 맞추기 요청) · 좌석과 def 대조(`pruneSeatPartsAgainstDef`) · 저장된 파츠 한꺼번에 입히기(`applyEquippedPartsToSeat`) · 본 찾기(`extractBonesInto`). 앱 FSD 분리 T6 — 0.13 app.js 글 그대로(복제 · 재질 · _col · _pic · 리깅 다시 묶기 · wrapper 는 코어 `createParts` 호출).
- **만드는 법**: `TwPartEquip.createPartEquip({ … })` — 21개(값 5 · 옛 이름으로 받은 part-xf · cloth-visibility · part-anim 함수 · 함수 2 · 읽는 함수 `partSceneMod`). app.js 가 `part-xf.js` 와 옷 겹침 뒤에서 만들고 밖에서 부르는 아홉 이름을 const 로 받는다.
- **함정**: 해제는 먼저 `_invalidatePendingEquip` 으로 번호를 올려야 늦게 도착한 장착이 스스로 멈춘다(유령 파츠 방어). `pruneSeatPartsAgainstDef` 의 파츠 정보 조회 실패는 «없음» 이 아니라 «유지» 다(착용 파츠 증발 사고). `skelShare.shareSkeletons` 두 줄(#830 — 본체 · 다중 파츠 사본)을 지우지 말 것(`sim-skeleton-share`). 검사: `checks/sim-part-equip-mod.js`.

## animal.js — 🐾 동물 생성기 · 동물 카드

- **책임**: 예전엔 app.js 다음 `<script>` 로 실려 app.js 맨 위 이름을 그냥 불렀다(R7). 지금은 `TwAnimal.createAnimal(deps)` 로 받는다 — app.js 보다 먼저 싣고(html), app.js 끝의 «화면 모듈 둘(M23)» 줄에서 INIT 뒤에 만든다(옛 «app.js 다음 script» 와 같은 때 · 같은 차례).
- **받는 deps**: 값 `lightToneMod` · `loader` · `focusLevelMod` · `accountStoreMod`(해금 기록 계정 칸) · `accountJsonStoreMod`(동물 프리셋 JSON 칸) · `ANIMAL_HAND_REST` · `partPaintMod` · `slots`(제자리 고침 — 다시 대입 안 됨) · `slotSaveMod` · `Presence` · `LIGHT_PRESET` · 함수 아홉(`normalizeModel` · `toast` · `bindHold` · `applyDesktopRunClass` · `renderLauncher` · `applyCharToSeat` · `layoutSeats` · `openCreator` · `saveCurSlot`) · 읽는 함수 넷(`isAdmin` · `curSlot` · `creatorMode` · `creatorOpen`) · 쓰는 함수 둘(`setCurSlot` · `setCreatorOpen`).
- **함정**: `curSlot` · `creatorOpen` 은 이 모듈이 바꾸는 app.js 의 let 이라 쓰는 함수로만 바꾼다. 자료(`animal-glb.js` · `ears-glb.js`)는 이 모듈보다 먼저 싣는다. 검사: `checks/sim-global-deps.js`(deps 없이 app.js 이름을 부르는 곳 0 · deps 짝 · 연결).
