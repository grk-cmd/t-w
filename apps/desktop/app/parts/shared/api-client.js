/* api-client.js — 🌐 앱 공통 API 통로(우리 서버 /v1) (검사 sim-api-client.js)
   [왜] 기능마다 fetch · 시간 제한 · 봉투 풀기 · 실패 판정 · 토큰 · 기기 머리를 따로 만들지 않게 여기 한 곳에 둔다.
   [모양] get · post · put · patch · del → 성공 봉투 { success: true, data } 의 data(204 는 null). 실패는 늘 ApiError 하나로:
     kind 'unavailable' — 닿지 못함(네트워크 · 시간 초과 · 5xx · 길이 없는 404 · 봉투가 아닌 응답 · 쉬는 중).
     kind 'notReady'    — 서버는 살아 있지만 사본이 아직 없음(code 가 *_NOT_READY).
     kind 'auth'        — 401/403. kind 'request' — 그 밖의 4xx(그 자원이 없다는 404 포함 · 429 는 retryAfterMs).
     err.code 는 서버 봉투의 code(기계가 읽는 이름 — 문구 message 로 가르지 않는다) · err.items 는 실패에 걸린 줄(있을 때만 · 없으면 null).
     앱 오류 번호 · 할 일(로그인 화면 · 점검 창 · 다시 받기)로 바꾸는 표는 api-errors.js 한 곳.
     shouldFallback 은 옛 Firebase 길이 남은 동안만 쓴다(닿지 못함 · 사본 없음이면 옛 길로) — 그 길을 걷는 묶음이 같이 걷는다.
   [읽기] get(path, { cacheMs, auth, headers, timeoutMs }) — 같은 경로를 동시에 부르면 요청은 하나. cacheMs 는 로그인 없는 읽기만.
     응답에 ETag 가 있으면 값과 함께 기억했다가 다음 읽기에 If-None-Match — 304 면 기억한 값을 돌려준다(ETAG_MAX 개까지 · 오래된 것부터 버림).
     로그인 읽기는 «누구의 토큰인가»(토큰 sub)까지 열쇠에 넣는다 — 계정을 바꿔도 남의 기억 값을 돌려주지 않게.
   [쓰기] post · put · patch(path, body, opts) · del(path, opts) — 로그인이 기본(opts.auth === false 일 때만 토큰 없이).
     캐시 · 합치기 · 쉬기는 하지 않는다(쓰기는 매번 다르다). 다시 보내도 되는 쓰기는 본문 requestId 를 같은 값으로(request-id.js).
   [로그인] 토큰은 deps.getToken(force). 없으면 보내지 않고 'auth'(code NO_TOKEN). 401 AUTH_REQUIRED 면 새 토큰으로 한 번만 다시.
     로그인 요청에는 이 기기 id 머리 X-Device-Id(device-id.js — 프리미엄은 «이 기기» 판정)를 싣는다.
   [쉬기] 'unavailable' 이면 BACKOFF_MS 동안 묻지 않고 곧장 'unavailable'(code BACKOFF) — 읽기만. 로그인 통로(authed)는 쉬지 않는다.
   [주소] 운영 앱 = 운영 API · dev 앱(--tw-firebase=dev) = dev API. dev 앱만 tw.apiBaseUrl 로 다른 주소(CSP 묶음 안)를 쓸 수 있다.
     CSP connect-src https://*.together-working.com · *.togetherworking.duckdns.org 안이어야 한다(desk-companion-prototype.html). duckdns 는 옛 주소 — dev 시험 주소용으로만 남는다.
   Electron(file://)의 fetch 는 Origin 헤더 없이 나가고 CORS 를 보지 않는다 — 쿠키는 늘 보내지 않는다.
   앱 한 벌: TwApi.client(로그인 없는 읽기 · 쉬기 있음) · TwApi.authed(로그인 통로 — 토큰은 firebase-init 이 bindToken 으로 잇는다 · 쉬기 없음).
   계정을 놓을 때는 authed.forgetSession() — 진행 중인 로그인 읽기 · 계정별 ETag 기억을 뗀다(account/login-flow.js logout).
   classic script — maintenance-gate.js · device-id.js 다음 · remote-config.js · app.js 보다 먼저 싣는다(window.TwApi). Firebase 를 모른다. */
