/* recent-rooms.js — 🕘 최근에 들어간 방(최대 3개) — 규칙 · 이 PC 저장.
   app.js 가 room-entry 의 «방에 연결됨» 알림(onRoomJoined)에 record(코드, 제목) 를 걸고, 로비 코드 칸(recent-rooms-ui.js)이 list() 로 그린다.
   방 코드 모양 · 시크릿룸 코드인가는 여기서 다시 쓰지 않는다 — room-entry 의 isRoomCode · room-state 의 isSecretCode 를 deps 로 받는다(규칙 한 곳).
   ⚠️ 계정마다 따로 저장한다(tw.recentRooms.<내 id>) — 한 PC 를 둘이 쓸 때 앞 사람의 방 코드(시크릿룸 포함)가 보이지 않게.
     내 id 가 없으면(로그인 전) 기록도 목록도 없다.
   ⚠️ 시크릿룸은 코드를 남기지 않는다 — «SCRT-****» 와 제목 · 시각만 적는다(SECRET_MASK). 한 번 들어가 본 사람이 코드를 모르는 채 최근 방으로 다시 들어가지 못하게
     (친구 방 놀러가기처럼 코드를 모르고 들어가는 길이 있다). 다시 들어가려면 코드를 입력한다(recent-rooms-ui.js → room-entry secretCodeFrom) — 맞는지는 서버가 가른다.
     옛 판이 남긴 진짜 시크릿룸 코드는 읽을 때 가린 줄로 바꿔 다시 저장한다.
   ⚠️ 서버에 올리지 않는다 — 이 PC 의 편의 기능이다(다른 기기에는 없다).
   내보냄: window.TwRecentRooms = { MAX, KEY_PREFIX, SECRET_MASK, add, parse, agoText, createRecentRooms }.
   room-entry.js · recent-rooms-ui.js · app.js 보다 먼저 싣는 classic script. 검사: checks/sim-recent-rooms.js */
(function(){

const MAX = 3;
const KEY_PREFIX = 'tw.recentRooms.';
const TITLE_MAX = 40;
const SECRET_MASK = 'SCRT-****';   // 시크릿룸 줄에 적는 코드 — 진짜 코드는 저장하지 않는다
/* 같은 줄인가 — 공개 방은 코드로 · 시크릿룸(가린 줄)은 코드가 다 같으니 제목까지 */
const sameRow = (a, b) => a.code === b.code && (a.code !== SECRET_MASK || a.title === b.title);

/** 저장된 글 → 목록. 모양이 틀린 줄(isCode 가 아니라는 코드 포함)은 버리고, 같은 줄은 앞 것만, 최대 MAX. 시크릿룸은 가린 줄로 바꾼다.
 *  @param {string} raw @param {(code: unknown) => boolean} isCode @param {(code: unknown) => boolean} isSecret */
function parse(raw, isCode, isSecret){
  let arr;
  try{ arr = JSON.parse(raw); }catch(_){ return []; }
  if(!Array.isArray(arr)) return [];
  const out = [];
  for(const r of arr){
    if(!r || !(r.code === SECRET_MASK || isCode(r.code))) continue;
    if(!Number.isFinite(r.at) || r.at <= 0) continue;
    const row = { code: isSecret(r.code) ? SECRET_MASK : r.code, title: (typeof r.title === 'string') ? r.title.slice(0, TITLE_MAX) : '', at: r.at };
    if(out.some((x) => sameRow(x, row))) continue;
    out.push(row);
    if(out.length >= MAX) break;
  }
  return out;
}

/** 방 하나를 맨 앞에 — 같은 줄이 있으면 그 줄을 빼고 앞으로. 모양이 틀린 코드면 목록 그대로. 시크릿룸은 코드 대신 SECRET_MASK 를 적는다.
 *  @param {(code: unknown) => boolean} isCode @param {(code: unknown) => boolean} isSecret */
function add(list, code, title, at, isCode, isSecret){
  if(!isCode(code)) return list.slice();
  const t = (typeof title === 'string') ? title.trim().slice(0, TITLE_MAX) : '';
  const row = { code: isSecret(code) ? SECRET_MASK : code, title: t, at };
  return [row].concat(list.filter((r) => !sameRow(r, row))).slice(0, MAX);
}

/** 저장된 글에 옛 판이 남긴 진짜 시크릿룸 코드가 있는가(가린 줄은 아니다). @param {string} raw @param {(code: unknown) => boolean} isSecret */
function hasRealSecret(raw, isSecret){
  let arr;
  try{ arr = JSON.parse(raw); }catch(_){ return false; }
  return Array.isArray(arr) && arr.some((r) => !!r && r.code !== SECRET_MASK && isSecret(r.code));
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
 *   isSecretCode: (code: unknown) => boolean,
 * }} deps
 */
function createRecentRooms(deps){
  const storage = deps.storage;
  const getMyUserId = deps.getMyUserId;
  const now = deps.now;
  const isRoomCode = deps.isRoomCode;
  const isSecretCode = deps.isSecretCode;   // 시크릿룸 코드인가(room-state.js TwRoomState.isSecretCode — 공용 판정)

  const keyOf = () => { const id = getMyUserId(); return id ? KEY_PREFIX + id : null; };

  /** @returns {{ code: string, title: string, at: number }[]} */
  function list(){
    const k = keyOf();
    if(!k) return [];
    let raw = null;
    try{ raw = storage.getItem(k); }catch(_){ return []; }
    if(!raw) return [];
    const rows = parse(raw, isRoomCode, isSecretCode);
    // 옛 판이 남긴 진짜 시크릿룸 코드 — 가린 줄로 바꾼 목록을 바로 다시 적어 이 PC 에서 지운다
    if(hasRealSecret(raw, isSecretCode)){ try{ storage.setItem(k, JSON.stringify(rows)); }catch(_){} }
    return rows;
  }

  /** @param {string} code @param {string} title */
  function record(code, title){
    const k = keyOf();
    if(!k) return;
    const next = add(list(), code, title, now(), isRoomCode, isSecretCode);
    try{ storage.setItem(k, JSON.stringify(next)); }catch(_){}   // 저장소가 막혀도 입장은 그대로
  }

  return { list, record };
}

const api = Object.freeze({ MAX, KEY_PREFIX, SECRET_MASK, add, parse, agoText, createRecentRooms });
if(typeof window !== 'undefined') window.TwRecentRooms = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
