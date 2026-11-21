// 메뉴 «종료»(mac Cmd+Q 와 같은 길)로 끌 때 못 올린 캐릭터 고침을 기다린다(#1024)
// 캐릭터를 고쳐 3초 묶음 저장이 예약된 채 앱 메뉴의 «종료» 를 누른다 → 끄기를 붙잡고(before-quit held) · 저장(PUT)이 200(그 사이 메인 창은 닫히지 않음) · 그 뒤 놓아 준다 ·
// 상한(quit-hold.js GUARD_MS) 안에 꺼진다 → 다시 켜면 서버 캐릭터가 고친 책상 색이다
'use strict';
const { run } = require('./_kit.js');
const Q = require('./_quit.js');

const COLOR = '#22aa66';

run('quit-menu', async (t) => {
  const A = await t.newUser('a');
  const id = await t.step('캐릭터 만들기 → 서버 슬롯 0', () => t.createCharacter(A));
  let pressed, trail0;
  await t.step('책상 색을 고친 직후(3초 묶음 전) 메뉴 «종료»', async () => {
    await Q.watchQuit(A);
    await Q.watchClose(A);
    await Q.pendingEdit(t, A, COLOR);
    trail0 = Q.quitTrail(A).length;
    pressed = await Q.menuQuit(A);
    t.note('끄기 길 ' + pressed.how);
  });
  await t.step(`끄기를 붙잡고 저장한 뒤 ${Q.GUARD_S}초 안에 꺼짐`, async () => {
    const exitAt = await Q.waitExit(A, Q.EXIT_WAIT_MS);
    const held = Q.checkHeldSave(t, Q.quitTrail(A), trail0);
    const took = exitAt - pressed.at;
    t.note(`붙잡은 시간 ${held}ms · 누르고 꺼질 때까지 ${took}ms`);
    t.check(took < Q.GUARD_MS, `${Q.GUARD_S}초 상한을 넘김(${took}ms)`);
  });
  await t.step('다시 켜면 서버 캐릭터가 고친 책상 색', async () => {
    await t.relaunchFresh(A);
    await t.waitLoggedIn(A);
    const def = (await t.api(A, 'GET', '/v2/me/avatars/' + id)).body.data.def;
    t.check(String(def.deskColor).toLowerCase() === COLOR, '서버 책상 색 ' + def.deskColor + ' ≠ ' + COLOR);
  });
});
