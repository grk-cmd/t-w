// 📅 스케줄러 — 오늘 일정 추가(친구 태그) · 친구의 🔔 일정 알림 · ⏳ D-day(달력 우클릭 · 알림 켬) · 🔔 알림창(오늘 일정 · D-DAY)
'use strict';
const { scenario, assert, befriend, openMyHome } = require('./_kit.js');

scenario('schedule-dday', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  await t.step('준비: 친구 맺기(API)', () => befriend(a, b));
  const tag = Date.now().toString(36);
  const SCHED = '일정 ' + tag, DDAY = '디데이 ' + tag;
  const month = await a.eval(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });

  await t.step('a: 스케줄러 › 오늘 › b 태그 › 일정 추가', async () => {
    await openMyHome(a, 'friend');   // 태그 창은 받아 둔 친구 목록으로 그린다 — 친구 탭에서 한 번 받는다
    await a.until(() => !!document.querySelector('#mhFriendList .mh-frow'), null, { what: '친구 목록' });
    await openMyHome(a, 'scheduler');
    await a.w.click('#mhSchedToday');
    await a.until(() => !!document.querySelector('#mhSchedGrid .mh-cell.today.sel'), null, { what: '오늘 칸 선택' });
    await a.w.fill('#mhSchedInput', SCHED);
    await a.w.click('#mhSchedTagBtn');
    const ids = await a.until(() => { const l = [...document.querySelectorAll('#mhSchedTagList input')].map((e) => e.value); return l.length ? l : null; }, null, { what: '태그 창 친구' });
    assert(ids.includes(b.me.userCode), '태그 창 친구 ' + JSON.stringify(ids));
    await a.w.locator(`#mhSchedTagList input[value="${b.me.userCode}"]`).check();
    await a.w.click('#mhSchedTagOk');
    assert((await a.text('#mhSchedTagInfo')).includes('1명'), '태그 표시');
    // 친구를 태그하면 그 일정은 공개로 묶인다(태그한 친구가 볼 수 있게)
    assert(await a.eval(() => { const c = document.getElementById('mhSchedPublic'); return c.checked && c.disabled; }), '태그했는데 공개가 잠기지 않음');
    await a.w.click('#mhSchedAddBtn');
    await a.until(() => /친구 1명에게 알렸어요/.test(document.getElementById('toast').textContent), null, { what: '추가 토스트' });
    await a.until(() => !!document.querySelector('#mhSchedGrid .mh-cell.today .dots .dot'), null, { what: '달력 점' });
    const r = await a.api('GET', '/v2/me/schedules?month=' + month);
    assert(JSON.stringify(r.json.data).includes(SCHED), '서버 일정 ' + JSON.stringify(r.json.data).slice(0, 300));
  });

  await t.step('b: 🔔 알림 배지 · 알림창에 a 가 태그한 일정', async () => {
    let bell;
    for(let i = 0; i < 30; i++){
      bell = JSON.stringify((await b.api('GET', '/v2/me/notifications?section=BELL&limit=50')).json.data);
      if(bell.includes(SCHED)) break;
      await t.wait(500);
    }
    assert(bell.includes(SCHED), 'b 서버 BELL 알림 ' + bell.slice(0, 300));
    await b.until(() => document.getElementById('myBellBadge').classList.contains('on'), null, { timeout: 30000, what: '🔔 배지' });
    await b.eval(() => document.getElementById('myBellBtn').click());   // 상태칩 줄의 🔔 — 런처 화면에선 줄이 숨어 있어 단추를 직접 누른다
    const txt = await b.until((x) => { const l = document.getElementById('bellList'); return l && l.textContent.includes(x) && l.textContent; }, SCHED, { what: '알림창 줄' });
    assert(/에이/.test(txt), '알림창에 보낸 사람 이름 ' + txt.slice(0, 200));
    await b.until(() => !document.getElementById('myBellBadge').classList.contains('on'), null, { what: '열면 배지 꺼짐' });
  });

  await t.step('a: 오늘 칸 우클릭 → D-day(알림 켬) 저장 → 배너 · 서버', async () => {
    await a.w.click('#mhSchedGrid .mh-cell.today', { button: 'right' });
    await a.w.locator('#mhDdayText').waitFor({ state: 'visible', timeout: 10000 });
    await a.w.fill('#mhDdayText', DDAY);
    await a.w.locator('#mhDdayNotify').check();
    await a.w.click('#mhDdaySaveBtn');
    const ban = await a.until((x) => { const b2 = [...document.querySelectorAll('#mhDdayBanners > *')].find((e) => e.textContent.includes(x)); return b2 && b2.textContent; }, DDAY, { what: 'D-day 배너' });
    assert(/D-DAY|D-0|오늘/i.test(ban), '오늘 D-day 표시 ' + ban);
    let dd;
    for(let i = 0; i < 20; i++){ dd = JSON.stringify((await a.api('GET', '/v2/me/ddays')).json.data); if(dd.includes(DDAY)) break; await t.wait(300); }
    assert(dd.includes(DDAY) && /"notify":true/.test(dd), '서버 D-day ' + dd.slice(0, 300));
  });

  await t.step('a: 🔔 알림창 — 오늘 일정 · 오늘 D-day', async () => {
    await a.eval(() => document.getElementById('myBellBtn').click());
    const txt = await a.until((x) => { const l = document.getElementById('bellList'); return l && x.every((s) => l.textContent.includes(s)) && l.textContent; }, [SCHED, DDAY], { what: '알림창 두 줄' });
    t.note(txt.slice(0, 200));
  });

  await t.step('b: a 의 공개 일정(태그)은 보이고 비공개 D-day 는 안 보인다', async () => {
    const r = await b.api('GET', `/v2/schedules/${a.me.userCode}?month=${month}`);
    assert(JSON.stringify(r.json.data).includes(SCHED), '태그한(공개) 일정이 친구에게 안 보임');
    const d = await b.api('GET', `/v2/ddays/${a.me.userCode}`);
    assert(!JSON.stringify(d.json.data).includes(DDAY), '비공개 D-day 가 친구에게 보임');
  });
});
