/* gift-api.js — 🧸 말랑이 · 🎁 선물 api provider (검사 sim-gift-api.js)
   책임: 내 말랑이 칸 읽기 · 통째 저장(GET · PUT /v1/me/mallangs) · 그림 올리기(POST /v1/me/images?purpose=mallang) · 남의 집 칸(GET /v1/mallangs/{userCode}) ·
     내 선물함(GET /v1/me/gifts) · 봤음(POST …/seen) · ⭐ · 치움(PATCH …/{id}) · 지우기(DELETE …/{id}) · 오늘 보낸 수(GET …/sent-today) ·
     그 집에 나온 선물(GET /v1/gifts/{userCode}) · 보내기(POST /v1/gifts/{userCode}).
     서버 모양(sentAt ISO)을 화면 모양(sentAt ms)으로 맞추는 곳은 여기뿐이다.
     칸 번호: 받은 칸은 서버 slot 을 그대로 들고 있다(0~3 안에서 겹치지만 않고 0 · 2 처럼 빌 수 있다) — 보내기는 이 번호를 쓴다. 칸 저장(PUT)만 배열 차례로 0부터 다시 매긴다.
   신원: 보낸 사람 · 내 칸은 서버가 토큰에서 정한다 — 본문에 내 코드 · 이름 · 날짜 · 그림 주소(보내기)를 싣지 않는다. 경로의 코드는 받는 사람 · 방문한 집(데이터 주소).
   deps: authed — 로그인 API 통로(TwApi.authed — get(path, { auth, onOwner }) · post · put · patch · del(…, { expectOwner }) → Promise<data>)
         warn(...a)(진단 로그)
   내보냄: createGiftApi(deps) → {
     fetchMine() → Promise<{ slots:[{ slot, imageUrl, enabled }], version }> — 저장한 적 없으면 빈 칸 · 판 0. 못 읽으면 던진다.
     fetchOf(userCode) → 같은 모양(남의 집 — 주인 기억은 안 바꾼다)
     uploadImage(dataUrl) → Promise<url> — png · webp · 1MB 이하. 아니면 요청 없이 IMAGE_UPLOAD 로 던진다.
     saveMallangs(version, slots) → Promise<{ slots, version }> — 통째 저장 · 칸 번호는 배열 차례로 0부터 다시 매긴다.
     fetchBox() → Promise<{ items:[{ id, senderName, imageUrl, message, starred, hidden, sentAt }], unseenCount, starCount, boxKeep, starMax }>
     markSeen() · star(id, on) · hide(id, on) · remove(id) → Promise<void>
     fetchSentToday() → Promise<{ count, dailyMax }>
     fetchVisible(userCode) → Promise<{ items:[{ id, imageUrl, message }], visibleCount, recipientCap }>
     send(userCode, { requestId, mallang, message }) → Promise<{ giftId, sentToday, dailyMax }> — mallang 은 fetchMine 이 준 칸 하나(본문 slot = 그 칸의 서버 번호).
       requestId 는 부르는 쪽(TwRequestId pending)이 정한다. 메시지는 UTF-16 50자까지(이모지 짝을 깨지 않게 자른다).
     reset() — 읽은 토큰 주인 기억을 비운다(계정을 놓을 때)
   }
     순수: slotsOf · slotsBody · giftOf · boxOf · visibleOf · sentTodayOf · sentOf · sendBody · failOf · ERRORS · PATHS · LIMITS (TwGiftApi 위)
   ⚠️ 쓰기는 «읽은 토큰의 주인» 과 묶는다(expectOwner) — 계정이 바뀌는 틈에 앞 계정 화면의 누름이 새 계정 토큰으로 나가지 않게.
     읽은 적이 없으면(내 것을 받기 전) NOT_RECEIVED 로 요청 0. 주인 기억은 내 것 읽기(mallangs · gifts · sent-today)만 남긴다.
   ⚠️ 칸 저장은 통째 PUT 하나 — 판(version)은 상태 주인(mallang-store)이 들고 넘긴다. 409 CONCURRENT_UPDATE 에 여기서 다시 받아 한 번 더 보내지 않는다.
   검사: checks/sim-gift-api.js */
