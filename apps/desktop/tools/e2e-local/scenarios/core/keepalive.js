// keepalive — realtime 서버가 TCP 닫힘 없이 멈추면(컨테이너 pause) 앱이 조용함(15초) 뒤 ping 을 보내고, pong 을 5초 못 받으면 끊고
// 다시 붙기로 넘어가는지 · 15초 넘게 못 붙으면 런처에 «다시 연결하는 중» 띠가 뜨는지 · 풀면 다시 ready 가 되고 띠가 사라지는지 본다.
// 공유 realtime 컨테이너를 멈추므로 스택 잠금 안에서만 하고, 끝나면(실패해도) 풀어 둔다.
'use strict';
const { run } = require('./_kit.js');
const { watchRealtime } = require('./_rt.js');

run('keepalive', async (t) => {
  const A = await t.newUser('a');
  await t.step('realtime ready', () => t.poll(() => A.w.evaluate(() => TwRtHub.store.state() === 'ready'), 20000, 'ready'));
  await watchRealtime(A.w);
  await t.withStackLock(async () => {
    try {
      const t0 = await t.step('realtime 컨테이너 멈춤(pause)', async () => { t.pauseRt(); return Date.now(); });
      await t.step('조용함 15초 → ping → 5초 뒤 끊음', async () => {
        const r = await t.poll(() => A.w.evaluate(() => {
          const s = window.__e2eRt;
          const drop = s.states.find((x) => x.s !== 'ready');
          return drop && { drop, pings: s.sent.filter((m) => m.t === 'ping'), states: s.states };
        }), 45000, 'ready 를 벗어남');
        // 끊기 직전 마지막 ping — 멈추기 전 평소 keepalive ping 을 고르면 간격이 커져 거짓 실패
        const ping = r.pings.filter((p) => p.at <= r.drop.at).pop();
        t.check(ping, 'ping 을 보내지 않고 끊김');
        const gap = r.drop.at - ping.at;
        t.note(`멈춤 뒤 ${Math.round((r.drop.at - t0) / 1000)}s 에 끊김 · ping → 끊김 ${gap}ms · 상태 ${r.states.map((x) => x.s).join('→')}`);
        // pong 기다림 5초(PONG_WAIT_MS) — 타이머 오차만큼 여유
        t.check(gap >= 4500 && gap <= 7000, `ping 뒤 끊기까지 ${gap}ms — 5초가 아님`);
        // 멈춘 순간부터 조용함 15초 + pong 5초 안(마지막으로 받은 메시지가 멈추기 전이라 더 짧을 수 있다)
        t.check(r.drop.at - t0 <= 22000, `멈춘 뒤 ${r.drop.at - t0}ms 에야 끊음 — 20초 상한을 넘음`);
      });
      await t.step('15초 넘게 못 붙으면 런처에 «다시 연결하는 중» 띠', async () => {
        await t.poll(() => t.shown(A, '#rtBand'), 30000, '#rtBand 보임');
        const txt = await A.w.textContent('#rtBand');
        t.check(/다시 연결하는 중/.test(txt), '띠 글자: ' + txt);
        t.check(await A.w.evaluate(() => TwRtHub.store.state() === 'retrying'), '상태가 retrying 이 아님');
        await t.shot(A, '01-band');
      });
      await t.step('컨테이너 풀기(unpause) → 다시 ready · 띠 사라짐', async () => {
        t.unpauseRt();
        const t1 = Date.now();
        // 백오프 상한 15초 ±50% + 연결 대기
        await t.poll(() => A.w.evaluate(() => TwRtHub.store.state() === 'ready'), 40000, '다시 ready');
        t.note(`풀고 ${Math.round((Date.now() - t1) / 1000)}s 에 다시 ready`);
        await t.poll(async () => !(await t.shown(A, '#rtBand')), 5000, '#rtBand 사라짐');
      });
    } finally {
      t.unpauseRt();
    }
  });
  await t.step('다시 붙은 연결로 요청이 오간다(presenceGet 답)', async () => {
    const r = await A.w.evaluate(() => TwRtHub.store.request({ t: 'presenceGet', ids: [TwRtHub.store.userCode()] }));
    t.check(r && r.t === 'presence', '답이 없음: ' + JSON.stringify(r));
  });
});
