# 캐릭터 코어 라이브러리 · 메인 홈페이지 웹 생성기 — 기획서

> 상태: 기획(코드 변경 없음) · 결정 2026-10-20(사용자) · 앱 쪽 떼어 내기는 **0.13.0** · 기준 코드 `release/0.12.0`
> 공개 저장소 문서다 — 서버 내부(판정 방식 · 내부 길 · 저장 구조 · 횟수 제한 값)는 적지 않는다. 서버는 아래 «API 규격» 을 받아 서버 저장소에서 따로 설계한다.

## 한 줄 요약
캐릭터를 3D 로 만드는 코드(몸 · 얼굴 · 파츠 · 귀 · 동물 · 색조 · 복제 코드)를 **앱에서 떼어 라이브러리(`packages/char-core`, 자기 버전)** 로 만들고, 앱(Electron)과 메인 홈페이지(웹)가 **같은 한 벌**을 쓴다. 웹 겉(메뉴 · 소식 · 라이브러리 · 다운로드)은 React + Vite + TS, 생성기 속은 프레임워크 없는 TS 라이브러리.

## 1. 목표 · 범위 · 하지 않는 것
**목표**
- 웹에서 캐릭터를 만들어 볼 수 있다(1단계: 로그인 없이 → 복제 코드 DCC1 로 앱에 가져감 · 2단계: 로그인해 내 계정에 바로 저장).
- 생성기가 앱 · 웹에 **두 벌 생기지 않는다** — 파츠 하나 고칠 때 한 곳만 고친다 · DCC1 호환이 깨지지 않는다.
- 라이브러리는 버전을 따로 낸다 — 앱 · 웹이 «이 판을 쓴다» 고 정하고 원할 때 따라간다.

**범위**: 폴더 구조 바꾸기 · `packages/char-core` · 앱 0.13.0 떼어 내기 · 웹 1 · 2단계 · 프론트가 바라는 API 규격.

**하지 않는 것**
- three.js 판 올리기(지금 r128) — 별도 작업. 처음엔 r128 에 맞춘다.
- 좌석 · 방 · 책상 · 올라타기 · 저장 · 동기화를 라이브러리로 옮기기 — 앱에 남는다.
- 유료(라이선스) · 가챠 · 커미션 자산을 웹에 싣기 — 아래 «4. 자산 경계».
- 서버 구현 — 서버 저장소 몫.

## 2. 폴더 구조 (동작 무변경 단계로 따로)
```
/ (루트 — npm workspaces · 공용 설정 · 검사 러너)
├─ apps/desktop        지금 루트의 앱(main.js · preload.js · overlay-* · sysinput-* · app/ · build/)
├─ apps/web            메인 홈페이지(React + Vite + TS · FSD — web-admin 과 같은 틀)
├─ apps/admin          지금 web-admin/
├─ packages/char-core  캐릭터 코어(TS · 자기 버전 · 빌드 두 벌)
└─ firebase/           firebase.json · 규칙 · functions/ · hosting/
```
**원칙**: 폴더 옮기기 PR 에는 동작 변경을 섞지 않는다(경로만). 옮긴 뒤 설치 파일 · 검사 · 배포가 그대로인지 확인하고 다음 단계로.

**영향 목록(옮길 때 같이 고칠 것)**
| 무엇 | 지금 | 할 일 |
|---|---|---|
| 검사 `checks/` | 약 237개 파일이 `app/` · `web-admin/` · `functions/` · `hosting/` 경로를 안다 · 러너(`checks/run.js`)가 원본을 찾아 스테이징 | 러너의 원본 찾기를 새 경로로 · 경로를 글자로 박은 검사는 같이 고침 · CHECKS.md §3 해시 |
| 앱 빌드 | 루트 `package.json`(`main`, `build.files`, electron-builder) | `apps/desktop/package.json` 으로 · 설치 파일 내용이 같은지(asar 목록 비교) |
| CI | `.github/workflows/checks.yml`(경로 조건) · `release.yml` · `release-start.yml` · `deploy-dev.yml` · `mac-probe.yml` | 작업 폴더 · 경로 조건 · 산출물 경로 |
| Firebase | 루트 `firebase.json`(규칙 · functions · Hosting 사이트 둘 · 웹 관리자 predeploy) | `firebase/` 로 · `predeploy` 의 웹 관리자 경로 · 배포 명령을 치는 폴더가 바뀜(문서 · 기억) |
| 문서 | CLAUDE.md 구조 표 · `docs/*` · 하네스(`.claude/`)의 경로 | 같이 고침(하네스는 가드 자리 — 승인) |

