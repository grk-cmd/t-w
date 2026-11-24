// 프로그램 이동 모드 — 책상 모드에서 칩 ▼ → «프로그램 이동» → 마우스를 움직이면 캐릭터가 따라오고 → 누르면 «위치가 확정됐어요» · 자리(tw.deskPan)가 저장된다.
// 다시 켜고 책상 모드로 가도 같은 자리에 있다.
// 판정은 앱이 그리는 데 쓰는 지금 자리(charPlaceMod.deskPanX/Y)로 한다 — 저장값(tw.deskPan)은 확정할 때만 써서 «따라감 · 되살림» 을 못 보여 준다
'use strict';
const { run } = require('./_kit.js');

const pan = (A) => A.w.evaluate(() => JSON.parse(localStorage.getItem('tw.deskPan') || 'null'));
const live = (A) => A.w.evaluate(() => ({ x: charPlaceMod.deskPanX(), y: charPlaceMod.deskPanY() }));
const same = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

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
    const m0 = await live(A);
    await A.w.mouse.move(500, 350, { steps: 10 });
    await t.wait(300);
    t.check(!same(await live(A), m0), '이동 모드인데 마우스를 따라가지 않음');
    await A.w.mouse.click(500, 350);
    await t.poll(async () => /위치가 확정됐어요/.test(await A.w.textContent('#toast')), 4000, '«위치가 확정됐어요»');
    p1 = await pan(A);
    t.check(p1 && Number.isFinite(p1.x) && Number.isFinite(p1.y), '자리가 저장되지 않음');
    t.check(!p0 || Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y) > 0.05, `자리가 안 바뀜 ${JSON.stringify(p0)} → ${JSON.stringify(p1)}`);
    t.check(same(await live(A), p1), '저장한 자리와 지금 자리가 다름');
    t.note('자리 ' + JSON.stringify(p1));
  });
  await t.step('확정 뒤 마우스를 움직여도 안 따라감', async () => {
    await A.w.mouse.move(1000, 600, { steps: 10 });
    await t.wait(500);
    const p2 = await live(A);
    t.check(same(p2, p1), `확정 뒤에도 따라감 ${JSON.stringify(p1)} → ${JSON.stringify(p2)}`);
  });
  await t.step('다시 켜도 같은 자리', async () => {
    await t.relaunch(A);
    await t.waitLoggedIn(A);
    await t.enterDesk(A);
    const p3 = await live(A);
    t.check(same(p3, p1), `다시 켠 뒤 지금 자리 ${JSON.stringify(p3)} ≠ 저장한 자리 ${JSON.stringify(p1)}`);
    await t.shot(A, '01-moved');
  });
});
