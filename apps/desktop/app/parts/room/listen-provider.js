/* listen-provider.js — 🎧 같이 듣기 곡 칸을 읽고 쓰는 한 곳 + 서버 시각.
   방 서버 방이면 방 서버 `music` 메시지(server() 가 돌려주는 provider — onMusic · sendMusic · serverNow), 아니면 Firebase rooms/{방}/_music.
   고르기는 부를 때마다 server() 로 — 방 서버 방에서 Firebase 칸을 쓰면 방 사람들이 못 받는다(docs/LISTEN_TOGETHER.md 5장).
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
 *   server: () => ({ onMusic(fn: (m: object|null) => void): () => void, sendMusic(m: object|null, pos?: number): Promise<{ ok: boolean, code?: string }>,
 *                    serverNow(): number, lastMusicSeq(): number }|null),
 *   model: { wirePos(m: object, now: number): number },   // TwListenModel — 위치 계산 · 상한은 그 한 곳
 * }} deps
 */
function createListenProvider(deps){
const api = deps.api;
const server = deps.server;   // 방 서버 방의 provider · 아니면 null
const model = deps.model;

/** 곡 칸 구독 — 부르자마자 cb(undefined)(불러오는 중), 그 뒤 값 | null. 끊는 함수를 돌려준다. */
function subscribe(room, cb, onErr){
  if(!room) return () => {};
  cb(undefined);
  const sp = server();
  if(sp) return sp.onMusic((m) => cb(m || null));
  return api().subscribeRoomMusic(room, (m) => cb(m || null), onErr);
}
/** 쓰기 — null 은 지움(틀 곡 없음). { ok } */
async function write(room, m){
  if(!room) return { ok: false };
  const sp = server();
  if(sp){
    const r = await sp.sendMusic(m || null, m ? model.wirePos(m, sp.serverNow()) : 0);
    return (r && r.ok) ? { ok: true } : { ok: false, err: (r && r.code) || 'error' };
  }
  return api().setRoomMusic(room, m || null);
}
/** 칸이 비었을 때 새 곡의 앞 차례 — 방 서버는 지운 뒤에도 마지막 차례를 기억해 그보다 커야 받는다 · Firebase 칸은 지우면 차례도 없다(-1). */
function lastSeq(){
  const sp = server();
  return sp ? sp.lastMusicSeq() : -1;
}
/** 서버 시각(ms) — 방 서버 방은 welcome · music 의 now 로 맞춘 시계, 아니면 `.info/serverTimeOffset` 보정 · 위치 계산은 늘 이 값으로 */
function now(){
  const sp = server();
  return sp ? sp.serverNow() : api().serverNow();
}

return { subscribe, write, now, lastSeq };
}

window.TwListenProvider = { createListenProvider };

})();
