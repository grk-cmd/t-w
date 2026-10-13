/* remote-config.js — ⚙️ 원격 설정: 관리자가 웹 관리자 ⚙️ 설정에서 바꾸는 작은 칸들 (검사 sim-remote-config.js)
   [왜] 채널당 방 개수 상한이 앱 코드에 박혀 있어 운영 사고 때 바로 바꿀 수 없었다. 앱 릴리스 없이 바꿀 값을 DB 로 옮긴다.
   ・config/roomLimits = { workingroom, togetherroom } (1~10000) — 채널별 «전체» 방 상한(Firebase 방 + 방 서버 방). 없으면 300.
   ・config/roomMaxPeople (2~50) — 방 정원(시크릿룸 손님은 정원 − 1). 없으면 10.
   ・config/flags/inviteGate · config/flags/existingSignup (불리언) — 초대 코드 게이트 · 기존 사용자 가입 강제. 없으면 true.
   ・규칙: 누구나 읽기 · 관리자만 쓰기 · 범위 · 타입 · 모르는 칸 거절(firebase-database-rules.json config/*).
   [읽는 법] 칸마다 따로 구독한다(config 를 통째로 읽지 않는다 — 몇 바이트짜리 칸 넷). 바뀌면 바로 반영.
     못 읽으면(오프라인 · 규칙 배포 전 거부) 기본값 그대로 — 기본값은 이 칸이 생기기 전 동작과 같다(방 상한만 300).
     범위 밖 · 타입이 다른 값은 무시하고 기본값.
   classic script — app.js 보다 먼저 싣고(window.TwRemoteConfig), firebase-init.js(module)가 store.watch 로 DB 를 잇는다. */
(function(){
'use strict';

const PATHS = Object.freeze({
  roomLimits: 'config/roomLimits',
  roomMaxPeople: 'config/roomMaxPeople',
  inviteGate: 'config/flags/inviteGate',
  existingSignup: 'config/flags/existingSignup',
});
const CHANNELS = ['workingroom', 'togetherroom'];
const ROOM_LIMIT_MIN = 1, ROOM_LIMIT_MAX = 10000;
const MAX_PEOPLE_MIN = 2, MAX_PEOPLE_MAX = 50;
const DEFAULTS = Object.freeze({
  roomLimits: Object.freeze({ workingroom: 300, togetherroom: 300 }),
  roomMaxPeople: 10,
  inviteGate: true,
  existingSignup: true,
});

const isInt = (v) => typeof v === 'number' && isFinite(v) && v % 1 === 0;
function cleanRoomLimits(raw){
  const out = {};
  for(const ch of CHANNELS){
    const v = (raw && typeof raw === 'object') ? raw[ch] : undefined;
    out[ch] = (isInt(v) && v >= ROOM_LIMIT_MIN && v <= ROOM_LIMIT_MAX) ? v : DEFAULTS.roomLimits[ch];
  }
  return out;
}
function cleanMaxPeople(raw){
  return (isInt(raw) && raw >= MAX_PEOPLE_MIN && raw <= MAX_PEOPLE_MAX) ? raw : DEFAULTS.roomMaxPeople;
}
function cleanFlag(raw, def){ return (typeof raw === 'boolean') ? raw : def; }
function clean(key, raw){
  if(key === 'roomLimits') return cleanRoomLimits(raw);
  if(key === 'roomMaxPeople') return cleanMaxPeople(raw);
  return cleanFlag(raw, DEFAULTS[key]);
}
const same = (a, b) => (a && typeof a === 'object') ? CHANNELS.every(ch => a[ch] === b[ch]) : a === b;

function createRemoteConfig(){
  let cur = { roomLimits: cleanRoomLimits(null), roomMaxPeople: DEFAULTS.roomMaxPeople,
    inviteGate: DEFAULTS.inviteGate, existingSignup: DEFAULTS.existingSignup };
  const answered = {};          // 칸마다 첫 답(값이든 실패든)을 받았는가 — ready() 가 본다
  const listeners = [], waiters = [];
  const keys = Object.keys(PATHS);
  const settle = () => {
    for(let i = waiters.length - 1; i >= 0; i--){
      const w = waiters[i];
      if(w.keys.every(k => answered[k])){ waiters.splice(i, 1); clearTimeout(w.timer); w.resolve(cur); }
    }
  };
  function set(key, raw){
    if(!(key in PATHS)) return false;
    answered[key] = true;
    const v = clean(key, raw);
    const changed = !same(cur[key], v);
    if(changed){
      cur = Object.assign({}, cur, { [key]: v });
      for(const fn of listeners.slice()){ try{ fn(cur, key); }catch(e){ console.warn('[원격 설정] 반영 실패', key, e); } }
    }
    settle();
    return changed;
  }
  /* 못 읽음(거부 · 끊김) — 값은 그대로 두고 «답은 받았다» 만 적는다(기다리는 쪽이 시간 초과까지 서지 않게). */
  function fail(key){ if(key in PATHS){ answered[key] = true; settle(); } }
  /* subscribe(path, onValue(raw), onError(err)) → 끊는 함수. firebase-init.js 가 onValue(ref(db, path)) 로 넘긴다. */
  function watch(subscribe){
    const offs = keys.map(k => {
      try{ return subscribe(PATHS[k], (raw) => set(k, raw), () => fail(k)); }
      catch(_){ fail(k); return null; }
    });
    return () => offs.forEach(off => { try{ if(typeof off === 'function') off(); }catch(_){} });
  }
  function onChange(fn){
    listeners.push(fn);
    return () => { const i = listeners.indexOf(fn); if(i >= 0) listeners.splice(i, 1); };
  }
  /* 부팅 때 한 번 결정하는 흐름(초대 게이트 · 가입 강제)이 첫 답을 기다린다. 시간이 넘으면 지금 값(기본값)으로. */
  function ready(want, ms){
    const ks = (want && want.length) ? want : keys;
    if(ks.every(k => answered[k])) return Promise.resolve(cur);
    return new Promise(resolve => {
      const w = { keys: ks, resolve, timer: null };
      w.timer = setTimeout(() => { const i = waiters.indexOf(w); if(i >= 0) waiters.splice(i, 1); resolve(cur); }, ms || 0);
      waiters.push(w);
    });
  }
  return {
    get: () => cur,
    set, fail, watch, onChange, ready,
    roomLimitOf: (ch) => cur.roomLimits[ch] || cur.roomLimits.workingroom,
    maxPeople: () => cur.roomMaxPeople,
    inviteGate: () => cur.inviteGate,
    existingSignup: () => cur.existingSignup,
  };
}

const api = { PATHS, CHANNELS, DEFAULTS, ROOM_LIMIT_MIN, ROOM_LIMIT_MAX, MAX_PEOPLE_MIN, MAX_PEOPLE_MAX,
  cleanRoomLimits, cleanMaxPeople, cleanFlag, createRemoteConfig, store: createRemoteConfig() };
if(typeof window !== 'undefined') window.TwRemoteConfig = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
