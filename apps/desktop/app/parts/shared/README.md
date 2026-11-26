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
  - three r128 은 셰이더를 `customProgramCacheKey()`(기본 = `onBeforeCompile` 글자)로 나눠 쓴다. 감싼 훅은 글자가 늘 같으니 키에 원래 훅 글자를 넣어야 염색 재질과 보통 재질이 한 셰이더를 나눠 쓰지 않는다(염색 빠짐). 키는 그릴 때마다 계산한다 — 켠 뒤 처음 색조를 걸면 색조 셰이더가 우리 훅을 덮어쓰는데, 그동안은 three 기본 키(그 훅 글자)를 낸다. 켤 때 적어 둔 키면 색조가 빠지고, 접두사를 붙이면 다시 감싼 뒤 키가 같아 PS1 이 영영 안 걸린다.
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
  - 검사: `checks/sim-ps1-dither.js`(값 · 경계값 · 도트 셰이더 글 · 스티커사진 필터 결과가 묶기 전과 픽셀까지 같음 · mutation test).

## etag-store.js — 🏷️ ETag 기억을 껐다 켜도 남게

- **책임**: api-client 의 ETag 기억({ etag, data })을 IndexedDB `tw-etag-cache`(저장소 `etag`, keyPath `k`)에 남겨, 켤 때 첫 읽기에도 If-None-Match 를 싣는다. 값은 서버가 304 로 답할 때만 쓴다 — 서버에 묻기 전에 이 값으로 화면을 그리지 않는다.
- **만드는 법**: api-client.js 가 앱 한 벌을 만들 때 `TwEtagStore.createEtagStore()` 한 벌을 두 통로에 `persist: { store, paths }` 로 넘긴다. 남기는 길은 api-client.js `PERSIST_PUBLIC`(설정 · 공지) · `PERSIST_AUTHED`(카탈로그 · 옷장 · 보유분 · 포커스 · 친구 · 플레이리스트).
- **내보내는 것**: `load(key)` → `Promise<{ etag, data } | null>` · `save(key, etag, data)` · `clear()` · 상한 `MAX`(64 — 넘으면 오래된 것부터).
- **함정**
  - 열쇠는 api-client 의 «누구(토큰 sub) + 경로» — 다른 계정 값을 돌려주지 않는다. 계정을 놓으면(`forgetSession`) 통째로 지운다.
  - 길을 더할 땐 서버가 그 길에 ETag 를 주는지 먼저 본다(안 주면 남길 것이 없다).
  - 검사: `checks/sim-etag-store.js` · `checks/sim-api-client.js`(persist 절).

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

## `light-tone.js` — 💡 재질 톤(조명 예산 · emissive) · 실행 화면 조명 한 벌

**책임** — 화면 밝기의 손잡이 하나(`TONE_FRONT_TOTAL` — 카메라를 보는 흰 면이 받는 빛의 총합)에서 플랫 조명 몫(`FLAT_EMISSIVE`)을 계산하고,
아이템 · 책상 재질에 같은 규칙으로 emissive 를 얹는다. 캐릭터 · 파츠 재질 톤(파츠 톤 · baseFlat · 얼굴 맵 · 몸 평탄 조명 · 색조)은 캐릭터 코어 `tone.ts` 이고,
여기서 `FLAT_EMISSIVE` 로 코어 톤을 만들어 `toneCore` 로 내놓는다(앱의 다른 곳은 그것을 deps 로 받는다).
숫자(`LIGHT_PRESET` · `CREATOR_LIGHT_SL` · `TONE_FRONT_TOTAL` · 조명 배율)와 플랫 몫 계산식 · 재질 고치기(`fixMatLighting`)는 캐릭터 코어 `lighting.ts` 한 벌 — 웹 생성기도 같은 것을 쓴다.
실행 화면 조명(앰비언트 · 키 · 뒤쪽 냉색 바운스 · 정면 필)을 씬에 넣는 것도 여기 한 벌(`addRunLights`) — 메인 씬 · 종족 선택 · 런처 · 꾸미기 · 스티커사진 · 썸네일 · 생성기 미리보기 · 동물 생성기 · 종족 선택의 동물 카드가 모두 부른다. 세기를 슬라이더로 다시 정하는 생성기는 `runLightInts` 로 세기를 읽는다(몫 숫자를 곳마다 다시 적지 않게).

**만드는 법** — app.js 💡 조명 상수 바로 뒤(메인 씬 조명이 바로 아래에서 쓴다):

