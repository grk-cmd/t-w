/* sim-room-invite-rt.js — 🙋 방 초대 포트(room/room-invite-rt.js) 검사 — 가짜 연결로 그대로 돌린다
   ・1절: 보내기 — roomInvite{ to }(방 코드 · 이름은 싣지 않는다) · 오류가 안 오면 ok · ROOM_INVITE_NOT_FRIEND · 한 번에 하나씩 · 연결 없음
   ・2절: 받기 — roomInvited → { 보낸 사람: { fromName, roomCode, ts } } · 같은 사람은 하나 · 듣자마자 지금 것 · 지우기(roomInviteClear)
   ・3절: 배선 · 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const SRC0 = {
  IR: pick(['room-invite-rt.js', 'parts/room/room-invite-rt.js', 'app/parts/room/room-invite-rt.js']),
  UI: pick(['room-invite-ui.js', 'parts/room/room-invite-ui.js', 'app/parts/room/room-invite-ui.js']),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
const tick = async () => { for(let i = 0; i < 10; i++) await Promise.resolve(); };
function mk(S, o){
  const fns = {}, sent = [], timers = [];
  const hub = { onMessage(t, fn){ (fns[t] = fns[t] || []).push(fn); }, send(m){ if(o && o.offline) return false; sent.push(m); return true; } };
  const I = load(S.IR).createRoomInviteRt({ hub, setTimeout: (f) => { const h = { f }; timers.push(h); return h; }, clearTimeout: (h) => { const i = timers.indexOf(h); if(i >= 0) timers.splice(i, 1); } });
  return { I, sent, timers, emit: (m) => (fns[m.t] || []).forEach((f) => f(m)), fire: () => { const t = timers.shift(); if(t) t.f(); } };
}
async function judge(S){
  say('── 1. 보내기');
  let e = mk(S);
  const p1 = e.I.send('u2'), p2 = e.I.send('u3');
  chk(e.sent.length === 1 && JSON.stringify(e.sent[0]) === '{"t":"roomInvite","to":"u2"}', 'roomInvite{ to } — 방 코드 · 이름은 싣지 않는다(서버가 채운다) · 한 번에 하나');
  e.fire(); await tick();
  chk(e.sent.length === 2 && e.sent[1].to === 'u3', '  오류가 안 오면 다음 것을 보낸다');
  e.emit({ t: 'error', code: 'ROOM_INVITE_NOT_FRIEND', ref: 'roomInvite' });
  const r1 = await p1, r2 = await p2;
  chk(r1.ok === true && r2.ok === false && r2.code === 'ROOM_INVITE_NOT_FRIEND', '  첫째는 ok · 둘째는 서버 거절 code');
  e = mk(S, { offline: true });
  chk((await e.I.send('u2')).code === 'notReady', '  연결이 없으면 notReady');
  chk((await mk(S).I.send('')).ok === false, '  받는 사람이 없으면 보내지 않는다');
  say('── 2. 받기');
  e = mk(S);
  const seen = [];
  e.emit({ t: 'roomInvited', from: 'u5', fromName: '도토리', room: 'PLAY-AB12', ts: 9 });
  e.I.onInvites((v) => seen.push(JSON.stringify(v)));
  chk(seen[0] === '{"u5":{"fromName":"도토리","roomCode":"PLAY-AB12","ts":9}}', '듣자마자 지금 것 { 보낸 사람: { fromName, roomCode, ts } }');
  e.emit({ t: 'roomInvited', from: 'u5', fromName: '도토리', room: 'PLAY-CD34', ts: 10 });
  chk(seen.length === 2 && JSON.parse(seen[1]).u5.roomCode === 'PLAY-CD34' && Object.keys(JSON.parse(seen[1])).length === 1, '  같은 사람은 하나(나중 것)');
  e.I.clear('u5');
  chk(seen[2] === '{}' && e.sent[0] && e.sent[0].t === 'roomInviteClear' && e.sent[0].from === 'u5', '지우기 — roomInviteClear{ from } · 목록에서 빠진다');
  say('── 3. 배선');
  const h = S.HTML, at = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
  chk(at('room/room-invite-rt.js') > at('realtime/rt-hub.js') && at('app.js') > at('room/room-invite-rt.js'), 'html — rt-hub → room-invite-rt → app.js');
  chk(/await invites\.send\(fid\)/.test(S.UI) && /invites\.onInvites\(/.test(S.UI) && !/firebaseAPI\.(?:sendRoomInvite|subscribeRoomInvites|clearRoomInvite)/.test(S.UI) && !/roomInvites\//.test(S.FI), '초대 화면은 이 포트만 · firebase-init 에 roomInvites 길이 없다');
}
(async () => {
  await judge(SRC0);
  say('── 4. 깨 보기');
  const BREAKS = [
    ['IR', "    job.timer = tSet(() => job.done({ ok: true }), SEND_ERR_WAIT_MS);", "    job.done({ ok: true });", '오류를 안 기다림'],
    ['IR', "    if(invites[from]){ delete invites[from]; emit(); }\n", "", '지워도 목록에 남음'],
    ['IR', "    invites[m.from] = {", "    invites[m.from + Math.random()] = {", '같은 사람이 여럿'],
  ];
  const missed = [];
  for(const [w, a, b, what] of BREAKS){
    if(SRC0[w].indexOf(a) < 0){ missed.push('못 찾음 ' + what); continue; }
    const S = Object.assign({}, SRC0); S[w] = S[w].split(a).join(b);
    quiet = true; qfail = 0; try{ await judge(S); }catch(_){ qfail++; } quiet = false;
    if(!qfail) missed.push(what);
  }
  chk(!missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — ' + missed.join(' · ') : ''));
  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
