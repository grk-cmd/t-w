/* api-client.js — 🌐 앱 공통 API 통로(t-w-server api/) (검사 sim-api-client.js)
   [왜] Firebase 요금은 내려받은 바이트라, 읽기 사본이 있는 것은 우리 API 에서 먼저 읽고 못 받으면 지금 Firebase 길로 간다.
     기능마다 fetch · 시간 제한 · 봉투 풀기 · 실패 판정을 따로 만들지 않게 여기 한 곳에 둔다. 첫 사용자는 원격 설정(remote-config.js).
   [모양] get(path) → 성공 봉투 { success: true, data } 의 data. 실패는 늘 ApiError 하나로:
     kind 'unavailable' — 닿지 못함(네트워크 · 시간 초과 · 5xx · 404 · 봉투가 아닌 응답 · 쉬는 중). Firebase 길로 넘어가면 된다.
     kind 'notReady'    — 서버는 살아 있지만 사본이 아직 없음(503 CONFIG_NOT_READY 처럼 code 가 *_NOT_READY). 역시 넘어가면 된다.
     kind 'auth' · 'request' — 401/403 · 그 밖의 4xx. 부르는 쪽 문제라 덮지 않는다(shouldFallback 이 false).
   [쉬기] 'unavailable' 이면 BACKOFF_MS 동안 묻지 않고 곧장 'unavailable'(code BACKOFF) — API 가 죽었을 때 부를 때마다 시간 제한만큼 기다리지 않게.
   [캐시] get(path, { cacheMs }) 로 성공 값을 메모리에 잠깐 둔다. 같은 경로를 동시에 부르면 요청은 하나.
   [로그인] get(path, { auth: true, headers }) — deps.getToken() 의 값을 Authorization: Bearer 로 붙인다(로그인이 필요한 경로 · 첫 사용자 friends-api.js).
     토큰이 없으면 보내지 않고 'auth'(code NO_TOKEN). 로그인 요청은 캐시하지 않는다. headers 는 그 요청에만 더한다.
   [주소] 운영 앱 = 운영 API · dev 앱(--tw-firebase=dev) = dev API. dev 앱만 tw.apiBaseUrl 로 다른 주소(CSP 묶음 안)를 쓸 수 있다.
     CSP connect-src https://*.together-working.com · *.togetherworking.duckdns.org 안이어야 한다(desk-companion-prototype.html). duckdns 는 옛 주소 — dev 시험 주소용으로만 남는다.
   Electron(file://)의 fetch 는 Origin 헤더 없이 나가고 CORS 를 보지 않는다 — 공개 GET 은 토큰 · 쿠키 없이 보낸다(쿠키는 늘 omit).
   classic script — remote-config.js · app.js 보다 먼저 싣는다(window.TwApi). Firebase 를 모른다. */
