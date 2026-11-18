// 렌더러가 죽었을 때 런처로 되돌리기 — 런처 밖 창 모드(마이홈 — 창이 커진다)에서 렌더러를 죽이면 한 번 다시 불러오고,
// 다시 불러오기 전에 창부터 런처 크기로 되돌린다. 판정: 창 크기(main 의 BrowserWindow)가 처음 런처 크기 · 런처가 보임 · 로그인 그대로
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
  await t.step('렌더러를 죽인다 → 다시 불러옴 → 창이 런처 크기 · 런처 보임 · 로그인 그대로', async () => {
    const n = a.A.reqs.length;
    await a.A.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((x) => !x.getParentWindow()).webContents.forcefullyCrashRenderer());
    await K.waitFor(async () => (await size()) === launcher, 15000, '창이 런처 크기로');
    await K.waitFor(async () => { try { return await K.shown(a.w, '#lcLoad'); } catch(_){ return false; } }, 40000, '런처 보임');
    if(await K.shown(a.w, '#inviteGateCard')) throw new Error('로그인이 풀림');
    if(!a.A.reqs.slice(n).some((r) => /^GET \/v2\/me 200/.test(r))) throw new Error('다시 불러온 뒤 내 계정 확인이 없음');
    if(!a.A.logs.some((l) => /다시 불러오기 전 창을 런처로 되돌림/.test(l))) throw new Error('main 로그에 되돌림이 없음');
  });
});
