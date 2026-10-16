/* friends-port.js — 👥 친구 데이터 포트 — 도메인(friends-sub.js) · 화면이 부르는 모양 하나. 어디서 받을지는 provider 가 맡는다
   책임: 친구 목록 받기 · 목록(추가 · 삭제) 듣기 · 접속 상태 듣기를 provider 로 잇는다. 이 파일 위로는 Firebase · API 를 모른다.
     목록 받기는 api 먼저(스위치가 켜져 있을 때) → 못 받으면 옛 길(firebase). 듣기 둘은 아직 옛 길(ws 는 다음 단계 — LIVE_SOURCE 자리).
   deps: firebase — 옛 길 provider(friends-firebase.js) { listFriends · watchList · watchPresence } ·
         api — api provider(friends-api.js) { listFriends } | null · apiOn() → boolean(원격 설정 flags.friendsApi — 끄는 스위치) · warn(...a)
   내보냄: createFriendsPort(deps) → {
     listFriends(myId, opts) → Promise<{ 친구id: 친구 }>   opts.idsOnly — 판정용(id · addedAt 만 있으면 된다)
     watchList(myId, onChange, onError) → 해제 함수         onChange({ 친구id: { addedAt } }) — 추가 · 삭제
     watchPresence(myId, ids, onChange) → 해제 함수         onChange({ 친구id: { online, lastSeen, room, inRoom } })
     lastSource() → 'api' | 'firebase' | null              마지막 목록 받기가 어디서 왔나(진단)
   }
     순수: pickListSource(apiOn, hasApi) · SOURCE · LIVE_SOURCE (TwFriendsPort 위)
   친구 하나: { addedAt, name, level, cyc, clv, starC, bio, avatar, online, lastSeen, room, inRoom } — 없는 칸은 그 provider 가 모르는 값.
   검사: checks/sim-friends-port.js */
(function(){
'use strict';

const SOURCE = { API: 'api', FIREBASE: 'firebase' };
const LIVE_SOURCE = SOURCE.FIREBASE;   // 목록 듣기 · 접속 상태 — 다음 단계에서 ws provider 로

/* ★ 목록을 어디서 받을지 고르는 곳은 이 함수 하나다. 스위치(apiOn)는 끌 때만 false — 값이 없으면 켜짐.
   비율 · 단계 켜기는 없다(사용자 확정 10-17). */
function pickListSource(apiOn, hasApi){
  return (apiOn !== false && hasApi) ? SOURCE.API : SOURCE.FIREBASE;
}

function createFriendsPort(deps){
  const firebase = deps.firebase;
  const apiProvider = deps.api || null;
  const apiOn = deps.apiOn;
  const warn = deps.warn;
  let _last = null;

  const _apiOn = () => { try{ return apiOn(); }catch(_){ return true; } };

  async function listFriends(myId, opts){
    if(pickListSource(_apiOn(), !!apiProvider) === SOURCE.API){
      try{
        const v = await apiProvider.listFriends(myId);
        _last = SOURCE.API;
        return v;
      }catch(e){
        warn('[친구 목록] 서버에서 못 받음 — 옛 길(Firebase)로', (e && (e.status || e.code || e.message)) || e);
      }
    }
    const v = await firebase.listFriends(myId, opts || {});
    _last = SOURCE.FIREBASE;
    return v;
  }
  function watchList(myId, onChange, onError){ return firebase.watchList(myId, onChange, onError); }
  function watchPresence(myId, ids, onChange){ return firebase.watchPresence(myId, ids, onChange); }

  return { listFriends, watchList, watchPresence, lastSource: () => _last };
}

const api = { createFriendsPort, pickListSource, SOURCE, LIVE_SOURCE };
if(typeof window !== 'undefined') window.TwFriendsPort = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
