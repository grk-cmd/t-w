// 👑 달성표(한 주 도전) — 라이선스 없으면 잠김 · 📋 규칙 달성표 만들기(오늘부터 남은 요일마다 한 줄) → 서버 한 주 한 벌 · 오늘 체크 → «오늘 달성» → 서버 기록 · 포기
'use strict';
const { scenario, assert, makeAdmin, enterDesk, openFocusLog } = require('./_kit.js');

scenario('weekly-challenge', async (t) => {
  const a = await t.user('a', { name: '에이' });
  const openChal = async () => {
    await openFocusLog(a);
    await a.eval(() => document.getElementById('chalBtn').click());
    await a.until(() => document.getElementById('focusLogWin').classList.contains('chal-on') || getComputedStyle(document.getElementById('chalDrawer')).display !== 'none', null, { what: '달성표 서랍' });
  };

  await t.step('라이선스 없으면 서버가 잠근다(PREMIUM_REQUIRED)', async () => {
    const r = await a.api('GET', '/v2/me/focus/challenges/current');
    assert(r.status === 403 && r.json && r.json.code === 'PREMIUM_REQUIRED', '잠김 답 ' + r.status + ' ' + JSON.stringify(r.json));
  });

  await t.step('준비: 관리자(프리미엄) · 책상 모드 · 달성표 서랍', async () => {
    await makeAdmin(a);
    await enterDesk(a);
    await openChal();
    await a.until(() => getComputedStyle(document.getElementById('chalPick')).display !== 'none', null, { what: '종류 고르기' });
  });

  await t.step('📋 규칙 — 남은 요일마다 한 줄 적고 시작 → 서버', async () => {
    await a.eval(() => document.getElementById('chalKindRule').click());
    await a.until(() => getComputedStyle(document.getElementById('chalSetup')).display !== 'none', null, { what: '설정 화면' });
    const days = await a.eval(() => [...document.querySelectorAll('#chalRuleDays [data-d]')].map((b) => b.getAttribute('data-d')));
    for(const d of days){
      await a.eval((dd) => document.querySelector(`#chalRuleDays [data-d="${dd}"]`).click(), d);
      if(!(await a.eval(() => !!document.querySelector('#chalRuleList input[data-i]')))) await a.eval(() => document.querySelector('#chalRuleList [data-add]').click());
      await a.w.fill('#chalRuleList input[data-i="0"]', '물 마시기 ' + d);
    }
    await a.eval(() => document.getElementById('chalStartBtn').click());
    await a.until(() => getComputedStyle(document.getElementById('chalRun')).display !== 'none', null, { what: '진행 화면' });
    const r = await a.api('GET', '/v2/me/focus/challenges/current');
    const s = JSON.stringify(r.json.data);
    assert(r.status === 200 && /물 마시기/.test(s), '서버 달성표 ' + s.slice(0, 300));
    t.note(s.slice(0, 200));
  });

  await t.step('오늘 줄 체크 → «오늘 달성» 토스트 · 서버', async () => {
    const row = await a.until(() => !!document.querySelector('#chalToday [data-i]'), null, { what: '오늘 체크 줄' });
    assert(row, '오늘 줄');
    // 주말엔 첫 달성에 이른 보상 칸이 바로 열려 «뽑기 n회» 토스트가 «오늘 달성» 을 곧 덮는다 — 지금 글만 보지 않고 뜬 글을 다 모은다
    await a.eval(() => {
      const el = document.getElementById('toast');
      window.__chalToasts = [el.textContent];
      new MutationObserver(() => window.__chalToasts.push(el.textContent)).observe(el, { subtree: true, childList: true, characterData: true });
    });
    await a.eval(() => document.querySelector('#chalToday [data-i="0"]').click());
    await a.until(() => window.__chalToasts.some((x) => /오늘 달성! 1일째/.test(x)), null, { timeout: 20000, what: '오늘 달성 토스트' });
    let s;
    for(let i = 0; i < 20; i++){ s = JSON.stringify((await a.api('GET', '/v2/me/focus/challenges/current')).json.data); if(/"(count|doneCount|days)":\s*1|true/.test(s)) break; await t.wait(300); }
    t.note(s.slice(0, 300));
    assert(a.sawReq(/^(POST \/v2\/me\/focus\/challenges\/today|PUT \/v2\/me\/focus\/challenges\/[^ ]+) 200$/), '오늘 달성 API');
  });

  await t.step('포기 → 확인 → 종류 고르기로', async () => {
    await a.eval(() => document.getElementById('chalGiveupBtn').click());
    await a.w.locator('button:not(#chalGiveupBtn)', { hasText: '포기하기' }).last().click();   // 확인 창의 단추(진행 화면 단추와 글이 같다)
    await a.until(() => getComputedStyle(document.getElementById('chalPick')).display !== 'none', null, { what: '포기 뒤 고르기 화면' });
  });
});
