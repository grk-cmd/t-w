// 친구 목록(이름 · 레벨 · 온라인 묶음 · 수 · Ctrl+F 검색) · 친구 끊기(✕ → 확인) — 양쪽 서버 목록과 상대 화면에서 사라진다
'use strict';
const { scenario, assert, befriend, openMyHome } = require('./_kit.js');

scenario('friend-list-remove', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  await t.step('준비: 친구 맺기(API)', () => befriend(a, b));

  await t.step('a: 친구 목록에 b — 이름 · Lv · 온라인 묶음 · (1/100)', async () => {
    await openMyHome(a, 'friend');
    await openMyHome(b, 'friend');
    const row = await a.until(() => { const r = document.querySelector('#mhFriendList .mh-frow'); return r && { cls: r.className, name: r.querySelector('.mh-fname').textContent, sub: r.querySelector('.mh-fsub').textContent }; }, null, { what: '친구 줄' });
    assert(row.name.startsWith('비이') && /Lv\s*1/.test(row.name), '이름 · 레벨 ' + row.name);
    assert(!/\boff\b/.test(row.cls) && row.sub === '온라인', '온라인 표시 ' + JSON.stringify(row));
    assert((await a.text('#mhFriendList .mh-fgroup')) === '온라인 — 1', '묶음 머리');
    assert((await a.text('#mhFriendHeadCount')) === '(1/100)', '친구 수');
  });

  await t.step('a: 검색 — 맞는 이름만 남는다', async () => {
    await a.w.keyboard.press('Control+f');
    await a.w.locator('#mhFriendSearchInput').waitFor({ state: 'visible', timeout: 5000 });
    await a.w.fill('#mhFriendSearchInput', '없는이름');
    await a.until(() => document.querySelectorAll('#mhFriendList .mh-frow').length === 0, null, { what: '검색 0줄' });
    await a.w.fill('#mhFriendSearchInput', '비');
    await a.until(() => document.querySelectorAll('#mhFriendList .mh-frow').length === 1, null, { what: '검색 1줄' });
    await a.w.click('#mhFriendSearchClear');
  });

  await t.step('a: ✕ → 확인 → 끊김', async () => {
    await a.w.hover('#mhFriendList .mh-frow');   // ✕ 는 줄에 마우스를 올려야 보인다
    await a.w.click('#mhFriendList .mh-frow .mh-fremove');
    await a.until(() => document.querySelectorAll('#mhFriendList .mh-frow').length === 0, null, { what: 'a 목록 비움' });
    assert(a.dialogs.some((d) => d.includes('삭제할까요')), '확인 창이 안 떴음 ' + JSON.stringify(a.dialogs));
    assert(a.sawReq(new RegExp(`^DELETE /v2/me/friends/${b.me.userCode} 20\\d$`)), '끊기 API');
    const fa = (await a.api('GET', '/v2/me/friends')).json.data;
    const fb = (await b.api('GET', '/v2/me/friends')).json.data;
    assert(fa.length === 0 && fb.length === 0, `서버 친구 a=${fa.length} b=${fb.length}`);
  });

  await t.step('b: 열린 친구 목록에서도 a 가 사라진다(realtime 알림)', async () => {
    await b.until(() => document.querySelectorAll('#mhFriendList .mh-frow').length === 0, null, { what: 'b 목록 비움' });
    assert((await b.text('#mhFriendHeadCount')) === '(0/100)', 'b 친구 수');
  });
});
