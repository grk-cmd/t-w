// realtime 연결을 앱 창 안에서 지켜보는 기록기 — 상태 바뀜(시각)과 앱이 보낸 메시지 종류(시각)를 window.__e2eRt 에 쌓는다
'use strict';

async function watchRealtime(w){
  await w.evaluate(() => {
    if(window.__e2eRt) return;
    const s = window.__e2eRt = { states: [], sent: [] };
    TwRtHub.store.onState((st) => s.states.push({ s: st, at: Date.now() }));
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function(d){
      try { const m = JSON.parse(String(d)); s.sent.push({ t: m.t, at: Date.now() }); } catch(_){}
      return send.call(this, d);
    };
  });
}

module.exports = { watchRealtime };
