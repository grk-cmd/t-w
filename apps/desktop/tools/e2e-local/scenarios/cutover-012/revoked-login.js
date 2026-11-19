// 런북 T-5 전원 로그아웃 — 모든 Auth 사용자의 refresh token 을 끊으면(cutover-logout.js 와 같은 validSince) 운영 0.12.3 은
// ① Auth 에뮬레이터가 끊긴 refresh token 을 거절하나(REST 로 직접 — 거절 안 하면 그렇게 적고 ③ 판정을 바꾼다)
// ② 켜 둔 앱: ID 토큰(1시간)이 살아 있는 동안은 그대로 — 30초 지켜본다
//    에뮬레이터가 거절하지 않으면(지금 판 그렇다) 주소 돌리기가 토큰 다시 받기에 진짜 서버의 답(400 TOKEN_EXPIRED)을 대신 준다 — 단계 글에 적는다
// ③ ID 토큰이 끝난 뒤를 흉내: 앱이 저장한 토큰의 끝 시각만 지난 값으로 바꾸고(localStorage · 앱 코드는 그대로) 다시 켠다 →
//    토큰을 새로 받다 거절되면 로그인이 풀린다(authCurrentUid 없음) · 화면(로그인 필요 창 · 띠 · 토스트)을 적는다 · 앱은 죽지 않음
'use strict';
const k = require('./_kit.js');

// 앱이 저장한 로그인(browserLocalPersistence — localStorage 의 firebase:authUser:<키>:[DEFAULT]) — expire 면 ID 토큰 끝 시각을 지난 값으로.
// refresh token 을 돌려준다
const authRow = (w, expire) => w.evaluate((ex) => {
  const key = Object.keys(localStorage).find((x) => x.startsWith('firebase:authUser:'));
  if(!key) throw new Error('저장된 로그인이 없음');
  const v = JSON.parse(localStorage.getItem(key));
  if(ex){ v.stsTokenManager.expirationTime = Date.now() - 60000; localStorage.setItem(key, JSON.stringify(v)); }
  return v.stsTokenManager.refreshToken;
}, expire);

k.run('revoked-login', async (t) => {
  await k.seedNormal(t);
  const A = t.newApp('pc');
  let u, w, rt, enforced;
  const refresh = async (token) => {
    const r = await fetch(`${t.env.emu.authUrl}/securetoken.googleapis.com/v1/token?key=fake`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(token) });
    return { status: r.status, body: (await r.text()).slice(0, 160) };
  };

  await t.step('준비 — 0.12.3 규칙에서 로그인한 옛 사용자', async () => { u = await k.prepareUser(t, A); w = u.w; return u.code; });

  await t.step('끊기 전 — 앱의 refresh token 으로 새 토큰을 받을 수 있음', async () => {
    rt = await authRow(w, false);
    const r = await refresh(rt);
    if(r.status !== 200) throw new Error('끊기 전인데 거절 ' + JSON.stringify(r));
  });

  await t.step('T-5 전원 로그아웃(validSince = 지금) — 에뮬레이터가 끊긴 refresh token 을 거절하나', async () => {
    await k.wait(1100);   // validSince 는 초 단위 — 앞서 받은 토큰과 같은 초를 피한다
    await t.auth.revoke(u.authUid);
    const r = await refresh(rt);
    enforced = r.status !== 200;
    return enforced ? `거절함(${r.status} ${r.body.replace(/\s+/g, ' ')})` : '거절 안 함 — 에뮬레이터가 폐기를 지키지 않는다';
  });

  await t.step('켜 둔 앱 30초 — ID 토큰이 살아 있는 동안은 로그인 그대로 · 앱 그대로', async () => {
    await k.wait(30000);
    const uid = await w.evaluate(() => window.firebaseAPI.authCurrentUid());
    const s = await k.screen(w);
    await k.alive(A, w);
    if(uid !== u.authUid) t.note('30초 안에 로그인이 풀림 — ' + uid);
    return `로그인 ${uid === u.authUid ? '그대로' : '풀림'} · 토스트 «${s.toast}» · 띠 «${s.band}»`;
  });

  await t.step('ID 토큰이 끝난 뒤(저장한 끝 시각만 지난 값으로) 다시 켬 — 끊긴 로그인이면 풀리고 앱은 그대로', async () => {
    await authRow(w, true);
    await A.quit();
    if(!enforced) t.env.rejectRefresh = true;
    w = await A.launch();
    await k.wait(3000);
    const uid = await k.until(async () => { const x = await w.evaluate(() => window.firebaseAPI ? window.firebaseAPI.authCurrentUid() : 'not-ready'); return x === 'not-ready' ? null : { x }; }, 20000);
    await k.wait(8000);
    const now = await w.evaluate(() => window.firebaseAPI.authCurrentUid());
    const s = await k.screen(w);
    const need = await w.isVisible('#needLoginOverlay');
    await t.shot(w, 'after-revoke');
    await k.alive(A, w);
    const tokenReq = A.lines(/securetoken\.googleapis\.com\/v1\/token/);
    const what = `로그인 ${now ? '그대로(' + now + ')' : '풀림'} · «로그인 필요» 창 ${need ? '뜸' : '안 뜸'} · 토스트 «${s.toast}» · 띠 «${s.band}» · 토큰 다시 받기 ${tokenReq.map((x) => x.split(' ').pop()).join(',') || '없음'}`;
    if(!uid) throw new Error('앱이 준비되지 않음');
    if(now) throw new Error('토큰 다시 받기가 거절됐는데 로그인이 그대로 — ' + what);
    return (enforced ? '에뮬레이터가 거절 · ' : '시험이 TOKEN_EXPIRED 를 대신 줌 · ') + what;
  });
});