## 3. `packages/char-core`
### 3.1 하는 일 · 하지 않는 일
| 들어감(코어) | 지금 있는 곳 |
|---|---|
| 캐릭터 정의(def) 모양 · 정리(`charDef` · 옛 칸 맞추기) | `app/parts/app.js` `charDef` · 여러 곳 |
| 몸 모델 불러오기 · 정규화 | `app.js` `loadBaseGLB` · `instantiateBase` · `normalizeModel` · `measureBaseGeometry` · `calcMeshBox` · (예비) `buildCreatorBase` · `buildFacePatchGeo` |
| def → 3D 캐릭터 한 덩어리 | `app.js` `defToBase`(진입점) |
| 얼굴 · 피부 캔버스 합성 | `app.js` `CANVAS_SZ` · `FACE_SYM_SUM` · `newCanvas` · `compositeFace` · `mkFaceTex` · `_isBlankDraw` · `snapCanvas` · `SKIN_COLORS` · 피부 그림(`loadSkins` ← `window.SKIN_PNGS`) |
| 재질 · 색조 · 조명 프리셋 | `character/mat-tone.js` |
| 사람 귀 · 동물 몸 · 동물 귀 | `character/human-ear.js` · `character/animal.js`(동물 조립 `buildAnimalBase` · 귀 파싱 `parseAnimalEar`) |
| 파츠 붙이기(옷 겹침 · 쌓기 · 위치 · 크기 · 회전) | `app.js` `equipPartOnSeat`(좌석과 섞여 있음 — 좌석 몫을 떼고 «캐릭터에 붙이기» 만) · `character/part-scene.js` · 카테고리 표(`character/premium-assets.js` 의 `PART_CATS` · `partCatInfo` · `getRecHides`) |
| 그리기 도구의 순수 몫(좌우 대칭 · 도장 · UV 채우기 · 변환) | `creator/stamp.js` · `creator/uv-fill.js` · `creator/creator-xform.js` · `character/part-paint.js`(그리기 광선 · 도장 감싸기) |
| 복제 코드 DCC1 만들기 · 읽기(비밀번호 · AES-GCM · Web Crypto) | `character/code-crypto.js` `encryptCode` · `decryptCode` |

| 빠짐(앱에 남음) | 까닭 |
|---|---|
| 좌석 만들기 · 앉히기 · 배치(`createSeat` · `applyCharToSeat` · `layoutSeats` · `seat-*.js`) | 데스크톱 화면 전용 |
| 책상 · 책상 아이템 · 올라타기 · 벤치(`desk-*.js` · `room/ride-bench.js`) | 방 · 데스크톱 전용 |
| 저장 · 동기화 · 보관함(`slot-save.js` · `slot-sync.js` · `chars.js`) | 계정 · 저장 경로 |
| 가챠 · 라이선스 판정 · 커미션 · 에셋 코드(`gacha.js` · `commission.js` · `asset-code.js` DCK1 · 암호화 GLB) | 유료 자산 — 웹에 싣지 않음 |
| 생성기 화면(단계 · 버튼 · 단축키 · 창) | 앱 · 웹이 각자 그린다 — 코어의 순수 함수만 부른다 |
| 카탈로그 받기(`catalog-cache.js` · `catalog-glb.js` · Firebase · IndexedDB) | 받는 길은 앱 · 웹이 다르다 → 코어에는 «자산 공급자» 로 주입 |

### 3.2 지금 기대는 전역(떼어 낼 때 주입으로 바꿀 것)
| 전역 · 상태 | 누가 씀 | 코어에서 |
|---|---|---|
| `THREE`(r128 classic · 전역) · `GLTFLoader` · `DRACOLoader`(디코더 `vendor/draco/`) | 몸 · 파츠 · 귀 · 동물 | `deps.THREE` · `deps.gltf`(로더) 주입 |
| `scene`(app.js 전역 · 조명 · 바닥) | 데스크톱 화면 | 코어는 장면을 모른다 — 캐릭터 그룹만 돌려준다 |
| `loader`(app.js 전역) · `BASE_SCENE` · `BASE_ANIMS` · `BASE_MESH_*`(let) | 몸 | 코어 안 상태(인스턴스마다) |
| `window.BASE_GLB_B64`(`app/parts/base-glb.js`) · `window.SKIN_PNGS` | 몸 · 피부 | `assets.baseGlb()` · `assets.skinImage(i)` |
| `window.buildAnimalBase` · `window.parseAnimalEar` · `window.ANIMAL_EAR_TYPES` | 동물 · 귀(window 고리) | 코어 안 모듈끼리 직접 부름(고리 걷기) |
| `premiumMod` · `catalogGlbMod` · `savedParts()` | 파츠 | `assets.partGlb(rec)` · 카테고리 표는 코어 안 상수 |
| `matToneMod` · `lightToneMod` | 색조 | 코어 안 |
| `document.createElement('canvas')` · `Image` | 얼굴 | 브라우저 · Electron 렌더러 둘 다 있음 — 그대로(시험은 가짜 캔버스 주입) |
| Electron `companion` · `firebaseAPI` · `localStorage` | 없음이어야 함 | 코어는 쓰지 않는다(검사로 막음) |

