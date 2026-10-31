# shared/ — 공용 도구 · 공용 통로

도메인을 모르는 아래층 모듈. 도메인 폴더 · app.js 만 이 폴더를 부르고, 이 폴더는 도메인을 부르지 않는다.
절은 모듈마다 하나 — 다른 사람이 만든 절은 건드리지 않고 자기 절만 더한다.

## dot-render.js — 🕹️ 도트 모드 머티리얼

- **책임**: 도트 렌더 모드일 때 씬 머티리얼만 바꾼다 — 텍스처를 Nearest 필터로, 프래그먼트 셰이더 끝에 PS1 색 양자화(16단계) + 4×4 Bayer 디더를 넣는다. 끄면 원래대로. *언제* 켤지는 부르는 쪽(app.js `applyCameraAndCanvas`)이 정한다.
- **만드는 법**: `const dotRenderMod = TwDotRender.createDotRender({ scene, ps1Dither: TwPs1Dither });` — `scene` 은 `traverse(cb)` 가 있는 THREE.Scene, `ps1Dither` 는 아래 `ps1-dither.js`(색 단계 · Bayer 표).
- **내보내는 것**
  - `applyDotTextureFilter(on)` — `map · emissiveMap · normalMap · roughnessMap · metalnessMap` 의 min/mag 필터를 바꾼다. 원래 값은 `tex.userData._origMinFilter/_origMagFilter` 에 둔다.
  - `applyPS1Shader(on)` — 머티리얼의 `onBeforeCompile` 을 감싼다(원래 것을 먼저 부른다) · 셰이더 캐시 키(`customProgramCacheKey`)에 원래 훅 글자를 넣는다 · `needsUpdate = true` 로 다시 컴파일.
  - 켬은 부를 때마다 씬을 훑고 **이미 걸린 것만 건너뛴다**(Nearest 인 텍스처 · 지금 훅이 우리 것인 머티리얼). 끔은 켠 적이 있을 때만 훑는다.
  - `sweepIfOn(now)` — 프레임 루프가 매 프레임 부른다. 켜져 있을 때만 `SWEEP_MS`(0.5초)마다 한 번 위 두 함수를 다시 불러, 켠 뒤 들어온 캐릭터 · 파츠 · 바꿔 낀 표정 텍스처 · 덮어쓴 색조 셰이더를 받는다.
  ```js
  if(dotOn){ dotRenderMod.applyDotTextureFilter(true); dotRenderMod.applyPS1Shader(true); }
  else { dotRenderMod.applyDotTextureFilter(false); dotRenderMod.applyPS1Shader(false); }
  // frame(now) 안에서
  dotRenderMod.sweepIfOn(now);
  ```
- **확장할 때 고칠 자리**: 색 단계 · 디더 행렬은 `ps1-dither.js` 한 곳(스티커사진 PS1 필터도 같이 바뀐다) · 넣을 GLSL 은 `_PS1_FRAG_INJECT` · 필터를 바꿀 텍스처 칸은 `DOT_TEX_KEYS` · 다시 훑는 간격은 `SWEEP_MS`.
- **함정**
  - «걸렸나» 는 `userData._ps1Hooked` 표식이 아니라 **지금 `onBeforeCompile` 이 우리 훅인가**로 본다. `m.clone()` 은 userData 를 JSON 으로 복사하고 `onBeforeCompile` 은 안 옮겨서 표식만 따라온 가짜가 생기고, 색조 셰이더(`_ensureHueUniforms`)가 나중에 훅을 덮어쓰기도 한다. 표식은 스티커사진(`purikura-ui.js`)이 읽어서 그대로 적어 둔다.
  - three r128 은 셰이더를 `customProgramCacheKey()`(기본 = `onBeforeCompile` 글자)로 나눠 쓴다. 감싼 훅은 글자가 늘 같으니 키에 원래 훅 글자를 넣어야 염색 재질과 보통 재질이 한 셰이더를 나눠 쓰지 않는다(염색 빠짐).
  - 끌 때 그새 남이 덮어쓴 `onBeforeCompile`(색조)은 지우지 않는다 — 우리 훅일 때만 되돌린다.
  - 켬 상태에서 텍스처에 `needsUpdate` 를 다시 걸지 않는다(이미 Nearest 면 건너뜀) — 걸면 0.5초마다 텍스처를 GPU 에 다시 올린다.
  - 셰이더는 three 의 `#include <dithering_fragment>` 뒤에 붙는다. 그 줄이 없는 머티리얼이면 마지막 `}` 앞에 넣는다.
  - 검사: `checks/sim-dot-render.js`(4절이 가짜 씬으로 켜고 끄기 · 다시 부르기 · 빈 씬 · 5절이 켠 뒤 들어온 메쉬 · 가짜 표식 · 덮어쓴 색조 · 캐시 키 · 훑기 간격).

## ps1-dither.js — 🕹️ PS1 디더 규칙(색 단계 · Bayer 표 · 한 칸 식)

- **책임**: PS1 느낌 디더의 값과 식을 한 곳에 둔다 — 도트 모드 셰이더(`dot-render.js`)와 스티커사진 PS1 필터(`purikura/purikura-net.js` `applyFilter('ps1')`)가 같이 읽는다. 값과 순수 함수뿐이라 DOM · THREE 를 모른다.
- **만드는 법**: 만들 것 없음 — `window.TwPs1Dither`(얼린 객체)를 그대로 쓴다. html 에서 `purikura-net.js` · `dot-render.js` 보다 먼저 싣는다. node 에서는 `require('./ps1-dither.js')`.
- **내보내는 것**
  - `PS1_LEVELS` — 채널당 색 단계(16) · `BAYER4` — 4×4 Bayer 임계값 0~15(가로 4칸씩)
  - `bayerThreshold(x, y)` — 픽셀 자리의 임계값 0~15/16 (4칸마다 되풀이)
  - `ditherQuantize(v, t)` — 0~1 색 값을 임계값만큼 흔든 뒤 단계로 스냅. 0~1 밖으로 한 단계까지 나갈 수 있다 — 자르기는 부르는 쪽
  ```js
  const t = TwPs1Dither.bayerThreshold(x, y);
  const out = Math.max(0, Math.min(255, TwPs1Dither.ditherQuantize(px / 255, t) * 255));
  ```
- **확장할 때 고칠 자리**: 단계 · 표는 이 파일 위 상수 두 개. 식을 바꾸면 `dot-render.js` 의 `_PS1_FRAG_INJECT`(GLSL 은 이 함수를 못 부르므로 같은 식을 글로 다시 쓴다)도 같이.
- **함정**
  - `purikura-net.js` 는 `TwPs1Dither` 를 **부를 때** 읽는다 — 그 파일만 node 로 싣는 검사가 많아서, 실을 때 읽으면 그 검사들이 죽는다.
  - 검사: `checks/sim-ps1-dither.js`(값 · 경계값 · 도트 셰이더 글 · 스티커사진 필터 결과가 묶기 전과 픽셀까지 같음 · 깨 보기).

## glb-idb-cache.js — 💾 GLB 영구 캐시(IndexedDB)

- **책임**: 받은 GLB(base64)를 url 을 키로 IndexedDB `tw-glb-cache`(저장소 `glb`, keyPath `url`)에 넣고 꺼낸다. 45일 넘게 안 쓴 것은 실행마다 한 번 치운다. 무슨 GLB 인지는 모른다.
- **만드는 법**: `const glbIdbMod = TwGlbIdbCache.createGlbIdbCache({});` — deps 없음(브라우저 `indexedDB`).
- **내보내는 것**
  - `_glbIdbGet(url)` → `Promise<b64 | null>` · `_glbIdbPut(url, b64)` → `Promise<void>`(기다리지 않아도 된다) · `_glbIdbPrune()` — 한 실행에 한 번만 실제로 돈다.
  ```js
  const hit = await glbIdbMod._glbIdbGet(url);
  if(!hit){ const b64 = await fetchIt(url); glbIdbMod._glbIdbPut(url, b64); }
  ```
- **확장할 때 고칠 자리**: 이름 · 저장소 · 보관 기간은 머리의 `_GLB_IDB_NAME` · `_GLB_IDB_STORE` · `_GLB_IDB_TTL`. 저장소 모양을 바꾸면 `indexedDB.open` 판(지금 1)을 올리고 `onupgradeneeded` 를 고친다.
- **함정**
  - 실패는 전부 삼킨다(없으면 null) — 캐시는 있으면 좋은 것이지 없으면 안 되는 것이 아니다. 여기서 던지게 바꾸면 카탈로그 받기가 같이 멈춘다.
  - 키가 url 그대로라 따로 지우지 않아도 관리자가 다시 올리면 새 url 로 받는다.
  - 검사: `checks/sim-glb-idb-cache.js`(4절 — 가짜 IndexedDB 로 없음 · 열기 실패 · 넣기/꺼내기 · 한 번만 열기 · 치우기 45일 경계 · 한 번만 치우기).

