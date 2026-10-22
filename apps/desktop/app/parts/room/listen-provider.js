/* listen-provider.js — 🎧 같이 듣기 곡 칸(rooms/{방}/_music)을 읽고 쓰는 한 곳 + 서버 시각.
   지금은 Firebase 옛 길뿐이다 — 방 서버가 `music` 방 메시지를 받게 되면 여기만 바꾼다(docs/LISTEN_TOGETHER.md 5장).
   화면(listen-ui.js)은 이 모양만 안다: subscribe 의 cb 는 불러오는 중 undefined → 값 | null(틀 곡 없음) · 못 받음은 onErr.
   classic script(window.TwListenProvider) — app.js 가 createListenProvider(deps). 검사: checks/sim-listen-provider.js */
(function(){

/**
 * @param {{
 *   api: () => {
 *     subscribeRoomMusic(room: string, cb: (m: object|null) => void, onErr: (e: unknown) => void): () => void,
 *     setRoomMusic(room: string, m: object|null): Promise<{ ok: boolean, err?: unknown }>,
 *     serverNow(): number,
 *   },
 * }} deps
 */
function createListenProvider(deps){
const api = deps.api;

/** 곡 칸 구독 — 부르자마자 cb(undefined)(불러오는 중), 그 뒤 값 | null. 끊는 함수를 돌려준다. */
function subscribe(room, cb, onErr){
  if(!room) return () => {};
  cb(undefined);
  return api().subscribeRoomMusic(room, (m) => cb(m || null), onErr);
}
/** 쓰기 — null 은 지움(틀 곡 없음). { ok } */
async function write(room, m){
  if(!room) return { ok: false };
  return api().setRoomMusic(room, m || null);
}
/** 서버 시각(ms) — `.info/serverTimeOffset` 보정 · 위치 계산은 늘 이 값으로 */
function now(){ return api().serverNow(); }

return { subscribe, write, now };
}

window.TwListenProvider = { createListenProvider };

})();
