/* friends-firebase.js — 👥 친구 데이터 옛 길 provider(Firebase · 나중에 걷음) — friends-port.js 가 부른다
   책임: firebase-init.js 의 친구 함수(firebaseAPI)를 포트 모양으로 바꾼다. firebaseAPI 를 직접 부르지 않는다(app.js 가 deps 로 잇는다).
   deps: getList(myId) → Promise<{친구id:{addedAt}}>(users/{나}/friends 한 번) ·
         watchAll(myId, onChange, onError) → 해제 함수(목록 + 친구별 프로필 · 접속 · 소개 · 사진 — firebase-init subscribeMyFriends)
   내보냄: createFriendsFirebase(deps) → { listFriends(myId, opts) · watchList(myId, onChange, onError) · watchPresence(myId, ids, onChange) }
   ⚠️ 옛 길의 watchList 는 접속 상태까지 같이 실어 온다 — watchPresence 는 따로 걸 것이 없어 빈 해제 함수다.
   검사: checks/sim-friends-port.js */
(function(){
'use strict';

const NOOP = function(){};

function createFriendsFirebase(deps){
  const getList = deps.getList;
  const watchAll = deps.watchAll;

  async function listFriends(myId){ return (await getList(myId)) || {}; }
  function watchList(myId, onChange, onError){ return watchAll(myId, onChange, onError); }
  function watchPresence(){ return NOOP; }

  return { listFriends, watchList, watchPresence };
}

const api = { createFriendsFirebase };
if(typeof window !== 'undefined') window.TwFriendsFirebase = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