## `light-tone.js` — 💡 재질 톤(조명 예산 · emissive)

**책임** — 화면 밝기의 손잡이 하나(`TONE_FRONT_TOTAL` — 카메라를 보는 흰 면이 받는 빛의 총합)에서 플랫 조명 몫(`FLAT_EMISSIVE`)을 계산하고,
아이템 · 책상 재질에 같은 규칙으로 emissive 를 얹는다. 캐릭터 · 파츠 재질 톤(파츠 톤 · baseFlat · 얼굴 맵 · 몸 평탄 조명 · 색조)은 캐릭터 코어 `tone.ts` 이고,
여기서 `FLAT_EMISSIVE` 로 코어 톤을 만들어 `toneCore` 로 내놓는다(앱의 다른 곳은 그것을 deps 로 받는다).
숫자(`LIGHT_PRESET` · `CREATOR_LIGHT_SL` · `TONE_FRONT_TOTAL` · 조명 배율)와 플랫 몫 계산식 · 재질 고치기(`fixMatLighting`)는 캐릭터 코어 `lighting.ts` 한 벌 — 웹 생성기도 같은 것을 쓴다.

**만드는 법** — app.js «관리자 모드» 머리 바로 앞:

```js
const lightToneMod = TwLightTone.createLightTone({
  _FILL_LIGHT_MUL: _FILL_LIGHT_MUL,                       // 값 — 채움광 배율(app.js 조명 상수)
  _MAIN_LIGHT_INT: _MAIN_LIGHT_INT,                       // 값 — 주광 세기(코어 MAIN_LIGHT_INT = LIGHT_PRESET.b × e)
  _fixGlbMatLighting: (...a)=>_fixGlbMatLighting(...a),   // 함수 — metalness 1 재질 눕히기(코어 fixMatLighting + 콘솔 한 줄)
  charCore: TwCharCore,                                   // 캐릭터 코어 — createTone 으로 toneCore 를 만든다
});
const LIGHT_PRESET = lightToneMod.LIGHT_PRESET;   // 옛 전역 이름(animal.js)
```

**내놓는 것**

| 이름 | 뜻 |
|---|---|
| `LIGHT_PRESET` | 생성기 · 미리보기 조명 프리셋 `{b, h, e}`(코어 — 얼려 있다) |
| `CREATOR_LIGHT_SL` | 생성기 미리보기 빛의 채도 · 명도 `{s, l}`(코어 — 색상은 `LIGHT_PRESET.h`) |
| `TONE_FRONT_TOTAL` | 밝기 손잡이(1.0 = 텍스처 값 그대로) |
| `FLAT_EMISSIVE` | `max(0, 총합 − 0.95×주광 − 주광×채움)` — 조명이 받고 남는 몫 |
| `toneCore` | 캐릭터 코어 재질 톤(`createTone`) — matToneMod · partsCore 가 deps 로 받는다 |
| `_applyPartMatTone(m)` | 파츠 재질 — 코어 `toneCore.applyPartMatTone`(map 이 있으면 emissiveMap 도 · emissive = 색 × 플랫 · `userData.baseFlat`) |
| `_applyItemMatTone(m)` | 아이템 · 책상 GLB 재질 — GLB 의 emissive 를 덮어쓴다 · emissiveIntensity 는 1 로 |
| `_setDeskMatColor(m, color)` | 책상 색 바꾸기 — baseFlat 으로 emissive 다시 계산(없으면 처음 심는다) |
| `baseFlatOf(mat)` | 코어 `toneCore.baseFlatOf` — 재질에 심은 플랫 배율(baseFlat), 없으면 공용 기준 `FLAT_EMISSIVE` — 색을 다시 칠하는 곳(아이템 · 꾸미기 · 생성기)은 모두 이것으로 읽는다. 0 도 심은 값 |

```js
lightToneMod._setDeskMatColor(seat.deskMat, def.deskColor || null);   // 책상 색은 꼭 이 함수로(color.set 직접 금지)
```

**확장할 때 고칠 자리** — 화면이 밝다 / 어둡다 → 코어 `packages/char-core/src/lighting.ts` 의 `TONE_FRONT_TOTAL` 하나만(코어를 빌드해 앱 사본까지 같은 커밋에). 아이템만 톤을 달리해야 하면 `ITEM_SOLID_FLAT` 줄에, 파츠만이면 코어 `packages/char-core/src/tone.ts` 의 `PART_TEX_FLAT` 줄에 숫자를.

**함정**
- «baseFlat 이 있으면 그 값, 없으면 …» 판단을 부르는 쪽에 다시 쓰지 않는다 — `baseFlatOf` 를 부른다(곳마다 쓰면 대체값이 갈라진다 · `sim-light-tone` 이 잡는다).
- 1.16 을 넘기면 측면도 잘려 밝아지지 않고 계조만 사라진다.
- 재질 색을 바꾸는 새 코드는 `color.set` 만 하지 말고 baseFlat 으로 emissive 를 다시 계산해야 한다(책상은 `_setDeskMatColor`).

검사: `checks/sim-light-tone.js` (FLAT_EMISSIVE 식 · 경계 · 재질 함수 셋 · 연결 · 깨 보기).

## blink-timing.js — 👁 깜빡임 시간표

- **책임**: 눈을 *언제* 감는지만 정한다 — 한 번씩 2~3번 깜빡인 뒤 세 번 연달아, 사이 간격은 무작위. 시간은 실제 시각(ms)으로만 센다. 무슨 그림으로 바꿀지는 부르는 쪽이 정한다.
- **만드는 법**: 만들 것 없음 — `window.TwBlinkTiming` 의 순수 함수(DOM · THREE 안 봄).
- **내보내는 것**
  - `createBlink(now, rand?)` → 깜빡임 상태 `{ pulses, nextAt, singles, closed }` · `scheduleBlinks(bl, now, rand?)` — 때가 됐으면 예약 · `eyeClose(bl, now)` → 감은 정도 0~1 · `SHUT_AT` — 이보다 크면 감은 눈 그림.
  ```js
  seat.blink = TwBlinkTiming.createBlink(performance.now());
  TwBlinkTiming.scheduleBlinks(seat.blink, now);
  const shut = TwBlinkTiming.eyeClose(seat.blink, now) > TwBlinkTiming.SHUT_AT;
  ```
- **확장할 때 고칠 자리**: 박자는 머리의 상수(`SINGLE_DUR_MS` · `SINGLE_GAP_*` · `TRIPLE_*` · `FIRST_*`). 바꾸면 실행 화면 좌석과 런처 미리보기가 같이 바뀐다.
- **함정**
  - 프레임마다 고정 ms 를 더하는 식으로 다시 쓰지 않는다 — 주사율 · 프레임 상한에 따라 주기가 달라진다(예전 런처가 그랬다).
  - `rand` 는 검사용(씨앗 고정). 앱에서는 비워 두면 `Math.random`.
  - 검사: `checks/sim-blink-timing.js`(옮기기 전 글과 같은 결과 · 주사율 무관 · 연결).

## toast.js — 🍞 토스트 · 저장 실패 문구

- **책임**: `#toast` 한 줄 알림을 띄우고 시간이 되면 끈다 · 저장 실패 오류가 규칙 거부(PERMISSION_DENIED)인지 가려 문구를 고른다. 도메인을 모른다.
- **만드는 법**: `const toastMod = TwToast.createToast({});` — deps 없음. app.js 는 그 바로 뒤에 같은 이름의 이음 함수 `toast(...)` · `_saveFailMsg(...)` 를 둔다(«옛 전역 이름» — app.js 150여 곳 · 다른 파일 · `window.toast` 가 전역으로 부른다).
- **내보내는 것**
  - `toast(msg, iconSrc?, ms?)` — 글은 `textContent`, `iconSrc` 가 있으면 앞에 16px img. `ms` 가 양수 숫자가 아니면 1.9초. 새 토스트는 앞 타이머를 지운다.
    문구 안 `\n` 은 줄바꿈으로 보인다(html `.toast` 의 `white-space:pre-line`) — 두 문장을 나눌 땐 `<br>` 말고 `\n`.
  - `_saveFailMsg(e, fallback?)` — `e.code || e.message` 에 `permission-denied`(_ · - · 대소문자 무관)가 있으면 «관리자 계정으로 로그인» 안내, 아니면 `fallback` 또는 «인터넷 연결을 확인해 주세요».
  ```js
  toast('저장했어요');
  try{ await save(); }catch(e){ toast(_saveFailMsg(e, '전송에 실패했어요 — 네트워크 확인')); }
  ```
