/* sim-google-oauth.js — 🔑 구글 로그인 기본 브라우저(루프백) 받기 (google-oauth.js · main.js 연결)
   실행:  node checks/run.js sim-google-oauth
   ★ 지키는 것
     ① 돌아온 주소 판정 — state 가 맞고 code 가 있을 때만 성공 · 구글 오류는 오류로 · 그 밖은 «올바르지 않음»
     ② 루프백은 실제로 듣고, 정해진 경로 한 번만 받고 닫는다 — 다른 경로 · 다른 방법은 404 로 답하고 계속 기다린다
     ③ 브라우저 탭의 글은 고정 글 — 주소에 실려 온 값을 HTML 에 넣지 않는다
     ④ 시간이 지나거나 취소하면 결과가 끝난다(버튼이 영영 잠기지 않는다) · 결과는 한 번만
     ⑤ 포트를 못 잡으면 실패를 돌려준다(main 이 앱 안 창으로 대신한다)
     ⑥ main.js — 기본 브라우저가 먼저 · 포트를 못 잡을 때만 앱 안 창 · 다시 누르면 앞의 대기를 멈춤 · 설치 파일 목록에 모듈이 있다 */
'use strict';
const fs = require('fs'), http = require('http'), path = require('path');

const pick = (...c) => c.find(p => fs.existsSync(p)) || null;
const MOD = pick('google-oauth.js', '../google-oauth.js', path.join(__dirname, '../apps/desktop/google-oauth.js'));
const MAIN_P = pick('main.js', '../main.js', path.join(__dirname, '../apps/desktop/main.js'));
const PKG_P = pick(path.join(__dirname, '../apps/desktop/package.json'), 'package.json');

const say = console.log;
let pass = 0, fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (c) pass++; else fail++; };

