// 오픈소스 라이선스 창 — 런처 아래 «오픈소스 라이선스» · 설정 › 시스템 › 프로그램 정보 두 곳에서 연다
// 판정: 머리 «오픈소스 n개» 와 줄 수가 같음 · [원문 ▾] 펼치면 원문 · 이름을 누르면 그 홈페이지 주소로 시스템 브라우저 요청 · [닫기]
// 시스템 브라우저는 열지 않는다 — main 의 열기 IPC 를 기록만 하게 바꾼다
'use strict';
const K = require('../account/_kit.js');
const OV = '#ossLicensesOverlay';

K.scenario('oss-licenses', async (t) => {
  const acct = await K.apiAccount();
  const a = await t.app('pc');
  await t.step('로그인', () => K.loginUi(a, acct.fc));
  await a.A.app.evaluate(({ ipcMain }) => {
    globalThis.__twOpened = [];
    ipcMain.removeAllListeners('companion:openBrowser');
    ipcMain.on('companion:openBrowser', (_e, u) => globalThis.__twOpened.push(String(u)));
  });
  const check = async () => {
    await K.waitShown(a.w, OV, 10000);
    await K.waitFor(async () => /^이 프로그램이 쓰는 오픈소스 \d+개예요/.test(await K.text(a.w, OV + ' .oss-cap') || ''), 15000, '머리 글');
    const n = Number((await K.text(a.w, OV + ' .oss-cap')).match(/(\d+)개/)[1]);
    const rows = await a.w.evaluate((s) => document.querySelectorAll(s + ' .oss-row').length, OV);
    if(!(n > 0) || n !== rows) throw new Error('머리 ' + n + '개 · 줄 ' + rows);
    return n;
  };
  await t.step('런처 «오픈소스 라이선스» → 창 · 머리 n개 = 줄 n', async () => {
    await a.w.click('#miOssLink');
    t.note('오픈소스 ' + await check() + '개');
  });
  await t.step('[원문 ▾] → 원문 펼침 · 다시 누르면 접힘', async () => {
    const more = a.w.locator(OV + ' .oss-row').first().locator('.oss-more');
    await more.click();
    const raw = await K.text(a.w, OV + ' .oss-row:first-child .oss-raw');
    if(!raw || raw.length < 20) throw new Error('원문이 비었음');
    if((await more.textContent()) !== '원문 ▴') throw new Error('단추 글');
    await more.click();
    if(await a.w.evaluate((s) => !!document.querySelector(s + ' .oss-row:first-child .oss-raw'), OV)) throw new Error('안 접힘');
  });
  await t.step('이름 → 그 홈페이지 주소로 시스템 브라우저 요청', async () => {
    const name = a.w.locator(OV + ' .oss-name:not([disabled])').first();
    const url = await name.getAttribute('title');
    await name.click();
    await K.waitFor(async () => (await a.A.app.evaluate(() => globalThis.__twOpened)).includes(url), 5000, '열기 요청 ' + url);
  });
  await t.step('[닫기] → 닫힘', async () => {
    await a.w.click(OV + ' .oss-foot button');
    await K.waitFor(async () => !(await K.shown(a.w, OV)), 5000, '닫힘');
  });
  await t.step('설정 › 시스템 › «오픈소스 라이선스» 에서도 같은 창', async () => {
    await a.w.click('#lcProgSettingsBtn');
    await a.w.click('#progTabBtnSystem');
    await a.w.click('#progOssLink');
    await check();
  });
});
