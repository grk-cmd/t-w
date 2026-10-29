/* remote-config.js — ⚙️ 원격 설정: 관리자가 웹 관리자 ⚙️ 설정에서 바꾸는 운영 값 (검사 sim-remote-config.js)
   [왜] 운영 값(방 상한 · 정원 · 방 연결 시간 · 최소 버전 · 금칙어 · 초대 게이트 · 제보 · 박수 · 선물 하루 상한)을 앱 릴리스 없이 바꾸려고.
   [읽는 곳] 서버 GET /v1/config 하나(로그인 없이 · 몇백 바이트) — data 모양
     { room:{ limits:{workingroom, togetherroom}, maxPeople, timing:{joinWaitMs, clientGiveUpMs}, minVersion, bannedWords }, app:{ minVersion },
       user:{ inviteGate }, bug:{ dailyMax }, guestbook:{ clapDailyMax }, gift:{ dailySendMax } }.
     못 받으면 이 PC 저장값(CACHE_KEY · 마지막으로 받은 값) → 그것도 없으면 DEFAULTS. Firebase config 칸은 읽지 않는다(0.13 · 서버가 원본).
     ★ 최소 버전(minVersion)은 저장값을 쓰지 않는다 — 이번 실행에 받은 값으로만 막는다(못 받으면 막지 않는다).
     범위 밖 · 타입이 다른 값은 그 칸만 기본값. 범위는 서버 설정 키 표와 같다.
   [언제] 켤 때 한 번 + REFRESH_MS 마다 · 창이 다시 보일 때(STALE_MS 넘었으면) · realtime 알림 config(rt-hub.js — 서버가 바꿨다고 알림 · 오래 끊겼다 붙음).
     방 입장 · 제보 전에는 STALE_MS 넘었을 때만(refresh({ maxAgeMs })). 같은 값이면 API 통로가 ETag 304 로 받는다(api-client.js).
   API 는 앱 공통 통로(api-client.js · window.TwApi.client — 시간 제한 · 봉투 · 실패 한 모양 · 죽었을 때 쉬기)로 부른다.
   classic script — api-client.js 다음 · app.js 보다 먼저 싣고(window.TwRemoteConfig), firebase-init.js(module)가 store.start 로 API 통로 · 알림을 잇는다. */
