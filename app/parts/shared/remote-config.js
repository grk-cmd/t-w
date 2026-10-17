/* remote-config.js — ⚙️ 원격 설정: 관리자가 웹 관리자 ⚙️ 설정에서 바꾸는 운영 값 (검사 sim-remote-config.js)
   [왜] 운영 값(방 상한 · 정원 · 가입 스위치 · 친구 목록 서버 스위치 · 방 서버 · 방 서버 연결 시간 · 최소 버전 · 제보 상한)을 앱 릴리스 없이 바꾸려고.
     쓰기 원본은 Firebase config/*(웹 관리자가 씀)이고, 우리 API(t-w-server · PostgreSQL)는 그 읽기 전용 사본이다.
     Firebase 요금은 내려받은 바이트라 평소에는 사본(API)에서 읽는다.
   [읽는 차례] API GET /v1/config(로그인 없이 · 몇백 바이트 · data = { version, syncedAt, config }) → 못 받으면(사본 미준비 503 CONFIG_NOT_READY 포함)
     Firebase config/* 칸을 직접(FALLBACK_PATHS · 칸마다 get)
     → 그것도 못 읽으면 이 PC 저장값(CACHE_KEY · 마지막으로 받은 값) → 그것도 없으면 DEFAULTS. API 를 받으면 Firebase 는 읽지 않는다.
     켤 때 한 번 + REFRESH_MS 마다 · 창이 다시 보일 때(STALE_MS 넘었으면). 방 입장 · 방 서버 고르기 전에는 STALE_MS 넘었을 때만(refresh({ maxAgeMs })).
     ★ 최소 버전(minVersion)은 저장값을 쓰지 않는다 — 이번 실행에 API · Firebase 에서 받은 값으로만 막는다(둘 다 못 받으면 막지 않는다).
     범위 밖 · 타입이 다른 값은 그 칸만 기본값.
   [허용 목록 · 서버 주소] 허용 목록은 응답에 없다 — 한 사람씩 GET /v1/config/room-server/allow/{내 코드}(공개 · { userCode, server })
     → 못 받으면 Firebase config/roomServer/allow/{내 코드}.
     서버 주소는 API 를 받았으면 응답의 servers 에서, Firebase 로 읽은 판이면 config/roomServer/servers/{이름} 한 칸씩(serverAddr).
   API 는 앱 공통 통로(api-client.js · window.TwApi.client — 시간 제한 · 봉투 · 실패 한 모양 · 죽었을 때 쉬기)로 부른다.
   classic script — api-client.js 다음 · app.js 보다 먼저 싣고(window.TwRemoteConfig), firebase-init.js(module)가 store.start 로 API · Firebase 읽기를 잇는다. */
