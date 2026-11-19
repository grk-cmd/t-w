/* _main012.js — 0.12.3 운영 앱(시험 프로세스 main)의 요청을 이 PC 로만 보낸다. _kit.js 가 만드는 감싸는 진입점이
   quiet-main.js 다음 · 앱 main.js 보다 먼저 require 해서 부른다: require('_main012.js')({ log, rtdbHost, proxyPort, db, auth, storage, api }).
   앱 코드는 바꾸지 않는다.

   route-main.js 를 그대로 못 쓰는 까닭: 운영 앱은 api.together-working.com · 운영 RTDB 주소를 부르고, RTDB 는 wss 로 붙는다.
   webRequest 의 redirect 는 웹소켓에 듣지 않아(해 보니 진짜 서버로 붙었다) 이름 풀이를 바꾸는 길을 쓴다.

   ・RTDB — host-resolver-rules 로 운영 RTDB 이름만 127.0.0.1:<proxyPort>(_kit.js 의 TLS 중계 → 에뮬레이터)로 푼다.
     그 이름의 인증서만 이 중계의 자체 서명 인증서를 받는다(setCertificateVerifyProc). https 로 오는 RTDB 요청(.lp 등)은 에뮬레이터 http 로
   ・https 처리기(protocol.handle) — 돌리기: api.together-working.com → <api>(시험 stub) · identitytoolkit · securetoken → <auth>/<호스트>/… · firebasestorage → <storage> ·
     *.cloudfunctions.net → <api>/__fn/<호스트>/…(stub) · help.together-working.com → 404.
     그대로 보냄: www.gstatic.com/firebasejs/ 만(앱이 Firebase SDK 를 받는 곳 · 데이터 없음). 그 밖의 https 는 전부 막는다
   ・webRequest — ws · wss · http 는 RTDB 이름의 wss 와 127.0.0.1 · localhost 만 두고 막는다
   ・main 의 Node 요청 — https.get/request · http.get/request · fetch 는 127.0.0.1 만. api.github.com(맥 업데이트 확인)은 <api>/__github/… 로 돌린다
   ・shell.openExternal · dialog.showMessageBox · showErrorBox — 열지 않고 «OPEN» · «DIALOG» 줄로 남긴다(브라우저 · 시스템 창이 포커스를 뺏지 않게)
   막은 것은 «BLOCK <방법> <주소>» 로 log 에 남기고 global.__e2eBlocked 에 쌓는다 — lib.quietProblems 가 읽어 그 단계를 실패시킨다.
   돌린 것은 «REQ <방법> <표시> <상태>» · 그대로 보낸 것은 «PASS <주소>» */
'use strict';
const fs = require('fs');
const electron = require('electron');
const { app, session, shell, dialog } = electron;

const API_HOST = 'api.together-working.com';
const HELP_HOST = 'help.together-working.com';
const AUTH_HOSTS = ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com'];
const PASS_RE = /^https:\/\/www\.gstatic\.com\/firebasejs\//;
const LOCAL_RE = /^(127\.0\.0\.1|localhost)$/;