const get = (port, p, method = 'GET') => new Promise((res) => {
  const req = http.request({ host: '127.0.0.1', port, path: p, method }, (r) => {
    let b = ''; r.setEncoding('utf8'); r.on('data', (d) => { b += d; }); r.on('end', () => res({ status: r.statusCode, body: b }));
  });
  req.on('error', (e) => res({ status: 0, body: String(e.code || e) }));
  req.end();
});
/* 빈 포트 하나 받기 — 검사끼리 부딪히지 않게 */
const freePort = () => new Promise((res) => { const s = http.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

(async () => {
  say('=== 🔑 구글 로그인 — 기본 브라우저(루프백) ===');
  if (!MOD){ say('  (google-oauth.js 를 못 찾음 — 건너뜀)'); process.exit(0); }
  const G = require(path.resolve(MOD));

  say('· ① 돌아온 주소 판정');
  chk(JSON.stringify(G.parseCallback('?code=C1&state=S', 'S')) === JSON.stringify({ ok: true, code: 'C1' }), 'state 가 맞고 code 가 있으면 성공');
  chk(G.parseCallback('?code=C1&state=X', 'S').bad === true, 'state 가 다르면 올바르지 않음');
  chk(G.parseCallback('?code=C1', 'S').bad === true, 'state 가 없으면 올바르지 않음');
  chk(G.parseCallback('?state=S', 'S').bad === true, 'code 가 없으면 올바르지 않음');
  chk(G.parseCallback('?code=C1&state=', '').bad === true, '기다리는 state 가 비었으면 성공으로 보지 않는다');
  chk(G.parseCallback('?error=access_denied&state=S', 'S').error === 'access_denied', '구글 오류는 오류로');
  chk(/허용하지 않았어요/.test(G.errorReason('access_denied')) && /\(server_error\)/.test(G.errorReason('server_error')), '오류 문구');
  const url = G.buildAuthUrl({ clientId: 'CID', redirect: 'http://127.0.0.1:52736/tw-oauth', challenge: 'CH', state: 'ST' });
  chk(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/.test(url) && url.includes('redirect_uri=' + encodeURIComponent('http://127.0.0.1:52736/tw-oauth'))
    && /code_challenge_method=S256/.test(url) && /response_type=code/.test(url) && /state=ST/.test(url) && /prompt=select_account/.test(url), '동의 화면 주소 — 리디렉션 · PKCE · code · state · 계정 고르기');

  say('· ② ③ 루프백 — 정해진 경로 한 번만');
  {
    const port = await freePort();
    const lb = G.createLoopback({ http, port, path: '/tw-oauth', state: 'S', timeoutMs: 5000 });
    chk((await lb.start()).ok === true, '포트를 잡는다');
    const fav = await get(port, '/favicon.ico');
    chk(fav.status === 404, '다른 경로는 404');
    const post = await get(port, '/tw-oauth?code=C&state=S', 'POST');
    chk(post.status === 404, 'GET 이 아니면 404');
    const cb = await get(port, '/tw-oauth?code=C9&state=S&error_description=%3Cscript%3Ex%3C%2Fscript%3E');
    chk(cb.status === 200 && cb.body === G.PAGE_OK, '맞는 응답 — 고정 «마쳤어요» 한 장');
    chk(!/script>x/.test(cb.body), '③ 주소에 실려 온 값을 HTML 에 넣지 않는다');
    const r = await lb.result;
    chk(r.ok === true && r.code === 'C9', '결과로 code 를 돌려준다');
    const after = await get(port, '/tw-oauth?code=C2&state=S');
    chk(after.status === 0, '받은 뒤에는 듣기를 닫는다(두 번째 요청은 닿지 않는다)');
  }
  {
    const port = await freePort();
    const lb = G.createLoopback({ http, port, path: '/tw-oauth', state: 'S', timeoutMs: 5000 });
    await lb.start();
    const bad = await get(port, '/tw-oauth?code=C&state=X');
    chk(bad.status === 200 && bad.body === G.PAGE_ERR, 'state 가 다르면 «하지 못했어요» 한 장');
    const r = await lb.result;
    chk(r.ok === false && r.bad === true, '결과는 올바르지 않음');
  }
  {
    const port = await freePort();
    const lb = G.createLoopback({ http, port, path: '/tw-oauth', state: 'S', timeoutMs: 5000 });
    await lb.start();
    await get(port, '/tw-oauth?error=access_denied&state=S');
    const r = await lb.result;
    chk(r.ok === false && r.error === 'access_denied', '구글 오류를 결과로 넘긴다');
  }

  say('· ④ 시간 · 취소 — 결과가 끝나고 한 번만');
  {
    const port = await freePort();
    const lb = G.createLoopback({ http, port, path: '/tw-oauth', state: 'S', timeoutMs: 60 });
    await lb.start();
    const r = await lb.result;
    chk(r.ok === false && r.timeout === true, '시간이 지나면 멈춘다');
    chk((await get(port, '/tw-oauth?code=C&state=S')).status === 0, '멈춘 뒤 듣기가 닫혀 있다');
  }
  {
    const port = await freePort();
    const lb = G.createLoopback({ http, port, path: '/tw-oauth', state: 'S', timeoutMs: 5000 });
    await lb.start();
    lb.cancel('다시 시도');
    lb.cancel('두 번째');
    const r = await lb.result;
    chk(r.ok === false && r.canceled === true && r.reason === '다시 시도', '취소하면 끝나고 첫 결과만 남는다');
    chk((await get(port, '/tw-oauth?code=C&state=S')).status === 0, '취소 뒤 듣기가 닫혀 있다(같은 포트를 바로 다시 잡을 수 있다)');
    const again = G.createLoopback({ http, port, path: '/tw-oauth', state: 'S2', timeoutMs: 5000 });
    chk((await again.start()).ok === true, '같은 포트로 새 대기를 연다');
    again.cancel();
    await again.result;
  }

  say('· ⑤ 포트를 못 잡으면');
  {
    const port = await freePort();
    const hog = http.createServer(); await new Promise((r) => hog.listen(port, '127.0.0.1', r));
    const lb = G.createLoopback({ http, port, path: '/tw-oauth', state: 'S', timeoutMs: 5000 });
    const st = await lb.start();
    chk(st.ok === false && /EADDRINUSE/.test(st.reason), '실패를 돌려준다(EADDRINUSE)');
    await new Promise((r) => hog.close(r));
  }

  say('· ⑥ main.js 연결');
  const MAIN = MAIN_P ? fs.readFileSync(MAIN_P, 'utf8') : '';
  if (!MAIN){ say('  (main.js 를 못 찾음 — 건너뜀)'); }
  else {
    const i = MAIN.indexOf("ipcMain.handle('companion:signInWithGoogle'");
    const body = i < 0 ? '' : MAIN.slice(i, i + 12000);
    const iLb = body.indexOf('GoogleOAuth.createLoopback('), iWin = body.indexOf('new BrowserWindow(');
    chk(/require\('\.\/google-oauth'\)/.test(MAIN), 'main 이 google-oauth.js 를 싣는다');
    chk(iLb > 0 && iWin > iLb, '기본 브라우저 길이 앱 안 창보다 먼저');
    chk(/if\(started\.ok\)\{[\s\S]{0,400}shell\.openExternal\(authUrl\)/.test(body), '포트를 잡았을 때만 기본 브라우저를 연다');
    chk(/if\(googleLoopback\)\{\s*googleLoopback\.cancel\(/.test(body), '다시 누르면 앞의 대기를 멈춘다');
    chk(/new URL\(GOOGLE_OAUTH_REDIRECT\)/.test(body) && /port:\s*Number\(_cb\.port\)/.test(body), '리디렉션 주소의 포트 · 경로로 듣는다(구글 콘솔 그대로)');
  }
  if (PKG_P){
    let files = [];
    try{ files = (JSON.parse(fs.readFileSync(PKG_P, 'utf8')).build || {}).files || []; }catch(_){ files = []; }
    if (files.length) chk(files.includes('google-oauth.js'), '설치 파일 목록(build.files)에 google-oauth.js 가 있다 — 없으면 설치본이 켜지자마자 죽는다');
  }

  say('');
  say(`결과: ${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})();