- **확장할 때 고칠 자리**: 기본 시간 1900 · 그림 크기는 `toast` 안. 새 실패 갈래(예: 용량 초과)는 `_saveFailMsg` 의 정규식 아래에 한 줄.
- **함정**
  - 글을 `innerHTML` 로 바꾸지 말 것 — 닉네임 등 남이 친 글이 섞인다.
  - 이음 함수는 모듈을 만든 줄 뒤에서만 돈다 — 부팅 중 그보다 먼저 부르면 예전처럼(옛 `toastT`) 멈춘다.
  - 도메인 단계에서 부르는 곳이 deps 로 받게 되면 이음 함수 둘을 걷는다.
  - 검사: `checks/sim-toast.js`(4절 — 띄우기 · 끄기 · 그림 · 앞 타이머 지우기 · 시간 경계 · 거부 문구 갈래).

## `paint-geom.js` — ✏️ 그리기 공용 기하(획 조각 · 거울 UV)

**책임** — 생성기 얼굴 칠하기(`creator/paint-stroke.js`)와 꾸미기 파츠 그리기(`character/part-paint.js`)가 같이 쓰는 기하 두 가지. 캔버스 2D 에 선 한 조각을 긋고, 3D 메쉬의 거울 자리 표면점을 되쏘아 UV 를 찾는다. 한쪽 그리기에 두면 두 그리기가 서로를 부르게 되어(sim-dep-cycles) 아래층에 둔다.

**만드는 법** — `const paintGeomMod = TwPaintGeom.createPaintGeom({ });`(deps 0 · 생성기 «되돌리기 · blit» 바로 뒤).

**내놓는 것**
- `strokeSeg(ctx, lx, ly, x, y)` — 앞 점(lx)이 `null` 이면 그 자리에 0.01 짧은 선(점), 아니면 앞 점에서 이번 점까지. 선 굵기 · 색 · 합성은 부르는 쪽이 ctx 에 먼저 맞춘다.
- `mirrorUVOn(hit, mesh, cam, cx, castFn, off)` — 맞은 점을 메쉬 로컬에서 중심 `cx` 로 x 반전 → 거울 법선(없으면 카메라 쪽) 바깥 `off`(기본 0.6)에서 표면 쪽으로 되쏜다. `castFn(ray, mesh)` 를 주면 그것으로 맞힌다(리깅 메쉬는 지금 자세로 맞히는 함수를 넘긴다). 못 맞히면 `null`.
  ```js
  const m = paintGeomMod.mirrorUVOn(hit, crState.cBase.face, crState.cCam, crState.cBase.faceCx||0, (ray, mesh)=>partPaintMod._picIntersect(ray,[mesh]));
  ```

**확장할 때 고칠 자리** — 되쏘는 거리 기본값 `MIRROR_BACKOFF`(0.6 · 캐릭터 얼굴 크기 기준) · 점 길이 `DOT_LEN` 은 파일 위 상수. 파츠마다 다르면 부르는 쪽이 `off` 를 넘긴다.

**함정**
- 옷처럼 몸통 · 소매가 겹친 파츠에서 0.6 을 물러나면 반대편 표면 대신 앞쪽 천에서 출발한다 — 그래서 `off` 를 열어 두었다.
- 리깅 메쉬에 기본 레이캐스트(castFn 없음)를 쓰면 바인드 포즈를 맞혀 대칭이 빗나간다.

검사: `checks/sim-paint-geom.js` (strokeSeg 점 · 잇기 · 0 · mirrorUVOn 반전 · 0.6 · off · cx 없음 · 법선 없음 · castFn 없음 · null · 연결 · 깨 보기 9).

## `net-ready.js` — 🛰 네트워크(provider) 준비됨 기다리기

**책임** — «연결이 있으면 바로, 없으면 준비 신호를 한 번 기다림» 한 곳. 15곳(app.js 넷 · room-entry 둘 · ad-banner · license-request · my-info · scheduler · overhead · room-invite-ui · room-sync · bug-board-ui · catalog-source)에 따로 있던 판단을 묶었다. 지금 «준비됨» 은 `firebase-init.js` 가 `window.firebaseAPI` 를 다 만들고 쏘는 `firebase-ready` 이벤트.

**만드는 법** — 만들 필요 없음(deps 0). 쓰는 모듈 · app.js 보다 먼저 싣는 classic script(`window.TwNetReady`)이고, 쓰는 곳은 `TwNetReady.이름` 으로 바로 부른다.

**내놓는 것**
- `whenNetReady(cb, need)` — 준비면 바로 `cb()`, 아니면 신호에 `{ once:true }` 로 한 번. `need`(함수 이름 글)를 주면 «`firebaseAPI` 에 그 함수까지 있을 때» 만 바로 부른다.
  ```js
  TwNetReady.whenNetReady(()=>_bindRoomInviteReceiver());
  TwNetReady.whenNetReady(()=>cb(), 'watchMyFriendList');
  ```
- `onNetReady(cb)` — 신호가 올 때마다(once 없음). 예전에 once 없이 걸던 두 곳(overhead 공지 구독 · room-sync 다시 연결 알림)만 쓴다.
- `waitNetReady(ms)` — `Promise<boolean>`: 신호가 오면 `true`, `ms` 가 지나면 그때 연결 유무. room-entry `_waitFirebaseApi`(방 입장 10초)가 쓴다.
- `isNetReady(need)` · `NET_READY_EVENT`.

**확장할 때 고칠 자리** — 서버 이관 때 provider 의 «준비됨» 신호로 갈아 끼우는 곳은 이 파일의 `NET_READY_EVENT` · `isNetReady` 뿐이다. 새로 «준비되면 하기» 가 필요하면 여기 함수를 부르고, `firebase-ready` 에 직접 귀를 대지 않는다(sim-net-ready 가 막는다).

**함정**
- 이벤트 자리에 함수를 그대로 넘기면 그 함수가 이벤트를 첫 인자로 받는다(예전과 같다). 인자를 받는 함수면 `()=>fn()` 으로 감싼다.
- `onNetReady` 는 신호가 두 번 오면 두 번 부른다. overhead 의 once 없음은 원래 동작 그대로 둔 것이다(CONFIRM.md).

검사: `checks/sim-net-ready.js` (바로 · once 한 번 · need · 이벤트 인자 · onNetReady 두 번 · waitNetReady 신호 · 시간 · 한 번만 풀림 · 직접 귀 0곳 · 쓰는 파일 11곳 · html 순서 · smoke · 깨 보기 9).

## `upload-cache.js` — 🗂️ 업로드 캐시 규칙 · 같은 그림 다시 안 올리기

- **책임**: 업로드 캐시(`«종류:내용해시» → URL`)를 다루는 규칙 하나 — 넘칠 때 무엇을 버리나 · 쓴 것 표시 · 저장 때 사본 합치기 · 같은 업로드 한 번 · 올린 자리를 URL 로 바꿔 넣기. 읽기 · 쓰기(localStorage) · 업로드는 쓰는 모듈이 한다.
- **쓰는 곳**: 얼굴 캐시 `room/room-sync.js`(`tw.roomFaceUrls` · `faceUploadCache`) · 슬롯 GLB 캐시 `character/slot-sync.js`(`tw.slotGlbUrls` · `glbUploadCache`) · 마이홈 저장 뒤 `myhome/myhome-edit.js`(`homeUploadCache.applyUrlSwaps`).
- **만드는 법**: app.js 가 `const uploadCacheMod = TwUploadCache.createUploadCache();` 로 하나 만들어 위 세 모듈에 deps 로 넘긴다(받는 deps 없음 · 진행 중 업로드 표는 이 하나에 있다).
- **내놓는 것**: `trim(st, max)` — 넘치면 옛 해시 → 섬네일 `THUMB_CACHE_MAX`(10) → 오래 안 쓴 것부터 버림(통째로 비우지 않는다) · `touch(st, key)` · `merge(stored, mine)` · `once(key, run)` · `applyUrlSwaps(obj, swaps)` · `FACE_CACHE_MAX`(100) · `GLB_CACHE_MAX`(40).
- **확장**: 새 업로드 캐시가 생기면 상한 상수를 여기에 더하고 같은 함수를 부른다 — 쓰는 모듈에 «넘치면 비우기» · «동시 업로드 막기» 를 다시 쓰지 않는다.
- **함정**: 키 순서가 «오래 안 쓴 순» 이다 — 조회해서 쓰면 `touch`, 저장은 `merge` 뒤에. 옛 해시(`h2` 로 시작하지 않는) 항목은 조회에 쓰지 않는다(같은 해시가 같은 그림이라는 보장이 없다).
- **검사**: `checks/sim-upload-cache.js`.
## `source-switch.js` — 🎚️ 기능별 받는 곳(0.13 — 한 길만 돌려주는 얇은 자리)

