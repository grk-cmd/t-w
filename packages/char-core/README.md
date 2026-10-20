# @tw/char-core — 캐릭터 3D 코어

캐릭터를 3D 로 만드는 코드(몸 · 얼굴 · 파츠 · 귀 · 동물 · 색조 · 복제 코드)를 앱(Electron)과 메인 홈페이지(웹)가 **같은 한 벌**로 쓰기 위한 라이브러리. 에픽 #430 의 순서대로 앱에서 한 단계씩 옮겨 온다.

| 옮겨 온 것 | 파일 | 앱에서 부르는 곳 |
|---|---|---|
| 복제 코드 DCC1(암호 · 칸 싣기 · 되살리기 · base64 · 열쇠 만들기) | `src/clone-code.ts` | `apps/desktop/app/parts/character/code-crypto.js`(그림 다루기 · 커미션 이름은 앱 몫) |
| 🪣 UV 채우기(메쉬 · 섬 · 여백 몫) | `src/uv-fill.ts` → `TwCharCore.uvFill` | 전역 이름 `UvFill` 그대로(`apps/desktop/app/parts/creator/uv-fill.js` 가 코어에 잇는다) |
| 🧍 사람 몸(기본 몸 불러오기 · 복제 · 크기 맞추기 · 조립 · 대신 몸) | `src/body.ts` → `TwCharCore.createBody` | `app.js` 의 `bodyCore` — 몸 모델 바이트 · 재질 톤 · 귀 · 커미션 배율은 앱이 넘긴다(`defToBase` · `instantiateBase` · `normalizeModel` 이름 그대로) |
| 🙂 얼굴 · 피부 그림판(512 캔버스 · 대칭축 · 피부 5종 · 피부 위에 그림 얹기 · «완전히 비었나») | `src/face.ts` → `TwCharCore.createFace` | `app.js` 의 `faceCore` — 이름(`compositeFace` · `newCanvas` · `_isBlankDraw` · `skinCanvases` …) 그대로. 피부 그림 불러오기(`loadSkins`)는 앱 몫 |
| 🎀 파츠를 캐릭터에 붙일 한 벌로(복제 · 재질 · `_col` · `_pic` · 리깅 판정 · 다시 묶기 · wrapper · 저작 오프셋 · 다중 인스턴스) | `src/parts.ts` → `TwCharCore.createParts` | `app.js` 의 `partsCore` — 장착 차례 · 옷 겹침 · 귀 · 애니메이션 · 책상 파츠 · 좌석 저장은 `equipPartOnSeat` 에 남는다(코어는 책상 · 좌석을 모른다) |
| 💡 재질 톤(얼굴 맵 · 몸 평탄 조명 · 파츠 톤 · baseFlat · 텍스처 파츠 색조 셰이더) · 파츠 xf 적용 | `src/tone.ts` → `TwCharCore.createTone` · `src/parts.ts` `applyXfToWrapper` | `shared/light-tone.js` 가 화면 밝기 예산(FLAT_EMISSIVE)으로 만들어 `toneCore` 로 내놓는다(책상 · 아이템 톤은 앱). `mat-tone.js` 는 🐾 동물 귀 깜빡임만 더한다 |

## 책임
- 들어오는 것: 캐릭터 정의(def) 정리 · 몸 모델 · def → 3D 캐릭터 한 덩어리 · 얼굴 · 피부 합성 · 귀 · 동물 · 파츠 붙이기 · 색조 · 복제 코드 DCC1(#430 3.1).
- 들어오지 않는 것: 장면 · 카메라 · 렌더러 · 조명 · 좌석 · 방 · 저장 · 동기화 · 유료 · 가챠 · 커미션 자산 해석.
- `window` · `localStorage` · `firebaseAPI` · Electron `companion` 을 쓰지 않는다.

## 주입(deps)
`createCharCore({ THREE, log? })` — three 는 번들에 넣지 않는다. 앱은 `vendor/three`(r128) 전역, 웹은 같은 판 의존성. 다른 판이면 만들 때 거절한다(`THREE_REVISION`).

## 빌드 두 벌
```bash
npm -w @tw/char-core run build      # 루트에서 — dist/ · 앱 사본까지
npm -w @tw/char-core test           # vitest — 몸은 진짜 three r128 + 앱에 든 기본 몸 GLB, 나머지는 가짜 THREE · 가짜 캔버스
npm -w @tw/char-core run typecheck
```
- 앱용 classic script `dist/char-core.iife.js` → `window.TwCharCore`. 앱은 번들러가 없어 **빌드가 같은 파일을 `apps/desktop/app/vendor/char-core/char-core.iife.js` 에 복사**하고, html 이 three 다음 · app.js 앞에서 싣는다(`checks/sim-char-core-load.js` · `checks/smoke.js` PRELOAD).
- 웹용 ESM `dist/char-core.mjs` + 타입 `dist/types/`.
- ⚠️ 코어를 고치면 빌드를 돌려 **앱 사본까지 같은 커밋**에 넣는다 — CI «캐릭터 코어 시험 · 빌드» 가 다시 빌드해 사본과 다르면 빨강.

## 판 · 태그
- 판은 `package.json` 의 semver, 태그는 `char-core@X.Y.Z`. 깨지는 변경(def 모양 · DCC1 · 내보내는 이름)은 큰 판.
- DCC1 은 읽기 호환을 늘 지킨다 — 옛 코드를 새 코어가 읽는다.

## 함정
- 경계 검사(`tests/boundary.test.ts`): 앱이 싣는 빌드 사본을 `window` · 저장소 · `firebaseAPI` · `companion` · 네트워크가 덫인 전역 위에서 돌린다 — 코어가 그중 하나라도 건드리면 빨강. 유료 자산 모듈 이름(가챠 · DCK1 · 라이선스 전용 · 에셋 코드 …)이 번들에 들어가도 빨강.
- DCC1 읽기 호환 표본 `tests/fixtures/dcc1-*.json` 은 코어로 옮기기 전 앱이 만든 코드 · 되살린 def 다. 표본을 고쳐 시험을 맞추지 않는다 — 새 모양은 표본을 더한다.
- `npm install` 은 루트에서 한다(workspace). 이 폴더에서 따로 깔면 lock 이 갈라진다.
- `__CHAR_CORE_VERSION__` 은 빌드(`build.mjs`)와 시험(`vitest.config.ts`)이 package.json 판으로 바꿔 넣는다.
