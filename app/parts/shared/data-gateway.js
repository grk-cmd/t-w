/* data-gateway.js — 🚪 범용 데이터 통로 — Firebase 기본 동작(읽기 · 쓰기 · 듣기) 앞의 문 하나
   책임: 경로마다 «서버 범용 끝점 / Firebase(지금 길)» 를 고르고, 서버 쪽이면 같은 «동작 · 경로 · 값 · 조건» 을 서버로 보낸다.
     기능 함수(firebase-init.js 의 firebaseAPI.* 256개)는 이 문을 모른다 — 기본 동작(get · set · update · remove · push · onValue)만 이 문을 지난다.
     그래서 기능을 서버로 옮길 때는 서버에 그 경로 처리기를 넣고 원격 설정 dataRoutes 표에 경로 한 줄만 더하면 된다(앱 업데이트 없음).
   표(원격 설정 dataRoutes — Firebase config/dataRoutes · GET /v1/config): 경로 앞부분 목록. 칸 자리에 별표 하나를 쓰면 아무 칸.
     **표가 비면 모든 동작이 지금과 똑같이 Firebase SDK 로 간다**(같은 함수 · 같은 인자 · 같은 돌려주는 값).
   요청 모양(서버와 약속 — 매개변수는 전부 본문 JSON, 주소에는 안 붙인다 · 머리는 Authorization: Bearer <ID 토큰> 하나):
     POST /v1/data         { op: get|set|update|remove, path, value?, query? }
     POST /v1/data/stream  { path, query? } → { key }  ·  GET /v1/data/stream/{key} → SSE(event: value · error)
     query = { orderBy('$key' | '$value' | 자식 경로), limitToLast, limitToFirst, startAt, endAt, equalTo } — 이 밖의 조건(endBefore · 키 붙은 startAt 등)이면 Firebase.
     tx = { name, args } 는 서버에 이름 붙은 연산이 생길 때 쓴다 — 지금 앱의 트랜잭션은 늘 Firebase(바꾸는 함수를 보낼 수 없다).
   ★ 경로 속 코드는 «데이터 주소» 일 뿐 신원이 아니다 — 서버로 보낼 때 **내 코드인 칸만 `me` 로** 바꾼다(남의 코드는 그대로).
     신원은 서버가 Firebase ID 토큰에서만 정한다. 로그인 세션이 없으면(토큰 없음) 표에 걸려도 Firebase 길.
   서버 오류 → 앱 처리는 번역표 한 곳(FALLBACK_CODES · ERROR_NOTICES · translate): 준비 안 됨 · 연결 실패 · 모르는 경로(404) · 로그인 없음 → 그 호출은 Firebase(문구 없음) /
     권한 없음 · 잘못된 요청 · 동시 수정 · 모르는 code → 부른 쪽에 오류(E-DATA 번호로 알림 · err.twCode).
   서버로 보내지 않는 것(늘 Firebase): 트랜잭션 · onDisconnect · 자식 단위 듣기(onChild*) · 위에 없는 조건.
   받는 deps(createDataGateway): sdk{ get, set, update, remove, push, onValue } · routes() → 표 · myCode() → 내 코드 | null · canServer() → 로그인 세션 있나 ·
     queryOf(r) → undefined(조건 없는 ref) | null(서버로 못 보내는 조건) | { ref, query } · serverFirst · post(주소, 본문) → Promise<data> ·
     stream(본문, onData, onError) → 끊기 함수 · notifyError — 번호 · 오류를 받아 알림 · warn(...a)
   내놓는 것: DATA_PATH · STREAM_PATH · REQUEST_TIMEOUT_MS · ME · QUERY_KEYS · FALLBACK_CODES · ERROR_NOTICES · matchRoute · pathOf · toServerPath ·
     translate(err) · snapshotOf · parseSse · makeStream(통로) → stream · createDataGateway(deps) → { route, get, set, update, remove, push, onValue }
   검사: checks/sim-data-gateway.js */
