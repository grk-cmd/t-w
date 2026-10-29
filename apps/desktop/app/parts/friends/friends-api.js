/* friends-api.js — 👥 친구 데이터 api provider — GET /v1/me/friends · 친구 한 명 명함(t-w-server) · 요청 규칙(시간 제한 · 다시 묻기)
   책임: 내 친구 목록(이름 · 레벨 · 소개 · 사진)을 서버에서 한 번 받는다. 서버 문제면 정해진 만큼만 다시 묻고, 그래도 안 되면 던진다
     — 던지면 포트(friends-port.js)가 옛 길(Firebase)로 넘긴다. 목록 듣기 · 접속 상태는 아직 옛 길이다(ws 는 다음 단계).
     새로 생긴 친구 한 명은 공개 명함(GET /v1/users/{uid}/card)으로 — 다시 묻지 않고, 못 받으면 던진다(포트가 옛 길로).
   deps: get(path, opts) → Promise<data> — 로그인 API 통로(firebase-init.js apiGetAuthed — api-client.js 의 get · 토큰은 거기서 붙인다) ·
         getCard(uid) → Promise<명함 data | null>(공개 읽기 — firebase-init 이 api-public-reads.js 로 단 fetchUserCardApi · 경로 · 통로는 거기) ·
         wait(ms) → Promise(다시 묻기 전 쉬기) · warn(...a)(진단 로그)
   내보냄: createFriendsApi(deps) → { listFriends(myId) → Promise<{ 친구id: 친구 }> · readFriend(fid) → Promise<친구 | null(없는 사람)> }
     순수: friendsOf(data) · cardOf(c) · retryable(err) · FRIENDS_PATH · REQUEST_TIMEOUT_MS · RETRY_DELAYS_MS (TwFriendsApi 위)
   요청 규칙(사용자 확정 10-17): 한 번에 REQUEST_TIMEOUT_MS. 서버 문제(연결 실패 · 시간 초과 · 5xx)면 RETRY_DELAYS_MS 만큼 쉬고 다시(총 3번).
     401(연결 없는 옛 계정 · 토큰 없음) · 400 · 그 밖의 4xx · 모양이 틀린 응답은 다시 묻지 않고 바로 던진다(400 은 진단 로그).
     실패를 기억하지 않는다 — 다음에 목록을 열면 다시 서버부터.
   ⚠️ 통로는 쉬기(backoffMs)를 끈 것이어야 한다 — 공용 통로(TwApi.client)의 쉬기를 쓰면 다시 묻기가 묻지도 않고 끝나고,
     이 경로 하나의 실패가 원격 설정 · 공개 읽기까지 30초 쉬게 만든다(로그인 통로 TwApi.authed 를 쓴다).
   검사: checks/sim-friends-port.js */
(function(){
'use strict';

const FRIENDS_PATH = '/v1/me/friends';
const REQUEST_TIMEOUT_MS = 5000;          // 요청 한 번의 상한
const RETRY_DELAYS_MS = [1000, 3000];     // 서버 문제일 때 다시 묻기 전 쉬는 시간 — 길이 = 더 묻는 횟수
const USER_CODE_HEADER = 'X-User-Code';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');

/* 다시 물어도 되는 실패인가 — 닿지 못함(연결 실패 · 시간 초과) · 5xx 만. 4xx · 모양 틀림은 다시 물어도 같다. */
function retryable(e){
  if(!e) return false;
  if(e.code === 'NETWORK' || e.code === 'TIMEOUT') return true;
  return typeof e.status === 'number' && e.status >= 500;
}

/* 친구 칸 하나(목록 줄 · 명함 같은 규칙) → 이름 · 레벨 · 회차 · 소개 · 사진. 객체가 아니면 undefined.
   이름 · 레벨 거르기는 옛 길(firebase provider)과 같다 — 이름이 없으면 '(이름 없음)' · 레벨은 1 이상 숫자만(아니면 null = 배지 숨김).
   회차(cyc · clv · starC)는 날것 그대로 넘긴다(거르기는 app.js starFromRemote 한 곳). 사진은 주소 또는 그 자리 데이터 —
   명함의 avatarInline 은 불리언(«그 자리 사진 있음» 표시뿐)이라 사진이 안 된다. 명함엔 소개가 없어 '' — 다음 목록 받기 때 채워진다. */
function cardOf(c){
  if(!isObj(c)) return undefined;
  return {
    name: str(c.name) || '(이름 없음)',
    level: (typeof c.level === 'number' && c.level >= 1) ? c.level : null,
    cyc: c.cyc, clv: c.clv, starC: c.starC,
    bio: str(c.bio),
    avatar: str(c.avatarUrl) || str(c.avatarInline) || null,
  };
}
/* 응답 data({ friends:[…], total, truncated }) → { 친구id: 친구 }. 모양이 틀리면 undefined(던져서 옛 길로). */
function friendsOf(data){
  if(!isObj(data) || !Array.isArray(data.friends)) return undefined;
  const out = {};
  for(const f of data.friends){
    if(!isObj(f) || typeof f.id !== 'string' || !f.id) continue;
    out[f.id] = Object.assign({ addedAt: (typeof f.addedAt === 'number') ? f.addedAt : undefined }, cardOf(f), { mutual: f.mutual === true });
  }
  return out;
}

function createFriendsApi(deps){
  const get = deps.get;
  const getCard = deps.getCard;
  const wait = deps.wait;
  const warn = deps.warn;

  async function listFriends(myId){
    if(!myId){ const e = new Error('내 코드 없음'); e.code = 'NO_USER'; throw e; }
    let last = null;
    for(let i = 0; i <= RETRY_DELAYS_MS.length; i++){
      if(i) await wait(RETRY_DELAYS_MS[i - 1]);
      try{
        const out = friendsOf(await get(FRIENDS_PATH, { auth: true, headers: { [USER_CODE_HEADER]: myId }, timeoutMs: REQUEST_TIMEOUT_MS }));
        if(out) return out;
        last = new Error('응답 모양이 달라요'); last.code = 'SHAPE';
      }catch(e){ last = e; }
      if(!retryable(last)) break;
    }
    if(last && last.status === 400) warn('[친구 목록] 서버가 요청을 거절했어요(400) — 옛 길로', last.code || '', last.message || '');
    throw last;
  }

  /* 친구 한 명 — 공개 명함 한 번. data:null 은 «없는 사람»(null · 옛 길로 다시 안 감). 모양이 틀리면 던진다(옛 길로). */
  async function readFriend(fid){
    if(!fid){ const e = new Error('친구 코드 없음'); e.code = 'NO_USER'; throw e; }
    const d = await getCard(fid);
    if(d === null) return null;
    const out = cardOf(d);
    if(!out){ const e = new Error('응답 모양이 달라요'); e.code = 'SHAPE'; throw e; }
    return out;
  }

  return { listFriends, readFriend };
}

const api = { createFriendsApi, friendsOf, cardOf, retryable, FRIENDS_PATH, REQUEST_TIMEOUT_MS, RETRY_DELAYS_MS, USER_CODE_HEADER };
if(typeof window !== 'undefined') window.TwFriendsApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
