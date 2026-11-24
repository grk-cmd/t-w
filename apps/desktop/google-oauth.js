/* google-oauth.js — 🔑 구글 로그인을 기본 브라우저에서 받는다(루프백) · main.js 가 쓴다 (검사 checks/sim-google-oauth.js)
   [왜] 앱 안 창(BrowserWindow)에서 구글 로그인을 띄우면 구글이 «안전하지 않은 브라우저» 로 보고 막거나,
     비밀번호가 맞아도 로그인을 거절할 때가 있다. 구글이 데스크톱 앱에 권하는 길(RFC 8252)은 기본 브라우저를 열고
     127.0.0.1 로 돌아오게 하는 것이다 — 리디렉션 주소(GOOGLE_OAUTH_REDIRECT)는 예전 그대로라 구글 콘솔은 바꾸지 않는다.
   흐름: 127.0.0.1:{port} 에 듣기 → 기본 브라우저로 동의 화면 → 구글이 /tw-oauth?code&state 로 돌려보냄 →
     state 가 맞으면 code 를 돌려주고 듣기를 닫는다. 브라우저 탭에는 «앱으로 돌아가세요» 한 장만 보인다.
   ★ 듣는 곳은 127.0.0.1 하나 · 경로 하나 · state 가 맞는 응답 한 번만. 그 밖(다른 경로 · favicon · state 다름)은 404 로 답하고 계속 기다린다.
   ★ 응답마다 연결을 닫는다(keep-alive 로 열린 연결이 남으면 듣기를 닫은 뒤에도 요청이 들어온다).
   ★ 브라우저에 보이는 쪽은 고정 글만 — 주소에 실려 온 값(error_description 등)을 HTML 에 넣지 않는다.
   ⚠️ 포트를 못 잡으면(다른 프로그램이 쓰는 중) start 가 실패를 돌려준다 — main.js 가 예전 앱 안 창으로 대신한다.
   기다리는 동안 앱 쪽에는 작은 안내 창(WAIT_HTML · [취소] = WAIT_CANCEL_URL 로 이동 — main 이 가로챈다)을 띄운다.
   createLoopback({ http, host, port, path, state, timeoutMs, setTimeout, clearTimeout }) →
     { start() → Promise<{ ok:true } | { ok:false, reason }>, result → Promise<결과>, cancel(reason) }
     결과: { ok:true, code } · { ok:false, error }(구글이 오류를 돌려줌) · { ok:false, bad:true }(code 없음 — state 가 다르면 결과로 넘기지 않고 계속 기다린다) ·
       { ok:false, timeout:true } · { ok:false, canceled:true, reason } */
'use strict';

const CALLBACK_PATH = '/tw-oauth';
const WAIT_MS = 5 * 60 * 1000;   // 브라우저에서 이만큼 안에 끝내지 않으면 멈춘다(버튼이 영영 잠기지 않게)

/** 동의 화면 주소 — PKCE(S256) · code 흐름 · select_account(한 PC 를 나눠 쓸 때 다른 계정을 고를 수 있게) */
function buildAuthUrl(o){
  return 'https://accounts.google.com/o/oauth2/v2/auth'
    + '?client_id='      + encodeURIComponent(o.clientId)
    + '&redirect_uri='   + encodeURIComponent(o.redirect)
    + '&response_type=code'
    + '&scope='          + encodeURIComponent('openid email profile')
    + '&code_challenge=' + o.challenge
    + '&code_challenge_method=S256'
    + '&state='          + o.state
    + '&prompt=select_account';
}

/** 돌아온 주소의 물음표 뒤 → 결과. 리디렉션을 가로채는 앱 안 창(main.js)도 같은 판정을 쓴다.
    state 를 맨 먼저 본다 — 구글은 오류 응답에도 state 를 싣는다. state 가 다른 «오류» 를 받으면 아무 웹 페이지가
    127.0.0.1 로 요청 한 번만 보내도 로그인 대기를 끊을 수 있다. */
