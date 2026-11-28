/* api-client.js — 🌐 앱 공통 API 통로(우리 서버 /v2) (검사 sim-api-client.js)
   [왜] 기능마다 fetch · 시간 제한 · 봉투 풀기 · 실패 판정 · 토큰 · 기기 머리를 따로 만들지 않게 여기 한 곳에 둔다.
   [모양] get · post · put · patch · del → 성공 봉투 { success: true, data } 의 data(204 는 null). 실패는 늘 ApiError 하나로:
     kind 'unavailable' — 닿지 못함(네트워크 · 시간 초과 · 5xx · 봉투가 아닌 응답 · 쉬는 중).
     kind 'noRoute'     — 서버에 그 길 자체가 없는 404(code NOT_FOUND · DATA_ROUTE_NOT_FOUND · 빈 code). 서버가 죽은 것이 아니라 «앱이 없는 길을 부른 버그» 다 —
                          그 요청만 실패시키고 console.error 로 크게 남긴다. 쉬기(BACKOFF)에 넣지 않는다(같은 통로의 /v2/config 점검 판정까지 막지 않게).
     kind 'notReady'    — 서버는 살아 있지만 사본이 아직 없음(code 가 *_NOT_READY).
     kind 'auth'        — 401/403. kind 'request' — 그 밖의 4xx(그 자원이 없다는 404 포함 · 429 는 retryAfterMs).
     err.code 는 서버 봉투의 code(기계가 읽는 이름 — 문구 message 로 가르지 않는다) · err.items 는 실패에 걸린 줄(있을 때만 · 없으면 null).
     앱 오류 번호 · 할 일(로그인 화면 · 점검 창 · 다시 받기)로 바꾸는 표는 api-errors.js 한 곳.
     실패하면 다른 길로 넘어가지 않는다 — 부르는 쪽이 오류 번호(TwErrorCodes)로 드러낸다.
   [읽기] get(path, { cacheMs, auth, headers, timeoutMs, onOwner }) — 같은 경로를 동시에 부르면 요청은 하나. cacheMs 는 로그인 없는 읽기만.
     응답에 ETag 가 있으면 값과 함께 기억했다가 다음 읽기에 If-None-Match — 304 면 기억한 값을 돌려준다(ETAG_MAX 개까지 · 오래된 것부터 버림).
     persist.paths 의 경로는 그 기억을 IndexedDB(etag-store.js)에도 남겨 껐다 켜도 If-None-Match 를 싣는다 — 값은 304 일 때만 쓴다. 읽기는 PERSIST_LOAD_MS 까지만 기다린다.
     계정을 놓으면 지우고, 놓기 전에 나간 요청의 답은 적지 않는다(sessionGen).
     로그인 읽기는 «누구의 토큰인가»(토큰 sub)까지 열쇠에 넣는다 — 계정을 바꿔도 남의 기억 값을 돌려주지 않게. 토큰은 요청당 한 번만 받고(시간 제한과 겨룸) 그 토큰으로 보낸다.
     onOwner(who): 로그인 읽기에 쓴 토큰의 주인을 응답과 함께 알려 준다.
   [쓰기] post · put · patch(path, body, opts) · del(path, opts) — 로그인이 기본(opts.auth === false 일 때만 토큰 없이).
     opts.expectOwner: 보내기 직전 쓸 토큰의 주인과 견줘 다르면 보내지 않고 code OWNER_CHANGED 로 끝낸다(요청 0) — 읽은 계정의 값을 다른 계정 토큰으로 쓰지 않게.
     opts.rawType: 본문(Uint8Array 등)을 JSON 으로 바꾸지 않고 이 Content-Type 으로 바이트 그대로 보낸다(그림 올리기).
     캐시 · 합치기 · 쉬기는 하지 않는다(쓰기는 매번 다르다). 다시 보내도 되는 쓰기는 본문 requestId 를 같은 값으로(request-id.js).
   [기다리기] whenIdle() — 지금 나가 있는 요청(읽기 · 쓰기)이 다 끝나면 풀린다.
   [로그인] 토큰은 deps.getToken(force). 없으면 보내지 않고 'auth'(code NO_TOKEN). 401 AUTH_REQUIRED 면 새 토큰으로 한 번만 다시.
     로그인 요청에는 이 기기 id 머리 X-Device-Id(device-id.js — 프리미엄은 «이 기기» 판정)를 싣는다.
   [쉬기] 'unavailable' 이면 BACKOFF_MS 동안 묻지 않고 곧장 'unavailable'(code BACKOFF) — 읽기만. 로그인 통로(authed)는 쉬지 않는다.
   [멈춤 gate] gate:true 인 통로(authed)만 — 서버가 답을 못 하면(5xx · 시간 초과 · 네트워크 · notReady) 다음 요청을 바로 보내지 않고 GATE_MS 만큼 기다렸다 보낸다
     (연달아 실패하면 늘고 · 실제 기다림은 [base/2, base] 로 흩는다(jitter) · 성공하면 풀린다). 429 + Retry-After 면 그 요청(method + path)만 그때까지 보내지 않고
     곧장 429(retryAfterMs = 남은 시간)로 끝낸다 — 서버 요청 제한은 endpoint(method + path)마다라 다른 endpoint 는 막지 않는다. Retry-After 없는 429 는 위 멈춤. 다시 묻는 쪽(login-flow retryNow 등)이 따로 흩지 않아도 되게 여기 한 곳.
   [닿는가] health(shared/api-health.js)에 알린다 — 닿지 못한 실패(네트워크 · 시간 초과 · 5xx · 봉투가 아닌 응답)는 down() · 성공은 ok(). 4xx · notReady 는 알리지 않는다.
     닿지 않는 동안 확인 요청(PROBE_PATH — 이미 있는 가벼운 공개 읽기)을 health 가 간격을 두고 하나만 보낸다 · 복귀 알림은 TwApi.health.onRecover. 계정을 놓으면(forgetSession) health.reset().
   [주소] 운영 앱 = 운영 API · dev 앱(--tw-firebase=dev) = dev API. dev 앱만 tw.apiBaseUrl 로 다른 주소(CSP 묶음 안)를 쓸 수 있다.
     CSP connect-src https://*.together-working.com 안이어야 한다(desk-companion-prototype.html).
   Electron(file://)의 fetch 는 Origin 헤더 없이 나가고 CORS 를 보지 않는다 — 쿠키는 늘 보내지 않는다.
   앱 한 벌: TwApi.client(로그인 없는 읽기 · 쉬기 있음) · TwApi.authed(로그인 통로 — 토큰은 firebase-init 이 bindToken 으로 잇는다 · 쉬기 없음 · 멈춤 gate 있음).
   계정을 놓을 때는 authed.forgetSession() — 진행 중인 로그인 읽기 · 계정별 ETag 기억을 뗀다(account/login-flow.js logout).
   classic script — maintenance-gate.js · device-id.js · etag-store.js 다음 · remote-config.js · app.js 보다 먼저 싣는다(window.TwApi). Firebase 를 모른다. */
