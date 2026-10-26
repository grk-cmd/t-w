/* gacha-server.js — 🎰 가챠 서버 길 — 서버가 뽑고 서버가 저장한다(GET /v1/me/gacha · POST /v1/me/gacha/draws · t-w-server character)
   책임: 내 보유분 · 남은 뽑기 · 시즌을 서버에서 받고, 뽑기를 서버에 부탁한다. 확률 · 풀 · 시즌 · 남은 횟수는 서버가 정한다.
     이 PC 에만 있는 뽑기는 올리지 않는다 — 서버 값만 원본. 받는 곳 고르기(서버 / 옛 길)는 gacha.js 가 source-switch 로.
   deps: get(path, opts) · post(path, body, opts) → Promise<data> — 로그인 API 통로(firebase-init.js apiGetAuthed · apiPostAuthed — 토큰은 거기서)
         newRequestId() → 문자열(같은 뽑기를 다시 보내도 서버가 두 번 굴리지 않게 하는 이름)
   내보냄: createGachaServer(deps) → { load() → Promise<상태> · draw(n) → Promise<{ ok:true, out, state } | { ok:false, reason }> }
     순수: stateOf(data) · resultsOf(list) · reasonOf(err) · clampCount(n) · GACHA_PATH · DRAWS_PATH · COUNT_MAX · DRAW_TIMEOUT_MS (TwGachaServer 위)
   ⚠️ 실패해도 옛 길(Firebase 트랜잭션)로 넘기지 않는다 — 넘기면 서버가 정하는 뜻이 없어진다. 실패는 그대로 알린다(E-CHAR-*).
   검사: checks/sim-gacha-server.js */
(function(){
'use strict';

const GACHA_PATH = '/v1/me/gacha';
const DRAWS_PATH = '/v1/me/gacha/draws';
const COUNT_MAX = 10;               // 한 번에 부탁할 수 있는 뽑기 수 — 서버 규격(1..10)과 같은 값
const LOAD_TIMEOUT_MS = 5000;
const DRAW_TIMEOUT_MS = 8000;       // 서버가 읽고 · 굴리고 · 원자적으로 쓰는 왕복 — 읽기보다 길게
const OWNED_MAX = 9999;             // 파츠 하나 보유 상한 — 규칙 users/$userId/gacha/owned/$partId 와 같은 값
const SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonNeg = (v) => (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.floor(v) : null;

/* 보유분 씻기 — 0 이하 · 숫자 아님 · 빈 키는 빼고 상한에서 자른다. */
function ownedOf(raw){
  const out = {};
  if(!isObj(raw)) return out;
  for(const k in raw){
    if(!k) continue;
    const n = nonNeg(raw[k]);
    if(n) out[k] = Math.min(OWNED_MAX, n);
  }
  return out;
}

/* 서버 data → { owned, ts, earned, left, season }. 모양이 틀리면 null(그 응답은 쓰지 않는다). */
function stateOf(d){
  if(!isObj(d) || !isObj(d.owned)) return null;
  const earned = nonNeg(d.earned), left = nonNeg(d.left);
  if(earned === null || left === null) return null;
  return {
    owned: ownedOf(d.owned),
    ts: nonNeg(d.ts) || 0,
    earned,
    left,
    season: SEASONS.indexOf(d.season) >= 0 ? d.season : null,
  };
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

/* 실패 → gacha.js 의 뽑기 실패 이유(_gachaNotifyFail 이 E-CHAR-09~12 로 그린다). */
/* 서버가 살아 있는데 지금 못 하는 것(겹친 저장 · 카탈로그 준비 중)은 «연결 확인» 이 아니라 «잠시 후 다시» 다. */
const SERVER_BUSY_CODES = Object.freeze(['GACHA_BUSY', 'CATALOG_NOT_READY']);

function reasonOf(e){
  if(!e) return 'error';
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

/** @param {{ get: (path: string, opts: object) => Promise<any>, post: (path: string, body: object, opts: object) => Promise<any>, newRequestId: () => string }} deps */
function createGachaServer(deps){
  const get = deps.get;
  const post = deps.post;
  const newRequestId = deps.newRequestId;

  /** 내 상태 — 상태 객체 · 실패면 던진다(부르는 쪽이 «못 읽음» 으로 본다). */
  async function load(){
    const st = stateOf(await get(GACHA_PATH, { auth: true, timeoutMs: LOAD_TIMEOUT_MS }));
    if(!st) throw Object.assign(new Error('가챠 응답 모양이 달라요'), { kind: 'request', code: 'BAD_SHAPE' });
    return st;
  }

  async function draw(n){
    let d;
    try{ d = await post(DRAWS_PATH, { count: clampCount(n), requestId: newRequestId() }, { auth: true, timeoutMs: DRAW_TIMEOUT_MS }); }
    catch(e){ return { ok: false, reason: reasonOf(e) }; }
    const state = stateOf(d), out = resultsOf(d && d.results);
    if(!state || !out) return { ok: false, reason: 'error' };
    return { ok: true, out, state };
  }

  return { load, draw };
}

const api = { createGachaServer, stateOf, resultsOf, reasonOf, clampCount, ownedOf, SERVER_BUSY_CODES,
  GACHA_PATH, DRAWS_PATH, COUNT_MAX, LOAD_TIMEOUT_MS, DRAW_TIMEOUT_MS, OWNED_MAX, SEASONS };
if(typeof window !== 'undefined') window.TwGachaServer = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
