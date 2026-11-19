// cutover-012 공통부 — 운영 0.12.3 앱을 이 PC 의 Firebase 에뮬레이터(demo- 프로젝트)에 붙여 컷오버 차례를 흉내 낸다.
// 띄우는 것(전부 이 실행이 띄우고 끝에 끈다 · tw-dev-local docker 는 건드리지 않음):
//   ・Firebase 에뮬레이터(Database · Auth · Storage) — demo-tw-c012 · 빈 포트. 앱의 RTDB 이름공간은 운영 이름 그대로(together-working-default-rtdb)
//   ・TLS 중계 — 운영 RTDB 이름의 wss 를 받아 에뮬레이터로 넘긴다. 첫 handshake 의 h(에뮬레이터 주소)를 운영 이름으로 바꾸고
//     (안 바꾸면 SDK 가 다음 연결을 wss://127.0.0.1:<에뮬레이터> 로 연다) · 오간 글을 rtdb.txt 에 남긴다(쓰기 시도 셈)
//   ・API stub — api.together-working.com 대신. /v1/config 는 mode(down · min · empty)대로, 그 밖은 503(옛 API 를 멈춘 뒤와 같음)
// 앱: 0.12.3 worktree 를 --tw-firebase=dev 없이(운영 설정) 켠다
'use strict';
const fs = require('fs');
const path = require('path');
const net = require('net');
const tls = require('tls');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const { _electron } = require('playwright-core');
const { wait, quietProblems } = require('../../lib.js');
const { acquire, QUIET_FAIL, markQuietFail } = require('../../runlock.js');

const REPO = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// 0.12.3 폴더 — TW_E2E_APP012, 없으면 저장소 옆 worktree(<저장소>/../.wt/app-0123 또는 worktree 끼리 <저장소>/../app-0123)
const APP_DIR = path.resolve(process.env.TW_E2E_APP012
  || [path.join(REPO, '..', '.wt', 'app-0123'), path.join(REPO, '..', 'app-0123')].find((d) => fs.existsSync(path.join(d, 'package.json')))
  || path.join(REPO, '..', '.wt', 'app-0123'));
// 실행마다 다른 demo- 프로젝트 — 앞 실행의 에뮬레이터 기록(허브 위치 파일)과 부딪히지 않게. RTDB 이름공간은 운영 이름 그대로
const PROJECT = 'demo-tw-c012-' + process.pid;
const NS = 'together-working-default-rtdb';
const RTDB_HOST = NS + '.asia-southeast1.firebasedatabase.app';
const RULES_012 = path.join(APP_DIR, 'firebase-database-rules.json');
const RULES_CUTOVER = path.join(REPO, 'firebase', 'firebase-database-rules-cutover.json');

function freePort(){ return new Promise((ok, no) => { const s = net.createServer(); s.on('error', no); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); }); }

