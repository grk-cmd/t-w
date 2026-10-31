/* schedule-api.js — 📅 일정 · 🎂 디데이 · 🔔 일정 알림 api provider (검사 sim-schedule-api.js)
   책임: 내 달력 한 달 읽기 · 일정 쓰기 · 지우기(GET · POST · DELETE /v1/me/schedules) · 남의 공개 일정(GET /v1/schedules/{userCode}) ·
     디데이 보드 통째 읽기 · 통째 저장(GET · PUT /v1/me/ddays) · 남의 공개 보드(GET /v1/ddays/{userCode}) · 친구가 태그한 알림(GET · DELETE /v1/me/notifications — 🔔 칸).
     서버 모양(visibility · countFromOne · bgImage · cards / banners 두 목록)을 화면이 쓰던 모양(public · base1 · bgImg · kind · order)으로 맞추는 곳은 여기뿐이다.
   신원: 내 것은 토큰(/v1/me/…) · 남의 것은 사용자 코드(경로의 코드는 데이터 주소일 뿐). 내 코드(uid)는 «읽은 판 · 토큰 주인 기억 열쇠» 로만 받는다.
   deps: authed — 로그인 API 통로(TwApi.authed — get(path, { auth, onOwner }) · post · put · del(path, …, { expectOwner }) → Promise<data>)
         newId() → 요청 번호(TwRequestId.newId) · warn(...a)
   내보냄: createScheduleApi(deps) → {
     fetchMonth(uid, ym) → Promise<{ DD: { id: { text, public, ts, version, date } } }> — 일정이 없어도 {}(빈 달 ≠ 못 읽음). 못 읽으면 던진다.
     fetchMonthOf(userCode, ym) → 같은 모양(공개한 일정만). 못 읽으면 던진다.
     createItem(uid, { date, text, public, tagFriends }) → Promise<{ id, date, text, public, version }> — 친구를 태그하면 서버가 공개로 바꾼다.
     deleteItem(uid, id, version) → Promise<void> — 이미 없으면 성공.
     fetchBoard(uid) → Promise<{ ddayId: { kind, text, date, public, notify, base1, bgColor, bgImg, order, ts } }> — 비어도 {}. 못 읽으면 던진다.
     fetchBoardOf(userCode) → 같은 모양(공개한 장만).
     saveBoard(uid, ddays, tag) → Promise<ddays> — 보드를 통째로 보낸다. tag = { id, userCodes }(이번에 저장한 한 장에 대해 알릴 친구) 또는 null. 새 장은 id 가 UUID 가 아닌 임시 열쇠.
     fetchBell(uid) → Promise<{ id: { fromId, fromName, text, date, ts } }> — 친구가 일정에 태그해 보낸 알림. 못 읽으면 던진다.
     deleteBell(uid, id) → Promise<void>
     orderedIds(ddays, kind) → 그 종류의 열쇠를 «order → 만든 순» 으로(순수 — 화면과 저장이 같은 순서를 쓴다)
     reset() — 읽은 판 · 토큰 주인 기억을 비운다(계정을 놓을 때)
   }
     순수: itemOf · monthOf · ddayOf · boardOf · bellOf · boardBody · orderedIds · PATHS · LIMITS (TwScheduleApi 위)
   ⚠️ 보드는 판(version)으로 겹친 고침을 가른다 — 저장은 «마지막으로 읽은 판» 을 실어 보내고, 다른 기기가 먼저 저장했으면(409 CONCURRENT_UPDATE) 판을 버려 다시 받기 전엔 쓰지 못하게 한다. 409 에 판을 다시 읽어 한 번 더 보내지 않는다.
   ⚠️ 쓰기는 읽은 토큰의 주인과 묶는다(expectOwner) — 계정이 바뀌는 틈에 앞 계정의 값이 새 계정 토큰으로 나가지 않게. 읽은 적 없으면(받기 전) 쓰지 않는다.
   ⚠️ 카드 그림은 data: 로 들고 있다가 저장할 때만 올린다(POST /v1/me/images?purpose=dday — 바이트 그대로 · 1MB 이하 png / webp / jpeg, 응답 { url }). 올리기를 못 하면 보드를 보내지 않는다(그림이 빠진 채 저장되지 않게).
   검사: checks/sim-schedule-api.js */