### 3.3 모양(입력 · 출력 · 주입)
```ts
// 만들기 — 앱도 웹도 한 번
const core = createCharCore({
  THREE,                        // r128
  gltf,                         // GLTFLoader 인스턴스(DRACO 붙인 것)
  assets: {
    baseGlb(): Promise<ArrayBuffer>,          // 몸 모델
    skinImage(i: number): Promise<HTMLImageElement | ImageBitmap>,
    partGlb(rec: PartRec): Promise<ArrayBuffer>,   // 앱: 카탈로그 캐시 · 웹: API 주소
    earGlb(key: string): Promise<ArrayBuffer>,
  },
  log?: (level, msg) => void,
});

// 쓰기
const ch = await core.buildCharacter(def);          // → { group, faceMat, … , dispose() }
await core.equipPart(ch, cat, rec, xf);             // 옷 겹침 · 쌓기 규칙 포함
core.setFace(ch, faceCanvas, blinkCanvas);          // 그리던 얼굴 바로 반영
const code = await core.encodeCloneCode(def, pass); // 'DCC1.…'
const def2 = await core.decodeCloneCode(code, pass);
core.normalizeDef(raw)                              // 옛 칸 · 모르는 칸 정리(한 변수 한 모양)
```
- 코어는 **장면 · 카메라 · 렌더러 · 조명을 갖지 않는다**(만든 그룹을 돌려줄 뿐). 미리보기 장면은 앱 · 웹이 각자.
- `def` 는 JSON 으로 오갈 수 있는 모양(+ 얼굴 · 깜빡임 캔버스). 판 칸 `defVer` 를 둔다.

### 3.4 빌드 두 벌 · 판 · 태그
- 원본은 TS(`packages/char-core/src`). 빌드(esbuild):
  - **앱용 classic script** `dist/char-core.iife.js` → `window.TwCharCore`(앱은 번들러가 없다 · html 에서 app.js 보다 먼저 싣는다 · `checks/smoke.js` PRELOAD)
  - **웹용 ESM** `dist/char-core.mjs` + 타입(`.d.ts`)
- three 는 **번들에 넣지 않는다**(주입) — 앱은 지금 `vendor/three` 그대로, 웹은 같은 판(r128)을 의존성으로.
- 판: `packages/char-core/package.json` 의 semver. 태그 `char-core@X.Y.Z`. 앱 · 웹은 정확한 판을 적어 쓴다(workspace 라도 판을 고정 — 올리는 건 따로 PR).
  - 깨지는 변경(def 모양 · DCC1 · 내보내는 이름) = 큰 판. DCC1 은 **읽기 호환을 늘 지킨다**(옛 코드를 새 코어가 읽음).
- 검사: 코어 시험은 `packages/char-core/tests`(vitest · 가짜 THREE · 가짜 캔버스). 앱 쪽 `checks/` 는 «앱이 코어를 싣고 부르는가» 만.

## 4. 자산 경계 — 웹에 새면 안 되는 것
- 웹 생성기는 **무료 파츠만** 받는다. 거르기는 **서버가** 한다(전체 카탈로그를 받아 화면에서 거르지 않는다 — 받은 순간 샌다).
- 라이선스 전용(`licenseOnly`) · 가챠(`gacha`) · 커미션(`isCommission` · `commGlb`) · 암호화 GLB(.dcc) · 책상 · 아이템 코드(DCK1) 를 다루는 코드는 웹 번들에 넣지 않는다 — 코어에도 넣지 않는다.
- 몸 모델 · 피부 그림은 설치 파일에도 들어 있는 공개 자산이라 웹에 둬도 된다(지금과 같은 수준).
- 앱이 DCC1 을 받을 때 지금도 하는 일(라이선스 없는 기기의 라이선스 자산 걷기 · `char-code.js`)은 그대로 둔다 — 웹에서 만든 코드도 앱이 마지막 문지기다.

