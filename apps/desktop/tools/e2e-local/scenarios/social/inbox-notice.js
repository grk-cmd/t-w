// 📩 알림함 — 관리자 우편 한 통(받는 사람에게만) · 📢 소식(모두에게 공지) · 안 읽은 수 · 펼치면 읽음 · × 지우기
// 보내는 쪽은 관리자 API(웹 관리자와 같은 길) — 관리자 계정은 seed/social.sql 로 만든다
'use strict';
const { scenario, assert, openMyHome, makeAdmin } = require('./_kit.js');

scenario('inbox-notice', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '받는이' });
  const tag = Date.now().toString(36);
  const MAIL = '우편 e2e ' + tag, NEWS = '공지 e2e ' + tag;
  await t.step('준비: a 를 관리자로', () => makeAdmin(a));
  const mine = async () => (await b.api('GET', '/v2/me/notifications?section=MAIL&limit=50')).json.data;
  const find = (d, title) => (d.items || d.notifications || d).find((x) => x.title === title);

  await t.step('b: 알림함을 열어 둔다', async () => {
    await openMyHome(b, 'mail');
    await b.w.click('#mhInboxRail .mh-ibx-sec[data-sec="mail"]');
  });

  await t.step('관리자 → b 우편 한 통 → b 우편 칸에 안 읽은 카드', async () => {
    const r = await a.api('POST', `/v2/admin/users/${b.me.userCode}/mail`, { requestId: 'e2e-mail-' + tag, title: MAIL, body: '본문 ' + tag });
    assert(r.status === 200, '우편 보내기 ' + r.status + ' ' + JSON.stringify(r.json));
    await b.until((x) => [...document.querySelectorAll('#mhInboxList .mh-ibx-card.unread .mh-ibx-title')].some((e) => e.textContent === x), MAIL, { timeout: 30000, what: '우편 카드' });
    const n = await b.eval(() => { const e = document.querySelector('#mhInboxRail .mh-ibx-sec[data-sec="mail"] .mh-ibx-secn'); return e && e.style.display !== 'none' ? e.textContent : '0'; });
    assert(n === '1', '우편 안 읽은 수 ' + n);
    const mineA = (await a.api('GET', '/v2/me/notifications?section=MAIL&limit=50')).json.data;
    assert(!find(mineA, MAIL), '받는 사람이 아닌 a 에게도 우편이 감');
  });

  await t.step('b: 카드를 펼치면 읽음 → 서버 read', async () => {
    await b.w.locator('#mhInboxList .mh-ibx-card', { hasText: MAIL }).click();
    await b.until((x) => [...document.querySelectorAll('#mhInboxList .mh-ibx-card.read .mh-ibx-title')].some((e) => e.textContent === x), MAIL, { what: '읽음 카드' });
    let m;
    for(let i = 0; i < 20; i++){ m = find(await mine(), MAIL); if(m && m.readAt) break; await t.wait(300); }
    assert(m && !!m.readAt, '서버 읽음 ' + JSON.stringify(m));
  });

  await t.step('b: × 지우기 → 서버에서도 없다', async () => {
    await b.w.locator('#mhInboxList .mh-ibx-card', { hasText: MAIL }).locator('.mh-ibx-x').click();
    await b.until((x) => ![...document.querySelectorAll('#mhInboxList .mh-ibx-title')].some((e) => e.textContent === x), MAIL, { what: '카드 사라짐' });
    let m = true;
    for(let i = 0; i < 20; i++){ m = find(await mine(), MAIL); if(!m) break; await t.wait(300); }
    assert(!m, '지운 우편이 서버에 남음');
  });

  await t.step('관리자 공지(소식) → b 📢 소식 칸', async () => {
    const r = await a.api('POST', '/v2/admin/notices/broadcasts', { requestId: 'e2e-news-' + tag, tag: 'NOTICE', title: NEWS, body: '공지 본문 ' + tag });
    assert(r.status === 200, '공지 올리기 ' + r.status + ' ' + JSON.stringify(r.json));
    await b.w.click('#mhInboxRail .mh-ibx-sec[data-sec="news"]');
    await b.until((x) => [...document.querySelectorAll('#mhNewsList .mh-news-item.unread .mh-news-title')].some((e) => e.textContent === x), NEWS, { timeout: 75000, what: '소식 줄' });   // 전체 공지는 realtime 이 모두에게 0~60초 사이로 흩어 보낸다(ALL_NOTIFY_SPREAD_MS) — 그보다 길게 기다린다
    await b.w.locator('#mhNewsList .mh-news-item', { hasText: NEWS }).click();
    await b.until((x) => [...document.querySelectorAll('#mhNewsList .mh-news-item.read .mh-news-title')].some((e) => e.textContent === x), NEWS, { what: '소식 읽음' });
    const body = await b.text('#mhNewsView');
    assert(body && body.includes('공지 본문 ' + tag), '소식 본문 ' + (body || '').slice(0, 100));
  });
});
