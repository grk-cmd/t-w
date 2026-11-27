// 앱 켜기 순서 · 오프라인 → 온라인 다시 잇기
// 켜기: 가입 뒤 다시 켠 앱이 시험이 부르기 전에 스스로 계정 확인(/v2/me 200)을 보내고(_kit newUser 가 요청 기록으로 본다), realtime ready · 로그인된 런처 · 화면 오류(pageerror) 없음.
//   /v2/me 와 realtime 의 앞뒤 순서는 보지 않는다(웹소켓은 요청 기록에 안 남는다).
// 다시 잇기: 크로미움 오프라인 흉내는 열린 localhost 웹소켓을 끊지 않아서(README «함정») realtime 컨테이너도 같이 멈춘다(스택 잠금 안).
//   앱이 keepalive 로 끊김을 알아채 다시 붙기를 기다리는 동안 → 풀고 온라인 + 창 'online' 이벤트 → 백오프를 건너뛰고 곧바로 ready 인지 본다.
'use strict';
const { run } = require('./_kit.js');
const { watchRealtime } = require('./_rt.js');

run('boot-offline-online', async (t) => {
  const A = await t.newUser('a');
  await t.step('켜기 — 앱이 스스로 /v2/me 200 · realtime ready · 런처 · 화면 오류 없음', async () => {
    t.check(A.bootMeByApp === true, '다시 켠 앱이 스스로 /v2/me 를 보내지 않음');
    await t.poll(() => A.w.evaluate(() => TwRtHub.store.state() === 'ready'), 20000, 'realtime ready');
    t.check(await t.shown(A, '#launcher'), '런처가 안 보임');
    t.check(!(await t.shown(A, '#inviteGateInput')), '로그인된 채 켰는데 초대 화면이 보임');
    const errs = A.logs.filter((l) => l.startsWith('[pageerror]'));
    t.check(!errs.length, '화면 오류: ' + (errs[0] || ''));
  });
  await watchRealtime(A.w);
  await t.withStackLock(async () => {
    try {
      await t.step('오프라인(크로미움 흉내 + realtime 멈춤) → 끊김을 알아챔', async () => {
        A.reqs.push('--- offline ---');
        await A.net(true);
        t.pauseRt();
        await t.poll(() => A.w.evaluate(() => TwRtHub.store.state() === 'retrying'), 45000, 'retrying');
        const r = await A.w.evaluate(async (h) => { try { await fetch(`https://${h}/v2/config`); return 'ok'; } catch(e){ return 'fail'; } }, t.API_HOST);
        t.check(r === 'fail', '오프라인인데 API 요청이 통함');
      });
      await t.step('다시 붙기 백오프가 길어질 때까지 둔다(25초)', async () => {
        await t.wait(25000);
        t.check(await A.w.evaluate(() => TwRtHub.store.state() === 'retrying'), '오프라인인데 retrying 이 아님');
        await t.shot(A, '01-offline');
      });
      await t.step('온라인 + online 이벤트 → 백오프를 건너뛰고 5초 안에 ready', async () => {
        t.unpauseRt();
        A.reqs.push('--- online ---');
        await A.net(false);
        const t1 = Date.now();
        await A.w.evaluate(() => window.dispatchEvent(new Event('online')));
        await t.poll(() => A.w.evaluate(() => TwRtHub.store.state() === 'ready'), 5000, 'online 뒤 ready');
        t.note(`online 이벤트 뒤 ${Date.now() - t1}ms 에 ready`);
        const r = await t.api(A, 'GET', '/v2/me');
        t.check(r.status === 200, '온라인 뒤 /v2/me ' + r.status);
        await t.shot(A, '02-online');
      });
    } finally {
      t.unpauseRt();
    }
  });
});
