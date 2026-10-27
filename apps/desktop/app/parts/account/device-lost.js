/* device-lost.js — 🖥️ 한 계정 한 기기 — 밀려난 기기 처리(여기서 계속 · 안내)
   app.js «🖥️ 한 계정 한 기기 — 밀려난 기기 처리(여기서 계속 · 안내)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 46번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     방 나가기는 창 열기 통로(nav.js)로 부탁한다(모듈 순환 끊기 6 — 예전엔 roomEntryMod 를 이름() 으로 읽었다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 1개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _onDeviceSessionLost — app.js 는 deviceLostMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwDeviceLost — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-device-lost.js */
(function(){

function createDeviceLost(deps){
const getMyUserId = deps.getMyUserId;
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js) — 방 나가기
const _acctRelaunchAfterDetach = deps._acctRelaunchAfterDetach;   // 앱 다시 켜기(account-state.js) — 못 하면 onFallback 을 부르고 false
window._deviceSessionLost = false;
/* 왜 밀렸나 — 세션 구독이 읽기 거부로 끊기면(firebase-init 이 null 을 넘긴다) 다른 기기 로그인이 아니라, 같은 계정의 옛 앱
   (presence 에 ver 없음)이 켜져 있어 규칙이 이 앱의 읽기를 막은 경우가 대부분이다. 같은 «다른 기기» 안내를 띄우면
   [여기서 계속] 을 눌러도 옛 앱이 켜져 있는 한 다시 막혀 같은 화면만 되풀이된다 — 무엇을 끄면 되는지 알려 준다. */
const LOST_TEXT = {
  device: { title: '🖥️ 다른 기기에서 사용 중이에요', btn: '여기서 계속 쓰기',
    msg: '이 계정이 방금 다른 PC에서 로그인됐어요. 투게더워킹은 한 번에 한 기기에서만 쓸 수 있어요.\n이 PC의 캐릭터·기록은 그대로 두고, 방 접속만 끊었어요.' },
  oldApp: { title: '🖥️ 옛 버전 투게더워킹이 켜져 있어요', btn: '다시 시도',
    msg: '서버가 이 PC의 읽기를 막고 있어요. 같은 계정으로 옛 버전 투게더워킹(맥 등)이 켜져 있으면 이렇게 돼요.\n그 기기에서 앱을 업데이트하거나 꺼 준 뒤 [다시 시도]를 눌러 주세요.' },
};
function lostKind(v){ return v === null ? 'oldApp' : 'device'; }
function _onDeviceSessionLost(v){
  if(window._deviceSessionLost) return;
  window._deviceSessionLost = true;
  try{ Promise.resolve(twNav.go(twNav.NAV.LEAVE_ROOM)).catch(()=>{}); }catch(_){}
  const t = LOST_TEXT[lostKind(v)];
  const ti = document.getElementById('deviceSessionTitle'), mi = document.getElementById('deviceSessionMsg'), b1 = document.getElementById('deviceSessionContinue');
  if(ti) ti.textContent = t.title;
  if(mi) mi.textContent = t.msg;
  if(b1){ b1.textContent = t.btn; _continueLabel = t.btn; }
  const ov = document.getElementById('deviceSessionOverlay');
  if(ov) ov.style.display = 'flex';
}
/* 이어 쓰기 = 내 presence(ver 실림) · 기기 세션을 다시 쓴 뒤 앱을 다시 켠다.
   밀어낸 쪽이 같은 계정의 ≤0.10.2 면 presence 가 «켜짐 · ver 없음» 이 되는 순간 규칙(옛 앱 읽기 막기)이 이 앱의
   구독(친구 · 카탈로그 · 알림 …)을 다 끊고, 끊긴 구독은 다시 걸리지 않는다 — 다시 켜야 산다.
   ⚠️ 다시 켜기 전에 presence(ver)부터 — «ver 없음» 인 채로 켜면 부팅 구독이 또 막힌다.
   다시 켜기를 못 하는 판이면 여기서 화면만 닫는다(예전과 같다). */
let _continuing = false;
let _continueLabel = '';   // 다시 켜는 동안 바꾼 버튼 글 — 다시 켜기를 못 해 여기서 이어 가면 되돌린다
function _continueInPlace(){
  const b1 = document.getElementById('deviceSessionContinue');
  if(b1){ b1.disabled = false; b1.textContent = _continueLabel; }
  _continuing = false;
  const ov = document.getElementById('deviceSessionOverlay');
  if(ov) ov.style.display = 'none';
  window._deviceSessionLost = false;
}
async function _deviceSessionContinueHere(){
  if(_continuing) return;   // 이미 누름
  _continuing = true;
  const b1 = document.getElementById('deviceSessionContinue');
  if(b1){ _continueLabel = b1.textContent; b1.disabled = true; b1.textContent = '다시 시작하는 중…'; }
  const myId = getMyUserId();
  try{
    /* presence 재등록 — 밀릴 때 _myPresenceRef 를 놓았으므로 setMyPresenceOnline 의 «중복 등록 방지» 를 지나 다시 건다. */
    if(window.firebaseAPI && firebaseAPI.setMyPresenceOnline) firebaseAPI.setMyPresenceOnline(myId);
    if(window.firebaseAPI && firebaseAPI.claimDeviceSession) await firebaseAPI.claimDeviceSession(myId, _onDeviceSessionLost);
  }catch(_){}
  _acctRelaunchAfterDetach(_continueInPlace);
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
