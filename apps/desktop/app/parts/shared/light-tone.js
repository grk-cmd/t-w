/* light-tone.js — 💡 재질 톤: 화면 밝기 예산(TONE_FRONT_TOTAL)에서 플랫 조명 몫을 계산하고, 파츠 · 아이템 · 책상 재질에 emissive 를 얹는 단 한 곳
   ・책임: 상수 LIGHT_PRESET · CREATOR_LIGHT_SL · TONE_FRONT_TOTAL(값은 코어 lighting.ts) · FLAT_EMISSIVE(파생) · ITEM_SOLID_FLAT 와 재질 함수 셋(파츠 톤은 코어를 부른다).
   ・받는 deps 4 — 값 _MAIN_LIGHT_INT · _FILL_LIGHT_MUL(app.js 조명 상수 — FLAT_EMISSIVE 계산) · 함수 _fixGlbMatLighting(metalness 1 재질 눕히기) · charCore(TwCharCore).
   ・캐릭터 · 파츠 재질 톤(파츠 톤 · baseFlat · 얼굴 맵 · 몸 평탄 조명 · 색조 셰이더)은 캐릭터 코어(createTone · #437) — 여기서 FLAT_EMISSIVE 로 만들어 toneCore 로 내놓는다.
     책상 · 아이템 재질 톤은 여기 그대로(앱 몫).
   ・내놓는 것: LIGHT_PRESET · CREATOR_LIGHT_SL · TONE_FRONT_TOTAL · FLAT_EMISSIVE · toneCore · baseFlatOf · _applyPartMatTone(m) · _applyItemMatTone(m) · _setDeskMatColor(m, color) — app.js 는 lightToneMod.이름.
     animal.js 가 전역 LIGHT_PRESET 을 읽어 app.js 에 «옛 전역 이름» 한 줄이 있다.
   ⚠️ THREE 는 전역 이름 그대로. 전역 이름은 TwLightTone(Tw 접두사 #103). shared — 도메인을 모른다.
   검사: checks/sim-light-tone.js */
(function(){

function createLightTone(deps){
const _FILL_LIGHT_MUL = deps._FILL_LIGHT_MUL;
const _MAIN_LIGHT_INT = deps._MAIN_LIGHT_INT;
const _fixGlbMatLighting = deps._fixGlbMatLighting;
const charCore = deps.charCore;
/* 조명 프리셋 · 밝기 손잡이(TONE_FRONT_TOTAL) · 플랫 몫 계산식은 캐릭터 코어 한 벌(lighting.ts — 웹 생성기와 같다).
   플랫 몫은 받은 조명 상수(deps)로 계산한다 — 조명 상수와 한 예산을 나눠 쓴다. */
const LIGHT_PRESET = charCore.LIGHT_PRESET;
const CREATOR_LIGHT_SL = charCore.CREATOR_LIGHT_SL;   // 생성기 빛 채도 · 명도(색상은 LIGHT_PRESET.h)
const TONE_FRONT_TOTAL = charCore.TONE_FRONT_TOTAL;
const FLAT_EMISSIVE = charCore.flatEmissive(_MAIN_LIGHT_INT, _FILL_LIGHT_MUL, TONE_FRONT_TOTAL);
/* 캐릭터 · 파츠 재질 톤 — 같은 예산(FLAT_EMISSIVE)으로 코어가 칠한다(파츠 톤을 바꿀 일이 있으면 코어 tone.ts 한 곳). */
const toneCore = charCore.createTone({ THREE, flatEmissive: FLAT_EMISSIVE, fixMatLighting: _fixGlbMatLighting });
/* 💡 텍스처가 없는(solid) 아이템 · 책상 메쉬의 flat 몫 — 파츠와 같은 규칙(0 이면 같은 GLB · 같은 색이 아이템만 칙칙하다).
   ⚠️ 아이템만 톤을 달리할 일이 생기면 여기에 숫자를 — _applyItemMatTone 본문에 흩뿌리지 말 것. */
const ITEM_SOLID_FLAT = FLAT_EMISSIVE;
/* 💡 파츠 머티리얼에 '플랫 조명'을 얹는 단 하나의 자리(장착 · 다중 파츠 · 등록 썸네일) — 코어 */
function _applyPartMatTone(m){ toneCore.applyPartMatTone(m); }
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

/* 재질의 플랫 조명 배율 — 심어 둔 baseFlat(0 도 심은 값), 없으면 FLAT_EMISSIVE. 색을 다시 칠하는 곳은 모두 이 함수로 읽는다 — 코어 */
function baseFlatOf(mat){ return toneCore.baseFlatOf(mat); }

return {
  toneCore,
  FLAT_EMISSIVE,
  CREATOR_LIGHT_SL,
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
