/* license-key.js — 🔑 라이선스 키 등록 · 해제 버튼
   app.js «🔑 라이선스 키 등록 · 해제 버튼» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 48번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 2개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLicenseKey — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-license-key.js */
(function(){

function createLicenseKey(deps){
const licenseGateMod = deps.licenseGateMod;
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js) — 설정 창 닫기
const refreshLicenseUI = deps.refreshLicenseUI;
const toast = deps.toast;
document.getElementById('licenseSubmitBtn').onclick=async ()=>{
  const input=document.getElementById('licenseKeyInput');
  const err=document.getElementById('licenseErrorMsg');
  const btn=document.getElementById('licenseSubmitBtn');
  const key=(input.value||'').trim();
  if(!key){ err.textContent='라이선스 키를 입력해 주세요'; err.style.display='block'; return; }
  btn.disabled=true; btn.textContent='확인 중...';
  const r=await licenseGateMod.activateLicense(key);
  btn.disabled=false; btn.textContent='확인';
  if(r.ok){
    toast('🎉 라이선스가 등록됐어요! 꾸미기를 이용할 수 있어요');
    refreshLicenseUI();
    setTimeout(()=>{ twNav.go(twNav.NAV.PROGRAM_SETTINGS_CLOSE); }, 900);
  } else {
    err.textContent = r.reason || '등록에 실패했어요'; err.style.display='block';
  }
};
document.getElementById('licenseDeactivateBtn').onclick=()=>{
  licenseGateMod.deactivateLicense(); refreshLicenseUI(); toast('이 기기에서 라이선스가 해제됐어요');
};
document.getElementById('licenseKeyInput').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('licenseSubmitBtn').click(); });

return {

};
}

const api = { createLicenseKey };
if(typeof window !== 'undefined') window.TwLicenseKey = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