function parseCallback(search, state){
  let q = null;
  try{ q = new URLSearchParams(String(search || '').replace(/^\?/, '')); }catch(_){ q = null; }
  if(!q) return { ok: false, bad: true };
  if(!state || q.get('state') !== state) return { ok: false, bad: true };
  const err = q.get('error');
  if(err) return { ok: false, error: String(err), description: String(q.get('error_description') || '') };
  const code = q.get('code');
  if(!code) return { ok: false, bad: true, noCode: true };
  return { ok: true, code };
}

/** 구글 오류 코드 → 사람이 읽을 한 줄 */
function errorReason(err){
  return err === 'access_denied'
    ? '구글이 로그인을 허용하지 않았어요 — 직접 취소했거나, 이 구글 계정(회사·학교 계정 등)이 막혀 있어요'
    : ('구글 로그인 오류 (' + err + ')');
}

/* 브라우저 탭에 보일 한 장 — 고정 글(받은 값을 넣지 않는다) */
function page(title, body){
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Together Working</title>'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#008080;font-family:-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}'
    + '.w{max-width:420px;margin:16px;padding:20px 22px;background:#c0c0c0;border:2px solid;border-color:#fff #000 #000 #fff;box-shadow:3px 3px 0 rgba(0,0,0,.35)}'
    + 'h1{font-size:16px;margin:0 0 8px}p{font-size:14px;line-height:1.6;margin:0}</style></head>'
    + '<body><div class="w"><h1>' + title + '</h1><p>' + body + '</p></div></body></html>';
}
const PAGE_OK  = page('로그인을 마쳤어요', '이 탭을 닫고 투게더워킹으로 돌아가 주세요.');
const PAGE_ERR = page('로그인하지 못했어요', '이 탭을 닫고 투게더워킹에서 다시 시도해 주세요.');

/* 기다리는 동안 앱 쪽에 띄우는 작은 안내 창 — 브라우저 탭을 닫아 버려도 여기서 끝낼 수 있게.
   [취소]는 이 주소로 이동하려는 것을 main 이 가로채 알아챈다(창에 preload 를 붙이지 않는다). */
const WAIT_CANCEL_URL = 'https://tw-google-wait.invalid/cancel';
const WAIT_HTML = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>구글 로그인</title>'
  + '<style>html,body{margin:0;height:100%;background:#c0c0c0;font-family:-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#111;overflow:hidden}'
  + '.w{box-sizing:border-box;height:100%;padding:14px 16px;display:flex;flex-direction:column;justify-content:space-between;border:2px solid;border-color:#fff #000 #000 #fff}'
  + 'b{font-size:14px}p{font-size:12.5px;line-height:1.5;margin:4px 0 0;color:#333}'
  + 'a{align-self:flex-end;padding:6px 18px;font-size:13px;color:#111;text-decoration:none;background:#c0c0c0;border:2px solid;border-color:#fff #000 #000 #fff}'
  + 'a:active{border-color:#000 #fff #fff #000}</style></head>'
  + '<body><div class="w"><div><b>브라우저에서 구글 로그인을 마쳐 주세요</b>'
  + '<p>기본 브라우저에 구글 로그인 화면을 열었어요. 마치면 투게더워킹으로 돌아와요.</p></div>'
  + '<a href="' + WAIT_CANCEL_URL + '">취소</a></div></body></html>';

