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
## `source-switch.js` — 🎚️ 기능별 받는 곳 고르기(서버 / 파이어베이스)

- **책임**: 기능(친구 · 방 · 카탈로그 …)마다 «서버(우리 API · 방 서버) / 파이어베이스(옛 길)» 중 어디서 받을지 고르고(`pickSource`), «서버 먼저 → 못 받으면 파이어베이스» 를 한 벌로 돌린다(`serverFirst`). 기능 쪽은 이것만 부른다 — 스위치 이름 · 기본값 · 넘어가기 조건을 다시 쓰지 않는다(`sim-source-switch.js` 가 막는다).
- **스위치 자리**: 원격 설정 `sources.{기능}`(쓰기 원본 Firebase `config/sources/{기능}` · 웹 관리자 «🎚️ 기능 스위치») = `'server'` | `'firebase'`. 칸이 없으면 기능 표(`FEATURES`)의 옛 자리를 읽는다 — 친구 `flags.friendsApi`(끌 때만 false) · 방 `roomServer.on`(true 일 때만) · 카탈로그(옛 스위치 없음 — 늘 서버 먼저). 그래서 칸을 비워 두면 예전 동작 그대로다.
- **만드는 법**: 브라우저는 `TwSourceSwitch.store`(원격 설정 store 를 부를 때마다 읽는 한 벌)를 쓴다. 시험에서는 `createSourceSwitch({ valueOf(기능), legacyOf(기능) })`.
- **내놓는 것**: `SOURCE` · `SKIP` · `FEATURES` · `cleanSource` · `pickSource(기능, 새 값, 옛 값)` · `serverFirst(받는 곳, 서버 함수 | null, 파이어베이스 함수, 실패 알림)` → `{ v, from }` · `createSourceSwitch(deps)` → `{ pick, serverFirst }` · `store`.
  ```js
  // 친구 포트
  const r = await serverFirst(source(), apiProvider ? () => apiProvider.listFriends(myId) : null, () => firebase.listFriends(myId), onFail);
  ```
- **확장**: 새 기능을 서버로 옮길 때 `FEATURES` 에 한 줄(옛 스위치가 없으면 `legacy: () => 기본값`) · `remote-config.js` `SOURCE_FEATURES` · 웹 관리자 기능 스위치 표에 한 줄. 규칙은 `config/sources/$feature` 한 칸으로 이미 받는다.
- **함정**: 서버 함수가 «값은 왔는데 못 쓴다»(예: 사본 버전이 다름)면 던지지 말고 `SKIP` 을 돌려준다 — 실패 알림 없이 파이어베이스로 간다. 파이어베이스 쪽 오류는 숨기지 않고 그대로 던진다. 방의 허용 목록 · 비율 · 기본 서버는 이 스위치가 «서버» 일 때 `room-server-gate.js` 가 그다음에 본다.

## json-store.js — 💾 localStorage JSON 칸 읽기 · 쓰기 한 곳

- **책임**: 한 키의 JSON 을 읽고(해석) 쓴다. 실패를 삼키지 않고 결과 `{ ok, err, bytes }` 로 돌려준다 — 부르는 쪽이 알릴 수 있게.
- **쓰는 곳**: 사람 책상 프리셋(`creator/desk-preset-store.js` · `tw.deskPresets`) · 동물 프리셋(`character/animal.js` · `tw.animalPresets`). 같은 «읽기 → 해석 / 만들기 → 쓰기» 를 두 곳이 따로 들던 것을 묶었다.
- **만드는 법**: 렌더러에서는 `window.TwJsonStore`(`load` · `save`)를 바로 쓴다. 검사 · 다른 저장소는 `TwJsonStore.createJsonStore({ storage: () => 저장소 })`.
- **내놓는 것**: `load(key, fallback)` → `{ ok, list, err, bytes }`(키가 없거나 빈 글이면 ok · fallback) · `save(key, value)` → `{ ok, err, bytes }`(던지지 않는다).
- **함정**: 값의 모양(배열 · 객체)은 부르는 쪽이 본다. DOM · 토스트를 모른다 — 알리기는 부르는 쪽. 검사 `checks/sim-json-store.js`.

## `data-gateway.js` — 🚪 범용 데이터 통로(서버만 배포해서 기능 옮기기)

- **책임**: `firebase-init.js` 의 Firebase 기본 동작(get · set · update · remove · push · onValue) 앞의 문 하나. 원격 설정 **dataRoutes** 표에 걸린 경로만 서버 범용 끝점(`POST /v1/data` · 듣기는 `GET /v1/data/stream` SSE)으로 보내고, 나머지는 SDK 를 같은 인자로 그대로 부른다. **표가 비면 지금과 똑같다.**
- **왜**: 기능 함수(firebaseAPI 256개)마다 서버 주소를 박으면 기능을 옮길 때마다 앱 업데이트가 필요하다. 문 하나를 두면 «서버에 그 경로 처리기 추가 + 표에 경로 한 줄» 만으로 옮긴다(앱 업데이트 없음 · 표에서 빼면 즉시 되돌림).
- **만드는 법**: `TwDataGateway.createDataGateway({ sdk, routes, myCode, serverFirst, post, stream, isQuery, warn })` — firebase-init.js 가 만든다(`post` · `stream` 은 로그인 통로 `_authApi` · ID 토큰).
- **표**: `config/dataRoutes`(관리자만 쓰기 · 누구나 읽기 · 글자 배열) · `GET /v1/config` 의 `dataRoutes`. 경로 앞부분 — 칸 자리에 별표를 쓰면 아무 칸.
- **신원**: 경로 속 코드는 데이터 주소일 뿐이다. 서버로 보낼 때 **내 코드인 칸만 `me`** 로 바꾼다(`toServerPath`). 신원은 서버가 ID 토큰에서만 정한다.
- **실패하면**: 연결 실패 · 시간 초과 · 5xx · 404(서버가 모르는 경로) → 그 호출은 Firebase 로(`source-switch.js` serverFirst 한 벌). 듣기는 첫 값 전에 끊기면 Firebase 로 듣는다.
- **늘 Firebase**: 조건 붙은 읽기(query) · 트랜잭션 · onDisconnect · 자식 단위 듣기(onChild*).
- **⚠️ 함정**: 기능 함수에서 SDK 함수를 새로 import 해 직접 부르지 말 것 — 통로를 건너뛰면 그 기능은 서버로 못 옮긴다(`checks/sim-data-gateway.js`). 다중 경로 update 는 칸이 서버 · Firebase 로 섞이면 쪼개지 않고 통째로 Firebase.

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