// ── 에뮬레이터 ─────────────────────────────────────────────
async function startEmulatorsOnce(dir){
  const [db, auth, storage, hub, logging] = [await freePort(), await freePort(), await freePort(), await freePort(), await freePort()];
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'db.rules.json'), JSON.stringify({ rules: { '.read': false, '.write': false } }));
  // Storage 규칙은 0.12.3 저장소에 없다(콘솔에서 관리) — 얼굴 그림 올리기가 막히지 않게 «로그인한 사람은 읽고 씀» 으로 둔다
  fs.writeFileSync(path.join(dir, 'storage.rules'), "rules_version = '2';\nservice firebase.storage {\n  match /b/{bucket}/o {\n    match /{all=**} { allow read, write: if request.auth != null; }\n  }\n}\n");
  fs.writeFileSync(path.join(dir, 'firebase.json'), JSON.stringify({ database: { rules: 'db.rules.json' }, storage: { rules: 'storage.rules' },
    emulators: { database: { host: '127.0.0.1', port: db }, auth: { host: '127.0.0.1', port: auth }, storage: { host: '127.0.0.1', port: storage }, hub: { host: '127.0.0.1', port: hub },
      logging: { host: '127.0.0.1', port: logging }, ui: { enabled: false }, singleProjectMode: true } }));
  const logFile = path.join(dir, 'emulators.log');
  const log = fs.openSync(logFile, 'a');
  const p = spawn('firebase', ['emulators:start', '--only', 'database,auth,storage', '--project', PROJECT], { cwd: dir, stdio: ['ignore', log, log], detached: true });
  const exited = new Promise((r) => p.once('exit', r));
  const kill = (sig) => { try { process.kill(-p.pid, sig); } catch(_){} };
  process.on('exit', () => kill('SIGKILL'));
  // 끄기 — CLI 가 스스로 정리하게 SIGINT 를 주고 끝날 때까지(15초 넘으면 SIGKILL)
  const stop = async () => { kill('SIGINT'); if(await Promise.race([exited.then(() => true), wait(15000).then(() => false)])) return; kill('SIGKILL'); await Promise.race([exited, wait(5000)]); };
  const t0 = Date.now();
  for(;;){
    const text = fs.readFileSync(logFile, 'utf8');
    if(/All emulators ready/.test(text)) break;
    if(p.exitCode !== null || Date.now() - t0 > 90000){ await stop(); return { error: (text.match(/Error: .*/) || ['시간 넘음'])[0] }; }
    await wait(500);
  }
  return { db, auth, stop, dbUrl: 'http://127.0.0.1:' + db, authUrl: 'http://127.0.0.1:' + auth, storageUrl: 'http://127.0.0.1:' + storage };
}
// 고른 빈 포트를 CLI 가 확인하기 전에 남이 잡을 수 있다 — 포트 문제면 새 포트로 두 번까지 다시
async function startEmulators(dir){
  let r;
  for(let n = 0; n < 3; n++){
    r = await startEmulatorsOnce(dir);
    if(!r.error) return r;
    if(!/port/i.test(r.error)) break;
  }
  throw new Error('에뮬레이터가 안 뜸(' + r.error + ') — ' + path.join(dir, 'emulators.log'));
}

