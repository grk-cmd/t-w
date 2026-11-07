/* invite-notice.js — 🙋 마지막으로 받은 방 초대 한 줄(이 PC · 계정마다) — 🔔 일정 알림 창 아래 줄 · 알림콩(검사 sim-invite-notice.js)
   ・초대가 올 때마다 그 한 줄을 바꾼다(쌓지 않는다). 초대 팝업을 닫았거나(10분) 앱을 꺼 둔 사이에 온 초대도 여기서 다시 연다.
   ・«새 초대» 판정은 일정 알림 창을 마지막으로 연 시각과 받은 시각(이 PC 시계)을 견준다 — 창을 열면 알림콩이 꺼진다.
   ・같은 초대(보낸 사람 · 보낸 시각이 같음)는 다시 받아도 받은 시각을 바꾸지 않는다 — 구독이 다시 불려도 알림콩이 되살아나지 않게.
   순수 규칙(read · write · same) + 저장소를 받는 createInviteNotice. classic script(window.TwInviteNotice) — app.js 보다 먼저. */
(function(){
'use strict';

const KEY = 'tw.roomInviteLast';
const NAME_MAX = 40;
const CODE_RE = /^[A-Z]{4}-[A-Z0-9]{4}$/;

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** 저장본 → { fromId, fromName, roomCode, sentTs, at } | null — 다른 계정 · 모양이 틀리면 null */
function read(raw, owner){
  if(!raw || !owner) return null;
  let v = null;
  try{ v = JSON.parse(raw); }catch(_){ return null; }
  if(!v || typeof v !== 'object' || v.owner !== owner) return null;
  const fromId = str(v.fromId, 64), roomCode = str(v.roomCode, 16).toUpperCase(), at = num(v.at);
  if(!fromId || !CODE_RE.test(roomCode) || !at) return null;
  return { fromId, fromName: str(v.fromName, NAME_MAX) || '친구', roomCode, sentTs: num(v.sentTs), at };
}
/** 받은 초대(roomInvites 한 칸) + 받은 시각 → 저장본 글 | null(모양이 틀림) */
function write(fromId, inv, owner, now){
  const n = read(JSON.stringify({ owner, fromId, fromName: inv && inv.fromName, roomCode: inv && inv.roomCode, sentTs: inv && inv.ts, at: now }), owner);
  return n ? JSON.stringify(Object.assign({ owner }, n)) : null;
}
/** 같은 초대인가 — 보낸 사람 · 보낸 시각 */
const same = (n, fromId, inv) => !!n && n.fromId === fromId && n.sentTs === num(inv && inv.ts);
/** 지금 줄보다 먼저 보낸 초대인가 — 새 초대를 처리하고 지운 뒤 남은 옛 초대로 줄을 되돌리지 않게 */
const older = (n, inv) => !!n && num(inv && inv.ts) > 0 && n.sentTs > num(inv && inv.ts);
/** 알림콩 — 일정 알림 창을 마지막으로 연 뒤에 받았나 */
const isNew = (n, seenTs) => !!n && n.at > (Number(seenTs) || 0);

/**
 * @param {{
 *   storage: { getItem(k: string): string|null, setItem(k: string, v: string): void, removeItem(k: string): void },
 *   getMyUserId: () => string,
 *   now: () => number,
 *   onChange: () => void,   // 줄이 바뀌었을 때 — 일정 알림 배지 · 창 다시 그리기(app.js 가 잇는다)
 * }} deps
 */
function createInviteNotice(deps){
  const storage = deps.storage, getMyUserId = deps.getMyUserId, now = deps.now, onChange = deps.onChange;
  function get(){
    const owner = getMyUserId(); if(!owner) return null;
    let raw = null; try{ raw = storage.getItem(KEY); }catch(_){}
    return read(raw, owner);
  }
  /** 초대 한 칸을 줄로 — 같은 초대면 그대로(false) · 바꿨으면 true */
  function note(fromId, inv){
    const owner = getMyUserId(); if(!owner || !fromId) return false;
    const cur = get();
    if(same(cur, fromId, inv) || older(cur, inv)) return false;
    const w = write(fromId, inv, owner, now()); if(!w) return false;
    try{ storage.setItem(KEY, w); }catch(_){ return false; }
    onChange();
    return true;
  }
  function clear(){
    try{ storage.removeItem(KEY); }catch(_){}
    onChange();
  }
  return { get, note, clear, isNew: (seenTs) => isNew(get(), seenTs) };
}

const api = { KEY, NAME_MAX, read, write, same, older, isNew, createInviteNotice };
if(typeof window !== 'undefined') window.TwInviteNotice = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
