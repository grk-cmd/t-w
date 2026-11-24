// 친구 요청 보내기(화면) → 받기(토스트 · 친구 탭 배지 · 받은 요청 목록) → 수락(목록 [수락]) → 둘 다 친구 목록에 서로가 있다
'use strict';
const { scenario, assert, wait, openMyHome, toastText } = require('./_kit.js');

scenario('friend-request-accept', async (t) => {
  const a = await t.user('a', { name: '보내는이' });
  const b = await t.user('b', { name: '받는이' });

  await t.step('a: 마이홈 › 친구 › 친구 코드로 요청 보내기', async () => {
    await openMyHome(a, 'friend');
    await a.w.click('#mhAddToggleBtn');
    await a.w.fill('#mhAddInput', b.me.friendCode);
    await a.w.click('#mhAddBtn');
    await a.until(() => /친구 요청을 보냈어요/.test(document.getElementById('toast').textContent), null, { what: '보냄 토스트' });
    assert(a.sawReq(/^POST \/v2\/me\/friend-requests 200$/), '요청 보내기 API 가 200 이 아님');
    const r = await a.api('GET', '/v2/me/friend-requests');
    assert(r.json.data.sent.some((x) => x.userCode === b.me.userCode), 'a 의 보낸 요청에 b 가 없음');
  });

  await t.step('b: 새 요청 토스트 · 친구 탭 배지', async () => {
    await b.until(() => /님이 친구 요청을 보냈어요/.test(document.getElementById('toast').textContent), null, { what: '받음 토스트' });
    const tt = await toastText(b);
    assert(tt.includes('보내는이'), '토스트에 보낸 사람 이름이 없음: ' + tt);
    const badge = await b.until(() => { const e = document.querySelector('#myHomeTabs .mh-tab[data-tab="friend"] .mh-tab-badge'); return e && e.style.display !== 'none' && e.textContent; }, null, { what: '친구 탭 배지' });
    assert(badge === '1', '배지 숫자 ' + badge);
  });

  await t.step('b: 받은 요청 목록에 a 가 보이고 [수락]', async () => {
    await openMyHome(b, 'friend');
    const names = await b.until(() => { const l = [...document.querySelectorAll('#mhFmList .mh-req .mh-req-nm')].map((e) => e.textContent); return l.length ? l : null; }, null, { what: '받은 요청 줄' });
    assert(names.length === 1 && names[0] === '보내는이', '받은 요청 줄 ' + JSON.stringify(names));
    await b.w.click('#mhFmList .mh-req button.ok');
    await b.until(() => /친구가 됐어요/.test(document.getElementById('toast').textContent), null, { what: '수락 토스트' });
  });

  await t.step('서버: 둘 다 친구 · 요청은 비었다', async () => {
    const fa = (await a.api('GET', '/v2/me/friends')).json.data.map((x) => x.userCode);
    const fb = (await b.api('GET', '/v2/me/friends')).json.data.map((x) => x.userCode);
    assert(fa.includes(b.me.userCode) && fb.includes(a.me.userCode), `친구 목록 a=${fa} b=${fb}`);
    const rb = (await b.api('GET', '/v2/me/friend-requests')).json.data;
    assert(rb.received.length === 0, 'b 받은 요청이 남음');
  });

  await t.step('화면: 두 사람 친구 목록에 서로가 온라인으로', async () => {
    // 새 친구 줄은 이름을 받기 전까지 자리표시(friends-sub.js FRIEND_BLANK '...')로 먼저 그려진다 — 이름이 찬 뒤에 본다
    const rowB = await b.until(() => { const r = document.querySelector('#mhFriendList .mh-frow .mh-fname'); return r && !r.textContent.startsWith('...') && r.textContent; }, null, { what: 'b 친구 줄' });
    assert(rowB.startsWith('보내는이'), 'b 친구 줄 ' + rowB);
    const head = await b.text('#mhFriendHeadCount');
    assert(head === '(1/100)', 'b 친구 수 ' + head);
    // a 는 마이홈이 열린 채 — 수락 알림(realtime)으로 목록이 바뀌어야 한다
    const rowA = await a.until(() => { const r = document.querySelector('#mhFriendList .mh-frow:not(.off) .mh-fname'); return r && !r.textContent.startsWith('...') && r.textContent; }, null, { what: 'a 친구 줄(온라인)' });
    assert(rowA.startsWith('받는이'), 'a 친구 줄 ' + rowA);
    await b.until(() => { const e = document.querySelector('#myHomeTabs .mh-tab[data-tab="friend"] .mh-tab-badge'); return !e || e.style.display === 'none'; }, null, { timeout: 15000, what: '수락 뒤 친구 탭 배지 꺼짐' });
  });
  await wait(0);
});
