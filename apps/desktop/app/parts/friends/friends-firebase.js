/* friends-firebase.js — 👥 친구 데이터 옛 길 provider(Firebase · 나중에 걷음) — friends-port.js 가 부른다
   책임: firebase-init.js 의 친구 함수(firebaseAPI)를 포트 모양으로 바꾼다. firebaseAPI 를 직접 부르지 않는다(app.js 가 deps 로 잇는다).
     상시 구독은 목록(추가 · 삭제) 하나뿐 — 소개 · 사진은 목록을 열 때 한 번 읽고, 접속 상태 · 프로필(이름 · 레벨 · 회차)은 목록이 열려 있는 동안만 친구별로 듣는다.
     프로필은 규칙상 작은 칸 여섯뿐(name ≤20자 · level · cyc · clv · starC · updatedAt — 그 밖의 칸은 .validate false)이라 통째로 듣는다.
   deps: getList(myId) → Promise<{친구id:{addedAt}}>(users/{나}/friends 한 번) · watchList(myId, onChange, onError) → 해제 함수(목록 구독 하나) ·
         getCard(fid) → Promise<{ profile, bio, avatar }>(날것) · watchPresence(fid, onChange(날것)) → 해제 함수 · getPresence(fid) → Promise<날것> ·
         watchProfile(fid, onChange(날것)) → 해제 함수(users/{fid}/profile 구독) · getProfile(fid) → Promise<날것>(같은 칸 한 번) ·
         setTimer(fn, ms) → id · clearTimer(id) · now() → ms
   내보냄: createFriendsFirebase(deps) → { listFriends(myId, opts) · readFriend(fid) · watchList(myId, onChange, onError) · watchPresence(myId, ids, onChange) · readPresence(fid) ·
         watchProfile(myId, ids, onChange) · readProfile(fid) }
     순수: cardOf(raw) · profileOf(raw) · presenceOf(raw) · PRESENCE_BATCH_MS · CARD_KEEP_MS (TwFriendsFirebase 위)
   ⚠️ 접속 상태 · 프로필 콜백은 친구 수만큼 한꺼번에 온다 — PRESENCE_BATCH_MS 창에 한 번만 넘긴다(스로틀 · 뒷날. 디바운스면 계속 오는 동안 영영 안 그린다).
   ⚠️ 듣거나 새로 읽은 프로필은 카드 기억(_cards)에도 얹는다 — 안 그러면 10분 안에 목록을 다시 열 때 기억해 둔 옛 이름이 돌아온다.
   검사: checks/sim-friends-port.js */
