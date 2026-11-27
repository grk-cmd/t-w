// 방 설정(방장만 · 제목 · 공개) · 방장이 나가면 남은 사람이 방장 · 다시 들어와도 방장은 그대로
'use strict';
const kit = require('./_kit.js');

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  const code = await t.step('a: 방 만들기(공개)', () => a.createRoom({ title: '처음 제목' }));
  await t.step('b: 방 코드로 참여', () => b.joinRoom(code));
  await t.step('b(방장 아님): [방 설정] 안 보임', async () => {
    await b.openLobby();
    await t.until('b 제목 줄', async () => (await b.text('#riTitle')) === '처음 제목');
    t.eq('b 의 [방 설정]', await b.shown('#riEdit'), false);
    await b.closeLobby();
  });
  const title2 = '바꾼제목' + String(Date.now()).slice(-4);
  await t.step('a: [방 설정] 에서 제목 바꾸고 비공개로 저장', async () => {
    await a.openLobby();
    await a.w.click('#riEdit');
    await a.w.locator('#riPanel').waitFor({ state: 'visible', timeout: 10000 });
    await a.w.fill('#riTitleIn', title2);
    await a.w.uncheck('#riOpen');
    await a.w.click('#riSave');
    await t.until('a meta 제목', async () => (await a.room()).meta.title === title2, 15000);
    await a.closeLobby();
  });
  await t.step('b: 바뀐 제목 · 비공개를 받음', async () => {
    await t.until('b meta', async () => { const m = (await b.room()).meta; return m.title === title2 && m.open === false; }, 15000);
    await b.openLobby();
    await t.until('b 제목 줄', async () => (await b.text('#riTitle')) === title2);
    await b.closeLobby();
  });
  await t.step('비공개라 로비 목록에 안 나옴(서버 로비 API)', async () => {
    const r = await b.api('GET', '/v2/rooms/lobby?channel=workingroom');
    t.eq('로비 응답', r.status, 200);
    t.ok('목록에 ' + code + ' 이 없어야: ' + JSON.stringify(r.body).slice(0, 300), !JSON.stringify(r.body).includes(code.slice(5)));
  });
  await t.step('a 가 나가면 b 가 방장(«내가 새 방장이 됐어요»)', async () => {
    await a.leaveRoom();
    await t.until('b 방장', async () => (await b.room()).host === b.code, 20000);
    await b.toastSeen(/새 방장/);
    await b.openLobby();
    await t.until('b [방 설정] 보임', () => b.shown('#riEdit'));
    await b.closeLobby();
  });
  await t.step('a 가 다시 들어와도 방장은 b', async () => {
    await a.joinRoom(code);
    await kit.wait(1500);
    t.eq('a 가 본 방장', (await a.room()).host, b.code);
    t.eq('a 의 제목', (await a.room()).meta.title, title2);
  });
  await t.step('b 가 나가면 다시 a 가 방장', async () => {
    await b.leaveRoom();
    await t.until('a 방장', async () => (await a.room()).host === a.code, 20000);
  });
});
