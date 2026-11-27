// 마이홈 바탕화면(환경 설정 › 폴더 숨기기 — 서버 저장 · 친구가 구경할 때도 숨김) · 📚 책장 북마크(꽂기 · 공개 책만 친구에게)
'use strict';
const { scenario, assert, befriend, openMyHome } = require('./_kit.js');

scenario('myhome-desktop', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  await t.step('준비: 친구 맺기(API)', () => befriend(a, b));
  const visit = async () => {
    await openMyHome(b, 'friend');
    if(await b.shown('#mhBackHomeBtn')){ await b.w.click('#mhBackHomeBtn'); await openMyHome(b, 'friend'); }
    await b.until(() => !!document.querySelector('#mhFriendList .mh-frow .mh-favatar'), null, { what: '친구 줄' });
    await b.w.click('#mhFriendList .mh-frow .mh-favatar');
    await b.until(() => /관람 중/.test(document.getElementById('mhVisitBadge').textContent), null, { what: '관람 표시' });
    await t.wait(1000);
  };

  await t.step('a: 환경 설정 › 폴더 숨기기 → 아이콘이 사라지고 서버에 저장', async () => {
    await openMyHome(a, 'home');
    await a.until(() => !!document.getElementById('mhdIcon_bookmark'), null, { what: '북마크 아이콘' });
    await a.w.click('#advEnvBtn');
    await a.w.click('#advEnvHideFolders');
    await a.until(() => { const e = document.getElementById('mhdIcon_bookmark'); return !e || getComputedStyle(e).display === 'none' || !e.offsetParent; }, null, { what: '아이콘 숨김' });
    let desk;
    for(let i = 0; i < 20; i++){ desk = (await a.api('GET', '/v2/me/myhome')).json.data.desktop; if(desk.hideFolders) break; await t.wait(300); }
    assert(desk.hideFolders === true, '서버 hideFolders ' + JSON.stringify(desk));
  });

  await t.step('b: a 의 홈을 구경하면 폴더가 숨겨져 있다', async () => {
    await visit();
    const shown = await b.shown('#mhdIcon_bookmark');
    assert(!shown, '구경하는 쪽에 폴더가 보임');
  });

  await t.step('a: 폴더 다시 보이기', async () => {
    await a.w.click('#advEnvBtn');
    await a.w.click('#advEnvHideFolders');
    await a.until(() => { const e = document.getElementById('mhdIcon_bookmark'); return e && getComputedStyle(e).display !== 'none' && !!e.offsetParent; }, null, { what: '아이콘 다시' });
    let desk;
    for(let i = 0; i < 20; i++){ desk = (await a.api('GET', '/v2/me/myhome')).json.data.desktop; if(!desk.hideFolders) break; await t.wait(300); }
    assert(desk.hideFolders === false, '서버 hideFolders ' + JSON.stringify(desk));
  });

  const addBook = async (url, title, pub) => {
    await a.w.click('#bmAdd');
    await a.w.locator('input[placeholder="https://"]').fill(url);
    await a.w.locator('input[placeholder="책등에 세로로 (14자)"]').fill(title);
    if(pub) await a.w.locator('label', { hasText: '마이홈 방문자에게 공개' }).locator('input').check();
    await a.w.locator('.app-popup-ov', { hasText: '📚 책 꽂기' }).getByRole('button', { name: '저장', exact: true }).click();
    await a.until((x) => [...document.querySelectorAll('.bm-cell .bm-t')].some((e) => e.textContent === x), title, { what: '책 ' + title });
  };

  await t.step('a: 북마크(책장) 열기 → 공개 책 · 비공개 책 꽂기 → 서버', async () => {
    await a.w.dblclick('#mhdIcon_bookmark');
    await a.w.locator('#bmAdd').waitFor({ state: 'visible', timeout: 10000 });
    await addBook('https://example.com/pub', '공개책', true);
    await addBook('https://example.com/secret', '비밀책', false);
    let books;
    for(let i = 0; i < 20; i++){
      const d = (await a.api('GET', '/v2/me/myhome/bookshelf')).json.data;
      books = d.books || d.items || d;
      if(Array.isArray(books) && books.length === 2) break;
      await t.wait(300);
    }
    assert(Array.isArray(books) && books.length === 2, '서버 책장 ' + JSON.stringify(books).slice(0, 300));
    const pubBook = books.find((x) => x.title === '공개책');
    assert(pubBook && pubBook.public === true && pubBook.url === 'https://example.com/pub', '공개책 ' + JSON.stringify(pubBook));
  });

  await t.step('b: 구경하는 a 의 책장에는 공개 책만', async () => {
    const r = await b.api('GET', `/v2/myhomes/${a.me.userCode}/bookshelf`);
    const list = JSON.stringify(r.json.data);
    assert(list.includes('공개책') && !list.includes('비밀책'), '친구가 받은 책장 ' + list.slice(0, 300));
    await visit();
    await b.w.dblclick('#mhdIcon_bookmark');
    const titles = await b.until(() => { const l = [...document.querySelectorAll('.bm-cell .bm-t')].map((e) => e.textContent); return l.length ? l : null; }, null, { what: '구경 책장' });
    assert(titles.length === 1 && titles[0] === '공개책', '구경 책장 ' + JSON.stringify(titles));
    assert(!(await b.shown('#bmAdd')), '구경하는 쪽에 [+ 추가] 가 보임');
  });
});