- **책임**: 0.13 서버 설정(`GET /v1/config`)에는 기능 스위치가 없다. 기능마다 «지금 도는 한 길» 을 고정 표 `ONE_WAY` 로 돌려주고(`pick`), 서버 길이 있는 기능은 «서버 먼저 → 못 받으면 옛 길» 을 한 벌로 돌린다(`serverFirst`).
- **표**: `friends` 서버 먼저 · `catalog` 서버 먼저 · `gacha` 앱이 뽑기 — 옛 판의 «스위치 칸 없음» 기본값과 같다(동작 그대로). 방은 `room/room-server-gate.js` 가 늘 Firebase 방을 돌려준다(같은 까닭의 얇은 자리).
- **걷는 차례**: 기능 묶음이 그 기능을 API · realtime 길로 갈아 끼우면 부르는 줄(app.js · firebase-init.js 의 `pick` · `serverFirst`)을 걷고 표에서 한 줄을 지운다. 표가 비면 파일을 지운다. 새 기능을 더하지 않는다.
- **함정**: 서버 함수가 «값은 왔는데 못 쓴다» 면 던지지 말고 `SKIP` 을 돌려준다 — 실패 알림 없이 옛 길로 간다. 옛 길 오류는 숨기지 않고 그대로 던진다.
- 검사: `checks/sim-source-switch.js`.

## json-store.js — 💾 localStorage JSON 칸 읽기 · 쓰기 한 곳

- **책임**: 한 키의 JSON 을 읽고(해석) 쓴다. 실패를 삼키지 않고 결과 `{ ok, err, bytes }` 로 돌려준다 — 부르는 쪽이 알릴 수 있게.
- **쓰는 곳**: 사람 책상 프리셋(`creator/desk-preset-store.js` · `tw.deskPresets`) · 동물 프리셋(`character/animal.js` · `tw.animalPresets`). 같은 «읽기 → 해석 / 만들기 → 쓰기» 를 두 곳이 따로 들던 것을 묶었다.
- **만드는 법**: 렌더러에서는 `window.TwJsonStore`(`load` · `save`)를 바로 쓴다. 검사 · 다른 저장소는 `TwJsonStore.createJsonStore({ storage: () => 저장소 })`.
- **내놓는 것**: `load(key, fallback)` → `{ ok, list, err, bytes }`(키가 없거나 빈 글이면 ok · fallback) · `save(key, value)` → `{ ok, err, bytes }`(던지지 않는다).
- **함정**: 값의 모양(배열 · 객체)은 부르는 쪽이 본다. DOM · 토스트를 모른다 — 알리기는 부르는 쪽. 검사 `checks/sim-json-store.js`.

## `app-version.js` — 🏷️ 앱 버전(ver) 싣기

**책임** — 앱 버전을 한 번 받아(`companion.getAppVersion()` · 비동기 IPC) presence · 라이선스 요청에 싣는다. 웹 관리자가 누가 어느 판을 쓰는지 보고, 규칙은 presence 의 ver 로 옛 앱(≤0.10.2)을 가린다.

**만드는 법** — `firebase-init.js` 가 `createAppVersion({ getVersion, onReady })`. `onReady(ver)` 는 처음 받았을 때 한 번 — presence 를 이미 썼으면 ver 만 update 하고 onDisconnect 를 다시 건다.

**내놓는 것**
- `ready` — 받은 버전(못 받으면 `null` · 거부 없음). 최소 버전 게이트 · 방 서버 · 방문 집계 · accountSnap 은 이것(«모름» = null)을 본다.
- `get()` — 지금 아는 버전 또는 `null`.
- `withVer(obj)` — 쓰는 객체에 ver 를 **늘** 붙인다. 아직 모르거나 못 받았으면 `APP_VER_UNKNOWN`(`'unknown'`).
- `cleanAppVer(v)` · `APP_VER_MAX`(20 · 규칙 상한).

**함정**
- presence 에 쓰는 것은 set · update · onDisconnect 전부 `withVer` 를 거친다. 규칙은 `online:true` 인데 ver 가 없으면 옛 앱으로 보고 그 사람의 읽기 · 쓰기를 막고 구독도 끊는다(ver 없는 오프라인 쓰기도 `inRoom` 이 있으면 거절). 버전이 늦거나 못 받았다고 ver 를 빼면 지금 앱이 막힌다.
- presence 첫 쓰기(로그인 뒤)는 `ready` 를 기다린다 — «unknown» 으로 쓰고 메우는 쓰기를 줄인다. 그 전에 `.info/connected` 가 먼저 오면 그쪽이 «unknown» 으로 쓰고, 받은 뒤 `onReady` 가 메운다.

검사: `checks/sim-app-version.js` (1절 모듈 · 2절 쓰는 자리 · 3절 규칙 · 5절 presence 쓰기를 실제로 돌림 — 평소 · 늦게 옴 · 못 받음 · companion 없음 · 영영 안 옴 · 오프라인 · 규칙 판정 · 깨 보기 3).

## `maintenance-gate.js` — 🛠 서버 점검 창

**책임** — Firebase `config/maintenance`(`{ on, endsAt?, message? }` · 웹 관리자가 씀)가 켜진 동안, **사람이 방금 누른 동작**이 서버에 닿으면 «서버 점검 중 · ○○:○○쯤 끝날 예정» 창을 띄운다. 이 PC 에서만 도는 기능(책상 · 꾸미기 · 뽀모도로)은 막지 않는다. 점검이 끝나면 «지금 다시 켜기 · 나중에» 를 묻는다.

**만드는 법** — classic script(`window.TwMaintenance`)를 `error-codes.js` · `api-client.js` 보다 먼저 싣고, 앱 한 벌 `store` 를 만들어 둔다. `firebase-init.js` 가 `config/maintenance` 를 구독해 `store.onValue` 에 잇고, Firebase 기본 동작(firebase-init.js `_touched`) · API 통로(`api-client.js` `onRequest`)가 요청마다 `store.touch()` 를 부른다.

**내놓는 것**
- `store.onValue(값)` · `store.touch()`(점검 중이고 사람이 누른 동작이면 창 · 참) · `store.on()`(지금 점검인가 — 오류 번호 토스트를 조용히 하는 데 쓴다).
- 순수: `maintenanceOf` · `endsAtText` · `viewOf` · `MAINTENANCE_PATH` · `GATE_ID` · `MESSAGE_MAX`(200 · 규칙과 같은 값).

**함정**
- «사람이 누른 동작» 은 클릭 · 키 입력 뒤 `ACTIVE_MS`(1초) 안에 나간 요청이다(점검 창 안 입력은 세지 않는다). `navigator.userActivation.isActive` 는 쓰지 않는다 — 아무 데나 누른 뒤 약 5초 참이라 꾸미기 저장 디바운스(3초) · 하트비트에도 창이 뜬다.
- 따로 된 창(`window.open` — 📖 방명록 · 👑 디자인 스튜디오)은 본창 입력 시계가 못 듣는다. 그런 창을 새로 만들면 열 때 `store.watchInput(그 document)` 를 건다(deps `watchMaintenanceInput` · `d.close()` 뒤 — `document.open` 이 리스너를 지운다). 점검 창은 마지막으로 누른 창 안에 그린다.
- 잡는 문은 범용 통로 · API 통로 둘뿐이다 — `runTransaction` 직접 호출 · 함수 호출 · 방 서버 웹소켓으로만 닿는 기능은 창 없이 실패한다(오류 번호 토스트도 점검 중엔 꺼짐).
- 끝나도 저절로 다시 켜지 않는다(로컬 기능을 쓰는 중일 수 있다). 다만 점검 중 거부된 `onValue` 구독은 다시 붙지 않으니, 다시 켜야 친구 · 우편 · 방이 이어진다.
- 점검 때 Firebase 를 잠그는 규칙도 `config/maintenance` **읽기는 열어 둬야** 한다 — 닫으면 구독이 끊겨 끝난 것을 모른다.
- 창이 떠 있는 동안 관리자가 끝 시각 · 문구를 바꾸면 바로 다시 그린다.

