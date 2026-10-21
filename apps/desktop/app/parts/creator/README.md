# creator/ — 캐릭터 생성기

모듈마다 절 하나. 모양은 모두 같다 — `window.TwXxx = { createXxx(deps) }`, app.js 가 원래 구역 자리에서 `const xMod = TwXxx.createXxx({ … })` 로 만든다.
생성기 상태(`cBase` · `cDesk` · `cDeskPos` · `cXform` …)는 `creator-state.js` 한 곳에 있다 — app.js 는 `crState.이름`, 새 생성기 조각 모듈은 `crState` 하나를 deps 로 받는다.

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
  조명 세기는 `LIGHT_PRESET` · `_KEY_LIGHT_MUL` · `_FILL_LIGHT_MUL`(실행 화면과 같은 몫), 빛 색은 `LIGHT_PRESET.h` + `CREATOR_LIGHT_SL`(채도 · 명도) — 숫자는 모두 캐릭터 코어 `lighting.ts`(웹 생성기와 같다)이고, 앱에서는 둘 다 `lightToneMod` 한 길로 받는다.
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

## commission-import.js — 🎨 커미션 캐릭터 코드 입력

- **책임**: 종족 선택창의 [코드로 등록] 패널 — 코드 머리글자로 가른다: `DCC1.`(캐릭터 복제 코드) → `charCodeMod.importCloneCode` 로 그대로,
  `DCK1.`(책상 · 아이템) → 생성기 안으로 가라는 안내만, `DCM1.`(커미션) → 풀어서 빈 칸에 커미션 캐릭터로 등록 → 바로 생성기(책상부터). 그 밖은 «코드 형식이 아니에요».
- **만드는 법**: `TwCommissionImport.createCommissionImport(deps)` — 만들 때 버튼(`raceCommCode` · `commImpCancel` · `commImpGo`)에 건다.
  값: `slots` · `CANVAS_SZ` · `racePickerMod`(정한 칸) · `creatorSaveMod`(용량 재기) / 읽는 함수: `curSlot` · `charCodeMod` · `charsMod` · `commissionMod` · `slotSaveMod` / 쓰는 함수: `setCurSlot` /
  함수: `charDef` · `openCreator` · `renderLauncher` · `saveCurSlot` · `toast`.
- **내놓는 것**: 없음(버튼에만 건다).
- **확장할 때**: 코드 종류가 늘면 머리글자 갈래(①②③)에 한 줄씩 — 등록 로직은 그 코드를 맡은 모듈의 함수를 부른다(여기서 새로 구현하지 않는다).
- **함정**: 칸은 [＋]로 정한 칸이 비어 있을 때만 그 칸, 아니면 첫 빈 칸 · 빈 칸이 없으면 거부(덮어쓰지 않는다). 형식은 미리 걸렀으니 catch 의 실패는 «비밀번호» 로 안내한다.
- **검사**: `checks/sim-commission-import.js` — 모양 · 연결 · 깨 보기 + 패널 열고 닫기 · 갈래 셋 · 복호화 못 쓰는 환경 · 칸 고르기 · 등록 칸 값 · 용량 · 보관함 문턱 · 암호 틀림 · 그림 못 읽음.

## `creator-xform.js` — 🧭 생성기 변형(아이템 3D 기즈모 · 좌석 세팅 6단계)

**책임** — 생성기 미리보기에서 책상 위 아이템 · 책상 · 캐릭터를 옮기고 돌리고 키운다. TransformControls 하나(`itemGizmo`)를 아이템 또는 책상에 붙이고,
드래그가 끝나면 아이템은 `userData.adj`(x · y · z · rot · scale)로, 책상은 `cDeskPos` 로 되짚어 저장한다. 끄는 동안 바닥(y=0) 아래로는 못 간다.

**만드는 법** — app.js «👻 …» 덩어리의 «아이템 3D 기즈모» 자리(책상 세팅 뒤 · 코드 만들기 앞):

