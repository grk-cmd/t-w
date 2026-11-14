/* friend-requests-firebase.js — 👋 친구 요청 옛 길 provider(Firebase · 나중에 걷음) — friend-requests-port.js 가 부른다
   책임: firebaseAPI 의 친구 요청 함수를 포트 모양으로 바꾼다(firebaseAPI 를 직접 부르지 않는다 — app.js 가 deps 로 잇는다).
     📤 보낸 요청은 미러 노드(sentFriendRequests/{나})를 읽고 한 건씩 진짜 요청이 살아 있는지 확인해 죽은 것은 뺀다 · 서버에서도 치운다
     (구버전이 수락하면 미러가 남는다 — 확인이 실패하면 살아 있는 것으로 본다).
   deps: subscribe(myId, onChange) · getSent(myId) · isAlive(toId, myId) · prune(myId, toId) · accept(myId, fromId) · reject(myId, fromId) ·
         cancel(myId, toId) → { ok, reason } · send(myId, toId, myName, toName, toCode) → { ok, reason } · getName(uid) · lookupCode(code)
   내보냄: createFriendRequestsFirebase(deps) → 포트가 부르는 모양(friend-requests-api.js 와 같다)
   검사: checks/sim-friend-requests.js */
(function(){
'use strict';

function createFriendRequestsFirebase(deps){
  async function listSent(myId){
    const raw = (await deps.getSent(myId)) || {};
    const out = {};
    for(const toId of Object.keys(raw)){
      const ok = deps.isAlive ? await deps.isAlive(toId, myId) : true;
      if(ok) out[toId] = raw[toId];
      else if(deps.prune) deps.prune(myId, toId);   // 기다리지 않는다
    }
    return out;
  }
  return {
    watchReceived: (myId, onChange, onError) => deps.subscribe(myId, (v) => onChange(v || {}), onError),
    listSent,
    accept: (myId, fromId) => deps.accept(myId, fromId),
    reject: (myId, fromId) => deps.reject(myId, fromId),
    cancel: (myId, toId) => deps.cancel(myId, toId),
    send: (...a) => deps.send(...a),
    lookupName: (uid) => deps.getName(uid),
    lookupFriendCode: (code) => deps.lookupCode(code),
  };
}

const api = { createFriendRequestsFirebase };
if(typeof window !== 'undefined') window.TwFriendRequestsFirebase = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
