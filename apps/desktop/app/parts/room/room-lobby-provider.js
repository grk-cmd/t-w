/* room-lobby-provider.js — 🗂️ 방 목록 로비가 읽는 것(채널 목록 사본 · 내 시크릿룸)을 한 곳에서.
   지금은 Firebase 옛 길뿐이다 — 방 서버 API(GET /v1/rooms/lobby?channel=)가 생기면 listRooms 만 «API 먼저 · 못 받으면 Firebase» 로 바꾼다
   (설계 docs/ROOM_LOBBY.md 4장 · api-public-reads.js 의 count · random 과 같은 모양). 화면(room-lobby-ui.js)은 이 모양만 안다.
   classic script(window.TwRoomLobbyProvider) — app.js 가 createRoomLobbyProvider(deps). 검사: checks/sim-room-lobby-ui.js */
(function(){

/**
 * @param {{
 *   api: () => {
 *     getRoomLobby(channel: string): Promise<{ at: number|null, rooms: object }|null>,
 *     getMySecretRoom(userId: string): Promise<string|null>,
 *     getSecretRoomPub(code: string): Promise<{ owner: string, name?: string, exp?: number }|null>,
 *     checkSecretRoomEntry(code: string, ownerUid: string): Promise<{ count: number, ownerIn: boolean }|null>,
 *   },
 *   myUserId: () => string|null,
 *   now: () => number,
 * }} deps
 */
function createRoomLobbyProvider(deps){
const api = deps.api;
const myUserId = deps.myUserId;
const now = deps.now;

/** 채널 목록 사본 — { at, rooms } · 칸 없음은 { at:null, rooms:{} } · 못 읽음 null(빈 목록과 다르게 그린다). */
// TODO: 방 서버 API(GET /v1/rooms/lobby)가 생기면 먼저 묻고 서버 방을 합친다.
async function listRooms(channel){
  return api().getRoomLobby(channel);
}

/* 내 시크릿룸 «누구 것인가» 는 세션에 한 번만 읽는다(계정이 바뀌면 다시) — 손님 수는 따로(secretGuests · 로비 줄만 부른다).
   발급 칸(users/{나}/secretRoom)은 «마지막으로 받은 코드» 라 소유의 증거가 아니다 — pub.owner 가 나일 때만 내 것. */
let owned = null;   // { uid, p: Promise<{ code, pub }|null> }
async function readOwned(uid){
  const code = await api().getMySecretRoom(uid);
  if(!code) return null;
  const full = 'SCRT-' + String(code).replace(/^SCRT-/, '');
  const pub = await api().getSecretRoomPub(full);
  return (pub && pub.owner === uid) ? { code: full, pub } : null;
}

/** 내 시크릿룸 — { code, name } 또는 null(없음 · 남의 코드 · 만료). 첫 번 뒤로는 읽기 없음. */
async function mySecretRoom(){
  const uid = myUserId();
  if(!uid) return null;
  if(!owned || owned.uid !== uid){
    const p = readOwned(uid);
    owned = { uid, p };
    p.catch(() => { if(owned && owned.p === p) owned = null; });   // 못 읽었으면 다음에 다시
  }
  const o = await owned.p;
  if(!o) return null;
  if(typeof o.pub.exp === 'number' && o.pub.exp <= now()) return null;
  return { code: o.code, name: (typeof o.pub.name === 'string' && o.pub.name) ? o.pub.name : '내 시크릿룸' };
}

/** 내 시크릿룸 손님 수 — 방장(나)을 뺀다(입장 검사와 같은 셈) · 못 읽으면 null. 방 멤버를 읽으니 로비 줄을 그릴 때만 부른다. */
async function secretGuests(code){
  const uid = myUserId();
  if(!uid || !code) return null;
  const e = await api().checkSecretRoomEntry(code, uid);
  return (e && typeof e.count === 'number') ? Math.max(0, e.count - (e.ownerIn ? 1 : 0)) : null;
}

return { listRooms, mySecretRoom, secretGuests };
}

window.TwRoomLobbyProvider = { createRoomLobbyProvider };

})();
