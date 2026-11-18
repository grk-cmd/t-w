// 로그인 화면 — 친구 코드 + 비밀번호(틀린 모양 · 틀린 비밀번호 · 맞는 것) · 구글로 로그인(가입 기록 없음 → 초대 코드 → 구글로 가입) · 다른 PC 에서 같은 구글로 로그인
// 구글 창은 진짜 OAuth 라 열 수 없어 Auth 에뮬레이터가 받는 가짜 구글 ID 토큰으로 대신한다(_kit.js stubGoogle) — 그 뒤 Auth · 서버 가입은 앱 그대로
'use strict';
const K = require('./_kit.js');

K.scenario('login', async (t) => {
  const acct = await t.step('API 로 비밀번호 계정 만들기', () => K.apiAccount());
  t.note('친구 코드 ' + acct.fc);
  const a = await t.app('pc1');
  const msg = () => K.text(a.w, '#inviteGateLoginMsg');

  await t.step('친구 코드 모양이 틀리면 서버에 묻지 않고 막는다', async () => {
    await K.waitShown(a.w, '#inviteGateFc', 30000);
    const n = a.A.reqs.length;
    await K.fillChecked(a.w, [['#inviteGateFc', 'HELLO'], ['#inviteGatePw', K.PW]]);
    await a.w.click('#inviteGateFcBtn');
    await K.waitFor(async () => (await msg()) === '친구 코드는 MATE-XXXX 모양이에요', 5000, '모양 안내');
    if(a.A.reqs.slice(n).some((r) => /identitytoolkit/.test(r))) throw new Error('모양이 틀렸는데 로그인 요청을 보냄');
  });
  await t.step('비밀번호가 틀리면 «맞지 않아요» · 게이트 그대로', async () => {
    await K.fillChecked(a.w, [['#inviteGateFc', acct.fc], ['#inviteGatePw', 'wrong-pass-999']]);
    await a.w.click('#inviteGateFcBtn');
    await K.waitFor(async () => (await msg()) === '친구 코드나 비밀번호가 맞지 않아요', 15000, '틀린 비밀번호 안내');
    if(!(await K.shown(a.w, '#inviteGateCard'))) throw new Error('게이트가 닫힘');
  });
  await t.step('맞는 비밀번호 → 다시 켜기 → 그 계정으로 들어감', async () => {
    await K.loginUi(a, acct.fc);
    const me = await a.w.evaluate(() => JSON.parse(localStorage.getItem('tw.me') || 'null'));
    const fc = me && (me.me ? me.me.friendCode : me.friendCode);
    if(fc !== acct.fc) throw new Error('이 PC 계정 사본의 친구 코드가 다름: ' + JSON.stringify(me).slice(0, 120));
  });

  // 구글 — 이 구글로 가입한 계정이 없다 → 초대 코드 칸으로 → 코드가 통과하면 구글 가입을 이어 간다
  const g = { sub: 'e2e-g-' + K.uniq(), email: 'e2e-' + K.uniq() + '@example.com' };
  const b = await t.app('pc2');
  await K.setGoogle(b, g);
  await t.step('가입 기록 없는 구글로 로그인 → 초대 코드를 넣으라는 안내', async () => {
    await K.waitShown(b.w, '#inviteGateGoogleBtn', 30000);
    await b.w.click('#inviteGateGoogleBtn');
    await K.waitFor(async () => /초대 코드를 넣어 주세요/.test(await K.text(b.w, '#inviteGateLoginMsg') || ''), 20000, '초대 코드 안내');
  });
  let gfc = '';
  await t.step('초대 코드 → 구글로 가입 → 완료 화면(구글 문구 · 비밀번호 안내 없음)', async () => {
    await b.w.fill('#inviteGateInput', K.INVITE);
    await b.w.click('#inviteGateOk');
    await K.waitShown(b.w, '#sdStart', 30000);
    gfc = await K.text(b.w, '#sdCode');
    if(!/^MATE-[0-9A-Z]{4}$/.test(gfc)) throw new Error('친구 코드 모양이 아님: ' + gfc);
    if(!/구글로 로그인/.test(await K.text(b.w, '#sdIntro'))) throw new Error('구글 가입 문구가 아님');
    if(await K.shown(b.w, '#sdPwNote')) throw new Error('구글 가입인데 비밀번호 안내가 보임');
    if(!b.A.reqs.some((r) => /^POST \/v2\/users 200/.test(r))) throw new Error('POST /v2/users 200 없음');
    t.note('구글 계정 친구 코드 ' + gfc);
  });
  await t.step('[시작하기] → 다시 켜기 → 구글 계정으로 들어감', async () => {
    await b.relaunchAfter(() => b.w.click('#sdStart'));
    await K.waitEntered(b);
  });
  const c = await t.app('pc3');
  await K.setGoogle(c, g);
  await t.step('다른 PC 에서 같은 구글로 로그인 → 초대 코드 없이 같은 계정', async () => {
    await K.waitShown(c.w, '#inviteGateGoogleBtn', 30000);
    await c.relaunchAfter(() => c.w.click('#inviteGateGoogleBtn'));
    await K.waitEntered(c);
    await K.openMyInfo(c);
    await K.waitFor(async () => (await K.text(c.w, '#miCode')) === gfc, 15000, '내 정보 친구 코드 ' + gfc);
  });
});
