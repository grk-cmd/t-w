/* xmas-api.js — 🎄 크리스마스 이벤트 서버 읽기 · 쓰기(api provider · 일회성 — 다음 업데이트에서 걷는다 · 이슈 #1097) (검사 sim-xmas-api.js)
   책임: 트리(GET /v2/xmas/trees/current · /{t}/ornaments — 모두에게 같은 응답) · 내 몫(GET /v2/me/xmas — 장식 · 편지 · 반송 · 받은 편지) ·
     장식(PUT /v2/me/xmas/ornament) · 편지(PUT · DELETE /v2/me/xmas/letters/{lid} · DELETE /v2/me/xmas/returned/{lid}) · 신고(POST /v2/xmas/reports) ·
     그림 바이트(Storage xmas/{imageId}.png — api 를 거치지 않는다).
     서버 모양을 화면이 쓰던 모양({ ok, code } · 장식 { k, v, w, id })으로 맞추고 서버 오류 이름을 옛 code 로 바꾸는 곳은 여기뿐이다(ERROR_CODES — 설계 6-4).
   신원: 늘 토큰의 «나» — 경로 · 본문에 사람 코드를 싣지 않는다. 내 코드(me)는 이 PC 읽음 표시 열쇠로만.
   ★ 판(version)은 여기서 기억한다 — 마지막으로 읽은(또는 쓴) 내 장식 · 편지 칸의 판을 쓰기에 싣는다. 읽은 토큰의 주인과 묶어(expectOwner)
     로그인이 바뀌는 틈에 앞 계정의 판이 새 계정 토큰으로 나가지 않게 한다. 409 CONCURRENT_UPDATE 는 다시 보내지 않고 code 'conflict' — 부른 쪽이 다시 읽는다.
   ★ 날짜는 trees/current 를 읽을 때마다 schedule() 에 남긴다(rules.scheduleOf · 못 읽으면 앞 값) — 화면의 날짜 판정이 이 값을 쓴다.
   ★ 던지지 않는다 — { ok:true, … } / { ok:false, code, msg, err }(화면이 실패와 «없음» 을 나눠 그린다).
   deps: authed — 로그인 API 통로(TwApi.authed) · rules — TwXmasRules(scheduleOf) · myCode() — 내 사람 코드 · storageBucket() — 이 앱의 Storage 버킷 ·
         fetch — 그림 받기(window.fetch) · warn(...a)
   classic script(window.TwXmasApi) — xmas-window.js · app.js 보다 먼저 싣는다. app.js 가 `createXmasApi(deps)` 한 번. */
(function(){
'use strict';

const PATHS = Object.freeze({
  current: '/v2/xmas/trees/current',
  tree: (t) => '/v2/xmas/trees/' + t + '/ornaments',
  me: '/v2/me/xmas',
  ornament: '/v2/me/xmas/ornament',
  letter: (lid) => '/v2/me/xmas/letters/' + encodeURIComponent(lid),
  returned: (lid) => '/v2/me/xmas/returned/' + encodeURIComponent(lid),
  reports: '/v2/xmas/reports',
});
const STORAGE_HOST = 'https://firebasestorage.googleapis.com';
const IMAGE_ID_RE = /^[0-9a-f]{32}$/;
const IMAGE_BYTES_MAX = 16 * 1024;   // Storage 규칙 xmas/ 상한과 같다 — 넘는 응답은 그림으로 쓰지 않는다
const NOTE_MAX = 40;

/* 서버 오류 이름 → 옛 code(화면이 고르는 갈래). 없는 이름은 부른 쪽 기본(read · write · call) */
const ERROR_CODES = Object.freeze({
  XMAS_ENDED: 'failed-precondition',
  XMAS_KIND_INVALID: 'invalid-argument', XMAS_IMAGE_TOO_LARGE: 'invalid-argument', XMAS_IMAGE_INVALID: 'invalid-argument',
  XMAS_WORD_TOO_LONG: 'invalid-argument', XMAS_WORD_BANNED: 'invalid-argument', XMAS_REPORT_SELF: 'invalid-argument',
  XMAS_TREE_FORBIDDEN: 'read', XMAS_TREE_NOT_FOUND: 'read',
  XMAS_LETTER_CLOSED: 'closed',
  XMAS_LETTER_INVALID: 'write', XMAS_ORNAMENT_NOT_FOUND: 'write', XMAS_RECEIVED_NOT_FOUND: 'write', XMAS_LETTER_NOT_FOUND: 'write',
  XMAS_REPORT_DUPLICATE: 'dup',
  CONCURRENT_UPDATE: 'conflict',
  USER_CODE_NOT_BOUND: 'auth', AUTH_REQUIRED: 'auth', NO_TOKEN: 'auth', OWNER_CHANGED: 'auth',
  TOO_MANY_REQUESTS: 'aborted', DB_BUSY: 'aborted', STORAGE_UNAVAILABLE: 'aborted',
});
const NOT_BOUND = 'USER_CODE_NOT_BOUND';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const intOf = (v) => (Number.isInteger(v) ? v : null);
const strOf = (v) => (typeof v === 'string' ? v : '');
const imageIdOf = (v) => (typeof v === 'string' && IMAGE_ID_RE.test(v) ? v : null);
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });

