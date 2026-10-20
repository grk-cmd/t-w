/* ps1-dither.js — 🕹️ PS1 디더 규칙 — 색 단계 · 4×4 Bayer 표 · 한 칸 계산을 한 곳에
   책임: 도트 모드 셰이더(shared/dot-render.js)와 스티커사진 PS1 필터(purikura/purikura-net.js)가 같은 값 · 같은 식을 읽게 한다.
   받는 deps: 없음(값과 순수 함수뿐). 내보내는 것: PS1_LEVELS · BAYER4 · bayerThreshold(x, y) · ditherQuantize(v, t).
   ⚠️ 셰이더(GLSL)는 이 함수를 부를 수 없어 dot-render.js 가 같은 식을 글로 다시 쓴다 — 식을 바꾸면 그쪽 _PS1_FRAG_INJECT 도 같이.
   ⚠️ 전역 이름은 TwPs1Dither — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-ps1-dither.js */
(function(){

const PS1_LEVELS = 16;   // 채널당 색 단계. 16=PS1 디더가 눈에 보이는 균형점. 32=미세(RGB555), 8=강한 포스터화.
const BAYER4 = Object.freeze([0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5]);   // 4×4 Bayer 임계값(0~15) — 가로 4칸씩

/* 픽셀 (x, y) 의 디더 임계값 0~15/16 — 4칸마다 되풀이되는 격자 */
function bayerThreshold(x, y){ return BAYER4[(y % 4) * 4 + (x % 4)] / 16; }

/* 0~1 색 값 v 에 임계값 t 만큼(±0.5단계) 흔든 뒤 단계로 스냅한다. 0~1 밖으로 나갈 수 있다 — 자르는 건 부르는 쪽 */
function ditherQuantize(v, t){ return Math.floor((v + (t - 0.5) / PS1_LEVELS) * PS1_LEVELS + 0.5) / PS1_LEVELS; }

const api = Object.freeze({ PS1_LEVELS, BAYER4, bayerThreshold, ditherQuantize });
if(typeof window !== 'undefined') window.TwPs1Dither = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