```js
const crXformMod = TwCreatorXform.createCreatorXform({
  cBase: ()=>cBase, cDesk: ()=>cDesk, cDeskPos: ()=>cDeskPos, cXform: ()=>cXform, …   // 읽는 함수 11
  setCDeskPos: (v)=>{ cDeskPos = v; }, setCDeskLenX: …, setCDeskScale: …,           // 쓰는 함수 3
  applyDeskAdj, autoSaveDeskItemsNow, floorClampWrapper, layoutSeats, …              // 함수 13(화살표)
  CHAR_Y_MAX, DESK_SCALE_DEFAULT, deskItemOrigin,                                    // 값 3
});
```

만들 때 버튼 · 슬라이더를 건다: `#crItemPos .cr-gz-mode`(이동 · 회전) · `crItemBigger/Smaller`(꾹 누르면 연속 · 0.05 칸 · 0.05 ~ 2.5) · `crItemRemove`(크기만 초기화) ·
`crItemXfReset`(이동 · 회전만 — 처음 자리로) · `deskAddCode/itemAddCode` · `crScale/crZ(높이)/crRot` · `#seatStage .mini-reset` · `deskPosGz/deskPosReset` · `deskScaleReset` · `deskLenX/deskLenXReset`.

**내놓는 것**

| 함수 | 쓰는 곳 |
|---|---|
| `attachItemGizmoToActive()` | 아이템을 고르거나 풀 때(`cBase.activeDeskItem` 기준) — 아이템을 고르면 책상 위치 모드는 꺼진다 |
| `detachItemGizmo()` | 생성기를 닫을 때 |
| `updateDeskPosNum()` | 책상 위치 숫자 글(`기본 위치` 또는 `x 1.00 · y … · z …`)을 다시 쓸 때(프리셋 · 열기) |

**확장할 때 고칠 자리** — 새 저장 칸은 `dragging-changed` 의 아이템 갈래(adj 에 한 줄) · 크기 범위 · 한 칸 · 기즈모 크기 · 캐릭터 크기 되돌리기 값은 파일 위 상수(`ITEM_SCALE_MAX` · `ITEM_SCALE_MIN` · `ITEM_SCALE_STEP` · `ITEM_GIZMO_SIZE` · `CHAR_SCALE_DEFAULT`).

**함정**
- 회전은 Y 축 하나(`adj.rot`)만 저장한다 — 회전 모드에서 X · Z 고리를 다시 보이게 하지 말 것. 저장은 `_itemYaw`(YXZ 로 푼 y) — `rotation.y` 는 90° 를 넘으면 거울상 각도다.
- 책상 바닥 클램프는 파츠 핀(`DESK_PART_ANCHOR_NAME`)을 빼고 잰다 — 같이 재면 끌 때마다 책상이 솟는다.
- 책상 드래그 끝 갈래는 아이템 갈래보다 **먼저** 보고 빠져나간다 — 남아 있던 activeDeskItem 에 책상 값이 들어가지 않게.
- 생성기 책상은 배율 1 이라 position 이 곧 deskPos 다(생성기에 animCorr 을 심으면 깨진다).

검사: `checks/sim-creator-xform.js` (슬라이더 · 아이템 버튼 · 기즈모 붙이기 · 드래그 끝 저장 · 책상 위치 · 길이 · 배율 · 연결 · 깨 보기).

## `creator-state.js` — 🧍 생성기 상태(세션 값)

**책임** — 캐릭터 생성기 한 세션의 값 58개(미리보기 3D `cRenderer · cScene · cCam · cBase` · 카메라 `camDist · camYaw …` · 단계 `crStep` · 붓 `brushColor · brushSize · eraser · lastPX …` · 도장 `stampMode · stampPlace …` · 책상 세팅 `cDesk · cDeskPos · cDeskScale · cXform …` · 코드 가져오기 `_assetImpKind · _assetImpCat`)를 처음 값과 함께 한 곳에 든다. 값을 들고 내놓기만 한다(그리기 · 저장 · DOM 없음).

**만드는 법** — app.js «CREATOR + LAUNCHER» 머리, `DESK_SCALE_DEFAULT` 바로 뒤(이 값보다 앞에서 생성기 상태를 쓰는 부팅 줄은 없다):

```js
const crState = TwCreatorState.createCreatorState({
  DESK_SCALE_DEFAULT: DESK_SCALE_DEFAULT,   // 값 — 책상 크기 처음 값(HTML 슬라이더와 짝이라 app.js 에 둔다)
});
```

