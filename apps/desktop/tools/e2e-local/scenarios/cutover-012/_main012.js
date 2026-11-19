/* _main012.js — 0.12.3 운영 앱(시험 프로세스 main)의 요청을 이 PC 로만 보낸다. _kit.js 가 만드는 감싸는 진입점이
   quiet-main.js 다음 · 앱 main.js 보다 먼저 require 해서 부른다: require('_main012.js')({ log, proxyPort, fingerprint, db, auth, storage, api, rejectRefresh, probe }).
   앱 코드는 바꾸지 않는다.

   주소 표(돌릴 곳 · 이름 풀이 규칙 · 막기 판정)는 _route012.js 한 벌 — 켜기 전 문지기(_kit.js guard)도 같은 표를 본다.
   route-main.js 를 그대로 못 쓰는 까닭: 운영 앱은 api.together-working.com · 운영 RTDB 주소를 부르고, RTDB 는 wss 로 붙는다.
   webRequest 의 redirect 는 웹소켓에 듣지 않아(해 보니 진짜 서버로 붙었다) 이름 풀이를 바꾸는 길을 쓴다.

   ・스위치(R.applySwitches) — 시스템 프록시를 끄고(no-proxy-server) 이름 풀이 규칙을 건다: 운영 RTDB 이름만 127.0.0.1:<proxyPort>(_kit.js 의 TLS 중계 → 에뮬레이터),
     localhost · www.gstatic.com 말고 모든 이름은 ~NOTFOUND
   ・인증서(R.certVerifier) — 운영 RTDB 이름은 중계 인증서 지문(o.fingerprint)과 같을 때만 받는다 · 진짜 Firebase 인증서도 거절. 판정은 «CERT» 줄로
   ・https 로 오는 RTDB 요청(.lp 등)은 에뮬레이터 http 로
   ・https 처리기(protocol.handle) — 표의 호스트만 이 PC 로 · help.together-working.com → 404 · www.gstatic.com/firebasejs/ 만 그대로 · 그 밖은 막는다
   ・webRequest — ws · wss · http 는 RTDB 이름의 wss 와 127.0.0.1 · localhost 만 두고 막는다
   ・main 의 Node 요청 — https.get/request · http.get/request · fetch 는 127.0.0.1 만. api.github.com(맥 업데이트 확인)은 <api>/__github/… 로 돌린다
   ・shell.openExternal · dialog.showMessageBox · showErrorBox — 열지 않고 «OPEN» · «DIALOG» 줄로 남긴다(브라우저 · 시스템 창이 포커스를 뺏지 않게)
   ・o.probe — 앱 없이 켠 확인용 실행(_kit.js guardLaunch): 프록시가 DIRECT 인지(«PROXY») · Chromium 이 정말 그 규칙으로 이름을 푸는지(«DNS») · 중계 wss 가 고정 인증서로 열리고 막을 wss 가 막히는지(«CERT» · «WSS») 남기고 끝낸다 — 판정은 R.probeProblems
   막은 것은 «BLOCK <방법> <주소>» 로 log 에 남기고 global.__e2eBlocked 에 쌓는다 — lib.quietProblems 가 읽어 그 단계를 실패시킨다.
   돌린 것은 «REQ <방법> <표시> <상태>» · 그대로 보낸 것은 «PASS <주소>» */
'use strict';
const fs = require('fs');
const electron = require('electron');
const R = require('./_route012.js');
const { app, session, shell, dialog } = electron;

