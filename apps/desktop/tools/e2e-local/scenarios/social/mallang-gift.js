// 🧸 말랑이 등록(라이선스) · 폴더 누르면 소환 · 친구에게 선물(친구 줄 우클릭) · 받은 쪽 선물함
// ⚠️ 로컬 묶음 서버에는 Storage 봇 계정이 없어 서버가 그림을 올리거나 복사하는 길(POST /v2/me/images · 선물 사본)이 503 STORAGE_UNAVAILABLE 이다.
//   그래서 화면 등록은 «실패 → E-GIFT-02 · 칸 그대로» 를 판정하고, 칸은 앱의 Storage 길(에뮬레이터)로 올린 그림을 PUT /v2/me/mallangs 로 넣어 이어 간다.
//   선물 보내기도 서버 사본에서 503 이면 «E-GIFT-08 · 서버 선물 없음» 을 판정한다(성공 길은 봇 계정이 있는 dev 서버에서만)
'use strict';
const { scenario, assert, befriend, openMyHome, makeAdmin, pngFile, stubFileDialog } = require('./_kit.js');

scenario('mallang-gift', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  await t.step('준비: 친구 맺기(API)', () => befriend(a, b));
  let sentOk = false;

  await t.step('라이선스 없으면 말랑이 폴더가 없다', async () => {
    await openMyHome(a, 'home');
    await t.wait(1500);
    assert(!(await a.shown('#mlFolder')), '라이선스 없는데 말랑이 폴더가 보임');
  });

  await t.step('준비: a 를 관리자(프리미엄)로 — seed/social.sql · 다시 켜기', () => makeAdmin(a));

  await t.step('a: 말랑이 폴더 우클릭 → 칸 → 그림 등록 → (로컬 서버 Storage 없음) E-GIFT-02 · 칸 그대로', async () => {
    await openMyHome(a, 'home');
    await a.until(() => !!document.getElementById('mlFolder') && getComputedStyle(document.getElementById('mlFolder')).display !== 'none', null, { what: '말랑이 폴더' });
    await stubFileDialog(a, await pngFile(a, 'mallang.png', '#ff8fb0'));
    await a.w.click('#mlFolder', { button: 'right' });
    await a.w.locator('#mlManage .ml-slot').first().waitFor({ state: 'visible', timeout: 10000 });
    await a.w.locator('#mlManage .ml-slot').first().click();
    const tt = await a.until(() => /말랑이가 등록됐어요|오류 E-GIFT-02/.test(document.getElementById('toast').textContent) && document.getElementById('toast').textContent, null, { what: '등록 결과 토스트' });
    if(/오류 E-GIFT-02/.test(tt)){
      assert(a.sawReq(/^POST \/v2\/me\/images 503$/), '503 이 아닌데 E-GIFT-02 — ' + a.A.reqs.filter((l) => /images/.test(l)).join(','));
      const slots = (await a.api('GET', '/v2/me/mallangs')).json.data.slots;
      assert(slots.length === 0, '실패했는데 칸이 생김');
      t.note('로컬 서버 Storage 없음 — 등록 실패 길 확인 · 칸은 아래 준비로 넣음');
      // 준비: 앱의 Storage 길(에뮬레이터)로 그림을 올리고 칸 저장
      // 서버는 users/<코드>/mallang_*.<확장자> 만 받는다 — 그 이름으로 에뮬레이터에 바로 올린다(앱의 Storage 길과 같은 주소 · 같은 토큰)
      const url = await a.eval(async (code) => {
        const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#ff8fb0'; g.fillRect(0, 0, 64, 64);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        const base = 'https://firebasestorage.googleapis.com/v0/b/together-working-dev.firebasestorage.app/o';
        const name = 'users/' + code + '/mallang_e2e' + Date.now().toString(36) + '.png';
        const r = await fetch(base + '?name=' + encodeURIComponent(name), { method: 'POST', headers: { Authorization: 'Firebase ' + await window.firebaseAPI.getIdToken(), 'Content-Type': 'image/png' }, body: blob });
        const j = await r.json();
        if(!r.ok) throw new Error('올리기 ' + r.status + ' ' + JSON.stringify(j));
        return base + '/' + encodeURIComponent(name) + '?alt=media&token=' + String(j.downloadTokens || '').split(',')[0];
      }, a.me.userCode);
      const cur = (await a.api('GET', '/v2/me/mallangs')).json.data;
      const put = await a.api('PUT', '/v2/me/mallangs', { version: cur.version, slots: [{ slot: 0, imageUrl: String(url), enabled: true }] });
      assert(put.status === 200, '칸 저장 ' + put.status + ' ' + JSON.stringify(put.json));
      await a.eval(() => document.getElementById('mlManageClose').click());
      await a.relaunch();
      await openMyHome(a, 'home');
      await a.until(() => !!document.getElementById('mlFolder'), null, { what: '말랑이 폴더' });
    } else {
      const slots = (await a.api('GET', '/v2/me/mallangs')).json.data.slots;
      assert(slots.length === 1 && slots[0].imageUrl, '서버 칸 ' + JSON.stringify(slots));
      await a.w.click('#mlManageClose');
    }
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
    sentOk = /보냈어요/.test(tt);
    const sent = (await a.api('GET', '/v2/me/gifts/sent-today')).json.data;
    if(sentOk) assert(sent.count === 1, '오늘 보낸 수 ' + JSON.stringify(sent));
    else {
      assert(a.sawReq(/^POST \/v2\/gifts\/[^ ]+ 503$/), '503 이 아닌데 E-GIFT-08');
      assert(sent.count === 0, '실패했는데 보낸 수가 셈 ' + JSON.stringify(sent));
      t.note('로컬 서버 Storage 없음 — 선물 사본 503 · E-GIFT-08 확인');
    }
  });

  await t.step('b: 받은 선물(보내기가 됐으면 1칸 · 아니면 «아직 받은 선물이 없어요»)', async () => {
    if(!sentOk){
      await openMyHome(b, 'friend');
      await b.w.click('#mhFmTabs .mh-ibx-tab[data-fm="gift"]');
      await b.until(() => /아직 받은 선물이 없어요/.test(document.getElementById('mhFmList').textContent), null, { what: '빈 선물함' });
      return;
    }
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
    await b.until(() => document.querySelectorAll('#mhFmList .gift-grid > *').length === 1, null, { what: '선물함 칸' });
  });
});
