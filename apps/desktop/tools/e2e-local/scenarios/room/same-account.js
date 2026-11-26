// 같은 계정은 방에 한 자리 — 둘째 PC 가 같은 방에 들어오면 먼저 있던 PC 는 토스트와 함께 방에서 나온다
'use strict';
const kit = require('./_kit.js');

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  const code = await t.step('a: 방 만들기', () => a.createRoom({ title: '한자리' }));
  await t.step('b: 참여 · 책상 모드', async () => { await b.joinRoom(code); await b.desk(); });
  const a2 = await t.sameAccount(a, 'a2');
  await t.step('a2: 같은 계정(같은 userCode)', async () => t.eq('a2 userCode', a2.code, a.code));
  await t.step('a2: 슬롯이 계정을 따라옴(캐릭터 있음)', async () => {
    await t.until('a2 슬롯', () => a2.eval(() => slots.some(Boolean)), 30000);
  });
  await t.step('a2: 같은 방에 들어감', () => a2.joinRoom(code));
  await t.step('a(먼저 PC): «다른 PC에서 이 방에 들어왔어요» 토스트 · 방에서 나옴', async () => {
    await a.toastSeen(/다른 PC에서 이 방에 들어왔어요/, 20000);
    await t.until('a 방 밖', async () => !(await a.room()).code, 20000);
  });
  await t.step('b: 그 계정은 한 자리만 보임', async () => {
    await kit.wait(2000);
    const fr = (await b.room()).friends;
    t.eq('b 쪽 친구 수', Object.keys(fr).length, 1);
    let last = null;
    await t.until('b 화면 좌석 둘', async () => { last = await b.seats(); return last.length === 2; }).catch((e) => {
      throw new Error(e.message + ' — 좌석 ' + JSON.stringify(last.map((s) => ({ r: s.remote, f: s.friendId, x: s.x, v: s.visible }))));
    });
  });
  await t.step('a2 는 방 안 그대로', async () => t.eq('a2 방', (await a2.room()).code, code));
});
