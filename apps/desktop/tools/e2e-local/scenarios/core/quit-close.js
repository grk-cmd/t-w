// 메인 창 닫기도 못 올린 캐릭터 고침을 기다린다(#1024 · #1043)
// mac: 고친 직후 메인 창을 닫으면 저장(PUT)한 뒤 창만 닫고 앱은 남는다(Dock) → Dock 누르기(activate)로 다시 연 창에서 또 고친 뒤
//   메뉴 «종료» → 다시 붙잡아 둘째 저장까지 서버에 닿는다(다시 연 창이 «답할 수 있다» 를 알린 뒤 붙잡기가 다시 걸림).
// 윈도우 · 리눅스: 창 닫기 = 끄기 — 붙잡고 저장한 뒤 상한(quit-hold.js GUARD_MS) 안에 꺼진다
'use strict';
const { run } = require('./_kit.js');
const Q = require('./_quit.js');

const COLOR_1 = '#aa3377', COLOR_2 = '#3377aa';
const mac = process.platform === 'darwin';

const closeMain = (A) => A.app.evaluate(({ BrowserWindow }) => {
  const m = BrowserWindow.getAllWindows().find((x) => /Desk Companion/.test(x.getTitle()));
  if(!m) return false;
  setTimeout(() => m.close(), 0);
  return true;
});
const mainOpen = (A) => A.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some((x) => !x.isDestroyed() && /Desk Companion/.test(x.getTitle())));

run('quit-close', async (t) => {
  const A = await t.newUser('a');
  const id = await t.step('캐릭터 만들기 → 서버 슬롯 0', () => t.createCharacter(A));
  let trail0;
  await t.step(mac ? '책상 색을 고친 직후 메인 창 닫기 → 저장(PUT 200) 뒤 창만 닫힘 · 앱은 남음 · 서버에 고친 색 → Dock 누르기(activate)' : `책상 색을 고친 직후 메인 창 닫기 → 붙잡고 저장한 뒤 ${Q.GUARD_S}초 안에 꺼짐`, async () => {
    await Q.watchQuit(A);
    await Q.pendingEdit(t, A, COLOR_1);
    trail0 = Q.quitTrail(A).length;
    t.check(await closeMain(A), '메인 창을 못 찾음');
    const at0 = Date.now();
    if(!mac){
      const exitAt = await Q.waitExit(A, Q.EXIT_WAIT_MS);
      const held = Q.checkHeldSave(t, Q.quitTrail(A), trail0);
      t.note(`붙잡은 시간 ${held}ms · 닫고 꺼질 때까지 ${exitAt - at0}ms`);
      t.check(exitAt - at0 < Q.GUARD_MS, `${Q.GUARD_S}초 상한을 넘김(${exitAt - at0}ms)`);
      return;
    }
    // mac 은 창이 없는 동안 단계 끝의 조용한 창 판정(창 0개 = 깨짐)이 틀리게 걸린다 — 닫기부터 다시 열기까지 한 단계로 둔다
    await t.poll(async () => !(await mainOpen(A)), Q.GUARD_MS, '메인 창이 닫힘');
    const tr = Q.quitTrail(A).slice(trail0);
    const save = tr.find((x) => x.kind === 'save' && x.method === 'PUT');
    t.check(save && save.status === '200', '창이 닫히기 전 저장(PUT 200)이 없음 — ' + JSON.stringify(tr));
    t.check(!tr.some((x) => x.kind === 'held' || x.kind === 'go'), '창 닫기가 앱 끄기(before-quit)로 감 — ' + JSON.stringify(tr));
    await t.wait(2000);
    t.check(A.app.process().exitCode === null && A.app.process().signalCode === null, '창을 닫았더니 앱이 꺼짐');
    const def = await Q.serverDef(A.fc, t.PW, id);
    t.check(String(def.deskColor).toLowerCase() === COLOR_1, '서버 책상 색 ' + def.deskColor + ' ≠ ' + COLOR_1);
    t.note(`닫은 뒤 ${Date.now() - at0}ms 동안 앱이 남음 · 서버 책상 색 ${def.deskColor}`);
    const opened = A.app.waitForEvent('window', { timeout: 30000 });
    await A.app.evaluate(({ app }) => { app.emit('activate', { preventDefault(){} }, false); });
    A.w = await opened;
  });
  if(!mac){
    await t.step('서버에 고친 색', async () => {
      const def = await Q.serverDef(A.fc, t.PW, id);
      t.check(String(def.deskColor).toLowerCase() === COLOR_1, '서버 책상 색 ' + def.deskColor);
    });
    return;
  }
  await t.step('[mac] Dock 누르기(activate)로 다시 연 창 — 로그인된 런처 · 옷장 받음', async () => {
    await A.w.waitForLoadState('domcontentloaded');
    await t.waitLoggedIn(A);
    await t.poll(() => A.w.evaluate(() => closetMod.state() === 'ready'), 20000, '옷장 받음');
  });
  let pressed;
  await t.step('[mac] 다시 연 창에서 또 고친 직후 메뉴 «종료»', async () => {
    await Q.pendingEdit(t, A, COLOR_2);
    trail0 = Q.quitTrail(A).length;
    pressed = await Q.menuQuit(A);
  });
  await t.step(`[mac] 다시 붙잡고 둘째 저장 뒤 ${Q.GUARD_S}초 안에 꺼짐 · 서버에 둘째 색`, async () => {
    const exitAt = await Q.waitExit(A, Q.EXIT_WAIT_MS);
    const held = Q.checkHeldSave(t, Q.quitTrail(A), trail0);
    t.note(`붙잡은 시간 ${held}ms · 누르고 꺼질 때까지 ${exitAt - pressed.at}ms`);
    t.check(exitAt - pressed.at < Q.GUARD_MS, `${Q.GUARD_S}초 상한을 넘김(${exitAt - pressed.at}ms)`);
    const def = await Q.serverDef(A.fc, t.PW, id);
    t.check(String(def.deskColor).toLowerCase() === COLOR_2, '서버 책상 색 ' + def.deskColor + ' ≠ ' + COLOR_2);
  });
});