```js
const lightToneMod = TwLightTone.createLightTone({
  _FILL_LIGHT_MUL: _FILL_LIGHT_MUL,                       // 값 — 채움광 배율(app.js 조명 상수)
  _KEY_LIGHT_MUL: _KEY_LIGHT_MUL,                         // 값 — 키(위) 배율
  _MAIN_LIGHT_COL: _MAIN_LIGHT_COL,                       // 값 — 빛 색(거의 백색)
  _MAIN_LIGHT_INT: _MAIN_LIGHT_INT,                       // 값 — 주광 세기(코어 MAIN_LIGHT_INT = LIGHT_PRESET.b × e)
  _fixGlbMatLighting: (...a)=>_fixGlbMatLighting(...a),   // 함수 — metalness 1 재질 눕히기(코어 fixMatLighting + 콘솔 한 줄)
  charCore: TwCharCore,                                   // 캐릭터 코어 — createTone 으로 toneCore 를 만든다
});
const LIGHT_PRESET = lightToneMod.LIGHT_PRESET;   // 옛 전역 이름 — app.js 안에서 쓴다(animal.js 는 deps 로 받는다)
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
| `addRunLights(target, opt)` | 실행 화면 조명을 `target` 에 넣는다 — `opt.keyPos`(필수) · `mul`(썸네일 광량 배율, 기본 1) · `int` · `keyMul`(`runLightInts` 와 같다) · `backBounce`(뒤쪽 냉색 바운스) · `frontFill`(기본 켬). `{ amb, key, back, front }` 를 돌려준다(키 그림자는 부르는 쪽이 건다) |
| `runLightInts(opt)` | 세 빛의 세기 `{ amb, key, front }` — `opt.int`(세기 예산, 기본 주광) · `mul`(광량 배율, 기본 1) · `keyMul`(키 배율, 기본 `_KEY_LIGHT_MUL`). `addRunLights` 도 같은 옵션을 받는다 |
| `runLightAt1()` | 배율 1 일 때 앰비언트 + 키 세기 합 — 썸네일이 광량 배율을 계산할 때 |
| `baseFlatOf(mat)` | 코어 `toneCore.baseFlatOf` — 재질에 심은 플랫 배율(baseFlat), 없으면 공용 기준 `FLAT_EMISSIVE` — 색을 다시 칠하는 곳(아이템 · 꾸미기 · 생성기)은 모두 이것으로 읽는다. 0 도 심은 값 |

```js
lightToneMod._setDeskMatColor(seat.deskMat, def.deskColor || null);   // 책상 색은 꼭 이 함수로(color.set 직접 금지)
```

**확장할 때 고칠 자리** — 화면이 밝다 / 어둡다 → 코어 `packages/char-core/src/lighting.ts` 의 `TONE_FRONT_TOTAL` 하나만(코어를 빌드해 앱 사본까지 같은 커밋에). 아이템만 톤을 달리해야 하면 `ITEM_SOLID_FLAT` 줄에, 파츠만이면 코어 `packages/char-core/src/tone.ts` 의 `PART_TEX_FLAT` 줄에 숫자를.

**함정**
- «baseFlat 이 있으면 그 값, 없으면 …» 판단을 부르는 쪽에 다시 쓰지 않는다 — `baseFlatOf` 를 부른다(곳마다 쓰면 대체값이 갈라진다 · `sim-light-tone` 이 잡는다).
- 1.16 을 넘기면 측면도 잘려 밝아지지 않고 계조만 사라진다.
- 실행 화면을 닮은 새 미리보기 씬은 빛을 손으로 만들지 말고 `addRunLights` 를 deps 로 받아 부른다(손으로 적으면 예산이 바뀔 때 그 화면만 톤이 달라진다 · `sim-light-tone` 7절이 잡는다).
- 재질 색을 바꾸는 새 코드는 `color.set` 만 하지 말고 baseFlat 으로 emissive 를 다시 계산해야 한다(책상은 `_setDeskMatColor`).

검사: `checks/sim-light-tone.js` (FLAT_EMISSIVE 식 · 경계 · 재질 함수 셋 · 연결 · 실행 화면 조명 여섯 자리 · 생성기 둘을 옛 글과 견주기 · mutation test).

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
  - `rand` 는 검사용(seed 고정). 앱에서는 비워 두면 `Math.random`.
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

검사: `checks/sim-paint-geom.js` (strokeSeg 점 · 잇기 · 0 · mirrorUVOn 반전 · 0.6 · off · cx 없음 · 법선 없음 · castFn 없음 · null · 연결 · mutation test 9).

## `net-ready.js` — 🛰 네트워크(provider) 준비됨 기다리기

**책임** — «연결이 있으면 바로, 없으면 준비 신호를 한 번 기다림» 한 곳. 14곳(app.js 넷 · room-entry 둘 · ad-banner · my-info · scheduler · overhead · room-invite-ui · room-sync · bug-board-ui)에 따로 있던 판단을 묶었다. 지금 «준비됨» 은 `firebase-init.js` 가 `window.firebaseAPI` 를 다 만들고 쏘는 `firebase-ready` 이벤트.

**만드는 법** — 만들 필요 없음(deps 0). 쓰는 모듈 · app.js 보다 먼저 싣는 classic script(`window.TwNetReady`)이고, 쓰는 곳은 `TwNetReady.이름` 으로 바로 부른다.

**내놓는 것**
- `whenNetReady(cb, need)` — 준비면 바로 `cb()`, 아니면 신호에 `{ once:true }` 로 한 번. `need`(함수 이름 글)를 주면 «`firebaseAPI` 에 그 함수까지 있을 때» 만 바로 부른다.
  ```js
  TwNetReady.whenNetReady(()=>_bindRoomInviteReceiver());
  TwNetReady.whenNetReady(()=>cb());   // 준비 키(need)를 주지 않는다 — 키 이름을 걷은 메서드로 두면 «준비됨» 이 영영 안 온다
  ```
- `onNetReady(cb)` — 신호가 올 때마다(once 없음). 예전에 once 없이 걸던 두 곳(overhead 공지 구독 · room-sync 다시 연결 알림)만 쓴다.
- `waitNetReady(ms)` — `Promise<boolean>`: 신호가 오면 `true`, `ms` 가 지나면 그때 연결 유무. room-entry `_waitFirebaseApi`(방 입장 10초)가 쓴다.
- `isNetReady(need)` · `NET_READY_EVENT`.

**확장할 때 고칠 자리** — 서버 이관 때 provider 의 «준비됨» 신호로 갈아 끼우는 곳은 이 파일의 `NET_READY_EVENT` · `isNetReady` 뿐이다. 새로 «준비되면 하기» 가 필요하면 여기 함수를 부르고, `firebase-ready` 에 직접 귀를 대지 않는다(sim-net-ready 가 막는다).

**함정**
- 이벤트 자리에 함수를 그대로 넘기면 그 함수가 이벤트를 첫 인자로 받는다(예전과 같다). 인자를 받는 함수면 `()=>fn()` 으로 감싼다.
- `onNetReady` 는 신호가 두 번 오면 두 번 부른다. overhead 의 once 없음은 원래 동작 그대로 둔 것이다(CONFIRM.md).

검사: `checks/sim-net-ready.js` (바로 · once 한 번 · need · 이벤트 인자 · onNetReady 두 번 · waitNetReady 신호 · 시간 · 한 번만 풀림 · 직접 귀 0곳 · 쓰는 파일 11곳 · html 순서 · smoke · mutation test 9).

## `upload-cache.js` — 🗂️ 업로드 캐시 규칙 · 같은 그림 다시 안 올리기

- **책임**: 업로드 캐시(`«종류:내용해시» → URL`)를 다루는 규칙 하나 — 넘칠 때 무엇을 버리나 · 쓴 것 표시 · 저장 때 사본 합치기 · 같은 업로드 한 번. 읽기 · 쓰기(localStorage) · 업로드는 쓰는 모듈이 한다.
- **쓰는 곳**: 얼굴 캐시 `room/room-sync.js`(`tw.roomFaceUrls` · `faceUploadCache`) · 슬롯 GLB 캐시 `character/slot-codec.js`(`tw.slotGlbUrls` · `glbUploadCache`).
- **만드는 법**: app.js 가 `const uploadCacheMod = TwUploadCache.createUploadCache();` 로 하나 만들어 위 모듈에 deps 로 넘긴다(받는 deps 없음 · 진행 중 업로드 표는 이 하나에 있다).
- **내놓는 것**: `trim(st, max)` — 넘치면 옛 해시 → 섬네일 `THUMB_CACHE_MAX`(10) → 오래 안 쓴 것부터 버림(통째로 비우지 않는다) · `touch(st, key)` · `merge(stored, mine)` · `once(key, run)` · `FACE_CACHE_MAX`(100) · `GLB_CACHE_MAX`(40).
- **확장**: 새 업로드 캐시가 생기면 상한 상수를 여기에 더하고 같은 함수를 부른다 — 쓰는 모듈에 «넘치면 비우기» · «동시 업로드 막기» 를 다시 쓰지 않는다.
- **함정**: 키 순서가 «오래 안 쓴 순» 이다 — 조회해서 쓰면 `touch`, 저장은 `merge` 뒤에. 옛 해시(`h2` 로 시작하지 않는) 항목은 조회에 쓰지 않는다(같은 해시가 같은 그림이라는 보장이 없다).
- **검사**: `checks/sim-upload-cache.js`.
## `device-toggle.js` — 이 PC 의 켜고 끄는 화면 설정 하나
- **책임**: 설정 › 디스플레이의 켜짐 · 꺼짐 한 칸을 들고 저장한다(기본 켜짐 · `'0'` 이면 꺼짐). 지금 쓰는 곳: «남의 자리비움 그림»(`tw.awayPicOthers`).
- **만드는 법**: app.js 가 설정 창보다 먼저 `TwDeviceToggle.createDeviceToggle({ storage: localStorage, key: 'tw.…' })` → 설정 창과 그 설정을 읽는 기능 모듈에 값으로 넘긴다.
- **내놓는 것**: `on()` · `set(v)`(저장 + 알림) · `onChange(fn)`(바뀔 때만 · 돌려주는 함수로 뗀다).
- **함정**: 설정 창이 기능 모듈의 값을 읽게 하면 «설정 창 → 기능 모듈» 순환이 된다(`sim-dep-cycles`) — 그래서 값은 여기 두고 둘 다 이것을 읽는다. 키는 `tw.` 로 시작해야 하고(아니면 만들 때 던진다) 기기 칸 목록(`account-store.js`)에도 넣는다.
- 검사: `sim-device-toggle.js`

## json-store.js — 💾 localStorage JSON 칸 읽기 · 쓰기 한 곳

- **책임**: 한 키의 JSON 을 읽고(해석) 쓴다. 실패를 삼키지 않고 결과 `{ ok, err, bytes }` 로 돌려준다 — 부르는 쪽이 알릴 수 있게.
- **쓰는 곳**: 사람 책상 프리셋(`creator/desk-preset-store.js` · `tw.deskPresets`) · 동물 프리셋(`character/animal.js` · `tw.animalPresets`). 같은 «읽기 → 해석 / 만들기 → 쓰기» 를 두 곳이 따로 들던 것을 묶었다.
- **만드는 법**: 렌더러에서는 `window.TwJsonStore`(`load` · `save`)를 바로 쓴다. 검사 · 다른 저장소는 `TwJsonStore.createJsonStore({ storage: () => 저장소 })`.
- **내놓는 것**: `load(key, fallback)` → `{ ok, list, err, bytes }`(키가 없거나 빈 글이면 ok · fallback) · `save(key, value)` → `{ ok, err, bytes }`(던지지 않는다).
- **함정**: 값의 모양(배열 · 객체)은 부르는 쪽이 본다. DOM · 토스트를 모른다 — 알리기는 부르는 쪽. 검사 `checks/sim-json-store.js`.

## `app-version.js` — 🏷️ 앱 버전(ver) 받기

**책임** — 앱 버전을 한 번 받아(`companion.getAppVersion()` · 비동기 IPC) realtime 연결의 hello 에 싣는다. 서버가 hello 의 ver 로 최소 버전 · 방 서버 판정을 한다.

**만드는 법** — `realtime/rt-bind.js` 가 `sharedAppVersion(window)` 을 받아 `TwRtHub.store.bind` 의 `getVersion` 으로 넘긴다(앱 한 벌 · IPC 한 번). 검사 · 다른 출처는 `createAppVersion({ getVersion })`.

**내놓는 것**
- `sharedAppVersion(win)` — 앱 한 벌의 `{ ready }`.
- `createAppVersion({ getVersion })` → `{ ready }` — 받은 버전(못 받으면 `null` · 거부 없음). 최소 버전 게이트 · 방 서버는 이것(«모름» = null)을 본다.
- `cleanAppVer(v)` · `APP_VER_MAX`(20 · 서버 hello 상한).

**함정**
- companion 이 없거나(웹 · 검사) 던지거나 모양이 이상하면 `null` — 부르는 쪽이 «모름» 으로 다룬다.
- Firebase presence 에 ver 를 싣던 길(`withVer` · `.info/connected` · `onVersion`)은 걷었다.

검사: `checks/sim-app-version.js` (1절 모듈 · 2절 rt-bind 가 한 벌을 받음 · 3절 규칙 · 4절 accountSnap).

## `api-client.js` · `api-errors.js` — 🌐 서버 API(/v2) 통로 · 오류 번역표
**책임** — 앱이 우리 서버(`/v2`)와 말하는 길 한 벌. 시간 제한 · 봉투 풀기 · 실패 모양(`ApiError`) · 토큰 붙이기를 기능마다 따로 만들지 않는다. `TwApi.client`(로그인 없는 읽기 · 쉬기 있음) · `TwApi.authed`(로그인 통로 — 읽기 · `post` · `put` · `patch` · `del` · 쉬기 없음). 토큰은 `firebase-init.js` 가 `TwApi.bindToken` 으로 잇는다.
**provider 자리** — 도메인 모듈은 `firebaseAPI` 를 부르지 않고 `*-api.js`(예: `support/report-api.js`) 한 파일의 함수만 부른다. 그 파일이 경로 · 본문 모양 · 서버 code 를 알고 `TwApi.authed` 를 deps 로 받는다.
**실패** — 옛 Firebase 경로로 넘어가지 않는다. 실패는 던지고, 부르는 쪽이 `TwApiErrors.translate` 로 갈래를 잡아 `TwErrorCodes.notify('E-영역-번호')` 로 보인다. 자동 재시도 없음(사용자가 버튼을 다시 누르는 것만).
**두 번역표** — `data-gateway.js` 의 `ERROR_NOTICES`(E-DATA)는 범용 통로(옛 경로) 몫이고 새 기능은 `api-errors.js`(E-NET)만 쓴다. 범용 통로를 걷을 때 앞의 표도 같이 걷는다.
**함정** — 공개 읽기 통로(`api-public-reads.js` · `shouldFallback`)는 옛 경로가 남은 동안만 쓰고 새 코드는 쓰지 않는다. 쓰기(`post` 등)는 로그인이 기본이다.

## `maintenance-gate.js` — 🛠 서버 점검 창

**책임** — 점검이 켜진 동안(0.13: 서버 `GET /v2/config` 의 `maintenance { on, endsAt(ISO), message }` 를 먼저 읽고, 서버에 닿지 못할 때만 Firebase `config/maintenance` 한 칸), **사람이 방금 누른 동작**이 서버에 닿으면 «서버 점검 중 · ○○:○○쯤 끝날 예정» 창을 띄운다. 이 PC 에서만 도는 기능(책상 · 꾸미기 · 뽀모도로)은 막지 않는다. 점검이 끝나면 «지금 다시 켜기 · 나중에» 를 묻는다.

**만드는 법** — classic script(`window.TwMaintenance`)를 `error-codes.js` · `api-client.js` 보다 먼저 싣고, 앱 한 벌 `store` 를 만들어 둔다. `firebase-init.js` 가 `store.start({ readFlag, rt })` 로 Firebase 한 칸 읽기 · realtime 알림을 잇고(구독은 하지 않는다), Firebase 기본 동작(firebase-init.js `_touched`) · API 통로(`api-client.js` `onRequest`)가 요청마다 `store.touch()` 를 부른다.

**내놓는 것**
- `store.onValue(값)` · `store.touch()`(점검 중이고 사람이 누른 동작이면 창 · 참) · `store.on()`(지금 점검인가 — 오류 번호 토스트를 조용히 하는 데 쓴다).
- `store.serverClosed(retry, onDismiss)` — realtime 서버가 점검(4006)으로 닫았다(`realtime/rt-status-ui.js` 가 부름). 점검 창에 [다시 시도] 를 더해 띄우고, 누르거나 `config/maintenance` 가 풀리면 `retry()` 한 번(자동 재시도 없음). 창이 떠 있는 동안 `on()` 도 참. «확인» 으로 닫으면 같은 `retry` 를 `onDismiss` 에도 넘긴다(띠 [다시 연결] · 점검 해제와 띠 중 먼저 온 쪽 한 번만) — ⚠️ 닫은 뒤에도 `on()` 이 참이면 이 실행의 오류 알림이 다 꺼진다.
- `store.check()` — 점검 값을 한 번 읽는다(서버 먼저 · 네트워크 · 5xx · 시간 초과면 Firebase 한 칸 · 4xx 는 물러나지 않고 지금 값 그대로). 읽는 때: 앱 켤 때(`start`) · realtime `config` 알림 · 4006 으로 닫힐 때(`serverClosed` · 3초 안에 읽었으면 건너뜀) · [다시 시도]. 점검 상태(`cur`)의 주인은 이 모듈 하나.
- 순수: `maintenanceOfServer`(ISO → ms) · `unreachable(오류)` · `maintenanceOf` · `endsAtText` · `viewOf` · `MAINTENANCE_PATH` · `GATE_ID` · `MESSAGE_MAX`(200 · 규칙과 같은 값).

**함정**
- «사람이 누른 동작» 은 클릭 · 키 입력 뒤 `ACTIVE_MS`(1초) 안에 나간 요청이다(점검 창 안 입력은 세지 않는다). `navigator.userActivation.isActive` 는 쓰지 않는다 — 아무 데나 누른 뒤 약 5초 참이라 꾸미기 저장 디바운스(3초) · 하트비트에도 창이 뜬다.
- 따로 된 창(`window.open` — 📖 방명록 · 👑 디자인 스튜디오)은 본창 입력 시계가 못 듣는다. 그런 창을 새로 만들면 열 때 `store.watchInput(그 document)` 를 건다(deps `watchMaintenanceInput` · `d.close()` 뒤 — `document.open` 이 리스너를 지운다). 점검 창은 마지막으로 누른 창 안에 그린다.
- 잡는 문은 범용 통로 · API 통로 둘뿐이다 — `runTransaction` 직접 호출 · 함수 호출 · 방 서버 웹소켓으로만 닿는 기능은 창 없이 실패한다(오류 번호 토스트도 점검 중엔 꺼짐).
- 끝나도 저절로 다시 켜지 않는다(로컬 기능을 쓰는 중일 수 있다). 다만 점검 중 거부된 `onValue` 구독은 다시 붙지 않으니, 다시 켜야 친구 · 우편 · 방이 이어진다.
- 점검 때 Firebase 를 잠그는 규칙도 `config/maintenance` **읽기는 열어 둬야** 한다 — 닫으면 구독이 끊겨 끝난 것을 모른다.
- 창이 떠 있는 동안 관리자가 끝 시각 · 문구를 바꾸면 바로 다시 그린다.

검사: `checks/sim-maintenance-gate.js` (1절 순수 · 2절 창을 실제로 돌림 · 2-1절 입력 시각 판정 · 자식 창 · 2-2절 realtime 점검 · 3절 통로 고리 · 오류 토스트 조용히 · 4절 연결 · 규칙 · 5절 mutation test 11).

## safe-html.js — 🛡️ 남이 쓸 수 있는 값을 화면에 넣는 단 한 곳

- **책임**: 남이 쓸 수 있는 글(닉네임 · 메모 · 서버 값)을 **친 그대로 보이게** 하고 HTML 로는 절대 안 읽히게 한다. «초마 <뚱쟁이>» · «병준이<3» · «>_<» 는 진짜 이름이다 — 지우거나 거절하지 않는다. 주소 · CSS 값도 여기서 거른다. 순수 함수 · DOM 없음.
- **만드는 법**: 만들지 않는다(받는 것 없음). `window.TwSafeHtml`(얼린 객체)를 그대로 쓴다. html · `checks/smoke.js` PRELOAD 에서 쓰는 모듈 · app.js 보다 먼저 싣는다. node 에서는 `require('./safe-html.js')`.
- **내보내는 것**
  - `text(s)` — 마크업 글자 · 속성값 안에 넣을 값. `& < > " '` 다섯 글자를 엔티티로. app.js `escHtml` · `_chatEsc`, 파일 안 `esc` 는 이것을 부르는 별칭.
  - `attr(s)` — `text` + 보이지 않는 제어 글자 빼기(줄바꿈 · 탭은 남김 — title 여러 줄). XML 칸(엑셀 내보내기)도 이것.
  - `safeUrl(u, kind)` → 허용 안 되면 `''`. `'image'` = `data:image/(png|jpeg|webp|gif);base64,` · `https:`(호스트는 아직 안 좁힘) / `'link'` = `https:` · `http:`(2048자 상한). `new URL` 로 읽어 `JaVaScRiPt:` · `\tjavascript:` · `//evil` · 상대 주소를 막는다. 돌려주는 값은 정규화한 주소.
  - `cssUrl(u)` → `url("…")` 통째로(`safeUrl(u,'image')` + 따옴표 · 역슬래시 막기), 안 되면 `''`.
  - `cssColor(c)` → 색 · 그라데이션 값 그대로, 주소를 부르는 글(`url(` · `image-set(` …)이나 다른 선언으로 넘어가는 글자(`; { } \ < >` 따옴표)가 있으면 `''`.
  - `linkify(s)` → 글 속 `http(s)` 주소(`safeUrl(…,'link')` 를 지난 것)만 `<span class="ext-link" data-url="…">` 칸으로, 나머지는 `text`. `<a href>` 가 아니라 눌러도 앱 화면이 안 넘어간다 — 부르는 쪽 클릭 처리가 `data-url` 을 다시 `safeUrl` 로 거른 뒤 `companion.openBrowser`. 문장 끝 `. , ; : ! ? ) ]` 는 주소에서 뺀다. 지금 쓰는 곳: 🐞 버그제보 게시판 본문 · 답변 · 답글.
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

## `person-name.js` — 🏷️ 사람 이름을 화면 글로

