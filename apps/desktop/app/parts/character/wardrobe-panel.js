/* wardrobe-panel.js — 🎨 꾸미기 사이드 패널 열고 닫기(bindWardrobe)
   app.js «🎨 꾸미기 사이드 패널 열고 닫기(bindWardrobe)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 48번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ wardrobeMod 는 읽는 함수로 받는다(모듈을 만드는 줄보다 뒤에 선언된다).
   ★ 라이선스 검사는 여기서 하지 않는다 — 창은 누구나 열고, 탭마다 꾸미기 창(wardrobe.js)이 가른다(«📚 도감» 은 라이선스 없이).
   ★ 밖에서 부르는 이름: toggleAlbum() — T 키. 뽑기 창 [도감으로] 는 창 열기 통로(twNav.NAV.WARDROBE_ALBUM)로 부탁한다. 예전 window 고리(openWardrobe · closeWardrobe · refreshWardrobe)도 그대로 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwWardrobePanel — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-wardrobe-panel.js */
(function(){

function createWardrobePanel(deps){
const wardrobeMod = deps.wardrobeMod;   // 읽는 함수
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js) — 뽑기 창 [도감으로] 가 이 통로로 «도감» 탭을 연다
let open = null, close = null, isOpen = null;   // bindWardrobe 가 채운다 — DOM 이 없으면 비어 있다
/* 🎨 꾸미기 사이드 패널 — 열고 닫기 + 콘텐츠 렌더 */
(function bindWardrobe(){
  const btn=document.getElementById('myWardrobeBtn');
  const panel=document.getElementById('wardrobePanel');
  const closeBtn=document.getElementById('wardrobeClose');
  if(!btn||!panel)return;
  isOpen = ()=>panel.classList.contains('on');
  /* tab — 보일 탭(안 주면 마지막에 본 탭). 이미 열려 있으면 탭만 바꿔 다시 그린다. */
  open = function(tab){
    wardrobeMod().selectWdTab(tab);
    wardrobeMod().renderWardrobe();
    panel.classList.add('on');
    if(typeof wardrobeMod().syncWdPreviewOwner==='function') wardrobeMod().syncWdPreviewOwner();
    if(typeof wardrobeMod().refreshWdPreviewChar==='function') wardrobeMod().refreshWdPreviewChar();
  };
  close = function(){
    if(panel.classList.contains('on') && typeof wardrobeMod().commitWdDraft==='function') wardrobeMod().commitWdDraft();   // ★ 저장 버튼 없이, 닫힐 때 자동 저장
    panel.classList.remove('on');
    // ★ 미리보기 표시 판정은 syncWdPreviewOwner 한 곳에서만.
    if(typeof wardrobeMod().syncWdPreviewOwner==='function') wardrobeMod().syncWdPreviewOwner();
    if(typeof wardrobeMod().detachWdGizmo==='function') wardrobeMod().detachWdGizmo();
    // ★ 컬러 선택 팝업(body에 fixed로 붙는 팔레트)이 열린 채로 꾸미기창이 닫히면 팔레트만 남던 문제 —
    //   꾸미기창이 닫힐 땐 떠 있는 팔레트도 전부 같이 제거(요청사항).
    document.querySelectorAll('.wd-color-palette').forEach(p=>p.remove());
  };
  btn.addEventListener('click', e=>{ e.stopPropagation(); if(panel.classList.contains('on'))close(); else open(); });
  if(closeBtn) closeBtn.addEventListener('click', close);
  /* ESC — 뽑기 창이 떠 있으면 그 창만 닫힌다(gacha.js) · 꾸미기 창은 다음 ESC 에 */
  document.addEventListener('keydown', e=>{
    if(e.key!=='Escape' || !panel.classList.contains('on')) return;
    const dv=document.getElementById('gachaDrawOverlay');
    if(dv && dv.style.display==='block') return;
    close();
  });
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
    /* ⚠️ 뽑기 창(#gachaDrawOverlay) 안 클릭도 뺀다 — 뽑고 [도감으로] 돌아와 입혀 보는 흐름이다. */
    if(e.target.closest && e.target.closest('#gachaDrawOverlay, #partRegOverlay, #deskRegOverlay, #assetImpOverlay, #assetGenOverlay, #glbEncOverlay, #glbLoadOverlay, #exportOverlay, #adminPassOverlay, #licenseGenOverlay, #announceOverlay, #adBannerOverlay, #commGenOverlay, #inviteOverlay, #raceOverlay, #codeOverlay, #creatorOverlay, #focusSettingsPanel, #myHomeOverlay, .toast')) return;
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

/* 📚 T 키 — «도감» 탭이 보이면 닫고, 아니면 «도감» 탭으로 연다(열려 있으면 탭만 바꾼다). */
function toggleAlbum(){
  if(!open) return;
  if(isOpen() && wardrobeMod().isAlbumTab()) close();
  else open(wardrobeMod().ALBUM_TAB);
}

/* 📚 뽑기 창 [도감으로] — «도감» 탭으로 연다(열려 있으면 탭만 바꾼다). 가챠는 꾸미기 창을 모르므로 통로로 부탁한다. */
twNav.on(twNav.NAV.WARDROBE_ALBUM, ()=>{ if(open) open(wardrobeMod().ALBUM_TAB); });

return {
  toggleAlbum,
};
}

const api = { createWardrobePanel };
if(typeof window !== 'undefined') window.TwWardrobePanel = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