module.exports = function main012(o){
  global.__e2eBlocked = [];
  const write = (line) => { try { fs.appendFileSync(o.log, line + '\n'); } catch(_){} };
  const block = (method, url) => { global.__e2eBlocked.push(url); write(`BLOCK ${method} ${url}`); };

  R.applySwitches(app.commandLine, o.proxyPort);

  async function https(ses, req){
    const u = new URL(req.url);
    // o.rejectRefresh — 끊긴 refresh token 에 진짜 서버가 주는 답(400 TOKEN_EXPIRED)을 대신 준다(Auth 에뮬레이터는 validSince 를 안 지킨다)
    if(o.rejectRefresh && u.hostname === 'securetoken.googleapis.com'){
      write(`REQ ${req.method} securetoken.googleapis.com${u.pathname} 400 (시험이 TOKEN_EXPIRED)`);
      return new Response(JSON.stringify({ error: { code: 400, message: 'TOKEN_EXPIRED', status: 'INVALID_ARGUMENT' } }), { status: 400, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    const m = R.classify(req.url, o);
    if(m.kind === 'route'){
      const tag = `${req.method} ${m.tag}`;
      try {
        const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : req.body;
        const r = await ses.fetch(m.to, { method: req.method, headers: req.headers, body, duplex: 'half', bypassCustomProtocolHandlers: true, redirect: 'manual' });
        write(`REQ ${tag} ${r.status}`);
        // RTDB 긴 폴링(.lp) 답의 h 도 에뮬레이터 주소 대신 운영 이름으로 — 안 바꾸면 SDK 가 다음 요청을 https://127.0.0.1:<포트> 로 보내 CSP 에 막힌다
        if(u.hostname === R.RTDB_HOST){
          const text = (await r.text()).replace(/"h":"127\.0\.0\.1:\d+"/g, `"h":"${R.RTDB_HOST}"`);
          const h = new Headers(r.headers); h.delete('content-length'); h.delete('content-encoding');
          return new Response(text, { status: r.status, headers: h });
        }
        return r;
      } catch(e){ write(`REQ ${tag} ERR ${e.message}`); return Response.error(); }
    }
    if(m.kind === 'help'){ write(`REQ ${req.method} ${R.HELP_HOST}${u.pathname} 404`); return new Response('not found', { status: 404 }); }
    if(m.kind === 'pass'){ write(`PASS ${req.url}`); return ses.fetch(req, { bypassCustomProtocolHandlers: true }); }
    block(req.method, req.url);
    return Response.error();
  }

  const toRe = (p) => new RegExp('^' + String(p).split('*').map((x) => x.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('.*') + '$');
  // https 는 처리기가 정한다(막을 것도 처리기가 막는다). 그 밖(ws · wss · http)은 표의 판정대로
  const allowed = (raw) => { try { if(new URL(raw).protocol === 'https:') return true; } catch(_){ return true; } return R.classify(raw, o).kind !== 'block'; };
  const done = new Set();
  function wire(ses){
    if(!ses || done.has(ses)) return;
    done.add(ses);
    ses.setCertificateVerifyProc(R.certVerifier(o.fingerprint, (h, fp, r) => write(`CERT ${h} ${fp} ${r}`)));
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
        if(R.LOCAL_RE.test(String(host).replace(/:\d+$/, ''))) return orig(a, b, c);
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
    try { if(R.LOCAL_RE.test(new URL(url).hostname)) return origFetch(input, init); } catch(_){}
    block('FETCH', url);
    return Promise.reject(new TypeError('blocked by e2e'));
  };

  if(o.probe) app.whenReady().then(() => probe(write));

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

// 확인용 실행 — 앱 없이 같은 스위치 · 같은 처리기로 켜서 ① 운영 RTDB 의 wss · https 가 프록시 없이(DIRECT) 나가는지 — 아니면 아무것도 열지 않고 끝
// ② 표지 이름이 규칙대로 풀리는지(규칙이 resolveHost 에 걸렸다는 증거 · .invalid 라 밖에 묻지 않음) ③ 표의 이름마다 무엇으로 푸는지
// ④ 운영 RTDB 이름의 wss 가 중계로 열리는지(인증서 고정 · 이름 풀이가 127.0.0.1 일 때만) ⑤ 막을 wss 가 막히는지
async function probe(write){
  const ses = session.defaultSession;
  const end = () => { write('PROBE-END'); setTimeout(() => app.exit(0), 100); };
  let direct = true;
  for(const u of R.PROBE_PROXY){
    let r; try { r = await ses.resolveProxy(u); } catch(e){ r = 'ERR ' + (e.message || e); }
    write(`PROXY ${u} ${String(r).replace(/\s+/g, '_')}`);
    if(r !== 'DIRECT') direct = false;
  }
  if(!direct) return end();
  const res = async (h) => { try { const r = await ses.resolveHost(h); return (r.endpoints || []).map((e) => e.address).join(',') || 'EMPTY'; } catch(e){ return 'ERR ' + (e.message || e); } };
  const sentinel = await res(R.SENTINEL_HOST);
  write(`DNS ${R.SENTINEL_HOST} ${sentinel}`);
  if(sentinel !== '127.0.0.1') return end();
  const dns = {};
  for(const { host } of R.GUARD_HOSTS){ dns[host] = await res(host); write(`DNS ${host} ${dns[host]}`); }
  const w = new electron.BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await w.loadURL('data:text/html,<p>probe</p>');
  const open = (url) => w.webContents.executeJavaScript(`new Promise((ok) => { const s = new WebSocket(${JSON.stringify(url)}); s.onopen = () => { s.close(); ok('OPEN'); }; s.onerror = () => ok('ERROR'); setTimeout(() => ok('TIMEOUT'), 5000); })`);
  if(dns[R.RTDB_HOST] === '127.0.0.1') write(`WSS ${R.PROBE_RELAY_WSS} ${await open(R.PROBE_RELAY_WSS)}`);
  for(const url of R.PROBE_WSS) write(`WSS ${url} ${await open(url)}`);
  end();
}
