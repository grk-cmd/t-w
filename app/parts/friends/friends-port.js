/* friends-port.js — 👥 친구 데이터 포트 — 도메인(friends-sub.js) · 화면이 부르는 모양 하나. 어디서 받을지는 provider 가 맡는다
   책임: 친구 목록 받기 · 목록(추가 · 삭제) 듣기 · 접속 상태 듣기를 provider 로 잇는다. 이 파일 위로는 Firebase · API 를 모른다.
   deps: firebase — 옛 길 provider(friends-firebase.js) { listFriends · watchList · watchPresence }
   내보냄: createFriendsPort(deps) → {
     listFriends(myId, opts) → Promise<{ 친구id: 친구 }>   opts.idsOnly — 판정용(id · addedAt 만 있으면 된다)
     watchList(myId, onChange, onError) → 해제 함수         onChange({ 친구id: { addedAt } }) — 추가 · 삭제
     watchPresence(myId, ids, onChange) → 해제 함수         onChange({ 친구id: { online, lastSeen, room, inRoom } })
   }
   친구 하나: { addedAt, name, level, cyc, clv, starC, bio, avatar, online, lastSeen, room, inRoom } — 없는 칸은 그 provider 가 모르는 값.
   검사: checks/sim-friends-port.js */
(function(){
'use strict';

function createFriendsPort(deps){
  const firebase = deps.firebase;

  function listFriends(myId, opts){ return firebase.listFriends(myId, opts || {}); }
  function watchList(myId, onChange, onError){ return firebase.watchList(myId, onChange, onError); }
  function watchPresence(myId, ids, onChange){ return firebase.watchPresence(myId, ids, onChange); }

  return { listFriends, watchList, watchPresence };
}

const api = { createFriendsPort };
if(typeof window !== 'undefined') window.TwFriendsPort = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
