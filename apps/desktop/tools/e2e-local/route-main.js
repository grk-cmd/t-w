/* route-main.js — 시험 앱의 요청이 진짜 서버로 나가지 않게(주소 돌리기 · 막기). 감싸는 진입점(lib.js 의 wrap/main.js)이
   앱 main.js 보다 먼저 require 하고 곧바로 부른다: require('route-main.js')({ log, api, auth, storage }).
   앱 코드는 바꾸지 않는다 — 시험 프로세스의 main 에서 세션마다 건다.

   ・왜 main 에서: Playwright 의 ctx.route 는 앱 창에 붙은 뒤에야 걸리고, 안 걸린 채 뜬 판이 있었다(그 판은 앱이 진짜
     api-dev.together-working.com 으로 나가 502 를 받았다). 세션 처리기는 앱이 창 · 요청을 만들기 전에 걸린다
   ・돌리기 — 세션의 https 처리기(protocol.handle)가 이 PC 주소로 대신 받아 그 답을 원래 주소의 답으로 준다.
     redirect 가 아니라서 창에서 보면 주소 · 출처(CORS)가 그대로다(Playwright 의 fulfill 과 같은 모양). lib.js 가 하던 짝 그대로:
       https://api-dev.together-working.com/<길>              → <api>/<길>
       https://identitytoolkit|securetoken.googleapis.com/<길> → <auth>/<그 호스트>/<길>(Auth 에뮬레이터는 원래 호스트를 앞에 붙여 받는다)
       https://firebasestorage.googleapis.com/<길>             → <storage>/<길>
     realtime 은 dev 판이 처음부터 ws://127.0.0.1:8787 을 쓴다(rt-hub.js) — 돌릴 것이 없다
   ・막기 — 위 짝이 아닌 *.together-working.com · *.googleapis.com · *.firebaseio.com · *.firebaseapp.com · *.web.app.
     https 는 처리기가 네트워크 오류로 끝내고, 그 밖(ws · wss · http · main 의 요청)은 webRequest 가 막는다.
     막은 것은 log 에 «BLOCK <방법> <주소>» 로 남기고 global.__e2eBlocked 에 쌓는다 — lib.quietProblems 가 읽어 그 단계를 실패시킨다
   ・오프라인 흉내(global.__e2eOffline — lib.js net) — 돌릴 요청을 네트워크 오류로 끝내고 «OFFLINE» 으로 남긴다
   ・시험이 고친 답(global.__e2eEdits · lib.js editJson) — 돌린 API 답 JSON 의 data 를 함수로 고쳐 준다(이 앱 하나만 · 서버 값은 그대로)
   ・돌린 요청은 «REQ <방법> <표시> <상태>» 로 남긴다 — lib.js 가 읽어 A.reqs 에 옛 모양 그대로 넣는다 */
'use strict';
const fs = require('fs');
const { app, session, net } = require('electron');

const API_HOST = 'api-dev.together-working.com';
const AUTH_HOSTS = ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com'];
const STORAGE_HOST = 'firebasestorage.googleapis.com';
const BLOCK = /(^|\.)(together-working\.com|googleapis\.com|firebaseio\.com|firebaseapp\.com|web\.app)$/;

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
  const isBlocked = (raw) => { try { return BLOCK.test(new URL(raw).hostname); } catch(_){ return false; } };

  async function https(req){
    const u = new URL(req.url);
    const m = map(u);
    if(m){
      const tag = `${req.method} ${m.tag}`;
      if(global.__e2eOffline){ write(`REQ ${tag} OFFLINE`); return Response.error(); }
      try {
        const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : req.body;
        const r = await net.fetch(m.to, { method: req.method, headers: req.headers, body, duplex: 'half', bypassCustomProtocolHandlers: true, redirect: 'manual' });
        // 시험이 고친 답(lib.js editJson — 이 앱 하나만 · 서버 값은 그대로): JSON 답의 data 를 고쳐 준다
        const ed = global.__e2eEdits.find((e) => e.method === req.method && e.re.test(u.pathname + u.search));
        if(ed){
          const j = await r.json();
          if(j && j.data) j.data = ed.fn(j.data);
          write(`REQ ${tag} ${r.status} (시험이 고침)`);
          return new Response(JSON.stringify(j), { status: r.status, headers: { 'content-type': 'application/json' } });
        }
        write(`REQ ${tag} ${r.status}`);
        return r;
      } catch(e){ write(`REQ ${tag} ERR ${e.message}`); return Response.error(); }
    }
    if(BLOCK.test(u.hostname)){ block(req.method, req.url); return Response.error(); }
    return net.fetch(req, { bypassCustomProtocolHandlers: true });   // 그 밖의 https(유튜브 등)는 그대로
  }

  const done = new Set();
  function wire(ses){
    if(!ses || done.has(ses)) return;
    done.add(ses);
    ses.protocol.handle('https', https);
    // https 처리기를 거치지 않는 요청(ws · wss · http · main 이 따로 부르는 것)의 마지막 그물
    // ⚠️ 돌릴 https 주소는 건너뛴다 — webRequest 가 처리기보다 먼저 보는 판이면 여기서 막아 버린다
    ses.webRequest.onBeforeRequest((d, cb) => {
      let u = null; try { u = new URL(d.url); } catch(_){}
      if(u && map(u)) return cb({});
      if(isBlocked(d.url)){ block(d.method, d.url); return cb({ cancel: true }); }
      cb({});
    });
  }
  app.on('session-created', (ses) => { if(app.isReady()) wire(ses); });
  // 처리기는 ready 뒤에 걸 수 있다 — 이 파일이 앱 main.js 보다 먼저 'ready' 를 들으므로 앱의 창 · 요청보다 먼저 걸린다
  app.on('ready', () => wire(session.defaultSession));
};
