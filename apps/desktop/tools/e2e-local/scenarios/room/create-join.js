// 방 만들기 · 참여(로비 카드) · 서로 보이기 · 이름 · 레벨은 서버 값(이름 없으면 «이름 없음») · 최근 방 · 나가기
'use strict';
const kit = require('./_kit.js');

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  const title = '방시험' + String(Date.now()).slice(-5);
  const code = await t.step('a: 로비 [방 만들기] — 제목 · 공개', () => a.createRoom({ title }));
  t.note('방 코드 ' + code);
  await t.step('a: 방장 · 제목 줄', async () => {
    const r = await a.room();
    t.eq('방장', r.host, a.code);
    t.eq('meta.title', r.meta.title, title);
    t.eq('meta.open', r.meta.open, true);
    await a.openLobby();
    await t.until('제목 줄', async () => (await a.text('#riTitle')) === title);
    t.ok('방장에게 [방 설정] 이 보임', await a.shown('#riEdit'));
    await a.closeLobby();
  });
  await t.step('b: 로비 목록에 그 방 카드 → 눌러 들어감', async () => {
    await b.openLobby();
    const card = b.w.locator('#lobbyGrid .lb-card', { hasText: title });
    await card.waitFor({ state: 'visible', timeout: 15000 });
    await card.click();
    await t.until('b 가 그 방에', async () => (await b.room()).code === code, 30000);
    await b.closeLobby();
  });
  await t.step('둘이 서로 보임 · 서버가 준 이름 · 레벨', async () => {
    await t.until('a 쪽 친구 1', async () => Object.keys((await a.room()).friends).length === 1);
    await t.until('b 쪽 친구 1', async () => Object.keys((await b.room()).friends).length === 1);
    const fa = Object.values((await a.room()).friends)[0], fb = Object.values((await b.room()).friends)[0];
    t.eq('a 가 본 b 이름(없음)', fa.name, null);
    t.eq('b 가 본 a 레벨', fb.level, 1);
    t.eq('b 가 본 방장', (await b.room()).host, a.code);
    await a.desk();
    await b.desk();
    await t.until('a 화면에 좌석 둘', async () => (await a.seats()).length === 2);
    await t.until('b 화면 남의 좌석 이름표 «이름 없음»', async () => {
      const r = (await b.seats()).find((s) => s.remote);
      return r && /Lv\.1\s*이름 없음/.test(r.plate || '');
    });
  });
  await t.step('a 이름을 바꾸면 b 화면 이름표가 서버 이름으로', async () => {
    const me = await a.whoami();
    const name = '에이' + String(Date.now()).slice(-3);
    const r = await a.api('PATCH', '/v2/me', { displayName: name, version: me.version });
    t.eq('PATCH /v2/me', r.status, 200);
    await t.until('b 가 받은 이름', async () => Object.values((await b.room()).friends)[0].name === name, 30000);
    await t.until('b 화면 이름표', async () => ((await b.seats()).find((s) => s.remote) || {}).plate?.includes(name), 15000);
  });
  await t.step('b: 최근 방에 남음', async () => {
    const recent = await b.eval(() => roomEntryMod && JSON.parse(localStorage.getItem('tw.recentRooms.' + getMyUserId()) || '[]'));
    t.ok('최근 방 ' + JSON.stringify(recent), JSON.stringify(recent).includes(code));
  });
  await t.step('b: [나가기] → a 쪽에서 사라짐', async () => {
    await b.leaveRoom();
    await t.until('a 쪽 친구 0', async () => Object.keys((await a.room()).friends).length === 0, 20000);
    await t.until('a 화면 좌석 하나', async () => (await a.seats()).length === 1);
  });
});