(function(){
'use strict';

const PATHS = Object.freeze({
  mine: '/v1/me/mallangs',
  of: (userCode) => '/v1/mallangs/' + encodeURIComponent(userCode),
  image: '/v1/me/images?purpose=mallang',
  box: '/v1/me/gifts',
  seen: '/v1/me/gifts/seen',
  one: (id) => '/v1/me/gifts/' + encodeURIComponent(id),
  sentToday: '/v1/me/gifts/sent-today',
  visible: (userCode) => '/v1/gifts/' + encodeURIComponent(userCode),
  send: (userCode) => '/v1/gifts/' + encodeURIComponent(userCode),
});
/* 서버 상한과 같은 값 — 넘기면 서버가 거절한다 */
const LIMITS = Object.freeze({ SLOTS: 4, MESSAGE: 50, IMAGE_BYTES: 1024 * 1024 });
const IMAGE_TYPES = Object.freeze(['image/png', 'image/webp']);   // 말랑이는 JPEG 를 받지 않는다(투명 배경)
const NOT_RECEIVED_CODE = 'NOT_RECEIVED';
const IMAGE_UPLOAD_CODE = 'IMAGE_UPLOAD';

/* 서버 코드 → 화면이 할 일의 갈래(TwApiErrors.translate 에 넘기는 기능 표 — 공통 표보다 먼저 본다).
   guide = 안내 토스트(서버 문구 · 번호 없음) · gone = 이미 없는 선물(안내 + 받기 한 번) · missing = 그 사람이 없음(«없음» 화면 · 번호 없음)
   · site = 그 자리의 E-GIFT 번호 · stale = 계정이 바뀌는 중이거나 받기 전(조용히 버림) */
const KIND = Object.freeze({ GUIDE: 'guide', GONE: 'gone', MISSING: 'missing', SITE: 'site', STALE: 'stale', CONFLICT: 'conflict', COMMON: 'common' });
const row = (kind) => Object.freeze({ action: kind, notice: null });
const ERRORS = Object.freeze({
  GIFT_STAR_FULL: row(KIND.GUIDE), GIFT_STARRED: row(KIND.GUIDE), GIFT_SELF: row(KIND.GUIDE), GIFT_NOT_FRIEND: row(KIND.GUIDE),
  GIFT_NO_MALLANG: row(KIND.GUIDE), GIFT_DAILY_LIMIT: row(KIND.GUIDE), GIFT_RECIPIENT_FULL: row(KIND.GUIDE), GIFT_MESSAGE_INVALID: row(KIND.GUIDE),
  GIFT_NOT_FOUND: row(KIND.GONE),
  USER_NOT_FOUND: row(KIND.MISSING),
  GIFT_IMAGE_COPY_FAILED: row(KIND.SITE), GIFT_MALLANG_INVALID: row(KIND.SITE), GIFT_INVALID_STATE: row(KIND.SITE),
  IMAGE_UPLOAD: row(KIND.SITE), SHAPE: row(KIND.SITE), BAD_SLOT: row(KIND.SITE),
  OWNER_CHANGED: row(KIND.STALE), NOT_RECEIVED: row(KIND.STALE),
});
const CONCURRENT_CODE = 'CONCURRENT_UPDATE';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const str = (v) => (typeof v === 'string' ? v : '');
const cnt = (v) => typeof v === 'number' && isFinite(v) && v >= 0 && Math.floor(v) === v;
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });
const codeError = (code, message) => Object.assign(new Error(message || code), { code });
const msOf = (iso) => { const t = Date.parse(iso); return isFinite(t) ? t : 0; };

/* 실패 하나 → { kind, code, message }. errs = TwApiErrors(translate · COMMON).
   기능 표 → 그 갈래 · 공통 code → common(CONCURRENT_UPDATE 만 conflict) · 그 밖(닿지 못함 · 모르는 code) → site(그 자리 번호) */
