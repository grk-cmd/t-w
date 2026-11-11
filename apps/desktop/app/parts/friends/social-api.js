/* social-api.js — 👥 친구 · 친구 요청 · 명함 api provider (검사 sim-social-api.js)
   책임: 내 친구 목록(GET /v1/me/friends) · 친구 한 명(GET …/{code}) · 끊기(DELETE …/{code}) ·
     친구 요청 목록(GET /v1/me/friend-requests) · 보내기(POST) · 수락 · 거절(POST …/{from}/accept · reject) · 취소(DELETE …/{to}) ·
     명함 묶음(GET /v1/myhomes/cards?codes=). 서버 모양(userCode · ISO 시각 · displayName · cycle …)을 화면 모양
     (친구 칸 name · level · cyc · clv · starC · bio · avatar · 시각 ms)으로 맞추는 곳은 여기뿐이다.
   신원: 나는 서버가 토큰에서 정한다 — 경로 · 본문에 내 코드 · 이름을 싣지 않는다. 경로의 코드는 상대(데이터 주소).
   이름: 이름이 없으면 '' 그대로 넘긴다 — «(이름 없음)» 같은 자리표시는 화면 한 곳이 정한다(여기서 새로 만들지 않는다).
   다시 묻지 않는다: 실패는 한 번에 던진다 — 다시 받기는 사용자가 목록을 다시 열거나 realtime 알림(friends · friendRequests · card)이 올 때.
   deps: authed — 로그인 API 통로(TwApi.authed — get(path, { auth, onOwner }) · post · del(…, { expectOwner }) → Promise<data> · ETag 는 통로가 맡는다)
         warn(...a)(진단 로그)
   내보냄: createSocialApi(deps) → {
     fetchFriends() → Promise<[{ userCode, addedAt, lastSeenAt }]>   오래 사귄 순 · addedAt ms · lastSeenAt ms | null(기록 없음). 못 읽으면 던진다
     fetchFriend(userCode) → Promise<{ userCode, addedAt, lastSeenAt } | null>   null = 친구가 아님(요청 중 · 나 · 없는 사람)
     removeFriend(userCode) → Promise<void>
     fetchRequests() → Promise<{ received:[userCode], sent:[userCode] }>   요청이 먼저 생긴 순
     sendRequest(to) · acceptRequest(from) · rejectRequest(from) · cancelRequest(to) → Promise<void>
     fetchCards(codes) → Promise<{ userCode: 명함 }>   명함 = { name, avatar, bio, level, cyc, clv, starC } · 없는 코드는 빠진다 · 100개씩 나눠 묻는다 · 한 조각이라도 못 받으면 던진다
     reset() — 읽은 토큰 주인 기억을 비운다(계정을 놓을 때)
   }
     순수: friendOf · friendsOf · requestsOf · cardOf · cardsOf · chunk · failOf · ERRORS · KIND · PATHS · LIMITS (TwSocialApi 위)
   ⚠️ 쓰기는 «읽은 토큰의 주인» 과 묶는다(expectOwner) — 계정이 바뀌는 틈에 앞 계정 화면의 누름이 새 계정 토큰으로 나가지 않게.
     읽은 적이 없으면(내 친구 · 요청을 받기 전) NOT_RECEIVED 로 요청 0. 주인 기억은 내 것 읽기(friends · friend-requests)만 남긴다.
   classic script — api-client.js 다음 · app.js 보다 먼저 싣는다(window.TwSocialApi). Firebase 를 모른다. */
