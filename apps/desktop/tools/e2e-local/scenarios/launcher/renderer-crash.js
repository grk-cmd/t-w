// 렌더러가 죽었을 때 런처로 되돌리기 — 런처 밖 창 모드(마이홈 — 창이 커진다)에서 렌더러를 죽이면 한 번 다시 불러오고,
// 다시 불러오기 전에 창부터 런처 크기로 되돌린다. 판정: 창 크기(main 의 BrowserWindow)가 처음 런처 크기 · main 로그(crashed → 되돌림 → 다시 불러옴) · 다시 불러온 화면에 런처
// 실행 화면(모니터 전체 오버레이)은 캐릭터가 있어야 들어가서 마이홈 창 모드로 본다 — 되돌리는 길(_resetWindowForReload)은 같다
'use strict';
const K = require('../account/_kit.js');

K.scenario('renderer-crash', async (t) => {
  const acct = await K.apiAccount();
  const a = await t.app('pc');
  await t.step('로그인', () => K.loginUi(a, acct.fc));
  const size = () => a.A.app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find((x) => !x.getParentWindow()); const b = w.getBounds(); return b.width + 'x' + b.height; });
  const launcher = await size();
  t.note('런처 창 ' + launcher);
  await t.step('마이홈 열기 → 창이 런처보다 커진다', async () => {
    await a.w.click('#lcNameBtn');
    await K.waitFor(async () => (await size()) !== launcher, 15000, '창 크기 바뀜');
    t.note('마이홈 창 ' + await size());
  });
  // 죽은 뒤 다시 불러온 렌더러는 Playwright 가 다시 붙지 않아 주소 돌리기 · 페이지 손잡이를 쓸 수 없다 — 다시 불러온 화면은 main 에서 직접 읽고,
  // 로그인이 이어지는지(서버 요청)는 이 도구로는 못 본다
  const mainWc = (fn) => a.A.app.evaluate(({ BrowserWindow }, src) => {
    const w = BrowserWindow.getAllWindows().find((x) => !x.getParentWindow());
    return w.webContents.isCrashed() ? 'crashed' : w.webContents.executeJavaScript(src).catch((e) => 'ERR ' + e.message);
  }, fn);
  await t.step('렌더러를 죽인다(crashed) → 창이 런처 크기로 · 한 번 다시 불러옴 → 런처 화면', async () => {
    // forcefullyCrashRenderer 는 까닭이 killed(사용자가 끈 것)라 main 이 일부러 넘긴다 — 진짜 사고처럼 crashed 로 죽인다
    const cdp = await a.w.context().newCDPSession(a.w);
    await cdp.send('Page.crash').catch(() => {});
    await K.waitFor(async () => (await size()) === launcher, 15000, '창이 런처 크기로');
    await K.waitFor(() => a.A.logs.some((l) => /\[렌더러\] 자동 재로드 실행/.test(l)), 15000, '자동 다시 불러오기');
    if(!a.A.logs.some((l) => /reason=crashed/.test(l)) || !a.A.logs.some((l) => /다시 불러오기 전 창을 런처로 되돌림/.test(l))) throw new Error('main 로그에 되돌림이 없음');
    await K.waitFor(async () => (await mainWc("document.readyState === 'complete' && !!document.getElementById('launcher')")) === true, 30000, '다시 불러온 화면');
    if((await size()) !== launcher) throw new Error('다시 불러온 뒤 창 크기가 바뀜 ' + await size());
  });
});
