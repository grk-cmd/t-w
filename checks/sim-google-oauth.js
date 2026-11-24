/* sim-google-oauth.js — 🔑 구글 로그인 기본 브라우저(루프백) 받기 (google-oauth.js · main.js 연결)
   실행:  node checks/run.js sim-google-oauth
   ★ 지키는 것
     ① 돌아온 주소 판정 — state 를 맨 먼저 · state 가 맞고 code 가 있을 때만 성공 · state 가 맞는 구글 오류만 오류로 · 그 밖은 «올바르지 않음»
     ② 루프백은 실제로 듣고, 정해진 경로 · state 가 맞는 응답 한 번만 받고 닫는다 — 다른 경로 · 다른 방법 · state 다름은 404 로 답하고 계속 기다린다(다른 페이지가 대기를 끊지 못한다)
     ③ 브라우저 탭의 글은 고정 글 — 주소에 실려 온 값을 HTML 에 넣지 않는다
     ④ 시간이 지나거나 취소하면 결과가 끝난다(버튼이 영영 잠기지 않는다) · 결과는 한 번만
     ⑤ 포트를 못 잡으면 실패를 돌려준다(main 이 앱 안 창으로 대신한다) · 듣기 전에 취소됐으면 열린 채 남지 않는다
     ④-2 끝나면 타이머를 풀고, 받아 둔 빈 연결까지 닫는다
     ⑦ 기다리는 동안의 안내 창 — [취소] 주소 · 스크립트 없음 · main 이 [취소] · × 를 대기 취소로 잇는다
     ⑥ main.js — 기본 브라우저가 먼저 · 포트를 못 잡을 때만 앱 안 창 · 다시 누르면 앞의 대기를 멈춤 · 설치 파일 목록에 모듈이 있다 */