(function(){
'use strict';

const API_BASE_PROD = 'https://api.together-working.com';
const API_BASE_DEV = 'https://api-dev.together-working.com';
const API_BASE_DEV_KEY = 'tw.apiBaseUrl';
const API_BASE_RE = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:together-working\.com|togetherworking\.duckdns\.org)$/;
const TIMEOUT_MS = 2500;
const BACKOFF_MS = 30 * 1000;

class ApiError extends Error {
  constructor(kind, status, code, message){
    super(message || kind);
    this.name = 'ApiError'; this.kind = kind; this.status = status || 0; this.code = code || '';
  }
}
/* Firebase 길로 넘어가도 되는 실패인가 — 닿지 못함 · 사본 없음만. */
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

/* deps: { baseUrl, fetch, now, timeoutMs, backoffMs, getToken() → Promise<토큰 | null>(로그인 요청만 · 없으면 로그인 요청은 늘 NO_TOKEN) } */
function createApiClient(deps){
  const d = deps || {};
  const base = String(d.baseUrl || '').replace(/\/+$/, '');
  const fetchFn = (typeof d.fetch === 'function') ? d.fetch : null;
  const now = d.now || (() => Date.now());
  const timeoutMs = d.timeoutMs || TIMEOUT_MS;
  const backoffMs = (d.backoffMs == null) ? BACKOFF_MS : d.backoffMs;
  const getToken = d.getToken || null;   // 로그인 통로만 넘긴다 — 공개 통로는 없다
  const cache = new Map();      // path → { data, until }
  const inflight = new Map();   // path → Promise
  let downUntil = 0;

  async function authHeaders(o){
    const h = Object.assign({}, o.headers || {});
    if(!o.auth) return h;
    let tok = null;
    try{ tok = getToken ? await getToken() : null; }catch(_){ tok = null; }
    if(!tok) throw new ApiError('auth', 0, 'NO_TOKEN', '로그인 토큰이 없어요');
    h.Authorization = 'Bearer ' + tok;
    return h;
  }

  async function once(path, ms, o){
    const ctl = (typeof AbortController === 'function') ? new AbortController() : null;
    let timer = null;
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => { try{ ctl && ctl.abort(); }catch(_){} rej(new ApiError('unavailable', 0, 'TIMEOUT', 'API 응답이 늦어요')); }, ms); });
    timeout.catch(() => {});   // 토큰에서 끝난 요청도 시간 제한 거부가 «잡히지 않은 오류» 로 남지 않게
    let res, body = null;
    try{
      const headers = await Promise.race([authHeaders(o), timeout]);   // 토큰 새로 받기가 멈춰도 시간 제한 안에서 끝난다
      try{
        const init = { headers, credentials: 'omit', signal: ctl ? ctl.signal : undefined };
        if(o.method){ init.method = o.method; init.headers = Object.assign({ 'Content-Type': 'application/json' }, headers); init.body = JSON.stringify(o.body === undefined ? null : o.body); }
        res = await Promise.race([fetchFn(base + path, init), timeout]);
      }catch(e){
        if(e instanceof ApiError) throw e;
        throw new ApiError('unavailable', 0, 'NETWORK', 'API 에 연결하지 못했어요');
      }
      try{ body = await Promise.race([res.json(), timeout]); }catch(e){ if(e instanceof ApiError) throw e; body = null; }
    }finally{ clearTimeout(timer); }
    const status = (res && res.status) || 0;
    const code = (isObj(body) && typeof body.code === 'string') ? body.code : '';
    const msg = (isObj(body) && typeof body.message === 'string') ? body.message : '';
    if(/_NOT_READY$/.test(code)) throw new ApiError('notReady', status, code, msg);
    if(status === 401 || status === 403) throw new ApiError('auth', status, code, msg);
    if(status >= 500 || status === 404 || !status) throw new ApiError('unavailable', status, code, msg || ('API 오류 (' + status + ')'));
    if(!(res && res.ok)) throw new ApiError('request', status, code, msg || ('API 요청 오류 (' + status + ')'));
    // 앞단(Caddy) 오류 페이지처럼 봉투가 아닌 2xx 도 서버 문제로 본다
    if(!isObj(body) || body.success !== true) throw new ApiError('unavailable', status, code, msg || 'API 응답 모양이 달라요');
    return body.data;
  }

  /* opts: { cacheMs, timeoutMs, auth, headers } — once 는 opts.method · body 가 있으면 그대로 실어 보낸다(post) */
  function get(path, opts){
    const o = opts || {};
    if(!base || !fetchFn) return Promise.reject(new ApiError('unavailable', 0, 'NO_API', 'API 주소 없음'));
    const c = o.auth ? null : cache.get(path);
    if(c && c.until > now()) return Promise.resolve(c.data);
    if(downUntil > now()) return Promise.reject(new ApiError('unavailable', 0, 'BACKOFF', 'API 를 잠깐 쉬는 중'));
    if(inflight.has(path)) return inflight.get(path);
    const p = once(path, o.timeoutMs || timeoutMs, o).then((data) => {
      downUntil = 0;
      if(o.cacheMs > 0 && !o.auth) cache.set(path, { data, until: now() + o.cacheMs });
      return data;
    }, (e) => {
      if(e && e.kind === 'unavailable' && backoffMs > 0) downUntil = now() + backoffMs;
      throw e;
    }).finally(() => { inflight.delete(path); });
    inflight.set(path, p);
    return p;
  }

  /* 보내기(POST · JSON) — 범용 데이터 통로(data-gateway.js) 몫. 캐시 · 같은 요청 합치기 · 쉬기는 하지 않는다(쓰기는 매번 다르다).
     opts: { auth, headers, timeoutMs } — 실패 모양은 get 과 같다(ApiError). */
  function post(path, body, opts){
    const o = Object.assign({}, opts || {}, { method: 'POST', body });
    if(!base || !fetchFn) return Promise.reject(new ApiError('unavailable', 0, 'NO_API', 'API 주소 없음'));
    return once(path, o.timeoutMs || timeoutMs, o);
  }

  return {
    get,
    post,
    baseUrl: () => base || null,
    resting: () => downUntil > now(),
    clearCache: () => { cache.clear(); },
  };
}

/* 앱 한 벌 — preload 가 정한 환경으로. 검사 · 웹(companion 없음)은 운영 주소지만 CSP · 네트워크가 막으면 곧장 'unavailable'. */
let client = null;
try{
  if(typeof window !== 'undefined'){
    let st = null; try{ st = window.localStorage; }catch(_){}
    client = createApiClient({ baseUrl: apiBaseFor(envOf(window), st), fetch: (typeof window.fetch === 'function') ? window.fetch.bind(window) : null });
  }
}catch(_){ client = null; }

const api = { API_BASE_PROD, API_BASE_DEV, API_BASE_DEV_KEY, API_BASE_RE, TIMEOUT_MS, BACKOFF_MS,
  ApiError, shouldFallback, apiBaseFor, envOf, createApiClient, client };
if(typeof window !== 'undefined') window.TwApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