- **책임**: 서버가 준 사람 이름(문자열 | `null` — 우리 화면 모양에서는 `''` 로도 온다)을 화면 글로 바꾸는 한 곳. 이름이 없으면 **그리는 순간에만** «이름 없음». 서버 · 이 PC localStorage(`tw.userName`) · 방에 보내는 값에는 «이름 없음» 을 적지 않는다 — 이름의 주인은 서버 계정이다(방 이름 · 레벨도 서버가 채운다 · realtime pv 4). 서버가 모르는 사람(탈퇴 · 옛 기록)은 서버가 «알 수 없음» 글자로 주므로 그대로 그린다. 사용자가 이름을 «나» 로 저장했으면 그것은 진짜 이름이라 «나» 로 그린다.
- **쓰는 법**: 만들지 않는다. `TwPersonName.shown(name)` → 앞뒤 공백을 trim 한 이름 · 없으면 `TwPersonName.NO_NAME`(«이름 없음»). html · `checks/smoke.js` PRELOAD 에서 쓰는 모듈 · app.js 보다 먼저 싣는다. 이름을 HTML 에 넣을 땐 이 값을 다시 `TwSafeHtml.text` 로 씻는다.
- **지금 쓰는 곳**: 내 이름(`getDisplayName` — app.js) · 방 좌석(`room-entry.js` 좌석 `friendName` · 이름표) · 대화 줄 · 복사 · 저장 · 같이 듣기 · 스티커사진 자리 · 방 초대 팝업 · 친구 목록 · 친구 요청 · 선물함 · 말랑이 선물 창 · 방명록 · 일정 태그 · 플레이리스트 · 버그 게시판 글쓴이 · 관리자 신고 · 라이선스 요청 목록.
- **함정**: 받는 쪽(`*-api.js` · `*-rt.js`)에서 «이름 없음» · «친구» 같은 placeholder 를 새로 만들지 않는다 — name 필드는 `''` 그대로 두고 그리는 곳이 이 함수를 부른다. 입력 필드(내 이름 고치기)에는 `getUserName()`(이름이 없으면 빈칸)을 넣는다 — «이름 없음» 을 넣으면 진짜 이름으로 저장된다.
- 검사: `checks/sim-person-name.js`.

## `drag-scroll.js` — 🖱 목록을 마우스로 끌어 움직이기

- **책임**: 스크롤바를 숨긴 목록을 왼쪽 버튼으로 끌어 위아래로 움직인다(휠은 브라우저가 그대로). 도메인을 모르는 DOM 도우미.
- **쓰는 법**: `TwDragScroll.attachDragScroll(el)` — 한 요소에 한 번(두 번 불러도 한 번만 건다 · 요소가 없으면 넘어간다). 스크롤바 숨김은 css(`scrollbar-width:none` · `::-webkit-scrollbar{display:none}`)로 따로, 끄는 중엔 `.dragging` 이 붙는다(커서 · 글 선택 막기).
- **지금 쓰는 곳**: 📩 우편함 우편 · 소식 목록(`myhome-ui.js` — `#mhInboxList` · `#mhNewsList`).
- **빼는 곳**: `attachDragScroll(el, { skip: '선택자' })` — 거기서 누르면 끌기를 시작하지 않는다(우편함은 펼친 본문 `.mh-ibx-body` · 링크 `a` — 글자를 끌어 골라 복사할 수 있게).
- **함정**: `DRAG_PX`(5) 아래로 움직이면 누르기 — 항목 열기 클릭은 그대로. 넘으면 끌기 — 손을 뗄 때 나는 클릭은 막는다(끌다가 엉뚱한 글이 안 열리게). 누를 때마다 끌기 표시를 지운다(목록 밖에서 떼 클릭이 안 난 끌기 뒤에도 다음 클릭이 먹게).
- 검사: `checks/sim-drag-scroll.js`.

## `idle-gate.js` — 😴 할 일 없는 반복 재우기

- **책임**: 창이 닫혀 있어 결과가 화면 · 저장 · 서버에 닿지 않는 동안 반복(rAF · 짧은 주기 타이머)을 재우고, 다시 열리면 다음 틱에 건다. 판단(돌 때인가)과 할 일은 부르는 쪽이 넘긴다 — 도메인을 모른다.
- **쓰는 법**: `TwIdleGate.rafWhile({ isOn, frame, sleep, raf })` · `TwIdleGate.intervalWhile({ idle, step, ms, setInterval, clearInterval })` — 둘 다 `{ wake, running }` 을 돌려준다. 깨우기는 `TwIdleGate.onClassChange(el, fn)`(class 변화 — 여는 길이 여럿이어도 한 곳). html 에서 쓰는 모듈보다 먼저 싣는다.
- **지금 쓰는 곳**: 런처 미리보기(`launcher-preview.js` `startLauncherLoop` — `#launcher.on`) · 꾸미기 미리보기(`wardrobe.js` — `#wdPreviewPanel.on`) · 플레이리스트 재생 창 사각형 폴링(`playlist.js` — `#myPlaylistBox` 가 `.hidden` 이고 off 를 보낸 뒤).
- **함정**: 재우는 조건에 «마지막 결과를 이미 보냈다» 를 넣는다(플레이리스트는 닫힌 뒤 off 를 한 번 보내고 잔다) — 닫히자마자 자면 마지막 IPC 가 빠진다. 안 보여도 돌아야 하는 것(하트비트 · 자리비움 판정 · 포커스 기록 · rAF 멈춤 감시 · 백색소음)에는 쓰지 않는다.
- 검사: `checks/sim-idle-gate.js` · 쓰는 곳은 `sim-launcher-preview` 5절 · `sim-wardrobe` 5절 · `sim-playlist` 7-2절.

## `mac-tooltip.js` — 💬 맥 설명 말풍선

- **책임**: 맥에서 마우스를 올리면 뜨는 설명(`title`)을 앱이 직접 그린다. 실행 화면 창이 «항상 위»(`overlay-mac.js` `TOP_LEVEL`)라 맥 OS 툴팁이 그 뒤로 깔려 안 보이기 때문이다. 윈도우는 OS 툴팁이 맨 위라 걸지 않는다.
- **쓰는 법**: 메인 창은 없다 — 싣기만 하면 맥에서 스스로 건다(`install(document, window)`). 화면 코드는 예전처럼 `title=` · `.title =` 를 쓴다. 따로 여는 창(방명록 · 디자인 스튜디오)은 `d.write` · `d.close` 뒤에 `installChild(창 문서, 창)` — 메인과 같은 «항상 위» 단계(`TOP_LEVEL`)라 같은 일이 생긴다(맥 창이 아니면 안 건다 · app.js 가 deps `installMacTip` 으로 넘긴다). 내놓는 것 `TwMacTooltip.isMac(navigator)` · `place(…)` · `install(doc, win)` · `installChild(doc, win)`.
- **어떻게**: 올리면 `title` 을 `data-tw-tip` 으로 잠시 옮기고(OS 툴팁이 안 뜨게) 450ms 뒤 `#twMacTip`(토스트와 같은 «쪽지» 모양 · z-index 10000)에 같은 글을 그린다. 말풍선 css 는 이 모듈 한 곳에 두고 거는 문서마다 `<style id="twMacTipCss">` 로 넣는다(자식 창은 메인 HTML 의 style 을 못 본다). 나가면 `title` 을 되돌린다. 누르기 · 휠 · 키 · 창 떠남은 말풍선만 접는다.
- **함정**: 올려 둔 동안 그 요소의 `title` 은 비어 있다 — 그 사이 코드가 `title` 을 새로 쓰면 그 값을 살린다(되돌릴 때 덮지 않는다). 빈 `title` 은 건드리지 않는다.
- 검사: `checks/sim-mac-tooltip.js`.
## `panel-fit.js` — 📐 아래 기준 창을 화면 안으로

- **책임**: 기준점이 창의 아래 가운데인 창(`transform: translate(-50%,-100%)`)의 기준점을, 창 전체가 화면 안에 들도록 옮긴다. 순수 함수 · DOM 없음.
- **쓰는 법**: `TwPanelFit.fitBottomCenter(x, y, 창너비, 창높이, 화면너비, 화면높이, 여유)` → `{ x, y }`. 화면보다 큰 창은 위(제목줄)를 살린다 — 아래는 창 안 스크롤로 보지만 제목줄이 잘리면 끌 수도 닫을 수도 없다.
- **지금 쓰는 곳**: ⚙ 설정창 — 머리 위 자동 배치(`status-chip.js`) · 끌어 옮기기 · 끈 뒤 크기가 바뀔 때(`settings-panel.js` — 탭을 바꾸면 위로 자란다).
- **함정**: 함수만으로는 화면보다 긴 창을 못 넣는다 — 창 높이 상한(css `max-height: calc(100vh - 16px)`)과 안쪽 스크롤(`.fs-body{overflow-y:auto}`)이 짝이다.
- 검사: `checks/sim-panel-fit.js`.

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

**책임** — 금칙어 목록 맞추기(`cleanBannedList`)와 판정(`hasBannedWord` — 글자만 남기고 소문자로 맞춘 뒤 부분 일치). 앱(방 만들기 · 방 설정 · 방 안 제목 · 최근 방 제목)이 이 판정을 쓴다. 방 목록 로비에서는 realtime 서버가 같은 규칙(서버 `realtime/src/domain/bannedWords.ts`)으로 한 번 더 거른다.

**만드는 법** — 앱에서는 classic script(`window.TwBannedWords`), 검사(node)에서는 `require`. 판정 규칙을 바꾸면 realtime 서버의 판정도 같이 고친다(서버 `tests/lobby.test.ts` 가 이 파일의 결과와 견준다).

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
- 검사: `checks/sim-input-diag.js`(mutation test 열).

## `image-bytes.js` — 🖼 data: 그림 → 올릴 바이트

- **책임**: 화면이 줄여 만든 `data:image/…;base64,…` 그림을 Storage 바로 올리기(`own-image.js`)가 올리는 바이트로 푼다. 풀기 · 종류 · 빈 그림 · 크기 판정이 말랑이 · 일정 카드 · 박수 그림 provider 에 세 벌 있던 것을 한 곳으로 모았다.
- **쓰는 법**: provider 가 `deps.imageBytes`(app.js 가 `TwImageBytes` 를 넘김)로 받아 `inspect(dataUrl, { types, maxBytes })` → `{ ok: true, type, bytes }` 또는 `{ ok: false, why: 'format' | 'empty' | 'large' }`. 종류 · 상한 값은 부르는 쪽(provider `LIMITS` · `IMAGE_TYPES`)이 정한다 — 여기엔 숫자를 두지 않는다.
- **내놓는 것**: `parseDataUrl` · `inspect`. 순수 — 아무것도 부르지 않는다.
- **함정**: 상한과 같은 크기는 통과(초과만 `large`). 서버 상한이 바뀌면 값은 각 provider `LIMITS` 한 곳씩.
- 검사: `checks/sim-image-bytes.js`.

## `own-image.js` — 🖼 내 그림을 Storage 내 폴더에 바로 올리기

- **책임**: 마이홈(책장 책등 포함) · 디데이 카드 · 박수 · 말랑이 그림의 경로 이름(`users/{내 코드}/{mh|dday|clap|mallang}_{무작위 id}.{png|webp|jpg}`)과 올리기 한 번. 이름 머리 · 형식 · 상한은 서버 URL 검사 · Storage 규칙(이름마다 형식 · 상한)과 같다.
- **deps**: `myCode()`(서버가 준 내 코드) · `newId()` · `put(path, bytes, contentType)` → `{ done: Promise<주소>, cancel() }`(firebase-init `putOwnFile`) · `later(fn, ms)` → 해제 함수 · `owner()` → 지금 로그인 uid(`firebaseAPI.authCurrentUid`).
- **내놓는 것**: `window.TwOwnImage` — `KINDS` · `TIMEOUT_MS` · `pathOf` · `createOwnImage(deps).upload(kind, img, { expectOwner })`. 형식 · 크기 판정은 부르는 provider 가 `image-bytes.js` 로 먼저 한다.
- **함정**: 읽은 토큰 주인(`expectOwner`)이 지금 로그인과 다르면 요청 없이 `OWNER_CHANGED`(경로의 코드가 지금 계정 것이라 규칙은 계정 바뀜을 못 막는다). 코드가 없으면 `NO_USER`, Storage 거절(주인 아님 · 상한) · 닿지 못함 · 10초 넘음(`cancel()`) · 빈 주소는 `IMAGE_UPLOAD` 로 던진다(원인은 `cause`). 0.13 앱이 쓰는 서버 endpoint(`POST /v2/me/images`)는 서버에 남아 있다.
- **함정**: 주소 받기(`getDownloadURL`) 도중 10초를 넘기면 파일은 이미 올라가 Storage 에 남는다(아무 칸도 가리키지 않음) — 탈퇴 때 서버가 폴더째 지운다.
- 검사: `checks/sim-own-image.js`.

## `request-id.js` — 🔁 요청 번호(requestId)

- **책임**: 새것을 만들거나 쌓는 쓰기(뽑기 · 선물 · 지급 · 초대 · 글 쓰기 · 대화 보내기)에 싣는 `requestId` 를 만든다 — 서버 규칙 `^[A-Za-z0-9_-]{8,64}$`(uuid). 서버는 같은 사람 · 같은 번호를 «처음 결과를 다시 돌려주기» 로 받는다(10분).
- **쓰는 법**: 한 번 보내고 끝 — `body.requestId = TwRequestId.newId()`. 닿지 못해 다시 보낼 수 있는 일 — `const ids = TwRequestId.createPending()` 을 모듈에 하나 두고 `ids.idFor(키)`(같은 키는 같은 번호) → 답을 받으면(성공이든 서버 거절이든) `ids.settle(키)`.
- **내놓는 것**: `PATTERN` · `isValid` · `newId` · `createPending({ newId?, max? })` → `{ idFor · settle · has · size }` · `createIdMaker({ crypto, random })` · `uuidFrom(bytes)`.
- **함정**: 다시 보낼 때 새 번호를 만들면 서버가 새 일로 받아 두 번 된다(뽑기 두 번 · 선물 두 번). 끝난 일을 settle 하지 않으면 다음 일이 옛 번호로 가서 서버가 옛 결과를 돌려준다. 끝내지 않은 키는 `PENDING_MAX` 까지만 기억한다.
- 검사: `checks/sim-request-id.js`.

