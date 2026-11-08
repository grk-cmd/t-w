/* mallang-sent.js — 🎁 보낸 말랑이 기록 규칙 — 기록 모양 씻기 · 최근 순서 · 30개 넘는 것 · 같은 친구에게 같은 그림을 보낸 적 있나
   순수 모듈(DOM · firebase 없음) — mallang.js(보내기 · 다시 보낼 때 묻기) · myhome-inbox.js(💝 선물함 › 보낸 선물)가 읽는다. window.TwMallangSent.
   ★ 서버 users/{내 코드}/mallangSent/{선물 id} = { to, toName, src, img, ts, msg? } — 규칙도 이 모양만 받는다.
     src = 내 말랑이 칸의 원래 그림 주소(같은 그림인지 가를 때) · img = 보낸 그림 사본 주소(목록에 보일 그림).
   ★ 기록은 최근 SENT_MAX 개만 — 넘는 것은 보낼 때 지운다. 0.14.0 전에 보낸 선물은 기록이 없다.
   검사: checks/sim-mallang-sent.js */
(function(){

const SENT_MAX = 30;
const NAME_MAX = 20, MSG_MAX = 50, URL_MAX = 1000;
const USER_RE = /^[uU][0-9a-zA-Z]{8,40}$/;
const STORAGE = 'https://firebasestorage.googleapis.com/';
const okUrl = (u) => typeof u === 'string' && u.length <= URL_MAX && u.startsWith(STORAGE);

/* 보낼 때 남길 기록 — 모양이 안 맞으면 null(남기지 않는다) */
function record(o){
  if(!o || !USER_RE.test(String(o.to || '')) || !okUrl(o.src) || !(Number(o.ts) > 0)) return null;
  const r = { to: String(o.to), src: o.src, ts: Number(o.ts) };
  const name = String(o.toName || '').trim().slice(0, NAME_MAX);
  if(name) r.toName = name;
  if(okUrl(o.img)) r.img = o.img;
  const msg = String(o.msg || '').trim().slice(0, MSG_MAX);
  if(msg) r.msg = msg;
  return r;
}
/* 서버 값 → 최근 것부터 [{id, ...}] — 모양이 깨진 줄은 뺀다 */
function list(obj){
  return Object.keys(obj || {}).map(id => {
    const r = record(obj[id]);
    return r ? Object.assign({ id }, r) : null;
  }).filter(Boolean).sort((a, b) => b.ts - a.ts);
}
/* 최근 SENT_MAX 개를 넘는 기록 id(오래된 것) — 보낸 뒤 지운다 */
function overflow(obj){ return list(obj).slice(SENT_MAX).map(r => r.id); }
/* 이 친구에게 이 그림을 보낸 적이 있으면 가장 최근 기록 */
function lastTo(obj, to, src){
  if(!to || !src) return null;
  return list(obj).find(r => r.to === to && r.src === src) || null;
}

const api = { SENT_MAX, record, list, overflow, lastTo };
if(typeof window !== 'undefined') window.TwMallangSent = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