**내놓는 것** — 이름마다 get · set 이 붙은 객체 하나. 보통 변수처럼 읽고 대입한다.

```js
if(!crState.cBase) return;
crState.crStep = 5;
crState.cDeskPos.x = 0.1;          // 안쪽을 바꾸는 것도 그대로
crState.camYaw += dx * 0.01;
```

생성기 조각을 모듈로 옮길 때는 이름마다 읽는 · 쓰는 함수를 넘기지 말고 `crState: crState` 하나를 넘긴다(모듈 안에서 `const crState = deps.crState;` → `crState.cBase`).

**확장할 때 고칠 자리** — 새 세션 값은 모듈의 `let` 줄(처음 값)과 맨 아래 `return { get … set … }` 한 줄 · `checks/sim-creator-state.js` 의 `INIT` 표. app.js 에 생성기 값을 새 꼭대기 `let` 으로 만들지 않는다.

**함정**
- `creatorOpen` · `creatorMode` · `curSlot` 은 여기 없다 — animal.js 가 전역 이름으로 직접 읽어서 app.js 에 남겼다(옮기려면 animal.js 를 deps 로 바꾼 뒤).
- `crState` 는 만드는 줄보다 앞에서 부팅 때 바로 쓰면 TDZ — 함수 안(나중에 불림)은 괜찮다.
- 처음 값의 객체(`cXform` · `cDeskPos` · `stampPlace`)는 만들 때마다 새것이다 — 다른 곳과 같이 쓰는 객체로 바꾸지 말 것.

검사: `checks/sim-creator-state.js` (처음 값 58개 · get/set · 만들 때마다 따로 · 연결 · 맨 이름 참조 없음 · 깨 보기).

## `paint-stroke.js` — 🖌 얼굴에 칠하기(획 · 대칭 · 페인트통 · 스포이드)

**책임** — 생성기 미리보기에서 누른 화면 점을 얼굴 UV 로 맞혀 그림 층(`actC()`)에 획을 잇는다. 맞히기는 앞면만 · 옷이 앞에 있으면 없음, 획은 솔기(3D 이동량에 비해 UV 가 크게 뛰는 곳)에서 끊고, 화면 경로는 6px 단위(최대 8번)로 쪼갠다. 대칭이면 거울 자리에도, 페인트통은 누른 UV 섬만, 스포이드는 그 픽셀 색을 붓 색으로.

**만드는 법** — app.js «되돌리기 · blit» 바로 뒤:

```js
const paintStrokeMod = TwPaintStroke.createPaintStroke({
  CANVAS_SZ: CANVAS_SZ,          // 값 — 그림 층 한 변(512)
  crState: crState,              // 값 — 생성기 상태(cBase · cCam · brushColor · brushSize · eraser · symmetry · 획 기억 lastPX …)
  paintGeomMod: paintGeomMod,    // 값 — 선 긋기 · 거울 UV(shared/paint-geom.js)
  partPaintMod: partPaintMod,    // 값 — 리깅 맞히기(_picIntersect) · UV 배율(_wdPicUvScale)
  swEl: ()=>swEl,                // 읽는 함수 — 색 견본 줄(뒤에서 선언)
  actC: (...a)=>actC(...a),      // 함수 — 지금 그림 층(표정 / 감은눈)
  // … _crDropEraser · blit · isDrawStep · pushHistory · toast
});
```

**내놓는 것**

| 이름 | 하는 일 |
|---|---|
| `paintFromEvent(e)` | 포인터 이벤트 하나 — 직전 화면 점과의 경로를 쪼개 맞히고 잇는다(빗나가면 끊는다) |
| `bucketFromEvent(e, erase)` | 페인트통 — 누른 UV 섬을 채운다(대칭이면 거울 섬도 같은 되돌리기 한 칸). 못 채우면 안내 토스트 · false |
| `eyedropFromEvent(e)` | 스포이드 — 거의 투명한(알파 < 8) 픽셀은 무시 |
| `_paintBreak()` | 획을 끊는다(다음 점은 새 점) |
| `_pray` · `_pndc` | 도장이 같이 쓰는 광선 |

```js
cv.addEventListener('pointerdown', e=>{ pushHistory(); crState.lastPX=null; paintStrokeMod.paintFromEvent(e); });
```