(function(){
'use strict';

const API_BASE_PROD = 'https://api.together-working.com';
const API_BASE_DEV = 'https://api-dev.together-working.com';
const API_BASE_DEV_KEY = 'tw.apiBaseUrl';
const API_BASE_RE = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.together-working\.com$/;
const TIMEOUT_MS = 2500;           // 읽기 한 번 — 본문이 큰 읽기는 부르는 쪽이 timeoutMs 를 넘긴다
const WRITE_TIMEOUT_MS = 10000;    // 쓰기 한 번 — 서버가 트랜잭션 · 그림 사본까지 하고 답한다
const BACKOFF_MS = 30 * 1000;
/* 로그인 통로가 서버에 닿지 못한 뒤 다음 요청까지 기다리는 시간 — n 번째 연속 실패는 GATE_MS[n-1](끝 값에서 멈춤) · 실제는 [base/2, base].
   API 가 느릴 때 앱 2,000 대가 «다시 시도» · realtime ready 마다 곧바로 다시 묻지 않게 */
const GATE_MS = Object.freeze([1000, 2000, 4000, 8000]);
const RETRY_AFTER_MAX_MS = 10 * 60 * 1000;   // Retry-After 상한 — 이상한 값 하나로 그 endpoint 가 앱을 끌 때까지 막히지 않게
const ETAG_MAX = 64;               // ETag 로 기억하는 읽기 수
const PERSIST_LOAD_MS = 250;       // 남긴 ETag 기억 읽기 상한 — IndexedDB 가 멈춰도 요청은 If-None-Match 없이 바로 나간다
const DEVICE_HEADER = 'X-Device-Id';
const PROBE_PATH = '/v2/config';   // 닿지 않는 동안 api-health 가 보내는 확인 요청 — 로그인 없이 읽는 가벼운 공개 설정(점검 창도 읽는 길 · 새 endpoint 를 만들지 않는다)
/* ETag 기억을 껐다 켜도 남기는 길 — 로그인 없는 읽기 · 로그인 읽기 */
const PERSIST_PUBLIC = Object.freeze(['/v2/config', '/v2/notices']);
const PERSIST_AUTHED = Object.freeze(['/v2/catalog', '/v2/me/avatars', '/v2/me/collection', '/v2/me/focus', '/v2/me/friends', '/v2/me/playlist']);
/* 서버에 그 길 자체가 없을 때의 404 code — 자원이 없다는 404(USER_NOT_FOUND 등)와 가른다.
   서버 정본: GlobalExceptionHandler.handleNotFound → ErrorType.NOT_FOUND(404 · code 'NOT_FOUND'). DATA_ROUTE_NOT_FOUND 는 옛 /v1 legacy 의 «맡지 않는 길». */
const NO_ROUTE_CODES = Object.freeze(['', 'NOT_FOUND', 'DATA_ROUTE_NOT_FOUND']);

class ApiError extends Error {
  constructor(kind, status, code, message, extra){
    super(message || kind);
    const x = extra || {};
    this.name = 'ApiError'; this.kind = kind; this.status = status || 0; this.code = code || '';
    this.items = Array.isArray(x.items) ? x.items : null;
    this.retryAfterMs = (typeof x.retryAfterMs === 'number') ? x.retryAfterMs : null;
  }
}

/* 이 환경의 API 주소. 운영 앱은 늘 운영 API. dev 앱은 tw.apiBaseUrl(묶음 안 · 운영 API 아님)이 있으면 그것, 없으면 dev API. */
function apiBaseFor(env, storage){
  if(env !== 'dev') return API_BASE_PROD;
  try{
    const v = String((storage && storage.getItem(API_BASE_DEV_KEY)) || '').trim().replace(/\/+$/, '');
    if(API_BASE_RE.test(v) && v !== API_BASE_PROD) return v;
  }catch(_){}
  return API_BASE_DEV;
}
/* 앱이 운영/dev 를 가르는 방식(firebase-config.js FIREBASE_ENV)과 같다 — preload 의 companion.firebaseEnv. */
const envOf = (w) => (w && w.companion && w.companion.firebaseEnv === 'dev') ? 'dev' : 'prod';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/* 토큰(JWT)의 sub — ETag 기억 열쇠에 «누구의 읽기인가» 를 넣으려고. 못 읽으면 토큰 끝 글자로 가른다. */
function tokenOwner(token){
  const tail = 't:' + String(token).slice(-16);
  try{
    const p = String(token).split('.')[1];
    const b = p.replace(/-/g, '+').replace(/_/g, '/');
    const s = b + '==='.slice((b.length + 3) % 4);
    const o = JSON.parse(atob(s));
    return (typeof o.sub === 'string' && o.sub) ? o.sub : tail;
  }catch(_){ return tail; }
}
/* Retry-After(초) → ms. 날짜 모양 · 이상한 값은 null. */
function retryAfterMsOf(v){
  const s = String(v == null ? '' : v).trim();
  const n = Number(s);
  return (s !== '' && isFinite(n) && n >= 0) ? Math.round(n * 1000) : null;
}
const headerOf = (res, name) => { try{ return res.headers.get(name); }catch(_){ return null; } };   // 머리가 없는 응답(가짜 · 앞단 오류)은 null

/* 연속 실패 n(1부터) → 기다림(ms) · r 은 0~1 난수 */
function gatePauseMs(n, r){
  const base = GATE_MS[Math.min(Math.max(n, 1), GATE_MS.length) - 1];
  return Math.round(base * (1 - 0.5 * r));
}
/* 서버가 답을 못 한 실패인가 — 멈춤 gate 를 건다. 304 인데 기억 값이 없는 것(NOT_MODIFIED)은 서버가 답한 것이라 뺀다 */
/* 닿지 못한 실패인가 — health 에 알린다(notReady 는 서버가 답한 것이라 뺀다) */
const isUnreachable = (e) => e instanceof ApiError && e.kind === 'unavailable' && e.code !== 'NOT_MODIFIED';
const isServerDown = (e) => e instanceof ApiError && (e.kind === 'notReady' || (e.kind === 'unavailable' && e.code !== 'NOT_MODIFIED'));

/** @param {{ baseUrl: string, fetch: Function | null, now?: () => number, timeoutMs?: number, writeTimeoutMs?: number, backoffMs?: number,
 *   getToken?: (force: boolean) => Promise<string | null>, deviceId?: () => string | null, onRequest?: () => void, etagMax?: number,
 *   gate?: boolean, random?: () => number, setTimeout?: Function, health?: { down: () => void, ok: () => void, reset: () => void },
 *   persist?: { store: { load: (k: string) => Promise<{ etag: string, data: any } | null>, save: Function, clear: Function }, paths: string[] } }} deps
 *   getToken 은 로그인 통로만 넘긴다(없으면 로그인 요청은 늘 NO_TOKEN) · onRequest 는 실제로 보내기 직전(서버 점검 창 maintenance-gate.js touch)
 *   gate 는 위 [멈춤 gate](로그인 통로만) · random · setTimeout 은 검사용(기본 전역) */
function createApiClient(deps){
  const d = deps || {};
  const base = String(d.baseUrl || '').replace(/\/+$/, '');
  const fetchFn = (typeof d.fetch === 'function') ? d.fetch : null;
  const now = d.now || (() => Date.now());
  const timeoutMs = d.timeoutMs || TIMEOUT_MS;
  const writeTimeoutMs = d.writeTimeoutMs || WRITE_TIMEOUT_MS;
  const backoffMs = (d.backoffMs == null) ? BACKOFF_MS : d.backoffMs;
  const getToken = d.getToken || null;
  const deviceId = d.deviceId || (() => null);
  const onRequest = d.onRequest || (() => {});
  const etagMax = d.etagMax || ETAG_MAX;
  const gate = d.gate === true;
  const random = d.random || Math.random;
  const tSet = d.setTimeout || ((f, ms) => setTimeout(f, ms));
  const health = d.health || null;   // shared/api-health.js — 앱 한 벌만 넘긴다(검사 · 다른 통로는 없음)
  const cache = new Map();      // path → { data, until }
  const inflight = new Map();   // 'A ' + 누구 + ' ' + path | 'P ' + path → Promise
  const etags = new Map();      // 누구 + ' ' + path → { etag, data } (넣은 차례 = 오래된 차례)
  const persist = d.persist || null;   // { store: etag-store.js, paths: [경로] } — 이 경로의 ETag 기억은 껐다 켜도 남긴다
  const persistable = (path) => !!persist && persist.paths.indexOf(String(path).split('?')[0]) >= 0;
  let sessionGen = 0;   // forgetSession 마다 하나 — 놓기 전에 나간 요청의 답을 다음 계정 기억(메모리 · 디스크)에 적지 않게
  /* 남긴 기억 읽기 — PERSIST_LOAD_MS 안에 못 읽거나 실패하면 null(그 요청은 If-None-Match 없이) */
  function loadPersisted(key){
    let p;
    try{ p = Promise.resolve(persist.store.load(key)).catch(() => null); }catch(_){ p = Promise.resolve(null); }
    return Promise.race([p, new Promise((r) => tSet(() => r(null), PERSIST_LOAD_MS))]);
  }
  let downUntil = 0;
  let gateUntil = 0, gateFails = 0;   // 멈춤 gate — 이 때까지 보내지 않고 기다린다 · 연속 실패 수
  const limited = new Map();          // method + ' ' + path → 429 Retry-After 가 끝나는 때
  let active = 0;                     // 지금 나가 있는 요청 수(읽기 · 쓰기) — whenIdle
  const idleWaiters = [];
  /* 요청 하나를 센다 — 끝나면(성공 · 실패) 빼고, 0 이 되면 기다리던 쪽을 푼다 */
  function counted(p){
    active++;
    const done = () => { active--; if(!active) idleWaiters.splice(0).forEach((f) => f()); };
    p.then(done, done);
    return p;
  }

  /* 로그인 요청이면 토큰 · 기기 머리를 붙인다. who 는 ETag 열쇠의 «누구». */
  async function authOf(o, force){
    const h = Object.assign({}, o.headers || {});
    if(!o.auth) return { headers: h, who: '' };
    let tok = null;
    if(!force && 'tok' in o) tok = o.tok;   // get 이 이미 받은 토큰 — 다시 받지 않는다(받기는 요청당 한 번)
    else{ try{ tok = getToken ? await getToken(!!force) : null; }catch(_){ tok = null; } }
    if(!tok) throw new ApiError('auth', 0, 'NO_TOKEN', '로그인 토큰이 없어요');
    /* 쓰기에 expectOwner 가 있으면 보내기 직전 쓸 토큰의 주인과 견준다 — 다르면(그 사이 로그인한 사람이 바뀜) 보내지 않고 끝낸다 */
    if(o.expectOwner && tokenOwner(tok) !== o.expectOwner) throw new ApiError('auth', 0, 'OWNER_CHANGED', '로그인한 사람이 바뀌어 보내지 않았어요');
    h.Authorization = 'Bearer ' + tok;
    let dev = null; try{ dev = deviceId(); }catch(_){ dev = null; }
    if(typeof dev === 'string' && dev) h[DEVICE_HEADER] = dev;
    return { headers: h, who: tokenOwner(tok) };
  }
  function remember(key, etag, data, path){
    etags.delete(key);
    etags.set(key, { etag, data });
    if(etags.size > etagMax) etags.delete(etags.keys().next().value);
    if(path && persistable(path)){ try{ persist.store.save(key, etag, data); }catch(_){} }   // 기다리지 않는다 — 못 남겨도 이번 실행은 메모리로
  }

  /* 한 번 보내기. o: { method, body, auth, headers, force } */
  async function once(path, ms, o){
    const method = o.method || 'GET';
    const ctl = (typeof AbortController === 'function') ? new AbortController() : null;
    let timer = null;
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => { try{ ctl && ctl.abort(); }catch(_){} rej(new ApiError('unavailable', 0, 'TIMEOUT', 'API 응답이 늦어요')); }, ms); });
    timeout.catch(() => {});   // 토큰에서 끝난 요청도 시간 제한 거부가 «잡히지 않은 오류» 로 남지 않게
    let res, body = null, memoKey = null, memo = null;
    const gen0 = sessionGen;
    try{
      const a = await Promise.race([authOf(o, o.force), timeout]);   // 토큰 새로 받기가 멈춰도 시간 제한 안에서 끝난다
      const headers = a.headers;
      if(method === 'GET'){
        memoKey = a.who + ' ' + path;
        memo = etags.get(memoKey) || null;
        if(!memo && persistable(path)){   // 켠 뒤 처음 — 지난 실행이 남긴 기억(304 가 올 때만 그 값을 쓴다)
          const m = await loadPersisted(memoKey);
          if(m && typeof m.etag === 'string' && m.etag && gen0 === sessionGen){ memo = m; remember(memoKey, m.etag, m.data); }
        }
        if(memo) headers['If-None-Match'] = memo.etag;
      }
      const init = { method, headers, credentials: 'omit', signal: ctl ? ctl.signal : undefined };
      // 본문은 GET 이 아니면 JSON — 본문 없는 DELETE 만 안 싣는다(POST · PUT · PATCH 의 빈 본문은 null)
      if(method !== 'GET' && !(method === 'DELETE' && o.body === undefined)){
        if(o.rawType){   // 파일 바이트 그대로 — 그림 올리기(Content-Type 은 부르는 쪽이 정한다)
          headers['Content-Type'] = o.rawType;
          init.body = o.body;
        }else{
          headers['Content-Type'] = 'application/json';
          init.body = JSON.stringify(o.body === undefined ? null : o.body);
        }
      }
      try{
        res = await Promise.race([fetchFn(base + path, init), timeout]);
      }catch(e){
        if(e instanceof ApiError) throw e;
        throw new ApiError('unavailable', 0, 'NETWORK', 'API 에 연결하지 못했어요');
      }
      const st = (res && res.status) || 0;
      if(st !== 304 && st !== 204){
        try{ body = await Promise.race([res.json(), timeout]); }catch(e){ if(e instanceof ApiError) throw e; body = null; }
      }
    }finally{ clearTimeout(timer); }
    const status = (res && res.status) || 0;
    if(status === 304){
      if(memo) return memo.data;
      throw new ApiError('unavailable', status, 'NOT_MODIFIED', '기억한 값 없이 304 를 받았어요');
    }
    const code = (isObj(body) && typeof body.code === 'string') ? body.code : '';
    const msg = (isObj(body) && typeof body.message === 'string') ? body.message : '';
    const extra = { items: isObj(body) ? body.items : null, retryAfterMs: status === 429 ? retryAfterMsOf(headerOf(res, 'Retry-After')) : null };
    if(/_NOT_READY$/.test(code)) throw new ApiError('notReady', status, code, msg, extra);
    if(status === 401 || status === 403) throw new ApiError('auth', status, code, msg, extra);
    if(status >= 500 || !status) throw new ApiError('unavailable', status, code, msg || ('API 오류 (' + status + ')'), extra);
    if(status === 404 && NO_ROUTE_CODES.indexOf(code) >= 0){
      /* 앱 버그 — 쉬기에 넣지 않고(kind 가 unavailable 이 아니다) 이 요청만 실패시키며 크게 남긴다 */
      try{ console.error('[api] 서버에 없는 길을 불렀다(앱 버그) —', method, path, status, code || '(code 없음)'); }catch(_){}
      throw new ApiError('noRoute', status, code || 'NOT_FOUND', msg || 'API 에 그 길이 없어요', extra);
    }
    if(!(res && res.ok)) throw new ApiError('request', status, code, msg || ('API 요청 오류 (' + status + ')'), extra);
    if(status === 204) return null;
    // 앞단(Caddy) 오류 페이지처럼 봉투가 아닌 2xx 도 서버 문제로 본다
    if(!isObj(body) || body.success !== true) throw new ApiError('unavailable', status, code, msg || 'API 응답 모양이 달라요', extra);
    const data = (body.data === undefined) ? null : body.data;
    const etag = (method === 'GET') ? headerOf(res, 'ETag') : null;
    if(memoKey && typeof etag === 'string' && etag && gen0 === sessionGen) remember(memoKey, etag, data, path);   // 그 사이 계정을 놓았으면 적지 않는다
    return data;
  }
  /* 401 AUTH_REQUIRED(토큰이 막 끝남)면 새 토큰으로 한 번만 다시. 가입 전(USER_CODE_NOT_BOUND)은 다시 해도 같아서 그대로. */
  function send(path, ms, o){
    const p = once(path, ms, o).catch((e) => {
      if(!(o.auth && e instanceof ApiError && e.status === 401 && e.code === 'AUTH_REQUIRED')) throw e;
      onRequest();
      return once(path, ms, Object.assign({}, o, { force: true }));
    });
    const q = health ? p.then((data) => { health.ok(); return data; }, (e) => { if(isUnreachable(e)) health.down(); throw e; }) : p;   // [닿는가] — 4xx 는 알리지 않는다
    return gate ? q.then((data) => { gateUntil = 0; gateFails = 0; return data; }, (e) => { gateAfter(e, o.method + ' ' + path); throw e; }) : q;
  }

  /* 멈춤 gate — 실패 하나를 보고 다음 요청을 늦춘다. 같은 멈춤 동안 실패한 다른 요청(동시에 나간 것)은 한 번으로 센다 */
  function gateAfter(e, key){
    if(e instanceof ApiError && e.status === 429 && e.retryAfterMs != null){
      limited.set(key, now() + Math.min(e.retryAfterMs, RETRY_AFTER_MAX_MS));
      return;
    }
    if(!(isServerDown(e) || (e instanceof ApiError && e.status === 429)) || gateUntil > now()) return;   // Retry-After 없는 429 도 멈춤
    gateFails++;
    gateUntil = now() + gatePauseMs(gateFails, random());
  }
  /* go() 를 멈춤이 끝난 뒤 부른다 — 멈춤이 없으면 그 자리에서. 기다리는 사이 멈춤이 늘었으면 다시 기다린다. 이 endpoint(method + path)가 429 로 막혀 있으면 보내지 않고 429 로 끝낸다 */
  function gated(key, go){
    if(!gate) return go();
    const until = limited.get(key);
    if(until != null){
      if(until > now()) return Promise.reject(new ApiError('request', 429, 'TOO_MANY_REQUESTS', '요청이 잦아 잠깐 쉬어요', { retryAfterMs: until - now() }));
      limited.delete(key);
    }
    const ms = gateUntil - now();
    if(ms <= 0) return go();
    return new Promise((r) => tSet(r, ms)).then(() => gated(key, go));
  }

  /* 로그인 읽기에 쓸 토큰을 한 번 받는다 — 시간 제한과 겨룬다(토큰 갱신이 멈춰도 요청이 끝나지 않는 일이 없게).
     «누구»(who)는 같은 요청 합치기 열쇠에 들어간다. 토큰이 없으면 tok null · who '' (보내는 쪽이 NO_TOKEN 으로 거절) */
  async function acquire(ms){
    let timer = null;
    const to = new Promise((_, rej) => { timer = setTimeout(() => rej(new ApiError('unavailable', 0, 'TIMEOUT', 'API 응답이 늦어요')), ms); });
    to.catch(() => {});
    try{
      let tok = null;
      try{ tok = getToken ? await Promise.race([getToken(false), to]) : null; }
      catch(e){ if(e instanceof ApiError) throw e; tok = null; }
      return { tok: tok || null, who: tok ? tokenOwner(tok) : '' };
    }finally{ clearTimeout(timer); }
  }

  /* opts: { cacheMs, timeoutMs, auth, headers } */
  function get(path, opts){
    const o = Object.assign({}, opts || {}, { method: 'GET' });
    if(!base || !fetchFn) return Promise.reject(new ApiError('unavailable', 0, 'NO_API', 'API 주소 없음'));
    const c = o.auth ? null : cache.get(path);
    if(c && c.until > now()) return Promise.resolve(c.data);
    if(downUntil > now()) return Promise.reject(new ApiError('unavailable', 0, 'BACKOFF', 'API 를 잠깐 쉬는 중'));
    return gated('GET ' + path, () => {
      /* ★ 로그인 읽기는 «누구» 가 열쇠에 든다(ETag 기억 열쇠와 같게) — 계정이 바뀌는 사이 앞 계정의 응답에 합쳐지지 않게 */
      if(o.auth){
        return acquire(o.timeoutMs || timeoutMs).then((a) => {
          const p = joined('A ' + a.who + ' ' + path, path, Object.assign({}, o, { tok: a.tok }));
          return o.onOwner ? p.then((data) => { o.onOwner(a.who); return data; }) : p;   // onOwner: 이 응답에 쓴 토큰의 주인
        });
      }
      return joined('P ' + path, path, o);
    });
  }
  function joined(key, path, o){
    if(inflight.has(key)) return inflight.get(key);
    onRequest();
    const p = counted(send(path, o.timeoutMs || timeoutMs, o)).then((data) => {
      downUntil = 0;
      if(o.cacheMs > 0 && !o.auth) cache.set(path, { data, until: now() + o.cacheMs });
      return data;
    }, (e) => {
      if(e && e.kind === 'unavailable' && backoffMs > 0) downUntil = now() + backoffMs;
      throw e;
    }).finally(() => { if(inflight.get(key) === p) inflight.delete(key); });   // 계정을 놓은 뒤 새로 건 같은 열쇠는 지우지 않는다
    inflight.set(key, p);
    return p;
  }

  /* 쓰기 한 벌 — 로그인이 기본. opts: { auth, headers, timeoutMs, expectOwner, rawType } */
  function write(method, path, body, opts){
    const o = Object.assign({}, opts || {}, { method, body });
    o.auth = o.auth !== false;
    if(!base || !fetchFn) return Promise.reject(new ApiError('unavailable', 0, 'NO_API', 'API 주소 없음'));
    return gated(method + ' ' + path, () => {
      onRequest();
      return counted(send(path, o.timeoutMs || writeTimeoutMs, o));
    });
  }

  return {
    get,
    post: (path, body, opts) => write('POST', path, body, opts),
    put: (path, body, opts) => write('PUT', path, body, opts),
    patch: (path, body, opts) => write('PATCH', path, body, opts),
    del: (path, opts) => write('DELETE', path, undefined, opts),
    baseUrl: () => base || null,
    resting: () => downUntil > now(),
    /* 지금 나가 있는 요청이 다 끝나면 풀리는 약속(없으면 바로) — 켤 때 «접속 중…» 을 언제 내릴지(app-boot) */
    whenIdle: () => (active ? new Promise((r) => idleWaiters.push(r)) : Promise.resolve()),
    /* 멈춤 gate 가 남은 시간(ms · 없으면 0) — 화면 · 진단용 */
    gateLeftMs: () => Math.max(0, gateUntil - now()),
    clearCache: () => { cache.clear(); etags.clear(); if(persist){ try{ persist.store.clear(); }catch(_){} } },
    /* 계정을 놓을 때(로그아웃 · 탈퇴 · 다른 계정) — 진행 중인 로그인 읽기에 다음 계정이 묻어가지 않게 떼고, 계정별 ETag 기억도 지운다.
       떼인 요청은 그대로 끝나지만(부른 쪽은 앞 계정 답을 받는다) 새 요청은 새로 보낸다. */
    forgetSession: () => {
      for(const k of Array.from(inflight.keys())) if(k.indexOf('A ') === 0) inflight.delete(k);
      etags.clear();
      sessionGen++;
      if(persist){ try{ persist.store.clear(); }catch(_){} }   // 남긴 기억도 — 다음 계정이 앞 계정 값을 304 로 받지 않게(열쇠에 누구가 들어 있어도 이 PC 에 남기지 않는다)
      if(health) health.reset();   // 닿지 않음 · 확인 타이머도 다음 계정에 남기지 않는다
      gateUntil = 0; gateFails = 0; limited.clear();   // 앞 계정의 멈춤 · 429 막힘(최대 RETRY_AFTER_MAX_MS)이 다음 계정에 남지 않게
    },
  };
}

