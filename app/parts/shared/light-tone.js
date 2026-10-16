/* light-tone.js — 💡 재질 톤: 화면 밝기 예산(TONE_FRONT_TOTAL)에서 플랫 조명 몫을 계산하고, 파츠 · 아이템 · 책상 재질에 emissive 를 얹는 단 한 곳
   app.js «👻 …» 덩어리 끝의 조명 프리셋 · 재질 톤 조각을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다(바뀐 줄 0 · 주석만 줄임).
   ・책임: 상수 LIGHT_PRESET · TONE_FRONT_TOTAL · FLAT_EMISSIVE(파생) · PART_TEX_FLAT · ITEM_SOLID_FLAT 와 재질 함수 셋.
   ・받는 deps 3 — 값 _MAIN_LIGHT_INT · _FILL_LIGHT_MUL(app.js 조명 상수 — FLAT_EMISSIVE 계산) · 함수 _fixGlbMatLighting(metalness 1 재질 눕히기).
   ・내놓는 것: LIGHT_PRESET · TONE_FRONT_TOTAL · FLAT_EMISSIVE · _applyPartMatTone(m) · _applyItemMatTone(m) · _setDeskMatColor(m, color) — app.js 는 lightToneMod.이름.
     animal.js 가 전역 LIGHT_PRESET 을 읽어 app.js 에 «옛 전역 이름» 한 줄이 있다.
   ⚠️ THREE 는 전역 이름 그대로. 전역 이름은 TwLightTone(Tw 접두사 #103). shared — 도메인을 모른다.
   검사: checks/sim-light-tone.js */
