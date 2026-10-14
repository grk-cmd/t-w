/* license-ui.js — 🔑 라이선스 등록 화면 — 상태 표시(refreshLicenseUI)
   app.js «🔑 라이선스 등록 화면 — 상태 표시(refreshLicenseUI)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 48번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 9줄 —
     isPremium · licReqMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: refreshLicenseUI — app.js 는 licenseUiMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLicenseUi — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-license-ui.js */
(function(){

function createLicenseUi(deps){
const isPremium = deps.isPremium;   // 읽는 함수
const licReqMod = deps.licReqMod;   // 읽는 함수
/* --- 라이선스 등록 UI --- */
function refreshLicenseUI(){
  const box=document.getElementById('licenseActiveBox');
  const input=document.getElementById('licenseKeyInput');
  const submitBtn=document.getElementById('licenseSubmitBtn');
  const err=document.getElementById('licenseErrorMsg');
  if(err) err.style.display='none';
  if(box) box.style.display = isPremium() ? 'block' : 'none';
  if(input) input.style.display = isPremium() ? 'none' : 'block';
  if(submitBtn) submitBtn.style.display = isPremium() ? 'none' : 'block';
  const lbl=document.getElementById('lcLicenseLbl');
  if(lbl) lbl.textContent = isPremium() ? '🔓 라이선스 등록됨' : '🔑 라이선스 등록';
  // ★ 요청 섹션(licenseReqSection)은 기본적으로 접혀 숨겨져 있음(대규모 배포 시 아무나 요청 버튼을 누르는 걸 막기 위한 트릭).
  //   [확인] 버튼을 Ctrl 누른 채 3번 연속 클릭하면 펼쳐짐(licenseReqUnlocked). 이미 보낸 요청이 있으면(reqId 저장돼 있음)
  //   트릭을 몰라도 자기 요청 상태(대기중/승인됨)는 볼 수 있게 자동으로 펼쳐줌.
  const reqSection=document.getElementById('licenseReqSection');
  if(reqSection){
    let reqId=null; try{ reqId=localStorage.getItem(licReqMod().LICENSE_REQ_ID_KEY); }catch(e){}
    const shouldOpen = !isPremium() && (!!reqId || licenseReqUnlocked);
    reqSection.classList.toggle('open', shouldOpen);
  }
  if(!isPremium()){
    let reqId=null; try{ reqId=localStorage.getItem(licReqMod().LICENSE_REQ_ID_KEY); }catch(e){}
    if(!reqId) licReqMod()._showLicenseReqState('idle');
    // reqId가 있으면 watchMyLicenseRequest의 콜백이 pending/approved 표시를 갱신함(resumePendingLicenseRequest에서 이미 구독 중)
  }
}
/* --- 라이선스 요청 섹션 비공개 트릭 — [확인] 버튼을 빠르게 3번 연속 클릭하면 펼쳐짐 ---
   대규모 배포 시 구매하지 않은 사람들이 무분별하게 요청을 보내는 걸 막기 위한 장치. 문서/안내에 노출하지 않고
   알음알음 전달하는 용도. 요청사항으로 Ctrl 조합은 제거 — 그냥 3번 연속 클릭만. document 캡처 단계에서
   감지해서, 트릭 발동 시엔 원래의 "빈 키 검증" 로직으로 넘어가지 않게 막아줌(실수로 에러 문구가 같이 뜨는 것 방지). */
let licenseReqUnlocked = false;
/* ★ (제거됨) 연타 3번으로 라이선스 '요청 보내기' 섹션을 여는 기능 — 이제 관리자가 친구코드로 직접
   발급(수령함 전송)하는 방식으로 대체되어, 유저 요청 경로는 비활성화함. 섹션 HTML은 남아 있어도
   열리지 않으므로 표시되지 않는다. */
(function bindLicenseReqSecret(){ /* 비활성화 */ })();

return {
  refreshLicenseUI,
};
}

const api = { createLicenseUi };
if(typeof window !== 'undefined') window.TwLicenseUi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