(function(){
'use strict';

const CONFIG_PATH = '/v1/config', ALLOW_PATH = '/v1/config/room-server/allow/';
const CACHE_KEY = 'tw.remoteConfig';
const REFRESH_MS = 5 * 60 * 1000;
const STALE_MS = 60 * 1000;
// Firebase 한 칸을 이만큼만 기다린다(API 는 api-client.js TIMEOUT_MS 2.5초) — 둘 다 멈춰도 6초 안에 끝나 앱 최소 버전 대기(firebase-init MIN_APP_VER_WAIT_MS)보다 짧다
const FETCH_TIMEOUT_MS = 3000;

const CHANNELS = ['workingroom', 'togetherroom'];
const ROOM_LIMIT_MIN = 1, ROOM_LIMIT_MAX = 10000;
const MAX_PEOPLE_MIN = 2, MAX_PEOPLE_MAX = 50;
const BUG_DAILY_MIN = 1, BUG_DAILY_MAX = 100;
const VER_MAX = 20;                                     // 버전 문자열 길이 상한(app-version-gate.js MIN_APP_VER_MAX 와 같다)
const SERVER_NAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;     // room-server-gate.js SERVER_NAME_RE 와 같다
/* 방 서버 연결 시간(config/roomServer/timing 의 앱 쪽 칸) — 이름 → [최소, 최대, 기본]. 규칙 .validate · API ConfigRules.TIMING ·
   room-server-net.js TIMING_DEFAULTS 와 같다. 같은 칸의 서버 쪽 값(graceMs 등)은 방 서버만 쓰므로 여기서 받지 않는다. */
const TIMING_RANGES = Object.freeze({
  joinWaitMs: Object.freeze([3000, 60000, 10000]),
  clientGiveUpMs: Object.freeze([15000, 600000, 90000]),
});
/* API 를 못 받았을 때 읽는 Firebase 칸 — 칸마다 따로(config 통째 · roomServer 통째 읽기는 규칙상 관리자만).
   허용 목록 · 서버 주소는 쓸 때 한 칸씩(allow/{내 코드} · servers/{이름}). */
const FALLBACK_PATHS = Object.freeze({
  roomLimits: 'config/roomLimits', roomMaxPeople: 'config/roomMaxPeople',
  inviteGate: 'config/flags/inviteGate', existingSignup: 'config/flags/existingSignup', friendsApi: 'config/flags/friendsApi', bugDailyMax: 'config/bugDailyMax',
  minAppVer: 'config/minAppVer', minRoomVer: 'config/minRoomVer',
  rsOn: 'config/roomServer/on', rsDefault: 'config/roomServer/default', rsPercent: 'config/roomServer/defaultPercent',
  rsJoinWait: 'config/roomServer/timing/joinWaitMs', rsGiveUp: 'config/roomServer/timing/clientGiveUpMs',
});
const FB_ALLOW = 'config/roomServer/allow/', FB_SERVERS = 'config/roomServer/servers/';
const KEYS = ['roomLimits', 'roomMaxPeople', 'inviteGate', 'existingSignup', 'friendsApi', 'roomServer', 'roomServerTiming', 'minVersion', 'bugDailyMax'];
const DEFAULTS = Object.freeze({
  roomLimits: Object.freeze({ workingroom: 300, togetherroom: 300 }),
  roomMaxPeople: 10,
  inviteGate: true,
  existingSignup: true,
  friendsApi: true,             // 친구 목록을 서버(GET /v1/me/friends)에서 먼저 받는다 — 끄면 옛 길(Firebase)만(friends-port.js)
  roomServer: Object.freeze({ on: false, default: null, defaultPercent: 0, servers: Object.freeze({}) }),
  roomServerTiming: Object.freeze({ joinWaitMs: TIMING_RANGES.joinWaitMs[2], clientGiveUpMs: TIMING_RANGES.clientGiveUpMs[2] }),
  minVersion: Object.freeze({ app: null, room: null }),
  bugDailyMax: 5,
});

const isInt = (v) => typeof v === 'number' && isFinite(v) && v % 1 === 0;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
function cleanRoomLimits(raw){
  const out = {};
  for(const ch of CHANNELS){
    const v = isObj(raw) ? raw[ch] : undefined;
    out[ch] = (isInt(v) && v >= ROOM_LIMIT_MIN && v <= ROOM_LIMIT_MAX) ? v : DEFAULTS.roomLimits[ch];
  }
  return out;
}
function cleanMaxPeople(raw){
  return (isInt(raw) && raw >= MAX_PEOPLE_MIN && raw <= MAX_PEOPLE_MAX) ? raw : DEFAULTS.roomMaxPeople;
}
function cleanFlag(raw, def){ return (typeof raw === 'boolean') ? raw : def; }
function cleanBugDailyMax(raw){
  return (isInt(raw) && raw >= BUG_DAILY_MIN && raw <= BUG_DAILY_MAX) ? raw : DEFAULTS.bugDailyMax;
}
const cleanVer = (v) => (typeof v === 'string' && v.trim() && v.length <= VER_MAX) ? v.trim() : null;
function cleanMinVersion(raw){
  return isObj(raw) ? { app: cleanVer(raw.app), room: cleanVer(raw.room) } : { app: null, room: null };
}
/* 방 서버 스위치 — 주소 자체가 붙어도 되는지는 room-server-gate.js serverUrlOk 가 한 번 더 거른다. */
function cleanRoomServer(raw){
  const r = isObj(raw) ? raw : {};
  const servers = {};
  if(isObj(r.servers)){
    for(const k of Object.keys(r.servers)){
      if(SERVER_NAME_RE.test(k) && typeof r.servers[k] === 'string') servers[k] = r.servers[k];
    }
  }
  const pct = r.defaultPercent;
  return {
    on: r.on === true,
    default: (typeof r.default === 'string' && SERVER_NAME_RE.test(r.default)) ? r.default : null,
    defaultPercent: (isInt(pct) && pct >= 0 && pct <= 100) ? pct : 0,
    servers,
  };
}
/* 방 서버 연결 시간 — 앱 쪽 두 칸만. 범위 밖 · 정수 아님은 그 칸만 기본값. */
function cleanTiming(raw){
  const out = {};
  for(const k of Object.keys(TIMING_RANGES)){
    const [min, max, def] = TIMING_RANGES[k];
    const v = isObj(raw) ? raw[k] : undefined;
    out[k] = (isInt(v) && v >= min && v <= max) ? v : def;
  }
  return out;
}
function clean(key, raw){
  if(key === 'roomLimits') return cleanRoomLimits(raw);
  if(key === 'roomMaxPeople') return cleanMaxPeople(raw);
  if(key === 'roomServer') return cleanRoomServer(raw);
  if(key === 'roomServerTiming') return cleanTiming(raw);
  if(key === 'minVersion') return cleanMinVersion(raw);
  if(key === 'bugDailyMax') return cleanBugDailyMax(raw);
  return cleanFlag(raw, DEFAULTS[key]);
}
/* GET /v1/config 의 data → 칸별 원값. flags 는 세 칸으로 편다. */
function fieldsOf(data){
  const d = isObj(data) ? data : {};
  const f = isObj(d.flags) ? d.flags : {};
  return { roomLimits: d.roomLimits, roomMaxPeople: d.roomMaxPeople, inviteGate: f.inviteGate, existingSignup: f.existingSignup, friendsApi: f.friendsApi,
    roomServer: d.roomServer, roomServerTiming: d.roomServerTiming, minVersion: d.minVersion, bugDailyMax: d.bugDailyMax };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function createRemoteConfig(){
  let cur = {};
  for(const k of KEYS) cur[k] = clean(k, undefined);
  let answered = false;         // 첫 답(값이든 실패든)을 받았는가 — ready() 가 본다
  let src = 'default';          // 지금 값의 출처 — 'api' | 'firebase' | 'cache' | 'default'
  let opts = null;              // start 가 받은 것 { api, storage, fallbackRead, now, win }
  let lastTry = 0, inflight = null, timer = null;
  const meCache = {};           // uid → { name, until }
  const addrCache = {};         // Firebase 판의 서버 이름 → { url, until }
  const listeners = [], waiters = [];
  const now = () => (opts && opts.now) ? opts.now() : Date.now();
  const warn = (...a) => { try{ console.warn('[원격 설정]', ...a); }catch(_){} };

  const settle = () => {
    for(const w of waiters.splice(0)){ clearTimeout(w.timer); w.resolve(cur); }
  };
  function set(key, raw){
    if(KEYS.indexOf(key) < 0) return false;
    const v = clean(key, raw);
    const changed = !same(cur[key], v);
    if(changed){
      cur = Object.assign({}, cur, { [key]: v });
      for(const fn of listeners.slice()){ try{ fn(cur, key); }catch(e){ console.warn('[원격 설정] 반영 실패', key, e); } }
    }
    return changed;
  }
  /* 응답 한 벌(API data 모양)을 칸마다 반영. fromCache 면 최소 버전은 건너뛴다(지난 값으로 막지 않게). */
  function apply(data, fromCache){
    const f = fieldsOf(data);
    for(const k of KEYS){ if(fromCache && k === 'minVersion') continue; set(k, f[k]); }
  }
  function answer(){ answered = true; settle(); }

  function loadCache(){
    try{
      const s = opts && opts.storage; if(!s) return false;
      const c = JSON.parse(s.getItem(CACHE_KEY) || 'null');
      if(!isObj(c) || !isObj(c.data)) return false;
      apply(c.data, true);
      src = 'cache';
      return true;
    }catch(_){ return false; }
  }
  function saveCache(data){
    try{ if(opts && opts.storage) opts.storage.setItem(CACHE_KEY, JSON.stringify({ at: now(), from: src, data })); }catch(_){}
  }
  /* Firebase 한 칸 — 시간 상한 · 실패는 undefined(«못 읽음»), 칸이 없으면 null. */
  function fbOne(path){
    const rd = opts && opts.fallbackRead;
    if(typeof rd !== 'function') return Promise.resolve(undefined);
    let t = null;
    return Promise.race([
      Promise.resolve().then(() => rd(path)).then((v) => (v === undefined ? null : v)),
      new Promise((res) => { t = setTimeout(() => res(undefined), FETCH_TIMEOUT_MS); }),
    ]).catch(() => undefined).then((v) => { clearTimeout(t); return v; });
  }
  /* API 를 못 받았을 때 — Firebase config 칸을 직접. 한 칸이라도 읽혔으면 반영하고 true. */
  async function readFirebase(){
    const P = FALLBACK_PATHS, names = Object.keys(P);
    const vals = await Promise.all(names.map((k) => fbOne(P[k])));
    const v = {}; names.forEach((k, i) => { v[k] = vals[i]; });
    if(names.every((k) => v[k] === undefined)) return false;
    const data = { roomLimits: v.roomLimits, roomMaxPeople: v.roomMaxPeople, bugDailyMax: v.bugDailyMax,
      flags: { inviteGate: v.inviteGate, existingSignup: v.existingSignup, friendsApi: v.friendsApi },
      minVersion: { app: v.minAppVer, room: v.minRoomVer },
      roomServer: { on: v.rsOn, default: v.rsDefault, defaultPercent: v.rsPercent, servers: {} },
      roomServerTiming: { joinWaitMs: v.rsJoinWait, clientGiveUpMs: v.rsGiveUp } };
    src = 'firebase';
    apply(data, false); saveCache(data);
    return true;
  }

  /* 다시 읽기. maxAgeMs 를 주면 마지막 시도가 그보다 최근이면 묻지 않는다(성공이든 실패든 — 멈췄을 때 입장마다 기다리지 않게). */
  function refresh(o){
    const maxAge = (o && o.maxAgeMs) || 0;
    if(!opts){ answer(); return Promise.resolve(cur); }
    if(inflight) return inflight;
    if(maxAge && lastTry && now() - lastTry < maxAge) return Promise.resolve(cur);
    lastTry = now();
    const viaApi = opts.api
      ? opts.api.get(CONFIG_PATH).then((data) => {
          const cfg = isObj(data) ? data.config : null;
          if(!isObj(cfg)) throw new Error('config 없음');
          src = 'api';
          apply(cfg, false); saveCache(cfg);
        })
      : Promise.reject(new Error('API 주소 없음'));
    inflight = viaApi
      .catch((e) => {
        if(opts.api) warn('API 를 못 읽음 — Firebase config 로', (e && (e.code || e.message)) || e);
        return readFirebase().then((ok) => { if(!ok) warn('Firebase config 도 못 읽음 — ' + (src === 'cache' ? '저장값' : src === 'default' ? '기본값' : '지난 값') + ' 그대로'); });
      })
      .catch(() => {})
      .then(() => { inflight = null; answer(); return cur; });
    return inflight;
  }

  /* deps: { api(TwApi.client — get(path)), storage, fallbackRead(path), now, win } — firebase-init.js 가 부른다. 두 번 부르면 두 번째는 다시 읽기만. */
  function start(deps){
    if(opts) return refresh({ maxAgeMs: STALE_MS });
    opts = Object.assign({}, deps || {});
    if(!opts.api || typeof opts.api.get !== 'function') opts.api = null;
    loadCache();
    const p = refresh();
    timer = setInterval(() => { refresh(); }, REFRESH_MS);
    const w = opts.win;
    const again = () => { refresh({ maxAgeMs: STALE_MS }); };
    try{
      if(w && w.document) w.document.addEventListener('visibilitychange', () => { if(w.document.visibilityState === 'visible') again(); });
      if(w && w.addEventListener) w.addEventListener('focus', again);
    }catch(_){}
    return p;
  }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }

  /* 내 «허용 목록 서버 이름» — GET /v1/config/room-server/allow/{내 코드}(공개) → 못 받으면 Firebase allow/{내 코드} 한 칸. 둘 다 없으면 null. */
  async function myServer(uid){
    if(!uid || !opts) return null;
    const c = meCache[uid];
    if(c && c.until > now()) return c.name;
    let name, got = false;
    if(opts.api){
      try{
        const d = await opts.api.get(ALLOW_PATH + encodeURIComponent(uid));
        name = isObj(d) ? d.server : null; got = true;
      }catch(_){ got = false; }
    }
    if(!got){ const v = await fbOne(FB_ALLOW + uid); name = (v === undefined) ? null : v; }
    name = (typeof name === 'string' && SERVER_NAME_RE.test(name)) ? name : null;
    meCache[uid] = { name, until: now() + STALE_MS };
    return name;
  }
  /* 서버 이름 → 주소(거르기 전 원값). API 를 받은 판이면 응답의 servers, Firebase · 저장값 판이면 Firebase servers/{이름} 한 칸(5분 기억). */
  async function serverAddr(name){
    if(typeof name !== 'string' || !SERVER_NAME_RE.test(name)) return null;
    const own = cur.roomServer.servers[name];
    if(src === 'api') return (typeof own === 'string') ? own : null;
    const c = addrCache[name];
    if(c && c.until > now()) return c.url;
    const v = await fbOne(FB_SERVERS + name);
    const url = (typeof v === 'string') ? v : (v === undefined && typeof own === 'string') ? own : null;
    if(v !== undefined) addrCache[name] = { url, until: now() + REFRESH_MS };
    return url;
  }

  function onChange(fn){
    listeners.push(fn);
    return () => { const i = listeners.indexOf(fn); if(i >= 0) listeners.splice(i, 1); };
  }
  /* 부팅 때 한 번 결정하는 흐름(초대 게이트 · 가입 강제 · 앱 최소 버전)이 첫 답을 기다린다. 시간이 넘으면 지금 값(저장값 · 기본값)으로.
     want(칸 이름)는 예전 모양 그대로 받는다 — 칸이 한 번에 같이 오므로 첫 답 하나만 본다. */
  function ready(want, ms){
    if(answered) return Promise.resolve(cur);
    return new Promise(resolve => {
      const w = { resolve, timer: null };
      w.timer = setTimeout(() => { const i = waiters.indexOf(w); if(i >= 0) waiters.splice(i, 1); resolve(cur); }, ms || 0);
      waiters.push(w);
    });
  }
  return {
    get: () => cur,
    set, apply, start, stop, refresh, myServer, serverAddr, onChange, ready,
    answered: () => answered,
    source: () => src,
    roomLimitOf: (ch) => cur.roomLimits[ch] || cur.roomLimits.workingroom,
    maxPeople: () => cur.roomMaxPeople,
    inviteGate: () => cur.inviteGate,
    existingSignup: () => cur.existingSignup,
    friendsApi: () => cur.friendsApi,
    roomServer: () => cur.roomServer,
    roomServerTiming: () => cur.roomServerTiming,
    minAppVer: () => cur.minVersion.app,
    minRoomVer: () => cur.minVersion.room,
    bugDailyMax: () => cur.bugDailyMax,
  };
}

const api = { FALLBACK_PATHS, FB_ALLOW, FB_SERVERS, CONFIG_PATH, ALLOW_PATH, CACHE_KEY, REFRESH_MS, STALE_MS, FETCH_TIMEOUT_MS,
  KEYS, CHANNELS, DEFAULTS, TIMING_RANGES, ROOM_LIMIT_MIN, ROOM_LIMIT_MAX, MAX_PEOPLE_MIN, MAX_PEOPLE_MAX, BUG_DAILY_MIN, BUG_DAILY_MAX,
  cleanRoomLimits, cleanMaxPeople, cleanFlag, cleanBugDailyMax, cleanMinVersion, cleanRoomServer, cleanTiming, fieldsOf,
  createRemoteConfig, store: createRemoteConfig() };
if(typeof window !== 'undefined') window.TwRemoteConfig = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