**확장할 때 고칠 자리** — 쪼개기 간격 · 횟수는 `CR_PAINT_STEP_PX` · `CR_PAINT_MAX_STEPS`(꾸미기 `_wdPicStrokeTo` 와 같은 값). 솔기 허용 `SEAM_UV_*` · 가려짐 여유 `OCCLUDE_EPS` · 스포이드 `EYEDROP_MIN_ALPHA` 는 파일 위 상수. 가려짐에 넣을 옷은 `_paintHitAt` 의 `occ` 목록.

**함정**
- 가려짐 판정에 모자 · 안경 · 탈은 넣지 않는다 — 얼굴 위에 얹는 파츠라 그 아래를 칠하려는 경우가 있다.
- 입구 전제 — 세 입구 모두 그리기 단계 · 캐릭터(`crState.cBase`) · 얼굴 메쉬 · 미리보기 캔버스(`#creatorPreview`)가 없으면 아무것도 안 한다. 새 입구를 더하면 같은 확인을 맨 앞에.
- 얼굴 · 옷은 리깅이라 기본 레이캐스트(바인드 포즈)가 아니라 `partPaintMod._picIntersect`(지금 자세)로 맞힌다.
- 옷은 같은 장면에 붙은 것만 본다 — 동물 생성기로 바뀌면 옷 참조가 장면에서 떼어진 옛 메쉬일 수 있다.
- 선 긋기(`strokeSeg`) · 거울 UV(`mirrorUVOn`)는 꾸미기 파츠 그리기도 같이 써서 `shared/paint-geom.js` 에 있다 — 여기로 다시 가져오면 part-paint 와 서로를 부른다.

검사: `checks/sim-paint-stroke.js` (획 · 쪼개기 · 끊기 · 지우개 · 가려짐 · 솔기 · 대칭 · 페인트통 · 스포이드 · 입구 전제 · 연결 · 깨 보기 12).

## `stamp.js` — 🖼 이미지 도장(띄워 놓고 확정 찍기)

**책임** — 불러온 그림을 미리보기 위에 띄워(옮기기 · 모서리로 크기 · 손잡이로 회전) 두었다가, 찍으면 얼굴 그림 층에 곡면을 따라 박는다. 찍기는 화면의 도장 사각형을 28×28 격자로 얼굴에 쏘아 UV 를 얻고, 삼각형마다 픽셀로 직접 래스터해 오프스크린에 다 조립한 뒤 그림 층에 한 번 얹는다. 대칭이면 거울 자리도(도장이 가운데 근처면 생략).

**만드는 법** — app.js 칠하기(paintStrokeMod) 바로 뒤:

```js
const crStampMod = TwCrStamp.createCrStamp({
  CANVAS_SZ: CANVAS_SZ,
  crState: crState,                // 값 — stampMode · stampImg · stampPlace · stampDirty · cBase · cCam · symmetry · crStep
  paintStrokeMod: paintStrokeMod,  // 값 — 같은 광선(_pray · _pndc)
  partPaintMod: partPaintMod,      // 값 — 리깅 맞히기 · 감아 칠하기(_stampWrapFill) · UV 배율
  // … _crDropEraser · actC · blit · isDrawStep · pushHistory · toast
});
```

**내놓는 것**

| 이름 | 하는 일 |
|---|---|
| `setStampMode(on)` · `cancelStamp()` | 도장 모드 켜기(지우개 끔 · 버튼 · 패널 · 띄운 그림) / 끄기 |
| `clearStampState()` | 생성기를 닫을 때 — 화면만 닫고 그림 · 배치는 남긴다(다음 캐릭터에서 바로 다시 쓰게) |
| `loadStampFromFile(file)` | 그림 불러오기 — 처음이면 짧은 변 × 0.4 · 가운데, 크기 · 회전을 만진 뒤(dirty)면 배치 그대로 |
| `resetStampPlacement(alsoPos)` | 크기 · 회전 처음대로(`true` 면 위치도 가운데로) |
| `commitStamp()` | 찍기 — 90% 넘게 얼굴 밖이면 안 찍고 알림 · 20% 넘게 밖이면 «n%만 찍힘» |
| `bindStampOverlay()` | 띄운 그림의 손잡이(이동 · Shift 가운데 맞춤 · 회전 Shift 15° · 모서리 최소 20 · Shift 비율 유지) — 부팅 때 한 번 |

