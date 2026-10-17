# shared/ — 공용 도구 · 공용 통로

도메인을 모르는 아래층 모듈. 도메인 폴더 · app.js 만 이 폴더를 부르고, 이 폴더는 도메인을 부르지 않는다.
절은 모듈마다 하나 — 다른 사람이 만든 절은 건드리지 않고 자기 절만 더한다.

## dot-render.js — 🕹️ 도트 모드 머티리얼

- **책임**: 도트 렌더 모드일 때 씬 머티리얼만 바꾼다 — 텍스처를 Nearest 필터로, 프래그먼트 셰이더 끝에 PS1 색 양자화(16단계) + 4×4 Bayer 디더를 넣는다. 끄면 원래대로. *언제* 켤지는 부르는 쪽(app.js `applyCameraAndCanvas`)이 정한다.
- **만드는 법**: `const dotRenderMod = TwDotRender.createDotRender({ scene });` — `scene` 은 `traverse(cb)` 가 있는 THREE.Scene.
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
- **확장할 때 고칠 자리**: 색 단계는 `_PS1_LEVELS`(스티커사진 `purikura-net.js` 의 `PS1_LEVELS` 와 같은 값이어야 한다) · 디더 행렬 · 넣을 GLSL 은 `_PS1_FRAG_INJECT` · 필터를 바꿀 텍스처 칸은 `DOT_TEX_KEYS` · 다시 훑는 간격은 `SWEEP_MS`.
- **함정**
  - «걸렸나» 는 `userData._ps1Hooked` 표식이 아니라 **지금 `onBeforeCompile` 이 우리 훅인가**로 본다. `m.clone()` 은 userData 를 JSON 으로 복사하고 `onBeforeCompile` 은 안 옮겨서 표식만 따라온 가짜가 생기고, 색조 셰이더(`_ensureHueUniforms`)가 나중에 훅을 덮어쓰기도 한다. 표식은 스티커사진(`purikura-ui.js`)이 읽어서 그대로 적어 둔다.
  - three r128 은 셰이더를 `customProgramCacheKey()`(기본 = `onBeforeCompile` 글자)로 나눠 쓴다. 감싼 훅은 글자가 늘 같으니 키에 원래 훅 글자를 넣어야 염색 재질과 보통 재질이 한 셰이더를 나눠 쓰지 않는다(염색 빠짐).
  - 끌 때 그새 남이 덮어쓴 `onBeforeCompile`(색조)은 지우지 않는다 — 우리 훅일 때만 되돌린다.
  - 켬 상태에서 텍스처에 `needsUpdate` 를 다시 걸지 않는다(이미 Nearest 면 건너뜀) — 걸면 0.5초마다 텍스처를 GPU 에 다시 올린다.
  - 셰이더는 three 의 `#include <dithering_fragment>` 뒤에 붙는다. 그 줄이 없는 머티리얼이면 마지막 `}` 앞에 넣는다.
  - 검사: `checks/sim-dot-render.js`(4절이 가짜 씬으로 켜고 끄기 · 다시 부르기 · 빈 씬 · 5절이 켠 뒤 들어온 메쉬 · 가짜 표식 · 덮어쓴 색조 · 캐시 키 · 훑기 간격).

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
파츠 · 아이템 · 책상 재질에 같은 규칙으로 emissive 를 얹는다. 재질 톤을 정하는 곳은 여기 하나다.

**만드는 법** — app.js «관리자 모드» 머리 바로 앞:

```js
const lightToneMod = TwLightTone.createLightTone({
  _FILL_LIGHT_MUL: _FILL_LIGHT_MUL,                       // 값 — 채움광 배율(app.js 조명 상수)
  _MAIN_LIGHT_INT: _MAIN_LIGHT_INT,                       // 값 — 주광 세기(= LIGHT_PRESET.b × e)
  _fixGlbMatLighting: (...a)=>_fixGlbMatLighting(...a),   // 함수 — metalness 1 재질 눕히기
});
const LIGHT_PRESET = lightToneMod.LIGHT_PRESET;   // 옛 전역 이름(animal.js)
```

