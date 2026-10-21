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

/** 내 시크릿룸 — { code, name, guests } 또는 null. 발급 칸(users/{나}/secretRoom)은 «마지막으로 받은 코드» 라
 *  소유의 증거가 아니다 — pub.owner 가 나일 때만 · 만료 전만 보인다. 인원은 손님 수(방장인 나는 밖에 있다). */
async function mySecretRoom(){
  const uid = myUserId();
  if(!uid) return null;
  const code = await api().getMySecretRoom(uid);
  if(!code) return null;
  const full = 'SCRT-' + String(code).replace(/^SCRT-/, '');
  const pub = await api().getSecretRoomPub(full);
  if(!pub || pub.owner !== uid) return null;
  if(typeof pub.exp === 'number' && pub.exp <= now()) return null;
  const e = await api().checkSecretRoomEntry(full, uid);
  return { code: full, name: (typeof pub.name === 'string' && pub.name) ? pub.name : '내 시크릿룸', guests: (e && typeof e.count === 'number') ? e.count : null };
}

return { listRooms, mySecretRoom };
}

window.TwRoomLobbyProvider = { createRoomLobbyProvider };

})();
