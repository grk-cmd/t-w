/* sim-google-oauth.js — 🔑 구글 로그인 기본 브라우저(루프백) 받기 (google-oauth.js · main.js 연결)
   실행:  node checks/run.js sim-google-oauth
   ★ 지키는 것
     ① 돌아온 주소 판정 — state 를 맨 먼저 · state 가 맞고 code 가 있을 때만 성공 · state 가 맞는 구글 오류만 오류로 · 그 밖은 «올바르지 않음»
     ② 루프백은 실제로 듣고, 정해진 경로 · state 가 맞는 응답 한 번만 받고 닫는다 — 다른 경로 · 다른 방법 · state 다름은 404 로 답하고 계속 기다린다(다른 페이지가 대기를 끊지 못한다)
     ③ 브라우저 탭의 글은 고정 글 — 주소에 실려 온 값을 HTML 에 넣지 않는다
     ④ 시간이 지나거나 취소하면 결과가 끝난다(버튼이 영영 잠기지 않는다) · 결과는 한 번만
     ⑤ 포트를 못 잡으면 실패를 돌려준다(main 이 앱 안 창으로 대신한다) · 듣기 전에 취소됐으면 열린 채 남지 않는다
     ④-2 끝나면 타이머를 풀고, 받아 둔 빈 연결까지 닫는다
     ④-3 아주 빨리 여러 번 불려도 앞은 canceled · 마지막만 같은 포트로 받는다(대체 길로 빠지지 않는다)
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
  chk(G.parseCallback('?state=S', 'S').bad === true && G.parseCallback('?state=S', 'S').noCode === true, 'code 가 없으면 올바르지 않음 · «코드 없음» 표시');
  chk(!G.parseCallback('?code=C1&state=X', 'S').noCode && !G.parseCallback('?state=X', 'S').noCode, 'state 가 다르면 «코드 없음» 이 아니다(그냥 올바르지 않음)');
  {
    const e = G.parseCallback('?error=access_denied&error_description=blocked+by+admin&state=S', 'S');
    chk(G.errorLogText(e) === '[구글] 로그인 오류 응답: access_denied — blocked by admin', '오류 기록에 error_description 을 붙인다');
    chk(G.errorLogText(G.parseCallback('?error=server_error&state=S', 'S')) === '[구글] 로그인 오류 응답: server_error', '설명이 없으면 오류 코드만');
  }
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
    chk(st.ok === false && st.reason === 'canceled' && (await get(port, '/tw-oauth?code=C&state=S')).status === 0, '듣기 전에 취소됐으면 canceled · 듣기가 열린 채 남지 않는다');
  }

  say('· ⑦ 기다리는 동안의 안내 창');
  chk(typeof G.WAIT_HTML === 'string' && G.WAIT_HTML.includes('href="' + G.WAIT_CANCEL_URL + '"') && /취소/.test(G.WAIT_HTML) && !/<script/i.test(G.WAIT_HTML),
    '[취소] 는 정해진 주소로 가는 링크 · 스크립트가 없다');
  chk(/\.invalid\//.test(G.WAIT_CANCEL_URL), '[취소] 주소는 실제로 닿지 않는 .invalid 주소');

  say('· ⑧ 흐름(createGoogleSignIn) — 가짜 창 · 가짜 브라우저로 실제로 돌린다');
  /* 가짜 BrowserWindow — 만든 옵션 · 늘 위 단계 · 이동 · 닫힘을 기록한다 */
  class FakeWin {
    constructor(opts){ this.opts = opts; this.level = null; this.destroyed = false; this.h = {}; this.wc = {};
      this.webContents = { on: (ev, fn) => { this.wc[ev] = fn; }, setWindowOpenHandler: () => {} }; FakeWin.all.push(this); }
    setAlwaysOnTop(on, level){ this.level = level; }
    on(ev, fn){ this.h[ev] = fn; }
    loadURL(){ return Promise.resolve(); }
    isDestroyed(){ return this.destroyed; }
    destroy(){ if (this.destroyed) return; this.destroyed = true; if (this.h.closed) this.h.closed(); }
    userClose(){ this.destroy(); }   // × — 사람이 닫음(close() 를 거치지 않음)
    navigate(url){ let prevented = false; this.wc['will-navigate']({ preventDefault: () => { prevented = true; } }, url); return prevented; }
  }
  FakeWin.all = [];
  /* 흐름 하나 — browser(url, state) 가 브라우저 몫을 한다(없으면 아무것도 안 함) */
  const mkFlow = (port, o = {}) => {
    const log = { opened: [], waits: [], focus: 0, exchanged: [] };
    const flow = G.createGoogleSignIn({
      http, redirect: 'http://127.0.0.1:' + port + '/tw-oauth', timeoutMs: o.timeoutMs || 5000,
      openExternal: async (u) => { log.opened.push(u); if (o.browser) setTimeout(() => o.browser(u), 10); },
      openWait: (onCancel) => { const w = G.openWaitWindow({ BrowserWindow: FakeWin, parent: { id: 'main' }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, onCancel }); log.waits.push(FakeWin.all[FakeWin.all.length - 1]); return w; },
      focusMain: () => { log.focus++; },
      exchange: async (code, verifier) => { log.exchanged.push([code, verifier]); return { ok: true, idToken: 'ID-' + code }; },
    });
    return { flow, log };
  };
  const stateOf = (u) => new URL(u).searchParams.get('state');
  const authUrl = (state) => G.buildAuthUrl({ clientId: 'CID', redirect: 'http://127.0.0.1/x', challenge: 'CH', state });
  {
    const port = await freePort();
    const { flow, log } = mkFlow(port, { browser: (u) => get(port, '/tw-oauth?code=C7&state=' + stateOf(u)) });
    const r = await flow.run({ authUrl: authUrl('S1'), state: 'S1', verifier: 'V1' });
    const w = log.waits[0];
    chk(r.ok === true && r.idToken === 'ID-C7' && JSON.stringify(log.exchanged) === JSON.stringify([['C7', 'V1']]), '① 성공 — code 를 이번 verifier 로 바꿔 돌려준다');
    chk(log.waits.length === 1 && w.destroyed === true, '① 결과가 오면 안내 창을 닫는다');
    chk(log.focus === 1, '① 성공이면 앱 창을 앞으로');
  }
  {
    const port = await freePort();
    const { flow, log } = mkFlow(port);
    let cancels = 0;
    const p = flow.run({ authUrl: authUrl('S2'), state: 'S2', verifier: 'V2' });
    await new Promise((r) => setTimeout(r, 30));
    log.waits[0].userClose();
    const r = await p;
    chk(r.ok === false && r.canceled === true && log.focus === 0 && log.exchanged.length === 0, '② × 로 닫으면 canceled · 앱 창을 당기지 않는다');
    chk((await get(port, '/tw-oauth?code=C&state=S2')).status === 0, '② 취소 뒤 듣기가 닫혀 있다');
  }
  {
    const port = await freePort();
    const { flow, log } = mkFlow(port);
    const p = flow.run({ authUrl: authUrl('S3'), state: 'S3', verifier: 'V3' });
    await new Promise((r) => setTimeout(r, 30));
    const prevented = log.waits[0].navigate(G.WAIT_CANCEL_URL);
    const r = await p;
    chk(prevented && r.canceled === true && log.waits[0].destroyed, '③ [취소] — 이동을 막고 canceled · 안내 창을 닫는다');
    const other = log.waits[0].navigate('https://example.com/');
    chk(other === true, '③ 다른 주소로의 이동도 막는다(안내 창은 아무 데도 가지 않는다)');
  }
  {
    const port = await freePort();
    let st = null;
    const { flow, log } = mkFlow(port, { browser: (u) => { st = stateOf(u); } });
    const a = flow.run({ authUrl: authUrl('SA'), state: 'SA', verifier: 'VA' });
    await new Promise((r) => setTimeout(r, 30));
    const b = flow.run({ authUrl: authUrl('SB'), state: 'SB', verifier: 'VB' });
    const ra = await a;
    chk(ra.canceled === true && log.waits[0].destroyed === true, '④ 대기 중 다시 부르면 앞 호출은 canceled · 앞 안내 창이 닫힌다');
    await new Promise((r) => setTimeout(r, 30));
    await get(port, '/tw-oauth?code=CB&state=SB');
    const rb = await b;
    chk(rb.ok === true && rb.idToken === 'ID-CB' && log.waits.length === 2, '④ 새 호출은 같은 포트로 이어서 받는다');
  }
  {
    /* 아주 빨리 두 번 — 앞이 아직 포트를 잡는 중에 다시 불려도 뒤가 EADDRINUSE 로 앱 안 창 길로 빠지지 않는다 */
    const port = await freePort();
    const { flow, log } = mkFlow(port, { browser: (u) => get(port, '/tw-oauth?code=CD&state=' + stateOf(u)) });
    const a = flow.run({ authUrl: authUrl('SC'), state: 'SC', verifier: 'VC' });
    const b = flow.run({ authUrl: authUrl('SD'), state: 'SD', verifier: 'VD' });
    const [ra, rb] = await Promise.all([a, b]);
    chk(ra.canceled === true && !ra.fallback, '④-3 듣기 전에 다시 불리면 앞 호출은 canceled(대체 길 아님)');
    chk(rb.ok === true && rb.idToken === 'ID-CD' && !rb.fallback, '④-3 뒤 호출은 같은 포트로 받아 성공');
    chk(log.opened.length === 1 && stateOf(log.opened[0]) === 'SD', '④-3 브라우저는 뒤 호출 것 한 번만 연다');
  }
  {
    const port = await freePort();
    const { flow } = mkFlow(port, { browser: (u) => get(port, '/tw-oauth?code=CG&state=' + stateOf(u)) });
    const rs = await Promise.all(['S7', 'S8', 'S9'].map((st) => flow.run({ authUrl: authUrl(st), state: st, verifier: 'V' })));
    chk(rs[0].canceled && rs[1].canceled && !rs[0].fallback && !rs[1].fallback && rs[2].ok === true, '④-3 세 번 겹쳐도 앞 둘은 canceled · 마지막만 성공');
  }
  {
    /* 세 번 겹친 뒤 대기 중인 마지막을 네 번째가 멈추고 이어 받는다 — 먼저 끝난 앞 호출이 지금 대기를 지우지 않는다 */
    const port = await freePort();
    const { flow } = mkFlow(port);
    const ps = ['T1', 'T2', 'T3'].map((st) => flow.run({ authUrl: authUrl(st), state: st, verifier: 'V' }));
    await Promise.all(ps.slice(0, 2));
    await new Promise((r) => setTimeout(r, 30));
    const p4 = flow.run({ authUrl: authUrl('T4'), state: 'T4', verifier: 'V4' });
    const r3 = await ps[2];
    await new Promise((r) => setTimeout(r, 30));
    await get(port, '/tw-oauth?code=C4&state=T4');
    const r4 = await p4;
    chk(r3.canceled === true && r4.ok === true && r4.idToken === 'ID-C4', '④-3 겹친 뒤 네 번째도 앞 대기를 멈추고 같은 포트로 성공');
  }
  {
    /* 듣는 중에 다시 부르기를 두 번 — 먼저 끝난 앞 호출이 지금 대기(가운데)를 지우면 세 번째가 포트를 못 잡는다 */
    const port = await freePort();
    const { flow } = mkFlow(port);
    const pa = flow.run({ authUrl: authUrl('U1'), state: 'U1', verifier: 'V' });
    await new Promise((r) => setTimeout(r, 30));
    const pb = flow.run({ authUrl: authUrl('U2'), state: 'U2', verifier: 'V' });
    await pa;
    await new Promise((r) => setTimeout(r, 30));
    const pc = flow.run({ authUrl: authUrl('U3'), state: 'U3', verifier: 'V3' });
    const rb = await pb;
    await new Promise((r) => setTimeout(r, 30));
    await get(port, '/tw-oauth?code=C3&state=U3');
    const rc = await pc;
    chk(rb.canceled === true && rc.ok === true && rc.idToken === 'ID-C3', '④-3 듣는 중 두 번 다시 불러도 마지막이 같은 포트로 성공');
  }
  {
    /* 포트를 다른 프로그램이 잡은 채 빨리 두 번 — 대체 길(앱 안 창)은 마지막 한 번만 */
    const port = await freePort();
    const hog = http.createServer(); await new Promise((r) => hog.listen(port, '127.0.0.1', r));
    const { flow } = mkFlow(port);
    const [ra, rb] = await Promise.all(['H1', 'H2'].map((st) => flow.run({ authUrl: authUrl(st), state: st, verifier: 'V' })));
    chk(ra.canceled === true && !ra.fallback && rb.fallback === true, '④-3 포트가 막힌 채 두 번 — 앞은 canceled · 뒤만 대체 길');
    await new Promise((r2) => hog.close(r2));
  }
  {
    const port = await freePort();
    const hog = http.createServer(); await new Promise((r) => hog.listen(port, '127.0.0.1', r));
    const { flow, log } = mkFlow(port);
    const r = await flow.run({ authUrl: authUrl('S5'), state: 'S5', verifier: 'V5' });
    chk(r.fallback === true && log.opened.length === 0 && log.waits.length === 0, '⑤ 포트를 못 잡으면 대체 길 — 브라우저 · 안내 창을 열지 않는다');
    await new Promise((r2) => hog.close(r2));
  }
  {
    const port = await freePort();
    const { flow, log } = mkFlow(port, { timeoutMs: 80 });
    const r = await flow.run({ authUrl: authUrl('S6'), state: 'S6', verifier: 'V6' });
    chk(r.ok === false && !r.canceled && /마치지 않아/.test(r.reason) && log.waits[0].destroyed, '⑥ 시간이 지나면 멈춤 문구 · 안내 창을 닫는다');
  }
  {
    let cancels = 0;
    const before = FakeWin.all.length;
    const w = G.openWaitWindow({ BrowserWindow: FakeWin, parent: { id: 'main' }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, onCancel: () => { cancels++; } });
    const fw = FakeWin.all[before];
    chk(fw.level === 'screen-saver' && fw.opts.parent && fw.opts.parent.id === 'main', '⑦ 안내 창 — 실행 모드 메인과 같은 단계(screen-saver) · 메인을 부모로');
    chk(!('preload' in fw.opts.webPreferences) && fw.opts.webPreferences.contextIsolation === true && fw.opts.webPreferences.nodeIntegration === false, '⑦ 안내 창에 preload 를 붙이지 않는다');
    chk(fw.opts.x === 1920 - 380 - 24 && fw.opts.y === 1040 - 132 - 24, '⑦ 화면 오른쪽 아래(브라우저를 가리지 않게)');
    w.close();
    chk(fw.destroyed === true && cancels === 0, '⑦ close() 로 닫으면 취소를 부르지 않는다');
  }
  for (const dt of [false, true]){
    const before = FakeWin.all.length;
    G.openWaitWindow({ BrowserWindow: FakeWin, parent: { id: 'main' }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, devTools: dt, onCancel: () => {} }).close();
    chk(FakeWin.all[before].opts.webPreferences.devTools === dt, '⑦ 개발자 도구 허용을 받은 그대로 넘긴다(devTools:' + dt + ')');
  }

  say('· ⑨ main.js 연결');
  const MAIN = MAIN_P ? fs.readFileSync(MAIN_P, 'utf8') : '';
  if (!MAIN){ chk(false, 'main.js 를 찾는다'); }
  else {
    const i = MAIN.indexOf("ipcMain.handle('companion:signInWithGoogle'");
    const body = i < 0 ? '' : MAIN.slice(i, i + 12000);
    const pre = MAIN.slice(MAIN.indexOf('const googleSignIn = GoogleOAuth.createGoogleSignIn('), i);
    chk(/require\('\.\/google-oauth'\)/.test(MAIN), 'main 이 google-oauth.js 를 싣는다');
    const iRun = body.indexOf('googleSignIn.run('), iWin = body.indexOf('new BrowserWindow(');
    chk(iRun > 0 && iWin > iRun && /if\(!viaBrowser\.fallback\) return viaBrowser;/.test(body), '기본 브라우저 길이 먼저 · 대체 길(포트 실패)일 때만 앱 안 창');
    chk(/redirect:\s*GOOGLE_OAUTH_REDIRECT/.test(pre) && /GoogleOAuth\.openWaitWindow\(\{\s*BrowserWindow/.test(pre) && /shell\.openExternal\(u\)/.test(pre) && /_googleExchange\(code, verifier\)/.test(pre),
      '흐름에 리디렉션 주소(구글 콘솔 그대로) · 안내 창 · 기본 브라우저 · 토큰 교환을 잇는다');
    const handleBody = body.slice(body.indexOf('const handle = (e, url)=>'), body.indexOf("webContents.on('will-redirect', handle)"));
    chk(/GoogleOAuth\.parseCallback\(/.test(handleBody) && /GoogleOAuth\.errorReason\(/.test(handleBody) && /_googleExchange\(/.test(handleBody)
        && !/oauth2\.googleapis\.com\/token/.test(handleBody) && !/q\.get\('state'\)/.test(handleBody), '앱 안 창 길도 같은 판정 · 오류 문구 · 토큰 교환을 쓴다(두 벌이 아니다)');
    chk(/_diagLog\(GoogleOAuth\.errorLogText\(r\)\)/.test(handleBody) && /if\(r\.noCode\)\{ finish\(\{ ok:false, reason: GoogleOAuth\.NO_CODE_TEXT \}\)/.test(handleBody)
        && handleBody.indexOf('r.noCode') < handleBody.indexOf('if(!r.ok)'), '앱 안 창 길 — 오류 기록에 설명까지 · code 가 없으면 «코드가 없어요»');
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
