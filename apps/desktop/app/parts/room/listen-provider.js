/* listen-provider.js — 🎧 같이 듣기 곡 칸을 읽고 쓰는 한 곳 + 서버 시각.
   지금 방의 방 포트 provider(room-rt.js — music 메시지 · onMusic · sendMusic · serverNow)로만 한다. 방 밖이면 할 일이 없다.
   화면(listen-ui.js)은 이 모양만 안다: subscribe 의 cb 는 불러오는 중 undefined → 값 | null(틀 곡 없음).
   classic script(window.TwListenProvider) — app.js 가 createListenProvider(deps). 검사: checks/sim-listen-provider.js */
(function(){

/**
 * @param {{
 *   server: () => ({ onMusic(fn: (m: object|null) => void): () => void, sendMusic(m: object|null, pos?: number): Promise<{ ok: boolean, code?: string }>,
 *                    serverNow(): number, lastMusicSeq(): number }|null),   // 지금 방의 provider · 방 밖이면 null
 *   model: { wirePos(m: object, now: number): number },   // TwListenModel — 위치 계산 · 상한은 그 한 곳
 * }} deps
 */
function createListenProvider(deps){
const server = deps.server;
const model = deps.model;

/** 곡 칸 구독 — 부르자마자 cb(undefined)(불러오는 중), 그 뒤 값 | null. 끊는 함수를 돌려준다. 방 밖이면 아무 일 없음. */
function subscribe(room, cb){
  const sp = server();
  if(!room || !sp) return () => {};
  cb(undefined);
  return sp.onMusic((m) => cb(m || null));
}
/** 쓰기 — null 은 지움(틀 곡 없음). { ok } · 거절은 { ok:false, err: code } */
async function write(room, m){
  const sp = server();
  if(!room || !sp) return { ok: false, err: 'notInRoom' };
  const r = await sp.sendMusic(m || null, m ? model.wirePos(m, sp.serverNow()) : 0);
  return (r && r.ok) ? { ok: true } : { ok: false, err: (r && r.code) || 'error' };
}
/** 칸이 비었을 때 새 곡의 앞 차례 — 서버는 지운 뒤에도 마지막 차례를 기억해 그보다 커야 받는다 · 방 밖이면 -1. */
function lastSeq(){
  const sp = server();
  return sp ? sp.lastMusicSeq() : -1;
}
/** 서버 시각(ms) — 방 포트가 welcome · music 의 now 로 맞춘 시계 · 방 밖이면 기기 시계 */
function now(){
  const sp = server();
  return sp ? sp.serverNow() : Date.now();
}

return { subscribe, write, now, lastSeq };
}

window.TwListenProvider = { createListenProvider };

})();