function failOf(err, errs){
  const t = errs.translate(err, ERRORS);
  let kind;
  if(own(ERRORS, t.code)) kind = t.action;
  else if(t.code === CONCURRENT_CODE) kind = KIND.CONFLICT;
  else if(own(errs.COMMON, t.code)) kind = KIND.COMMON;
  else kind = KIND.SITE;
  return { kind, code: t.code, message: str(err && err.message) };
}

/* data:image/…;base64,… → { type, bytes }. 형식이 아니면 null */
function parseDataUrl(u){
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]*)$/.exec(str(u));
  if(!m) return null;
  let bin;
  try{ bin = atob(m[2]); }catch(_){ return null; }
  const bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { type: m[1], bytes };
}

/* 칸 응답 { slots:[{slot, imageUrl, enabled}], version } → { slots:[{slot, imageUrl, enabled}] (slot 차례 · 서버 번호 그대로), version }. 모양이 틀리면 undefined */
function slotsOf(d){
  if(!isObj(d) || !Array.isArray(d.slots) || !cnt(d.version) || d.slots.length > LIMITS.SLOTS) return undefined;
  const list = [], seen = new Set();
  for(const s of d.slots){
    if(!isObj(s) || !cnt(s.slot) || s.slot >= LIMITS.SLOTS || seen.has(s.slot) || !nonEmpty(s.imageUrl) || typeof s.enabled !== 'boolean') return undefined;
    seen.add(s.slot);
    list.push(s);
  }
  list.sort((a, b) => a.slot - b.slot);
  return { slots: list.map((s) => ({ slot: s.slot, imageUrl: s.imageUrl, enabled: s.enabled })), version: d.version };
}
/* 칸 저장 본문 — 들고 있던 서버 번호는 버리고 배열 차례로 0부터 다시 매긴다(지우면 뒤 칸이 당겨지는 화면 그대로) */
function slotsBody(version, slots){
  return { version, slots: (slots || []).slice(0, LIMITS.SLOTS).map((s, i) => ({ slot: i, imageUrl: str(s && s.imageUrl), enabled: !!(s && s.enabled) })) };
}

/* 선물함 한 줄 → 화면 한 줄. 모양이 틀리면 undefined */
function giftOf(raw){
  if(!isObj(raw) || !nonEmpty(raw.id) || typeof raw.senderName !== 'string' || !nonEmpty(raw.imageUrl)
    || typeof raw.starred !== 'boolean' || typeof raw.hidden !== 'boolean') return undefined;
  return { id: raw.id, senderName: raw.senderName, imageUrl: raw.imageUrl, message: str(raw.message), starred: raw.starred, hidden: raw.hidden, sentAt: msOf(raw.sentAt) };
}
/* GET /v1/me/gifts → 선물함. 한 줄이 깨져 있으면 그 줄만 뺀다 · 숫자 칸이 틀리면 undefined */
function boxOf(d){
  if(!isObj(d) || !Array.isArray(d.items) || !cnt(d.unseenCount) || !cnt(d.starCount) || !cnt(d.boxKeep) || !cnt(d.starMax)) return undefined;
  const items = [];
  for(const raw of d.items){ const g = giftOf(raw); if(g) items.push(g); }
  return { items, unseenCount: d.unseenCount, starCount: d.starCount, boxKeep: d.boxKeep, starMax: d.starMax };
}
/* GET /v1/gifts/{code} → 그 집에 나온 선물. 모양이 틀리면 undefined */
function visibleOf(d){
  if(!isObj(d) || !Array.isArray(d.items) || !cnt(d.visibleCount) || !cnt(d.recipientCap)) return undefined;
  const items = [];
  for(const raw of d.items){
    if(isObj(raw) && nonEmpty(raw.id) && nonEmpty(raw.imageUrl)) items.push({ id: raw.id, imageUrl: raw.imageUrl, message: str(raw.message) });
  }
  return { items, visibleCount: d.visibleCount, recipientCap: d.recipientCap };
}
function sentTodayOf(d){
  if(!isObj(d) || !cnt(d.count) || !cnt(d.dailyMax)) return undefined;
  return { count: d.count, dailyMax: d.dailyMax };
}
function sentOf(d){
  if(!isObj(d) || !nonEmpty(d.giftId) || !cnt(d.sentToday) || !cnt(d.dailyMax)) return undefined;
  return { giftId: d.giftId, sentToday: d.sentToday, dailyMax: d.dailyMax };
}
/* UTF-16 n 자까지 — 끝이 이모지 짝(서로게이트)의 앞 반쪽이면 그것도 뺀다(입력칸 maxlength · 서버 길이 셈과 같은 단위) */
function clip(text, n){
  let t = text.slice(0, n);
  const last = t.charCodeAt(t.length - 1);
  if(last >= 0xD800 && last <= 0xDBFF) t = t.slice(0, -1);
  return t;
}
/* 보내기 본문 — 요청 번호 · 칸(고른 칸의 서버 번호) · 메시지만(보낸 사람 · 이름 · 날짜 · 그림 주소는 서버가 정한다).
   칸 번호가 없으면 undefined — 화면 차례로 메우지 않는다(칸이 0 · 2 처럼 비면 다른 칸이 간다) */
