/* closet-api.js — 🧬 옷장(슬롯 5칸 · 보관함 · 휴지통) api provider (검사 sim-closet-api.js)
   책임: 내 캐릭터 옷장을 서버에서 받고(GET /v2/me/avatars — 슬롯 캐릭터의 def 까지 한 번에) 캐릭터 하나를 읽고 · 만들고 · 고치고 ·
     슬롯 ↔ 보관함으로 옮기고 · 휴지통으로 보내고 · 되살린다(/v2/me/avatars/…). 슬롯 5칸 · 보관함 20 · 휴지통 기한(옮김 3일 · 연동 교체 10일)은 서버가 정한다.
   신원: 토큰이 정한 나뿐이다(남의 옷장을 읽거나 고치는 길이 없다). 읽을 때 토큰의 주인을 기억해 두고 쓰기는 그 주인과 묶는다(expectOwner —
     계정이 바뀌는 틈에 앞 계정 캐릭터가 새 계정 토큰으로 나가지 않게). 읽기 전에는 쓰지 않는다.
   deps: authed — 로그인 API 통로(TwApi.authed — get(path, { auth, onOwner, timeoutMs }) · post · put(path, body, { auth, expectOwner, timeoutMs }) → Promise<data>)
         newRequestId() → 요청 이름(만들기 · 되살리기 · 첫 실행 올리기는 같은 이름이면 처음 답이 돌아온다)
   내보냄: createClosetApi(deps) → {
     load() → Promise<{ slots:[avatarId|null ×5], avatars:[머리], defs:{ avatarId: def } }> — 못 읽으면 던진다(빈 옷장 ≠ 못 읽음)
     fetchOne(avatarId) → Promise<{ def, version, place }>
     create(slot, def) → Promise<{ avatarId, version }>      update(avatarId, baseVersion, def) → Promise<{ version }>
     move(avatarId, 'BOX' | 'SLOT') → Promise<옷장>           trash(avatarIds) → Promise<[{ id, ok, code }]>
     trashPage({ cursor, limit }) → Promise<{ items:[휴지통 줄], nextCursor }>      restore(trashId) → Promise<{ avatarId, closet|null }>
     legacySync(items) → Promise<옷장>(첫 실행 1회 — 서버가 이미 받았으면 AVATAR_LEGACY_SYNC_DONE)
     reset() — 읽은 주인 기억을 비운다(계정을 놓을 때)
   }
     머리 = { avatarId, place:'SLOT'|'BOX', slot:0~4|null, version, thumbUrl, faceUrl, updatedAt(ms), legacyCid }
     순수: headOf · closetOf · trashOf · failOf(err) → { code, items } · PATHS · LIMITS (TwClosetApi 위)
   ⚠️ 고치기는 «내가 마지막으로 받은 판(baseVersion)» 을 실어 보낸다 — 낡은 판이어도 서버가 받는다(앞 모습은 휴지통 «연동 교체» 10일). 409 가 아니다.
   ⚠️ 실패는 모두 던진다(서버 code 를 그대로) — 무엇으로 말할지는 부르는 쪽(closet.js)이 failOf 로 가른다. 혼자 다시 보내지 않는다.
   검사: checks/sim-closet-api.js */
