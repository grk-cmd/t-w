// 친구 마이홈 구경(친구 목록 사진 누르기) · 친구 방 놀러 가기(방 코드 누르기 → «놀러 갈까요?» → 같은 방)
'use strict';
const { scenario, assert, befriend, openMyHome, makeCharacter, createRoom } = require('./_kit.js');

scenario('friend-visit', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  await t.step('준비: 친구 맺기(API)', () => befriend(a, b));

  await t.step('b: 친구 사진 → a 마이홈 구경', async () => {
    await openMyHome(b, 'friend');
    await b.until(() => !!document.querySelector('#mhFriendList .mh-frow .mh-favatar'), null, { what: '친구 줄' });
    await b.w.click('#mhFriendList .mh-frow .mh-favatar');
    await b.until(() => /관람 중/.test((document.getElementById('mhVisitBadge') || {}).textContent || ''), null, { what: '관람 표시' });
    await b.until(() => document.getElementById('mhMyName').textContent === '에이', null, { what: '구경하는 홈 이름 «에이»' });
    assert(await b.shown('#mhBackHomeBtn'), '내 홈으로 버튼');
    assert(b.sawReq(new RegExp(`^GET /v2/myhomes/${a.me.userCode} 200$`)), '친구 홈 읽기 API');
  });

  await t.step('b: 내 홈으로 돌아오기', async () => {
    await b.w.click('#mhBackHomeBtn');
    await b.until(() => getComputedStyle(document.getElementById('mhBackHomeBtn')).display === 'none', null, { what: '돌아옴' });
  });

  let code;
  await t.step('준비: 두 사람 캐릭터 · a 가 워킹룸을 만든다', async () => {
    await b.w.keyboard.press('Escape');
    await makeCharacter(a);
    await makeCharacter(b);
    code = await createRoom(a);
    t.note('방 ' + code);
  });

  await t.step('b: 친구 줄의 방 코드 → 놀러 가기 → 같은 방', async () => {
    await openMyHome(b, 'friend');
    await b.until(() => { const r = document.querySelector('#mhFriendList .mh-frow'); return r && /🏠/.test(r.textContent); }, null, { timeout: 30000, what: '🏠 표시' });
    await b.w.click('#mhFriendList .mh-frow');
    const pill = await b.until(() => { const e = document.querySelector('#mhFriendList .mh-fpill-code.go'); return e && e.textContent; }, null, { what: '방 코드' });
    assert(pill === code, `친구 줄 방 코드 ${pill} ≠ ${code}`);
    await b.w.click('#mhFriendList .mh-fpill-code.go');
    const q = await b.until(() => { const e = document.getElementById('fvQ'); return e && e.textContent; }, null, { what: '놀러 가기 창' });
    assert(q === '에이 님이 있는 룸에 놀러 갈까요?', '물음 ' + q);
    await b.w.click('[role="alertdialog"] [data-a="ok"]');
    const got = await b.until(() => (typeof Presence !== 'undefined' && Presence.active() && Presence.roomCode()) || null, null, { timeout: 30000, what: 'b 방 입장' });
    assert(got === code, `b 가 들어간 방 ${got} ≠ ${code}`);
  });
});
