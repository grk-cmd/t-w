/* license-key.js — 🔑 라이선스 키 등록 · 해제 버튼
   app.js «🔑 라이선스 키 등록 · 해제 버튼» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 48번 — docs/APP_FSD_MAP.md).
   0.13 — 등록 · 해제는 서버에(license-premium.js activate · deactivate). 이 파일은 버튼 연결과 결과 문구만 한다.
   ★ app.js 함수 2개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLicenseKey — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-license-key.js */
(function(){

function createLicenseKey(deps){
const licensePremiumMod = deps.licensePremiumMod;   // 🔑 프리미엄 판정(license-premium.js) — 키 등록 · 이 기기 해제는 서버에
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js) — 설정 창 닫기
const refreshLicenseUI = deps.refreshLicenseUI;
const toast = deps.toast;
const notifyError = deps.notifyError;   // 번호 토스트(error-codes.js)
document.getElementById('licenseSubmitBtn').onclick=async ()=>{
  const input=document.getElementById('licenseKeyInput');
  const err=document.getElementById('licenseErrorMsg');
  const btn=document.getElementById('licenseSubmitBtn');
  const key=(input.value||'').trim();
  if(!key){ err.textContent='라이선스 키를 입력해 주세요'; err.style.display='block'; return; }
  btn.disabled=true; btn.textContent='확인 중...';
  const r=await licensePremiumMod.activate(key);
  btn.disabled=false; btn.textContent='확인';
  if(r.ok){
    toast('🎉 라이선스가 등록됐어요! 꾸미기를 이용할 수 있어요');
    refreshLicenseUI();
    setTimeout(()=>{ twNav.go(twNav.NAV.PROGRAM_SETTINGS_CLOSE); }, 900);
  } else if(!r.notified){   // 확인 실패 번호(E-LIC-01)를 이미 띄웠으면 입력칸에 같은 실패를 또 적지 않는다
    err.textContent = r.reason || '등록에 실패했어요'; err.style.display='block';
  }
};
document.getElementById('licenseDeactivateBtn').onclick=async ()=>{
  const r=await licensePremiumMod.deactivate();
  refreshLicenseUI();
  if(r.ok) toast('이 기기에서 라이선스가 해제됐어요');
  else if(!(r.err && r.err.kind === 'auth')) notifyError('E-LIC-02', r.err);   // 로그인이 풀린 실패는 로그인 흐름 몫(license-premium.js fail 과 같다)
};
document.getElementById('licenseKeyInput').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('licenseSubmitBtn').click(); });

return {

};
}

const api = { createLicenseKey };
if(typeof window !== 'undefined') window.TwLicenseKey = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