**확장할 때 고칠 자리** — 파일 위 상수: 격자 `STAMP_GRID`(28) · 처음 너비 `STAMP_FIRST_W` · 안내 비율 `STAMP_SKIP_RATIO` · `STAMP_WARN_RATIO` · 이음새 허용 `STAMP_SEAM_*`(외삽한 점은 `UV_EDGE_MAX`) · 회전 단위 `STAMP_ROT_SNAP_DEG` · 최소 크기 `STAMP_MIN_PX`. 외삽 칸은 `EXTRA_MAX`.

**함정**
- 입구 전제 — 미리보기 캔버스(`#creatorPreview`) · 띄운 그림(`#stampOverlay` · `#stampOverlayImg`) · 찍기/취소 버튼이 없으면 아무것도 안 한다.
- 삼각형을 clip + drawImage 로 그리지 말 것 — 겹친 띠에서 알파가 두 번 쌓이거나(진한 빗금) 이웃 픽셀을 지운다(밝은 빗금).
- `character/animal.js` 의 `aCommitStamp` 에 찍기 코드가 한 벌 더 있다 — 한쪽을 고치면 다른 쪽도(묶기는 IMPROVEMENT_BACKLOG).

검사: `checks/sim-cr-stamp.js` (모드 · 불러오기 · 초기화 · 찍기 진짜 래스터 · 90% / 20% · 대칭 · 손잡이 · 입구 전제 · 연결 · 깨 보기 14).

## `asset-import.js` — 📥 코드로 추가하기(책상 · 아이템 · 파츠)

**책임** — 판매자가 준 암호 코드 + 비밀번호를 풀어 책상 · 아이템 · 파츠를 **이 기기에만** 넣는다(카탈로그 · Firebase 에는 안 올림). 넣을 종류는 코드 안의 값이 아니라 어느 버튼으로 창을 열었는지로 정한다. 거르기 순서: 복호화 → GLB 1MB → 종류별 개수 한도(파츠는 그 칸의 꾸미기 통만 · 가챠 빼고) → 생성기가 열려 있고 책상 · 아이템이면 캐릭터 용량(책상은 지금 책상 자리를 비운 나머지와 견줌).

**만드는 법** — app.js «책상·아이템 코드: 가져오기» 자리, 바로 뒤에 구독 한 줄:

```js
const assetImportMod = TwAssetImport.createAssetImport({
  crState: crState,                       // 값 — _assetImpKind · _assetImpCat · cBase · cDesk · cDeskScale …
  premiumMod: premiumMod,                 // 값 — 파츠 칸 · 개수 · 저장
  assetCodeMod: ()=>assetCodeMod,         // 읽는 함수 — 복호화 · 풀기 · GLB 파싱(뒤에서 만들어짐)
  // … 함수 8 · 읽는 함수 8(DEF_SIZE_TOAST_MS · codeCryptoMod · commissionMod · creatorOpen · customItems · deskItemsMod · partSceneMod)
});
assetImportMod.onPartAdded(()=>wardrobeMod.renderWardrobe());   // 파츠를 넣으면 꾸미기 창을 다시 그린다
```

**내놓는 것**
- `openAssetImport(kind, cat)` — `'desk' | 'item' | 'part'`(파츠는 칸 `cat`). 제목 · 입력 비우기 · 창 열기.
- `onPartAdded(fn)` — 파츠를 넣은 뒤 부를 곳. 꾸미기 창이 이 창을 열기도 해서 `wardrobeMod` 를 deps 로 받으면 둘이 서로를 부른다(sim-dep-cycles) — 그래서 구독.

**확장할 때 고칠 자리** — 새 종류는 `openAssetImport` 의 제목 · [추가] 처리의 한도(`arr` · `_maxAssets`) · 등록 갈래 세 곳. 한도 숫자는 commissionMod · premiumMod 의 상수.

**함정**
- 입구 전제 — 창(`#assetImpOverlay`) · [추가] · [취소] 버튼이 없으면 만들 때 버튼을 걸지 않고, 열지도 않는다.
- 책상을 넣을 때 크기(`cDeskScale`)는 바꾸지 않는다 — 슬라이더로 맞춰 둔 값을 그대로 둔다(처음값으로 돌리면 매번 슬라이더가 튄다).