검사: `checks/sim-maintenance-gate.js` (1절 순수 · 2절 창을 실제로 돌림 · 2-1절 입력 시각 판정 · 자식 창 · 3절 통로 고리 · 오류 토스트 조용히 · 4절 연결 · 규칙 · 5절 깨 보기 7).

## safe-html.js — 🛡️ 남이 쓸 수 있는 값을 화면에 넣는 단 한 곳

- **책임**: 남이 쓸 수 있는 글(닉네임 · 메모 · 서버 값)을 **친 그대로 보이게** 하고 HTML 로는 절대 안 읽히게 한다. «초마 <뚱쟁이>» · «병준이<3» · «>_<» 는 진짜 이름이다 — 지우거나 거절하지 않는다. 주소 · CSS 값도 여기서 거른다. 순수 함수 · DOM 없음.
- **만드는 법**: 만들지 않는다(받는 것 없음). `window.TwSafeHtml`(얼린 객체)를 그대로 쓴다. html · `checks/smoke.js` PRELOAD 에서 쓰는 모듈 · app.js 보다 먼저 싣는다. node 에서는 `require('./safe-html.js')`.
- **내보내는 것**
  - `text(s)` — 마크업 글자 · 속성값 안에 넣을 값. `& < > " '` 다섯 글자를 엔티티로. app.js `escHtml` · `_chatEsc`, 파일 안 `esc` 는 이것을 부르는 별칭.
  - `attr(s)` — `text` + 보이지 않는 제어 글자 빼기(줄바꿈 · 탭은 남김 — title 여러 줄). XML 칸(엑셀 내보내기)도 이것.
  - `safeUrl(u, kind)` → 허용 안 되면 `''`. `'image'` = `data:image/(png|jpeg|webp|gif);base64,` · `https:`(호스트는 아직 안 좁힘) / `'link'` = `https:` · `http:`(2048자 상한). `new URL` 로 읽어 `JaVaScRiPt:` · `\tjavascript:` · `//evil` · 상대 주소를 막는다. 돌려주는 값은 정규화한 주소.
  - `cssUrl(u)` → `url("…")` 통째로(`safeUrl(u,'image')` + 따옴표 · 역슬래시 막기), 안 되면 `''`.
  - `cssColor(c)` → 색 · 그라데이션 값 그대로, 주소를 부르는 글(`url(` · `image-set(` …)이나 다른 선언으로 넘어가는 글자(`; { } \ < >` 따옴표)가 있으면 `''`.
  ```js
  el.innerHTML = '<b title="' + TwSafeHtml.attr(m.memo) + '">' + TwSafeHtml.text(m.name) + '</b>';
  const src = TwSafeHtml.safeUrl(item.url, 'image'); if(src) img.src = src;
  box.style.background = TwSafeHtml.cssUrl(t.img) || TwSafeHtml.cssColor(t.color);
  ```
- **확장할 때 고칠 자리**: 그림 형식 · 링크 스킴 · 길이 상한은 파일 위 상수(`DATA_IMAGE` · `LINK_MAX` · `CSS_BAD`). https 호스트를 좁히는 일은 따로 정한다.
- **함정**
  - 프로퍼티(`textContent` · `title` · `value` · 토스트)에 넣는 값은 씻지 않는다 — `&lt;` 가 글자로 보인다. 주소만은 프로퍼티라도 `safeUrl`.
  - 앱 안 그림의 **상대 경로**(`emoji/…` · `assets/…`)는 `safeUrl` 이 막는다 — 그런 고정 경로는 감싸지 않는다(검사는 앞 글자가 주소를 정한 길 조각을 통과시킨다).
  - **다른 escape 를 새로 만들지 않는다.** `checks/sim-safe-html.js` 가 parts/ 전체 · html `<script>` · main.js · preload.js 를 typescript 파서로 읽어 innerHTML · outerHTML · insertAdjacentHTML · `.src` · `.href` · `style.background*` · `url(` 에 들어가는 값을 끝까지 따라가고, 씻지 않은 잎 · 집에서 만든 escape 가 있으면 빨강. 예외는 그 파일 `ALLOW` 에 이유와 함께만.

## `drag-scroll.js` — 🖱 목록을 마우스로 끌어 움직이기

- **책임**: 스크롤바를 숨긴 목록을 왼쪽 버튼으로 끌어 위아래로 움직인다(휠은 브라우저가 그대로). 도메인을 모르는 DOM 도우미.
- **쓰는 법**: `TwDragScroll.attachDragScroll(el)` — 한 요소에 한 번(두 번 불러도 한 번만 건다 · 요소가 없으면 넘어간다). 스크롤바 숨김은 css(`scrollbar-width:none` · `::-webkit-scrollbar{display:none}`)로 따로, 끄는 중엔 `.dragging` 이 붙는다(커서 · 글 선택 막기).
- **지금 쓰는 곳**: 📩 우편함 우편 · 소식 목록(`myhome-ui.js` — `#mhInboxList` · `#mhNewsList`).
- **빼는 곳**: `attachDragScroll(el, { skip: '선택자' })` — 거기서 누르면 끌기를 시작하지 않는다(우편함은 펼친 본문 `.mh-ibx-body` · 링크 `a` — 글자를 끌어 골라 복사할 수 있게).
- **함정**: `DRAG_PX`(5) 아래로 움직이면 누르기 — 항목 열기 클릭은 그대로. 넘으면 끌기 — 손을 뗄 때 나는 클릭은 막는다(끌다가 엉뚱한 글이 안 열리게). 누를 때마다 끌기 표시를 지운다(목록 밖에서 떼 클릭이 안 난 끌기 뒤에도 다음 클릭이 먹게).
- 검사: `checks/sim-drag-scroll.js`.

## `img-retry.js` — 🖼 남의 그림을 한 번 더 받을 주소

- **책임**: crossOrigin 그림이 처음 실패했을 때 다시 받을 주소를 정하는 규칙 한 곳(순수 함수).
- **쓰는 법**: `TwImgRetry.retryUrl(u)` — 다시 받을 주소(뒤에 `twr=1`), 다시 받지 않을 주소(dataURL 등 http(s) 아님 · 이미 표식)면 `null`.
  `TwImgRetry.laterRetryMs(u, n)` — 두 번 다 못 받은 그림을 n 번째(0부터) 나중에 다시 받기까지 기다릴 ms(`LATER_RETRY_MS` 5 · 20 · 60초) · http(s) 아님 · 횟수 다 씀이면 `null`.
  `TwImgRetry.retryOnError(img, onGiveUp)` — 화면의 `<img>` 에 «못 받으면 `retryUrl` 로 한 번 더» 를 건다(그래도 못 받으면 `onGiveUp`) · 받은 `img` 를 돌려준다.
  `TwImgRetry.loadWithRetry(load, u)` — 받기 함수(`load`: 주소 → Promise<이미지>)가 처음 실패하면 `retryUrl(u)` 로 한 번 더 · 다시 받을 주소가 없으면 처음 실패를 그대로 던진다.
- **지금 쓰는 곳**: `room/room-sync.js`(남의 얼굴 · 감은눈 — `loadWithRetry` · 얼굴 못 받은 def 를 방 서버 provider 가 다시 풀 때 — `retryDefAfter`) · `character/face-heal.js`(그래픽 리셋 뒤 남의 얼굴 · 동물 그림 다시 그리기 — `loadWithRetry`) · `character/animal.js`(동물 페인트 그림) · `myhome/mallang.js`(말랑이 · 등록 칸 · 선물 고르기 — `retryOnError`) · `myhome/myhome-inbox.js`(💝 선물함 칸 — `retryOnError`).
- **함정**: 표식은 고정값이어야 한다 — 다시 받은 응답이 그 주소로 캐시돼 방 스냅샷마다 다시 받지 않는다(`Date.now()` 를 붙이면 매번 새로 받는다).
  나중 받기는 횟수 상한이 있어야 한다 — 끝내 못 받는 그림을 계속 받으면 늘 받기(폴링)가 된다.
