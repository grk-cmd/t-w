// 비밀번호 바꾸기(친구 코드 계정) · 구글 계정에 비밀번호 붙이기 — 내 정보 › 계정 탭
// 판정은 Auth 에뮬레이터에 친구 코드 + 비밀번호로 실제 로그인되는지(바꾼 뒤 옛 비밀번호는 안 됨)
'use strict';
const K = require('./_kit.js');
const NEW_PW = 'e2e-new-5678';

K.scenario('password', async (t) => {
  const a = await t.app('pw');
  const acct = await t.step('비밀번호로 가입', () => K.signupUi(t, a));
  t.note('친구 코드 ' + acct.fc);
  await t.step('계정 탭 — 비밀번호 있음 · 구글 없음(바꾸기 · 경고 · [연결하기])', async () => {
    await K.openMyInfo(a, 'acct');
    await K.waitShown(a.w, '#acctMethods');
    if((await K.text(a.w, '#acctPwBtn')) !== '비밀번호 바꾸기') throw new Error('버튼이 «비밀번호 바꾸기» 가 아님');
    if(!(await K.shown(a.w, '#acctMWarn'))) throw new Error('구글 없음 경고가 안 보임');
    if(!(await K.shown(a.w, '#acctMGoogleLink'))) throw new Error('[연결하기] 가 안 보임');
    if((await K.text(a.w, '#acctMCode')) !== acct.fc) throw new Error('아이디 칸이 친구 코드가 아님');
  });
  await t.step('짧은 비밀번호 · 서로 다른 확인은 화면에서 막는다', async () => {
    await a.w.fill('#acctPw1', '123'); await a.w.fill('#acctPw2', '123'); await a.w.click('#acctPwBtn');
    await K.waitFor(async () => (await K.text(a.w, '#acctPwMsg')) === '비밀번호는 6자 이상으로 정해 주세요', 5000, '6자 안내');
    await a.w.fill('#acctPw1', NEW_PW); await a.w.fill('#acctPw2', NEW_PW + 'x'); await a.w.click('#acctPwBtn');
    await K.waitFor(async () => (await K.text(a.w, '#acctPwMsg')) === '비밀번호가 서로 달라요.', 5000, '다름 안내');
    if(a.A.reqs.some((r) => /^POST \/v2\/me\/password /.test(r))) throw new Error('막아야 할 입력이 서버로 감');
  });
  await t.step('비밀번호 바꾸기 → 서버 200 · 이 PC 는 새 비밀번호로 다시 로그인', async () => {
    await a.w.fill('#acctPw1', NEW_PW); await a.w.fill('#acctPw2', NEW_PW); await a.w.click('#acctPwBtn');
    await K.waitFor(async () => /^✅ 비밀번호를 바꿨어요\. 다른 PC는/.test(await K.text(a.w, '#acctPwMsg') || ''), 30000, '바꿈 안내(다시 로그인 성공 문구)');
    if(!a.A.reqs.some((r) => /^POST \/v2\/me\/password 200/.test(r))) throw new Error('POST /v2/me/password 200 없음');
  });
  await t.step('Auth — 새 비밀번호는 되고 옛 비밀번호는 안 된다', async () => {
    if(!(await K.emuSignIn(acct.fc, NEW_PW)).ok) throw new Error('새 비밀번호 로그인 실패');
    const old = await K.emuSignIn(acct.fc, K.PW);
    if(old.ok) throw new Error('옛 비밀번호로도 로그인됨');
    t.note('옛 비밀번호: ' + old.error);
  });

  const b = await t.app('google');
  const fc = await t.step('구글로 가입', () => K.googleSignupUi(b, K.newGoogle()));
  t.note('구글 계정 친구 코드 ' + fc);
  await t.step('계정 탭 — 구글 연결됨 · 비밀번호 없음(만들기)', async () => {
    await K.openMyInfo(b, 'acct');
    await K.waitShown(b.w, '#acctMethods');
    if((await K.text(b.w, '#acctPwBtn')) !== '비밀번호 만들기') throw new Error('버튼이 «비밀번호 만들기» 가 아님');
    if((await K.text(b.w, '#acctMPwState')) !== '비밀번호 없음') throw new Error('비밀번호 상태가 «없음» 이 아님');
    if(!(await K.shown(b.w, '#acctMGoogleOk'))) throw new Error('구글 «연결됨» 이 안 보임');
    if((await K.emuSignIn(fc, NEW_PW)).ok) throw new Error('붙이기 전인데 친구 코드 로그인이 됨');
  });
  await t.step('비밀번호 만들기 → 서버가 붙임 · 만듦 안내', async () => {
    await b.w.fill('#acctPw1', NEW_PW); await b.w.fill('#acctPw2', NEW_PW); await b.w.click('#acctPwBtn');
    await K.waitFor(async () => (await K.text(b.w, '#acctPwMsg') || '').startsWith('✅ 비밀번호를 만들었어요. 이제 친구 코드 ' + fc), 30000, '만듦 안내');
    if(!b.A.reqs.some((r) => /^POST \/v2\/me\/password-login 200/.test(r))) throw new Error('POST /v2/me/password-login 200 없음');
  });
  // 서버가 로그인 수단을 바꾸면 Auth 가 이 계정의 옛 토큰을 끊는다 — 앱은 새 비밀번호로 곧바로 다시 로그인한다(#1017 · 옛 BUG-ACCT-1)
  await t.step('비밀번호를 붙인 뒤에도 이 PC 로그인이 이어지고 탭이 «바꾸기» 로', async () => {
    await K.waitFor(async () => (await K.text(b.w, '#acctPwBtn')) === '비밀번호 바꾸기', 15000, '탭이 «비밀번호 바꾸기» 로');
    const tok = await b.w.evaluate(() => window.firebaseAPI.getIdToken(true).then((x) => !!x, (e) => 'ERR ' + (e && e.code)));
    if(tok !== true) throw new Error('토큰 새로 받기 실패(' + tok + ')');
  });
  await t.step('Auth — 구글 계정이 친구 코드 + 새 비밀번호로도 로그인된다(같은 계정)', async () => {
    const r = await K.emuSignIn(fc, NEW_PW);
    if(!r.ok) throw new Error('친구 코드 로그인 실패 ' + r.error);
    const me = await K.http('GET', K.API + '/v2/me', undefined, { Authorization: 'Bearer ' + r.idToken });
    if(!me.data || me.data.friendCode !== fc) throw new Error('친구 코드 로그인이 다른 계정: ' + JSON.stringify(me.body).slice(0, 120));
  });
});
