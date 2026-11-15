/* hue-tint.js — 🎨 텍스처 파츠 색조 셰이더 이름 잇기(앱 FSD · app.js 분리 T1)
   app.js «🎨 텍스처 파츠 색조 셰이더» 구역의 여섯 함수를 0.13 app.js 글 그대로 옮긴 모듈이다. 본문(셰이더 · HSV 환산 · 색조 걸기)은 캐릭터 코어(createTone)에 있고 여기는 옛 이름을 코어로 잇기만 한다.
   ・받는 deps 1 — 값 lightToneMod(toneCore 를 내놓는다).
   ・내놓는 것: _rgbHexToHsv · isHueTintMesh · _ensureHueUniforms · _hueOBC · applyHueTint · _hsvToHex — app.js 는 같은 이름 const 로 받는다(꾸미기 · 도트 · 스티커사진이 부른다).
   ⚠️ r128 Material.copy 는 onBeforeCompile 을 복사하지 않는다 — 재질을 복제한 쪽은 _hueOBC 로 다시 건다.
   검사: checks/sim-hue-tint.js */
(function(){

function createHueTint(deps){
const lightToneMod = deps.lightToneMod;
/* 🎨 텍스처 파츠 색조 변경 ─────────────────────────────────────────────────
   _col 메쉬 중 텍스처(map)가 있는 것은 material.color를 갈아끼우면 "텍스처 × 색" 곱셈이 되어
   무늬가 어두워지고 탁해진다. 그래서 텍스처가 있으면 색을 덮어쓰는 대신 셰이더에서 '색조(Hue)만'
   회전시킨다 — 명암·무늬·질감(밝기 V)은 원본 그대로 두고 색상만 바뀐다.
     ・채도(S)는 중립(0)을 가운데 두고 양쪽으로 간다 — 오른쪽은 원본과 고른 값 중 진한 쪽을
       따라가고(흑백 텍스처에도 색이 입혀진다), 왼쪽은 원본 채도를 곱해서 낮춘다(끝 = 회색).
     ・emissiveMap이 map과 같은 텍스처를 쓰므로 emissive 쪽에도 같은 변환을 넣어야 색이 어긋나지 않는다.
   ※ 셰이더 주입이라 렌더 결과는 실제 실행에서 눈으로 확인 필요. */
/* 본문(셰이더 · HSV 환산 · 색조 걸기)은 캐릭터 코어(src/tone.ts · #437) — 옛 이름은 그대로 둔다(꾸미기 · 도트 · 스티커사진이 부른다).
   ⚠️ r128 Material.copy 는 onBeforeCompile 을 복사하지 않는다 — 재질을 복제한 쪽은 _hueOBC 로 다시 건다. */
function _rgbHexToHsv(hex){ return lightToneMod.toneCore.rgbHexToHsv(hex); }
function isHueTintMesh(mesh){ return lightToneMod.toneCore.isHueTintMesh(mesh); }
function _ensureHueUniforms(mat){ return lightToneMod.toneCore.ensureHueUniforms(mat); }
function _hueOBC(u){ return lightToneMod.toneCore.hueOBC(u); }
function applyHueTint(mesh, hex, hsvOpt){ return lightToneMod.toneCore.applyHueTint(mesh, hex, hsvOpt); }
function _hsvToHex(h, sv, v){ return lightToneMod.toneCore.hsvToHex(h, sv, v); }

return {
  _rgbHexToHsv,
  isHueTintMesh,
  _ensureHueUniforms,
  _hueOBC,
  applyHueTint,
  _hsvToHex,
};
}

const api = { createHueTint };
if(typeof window !== 'undefined') window.TwHueTint = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
