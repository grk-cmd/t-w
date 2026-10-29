/* request-id.js — 🔁 요청 번호(requestId) 한 곳 (검사 sim-request-id.js)
   [왜] 새것을 만들거나 쌓는 쓰기(뽑기 · 선물 · 지급 · 초대 · 글 쓰기 · 대화 보내기)는 본문에 requestId 를 싣는다.
     서버는 같은 사람 · 같은 번호를 «처음 결과를 다시 돌려주기» 로 받는다(10분). 그래서 답을 못 받아 **같은 일을 다시 보낼 땐 같은 번호**,
     새 일에는 새 번호여야 한다 — 다시 보낼 때 새 번호를 만들면 뽑기 · 선물이 두 번 된다.
   [모양] 서버 규칙 ^[A-Za-z0-9_-]{8,64}$ (PATTERN). 만드는 값은 uuid(36자 · 영숫자와 -) — 규칙 안이다.
   [쓰는 법] 한 번 보내고 끝나는 일: body.requestId = TwRequestId.newId().
     다시 보낼 수 있는 일: const ids = TwRequestId.createPending(); ids.idFor(키) — 같은 키는 settle(키) 하기 전까지 같은 번호.
       답을 받았으면(성공이든 서버가 거절했든) settle(키), 닿지 못해 다시 보낼 거면 settle 하지 않고 다시 idFor(키).
   classic script — 쓰는 모듈(device-id.js · api 를 부르는 provider) · app.js 보다 먼저 싣는다(window.TwRequestId). 아무것도 부르지 않는다. */
(function(){
'use strict';

const PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const PENDING_MAX = 200;   // 다시 보낼 일을 이만큼만 기억한다 — 끝내지 않은 키가 쌓여도 메모리가 늘지 않게(오래된 것부터 버림)

const isValid = (v) => typeof v === 'string' && PATTERN.test(v);

/* 16바이트 무작위 → uuid 모양(8-4-4-4-12 · 소문자 hex). randomUUID 가 없는 판(옛 크로미움 · 검사)의 대신. */
function uuidFrom(bytes){
  const b = Array.from(bytes, (x) => x & 0xff);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => (x < 16 ? '0' : '') + x.toString(16)).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

/** @param {{ crypto?: { randomUUID?: () => string, getRandomValues?: (a: Uint8Array) => Uint8Array }, random?: () => number }} deps */
function createIdMaker(deps){
  const c = (deps && deps.crypto) || null;
  const random = (deps && deps.random) || Math.random;
  return function newId(){
    if(c && c.randomUUID){
      const v = c.randomUUID();
      if(isValid(v)) return v;
    }
    const bytes = new Uint8Array(16);
    if(c && c.getRandomValues) c.getRandomValues(bytes);
    else for(let i = 0; i < 16; i++) bytes[i] = Math.floor(random() * 256);
    return uuidFrom(bytes);
  };
}

/* 다시 보낼 수 있는 일의 번호 기억 — 키(일의 이름 · 예: 'gift:' + 받는 사람)마다 하나. */
/** @param {{ newId: () => string, max?: number }} deps */
function createPending(deps){
  const newId = deps.newId;
  const max = deps.max || PENDING_MAX;
  const ids = new Map();   // 키 → 번호(넣은 차례가 곧 오래된 차례)
  return {
    idFor(key){
      const k = String(key);
      if(ids.has(k)) return ids.get(k);
      const id = newId();
      ids.set(k, id);
      if(ids.size > max) ids.delete(ids.keys().next().value);
      return id;
    },
    /* 이 일은 끝났다 — 다음 idFor(같은 키)는 새 번호 */
    settle(key){ ids.delete(String(key)); },
    has: (key) => ids.has(String(key)),
    size: () => ids.size,
  };
}

const browserCrypto = (typeof window !== 'undefined' && window.crypto) || null;   // 검사 · node 에서는 random 길
const newId = createIdMaker({ crypto: browserCrypto });
const api = {
  PATTERN, PENDING_MAX, isValid, uuidFrom, createIdMaker,
  newId,
  createPending: (o) => createPending(Object.assign({ newId }, o || {})),
};
if(typeof window !== 'undefined') window.TwRequestId = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