## 5. 앱(0.13.0) 떼어 내기 순서
한 단계 = PR 하나 = **동작 무변경**. 각 PR 은 실제 앱으로 생성기 · 꾸미기 · 방 좌석 화면을 열어 전후 화면을 비교하고(지금 FSD 떼어 내기와 같은 방식), 해당 `sim-*` 를 붙인다.
1. **폴더 구조**(2절) — 경로만.
2. **코어 뼈대** — `packages/char-core` 빈 패키지 · 빌드 두 벌 · 앱이 `window.TwCharCore` 를 싣기만(부르는 곳 없음).
3. **순수 몫부터** — 얼굴 · 피부 합성(`compositeFace` 등) · 대칭 · 도장 · UV 채우기 · `normalizeDef` · DCC1(`code-crypto.js`). 앱은 코어를 부르게만 바꾼다.
4. **몸** — `loadBaseGLB` · `instantiateBase` · `normalizeModel` · `defToBase`(사람). `window.BASE_GLB_B64` 는 앱의 자산 공급자가 넘긴다.
5. **귀 · 동물** — `human-ear.js` · `animal.js` 의 조립 몫. window 고리(`buildAnimalBase` · `parseAnimalEar`)를 걷는다.
6. **파츠** — `equipPartOnSeat` 를 «캐릭터에 붙이기(코어)» 와 «좌석 정리(앱)» 로 가른다. 카테고리 표는 코어로.
7. **색조** — `mat-tone.js` 를 코어로.
8. 정리 — 코어가 `window` · `firebaseAPI` · `companion` 을 안 쓰는지 검사(글자 아님 — 가짜 전역으로 돌려 봄).

## 6. 웹
### 1단계 — 로그인 없이 만들어 보기
- 웹에서 만들고 → «코드 만들기»(비밀번호) → DCC1 → 앱 «코드 입력하기» 로 불러온다.
- 서버에는 **무료 파츠 목록 · 파일만** 묻는다(7절 A). 저장 · 로그인 없음.
- 그린 얼굴은 브라우저 안에만(새로 고침 대비 localStorage `tw.` 키에 초안 — 선택).

### 2단계 — 로그인해 내 계정에 저장
- 로그인은 앱과 같은 로그인(구글 · 친구 코드). 웹 주소를 로그인 허용 주소에 더해야 한다(콘솔 설정 — 사람이).
- **새 가입은 앱과 같은 초대 코드 절차**를 거친다(7절 B-1).
- 저장 · 불러오기는 API(7절 B) — 웹이 DB 에 직접 쓰지 않는다(서버 이관 방향 · Firebase 의존을 늘리지 않음).
- 앱도 같은 API 로 캐릭터를 읽게 되면 기기 간 동기화가 이 길로 합쳐진다(앱 쪽 적용 시점은 따로).

## 7. 서버에 줄 API 규격 (프론트 입장)
서버 내부(인증 판정 · 저장 구조 · 횟수 제한 값)는 서버가 정한다. 여기는 **웹 · 앱이 받고 싶은 모양**이다.

**공통**
- 주소: `https://api.together-working.com` 아래 `/v1/…`. 응답 봉투는 지금 API 와 같다 — 성공 `{ success: true, data }` · 실패 `{ success: false, code, message }`.
- 로그인이 필요한 요청은 로그인 토큰을 `Authorization: Bearer <토큰>` 으로 보낸다. 401 = 로그인 다시 · 403 = 권한 없음(화면은 그대로 보여 준다).
- 캐시: 목록은 `ETag` + `If-None-Match` → 바뀐 게 없으면 `304`(본문 없음). 파일은 **내용 해시가 든 주소**(바뀌면 주소가 바뀜) + `Cache-Control: public, max-age=31536000, immutable`.
- 문자열 길이 · 개수 상한은 아래 표대로 — 넘으면 `400` `code: VALIDATION`.
- 시각은 epoch ms 숫자.