(function(){
'use strict';
const SERVER = 'server', FIREBASE = 'firebase';
const DATA_PATH = '/v1/data';                   // 서버 범용 끝점(본문 { op, path, value?, query? })
const STREAM_PATH = '/v1/data/stream';          // 듣기 — POST 로 열쇠를 받고 GET STREAM_PATH/{열쇠} 로 SSE
const REQUEST_TIMEOUT_MS = 8000;                // 서버 한 번 기다리기 — 넘으면 Firebase 로
const ME = 'me';                                // 서버로 보내는 경로에서 «내 코드» 칸 자리
const ROUTE_MAX = 200;                          // 표 상한 — 원격 설정이 이보다 길면 앞의 것만
const ROUTE_RE = /^[A-Za-z0-9_\-*]+(\/[A-Za-z0-9_\-*]+)*$/;   // 경로 앞부분 모양 — '.' · '$' · '#' · '[' · ']' 는 Firebase 키에도 못 쓴다
const QUERY_KEYS = Object.freeze(['orderBy', 'limitToLast', 'limitToFirst', 'startAt', 'endAt', 'equalTo']);   // 서버로 보낼 수 있는 조건

/* ── 서버 오류 번역표 — 서버 ApiResponse.code(ErrorType 이름) · 앱 통로 code → 앱 처리. 여기 한 곳에서만 정한다. ── */
/* Firebase 길로(문구 없음): 서버가 아직 못 받는 · 닿지 못한 · 로그인 없음 · 묶이지 않은 계정 */
const FALLBACK_CODES = Object.freeze(['RTDB_UNAVAILABLE', 'AUTH_REQUIRED', 'USER_CODE_NOT_BOUND', 'NETWORK', 'TIMEOUT', 'NO_API', 'NO_TOKEN', 'BACKOFF']);
/* 부른 쪽에 오류로 — 번호는 error-codes.js 표(E-DATA). 모르는 code 는 안전하게 오류(UNKNOWN). */
const ERROR_NOTICES = Object.freeze({
  ACCESS_DENIED: (notifyError, e) => notifyError('E-DATA-01', e),
  INVALID_REQUEST: (notifyError, e) => notifyError('E-DATA-02', e),
  CONCURRENT_UPDATE: (notifyError, e) => notifyError('E-DATA-03', e),
  UNKNOWN: (notifyError, e) => notifyError('E-DATA-04', e),
});
/* 오류 하나 → FIREBASE | ERROR_NOTICES 의 이름. */
function translate(e){
  const code = String((e && e.code) || ''), status = (e && typeof e.status === 'number') ? e.status : 0;
  if(/_NOT_READY$/.test(code) || FALLBACK_CODES.includes(code)) return FIREBASE;
  if(status === 404) return FIREBASE;                                   // 서버에 그 경로 처리기가 아직 없다
  if(!code && (!status || status >= 500)) return FIREBASE;             // 봉투 없는 5xx · 끊김(앞단 오류 페이지 등) — 서버에 닿지 못한 것
  return Object.prototype.hasOwnProperty.call(ERROR_NOTICES, code) ? code : 'UNKNOWN';
}

/* 표 한 줄이 이 경로를 덮는가 — 앞부분 칸마다 같거나 별표. */
function covers(prefix, path){
  const a = prefix.split('/'), b = String(path || '').split('/').filter(Boolean);
  if(a.length > b.length) return false;
  for(let i = 0; i < a.length; i++){ if(a[i] !== '*' && a[i] !== b[i]) return false; }
  return true;
}
/* 경로 → 'server' | 'firebase'. 표가 비었거나 모양이 틀린 줄은 건너뛴다(안전한 쪽 = Firebase). */
function matchRoute(routes, path){
  if(!Array.isArray(routes) || !routes.length || typeof path !== 'string') return FIREBASE;
  for(const r of routes.slice(0, ROUTE_MAX)){
    if(typeof r === 'string' && ROUTE_RE.test(r) && covers(r, path)) return SERVER;
  }
  return FIREBASE;
}
/* Firebase ref → 경로('a/b/c'). ref.toString() 은 «DB 주소 + 경로» 라 주소 몫을 뗀다. 모르면 null. */
function pathOf(r){
  try{
    const s = String(r && r.toString());
    const m = /^https?:\/\/[^/]+\/?(.*)$/.exec(s);
    if(!m) return null;
    return decodeURIComponent(m[1]).replace(/\/+$/, '');
  }catch(_){ return null; }
}
/* 서버로 보낼 경로 — 칸이 내 코드와 **글자 그대로 같을 때만** `me` 로(앞부분만 같은 다른 코드 · 남의 코드는 그대로). 코드가 없으면 그대로. */
function toServerPath(path, myCode){
  if(typeof path !== 'string' || typeof myCode !== 'string' || !myCode) return path;
  return path.split('/').map((seg) => (seg === myCode ? ME : seg)).join('/');
}
/* 서버가 준 값 → DataSnapshot 닮은 것(부르는 쪽이 쓰는 val · exists · key · forEach · child · hasChild · size). */
function snapshotOf(key, value){
  const v = (value === undefined) ? null : value;
  const isObj = !!v && typeof v === 'object';
  const snap = {
    key,
    val: () => v,
    exists: () => v !== null,
    toJSON: () => v,
    child: (p) => {
      let cur = v; const segs = String(p).split('/').filter(Boolean);
      for(const s of segs) cur = (cur && typeof cur === 'object') ? cur[s] : undefined;
      return snapshotOf(segs[segs.length - 1] || key, cur);
    },
    hasChild: (p) => snap.child(p).exists(),
    get size(){ return isObj ? Object.keys(v).length : 0; },
    forEach: (cb) => {
      if(!isObj) return false;
      for(const k of Object.keys(v)){ if(cb(snapshotOf(k, v[k])) === true) return true; }
      return false;
    },
  };
  return snap;
}
/* SSE 글 조각 → [{ event, data }] 와 남은 글. data 는 JSON 이면 풀고 아니면 글 그대로. */
function parseSse(buf){
  const out = [];
  const parts = String(buf).split(/\r?\n\r?\n/);
  const rest = parts.pop();
  for(const block of parts){
    let event = 'message'; const data = [];
    for(const line of block.split(/\r?\n/)){
      if(line.startsWith('event:')) event = line.slice(6).trim();
      else if(line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if(!data.length) continue;
    const raw = data.join('\n');
    let parsed = raw; try{ parsed = JSON.parse(raw); }catch(_){}
    out.push({ event, data: parsed });
  }
  return { events: out, rest };
}
/* 듣기 두 단계 — POST 로 본문(path · query)을 보내 짧게 쓰는 열쇠를 받고, 주소에는 열쇠만 붙여 SSE 로 듣는다(경로 · 코드가 접속 기록에 안 남게).
   t: { post(주소, 본문) → Promise<data> · getToken() → Promise<토큰|null> · baseUrl() · fetch } → stream(본문, onData, onError) → 끊기 함수 */
function makeStream(t){
  return function stream(req, onData, onError){
    const ctl = new AbortController(); let stopped = false;
    (async () => {
      const d = await t.post(STREAM_PATH, req);
      const key = d && d.key, tok = await t.getToken(), base = t.baseUrl();
      if(!key || !tok || !base) throw Object.assign(new Error('듣기 준비 안 됨'), { code: !tok ? 'NO_TOKEN' : 'NO_API' });
      const res = await t.fetch(base + STREAM_PATH + '/' + encodeURIComponent(key), { credentials: 'omit', signal: ctl.signal,
        headers: { Authorization: 'Bearer ' + tok, Accept: 'text/event-stream' } });
      if(!res.ok || !res.body) throw Object.assign(new Error('듣기 실패 (' + res.status + ')'), { status: res.status });
      const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '';
      for(;;){
        const { done, value } = await rd.read();
        if(done) break;
        const p = parseSse(buf + dec.decode(value, { stream: true })); buf = p.rest;
        for(const ev of p.events){
          if(ev.event === 'value') onData(ev.data);
          else if(ev.event === 'error') throw Object.assign(new Error('서버 듣기 오류'), { code: (ev.data && ev.data.code) || '', status: (ev.data && ev.data.status) || 0 });
        }
      }
      throw Object.assign(new Error('서버 듣기 끝남'), { code: 'NETWORK' });
    })().catch((e) => { if(!stopped) onError(e); });
    return () => { stopped = true; try{ ctl.abort(); }catch(_){} };
  };
}
const lastSeg = (p) => { const s = String(p || '').split('/').filter(Boolean); return s.length ? s[s.length - 1] : null; };

function createDataGateway(deps){
  const sdk = deps.sdk;
  const routesOf = deps.routes;
  const myCode = deps.myCode;
  const canServer = deps.canServer;
  const queryOf = deps.queryOf;
  const serverFirst = deps.serverFirst;
  const post = deps.post;
  const stream = deps.stream;
  const notifyError = deps.notifyError;
  const warn = deps.warn || (() => {});
  const sp = (p) => { let c = null; try{ c = myCode(); }catch(_){ c = null; } return toServerPath(p, c); };

  /* 경로 → 'server' | 'firebase'. 표를 못 읽으면 · 로그인 세션이 없으면 Firebase(지금 길). */
  function route(path){
    let routes = null;
    try{ routes = routesOf(); }catch(_){ routes = null; }
    if(matchRoute(routes, path) !== SERVER) return FIREBASE;
    let ok = false; try{ ok = !!canServer(); }catch(_){ ok = false; }
    return ok ? SERVER : FIREBASE;
  }
  /* 이 ref(조건 붙은 것 포함)가 서버로 가면 { path, query? }, 아니면 null. */
  function target(r){
    const q = queryOf(r);
    if(q === null) return null;                              // 서버로 못 보내는 조건
    const p = pathOf(q ? q.ref : r);
    if(p === null || route(p) !== SERVER) return null;
    return q ? { path: p, query: q.query } : { path: p };
  }
  /* 서버 한 번 — 번역표대로 «Firebase 로 넘기기(던짐 → serverFirst 가 Firebase 로)» 또는 «부른 쪽에 오류(표시를 돌려줌 → finish 가 던짐)». */
  const ERR = Symbol('err');
  const viaServer = (op, path, fn) => () => fn().catch((e) => {
    const t = translate(e);
    if(t === FIREBASE){ warn('[통로] 서버 ' + op + ' 못 씀 — Firebase 로:', path, e && (e.code || e.status || e.message)); throw e; }
    try{ ERROR_NOTICES[t](notifyError, e); }catch(_){}
    if(e && typeof e === 'object') e.twCode = t;
    return { [ERR]: e };
  });
  const finish = (x) => { if(x.v && x.v[ERR]) throw x.v[ERR]; return x.v; };
  const body = (op, t, extra) => Object.assign({ op, path: sp(t.path) }, t.query ? { query: t.query } : {}, extra || {});

  function get(r, ...rest){
    const t = target(r);
    if(t === null) return sdk.get(r, ...rest);
    return serverFirst(SERVER, viaServer('get', t.path, () => post(DATA_PATH, body('get', t)).then((d) => snapshotOf(lastSeg(t.path), d && d.value))),
      () => sdk.get(r, ...rest)).then(finish);
  }
  function set(r, value, ...rest){
    const t = target(r);
    if(t === null || t.query) return sdk.set(r, value, ...rest);
    return serverFirst(SERVER, viaServer('set', t.path, () => post(DATA_PATH, body('set', t, { value })).then(() => undefined)),
      () => sdk.set(r, value, ...rest)).then(finish);
  }
  function remove(r, ...rest){
    const t = target(r);
    if(t === null || t.query) return sdk.remove(r, ...rest);
    return serverFirst(SERVER, viaServer('remove', t.path, () => post(DATA_PATH, body('remove', t)).then(() => undefined)),
      () => sdk.remove(r, ...rest)).then(finish);
  }
  /* 다중 경로 update — 칸마다 경로가 다르다. 모든 칸이 서버 쪽일 때만 서버로(섞이면 한 덩어리를 쪼개지 않고 Firebase). */
  function update(r, value, ...rest){
    if(queryOf(r) !== undefined) return sdk.update(r, value, ...rest);
    const base = pathOf(r);
    if(base === null || !value || typeof value !== 'object') return sdk.update(r, value, ...rest);
    const keys = Object.keys(value);
    const sides = keys.map((k) => route([base, k].filter(Boolean).join('/')));
    if(!keys.length || sides.some((s) => s !== SERVER)){
      if(sides.some((s) => s === SERVER)) warn('[통로] update 칸이 서버 · Firebase 로 섞임 — 한 덩어리라 Firebase 로:', base);
      return sdk.update(r, value, ...rest);
    }
    const sv = {}; keys.forEach((k) => { sv[sp(k)] = value[k]; });   // 칸 이름에도 경로가 들어 있다
    return serverFirst(SERVER, viaServer('update', base, () => post(DATA_PATH, { op: 'update', path: sp(base), value: sv }).then(() => undefined)),
      () => sdk.update(r, value, ...rest)).then(finish);
  }
  /* push — 키는 Firebase 가 이 기기에서 만든다(네트워크 없음). 값이 있으면 그 자리에 set 과 같은 길로. */
  function push(r, value, ...rest){
    const t = (value === undefined) ? null : target(r);
    if(t === null || t.query) return sdk.push(r, value, ...rest);
    const child = sdk.push(r);   // 값 없이 부르면 키만 만든다
    const done = set(child, value);
    return Object.assign(done, { key: child.key, ref: child });
  }
  /* 값 듣기 — 서버 쪽이면 SSE. 첫 값 전에 번역표가 «Firebase» 라 하는 끊김이면 Firebase 로 듣는다. 돌려주는 끊기 함수는 어느 쪽이든 끊는다. */
  function onValue(r, cb, ...rest){
    const t = target(r);
    if(t === null) return sdk.onValue(r, cb, ...rest);
    let off = null, closed = false, got = false;
    const toFirebase = (e) => {
      if(closed) return;
      warn('[통로] 서버 듣기 못 씀 — Firebase 로:', t.path, e && (e.code || e.status || e.message));
      try{ off && off(); }catch(_){}
      off = sdk.onValue(r, cb, ...rest);
    };
    const req = Object.assign({ path: sp(t.path) }, t.query ? { query: t.query } : {});
    try{
      off = stream(req, (d) => { got = true; if(!closed) cb(snapshotOf(lastSeg(t.path), d && d.value)); },
        (e) => {
          const tr = translate(e);
          if(!got && tr === FIREBASE) return toFirebase(e);
          if(tr !== FIREBASE){ try{ ERROR_NOTICES[tr](notifyError, e); }catch(_){} }
          warn('[통로] 서버 듣기 끊김:', t.path, e && (e.code || e.status || e.message));
        });
    }catch(e){ toFirebase(e); }
    return () => { closed = true; try{ off && off(); }catch(_){} };
  }
  return { route, get, set, update, remove, push, onValue };
}

const api = { SERVER, FIREBASE, ROUTE_MAX, ROUTE_RE, DATA_PATH, STREAM_PATH, REQUEST_TIMEOUT_MS, ME, QUERY_KEYS, FALLBACK_CODES, ERROR_NOTICES,
  matchRoute, pathOf, toServerPath, translate, snapshotOf, parseSse, makeStream, createDataGateway };
if(typeof window !== 'undefined') window.TwDataGateway = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
