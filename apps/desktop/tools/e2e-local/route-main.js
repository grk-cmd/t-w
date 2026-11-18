/* route-main.js — 시험 앱의 요청이 진짜 서버로 나가지 않게(주소 돌리기 · 막기). 감싸는 진입점(lib.js 의 wrap/main.js)이
   앱 main.js 보다 먼저 require 하고 곧바로 부른다: require('route-main.js')({ log, api, auth, storage, helpDir }).
   앱 코드는 바꾸지 않는다 — 시험 프로세스의 main 에서 세션마다 건다.

   ・왜 main 에서: Playwright 의 ctx.route 는 앱 창에 붙은 뒤에야 걸려, 안 걸린 채 뜬 앱은 진짜 서버로 나간다.
     세션 처리기는 앱이 창 · 요청을 만들기 전에 걸린다
   ・돌리기 — 세션의 https 처리기(protocol.handle)가 이 PC 주소로 대신 받아 그 답을 원래 주소의 답으로 준다.
     redirect 가 아니라서 창에서 보면 주소 · 출처(CORS)가 그대로다(Playwright 의 fulfill 과 같은 모양). lib.js 가 하던 짝 그대로:
       https://api-dev.together-working.com/<길>              → <api>/<길>
       https://identitytoolkit|securetoken.googleapis.com/<길> → <auth>/<그 호스트>/<길>(Auth 에뮬레이터는 원래 호스트를 앞에 붙여 받는다)
       https://firebasestorage.googleapis.com/<길>             → <storage>/<길>
       https://help.together-working.com/<길>               → 저장소 firebase/hosting/help 파일(o.helpDir · cleanUrls)
     realtime 은 dev 판이 처음부터 ws://127.0.0.1:8787 을 쓴다(rt-hub.js) — 돌릴 것이 없다
   ・막기 — 우리 데이터를 실을 수 있는 곳만: *.together-working.com · identitytoolkit · securetoken · firebasestorage · firestore · firebaseinstallations.googleapis.com ·
     *.firebaseio.com · *.firebasedatabase.app · *.firebaseapp.com · *.web.app(돌릴 세 짝은 먼저 돌린다). 그 밖(유튜브 · 글꼴 등)은 그대로 둔다.
     https 는 처리기가 네트워크 오류로 끝내고, 그 밖(ws · wss · http · main 의 요청)은 webRequest 가 막는다.
     막은 것은 log 에 «BLOCK <방법> <주소>» 로 남기고 global.__e2eBlocked 에 쌓는다 — lib.quietProblems 가 읽어 그 단계를 실패시킨다
   ・오프라인 흉내(global.__e2eOffline — lib.js net) — 돌릴 요청을 네트워크 오류로 끝내고 «OFFLINE» 으로 남긴다
   ・시험이 고친 답(global.__e2eEdits · lib.js editJson) — 돌린 API 답 JSON 의 data 를 함수로 고쳐 준다(이 앱 하나만 · 서버 값은 그대로)
   ・돌린 요청은 «REQ <방법> <표시> <상태>» 로 남긴다 — lib.js 가 읽어 A.reqs 에 옛 모양 그대로 넣는다 */
'use strict';
const fs = require('fs');
const path = require('path');
const { app, session } = require('electron');

const API_HOST = 'api-dev.together-working.com';
const AUTH_HOSTS = ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com'];
const STORAGE_HOST = 'firebasestorage.googleapis.com';
const HELP_HOST = 'help.together-working.com';   // 도움말 사이트 — 저장소의 firebase/hosting/help 파일로 답한다(firebase.json help 사이트 · cleanUrls)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
// 막는 곳 — 우리 데이터를 실을 수 있거나 우리 백엔드에 닿는 호스트만(돌릴 세 짝은 위에서 먼저 돌린다).
// 그 밖(유튜브 플레이어 · 글꼴 fonts.googleapis.com · fonts.gstatic.com · ytimg · googlevideo 등)은 그대로 둔다
const BLOCK_HOSTS = new Set(['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firebasestorage.googleapis.com',
  'firestore.googleapis.com', 'firebaseinstallations.googleapis.com']);
const BLOCK_SUFFIX = /(^|\.)(together-working\.com|firebaseio\.com|firebasedatabase\.app|firebaseapp\.com|web\.app)$/;
const blockedHost = (h) => BLOCK_HOSTS.has(h) || BLOCK_SUFFIX.test(h);