function sendBody(o){
  const slot = o && isObj(o.mallang) ? o.mallang.slot : undefined;
  if(!cnt(slot) || slot >= LIMITS.SLOTS) return undefined;
  const body = { requestId: str(o && o.requestId), slot };
  const msg = clip(str(o && o.message).trim(), LIMITS.MESSAGE);
  if(msg) body.message = msg;
  return body;
}

function createGiftApi(deps){
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
      else warn('[선물] ' + what + ' 실패', (e && (e.code || e.message)) || e);
      throw e;
    }
  }
  const need = (v) => { if(!v) throw shapeError(); return v; };
  const needCode = (c) => { if(!nonEmpty(c)) throw codeError('NO_USER', '사용자 코드 없음'); return c; };

  async function uploadImage(dataUrl){
    const img = parseDataUrl(dataUrl);
    if(!img || IMAGE_TYPES.indexOf(img.type) < 0 || img.bytes.length === 0 || img.bytes.length > LIMITS.IMAGE_BYTES) throw codeError(IMAGE_UPLOAD_CODE, '말랑이 그림을 올리지 못했어요');
    const d = await write('그림 올리기', (o) => authed.post(PATHS.image, img.bytes, Object.assign({ rawType: img.type }, o)));
    if(!isObj(d) || !nonEmpty(d.url)) throw shapeError();
    return d.url;
  }

  return {
    fetchMine: async () => need(slotsOf(await readMine(PATHS.mine))),
    fetchOf: async (userCode) => need(slotsOf(await authed.get(PATHS.of(needCode(userCode)), { auth: true }))),
    uploadImage,
    saveMallangs: async (version, slots) => need(slotsOf(await write('말랑이 저장', (o) => authed.put(PATHS.mine, slotsBody(version, slots), o)))),
    fetchBox: async () => need(boxOf(await readMine(PATHS.box))),
    markSeen: async () => { await write('봤음', (o) => authed.post(PATHS.seen, {}, o)); },
    star: async (id, on) => { await write('즐겨찾기', (o) => authed.patch(PATHS.one(id), { starred: !!on }, o)); },
    hide: async (id, on) => { await write('치우기', (o) => authed.patch(PATHS.one(id), { hidden: !!on }, o)); },
    remove: async (id) => { await write('지우기', (o) => authed.del(PATHS.one(id), o)); },
    fetchSentToday: async () => need(sentTodayOf(await readMine(PATHS.sentToday))),
    fetchVisible: async (userCode) => need(visibleOf(await authed.get(PATHS.visible(needCode(userCode)), { auth: true }))),
    send: async (userCode, o) => {
      const code = needCode(userCode);
      const body = sendBody(o);
      if(!body) throw codeError('BAD_SLOT', '보낼 말랑이 칸이 없어요');
      return need(sentOf(await write('보내기', (opts) => authed.post(PATHS.send(code), body, opts))));
    },
    reset: () => { epoch++; owner = undefined; },
  };
}

const api = { createGiftApi, slotsOf, slotsBody, giftOf, boxOf, visibleOf, sentTodayOf, sentOf, sendBody, failOf, ERRORS, KIND, PATHS, LIMITS };
if(typeof window !== 'undefined') window.TwGiftApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