/** 실패 하나 → { ok:false, code, msg, err }. code 는 ERROR_CODES · 그 밖은 기본값 */
function failOf(e, dflt){
  const name = (e && typeof e.code === 'string') ? e.code : '';
  const code = ERROR_CODES[name] || (e && e.kind === 'auth' ? 'auth' : dflt);
  return { ok: false, code, msg: (e && e.message) || '', err: e };
}

/** trees/current → { cur, matched } (모양이 틀리면 undefined) */
function currentOf(d){
  if (!isObj(d) || !Number.isInteger(d.cur) || d.cur < 1 || typeof d.matched !== 'boolean') return undefined;
  return { cur: d.cur, matched: d.matched };
}
/** 트리 장식 목록 → { 자리: { k, v, w?, id? } } — 화면 · 규칙이 쓰던 모양(종류 · 판 · 한마디 · 그림 id). 모양이 틀린 자리는 뺀다 */
function ornamentsOf(d){
  if (!isObj(d) || !isObj(d.ornaments)) return undefined;
  const out = {};
  for (const s of Object.keys(d.ornaments)){
    const e = d.ornaments[s];
    if (!/^(0|[1-9][0-9]{0,2})$/.test(s) || !isObj(e) || typeof e.kind !== 'string' || !Number.isInteger(e.version)) continue;
    const one = { k: e.kind, v: e.version };
    if (typeof e.word === 'string' && e.word) one.w = e.word;
    const id = imageIdOf(e.imageId);
    if (id) one.id = id;
    out[s] = one;
  }
  return out;
}
/** 내 장식(me/xmas mine) → { t, s, v, k, w, id } | null */
function mineOf(m){
  if (!isObj(m) || !Number.isInteger(m.tree) || !Number.isInteger(m.slot) || !Number.isInteger(m.version)) return null;
  return { t: m.tree, s: m.slot, v: m.version, k: strOf(m.kind), w: strOf(m.word), id: imageIdOf(m.imageId) };
}
/** me/xmas → { mine, letters, returned, received }(맵은 서버 그대로 — rules 가 다듬는다). 모양이 틀리면 undefined */
function meOf(d){
  if (!isObj(d) || !isObj(d.letters) || !isObj(d.returned) || !isObj(d.received)) return undefined;
  return { mine: mineOf(d.mine), letters: d.letters, returned: d.returned, received: d.received };
}
/** 그림 Storage 주소 — 버킷 · id 가 맞을 때만(아니면 '') */
function imageUrl(bucket, id){
  if (!imageIdOf(id) || !/^[a-z0-9][a-z0-9.-]*$/.test(String(bucket || ''))) return '';
  return STORAGE_HOST + '/v0/b/' + bucket + '/o/xmas%2F' + id + '.png?alt=media';
}
/** 바이트 → PNG data URL */
function pngDataUrl(bytes){
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return 'data:image/png;base64,' + btoa(bin);
}

/**
 * @param {{ authed:{ get:Function, put:Function, post:Function, del:Function }, rules:{ scheduleOf:Function },
 *           myCode:()=>string|null, storageBucket:()=>string, fetch:Function, warn:(...a:any[])=>void }} deps
 */
