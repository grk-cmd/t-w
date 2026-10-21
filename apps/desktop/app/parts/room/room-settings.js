/* room-settings.js — 🏷️ 방 설정 규칙(제목 · 보일 제목 · 최대 인원 · 방장 닉네임) 한 곳 — 순수 함수 · DOM · firebase 없음.
   방 만들기 창(room-create-ui.js) · 방 안 [방 설정](room-info-ui.js) · 로비 카드(room-lobby-model.js) · 입장 정원 검사(room-entry.js) · 들어간 뒤 자기 퇴장(firebase-init.js)이 같은 판정을 부른다.
   범위는 규칙(rooms/$room/_meta)과 서버 함수(firebase/functions/room-lobby.js)와 같아야 한다 — sim-room-settings 가 견준다.
   classic script(window.TwRoomSettings) — html 에서 app.js · firebase-init.js 보다 먼저. 금칙어 판정은 shared/banned-words.js(TwBannedWords). */
(function(){

const TITLE_MAX = 20;
const HOST_NAME_MAX = 20;
const ROOM_MAX_MIN = 2;
const ROOM_MAX_MAX = 50;
const SECRET_PREFIX = 'SCRT-';   // 시크릿룸 코드 — 방 목록에 안 나오니 «공개» 칸이 없다
/** «방 목록에 공개» 칸 아래 안내 — 방 만들기 창 · 방 안 [방 설정] 이 같은 글 */
const OPEN_HINT = Object.freeze({
  on: '누구나 방 목록에서 보고 들어올 수 있어요',
  off: '방 목록에 안 보여요 · 방 코드를 아는 사람만 들어와요',
});

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

/** 시크릿룸 코드인가 */
function isSecretCode(code){ return typeof code === 'string' && code.indexOf(SECRET_PREFIX) === 0; }

/** 화면에 보일 방 제목 — { text, isDefault }. 제목이 있고 금칙어에 안 걸리면 그 제목 · 아니면 «닉네임 님의 방» · 닉네임도 없으면 «이름 없는 방».
 *  banned · bw 를 주면 금칙어를 거른다(로비 목록 사본은 서버 함수가 이미 걸렀다 — 방 안은 _meta 를 그대로 받으니 여기서 거른다).
 *  @param {unknown} t 제목  @param {unknown} hn 방장 닉네임  @param {string[]} [banned]  @param {{ hasBannedWord(text:string, list:string[]):boolean }} [bw] */
function displayTitle(t, hn, banned, bw){
  const title = (typeof t === 'string') ? t.trim() : '';
  if(title && !(bw && banned && bw.hasBannedWord(title, banned))) return { text: title, isDefault: false };
  const name = (typeof hn === 'string') ? hn.trim() : '';
  return { text: name ? name + ' 님의 방' : '이름 없는 방', isDefault: true };
}

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

window.TwRoomSettings = { TITLE_MAX, HOST_NAME_MAX, ROOM_MAX_MIN, ROOM_MAX_MAX, TITLE_ERROR_TEXT, OPEN_HINT,
  checkTitle, displayTitle, isSecretCode, clampMax, roomCap, hostNameOf };

})();
