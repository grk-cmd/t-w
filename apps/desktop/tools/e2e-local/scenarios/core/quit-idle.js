// 못 올린 고침이 없으면 끄기가 바로 된다 — 8초 상한을 기다리지 않는다(#1024)
// 캐릭터를 만들고 서버 저장이 끝난 뒤(못 올린 고침 0) 메뉴 «종료» → 붙잡아도 저장 요청 없이 곧바로 놓아 주고 앱이 IDLE_MAX_MS 안에 꺼진다
'use strict';
const { run } = require('./_kit.js');
const Q = require('./_quit.js');

// 바로 끄기의 상한 — 렌더러 상한(8초)을 기다렸다면 반드시 넘는 값
const IDLE_MAX_MS = 4000;
const HOLD_MAX_MS = 1000;

run('quit-idle', async (t) => {
  const A = await t.newUser('a');
  await t.step('캐릭터 만들기 → 서버 슬롯 0', () => t.createCharacter(A));
  let pressed, trail0;
  await t.step('못 올린 고침 0 → 메뉴 «종료»', async () => {
    await t.poll(() => A.w.evaluate(() => closetMod.unsavedCount() === 0), 15000, '못 올린 고침 0');
    await Q.watchQuit(A);
    trail0 = Q.quitTrail(A).length;
    pressed = await Q.menuQuit(A);
    t.note('끄기 길 ' + pressed.how);
  });
  await t.step(`저장 요청 없이 ${IDLE_MAX_MS}ms 안에 꺼짐`, async () => {
    const exitAt = await Q.waitExit(A, Q.EXIT_WAIT_MS);
    const took = exitAt - pressed.at;
    const tr = Q.quitTrail(A).slice(trail0);
    const held = tr.find((x) => x.kind === 'held'), go = tr.find((x) => x.kind === 'go');
    t.note(`누르고 꺼질 때까지 ${took}ms · 기록 ${JSON.stringify(tr)}`);
    t.check(go, '끄기 기록(before-quit go)이 없음');
    t.check(!tr.some((x) => x.kind === 'save'), '고친 것이 없는데 저장 요청을 보냄');
    if(held) t.check(go.at - held.at < HOLD_MAX_MS, `붙잡은 채 ${go.at - held.at}ms 기다림`);
    t.check(took < IDLE_MAX_MS, `바로 안 꺼짐(${took}ms — 상한을 기다렸을 수 있음)`);
  });
});
