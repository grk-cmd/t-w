// 렌더러가 죽었을 때 런처로 되돌리기 — 런처 밖 창 모드(마이홈 — 창이 커진다)에서 렌더러를 죽이면 한 번 다시 불러오고,
// 다시 불러오기 전에 창부터 런처 크기로 되돌린다. 판정: 창 크기(main 의 BrowserWindow)가 처음 런처 크기 · main 로그 순서(crashed → 되돌림 → 다시 불러옴)
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
  // Playwright 로 붙인 앱에서는 죽은 뒤 새로 뜬 렌더러가 로드를 끝내지 못한다(isLoading 그대로 · executeJavaScript 무응답 — 디버거가 새 렌더러를 붙잡음).
  // 그래서 판정은 main 쪽까지 — 창 크기 되돌림 · 자동 다시 불러오기 한 번. 다시 불러온 화면 · 로그인 유지는 이 도구로 못 본다
  await t.step('렌더러를 죽인다(crashed) → 창이 런처 크기로 · 자동 다시 불러오기 한 번', async () => {
    // forcefullyCrashRenderer 는 까닭이 killed(사용자가 끈 것)라 main 이 일부러 넘긴다 — 진짜 사고처럼 crashed 로 죽인다.
    // 죽는 페이지는 CDP 답을 보내지 못해 send 가 끝나지 않는다 — 기다리지 않는다
    const cdp = await a.w.context().newCDPSession(a.w);
    cdp.send('Page.crash').catch(() => {});
    await K.waitFor(async () => (await size()) === launcher, 15000, '창이 런처 크기로');
    await K.waitFor(() => a.A.logs.some((l) => /\[렌더러\] 자동 재로드 실행/.test(l)), 15000, '자동 다시 불러오기');
    const L = a.A.logs.join('\n');
    const iGone = L.search(/reason=crashed/), iReset = L.indexOf('다시 불러오기 전 창을 런처로 되돌림'), iReload = L.indexOf('자동 재로드 실행');
    if(!(iGone >= 0 && iGone < iReset && iReset < iReload)) throw new Error('main 로그 순서가 crashed → 되돌림 → 다시 불러오기가 아님');
  });
});