// RTDB REST(owner — 규칙을 건너뛴다). 경로는 'config/maintenance' 처럼
function rtdb(emu){
  const call = async (method, p, body) => {
    const r = await fetch(`${emu.dbUrl}/${p.replace(/^\/+/, '')}.json?ns=${NS}`, { method, headers: { Authorization: 'Bearer owner' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text();
    if(!r.ok) throw new Error(`RTDB ${method} ${p} → ${r.status} ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  };
  return {
    get: (p) => call('GET', p), set: (p, v) => call('PUT', p, v), update: (p, v) => call('PATCH', p, v),
    async rules(file){
      const r = await fetch(`${emu.dbUrl}/.settings/rules.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: fs.readFileSync(file, 'utf8') });
      if(!r.ok) throw new Error('규칙 올리기 실패 ' + path.basename(file) + ' → ' + r.status + ' ' + (await r.text()).slice(0, 300));
    },
  };
}

// Auth 에뮬레이터 — 비밀번호 계정 만들기 · 토큰 끊기(관리 길은 Bearer owner)
function authEmu(emu){
  const base = `${emu.authUrl}/identitytoolkit.googleapis.com/v1`;
  const post = async (p, body, admin) => {
    const r = await fetch(`${base}/${p}${admin ? '' : '?key=fake'}`, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, admin ? { Authorization: 'Bearer owner' } : {}), body: JSON.stringify(body) });
    const j = await r.json();
    if(!r.ok) throw new Error(`Auth ${p} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    return j;
  };
  return {
    signUp: (email, password) => post('accounts:signUp', { email, password, returnSecureToken: true }),
    // T-5 전원 로그아웃(cutover-logout.js)이 하는 것 — validSince 를 지금으로(그 전 refresh token 무효)
    revoke: (localId) => post(`projects/${PROJECT}/accounts:update`, { localId, validSince: String(Math.floor(Date.now() / 1000)) }, true),
    lookup: (localId) => post(`projects/${PROJECT}/accounts:lookup`, { localId: [localId] }, true),
  };
}

// ── TLS 중계(운영 RTDB 이름 → 에뮬레이터) ───────────────────
function selfCert(dir){
  const key = path.join(dir, 'rtdb.key'), crt = path.join(dir, 'rtdb.crt');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=tw-e2e-rtdb',
    '-addext', 'subjectAltName=DNS:' + RTDB_HOST, '-keyout', key, '-out', crt], { stdio: 'ignore' });
  return { key: fs.readFileSync(key), cert: fs.readFileSync(crt) };
}

// 웹소켓 틀 하나 읽기 — { fin, op, payload(가림 풀린 글), raw 길이 } · 모자라면 null
function readFrame(buf){
  if(buf.length < 2) return null;
  const b1 = buf[1], masked = !!(b1 & 0x80);
  let len = b1 & 0x7f, off = 2;
  if(len === 126){ if(buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if(len === 127){ if(buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  const mask = masked ? buf.slice(off, off + 4) : null;
  if(masked) off += 4;
  if(buf.length < off + len) return null;
  const payload = Buffer.from(buf.slice(off, off + len));
  if(mask) for(let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
  return { op: buf[0] & 0x0f, first: buf[0], payload, size: off + len };
}
function textFrame(first, text){
  const p = Buffer.from(text, 'utf8');
  const head = p.length < 126 ? Buffer.from([first, p.length]) : Buffer.concat([Buffer.from([first, 126]), Buffer.from([p.length >> 8, p.length & 0xff])]);
  return Buffer.concat([head, p]);
}

async function startRelay(dir, emu, logFile){
  const port = await freePort();
  const out = fs.createWriteStream(logFile, { flags: 'a' });
  const note = (dirn, text) => out.write(`${new Date().toISOString()} ${dirn} ${text.slice(0, 600)}\n`);
  const srv = tls.createServer(selfCert(dir), (c) => {
    const up = net.connect(emu.db, '127.0.0.1');
    let cHead = true, cBuf = Buffer.alloc(0), ws = false;
    let sHead = true, sBuf = Buffer.alloc(0), sFirst = true;
    c.on('data', (d) => {
      if(cHead){
        cBuf = Buffer.concat([cBuf, d]);
        const end = cBuf.indexOf('\r\n\r\n');
        if(end < 0) return;
        let head = cBuf.slice(0, end).toString('latin1');
        ws = /^upgrade:\s*websocket/im.test(head);
        head = head.split('\r\n').filter((l) => !/^sec-websocket-extensions:/i.test(l)).join('\r\n');   // 압축을 빼야 틀을 읽는다
        if(ws) note('C>', 'OPEN ' + head.split('\r\n')[0]);
        up.write(Buffer.concat([Buffer.from(head + '\r\n\r\n', 'latin1'), cBuf.slice(end + 4)]));
        const rest = cBuf.slice(end + 4); cHead = false; cBuf = ws ? rest : Buffer.alloc(0);
      } else { up.write(d); if(ws) cBuf = Buffer.concat([cBuf, d]); }
      if(!ws) return;
      for(let f; (f = readFrame(cBuf)); cBuf = cBuf.slice(f.size)) if(f.op === 1 || f.op === 0) note('C>', f.payload.toString('utf8'));
    });
    up.on('data', (d) => {
      if(!ws){ c.write(d); return; }
      sBuf = Buffer.concat([sBuf, d]);
      if(sHead){
        const end = sBuf.indexOf('\r\n\r\n');
        if(end < 0) return;
        note('S<', 'HEAD ' + sBuf.slice(0, sBuf.indexOf('\r\n')).toString('latin1'));
        c.write(sBuf.slice(0, end + 4)); sBuf = sBuf.slice(end + 4); sHead = false;
      }
      for(let f; (f = readFrame(sBuf)); sBuf = sBuf.slice(f.size)){
        let raw = sBuf.slice(0, f.size);
        if(f.op === 1){
          let t = f.payload.toString('utf8');
          if(sFirst && /"t":"h"/.test(t)){ t = t.replace(/"h":"[^"]*"/, `"h":"${RTDB_HOST}"`); raw = textFrame(f.first, t); }
          note('S<', t);
        }
        sFirst = false;
        c.write(raw);
      }
    });
    const end = () => { c.destroy(); up.destroy(); };
    c.on('error', end); up.on('error', end); c.on('close', end); up.on('close', end);
  });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  return { port, stop: () => { srv.close(); out.end(); } };
}

// rtdb.txt 에서 앱이 보낸 쓰기(set p · update m · onDisconnect o/om)와 거절(permission_denied)을 센다. since = ISO 시각
function rtdbStats(logFile, since){
  const lines = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n') : [];
  const writes = [], denied = [];
  const reqs = new Map();
  for(const l of lines){
    const sp = l.indexOf(' '); if(sp < 0) continue;
    const at = l.slice(0, sp); if(since && at < since) continue;
    const m = /^(\S+) (C>|S<) (.*)$/.exec(l); if(!m) continue;
    let j; try { j = JSON.parse(m[3]); } catch(_){ continue; }
    const d = j && j.d;
    if(m[2] === 'C>' && j.t === 'd' && d && ['p', 'm', 'o', 'om'].includes(d.a)){ const p = d.b && d.b.p, multi = p === '/' && d.b.d && typeof d.b.d === 'object';
      const w = { at, a: d.a, p: multi ? '/{' + Object.keys(d.b.d).map((x) => x.split('/').slice(0, 3).join('/')).join(',') + '}' : p, r: d.r }; writes.push(w); reqs.set(d.r, w); }
    if(m[2] === 'S<' && j.t === 'd' && d && d.b && d.b.s === 'permission_denied' && reqs.has(d.r)) denied.push(reqs.get(d.r));
  }
  const byPath = {};
  for(const w of writes) byPath[w.p] = (byPath[w.p] || 0) + 1;
  return { writes, denied, byPath };
}

// ── API stub ───────────────────────────────────────────────
async function startApiStub(logFile){
  const port = await freePort();
  const st = { mode: 'down', github: null };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
  const srv = http.createServer((req, res) => {
    const send = (code, body) => { res.writeHead(code, Object.assign({ 'content-type': 'application/json' }, cors)); res.end(JSON.stringify(body)); fs.appendFileSync(logFile, `${new Date().toISOString()} ${req.method} ${req.url} ${code} mode=${st.mode}\n`); };
    if(req.method === 'OPTIONS') return send(204, {});
    if(req.url.startsWith('/__github/')){
      // 맥 업데이트 확인(main.js checkMacUpdate)이 읽는 «최신 릴리스» — 받기는 브라우저가 하므로 주소만 준다(OPEN 줄로 남고 열리지 않는다)
      return st.github ? send(200, st.github) : send(404, { message: 'Not Found' });
    }
    if(req.url.split('?')[0] === '/v1/config'){
      if(st.mode === 'min') return send(200, { success: true, data: { version: 1, syncedAt: Date.now(), config: { minVersion: { app: '0.13.0', room: '0.13.0' } } } });
      if(st.mode === 'empty') return send(200, { success: true, data: { version: 1, syncedAt: Date.now(), config: {} } });
    }
    send(503, { success: false, code: 'ADMIN_ONLY', message: '점검 중' });
  });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  return { url: 'http://127.0.0.1:' + port, st, stop: () => srv.close() };
}

// ── 앱 한 벌 ───────────────────────────────────────────────
// lib.makeApp 과 같은 모양(감싸는 진입점이 appData 를 결과 폴더로 · quiet-main.js) — 앱 폴더 · 주소 돌리기(_main012.js) · 운영 설정만 다르다
function makeApp012(outArg, env){
  const out = path.resolve(outArg);
  const logs = [];
  const quiet = process.env.TW_E2E_QUIET !== '0';
  let app = null;
  const netLog = path.join(out, 'net.txt');
  async function quit(){
    if(!app) return;
    const pid = app.process().pid;
    const closed = new Promise((r) => app.once('close', r));
    await app.evaluate(({ app: a }) => setTimeout(() => a.exit(0), 50)).catch(() => {});
    await Promise.race([closed, wait(10000)]);
    try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch(_){}
    app = null;
  }
  async function launch(){
    const wrap = path.join(out, 'wrap');
    fs.mkdirSync(wrap, { recursive: true });
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'));
    fs.writeFileSync(path.join(wrap, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, main: 'main.js' }));
    // 키 입력 안내 · 실험실 영상 안내(시스템 창)는 «다시 보지 않기» 로 둔다 — 떠도 _main012 가 DIALOG 줄로만 남긴다
    const ud = path.join(out, 'appdata', pkg.name);
    fs.mkdirSync(ud, { recursive: true });
    for(const f of ['kb-guide-off', 'lab-video-guide-off']) fs.writeFileSync(path.join(ud, f), '1');
    const o = { log: netLog, rtdbHost: RTDB_HOST, proxyPort: env.relay.port, db: env.emu.dbUrl, auth: env.emu.authUrl, storage: env.emu.storageUrl, api: env.api.url, rejectRefresh: !!env.rejectRefresh };
    fs.writeFileSync(path.join(wrap, 'main.js'),
      `require('electron').app.setPath('appData', ${JSON.stringify(path.join(out, 'appdata'))});\n`
      + (quiet ? `require(${JSON.stringify(path.join(__dirname, '..', '..', 'quiet-main.js'))});\n` : '')
      + `require(${JSON.stringify(path.join(__dirname, '_main012.js'))})(${JSON.stringify(o)});\n`
      + `require(${JSON.stringify(path.join(APP_DIR, pkg.main || 'main.js'))});\n`);
    app = await _electron.launch({ args: [wrap], cwd: APP_DIR, executablePath: require(path.join(APP_DIR, 'node_modules', 'electron')) });
    app.process().stdout.on('data', (d) => logs.push('[main] ' + String(d).trim().slice(0, 300)));
    app.process().stderr.on('data', (d) => logs.push('[main-err] ' + String(d).trim().slice(0, 300)));
    const got = await app.evaluate(({ app: a }) => a.getPath('userData'));
    if(!got.startsWith(out)){ await quit(); throw new Error('userData 가 시험 폴더 밖: ' + got); }
    const hook = (p) => { p.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`)); p.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`)); };
    app.on('window', hook);
    app.windows().forEach(hook);
    return app.firstWindow({ timeout: 90000 });
  }
  const lines = (re) => { try { return fs.readFileSync(netLog, 'utf8').split('\n').filter((l) => re.test(l)); } catch(_){ return []; } };
  return { launch, quit, logs, out, quiet, lines, get app(){ return app; } };
}

// ── 시나리오 틀 ─────────────────────────────────────────────
// run(name, async (t) => { … }) — 잠금 · 에뮬레이터 · 중계 · stub 을 띄우고 steps.txt 를 쓴다. t: { step, env, db, auth, app(), shot, note }
async function run(name, body){
  const out = path.resolve(process.argv[2] || path.join(process.env.TW_E2E_OUT || '/tmp/tw-e2e', 'cutover-012', name));
  if(!out.startsWith('/tmp/') && !out.startsWith('/private/tmp/')){ console.error('결과 폴더는 /tmp 아래로: ' + out); process.exit(2); }
  if(QUIET_FAIL && fs.existsSync(QUIET_FAIL)){ console.error('e2e-quiet-fail 이 있어 켜지 않음: ' + QUIET_FAIL); process.exit(3); }
  if(!fs.existsSync(path.join(APP_DIR, 'node_modules', 'electron'))){ console.error('0.12.3 앱 폴더에 npm install 이 안 됨: ' + APP_DIR); process.exit(2); }
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const steps = [];
  const save = () => fs.writeFileSync(path.join(out, 'steps.txt'), steps.join('\n') + '\n');
  const unlock = await acquire('cutover-012/' + name);
  if(QUIET_FAIL && fs.existsSync(QUIET_FAIL)){ steps.push('ABORT e2e-quiet-fail 이 있음'); save(); unlock(); process.exit(3); }
  const apps = [];
  let shotN = 0, code = 0;
  const env = {};
  const t = {
    out, env,
    note: (s) => { steps.push('note ' + s); save(); },
    newApp(sub){ const a = makeApp012(path.join(out, sub || 'pc'), env); apps.push(a); return a; },
    async shot(w, label){ const f = path.join(out, String(++shotN).padStart(2, '0') + '-' + label + '.png'); try { await w.screenshot({ path: f }); } catch(_){} return f; },
    async step(label, fn){
      const t0 = Date.now();
      try {
        const r = await Promise.race([fn(), wait(180000).then(() => { throw new Error('3분 넘음'); })]);
        for(const a of apps){
          if(!a.app || !a.quiet) continue;
          const bad = await quietProblems(a.app);
          if(bad.length){
            const leak = bad.filter((b) => !/^진짜 서버로/.test(b));
            if(leak.length) markQuietFail('cutover-012/' + name + ' ' + label + ' — ' + leak.join(' / '));
            throw new Error('조용한 창 · 막힌 요청 — ' + bad.join(' / '));
          }
        }
        steps.push('ok   ' + label + (r ? ' — ' + r : '') + ' (' + (Date.now() - t0) + 'ms)'); save();
        return r;
      } catch(e){
        steps.push('FAIL ' + label + ': ' + e.message); save();
        for(const a of apps) if(a.app){ for(const w of a.app.windows()) await t.shot(w, 'fail').catch(() => {}); }
        throw e;
      }
    },
  };
  try {
    env.emu = await startEmulators(path.join(out, 'emu'));
    env.relay = await startRelay(path.join(out, 'emu'), env.emu, path.join(out, 'rtdb.txt'));
    env.api = await startApiStub(path.join(out, 'api.txt'));
    t.db = rtdb(env.emu);
    t.auth = authEmu(env.emu);
    t.rtdbStats = (since) => rtdbStats(path.join(out, 'rtdb.txt'), since);
    await body(t);
    steps.push('PASS');
  } catch(e){
    code = 1;
    if(!steps.some((s) => s.startsWith('FAIL '))) steps.push('FAIL ' + (e && e.stack || e));
    steps.push('ABORT');
  } finally {
    for(const a of apps){
      try { fs.writeFileSync(path.join(a.out, 'console.txt'), a.logs.join('\n') + '\n'); } catch(_){}
      await a.quit().catch(() => {});
    }
    for(const k of ['api', 'relay', 'emu']) try { env[k] && await env[k].stop(); } catch(_){}
    save();
    unlock();
  }
  console.log(steps.join('\n'));
  process.exit(code);
}

// 0.12.3 의 기본 운영 값 — 평소(점검 전) 상태. 규칙은 0.12.3 판, 점검 끔, 최소 버전 0.12.1(D-7)
async function seedNormal(t){
  await t.db.rules(RULES_012);
  await t.db.set('config', { maintenance: { on: false }, minAppVer: '0.12.1', minRoomVer: '0.12.1', flags: { inviteGate: false, existingSignup: false } });
}

// 로그인을 연결한 옛 사용자 한 명 — 옮기는 대상(런북 5장)과 같은 모양. Auth 계정 · userAuth · authUsers · 친구 코드를 넣고,
// 앱을 한 번 켜서 이 PC 의 신원(tw.myUserId · 초대 통과)을 적은 뒤 다시 켜 «로그인 필요» 창에서 친구 코드 비밀번호로 로그인한다
async function prepareUser(t, A, opts = {}){
  const code = 'MATE-' + Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z2-9]/g, 'X');
  const uid = 'u' + Date.now().toString(36) + 'e2etest';
  const pw = 'e2e-' + Math.random().toString(36).slice(2, 10);
  const s = await t.auth.signUp(code.toLowerCase() + '@tw.local', pw);
  await t.db.update('', { [`userAuth/${uid}`]: s.localId, [`authUsers/${s.localId}`]: { userCode: uid }, [`users/${uid}/friendCode`]: code, [`friendCodes/${code}`]: uid });
  let w = await A.launch();
  await w.waitForLoadState('domcontentloaded');
  // 라이선스(투게더룸 · 대화) — 키 한 줄과 이 PC 저장값. 앱이 켤 때 licenses/<키> 를 다시 확인한다
  const key = opts.premium ? 'TWE2E-' + uid.slice(-8).toUpperCase() : null;
  if(key) await t.db.set(`licenses/${key}`, { valid: true, createdAt: Date.now(), redeemedAt: Date.now() });
  await w.evaluate((a) => {
    localStorage.setItem('tw.myUserId', a.uid); localStorage.setItem('tw.myFriendCode', a.code); localStorage.setItem('tw.invitePassed', '1');
    if(a.key) localStorage.setItem('tw.licenseKey', a.key);
  }, { uid, code, key });
  await A.quit();
  w = await A.launch();
  await w.waitForSelector('#needLoginOverlay', { state: 'visible', timeout: 30000 });
  await w.fill('#nlPw', pw);
  await w.click('#nlFcBtn');
  await w.waitForSelector('#needLoginOverlay', { state: 'hidden', timeout: 30000 });
  const authUid = await until(() => w.evaluate(() => window.firebaseAPI && window.firebaseAPI.authCurrentUid()), 10000);
  if(authUid !== s.localId) throw new Error('로그인 안 됨 — authCurrentUid ' + authUid);
  // 한 번 더 켠다 — 로그인 전 첫 실행이 낸 거절 표시(🔑 띠)가 남지 않은, 평소처럼 로그인된 채 켠 앱
  await A.quit();
  w = await A.launch();
  const again = await until(() => w.evaluate(() => window.firebaseAPI && window.firebaseAPI.authCurrentUid()), 20000);
  if(again !== s.localId) throw new Error('다시 켠 뒤 로그인이 이어지지 않음 — ' + again);
  if(await w.isVisible('#needLoginOverlay')) throw new Error('다시 켠 뒤 «로그인 필요» 창이 뜸');
  return { w, uid, code, pw, authUid: s.localId };
}

// 런처 빈 칸 → 사람 → «다음» 을 «완성 → 저장» 이 나올 때까지 → 저장. 런처 글 «슬롯에 저장했어요» 를 기다린다
// 점검 중이면 누를 때마다 점검 창이 뜰 수 있어(서버를 부르는 동작) 누르기 전에 닫는다
async function createCharacter(w){
  const press = async (sel) => { await closeMaint(w); await w.click(sel); };
  await press('#lcEmpty');
  await press('#raceHuman');
  for(let i = 0; i < 15; i++){
    await closeMaint(w);
    const done = w.locator('button:visible', { hasText: '완성 → 저장' });
    if(await done.count()){ await done.first().click(); break; }
    await press('#crNext');
    await wait(300);
  }
  await w.waitForSelector('#lcEmpty', { state: 'hidden', timeout: 20000 });
}

// 화면 읽기 — 점검 창(maintenance-gate.js) · 업데이트 화면(app-version-gate.js) · 토스트 · 🔑 띠
const MAINT = '#maintGateOverlay', VERGATE = '#appVerGateOverlay';
async function screen(w){
  return w.evaluate(([m, v]) => {
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
    const box = (sel) => { const el = document.querySelector(sel); return vis(el) ? { text: el.innerText.trim(), buttons: [...el.querySelectorAll('button')].map((b) => b.textContent.trim()) } : null; };
    const toast = document.getElementById('toast');
    const band = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && /^🔑/.test((e.textContent || '').trim()) && vis(e) && e.offsetWidth > 0).map((e) => e.textContent.trim());
    return { maint: box(m), gate: box(v), lost: box('#deviceSessionOverlay'), toast: toast && vis(toast) && toast.offsetWidth > 0 ? toast.innerText.trim() : '', band: band[0] || '' };
  }, [MAINT, VERGATE]);
}
async function closeMaint(w){
  const s = await screen(w);
  if(!s.maint) return false;
  await w.locator(MAINT + ' button', { hasText: s.maint.buttons.includes('확인') ? '확인' : '나중에' }).click();
  return true;
}
// 죽지 않음 — 렌더러가 답하고 GONE 줄이 없다
async function alive(A, w){
  const r = await Promise.race([w.evaluate(() => 1).catch((e) => 'ERR ' + e.message), wait(5000).then(() => 'TIMEOUT')]);
  const gone = A.lines(/^GONE /);
  if(r !== 1 || gone.length) throw new Error('앱이 죽음 — ' + r + ' ' + gone.join(' | '));
}

const until = async (fn, ms, every = 250) => { const t0 = Date.now(); let v; while(Date.now() - t0 < ms){ v = await fn(); if(v) return v; await wait(every); } return v; };

module.exports = { run, seedNormal, prepareUser, createCharacter, screen, closeMaint, alive, MAINT, VERGATE, until, wait, APP_DIR, RTDB_HOST, NS, RULES_012, RULES_CUTOVER, PROJECT };
