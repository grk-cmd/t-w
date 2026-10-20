/* outside-close.js — 🪟 팝업 바깥 클릭으로 닫기
   app.js «🪟 팝업 바깥 클릭으로 닫기» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 47번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다(뒤에 더한 예외: 📄 오픈소스 라이선스 창 — 아래 programSettingsOverlay 줄).
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 옮길 때 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwOutsideClose — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-outside-close.js */
(function(){

function createOutsideClose(deps){

/* 팝업 바깥 클릭 시 자동 닫기 — 생성기(creatorOverlay)·꾸미기(wardrobePanel)는 편집 중 실수로 닫히는 걸 막기 위해 계속 제외
   런처3: 등록 관련 모든 창(파츠·책상·아이템 등록/코드 추가/GLB 인코드/GLB 로드/자산 생성/커미션 생성/초대장 등)도
   실수로 닫히면 입력 내용이 다 날아가므로 이 목록에서 제외 — 명시적으로 [닫기] 버튼으로만 닫히게. */
const OUTSIDE_CLOSE_OVERLAYS=[
  ['raceOverlay','raceCancel'],
  ['licenseGenOverlay','licenseGenClose'], ['adminPassOverlay','adminPassCancel'],
  ['adBannerOverlay','adBannerCloseBtn'], ['exportOverlay','exportCancel'],
  ['codeOverlay','codeCancel'],
  ['programSettingsOverlay','progSettingsCloseBtn'],
];
let _overlaysOpenBeforeClick=new Set();
// 캡처 단계: 이 클릭이 처리되기 "전" 상태를 스냅샷 — 버튼 자신의 onclick(열기)이 실행되기 전이라 정확함
document.addEventListener('click', ()=>{
  _overlaysOpenBeforeClick = new Set(OUTSIDE_CLOSE_OVERLAYS.map(([id])=>id).filter(id=>{
    const ov=document.getElementById(id); return ov && ov.classList.contains('on');
  }));
}, true);
// 버블 단계(기본): 스냅샷에 있던(=이 클릭 전부터 열려있던) 팝업만 바깥클릭 판정 — 이 클릭으로 "방금 연" 팝업은 스냅샷에 없으니 건드리지 않음
document.addEventListener('click', e=>{
  OUTSIDE_CLOSE_OVERLAYS.forEach(([overlayId,closeBtnId])=>{
    if(!_overlaysOpenBeforeClick.has(overlayId)) return;
    const ov=document.getElementById(overlayId); if(!ov || !ov.classList.contains('on')) return;
    // ★ ov(오버레이 배경) 자체가 아니라 안쪽 모달 박스(첫 자식) 기준으로 판정 — codeOverlay처럼 배경에
    //   pointer-events:none이 없는 옛날 구조는 배경 클릭 시 e.target이 ov 자신이 되어 ov.contains(e.target)가
    //   true(=안쪽 클릭으로 오판)가 되던 문제 수정.
    const box = ov.firstElementChild || ov;
    if(!box.contains(e.target)){
      // ★ 파츠 등록창은 등록하려는 파츠를 미리보기에서 실시간으로 조정할 수 있게 열어두는 창이므로,
      //   미리보기 패널(#wdPreviewPanel — 기즈모 조작 포함) 위의 클릭은 "바깥 클릭"으로 취급하지 않음(요청사항).
      if(overlayId==='partRegOverlay' && e.target && e.target.closest && e.target.closest('#wdPreviewPanel')) return;
      /* 📄 [2026-10-02] 라이선스 발급 창 옆의 «엑셀로 일괄 발급» 창(#licenseXlsxWin)은 같은 오버레이의 **두 번째 자식**이라
         위 box(첫 자식) 기준으로는 바깥으로 읽힌다 — 그 창 안 클릭이 발급 창을 통째로 닫지 않게 뺀다. */
      if(overlayId==='licenseGenOverlay' && e.target && e.target.closest && e.target.closest('#licenseXlsxWin')) return;
      /* 📄 오픈소스 라이선스 창(#ossLicensesOverlay — launcher/oss-licenses.js)은 프로그램 설정에서 열리지만 body 에 따로 붙은 오버레이라
         설정 상자 바깥으로 읽힌다 — 그 창 안 클릭이 아래 설정 창을 닫지 않게 뺀다. */
      if(overlayId==='programSettingsOverlay' && e.target && e.target.closest && e.target.closest('#ossLicensesOverlay')) return;
      const btn=document.getElementById(closeBtnId); if(btn) btn.click();
    }
  });
});

return {

};
}

const api = { createOutsideClose };
if(typeof window !== 'undefined') window.TwOutsideClose = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