### A. 로그인 없이(1단계)
**A-1. 생성기 목록 한 번에** — 무료 파츠 · 카테고리 · 기본 자산을 첫 화면에서 한 번에.
- `GET /v1/creator/catalog` · 로그인 필요 없음(누구나)
- 요청: 헤더 `If-None-Match`(가진 ETag), 쿼리 `lang=ko|en|ja`(이름 글 언어 — 없으면 ko)
- 응답 `200` · 헤더 `ETag` · `Cache-Control: public, max-age=300`
```json
{
  "ver": 1792400000000,
  "base": {
    "bodyGlb": "https://…/base/body.<해시>.glb",
    "skins": ["https://…/skin/0.<해시>.png", "… 5장"],
    "earTypes": [{ "key": "cat", "name": "고양이", "glb": "https://…/ear/cat.<해시>.glb" }]
  },
  "categories": [
    { "id": "hat", "name": "모자", "group": "deco", "order": 10 }
  ],
  "parts": [
    {
      "id": "p_8f2c", "cat": "hat", "name": "밀짚모자",
      "thumb": "https://…/t/p_8f2c.<해시>.png",
      "glb": "https://…/g/p_8f2c.<해시>.glb", "glbBytes": 48211,
      "hides": ["hat"], "stackable": false,
      "xf": { "s": 1, "y": 0, "rx": 0 }, "colorable": true
    }
  ]
}
```
- 들어가는 파츠: **무료만**(라이선스 전용 · 가챠 · 커미션은 서버에서 빼고 보낸다).
- `304` = 가진 것 그대로. 실패 `503` = 화면은 «지금 생성기를 열 수 없어요 · 잠시 뒤» + 다시 시도 버튼.
- 페이지 나누기: 없음(무료 파츠는 수백 개 이내 · 썸네일 · GLB 는 주소만 · 본문 수십 KB 목표). 늘어나면 `categories` 만 먼저 · `parts?cat=` 로 나누는 판을 따로 정한다.
- 파일(GLB · PNG)은 위 주소로 직접 받는다(CORS 로 together-working.com 허용) · 본체는 API 를 거치지 않는다.

**A-2. 이름 · 문구 번역**(선택) — A-1 의 `lang` 으로 충분하면 만들지 않는다.

### B. 로그인 뒤(2단계)
**B-0. 내 요약** — 화면 머리 · 저장 칸 수.
- `GET /v1/me` · 로그인 필요
- 응답 `{ userCode, friendCode, nickname, signedUp: true, charLimit: 5, charCount: 2 }`
- 가입 전 로그인(초대 미통과)이면 `200 { signedUp: false }` — 화면은 초대 코드 입력으로.

**B-1. 웹에서 새 가입(초대 코드)**
- `POST /v1/signup` · 로그인 필요(가입 전 로그인)
- 요청 `{ "inviteCode": "ABCD-EFGH-JKLM", "nickname": "민수" }` — inviteCode 는 앱 초대 코드 모양(`[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}`) · nickname 1~20자
- 응답 `201 { userCode, friendCode }`
- 실패: `400 INVITE_INVALID`(없는 코드) · `409 INVITE_USED`(이미 씀) · `409 ALREADY_SIGNED_UP`(이미 가입 — 화면은 B-0 으로) · `400 VALIDATION`
- 초대장 발급이 멈춰 있는 동안은 화면에 «지금은 초대받은 분만 가입할 수 있어요» 안내.

**B-2. 내 캐릭터 목록**
- `GET /v1/me/chars` · 로그인 필요 · `ETag`/`304`
- 응답 `{ "items": [{ "id": "c_x1", "name": "출근룩", "thumb": "https://…/<해시>.png", "updatedAt": 1792400000000, "ver": 7 }] }`
- 페이지 나누기 없음(상한 `charLimit` 개).

**B-3. 캐릭터 하나**
- `GET /v1/me/chars/{id}` · 로그인 필요 · `ETag`/`304`
- 응답 `{ id, name, ver, updatedAt, def }` — `def` 는 코어 `normalizeDef` 모양 JSON · 그림은 칸에 주소(`face`, `blink`, 동물 그림 등 — 아래 B-5 로 올린 주소)
- 실패 `404 NOT_FOUND`

**B-4. 저장(새로 · 고치기)**
- 새로: `POST /v1/me/chars` 요청 `{ name, def }` → `201 { id, ver }` · 실패 `409 CHAR_LIMIT`(칸 다 참)
- 고치기: `PUT /v1/me/chars/{id}` · 헤더 `If-Match: <ver>` · 요청 `{ name, def }` → `200 { ver }`
  - 다른 기기에서 먼저 고쳤으면 `412 VERSION_MISMATCH` + `data: { ver, updatedAt }` — 화면은 «다른 곳에서 바뀌었어요 · 내 것으로 덮을까요 / 불러올까요»
