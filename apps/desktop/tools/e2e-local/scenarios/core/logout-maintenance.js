// 로그아웃 · 서버 점검 켜고 끄기
// 점검: 관리자 A 가 서버 설정 app.maintenance 를 켜면(PUT /v2/admin/config) B 가 서버 설정 알림으로 받아(앱마다 0~60초 흩어짐)
//   서버를 쓰는 단추를 누를 때 «서버 점검 중» 창이 뜬다(B 를 다시 켜서 켤 때 읽게 한다 — 알림을 기다리지 않게).
//   끄면 B 는 서버 설정 알림(config)을 받아 «점검이 끝났어요 · 지금 다시 켜기» 를 묻는다(이번 실행에 점검을 봤으니).
//   모두가 받는 설정이라 스택 잠금 안에서 켜고, 끝에(실패해도) 끈다.
// 로그아웃: 내 정보 › 계정 › 로그아웃 → 확인 → 앱이 다시 켜지고 초대 · 로그인 화면이 나온다 · 서버 세션(realtime)이 끝난다.
'use strict';
const { run } = require('./_kit.js');

const KEY = '/v2/admin/config/app.maintenance';

async function setMaintenance(t, A, on){
  const list = await t.api(A, 'GET', '/v2/admin/config');
  const row = (list.body.data || []).find((x) => x.key === 'app.maintenance');
  t.check(row, '설정 목록에 app.maintenance 가 없음');
  const value = on ? { on: true, endsAt: null, message: 'e2e 점검 시험' } : { on: false, endsAt: null, message: null };
  const r = await t.api(A, 'PUT', KEY, { version: row.version, value });
  t.check(r.status === 200, 'app.maintenance 쓰기 ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
}
const gateShown = (t, B) => t.shown(B, '#maintGateOverlay');

run('logout-maintenance', async (t) => {
  const A = await t.newUser('admin');
  const B = await t.newUser('user');
  await t.step('A 서버 관리자', () => t.makeAdmin(A));
  await t.withStackLock(async () => {
    try {
      await t.step('점검 켬 → B 가 서버 설정으로 받음(/v2/config maintenance.on)', async () => {
        await setMaintenance(t, A, true);
        // 서버 설정 읽기는 잠깐 캐시될 수 있다 — 15초 안에 실리는지
        let last;
        await t.poll(async () => { const r = await t.api(B, 'GET', '/v2/config'); last = r.body && r.body.data && r.body.data.maintenance; return last && last.on === true; }, 15000, '/v2/config 에 점검이 실림')
          .catch((e) => { throw new Error(e.message + ' — 마지막 값 ' + JSON.stringify(last)); });
      });
      await t.step('B 다시 켜면(켤 때 /v2/config) 서버를 쓰는 단추(내 정보) → «서버 점검 중» 창', async () => {
        await t.relaunch(B);
        await t.waitLoggedIn(B);
        await t.poll(() => B.w.evaluate(() => window.TwMaintenance.store.on()), 15000, '앱이 점검을 앎');
        await t.poll(async () => {
          await B.w.click('#lcLoad').catch(() => {});
          await t.wait(1000);
          return gateShown(t, B);
        }, 20000, '점검 창', 2000);
        const txt = await B.w.textContent('#maintGateOverlay');
        t.check(/서버 점검 중/.test(txt) && /e2e 점검 시험/.test(txt), '점검 창 글자: ' + txt.replace(/\s+/g, ' ').slice(0, 80));
        await t.shot(B, '01-maintenance');
        await B.w.locator('#maintGateOverlay button', { hasText: '확인' }).click();
        await t.poll(async () => !(await gateShown(t, B)), 3000, '점검 창 닫힘');
      });
      await t.step('점검 끔 → B 가 «다시 켜기» 를 묻는다', async () => {
        await setMaintenance(t, A, false);
        await t.poll(async () => (await gateShown(t, B)) && /점검이 끝났어요/.test(await B.w.textContent('#maintGateOverlay')), 90000, '«점검이 끝났어요» 안내');
        t.check(/지금 다시 켜기/.test(await B.w.textContent('#maintGateOverlay')), '«지금 다시 켜기» 단추가 없음');
        await t.shot(B, '02-maintenance-off');
      });
    } finally {
      // 점검이 켜진 채 남으면 같은 스택을 쓰는 모든 시험이 막힌다 — 앱 없는 관리자로 끄고, 못 끄면 «FAIL 정리»
      const ADM = await t.headlessAdmin();
      await t.cleanup('점검(app.maintenance) 끔', async () => {
        const list = await ADM.call('GET', '/v2/admin/config');
        if(list.status !== 200) return list;
        const row = (list.body.data || []).find((x) => x.key === 'app.maintenance');
        if(!row) throw new Error('설정 목록에 app.maintenance 가 없음');
        if(!(row.value && row.value.on)) return null;
        return ADM.call('PUT', KEY, { version: row.version, value: { on: false, endsAt: null, message: null } });
      });
    }
  });
  await t.step('B 로그아웃 → 다시 켜기 → 초대 · 로그인 화면', async () => {
    await t.relaunch(B);
    await t.waitLoggedIn(B);
    await B.w.click('#lcLoad');
    await B.w.locator('#miTabAcct').waitFor({ state: 'visible', timeout: 10000 });
    await B.w.click('#miTabAcct');
    await B.w.click('#acctLogoutBtn');
    await B.app.evaluate(({ app: a }) => { a.relaunch = () => {}; });
    const closed = new Promise((r) => B.app.once('close', r));
    await B.w.click('#acctLogoutYes');
    await Promise.race([closed, t.wait(30000).then(() => { throw new Error('30초 안에 꺼지지 않음'); })]);
    B.logs.push('--- relaunch ---');
    await t.relaunchFresh(B);
    await B.w.locator('#inviteGateInput').waitFor({ state: 'visible', timeout: 30000 });
    // 런처는 뒤에 그려진 채 초대 · 로그인 창이 덮는다 — 런처 이름 단추 자리에 맨 위로 있는 것이 그 단추가 아닌가
    const onTop = await B.w.evaluate(() => {
      const b = document.getElementById('lcNameBtn'); if(!b) return false;
      const r = b.getBoundingClientRect(); if(!r.width) return false;
      const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!e && b.contains(e);
    });
    t.check(!onTop, '로그아웃했는데 런처를 누를 수 있음');
    t.check(!(await B.w.evaluate(() => window.firebaseAPI.getIdToken().catch(() => null))), '로그아웃 뒤에도 토큰이 있음');
  });
  await t.step('B 친구 코드 · 비밀번호로 다시 로그인 → 같은 계정', async () => {
    await B.w.fill('#inviteGateFc', B.fc);
    await B.w.fill('#inviteGatePw', t.PW);
    await B.app.evaluate(({ app: a }) => { a.relaunch = () => {}; });
    const closed = new Promise((r) => B.app.once('close', r));
    await B.w.click('#inviteGateFcBtn');
    // 로그인한 계정이 이 실행에서 처음 정해지면 앱을 다시 켠다 — 꺼지면 다시 켜고, 안 꺼지면 그대로 본다
    const off = await Promise.race([closed.then(() => true), t.wait(15000).then(() => false)]);
    if(off){ B.logs.push('--- relaunch ---'); await t.relaunchFresh(B); }
    const me = await t.waitLoggedIn(B);
    t.check(me.friendCode === B.fc, `다른 계정으로 들어감: ${me.friendCode} ≠ ${B.fc}`);
  });
});
