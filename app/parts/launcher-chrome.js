/* launcher-chrome.js — 🪟 런처 타이틀바 · 팝업 흐림
   app.js «🪟 런처 타이틀바 · 팝업 흐림» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 47번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLauncherChrome — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-launcher-chrome.js */
(function(){

function createLauncherChrome(deps){
const myInfoMod = deps.myInfoMod;
/* 런처 타이틀바 — 드래그로 창 이동(위치 기억은 main.js가 처리) + 최소화/최대화/닫기 */
/* 런처 타이틀바 드래그 이동은 CSS -webkit-app-region:drag(네이티브)로 처리 — JS 기반보다 안정적.
   여기서는 X 버튼(앱 종료)만 바인딩. */
(function bindLauncherTitlebar(){
  const closeBtn=document.getElementById('lcCloseBtn');
  if(closeBtn) closeBtn.onclick=e=>{ e.stopPropagation();
    /* 🪪 [내 정보]가 열려 있으면 X 는 먼저 [내 정보]만 닫고 런처로 돌아간다(◀ 와 같다 · 사용자 요청 · 개정 53).
       한 번 더 누르면 그때 앱을 끈다. Alt+F4 · 작업 표시줄 닫기는 여기를 거치지 않는다(OS 창 닫기). */
    if(typeof myInfoMod._miIsOpen === 'function' && myInfoMod._miIsOpen()){ myInfoMod.closeMyInfo(); return; }
    if(window.companion && companion.quitApp) companion.quitApp();
  };
})();

/* 팝업(오버레이)이 뜨면 뒤의 런처 카드를 비활성처럼 톤다운 — MutationObserver로 .on 클래스 변화 감시 */
(function bindLauncherDim(){
  const card = document.querySelector('.lc-card');
  if(!card) return;
  const overlaySelectors = ['#codeOverlay','#exportOverlay','#glbEncOverlay','#glbLoadOverlay',
    '#assetGenOverlay','#assetImpOverlay','#inviteOverlay','#commGenOverlay','#commImpOverlay',
    '#partRegOverlay','#creatorOverlay','#programSettingsOverlay','#adminPassOverlay','#licenseGenOverlay',
    '#adBannerOverlay','#gameCfgOverlay','#raceOverlay'];
  function refresh(){
    const anyOpen = overlaySelectors.some(sel=>{ const el=document.querySelector(sel); return el && el.classList.contains('on'); });
    card.classList.toggle('dimmed', anyOpen);
  }
  overlaySelectors.forEach(sel=>{
    const el=document.querySelector(sel); if(!el) return;
    new MutationObserver(refresh).observe(el, { attributes:true, attributeFilter:['class'] });
  });
  refresh();
})();

return {

};
}

const api = { createLauncherChrome };
if(typeof window !== 'undefined') window.TwLauncherChrome = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