(function(){
'use strict';

const CONFIG_PATH = '/v1/config';
const CACHE_KEY = 'tw.remoteConfig';
const CACHE_VERSION = 2;                 // 저장값 모양 — 0.13(서버 묶음 모양). 옛 판(평평한 칸)이 남긴 저장값은 읽지 않는다
const REFRESH_MS = 5 * 60 * 1000;
const STALE_MS = 60 * 1000;

const CHANNELS = ['workingroom', 'togetherroom'];
const ROOM_LIMIT_MIN = 1, ROOM_LIMIT_MAX = 10000;
const MAX_PEOPLE_MIN = 2, MAX_PEOPLE_MAX = 50;
const BUG_DAILY_MIN = 1, BUG_DAILY_MAX = 100;
const CLAP_DAILY_MIN = 1, CLAP_DAILY_MAX = 100;
const GIFT_DAILY_MIN = 1, GIFT_DAILY_MAX = 100;
const VER_MAX = 20;                                     // 버전 문자열 길이 상한(app-version-gate.js MIN_APP_VER_MAX 와 같다)
/* 방 연결 시간(서버 room.timing 의 앱 쪽 칸) — 이름 → [최소, 최대, 기본]. 서버 설정 키 표 · room-server-net.js TIMING_DEFAULTS 와 같다. */
const TIMING_RANGES = Object.freeze({
  joinWaitMs: Object.freeze([3000, 60000, 10000]),
  clientGiveUpMs: Object.freeze([15000, 600000, 90000]),
});
const KEYS = ['roomLimits', 'roomMaxPeople', 'inviteGate', 'roomServerTiming', 'minVersion', 'bugDailyMax', 'bannedWords', 'clapDailyMax', 'giftDailySendMax'];
const BANNED_WORDS_MAX = 500;     // 금칙어 줄 수 상한(서버 room.bannedWords 500 · 판정 banned-words.js BANNED_MAX 와 같은 값)
const BANNED_WORD_LEN_MAX = 20;   // 한 낱말 길이 상한(서버와 같은 값)
const DEFAULTS = Object.freeze({
  roomLimits: Object.freeze({ workingroom: 300, togetherroom: 300 }),
  roomMaxPeople: 10,
  inviteGate: true,
  roomServerTiming: Object.freeze({ joinWaitMs: TIMING_RANGES.joinWaitMs[2], clientGiveUpMs: TIMING_RANGES.clientGiveUpMs[2] }),
  minVersion: Object.freeze({ app: null, room: null }),
  bugDailyMax: 5,
  bannedWords: Object.freeze([]),  // 방 제목 금칙어 원문(웹 관리자) — 맞추기 · 판정은 shared/banned-words.js 한 곳
  clapDailyMax: 5,                 // 방명록 박수 하루 상한(한 홈마다) — 판정은 서버, 앱은 문구에만
  giftDailySendMax: 10,            // 선물 하루 보내기 상한 — 판정은 서버, 앱은 문구에만
});

const isInt = (v) => typeof v === 'number' && isFinite(v) && v % 1 === 0;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const intIn = (raw, min, max, def) => (isInt(raw) && raw >= min && raw <= max) ? raw : def;
function cleanRoomLimits(raw){
  const out = {};
  for(const ch of CHANNELS) out[ch] = intIn(isObj(raw) ? raw[ch] : undefined, ROOM_LIMIT_MIN, ROOM_LIMIT_MAX, DEFAULTS.roomLimits[ch]);
  return out;
}
const cleanMaxPeople = (raw) => intIn(raw, MAX_PEOPLE_MIN, MAX_PEOPLE_MAX, DEFAULTS.roomMaxPeople);
function cleanFlag(raw, def){ return (typeof raw === 'boolean') ? raw : def; }
const cleanBugDailyMax = (raw) => intIn(raw, BUG_DAILY_MIN, BUG_DAILY_MAX, DEFAULTS.bugDailyMax);
const cleanClapDailyMax = (raw) => intIn(raw, CLAP_DAILY_MIN, CLAP_DAILY_MAX, DEFAULTS.clapDailyMax);
const cleanGiftDailySendMax = (raw) => intIn(raw, GIFT_DAILY_MIN, GIFT_DAILY_MAX, DEFAULTS.giftDailySendMax);
const cleanVer = (v) => (typeof v === 'string' && v.trim() && v.length <= VER_MAX) ? v.trim() : null;
function cleanMinVersion(raw){
  return isObj(raw) ? { app: cleanVer(raw.app), room: cleanVer(raw.room) } : { app: null, room: null };
}
/* 방 연결 시간 — 앱 쪽 두 칸만(서버 쪽 칸 graceMs 등은 받지 않는다). 범위 밖 · 정수 아님은 그 칸만 기본값. */
function cleanTiming(raw){
  const out = {};
  for(const k of Object.keys(TIMING_RANGES)){
    const [min, max, def] = TIMING_RANGES[k];
    out[k] = intIn(isObj(raw) ? raw[k] : undefined, min, max, def);
  }
  return out;
}
/* 금칙어 원문 — 글자 칸만 · 길이 상한. 맞추기는 판정 쪽(banned-words.js)이 한다. */
function cleanBannedWords(raw){
  const list = Array.isArray(raw) ? raw : [];
  return list.filter((v) => typeof v === 'string' && v.length > 0 && v.length <= BANNED_WORD_LEN_MAX).slice(0, BANNED_WORDS_MAX);
}
const CLEAN = Object.freeze({
  roomLimits: cleanRoomLimits, roomMaxPeople: cleanMaxPeople, inviteGate: (raw) => cleanFlag(raw, DEFAULTS.inviteGate),
  roomServerTiming: cleanTiming, minVersion: cleanMinVersion, bugDailyMax: cleanBugDailyMax, bannedWords: cleanBannedWords,
  clapDailyMax: cleanClapDailyMax, giftDailySendMax: cleanGiftDailySendMax,
});
const clean = (key, raw) => CLEAN[key](raw);

/* GET /v1/config 의 data(서버 묶음 모양) → 칸별 원값. 앱 안의 칸 이름은 그대로 둔다(onChange 를 듣는 화면 · 부르는 쪽이 그대로). */
function fieldsOf(data){
  const d = isObj(data) ? data : {};
  const pick = (o, k) => (isObj(o) ? o[k] : undefined);
  const room = d.room;
  return {
    roomLimits: pick(room, 'limits'), roomMaxPeople: pick(room, 'maxPeople'), roomServerTiming: pick(room, 'timing'), bannedWords: pick(room, 'bannedWords'),
    minVersion: { app: pick(d.app, 'minVersion'), room: pick(room, 'minVersion') },
    inviteGate: pick(d.user, 'inviteGate'), bugDailyMax: pick(d.bug, 'dailyMax'),
    clapDailyMax: pick(d.guestbook, 'clapDailyMax'), giftDailySendMax: pick(d.gift, 'dailySendMax'),
  };
}
/* 서버 묶음 모양인가 — 칸 하나(room)라도 객체여야 받은 것으로 본다(봉투는 맞는데 엉뚱한 data 를 기본값으로 덮지 않게) */
const looksLikeConfig = (data) => isObj(data) && isObj(data.room);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function createRemoteConfig(){
  let cur = {};
  for(const k of KEYS) cur[k] = clean(k, undefined);
  let answered = false;         // 첫 답(값이든 실패든)을 받았는가 — ready() 가 본다
  let src = 'default';          // 지금 값의 출처 — 'api' | 'cache' | 'default'
  let opts = null;              // start 가 받은 것 { api, storage, now, win, rt }
  let lastTry = 0, inflight = null, timer = null;
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
  /* 응답 한 벌(서버 묶음 모양)을 칸마다 반영. fromCache 면 최소 버전은 건너뛴다(지난 값으로 막지 않게). */
  function apply(data, fromCache){
    const f = fieldsOf(data);
    for(const k of KEYS){ if(fromCache && k === 'minVersion') continue; set(k, f[k]); }
  }
  function answer(){ answered = true; settle(); }

  function loadCache(){
    try{
      const s = opts && opts.storage; if(!s) return false;
      const c = JSON.parse(s.getItem(CACHE_KEY) || 'null');
      if(!isObj(c) || c.v !== CACHE_VERSION || !looksLikeConfig(c.data)) return false;
      apply(c.data, true);
      src = 'cache';
      return true;
    }catch(_){ return false; }
  }
  function saveCache(data){
    try{ if(opts && opts.storage) opts.storage.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_VERSION, at: now(), data })); }catch(_){}
  }

  /* 다시 읽기. maxAgeMs 를 주면 마지막 시도가 그보다 최근이면 묻지 않는다(성공이든 실패든 — 멈췄을 때 입장마다 기다리지 않게). */
  function refresh(o){
    const maxAge = (o && o.maxAgeMs) || 0;
    if(!opts || !opts.api){ answer(); return Promise.resolve(cur); }
    if(inflight) return inflight;
    if(maxAge && lastTry && now() - lastTry < maxAge) return Promise.resolve(cur);
    lastTry = now();
    inflight = opts.api.get(CONFIG_PATH)
      .then((data) => {
        if(!looksLikeConfig(data)) throw new Error('설정 모양이 아님');
        src = 'api';
        apply(data, false); saveCache(data);
      })
      .catch((e) => { warn('API 를 못 읽음 — ' + (src === 'cache' ? '저장값' : src === 'default' ? '기본값' : '지난 값') + ' 그대로', (e && (e.code || e.message)) || e); })
      .then(() => { inflight = null; answer(); return cur; });
    return inflight;
  }

  /** deps: { api(TwApi.client — get(path)), storage, now, win, rt(TwRtHub.store — on('config', fn)) } — firebase-init.js 가 부른다. 두 번 부르면 두 번째는 다시 읽기만. */
  function start(deps){
    if(opts) return refresh({ maxAgeMs: STALE_MS });
    opts = Object.assign({}, deps || {});
    if(!opts.api) opts.api = null;
    loadCache();
    const p = refresh();
    timer = setInterval(() => { refresh(); }, REFRESH_MS);
    const w = opts.win;
    const again = () => { refresh({ maxAgeMs: STALE_MS }); };
    try{
      if(w && w.document) w.document.addEventListener('visibilitychange', () => { if(w.document.visibilityState === 'visible') again(); });
      if(w && w.addEventListener) w.addEventListener('focus', again);
    }catch(_){}
    if(opts.rt) opts.rt.on('config', () => { refresh(); });   // 서버가 바꿨다는 알림 · 오래 끊겼다 붙음 — 기다리지 않고 묻는다(304 면 그대로)
    return p;
  }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }

  function onChange(fn){
    listeners.push(fn);
    return () => { const i = listeners.indexOf(fn); if(i >= 0) listeners.splice(i, 1); };
  }
  /* 부팅 때 한 번 결정하는 흐름(초대 게이트 · 앱 최소 버전)이 첫 답을 기다린다. 시간이 넘으면 지금 값(저장값 · 기본값)으로.
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
    set, apply, start, stop, refresh, onChange, ready,
    answered: () => answered,
    source: () => src,
    roomLimitOf: (ch) => cur.roomLimits[ch] || cur.roomLimits.workingroom,
    maxPeople: () => cur.roomMaxPeople,
    inviteGate: () => cur.inviteGate,
    /* (얇은 자리) 기존 계정 가입 강제 스위치 — 0.13 설정에 칸이 없다. 옛 판 기본값(켜짐)만 돌려준다 — 계정 묶음이 가입 흐름을 서버로 옮기며 걷는다 */
    existingSignup: () => true,
    roomServerTiming: () => cur.roomServerTiming,
    minAppVer: () => cur.minVersion.app,
    minRoomVer: () => cur.minVersion.room,
    bugDailyMax: () => cur.bugDailyMax,
    bannedWords: () => cur.bannedWords,   // 방 제목 금칙어 원문 — 판정은 banned-words.js
    clapDailyMax: () => cur.clapDailyMax,
    giftDailySendMax: () => cur.giftDailySendMax,
  };
}

const api = { CONFIG_PATH, CACHE_KEY, CACHE_VERSION, REFRESH_MS, STALE_MS,
  KEYS, CHANNELS, DEFAULTS, TIMING_RANGES, ROOM_LIMIT_MIN, ROOM_LIMIT_MAX, MAX_PEOPLE_MIN, MAX_PEOPLE_MAX, BUG_DAILY_MIN, BUG_DAILY_MAX,
  CLAP_DAILY_MIN, CLAP_DAILY_MAX, GIFT_DAILY_MIN, GIFT_DAILY_MAX,
  cleanRoomLimits, cleanMaxPeople, cleanFlag, cleanBugDailyMax, cleanClapDailyMax, cleanGiftDailySendMax, cleanMinVersion, cleanTiming,
  cleanBannedWords, BANNED_WORDS_MAX, BANNED_WORD_LEN_MAX, fieldsOf, looksLikeConfig,
  createRemoteConfig, store: createRemoteConfig() };
if(typeof window !== 'undefined') window.TwRemoteConfig = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
