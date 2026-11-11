/* recent-rooms.js — 🕘 최근에 들어간 방(최대 3개) — 규칙 · 이 PC 저장.
   app.js 가 room-entry 의 «방에 연결됨» 알림(onRoomJoined)에 record(코드, 제목) 를 걸고, 로비 코드 칸(recent-rooms-ui.js)이 list() 로 그린다.
   방 코드 모양은 여기서 다시 쓰지 않는다 — room-entry 의 isRoomCode 를 deps 로 받는다(규칙 한 곳).
   ⚠️ 계정마다 따로 저장한다(tw.recentRooms.<내 id>) — 한 PC 를 둘이 쓸 때 앞 사람의 방 코드(시크릿룸 포함)가 보이지 않게.
     내 id 가 없으면(로그인 전) 기록도 목록도 없다.
   ⚠️ 서버에 올리지 않는다 — 이 PC 의 편의 기능이다(다른 기기에는 없다).
   내보냄: window.TwRecentRooms = { MAX, KEY_PREFIX, add, parse, agoText, createRecentRooms }.
   room-entry.js · recent-rooms-ui.js · app.js 보다 먼저 싣는 classic script. 검사: checks/sim-recent-rooms.js */
(function(){

const MAX = 3;
const KEY_PREFIX = 'tw.recentRooms.';
const TITLE_MAX = 40;

/** 저장된 글 → 목록. 모양이 틀린 줄(isCode 가 아니라는 코드 포함)은 버리고, 같은 코드는 앞 것만, 최대 MAX.
 *  @param {string} raw @param {(code: unknown) => boolean} isCode */
function parse(raw, isCode){
  let arr;
  try{ arr = JSON.parse(raw); }catch(_){ return []; }
  if(!Array.isArray(arr)) return [];
  const out = [], seen = new Set();
  for(const r of arr){
    if(!r || !isCode(r.code) || seen.has(r.code)) continue;
    if(!Number.isFinite(r.at) || r.at <= 0) continue;
    seen.add(r.code);
    out.push({ code: r.code, title: (typeof r.title === 'string') ? r.title.slice(0, TITLE_MAX) : '', at: r.at });
    if(out.length >= MAX) break;
  }
  return out;
}

/** 방 하나를 맨 앞에 — 같은 코드가 있으면 그 줄을 빼고 앞으로. 모양이 틀린 코드면 목록 그대로.
 *  @param {(code: unknown) => boolean} isCode */
function add(list, code, title, at, isCode){
  if(!isCode(code)) return list.slice();
  const t = (typeof title === 'string') ? title.trim().slice(0, TITLE_MAX) : '';
  return [{ code, title: t, at }].concat(list.filter((r) => r.code !== code)).slice(0, MAX);
}

/** 들어간 지 얼마나 됐나 — 방금 · n분 전 · n시간 전 · n일 전. */
function agoText(ms){
  const m = Math.floor(Math.max(0, ms) / 60000);
  if(m < 1) return '방금';
  if(m < 60) return m + '분 전';
  const h = Math.floor(m / 60);
  if(h < 24) return h + '시간 전';
  return Math.floor(h / 24) + '일 전';
}

/**
 * @param {{
 *   storage: { getItem(k: string): string|null, setItem(k: string, v: string): void },
 *   getMyUserId: () => string|null,
 *   now: () => number,
 *   isRoomCode: (code: unknown) => boolean,
 * }} deps
 */
function createRecentRooms(deps){
  const storage = deps.storage;
  const getMyUserId = deps.getMyUserId;
  const now = deps.now;
  const isRoomCode = deps.isRoomCode;

  const keyOf = () => { const id = getMyUserId(); return id ? KEY_PREFIX + id : null; };

  /** @returns {{ code: string, title: string, at: number }[]} */
  function list(){
    const k = keyOf();
    if(!k) return [];
    let raw = null;
    try{ raw = storage.getItem(k); }catch(_){ return []; }
    return raw ? parse(raw, isRoomCode) : [];
  }

  /** @param {string} code @param {string} title */
  function record(code, title){
    const k = keyOf();
    if(!k) return;
    const next = add(list(), code, title, now(), isRoomCode);
    try{ storage.setItem(k, JSON.stringify(next)); }catch(_){}   // 저장소가 막혀도 입장은 그대로
  }

  return { list, record };
}

const api = Object.freeze({ MAX, KEY_PREFIX, add, parse, agoText, createRecentRooms });
if(typeof window !== 'undefined') window.TwRecentRooms = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
