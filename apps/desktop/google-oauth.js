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
  if(!code) return { ok: false, bad: true };
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
    if(server){ const s = server; server = null; try{ s.close(); }catch(_){} }
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

module.exports = { CALLBACK_PATH, WAIT_MS, buildAuthUrl, parseCallback, errorReason, createLoopback, PAGE_OK, PAGE_ERR };
