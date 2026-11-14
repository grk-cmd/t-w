/* room-invite-rt.js — 🙋 방 초대 포트(realtime 연결 하나 · 서버 통신 규약 4-3) (검사 sim-room-invite-rt.js)
   [책임] 초대 보내기 roomInvite{ to } · 받기 roomInvited{ from, fromName, room, ts } · 지우기 roomInviteClear{ from }.
     방 코드 · 보낸 이름은 서버가 지금 방 · 멤버 이름으로 채운다(앱이 싣지 않는다) · 친구가 아니면 ROOM_INVITE_NOT_FRIEND · 한 쌍에 하나 · 10분 보관.
     받은 초대는 보낸 사람(userCode)마다 하나로 들고 있다가 바뀔 때마다 { 보낸 사람: { fromName, roomCode, ts } } 로 알린다(화면이 읽던 모양).
   [서버 답] 보내기는 rid 요청 — 성공은 roomInviteSent{ to, rid } · 실패는 error{ code, ref:'roomInvite', rid }. 답이 안 오면 실패(timeout)다(조용하다고 보낸 것으로 보지 않는다).
   classic script(window.TwRoomInviteRt) — rt-hub.js 다음 · app.js 보다 먼저. 앱 한 벌은 TwRoomInviteRt.store. */
(function(){
'use strict';

/** @param {{ hub: { onMessage: Function, send: Function, request: Function, isReady: Function } }} deps */
function createRoomInviteRt(deps){
  const hub = deps.hub;
  const invites = {};          // from → { fromName, roomCode, ts }
  const fns = [];

  const snapshot = () => Object.assign({}, invites);
  const emit = () => { const v = snapshot(); for(const fn of fns.slice()){ try{ fn(v); }catch(_){} } };

  hub.onMessage('roomInvited', (m) => {
    if(!m || typeof m.from !== 'string' || typeof m.room !== 'string') return;
    invites[m.from] = { fromName: (typeof m.fromName === 'string' && m.fromName) ? m.fromName : '친구', roomCode: m.room, ts: Number(m.ts) || 0 };
    emit();
  });
  /** 초대 보내기 — 받는 사람 userCode. 서버가 들어간 것을 확인하면(roomInviteSent) { ok } · 거절 { ok:false, code }(ROOM_INVITE_NOT_FRIEND · notInRoom · unavailable · badRequest) ·
   *  답이 안 오면 { ok:false, code:'timeout' | 'notReady' } — 조용하다고 보낸 것으로 보지 않는다. 요청은 rid 로 짝짓는다(hub.request) — 여럿을 동시에 보내도 답이 섞이지 않는다. */
  async function send(to){
    if(typeof to !== 'string' || !to) return { ok: false, code: 'badRequest' };
    const r = await hub.request({ t: 'roomInvite', to });
    if(r && r.t === 'roomInviteSent') return { ok: true };
    if(r && r.t === 'error') return { ok: false, code: r.code };
    return { ok: false, code: !hub.isReady() ? 'notReady' : 'timeout' };
  }
  /** 받은 초대 지우기(수락 · 거절 · 3분 자동 거절 · 오래된 것) */
  function clear(from){
    if(invites[from]){ delete invites[from]; emit(); }
    hub.send({ t: 'roomInviteClear', from: String(from || '') });
  }
  /** 받은 초대 듣기 — 지금 것을 바로 한 번 · 끊는 함수 */
  function onInvites(fn){
    fns.push(fn);
    try{ fn(snapshot()); }catch(_){}
    return () => { const i = fns.indexOf(fn); if(i >= 0) fns.splice(i, 1); };
  }
  /* 계정이 바뀜(session.onReset) — 앞 계정의 받은 초대를 비운다. 듣는 쪽은 부르는 쪽이 끊는다. */
  function reset(){ for(const k of Object.keys(invites)) delete invites[k]; }
  return { send, clear, onInvites, reset };
}

const api = { createRoomInviteRt };
if(typeof window !== 'undefined'){
  api.store = createRoomInviteRt({ hub: window.TwRtHub.store });
  window.TwRoomInviteRt = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
