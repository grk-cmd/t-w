/* device-lost.js — 🖥️ 한 계정 한 기기 — 밀려난 기기 처리(여기서 계속 · 안내)
   app.js «🖥️ 한 계정 한 기기 — 밀려난 기기 처리(여기서 계속 · 안내)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 46번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     roomEntryMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 1개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _onDeviceSessionLost — app.js 는 deviceLostMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwDeviceLost — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-device-lost.js */
(function(){

function createDeviceLost(deps){
const getMyUserId = deps.getMyUserId;
const roomEntryMod = deps.roomEntryMod;   // 읽는 함수
window._deviceSessionLost = false;
function _onDeviceSessionLost(){
  if(window._deviceSessionLost) return;
  window._deviceSessionLost = true;
  try{ if(typeof roomEntryMod().doLeaveRoom === 'function') Promise.resolve(roomEntryMod().doLeaveRoom()).catch(()=>{}); }catch(_){}
  const ov = document.getElementById('deviceSessionOverlay');
  if(ov) ov.style.display = 'flex';
}
function _deviceSessionContinueHere(){
  const ov = document.getElementById('deviceSessionOverlay');
  if(ov) ov.style.display = 'none';
  window._deviceSessionLost = false;
  const myId = getMyUserId();
  try{
    if(window.firebaseAPI && firebaseAPI.claimDeviceSession) firebaseAPI.claimDeviceSession(myId, _onDeviceSessionLost);
    /* presence 재등록 — 밀릴 때 _myPresenceRef 를 놓았으므로 setMyPresenceOnline 의 «중복 등록 방지» 를 지나 다시 건다. */
    if(window.firebaseAPI && firebaseAPI.setMyPresenceOnline) firebaseAPI.setMyPresenceOnline(myId);
  }catch(_){}
}
{
  const b1 = document.getElementById('deviceSessionContinue');
  const b2 = document.getElementById('deviceSessionQuit');
  if(b1) b1.onclick = _deviceSessionContinueHere;
  if(b2) b2.onclick = ()=>{ try{ if(window.companion && companion.quitApp) companion.quitApp(); else window.close(); }catch(_){} };
}

return {
  _onDeviceSessionLost,
};
}

const api = { createDeviceLost };
if(typeof window !== 'undefined') window.TwDeviceLost = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