## `device-id.js` — 🖥️ 이 기기 id(`tw.deviceId`)

- **책임**: 서버가 프리미엄을 «이 기기» 로 판정할 때 쓰는 기기 칸 이름 하나. 로그인 API 요청 머리 `X-Device-Id`(api-client.js 가 붙인다)와 realtime `hello.deviceId` 에 같은 값을 싣는다. 신원이 아니다(신원은 로그인 토큰뿐).
- **쓰는 법**: `TwDeviceId.store.get()` — 처음 부를 때 한 번 만들어(`TwRequestId.newId` · uuid) `localStorage` 에 두고, 그 뒤로는 저장값. 저장값이 모양(`^[A-Za-z0-9_-]{8,64}$`) 밖이면 새로 만들어 덮는다.
- **함정**: 계정을 바꿔도 **지우지 않는다**(계정 전환 지움 목록에 넣지 말 것) — 값이 바뀌면 같은 PC 가 등록 기기(서버가 정한 상한)를 하나 더 차지한다. 저장이 막힌 PC 는 실행마다 다른 기기로 보인다.
- 검사: `checks/sim-device-id.js`.

## `api-client.js` — 🌐 앱 공통 API 통로(`/v2`)

- **책임**: fetch · 시간 제한 · 봉투 풀기 · 실패 한 모양(`ApiError` kind · code · items · retryAfterMs) · 토큰 · 기기 머리 · ETag(304) 를 한 곳에서. 앱 오류 번호로 바꾸는 표는 `api-errors.js`.
- **쓰는 법**: 로그인 없는 읽기는 `TwApi.client.get(path, { cacheMs })`. 로그인 길은 `TwApi.authed` — `get(path, { auth: true, onOwner? })` · `post · put · patch(path, body)` · `del(path)`(쓰기는 로그인이 기본). 도메인 provider 는 app.js 가 만들 때 `api: TwApi.authed` 로 받는다(firebaseAPI 를 거치지 않는다).
- **ETag**: 응답에 ETag 가 있으면 값과 함께 기억했다가 다음 읽기에 `If-None-Match` — 304 면 기억한 값. 로그인 읽기는 토큰 주인(sub)마다 따로 기억한다. 계정을 놓을 때 `clearCache()`.
- **서버 쓰기는 읽은 토큰 주인과 묶는다**: 읽은 값을 고쳐 올리는 provider 는 읽을 때 `get(path, { auth: true, onOwner })` 로 토큰 주인을 기억하고, 쓸 때 `put(path, body, { expectOwner })` 를 싣는다. 보내기 직전 쓸 토큰의 주인이 다르면(그 사이 로그인한 사람이 바뀜) 통로가 보내지 않고 `OWNER_CHANGED`(요청 0)로 끝낸다 — 앞 계정 값이 새 계정 토큰으로 나가 덮어쓰는 길을 막는다. 다른 묶음의 «읽고 고쳐 쓰기» 도 이 규칙을 따른다.
- **토큰**: `TwApi.authed` 의 토큰은 firebase-init.js 가 `TwApi.bindToken(_getIdToken)` 로 잇는다. 로그인 읽기는 토큰을 요청당 한 번만 받고(시간 제한과 겨룸 — 멈춰도 `TIMEOUT`) 그 토큰으로 보낸다. 401 `AUTH_REQUIRED` 면 새 토큰으로 한 번만 다시 — `USER_CODE_NOT_BOUND`(가입 전)는 다시 안 한다.
- **길 없는 404 = 앱 버그**: 서버에 그 길 자체가 없는 404(`NOT_FOUND` · `DATA_ROUTE_NOT_FOUND` · code 없음)는 kind `noRoute` 다. 쉬기(30초 BACKOFF)에 넣지 않는다 — 같은 통로의 `GET /v2/config`(점검 판정)가 막히지 않게. 그 요청만 실패하고 `console.error` 가 남으며 `api-errors.js` 가 E-NET-09 로 알린다. 자원이 없다는 404(`USER_NOT_FOUND` 등)는 그대로 `request`. 앱이 부르는 길이 서버에 있는지는 `checks/sim-api-routes.js` 가 본다.
- **멈춤 gate(로그인 통로만)**: `TwApi.authed` 는 서버가 답을 못 하면(5xx · 시간 초과 · 네트워크 · notReady · 봉투 아님) 다음 요청을 바로 보내지 않고 `GATE_MS`(1 · 2 · 4 · 8초 · 실제는 [base/2, base] 로 흩음(jitter) · 동시 실패는 한 번으로 셈)를 기다렸다 보낸다. 성공하면 풀린다. 429 + `Retry-After` 면 그 요청(method + path)만 그때까지 보내지 않고 곧장 429(`retryAfterMs` = 남은 시간 · 상한 `RETRY_AFTER_MAX_MS`)로 끝낸다 — 서버 요청 제한은 endpoint(method + path)마다라 다른 endpoint 는 막지 않는다. Retry-After 없는 429 는 1 · 2 · 4 · 8초 멈춤. 다시 묻는 쪽(로그인 흐름 `retryNow` · 기기 등록 등)은 따로 흩지 않는다(이 한 곳). 공용 읽기 `TwApi.client` 는 gate 없이 그대로 30초 쉬기. 남은 시간은 `gateLeftMs()`. 계정을 놓을 때 `forgetSession()` 이 멈춤 · 429 막힘도 비운다.
- **함정**: 쓰기는 다시 보내지 않는다(통로가 알아서 재시도하지 않음) — 다시 보낼 일은 부르는 쪽이 같은 `requestId`(request-id.js)로. 읽기 시간 제한(`TIMEOUT_MS`)은 짧다 — 본문이 큰 읽기는 `timeoutMs` 를 넘긴다. 실패해도 다른 길로 넘어가지 않는다(부르는 쪽이 오류 번호로 드러낸다).
- 검사: `checks/sim-api-client.js`.

## `api-errors.js` — 🧭 서버 오류 봉투 → 할 일 · 오류 번호

- **책임**: api-client.js 의 `ApiError`(서버 봉투 code · 통로 kind)를 «할 일 + 오류 번호» 로 바꾸는 표 한 곳. 공통 code 만 여기 — `AUTH_REQUIRED` · `NO_TOKEN` → `login`(E-NET-01) · `USER_CODE_NOT_BOUND` → `signup`(토스트 없음) · `SERVER_ADMIN_ONLY` → `maintenance`(토스트 없음) · `ACCESS_DENIED` · `PREMIUM_REQUIRED` → `notice` · `TOO_MANY_REQUESTS` → `later`(`retryAfterMs`) · `CONCURRENT_UPDATE` → `refetch` · 모양 오류 → `notice` · 길 없는 404(`noRoute`) → `notice`(E-NET-09) · 닿지 못함 → `offline`(E-NET-07) · 그 밖 → `notice`(E-NET-08).
- **쓰는 법**: `const t = TwApiErrors.store.notify(err, 내 표)` → `{ code, action, retryAfterMs, items }` 를 받아 화면을 고른다(로그인 화면 · 점검 창 · 다시 받기는 부르는 쪽 몫). 번호 없이 판단만 — `TwApiErrors.translate(err, 내 표)`.
- **기능 표**: `{ GIFT_DAILY_LIMIT: { action: 'later', notice: (notifyError, e) => notifyError('E-MH-..', e, e.message) } }` 모양으로 그 묶음 파일에 둔다 — 번호는 error-codes.js 표에 먼저 넣고 글자 그대로. 기능 표가 공통 표보다 먼저다.
- **함정**: 서버 message 는 사용자 문구로 써도 되는 곳만 셋째 인자로(선물 · 하루 상한처럼 숫자가 든 것). 공통 표에 기능 code 를 더하지 않는다 — 같은 code 를 기능마다 다르게 다룰 수 있어야 한다.
- 검사: `checks/sim-api-errors.js`.

## `remote-config.js` — ⚙️ 원격 설정(`GET /v2/config` 하나)

- **책임**: 운영 값(방 상한 · 정원 · 방 연결 시간 · 앱 · 방 최소 버전 · 금칙어 · 초대 게이트 · 제보 · 박수 · 선물 하루 상한)을 서버 `GET /v2/config` 한 곳에서 받아 칸마다 씻어 둔다. 못 받으면 이 PC 저장값(2판) → 기본값. Firebase config 칸은 읽지 않는다.
- **쓰는 법**: `TwRemoteConfig.store` — `maxPeople()` · `roomLimitOf(채널)` · `inviteGate()` · `roomServerTiming()` · `minAppVer()` · `minRoomVer()` · `bugDailyMax()` · `bannedWords()` · `clapDailyMax()` · `giftDailySendMax()` · `onChange(fn)` · `ready(_, ms)` · `refresh({ maxAgeMs })`.
- **다시 읽기**: 5분마다 · 창이 다시 보일 때(1분 넘었으면) · realtime 알림 `config`(rt-hub.js — 서버가 바꿨다 · 오래 끊겼다 붙음). 같은 값이면 API 통로가 ETag 304 로 받는다.
- **얇은 자리**: `existingSignup()` 은 0.13 설정에 칸이 없어 옛 기본값(켜짐)만 돌려준다 — 계정 묶음이 가입 흐름을 서버로 옮기며 걷는다.
- **함정**: 최소 버전은 저장값을 쓰지 않는다(지난 값으로 막지 않게). 옛 판(평평한 칸)이 남긴 저장값은 판 표시가 없어 읽지 않는다. 칸 이름(`roomMaxPeople` 등)은 앱 안 이름이라 서버 이름과 다르다 — 풀기는 `fieldsOf` 한 곳.
- 검사: `checks/sim-remote-config.js`.

## `update-flow.js` — 🔄 켤 때 업데이트 흐름(업데이트 창 → 공지 창 → 로그인)

- **책임**: 로그인보다 먼저(계정 없이) 최소 버전(`minVersion.app` — `GET /v2/config`)과 새 판(main.js electron-updater)을 보고 창을 띄운다. 강제(내 버전 < 최소)는 [업데이트] 만 · 닫기 없음 · 로그인으로 넘어가지 않음. 선택(새 판 있음)은 [업데이트] [나중에](버전만 보임). 그 뒤 안 본 업데이트 공지 창, 그 뒤 로그인. 아무것도 없으면 바로 로그인.
- **만드는 법**: `TwUpdateFlow.createUpdateFlow({ readMin, getMin, onMinChange, getVersion, companion, ui: TwUpdateFlow.createUpdateDom(document), noticeOnce, showNotice })` — app.js 가 초대 게이트(`initInviteGate`) 앞에서 만든다. 오류 번호 없음(못 읽으면 막지 않고 넘어간다).
- **내놓는 것**: `runBeforeLogin()`(→ `{ proceed, stage }` — 강제면 `proceed:false`) · `press(action)` · `whenStageDone(fn)`(런처 «재시작하면 업데이트» 띠를 단계가 끝난 뒤에 걸기) · `isForced()` · `current()` / 순수 함수 `parseVer` · `isBelow` · `stageOf(my, min, latest)` · `viewOf`.
- **켜 둔 동안**: 원격 설정이 `minVersion` 이 바뀌었다고 알리면(`onMinChange` — 서버 신호) 바로 강제 창. 새 주기 요청은 없다. realtime 서버가 통신 판이 다르다고 닫으면(4003) `forceProtocol()` — 최소 버전 없이 «서버와 맞지 않아» 강제 창(`realtime/rt-status-ui.js` 가 부름). 계정이 더 새 판을 쓰는 기기가 있다고 서버가 답하면(`account/app-version-sync.js`) `forceAccount(highest)` — «다른 PC 에서 더 새 버전을 쓰고 있어요» 강제 창(이미 강제 창이면 그대로).
- **켜 둔 동안 다시 확인 · 끌 때 설치(윈도우 · 맥 · main.js — 판단은 `apps/desktop/update-platform.js`)**: main 이 4시간 + 0~1시간(사람마다 늦춤을 달리 둬 모두가 같은 때 GitHub 에 묻지 않게)마다 `startUpdateCheck` 를 조용히 부른다(`apps/desktop/update-recheck.js` — 새 창 · 물음 없음 · 확인 · 받는 중이면 그 차례는 건너뜀(같은 상태로 2차례 넘게 멈춰 있으면 다시 묻는다) · 다 받으면 멈춤 · 이 확인의 실패는 오류 파일에 한 번만). 새 판이 있으면 백그라운드로 받고 다 받으면 위 런처 띠가 뜬다. 받아 둔 판은 사용자가 앱을 끌 때(제목줄 × · Alt+F4 · 내 정보 끄기 — 모두 `app.quit` → `_quitHold` 가 렌더러 저장을 끝낸 뒤 `quit`) electron-updater 가 조용히 설치한다(`autoInstallOnAppQuit` · 다시 켜지 않음). 쓰는 도중에는 설치하지 않는다. 윈도우 세션 종료(메인 창 `query-session-end` 에서 설치를 끄고 `session-end` 에서 `_exitNow` — Electron 은 이 신호를 창 이벤트로만 준다) · 중복 실행 정리(`_exitNow`) · 계정 재시작(`relaunchApp`)은 사용자가 끈 것이 아니라 설치를 건너뛰고 다음에 끌 때 설치한다. 모든 사용자(Program Files)로 설치한 PC 는 끌 때 설치를 켜지 않는다 — 설치 폴더에 쓸 수 없어 UAC 창이 뜨기 때문(켤 때 `installDirWritable` 이 실행 파일 옆에 시험 파일을 만들어 본다 · `fs.access` 는 윈도우에서 믿을 수 없다). 그 PC 는 예전처럼 띠의 [재시작] 으로만 설치한다. [재시작] 은 예전처럼 바로 설치. 맥(Squirrel.Mac)은 다 받는 즉시 설치 준비를 끝내 어떻게 꺼지든 설치되므로, Squirrel 이 설치 준비를 끝낸 판(electron `autoUpdater` 의 `update-downloaded`)이 있는 재시작은 relaunch 대신 «설치하고 다시 켜기» 로 간다(`_relaunchOrInstall`) · `.app` 이 든 폴더에 못 쓰면 끌 때 설치를 켜지 않는다(그 맥의 [재시작] 은 Squirrel 이 관리자 암호를 묻거나 실패할 수 있다) · 응용 프로그램 폴더 밖이면 처음 한 번 옮기기를 묻는다. 검사 `checks/sim-update-recheck.js` · `checks/sim-update-platform.js`.
- **함정**: 켤 때 첫 확인은 main 이 혼자 하지 않고 이 모듈이 켤 때 `companion.checkUpdate()` 로 묻는다(구독을 건 뒤라 답을 놓치지 않음). 답이 `UPDATE_WAIT_MS` 안에 없으면 «없음». 실패 뒤 혼자 되풀이하지 않고 강제 창 [다시 시도] 를 누를 때만 다시 묻는다. 맥도 윈도우와 같은 길이다(0.14 부터 Developer ID 서명 · 공증 — 그 전 맥 앱은 다운로드 페이지 안내).
- 검사: `checks/sim-update-flow.js`.