module.exports = function main012(o){
  global.__e2eBlocked = [];
  const write = (line) => { try { fs.appendFileSync(o.log, line + '\n'); } catch(_){} };
  const block = (method, url) => { global.__e2eBlocked.push(url); write(`BLOCK ${method} ${url}`); };

  // 운영 RTDB 이름만 이 PC 중계로. 같은 꼬리의 다른 이름(s-*.firebasedatabase.app 등)은 못 풀게 해 둔다
  app.commandLine.appendSwitch('host-resolver-rules', [
    `MAP ${o.rtdbHost} 127.0.0.1:${o.proxyPort}`,
    'MAP *.firebasedatabase.app ~NOTFOUND', 'MAP *.firebaseio.com ~NOTFOUND', 'MAP *.together-working.com ~NOTFOUND',
    'MAP *.cloudfunctions.net ~NOTFOUND', 'MAP *.googleapis.com ~NOTFOUND', 'MAP *.firebaseapp.com ~NOTFOUND', 'MAP *.web.app ~NOTFOUND',
    'MAP github.com ~NOTFOUND', 'MAP *.github.com ~NOTFOUND', 'MAP *.githubusercontent.com ~NOTFOUND',
  ].join(', '));

  function map(u){
    if(u.protocol !== 'https:') return null;
    if(u.hostname === API_HOST) return { to: o.api + u.pathname + u.search, tag: u.pathname };
    if(AUTH_HOSTS.includes(u.hostname)) return { to: o.auth + '/' + u.hostname + u.pathname + u.search, tag: u.hostname + u.pathname };
    if(u.hostname === o.rtdbHost) return { to: o.db + u.pathname + u.search, tag: 'rtdb' + u.pathname };
    if(u.hostname === 'firebasestorage.googleapis.com') return { to: o.storage + u.pathname + u.search, tag: u.hostname + u.pathname };
    if(/\.cloudfunctions\.net$/.test(u.hostname)) return { to: o.api + '/__fn/' + u.hostname + u.pathname, tag: u.hostname + u.pathname };
    return null;
  }

  async function https(ses, req){
    const u = new URL(req.url);
    // o.rejectRefresh — 끊긴 refresh token 에 진짜 서버가 주는 답(400 TOKEN_EXPIRED)을 대신 준다(Auth 에뮬레이터는 validSince 를 안 지킨다)
    if(o.rejectRefresh && u.hostname === 'securetoken.googleapis.com'){
      write(`REQ ${req.method} securetoken.googleapis.com${u.pathname} 400 (시험이 TOKEN_EXPIRED)`);
      return new Response(JSON.stringify({ error: { code: 400, message: 'TOKEN_EXPIRED', status: 'INVALID_ARGUMENT' } }), { status: 400, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    const m = map(u);
    if(m){
      const tag = `${req.method} ${m.tag}`;
      try {
        const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : req.body;
        const r = await ses.fetch(m.to, { method: req.method, headers: req.headers, body, duplex: 'half', bypassCustomProtocolHandlers: true, redirect: 'manual' });
        write(`REQ ${tag} ${r.status}`);
        // RTDB 긴 폴링(.lp) 답의 h 도 에뮬레이터 주소 대신 운영 이름으로 — 안 바꾸면 SDK 가 다음 요청을 https://127.0.0.1:<포트> 로 보내 CSP 에 막힌다
        if(u.hostname === o.rtdbHost){
          const text = (await r.text()).replace(/"h":"127\.0\.0\.1:\d+"/g, `"h":"${o.rtdbHost}"`);
          const h = new Headers(r.headers); h.delete('content-length'); h.delete('content-encoding');
          return new Response(text, { status: r.status, headers: h });
        }
        return r;
      } catch(e){ write(`REQ ${tag} ERR ${e.message}`); return Response.error(); }
    }
    if(u.hostname === HELP_HOST){ write(`REQ ${req.method} ${HELP_HOST}${u.pathname} 404`); return new Response('not found', { status: 404 }); }
    if(PASS_RE.test(req.url)){ write(`PASS ${req.url}`); return ses.fetch(req, { bypassCustomProtocolHandlers: true }); }
    block(req.method, req.url);
    return Response.error();
  }

  const toRe = (p) => new RegExp('^' + String(p).split('*').map((x) => x.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('.*') + '$');
  // https 는 처리기가 정한다. 그 밖(ws · wss · http)은 RTDB 이름의 wss · 이 PC 주소만
  function allowed(raw){
    let u; try { u = new URL(raw); } catch(_){ return true; }
    if(u.protocol === 'https:' || u.protocol === 'file:' || u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'devtools:' || u.protocol === 'chrome-extension:') return true;
    if(u.protocol === 'wss:') return u.hostname === o.rtdbHost;
    if(u.protocol === 'ws:' || u.protocol === 'http:') return LOCAL_RE.test(u.hostname);
    return false;
  }
  const done = new Set();
  function wire(ses){
    if(!ses || done.has(ses)) return;
    done.add(ses);
    ses.setCertificateVerifyProc((req, cb) => cb(req.hostname === o.rtdbHost ? 0 : -3));
    ses.protocol.handle('https', (req) => https(ses, req));
    // 세션의 onBeforeRequest 는 하나뿐 — 앱이 거는 것을 받아 두고 막기 판정 뒤에 그 고르개대로 부른다(route-main.js 와 같은 모양)
    const wr = ses.webRequest;
    const set = wr.onBeforeRequest.bind(wr);
    let appFn = null, appRes = null;
    set((d, cb) => {
      if(!allowed(d.url)){ block(d.method, d.url); return cb({ cancel: true }); }
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
  app.on('ready', () => wire(session.defaultSession));

  // main 의 Node 요청 — 세션을 거치지 않는다
  const apiUrl = new URL(o.api);
  for(const modName of ['https', 'http']){
    const mod = require(modName);
    const http = require('http');
    for(const fn of ['request', 'get']){
      const orig = mod[fn].bind(mod);
      mod[fn] = function(a, b, c){
        let opt = a, url = '';
        if(typeof a === 'string' || a instanceof URL){ url = String(a); opt = (b && typeof b === 'object') ? b : {}; }
        const host = (opt && (opt.hostname || opt.host)) || (url ? new URL(url).hostname : '');
        const p = (opt && opt.path) || (url ? new URL(url).pathname + new URL(url).search : '/');
        if(LOCAL_RE.test(String(host).replace(/:\d+$/, ''))) return orig(a, b, c);
        const cb = [a, b, c].find((x) => typeof x === 'function');
        if(host === 'api.github.com'){
          write(`REQ ${(opt && opt.method) || 'GET'} api.github.com${p} (node)`);
          const r = http[fn]({ hostname: apiUrl.hostname, port: apiUrl.port, path: '/__github' + p, method: (opt && opt.method) || 'GET', headers: (opt && opt.headers) || {}, timeout: opt && opt.timeout }, cb);
          return r;
        }
        block('NODE', `${modName}://${host}${p}`);
        const r = orig({ hostname: '127.0.0.1', port: 9, path: '/', timeout: 1 }, cb);   // 닫힌 자리 — 앱은 연결 실패를 받는다
        return r;
      };
    }
  }
  const origFetch = global.fetch;
  global.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    try { if(LOCAL_RE.test(new URL(url).hostname)) return origFetch(input, init); } catch(_){}
    block('FETCH', url);
    return Promise.reject(new TypeError('blocked by e2e'));
  };

  // 렌더러가 죽으면 «GONE» 줄 — 시나리오가 «죽지 않음» 을 이 줄로 본다
  app.on('render-process-gone', (_e, wc, d) => write(`GONE ${d && d.reason} ${wc && wc.getURL().slice(0, 80)}`));
  app.on('child-process-gone', (_e, d) => { if(d && d.type !== 'Utility') write(`GONE ${d.type} ${d.reason}`); });

  shell.openExternal = (url) => { write(`OPEN ${url}`); return Promise.resolve(); };
  const dlg = (kind) => (...args) => {
    const opt = args.find((x) => x && typeof x === 'object' && !x.webContents && (x.message || x.title || x.buttons)) || {};
    write(`DIALOG ${kind} ${JSON.stringify({ title: opt.title, message: opt.message }).slice(0, 300)}`);
    const r = { response: typeof opt.cancelId === 'number' ? opt.cancelId : 0, checkboxChecked: false };
    return kind.endsWith('Sync') ? r.response : Promise.resolve(r);
  };
  dialog.showMessageBox = dlg('showMessageBox');
  dialog.showMessageBoxSync = dlg('showMessageBoxSync');
  dialog.showErrorBox = (title, content) => { write(`DIALOG showErrorBox ${JSON.stringify({ title, content: String(content).slice(0, 200) })}`); };
};
