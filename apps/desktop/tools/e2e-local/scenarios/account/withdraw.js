// 회원 탈퇴 — 내 정보 › 계정 › [회원 탈퇴] → 미리보기 줄 · 확인(체크 + «탈퇴») → 서버 202 → 다시 켜기 → 로그인 화면
// 판정: [탈퇴하기]가 조건이 맞을 때만 켜짐 · 서버가 계정을 지움(그 로그인으로 GET /v2/me 가 더는 내 계정이 아님) · 같은 친구 코드로 다시 로그인 못 함
'use strict';
const K = require('./_kit.js');

K.scenario('withdraw', async (t) => {
  const a = await t.app('pc');
  const acct = await t.step('비밀번호로 가입', () => K.signupUi(t, a));
  t.note('친구 코드 ' + acct.fc);
  await t.step('탈퇴 안내 열기 — 미리보기 «지울 항목 n개» · [탈퇴하기] 꺼짐', async () => {
    await K.openMyInfo(a, 'acct');
    await a.w.click('#acctDeleteBtn');
    await K.waitShown(a.w, '#acctDeleteConfirm');
    await K.waitFor(async () => /^지울 항목 \d+개/.test(await K.text(a.w, '#acctDeleteCount') || ''), 15000, '미리보기 줄');
    if(!a.A.reqs.some((r) => /^GET \/v2\/me\/withdrawal-preview 200/.test(r))) throw new Error('미리보기 요청 없음');
    if(!(await a.w.isDisabled('#acctDeleteYes'))) throw new Error('확인 전인데 [탈퇴하기]가 켜짐');
  });
  await t.step('체크만 · 글자만으로는 안 켜지고 둘 다 맞아야 켜진다', async () => {
    await a.w.check('#acctDeleteAgree');
    if(!(await a.w.isDisabled('#acctDeleteYes'))) throw new Error('체크만으로 켜짐');
    await a.w.uncheck('#acctDeleteAgree');
    await a.w.fill('#acctDeleteWord', '탈퇴');
    if(!(await a.w.isDisabled('#acctDeleteYes'))) throw new Error('글자만으로 켜짐');
    await a.w.fill('#acctDeleteWord', '탈퇴 할래');
    await a.w.check('#acctDeleteAgree');
    if(!(await a.w.isDisabled('#acctDeleteYes'))) throw new Error('글자가 다른데 켜짐');
    await a.w.fill('#acctDeleteWord', '탈퇴');
    if(await a.w.isDisabled('#acctDeleteYes')) throw new Error('둘 다 맞는데 꺼짐');
  });
  await t.step('[탈퇴하기] → 서버 탈퇴 → 완료 → 다시 켜기 → 로그인 화면', async () => {
    await a.relaunchAfter(() => a.w.click('#acctDeleteYes'));
    if(!a.A.reqs.some((r) => /^POST \/v2\/me\/withdrawal 20\d/.test(r))) throw new Error('POST /v2/me/withdrawal 2xx 없음');
    await K.waitShown(a.w, '#inviteGateInput', 30000);
    const me = await a.w.evaluate(() => localStorage.getItem('tw.me'));
    if(me) throw new Error('이 PC 계정 사본이 남음');
  });
  await t.step('서버 — 그 계정은 없다(로그인 · 내 계정 확인 둘 다 안 됨)', async () => {
    await K.waitFor(async () => {
      const s = await K.emuSignIn(acct.fc, acct.pw);
      if(!s.ok) return true;   // 로그인 계정까지 지워짐
      const r = await K.http('GET', K.API + '/v2/me', undefined, { Authorization: 'Bearer ' + s.idToken });
      return r.status !== 200;
    }, 30000, '계정 지워짐');
  });
});
