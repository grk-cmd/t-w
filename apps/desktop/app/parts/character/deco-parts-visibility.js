/* deco-parts-visibility.js — 🎁 꾸미기 파츠 표시 — 끄면 내 화면에서만 모든 좌석의 꾸미기 파츠 wrapper 를 숨긴다(책상 위 카테고리는 그대로)
   책임: 꾸미기 파츠 보이기 깃발(tw.decoParts — 계정 칸) 하나와 좌석 하나에 그 깃발을 거는 일(wrapper.visible) — 서버에 안 쓴다.
   받는 deps: premiumMod(읽는 함수 — 카테고리 표 PART_CATS · isDeskPartCat) · decoAccountStore(계정 칸).
   내보내는 것: applyDecoPartsVisibility(seat) · decoPartsVisible()/setDecoPartsVisible(v)(읽는 · 쓰는 함수 — 설정 창이 바꾸고, 파츠 붙이기가 읽는다).
   app.js «🪑 좌석 크기 평준화» 구역 안에 있던 «🎁 꾸미기 파츠 표시» 를 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄임). 바뀐 코드 줄은 2줄 —
     premiumMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 밖에서 부르는 이름: applyDecoPartsVisibility · decoPartsVisible — app.js 는 decoPartsMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwDecoPartsVisibility — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-deco-parts-visibility.js */
(function(){

function createDecoPartsVisibility(deps){
const premiumMod = deps.premiumMod;   // 읽는 함수
const decoAccountStore = deps.decoAccountStore;   // 🗂️ 계정별 칸(shared/account-store.js) — 보이기 깃발은 이 계정이 이 PC 에서 고른 것
/* 🎁 꾸미기 파츠 표시 — 끄면 내 화면에서만 모든 좌석의 꾸미기 파츠 wrapper(`__twPartWrap`)를 숨긴다. 책상 위(bone:'desk') 카테고리는 그대로.
   wrapper.visible 만 내린다 — 메시를 안 건드려 setSeatOpacity · 파츠 애니 · 스티커사진 키 계산과 안 섞인다.
   ⚠️ 파츠가 숨기던 기본 메시(모자 → 머리카락)는 applyClothVisibility 가 «파츠 없음» 으로 되돌린다 — 안 그러면 대머리가 된다. */
let decoPartsVisible = true;   // 기본 켜기 — 만들 때는 읽지 않는다(계정 칸은 확인 전엔 닫혀 있다). 확인 뒤 loadLocal 이 계정 칸에서 읽는다
const DECO_PARTS_KEY = 'tw.decoParts';
function loadLocal(){ try{ decoPartsVisible = (decoAccountStore.get(DECO_PARTS_KEY) !== '0'); }catch(_){ decoPartsVisible = true; } }
function _decoWrapperShow(cat){
  if(decoPartsVisible) return true;
  const info = premiumMod().PART_CATS() ? premiumMod().PART_CATS().find(c => c.cat === cat) : null;
  return premiumMod().isDeskPartCat(info);   // 책상 위는 항상 보인다
}
function applyDecoPartsVisibility(seat){
  if(!seat || !seat.group) return;
  try{
    seat.group.traverse(o => {
      if(!(o.userData && o.userData.__twPartWrap)) return;
      o.visible = _decoWrapperShow(o.userData.cat);
    });
  }catch(_){}
}

return {
  applyDecoPartsVisibility,
  decoPartsVisible: ()=>decoPartsVisible,   // 읽는 함수
  setDecoPartsVisible: (v)=>{ decoPartsVisible = v; },   // 쓰는 함수 — 설정 창이 켜고 끈다
  loadLocal,   // 확인 뒤 계정 칸에서 읽는다(launcher/user-local.js)
  resetLocal: ()=>{ decoPartsVisible = true; },   // 세션이 끝나면 처음 값으로
};
}

const api = { createDecoPartsVisibility };
if(typeof window !== 'undefined') window.TwDecoPartsVisibility = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
