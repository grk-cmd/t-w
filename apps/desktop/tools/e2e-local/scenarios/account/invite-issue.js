// 초대장 발급 — 런처 [🎟️ 초대장 (n)] → 확인 [발급] → 코드 · 남은 장수 → 그 코드로 다른 PC 에서 가입
// 판정: 발급 전엔 차감 없음([취소]) · 발급하면 한 장 줄고 코드가 서버에서 쓸 수 있음 · 친구가 그 코드로 가입됨 · 다 쓴 코드는 다시 못 씀
'use strict';
const K = require('./_kit.js');

K.scenario('invite-issue', async (t) => {
  const a = await t.app('host');
  const acct = await t.step('가입', () => K.signupUi(t, a));
  const left0 = (await acct.api('GET', '/v2/me/invites')).data.invitesLeft;
  t.note('남은 초대장 ' + left0);
  await t.step('런처 버튼이 서버의 남은 장수를 보인다', async () => {
    if(!(left0 > 0)) throw new Error('새 계정에 초대장이 없음: ' + left0);
    await K.waitFor(async () => (await K.text(a.w, '#lcInviteIssueBtn')) === '🎟️ 초대장 (' + left0 + ')', 15000, '버튼 장수');
  });
  await t.step('[초대장] → 확인 단계 → [취소] 는 차감하지 않는다', async () => {
    await a.w.click('#lcInviteIssueBtn');
    await K.waitShown(a.w, '#inviteConfirmStep');
    await K.waitFor(async () => (await K.text(a.w, '#inviteConfirmLeft')) === '남은 초대장: ' + left0 + '장', 10000, '확인 단계 장수');
    await a.w.click('#inviteConfirmCancel');
    if((await acct.api('GET', '/v2/me/invites')).data.invitesLeft !== left0) throw new Error('취소했는데 줄었음');
    if(a.A.reqs.some((r) => /^POST \/v2\/me\/invites/.test(r))) throw new Error('취소했는데 발급 요청이 감');
  });
  let code = '';
  await t.step('[발급] → 코드 · 남은 장수 하나 줄어듦', async () => {
    await a.w.click('#lcInviteIssueBtn');
    await K.waitShown(a.w, '#inviteConfirmStep');
    await a.w.click('#inviteConfirmOk');
    await K.waitShown(a.w, '#inviteIssuedStep', 15000);
    code = await K.text(a.w, '#inviteIssuedCode');
    if(!/^INVT-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code)) throw new Error('코드 모양이 아님: ' + code);
    await K.waitFor(async () => (await K.text(a.w, '#inviteIssuedLeft')) === '남은 초대장: ' + (left0 - 1) + '장', 10000, '남은 장수');
    const m = (await acct.api('GET', '/v2/me/invites')).data;
    if(m.invitesLeft !== left0 - 1) throw new Error('서버 장수 ' + m.invitesLeft);
    if(!(m.invites || []).some((x) => x.code === code)) throw new Error('내 초대 목록에 코드 없음');
    await a.w.click('#inviteIssuedClose');
    await K.waitFor(async () => (await K.text(a.w, '#lcInviteIssueBtn')) === '🎟️ 초대장 (' + (left0 - 1) + ')', 10000, '버튼 장수 갱신');
    t.note('초대 코드 ' + code);
  });
  await t.step('서버 — 그 코드는 쓸 수 있다', async () => {
    const r = await K.http('GET', K.API + '/v2/invites/' + code);
    if(!r.data || r.data.usable !== true) throw new Error(JSON.stringify(r.body));
  });
  const b = await t.app('friend');
  await t.step('친구 PC — 받은 코드로 가입 → 들어감', async () => {
    const f = await K.signupUi(t, b, code);
    t.note('친구 ' + f.fc);
  });
  await t.step('다 쓴 코드는 다시 쓸 수 없다(게이트가 거절 문구)', async () => {
    const r = await K.http('GET', K.API + '/v2/invites/' + code);
    if(r.data && r.data.usable === true) throw new Error('한 번 쓴 코드가 아직 쓸 수 있음');
    const c = await t.app('third');
    await K.waitShown(c.w, '#inviteGateInput', 30000);
    await c.w.fill('#inviteGateInput', code);
    await c.w.click('#inviteGateOk');
    await K.waitFor(async () => (await K.text(c.w, '#inviteGateMsg')) === '이미 다 쓴 초대 코드예요', 15000, '«이미 다 쓴 초대 코드예요»');
    if(await K.shown(c.w, '#signupCard')) throw new Error('쓴 코드로 가입 화면이 열림');
  });
});
