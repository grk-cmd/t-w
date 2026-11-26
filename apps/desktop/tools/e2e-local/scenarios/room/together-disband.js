// 투게더룸(프리미엄 방) — 라이선스 없는 사람은 못 열고 손님으로만 · 방장이 나가고 이어받을 보유자가 없으면 해산
'use strict';
const kit = require('./_kit.js');

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  await t.step('b(라이선스 없음): 방 만들기 창의 투게더룸은 잠김', async () => {
    await b.openLobby();
    await b.w.click('#lobbyCreate');
    await b.w.locator('#roomCreatePanel').waitFor({ state: 'visible', timeout: 10000 });
    t.eq('투게더룸 단추 꺼짐', await b.eval(() => document.getElementById('rcChTogether').disabled), true);
    await b.w.click('#rcCreate');
    const r = await t.until('b 방', async () => (await b.room()).meta, 30000);
    t.eq('b 가 연 방은 워킹룸', r.channel, 'workingroom');
    await b.closeLobby();
    await b.leaveRoom();
  });
  await t.step('a: 관리자(프리미엄)로', () => a.makeAdmin());
  const code = await t.step('a: 투게더룸 만들기', () => a.createRoom({ channel: 'together', title: '함께' }));
  await t.step('투게더룸 — PLAY- 코드 · 채널 · 대화창 버튼', async () => {
    t.ok('PLAY- ' + code, /^PLAY-/.test(code));
    t.eq('채널', (await a.room()).meta.channel, 'togetherroom');
  });
  await t.step('b: 손님으로 참여 · 대화창이 열림', async () => {
    await b.joinRoom(code);
    t.eq('b 채널', await b.eval(() => window._activeChannel), 2);
    await b.openChat();
  });
  await t.step('a(방장) 가 나가면 이어받을 보유자가 없어 해산 — b 토스트 · 방 밖', async () => {
    await a.leaveRoom();
    await b.toastSeen(/해산/, 20000);
    await t.until('b 방 밖', async () => !(await b.room()).code, 20000);
    t.eq('b 대화창 닫힘', await b.shown('#chatOverlay'), false);
  });
});
