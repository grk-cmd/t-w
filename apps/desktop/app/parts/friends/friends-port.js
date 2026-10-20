/* friends-port.js — 👥 친구 데이터 포트 — 도메인(friends-sub.js) · 화면이 부르는 모양 하나. 어디서 받을지는 provider 가 맡는다
   책임: 친구 목록 받기 · 목록(추가 · 삭제) 듣기 · 접속 상태 듣기 · 프로필(이름 · 레벨 · 회차) 듣기를 provider 로 잇는다. 이 파일 위로는 Firebase · API 를 모른다.
     목록 받기는 받는 곳 고르기(shared/source-switch.js — 기능 'friends')가 서버면 api 먼저 → 못 받으면 옛 길(firebase). 듣기 셋 · 프로필 새로 읽기는 아직 옛 길(ws 는 다음 단계 — LIVE_SOURCE 자리).
   deps: firebase — 옛 길 provider(friends-firebase.js) { listFriends · readFriend · watchList · watchPresence · readPresence · watchProfile · readProfile } ·
         api — api provider(friends-api.js) { listFriends · readFriend } | null · source() → 'server' | 'firebase'(source-switch pick('friends')) ·
         serverFirst(받는 곳, 서버 함수, 파이어베이스 함수, 실패 알림)(source-switch — 넘어가기 한 벌) · warn(...a)
   내보냄: createFriendsPort(deps) → {
     listFriends(myId, opts) → Promise<{ 친구id: 친구 }>   opts.idsOnly — 판정용(id · addedAt 만 있으면 된다)
     readFriend(fid) → Promise<친구 | null>                 새로 생긴 친구 한 명의 이름 · 레벨 · 사진(목록 받기와 같은 서버 먼저) · null = 모름
     watchList(myId, onChange, onError) → 해제 함수         onChange({ 친구id: { addedAt } }) — 추가 · 삭제
     watchPresence(myId, ids, onChange) → 해제 함수         onChange({ 친구id: { online, lastSeen, room, inRoom } }) — 목록이 열려 있는 동안만
     readPresence(fid) → Promise<{ online, lastSeen, room, inRoom }>   한 번 읽기 — 목록이 닫혀 있을 때 그 친구만
     watchProfile(myId, ids, onChange) → 해제 함수          onChange({ 친구id: { name, level, cyc, clv, starC } }) — 목록이 열려 있는 동안만(접속 상태와 같은 수명)
     readProfile(fid) → Promise<{ name, level, cyc, clv, starC }>   한 번 새로 읽기(기억 안 씀) — 목록이 닫혀 있을 때 그 친구 마이홈 구경
     lastSource() → 'api' | 'firebase' | null              마지막 목록 받기가 어디서 왔나(진단)
   }
     순수: SOURCE · LIVE_SOURCE (TwFriendsPort 위)
   친구 하나: { addedAt, name, level, cyc, clv, starC, bio, avatar, online, lastSeen, room, inRoom } — 없는 칸은 그 provider 가 모르는 값.
   검사: checks/sim-friends-port.js */
(function(){
'use strict';

const SOURCE = { API: 'api', FIREBASE: 'firebase' };
const LIVE_SOURCE = SOURCE.FIREBASE;   // 목록 듣기 · 접속 상태 · 프로필 — 다음 단계에서 ws provider 로

function createFriendsPort(deps){
  const firebase = deps.firebase;
  const apiProvider = deps.api || null;
  const source = deps.source;
  const serverFirst = deps.serverFirst;
  const warn = deps.warn;
  let _last = null;

  /* 어디서 받을지 · 넘어가기는 source-switch 한 벌 — 여기서는 서버 길(api provider)이 있는지만 넘긴다. */
  async function listFriends(myId, opts){
    const r = await serverFirst(source(),
      apiProvider ? () => apiProvider.listFriends(myId) : null,
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
  function watchList(myId, onChange, onError){ return firebase.watchList(myId, onChange, onError); }
  function watchPresence(myId, ids, onChange){ return firebase.watchPresence(myId, ids, onChange); }
  function readPresence(fid){ return firebase.readPresence(fid); }
  function watchProfile(myId, ids, onChange){ return firebase.watchProfile(myId, ids, onChange); }
  function readProfile(fid){ return firebase.readProfile(fid); }

  return { listFriends, readFriend, watchList, watchPresence, readPresence, watchProfile, readProfile, lastSource: () => _last };
}

const api = { createFriendsPort, SOURCE, LIVE_SOURCE };
if(typeof window !== 'undefined') window.TwFriendsPort = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
