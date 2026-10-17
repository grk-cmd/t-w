/* lv-tier.js — 🏅 레벨 티어 — 경계값 · 배지 · 바 색
   app.js «🏅 레벨 티어 — 경계값 · 배지 · 바 색» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 48번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _starPaint · lvBadgeClass · lvBarClass · lvStarBadgeClass · lvStarBarClass — app.js 는 lvTierMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLvTier — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-lv-tier.js */
(function(){

function createLvTier(deps){

const LV_TIERS = [[20,1],[40,2],[60,3],[80,4],[100,5],[130,6],
                  [200,7],[300,8],[400,9],[600,10],[998,11],[Infinity,12]];
function lvTierNum(lv){
  const n = Math.max(1, parseInt(lv, 10) || 1);
  for(let i = 0; i < LV_TIERS.length; i++) if(n <= LV_TIERS[i][0]) return LV_TIERS[i][1];
  return LV_TIERS[LV_TIERS.length - 1][1];
}
/* 배지(.mh-flv)에 붙일 클래스 덩어리 — 'mh-flv' 는 뺀 나머지. */
function lvBadgeClass(lv){
  const n = Math.max(1, parseInt(lv, 10) || 1), t = lvTierNum(n);
  return 't' + t + (n >= 81 ? ' shine' : '') + (t >= 7 ? ' lvx' : '');
}
/* 경험치 바(.seat-exp)에 붙일 클래스 덩어리 — 배지와 **같은 표**를 읽으므로 색이 어긋날 수 없다. */
function lvBarClass(lv){
  const t = lvTierNum(lv);
  return 't' + t + (t >= 7 ? ' lvx' : '') + (t >= 8 ? ' lvglow' : '');
}
/* 🌟 회차(999시간을 한 바퀴 채운 뒤) — 티어 자리에 lv-star 가 들어간다 (CHECKS 개정 70).
   ★ 표식은 그대로 둘뿐이다(lvx 흐름 · lvglow 바 발광). 회차 전용 표식을 새로 만들지 않는다.
   ★ 배지에는 shine 을 안 붙인다 — 번쩍임은 이름표 별에서만(목록에 여러 줄이 서는 자리 · handoff §3 «두 자리가 뒤집힌다»).
   ★ star = { cyc: 회차, lv: 이번 바퀴 레벨, color: 팔레트 색 } | null. 만드는 곳은 myFocusShow(나) · starFromRemote(남) 둘뿐. */
function lvStarBadgeClass(){ return 'lv-star lvx'; }
function lvStarBarClass(){ return 'lv-star lvx lvglow'; }
/* --pre-c 칠하기 — 회차면 얹고 아니면 걷는다(요소를 재활용하므로 걷는 쪽이 꼭 필요하다).
   ⚠️ 좌석의 이름표와 바는 #seatLabelsLayer 의 **형제**라 좌석마다 공통 조상 요소가 없다(레이어는 전 좌석 공용).
     그래서 «색 하나를 두 곳에 칠하지 않는다» 는 원칙을 «값 하나(star.color)를 이 함수 하나로 칠한다» 로 지킨다. */
function _starPaint(el, star){
  if(!el) return;
  if(star && star.color) el.style.setProperty('--pre-c', star.color);
  else el.style.removeProperty('--pre-c');
}

return {
  _starPaint,
  lvBadgeClass,
  lvBarClass,
  lvStarBadgeClass,
  lvStarBarClass,
};
}

const api = { createLvTier };
if(typeof window !== 'undefined') window.TwLvTier = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
