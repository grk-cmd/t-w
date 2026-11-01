/* recent-rooms.js — 🕘 최근에 들어간 방(최대 3개) — 규칙 · 이 PC 저장.
   방에 연결되면 room-entry 가 record(코드, 제목) 를 부르고, 로비 코드 칸(recent-rooms-ui.js)이 list() 로 그린다.
   ⚠️ 계정마다 따로 저장한다(tw.recentRooms.<내 id>) — 한 PC 를 둘이 쓸 때 앞 사람의 방 코드(시크릿룸 포함)가 보이지 않게.
     내 id 가 없으면(로그인 전) 기록도 목록도 없다.
   ⚠️ 서버에 올리지 않는다 — 이 PC 의 편의 기능이다(다른 기기에는 없다).
   내보냄: window.TwRecentRooms = { MAX, KEY_PREFIX, add, parse, agoText, createRecentRooms }.
   room-entry.js · recent-rooms-ui.js · app.js 보다 먼저 싣는 classic script. 검사: checks/sim-recent-rooms.js */
(function(){

const MAX = 3;
const KEY_PREFIX = 'tw.recentRooms.';
const TITLE_MAX = 40;
const CODE_RE = /^[A-Z]{4}-[A-Z0-9]{4}$/;   // WORK- · PLAY- · COZY- · SCRT- + 4자리(room-entry ROOM_CODE_RE 와 같은 모양)

/** 저장된 글 → 목록. 모양이 틀린 줄은 버리고, 같은 코드는 앞 것만, 최대 MAX. */
function parse(raw){
  let arr;
  try{ arr = JSON.parse(raw); }catch(_){ return []; }
  if(!Array.isArray(arr)) return [];
  const out = [], seen = new Set();
  for(const r of arr){
    if(!r || typeof r.code !== 'string' || !CODE_RE.test(r.code) || seen.has(r.code)) continue;
    if(!Number.isFinite(r.at) || r.at <= 0) continue;
    seen.add(r.code);
    out.push({ code: r.code, title: (typeof r.title === 'string') ? r.title.slice(0, TITLE_MAX) : '', at: r.at });
    if(out.length >= MAX) break;
  }
  return out;
}

/** 방 하나를 맨 앞에 — 같은 코드가 있으면 그 줄을 빼고 앞으로. 모양이 틀린 코드면 목록 그대로. */
function add(list, code, title, at){
  if(typeof code !== 'string' || !CODE_RE.test(code)) return list.slice();
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
 * }} deps
 */
function createRecentRooms(deps){
  const storage = deps.storage;
  const getMyUserId = deps.getMyUserId;
  const now = deps.now;

  const keyOf = () => { const id = getMyUserId(); return id ? KEY_PREFIX + id : null; };

  /** @returns {{ code: string, title: string, at: number }[]} */
  function list(){
    const k = keyOf();
    if(!k) return [];
    let raw = null;
    try{ raw = storage.getItem(k); }catch(_){ return []; }
    return raw ? parse(raw) : [];
  }

  /** @param {string} code @param {string} title */
  function record(code, title){
    const k = keyOf();
    if(!k) return;
    const next = add(list(), code, title, now());
    try{ storage.setItem(k, JSON.stringify(next)); }catch(_){}   // 저장소가 막혀도 입장은 그대로
  }

  return { list, record };
}

const api = Object.freeze({ MAX, KEY_PREFIX, add, parse, agoText, createRecentRooms });
if(typeof window !== 'undefined') window.TwRecentRooms = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