(function(){
'use strict';

const PATHS = Object.freeze({
  month: (ym) => '/v1/me/schedules?month=' + encodeURIComponent(ym),
  monthOf: (userCode, ym) => '/v1/schedules/' + encodeURIComponent(userCode) + '?month=' + encodeURIComponent(ym),
  create: '/v1/me/schedules',
  item: (id, version) => '/v1/me/schedules/' + encodeURIComponent(id) + '?version=' + encodeURIComponent(version),
  board: '/v1/me/ddays',
  boardOf: (userCode) => '/v1/ddays/' + encodeURIComponent(userCode),
  bell: '/v1/me/notifications?section=BELL&limit=50',
  image: '/v1/me/images?purpose=dday',
  bellOne: (id) => '/v1/me/notifications/' + encodeURIComponent(id),
});
/* 서버 상한과 같은 값 — 넘기면 서버가 거절한다 */
const LIMITS = Object.freeze({ TEXT: 40, DDAY_TEXT: 20, DDAY_PER_KIND: 10, TAGS: 100, IMAGE_BYTES: 1024 * 1024 });
const IMAGE_TYPES = Object.freeze(['image/png', 'image/webp', 'image/jpeg']);
const IMAGE_REJECT_STATUS = Object.freeze([400, 413, 415]);   // 서버가 이 그림을 안 받는다(형식 · 크기 · 모양) — 같은 오류 번호로
const KIND = Object.freeze({ CARD: 'anniv', BANNER: 'dday' });   // 화면이 쓰는 종류 이름 — 기념일 카드 · 디데이 배너
const BELL_KIND = 'SCHEDULE_TAG';
const OWNER_CHANGED_CODE = 'OWNER_CHANGED';   // api-client.js — 쓰기 직전 토큰 주인이 읽을 때와 달라졌다
const CONFLICT_STATUS = 409;
const CONCURRENT_CODE = 'CONCURRENT_UPDATE';   // 다른 기기가 먼저 고쳤다 — 같은 409 라도 SCHEDULE_DDAY_FULL(상한)은 판이 그대로다
const NOT_RECEIVED_CODE = 'NOT_RECEIVED';
const IMAGE_UPLOAD_CODE = 'IMAGE_UPLOAD';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/* data:image/…;base64,… → { type, bytes }. 형식이 아니면 null */
function parseDataUrl(u){
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]*)$/.exec(typeof u === 'string' ? u : '');
  if(!m) return null;
  let bin;
  try{ bin = atob(m[2]); }catch(_){ return null; }
  const bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { type: m[1], bytes };
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const fin = (v) => typeof v === 'number' && isFinite(v);
const isVis = (v) => v === 'PUBLIC' || v === 'PRIVATE';
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });
const codeError = (code, message) => Object.assign(new Error(message || code), { code });
const msOf = (iso) => { const t = Date.parse(iso); return isFinite(t) ? t : 0; };

/* 일정 한 줄 → 화면 한 줄. 모양이 틀리면 undefined */
function itemOf(raw){
  if(!isObj(raw) || typeof raw.id !== 'string' || !raw.id || typeof raw.date !== 'string' || !DATE_RE.test(raw.date)
    || typeof raw.text !== 'string' || !isVis(raw.visibility) || !fin(raw.version)) return undefined;
  return { id: raw.id, date: raw.date, text: raw.text, public: raw.visibility === 'PUBLIC', version: raw.version, ts: msOf(raw.createdAt) };
}
/* 한 달 목록 → { DD: { id: 칸 } }. ts 는 서버가 준 만든 시각(ms) — 없거나 깨지면 0(오래된 것). 모양이 틀리면 undefined */
function monthOf(list, ym){
  if(!Array.isArray(list)) return undefined;
  const byDay = {};
  for(const raw of list){
    const it = itemOf(raw);
    if(!it) return undefined;
    if(it.date.slice(0, 7) !== ym) continue;
    const dd = it.date.slice(8, 10);
    (byDay[dd] = byDay[dd] || {})[it.id] = { text: it.text, public: it.public, ts: it.ts, version: it.version, date: it.date };
  }
  return byDay;
}

