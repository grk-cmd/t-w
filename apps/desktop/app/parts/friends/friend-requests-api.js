/* friend-requests-api.js — 👋 친구 요청 서버 provider — social-api.js 위: 받은 요청 · 보낸 요청(이름 얹기) · 보내기 · 수락 · 거절 · 취소 · 친구코드 찾기 · 알림(friendRequests)
   책임: 요청 목록 한 번 받기 + 상대 이름(명함)을 얹어 화면 칸({ 상대id: { name, ts } })으로 맞춘다. 서버 길 자체는 social-api.js.
     다시 묻지 않는다 — 받은 요청 듣기는 처음 한 번 + friendRequests 알림(· 오래 끊겼다 붙을 때)마다 다시 받고, 받는 중에 알림이 여럿 와도 요청은 하나(끝난 뒤 한 번 더).
     이름 명함을 못 받아도 요청 목록은 그린다(이름은 빈칸 — 화면이 «(이름 없음)») — 요청을 못 받는 것보다 낫다.
   deps: social — createSocialApi 가 돌려준 것 · rt — 알림 걸기(TwRtHub.store.on) · warn(...a)
   내보냄: createFriendRequestsApi(deps) → {
     watchReceived(myId, onChange, onError) → 해제 함수   onChange({ 보낸이id: { name, ts } }) · 못 받으면 onError(e)
     listSent(myId) → Promise<{ 받는이id: { ts, toName } }>   못 받으면 던진다
     accept(myId, fromId) · reject(myId, fromId) → Promise<void>   못 하면 던진다
     cancel(myId, toId) → Promise<{ ok, reason? }>     reason = 서버 코드
     send(myId, toId, myName, toName, toCode) → Promise<{ ok, reason? }>   reason = 'already' | 'self' | 서버 코드(이름 · 코드는 서버가 알아서 — 안 보냄)
     lookupName(uid) → Promise<string | null>
     lookupFriendCode(code) → Promise<userCode | null>
   }
   검사: checks/sim-friend-requests.js */
(function(){
'use strict';

function createFriendRequestsApi(deps){
  const social = deps.social;
  const rt = deps.rt;
  const warn = deps.warn;

  async function namesOf(codes){
    if(!codes.length) return {};
    try{ return await social.fetchCards(codes); }
    catch(e){ warn('[친구 요청] 이름을 못 받음 — 이름 없이 그려요', (e && (e.code || e.message)) || e); return {}; }
  }
  const nameIn = (cards, c) => (cards[c] && cards[c].name) || '';

  function watchReceived(myId, onChange, onError){
    let dead = false, flying = false, again = false;
    const run = async () => {
      if(dead) return;
      if(flying){ again = true; return; }
      flying = true;
      try{
        const r = await social.fetchRequests();
        const cards = await namesOf(r.received.map((x) => x.userCode));
        if(dead) return;
        const out = {};
        for(const x of r.received) out[x.userCode] = { name: nameIn(cards, x.userCode), ts: x.requestedAt };
        onChange(out);
      }catch(e){ if(!dead && onError) onError(e); }
      finally{ flying = false; if(again){ again = false; run(); } }
    };
    const off = rt.on('friendRequests', () => { run(); });
    run();
    return () => { dead = true; off(); };
  }

  async function listSent(){
    const r = await social.fetchRequests();
    const cards = await namesOf(r.sent.map((x) => x.userCode));
    const out = {};
    for(const x of r.sent) out[x.userCode] = { ts: x.requestedAt, toName: nameIn(cards, x.userCode) || undefined };
    return out;
  }

  const outcome = async (fn) => {
    try{ await fn(); return { ok: true }; }
    catch(e){ return { ok: false, reason: (e && e.code) || 'ERROR' }; }
  };
  const REASON = { SOCIAL_ALREADY_FRIEND: 'already', SOCIAL_SELF: 'self' };

  return {
    watchReceived, listSent,
    accept: (myId, fromId) => social.acceptRequest(fromId),
    reject: (myId, fromId) => social.rejectRequest(fromId),
    cancel: (myId, toId) => outcome(() => social.cancelRequest(toId)),
    send: async (myId, toId) => {
      const r = await outcome(() => social.sendRequest(toId));
      if(!r.ok && REASON[r.reason]) r.reason = REASON[r.reason];
      return r;
    },
    lookupName: async (uid) => { try{ return nameIn(await social.fetchCards([uid]), uid) || null; }catch(_){ return null; } },
    lookupFriendCode: (code) => social.findByFriendCode(code),
  };
}

const api = { createFriendRequestsApi };
if(typeof window !== 'undefined') window.TwFriendRequestsApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
