/* friend-requests-port.js — 👋 친구 요청 데이터 포트 — 화면(friend-manage · myhome-ui · seat-friend-req · myhome-init)이 부르는 모양 하나
   책임: 받은 요청 듣기 · 보낸 요청 읽기 · 수락 · 거절 · 취소 · 보내기 · 이름 · 친구코드 찾기를 provider 로 잇는다. 이 파일 위로는 Firebase · API 를 모른다.
     서버 provider(friend-requests-api.js) 한 길뿐이다 — 못 하면 던진다(옛 Firebase 경로로 물러나지 않는다).
   deps: api — 서버 provider(friend-requests-api.js)
   내보냄: createFriendRequestsPort(deps) → {
     watchReceived(myId, onChange, onError) → 해제 함수   onChange({ 보낸이id: { name, ts, msg? } })
     listSent(myId) → Promise<{ 받는이id: { ts, toName?, toCode? } }>
     accept(myId, fromId) · reject(myId, fromId) → Promise<void>(못 하면 던진다)
     cancel(myId, toId) · send(myId, toId, msg?) → Promise<{ ok, reason? }>
     lookupName(uid) → Promise<string | null> · lookupFriendCode(code) → Promise<상대 id | null>
   }
   검사: checks/sim-friend-requests.js */
(function(){
'use strict';

function createFriendRequestsPort(deps){
  const pick = () => deps.api;
  return {
    watchReceived: (...a) => pick().watchReceived(...a),
    listSent: (...a) => pick().listSent(...a),
    accept: (...a) => pick().accept(...a),
    reject: (...a) => pick().reject(...a),
    cancel: (...a) => pick().cancel(...a),
    send: (...a) => pick().send(...a),
    lookupName: (...a) => pick().lookupName(...a),
    lookupFriendCode: (...a) => pick().lookupFriendCode(...a),
  };
}

const api = { createFriendRequestsPort };
if(typeof window !== 'undefined') window.TwFriendRequestsPort = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