/* 디데이 한 장 → 화면 한 장. 모양이 틀리면 undefined */
function ddayOf(raw, kind, order){
  if(!isObj(raw) || typeof raw.ddayId !== 'string' || !raw.ddayId || typeof raw.text !== 'string' || typeof raw.date !== 'string' || !DATE_RE.test(raw.date)
    || !isVis(raw.visibility) || typeof raw.notify !== 'boolean' || typeof raw.countFromOne !== 'boolean') return undefined;
  return { kind, text: raw.text, date: raw.date, public: raw.visibility === 'PUBLIC', notify: raw.notify, base1: raw.countFromOne,
    bgColor: str(raw.bgColor) || null, bgImg: str(raw.bgImage) || null, order, ts: msOf(raw.createdAt) };
}
/* 보드(두 목록) → { 열쇠: 장 }. 목록 순서가 곧 order. 모양이 틀리면 undefined */
function ddaysOf(data){
  if(!isObj(data) || !Array.isArray(data.cards) || !Array.isArray(data.banners)) return undefined;
  const out = {};
  for(const [list, kind] of [[data.cards, KIND.CARD], [data.banners, KIND.BANNER]]){
    for(let i = 0; i < list.length; i++){
      const d = ddayOf(list[i], kind, i);
      if(!d) return undefined;
      out[list[i].ddayId] = d;
    }
  }
  return out;
}
/* GET /v1/me/ddays 의 data → { version, ddays }. 모양이 틀리면 undefined */
function boardOf(data){
  const ddays = ddaysOf(data);
  if(!ddays || !fin(data.version) || data.version < 0) return undefined;
  return { version: data.version, ddays };
}

/* 그 종류의 열쇠 — order 가 작은 쪽 먼저, order 가 없으면 맨 뒤, 같으면 만든 순. 화면 그리기와 저장이 같은 순서를 쓴다 */
function orderedIds(ddays, kind){
  const src = ddays || {};
  const ids = Object.keys(src).filter((id) => (src[id].kind === KIND.BANNER ? KIND.BANNER : KIND.CARD) === kind);
  const at = (id) => (typeof src[id].order === 'number' ? src[id].order : Number.MAX_SAFE_INTEGER);
  ids.sort((a, b) => (at(a) - at(b)) || ((src[a].ts || 0) - (src[b].ts || 0)));
  return ids;
}

/* 한 장의 저장 본문 — 새 장(UUID 가 아닌 열쇠)은 ddayId 를 싣지 않는다. 그림 · 셈법은 카드만 */
function ddayBody(id, d){
  const o = { text: str(d.text).slice(0, LIMITS.DDAY_TEXT), date: str(d.date), visibility: d.public ? 'PUBLIC' : 'PRIVATE', notify: !!d.notify };
  if(UUID_RE.test(id)) o.ddayId = id;
  if(d.kind !== KIND.BANNER){
    o.countFromOne = d.base1 === true;
    if(d.bgColor) o.bgColor = d.bgColor;
    if(d.bgImg) o.bgImage = d.bgImg;
  }
  return o;
}
/* 보드 저장 본문 — 두 목록은 order 순. tag = { id, userCodes } 이면 그 장이 속한 목록의 몇 번째인지로 바꿔 싣는다 */
function boardBody(version, ddays, tag){
  const cardIds = orderedIds(ddays, KIND.CARD), bannerIds = orderedIds(ddays, KIND.BANNER);
  const body = { version, cards: cardIds.map((id) => ddayBody(id, ddays[id])), banners: bannerIds.map((id) => ddayBody(id, ddays[id])) };
  const codes = (tag && Array.isArray(tag.userCodes)) ? tag.userCodes.filter((c) => typeof c === 'string' && c).slice(0, LIMITS.TAGS) : [];
  if(tag && codes.length){
    const ci = cardIds.indexOf(tag.id), bi = bannerIds.indexOf(tag.id);
    if(ci >= 0) body.tagFriends = { kind: 'CARD', index: ci, userCodes: codes };
    else if(bi >= 0) body.tagFriends = { kind: 'BANNER', index: bi, userCodes: codes };
  }
  return body;
}

