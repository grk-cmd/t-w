// 라이선스 · 프리미엄 등록 — 설정 › 라이선스: 없는 키 거절 · 관리자가 낸 키 등록 → 이 기기 등록 · 프리미엄 → 이 기기에서 해제
// 키는 관리자 계정(seed/admin.sql)이 API 로 발급한다. 판정은 화면 칸 · 서버 GET /v2/me 의 premium(이 기기 머리 X-Device-Id)
'use strict';
const K = require('./_kit.js');

K.scenario('license', async (t) => {
  const admin = await t.step('관리자 계정 · 키 발급(API)', () => K.adminAccount());
  const key = await K.issueLicense(admin);
  t.note('키 ' + key.slice(0, 4) + '-…');
  const pc = await t.app('pc');
  const acct = await t.step('가입', () => K.signupUi(t, pc));
  const dev = await pc.w.evaluate(() => localStorage.getItem('tw.deviceId'));
  const premium = async () => (await acct.api('GET', '/v2/me', undefined, dev)).data.premium;
  await t.step('처음엔 프리미엄 아님 · 설정 › 라이선스는 키 칸', async () => {
    if(await premium()) throw new Error('처음부터 프리미엄');
    await pc.w.click('#lcProgSettingsBtn');
    await pc.w.click('#progTabBtnLicense');
    await K.waitShown(pc.w, '#licenseKeyBox', 15000);
  });
  await t.step('없는 키는 입력칸 아래 문구로 거절', async () => {
    await pc.w.fill('#licenseKeyInput', 'ABCD-EFGH-JKLM-NPQR');
    await pc.w.click('#licenseSubmitBtn');
    await K.waitShown(pc.w, '#licenseErrorMsg', 15000);
    t.note('문구: ' + await K.text(pc.w, '#licenseErrorMsg'));
    if(await premium()) throw new Error('없는 키로 프리미엄');
  });
  await t.step('발급한 키 → 등록됨 · 기기 목록에 «이 기기» · 서버 프리미엄', async () => {
    await pc.w.fill('#licenseKeyInput', key);
    await pc.w.click('#licenseSubmitBtn');
    await K.waitFor(async () => (await K.text(pc.w, '#licenseActiveTitle')) === '✅ 라이선스가 등록되어 있어요.', 20000, '등록됨');
    await K.waitFor(async () => /이 기기/.test(await K.text(pc.w, '#licenseDeviceList') || ''), 10000, '«이 기기» 줄');
    if(!(await premium())) throw new Error('서버가 프리미엄으로 보지 않음');
  });
  await t.step('같은 키를 다른 계정이 쓰면 거절', async () => {
    const other = await K.apiAccount();
    const r = await other.api('POST', '/v2/me/license', { key, device: { id: 'e2e-other-dev', name: 'PC' } }, 'e2e-other-dev');
    if(r.status < 400) throw new Error('남의 키가 등록됨 ' + r.status);
    t.note('다른 계정: ' + r.status + ' ' + (r.body && r.body.code));
  });
  await t.step('[이 기기에서 라이선스 해제] → 프리미엄 꺼짐', async () => {
    await pc.w.click('#licenseDeactivateBtn');
    await K.waitFor(async () => !(await premium()), 20000, '서버 프리미엄 꺼짐');
    await K.waitFor(async () => (await K.text(pc.w, '#licenseActiveTitle')) !== '✅ 라이선스가 등록되어 있어요.', 15000, '화면 바뀜');
    t.note('해제 뒤 제목: ' + await K.text(pc.w, '#licenseActiveTitle'));
  });
});