## `account-store.js` — 🗂️ 계정별 로컬 칸(`tw.u.<계정코드>.<이름>`)

- **책임**: 이 PC 에 남기는 값 중 «그 계정의 것» 을 계정별 칸에 둔다. 같은 PC 에서 계정을 바꾸면 다른 칸이 열릴 뿐이라 계정 전환 때 지우기 · 넘기기 판단이 없다(#582). 계정 데이터 자체는 0.13 부터 서버가 원본 — 여기는 PC 에 남는 값(미러 · 오늘치 · 마크 · 취향 · 캐시)만.
- **만드는 법**: `const accountStoreMod = TwAccountStore.createAccountStore({ storage: localStorage, getAccountCode: getMyUserId, isWriteLocked: ()=>acctStateMod._acctDetached() });` (app.js `getMyUserId` 바로 뒤). 계정 코드는 **부를 때마다** `getAccountCode()` 로 읽는다 — 값으로 받으면 계정이 바뀐 뒤에도 옛 칸을 쓴다. 쓰는 모듈은 deps 로 받는다(`focusTotalStore` · `focusLevelStore`), 마이홈 바탕화면(`myhome-desktop.js`)은 app.js 의 전역 이름 `accountStoreMod` 를 `advStore` 로 받는다.
- **내놓는 것**: `get(key)`(글자 또는 null) · `set(key, value)`(true / false) · `remove(key)`(true / false) · `open(code)` · `close()` · `migrateLegacy(code)` · `asStorage()`(Storage 모양 — 닫혀 있으면 읽기 null · 쓰기는 `AccountStoreRefused` 를 던진다. 저장소를 값으로 받는 모듈용) · 표 상수 `DEVICE_KEYS` · `ACCOUNT_KEYS` · `ACCOUNT_KEY_PREFIXES` · `MOVED_KEYS` · `MOVED_KEY_PREFIXES` · `isAccountKey`.
- **로그인 전(코드 없음 · 모양 밖)**: 읽기 null · 쓰기 false · 지우기 false. PC 공용 칸으로 돌려 쓰면 그게 섞임의 뿌리다. 쓰는 쪽은 false 를 «저장 안 됨» 으로 본다(로그인 전엔 남길 계정 값이 없다).
- **계정을 놓은 틈**: 로그아웃(wipe)이 `_acctDetached` 를 세운 뒤 재시작 전까지 `set` · `remove` 는 거절된다(코드가 바뀐 뒤에도 앱이 도는 동안 다른 계정 칸을 덮지 못하게 — 판단은 `isWriteLocked` 한 곳). 읽기는 된다. 틈을 통과하는 쓰기 길은 없다 — 0.13 은 로그인해야 쓰므로 «로그인 전 몫을 계정 칸으로 넘기기» 가 없다(옛 PC 칸의 값은 `migrateLegacy` 가 한 번만 옮긴다).
- **기기 공용 키 · 모르는 키는 던진다** — 잘못 쓴 코드를 조용히 넘기지 않는다.
- **`migrateLegacy(code)`**: 이미 깔린 사용자가 0.13 첫 실행 때 PC 칸 값을 그때 로그인한 계정 칸으로 한 번 옮긴다. `MOVED_KEYS` 와 `MOVED_KEY_PREFIXES`(PC 칸을 훑어 접두가 맞는 이름마다 — 한 이름이라도 못 옮기면 그 접두는 «처리함» 에 안 올려 다음에 남은 것만 다시) 만 옮기고(아직 옛 칸을 읽는 키를 옮기면 값이 사라진다) · 계정 칸에 값이 있으면 덮지 않고 · 처리한 키는 PC 칸에서 지우며 · `tw.accountStoreMigrated` 에 처리한 이름을 남겨 두 번 돌지 않는다. 쓰기에 실패한 키는 옛 칸을 지우지 않고 다음에 다시. **부르는 곳 둘**: ① `launcher/app-boot.js begin` — 계정 확인을 통과한 뒤 서버가 확인한 코드로, `open` 직전에 한 번(열기 전에는 칸이 닫혀 있어 먼저 쓴 값이 옮기기를 «kept» 로 막지 못한다 · 계정 칸을 읽는 모듈은 이 뒤 시작에서 읽는다). ② account.js `_detachAccountLocal` — 로그아웃 올리기 · 검문 앞(①에서 못 옮긴 것만 일이 있다 · 두 번째부터는 아무 일도 안 함). 로그인 전 몫을 계정으로 합치는 길은 없다.
- **새 키를 옮길 때**: 그 묶음이 ① 모듈이 `accountStore.get/set` 만 쓰게 ② `MOVED_KEYS` 에 이름 더하기 ③ 아래 표 «옮김» 으로 ④ `account.js` `ACCOUNT_LOCAL_KEYS` 에서 빼기(계정 칸은 지우지 않는다). ⑤ 그 키를 읽고 쓰는 모듈은 시작 전 입구에서 끝낸다(읽기 · 쓰기 · 서버 요청 없이) — 시작 함수는 `launcher/app-boot.js` STEPS 에 칸이 있어야 한다(만들 때 읽지 않는다). deps 이름은 모듈마다 달리(`xxxStore`) — joinRenderer 가 한 범위로 합치므로 `accountStore` 같은 같은 이름이 둘이면 겹친다.
- **함정**: 계정 코드를 정하는 값(`tw.myUserId` 등)은 여기 못 둔다(닭과 달걀). 계정 칸은 로그아웃해도 지우지 않는다 — 같은 계정으로 돌아오면 이어진다. `tw.accountStoreMigrated` 후에 `MOVED_KEYS` 에 키가 늘면 그 키만 새로 옮긴다(그 사이 다른 계정이 먼저 로그인했다면 그 계정이 받는다).
- **열림**: 처음엔 닫혀 있다 — `get` 은 null, `set`/`remove` 는 false 를 돌려주고 키마다 한 번 `console.warn('[계정 칸] 계정 확인 전 접근', 키)`. 계정 확인을 통과한 뒤 `launcher/app-boot.js` 가 `migrateLegacy(그 코드)` 직후 `open(code)` 로 연다(열려는 코드가 지금 `getAccountCode()` 와 다르면 열지 않고 경고 — 열린 뒤 계정 코드가 바뀌면 다시 닫힘으로 돌아간다). 닫힘의 결과는 계정을 놓은 틈(`isWriteLocked`)과 같다. 기기 공용 키는 상관없다.
- 검사: `checks/sim-account-store.js`.

### 키 갈래 표 (localStorage · `tw.` 접두사 — 옛 `deskFriends.*` · `tw_chat_*` 포함)

| 갈래 | 키 | 비고 |
|---|---|---|
| (a) 기기 공용 | `tw.deviceId` · `apiBaseUrl` · `realtimeUrl` · `remoteConfig` · `glReloads` · `renderQuality` · `dotRender` · `figureMode` · `officeMode` · `deskPan` · `focusCharScale` · `chipHorz` · `chipCollapsed` · `nameplate` · `nameplateSize` · `theme` · `accent` · `mockRoom` · `updateNoticeDismissedTs` · `chatFontSize` · `chatOpacity` · `chatSfx` · `chatSfxId` · `listenMute` · `listenVol` · `noise.*` · `pkBgmMuted` · `gapSolo` · `gapMulti` · `roomSeatMode` · `focusLogMini` · `annivAreaH` · `adBanner` · `thumbSigs` · `playlistVol/Mini/Loop*/Pos` · `demojiSfx` · `firstRun013`(값이 계정 코드) · `me`(서버 확인 답 사본) · `glRelaunchAt` · `accountStoreMigrated` · `leftNotice`(로그아웃 · 탈퇴 뒤 다시 켠 로그인 화면이 한 번 보일 안내의 까닭 — 읽으면 지운다) · `tw_chat_win_pos` · `bellWinPos` · `gachaWinPos` · `wdPreviewPos` · `ideskInvPos` | 이 PC 의 성질(창 자리 · 화질 · 소리 · 모양 취향). 계정을 바꿔도 그대로 |
| (a') 신원 · 로그인 | `tw.myUserId` · `loginEmail` · `loginAuthUid` · `myFriendCode` · `myFriendCodePrev` · `myPrevUserIds` · `invitePassed` · `inviteToken` · `signupPending` · `licenseKey` · `licenseOptOut` · `licenseFullNoticed` · `licenseReqId` | 계정 코드를 정하는 쪽이라 계정 칸에 둘 수 없다. 0.13 에서 서버 로그인 토큰으로 대체될 것은 계정 묶음(B) 몫 |
| (b) 계정별 — **옮김(이번 PR)** | `focusTodaySec` · `focusTodayDate` · `pomo` · `pomoRun`(뽀모도로 — `pomodoro.js`) · `mobileKey`(폰 연결 키 — `focus-level.js`) · `advZ.v2`(마이홈 바탕화면) · `advZ.v1`(옛 판 읽기 전용) | #582 에서 섞이던 것. 모듈: `focus-total.js` · `focus-level.js` · `myhome-desktop.js` |
| (b) 계정별 — 포커스 | `focusPendingSec`(서버에 아직 못 올린 집중 시간 — `focus-progress.js`) · `focusShow` · `pomo` · `pomoRun` · `bonkDay` · `dailyPlay.*` | 포커스 · 뽀모 묶음이 옮김. 옛 `focusTotalSec` · `focusSyncedSec` · `starColor` · `danceNotified` · `danceNotifiedFix` · `ideskNotified` 는 서버가 원본이 되어 표에서 뺐고 첫 실행(`first-run-013.js` 포커스 단계)이 지운다 |
| (b) 계정별 — 달성표 | `chalToday`(오늘 진행 — 오늘 앱 사용 초 · 체크 · 반복 횟수 · 오늘 달성을 적었는지. 목표 · 지난 날 · 보상은 서버 한 벌 — `focus/chal-store.js`) | 옛 `chal`(한 벌 통째)은 첫 실행(`first-run-013.js` chal 단계)이 오늘 진행만 옮기고 지운다 |
| (b) **옮김(S-3b)** | `charColorHistory`(`character/wardrobe.js`) · `activeInteractionDesk`(`room/interaction-desk.js`) | 둘 다 쓰는 때마다 읽는 키라 모듈이 `accountStore` 를 받아 읽고 쓴다. `MOVED_KEYS` 에 있어 옛 PC 값이 들어간 계정 칸으로 간다. 만들 때 읽는 `curSlot` · `extraSeatSlots` · `decoParts` · `seatEq` · `emojiReactions` 와 동물 카드가 처음 그릴 때 읽는 `animalCheatUnlock` 은 S-4a(`userLocal` 칸)와 함께 |
| (b) **옮김(S-3e 일부)** | `deskPresets`(`creator/desk-preset-store.js`) · `animalPresets`(`character/animal.js`) | 읽고 쓰는 때마다 JSON 칸(`json-store.js`)을 거치므로 app.js 가 계정 칸 위에 얹은 한 벌(`accountJsonStoreMod` = `createJsonStore({ storage: ()=>accountStoreMod.asStorage() })`)을 넘긴다. 계정 칸이 닫혀 있으면 읽기는 빈 칸 · 쓰기는 «저장 못 함» 결과. `MOVED_KEYS` 에 있어 옛 PC 값이 들어간 계정 칸으로 간다. 나머지(`savedDesks` · `savedItems` · `savedParts` · `animalEverUnlocked`)는 만들 때 읽거나 카탈로그 캐시와 한 칸이라 따로 — 확인 전 읽기를 걷는 S-4a 와 함께 |
| (b)+(c) 계정별 · 서버 원본이 될 것 | `gachaOwned` · `gachaOwnedTs` · `gachaBonus`(D 가챠) · `curSlot` · `extraSeatSlots` · `roomFaceUrls` · `slotGlbUrls` · `deskFriends.slots.*`(v1 · ts · seen · loss · lastsync · pushfail · bak · bak.meta) · `deskFriends.chars.*`(v1 · desk · trashPend) · `charsLinked` · `charsMoveFails`(D 캐릭터) · `savedDesks` · `savedItems` · `savedParts` · `decoParts` · `deskPresets` · `animalPresets` · `animalEverUnlocked` · `animalCheatUnlock` · `charColorHistory` · `seatEq` · `activeInteractionDesk` · `emojiReactions` | 서버가 원본이 되면 PC 사본이 필요 없어질 것 — 그 D 묶음이 «지움» 이든 «계정 칸으로 옮김» 이든 정한다 |
| (b) 플레이리스트 | `playlistCur`(지금 고른 목록 번호) · `secretRoomMusic` | 목록 · 한마디 · 공개 · 고친 시각 · 백업(`playlist` · `playlistSets` · `playlistTitle` · `playlistBio` · `playlistHomePublic` · `playlistPrivate` · `playlistEditTs` · `playlistBackup`)은 서버가 원본이라 표에서 걷었다 — 읽는 곳이 없고, 남은 옛 값은 첫 실행(`first-run-013.js` 로그인 단계)이 지운다 |
| (b) **옮김(S-3c)** | `myAdBannerImg`(`launcher/settings-panel.js`) · `secretRoomMusic`(`room/room-entry.js`) · `annivView`(`myhome/scheduler.js`) | 모두 쓰는 때마다 읽는 키라 모듈이 `accountStore` 를 deps 로 받아 읽고 쓴다. `MOVED_KEYS` 에 있어 옛 PC 값이 들어간 계정 칸으로 간다 · 로그아웃 지움 목록에서 뺐다. 만들 때 읽는 `userStatus` · `customStatus` · `awayKind` · `reportHidden` · `playlistCur` 은 확인 전 읽기를 걷는 S-4a(`userLocal` 칸)와 함께 |
| (b) **옮김(S-4a)** | `playlistCur`(`status/playlist.js` `loadLocal`) · `animalCheatUnlock` · `animalEverUnlocked`(`character/animal.js` — `window._animalLoadLocal` 이 읽고 카드 잠금 띠를 다시 그린다) · `userStatus`(app.js · `room/presence.js`) · `customStatus`(`status/user-status-table.js`) · `awayKind`(`room/presence.js`) · `reportHidden`(`room/hidden-seats.js`) · `curSlot`(지금 고른 칸 — app.js) · `extraSeatSlots`(자리 추가 — `launcher/settings-panel.js`) · `decoParts`(꾸미기 파츠 보이기 · `character/deco-parts-visibility.js`) · `seatEq`(좌석 평준화 · `character/seat-equalize.js`) · `emojiReactions`(반응 이모지 · `room/floaters.js`) | 만들 때 읽던 깃발이라 모듈은 처음 값으로 만들고 계정 칸이 열린 뒤 `launcher/user-local.js` 가 `loadLocal` 로 읽어 채운다(`resetLocal` 이 되돌림 · 현재 슬롯은 app.js 조각). 로그아웃 지움 목록에서 뺐다 — 슬롯은 서버가 원본이라 같은 계정이 돌아오면 그 번호가 그대로 맞다. `MOVED_KEYS` 에 있어 옛 PC 값이 들어간 계정 칸으로 간다. 설정 창이 `accountStore` 에 쓴다 |
| (b) 프로필 · 마이홈 | `userName` · `customStatus` · `userStatus` · `awayKind` · `awayImg` · `awaySz` · `myAdBannerImg` · `inboxBcRead` · `noticeBoard`(마지막으로 받은 소식 묶음 — `launcher/notice-feed.js`) · `bellSeenTs` · `reportHidden` · `mobileKey` · `mhRecentColors.<종류>` · `mhGbLastRead:<uid>` · `annivView`(기념일 보기 — 분류만, 옮김은 S-3c) | 마이홈 · 프로필 · 알림함 묶음이 옮김 |
| (b) 대화 — **옮김(S-3d)** | `chatTab.<방>` · `tw_chat_read:<방>` · `tw_chat_join:<방>`(채팅창 `chat-ui.js` — 계정 칸으로 읽고 씀) · `mhRecentColors.<종류>`(`myhome-edit.js`) · `mhGbLastRead:<코드>`(`guestbook-feed.js` 의 읽음 저장소 — `asStorage()` 로 받음) — 접두 키는 `MOVED_KEY_PREFIXES` 로 옛 PC 값이 들어간 계정 칸으로 간다. IndexedDB 대화 기록(`chat/chat-history.js` — 지금 scope 가 프로젝트라 계정 구분 없음) | 채팅 묶음 — IDB scope 에 계정 코드를 넣거나 서버 3일 보관으로 걷는다 |

- `ACCOUNT_LOCAL_KEYS`(`account/account.js`) 대조: 이번에 옮긴 포커스 오늘치 두 줄, 곧 그 목록의 `focusTodaySec` · `focusTodayDate` 를 빼도 된다(계정 칸은 로그아웃해도 안 지우는 게 맞다 — 같은 계정이 돌아오면 이어진다). `advZ` 는 원래 목록에 없었다(그래서 바탕화면이 섞였다). 지우기 · 넘기기 로직을 걷는 것은 #580.

## `session.js` — 🔐 로그인 세션 하나

- **책임**: 로그인(계정 확인 통과)마다 세션을 새로 만들어, 그 로그인에 딸린 타이머 · 구독 · 비우기 훅 · 계정 칸 열림을 한 곳에 쥔다. 로그아웃 · 계정 바뀜은 `dispose()` 한 번 — 전부 멈추고 비운다. 다음 로그인은 새 세션이라 앞 세션의 것을 하나도 이어받지 않는다(껐다 켜지 않고 «앞 사람 것이 안 남는다» 를 장치로 지킨다).
- **만드는 법**: `launcher/app-boot.js` 가 계정 확인 뒤 `deps.newSession(me)` 로 만들어 들고 있다(app.js 가 `TwSession.createSession({ me, openAccountStore, closeAccountStore, timers })` 를 넘긴다). 기능 모듈이 직접 만들지 않는다 — 시작 함수가 `(code, me, session)` 의 세 번째 인자로 받는다(**지금은 받아 쓰는 기능이 없다** — 모양만).
- **내놓는 것**: `id`(세션 번호) · `code` · `me` · `alive()` · `openStore()`(계정 칸 열기 — 한 번만, 못 열면 false) · `setInterval(fn, ms)` / `setTimeout(fn, ms)`(손잡이, 끝난 세션이면 null) · `clearInterval(h)` / `clearTimeout(h)` · `on(unsub)`(구독 해제 함수 맡기기 — 돌려주는 함수로 먼저 풀 수도 있다) · `onReset(fn)`(메모리 비우기 훅) · `ifAlive(fn)`(끝난 뒤엔 안 부르고 undefined 를 돌려주는 래퍼 — 늦게 도착한 답 막이) · `dispose()` · `counts()`(남은 개수 — 검사 · 진단용).
- **dispose**: 먼저 `alive` 를 내리고 → 타이머 clear → 구독 해제(나중에 등록한 것부터) → 비우기 훅(나중 것부터) → 계정 칸 닫기(열었을 때만). 하나가 던져도 나머지는 돈다(경고만). 두 번째부터는 아무 일 없이 false.
- **끝난 뒤 등록**: 타이머는 거절(null), 구독 · 비우기 훅은 바로 한 번 풀고, 모두 콘솔 경고 — 늦은 콜백이 끝난 세션에 쌓이지 않는다.
- **함정**: ① 올릴 것이 남았으면(서버 맞추기 · 검문) `dispose()` 전에 끝낸다 — 이 모듈은 올리지 않는다. ② 타이머 콜백은 `alive` 를 한 번 더 본다(clear 가 먹기 전에 이미 큐에 올라간 콜백도 막기 위해). ③ `await` 뒤에는 `session.alive()` 를 보거나 `ifAlive` 로 감싼다 — 세션 번호(`id`)를 값으로 쥐고 비교해도 된다. ④ 도메인 · 저장소를 모른다(deps 로만) — 계정 칸은 `account-store.js` 가 `open` / `close` 를 내놓는다.
- 검사: `checks/sim-session.js`.

## `leave-flush.js` — 🚪 떠나기 전 저장 기다리기(로그아웃 · 앱 끄기 · 상한 8초)

- **책임**: 로그아웃 올리기(`account/account.js`)와 앱 끄기가 같은 «일 여럿을 돌리고 다 끝나거나 8초가 지나면 돌아온다» 한 벌을 쓴다. 끄기는 main 이 붙잡고 묻는다(`apps/desktop/quit-hold.js` — before-quit 한 곳) — 이 파일이 실릴 때 건 듣기가 더해 둔 일을 올리고 답한다.
- **내놓는 것**: `LEAVE_FLUSH_MAX_MS`(8000) · `flushWithin(jobs)` → `{ timedOut }`(일이 없으면 타이머 없이 바로 · 던진 일도 끝난 것) · `addQuitJob(fn)`(끄기 전에 올릴 일 — app.js 가 옷장을 만든 뒤 더한다). 듣기는 실릴 때 `window.companion.onQuitFlush` 로 건다(preload 가 그때 main 에 «답할 수 있다» 를 알린다 · companion 이 없으면 안 건다).
- **함정**: ① 끄기에서 기다리는 것은 캐릭터(`closet.flushUnsaved`)뿐이다 — 못 올린 고침이 없으면 일이 null 이라 바로 끈다. 집중 시간 · 플레이리스트 등은 다음 켤 때 보내므로 예전처럼 `beforeunload` 에서 기다리지 않고 보낸다. ② main 의 상한(`quit-hold.js` GUARD_MS 9초)은 이 상한보다 길어야 한다 — 렌더러가 멈췄을 때만 걸리게. ③ OS 세션 종료(윈도우) · `_exitNow`(app.exit)는 묻지 않고 바로 끈다. ④ html 에서 오류 기록 바로 뒤 · 다른 스크립트보다 먼저 싣는다 — app.js 가 켜다 죽어도 일 0개로 바로 답하게.
- 검사: `checks/sim-leave-flush.js`.

## `front-diag.js` — 🩺 앞 창 진단(1분 `[프레임]` 줄 끝에 앞 창 · 전체화면 비율)

- **책임**: «앱을 켜 두면 게임 · 영상이 버벅인다» 제보를 진단 기록(`tw-mouse-diag.log`) 한 장으로 가르게, 렌더러가 1분마다 보내는 `[프레임]` 줄 끝에 그 1분 동안 가장 오래 앞에 있던 실행 파일과 그 창이 모니터를 꽉 채운 비율을 붙인다. main 만 싣는다(`module.exports` — 렌더러는 앞 창을 모른다).
- **쓰는 법**: `createFrontWatch()` — 활성 창 폴링(500ms)마다 `note(t, exe, coversDisplay(앞창 bounds, 우리 창 모니터 bounds))`, `companion:diagNote` 가 `isFrameLine(줄)` 이면 `줄 + suffix(take(t))`. 예) `… · 앞 창 Discord.exe · 전체화면 85%` · 표본이 없으면 ` · 앞 창 모름`.
- **함정**
  - 창 제목은 적지 않는다(영상 제목 · 대화 상대 이름) — 실행 파일 이름만.
  - 맥은 앞 창 크기를 안 읽는다(`bounds: null` — node-window-manager 맥 `getBounds` 가 창 목록을 통째로 다시 받고 사전을 놓아주지 않아 0.5초 폴링에 못 쓴다). 크기를 못 읽은 표본은 비율 분모에서 빠지고, 그것만 있으면 `전체화면 모름`.
  - 전체화면은 **크기만** 본다. Windows 의 창 좌표는 그 창 모니터 배율로 나눈 값이라 배율이 다른 모니터가 섞이면 Electron 좌표와 안 맞는다. 최대화 창은 작업표시줄만큼 작아서 안 걸린다.
  - 실행 화면이 아니면 `[프레임]` 줄이 안 와서 `take` 가 안 불린다 — `STALE_MS`(2분)보다 오래된 표본은 다음 `note` 때 버린다.
- 검사: `checks/sim-front-diag.js`(mutation test 열).

## `error-report.js` — 🧯 화면 오류를 오류 기록(tw-error.log)으로

- **책임**: 화면(렌더러)에서 난 잡히지 않은 오류 · 처리 안 된 Promise 거절 · `console.error` / `console.warn` 을 main 의 오류 기록(`apps/desktop/error-log.js` — 파일 `tw-error.log`, 진단 기록과 같은 폴더)으로 보낸다. 줄 모양 · 몰아칠 때 거르기 · 파일 크기는 main 이 정한다.
- **쓰는 법**: 싣기만 하면 `companion.errorLog` 로 스스로 건다 — html 맨 먼저(뒤 스크립트가 실리다 난 오류도 잡게). 에러코드 알림(`TwErrorCodes.notify`)은 스스로 `CODE` 로 보낸다.
- **내놓는 것**: `TwErrorReport.install(win, send, now?)` · `format(args)`.
- **함정**: console 원래 출력은 그대로 둔다 · 에러코드 알림이 찍는 `console.warn('[오류] E-…')` 은 다시 안 보낸다 · 보내다 난 오류가 되돌아 들어오지 않게 막는다 · 같은 줄은 10초 안에 한 번.
- 검사: `checks/sim-error-log.js`.
## `env-diag.js` — 🩺 환경 · 자원 진단(켤 때 `[환경]` · `[GPU 상세]` · 1분 `[자원]`)

- **책임**: «같은 앱이 PC 마다 CPU 가 크게 다르다» 를 진단 기록(`tw-mouse-diag.log`) 두 장으로 가르게, 어떤 PC 인지와 CPU · 메모리를 어느 프로세스가 쓰는지를 남기고, 기록을 돌려 쓸 때 «어떤 PC 인지» 줄을 새 파일에 다시 적는다. main 만 싣는다(`module.exports`). 파일은 받은 io 로만 만진다(검사가 가짜를 넣는다).
- **쓰는 법**
  - 켤 때(GPU 줄과 같이) `envLine({ app, electron, chrome, os, osVer, arch, cpuModel, threads, ramBytes, displays })` → `[환경]` 한 줄. 모니터 해상도는 배율을 곱한 물리 값.
  - 10초 뒤 `gpuDetailLine(getGPUInfo('complete'))` → `[GPU 상세]` 한 줄(실제로 그리는 장치 · directComposition · supportsOverlays · 겹친 그래픽 · 화면 종류 · 그리기 엔진).
  - 1분마다 `createResourceWatch().take(t, app.getAppMetrics(), 우리 창 pid, { cpu: cpuTimes(os.cpus()), freeBytes, totalBytes })` → `resourceLine(r, 논리 프로세서 수, '실행 화면' | '런처' | '숨김')`. 첫 호출은 기준만 잡고 줄을 안 남긴다.
- **함정**
  - CPU 는 `cumulativeCPUUsage`(시작 뒤 쓴 CPU 초)의 차이로 셈한다. `percentCPUUsage` 는 «지난 호출 뒤 평균» 이라 다른 곳이 부르면 구간이 바뀌고, 코어 하나 기준인지 PC 전체 기준인지 문서에 없다.
  - 적는 % 는 모두 **PC 전체 기준**(작업 관리자와 같음) — 우리 앱 몫은 코어 몫 ÷ 논리 프로세서 수, 끝의 «PC 전체 CPU» 는 그 구간 모든 프로그램 합.
  - 같은 pid 가 다시 쓰일 수 있어 «pid + 만든 시각» 으로 알아본다. 그사이 새로 뜬 프로세스는 처음부터 쓴 몫을, 지난번에 못 본 오래된 프로세스는 0 으로 센다.
  - `directComposition` · `supportsOverlays` 는 Windows 에만 온다 — 맥은 «모름».
  - 1분 사이에 죽은 프로세스(닫힌 자식 창 등)가 쓴 CPU 는 빠진다 — 앱 합이 조금 낮게 나올 수 있다.
  - 진단 기록은 256KB 에서 돌려 쓰고, `[자원]` 때문에 반나절이면 돈다. 그래서 `_diagLog` 는 `createHeaderKeep` 으로 `[환경]` · `[GPU]` · `[GPU 상세]` 의 마지막 줄을 기억하고, `rotateKeep` 이 새 파일 첫머리에 «(기록을 돌려 써서 다시 적음)» 을 붙여 다시 적는다. 이게 없으면 오래 켜 둔 PC 의 기록에 사양이 없다.
- 검사: `checks/sim-env-diag.js`(mutation test 열셋).

## `gpu-timer.js` — 🩺 한 장에 그래픽 칩 · JS 시간(1분 `[프레임]` 줄 꼬리)

- **책임**: «노트북에서 켜 두면 블루스크린» · «다른 프로그램이 버벅인다» 제보를 진단 기록(`tw-mouse-diag.log`) 한 장으로 가르게, 실행 화면이 한 장 그리는 데 그래픽 칩 · JS 가 쓴 시간과 그리기 · 그림자 횟수를 1분 `[프레임]` 줄 끝에 붙인다. 렌더러만 싣는다(`window.TwGpuTimer`).
- **쓰는 법**: app.js 가 프레임 예산 옆에서 `createGpuTimer(renderer.getContext(), renderer.capabilities.isWebGL2)` · `createStats()` 를 만들고, 그리기를 `begin()` · `end()` 로 감싸 매 장 `poll()`. 1분마다 `suffix({ gpu: take(), js, calls: renderer.info.render.calls, casters: countCasters(scene) })`. 예) `… · GPU 평균 3.2ms 최대 11.0ms · JS 평균 1.4ms 최대 2.0ms · 그리기 42 · 그림자 31`.
- **함정**
  - 그래픽 칩 시간은 WebGL2 타이머 질의(`EXT_disjoint_timer_query_webgl2`)로 잰다. 답이 몇 장 뒤에 오고, 끊김(절전 · 클럭 변경)이 나면 그 사이 답은 버린다. 확장이 없는 기기는 `GPU 모름` — 0 으로 속이지 않는다.
  - 기다리는 질의는 `MAX_PENDING` 까지만, `STALE_POLLS` 번 거둬도 안 오면 버린다(WebGL 연결 끊김 뒤 옛 질의는 영영 안 끝난다).
  - three.js 는 그림자 지도를 그리는 횟수를 `info.render.calls` 에 안 센다(그림자를 그린 뒤 `info.reset`). 그래서 `그림자` 는 그림자를 드리우는 보이는 메시 수를 따로 센다 — 장면을 다 도니 1분에 한 번만.
  - 재기만 한다 — 그리기 · 상한은 건드리지 않는다.