/* 🔔 알림 한 줄 → { fromId, fromName, text, date, ts }. 일정 태그가 아니거나 모양이 틀리면 null */
function bellOf(raw){
  if(!isObj(raw) || raw.kind !== BELL_KIND || typeof raw.id !== 'string' || !raw.id || !isObj(raw.payload)) return null;
  const date = str(raw.payload.date);
  if(!DATE_RE.test(date)) return null;
  return { fromId: str(raw.payload.from), fromName: str(raw.payload.fromName), text: str(raw.body), date, ts: msOf(raw.createdAt) };
}

function createScheduleApi(deps){
  const authed = deps.authed;
  const newId = deps.newId;
  const warn = deps.warn;
  const reads = new Map();   // uid → { owner: 마지막으로 읽을 때 쓴 토큰의 주인, v: 보드 판(없으면 undefined) }
  let epoch = 0;             // reset 마다 오른다 — reset 전에 시작한 읽기가 늦게 끝나도 기억을 되살리지 않게

  /* 내 것을 읽는 GET — 토큰 주인을 기억한다. 판은 보드만 */
  async function readMine(uid, path, withVersion){
    let owner;
    const at = epoch;
    const d = await authed.get(path, { auth: true, onOwner: (who) => { owner = who; } });
    if(at !== epoch) return d;   // 읽는 사이 계정을 놓았다 — 읽은 기억을 남기지 않는다(쓰기는 다시 받기 전까지 막힌 채)
    const prev = reads.get(uid);
    /* 판은 «같은 토큰 주인이 읽은» 것만 잇는다 — 다른 주인의 판에 이 주인의 읽기를 얹으면 남의 보드를 내 판으로 덮는 길이 된다 */
    reads.set(uid, { owner, v: withVersion ? undefined : (prev && prev.owner === owner ? prev.v : undefined) });
    return d;
  }
  /* 쓰기 전에 «읽은 적이 있는가» — 받기 전에는 올리지 않는다 */
  function readOf(uid){
    const r = uid ? reads.get(uid) : null;
    if(!r) throw codeError(NOT_RECEIVED_CODE, '받기 전에는 쓰지 않아요');
    return r;
  }

  async function fetchMonth(uid, ym){
    if(!uid) throw codeError('NO_USER', '내 코드 없음');
    const out = monthOf(await readMine(uid, PATHS.month(ym), false), ym);
    if(!out) throw shapeError();
    return out;
  }
  async function fetchMonthOf(userCode, ym){
    if(!userCode) throw codeError('NO_USER', '사용자 코드 없음');
    const out = monthOf(await authed.get(PATHS.monthOf(userCode, ym), { auth: true }), ym);
    if(!out) throw shapeError();
    return out;
  }

  async function createItem(uid, o){
    const read = readOf(uid);
    const tags = Array.isArray(o.tagFriends) ? o.tagFriends.slice(0, LIMITS.TAGS) : [];
    const body = { requestId: newId(), date: o.date, text: str(o.text).slice(0, LIMITS.TEXT), visibility: o.public ? 'PUBLIC' : 'PRIVATE' };   // 태그하면 서버가 공개로 바꾼다 — 화면이 이미 «공개» 를 켜 둔 채 보낸다(앱이 몰래 바꾸지 않는다)
    if(tags.length) body.tagFriends = tags;
    const it = itemOf(await authed.post(PATHS.create, body, { expectOwner: read.owner }));
    if(!it) throw shapeError();
    return it;
  }
  async function deleteItem(uid, id, version){
    const read = readOf(uid);
    if(!id || !fin(version)) throw codeError('BAD_ITEM', '지울 일정을 못 찾았어요');
    await authed.del(PATHS.item(id, version), { expectOwner: read.owner });
  }

  async function fetchBoard(uid){
    if(!uid) throw codeError('NO_USER', '내 코드 없음');
    const at = epoch;
    const d = await readMine(uid, PATHS.board, true);
    const out = boardOf(d);
    if(!out) throw shapeError();
    if(at === epoch && reads.get(uid)) reads.set(uid, Object.assign({}, reads.get(uid), { v: out.version }));
    return out.ddays;
  }
  async function fetchBoardOf(userCode){
    if(!userCode) throw codeError('NO_USER', '사용자 코드 없음');
    const out = ddaysOf(await authed.get(PATHS.boardOf(userCode), { auth: true }));
    if(!out) throw shapeError();
    return out;
  }

  /* 그림 한 장 올리기 → 주소. 형식 · 1MB 를 넘으면 요청 없이 IMAGE_UPLOAD. 서버가 안 받으면(400 · 413 · 415) IMAGE_UPLOAD,
     계정이 바뀐 것(OWNER_CHANGED) · 닿지 못함 등은 그대로 던진다 */
  async function uploadImage(dataUrl, owner){
    const img = parseDataUrl(dataUrl);
    if(!img || IMAGE_TYPES.indexOf(img.type) < 0 || img.bytes.length > LIMITS.IMAGE_BYTES || img.bytes.length === 0) throw codeError(IMAGE_UPLOAD_CODE, '카드 그림을 올리지 못했어요');
    let d;
    try{ d = await authed.post(PATHS.image, img.bytes, { expectOwner: owner, rawType: img.type }); }
    catch(e){
      if(e && e.kind === 'request' && IMAGE_REJECT_STATUS.indexOf(e.status) >= 0) throw codeError(IMAGE_UPLOAD_CODE, '카드 그림을 올리지 못했어요');
      throw e;
    }
    if(!isObj(d) || typeof d.url !== 'string' || !d.url) throw shapeError();
    return d.url;
  }

  /* 새로 고른 그림(data:)만 올려 주소로 바꾼 사본 — 하나라도 못 올리면 던진다(보드를 보내지 않는다) */
  async function withUploadedImages(ddays, owner){
    const out = {};
    for(const id of Object.keys(ddays)){
      const d = Object.assign({}, ddays[id]);
      if(d.kind !== KIND.BANNER && typeof d.bgImg === 'string' && d.bgImg.startsWith('data:')){
        try{ d.bgImg = await uploadImage(d.bgImg, owner); }
        catch(e){ warn('[일정] 카드 그림 올리기 실패', (e && (e.code || e.message)) || e); throw e; }
      }
      out[id] = d;
    }
    return out;
  }

  /* 보드를 통째로 저장 — 마지막으로 읽은 판을 실어 보낸다. 성공하면 서버가 돌려준 보드(새 장의 id · 순서)가 정답이다.
     409 면 판을 버린다 — 부른 쪽이 fetchBoard 로 서버 것을 다시 받기 전엔 쓰지 못한다(남이 먼저 고친 것을 덮어쓰지 않게) */
  async function saveBoard(uid, ddays, tag){
    const read = readOf(uid);
    if(read.v === undefined) throw codeError(NOT_RECEIVED_CODE, '받기 전에는 쓰지 않아요');
    try{
      const ready = await withUploadedImages(ddays, read.owner);
      const out = boardOf(await authed.put(PATHS.board, boardBody(read.v, ready, tag), { expectOwner: read.owner }));
      if(!out) throw shapeError();
      reads.set(uid, { owner: read.owner, v: out.version });
      return out.ddays;
    }catch(e){
      if(e && (e.code === OWNER_CHANGED_CODE || (e.status === CONFLICT_STATUS && e.code === CONCURRENT_CODE))) reads.set(uid, { owner: read.owner, v: undefined });
      throw e;
    }
  }

  async function fetchBell(uid){
    if(!uid) throw codeError('NO_USER', '내 코드 없음');
    const d = await readMine(uid, PATHS.bell, false);
    if(!isObj(d) || !Array.isArray(d.items)) throw shapeError();
    const out = {};
    for(const raw of d.items){
      const n = bellOf(raw);
      if(n) out[raw.id] = n;
    }
    return out;
  }
  async function deleteBell(uid, id){
    const read = readOf(uid);
    await authed.del(PATHS.bellOne(id), { expectOwner: read.owner });
  }

  return { fetchMonth, fetchMonthOf, createItem, deleteItem, fetchBoard, fetchBoardOf, saveBoard, fetchBell, deleteBell,
    orderedIds, reset: () => { epoch++; reads.clear(); }, LIMITS, KIND };
}

const api = { createScheduleApi, itemOf, monthOf, ddayOf, ddaysOf, boardOf, bellOf, boardBody, orderedIds, PATHS, LIMITS, KIND };
if(typeof window !== 'undefined') window.TwScheduleApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
