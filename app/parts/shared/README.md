# shared/ — 공용 도구 · 공용 통로

도메인을 모르는 아래층 모듈. 도메인 폴더 · app.js 만 이 폴더를 부르고, 이 폴더는 도메인을 부르지 않는다.
절은 모듈마다 하나 — 다른 사람이 만든 절은 건드리지 않고 자기 절만 더한다.

## dot-render.js — 🕹️ 도트 모드 머티리얼

- **책임**: 도트 렌더 모드일 때 씬 머티리얼만 바꾼다 — 텍스처를 Nearest 필터로, 프래그먼트 셰이더 끝에 PS1 색 양자화(16단계) + 4×4 Bayer 디더를 넣는다. 끄면 원래대로. *언제* 켤지는 부르는 쪽(app.js `applyCameraAndCanvas`)이 정한다.
- **만드는 법**: `const dotRenderMod = TwDotRender.createDotRender({ scene });` — `scene` 은 `traverse(cb)` 가 있는 THREE.Scene.
- **내보내는 것**
  - `applyDotTextureFilter(on)` — `map · emissiveMap · normalMap · roughnessMap · metalnessMap` 의 min/mag 필터를 바꾼다. 원래 값은 `tex.userData._origMinFilter/_origMagFilter` 에 둔다.
  - `applyPS1Shader(on)` — 머티리얼의 `onBeforeCompile` 을 감싼다(원래 것은 `userData._ps1PrevOBC` 에 두고 먼저 부른다) · `needsUpdate = true` 로 다시 컴파일.
  ```js
  if(dotOn){ dotRenderMod.applyDotTextureFilter(true); dotRenderMod.applyPS1Shader(true); }
  else { dotRenderMod.applyDotTextureFilter(false); dotRenderMod.applyPS1Shader(false); }
  ```
- **확장할 때 고칠 자리**: 색 단계는 `_PS1_LEVELS`(스티커사진 `purikura-net.js` 의 `PS1_LEVELS` 와 같은 값이어야 한다) · 디더 행렬 · 넣을 GLSL 은 `_PS1_FRAG_INJECT` · 필터를 바꿀 텍스처 칸은 `applyDotTextureFilter` 안 목록.
- **함정**
  - 두 함수 모두 **마지막 상태와 같으면 아무것도 안 한다**(모드가 바뀔 때 한 번). 켠 뒤 새로 더해진 메쉬는 껐다 켤 때까지 안 훑는다 — `CONFIRM.md` 에 적어 둠.
  - 셰이더는 three 의 `#include <dithering_fragment>` 뒤에 붙는다. 그 줄이 없는 머티리얼이면 마지막 `}` 앞에 넣는다.
  - 검사: `checks/sim-dot-render.js`(4절이 가짜 씬으로 켜고 끄기 · 다시 부르기 · 빈 씬).