검사: `checks/sim-asset-import.js` (창 열기 · 거르기 7 · 등록 3 · 구독 · 입구 전제 · 연결 · 깨 보기 12).

## `desk-preset-store.js` · `desk-preset.js` — 🗂 책상 · 좌석 세팅 프리셋(5칸)

**책임** — 생성기 5 · 6단계의 책상 · 좌석 세팅을 5칸(모든 캐릭터 칸 공용)에 담아 두었다가 지금 캐릭터에 한 번에 적용한다.
- `desk-preset-store.js` — 저장만: localStorage `tw.deskPresets` 를 늘 5칸으로 읽고(빈 칸 null · 깨진 값이면 빈 5칸), 앞 5칸만 쓴다. 쓸 때 카탈로그 책상은 GLB 바이트를 빼고 id 만 남긴다(`slimPresets` — 옛 칸도 같이).
- `desk-preset.js` — 담기(책상 색 · 크기 · 길이 · 위치 · 모델 · 아이템 · 로컬 아이템 · 좌석) · 적용 · 칸 화면(클릭 불러오기 · 우클릭 저장 / 비우기 · 팝업 버튼).

**만드는 법** — app.js 생성기 «책상 크기 슬라이더» 앞, 저장 모듈을 먼저:

```js
const deskPresetStoreMod = TwDeskPresetStore.createDeskPresetStore({
  jsonStore: TwJsonStore,
  notifyError: (...a)=>TwErrorCodes.notify(...a),
  isCatalogDesk: (id)=>commissionMod.catalogBacked(commissionMod.savedDesks().find(d=>d.id===id)),   // 카탈로그 판단은 commission.js 한 곳
});
const deskPresetMod = TwDeskPreset.createDeskPreset({
  crState: crState,                          // 값 — cDesk* · cXform · activeCustomDeskId · cDeskGlbB64 · deskCamSaved · crStep
  deskPresetStoreMod: deskPresetStoreMod,    // 값 — 5칸 읽기 · 쓰기
  premiumMod: premiumMod,                    // 값 — 라이선스 전용 책상 판정
  isPremium: ()=>isPremium,                  // 읽는 함수
  // … 함수 15 · 읽는 함수 8 · DEFAULT_DESK_OVERRIDE_ID
});
```

**내놓는 것** — `deskPresetStoreMod.loadDeskPresets()` · `saveDeskPresets(arr)` · `slimPresets(arr)` · `PRESET_SLOTS`. `deskPresetMod` 는 없음(만들 때 팝업 버튼을 건다).

**확장할 때 고칠 자리** — 담을 값은 `captureDeskPreset` 과 `applyDeskPreset` 의 같은 이름 칸을 짝으로. 칸 수는 `desk-preset-store.js` 의 `PRESET_SLOTS`(칸 화면도 이 값을 읽는다).

**함정**
- 좌석 높이는 `p.seat.y` — 옛 프리셋의 `p.seat.z`(앞뒤)는 읽지 않는다(읽으면 캐릭터가 공중에 뜬다).
- 로컬 아이템의 라이선스 전용 여부는 프리셋 값이 아니라 원본 카탈로그(savedItems)에서. 라이선스 전용 책상은 라이선스 · 관리자가 아니면 쓰지 않고 기본 책상으로 연다.
- «기본 책상» 프리셋은 관리자가 등록한 기본 책상(`__default_desk__`)이 있으면 그것을 — 내장 책상과 폭이 달라 미리보기 크기가 어긋난다.
- 카탈로그 책상 GLB 를 칸마다 base64 로 담으면 이 PC 저장소가 넘친다(1MB 책상이면 4번째 칸부터 저장 실패 — 10-16 제보 8). 그래서 저장은 id 만, 적용은 바이트가 없으면 카탈로그 기록에서 받는다(`_presetDeskGlb`). 카탈로그에도 없으면 `E-CHAR-08` + 기본 책상. 직접 넣은(카탈로그에 없는) 책상은 다시 받을 곳이 없어 예전처럼 바이트를 담는다.
- 입구 전제 — 적용 · 저장은 캐릭터(`crState.cBase`)가 있어야, 칸 화면은 `#crPresetSlots` · 버튼이 있어야.

