/* room-invite-rt.js — 🙋 방 초대 포트(realtime 연결 하나 · 서버 통신 규약 4-3) (검사 sim-room-invite-rt.js)
   [책임] 초대 보내기 roomInvite{ to } · 받기 roomInvited{ from, fromName, room, ts } · 지우기 roomInviteClear{ from }.
     방 코드 · 보낸 이름은 서버가 지금 방 · 멤버 이름으로 채운다(앱이 싣지 않는다) · 친구가 아니면 ROOM_INVITE_NOT_FRIEND · 한 쌍에 하나 · 10분 보관.
     받은 초대는 보낸 사람(userCode)마다 하나로 들고 있다가 바뀔 때마다 { 보낸 사람: { fromName, roomCode, ts } } 로 알린다(화면이 읽던 모양).
   [서버 답] 보내기는 성공 답이 없다 — 오류(ref roomInvite)가 SEND_ERR_WAIT_MS 안에 안 오면 보낸 것으로 본다. 보내기는 한 번에 하나씩 기다린다(오류에 누구 것인지 칸이 없다).
   classic script(window.TwRoomInviteRt) — rt-hub.js 다음 · app.js 보다 먼저. 앱 한 벌은 TwRoomInviteRt.store. */
(function(){
'use strict';

const SEND_ERR_WAIT_MS = 1500;

/** @param {{ hub: { onMessage: Function, send: Function }, setTimeout?: Function, clearTimeout?: Function }} deps */
function createRoomInviteRt(deps){
  const hub = deps.hub;
  const tSet = deps.setTimeout || ((f, ms) => setTimeout(f, ms));
  const tClear = deps.clearTimeout || ((h) => clearTimeout(h));
  const invites = {};          // from → { fromName, roomCode, ts }
  const fns = [];
  let sending = null;          // 지금 오류를 기다리는 보내기
  const queue = [];

  const snapshot = () => Object.assign({}, invites);
  const emit = () => { const v = snapshot(); for(const fn of fns.slice()){ try{ fn(v); }catch(_){} } };

  hub.onMessage('roomInvited', (m) => {
    if(!m || typeof m.from !== 'string' || typeof m.room !== 'string') return;
    invites[m.from] = { fromName: (typeof m.fromName === 'string' && m.fromName) ? m.fromName : '친구', roomCode: m.room, ts: Number(m.ts) || 0 };
    emit();
  });
  hub.onMessage('error', (m) => {
    if(!m || m.ref !== 'roomInvite' || !sending) return;
    sending.done({ ok: false, code: m.code });
  });

  function next(){
    if(sending || !queue.length) return;
    const job = queue.shift();
    sending = job;
    job.done = (r) => { tClear(job.timer); sending = null; job.res(r); next(); };
    if(!hub.send({ t: 'roomInvite', to: job.to })){ job.done({ ok: false, code: 'notReady' }); return; }
    job.timer = tSet(() => job.done({ ok: true }), SEND_ERR_WAIT_MS);
  }
  /** 초대 보내기 — 받는 사람 userCode. { ok } | { ok:false, code }(ROOM_INVITE_NOT_FRIEND · notInRoom · unavailable · notReady) */
  function send(to){
    if(typeof to !== 'string' || !to) return Promise.resolve({ ok: false, code: 'badRequest' });
    return new Promise((res) => { queue.push({ to, res, done: null, timer: null }); next(); });
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
  return { send, clear, onInvites };
}

const api = { SEND_ERR_WAIT_MS, createRoomInviteRt };
if(typeof window !== 'undefined'){
  api.store = createRoomInviteRt({ hub: window.TwRtHub.store });
  window.TwRoomInviteRt = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