module.exports = function routeMain(o){
  global.__e2eBlocked = [];
  global.__e2eOffline = false;
  global.__e2eEdits = [];   // { method, re, fn } — lib.js editJson 이 넣는다
  const write = (line) => { try { fs.appendFileSync(o.log, line + '\n'); } catch(_){} };
  const block = (method, url) => { global.__e2eBlocked.push(url); write(`BLOCK ${method} ${url}`); };

  // 진짜 주소 → 이 PC 주소와 표시(옛 lib.js proxy 의 표시와 같은 모양: API 는 길만, 그 밖은 호스트+길)
  function map(u){
    if(u.protocol !== 'https:') return null;
    if(u.hostname === API_HOST) return { to: o.api + u.pathname + u.search, tag: u.pathname };
    if(AUTH_HOSTS.includes(u.hostname)) return { to: o.auth + '/' + u.hostname + u.pathname + u.search, tag: u.hostname + u.pathname };
    if(u.hostname === STORAGE_HOST) return { to: o.storage + u.pathname + u.search, tag: u.hostname + u.pathname };
    return null;
  }
  const isBlocked = (raw) => { try { return blockedHost(new URL(raw).hostname); } catch(_){ return false; } };

  // 도움말 사이트 파일 — firebase.json 의 help 사이트처럼 cleanUrls(/privacy → privacy.html · 폴더 → index.html). 폴더 밖은 404
  function help(req, u){
    const tag = `${req.method} ${HELP_HOST}${u.pathname}`;
    const root = path.resolve(o.helpDir);
    let rel;
    try { rel = decodeURIComponent(u.pathname).replace(/^\/+/, ''); }
    catch(_){ write(`REQ ${tag} 404`); return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } }); }
    const cands = [];
    if(!rel || rel.endsWith('/')) cands.push(rel + 'index.html');
    else { cands.push(rel); if(!path.extname(rel)) cands.push(rel + '.html', rel + '/index.html'); }
    for(const c of cands){
      const f = path.resolve(root, c);
      if(f !== root && !f.startsWith(root + path.sep)) break;
      try {
        if(!fs.statSync(f).isFile()) continue;
        write(`REQ ${tag} 200`);
        return new Response(fs.readFileSync(f), { status: 200, headers: { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' } });
      } catch(_){}
    }
    write(`REQ ${tag} 404`);
    return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  }

  async function https(ses, req){
    const u = new URL(req.url);
    const m = map(u);
    if(m){
      const tag = `${req.method} ${m.tag}`;
      if(global.__e2eOffline){ write(`REQ ${tag} OFFLINE`); return Response.error(); }
      try {
        const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : req.body;
        const r = await ses.fetch(m.to, { method: req.method, headers: req.headers, body, duplex: 'half', bypassCustomProtocolHandlers: true, redirect: 'manual' });
        // 시험이 고친 답(lib.js editJson — 이 앱 하나만 · 서버 값은 그대로): JSON 답의 data 를 고쳐 준다
        const ed = global.__e2eEdits.find((e) => e.method === req.method && e.re.test(u.pathname + u.search));
        if(ed){
          const text = await r.text();
          let j = null; try { j = JSON.parse(text); } catch(_){}
          if(j && j.data) j.data = ed.fn(j.data);
          write(`REQ ${tag} ${r.status}${j ? ' (시험이 고침)' : ''}`);
          // 원래 답의 헤더(CORS 등)는 그대로 — 몸이 바뀌어 길이 · 압축 헤더만 뺀다
          const h = new Headers(r.headers); h.delete('content-length'); h.delete('content-encoding');
          return new Response(j ? JSON.stringify(j) : text, { status: r.status, statusText: r.statusText, headers: h });
        }
        write(`REQ ${tag} ${r.status}`);
        return r;
      } catch(e){ write(`REQ ${tag} ERR ${e.message}`); return Response.error(); }
    }
    if(u.hostname === HELP_HOST && o.helpDir) return help(req, u);
    if(isBlocked(req.url)){ block(req.method, req.url); return Response.error(); }
    return ses.fetch(req, { bypassCustomProtocolHandlers: true });   // 그 밖의 https(유튜브 등)는 그 세션으로 그대로
  }

  // webRequest 주소 고르개(<scheme>://<host>/<path> · * 허용) → 정규식
  const toRe = (p) => new RegExp('^' + String(p).split('*').map((x) => x.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('.*') + '$');
  const done = new Set();
  function wire(ses){
    if(!ses || done.has(ses)) return;
    done.add(ses);
    ses.protocol.handle('https', (req) => https(ses, req));
    // https 처리기를 거치지 않는 요청(ws · wss · http · main 이 따로 부르는 것)의 마지막 그물.
    // ⚠️ 세션의 onBeforeRequest 는 하나뿐이라 앱이 나중에 걸면(예: BGM 창) 이 그물이 갈린다 — 앱이 거는 것을 받아 두고,
    //   막기 판정을 먼저 한 뒤 앱의 것을 그 고르개(urls)대로 부른다
    // ⚠️ 돌릴 https 주소는 건너뛴다 — webRequest 가 처리기보다 먼저 보는 판이면 여기서 막아 버린다
    const wr = ses.webRequest;
    const set = wr.onBeforeRequest.bind(wr);
    let appFn = null, appRes = null;
    set((d, cb) => {
      let u = null; try { u = new URL(d.url); } catch(_){}
      const ours = u && (map(u) || (u.protocol === 'https:' && u.hostname === HELP_HOST && o.helpDir));
      if(!ours && isBlocked(d.url)){ block(d.method, d.url); return cb({ cancel: true }); }
      if(appFn && (!appRes || appRes.some((re) => re.test(d.url)))) return appFn(d, cb);
      cb({});
    });
    wr.onBeforeRequest = (a, b) => {
      const filter = (typeof a === 'function' || a == null) ? null : a;
      const fn = (typeof a === 'function' || a == null) ? a : b;
      appFn = fn || null;
      appRes = filter && Array.isArray(filter.urls) && filter.urls.length ? filter.urls.map(toRe) : null;
    };
  }
  app.on('session-created', (ses) => { if(app.isReady()) wire(ses); });
  // 처리기는 ready 뒤에 걸 수 있다 — 이 파일이 앱 main.js 보다 먼저 'ready' 를 들으므로 앱의 창 · 요청보다 먼저 걸린다
  app.on('ready', () => wire(session.defaultSession));
};
