// 같은 PC 에서 계정 바꾸기 — A 로 쓰다가 로그아웃 → 다시 켜기 → 로그인 화면 → B 로 로그인 → 다시 켜기
// 판정: 로그아웃 안내 · 로그아웃 뒤 이 PC 에 A 사본이 없음 · B 로 들어간 뒤 내 정보 친구 코드가 B · 서버가 이 PC(같은 기기 id)를 B 에 등록
'use strict';
const K = require('./_kit.js');

K.scenario('switch-account', async (t) => {
  const pc = await t.app('pc');
  const A = await t.step('A 로 가입', () => K.signupUi(t, pc));
  const B = await t.step('B 는 API 로 만듦', () => K.apiAccount());
  t.note('A ' + A.fc + ' · B ' + B.fc);
  const devId = await pc.w.evaluate(() => localStorage.getItem('tw.deviceId'));
  t.note('이 PC 기기 id ' + devId);
  await t.step('내 정보 › 계정 — 로그아웃 확인창 → [로그아웃] → 다시 켜기 → 로그인 화면', async () => {
    await K.openMyInfo(pc, 'acct');
    if((await K.text(pc.w, '#miCode')) !== A.fc) throw new Error('내 정보 친구 코드가 A 가 아님');
    await pc.w.click('#acctLogoutBtn');
    await K.waitShown(pc.w, '#acctLogoutConfirm');
    await pc.relaunchAfter(() => pc.w.click('#acctLogoutYes'));
    await K.waitShown(pc.w, '#inviteGateFc', 30000);
    const left = await pc.w.evaluate(() => ({ me: localStorage.getItem('tw.me'), fc: localStorage.getItem('tw.myFriendCode') }));
    if(left.me) throw new Error('A 의 계정 사본이 남음');
  });
  await t.step('B 로 로그인 → 다시 켜기 → B 로 들어감', async () => {
    await K.loginUi(pc, B.fc);
    await K.openMyInfo(pc);
    await K.waitFor(async () => (await K.text(pc.w, '#miCode')) === B.fc, 15000, '내 정보 친구 코드 B');
  });
  await t.step('서버 — 같은 기기 id 가 B 에 등록 · A 에서는 빠짐', async () => {
    if(!devId) throw new Error('기기 id 를 못 읽음');
    const nowId = await pc.w.evaluate(() => localStorage.getItem('tw.deviceId'));
    if(nowId !== devId) throw new Error('계정을 바꾸며 기기 id 가 바뀜 ' + nowId);
    const b = await B.api('GET', '/v2/me/devices', undefined, devId);
    if(!(b.data && b.data.devices || []).some((d) => d.deviceId === devId)) throw new Error('B 기기 목록에 이 PC 없음 ' + JSON.stringify(b.body).slice(0, 200));
    const a = await A.api('GET', '/v2/me/devices', undefined, devId);
    const mine = (a.data && a.data.devices || []).find((d) => d.deviceId === devId);
    if(mine) throw new Error('로그아웃했는데 A 기기 목록에 이 PC 가 남음 ' + JSON.stringify(mine));
  });
});
