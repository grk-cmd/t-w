// 🧸 말랑이 등록(라이선스) · 폴더 누르면 소환 · 친구에게 선물(친구 줄 우클릭) · 받은 쪽 선물함
// 서버가 그림을 올리고(POST /v2/me/images) 선물 사본을 만드는 길은 Storage 에뮬레이터에 붙은 로컬 서버로 끝까지 간다 — 503 이면 실패다
'use strict';
const { scenario, assert, befriend, openMyHome, makeAdmin, pngFile, stubFileDialog } = require('./_kit.js');

scenario('mallang-gift', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  await t.step('준비: 친구 맺기(API)', () => befriend(a, b));

  await t.step('라이선스 없으면 말랑이 폴더가 없다', async () => {
    await openMyHome(a, 'home');
    await t.wait(1500);
    assert(!(await a.shown('#mlFolder')), '라이선스 없는데 말랑이 폴더가 보임');
  });

  await t.step('준비: a 를 관리자(프리미엄)로 — seed/social.sql · 다시 켜기', () => makeAdmin(a));

  await t.step('a: 말랑이 폴더 우클릭 → 칸 → 그림 등록 → 서버 칸 1', async () => {
    await openMyHome(a, 'home');
    await a.until(() => !!document.getElementById('mlFolder') && getComputedStyle(document.getElementById('mlFolder')).display !== 'none', null, { what: '말랑이 폴더' });
    await stubFileDialog(a, await pngFile(a, 'mallang.png', '#ff8fb0'));
    await a.w.click('#mlFolder', { button: 'right' });
    await a.w.locator('#mlManage .ml-slot').first().waitFor({ state: 'visible', timeout: 10000 });
    await a.w.locator('#mlManage .ml-slot').first().click();
    const tt = await a.until(() => /말랑이가 등록됐어요|오류 E-GIFT-0/.test(document.getElementById('toast').textContent) && document.getElementById('toast').textContent, null, { what: '등록 결과 토스트' });
    assert(/말랑이가 등록됐어요/.test(tt), '등록 실패 ' + tt + ' · ' + a.A.reqs.filter((l) => /images|mallangs/.test(l)).join(','));
    assert(a.sawReq(/^POST \/v2\/me\/images 200$/), '그림 올리기 API');
    const slots = (await a.api('GET', '/v2/me/mallangs')).json.data.slots;
    assert(slots.length === 1 && slots[0].imageUrl, '서버 칸 ' + JSON.stringify(slots));
    await a.w.click('#mlManageClose');
  });

  await t.step('a: 폴더 누르기 → 말랑이가 나온다', async () => {
    const before = await a.eval(() => document.querySelectorAll('#myHomeWin img').length);
    await a.w.click('#mlFolder');
    await a.until((n) => document.querySelectorAll('#myHomeWin img').length > n, before, { what: '말랑이 그림' });
  });

  await t.step('a: 친구 줄 우클릭 → 선물 창 → 말랑이 보내기', async () => {
    await openMyHome(a, 'friend');
    await a.until(() => !!document.querySelector('#mhFriendList .mh-frow'), null, { what: '친구 줄' });
    await a.w.click('#mhFriendList .mh-frow', { button: 'right' });
    await a.w.locator('#mlGift .ml-gcell').first().waitFor({ state: 'visible', timeout: 15000 });
    const note = await a.text('#mlGift .ml-note');
    assert(/오늘 남은 횟수/.test(note), '선물 창 안내 ' + note);
    await a.w.locator('#mlGift .ml-gcell').first().click();
    const tt = await a.until(() => /말랑이를 보냈어요|오류 E-GIFT-08/.test(document.getElementById('toast').textContent) && document.getElementById('toast').textContent, null, { what: '보내기 결과' });
    assert(/말랑이를 보냈어요/.test(tt), '보내기 실패 ' + tt + ' · ' + a.A.reqs.filter((l) => /\/v2\/gifts/.test(l)).join(','));
    const sent = (await a.api('GET', '/v2/me/gifts/sent-today')).json.data;
    assert(sent.count === 1, '오늘 보낸 수 ' + JSON.stringify(sent));
  });

  await t.step('b: 서버 선물함 1 · 선물함 서브탭에 1칸', async () => {
    let gifts;
    for(let i = 0; i < 20; i++){
      const d = (await b.api('GET', '/v2/me/gifts')).json.data;
      gifts = d.gifts || d.items || d;
      if(Array.isArray(gifts) && gifts.length) break;
      await t.wait(300);
    }
    assert(Array.isArray(gifts) && gifts.length === 1, '받은 선물 ' + JSON.stringify(gifts).slice(0, 300));
    await openMyHome(b, 'friend');
    await b.w.click('#mhFmTabs .mh-ibx-tab[data-fm="gift"]');
    await b.until(() => document.querySelectorAll('#mhFmList .gift-grid .gift-item').length === 1, null, { what: '선물함 칸' });
  });
});
