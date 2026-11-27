/* device-lost.js — 🖥️ 이 PC 의 연결이 서버에서 끊긴 뒤(지워짐 · 다른 PC 가 씀 · 새 세션) — 안내 · 다시 등록 · 여기서 계속 (검사 checks/sim-device-lost.js)
   한 계정은 PC 를 서버가 정한 상한까지 등록하고, 쓰는 것은 한 번에 1대다(마지막으로 등록한 PC). 자리(기기 등록)는 서버 API 가 정하고 realtime 이 그대로 따른다(account/device-register.js).
   realtime 이 이 연결을 sessionLost · 닫힘 4004 로 끊으면(realtime/rt-hub.js) login-flow.js 가 여기 _onDeviceSessionLost(kind) 를 부른다.
     kind 'deviceRemoved' — 다른 PC 에서 이 기기를 지웠다(또는 등록돼 있지 않음) → «이 PC 다시 등록»
     kind 'otherDevice'   — 계정의 다른 PC 가 켜져 지금 쓰는 PC 가 됐다(이 PC 등록은 그대로) → «여기서 계속 쓰기»
     kind 'sessionLost'   — 이 PC 에서 앱을 새로 열어 이 창의 세션이 밀렸다 → «여기서 계속 쓰기»
   단추는 모두 continueHere() — 이 PC 를 다시 등록하고(상한이 다 찼으면 확인창) 같은 realtime 연결 하나로 다시 붙는다. 등록하지 못하면(취소 · 실패) 화면을 그대로 둔다.
   같은 계정이 다른 PC 에서 같은 방에 들어온 것(left replaced)은 이 화면이 아니다 — 방에서만 나온다(room-entry.js).
   여기는 «끊긴 뒤 이 PC 가 하는 일» 뿐이다 — 방에서 나온다 · 방 입장을 막는다(window._deviceSessionLost — room-entry) · 안내 화면.
   ★ 로그아웃하지 않는다 — 캐릭터 · 기록 · 신원 그대로. «앱 닫기» = quitApp.
   ★ 밖에서 부르는 이름: _onDeviceSessionLost — app.js 는 deviceLostMod.이름 으로 부른다.
   ⚠️ 전역 이름은 TwDeviceLost — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103). */
(function(){

/** @param {{ twNav: { go: Function, NAV: { LEAVE_ROOM: string } }, continueHere: () => Promise<boolean> }} deps */
function createDeviceLost(deps){
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js) — 방 나가기
const continueHere = deps.continueHere;   // 이 PC 다시 등록 → realtime 다시 붙기 — 붙일 수 있게 됐으면 true(취소 · 실패는 false)
window._deviceSessionLost = false;
const DEVICE_LOST_KIND = Object.freeze({ REMOVED: 'deviceRemoved', OTHER: 'otherDevice', SESSION: 'sessionLost' });
const DEVICE_LOST_TEXT = Object.freeze({
  [DEVICE_LOST_KIND.REMOVED]: { title: '다른 PC에서 이 기기를 지웠어요', btn: '이 PC 다시 등록', msg: '다시 등록하면 바로 이어서 쓸 수 있어요.' },
  [DEVICE_LOST_KIND.OTHER]: { title: '다른 기기에서 사용 중이에요', btn: '여기서 계속 쓰기', msg: '한 번에 한 PC에서만 쓸 수 있어요. 여기서 계속 쓰면 다른 PC는 연결이 끊겨요.' },
  [DEVICE_LOST_KIND.SESSION]: { title: '이 PC의 다른 창에서 쓰는 중이에요', btn: '여기서 계속 쓰기', msg: '' },
});

let _devLostBusy = false;
const _devLostEl = (id) => document.getElementById(id);
function _onDeviceSessionLost(kind){
  const t = DEVICE_LOST_TEXT[kind] || DEVICE_LOST_TEXT[DEVICE_LOST_KIND.SESSION];
  const first = !window._deviceSessionLost;
  window._deviceSessionLost = true;
  if(first){ try{ Promise.resolve(twNav.go(twNav.NAV.LEAVE_ROOM)).catch(()=>{}); }catch(_){} }
  const ti = _devLostEl('deviceSessionTitle'), mi = _devLostEl('deviceSessionMsg'), b1 = _devLostEl('deviceSessionContinue');
  if(ti) ti.textContent = t.title;
  if(mi){ mi.textContent = t.msg; mi.style.display = t.msg ? '' : 'none'; }
  if(b1){ b1.textContent = t.btn; b1.disabled = _devLostBusy; }
  const ov = _devLostEl('deviceSessionOverlay');
  if(ov) ov.style.display = 'flex';
}
/* 다시 등록 · 여기서 계속 — 등록이 되면 같은 연결로 다시 붙고 화면을 닫는다(앱을 다시 켜지 않는다 — 끊긴 것은 realtime 연결 하나뿐이다) */
async function _deviceSessionContinueHere(){
  if(!window._deviceSessionLost || _devLostBusy) return;
  _devLostBusy = true;
  const b1 = _devLostEl('deviceSessionContinue');
  if(b1) b1.disabled = true;
  let ok = false;
  try{ ok = (await continueHere()) === true; }catch(_){ ok = false; }
  _devLostBusy = false;
  if(b1) b1.disabled = false;
  if(!ok) return;   // 취소 · 실패 — 화면을 그대로 둔다(실패 번호는 등록 쪽이 알렸다)
  const ov = _devLostEl('deviceSessionOverlay');
  if(ov) ov.style.display = 'none';
  window._deviceSessionLost = false;
}
{
  const b1 = _devLostEl('deviceSessionContinue');
  const b2 = _devLostEl('deviceSessionQuit');
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
