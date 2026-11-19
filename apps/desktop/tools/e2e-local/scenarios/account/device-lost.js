// PC 연결이 끊긴 뒤 안내 — ① 다른 PC 가 이 기기를 지움(«다른 PC에서 이 기기를 지웠어요» → [이 PC 다시 등록])
//                         ② 이 PC 에서 새 세션이 이 창을 밀어냄(«이 PC의 다른 창에서 쓰는 중이에요» → [여기서 계속 쓰기])
// 상대 PC · 새 세션은 API 로 흉내 낸다(같은 서버 등록 길 — 서버가 realtime 에 닫으라고 알린다). 판정: 안내 화면 글 · 단추 뒤 화면 닫힘 · 서버 목록
'use strict';
const K = require('./_kit.js');

K.scenario('device-lost', async (t) => {
  const pc = await t.app('pc');
  const acct = await t.step('가입(이 PC 가 첫 기기)', () => K.signupUi(t, pc));
  const me = await pc.w.evaluate(() => localStorage.getItem('tw.deviceId'));
  const ov = '#deviceSessionOverlay';
  const list = async () => ((await acct.api('GET', '/v2/me/devices')).data.devices || []).map((d) => d.deviceId);
  const regs = () => pc.A.reqs.filter((r) => /^POST \/v2\/me\/devices/.test(r)).length;
  // realtime 이 붙은 뒤여야 서버가 닫을 연결이 있다
  await t.step('realtime 연결', () => K.waitFor(() => pc.w.evaluate(() => window.TwRtHub && window.TwRtHub.store.state && /ready|open|online/i.test(String(window.TwRtHub.store.state()))), 30000, 'realtime ready'));

  await t.step('다른 PC 를 상한까지 등록 → 다 찬 뒤 새 PC 가 이 PC 를 지우고 들어옴', async () => {
    for(let i = 0; ; i++){
      if(i > 20) throw new Error('20대를 넘게 등록해도 409 가 오지 않음');
      const id = 'e2e-' + i + '-' + K.uniq();
      const r = await acct.api('POST', '/v2/me/devices', { deviceId: id, session: 's-' + id, os: 'windows' }, id);
      if(r.status === 200){ await t.wait(1100); continue; }
      if(r.status !== 409 || !r.body || r.body.code !== 'USER_DEVICE_LIMIT') throw new Error(id + ' 등록 ' + r.status + ' ' + JSON.stringify(r.body));
      const again = await acct.api('POST', '/v2/me/devices', { deviceId: id, session: 's-' + id, os: 'windows', replaceOldest: me }, id);
      if(again.status !== 200 || again.data.removed !== me) throw new Error('이 PC 를 못 지움 ' + JSON.stringify(again.body));
      break;
    }
  });
  await t.step('① 안내 «다른 PC에서 이 기기를 지웠어요» · [이 PC 다시 등록]', async () => {
    await K.waitShown(pc.w, ov, 30000);
    if((await K.text(pc.w, '#deviceSessionTitle')) !== '다른 PC에서 이 기기를 지웠어요') throw new Error('제목: ' + await K.text(pc.w, '#deviceSessionTitle'));
    if((await K.text(pc.w, '#deviceSessionContinue')) !== '이 PC 다시 등록') throw new Error('단추 글');
  });
  await t.step('[이 PC 다시 등록] → 상한이 찼으니 확인창 → [지우고 사용] → 안내 닫힘 · 서버 목록에 이 PC', async () => {
    await pc.w.click('#deviceSessionContinue');
    await K.waitFor(() => pc.w.evaluate(() => !!document.querySelector('[role="alertdialog"]')), 15000, '확인창');
    await pc.w.click('[role="alertdialog"] button[data-a="ok"]');
    await K.waitFor(async () => !(await K.shown(pc.w, ov)), 20000, '안내 닫힘');
    if(!(await list()).includes(me)) throw new Error('다시 등록 안 됨');
  });

  await t.step('② 같은 기기 id · 새 세션으로 등록(이 PC 에서 앱을 새로 연 것과 같음)', async () => {
    const n = regs();
    await K.waitFor(() => pc.w.evaluate(() => /ready|open|online/i.test(String(window.TwRtHub.store.state()))), 30000, 'realtime 다시 붙음');
    const r = await acct.api('POST', '/v2/me/devices', { deviceId: me, session: 'e2e-other-window-' + K.uniq(), os: 'mac' }, me);
    if(r.status !== 200) throw new Error(JSON.stringify(r.body));
    t.note('앞선 등록 요청 ' + n);
  });
  await t.step('② 안내 «이 PC의 다른 창에서 쓰는 중이에요» · [여기서 계속 쓰기] → 닫힘', async () => {
    await K.waitShown(pc.w, ov, 30000);
    if((await K.text(pc.w, '#deviceSessionTitle')) !== '이 PC의 다른 창에서 쓰는 중이에요') throw new Error('제목: ' + await K.text(pc.w, '#deviceSessionTitle'));
    if((await K.text(pc.w, '#deviceSessionContinue')) !== '여기서 계속 쓰기') throw new Error('단추 글');
    const n = regs();
    await pc.w.click('#deviceSessionContinue');
    await K.waitFor(async () => !(await K.shown(pc.w, ov)), 20000, '안내 닫힘');
    if(regs() <= n) throw new Error('다시 등록 요청이 없음');
  });
});