(function(){
'use strict';

const enc = (c) => encodeURIComponent(c);
const PATHS = Object.freeze({
  friends: '/v1/me/friends',
  friend: (userCode) => '/v1/me/friends/' + enc(userCode),
  requests: '/v1/me/friend-requests',
  request: (userCode) => '/v1/me/friend-requests/' + enc(userCode),
  accept: (from) => '/v1/me/friend-requests/' + enc(from) + '/accept',
  reject: (from) => '/v1/me/friend-requests/' + enc(from) + '/reject',
  cards: (codes) => '/v1/myhomes/cards?codes=' + codes.map(enc).join(','),
});
/* 서버 상한과 같은 값 — 넘기면 서버가 거절한다 */
const LIMITS = Object.freeze({ CARD_CODES: 100 });
const NOT_RECEIVED_CODE = 'NOT_RECEIVED';
const NOT_FRIEND_CODE = 'SOCIAL_NOT_FRIEND';

/* 서버 코드 → 화면이 할 일의 갈래(TwApiErrors.translate 에 넘기는 기능 표 — 공통 표보다 먼저 본다).
   guide = 안내(서버 문구 · 번호 없음) · gone = 이미 없는 요청 · 친구(안내 + 목록 다시 받기 한 번) · missing = 그 사람이 없음
   · site = 그 자리의 E-FR 번호 · stale = 계정이 바뀌는 중이거나 받기 전(조용히 버림) · common = 공통 표(apiErrors.notify) */
const KIND = Object.freeze({ GUIDE: 'guide', GONE: 'gone', MISSING: 'missing', SITE: 'site', STALE: 'stale', COMMON: 'common' });
const row = (kind) => Object.freeze({ action: kind, notice: null });
const ERRORS = Object.freeze({
  SOCIAL_SELF: row(KIND.GUIDE), SOCIAL_ALREADY_FRIEND: row(KIND.GUIDE), SOCIAL_FRIEND_FULL: row(KIND.GUIDE),
  SOCIAL_REQUEST_NOT_FOUND: row(KIND.GONE), [NOT_FRIEND_CODE]: row(KIND.GONE),
  USER_NOT_FOUND: row(KIND.MISSING),
  SHAPE: row(KIND.SITE), NO_USER: row(KIND.SITE),
  OWNER_CHANGED: row(KIND.STALE), [NOT_RECEIVED_CODE]: row(KIND.STALE),
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const str = (v) => (typeof v === 'string' ? v : '');
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });
const codeError = (code, message) => Object.assign(new Error(message || code), { code });
/* ISO → ms. 못 읽으면 null(«모름» — 0 으로 꾸미지 않는다) */
const msOrNull = (iso) => { if(!nonEmpty(iso)) return null; const t = Date.parse(iso); return isFinite(t) ? t : null; };

/* 실패 하나 → { kind, code, message }. errs = TwApiErrors(translate · COMMON).
   기능 표 → 그 갈래 · 공통 code → common · 그 밖(닿지 못함 · 모르는 code) → site(그 자리 번호) */
function failOf(err, errs){
  const t = errs.translate(err, ERRORS);
  let kind;
  if(own(ERRORS, t.code)) kind = t.action;
  else if(own(errs.COMMON, t.code)) kind = KIND.COMMON;
  else kind = KIND.SITE;
  return { kind, code: t.code, message: str(err && err.message) };
}

/* 친구 한 줄 { userCode, addedAt, lastSeenAt } → { userCode, addedAt(ms), lastSeenAt(ms | null) }. 코드 · 친구가 된 시각이 없으면 undefined */
function friendOf(raw){
  if(!isObj(raw) || !nonEmpty(raw.userCode)) return undefined;
  const addedAt = msOrNull(raw.addedAt);
  if(addedAt === null) return undefined;
  return { userCode: raw.userCode, addedAt, lastSeenAt: msOrNull(raw.lastSeenAt) };
}
/* GET /v1/me/friends(배열) → 같은 차례의 배열. 깨진 줄 · 겹친 코드는 뺀다 · 배열이 아니면 undefined */
function friendsOf(d){
  if(!Array.isArray(d)) return undefined;
  const out = [], seen = new Set();
  for(const raw of d){
    const f = friendOf(raw);
    if(!f || seen.has(f.userCode)) continue;
    seen.add(f.userCode);
    out.push(f);
  }
  return out;
}
/* 코드 목록 — 문자열만 · 겹침 없이 · 차례 그대로 */
function codesOf(list){
  const out = [], seen = new Set();
  for(const c of list) if(nonEmpty(c) && !seen.has(c)){ seen.add(c); out.push(c); }
  return out;
}
/* GET /v1/me/friend-requests → { received, sent }. 둘 중 하나라도 배열이 아니면 undefined */
function requestsOf(d){
  if(!isObj(d) || !Array.isArray(d.received) || !Array.isArray(d.sent)) return undefined;
  return { received: codesOf(d.received), sent: codesOf(d.sent) };
}
/* 명함 한 장 → 친구 칸 이름(name · level · cyc · clv · starC · bio · avatar). 레벨은 1 이상 숫자만(아니면 null = 배지 숨김).
   회차 · 별 색은 날것 그대로 넘긴다(거르기는 app.js starFromRemote 한 곳). 코드가 없으면 undefined */
function cardOf(c){
  if(!isObj(c) || !nonEmpty(c.userCode)) return undefined;
  return {
    name: str(c.displayName),
    avatar: str(c.avatarUrl) || null,
    bio: str(c.bio),
    level: (typeof c.level === 'number' && c.level >= 1) ? c.level : null,
    cyc: c.cycle, clv: c.cycleLevel, starC: c.starColor,
  };
}
/* { cards:[…] } → { userCode: 명함 }. 깨진 장은 뺀다 · cards 가 배열이 아니면 undefined */
function cardsOf(d){
  if(!isObj(d) || !Array.isArray(d.cards)) return undefined;
  const out = {};
  for(const c of d.cards){ const card = cardOf(c); if(card) out[c.userCode] = card; }
  return out;
}
/* n 개씩 나누기 */
function chunk(list, n){
  const out = [];
  for(let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/** @param {{ authed: { get: (path: string, opts?: object) => Promise<any>, post: (path: string, body: object, opts?: object) => Promise<any>,
 *     del: (path: string, opts?: object) => Promise<any> }, warn: (...a: any[]) => void }} deps
 *   authed 는 로그인 API 통로(TwApi.authed — 토큰 · ETag 는 통로가 맡는다) · warn 은 진단 로그 */
function createSocialApi(deps){
  const authed = deps.authed;
  const warn = deps.warn;
  let owner;          // 마지막으로 내 것을 읽을 때 쓴 토큰의 주인(undefined = 읽은 적 없음)
  let epoch = 0;      // reset 마다 오른다 — reset 전에 시작한 읽기가 늦게 끝나도 주인 기억을 되살리지 않게

  /* 내 것을 읽는 GET — 토큰 주인을 기억한다 */
  async function readMine(path){
    let who;
    const at = epoch;
    const d = await authed.get(path, { auth: true, onOwner: (w) => { who = w; } });
    if(at === epoch) owner = who;
    return d;
  }
  /* 쓰기 한 번 — 읽은 적 없으면 요청 0. 계정이 바뀌었으면(OWNER_CHANGED) 기억을 비워 다시 읽기 전엔 쓰지 않는다 */
  async function write(what, send){
    if(owner === undefined) throw codeError(NOT_RECEIVED_CODE, '받기 전에는 쓰지 않아요');
    try{ return await send({ expectOwner: owner }); }
    catch(e){
      if(e && e.code === 'OWNER_CHANGED') owner = undefined;
      else warn('[친구] ' + what + ' 실패', (e && (e.code || e.message)) || e);
      throw e;
    }
  }
  const need = (v) => { if(!v) throw shapeError(); return v; };
  const needCode = (c) => { if(!nonEmpty(c)) throw codeError('NO_USER', '사용자 코드 없음'); return c; };

  async function fetchFriend(userCode){
    const code = needCode(userCode);
    try{ return need(friendOf(await authed.get(PATHS.friend(code), { auth: true }))); }
    catch(e){ if(e && e.code === NOT_FRIEND_CODE) return null; throw e; }
  }

  /* 명함 — 100개씩 나눠 한꺼번에 묻고 합친다. 빈 목록이면 조각이 없어 요청 0 */
  async function fetchCards(codes){
    const list = codesOf(Array.isArray(codes) ? codes : []);
    const parts = await Promise.all(chunk(list, LIMITS.CARD_CODES).map(async (part) => need(cardsOf(await authed.get(PATHS.cards(part), { auth: true })))));
    return Object.assign({}, ...parts);
  }

  return {
    fetchFriends: async () => need(friendsOf(await readMine(PATHS.friends))),
    fetchFriend,
    removeFriend: async (userCode) => { const c = needCode(userCode); await write('끊기', (o) => authed.del(PATHS.friend(c), o)); },
    fetchRequests: async () => need(requestsOf(await readMine(PATHS.requests))),
    sendRequest: async (to) => { const c = needCode(to); await write('요청 보내기', (o) => authed.post(PATHS.requests, { to: c }, o)); },
    acceptRequest: async (from) => { const c = needCode(from); await write('수락', (o) => authed.post(PATHS.accept(c), {}, o)); },
    rejectRequest: async (from) => { const c = needCode(from); await write('거절', (o) => authed.post(PATHS.reject(c), {}, o)); },
    cancelRequest: async (to) => { const c = needCode(to); await write('요청 취소', (o) => authed.del(PATHS.request(c), o)); },
    fetchCards,
    reset: () => { epoch++; owner = undefined; },
  };
}

const api = { createSocialApi, friendOf, friendsOf, requestsOf, cardOf, cardsOf, chunk, failOf, ERRORS, KIND, PATHS, LIMITS };
if(typeof window !== 'undefined') window.TwSocialApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
