/* friend-requests-port.js — 👋 친구 요청 데이터 포트 — 화면(friend-manage · myhome-ui · seat-friend-req · myhome-init)이 부르는 모양 하나
   책임: 받은 요청 듣기 · 보낸 요청 읽기 · 수락 · 거절 · 취소 · 보내기 · 이름 · 친구코드 찾기를 provider 로 잇는다. 이 파일 위로는 Firebase · API 를 모른다.
     고르기는 받는 곳(shared/source-switch.js — 기능 'friends')이 서버고 서버 provider 가 있으면 서버 · 아니면 옛 길(Firebase) — **하나만**.
     쓰기(수락 · 거절 · 취소 · 보내기)는 못 해도 옛 길로 넘기지 않는다(두 곳에 갈라 쓰지 않게). 읽기도 같은 길 하나(요청은 한쪽 사본만 맞다).
   deps: firebase · api — 같은 모양의 provider(api 는 없으면 null) · source() → 'server' | 'firebase'
   내보냄: createFriendRequestsPort(deps) → {
     watchReceived(myId, onChange, onError) → 해제 함수   onChange({ 보낸이id: { name, ts } })
     listSent(myId) → Promise<{ 받는이id: { ts, toName?, toCode? } }>
     accept(myId, fromId) · reject(myId, fromId) → Promise<void>(못 하면 던진다)
     cancel(myId, toId) · send(myId, toId, myName, toName, toCode) → Promise<{ ok, reason? }>
     lookupName(uid) → Promise<string | null> · lookupFriendCode(code) → Promise<상대 id | null>
   }
   검사: checks/sim-friend-requests.js */
(function(){
'use strict';

function createFriendRequestsPort(deps){
  const pick = () => ((deps.api && deps.source() === 'server') ? deps.api : deps.firebase);
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