/* 앱 한 벌 — preload 가 정한 환경으로. 검사 · 웹(companion 없음)은 운영 주소지만 CSP · 네트워크가 막으면 곧장 'unavailable'.
   authed 의 토큰은 firebase-init.js 가 bindToken 으로 잇는다(그 전 로그인 요청은 NO_TOKEN). */
let client = null, authed = null, health = null, tokenSource = null;
try{
  if(typeof window !== 'undefined'){
    let st = null; try{ st = window.localStorage; }catch(_){}
    const baseUrl = apiBaseFor(envOf(window), st);
    const fetchFn = (typeof window.fetch === 'function') ? window.fetch.bind(window) : null;
    const touch = () => { window.TwMaintenance.store.touch(); };
    /* 켤 때 읽는 길 중 ETag 를 주는 것 — 기억을 껐다 켜도 남긴다(etag-store.js). 경로를 더할 땐 서버가 그 길에 ETag 를 주는지 먼저 본다 */
    const store = window.TwEtagStore.createEtagStore();
    /* API 가 닿는가 한 벌(shared/api-health.js) — 두 통로가 같이 알리고, 확인 요청은 로그인 통로(쉬기 없음)로 하나만 */
    health = window.TwApiHealth.createApiHealth({
      probe: () => authed.get(PROBE_PATH),
      setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (h) => clearTimeout(h),
      note: (m) => { if(window.companion && window.companion.diagNote) window.companion.diagNote(m); },   // 🩺 [api] 줄 — 브라우저 미리보기 · 검사엔 companion 이 없다
    });
    client = createApiClient({ baseUrl, fetch: fetchFn, onRequest: touch, health, persist: { store, paths: PERSIST_PUBLIC } });
    authed = createApiClient({ baseUrl, fetch: fetchFn, onRequest: touch, backoffMs: 0, health, persist: { store, paths: PERSIST_AUTHED },   // 쉬기 끔 — 이 실패가 다시 묻기를 막지 않게
      gate: true,   // 대신 멈춤 gate — 다시 묻기는 막지 않고 늦춘다
      getToken: (force) => (tokenSource ? tokenSource(force) : Promise.resolve(null)),
      deviceId: () => window.TwDeviceId.store.get() });
  }
}catch(_){ client = null; authed = null; health = null; }

/* 로그인 토큰 출처를 잇는다 — (force) → Promise<ID 토큰 | null>. 다시 부르면 바꾼다. */
function bindToken(fn){ tokenSource = fn; }

const api = { API_BASE_PROD, API_BASE_DEV, API_BASE_DEV_KEY, API_BASE_RE, TIMEOUT_MS, WRITE_TIMEOUT_MS, BACKOFF_MS, GATE_MS, RETRY_AFTER_MAX_MS, ETAG_MAX, PERSIST_LOAD_MS, DEVICE_HEADER, NO_ROUTE_CODES, PERSIST_PUBLIC, PERSIST_AUTHED, PROBE_PATH,
  ApiError, gatePauseMs, apiBaseFor, envOf, tokenOwner, retryAfterMsOf, createApiClient, bindToken, client, authed, health };
if(typeof window !== 'undefined') window.TwApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
