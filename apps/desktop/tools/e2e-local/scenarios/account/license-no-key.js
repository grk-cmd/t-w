// 이 PC 에 라이선스 키(tw.licenseKey)가 없을 때 — 0.12.3 과 같은 모습인가
// 0.12.3(v0.12.3:app/parts/account/license-gate.js _licenseSnapForPush · my-info.js push): 켜고 6초 뒤 계정 스냅샷의 라이선스를 읽어
//   키가 유효하면 이 PC 에 키를 적고 프리미엄을 켜며 «🎫 계정에 등록된 라이선스를 이 PC에서도 켰어요» 를 띄웠다(묻는 창은 없음).
//   계정에 라이선스가 없으면 아무 일 없음(프리미엄 아님 · 안내 없음).
// 0.13(license-premium.js): 계정에 라이선스가 있고 이 기기가 목록에 없으면 0.12 처럼 이 기기를 등록하고 같은 안내를 띄운다(11-20 결정).
// 판정: ① 라이선스 없는 계정 — 아무 일 없음 ② 다른 PC 에 등록한 라이선스가 있는 계정 — 이 기기 등록 · 프리미엄 · 안내 한 번
'use strict';
const K = require('./_kit.js');

const OTHER_DEV = 'e2e-nokey-other-pc';
const TOAST_0123 = /계정에 등록된 라이선스를 이 PC에서도 켰어요/;
// 0.12.3 은 켜고 6초 뒤에 켰다 — 그보다 넉넉히 본다
const WATCH_MS = 12000;
// 안내가 뜬 뒤 더 지켜보는 시간 — 한 번만 뜨는지 다시 센다
const AFTER_TOAST_MS = 2000;

// 이 PC 에 키를 없앤 채 다시 켠다 · 켜는 차례의 프리미엄 확인이 끝날 때까지 · 그동안 뜬 안내 글을 모은다
async function relaunchNoKey(pc){
  await pc.w.evaluate(() => localStorage.removeItem('tw.licenseKey'));
  await pc.quit();
  await pc.launch();
  await K.waitEntered(pc);
  await pc.w.evaluate(() => {
    const el = document.getElementById('toast');
    window.__e2eToasts = el.textContent ? [el.textContent] : [];   // 계정에 들어가기 전에 이미 뜬 안내도 모은다
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
  await t.step('② 이 기기 등록(PUT) · 프리미엄 · «이 PC에서도 켰어요» 안내 한 번(0.12.3 과 같음)', async () => {
    await K.waitFor(() => pc.w.evaluate(() => isPremium), WATCH_MS, '이 PC 프리미엄');
    const shown = (x) => x.toasts.filter((y) => TOAST_0123.test(y)).length;
    await K.waitFor(async () => shown(await seen(pc)) >= 1, WATCH_MS, '«이 PC에서도 켰어요» 안내');
    await t.wait(AFTER_TOAST_MS);
    const s = await seen(pc);
    t.note('본 것 ' + JSON.stringify(s));
    if(!await serverPremium()) throw new Error('서버가 프리미엄으로 보지 않음');
    if(!licenseWrites(pc).some((r) => r.startsWith('PUT /v2/me/license/devices/'))) throw new Error('이 기기 등록 요청이 없음');
    if(shown(s) !== 1) throw new Error('«이 PC에서도 켰어요» 안내가 한 번이 아님: ' + s.toasts.join(' | '));
  });
});
