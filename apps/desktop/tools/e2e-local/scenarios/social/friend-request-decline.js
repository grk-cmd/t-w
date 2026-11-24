// 친구 요청 거절 두 길(마이홈이 열려 있을 때 뜨는 팝업 [거절] · 받은 요청 목록 [거절]) · 보낸 요청 취소
'use strict';
const { scenario, assert, openMyHome } = require('./_kit.js');

scenario('friend-request-decline', async (t) => {
  const a = await t.user('a', { name: '보내는이' });
  const b = await t.user('b', { name: '받는이' });
  const send = () => a.api('POST', '/v2/me/friend-requests', { to: b.me.userCode });
  const empty = async () => {
    const ra = (await a.api('GET', '/v2/me/friend-requests')).json.data;
    const rb = (await b.api('GET', '/v2/me/friend-requests')).json.data;
    const fa = (await a.api('GET', '/v2/me/friends')).json.data;
    return ra.sent.length === 0 && rb.received.length === 0 && fa.length === 0;
  };

  await t.step('b 가 마이홈(홈 탭)을 보는 중 요청이 오면 팝업 → [거절]', async () => {
    await openMyHome(b, 'home');
    const s = await send();
    assert(s.status === 200, '요청 보내기 ' + s.status);
    const txt = await b.until(() => { const o = document.querySelector('.friend-req-popup-ov'); return o && o.textContent; }, null, { what: '요청 팝업' });
    assert(txt.includes('보내는이'), '팝업 글 ' + txt);
    await b.w.click('.friend-req-popup-ov [data-a="no"]');
    await b.until(() => !document.querySelector('.friend-req-popup-ov'), null, { what: '팝업 닫힘' });
    for(let i = 0; i < 20 && !(await empty()); i++) await t.wait(300);
    assert(await empty(), '거절 뒤 요청 · 친구가 남음');
    assert(b.sawReq(new RegExp(`^POST /v2/me/friend-requests/${a.me.userCode}/reject 20\\d$`)), '거절 API 를 안 부름');
  });

  await t.step('받은 요청 목록 [거절]', async () => {
    await openMyHome(b, 'friend');
    const s = await send();
    assert(s.status === 200, '요청 보내기 ' + s.status);
    // 목록을 보고 있으면 팝업 없이 줄만 생긴다
    await b.until(() => document.querySelectorAll('#mhFmList .mh-req').length === 1, null, { what: '받은 요청 줄' });
    assert(!(await b.eval(() => !!document.querySelector('.friend-req-popup-ov'))), '목록을 보는 중인데 팝업이 떴음');
    await b.w.click('#mhFmList .mh-req .mh-req-btns button:not(.ok)');
    await b.until(() => !document.querySelector('#mhFmList .mh-req'), null, { what: '줄 사라짐' });
    for(let i = 0; i < 20 && !(await empty()); i++) await t.wait(300);
    assert(await empty(), '거절 뒤 요청 · 친구가 남음');
  });

  await t.step('a: 보낸 요청 탭에서 취소', async () => {
    const s = await send();
    assert(s.status === 200, '요청 보내기 ' + s.status);
    await openMyHome(a, 'friend');
    await a.w.click('#mhFmTabs .mh-ibx-tab[data-fm="sent"]');
    const txt = await a.until(() => { const l = document.getElementById('mhFmList'); return l && /받는이/.test(l.textContent) && l.textContent; }, null, { what: '보낸 요청 줄' });
    const btn = a.w.locator('#mhFmList button', { hasText: '취소' }).first();
    await btn.click();
    for(let i = 0; i < 20 && !(await empty()); i++) await t.wait(300);
    assert(await empty(), '취소 뒤 요청이 남음 — ' + txt.slice(0, 80));
    await b.until(() => !document.querySelector('#mhFmList .mh-req'), null, { what: 'b 목록에서도 사라짐' });
  });
});
