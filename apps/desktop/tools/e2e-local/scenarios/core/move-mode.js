// 프로그램 이동 모드 — 책상 모드에서 칩 ▼ → «프로그램 이동» → 마우스를 움직이면 캐릭터가 따라오고 → 누르면 «위치가 확정됐어요» · 자리(tw.deskPan)가 저장된다.
// 다시 켜고 책상 모드로 가도 같은 자리에 있다.
'use strict';
const { run } = require('./_kit.js');

const pan = (A) => A.w.evaluate(() => JSON.parse(localStorage.getItem('tw.deskPan') || 'null'));

run('move-mode', async (t) => {
  const A = await t.newUser('a');
  await t.step('캐릭터 만들기 · 책상 모드', async () => { await t.createCharacter(A); await t.enterDesk(A); });
  const p0 = await pan(A);
  let p1;
  await t.step('이동 모드 → 마우스 따라 옮기고 → 눌러서 확정', async () => {
    await A.w.click('#myChipMoreBtn');
    await A.w.click('#myMoveBtn');
    await t.wait(500);
    await A.w.mouse.move(900, 500);
    await A.w.mouse.move(500, 350, { steps: 10 });
    await t.wait(300);
    await A.w.mouse.click(500, 350);
    await t.poll(async () => /위치가 확정됐어요/.test(await A.w.textContent('#toast')), 4000, '«위치가 확정됐어요»');
    p1 = await pan(A);
    t.check(p1 && Number.isFinite(p1.x) && Number.isFinite(p1.y), '자리가 저장되지 않음');
    t.check(!p0 || Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y) > 0.05, `자리가 안 바뀜 ${JSON.stringify(p0)} → ${JSON.stringify(p1)}`);
    t.note('자리 ' + JSON.stringify(p1));
  });
  await t.step('확정 뒤 마우스를 움직여도 안 따라감', async () => {
    await A.w.mouse.move(1000, 600, { steps: 10 });
    await t.wait(500);
    const p2 = await pan(A);
    t.check(p2.x === p1.x && p2.y === p1.y, '확정 뒤에도 자리가 바뀜');
  });
  await t.step('다시 켜도 같은 자리', async () => {
    await t.relaunch(A);
    await t.waitLoggedIn(A);
    await t.enterDesk(A);
    const p3 = await pan(A);
    t.check(p3 && p3.x === p1.x && p3.y === p1.y, `다시 켠 뒤 자리 ${JSON.stringify(p3)}`);
    await t.shot(A, '01-moved');
  });
});
