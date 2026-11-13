/* friends-port.js — 👥 친구 데이터 포트 — 도메인(friends-sub.js) · 화면이 부르는 모양 하나. 어디서 받을지는 provider 가 맡는다
   책임: 친구 목록 받기 · 목록(추가 · 삭제) 듣기 · 접속 상태 듣기 · 프로필(이름 · 레벨 · 회차) 듣기 · 끊기를 provider 로 잇는다. 이 파일 위로는 Firebase · API 를 모른다.
     받는 곳 고르기(shared/source-switch.js — 기능 'friends')가 서버면 api(서버 길) 먼저 → 목록 · 한 명 · 프로필 새로 읽기는 못 받으면 옛 길(firebase). 접속 상태(듣기 · 읽기)는 realtime provider(friends-presence-rt.js) 하나 —
     옛 길로 넘어가지 않는다. 목록 듣기 · 프로필 듣기 · 끊기(쓰기)는 고른 길 하나만 — 서버면 api(알림 friends · card 를 받으면 다시 받기), 아니면 firebase. 쓰기는 옛 길로 넘기지 않는다(두 곳에 갈라 쓰지 않게).
   deps: firebase — 옛 길 provider(friends-firebase.js) { listFriends · readFriend · watchList · watchProfile · readProfile · removeFriend } ·
         presence — realtime provider(friends-presence-rt.js) { readPresence(ids) · watchPresence(ids, onChange, onStatus) · retryWatch() } ·
         api — 서버 provider(friends-api.js) { listFriends · readFriend · watchList · watchProfile · readProfile · removeFriend } | null · source() → 'server' | 'firebase'(source-switch pick('friends')) ·
         serverFirst(받는 곳, 서버 함수, 파이어베이스 함수, 실패 알림)(source-switch — 넘어가기 한 벌) · warn(...a)
   내보냄: createFriendsPort(deps) → {
     listFriends(myId, opts) → Promise<{ 친구id: 친구 }>   opts.idsOnly — 판정용(id · addedAt 만 있으면 된다)
     readFriend(fid) → Promise<친구 | null>                 새로 생긴 친구 한 명의 이름 · 레벨 · 사진(목록 받기와 같은 서버 먼저) · null = 모름
     watchList(myId, onChange, onError) → 해제 함수         onChange({ 친구id: { addedAt } }) — 추가 · 삭제
     removeFriend(myId, fid) → Promise<void>              친구 끊기 — 고른 길 하나로만(못 하면 던진다)
     watchPresence(myId, ids, onChange, onStatus) → 해제 함수   onChange({ 친구id: { online, lastSeen, room, inRoom } }) — 목록이 열려 있는 동안만 · onStatus('waiting' | 'live' | 'failed')
     retryPresence() → bool                               듣기가 못 받음(failed)이면 한 번 다시 묻는다 — 목록을 다시 열 때
     readPresence(ids) → Promise<{ 친구id: 접속 상태 }>      한 번 읽기(100명씩 나눠) — 목록이 닫혀 있을 때 그 친구들만 · 못 받으면 던진다
     watchProfile(myId, ids, onChange) → 해제 함수          onChange({ 친구id: { name, level, cyc, clv, starC } }) — 목록이 열려 있는 동안만(접속 상태와 같은 수명)
     readProfile(fid) → Promise<{ name, level, cyc, clv, starC }>   한 번 새로 읽기(기억 안 씀) — 목록이 닫혀 있을 때 그 친구 마이홈 구경
     lastSource() → 'api' | 'firebase' | null              마지막 목록 받기가 어디서 왔나(진단)
   }
     순수: SOURCE (TwFriendsPort 위)
   친구 하나: { addedAt, name, level, cyc, clv, starC, bio, avatar, online, lastSeen, room, inRoom } — 없는 칸은 그 provider 가 모르는 값.
   검사: checks/sim-friends-port.js */
(function(){
'use strict';

const SOURCE = { API: 'api', FIREBASE: 'firebase' };

function createFriendsPort(deps){
  const firebase = deps.firebase;
  const presence = deps.presence;
  const apiProvider = deps.api || null;
  const source = deps.source;
  const serverFirst = deps.serverFirst;
  const warn = deps.warn;
  let _last = null;

  /* 어디서 받을지 · 넘어가기는 source-switch 한 벌 — 여기서는 서버 길(api provider)이 있는지만 넘긴다. */
  async function listFriends(myId, opts){
    const r = await serverFirst(source(),
      apiProvider ? () => apiProvider.listFriends(myId, opts || {}) : null,
      () => firebase.listFriends(myId, opts || {}),
      (e) => warn('[친구 목록] 서버에서 못 받음 — 옛 길(Firebase)로', (e && (e.status || e.code || e.message)) || e));
    _last = r.from === 'server' ? SOURCE.API : SOURCE.FIREBASE;
    return r.v;
  }
  /* 친구 한 명 — 목록 받기와 같은 고르기 · 넘어가기. lastSource 는 목록 받기만 적는다. */
  async function readFriend(fid){
    const r = await serverFirst(source(),
      apiProvider ? () => apiProvider.readFriend(fid) : null,
      () => firebase.readFriend(fid),
      (e) => warn('[친구 목록] 친구 한 명을 서버에서 못 받음 — 옛 길(Firebase)로', (e && (e.status || e.code || e.message)) || e));
    return r.v;
  }
  /* 듣기 · 쓰기는 고른 길 하나 — 서버면 서버 provider · 아니면 옛 길. 서버 길이 없으면(api null) 옛 길. */
  const viaServer = () => !!apiProvider && source() === 'server';
  function watchList(myId, onChange, onError){ return (viaServer() ? apiProvider : firebase).watchList(myId, onChange, onError); }
  /* 접속 상태는 내 코드를 받지 않는다 — 서버가 토큰으로 내 친구를 안다(myId 는 부르는 쪽 모양을 맞추려 남긴 자리). */
  function watchPresence(myId, ids, onChange, onStatus){ return presence.watchPresence(ids, onChange, onStatus); }
  function readPresence(ids){ return presence.readPresence(ids); }
  function retryPresence(){ return presence.retryWatch(); }
  function watchProfile(myId, ids, onChange){ return (viaServer() ? apiProvider : firebase).watchProfile(myId, ids, onChange); }
  async function readProfile(fid){
    const r = await serverFirst(source(),
      apiProvider ? () => apiProvider.readProfile(fid) : null,
      () => firebase.readProfile(fid),
      (e) => warn('[친구 목록] 프로필을 서버에서 못 받음 — 옛 길(Firebase)로', (e && (e.status || e.code || e.message)) || e));
    return r.v;
  }
  function removeFriend(myId, fid){ return viaServer() ? apiProvider.removeFriend(fid) : firebase.removeFriend(myId, fid); }

  return { listFriends, readFriend, watchList, removeFriend, watchPresence, readPresence, retryPresence, watchProfile, readProfile, lastSource: () => _last };
}

const api = { createFriendsPort, SOURCE };
if(typeof window !== 'undefined') window.TwFriendsPort = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
