/* device-lost.js — 🖥️ 한 계정 한 기기 — 밀려난 기기 처리(여기서 계속 · 안내) (검사 checks/sim-device-lost.js)
   0.13 — «이 기기가 지금 기기» 는 realtime 서버가 정한다: 켤 때 hello claim → 같은 계정의 다른 기기가 claim 하면 이 연결에 sessionLost · 닫힘 4004
   (realtime/rt-hub.js 가 'sessionLost' 상태로 멈추고 login-flow.js 가 여기 _onDeviceSessionLost 를 부른다).
   여기는 «밀려난 뒤 이 기기가 하는 일» 뿐이다 — 방에서 나온다 · 방 입장을 막는다(window._deviceSessionLost — room-entry) · 차단 화면.
   ★ 로그아웃하지 않는다 — 캐릭터 · 기록 · 신원 그대로. «여기서 계속 쓰기» = 같은 연결 하나로 다시 claim(반대쪽이 이 화면을 본다) · «앱 닫기» = quitApp.
   ★ 밖에서 부르는 이름: _onDeviceSessionLost — app.js 는 deviceLostMod.이름 으로 부른다.
   ⚠️ 전역 이름은 TwDeviceLost — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103). */
(function(){

/** @param {{ twNav: { go: Function, NAV: { LEAVE_ROOM: string } }, continueHere: () => void }} deps */
function createDeviceLost(deps){
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js) — 방 나가기
const continueHere = deps.continueHere;   // 다시 claim(realtime 연결 하나 — TwRtHub.store.start({ claim:true }))
window._deviceSessionLost = false;
const LOST_TEXT = { title: '🖥️ 다른 기기에서 사용 중이에요', btn: '여기서 계속 쓰기',
  msg: '이 계정이 방금 다른 PC에서 로그인됐어요. 투게더워킹은 한 번에 한 기기에서만 쓸 수 있어요.\n이 PC의 캐릭터·기록은 그대로 두고, 방 접속만 끊었어요.' };
function _onDeviceSessionLost(){
  if(window._deviceSessionLost) return;
  window._deviceSessionLost = true;
  try{ Promise.resolve(twNav.go(twNav.NAV.LEAVE_ROOM)).catch(()=>{}); }catch(_){}
  const ti = document.getElementById('deviceSessionTitle'), mi = document.getElementById('deviceSessionMsg'), b1 = document.getElementById('deviceSessionContinue');
  if(ti) ti.textContent = LOST_TEXT.title;
  if(mi) mi.textContent = LOST_TEXT.msg;
  if(b1){ b1.textContent = LOST_TEXT.btn; b1.disabled = false; }
  const ov = document.getElementById('deviceSessionOverlay');
  if(ov) ov.style.display = 'flex';
}
/* 이어 쓰기 — 같은 연결로 다시 claim 하고 화면을 닫는다(앱을 다시 켜지 않는다 — 끊긴 것은 realtime 연결 하나뿐이다) */
function _deviceSessionContinueHere(){
  if(!window._deviceSessionLost) return;
  try{ continueHere(); }catch(_){}
  const ov = document.getElementById('deviceSessionOverlay');
  if(ov) ov.style.display = 'none';
  window._deviceSessionLost = false;
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
