/* friends-port.js — 👥 친구 데이터 포트 — 도메인(friends-sub.js) · 화면이 부르는 모양 하나. 어디서 받을지는 provider 가 맡는다
   책임: 친구 목록 받기 · 목록(추가 · 삭제) 듣기 · 접속 상태 듣기 · 프로필(이름 · 레벨 · 회차) 듣기 · 끊기를 provider 로 잇는다. 이 파일 위로는 API · realtime 을 모른다.
     서버 provider(friends-api.js) 한 길 — 못 받으면 던진다(옛 Firebase 길로 물러나지 않는다). 접속 상태(듣기 · 읽기)는 realtime provider(friends-presence-rt.js) 하나.
     목록 듣기 · 프로필 듣기는 알림 friends · card 를 받으면 다시 받는다.
   deps: presence — realtime provider(friends-presence-rt.js) { readPresence(ids) · watchPresence(ids, onChange, onStatus) · retryWatch() } ·
         api — 서버 provider(friends-api.js) { listFriends · readFriend · watchList · watchProfile · readProfile · removeFriend }
   내보냄: createFriendsPort(deps) → {
     listFriends(myId, opts) → Promise<{ 친구id: 친구 }>   opts.idsOnly — 판정용(id · addedAt 만 있으면 된다)
     readFriend(fid) → Promise<친구 | null>                 새로 생긴 친구 한 명의 이름 · 레벨 · 사진 · null = 모름
     watchList(myId, onChange, onError) → 해제 함수         onChange({ 친구id: { addedAt } }) — 추가 · 삭제
     removeFriend(myId, fid) → Promise<void>              친구 끊기(못 하면 던진다)
     watchPresence(myId, ids, onChange, onStatus) → 해제 함수   onChange({ 친구id: { online, lastSeen, room, inRoom } }) — 목록이 열려 있는 동안만 · onStatus('waiting' | 'live' | 'failed')
     retryPresence() → bool                               듣기가 못 받음(failed)이면 한 번 다시 묻는다 — 목록을 다시 열 때
     readPresence(ids) → Promise<{ 친구id: 접속 상태 }>      한 번 읽기(100명씩 나눠) — 목록이 닫혀 있을 때 그 친구들만 · 못 받으면 던진다
     watchProfile(myId, ids, onChange) → 해제 함수          onChange({ 친구id: { name, level, cyc, clv, starC } }) — 목록이 열려 있는 동안만(접속 상태와 같은 수명)
     readProfile(fid) → Promise<{ name, level, cyc, clv, starC }>   한 번 새로 읽기(기억 안 씀) — 목록이 닫혀 있을 때 그 친구 마이홈 구경
   }
   친구 하나: { addedAt, name, level, cyc, clv, starC, bio, avatar, online, lastSeen, room, inRoom } — 없는 칸은 그 provider 가 모르는 값.
   검사: checks/sim-friends-port.js */
(function(){
'use strict';

function createFriendsPort(deps){
  const presence = deps.presence;
  const apiProvider = deps.api;

  function listFriends(myId, opts){ return apiProvider.listFriends(myId, opts || {}); }
  function readFriend(fid){ return apiProvider.readFriend(fid); }
  function watchList(myId, onChange, onError){ return apiProvider.watchList(myId, onChange, onError); }
  /* 접속 상태는 내 코드를 받지 않는다 — 서버가 토큰으로 내 친구를 안다(myId 는 부르는 쪽 모양을 맞추려 남긴 자리). */
  function watchPresence(myId, ids, onChange, onStatus){ return presence.watchPresence(ids, onChange, onStatus); }
  function readPresence(ids){ return presence.readPresence(ids); }
  function retryPresence(){ return presence.retryWatch(); }
  function watchProfile(myId, ids, onChange){ return apiProvider.watchProfile(myId, ids, onChange); }
  function readProfile(fid){ return apiProvider.readProfile(fid); }
  function removeFriend(myId, fid){ return apiProvider.removeFriend(fid); }

  return { listFriends, readFriend, watchList, removeFriend, watchPresence, readPresence, retryPresence, watchProfile, readProfile };
}

const api = { createFriendsPort };
if(typeof window !== 'undefined') window.TwFriendsPort = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
