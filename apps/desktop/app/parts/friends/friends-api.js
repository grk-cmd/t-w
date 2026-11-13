/* friends-api.js — 👥 친구 데이터 서버 provider — 친구 목록(GET /v1/me/friends) + 명함(GET /v1/myhomes/cards)을 친구 칸으로 맞춘다
   책임: 포트(friends-port.js)가 부르는 모양 하나로 서버 친구 데이터를 낸다. 서버 길 자체(경로 · 모양 맞춤 · 오류 갈래)는 social-api.js 가 맡고,
     여기는 «목록 + 명함 → 친구 칸» 합치기 · 알림(friends · card)을 받으면 다시 받기뿐이다. 다시 묻지 않는다 — 못 받으면 던지거나 onError 로 알린다
     (다시 받기는 목록을 다시 열 때 · realtime 알림이 올 때 · 연결이 오래 끊겼다 붙을 때). 던지면 포트가 옛 길(Firebase)로 넘긴다(목록 · 한 명 받기).
   deps: social — createSocialApi 가 돌려준 것(social-api.js — fetchFriends · fetchFriend · fetchCards · removeFriend) ·
         rt — 알림 걸기(TwRtHub.store.on('friends' | 'card', fn)) · warn(...a)(진단 로그)
   내보냄: createFriendsApi(deps) → {
     listFriends(myId, opts) → Promise<{ 친구id: 친구 }>    opts.idsOnly — 명함은 받지 않는다(판정용 · addedAt 만)
     readFriend(fid) → Promise<친구 | null>               친구가 아니거나 명함이 없으면 null
     watchList(myId, onChange, onError) → 해제 함수        처음 한 번 + friends 알림마다 다시 받아 onChange({ 친구id: { addedAt } }) · 못 받으면 onError(e)
     watchProfile(myId, ids, onChange) → 해제 함수         처음 한 번 + card 알림(그 친구가 ids 안일 때)마다 onChange({ 친구id: { name, level, cyc, clv, starC } })
     readProfile(fid) → Promise<프로필>                    한 번 새로 읽기 — 명함이 없으면 던진다
     removeFriend(fid) → Promise<void>                    끊기 — 이미 친구가 아니면 끝난 것으로 본다
   }
     순수: friendOf(card) · profileOf(card) (TwFriendsApi 위)
   친구 하나: { addedAt, name, level, cyc, clv, starC, bio, avatar } — 접속 상태는 realtime(friends-presence-rt.js). «마지막 접속» 은 화면에 안 쓴다(설계 D3-Q1 안 넣음).
   이름: 명함이 있는데 이름이 비면 '(이름 없음)' — 명함 자체가 없는 친구는 이름 칸을 덮지 않는다(friends-sub 의 '...' 자리표시).
   검사: checks/sim-friends-port.js */
(function(){
'use strict';

const NO_NAME = '(이름 없음)';

/* 명함 → 프로필(이름 · 레벨 · 회차) */
function profileOf(card){
  return { name: card.name || NO_NAME, level: card.level, cyc: card.cyc, clv: card.clv, starC: card.starC };
}
/* 명함 → 친구 칸(프로필 + 소개 · 사진) */
function friendOf(card){
  return Object.assign(profileOf(card), { bio: card.bio, avatar: card.avatar });
}

function createFriendsApi(deps){
  const social = deps.social;
  const rt = deps.rt;
  const warn = deps.warn;

  async function listFriends(myId, opts){
    const list = await social.fetchFriends();
    const idsOnly = !!(opts && opts.idsOnly);
    const cards = idsOnly ? {} : await social.fetchCards(list.map((f) => f.userCode));
    const out = {};
    for(const f of list) out[f.userCode] = Object.assign({ addedAt: f.addedAt }, cards[f.userCode] ? friendOf(cards[f.userCode]) : {});
    return out;
  }

  async function readFriend(fid){
    if(!(await social.fetchFriend(fid))) return null;
    const card = (await social.fetchCards([fid]))[fid];
    return card ? friendOf(card) : null;
  }

  /* 알림이 겹쳐도 받기는 한 번에 하나 — 받는 중에 또 오면 끝난 뒤 한 번 더 */
  function oneAtATime(fetchOnce){
    let flying = false, again = false, dead = false;
    const run = async () => {
      if(dead) return;
      if(flying){ again = true; return; }
      flying = true;
      try{ await fetchOnce(() => dead); }
      finally{ flying = false; if(again){ again = false; run(); } }
    };
    return { run, stop: () => { dead = true; } };
  }

  function watchList(myId, onChange, onError){
    const w = oneAtATime(async (isDead) => {
      try{
        const list = await social.fetchFriends();
        if(isDead()) return;
        const out = {};
        for(const f of list) out[f.userCode] = { addedAt: f.addedAt };
        onChange(out);
      }catch(e){ if(!isDead() && onError) onError(e); }
    });
    const off = rt.on('friends', () => { w.run(); });
    w.run();
    return () => { w.stop(); off(); };
  }

  function watchProfile(myId, ids, onChange){
    const want = new Set(ids || []);
    const pending = new Set();
    const w = oneAtATime(async (isDead) => {
      const codes = Array.from(pending); pending.clear();
      if(!codes.length) return;
      try{
        const cards = await social.fetchCards(codes);
        if(isDead()) return;
        const out = {};
        for(const c of Object.keys(cards)) out[c] = profileOf(cards[c]);
        if(Object.keys(out).length) onChange(out);
      }catch(e){ warn('[친구 목록] 친구 프로필을 못 받음 — 다음 알림 때 다시', (e && (e.code || e.message)) || e); }
    });
    const all = () => { for(const c of want) pending.add(c); w.run(); };
    const off = rt.on('card', (n) => {
      if(n && n.resync) return all();
      if(n && typeof n.subject === 'string' && want.has(n.subject)){ pending.add(n.subject); w.run(); }
    });
    all();
    return () => { w.stop(); off(); };
  }

  async function readProfile(fid){
    const card = (await social.fetchCards([fid]))[fid];
    if(!card){ const e = new Error('명함 없음'); e.code = 'NO_CARD'; throw e; }
    return profileOf(card);
  }

  async function removeFriend(fid){
    try{ await social.removeFriend(fid); }
    catch(e){ if(!(e && e.code === 'SOCIAL_NOT_FRIEND')) throw e; }
  }

  return { listFriends, readFriend, watchList, watchProfile, readProfile, removeFriend };
}

const api = { createFriendsApi, friendOf, profileOf };
if(typeof window !== 'undefined') window.TwFriendsApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