- 검사: `checks/sim-gpu-timer.js`(mutation test 여섯).

## `run-cost-diag.js` — 🩺 그리기 밖 시간(1분 `[비용]` 줄)

- **책임**: «실행 화면 렌더러가 그리기(`frame()`) 밖에서 초당 수백 ms CPU 를 쓴다(창을 내려도)» 를 진단 기록(`tw-mouse-diag.log`) 한 장으로 가르게, 1분 동안 하트비트(100ms `setCharBounds`) · 클릭 통과 판정 · 받은 방 변경 수 · 좌석 맞춤(`syncFriendSeats`) · 한 장 쪼갬(좌석 반복 · 그리기 · 나머지)을 모으고 좌석 수 · 방 종류와 함께 한 줄로 낸다. 렌더러만 싣는다(`window.TwRunCostDiag`).
- **쓰는 법**: 창 하나에 하나인 `TwRunCostDiag.page` 에 더한다 — app.js(`const runCost = TwRunCostDiag.page` · 하트비트를 `runCost.timed('hb', fn)` 로 감쌈 · 프레임에서 `since('seat'|'render'|'frame', t0)`) · desktop-run.js(deps `runCost` — 기존 `_hitPerf` 자리에서 `add('hit', ms)`) · room-entry.js(deps `runCost` — `presenceChanged` 입구에서 `count('recv')`, 부르는 곳은 `timed('sync', syncFriendSeats)` 를 부른다). 1분마다 `[프레임]` 줄과 같은 자리에서 `take()` → `line(r, countSeats(seats, hiddenSeatsMod._bodyHidden), roomKind(Presence.roomCode(), window._activeChannel, !!Presence.serverProvider()))`.
  예) `[비용] 하트비트 600회 0.42/3.10ms · 통과 1200회 0.08/1.20ms · 수신 340 · 맞춤 340회 합 120 최대 4.20ms · 밖 초당 3.20ms · 한 장 1800 좌석 0.12 그리기 0.80 나머지 0.30ms · 좌석 8 몸 6 반짝 2 · 워킹룸 ws`
  - `n회 a/b` = 횟수 · 평균/최대. `밖 초당` = (하트비트 + 통과 + 맞춤 합) ÷ 초. `한 장` = 그린 장 수와 한 장 평균의 쪼갬. `수신` = 받은 방 변경(방 서버 · Firebase 두 길이 함께 지나는 `presenceChanged`) 수, 끝의 `ws` / `fb` 는 받는 길. `몸` = 넘긴 판단 함수(`hiddenSeatsMod._bodyHidden` — 숨김 · 자리비움)가 «보인다» 고 한 좌석(함수가 없으면 0 — shared 는 room 을 부르지 않는다), `반짝` = `.seat-exp.lvx` 바나 `.np-star` 이름표가 보이는 좌석.