**내놓는 것**

| 이름 | 뜻 |
|---|---|
| `LIGHT_PRESET` | 생성기 · 미리보기 조명 프리셋 `{b, h, e}` |
| `TONE_FRONT_TOTAL` | 밝기 손잡이(1.0 = 텍스처 값 그대로) |
| `FLAT_EMISSIVE` | `max(0, 총합 − 0.95×주광 − 주광×채움)` — 조명이 받고 남는 몫 |
| `_applyPartMatTone(m)` | 파츠 재질 — map 이 있으면 emissiveMap 도 · emissive = 색 × 플랫 · `userData.baseFlat` |
| `_applyItemMatTone(m)` | 아이템 · 책상 GLB 재질 — GLB 의 emissive 를 덮어쓴다 · emissiveIntensity 는 1 로 |
| `_setDeskMatColor(m, color)` | 책상 색 바꾸기 — baseFlat 으로 emissive 다시 계산(없으면 처음 심는다) |
| `baseFlatOf(mat)` | 재질에 심은 플랫 배율(baseFlat), 없으면 공용 기준 `FLAT_EMISSIVE` — 색을 다시 칠하는 곳(아이템 · 꾸미기 · 생성기)은 모두 이것으로 읽는다. 0 도 심은 값 |

```js
lightToneMod._setDeskMatColor(seat.deskMat, def.deskColor || null);   // 책상 색은 꼭 이 함수로(color.set 직접 금지)
```

**확장할 때 고칠 자리** — 화면이 밝다 / 어둡다 → `TONE_FRONT_TOTAL` 하나만. 파츠만 · 아이템만 톤을 달리해야 하면 `PART_TEX_FLAT` · `ITEM_SOLID_FLAT` 줄에 숫자를.

**함정**
- «baseFlat 이 있으면 그 값, 없으면 …» 판단을 부르는 쪽에 다시 쓰지 않는다 — `baseFlatOf` 를 부른다(곳마다 쓰면 대체값이 갈라진다 · `sim-light-tone` 이 잡는다).
- `LIGHT_PRESET.e` 를 바꾸면 app.js 위쪽 `_MAIN_LIGHT_INT`(= b × e, 숫자로 적힘)도 같이 — 한쪽만 고치면 생성기와 실행 화면 밝기가 갈라진다.
- 1.16 을 넘기면 측면도 잘려 밝아지지 않고 계조만 사라진다.
- 재질 색을 바꾸는 새 코드는 `color.set` 만 하지 말고 baseFlat 으로 emissive 를 다시 계산해야 한다(책상은 `_setDeskMatColor`).

검사: `checks/sim-light-tone.js` (FLAT_EMISSIVE 식 · 경계 · 재질 함수 셋 · 연결 · 깨 보기).

## toast.js — 🍞 토스트 · 저장 실패 문구

- **책임**: `#toast` 한 줄 알림을 띄우고 시간이 되면 끈다 · 저장 실패 오류가 규칙 거부(PERMISSION_DENIED)인지 가려 문구를 고른다. 도메인을 모른다.
- **만드는 법**: `const toastMod = TwToast.createToast({});` — deps 없음. app.js 는 그 바로 뒤에 같은 이름의 이음 함수 `toast(...)` · `_saveFailMsg(...)` 를 둔다(«옛 전역 이름» — app.js 150여 곳 · 다른 파일 · `window.toast` 가 전역으로 부른다).
- **내보내는 것**
  - `toast(msg, iconSrc?, ms?)` — 글은 `textContent`, `iconSrc` 가 있으면 앞에 16px img. `ms` 가 양수 숫자가 아니면 1.9초. 새 토스트는 앞 타이머를 지운다.
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