function createLoopback(o){
  const http = o.http;
  const host = o.host || '127.0.0.1';
  const cbPath = o.path || CALLBACK_PATH;
  const setT = o.setTimeout || setTimeout;
  const clearT = o.clearTimeout || clearTimeout;
  const timeoutMs = typeof o.timeoutMs === 'number' ? o.timeoutMs : WAIT_MS;
  let server = null, timer = null, done = false;
  let settle = null;
  const result = new Promise((res) => { settle = res; });

  function close(){
    clearT(timer); timer = null;
    /* 받아 둔 빈 연결(브라우저가 미리 연 연결)도 닫는다 — 남으면 그 연결로 온 응답을 옛 대기가 404 로 삼킨다 */
    if(server){ const s = server; server = null; try{ s.close(); }catch(_){} try{ if(s.closeAllConnections) s.closeAllConnections(); }catch(_){} }
  }
  function finish(r){
    if(done) return;
    done = true;
    close();
    settle(r);
  }
  function onRequest(req, res){
    let url = null;
    try{ url = new URL(req.url || '/', 'http://' + host); }catch(_){ url = null; }
    const r = (url && url.pathname === cbPath) ? parseCallback(url.search, o.state) : null;
    /* state 가 다른 요청은 우리 로그인의 답이 아니다 — 404 로 답하고 계속 기다린다(다른 페이지가 대기를 끊지 못하게) */
    if(done || req.method !== 'GET' || !r || r.bad){
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Connection': 'close' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'close' });
    res.end(r.ok ? PAGE_OK : PAGE_ERR);
    finish(r);
  }
  /* 듣기 시작 — 포트를 잡으면 { ok:true } · 못 잡으면 { ok:false, reason } (결과 약속은 그대로 열어 둔다 — 부르는 쪽이 다른 길로 간다) */
  function start(){
    return new Promise((res) => {
      let s;
      try{ s = http.createServer(onRequest); }catch(e){ res({ ok: false, reason: String((e && e.message) || e) }); return; }
      const fail = (e) => { try{ s.close(); }catch(_){} res({ ok: false, reason: String((e && e.code) || (e && e.message) || e) }); };
      s.once('error', fail);
      try{
        s.listen(o.port, host, () => {
          s.removeListener('error', fail);
          if(done){ try{ s.close(); }catch(_){} res({ ok: false, reason: 'canceled' }); return; }   // 듣기 전에 이미 취소됐다
          s.on('error', () => {});   // 듣는 중의 오류는 결과로 넘기지 않는다(시간이 지나면 멈춘다)
          server = s;
          timer = setT(() => finish({ ok: false, timeout: true }), timeoutMs);
          res({ ok: true });
        });
      }catch(e){ fail(e); }
    });
  }
  return { start, result, cancel: (reason) => finish({ ok: false, canceled: true, reason: reason || '' }) };
}

/* 기다리는 동안의 작은 안내 창 — Electron 의 BrowserWindow 를 받아 만든다(검사가 가짜 창으로 부른다).
   늘 위는 실행 모드 메인과 같은 'screen-saver' 단계 · 메인을 부모로(owned window — 메인이 다시 올라와도 같이 따라 올라온다).
   [취소](WAIT_CANCEL_URL 로 이동)와 × 둘 다 onCancel. close() 로 닫을 땐 onCancel 을 부르지 않는다. preload 를 붙이지 않는다. → { close() } */
function openWaitWindow(o){
  let closing = false;
  const W = 380, H = 132;
  const wa = o.workArea || null;
  const win = new o.BrowserWindow({
    width: W, height: H,
    x: wa ? wa.x + wa.width - W - 24 : undefined, y: wa ? wa.y + wa.height - H - 24 : undefined,   // 오른쪽 아래 — 브라우저를 가리지 않게
    resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
    icon: o.icon, title: '구글 로그인', autoHideMenuBar: true, backgroundColor: '#c0c0c0',
    parent: o.parent || undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: o.devTools },
  });
  try{ win.setAlwaysOnTop(true, 'screen-saver'); }catch(_){}
  win.webContents.on('will-navigate', (e, url) => {
    try{ e.preventDefault(); }catch(_){}
    if(String(url || '').indexOf(WAIT_CANCEL_URL) === 0) o.onCancel();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('closed', () => { if(!closing) o.onCancel(); });
  Promise.resolve(win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(WAIT_HTML))).catch(() => {});
  return { close(){ closing = true; try{ if(!win.isDestroyed()) win.destroy(); }catch(_){} } };
}

/* 기본 브라우저 로그인 한 번의 흐름 — 듣기 → 브라우저 열기 → 안내 창 → 결과 → 안내 창 닫기 → 결과 모양.
   다시 불리면 앞의 대기를 멈추고(앞 호출은 canceled), 앞의 듣기 시작이 끝나 포트를 놓은 뒤에 듣는다
   (앞이 아직 포트를 잡는 중일 때 바로 들으면 EADDRINUSE 로 앱 안 창 길로 빠진다).
   포트를 못 잡으면 { fallback:true } — main 이 앱 안 창으로 대신한다.
   deps: http · redirect · openExternal(url) · openWait(onCancel) → { close } · focusMain() · exchange(code, verifier) · log(msg) · timeoutMs?
   run({ authUrl, state, verifier }) → { ok:true, idToken } | { ok:false, reason, canceled? } | { fallback:true, reason } */
function createGoogleSignIn(deps){
  let current = null;   // { lb, started } — 지금 대기 한 벌
  const log = deps.log || (() => {});
  async function run(a){
    const prev = current;
    const cb = new URL(deps.redirect);
    const lb = createLoopback({ http: deps.http, host: cb.hostname, port: Number(cb.port), path: cb.pathname, state: a.state, timeoutMs: deps.timeoutMs });
    const me = {
      lb,
      started: (async () => {
        if(prev){ prev.lb.cancel('다시 시도'); await prev.started; }
        return lb.start();
      })(),
    };
    current = me;   // 기다리기 전에 걸어 둔다 — 그 사이 또 불리면 이 호출을 멈추게
    const started = await me.started;
    if(!started.ok){
      /* 그 사이 다시 불려 밀려났으면 포트를 못 잡았어도 대체 길로 가지 않는다(앱 안 창이 둘 열리지 않게) */
      if(started.reason === 'canceled' || current !== me) return { ok: false, reason: CANCELED_TEXT, canceled: true };
      current = null;
      return { fallback: true, reason: started.reason };
    }
    try{ await deps.openExternal(a.authUrl); }
    catch(_){ lb.cancel(); if(current === me) current = null; return { ok: false, reason: '브라우저를 열지 못했어요 — 기본 브라우저 설정을 확인해 주세요' }; }
    let wait = null;
    try{ wait = deps.openWait(() => lb.cancel('취소')); }catch(_){ wait = null; }
    const r = await lb.result;
    if(current === me) current = null;
    try{ if(wait) wait.close(); }catch(_){}
    if(r.canceled) return { ok: false, reason: CANCELED_TEXT, canceled: true };   // 화면은 조용히 끝낸다 · 앱 창을 당기지 않는다
    try{ deps.focusMain(); }catch(_){}
    if(r.ok) return deps.exchange(r.code, a.verifier);
    if(r.error){ log(errorLogText(r)); return { ok: false, reason: errorReason(r.error) }; }
    if(r.timeout) return { ok: false, reason: '브라우저에서 로그인을 마치지 않아 멈췄어요 — 다시 시도해 주세요' };
    return { ok: false, reason: '로그인 응답이 올바르지 않아요' };
  }
  return { run };
}
const CANCELED_TEXT = '로그인 창을 닫아서 연결을 멈췄어요';
const NO_CODE_TEXT = '로그인 응답에 코드가 없어요';

/* 구글이 준 오류 응답의 진단 기록 한 줄 — 두 길(브라우저 · 앱 안 창)이 같이 쓴다 */
function errorLogText(r){
  return '[구글] 로그인 오류 응답: ' + r.error + (r.description ? ' — ' + r.description : '');
}

module.exports = { CALLBACK_PATH, WAIT_MS, WAIT_CANCEL_URL, WAIT_HTML, CANCELED_TEXT, NO_CODE_TEXT, buildAuthUrl, parseCallback, errorReason, errorLogText, createLoopback, openWaitWindow, createGoogleSignIn, PAGE_OK, PAGE_ERR };
