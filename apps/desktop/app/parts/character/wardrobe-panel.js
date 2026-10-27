/* wardrobe-panel.js — 🎨 꾸미기 사이드 패널 열고 닫기(bindWardrobe)
   app.js «🎨 꾸미기 사이드 패널 열고 닫기(bindWardrobe)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 48번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 9줄 —
     isAdmin · isPremium · wardrobeMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 1개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwWardrobePanel — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-wardrobe-panel.js */
(function(){

function createWardrobePanel(deps){
const isAdmin = deps.isAdmin;   // 읽는 함수
const isPremium = deps.isPremium;   // 읽는 함수
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js)
const toast = deps.toast;
const wardrobeMod = deps.wardrobeMod;   // 읽는 함수
/* 🎨 꾸미기 사이드 패널 — 열고 닫기 + 콘텐츠 렌더 */
(function bindWardrobe(){
  const btn=document.getElementById('myWardrobeBtn');
  const panel=document.getElementById('wardrobePanel');
  const closeBtn=document.getElementById('wardrobeClose');
  if(!btn||!panel)return;
  function open(){
    // 프리미엄 게이트 — 라이선스 등록되어 있거나 관리자면 통과
    if(!isPremium() && !isAdmin()){
      toast('🔒 꾸미기는 라이선스 등록 후 이용할 수 있어요');
      twNav.go(twNav.NAV.PROGRAM_SETTINGS, 'license');
      return;
    }
    wardrobeMod().renderWardrobe();
    panel.classList.add('on');
    if(typeof wardrobeMod().syncWdPreviewOwner==='function') wardrobeMod().syncWdPreviewOwner();
    if(typeof wardrobeMod().refreshWdPreviewChar==='function') wardrobeMod().refreshWdPreviewChar();
  }
  function close(){
    if(panel.classList.contains('on') && typeof wardrobeMod().commitWdDraft==='function') wardrobeMod().commitWdDraft();   // ★ 저장 버튼 없이, 닫힐 때 자동 저장
    panel.classList.remove('on');
    // ★ 보관함이 아직 열려 있으면 미리보기는 그대로 둔다 — 판정은 syncWdPreviewOwner 한 곳에서만.
    if(typeof wardrobeMod().syncWdPreviewOwner==='function') wardrobeMod().syncWdPreviewOwner();
    if(typeof wardrobeMod().detachWdGizmo==='function') wardrobeMod().detachWdGizmo();
    // ★ 컬러 선택 팝업(body에 fixed로 붙는 팔레트)이 열린 채로 꾸미기창이 닫히면 팔레트만 남던 문제 —
    //   꾸미기창이 닫힐 땐 떠 있는 팔레트도 전부 같이 제거(요청사항).
    document.querySelectorAll('.wd-color-palette').forEach(p=>p.remove());
  }
  btn.addEventListener('click', e=>{ e.stopPropagation(); if(panel.classList.contains('on'))close(); else open(); });
  if(closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && panel.classList.contains('on')) close(); });
  window.openWardrobe = open;
  window.closeWardrobe = close;
  window.refreshWardrobe = ()=>{ if(panel.classList.contains('on')) wardrobeMod().renderWardrobe(); };
  // ★ 저장 버튼 대신 — 꾸미기/미리보기 패널 바깥을 클릭하면 자동으로 저장하고 닫음.
  document.addEventListener('mousedown', e=>{
    if(!panel.classList.contains('on')) return;
    const wp=document.getElementById('wdPreviewPanel');
    if(panel.contains(e.target)) return;              // 꾸미기 패널 안(색상 팔레트 등 포함) 클릭은 무시
    if(wp && wp.contains(e.target)) return;            // 미리보기 패널 안 클릭도 무시
    if(e.target===btn || btn.contains(e.target)) return;   // 토글 버튼 자체는 그 버튼의 자체 클릭 핸들러가 처리
    if(e.target.closest && e.target.closest('.wd-color-palette')) return;   // body에 fixed로 붙는 색상 팔레트도 무시
    // ★ 파츠 등록 등 다른 모달 창 위에서 클릭(텍스트 입력 등)해도 "꾸미기창 바깥 클릭"으로 오인해서
    //   꾸미기창이 같이 닫혀버리던 문제 — 다른 오버레이 위 클릭은 전부 무시하도록 예외 추가.
    /* ⚠️ #gachaInvOverlay·#gachaDrawOverlay(파츠보관함)가 이 목록에서 빠져 있었다. 보관함 쪽은
       _GACHA_KEEP 에 #wardrobePanel 을 넣어 두어 반대 방향은 이미 막혀 있었는데 여기만 없었다.
       그래서 꾸미기를 열어 둔 채 보관함 안을 클릭하면 여기서 close() 가 돌고, 그 close() 가
       두 창이 함께 쓰는 미리보기 패널의 .on 까지 떼어 갔다(제보: "보관함 미리보기창이 안 보임"). */
    if(e.target.closest && e.target.closest('#gachaInvOverlay, #gachaDrawOverlay, #partRegOverlay, #deskRegOverlay, #assetImpOverlay, #assetGenOverlay, #glbEncOverlay, #glbLoadOverlay, #exportOverlay, #adminPassOverlay, #licenseGenOverlay, #announceOverlay, #adBannerOverlay, #commGenOverlay, #inviteOverlay, #raceOverlay, #codeOverlay, #creatorOverlay, #focusSettingsPanel.fs-in-launcher, #focusSettingsPanel, #myHomeOverlay, .toast')) return;
    close();
  });
  // ★ 투명 배경(클릭통과 처리되는 영역)을 클릭하면 그 클릭 이벤트 자체가 우리 창에 전달되지 않아서
  //   (Electron 클릭통과 구조상 당연함) 위 mousedown 리스너로는 못 잡는 경우가 있음 — 이런 "진짜 바깥"
  //   클릭은 보통 다른 프로그램/바탕화면 포커스로 이어지므로, 창이 포커스를 잃는 시점도 같이 감지해서 처리.
  window.addEventListener('blur', ()=>{
    if(!panel.classList.contains('on')) return;
    // ★ 파츠 등록 등 우리 모달이 열려있는 상태에서 파일 선택 다이얼로그를 띄우면 Electron 창의 포커스가
    //   잠깐 빠지는데, 그때 여기서 닫아버리면 등록 창까지 같이 사라져 버림 — 모달이 하나라도 열려있으면 blur 무시.
    const modalOpen = document.querySelector('#partRegOverlay.on, #deskRegOverlay.on, #assetImpOverlay.on, #assetGenOverlay.on, #glbEncOverlay.on, #glbLoadOverlay.on, #exportOverlay.on, #adminPassOverlay.on, #licenseGenOverlay.on, #announceOverlay.on, #adBannerOverlay.on, #commGenOverlay.on, #inviteOverlay.on, #raceOverlay.on, #creatorOverlay.on, #focusSettingsPanel.fs-in-launcher.on, #myHomeOverlay.on, #pkOverlay.on');
    if(modalOpen) return;
    close();
  });
})();

return {

};
}

const api = { createWardrobePanel };
if(typeof window !== 'undefined') window.TwWardrobePanel = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