- 상한: `name` 1~20자 · `def` JSON 64KB(그림은 주소만이라 작다) · 모르는 칸은 `400 VALIDATION`
- **그림은 이 요청에 넣지 않는다**(dataURL 금지) — B-5 로 먼저 올리고 주소만.

**B-5. 그림 올리기(얼굴 · 깜빡임 · 동물 몸 · 귀 그림 · 내 그림)** — 바뀐 그림만 · 같은 그림은 두 번 안 올림.
- `PUT /v1/me/images/{sha256}` · 로그인 필요 · 본문 PNG 그대로(`Content-Type: image/png`)
  - 화면이 그림의 sha256 을 먼저 계산해 주소에 넣는다 → 이미 있으면 `200 { url }`(본문을 받기 전에 끝내도 된다 — `Expect: 100-continue` 또는 먼저 `HEAD`), 없으면 저장 뒤 `201 { url }`
- 상한: 512×512 이하 · 300KB 이하 · PNG 만 — 넘으면 `413` / `415`
- 응답 `url` 은 내용 해시 주소(오래 캐시).

**B-6. 지우기**
- `DELETE /v1/me/chars/{id}` · 로그인 필요 → `204` · 없으면 `404`(화면은 목록에서 빼기만).

### C. 라이브러리(공유) — 메인 홈페이지 «커스텀 라이브러리» 자리(프로토타입 #428)
나중 단계. 모양만 미리:
- `GET /v1/library?cursor=&limit=24&sort=new|popular` · 누구나 · 커서 페이지 나누기 `{ items, nextCursor }` · `ETag`
- `POST /v1/library` · 로그인 필요 · `{ charId, title, anonymous: true|false }` → 공유본은 저장 당시 복사(내 캐릭터를 고쳐도 공유본은 그대로)
- 공유본에는 무료 파츠만 남긴다(서버가 거름) · 신고 · 숨김은 기존 신고 흐름과 같은 모양으로 따로.

### 서버에 바라는 성질(요약)
- 첫 화면은 **요청 한 번**(A-1) · 바뀐 게 없으면 304 · 파일은 해시 주소로 영구 캐시.
- 쓰기는 **바뀐 것만**(B-5 해시 · B-4 버전 · 그림과 def 분리) · 충돌은 버전으로 가른다.
- 무료 / 유료 거르기 · 공유본 거르기는 **서버에서**.
- 응답 크기를 작게(목록은 요약만 · 본체는 하나씩).

## 8. 위험 · 열린 질문 (사용자가 정할 것)
| # | 질문 | 메모 |
|---|---|---|
| 1 | 폴더 구조 바꾸기를 0.13.0 시작에 할까, 코어 떼어 내기 뒤에 할까 | 먼저 하면 이후 PR 경로가 안정 · 그동안 열린 PR 은 다 충돌 |
| 2 | 웹 1단계에서 동물 캐릭터 · 귀까지 넣을까 | 동물 조립(`animal.js` 2천 줄)이 커서 사람만 먼저가 가볍다 |
| 3 | 3D 미리보기 없이 2D 로 1단계를 먼저 낼까 | 프로토타입은 2D · 코어가 준비되기 전에 낼 수 있음 |
| 4 | three 판 올리기(r128 → 최신) 시점 | 웹 의존성은 같은 판이어야 함 · 올리기는 앱 회귀 위험 큼 |
| 5 | 웹 새 가입을 1단계부터 막아 둘까(초대 발급 멈춤 중) | B-1 은 2단계 |
| 6 | 웹 주소 로그인 허용 · 메인 사이트 Hosting 사이트 · 맞춤 도메인 | 바깥 주소 · 새 사이트는 사용자 확인 규칙 |
| 7 | 앱도 B-2~B-5 로 캐릭터를 읽고 쓰게 할 시점 | 지금 동기화(`slot-sync` · `chars`)와 합치는 일 |

위험
- 생성기는 앱의 심장 — 떼어 내기는 PR 마다 화면 비교 필수. 한 번에 크게 옮기지 않는다.
- 유료 자산 누출 — 4절 경계를 검사로 지킨다(웹 번들에 그 모듈 이름이 들어가면 빨강).
- DCC1 호환 — 옛 코드 읽기 시험을 코어에 고정(앱에서 만든 실제 코드 몇 개를 표본으로).
