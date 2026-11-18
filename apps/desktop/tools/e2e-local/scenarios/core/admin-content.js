// 관리자 공지 · 카테고리 관리 · 신고 목록(앱 안 관리자 런처)
// 📣 확성기: A 가 보내면 책상 모드의 B 캐릭터 머리 위에 그 글이 뜨고, [종료] 하면 사라진다.
// 📰 업데이트 공지: A 가 발행하면 B 가 다음에 켤 때 공지 창이 뜬다(제목 · 본문). 끝에 A 가 지운다.
// 📁 카테고리: A 가 새 카테고리를 더하면 B 가 받는 카탈로그에 실린다. 끝에 지운다.
// 🚩 신고 목록: 서로 다른 세 사람(앱 없이 만든 계정)이 B 를 신고하면 A 목록에 B 가 «3명» 으로 뜨고, [문제없음] 이면 목록에서 빠진다.
// 확성기 · 업데이트 공지 · 카테고리는 모두가 보는 서버 값이라 끝에(실패해도) 되돌린다.
'use strict';
const { run } = require('./_kit.js');

run('admin-content', async (t) => {
  const A = await t.newUser('admin');
  const B = await t.newUser('user');
  await t.step('A 관리자 모드 · B 캐릭터 · 책상 모드', async () => {
    await t.makeAdmin(A); await t.enterAdmin(A);
    await t.createCharacter(B); await t.enterDesk(B);
  });
  const tag = Date.now().toString(36);
  const catId = 'e2e' + tag;
  try {
    await t.step('📣 확성기 → B 머리 위에 글 · 종료하면 사라짐', async () => {
      const text = 'e2e 확성기 ' + tag;
      await A.w.click('#lcAnnounce');
      await A.w.fill('#announceInput', text);
      await A.w.click('#announceSendBtn');
      await t.poll(async () => /공지를 발송했어요/.test(await A.w.textContent('#toast')), 8000, '발송 알림');
      const onB = () => B.w.evaluate((s) => document.getElementById('seatLabelsLayer').innerText.includes(s), text);
      await t.poll(onB, 15000, 'B 머리 위 확성기');
      await t.shot(B, '01-announce');
      await A.w.click('#lcAnnounce');   // 보내면 창이 닫힌다 — 종료는 다시 열어서
      await A.w.click('#announceClearBtn');
      await t.poll(async () => /공지를 종료했어요/.test(await A.w.textContent('#toast')), 8000, '종료 알림');
      await t.poll(async () => !(await onB()), 15000, 'B 확성기 사라짐');
      await A.w.click('#announceCloseBtn');
    });
    await t.step('📁 카테고리 추가 → B 카탈로그에 실림', async () => {
      await A.w.click('#lcCategoryManage');
      await A.w.locator('#cmGroupList').waitFor({ state: 'visible', timeout: 10000 });
      await A.w.locator('#cmGroupList >> text=＋ 추가').first().click();
      await A.w.fill('#cmAddName', 'e2e ' + tag);
      await A.w.fill('#cmAddIcon', '🧪');
      await A.w.fill('#cmAddId', catId);
      await A.w.click('#cmAddGoBtn');
      await t.poll(async () => /카테고리를 추가했어요/.test(await A.w.textContent('#toast')), 8000, '추가 알림');
      await t.poll(async () => { const r = await t.api(B, 'GET', '/v2/catalog'); return (r.body.data.categories || []).some((c) => c.code === catId); }, 15000, 'B 카탈로그에 새 카테고리');
      await A.w.click('#cmCloseX');
    });
    await t.step('🚩 세 사람이 B 신고 → A 목록에 «3명» · [문제없음] 이면 빠짐', async () => {
      const uc = (await t.api(B, 'GET', '/v2/me')).body.data.userCode;
      for(let i = 0; i < 3; i++){
        const u = await t.headlessUser();
        const r = await u.call('POST', '/v2/reports', { target: uc, kind: 'CHARACTER' });
        t.check(r.status === 200 || r.status === 204, `신고 ${i + 1} ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
      }
      await t.leaveDesk(B).catch(() => {});
      await A.w.click('#lcReportList');
      // 한 사람 줄 = 친구 코드 · «🚩 N명» · [문제없음] 을 함께 품은 가장 작은 칸
      const rowOf = (fc) => A.w.evaluate((fc) => {
        for(const b of document.querySelectorAll('button')){
          if(b.textContent.trim() !== '문제없음') continue;
          for(let e = b.parentElement, i = 0; e && i < 5; e = e.parentElement, i++){
            if(e.innerText.includes(fc)) return { count: (e.innerText.match(/🚩\s*(\d+)명/) || [])[1] || null, id: (b.dataset.e2e = fc) };
          }
        }
        return null;
      }, fc);
      const row = await t.poll(() => rowOf(B.fc), 15000, '신고 목록에 B 줄');
      t.check(row.count === '3', 'B 신고 수 ' + row.count);
      await t.shot(A, '02-reports');
      await A.w.click(`button[data-e2e="${B.fc}"]`);
      await t.poll(async () => /신고를 비웠어요/.test(await A.w.textContent('#toast')), 8000, '«신고를 비웠어요»');
      const r = await t.api(A, 'GET', '/v2/admin/reports');
      t.check(!JSON.stringify(r.body).includes(uc), '비운 뒤에도 목록에 B 가 있음');
      // 신고 목록 창은 닫기 단추가 없다 — 어두운 바탕(창 밖)을 눌러 닫는다
      await A.w.mouse.click(5, 5);
      await t.poll(() => A.w.evaluate(() => !document.querySelector('.app-popup-ov')), 3000, '신고 목록 창 닫힘');
    });
    await t.step('📰 업데이트 공지 발행 → B 를 다시 켜면 공지 창', async () => {
      const title = 'e2e 업데이트 ' + tag;
      await A.w.click('#lcUpdateNotice');
      await A.w.fill('#updateNoticeTitle', title);
      await A.w.fill('#updateNoticeBody', 'e2e 본문 ' + tag);
      await A.w.click('#updateNoticeSaveBtn');
      await t.poll(async () => /공지를 발행했어요/.test(await A.w.textContent('#toast')), 8000, '발행 알림');
      await t.relaunch(B);
      await t.poll(async () => (await t.shown(B, '#updateNoticeUserOverlay')) && (await B.w.textContent('#updateNoticeViewTitle')).includes(title), 40000, 'B 공지 창');
      await t.shot(B, '03-update-notice');
      await B.w.click('#updateNoticeOkBtn');
    });
  } finally {
    // 모두가 보는 값 되돌리기 — 업데이트 공지 · 카테고리(앞 단계가 실패했어도)
    const un = await t.api(A, 'GET', '/v2/notices').catch(() => null);
    const cur = un && un.body && un.body.data && un.body.data.updateNotice;
    if(cur && cur.id && /^e2e /.test(cur.title || '')) await t.api(A, 'DELETE', '/v2/admin/notices/update-notices/' + encodeURIComponent(cur.id)).catch(() => {});
    const cat = await t.api(A, 'GET', '/v2/catalog').catch(() => null);
    const row = cat && cat.body && (cat.body.data.categories || []).find((c) => c.code === catId);
    if(row) await t.api(A, 'DELETE', `/v2/admin/catalog/categories/${catId}?version=${row.version}`).catch(() => {});
  }
});
