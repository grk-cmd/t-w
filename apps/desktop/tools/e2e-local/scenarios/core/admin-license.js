// 라이선스 발급 · 시크릿룸 발급 · 초대권 주기(관리자 런처)
// A(관리자)가 B 의 친구 코드로 라이선스를 보내면 B 수령함에 키가 오고, B 가 그 키를 등록하면 프리미엄이 된다.
// A 가 새 키를 만들면 발급 목록에 뜬다. A 가 B 에게 시크릿룸을 주면 서버에 B 몫 SCRT- 코드가 생긴다. A 가 B 에게 초대권 2장을 주면 B 런처 초대장 수가 2 늘어난다.
'use strict';
const { run } = require('./_kit.js');

run('admin-license', async (t) => {
  const A = await t.newUser('admin');
  const B = await t.newUser('user');
  await t.step('A 관리자 모드', async () => { await t.makeAdmin(A); await t.enterAdmin(A); });
  const msg = async (sel) => (await A.w.textContent(sel)).trim();

  await t.step('A 초대권 2장 → B 런처 초대장 수 +2', async () => {
    const before = Number(((await B.w.textContent('#lcInviteIssueBtn')).match(/\((\d+)\)/) || [])[1]);
    t.check(Number.isFinite(before), 'B 초대장 수를 못 읽음');
    await A.w.click('#lcInviteGrant');
    await A.w.fill('#inviteGrantCode', B.fc);
    await A.w.click('#inviteGrantPlus');
    t.check((await msg('#inviteGrantCount')) === '2', '장 수가 2 가 아님');
    await A.w.click('#inviteGrantOk');
    await t.poll(async () => /지급/.test(await A.w.textContent('#toast')) || /지급/.test(await msg('#inviteGrantMsg')), 8000, '지급 알림');
    t.check(new RegExp(`초대권 2장 지급 완료 \\(현재 ${before + 2}장\\)`).test(await A.w.textContent('#toast')), 'A 알림: ' + (await A.w.textContent('#toast')));
    const r = await t.api(B, 'GET', '/v2/me/invites');
    t.check(r.body.data.invitesLeft === before + 2, 'B 서버 남은 장 수 ' + r.body.data.invitesLeft);
    // 런처 초대장 수는 켤 때 · 내가 발급할 때만 다시 읽는다(서버 알림 종류가 없다) — 다시 켜서 본다
    await t.relaunch(B);
    await t.waitLoggedIn(B);
    await t.poll(async () => Number(((await B.w.textContent('#lcInviteIssueBtn')).match(/\((\d+)\)/) || [])[1]) === before + 2, 15000, `B 초대장 ${before} → ${before + 2}`);
  });

  let key = '';
  await t.step('A 친구 코드로 라이선스 보내기 → B 수령함에 키', async () => {
    await A.w.click('#lcLicenseGen');
    await A.w.fill('#licenseGrantCode', B.fc);
    await A.w.click('#licenseGrantBtn');
    await t.poll(async () => /발급|보냈/.test(await A.w.textContent('#toast')), 8000, '발급 알림');
    t.note('A 알림: ' + (await A.w.textContent('#toast')).trim());
    const inbox = await t.poll(async () => {
      const r = await t.api(B, 'GET', '/v2/me/notifications?section=MAIL&limit=50');
      const s = JSON.stringify(r.body && r.body.data);
      const m = s && s.match(/[A-Z0-9]{4,}(?:-[A-Z0-9]{4,}){2,}/g);
      return m && m.find((x) => !x.startsWith('MATE-') && !x.startsWith('INVT-'));
    }, 15000, 'B 수령함에 키');
    key = inbox;
    t.note('키 ' + key.slice(0, 9) + '…');
  });
  await t.step('B 가 받은 키를 등록 → 서버가 프리미엄으로', async () => {
    const r = await t.api(B, 'POST', '/v2/me/license', { key, device: { id: await B.w.evaluate(() => TwDeviceId.store.get()), name: 'e2e' } });
    t.check(r.status === 200, '등록 ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
    await t.poll(async () => { const m = await t.api(B, 'GET', '/v2/me'); return m.body && m.body.data && m.body.data.premium === true; }, 10000, 'B premium true');
  });
  await t.step('A 새 키 발급 → 발급 목록에 메모와 함께', async () => {
    const note = 'e2e-' + Date.now().toString(36);
    await A.w.fill('#licenseGenNote', note);
    await A.w.click('#licenseGenBtn');
    await t.poll(async () => (await A.w.textContent('#licenseGenList')).includes(note), 10000, '목록에 새 키');
  });
  await t.step('A 시크릿룸 발급 → 서버에 B 몫 SCRT- 코드', async () => {
    await A.w.fill('#srGrantCode', B.fc);
    await A.w.fill('#srGrantMonths', '1');
    await A.w.click('#srGrantBtn');
    const m = await t.poll(async () => { const s = (await A.w.textContent('#toast')) + ' ' + (await A.w.evaluate(() => document.body.innerText)); return (s.match(/SCRT-[A-Z0-9]{4}/) || [])[0]; }, 10000, 'SCRT 코드 안내');
    t.note('시크릿룸 ' + m);
    const uc = (await t.api(B, 'GET', '/v2/me')).body.data.userCode;
    const row = t.query(`SELECT owner_user_code FROM secret_room WHERE code = '${m}'`);
    t.check(row === uc, `${m} 주인이 B(${uc})가 아님: ${row}`);
  });
});