function createXmasApi(deps){
  const authed = deps.authed;
  const rules = deps.rules;
  const myCode = deps.myCode;
  const storageBucket = deps.storageBucket;
  const fetchFn = deps.fetch;
  const warn = deps.warn;

  let sched = null;   // 마지막으로 읽은 날짜 한 벌(rules.scheduleOf) — 아직 못 읽었으면 null
  /* 판 기억 — 읽은 토큰의 주인 · 내 장식의 판(null = 아직 안 걺) · 편지 칸마다 판. 아직 안 읽었으면 null */
  let known = null;
  /* 같은 때 겹친 «내 몫 읽기» 는 요청 하나를 같이 쓴다(창을 열면 트리 · 편지 단추가 한꺼번에 부른다). 오래 기억하지 않는다 — 끝나면 비운다.
     쓰기가 시작되면 gen 이 올라 그 전에 나간 읽기에는 붙지 않는다(쓰기 앞의 값을 새 값으로 쓰지 않게) */
  let meFlight = null, gen = 0;

  async function readCurrent(){
    const d = await authed.get(PATHS.current, { auth: true });
    const c = currentOf(d);
    if (!c) throw shapeError();
    const s = rules.scheduleOf(d);
    if (s) sched = s;
    return c;
  }
  /** 내 몫 한 벌 — 가입 전(USER_CODE_NOT_BOUND)은 null. 판 기억을 새로 한다 */
  function readMe(){
    if (meFlight && meFlight.gen === gen) return meFlight.p;
    const f = { gen, p: null };
    f.p = readMeOnce(f.gen);
    meFlight = f;
    const done = () => { if (meFlight === f) meFlight = null; };
    f.p.then(done, done);
    return f.p;
  }
  async function readMeOnce(g){
    let owner;
    let d;
    try { d = await authed.get(PATHS.me, { auth: true, onOwner: (who) => { owner = who; } }); }
    catch (e) { if (e && e.code === NOT_BOUND){ if (g === gen) known = null; return null; } throw e; }
    const me = meOf(d);
    if (!me) throw shapeError();
    const letters = {};
    for (const lid of Object.keys(me.letters)){ const v = isObj(me.letters[lid]) ? intOf(me.letters[lid].version) : null; if (v != null) letters[lid] = v; }
    if (g === gen || !known) known = { owner, mine: me.mine ? me.mine.v : null, letters };   // 읽는 동안 쓰기가 판을 남겼으면 그쪽이 더 새것이다
    return me;
  }
  /** 쓰기 전 — 판을 모르면 한 번 읽는다(창을 열면 이미 읽었다) */
  async function ensureKnown(){
    if (!known) await readMe();
    if (!known) throw Object.assign(new Error('가입 전'), { code: NOT_BOUND });
    return known;
  }
  /** 쓰기 실패 뒤 — 주인이 바뀌었거나 판이 어긋났으면 판 기억을 버린다(다음 쓰기 전에 다시 읽는다) */
  function forgetOn(e){
    if (e && (e.code === 'OWNER_CHANGED' || e.code === 'CONCURRENT_UPDATE')) known = null;
  }

  /** 지금 트리 · 내 자리 — { ok, cur, matched, mine:{ t, s, v, k, w, id }|null } · 가입 전이면 mine:null(트리는 그린다) */
  async function where(){
    try {
      const [c, me] = await Promise.all([readCurrent(), readMe()]);
      return { ok: true, cur: c.cur, matched: c.matched, mine: me ? me.mine : null };
    } catch (e) { return failOf(e, 'read'); }
  }

  /** 트리 하나의 장식 목록 — { ok, o:{ 자리: { k, v, w?, id? } } } */
  async function tree(t){
    if (!Number.isInteger(t) || t < 1) return { ok: false, code: 'arg', msg: '', err: null };
    try {
      const o = ornamentsOf(await authed.get(PATHS.tree(t), { auth: true }));
      if (!o) throw shapeError();
      return { ok: true, o };
    } catch (e) { return failOf(e, 'read'); }
  }

  /** 그림 한 장(Storage xmas/{id}.png) — { ok, d: PNG data URL } · 없거나 틀리면 { ok:false } */
  async function img(id){
    const url = imageUrl(storageBucket(), id);
    if (!url) return { ok: false, code: 'arg', msg: '', err: null };
    try {
      const res = await fetchFn(url, { credentials: 'omit' });
      if (!res || !res.ok) throw Object.assign(new Error('그림을 받지 못했어요 (' + (res ? res.status : 0) + ')'), { code: 'IMG_HTTP' });
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!bytes.length || bytes.length > IMAGE_BYTES_MAX) throw Object.assign(new Error('그림 크기가 이상해요'), { code: 'IMG_SIZE' });
      return { ok: true, d: pngDataUrl(bytes) };
    } catch (e) { warn('[크리스마스] 그림 받기 실패', (e && (e.code || e.message)) || e); return failOf(e, 'read'); }
  }

  /** 장식 걸기 · 바꾸기 — { kind, word?, img?, preview? } → { ok, tree, slot, version, moved, changed, imageId } */
  async function hang(data){
    const d = data || {};
    gen++;
    try {
      const k = await ensureKnown();
      const body = { kind: d.kind, word: d.word ? d.word : null, previewTree: Number.isInteger(d.preview) ? d.preview : null, version: k.mine };
      if (d.kind === 'img') body.image = d.img;
      const r = await authed.put(PATHS.ornament, body, { expectOwner: k.owner });
      if (!isObj(r) || !Number.isInteger(r.tree) || !Number.isInteger(r.slot) || !Number.isInteger(r.version)) throw shapeError();
      if (known === k) k.mine = r.version;
      return { ok: true, tree: r.tree, slot: r.slot, version: r.version, moved: !!r.moved, changed: !!r.changed, imageId: imageIdOf(r.imageId) };
    } catch (e) { forgetOn(e); return failOf(e, 'call'); }
  }

  /** 신고 한 번 — 대상은 서버가 판정(내가 볼 수 있는 트리 · 내가 받은 편지만) · 두 번째는 code 'dup' */
  async function report(target, note){
    const n = String(note == null ? '' : note).trim().slice(0, NOTE_MAX);
    try { await authed.post(PATHS.reports, n ? { target, note: n } : { target }); return { ok: true }; }
    catch (e) { return failOf(e, 'write'); }
  }
  const reportOrnament = (t, s, note) => report({ type: 'ornament', tree: t, slot: s }, note);
  const reportLetter = (n, note) => report({ type: 'received', n }, note);

  /* ── ✉️ 편지 ── */
  /** 내 편지함 · 반송된 편지 — { ok, letters, returned }(서버 맵 그대로 — rules.myLettersOf · returnedOf 가 다듬는다) */
  async function myLetters(){
    try {
      const me = await readMe();
      if (!me) return { ok: false, code: 'auth', msg: '', err: null };
      return { ok: true, letters: me.letters, returned: me.returned };
    } catch (e) { return failOf(e, 'read'); }
  }
  /** 편지 맡기기 · 고치기 — 칸 lid 에. 반송된 편지를 다시 쓰면 fromReturned(반송 기록의 칸)를 실어 서버가 같은 트랜잭션에서 반송 기록을 지운다 */
  async function saveLetter(lid, text, song, fromReturned){
    gen++;
    try {
      const k = await ensureKnown();
      const body = { text, song: song ? (song.title ? { id: song.id, title: song.title } : { id: song.id }) : null,
        version: lid in k.letters ? k.letters[lid] : null, fromReturned: fromReturned || null };
      const r = await authed.put(PATHS.letter(lid), body, { expectOwner: k.owner });
      if (!isObj(r) || !Number.isInteger(r.version)) throw shapeError();
      if (known === k) k.letters[lid] = r.version;
      return { ok: true, version: r.version };
    } catch (e) { forgetOn(e); return failOf(e, 'write'); }
  }
  /** 편지 거두기 — 마지막으로 읽은 판으로(없는 칸이면 서버가 204) */
  async function removeLetter(lid){
    gen++;
    try {
      const k = await ensureKnown();
      if (!(lid in k.letters)) return { ok: true };
      await authed.del(PATHS.letter(lid) + '?version=' + k.letters[lid], { expectOwner: k.owner });
      if (known === k) delete k.letters[lid];
      return { ok: true };
    } catch (e) { forgetOn(e); return failOf(e, 'write'); }
  }
  /** 반송 표시 치우기(지우기 단추) — 본인 것만 · 없으면 그대로 204 */
  async function clearReturned(lid){
    gen++;
    try { await authed.del(PATHS.returned(lid)); return { ok: true }; }
    catch (e) { return failOf(e, 'write'); }
  }
  /** 받은 편지 — { ok, got, matched }(got 은 서버 맵 그대로 · matched=false 면 짝 짓기 전 — 화면은 «배달하는 중») */
  async function got(){
    try {
      const [c, me] = await Promise.all([readCurrent(), readMe()]);
      if (!me) return { ok: false, code: 'auth', msg: '', err: null };
      return { ok: true, got: me.received, matched: c.matched };
    } catch (e) { return failOf(e, 'read'); }
  }

  return { me: () => myCode(), where, tree, img, hang, reportOrnament, reportLetter, myLetters, saveLetter, removeLetter, clearReturned, got,
    schedule: () => sched };
}

const api = Object.freeze({ createXmasApi, PATHS, ERROR_CODES, failOf, currentOf, ornamentsOf, mineOf, meOf, imageUrl });
if (typeof window !== 'undefined') window.TwXmasApi = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
