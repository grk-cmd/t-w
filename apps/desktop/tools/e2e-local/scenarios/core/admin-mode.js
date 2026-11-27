// 관리자 모드 들어가기 · 나가기
// 관리자가 아닌 B: 비밀번호 창에 로그인한 uid 가 보이고 · 틀린 비밀번호는 «틀려요» · 맞는 비밀번호여도 서버가 관리자로 모르면 «등록돼 있지 않아요» · 모드는 안 켜짐.
// 관리자 A(seed/admin.sql): 맞는 비밀번호 → 서버 확인 → body.admin · 관리자 줄 보임 · Ctrl+E 로 끄면 관리자 줄이 숨는다.
// 개발자 도구 막기는 설치본에서만 돈다(dev 판은 늘 열림 — devtools-gate.js always) — 여기서는 판정하지 않는다(sim devtools-gate).
'use strict';
const { run } = require('./_kit.js');

const err = (A) => A.w.evaluate(() => { const e = document.getElementById('adminPassErr'); return getComputedStyle(e).display !== 'none' ? e.textContent.trim() : ''; });
const isAdmin = (A) => A.w.evaluate(() => document.body.classList.contains('admin'));

run('admin-mode', async (t) => {
  const A = await t.newUser('admin');
  const B = await t.newUser('user');
  await t.step('B 비밀번호 창 — 로그인한 uid 가 보임', async () => {
    await t.openAdminPrompt(B);
    const uid = await t.uid(B);
    const line = await B.w.textContent('#adminAuthLine');
    t.check(line.includes('uid ' + uid), '창에 uid 가 없음: ' + line);
  });
  await t.step('B 틀린 비밀번호 → «비밀번호가 틀려요» · 모드 안 켜짐', async () => {
    await B.w.fill('#adminPassInput', 'wrong-pass');
    await B.w.click('#adminPassOk');
    await t.poll(async () => (await err(B)) === '비밀번호가 틀려요', 5000, '틀림 안내');
    t.check(!(await isAdmin(B)), '모드가 켜짐');
  });
  await t.step('B 맞는 비밀번호지만 서버 관리자 아님 → «등록돼 있지 않아요»', async () => {
    await B.w.fill('#adminPassInput', await t.adminPass(B));
    await B.w.click('#adminPassOk');
    await t.poll(async () => /관리자로 등록돼 있지 않아요/.test(await err(B)), 8000, '관리자 아님 안내');
    t.check(!(await isAdmin(B)), '모드가 켜짐');
    t.check(!(await t.shown(B, '#lcReportList')), '관리자 줄이 보임');
  });
  await t.step('A 관리자 → 모드 켜짐 · 관리자 줄 보임 · 알림', async () => {
    await t.makeAdmin(A);
    await t.enterAdmin(A);
    t.check(await t.poll(async () => /관리자 모드 ON/.test(await A.w.textContent('#toast')), 3000, 'ON 알림'), '');
    for(const id of ['#lcReportList', '#lcLicenseGen', '#lcCategoryManage', '#lcInviteGrant', '#lcAnnounce']) t.check(await t.shown(A, id), id + ' 안 보임');
    t.check(!(await t.shown(A, '#adminPassOverlay')), '비밀번호 창이 남음');
    t.check(/무제한/.test(await A.w.textContent('#lcInviteIssueBtn')), '관리자 초대장이 무제한이 아님');
    await t.shot(A, '01-admin-on');
  });
  await t.step('A Ctrl+E → 모드 꺼짐 · 관리자 줄 숨음', async () => {
    await A.w.keyboard.press('Control+e');
    await t.poll(async () => !(await isAdmin(A)), 3000, 'body.admin 사라짐');
    t.check(/관리자 모드 OFF/.test(await A.w.textContent('#toast')), 'OFF 알림 없음');
    t.check(!(await t.shown(A, '#lcReportList')), '관리자 줄이 남음');
  });
});
