// 판 확인 · 업데이트 안내 — ① 최소 판(GET /v2/config app.minVersion)보다 낮으면 «업데이트가 필요해요»(닫기 없음 · 로그인 화면 안 나옴)
//                          ② 새 판이 있으면 «새 버전 …» [업데이트] [나중에] → [나중에] 뒤 로그인 화면
//                          ③ 같은 계정이 다른 PC 에서 더 새 판을 쓰면 이 PC 를 막는다(POST /v2/me/app-version behind — 진짜 서버 판정)
// ①은 설정을 이 앱 응답에만 고쳐 준다(로컬 묶음의 설정은 다른 시험과 같이 써서 바꾸지 않는다).
// ②의 «새 판 있음» 은 GitHub 릴리스 피드(electron-updater)라 시험에서 못 만든다 — main 의 확인 IPC 자리에서 «available» 상태를 보내 준다
'use strict';
const K = require('./_kit.js');
const OV = '#appVerGateOverlay';
const ovText = (w) => w.evaluate((s) => { const o = document.querySelector(s); return o ? o.innerText : ''; }, OV);
const ovButtons = (w) => w.evaluate((s) => [...document.querySelectorAll(s + ' button')].filter((b) => b.style.display !== 'none').map((b) => b.textContent), OV);

K.scenario('version', async (t) => {
  const a = await t.app('min', { version: '0.13.0' });
  await t.step('① 최소 판 0.99.0 → 강제 창 · 버튼 하나 · 로그인 화면 안 나옴', async () => {
    await a.editConfig((d) => { d.app = Object.assign({}, d.app, { minVersion: '0.99.0' }); return d; });
    await a.w.reload();
    await K.waitShown(a.w, OV, 30000);
    const tx = await ovText(a.w);
    if(!/업데이트가 필요해요/.test(tx) || !/이 버전\(0\.13\.0\)은 더 이상 쓸 수 없어요\. 0\.99\.0 이상으로/.test(tx)) throw new Error('글: ' + tx.slice(0, 160));
    const b = await ovButtons(a.w);
    if(b.length !== 1 || b.some((x) => x === '나중에')) throw new Error('버튼: ' + b.join('|'));
    await t.wait(5000);
    if(await K.shown(a.w, '#inviteGateCard')) throw new Error('강제 창 뒤로 로그인 화면이 열림');
  });
  await a.quit();

  const b = await t.app('optional', { version: '0.13.0' });
  await t.step('② 새 판 0.99.1 있음 → «새 버전 0.99.1» [업데이트] [나중에]', async () => {
    await b.A.app.evaluate(({ ipcMain, BrowserWindow }) => {
      ipcMain.removeAllListeners('companion:checkUpdate');
      ipcMain.on('companion:checkUpdate', () => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('companion:updateStatus', { status: 'available', version: '0.99.1' })));
    });
    await b.w.reload();
    await K.waitShown(b.w, OV, 30000);
    const tx = await ovText(b.w);
    if(!/새 버전 0\.99\.1이 나왔어요/.test(tx) || !/지금 버전 0\.13\.0/.test(tx)) throw new Error('글: ' + tx.slice(0, 160));
    const bt = await ovButtons(b.w);
    if(bt.length !== 2 || bt[1] !== '나중에') throw new Error('버튼: ' + bt.join('|'));
  });
  await t.step('② [나중에] → 창 닫힘 → 로그인 화면', async () => {
    await b.w.click(OV + ' button:has-text("나중에")');
    await K.waitFor(async () => !(await K.shown(b.w, OV)), 10000, '창 닫힘');
    await K.waitShown(b.w, '#inviteGateCard', 20000);
  });
  await b.quit();

  const acct = await K.apiAccount();
  const n = await t.app('newer', { version: '0.99.2' });
  await t.step('③ 새 판(0.99.2) PC 로 로그인 → 서버에 판 알림', async () => {
    await K.loginUi(n, acct.fc);
    await K.waitFor(() => n.A.reqs.some((r) => /^POST \/v2\/me\/app-version 200/.test(r)), 20000, '판 알림');
  });
  const o = await t.app('older', { version: '0.13.0' });
  await t.step('③ 옛 판(0.13.0) PC 로 같은 계정 로그인 → «다른 PC 에서 더 새 버전(0.99.2)» 강제 창', async () => {
    await K.loginUi(o, acct.fc);
    await K.waitShown(o.w, OV, 30000);
    const tx = await ovText(o.w);
    if(!/다른 PC 에서 더 새 버전\(0\.99\.2\)을 쓰고 있어요\. 이 PC\(0\.13\.0\)도/.test(tx)) throw new Error('글: ' + tx.slice(0, 160));
    if((await ovButtons(o.w)).includes('나중에')) throw new Error('강제 창에 «나중에»');
  });
});