- **함정(retryOnError)**: `src` 를 넣기 **전에** 건다(새로 만드는 `<img>`). innerHTML 로 만든 칸은 넣은 바로 뒤에 건다 — 실패 이벤트는 다음 차례에 나서 놓치지 않는다.
- 검사: `checks/sim-img-retry.js` · 쓰는 곳은 `checks/sim-room-face-load.js` · `checks/sim-room-server-net.js` · `checks/sim-gift-img-retry.js` · `checks/sim-face-heal.js`.

## `help-site.js` — 📘 도움말 웹 페이지 규칙(주소 · 들일 주소 · 알림 읽기)

**책임** — 도움말 탭(`myhome/help-tab.js`)이 여는 주소와, main.js 가 안쪽 틀 이동을 허락하는 주소를 한 벌로. 두 프로세스가 같이 쓴다
(main.js 는 `require` · 렌더러는 `window.TwHelpSite` — `launcher/click-through-policy.js` 와 같은 모양). 순수 함수만.

**내놓는 것** — `HELP_ORIGIN`(https://help.together-working.com — Hosting 맞춤 도메인) · `HELP_PATH`('/' — 도움말 전용 사이트라 맨 위가 목차) · `THEMES`(앱 테마 'default' · 'bubble') ·
`pageUrl(page, theme)`(모르는 편은 목차 · 모르는 테마는 기본 · 늘 `embed=1`) · `isHelpUrl(u)`(그 사이트만 — https · 출처가 같을 때) ·
`readToc(toc)`(모양이 어긋나면 null) · `readMessage(origin, data)`(우리 출처 · `tw-help` v1 · 편 이름이 맞으면 `{ page, toc }`, 아니면 null).

**함정** — 페이지가 보내는 모양은 `hosting/help/embed.js` 와 짝이다 — 한쪽만 바꾸면 목차가 안 뜬다(`sim-help-tab` 이 embed.js 를 돌려 이 함수로 읽어 본다).
사이트 주소를 바꾸면 앱 CSP `frame-src` 도 같이. 검사: `checks/sim-help-tab.js`.

## banned-words.js — 방 제목 금칙어 판정(한 벌)

**책임** — 금칙어 목록 맞추기(`cleanBannedList`)와 판정(`hasBannedWord` — 글자만 남기고 소문자로 맞춘 뒤 부분 일치). 앱(방 만들기 · 방 설정)과 서버 함수(목록 사본 `roomLobby`)가 같은 판정을 쓴다.

**만드는 법** — 이 파일은 서버 함수 `firebase/functions/banned-words.js` 와 **글자까지 같은 사본**이다. 원본은 서버 함수 쪽 — 고칠 땐 두 파일을 같이(`sim-room-settings` 가 견준다). 앱에서는 classic script(`window.TwBannedWords`), 서버 함수에서는 `require`.

**내놓는 것** — `BANNED_MAX` · `normalizeWord` · `cleanBannedList` · `hasBannedWord`.

**함정** — 숫자 · 기호만 된 낱말은 맞추면 비어서 걸 수 없다. 부분 일치라 한 글자 낱말은 그 글자가 든 제목을 다 막는다(웹 관리자 금칙어 칸에 안내). 검사: `checks/sim-room-settings.js`.

## `input-diag.js` — 🩺 한글 씹힘 진단(조합 끊김 · 메인 멈춤 · 활성 창 조회)

- **책임**: 진단 기록(`tw-mouse-diag.log`)에 남길 줄을 만든다. 렌더러 · main 이 같이 싣는다(`window.TwInputDiag` · `module.exports`).
- **쓰는 법**
  - 렌더러: `TwInputDiag.createImeWatch({ note, now, defer }).attach(document, window)` — 한글 조합이 «포커스 뺏김(누르기 · Tab · Enter · Esc 없이 옮겨 감)» · «창 포커스 잃음» · «입력칸이 사라짐» 으로 끊기면 `[한글] …` 한 줄을 `note` 로. 사람이 누르기 · Tab · Enter · Esc 로 옮긴 것은 평소 입력이라 남기지 않는다. 친 글자는 적지 않는다(조합 길이 · 칸 이름 · 시작 뒤 ms · 창 포커스만).
  - main: `createLagWatch({ now, log, front })` — `tick()` 을 `LAG_TICK_MS` 마다, 활성 창 조회가 끝날 때 `activeWinDone(ms)`. `REPORT_MS`(1분)마다 멈춤(`LAG_SLOW_MS`+) · 느린 조회(`AW_SLOW_MS`+)가 있었을 때만 `[입력지연] …` 한 줄.
- **지금 쓰는 곳**: `app.js` 맨 앞(WebGL 감시 옆) · `main.js` 활성 창 폴링(`startActiveWinPolling`).
- **함정**: 크로미움(Electron 44 실측)은 칸을 옮기면 compositionend → blur → focusout(같은 틱), 다른 앱이 앞으로 오면 focusout(창 포커스 없음) → window blur → compositionend, 칸을 다시 그리면 compositionend 없이 focusout(그때는 아직 붙어 있음 — 그래서 `defer` 뒤에 `isConnected` 를 본다). 절전 · 잠자기(`LAG_SLEEP_MS` 넘게 건너뜀)는 멈춤으로 안 센다. 줄 수 상한 `MAX_LINES` — 클릭고착 · 포커스 기록을 밀어내지 않게.
- **못 보는 것**: 조합 중 칸을 `display:none` 으로 숨기면 크로미움이 focusout · compositionend 를 둘 다 안 보낸다.
- 검사: `checks/sim-input-diag.js`(깨 보기 열).

## `request-id.js` — 🔁 요청 번호(requestId)

- **책임**: 새것을 만들거나 쌓는 쓰기(뽑기 · 선물 · 지급 · 초대 · 글 쓰기 · 대화 보내기)에 싣는 `requestId` 를 만든다 — 서버 규칙 `^[A-Za-z0-9_-]{8,64}$`(uuid). 서버는 같은 사람 · 같은 번호를 «처음 결과를 다시 돌려주기» 로 받는다(10분).
- **쓰는 법**: 한 번 보내고 끝 — `body.requestId = TwRequestId.newId()`. 닿지 못해 다시 보낼 수 있는 일 — `const ids = TwRequestId.createPending()` 을 모듈에 하나 두고 `ids.idFor(키)`(같은 키는 같은 번호) → 답을 받으면(성공이든 서버 거절이든) `ids.settle(키)`.
- **내놓는 것**: `PATTERN` · `isValid` · `newId` · `createPending({ newId?, max? })` → `{ idFor · settle · has · size }` · `createIdMaker({ crypto, random })` · `uuidFrom(bytes)`.
- **함정**: 다시 보낼 때 새 번호를 만들면 서버가 새 일로 받아 두 번 된다(뽑기 두 번 · 선물 두 번). 끝난 일을 settle 하지 않으면 다음 일이 옛 번호로 가서 서버가 옛 결과를 돌려준다. 끝내지 않은 키는 `PENDING_MAX` 까지만 기억한다.
- 검사: `checks/sim-request-id.js`.

## `device-id.js` — 🖥️ 이 기기 id(`tw.deviceId`)

- **책임**: 서버가 프리미엄을 «이 기기» 로 판정할 때 쓰는 기기 칸 이름 하나. 로그인 API 요청 머리 `X-Device-Id`(api-client.js 가 붙인다)와 realtime `hello.deviceId` 에 같은 값을 싣는다. 신원이 아니다(신원은 로그인 토큰뿐).
- **쓰는 법**: `TwDeviceId.store.get()` — 처음 부를 때 한 번 만들어(`TwRequestId.newId` · uuid) `localStorage` 에 두고, 그 뒤로는 저장값. 저장값이 모양(`^[A-Za-z0-9_-]{8,64}$`) 밖이면 새로 만들어 덮는다.
- **함정**: 계정을 바꿔도 **지우지 않는다**(계정 전환 지움 목록에 넣지 말 것) — 값이 바뀌면 같은 PC 가 등록 기기(3대)를 하나 더 차지한다. 저장이 막힌 PC 는 실행마다 다른 기기로 보인다.
- 검사: `checks/sim-device-id.js`.

## `api-client.js` — 🌐 앱 공통 API 통로(`/v1`)

- **책임**: fetch · 시간 제한 · 봉투 풀기 · 실패 한 모양(`ApiError` kind · code · items · retryAfterMs) · 토큰 · 기기 머리 · ETag(304) 를 한 곳에서. 앱 오류 번호로 바꾸는 표는 `api-errors.js`.
- **쓰는 법**: 로그인 없는 읽기는 `TwApi.client.get(path, { cacheMs })`. 로그인 길은 `TwApi.authed` — `get(path, { auth: true, onOwner? })` · `post · put · patch(path, body)` · `del(path)`(쓰기는 로그인이 기본). 도메인 provider 는 app.js 가 만들 때 `api: TwApi.authed` 로 받는다(firebaseAPI 를 거치지 않는다).
- **ETag**: 응답에 ETag 가 있으면 값과 함께 기억했다가 다음 읽기에 `If-None-Match` — 304 면 기억한 값. 로그인 읽기는 토큰 주인(sub)마다 따로 기억한다. 계정을 놓을 때 `clearCache()`.
- **서버 쓰기는 읽은 토큰 주인과 묶는다**: 읽은 값을 고쳐 올리는 provider 는 읽을 때 `get(path, { auth: true, onOwner })` 로 토큰 주인을 기억하고, 쓸 때 `put(path, body, { expectOwner })` 를 싣는다. 보내기 직전 쓸 토큰의 주인이 다르면(그 사이 로그인한 사람이 바뀜) 통로가 보내지 않고 `OWNER_CHANGED`(요청 0)로 끝낸다 — 앞 계정 값이 새 계정 토큰으로 나가 덮어쓰는 길을 막는다. 다른 묶음의 «읽고 고쳐 쓰기» 도 이 규칙을 따른다.
- **토큰**: `TwApi.authed` 의 토큰은 firebase-init.js 가 `TwApi.bindToken(_getIdToken)` 로 잇는다. 로그인 읽기는 토큰을 요청당 한 번만 받고(시간 제한과 겨룸 — 멈춰도 `TIMEOUT`) 그 토큰으로 보낸다. 401 `AUTH_REQUIRED` 면 새 토큰으로 한 번만 다시 — `USER_CODE_NOT_BOUND`(가입 전)는 다시 안 한다.
- **서버가 답했다는 알림**: `onReachable(fn)`(돌려주는 것: 구독 끊기) — 서버가 답한 요청(2xx · 304 · 4xx)이 끝날 때마다 이름 없이 `fn()`. 네트워크 실패 · 타임아웃 · 5xx · 길 없음(`NO_ROUTE_CODES`) · `*_NOT_READY` 는 알리지 않는다. 쓰는 곳은 로그인 흐름의 로컬 모드 되돌아오기(app.js 가 잇는다).
- **함정**: 쓰기는 다시 보내지 않는다(통로가 알아서 재시도하지 않음) — 다시 보낼 일은 부르는 쪽이 같은 `requestId`(request-id.js)로. 읽기 시간 제한(`TIMEOUT_MS`)은 옛 Firebase 길로 빨리 넘어가려고 짧다 — 옛 길이 없는 읽기는 `timeoutMs` 를 넘긴다. `shouldFallback` 은 옛 길을 걷으면 같이 걷는다.
- 검사: `checks/sim-api-client.js`.

## `api-errors.js` — 🧭 서버 오류 봉투 → 할 일 · 오류 번호

- **책임**: api-client.js 의 `ApiError`(서버 봉투 code · 통로 kind)를 «할 일 + 오류 번호» 로 바꾸는 표 한 곳. 공통 code 만 여기 — `AUTH_REQUIRED` · `NO_TOKEN` → `login`(E-NET-01) · `USER_CODE_NOT_BOUND` → `signup`(토스트 없음) · `SERVER_ADMIN_ONLY` → `maintenance`(토스트 없음) · `ACCESS_DENIED` · `PREMIUM_REQUIRED` → `notice` · `TOO_MANY_REQUESTS` → `later`(`retryAfterMs`) · `CONCURRENT_UPDATE` → `refetch` · 모양 오류 → `notice` · 닿지 못함 → `offline`(E-NET-07) · 그 밖 → `notice`(E-NET-08).
- **쓰는 법**: `const t = TwApiErrors.store.notify(err, 내 표)` → `{ code, action, retryAfterMs, items }` 를 받아 화면을 고른다(로그인 화면 · 점검 창 · 다시 받기는 부르는 쪽 몫). 번호 없이 판단만 — `TwApiErrors.translate(err, 내 표)`.
- **기능 표**: `{ GIFT_DAILY_LIMIT: { action: 'later', notice: (notifyError, e) => notifyError('E-MH-..', e, e.message) } }` 모양으로 그 묶음 파일에 둔다 — 번호는 error-codes.js 표에 먼저 넣고 글자 그대로. 기능 표가 공통 표보다 먼저다.
- **함정**: 서버 message 는 사용자 문구로 써도 되는 곳만 셋째 인자로(선물 · 하루 상한처럼 숫자가 든 것). 공통 표에 기능 code 를 더하지 않는다 — 같은 code 를 기능마다 다르게 다룰 수 있어야 한다.
- 검사: `checks/sim-api-errors.js`.

## `remote-config.js` — ⚙️ 원격 설정(`GET /v1/config` 하나)

- **책임**: 운영 값(방 상한 · 정원 · 방 연결 시간 · 앱 · 방 최소 버전 · 금칙어 · 초대 게이트 · 제보 · 박수 · 선물 하루 상한)을 서버 `GET /v1/config` 한 곳에서 받아 칸마다 씻어 둔다. 못 받으면 이 PC 저장값(2판) → 기본값. Firebase config 칸은 읽지 않는다.
- **쓰는 법**: `TwRemoteConfig.store` — `maxPeople()` · `roomLimitOf(채널)` · `inviteGate()` · `roomServerTiming()` · `minAppVer()` · `minRoomVer()` · `bugDailyMax()` · `bannedWords()` · `clapDailyMax()` · `giftDailySendMax()` · `onChange(fn)` · `ready(_, ms)` · `refresh({ maxAgeMs })`.
- **다시 읽기**: 5분마다 · 창이 다시 보일 때(1분 넘었으면) · realtime 알림 `config`(rt-hub.js — 서버가 바꿨다 · 오래 끊겼다 붙음). 같은 값이면 API 통로가 ETag 304 로 받는다.
- **얇은 자리**: `existingSignup()` 은 0.13 설정에 칸이 없어 옛 기본값(켜짐)만 돌려준다 — 계정 묶음이 가입 흐름을 서버로 옮기며 걷는다.
- **함정**: 최소 버전은 저장값을 쓰지 않는다(지난 값으로 막지 않게). 옛 판(평평한 칸)이 남긴 저장값은 판 표시가 없어 읽지 않는다. 칸 이름(`roomMaxPeople` 등)은 앱 안 이름이라 서버 이름과 다르다 — 풀기는 `fieldsOf` 한 곳.
- 검사: `checks/sim-remote-config.js`.

## `account-store.js` — 🗂️ 계정별 로컬 칸(`tw.u.<계정코드>.<이름>`)

- **책임**: 이 PC 에 남기는 값 중 «그 계정의 것» 을 계정별 칸에 둔다. 같은 PC 에서 계정을 바꾸면 다른 칸이 열릴 뿐이라 계정 전환 때 지우기 · 넘기기 판단이 없다(#582). 계정 데이터 자체는 0.13 부터 서버가 원본 — 여기는 PC 에 남는 값(미러 · 오늘치 · 마크 · 취향 · 캐시)만.
- **만드는 법**: `const accountStoreMod = TwAccountStore.createAccountStore({ storage: localStorage, getAccountCode: getMyUserId, isWriteLocked: ()=>acctStateMod._acctDetached() });` (app.js `getMyUserId` 바로 뒤). 계정 코드는 **부를 때마다** `getAccountCode()` 로 읽는다 — 값으로 받으면 계정이 바뀐 뒤에도 옛 칸을 쓴다. 쓰는 모듈은 deps 로 받는다(`focusTotalStore` · `focusLevelStore`), 마이홈 바탕화면(`myhome-desktop.js`)은 app.js 의 전역 이름 `accountStoreMod` 를 `advStore` 로 받는다.
- **내놓는 것**: `get(key)`(글자 또는 null) · `set(key, value)`(true / false) · `remove(key)`(true / false) · `migrateLegacy(code)` · 표 상수 `DEVICE_KEYS` · `ACCOUNT_KEYS` · `ACCOUNT_KEY_PREFIXES` · `MOVED_KEYS` · `isAccountKey`.
- **로그인 전(코드 없음 · 모양 밖)**: 읽기 null · 쓰기 false · 지우기 false. PC 공용 칸으로 돌려 쓰면 그게 섞임의 뿌리다. 쓰는 쪽은 false 를 «저장 안 됨» 으로 본다(로그인 전엔 남길 계정 값이 없다).
- **계정을 놓은 틈**: 로그아웃(wipe)이 `_acctDetached` 를 세운 뒤 재시작 전까지 `set` · `remove` 는 거절된다(코드가 바뀐 뒤에도 앱이 도는 동안 다른 계정 칸을 덮지 못하게 — 판단은 `isWriteLocked` 한 곳). 읽기는 된다. 틈을 통과하는 쓰기 길은 없다 — 0.13 은 로그인해야 쓰므로 «로그인 전 몫을 계정 칸으로 넘기기» 가 없다(옛 PC 칸의 값은 `migrateLegacy` 가 한 번만 옮긴다).
- **기기 공용 키 · 모르는 키는 던진다** — 잘못 쓴 코드를 조용히 넘기지 않는다.
- **`migrateLegacy(code)`**: 이미 깔린 사용자가 0.13 첫 실행 때 PC 칸 값을 그때 로그인한 계정 칸으로 한 번 옮긴다. `MOVED_KEYS` 만 옮기고(아직 옛 칸을 읽는 키를 옮기면 값이 사라진다) · 계정 칸에 값이 있으면 덮지 않고 · 처리한 키는 PC 칸에서 지우며 · `tw.accountStoreMigrated` 에 처리한 이름을 남겨 두 번 돌지 않는다. 쓰기에 실패한 키는 옛 칸을 지우지 않고 다음에 다시. **부르는 곳 둘**: ① app.js — `accountStoreMod` 를 만든 바로 뒤, 이 PC 에 적힌 계정 코드(`getMyUserId()`)로 한 번(계정 칸을 읽는 모듈을 만들기 전 — 서버 확인 뒤로 미루면 모듈이 «없음» 으로 읽고 저장해 옛 값이 «이미 있음» 으로 버려진다 · 코드 없는 PC 는 아무것도 안 함). ② account.js `_detachAccountLocal` — 로그아웃 올리기 · 검문 앞(①에서 못 옮긴 것만 일이 있다 · 두 번째부터는 아무 일도 안 함). 로그인 전 몫을 계정으로 합치는 길은 없다.
- **새 키를 옮길 때**: 그 묶음이 ① 모듈이 `accountStore.get/set` 만 쓰게 ② `MOVED_KEYS` 에 이름 더하기 ③ 아래 표 «옮김» 으로 ④ `account.js` `ACCOUNT_LOCAL_KEYS` 에서 빼기(계정 칸은 지우지 않는다). deps 이름은 모듈마다 달리(`xxxStore`) — joinRenderer 가 한 범위로 합치므로 `accountStore` 같은 같은 이름이 둘이면 겹친다.
- **함정**: 계정 코드를 정하는 값(`tw.myUserId` 등)은 여기 못 둔다(닭과 달걀). 계정 칸은 로그아웃해도 지우지 않는다 — 같은 계정으로 돌아오면 이어진다. `tw.accountStoreMigrated` 후에 `MOVED_KEYS` 에 키가 늘면 그 키만 새로 옮긴다(그 사이 다른 계정이 먼저 로그인했다면 그 계정이 받는다).
- 검사: `checks/sim-account-store.js`.

### 키 갈래 표 (localStorage · `tw.` 접두사 — 옛 `deskFriends.*` · `tw_chat_*` 포함)

| 갈래 | 키 | 비고 |
|---|---|---|
| (a) 기기 공용 | `tw.deviceId` · `apiBaseUrl` · `realtimeUrl` · `remoteConfig` · `glReloads` · `renderQuality` · `dotRender` · `figureMode` · `officeMode` · `deskPan` · `focusCharScale` · `chipHorz` · `chipCollapsed` · `nameplate` · `nameplateSize` · `theme` · `accent` · `mockRoom` · `updateNoticeDismissedTs` · `chatFontSize` · `chatOpacity` · `chatSfx` · `chatSfxId` · `listenMute` · `listenVol` · `noise.*` · `pkBgmMuted` · `gapSolo` · `gapMulti` · `roomSeatMode` · `focusLogMini` · `annivAreaH` · `adBanner` · `thumbSigs` · `playlistVol/Mini/Loop*/Pos` · `tw_chat_win_pos` · `bellWinPos` · `gachaWinPos` · `wdPreviewPos` · `ideskInvPos` | 이 PC 의 성질(창 자리 · 화질 · 소리 · 모양 취향). 계정을 바꿔도 그대로 |
| (a') 신원 · 로그인 | `tw.myUserId` · `loginEmail` · `loginAuthUid` · `myFriendCode` · `myFriendCodePrev` · `myPrevUserIds` · `invitePassed` · `inviteToken` · `signupPending` · `licenseKey` · `licenseOptOut` · `licenseReqId` | 계정 코드를 정하는 쪽이라 계정 칸에 둘 수 없다. 0.13 에서 서버 로그인 토큰으로 대체될 것은 계정 묶음(B) 몫 |
| (b) 계정별 — **옮김(이번 PR)** | `focusTotalSec` · `focusTodaySec` · `focusTodayDate` · `focusSyncedSec` · `advZ.v2`(마이홈 바탕화면) · `advZ.v1`(옛 판 읽기 전용) | #582 에서 섞이던 것. 모듈: `focus-total.js` · `focus-level.js` · `myhome-desktop.js` |
| (b) 계정별 — 포커스 | `focusShow` · `danceNotified` · `danceNotifiedFix` · `ideskNotified` · `starColor` · `pomo` · `pomoRun` · `bonkDay` · `dailyPlay.*` | 포커스 · 뽀모 묶음이 옮김 |
| (b)+(c) 계정별 · 서버 원본이 될 것 | `chal`(D 달성표) · `gachaOwned` · `gachaOwnedTs` · `gachaBonus`(D 가챠) · `curSlot` · `extraSeatSlots` · `roomFaceUrls` · `slotGlbUrls` · `deskFriends.slots.*`(v1 · ts · seen · loss · lastsync · pushfail · bak · bak.meta) · `deskFriends.chars.*`(v1 · desk · trashPend) · `charsLinked` · `charsMoveFails`(D 캐릭터) · `savedDesks` · `savedItems` · `savedParts` · `decoParts` · `deskPresets` · `animalPresets` · `animalEverUnlocked` · `animalCheatUnlock` · `charColorHistory` · `seatEq` · `activeInteractionDesk` · `emojiReactions` | 서버가 원본이 되면 PC 사본이 필요 없어질 것 — 그 D 묶음이 «지움» 이든 «계정 칸으로 옮김» 이든 정한다 |
| (b)+(c) 플레이리스트 | `playlist` · `playlistSets` · `playlistCur` · `playlistTitle` · `playlistBio` · `playlistHomePublic` · `playlistPrivate` · `playlistEditTs` · `playlistBackup` · `secretRoomMusic` | D10(playlist) — 서버 원본이면 `playlistEditTs` · `playlistBackup` 은 걷는다 |
| (b) 프로필 · 마이홈 | `userName` · `customStatus` · `userStatus` · `awayKind` · `awayImg` · `awaySz` · `myAdBannerImg` · `bookmarks` · `mallangGiftHidden` · `inboxBcRead` · `noticeBoard`(마지막으로 받은 소식 묶음 — `launcher/notice-feed.js`) · `bellSeenTs` · `reportHidden` · `mobileKey` · `mhRecentColors.<종류>` · `mhGbLastRead:<uid>` · `mallang.<…>` | 마이홈 · 프로필 · 알림함 묶음이 옮김 |
| (b) 대화 | `chatTab.<…>` · `tw_chat_read:<방>` · `tw_chat_join:<방>` · IndexedDB 대화 기록(`chat/chat-history.js` — 지금 scope 가 프로젝트라 계정 구분 없음) | 채팅 묶음 — IDB scope 에 계정 코드를 넣거나 서버 3일 보관으로 걷는다 |

- `ACCOUNT_LOCAL_KEYS`(`account/account.js`) 대조: 이번에 옮긴 포커스 누적 네 줄, 곧 그 목록의 `focusTotalSec` · `focusTodaySec` · `focusTodayDate` · `focusSyncedSec` 을 빼도 된다(계정 칸은 로그아웃해도 안 지우는 게 맞다 — 같은 계정이 돌아오면 이어진다). `advZ` 는 원래 목록에 없었다(그래서 바탕화면이 섞였다). 지우기 · 넘기기 로직을 걷는 것은 #580.
