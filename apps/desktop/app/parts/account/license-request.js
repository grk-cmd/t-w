/* license-request.js — 📨 라이선스 요청(일반 유저 → 관리자)
   app.js «📨 라이선스 요청(일반 유저 → 관리자)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 43번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 4개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: LICENSE_REQ_ID_KEY · _showLicenseReqState — app.js 는 licReqMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLicenseRequest — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-license-request.js */
(function(){

function createLicenseRequest(deps){
const _saveFailMsg = deps._saveFailMsg;
const getDisplayName = deps.getDisplayName;
const licenseGateMod = deps.licenseGateMod;
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js)
const refreshLicenseUI = deps.refreshLicenseUI;
const toast = deps.toast;
/* --- 라이선스 요청(일반 유저 → 관리자) --- */
const LICENSE_REQ_ID_KEY='tw.licenseReqId';
function _showLicenseReqState(state){
  const idle=document.getElementById('licenseReqIdle'), pending=document.getElementById('licenseReqPending'), approved=document.getElementById('licenseReqApproved');
  if(!idle) return;
  idle.style.display = state==='idle' ? 'block':'none';
  pending.style.display = state==='pending' ? 'block':'none';
  approved.style.display = state==='approved' ? 'block':'none';
}
function watchMyLicenseRequest(reqId){
  if(!window.firebaseAPI || !window.firebaseAPI.subscribeMyLicenseRequest) return;
  window.firebaseAPI.subscribeMyLicenseRequest(reqId, data=>{
    if(!data){
      // 노드가 사라짐 = 관리자가 거절함 — 처음(idle) 상태로 되돌려서 다시 요청할 수 있게 함
      try{ localStorage.removeItem(LICENSE_REQ_ID_KEY); }catch(e){}
      _showLicenseReqState('idle');
      return;
    }
    if(data.status==='approved' && data.issuedKey){
      document.getElementById('licenseReqKeyText').textContent=data.issuedKey;
      _showLicenseReqState('approved');
      // 발급된 키가 그 이후에 회수(valid:false)되는지도 계속 지켜봄 — "발급됐어요" 화면이 떠있는데
      // 정작 키는 이미 죽어있는 상황을 방지.
      if(window.firebaseAPI.subscribeLicenseValidity){
        window.firebaseAPI.subscribeLicenseValidity(data.issuedKey, lic=>{
          if(lic && lic.valid===false){
            try{ localStorage.removeItem(LICENSE_REQ_ID_KEY); }catch(e){}
            _showLicenseReqState('idle');
            toast('발급됐던 라이선스가 회수됐어요');
          }
        });
      }
    } else {
      document.getElementById('licenseReqName').textContent=data.name||'';
      _showLicenseReqState('pending');
    }
  });
}
document.getElementById('licenseReqBtn').onclick=async ()=>{
  if(!window.firebaseAPI || !window.firebaseAPI.requestLicense){ toast('네트워크 연결을 확인해 주세요'); return; }
  const btn=document.getElementById('licenseReqBtn'); btn.disabled=true; btn.textContent='보내는 중...';
  try{
    const reqId=await window.firebaseAPI.requestLicense(getDisplayName());
    try{ localStorage.setItem(LICENSE_REQ_ID_KEY, reqId); }catch(e){}
    document.getElementById('licenseReqName').textContent=getDisplayName();
    _showLicenseReqState('pending');
    watchMyLicenseRequest(reqId);
  }catch(e){ toast(_saveFailMsg(e, '요청 실패 — 네트워크를 확인해 주세요')); }
  btn.disabled=false; btn.textContent='🙋 라이선스 요청 보내기';
};
document.getElementById('licenseReqApplyBtn').onclick=async ()=>{
  const key=document.getElementById('licenseReqKeyText').textContent; if(!key) return;
  const r=await licenseGateMod.activateLicense(key);
  if(r.ok){
    toast('🎉 라이선스가 등록됐어요! 꾸미기를 이용할 수 있어요');
    try{ localStorage.removeItem(LICENSE_REQ_ID_KEY); }catch(e){}
    refreshLicenseUI();
    setTimeout(()=>{ twNav.go(twNav.NAV.PROGRAM_SETTINGS_CLOSE); }, 900);
  } else { toast('적용 실패: '+(r.reason||'')); }
};
// 앱을 껐다 켜도 예전에 보낸 요청이 있으면 이어서 지켜봄(관리자가 그 사이 승인했을 수도 있으니)
(function resumePendingLicenseRequest(){
  let reqId=null; try{ reqId=localStorage.getItem(LICENSE_REQ_ID_KEY); }catch(e){}
  if(!reqId) return;
  TwNetReady.whenNetReady(()=>watchMyLicenseRequest(reqId));
})();

/* --- 관리자 비밀번호 창 버튼 연결은 admin/admin-mode.js 로 옮겼다(관리자 모드 진입과 한 묶음) --- */

return {
  LICENSE_REQ_ID_KEY,
  _showLicenseReqState,
};
}

const api = { createLicenseRequest };
if(typeof window !== 'undefined') window.TwLicenseRequest = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
