// 이 PC 에 라이선스 키(tw.licenseKey)가 없을 때 — 0.12.3 과 같은 모습인가
// 0.12.3(v0.12.3:app/parts/account/license-gate.js _licenseSnapForPush · my-info.js push): 켜고 6초 뒤 계정 스냅샷의 라이선스를 읽어
//   키가 유효하면 이 PC 에 키를 적고 프리미엄을 켜며 «🎫 계정에 등록된 라이선스를 이 PC에서도 켰어요» 를 띄웠다(묻는 창은 없음).
//   계정에 라이선스가 없으면 아무 일 없음(프리미엄 아님 · 안내 없음).
// 0.13(license-premium.js): 프리미엄은 서버가 «이 기기가 라이선스 기기 목록에 있나» 로 정하고 앱은 기기를 알아서 등록하지 않는다.
// 판정: ① 라이선스 없는 계정 — 두 판이 같다(일반 단계) ② 다른 PC 에 등록한 라이선스가 있는 계정 — 0.12.3 모습을 knownBug 로 본다 ·
//   0.13 지금 모습(프리미엄 아님 · 안내 없음 · 등록 요청 없음 · 설정 › 라이선스에 [이 기기 등록])은 일반 단계로 남긴다
'use strict';
const K = require('./_kit.js');

const OTHER_DEV = 'e2e-nokey-other-pc';
const TOAST_0123 = /계정에 등록된 라이선스를 이 PC에서도 켰어요/;
// 0.12.3 은 켜고 6초 뒤에 켰다 — 그보다 넉넉히 본다
const WATCH_MS = 12000;

// 이 PC 에 키를 없앤 채 다시 켠다 · 켜는 차례의 프리미엄 확인이 끝날 때까지 · 그동안 뜬 안내 글을 모은다
async function relaunchNoKey(pc){
  await pc.w.evaluate(() => localStorage.removeItem('tw.licenseKey'));
  await pc.quit();
  await pc.launch();
  await K.waitEntered(pc);
  await pc.w.evaluate(() => {
    window.__e2eToasts = [];
    const el = document.getElementById('toast');
    new MutationObserver(() => window.__e2eToasts.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await K.waitFor(() => pc.w.evaluate(() => acctStateMod.premiumKnown()), 20000, '켜는 차례의 프리미엄 확인');
}
const seen = (pc) => pc.w.evaluate(() => ({
  premium: isPremium,
  key: localStorage.getItem('tw.licenseKey'),
  toasts: window.__e2eToasts.slice(),
}));
const licenseWrites = (pc) => pc.reqsSince(pc.A.reqs.lastIndexOf('--- launch ---')).filter((r) => /^(POST \/v2\/me\/license |PUT \/v2\/me\/license\/devices\/)/.test(r));

K.scenario('license-no-key', async (t) => {
  const admin = await t.step('관리자 계정 · 키 발급(API)', () => K.adminAccount());
  const key = await K.issueLicense(admin);
  const pc = await t.app('pc');
  const acct = await t.step('가입', () => K.signupUi(t, pc));
  const dev = await pc.w.evaluate(() => localStorage.getItem('tw.deviceId'));
  const serverPremium = async () => (await acct.api('GET', '/v2/me', undefined, dev)).data.premium;

  await t.step('① 라이선스 없는 계정 · 키 없이 다시 켬 → 프리미엄 아님 · 안내 없음 · 등록 요청 없음(0.12.3 과 같음)', async () => {
    await relaunchNoKey(pc);
    await t.wait(WATCH_MS);
    const s = await seen(pc);
    t.note('본 것 ' + JSON.stringify(s));
    if(s.premium) throw new Error('프리미엄이 켜짐');
    if(await serverPremium()) throw new Error('서버가 프리미엄으로 봄');
    if(s.toasts.some((x) => /라이선스/.test(x))) throw new Error('라이선스 안내가 뜸: ' + s.toasts.join(' | '));
    if(licenseWrites(pc).length) throw new Error('등록 요청을 보냄: ' + licenseWrites(pc).join(' | '));
  });

  await t.step('다른 PC 에 라이선스 등록(API)', async () => {
    const r = await acct.api('POST', '/v2/me/license', { key, device: { id: OTHER_DEV, name: 'other PC' } }, OTHER_DEV);
    if(r.status !== 200) throw new Error('다른 PC 등록 ' + r.status + ' ' + JSON.stringify(r.body));
  });

  await t.step('② 다른 PC 에 라이선스 · 이 PC 는 키 없이 다시 켬', async () => {
    await relaunchNoKey(pc);
  });
  await t.knownBug(1, '키 없는 PC 가 0.12.3 처럼 계정 라이선스를 이 PC 에서도 켜고 알림', async () => {
    await K.waitFor(() => pc.w.evaluate(() => isPremium), WATCH_MS, '이 PC 프리미엄');
    const s = await seen(pc);
    if(!s.toasts.some((x) => TOAST_0123.test(x))) throw new Error('0.12.3 의 «이 PC에서도 켰어요» 안내가 없음');
  });
  await t.step('② 0.13 지금 모습 — 프리미엄 아님 · 안내 없음 · 등록 요청 없음 · 설정 › 라이선스에 [이 기기 등록]', async () => {
    const s = await seen(pc);
    t.note('본 것 ' + JSON.stringify(s) + ' · 서버 premium ' + await serverPremium());
    if(s.premium || await serverPremium()){ t.note('0.12.3 모습으로 바뀜 — 위 knownBug 1 이 FIXED 를 남긴다'); return; }
    if(licenseWrites(pc).length) throw new Error('등록 요청을 보냄: ' + licenseWrites(pc).join(' | '));
    await pc.w.click('#lcProgSettingsBtn');
    await pc.w.click('#progTabBtnLicense');
    await K.waitShown(pc.w, '#licenseRegisterThisBtn', 15000);
    t.note('제목: ' + await K.text(pc.w, '#licenseActiveTitle'));
  });
});