검사: `checks/sim-desk-preset.js` (저장 4 · 담기 · 적용 · 책상 모델 7 · 카탈로그 책상 8 · 칸 화면 · 팝업 · 입구 전제 · 연결 · 깨 보기 15).

## `asset-cards.js` — 🃏 자산 카드 공용(카드 · 도트 썸네일 · ☰ 순서)

**책임** — 생성기 책상 세팅과 꾸미기가 같이 쓰는 카드 도우미 셋. 썸네일 카드 한 장(`swThumb`), 카드에 GLB 도트 썸네일 얹기(`applyDeskDotThumb` — 배포 썸네일 우선 · 없으면 한 번만 구워 `window._deskThumbCache` 에 · 실패는 기억), 포인터로 끄는 순서 바꾸기(`bindReorderHandle` — Electron 에서 HTML5 draggable 이 불안정해서).

**만드는 법** — `const assetCardsMod = TwAssetCards.createAssetCards({ partSceneMod: ()=>partSceneMod });`(«책상 세팅(5단계)» 머리).

**내놓는 것** — `swThumb(label, on, icon, onDelete, active)` → 카드(첫 자식 = 아이콘 상자) · `applyDeskDotThumb(rec, card)` · `bindReorderHandle(handle, cardEl, id, onDrop)` — 카드에 `dataset.reorderId` 를 붙여 두면 놓은 자리를 찾는다.

**함정** — 썸네일을 얹을 때 이모지(글자 노드)만 걷는다 — × · ✎ · ☰ 버튼은 남긴다. 고름(active) 색이 켜짐 색보다 먼저다.

검사: `checks/sim-asset-cards.js`.

## `desk-setup.js` — 🪑 책상 세팅(5단계)

**책임** — 책상 카드(기본 · 저장 책상 — 전용 책상은 관리자만 · 카탈로그 것은 관리자만 회수)와 아이템 카드(기본 셋 + 커스텀, 5개씩 쪽 넘김)를 그리고, 고르기 · 지우기 · 순서 바꾸기(관리자 — 카탈로그 순서 저장) · 놓인 아이템 고르기(카드 우클릭 · 미리보기 우클릭) · 책상 색 칸을 잇는다.

**만드는 법** — app.js «책상 세팅(5단계)» 자리, 그리고 crXformMod 를 만든 바로 뒤에 갈고리:

```js
const deskSetupMod = TwDeskSetup.createDeskSetup({
  crState: crState, assetCardsMod: assetCardsMod, premiumMod: premiumMod,
  catalogNet: ()=>window.firebaseAPI,   // 데이터 provider — 회수 · 순서 저장(서버 이관 때 이 줄만)
  // … 값 5 · 함수 10 · 읽는 함수 10
});
// … const crXformMod = …;
deskSetupMod.setHooks({
  openDeskRegister: (...a)=>adminPartReg.openDeskRegister(...a),
  attachItemGizmo: ()=>crXformMod.attachItemGizmoToActive(),
});
```

**내놓는 것** — `renderCrItems()` · `selectDeskItemForAdjust(pivot)` · `setHooks({ openDeskRegister, attachItemGizmo })`.

**확장할 때 고칠 자리** — 쪽당 카드 수 `CR_ITEM_PAGE_SIZE`(5). 카드에 새 버튼은 `swThumb` 결과의 첫 자식(아이콘 상자)에 붙인다.

**함정**
- 관리자 등록 창 · 기즈모 모듈을 deps 로 받지 않는다 — 둘 다 책상 카드를 다시 그리려고 이 모듈을 불러 서로를 부르게 된다(sim-dep-cycles). 갈고리로만.
- 카탈로그 책상 · 아이템은 GLB 를 def 에 안 싣는다 — 용량은 코드로 넣은 것만 잰다.
- 입구 전제 — 카드 줄(`#crDeskRow` · `#crItemRow`) · 색 칸 · 미리보기가 없으면 그리지 · 걸지 않는다. 아이템 고르기는 캐릭터가 있어야.
- `bindHold`(꾹 누르면 반복)는 animal.js 가 전역으로 읽어서 app.js 에 남겼다.

검사: `checks/sim-desk-setup.js`.
