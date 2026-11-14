/* gacha-api.js — 🎰 가챠 api provider (검사 sim-gacha-api.js)
   책임: 내 보유분 · 뽑기 수 · 시즌을 서버에서 받고(GET /v2/me/collection · GET /v2/me/gacha), 뽑기를 서버에 부탁한다(POST /v2/me/gacha/draws).
     확률 · 풀 · 시즌 · 남은 횟수 · 색 해금(다 모았나)은 서버가 정한다 — 앱은 받은 값을 그린다. 이 PC 에 보유분 사본을 두지 않는다.
   신원: 토큰이 정한 나뿐이다(남의 것을 보거나 대신 뽑는 길이 없다). 읽을 때 토큰의 주인을 기억해 두고, 뽑기는 그 주인과 묶어 보낸다
     (계정이 바뀌는 틈에 앞 계정 요청이 새 계정 토큰으로 나가지 않게 — OWNER_CHANGED).
   deps: authed — 로그인 API 통로(TwApi.authed — get(path, { auth, onOwner, timeoutMs }) · post(path, body, { expectOwner, timeoutMs }) → Promise<data>)
         newRequestId() → 문자열(뽑기마다 새 이름 — 그물망 재전송이 겹쳐도 서버가 두 번 굴리지 않게)
   내보냄: createGachaApi(deps) → { load() → Promise<상태> · draw(n) → Promise<{ ok:true, out, state } | { ok:false, reason }> · reset() }
     상태 = { owned:{partId:개수}, unlocked:{partId:true}, earned, bonus, left, season }
     순수: stateOf(items, gacha) · resultsOf(list) · reasonOf(err) · clampCount(n) · PATHS · COUNT_MAX (TwGachaApi 위)
   ⚠️ 실패해도 다른 길로 넘기지 않는다. 읽기가 실패하면 던진다(부르는 쪽이 «못 읽음» — 빈 보유분이 아니다).
   ⚠️ 뽑기는 시간 초과 뒤 서버에 들어갔을 수 있다 — 같은 요청을 다시 보내지 않고, 부르는 쪽이 사용자가 여는 때 다시 받는다.
   검사: checks/sim-gacha-api.js */