(function(){

function createLightTone(deps){
const _FILL_LIGHT_MUL = deps._FILL_LIGHT_MUL;
const _MAIN_LIGHT_INT = deps._MAIN_LIGHT_INT;
const _fixGlbMatLighting = deps._fixGlbMatLighting;
/* 전역 조명 프리셋 (생성기·메인·기타 미리보기 통일). 더 이상 UI 슬라이더 없음 — 코드 한 곳에서 관리
   ⚠️ e 를 바꾸면 파일 위쪽 _MAIN_LIGHT_INT(=b×e) 도 같이 바꿀 것. 저기는 이 상수보다 먼저 필요해서
      숫자를 직접 적어 두었다 — 한쪽만 고치면 생성기와 실행 화면의 밝기가 갈라진다. */
const LIGHT_PRESET = {b:1.2, h:0.09, e:0.46};
/* 💡 '플랫 조명' emissive 배율(FLAT_EMISSIVE) — 캐릭터 · 책상 · 파츠가 다 쓴다. **직접 정하지 않고** 조명 예산에서 남는 몫으로 받는다
   (이 값과 조명 상수가 한 예산을 나눠 쓴다 — 한쪽만 고치면 흰 면이 잘리거나 통째로 어두워진다). */
/* 🎚️ 화면 톤의 **단 하나의 손잡이** — 카메라를 보는 흰 면(알베도 1.0)이 받는 빛의 총합. 1.0 = 텍스처 값 그대로.
   ★ 밝기 제보는 이 숫자 하나만 옮긴다(조명 상수 · emissive 를 따로 만지면 예산이 갈라진다). 값 이력 · 잘림 표는 커밋 기록에.
   ⚠️ 1.16 에서 측면 몫이 1.0 이 된다 — 더 올리면 밝아지지 않고 계조만 사라진다. 흰 면은 1.2 를 넘기면 실루엣만 남는다. */
const TONE_FRONT_TOTAL = 1.05;
const FLAT_EMISSIVE = Math.max(0,
  TONE_FRONT_TOTAL - (0.95 * _MAIN_LIGHT_INT) - (_MAIN_LIGHT_INT * _FILL_LIGHT_MUL));
/* 💡 텍스처(map)가 있는 파츠 메쉬의 flat 몫 — FLAT_EMISSIVE 를 따라간다(따로 두면 파츠만 제일 하얗게 뜬다).
   ⚠️ 텍스처가 없는 메쉬는 무관하다(예전 그대로 · 통일하지 말 것). 파츠만 톤을 달리할 일이 생기면 이 줄에 숫자를 넣는다. */
const PART_TEX_FLAT = FLAT_EMISSIVE;
/* 💡 텍스처가 없는(solid) 아이템 · 책상 메쉬의 flat 몫 — 파츠와 같은 규칙(0 이면 같은 GLB · 같은 색이 아이템만 칙칙하다).
   ⚠️ 아이템만 톤을 달리할 일이 생기면 여기에 숫자를 — _applyItemMatTone 본문에 흩뿌리지 말 것. */
const ITEM_SOLID_FLAT = FLAT_EMISSIVE;
/* 💡 파츠 머티리얼에 '플랫 조명'을 얹는 단 하나의 자리(장착 · 다중 파츠 · 등록 썸네일이 같이 쓴다).
   ⚠️ 파츠 톤을 바꿀 일이 있으면 여기만 — 흩어 두면 썸네일만 어두워지는 식으로 또 갈라진다. */
function _applyPartMatTone(m){
  if(!m) return;
  _fixGlbMatLighting(m);   // ★ 조명을 못 받는 재질(metalness=1)이면 emissive 를 아무리 맞춰도 톤이 안 맞는다
  if(m.map) m.emissiveMap = m.map;
  const flat = m.map ? PART_TEX_FLAT : FLAT_EMISSIVE;
  if(m.emissive) m.emissive.copy(m.color || new THREE.Color(0xffffff)).multiplyScalar(flat);
  m.userData = m.userData || {};
  m.userData.baseFlat = flat;   // ★ 나중에 _col 색상 바꿀 때 같은 배율로 다시 계산하기 위해 기억
  m.needsUpdate = true;
}
/* 💡 아이템 · 책상(가구류) 머티리얼 톤 — GLB 가 담아 온 emissive 를 **덮어써서** 캐릭터 · 파츠와 같은 기준으로 맞춘다
   (그대로 두면 흰 텍스처가 순백 실루엣이 되거나, 플랫 조명을 못 받아 아이템만 어둡다). solid 메쉬는 ITEM_SOLID_FLAT.
   ⚠️ 가구류 톤은 앞으로 여기만 고칠 것. */
function _applyItemMatTone(m){
  if(!m) return;
  _fixGlbMatLighting(m);   // ★ 여기가 캐릭터와 갈라져 있던 자리 — 예전엔 텍스처 없는 재질만 눕혔다
  if(m.map){
    if(!m.emissiveMap) m.emissiveMap = m.map;
    if(m.emissive){
      if(m.color) m.emissive.copy(m.color).multiplyScalar(FLAT_EMISSIVE);
      else m.emissive.setScalar(FLAT_EMISSIVE);
    }
    m.userData = m.userData || {}; m.userData.baseFlat = FLAT_EMISSIVE;
  } else {
    /* ★ solid(map 없는) 메쉬 — 파츠와 같은 규칙으로 flat 을 얹는다(ITEM_SOLID_FLAT).
       ⚠️ 여기에 숫자를 적지 말 것. 예전에 0 이 박혀 있어서 아이템만 어두웠다. */
    if(m.emissive){
      if(m.color) m.emissive.copy(m.color).multiplyScalar(ITEM_SOLID_FLAT);
      else m.emissive.setScalar(ITEM_SOLID_FLAT);
    }
    m.userData = m.userData || {}; m.userData.baseFlat = ITEM_SOLID_FLAT;   // _col 색을 바꿀 때 같은 배율로 재계산
  }
  // KHR_materials_emissive_strength 로 1 을 넘겨 들어온 배율도 여기서 눕힌다 —
  // 위에서 emissive 색을 덮어써도 이 배율이 살아 있으면 클램프가 그대로 남는다.
  if('emissiveIntensity' in m) m.emissiveIntensity = 1;
  m.needsUpdate = true;
}

/* 🎨 책상 색을 바꾸는 **단 하나의 자리** — 색만 갈면(color.set) 예전 색의 발광이 새 색 위에 남아 씻겨 보인다.
   baseFlat 으로 emissive 를 다시 계산한다. 하드코딩 기본 책상(emissive 0)도 여기를 지나면 같은 예산을 받는다.
   ⚠️ 책상 색을 바꾸는 코드는 예외 없이 이 함수를 부를 것. */
function _setDeskMatColor(m, color){
  if(!m || !m.color) return;
  if(color != null) m.color.set(color);
  m.userData = m.userData || {};
  /* baseFlat 은 GLB 책상이면 _applyItemMatTone 이 이미 심어뒀다. 하드코딩 기본 책상에는
     없으므로 여기서 solid 규칙(ITEM_SOLID_FLAT)으로 처음 심는다 — 숫자를 직접 쓰지 말 것. */
  if(m.userData.baseFlat == null) m.userData.baseFlat = m.map ? FLAT_EMISSIVE : ITEM_SOLID_FLAT;
  if(m.emissive) m.emissive.copy(m.color).multiplyScalar(m.userData.baseFlat);
  if('emissiveIntensity' in m) m.emissiveIntensity = 1;   // GLB 가 1 을 넘겨 왔으면 여기서 눕힌다
  m.needsUpdate = true;
}

/* 재질의 플랫 조명 배율 — 재질 톤이 심어 둔 baseFlat, 없으면 fallback. 색을 다시 칠하는 곳(아이템 · 꾸미기 · 생성기)은 모두 이 함수로 읽는다 —
   같은 판단을 곳마다 다시 쓰면 대체값이 곳마다 갈라진다. 0 도 심은 값이다(없음이 아님). */
function baseFlatOf(mat, fallback){
  return (mat && mat.userData && mat.userData.baseFlat!=null) ? mat.userData.baseFlat : fallback;
}

return {
  FLAT_EMISSIVE,
  LIGHT_PRESET,
  TONE_FRONT_TOTAL,
  baseFlatOf,
  _applyItemMatTone,
  _applyPartMatTone,
  _setDeskMatColor,
};
}

const api = { createLightTone };
if(typeof window !== 'undefined') window.TwLightTone = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