(function(){
'use strict';

const PRESENCE_BATCH_MS = 50;            // 접속 상태 묶어 넘기기 — 받은 값은 바로 담고, 넘기기(그리기)만 이 창에 한 번
const CARD_KEEP_MS = 10 * 60 * 1000;     // 이름 · 사진을 다시 안 읽는 시간 — 목록을 열 때마다 친구 수 × 3 칸(사진은 그 자리 데이터면 수백 KB)을 받지 않게

/* 프로필 · 소개 · 사진 날것 → 친구 칸. 이름이 없으면 '(이름 없음)'. 레벨은 1 이상 숫자만 — 아니면 null(아직 새 버전으로 접속 안 한 친구와
   진짜 Lv.1 을 가른다 · 배지 숨김). 회차(cyc · clv · starC)는 날것 그대로(거르기는 app.js starFromRemote 한 곳). */
function cardOf(raw){
  const r = raw || {};
  return Object.assign(profileOf(r.profile), { bio: r.bio || '', avatar: r.avatar || null });
}
/* 프로필 날것(users/{fid}/profile) → 이름 · 레벨 · 회차. 거르기는 cardOf 와 같은 한 벌(소개 · 사진은 없다 — 그 칸은 덮지 않는다). */
function profileOf(raw){
  const p = raw || {};
  return {
    name: p.name || '(이름 없음)',
    level: (typeof p.level === 'number' && p.level >= 1) ? p.level : null,
    cyc: p.cyc, clv: p.clv, starC: p.starC,
  };
}
/* presence 날것 → 접속 상태. «방에 있음»(inRoom)은 코드(room)와 별개 칸이다 — 시크릿룸은 code 를 안 올린다.
   옛 판(inRoom 이 없던 앱)은 room 이 있으면 방에 있는 것으로 친다. */
function presenceOf(raw){
  const p = raw || {};
  return { online: !!p.online, lastSeen: p.lastSeen || 0, room: p.room || null, inRoom: (p.inRoom !== undefined) ? !!p.inRoom : !!p.room };
}

function createFriendsFirebase(deps){
  const getList = deps.getList;
  const watchListRaw = deps.watchList;
  const getCard = deps.getCard;
  const watchPresenceOne = deps.watchPresence;
  const getPresence = deps.getPresence;
  const watchProfileOne = deps.watchProfile;
  const getProfile = deps.getProfile;
  const setTimer = deps.setTimer;
  const clearTimer = deps.clearTimer;
  const now = deps.now;
  const _cards = {};   // 친구id → { at, card } — CARD_KEEP_MS 안이면 다시 안 읽는다

  async function _cardOf(fid, t){
    const c = _cards[fid];
    if(c && t - c.at < CARD_KEEP_MS) return c.card;
    try{
      const card = cardOf(await getCard(fid));
      _cards[fid] = { at: t, card };
      return card;
    }catch(e){
      console.warn('[친구 목록] 친구 이름 · 사진 읽기 실패', fid, e);
      return c ? c.card : null;   // 지난 값이 있으면 그것 · 없으면 자리표시('...')로 남긴다
    }
  }
  async function listFriends(myId, opts){
    const ids = (await getList(myId)) || {};
    if(opts && opts.idsOnly) return ids;
    const t = now(), out = {};
    await Promise.all(Object.keys(ids).map(async fid=>{
      const card = await _cardOf(fid, t);
      out[fid] = Object.assign({ addedAt: (ids[fid] || {}).addedAt }, card || {});
    }));
    return out;
  }
  /* 친구 한 명 카드 — 목록 받기와 같은 기억(CARD_KEEP_MS)을 쓴다. 못 읽으면 지난 카드 · 없으면 null. */
  function readFriend(fid){ return _cardOf(fid, now()); }
  function watchList(myId, onChange, onError){
    return watchListRaw(myId, v=>onChange(v || {}), onError);
  }
  /* 친구마다 하나씩 듣고(watchOne) 받은 값을 바꿔(toVal) 묶어 넘긴다 — 접속 상태 · 프로필이 같은 한 벌을 쓴다. */
  function _watchEach(ids, watchOne, toVal, onChange){
    const combined = {}, offs = [];
    let dead = false, timer = null;
    const flush = ()=>{ timer = null; if(!dead) onChange(Object.assign({}, combined)); };
    const notify = ()=>{ if(timer == null) timer = setTimer(flush, PRESENCE_BATCH_MS); };
    for(const fid of ids || []){
      offs.push(watchOne(fid, raw=>{ if(dead) return; combined[fid] = toVal(fid, raw); notify(); }));
    }
    return ()=>{
      if(dead) return;
      dead = true;
      if(timer != null){ clearTimer(timer); timer = null; }
      for(const off of offs){ try{ off(); }catch(_){} }
    };
  }
  function watchPresence(myId, ids, onChange){ return _watchEach(ids, watchPresenceOne, (fid, raw)=>presenceOf(raw), onChange); }
  async function readPresence(fid){ return presenceOf(await getPresence(fid)); }
  /* 받은 프로필을 카드 기억에도 얹는다(소개 · 사진 · 읽은 시각은 그대로) — 다음 목록 받기가 옛 이름을 돌려주지 않게. */
  function _keepProfile(fid, raw){
    const prof = profileOf(raw), c = _cards[fid];
    if(c) _cards[fid] = { at: c.at, card: Object.assign({}, c.card, prof) };
    return prof;
  }
  function watchProfile(myId, ids, onChange){ return _watchEach(ids, watchProfileOne, _keepProfile, onChange); }
  async function readProfile(fid){ return _keepProfile(fid, await getProfile(fid)); }

  return { listFriends, readFriend, watchList, watchPresence, readPresence, watchProfile, readProfile };
}

const api = { createFriendsFirebase, cardOf, profileOf, presenceOf, PRESENCE_BATCH_MS, CARD_KEEP_MS };
if(typeof window !== 'undefined') window.TwFriendsFirebase = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