(function(){
'use strict';

const BASE = '/v2/me/avatars';
const PATHS = Object.freeze({
  closet: BASE,
  one: (id) => BASE + '/' + encodeURIComponent(id),
  move: (id) => BASE + '/' + encodeURIComponent(id) + '/move',
  trash: BASE + '/trash',
  restore: (id) => BASE + '/trash/' + encodeURIComponent(id) + '/restore',
  legacySync: BASE + '/legacy-sync',
});
/* 서버 규격과 같은 값 — 넘기면 서버가 거절한다 */
const LIMITS = Object.freeze({ SLOTS: 5, BOX_MAX: 20, BULK_MAX: 25, TRASH_PAGE: 50 });
const LOAD_TIMEOUT_MS = 8000;      // 슬롯 캐릭터의 def 까지 실려 와 한 번이 크다
const WRITE_TIMEOUT_MS = 15000;    // def 한 개(최대 150000자)
const OWNER_CHANGED_CODE = 'OWNER_CHANGED';
const PLACE = Object.freeze({ SLOT: 'SLOT', BOX: 'BOX' });

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const toMs = (v) => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return isFinite(t) ? t : 0; };
const strOrNull = (v) => (typeof v === 'string' && v) ? v : null;

/* 머리 한 줄 → 앱 모양. 모양이 틀리면 null(그 줄은 버린다). */
function headOf(r){
  if(!isObj(r) || typeof r.avatarId !== 'string' || !r.avatarId) return null;
  const place = r.place === PLACE.SLOT ? PLACE.SLOT : (r.place === PLACE.BOX ? PLACE.BOX : null);
  if(!place) return null;
  const slot = (place === PLACE.SLOT && Number.isInteger(r.slot) && r.slot >= 0 && r.slot < LIMITS.SLOTS) ? r.slot : null;
  if(place === PLACE.SLOT && slot === null) return null;
  if(!Number.isInteger(r.version) || r.version < 0) return null;
  return { avatarId: r.avatarId, place, slot, version: r.version, thumbUrl: strOrNull(r.thumbUrl), faceUrl: strOrNull(r.faceUrl), updatedAt: toMs(r.updatedAt), legacyCid: strOrNull(r.legacyCid) };
}

/* 옷장 응답 → { slots, avatars, defs }. 모양이 틀리면 null. 슬롯 칸이 가리키는 캐릭터의 def 가 없으면 모양이 틀린 것이다(그 칸을 빈 칸으로 읽지 않는다). */
function closetOf(d){
  if(!isObj(d) || !Array.isArray(d.slots) || d.slots.length !== LIMITS.SLOTS || !Array.isArray(d.avatars)) return null;
  const avatars = [];
  for(const r of d.avatars){ const h = headOf(r); if(!h) return null; avatars.push(h); }
  const defs = {};
  const src = isObj(d.slotDefs) ? d.slotDefs : {};
  const slots = [];
  for(let i = 0; i < LIMITS.SLOTS; i++){
    const id = d.slots[i];
    if(id === null){ slots.push(null); continue; }
    const head = avatars.find(a => a.avatarId === id);
    if(typeof id !== 'string' || !head || head.slot !== i || !isObj(src[id])) return null;
    slots.push(id); defs[id] = src[id];
  }
  return { slots, avatars, defs };
}

/* 휴지통 한 줄 → 앱 모양. 모양이 틀리면 null. */
function trashOf(r){
  if(!isObj(r) || typeof r.trashId !== 'string' || !r.trashId || typeof r.avatarId !== 'string') return null;
  const reason = r.reason === 'OVERWRITTEN' ? 'overwritten' : (r.reason === 'DELETED' ? 'deleted' : null);
  if(!reason) return null;
  return { trashId: r.trashId, avatarId: r.avatarId, why: reason, thumbUrl: strOrNull(r.thumbUrl), faceUrl: strOrNull(r.faceUrl), trashedAt: toMs(r.trashedAt), expiresAt: toMs(r.expiresAt) };
}

/* 실패 → { code, items } — items 는 «입을 수 없는 물건» 줄(AVATAR_ITEM_NOT_USABLE 만 · 없으면 빈 배열). 부르는 쪽이 code 로 문구를 고른다. */
function failOf(e){
  const code = (e && typeof e.code === 'string') ? e.code : '';
  const items = (e && Array.isArray(e.items)) ? e.items.filter(isObj) : [];
  return { code, items, kind: (e && e.kind) || '' };
}

/** @param {{ authed: { get: Function, post: Function, put: Function }, newRequestId: () => string }} deps */
function createClosetApi(deps){
  const authed = deps.authed;
  const newRequestId = deps.newRequestId;
  let owner = null;   // 마지막으로 읽은 토큰의 주인 — 쓰기를 이 주인과 묶는다

  const readOpts = () => ({ auth: true, timeoutMs: LOAD_TIMEOUT_MS, onOwner: (who) => { owner = who; } });
  /* 읽기 전에는 쓰지 않는다 — 어느 계정의 옷장인지 모르는 채 보내지 않는다 */
  function writeOpts(){
    if(!owner) throw Object.assign(new Error('옷장을 받기 전에는 보내지 않아요'), { kind: 'auth', code: OWNER_CHANGED_CODE });
    return { auth: true, timeoutMs: WRITE_TIMEOUT_MS, expectOwner: owner };
  }
  const bad = (what) => Object.assign(new Error('옷장 응답 모양이 달라요 — ' + what), { kind: 'request', code: 'BAD_SHAPE' });

  async function load(){
    const c = closetOf(await authed.get(PATHS.closet, readOpts()));
    if(!c) throw bad('옷장');
    return c;
  }
  async function fetchOne(avatarId){
    const d = await authed.get(PATHS.one(avatarId), readOpts());
    if(!isObj(d) || !isObj(d.def) || !Number.isInteger(d.version) || (d.place !== PLACE.SLOT && d.place !== PLACE.BOX)) throw bad('캐릭터');
    return { def: d.def, version: d.version, place: d.place };
  }
  async function create(slot, def){
    const d = await authed.post(BASE, { requestId: newRequestId(), def, slot }, writeOpts());
    if(!isObj(d) || typeof d.avatarId !== 'string' || !Number.isInteger(d.version)) throw bad('만들기');
    return { avatarId: d.avatarId, version: d.version };
  }
  async function update(avatarId, baseVersion, def){
    const d = await authed.put(PATHS.one(avatarId), { baseVersion, def }, writeOpts());
    if(!isObj(d) || !Number.isInteger(d.version)) throw bad('고치기');
    return { version: d.version };
  }
  async function move(avatarId, to){
    const c = closetOf(await authed.post(PATHS.move(avatarId), { to: to === PLACE.SLOT ? PLACE.SLOT : PLACE.BOX }, writeOpts()));
    if(!c) throw bad('옮기기');
    return c;
  }
  async function trash(avatarIds){
    const ids = Array.isArray(avatarIds) ? avatarIds.filter(x => typeof x === 'string' && x).slice(0, LIMITS.BULK_MAX) : [];
    if(!ids.length) return [];
    const d = await authed.post(PATHS.trash, { avatarIds: ids }, writeOpts());
    if(!Array.isArray(d)) throw bad('휴지통 보내기');
    return d.filter(isObj).map(r => ({ id: String(r.id), ok: r.ok === true, code: strOrNull(r.code) }));
  }
  async function trashPage(opt){
    const o = opt || {};
    const q = [];
    if(o.cursor) q.push('cursor=' + encodeURIComponent(o.cursor));
    q.push('limit=' + Math.max(1, Math.min(LIMITS.TRASH_PAGE, Math.floor(Number(o.limit)) || LIMITS.TRASH_PAGE)));
    const d = await authed.get(PATHS.trash + '?' + q.join('&'), readOpts());
    if(!isObj(d) || !Array.isArray(d.items)) throw bad('휴지통');
    const items = [];
    for(const r of d.items){ const t = trashOf(r); if(t) items.push(t); }
    return { items, nextCursor: strOrNull(d.nextCursor) };
  }
  async function restore(trashId){
    const d = await authed.post(PATHS.restore(trashId), { requestId: newRequestId() }, writeOpts());
    if(!isObj(d) || typeof d.avatarId !== 'string') throw bad('되살리기');
    /* 서버가 move 처럼 옷장을 같이 주면(closet) 그대로 쓴다. avatarId 만 주는 모양이면 closet 은 null — 부르는 쪽이 옷장을 다시 받는다(판 · 시각을 지어내지 않는다) */
    return { avatarId: d.avatarId, closet: closetOf(d) };
  }
  /* items: [{ legacyCid, def, editedAt(ms), slot }] ≤25 — editedAt 은 서버가 ISO 시각으로 받는다 */
  async function legacySync(items){
    const list = (Array.isArray(items) ? items : []).slice(0, LIMITS.BULK_MAX).map(it => ({
      legacyCid: it.legacyCid || null, def: it.def, editedAt: new Date(Number(it.editedAt) || 0).toISOString(), slot: Number.isInteger(it.slot) ? it.slot : null,
    }));
    const c = closetOf(await authed.post(PATHS.legacySync, { requestId: newRequestId(), items: list }, writeOpts()));
    if(!c) throw bad('첫 실행 올리기');
    return c;
  }
  function reset(){ owner = null; }

  return { load, fetchOne, create, update, move, trash, trashPage, restore, legacySync, reset };
}

const api = { createClosetApi, headOf, closetOf, trashOf, failOf, PATHS, LIMITS, PLACE, LOAD_TIMEOUT_MS, WRITE_TIMEOUT_MS };
if(typeof window !== 'undefined') window.TwClosetApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