- **함정**
  - main 은 렌더러 진단 줄을 200자에서 자른다(`companion:diagNote`) — 줄은 `LINE_MAX` 안에서 끝낸다. `[프레임]` 으로 시작하지 않아 앞 창 꼬리(front-diag.js)가 안 붙는다.
  - 1분 몫은 실행 화면이 아니어도 비운다(take 를 runmode 확인보다 먼저). 창을 내려도 `runmode` 는 그대로라 그때도 남는다.
  - 재기만 한다 — 함수 본문은 안 고치고 부르는 곳을 감싼다. `timed` 는 던져도 시간을 더하고 그대로 던진다.
- 검사: `checks/sim-run-cost-diag.js`(mutation test 열).

## `system-prompt.js` — 🔐 시스템 확인 창이 맨 앞인가

- **책임**: 맥 앱스토어 «받기» · 관리자 암호 · Touch ID · 시스템 설정 · 설치 프로그램 같은 확인 창이 맨 앞인지 활성 창 키로 가른다. main 만 싣는다(`module.exports`). main 은 이 값이 참인 동안 실행 화면을 «항상 위» 에서 내린다(`_onSysPromptFront` · `_setRunTop`).
- **까닭**: 맥은 확인 창을 다른 앱 창이 덮으면 보안 때문에 그 칸(Touch ID · 암호 · «받기»)을 비워 보여 준다. 실행 화면은 모니터 전체를 덮는 투명 창이라 늘 덮는다(B-1104-10).
- **쓰는 법**: `isSystemPrompt(activeKey)` — 활성 창 폴링(500ms)의 `focusKeyOf` 키(소문자 · `mac:<번들 id>`).
- **함정**
  - 표시 이름(«App Store» · «시스템 설정»)으로 가르지 않는다 — 현지화로 흔들린다. 번들 id 만.
  - 실행 화면 맨 위 설정은 main 의 `_setRunTop` 한 곳 — 창 배치 IPC(수백 번/분) · 표시 설정 변경 · 색 고르기 창 복구도 `_sysPromptFront` 를 봐서 확인 창 위로 되돌리지 않는다. 자식 창(방명록 · 디자인 · 구글 로그인)은 아직 그대로 맨 위다.
- 검사: `checks/sim-system-prompt.js`(mutation test 셋).

## `skeleton-share.js` — 🦴 같은 뼈대는 Skeleton 하나

- **책임**: 같은 뼈 객체를 같은 순서로 쓰고 역행렬 값이 모두 같은 스킨 메시들이 Skeleton 객체 하나를 함께 쓰게 한다. three 는 Skeleton 객체마다 한 장에 한 번 뼈 행렬을 셈하고 뼈 텍스처를 올리는데(`skeleton.frame`), `SkeletonUtils.clone` 과 리깅 파츠 다시 묶기가 스킨 메시마다 Skeleton 을 따로 만들어 같은 뼈를 메시 수만큼 셈했다. 순수 모듈(`window.TwSkeletonShare` + `module.exports`) — three 객체 모양만 안다.
- **내놓는 것**: `sameRig(a, b)` · `shareSkeletons(meshes, anchors)`(anchors 의 Skeleton 은 바꾸지 않고 먼저 맞춰 볼 후보 · 바꾼 메시 수를 돌려줌) · `skinnedMeshesOf(root)`.
- **부르는 곳**: app.js `instantiateBase`(기본 · 커미션 몸 — 기본 몸 4 → 1) · `equipPartOnSeat`(리깅 파츠는 캐릭터 몸 · 다른 파츠와도 맞춰 봄 · 비리깅 스킨 파츠는 자기끼리 · 다중 파츠 사본) · animal.js `buildAnimalBase`(몸 + 얼굴 넷 5 → 1) · purikura-ui.js 무대 복제.
- **함정**
  - `bindMatrix` · `bindMatrixInverse` 는 메시 것이다(셰이더 유니폼 · 광선의 `boneTransform` 모두 메시에서 읽음). 파츠 xf 를 `bindMatrix` 에 구워 메시마다 달라도 함께 쓴다. 뼈 행렬은 «뼈 월드 × 역행렬» 이라 역행렬 값이 하나라도 다르면 따로 둔다(비트가 같은 값만 — `-0` 도 가른다).
  - 복제 · 묶기 바로 뒤, 그리기 전에만 부른다. 그린 적 있는 메시를 옮기면 옛 Skeleton 의 뼈 텍스처가 그래픽 메모리에 남는다.
  - 함께 쓰는 Skeleton 의 뼈 · 역행렬을 바꾸지 않는다는 전제다. 다시 묶을 땐 지금처럼 `bind(new THREE.Skeleton(…))`.
  - r128 광선 판정은 `boneMatrices` 가 아니라 뼈 `matrixWorld` × 역행렬을 바로 셈한다(`boneTransform`) — 함께 써도 판정이 같다.
- 검사: `checks/sim-skeleton-share.js`(진짜 기본 몸 · 동물 GLB 로 옛/새 뼈 행렬 · 스킨 자리 대조 · mutation test 둘).

## `gl-recover.js` · `gl-fail-notice.js` — 🧯 3D(WebGL) 끊김 뒤 복구

- **책임**
  - `gl-recover.js`(순수 규칙 · `window.GlRecover`): 메인 캔버스 WebGL 이 끊겨 6초 안에 안 돌아오면 **앱을 다시 켠다**. 다시 켠 지 10분 안에 또 안 돌아오면 다시 켜지 않고 안내만(무한 재시작 막기).
  - `gl-fail-notice.js`(`window.TwGlFailNotice`): WebGL 을 못 만들거나(처음) · 10분 안 재발일 때 «그래픽(3D)을 불러오지 못했어요» 안내 + [다시 켜기] [앱 끄기] · `E-SYS-05`.
- **만드는 법**: app.js 맨 앞에서 `createGlFailNotice(deps)` → 메인 렌더러를 `glFail.guard(() => new THREE.WebGLRenderer(...))` 로 만든 뒤 `GlRecover.createGlRecover(deps).attach(canvas)`.
- **deps**
  - gl-recover: `log` · `relaunch`(companion.relaunchApp) · `notice`(glFail.show('lost')) · `setTimer` · `clearTimer` · `now` · `store`(localStorage) · `afterRestore`.
  - gl-fail-notice: `doc` · `notifyError` · `note`(diagNote) · `relaunch` · `quit`.