(function(){
'use strict';

const PATHS = Object.freeze({ collection: '/v2/me/collection', gacha: '/v2/me/gacha', draws: '/v2/me/gacha/draws' });
const COUNT_MAX = 10;               // 한 번에 부탁할 수 있는 뽑기 수 — 서버 규격(1..10)과 같은 값
const LOAD_TIMEOUT_MS = 5000;
const DRAW_TIMEOUT_MS = 8000;       // 서버가 읽고 · 굴리고 · 쓰는 왕복 — 읽기보다 길게
const SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
const OWNER_CHANGED_CODE = 'OWNER_CHANGED';
/* 서버가 살아 있는데 지금 못 하는 것(겹친 저장 · 카탈로그 준비 중)은 «연결 확인» 이 아니라 «잠시 후 다시» 다. */
const SERVER_BUSY_CODES = Object.freeze(['GACHA_BUSY', 'CATALOG_NOT_READY']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonNeg = (v) => (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.floor(v) : null;

/* 가진 것 목록 → { owned, unlocked }. 모양이 틀리면 null. 개수 0 인 줄은 «안 가짐» 이라 뺀다. */
function itemsOf(list){
  if(!Array.isArray(list)) return null;
  const owned = {}, unlocked = {};
  for(const r of list){
    if(!isObj(r) || typeof r.partId !== 'string' || !r.partId) continue;
    const n = nonNeg(r.count);
    if(!n) continue;
    owned[r.partId] = n;
    if(r.colorUnlocked === true) unlocked[r.partId] = true;
  }
  return { owned, unlocked };
}

/* 시즌 — 서버는 대문자(SPRING · SUMMER · AUTUMN · WINTER)로 준다. 앱 키(소문자)로 바꾸고 모르는 값은 null */
function seasonOf(v){ const k = typeof v === 'string' ? v.toLowerCase() : ''; return SEASONS.indexOf(k) >= 0 ? k : null; }

/* 서버 두 응답 → 상태. 모양이 틀리면 null(그 응답은 쓰지 않는다). */
function stateOf(items, gacha){
  const it = itemsOf(items);
  if(!it || !isObj(gacha)) return null;
  const earned = nonNeg(gacha.earned), left = nonNeg(gacha.left), bonus = nonNeg(gacha.bonus);
  if(earned === null || left === null || bonus === null) return null;
  return { owned: it.owned, unlocked: it.unlocked, earned, bonus, left, season: seasonOf(gacha.season) };
}

/* 뽑기 결과 줄 → [{ id, count, isNew, unlockedColor }]. 모양이 틀린 줄은 버린다. */
function resultsOf(list){
  if(!Array.isArray(list)) return null;
  const out = [];
  for(const r of list){
    if(!isObj(r) || typeof r.partId !== 'string' || !r.partId) continue;
    const count = nonNeg(r.count);
    if(!count) continue;
    out.push({ id: r.partId, count, isNew: r.isNew === true, unlockedColor: r.colorUnlocked === true });
  }
  return out;
}

/* 실패 → 뽑기 실패 이유(gacha.js _gachaNotifyFail 이 E-CHAR-09~12 로 그린다). */
function reasonOf(e){
  if(!e) return 'error';
  if(e.code === OWNER_CHANGED_CODE) return 'nouser';
  if(e.code === 'TIMEOUT') return 'timeout';
  if(SERVER_BUSY_CODES.indexOf(e.code) >= 0) return 'error';
  if(e.kind === 'unavailable' || e.kind === 'notReady') return 'offline';
  if(e.kind === 'auth') return 'nouser';
  return 'error';
}

function clampCount(n){
  const v = Math.floor(Number(n));
  return Math.max(1, Math.min(COUNT_MAX, isFinite(v) ? v : 1));
}

/** @param {{ authed: { get: Function, post: Function }, newRequestId: () => string }} deps */
function createGachaApi(deps){
  const authed = deps.authed;
  const newRequestId = deps.newRequestId;
  let owner = null;   // 마지막으로 읽은 토큰의 주인 — 뽑기를 이 주인과 묶는다

  /** 내 상태 — 상태 객체. 실패하면 던진다(못 읽음 ≠ 빈 보유분). */
  async function load(){
    const o = { auth: true, timeoutMs: LOAD_TIMEOUT_MS, onOwner: (who) => { owner = who; } };
    const [col, gacha] = await Promise.all([authed.get(PATHS.collection, o), authed.get(PATHS.gacha, o)]);
    const st = stateOf(col && col.items, gacha);
    if(!st) throw Object.assign(new Error('가챠 응답 모양이 달라요'), { kind: 'request', code: 'BAD_SHAPE' });
    return st;
  }

  /** 읽은 적 없으면(받기 전) 보내지 않는다 — 어느 계정의 보유분인지 모르는 채 뽑지 않게. */
  async function draw(n){
    if(!owner) return { ok: false, reason: 'nouser' };
    let d;
    try{ d = await authed.post(PATHS.draws, { count: clampCount(n), requestId: newRequestId() }, { auth: true, timeoutMs: DRAW_TIMEOUT_MS, expectOwner: owner }); }
    catch(e){ return { ok: false, reason: reasonOf(e) }; }
    const state = d && stateOf(d.items, d.gacha), out = d && resultsOf(d.results);
    if(!state || !out) return { ok: false, reason: 'error' };
    return { ok: true, out, state };
  }

  function reset(){ owner = null; }

  return { load, draw, reset };
}

const api = { createGachaApi, stateOf, itemsOf, resultsOf, reasonOf, clampCount, SERVER_BUSY_CODES, PATHS, COUNT_MAX, LOAD_TIMEOUT_MS, DRAW_TIMEOUT_MS, SEASONS };
if(typeof window !== 'undefined') window.TwGachaApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
