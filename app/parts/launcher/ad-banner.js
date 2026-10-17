/* ad-banner.js — 📢 런처 광고 배너 · ⚙️ 게임 설정(사용자 쪽 — 그리기 · 구독)
   app.js «📢 런처 광고 배너 · ⚙️ 게임 설정» 구역의 사용자 쪽(배너 그리기 · 게임 설정 구독 · 서버 배너 구독)을 그대로 옮긴 모듈이다(앱 FSD 43번 — docs/APP_FSD_MAP.md).
   관리자 쪽 연결(admin-launcher.js 만드는 줄)은 app.js 에서 이 모듈 만드는 줄 바로 뒤. 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: AD_BANNER_KEY · _gameCfg · refreshAdBanner — app.js 는 adBannerMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdBanner — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-ad-banner.js */
(function(){

function createAdBanner(deps){
const settingsMod = deps.settingsMod;
/* 광고 배너 — localStorage에 저장된 이미지/링크를 런처 하단에 표시. 관리자만 편집 가능. */
const AD_BANNER_KEY = 'tw.adBanner';
let _lcAdSlides=[], _lcAdIdx=0, _lcAdTimer=null;
function refreshAdBanner(){
  const a=document.getElementById('lcAdBanner'); const img=document.getElementById('lcAdBannerImg');
  if(!a||!img) return;
  if(_lcAdTimer){ clearInterval(_lcAdTimer); _lcAdTimer=null; }
  _lcAdSlides = settingsMod.loadAdBannerSlides(); _lcAdIdx=0;
  if(!_lcAdSlides.length){ a.style.display='none'; return; }
  const show=()=>{ const s=_lcAdSlides[_lcAdIdx % _lcAdSlides.length]; img.src=s.img; a.href=s.link||'#'; };
  show(); a.style.display='block';
  if(_lcAdSlides.length>1) _lcAdTimer=setInterval(()=>{ _lcAdIdx=(_lcAdIdx+1)%_lcAdSlides.length; show(); }, 4000);
}
document.getElementById('lcAdBanner').addEventListener('click', e=>{
  const href=e.currentTarget.getAttribute('href');
  e.preventDefault();   // 기본 <a> 동작(외부 브라우저/새 탭) 대신 앱 안의 작은 창으로 열기
  if(e.ctrlKey || e.metaKey) return;   // Ctrl+클릭은 관리자 진입 시도용 — 배너 링크는 열지 않음
  if(href && href!=='#' && window.companion && companion.openBrowser) companion.openBrowser(href);
});
/* ⚙️ 게임 설정 — 앱을 새로 배포하지 않고 바꾸고 싶은 값(동물 해금 레벨 등)을 서버에 저장.
   광고 배너와 같은 방식이라 관리자가 저장하면 모든 유저에게 즉시 반영된다. */
let _gameCfg = {};
function _applyGameCfg(cfg){
  _gameCfg = cfg || {};
  const lv = _gameCfg.animalUnlockLevel;
  if(lv != null && typeof window._setAnimalUnlockLevel === 'function'){
    try{ window._setAnimalUnlockLevel(lv); }catch(_){}
  }
}
try{
  TwNetReady.whenNetReady(()=>{
    try{ firebaseAPI.subscribeGameConfig(_applyGameCfg); }catch(_){}
  }, 'subscribeGameConfig');
}catch(_){}

refreshAdBanner();
// 🌐 서버 배너 구독 — 관리자가 게시한 배너를 모든 사용자가 받아 localStorage에 반영 후 다시 그림.
//   (표시 로직은 기존 localStorage 경로를 그대로 재사용 — 서버는 동기화만 담당)
(function(){
  const _sub = ()=>{
    if(!(window.firebaseAPI && firebaseAPI.subscribeAdBanner)){ setTimeout(_sub, 500); return; }
    firebaseAPI.subscribeAdBanner(slides=>{
      try{
        const arr = Array.isArray(slides) ? slides.filter(x=>x&&x.img) : [];
        if(arr.length) localStorage.setItem(AD_BANNER_KEY, JSON.stringify(arr));
        else localStorage.removeItem(AD_BANNER_KEY);
      }catch(_){}
      refreshAdBanner();
      if(typeof settingsMod.refreshFsAdBanner==='function') settingsMod.refreshFsAdBanner();
    });
  };
  _sub();
})();

return {
  AD_BANNER_KEY,
  _gameCfg: ()=>_gameCfg,   // 읽는 함수
  refreshAdBanner,
};
}

const api = { createAdBanner };
if(typeof window !== 'undefined') window.TwAdBanner = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