'use strict';
const fs = require('fs'), http = require('http'), net = require('net'), path = require('path');

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
  if (!MOD){ say('  ✗ google-oauth.js 를 못 찾음 — 저장소 안의 고정 자리라 없으면 빨강'); process.exit(1); }
  const G = require(path.resolve(MOD));

  say('· ① 돌아온 주소 판정');
  chk(JSON.stringify(G.parseCallback('?code=C1&state=S', 'S')) === JSON.stringify({ ok: true, code: 'C1' }), 'state 가 맞고 code 가 있으면 성공');
  chk(G.parseCallback('?code=C1&state=X', 'S').bad === true, 'state 가 다르면 올바르지 않음');
  chk(G.parseCallback('?code=C1', 'S').bad === true, 'state 가 없으면 올바르지 않음');
  chk(G.parseCallback('?state=S', 'S').bad === true, 'code 가 없으면 올바르지 않음');
  chk(G.parseCallback('?code=C1&state=', '').bad === true, '기다리는 state 가 비었으면 성공으로 보지 않는다');
  chk(G.parseCallback('?error=access_denied&state=S', 'S').error === 'access_denied', 'state 가 맞는 구글 오류는 오류로');
  chk(G.parseCallback('?error=access_denied', 'S').bad === true && !G.parseCallback('?error=access_denied&state=X', 'S').error, 'state 가 없거나 다른 «오류» 는 오류로 보지 않는다');
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
    chk(bad.status === 404, 'state 가 다르면 404');
    const forged = await get(port, '/tw-oauth?error=access_denied');
    chk(forged.status === 404, 'state 없는 «오류» 도 404 — 다른 페이지가 대기를 끊지 못한다');
    const real = await get(port, '/tw-oauth?code=C5&state=S');
    chk(real.status === 200 && real.body === G.PAGE_OK, '그 뒤에도 계속 기다려 진짜 응답을 받는다');
    const r = await lb.result;
    chk(r.ok === true && r.code === 'C5', '결과는 진짜 응답의 code');
  }
  {
    const port = await freePort();
    const lb = G.createLoopback({ http, port, path: '/tw-oauth', state: 'S', timeoutMs: 5000 });
    await lb.start();
    const e = await get(port, '/tw-oauth?error=access_denied&state=S');
    chk(e.status === 200 && e.body === G.PAGE_ERR, 'state 가 맞는 구글 오류 — «하지 못했어요» 한 장');
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

  say('· ④-2 타이머 · 빈 연결');
  {
    const cleared = [];
    const fakeSet = (fn, ms) => ({ fn, ms, id: 'T1' });
    const port = await freePort();
    const lb = G.createLoopback({ http, port, path: '/tw-oauth', state: 'S', setTimeout: fakeSet, clearTimeout: (t) => { if (t) cleared.push(t.id); } });
    await lb.start();
    lb.cancel();
    await lb.result;
    chk(cleared.includes('T1'), '끝나면 시간 제한 타이머를 푼다');
  }
  {
    const port = await freePort();
    const lb = G.createLoopback({ http, port, path: '/tw-oauth', state: 'S', timeoutMs: 5000 });
    await lb.start();
    const sock = net.connect(port, '127.0.0.1');
    await new Promise((r) => sock.once('connect', r));
    await new Promise((r) => setTimeout(r, 30));
    const closed = new Promise((r) => { sock.once('close', () => r(true)); setTimeout(() => r(false), 800); });
    lb.cancel();
    await lb.result;
    chk(await closed, '끝나면 받아 둔 빈 연결도 닫는다(그 연결로 온 응답을 옛 대기가 삼키지 않게)');
    sock.destroy();
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
  {
    const port = await freePort();
    const lb = G.createLoopback({ http, port, path: '/tw-oauth', state: 'S', timeoutMs: 5000 });
    lb.cancel('먼저 취소');
    const st = await lb.start();
    chk(st.ok === false && (await get(port, '/tw-oauth?code=C&state=S')).status === 0, '듣기 전에 취소됐으면 듣기가 열린 채 남지 않는다');
  }

  say('· ⑦ 기다리는 동안의 안내 창');
  chk(typeof G.WAIT_HTML === 'string' && G.WAIT_HTML.includes('href="' + G.WAIT_CANCEL_URL + '"') && /취소/.test(G.WAIT_HTML) && !/<script/i.test(G.WAIT_HTML),
    '[취소] 는 정해진 주소로 가는 링크 · 스크립트가 없다');
  chk(/\.invalid\//.test(G.WAIT_CANCEL_URL), '[취소] 주소는 실제로 닿지 않는 .invalid 주소');

  say('· ⑥ main.js 연결');
  const MAIN = MAIN_P ? fs.readFileSync(MAIN_P, 'utf8') : '';
  if (!MAIN){ chk(false, 'main.js 를 찾는다'); }
  else {
    const i = MAIN.indexOf("ipcMain.handle('companion:signInWithGoogle'");
    const body = i < 0 ? '' : MAIN.slice(i, i + 12000);
    const iLb = body.indexOf('GoogleOAuth.createLoopback('), iWin = body.indexOf('new BrowserWindow(');
    chk(/require\('\.\/google-oauth'\)/.test(MAIN), 'main 이 google-oauth.js 를 싣는다');
    chk(iLb > 0 && iWin > iLb, '기본 브라우저 길이 앱 안 창보다 먼저');
    chk(/if\(started\.ok\)\{[\s\S]{0,400}shell\.openExternal\(authUrl\)/.test(body), '포트를 잡았을 때만 기본 브라우저를 연다');
    chk(/if\(googleLoopback\)\{\s*googleLoopback\.cancel\(/.test(body), '다시 불리면 앞의 대기를 멈춘다');
    chk(body.indexOf('googleLoopback = lb;') > 0 && body.indexOf('googleLoopback = lb;') < body.indexOf('await lb.start()'), '대기는 듣기 전에 걸어 둔다(겹쳐 불려도 포트를 두고 다투지 않게)');
    chk(/_openGoogleWait\(\(\)\s*=>\s*lb\.cancel\(/.test(body), '안내 창의 [취소] 가 대기를 끝낸다');
    chk(/if\(r\.canceled\)\s*return \{[^}]*canceled:\s*true/.test(body) && body.indexOf('if(r.canceled)') < body.indexOf('mainWindow.focus()'), '취소는 canceled 로 돌려주고(화면이 조용히 끝냄) 앱 창을 당기지 않는다');
    const w = MAIN.slice(MAIN.indexOf('const _openGoogleWait'), MAIN.indexOf("ipcMain.handle('companion:signInWithGoogle'"));
    chk(/WAIT_CANCEL_URL/.test(w) && /e\.preventDefault\(\)/.test(w) && /on\('closed',[^\n]*onCancel\(\)/.test(w), '안내 창 — [취소] 이동을 가로채 취소 · × 로 닫아도 취소');
    chk(!/preload/.test(w.replace(/\/\*[\s\S]*?\*\//g, '')) && /contextIsolation:\s*true/.test(w) && /nodeIntegration:\s*false/.test(w), '안내 창에 preload 를 붙이지 않는다');
    chk(/new URL\(GOOGLE_OAUTH_REDIRECT\)/.test(body) && /port:\s*Number\(_cb\.port\)/.test(body), '리디렉션 주소의 포트 · 경로로 듣는다(구글 콘솔 그대로)');
    const handleBody = body.slice(body.indexOf('const handle = (e, url)=>'), body.indexOf("webContents.on('will-redirect', handle)"));
    chk(/GoogleOAuth\.parseCallback\(/.test(handleBody) && /GoogleOAuth\.errorReason\(/.test(handleBody) && /_googleExchange\(/.test(handleBody)
        && !/oauth2\.googleapis\.com\/token/.test(handleBody) && !/q\.get\('state'\)/.test(handleBody), '앱 안 창 길도 같은 판정 · 오류 문구 · 토큰 교환을 쓴다(두 벌이 아니다)');
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