- **함정**
  - 화면만 다시 불러오지 않는다 — GPU 를 잃은 크롬 엔진은 WebGL 을 못 만들어 app.js 가 첫 줄에서 죽고, 런처 바탕이 모니터를 덮었다(B-1114-5). 앱을 다시 켜야 GPU 를 새로 잡는다.
  - 마지막으로 다시 켠 시각(`tw.glRelaunchAt`)은 localStorage — 앱을 다시 켜도 남아야 10분 규칙이 선다. 못 적으면 다시 켜지 않고 안내.
  - 처음 만들기 실패 안내는 뒤의 반쯤 죽은 런처를 덮고, 실행 중 끊김 안내는 모니터를 덮지 않는다(상자만 눌림). 창 크기는 main 이 정한다(launcher/reload-reset.js).
  - 안내는 렌더러를 못 만든 뒤 다시 던진다 — 뒤 코드는 렌더러 없이 돌 수 없다.
  - 검사: `checks/sim-gl-recover.js`(규칙 · 안내를 실제로 돌림 · 연결 · mutation test).

## stage.js — 🎬 3D 무대 한 벌

- **책임**: 메인 캔버스(`#scene`)의 WebGL 렌더러 · 씬 · 원근 카메라 · 그림자 바닥 · GLTF(+DRACO) 로더를 만들어 내놓는다. 만들기만 하고 그리지 않는다(그리기는 app.js `frame()`). 앱 FSD 분리 M1 — app.js SETUP 의 무대 만들기를 글 그대로 옮겼다.
- **만드는 법**: `const stageMod = TwStage.createStage({ _renderAA, afterRestore });` — `_renderAA` 는 저장된 화질에서 app.js 가 정한 antialias(렌더러를 만들 때만 정해진다) · `afterRestore` 는 3D 가 돌아온 직후 할 일(`faceHealMod.reportGlReset` — 좌석 그림 점검). app.js 가 SETUP 맨 앞(화질을 읽은 뒤)에서 만들고, 아래 일곱을 옛 이름 `const` 로 받는다.
- **내보내는 것**: `canvas` · `renderer` · `scene` · `camera` · `floor` · `sizeFloorTo(mesh, cx, cz, sx, sz)` · `loader`
- **함정**
  - 렌더러를 못 만들면 `gl-fail-notice` 안내(다시 켜기 · 앱 끄기)를 띄우고 **같은 오류를 다시 던진다** — 뒤 코드는 렌더러 없이 돌 수 없다(B-1114-5).
  - 연결 끊김 감시(`gl-recover`)의 «다시 켠 시각» 은 localStorage(`tw.glRelaunchAt`) — 앱을 다시 켜도 남아야 10분 규칙이 선다.
  - 조명은 여기 없다 — 조명 상수 · 재질 고치기는 app.js(T0 몫), 한 벌 만들기는 `light-tone.js addRunLights`. 메인 씬 빛은 app.js 가 만든 뒤 `key` 를 받는다.
  - 이 무대는 메인 창 하나다. 미리보기 창의 3D 장치 만들기는 따로(설계 F1 `gl-context.js`).
  - 검사: `checks/sim-stage.js`(옵션 · 배율 · 바닥 · 로더 · 실패 길 · 연결 · mutation test) · `sim-gl-recover.js` · `sim-frame-budget.js` 5절이 이 파일 글을 읽는다.

## gl-context.js — 🧯 3D 장치를 만드는 단 한 곳

- **책임**: `make(canvas, opts, role, extra)` — `new THREE.WebGLRenderer` 를 부르는 유일한 자리. `'main'` 은 만들기를 `extra.guard`(메인 무대의 `glFail.guard`)에 맡겨 옛 동작(안내 뒤 멈춤) 그대로. `'preview'` 는 못 만들면 던지지 않고 `null` 을 돌려주고, 실패 번호 `E-SYS-06` 로 알리고, 그 캔버스를 감싼 칸 안에 «3D 미리보기를 불러오지 못했어요 · [다시 시도]» 를 그린다(`extra.retry` 가 있을 때만 단추). 다시 만들어 성공하면 옛 안내를 지운다.
- **쓰는 법**: 전역 `TwGlContext.make(...)`(classic script — stage · 미리보기 모듈이 전역으로 부른다). 부르는 쪽은 맨 앞에서 `if(!r) return`. 못 만든 채로 이어도 안전한지(그 창을 여는 함수가 renderer 를 읽는 곳)를 같이 본다 — 생성기는 `ensureCreatorPreview` 가 false 를 돌려 `openCreator` 가 열지 않는다.
- **함정**: 개발용 `app/fx-preview.html` 만 직접 만든다. 새 3D 장치는 여기를 거친다(검사 `sim-gl-context.js` 가 이 파일 밖의 `new THREE.WebGLRenderer` 를 빨강으로). 화면에 안 붙은 캔버스(파츠 썸네일)는 안내 칸이 없어 번호만 낸다. 검사: `checks/sim-gl-context.js`.
## ls-set.js — 💾 작은 설정 저장(`_lsSet`)

- **책임**: `_lsSet(key, val)` — `setItem` 뒤 `getItem` 으로 왕복 확인 · 실패하면 콘솔 경고 + 세션당 한 번 토스트 · 성공 true / 실패 false. 설정처럼 작은 값 전용(슬롯 · 파츠 · 책상 같은 큰 값은 각자 처리).
- **만드는 법**: `TwLsSet.createLsSet({ toast })`. **내보내는 것**: `_lsSet`(app.js 는 같은 이름 const 로 받고 deps 에서 `(...a)=>_lsSet(...a)` 로 넘긴다). 검사: `checks/sim-ls-set.js`.

## hue-tint.js — 🎨 텍스처 파츠 색조 셰이더 이름 잇기

- **책임**: 텍스처가 있는 파츠의 색을 «텍스처 × 색» 곱셈 대신 셰이더에서 색조(Hue)만 돌리는 일의 옛 이름 여섯(`_rgbHexToHsv` · `isHueTintMesh` · `_ensureHueUniforms` · `_hueOBC` · `applyHueTint` · `_hsvToHex`)을 캐릭터 코어(`createTone`)로 잇는다. 앱 FSD 분리 T1 — 0.13 app.js 글 그대로. 본문(셰이더 · HSV 환산)은 코어 `tone.ts` 한 곳.
- **만드는 법**: `TwHueTint.createHueTint({ lightToneMod })` — 값 하나(`lightToneMod.toneCore` 를 읽는다). app.js 가 «색조 셰이더» 자리에서 만들고 여섯 이름을 const 로 받는다(꾸미기 · 도트 · 스티커사진이 부른다).
- **함정**: r128 `Material.copy` 는 `onBeforeCompile` 을 복사하지 않는다 — 재질을 복제한 쪽은 `_hueOBC` 로 다시 건다. 검사: `checks/sim-hue-tint.js`.

## image-bytes.js — 🖼 data: 그림 → 올릴 바이트 판정

**책임** — 화면이 줄여 만든 `data:image/…;base64,…` 글을 풀어 «종류 · 비어 있지 않음 · 크기» 를 한 곳에서 판정한다(`inspect(u, { types, maxBytes })` → `{ ok, type, bytes }` 또는 `{ ok: false, why: 'format' | 'empty' | 'large' }`). 순수 — 아무것도 부르지 않는다.
**만드는 법** — classic script(`window.TwImageBytes`)를 쓰는 provider · app.js 보다 먼저 싣고, app.js 가 provider 에 deps `imageBytes` 로 넘긴다(지금 쓰는 곳: `myhome/schedule-api.js` 카드 그림).
**함정** — 종류 목록을 안 주면 아무것도 통과시키지 않는다. 상한과 같은 크기는 통과.
검사: `checks/sim-image-bytes.js`.

## request-id.js — 🔁 요청 번호

**책임** — 새것을 만드는 쓰기의 본문 `requestId` 를 만든다(`newId()`). 같은 일을 다시 보낼 땐 같은 번호(`createPending` — 이 판에서는 쓰는 곳 없음). 서버 규칙 `^[A-Za-z0-9_-]{8,64}$`.
**만드는 법** — classic script(`window.TwRequestId`)를 쓰는 provider · app.js 보다 먼저 싣는다. 아무것도 부르지 않는다.
검사: `checks/sim-request-id.js`.
## `theme-custom.js` — 👑 테마 «내 색» 규칙(두 색 → 색상 축 · 저장 모양)

- **책임**: 프리미엄이 고른 제목줄 두 색(a · b)으로 그 테마의 `--acc-*` 아홉 값을 만든다 · 색(`#RRGGBB`) · 저장 모양(`{ default:{a,b}, bubble:{a,b} }`)을 씻는다. 순수 함수(DOM · localStorage · firebase 없음) — `window.TwThemeCustom`.
- **쓰는 곳**: `theme.js`(칸 `cx` 를 걸 때 `<html>` 인라인 · 쓸 수 있나 판단 `customUsable`) · `theme-ui.js`(설정 칸 색 · 만들기 상자 미리보기).
- **내놓는 것**: `normHex` · `normCustom` · `derive(theme, a, b)` · `chipCss` · `mix` · `lum` · `VAR_NAMES` · 밝기 경계 둘.
- **함정**: 기본 테마는 제목줄 글자가 흰색이라 고른 색을 어둡게, 버블은 글자가 어두워서 밝은 파스텔로 맞춘다 — 경계를 바꾸면 어떤 색에서 글자가 안 읽힌다(검사가 여러 색으로 돌려 본다). 저장 모양은 서버 규칙 `users/$uid/themeCustom` 과 짝이라 칸을 늘리면 규칙도 같이. 검사 `sim-theme-custom.js`.

## `font-choice.js` · `font-ui.js` — 🔤 창 글꼴 고르기

- **책임**: 설정 › 모니터 › 글꼴 — 기본 · 돋움 · 나눔고딕(누구나) + 👑 내 PC 글꼴(프리미엄). 규칙(값 씻기 · PC 글꼴 이름 씻기 · 값 → 글꼴 목록)은 순수 `font-choice.js`(`window.TwFontChoice`), 걸기 · 칸 · PC 글꼴 상자는 `font-ui.js`(`window.TwFontUi` · app.js 가 테마 바로 뒤에서 `createFontUi`).
- **deps**: `_premiumOn()` · `refreshChildren()`(열린 방명록 · 디자인 창에 토큰 다시 옮김 — `themeMod.applyTheme`).
- **내놓는 것**: `apply` · `bind` · `refresh` · `premiumChanged`(프리미엄이 바뀌면 초대 게이트 `_refreshPremiumGatedUI` 가 부른다 — 화면 글꼴까지 다시 건다).
- **함정**: 바꾸는 토큰은 창 글씨 둘(`--win-font` · `--tw-font-legacy`)뿐 — 머리 위 말풍선 · 이름표(`--tw-font-classic`)는 일부러 안 바꾼다. 저장은 이 PC(`tw.uiFont`) — PC 글꼴은 그 PC 에만 있다. 글꼴 이름은 CSS 글자 안에 들어가므로 늘 `cleanFamily` 를 거친다. PC 글꼴 목록(`queryLocalFonts`)은 누름 직후에만 부를 수 있다. 검사 `sim-font-choice.js`.

## `room-focus-days.js` — 📅 집중 기록 날 키 규칙

**책임** — 서버 칸 이름 `YYYYMMDD`(집중 하루)를 만들고 읽는 규칙 한 곳: `dayKeyOf`(집중 하루 문자열 → 키) · `isDayKey`(규칙 `$day` 와 같은 모양) · `addDays` · `weekStartKey`(월요일 시작). 올리기(`room-focus-sync.js` — app.js 가 `dayKey` 로 넘김)와 보여 주기(`chat/chat-focus.js`)가 같은 키를 쓴다.

**함정** — 도메인(focus · chat) 둘이 같이 쓰는 순수 leaf 라 shared 에 둔다. 의존 없는 순수 classic script(`window.TwRoomFocusDays`) — 쓰는 모듈보다 먼저 싣는다. 모양을 바꾸면 규칙 `d/$day` · 이미 쌓인 칸도 같이 본다.

## `server-features.js` — 서버가 아직 안 받는 0.14 기능 표
- **책임**: 0.14 판에서 Firebase DB · Functions 에 직접 읽고 쓰게 만든 기능의 «서버가 받는가» 를 한 표(`FEATURES`)에 둔다. 0.13 은 Firebase DB 쓰기를 잠갔으므로 서버(API)가 받을 때까지 입구(버튼 · 탭 · 입력칸)만 닫는다 — 기능 코드는 지우지 않는다.
- **내놓는 것**: `on(name)` → boolean(표에 없는 이름은 던진다) · `FEATURES`(바꿀 수 없는 표) · `noServer(name)`(서버 경로가 없는 provider 자리 — 어떤 메서드든 `SERVER_PATH_MISSING` 으로 거절) · `MISSING_CODE`.
- **입구**: xmas — app.js 가 크리스마스 창을 만들지 않음(런처 버튼은 html 에서 hidden 으로 시작) · chatNotice · chatFocus — 각 모듈 `enabled` deps(탭 · 구독 없음) · 집중 올리기는 room-focus-sync `isSecretRoom` 에 같이 · playlistLike — playlist-like-ui `enabled`(줄 안 그림 · 안 읽음) · friendReqMsg — friend-req-btn `reasonOn`(사유 칸 없이 묻기) · themeCustomSave — theme-ui `serverOn`(이 PC 저장만)· 가입은 login-flow.js).
- **서버가 받으면**: 표의 값을 true 로 바꾸고, 그 기능의 provider(지금은 `noServer(이름)`)를 서버 provider 로 갈아 끼운다. 서버 작업 요청은 GitHub 이슈 «서버 작업 요청: …(0.14.0)».
- **함정**: 다른 기준(날짜 · 방 종류)과 섞지 말 것 — 이 표는 «서버 길이 있나» 하나만 본다. 검사 `checks/sim-server-features.js`.
