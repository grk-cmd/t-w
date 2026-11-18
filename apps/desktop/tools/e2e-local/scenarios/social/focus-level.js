// ⏱ 포커스 시간 · 레벨 · 경험치 바 — 레벨 = min(999, 1 + floor(누적초 / 3600)) 를 서버 · 앱 · 화면(내 정보 배지 · 친구 목록 Lv) · 경험치 칸(5분 = 1칸 · 12칸)이 같이 지키는지
// 앱이 쌓은 초를 올리는 길(focusProgressMod.addSeconds → POST …/accruals)도 본다. 실제 «집중» 판정은 OS 의 앞 창 감지라 시험이 만들 수 없다 — 그 다음 단계부터 몬다
// 큰 누적은 서버가 한 번에 받지 않아(올린 시각 사이만큼만) seed/focus.sql 로 정해 둔다
'use strict';
const { scenario, assert, befriend, openMyHome, seedSql } = require('./_kit.js');

const levelOf = (sec) => Math.min(999, 1 + Math.floor(sec / 3600));

scenario('focus-level', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const b = await t.user('b', { name: '비이' });
  await t.step('준비: 친구 맺기(API)', () => befriend(a, b));

  await t.step('앱이 쌓은 초 → 올리기 → 서버 누적이 는다', async () => {
    await a.until(() => focusProgressMod.isReady(), null, { what: '진척 받음' });
    const before = (await a.api('GET', '/v2/me/focus')).json.data.totalSec;
    await t.wait(2000);   // 서버는 지난번 올린 뒤 흐른 시간까지만 받는다
    await a.eval(() => { focusProgressMod.addSeconds(1); return focusProgressMod.flushPending(); });
    let after = before;
    for(let i = 0; i < 20 && after <= before; i++){ after = (await a.api('GET', '/v2/me/focus')).json.data.totalSec; await t.wait(300); }
    assert(a.sawReq(/^POST \/v2\/me\/focus\/accruals 200$/), '올리기 API');
    assert(after > before, `누적 ${before} → ${after}`);
  });

  for(const sec of [0, 3599, 3600, 7 * 3600 + 30 * 60, 998 * 3600 + 1, 1500 * 3600]){
    await t.step(`누적 ${sec}초 → Lv ${levelOf(sec)}`, async () => {
      seedSql('focus.sql', { code: a.me.userCode, sec });
      const p = (await a.api('GET', '/v2/me/focus')).json.data;
      assert(p.totalSec === sec, '서버 누적 ' + p.totalSec);
      assert(p.level === levelOf(sec), `서버 레벨 ${p.level} ≠ ${levelOf(sec)}`);
      await a.eval(() => focusProgressMod.refreshDay());
      await a.until((x) => focusProgressMod.isReady() && focusProgressMod.progress() && focusProgressMod.progress().totalSec === x, sec, { what: '앱이 새 누적을 받음' });
      const appLv = await a.eval(() => focusProgressMod.getFocusLevel());
      assert(appLv === levelOf(sec), `앱 레벨 ${appLv} ≠ ${levelOf(sec)}`);
      // 경험치 바 칸 — 이번 시간 안의 5분 칸 수
      const cells = await a.eval(() => expBarMod.myExpCells());
      const want = sec >= 999 * 3600 ? null : Math.min(12, Math.floor((sec % 3600) / 300));
      if(want !== null) assert(cells === want, `경험치 칸 ${cells} ≠ ${want}`);
      t.note(`level ${p.level} cycle ${p.cycle} cycleLevel ${p.cycleLevel} cells ${cells}`);
    });
  }

  await t.step('내 정보 배지 · 친구 화면 Lv 가 서버 레벨', async () => {
    const sec = 41 * 3600 + 5;
    seedSql('focus.sql', { code: a.me.userCode, sec });
    await a.eval(() => focusProgressMod.refreshDay());
    await a.until(() => focusProgressMod.getFocusLevel() === 42, null, { what: '앱 레벨 42' });
    await a.w.click('#lcLoad');
    const lv = await a.until(() => { const e = document.getElementById('miLv'); return e && e.textContent.trim(); }, null, { what: '내 정보 레벨' });
    assert(/42/.test(lv), '내 정보 레벨 ' + lv);
    await openMyHome(b, 'friend');
    const row = await b.until(() => { const r = document.querySelector('#mhFriendList .mh-frow .mh-flv'); return r && /42/.test(r.textContent) && r.textContent; }, null, { timeout: 30000, what: '친구 목록 Lv 42' });
    t.note('친구 줄 ' + row);
  });
});
