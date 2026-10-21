/* room-lobby-model.js — 🗂️ 방 목록 로비 규칙(목록 사본 → 카드 · 거르기 · 정렬 · 쪽 · 빠른시작) — 순수 함수 · DOM · firebase 없음.
   사본 모양은 서버 함수 firebase/functions/room-lobby.js 의 roomLobby/{채널} = { at, rooms: { 코드: { t, n, max, hn, mu, since } } }.
   정렬은 설계(docs/ROOM_LOBBY.md 1장)대로 입장 가능 먼저 → 인원 많은 순 → 오래 열린 순. 방 번호는 이 순서의 번호다(방 코드 아님).
   classic script(window.TwRoomLobbyModel) — room-settings.js 뒤 · room-lobby-ui.js · app.js 보다 먼저. 검사: checks/sim-room-lobby-ui.js */
(function(){

const roomCap = window.TwRoomSettings.roomCap;   // 방 정원 규칙은 입장 재확인과 같은 한 곳
const displayTitle = window.TwRoomSettings.displayTitle;   // 제목 기본값(«○○ 님의 방») 은 방 안 제목과 같은 한 곳

const PER_PAGE = 12;                 // 한 쪽 3 × 4
const STALE_MS = 3 * 60 * 1000;      // 사본은 1분마다 — 3분 넘게 그대로면 서버 함수가 멈춘 것으로 본다

/** 방 한 줄 → 카드. cap = 원격 정원(방 최대 인원이 더 크면 정원으로 줄인다 — roomCap). */
function cardOf(code, row, cap){
  const r = row || {};
  const n = (Number.isInteger(r.n) && r.n > 0) ? r.n : 0;
  const max = roomCap({ max: r.max }, cap);
  const hn = (typeof r.hn === 'string') ? r.hn : '';
  const dt = displayTitle(r.t, hn);
  return {
    code,
    title: dt.text,
    titleIsDefault: dt.isDefault,
    host: hn,
    hostLabel: r.mu === true ? '현재 DJ' : '현재 방장',
    music: r.mu === true,
    n, max,
    full: n >= max,
    since: Number(r.since) || 0,
  };
}

function compare(a, b){
  if(a.full !== b.full) return a.full ? 1 : -1;
  if(a.n !== b.n) return b.n - a.n;
  if(a.since !== b.since) return a.since - b.since;
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

/** 채널 사본 → { state, list, total, open, ageMs }.
 *  state: 'failed'(못 읽음 · null) · 'missing'(칸이 없음 — 서버 함수가 안 돎) · 'stale'(3분 넘게 그대로) · 'ok'.
 *  list 는 정렬 · 거르기(onlyOpen = 빈자리 있는 방만)를 마친 카드, no 는 1부터.
 *  @param {{ at: number|null, rooms: object }|null} node  @param {{ now: number, cap: number, onlyOpen: boolean }} o */
function cardsFrom(node, o){
  if(!node) return { state: 'failed', list: [], total: 0, open: 0, ageMs: null };
  if(!node.at) return { state: 'missing', list: [], total: 0, open: 0, ageMs: null };
  const all = Object.keys(node.rooms || {}).map((c) => cardOf(c, node.rooms[c], o.cap)).filter((c) => c.n > 0).sort(compare);
  const open = all.filter((c) => !c.full).length;
  const list = (o.onlyOpen ? all.filter((c) => !c.full) : all).map((c, i) => Object.assign({ no: String(i + 1).padStart(3, '0') }, c));
  const ageMs = Math.max(0, o.now - node.at);
  return { state: ageMs > STALE_MS ? 'stale' : 'ok', list, total: all.length, open, ageMs };
}

/** 쪽 나누기 — page 는 0부터 · 범위 밖이면 끝 쪽으로. */
function pageOf(list, page){
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const p = Math.max(0, Math.min(pages - 1, Math.floor(Number(page)) || 0));
  return { items: list.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE), page: p, pages };
}

/** 빠른시작 — 빈자리 있는 방 중 하나(rand 는 0 이상 1 미만). 없으면 null. */
function pickQuick(list, rand){
  const open = list.filter((c) => !c.full);
  if(!open.length) return null;
  return open[Math.min(open.length - 1, Math.floor(rand * open.length))].code;
}

window.TwRoomLobbyModel = { PER_PAGE, STALE_MS, cardOf, cardsFrom, pageOf, pickQuick };

})();
