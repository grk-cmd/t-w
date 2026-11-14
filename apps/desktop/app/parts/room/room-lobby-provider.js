/* room-lobby-provider.js — 🗂️ 방 목록 로비가 읽는 것(채널 목록 · 내 시크릿룸 · 손님 수)을 한 곳에서.
   목록은 API GET /v1/rooms/lobby?channel= — realtime 서버가 지금 연 방(공개 · 사람 있음 · 시크릿룸 뺌)을 그대로 준다(저장 · 캐시 없음).
   내 시크릿룸은 GET /v1/me/secret-room(없으면 null) · 손님 수는 방 포트 peek(들어가지 않고 보기).
   화면(room-lobby-ui.js)은 이 모양만 안다 — 목록은 room-lobby-model.js 의 사본 모양 { at, rooms: { 코드: { t, n, max, hn, mu, since } } } 로 바꿔 넘긴다.
   classic script(window.TwRoomLobbyProvider) — app.js 가 createRoomLobbyProvider(deps). 검사: checks/sim-room-lobby-ui.js */
(function(){

/**
 * @param {{
 *   apiGet: (path: string, opts: object) => Promise<any>,   // 로그인 API 통로(TwApi.authed.get) — 실패는 던진다
 *   peek: (code: string) => Promise<{ exists: boolean, count: number }|null>,   // 방 포트 peek(room-rt.js) — 못 물으면 null
 *   roomCode: () => string|null,   // 지금 들어가 있는 방(없으면 null) — 내 시크릿룸 안이면 손님 수에서 나를 뺀다
 *   myUserId: () => string|null,   // 계정이 바뀌면 내 시크릿룸을 다시 읽는다
 *   now: () => number,
 * }} deps
 */
const LOBBY_PATH = '/v1/rooms/lobby';
const MY_SECRET_PATH = '/v1/me/secret-room';
const LOBBY_TIMEOUT_MS = 5000;
const SECRET_NAME_DEFAULT = '내 시크릿룸';
const CHANNELS = Object.freeze(['workingroom', 'togetherroom']);

const msOf = (v) => {
  if(typeof v === 'number' && isFinite(v)) return v;
  const t = (typeof v === 'string') ? Date.parse(v) : NaN;
  return isFinite(t) ? t : null;
};

/** API 로비 답 { at, rooms:[{ code, title, people, max, hostName, music, since }] } → 사본 모양 { at(ms), rooms: { 코드: { t, n, max, hn, mu, since } } } · 모양이 틀리면 null */
function lobbyOf(d){
  if(!d || typeof d !== 'object' || !Array.isArray(d.rooms)) return null;
  const at = msOf(d.at);
  if(at === null) return null;
  const rooms = {};
  for(const r of d.rooms){
    if(!r || typeof r.code !== 'string' || !r.code) continue;
    rooms[r.code] = {
      t: (typeof r.title === 'string') ? r.title : '',
      n: Number.isInteger(r.people) ? r.people : 0,
      max: Number.isInteger(r.max) ? r.max : undefined,
      hn: (typeof r.hostName === 'string') ? r.hostName : '',
      mu: r.music === true,
      since: msOf(r.since) || 0,
    };
  }
  return { at, rooms };
}
/** API 내 시크릿룸 답 { code, name, expiresAt } | null → { code, name, expiresAt(ms|null) } | null */
function mySecretOf(d){
  if(!d || typeof d !== 'object' || typeof d.code !== 'string' || !/^SCRT-[A-Z0-9]{4}$/.test(d.code)) return null;
  return { code: d.code, name: (typeof d.name === 'string' && d.name) ? d.name : SECRET_NAME_DEFAULT, expiresAt: msOf(d.expiresAt) };
}

function createRoomLobbyProvider(deps){
const apiGet = deps.apiGet;
const peek = deps.peek;
const roomCode = deps.roomCode;
const myUserId = deps.myUserId;
const now = deps.now;

/** 채널 목록 — { at, rooms } · 못 읽음(닿지 못함 · 모양 틀림) null — 빈 목록과 다르게 그린다. */
async function listRooms(channel){
  if(CHANNELS.indexOf(channel) < 0) return null;
  try{ return lobbyOf(await apiGet(LOBBY_PATH + '?channel=' + encodeURIComponent(channel), { auth: true, timeoutMs: LOBBY_TIMEOUT_MS })); }
  catch(_){ return null; }
}

/* 내 시크릿룸은 계정마다 한 번만 읽는다(발급 · 만료는 드물다 — 바뀌면 다음 실행에). 실패는 기억하지 않는다(다음에 다시). */
let owned = null;   // { uid, p: Promise<{ code, name, expiresAt }|null> }
/** 내 시크릿룸 — { code, name, expiresAt } 또는 null(없음 · 만료). */
async function mySecretRoom(){
  const uid = myUserId();
  if(!uid) return null;
  if(!owned || owned.uid !== uid){
    const p = Promise.resolve(apiGet(MY_SECRET_PATH, { auth: true, timeoutMs: LOBBY_TIMEOUT_MS })).then(mySecretOf);
    owned = { uid, p };
    p.catch(() => { if(owned && owned.p === p) owned = null; });
  }
  const o = await owned.p;
  if(!o) return null;
  if(typeof o.expiresAt === 'number' && o.expiresAt <= now()) return null;
  return o;
}

/** 내 시크릿룸 손님 수 — 방장(나)을 뺀다 · 못 물으면 null. 들어가지 않고 보기(peek)라 로비 줄을 그릴 때만 부른다. */
async function secretGuests(code){
  if(!code) return null;
  const e = await peek(code);
  if(!e) return null;
  if(!e.exists) return 0;
  return Math.max(0, e.count - (roomCode() === code ? 1 : 0));
}

return { listRooms, mySecretRoom, secretGuests };
}

window.TwRoomLobbyProvider = { LOBBY_PATH, MY_SECRET_PATH, lobbyOf, mySecretOf, createRoomLobbyProvider };

})();
