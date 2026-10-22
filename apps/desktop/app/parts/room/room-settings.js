/* room-settings.js — 🏷️ 방 설정 규칙(제목 · 최대 인원 · 방장 닉네임) 한 곳 — 순수 함수 · DOM · firebase 없음.
   방 만들기 창(room-create-ui.js) · 입장 정원 검사(room-entry.js) · 들어간 뒤 자기 퇴장(firebase-init.js)이 같은 판정을 부른다.
   범위는 규칙(rooms/$room/_meta)과 서버 함수(firebase/functions/room-lobby.js)와 같아야 한다 — sim-room-settings 가 견준다.
   classic script(window.TwRoomSettings) — html 에서 app.js · firebase-init.js 보다 먼저. 금칙어 판정은 shared/banned-words.js(TwBannedWords). */
(function(){

const TITLE_MAX = 20;
const HOST_NAME_MAX = 20;
const ROOM_MAX_MIN = 2;
const ROOM_MAX_MAX = 50;

/** 방 제목 확인 — { ok:true, title } · { ok:false, reason:'long'|'banned' }. 빈 제목은 통과(title:'') — 목록이 «○○ 님의 방» 으로 그린다.
 *  @param {unknown} raw 입력칸 값  @param {string[]} banned TwBannedWords.cleanBannedList 를 거친 목록
 *  @param {{ hasBannedWord(text:string, list:string[]):boolean }} bw TwBannedWords */
function checkTitle(raw, banned, bw){
  const title = (typeof raw === 'string') ? raw.trim() : '';
  if(!title) return { ok: true, title: '' };
  if(title.length > TITLE_MAX) return { ok: false, reason: 'long' };
  if(bw.hasBannedWord(title, banned)) return { ok: false, reason: 'banned' };
  return { ok: true, title };
}
const TITLE_ERROR_TEXT = Object.freeze({
  long: '방 제목은 ' + TITLE_MAX + '자까지예요',
  banned: '방 제목에 쓸 수 없는 말이 있어요',
});

/** 방 만들기 창의 최대 인원 — 2 ~ 정원(cap) 안의 정수로. 숫자가 아니면 정원. */
function clampMax(v, cap){
  const hi = Math.max(ROOM_MAX_MIN, Math.min(ROOM_MAX_MAX, Math.floor(Number(cap)) || ROOM_MAX_MIN));
  const n = Math.floor(Number(v));
  if(!Number.isFinite(n)) return hi;
  return Math.max(ROOM_MAX_MIN, Math.min(hi, n));
}

/** 이 방에 들어갈 수 있는 사람 수 — 방 최대 인원(_meta.max)과 정원(원격 설정) 중 작은 쪽. max 가 없거나 범위 밖이면 정원. */
function roomCap(meta, cap){
  const m = meta && meta.max;
  if(Number.isInteger(m) && m >= ROOM_MAX_MIN && m <= ROOM_MAX_MAX) return Math.min(m, cap);
  return cap;
}

/** _meta.hostName 에 적을 닉네임 — 앞뒤 공백을 걷고 20자까지. 비면 null(칸을 쓰지 않는다). */
function hostNameOf(name){
  const s = (typeof name === 'string') ? name.trim().slice(0, HOST_NAME_MAX) : '';
  return s || null;
}

window.TwRoomSettings = { TITLE_MAX, HOST_NAME_MAX, ROOM_MAX_MIN, ROOM_MAX_MAX, TITLE_ERROR_TEXT,
  checkTitle, clampMax, roomCap, hostNameOf };

})();