(function(){
'use strict';

const API_BASE_PROD = 'https://api.together-working.com';
const API_BASE_DEV = 'https://api-dev.together-working.com';
const API_BASE_DEV_KEY = 'tw.apiBaseUrl';
const API_BASE_RE = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:together-working\.com|togetherworking\.duckdns\.org)$/;
const TIMEOUT_MS = 2500;           // 읽기 한 번 — 옛 Firebase 길로 넘어가는 읽기가 오래 기다리지 않게
const WRITE_TIMEOUT_MS = 10000;    // 쓰기 한 번 — 서버가 트랜잭션 · 그림 사본까지 하고 답한다
const BACKOFF_MS = 30 * 1000;
const ETAG_MAX = 64;               // ETag 로 기억하는 읽기 수
const DEVICE_HEADER = 'X-Device-Id';
/* 서버에 그 길 자체가 없을 때의 404 code — 자원이 없다는 404(USER_NOT_FOUND 등)와 가른다 */
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
/* 옛 Firebase 길로 넘어가도 되는 실패인가 — 닿지 못함 · 사본 없음만. */
const shouldFallback = (e) => !!e && (e.kind === 'unavailable' || e.kind === 'notReady');

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

/** @param {{ baseUrl: string, fetch: Function | null, now?: () => number, timeoutMs?: number, writeTimeoutMs?: number, backoffMs?: number,
 *   getToken?: (force: boolean) => Promise<string | null>, deviceId?: () => string | null, onRequest?: () => void, etagMax?: number }} deps
 *   getToken 은 로그인 통로만 넘긴다(없으면 로그인 요청은 늘 NO_TOKEN) · onRequest 는 실제로 보내기 직전(서버 점검 창 maintenance-gate.js touch) */
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
  const cache = new Map();      // path → { data, until }
  const inflight = new Map();   // 'A '|'P ' + path → Promise
  const etags = new Map();      // 누구 + ' ' + path → { etag, data } (넣은 차례 = 오래된 차례)
  let downUntil = 0;

  /* 로그인 요청이면 토큰 · 기기 머리를 붙인다. who 는 ETag 열쇠의 «누구». */
  async function authOf(o, force){
    const h = Object.assign({}, o.headers || {});
    if(!o.auth) return { headers: h, who: '' };
    let tok = null;
    try{ tok = getToken ? await getToken(!!force) : null; }catch(_){ tok = null; }
    if(!tok) throw new ApiError('auth', 0, 'NO_TOKEN', '로그인 토큰이 없어요');
    h.Authorization = 'Bearer ' + tok;
    let dev = null; try{ dev = deviceId(); }catch(_){ dev = null; }
    if(typeof dev === 'string' && dev) h[DEVICE_HEADER] = dev;
    return { headers: h, who: tokenOwner(tok) };
  }
  function remember(key, etag, data){
    etags.delete(key);
    etags.set(key, { etag, data });
    if(etags.size > etagMax) etags.delete(etags.keys().next().value);
  }

  /* 한 번 보내기. o: { method, body, auth, headers, force } */
  async function once(path, ms, o){
    const method = o.method || 'GET';
    const ctl = (typeof AbortController === 'function') ? new AbortController() : null;
    let timer = null;
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => { try{ ctl && ctl.abort(); }catch(_){} rej(new ApiError('unavailable', 0, 'TIMEOUT', 'API 응답이 늦어요')); }, ms); });
    timeout.catch(() => {});   // 토큰에서 끝난 요청도 시간 제한 거부가 «잡히지 않은 오류» 로 남지 않게
    let res, body = null, memoKey = null, memo = null;
    try{
      const a = await Promise.race([authOf(o, o.force), timeout]);   // 토큰 새로 받기가 멈춰도 시간 제한 안에서 끝난다
      const headers = a.headers;
      if(method === 'GET'){
        memoKey = a.who + ' ' + path;
        memo = etags.get(memoKey) || null;
        if(memo) headers['If-None-Match'] = memo.etag;
      }
      const init = { method, headers, credentials: 'omit', signal: ctl ? ctl.signal : undefined };
      // 본문은 GET 이 아니면 JSON — 본문 없는 DELETE 만 안 싣는다(POST · PUT · PATCH 의 빈 본문은 null)
      if(method !== 'GET' && !(method === 'DELETE' && o.body === undefined)){
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(o.body === undefined ? null : o.body);
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
    if(status === 404 && NO_ROUTE_CODES.indexOf(code) >= 0) throw new ApiError('unavailable', status, code, msg || 'API 에 그 길이 없어요', extra);
    if(!(res && res.ok)) throw new ApiError('request', status, code, msg || ('API 요청 오류 (' + status + ')'), extra);
    if(status === 204) return null;
    // 앞단(Caddy) 오류 페이지처럼 봉투가 아닌 2xx 도 서버 문제로 본다
    if(!isObj(body) || body.success !== true) throw new ApiError('unavailable', status, code, msg || 'API 응답 모양이 달라요', extra);
    const data = (body.data === undefined) ? null : body.data;
    const etag = (method === 'GET') ? headerOf(res, 'ETag') : null;
    if(memoKey && typeof etag === 'string' && etag) remember(memoKey, etag, data);
    return data;
  }
  /* 401 AUTH_REQUIRED(토큰이 막 끝남)면 새 토큰으로 한 번만 다시. 가입 전(USER_CODE_NOT_BOUND)은 다시 해도 같아서 그대로. */
  function send(path, ms, o){
    return once(path, ms, o).catch((e) => {
      if(!(o.auth && e instanceof ApiError && e.status === 401 && e.code === 'AUTH_REQUIRED')) throw e;
      onRequest();
      return once(path, ms, Object.assign({}, o, { force: true }));
    });
  }

  /* opts: { cacheMs, timeoutMs, auth, headers } */
  function get(path, opts){
    const o = Object.assign({}, opts || {}, { method: 'GET' });
    if(!base || !fetchFn) return Promise.reject(new ApiError('unavailable', 0, 'NO_API', 'API 주소 없음'));
    const c = o.auth ? null : cache.get(path);
    if(c && c.until > now()) return Promise.resolve(c.data);
    if(downUntil > now()) return Promise.reject(new ApiError('unavailable', 0, 'BACKOFF', 'API 를 잠깐 쉬는 중'));
    const key = (o.auth ? 'A ' : 'P ') + path;
    if(inflight.has(key)) return inflight.get(key);
    onRequest();
    const p = send(path, o.timeoutMs || timeoutMs, o).then((data) => {
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

  /* 쓰기 한 벌 — 로그인이 기본. opts: { auth, headers, timeoutMs } */
  function write(method, path, body, opts){
    const o = Object.assign({}, opts || {}, { method, body });
    o.auth = o.auth !== false;
    if(!base || !fetchFn) return Promise.reject(new ApiError('unavailable', 0, 'NO_API', 'API 주소 없음'));
    onRequest();
    return send(path, o.timeoutMs || writeTimeoutMs, o);
  }

  return {
    get,
    post: (path, body, opts) => write('POST', path, body, opts),
    put: (path, body, opts) => write('PUT', path, body, opts),
    patch: (path, body, opts) => write('PATCH', path, body, opts),
    del: (path, opts) => write('DELETE', path, undefined, opts),
    baseUrl: () => base || null,
    resting: () => downUntil > now(),
    clearCache: () => { cache.clear(); etags.clear(); },
    /* 계정을 놓을 때(로그아웃 · 탈퇴 · 다른 계정) — 진행 중인 로그인 읽기에 다음 계정이 묻어가지 않게 떼고, 계정별 ETag 기억도 지운다.
       떼인 요청은 그대로 끝나지만(부른 쪽은 앞 계정 답을 받는다) 새 요청은 새로 보낸다. */
    forgetSession: () => { for(const k of Array.from(inflight.keys())) if(k.indexOf('A ') === 0) inflight.delete(k); etags.clear(); },
  };
}

/* 앱 한 벌 — preload 가 정한 환경으로. 검사 · 웹(companion 없음)은 운영 주소지만 CSP · 네트워크가 막으면 곧장 'unavailable'.
   authed 의 토큰은 firebase-init.js 가 bindToken 으로 잇는다(그 전 로그인 요청은 NO_TOKEN). */
let client = null, authed = null, tokenSource = null;
try{
  if(typeof window !== 'undefined'){
    let st = null; try{ st = window.localStorage; }catch(_){}
    const baseUrl = apiBaseFor(envOf(window), st);
    const fetchFn = (typeof window.fetch === 'function') ? window.fetch.bind(window) : null;
    const touch = () => { window.TwMaintenance.store.touch(); };
    client = createApiClient({ baseUrl, fetch: fetchFn, onRequest: touch });
    authed = createApiClient({ baseUrl, fetch: fetchFn, onRequest: touch, backoffMs: 0,   // 쉬기 끔 — 이 실패가 다시 묻기를 막지 않게
      getToken: (force) => (tokenSource ? tokenSource(force) : Promise.resolve(null)),
      deviceId: () => window.TwDeviceId.store.get() });
  }
}catch(_){ client = null; authed = null; }

/* 로그인 토큰 출처를 잇는다 — (force) → Promise<ID 토큰 | null>. 다시 부르면 바꾼다. */
function bindToken(fn){ tokenSource = fn; }

const api = { API_BASE_PROD, API_BASE_DEV, API_BASE_DEV_KEY, API_BASE_RE, TIMEOUT_MS, WRITE_TIMEOUT_MS, BACKOFF_MS, ETAG_MAX, DEVICE_HEADER, NO_ROUTE_CODES,
  ApiError, shouldFallback, apiBaseFor, envOf, tokenOwner, retryAfterMsOf, createApiClient, bindToken, client, authed };
if(typeof window !== 'undefined') window.TwApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
