// 시크릿룸(관리자 발급 · 주인이 열고 · 손님은 «코드*» 로) · 별표 없이 넣으면 다른 방 · 방장의 채팅 잠금
'use strict';
const kit = require('./_kit.js');

kit.scenario(__filename, async (t) => {
  const a = await t.user('a');
  const b = await t.user('b');
  await t.step('a: 관리자로', () => a.makeAdmin());
  const sr = await t.step('a: 시크릿룸 발급(관리자 API · 주인 a)', async () => {
    const r = await a.api('POST', '/v2/admin/secret-rooms', { requestId: 'e2e-' + Date.now(), ownerUserCode: a.code, name: 'e2e 비밀방', months: 1 });
    t.eq('발급 응답 ' + JSON.stringify(r.body).slice(0, 200), r.status, 200);
    return r.body.data;
  });
  const code = sr.code, body = code.slice(5);
  t.note('시크릿룸 ' + code);
  await t.step('a: 다시 켜서 «내 시크릿룸» 을 읽음(로그인마다 한 번)', async () => {
    await a.relaunch();
    await t.until('내 시크릿룸', async () => { const r = await a.api('GET', '/v2/me/secret-room'); return r.status === 200 && r.body.data && r.body.data.code === code; });
  });
  await t.step('a: 로비 «내 시크릿룸» 줄 → 바로 들어가기', async () => {
    await a.openLobby();
    await t.until('내 시크릿룸 줄', () => a.shown('#lobbySecret'), 15000);
    await a.w.click('#lobbySecretJoin');
    await t.until('a 가 시크릿룸에', async () => { const r = await a.room(); return r.code === code && !!r.meta; }, 30000);
    await a.closeLobby();
    t.eq('meta.secret', (await a.room()).meta.secret, true);
    t.eq('방장', (await a.room()).host, a.code);
  });
  await t.step('공개 로비 목록에 안 나옴', async () => {
    for(const ch of ['workingroom', 'togetherroom']){
      const r = await b.api('GET', '/v2/rooms/lobby?channel=' + ch);
      t.ok(ch + ' 목록에 없음', !JSON.stringify(r.body).includes(body));
    }
  });
  await t.step('b: 별표 없이 «' + body + '» → 시크릿룸이 아닌 다른 방', async () => {
    await b.openLobby();
    await b.eval((c) => { const el = document.getElementById('inviteCode'); el.value = c; el.dispatchEvent(new Event('input')); }, body);
    await b.w.click('#inviteJoin');
    const got = await t.until('b 방 코드', async () => (await b.room()).code, 30000);
    t.ok('다른 방 ' + got, got !== code && !/^SCRT-/.test(got));
    await b.closeLobby();
    await b.leaveRoom();
  });
  await t.step('b: «' + body + '*» → 시크릿룸에 손님으로', async () => {
    await b.joinRoom(body + '*', code);
    await t.until('a 쪽 친구 1', async () => Object.keys((await a.room()).friends).length === 1);
  });
  await t.step('둘 다 대화창 · 처음엔 채팅 켜짐', async () => {
    for(const u of [a, b]) await u.openChat();
    t.eq('a 토글', await a.text('#chatOffToggle'), '채팅 켜짐');
    t.eq('b 토글은 표시만', await b.eval(() => document.getElementById('chatOffToggle').classList.contains('readonly')), true);
    const m = '잠금전' + Date.now();
    await b.say(m);
    await t.until('a 가 받음', async () => (await a.chatText()).includes(m), 15000);
  });
  await t.step('a(방장): 채팅 잠금 → b 화면에도 «채팅 꺼짐»', async () => {
    await a.w.click('#chatOffToggle');
    await t.until('b meta.chatOff', async () => (await b.room()).meta.chatOff === true, 15000);
    await t.until('b 토글 글', async () => (await b.text('#chatOffToggle')) === '채팅 꺼짐', 10000);
    t.ok('b 입력칸 안내', /만 쓸 수 있어요/.test(await b.eval(() => document.getElementById('chatInput').placeholder)));
  });
  await t.step('잠긴 동안 b 의 글은 a 에게 안 감', async () => {
    const m = '잠금중' + Date.now();
    await b.say(m);
    await kit.wait(4000);
    t.ok('a 대화창에 없음', !(await a.chatText()).includes(m));
  });
  await t.step('a: 잠금 풀기 → b 글이 다시 감', async () => {
    await a.w.click('#chatOffToggle');
    await t.until('b meta.chatOff false', async () => (await b.room()).meta.chatOff === false, 15000);
    const m = '풀림' + Date.now();
    await b.say(m);
    await t.until('a 가 받음', async () => (await a.chatText()).includes(m), 15000);
  });
});
