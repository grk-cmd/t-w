// 방명록 · 웹박수 — 친구만 쓸 수 있다 · 친구가 내 홈에 글을 남기면 새 글 배지 · 내 창에서 읽으면 배지가 꺼진다 · 박수 한 번 = 1 · 쓴 사람만 지운다
'use strict';
const { scenario, assert, until, befriend, openMyHome, openChild } = require('./_kit.js');
// 방명록 창은 앱 CSP(unsafe-eval 없음)를 물려받아 waitForFunction 을 못 쓴다 — evaluate 로 되풀이해 본다(until)

scenario('guestbook', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  const TEXT = '방명록 e2e ' + Date.now().toString(36);

  await t.step('친구가 아니면 쓸 수 없다(서버 canWrite=false)', async () => {
    const r = await b.api('GET', `/v2/guestbooks/${a.me.userCode}`);
    assert(r.status === 200 && r.json.data.canWrite === false, '친구 아닌데 canWrite ' + JSON.stringify(r.json && r.json.data));
  });
  await t.step('준비: 친구 맺기(API)', () => befriend(a, b));

  await t.step('a: 마이홈을 열어 둔다(새 글 배지 듣기)', async () => {
    await openMyHome(a, 'home');
    assert(!(await a.shown('#mhGuestbookBadge')) || (await a.text('#mhGuestbookBadge')) === '', '처음부터 배지가 있음');
  });

  let gw;
  await t.step('b: a 의 마이홈 구경 → 방명록 창', async () => {
    await openMyHome(b, 'friend');
    await b.until(() => !!document.querySelector('#mhFriendList .mh-frow .mh-favatar'), null, { what: '친구 줄' });
    await b.w.click('#mhFriendList .mh-frow .mh-favatar');
    await b.until(() => /관람 중/.test(document.getElementById('mhVisitBadge').textContent), null, { what: '관람 표시' });
    gw = await openChild(b, '#mhGuestbookBtn');
    await until(gw, () => document.getElementById('gbTitleText') && /에이 님의 방명록/.test(document.getElementById('gbTitleText').textContent), null, { timeout: 15000 });
    await until(gw, () => /아직 방명록이 없어요/.test(document.getElementById('gbList').textContent), null, { timeout: 15000 });
  });

  await t.step('b: 글 남기기 → 목록 · 서버', async () => {
    await gw.fill('#gbInput', TEXT);
    await gw.click('#gbSubmit');
    await until(gw, (x) => [...document.querySelectorAll('#gbList .gb-row .gb-text')].some((e) => e.textContent === x), TEXT, { timeout: 15000 });
    const r = await a.api('GET', `/v2/guestbooks/${a.me.userCode}`);
    const en = r.json.data.entries;
    assert(en.length === 1 && en[0].text === TEXT && en[0].authorName === '비이', '서버 글 ' + JSON.stringify(en));
  });

  await t.step('b: 웹박수 한 번 → TOTAL CLAP 1', async () => {
    await gw.click('#gbClapBox');
    await until(gw, () => document.getElementById('gbClapTotal').textContent === 'TOTAL CLAP : 1', null, { timeout: 15000 });
    await t.wait(2000);   // 한 번 눌렀는데 더 올라가지 않는지
    const shown = await gw.evaluate(() => document.getElementById('gbClapTotal').textContent);
    const clap = (await b.api('GET', `/v2/guestbooks/${a.me.userCode}`)).json.data.clap;   // 오늘 남은 수는 보는 사람(b) 몫
    assert(shown === 'TOTAL CLAP : 1' && clap.count === 1, `박수 화면 ${shown} · 서버 ${clap.count}`);
    assert(clap.todayLeft === clap.dailyMax - 1, '오늘 남은 박수 ' + JSON.stringify(clap));
  });

  await t.step('a: 새 글 배지 1 → 내 방명록에서 읽으면 꺼진다', async () => {
    const n = await a.until(() => { const e = document.getElementById('mhGuestbookBadge'); return e && getComputedStyle(e).display !== 'none' && e.textContent; }, null, { timeout: 30000, what: '새 글 배지' });
    assert(n === '1', '배지 ' + n);
    const aw = await openChild(a, '#mhGuestbookBtn');
    await until(aw, (x) => [...document.querySelectorAll('#gbList .gb-row')].some((r) => r.querySelector('.gb-text').textContent === x && /비이/.test(r.querySelector('.gb-head b').textContent) && !r.querySelector('.gb-del')), TEXT, { timeout: 15000 });
    await a.until(() => { const e = document.getElementById('mhGuestbookBadge'); return !e || getComputedStyle(e).display === 'none' || e.textContent === ''; }, null, { what: '배지 꺼짐' });
    await aw.click('#gbClose');
  });

  await t.step('b: 내가 쓴 글 삭제 → 서버에서도 없다', async () => {
    await gw.click('#gbList .gb-row .gb-del');
    await until(gw, () => /아직 방명록이 없어요/.test(document.getElementById('gbList').textContent), null, { timeout: 15000 });
    const en = (await a.api('GET', `/v2/guestbooks/${a.me.userCode}`)).json.data.entries;
    assert(en.length === 0, '삭제 뒤 서버 글 ' + en.length);
  });
});
