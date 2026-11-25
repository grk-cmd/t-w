/* ═══ 🔒 sim-storage-owners-cli.js — Storage 주인 문서 확인 · 채우기 도구 scripts/storage-owners.js ═══
   소유자가 규칙을 올리기 전에 «계정 수 = 문서 수 · 빠진 계정 0» 을 이 도구로 본다(tw-docs design/12-storage-owner.md 6장).
   ・1절: report — ready 일 때만 «올려도 돼요» · 아닐 때 이유(빠진 계정 · 수가 다름) · orphans 안내
   ・2절: 가짜 API 서버로 check · backfill 을 실제로 돌린다(관리자 토큰 · 만료된 토큰은 todo.js session 으로 새로 받기 · 메모 필수 · 403 은 관리자 안내 · 로그인 파일 없음)
   ・3절: mutation test — ready 를 안 보고 «올려도 돼요» 를 찍으면 빨강
   [실행] node checks/run.js storage-owners-cli */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
for(const f of ['scripts/storage-owners.js', 'scripts/todo.js']) if(!fs.existsSync(f)){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); }
const SCRIPT = path.resolve('scripts/storage-owners.js');
const SRC = fs.readFileSync(SCRIPT, 'utf8');

function judgeReport(report){
  const ok = report({ users: 3, written: 3, documents: 3, missing: 0, orphans: 0, ready: true });
  const miss = report({ users: 3, written: 0, documents: 2, missing: 1, orphans: 0, ready: false });
  const diff = report({ users: 3, written: 3, documents: 4, missing: 0, orphans: 1, ready: false });
  return [
    [/✓ ready/.test(ok) && /firestore:rules,storage/.test(ok) && !/✗/.test(ok), 'ready → «올려도 돼요» 와 배포 명령'],
    [/✗ 아직/.test(miss) && /빠진 계정 1 명/.test(miss) && !/✓ ready/.test(miss), 'missing → 아직 · 빠진 수 · backfill 다시'],
    [/✗ 아직/.test(diff) && /3 ≠ 4/.test(diff) && /DB 에 없는 문서 1 개/.test(diff), '수가 다름 → 아직 · 두 수 · orphans 안내'],
  ];
}

say('── 1. report');
for(const [ok, msg] of judgeReport(require(SCRIPT).report)) chk(ok, msg);

function run(args, env){
  return new Promise((res) => {
    const p = spawn(process.execPath, [SCRIPT, ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => res({ code, out }));
  });
}

(async () => {
  say('── 2. 가짜 API 서버');
  const seen = [];
  let status = 200;
  const srv = http.createServer((req, rs) => {
    let b = ''; req.on('data', (d) => { b += d; });
    req.on('end', () => {
      if(req.url.startsWith('/refresh')){   // Firebase securetoken 흉내 — refresh token → 새 ID 토큰
        seen.push({ m: req.method, u: req.url, body: b });
        rs.writeHead(200, { 'Content-Type': 'application/json' });
        rs.end(JSON.stringify({ id_token: 'tok-new', refresh_token: 'r2', expires_in: '3600', user_id: 'U1' }));
        return;
      }
      seen.push({ m: req.method, u: req.url, auth: req.headers.authorization, body: b });
      const data = { users: 2, written: req.method === 'POST' ? 2 : 0, documents: 2, missing: 0, orphans: 0, ready: true };
      rs.writeHead(status, { 'Content-Type': 'application/json' });
      rs.end(JSON.stringify(status === 200 ? { success: true, data } : { success: false, code: 'ACCESS_DENIED' }));
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-so-'));
  const authPath = path.join(dir, 'auth.json');
  fs.writeFileSync(authPath, JSON.stringify({ uid: 'U1', refreshToken: 'r', idToken: 'tok-1', idTokenExp: Date.now() + 3600e3 }), { mode: 0o600 });
  const base = 'http://127.0.0.1:' + srv.address().port;
  const env = { TW_TODO_API: base, TW_TODO_AUTH: authPath, TW_TODO_FIREBASE_KEY: 'k', TW_TODO_REFRESH_URL: base + '/refresh' };

  const c = await run(['check'], env);
  chk(c.code === 0 && /계정 2 · 문서 2/.test(c.out) && seen[0].m === 'GET' && seen[0].u === '/v2/admin/storage-owners' && seen[0].auth === 'Bearer tok-1', 'check — GET /v2/admin/storage-owners · 관리자 토큰 · 결과 줄');
  const noMemo = await run(['backfill'], env);
  chk(noMemo.code === 1 && /메모를 적어/.test(noMemo.out) && seen.length === 1, 'backfill 메모 없음 → 요청 0 · 안내');
  const b = await run(['backfill', '규칙 올리기 전'], env);
  const last = seen[seen.length - 1];
  chk(b.code === 0 && last.m === 'POST' && last.u === '/v2/admin/storage-owners/backfill' && JSON.parse(last.body).memo === '규칙 올리기 전' && /이번에 쓴 것 2/.test(b.out), 'backfill — POST …/backfill { memo } · 결과 줄');
  fs.writeFileSync(authPath, JSON.stringify({ uid: 'U1', refreshToken: 'r', idToken: 'tok-old', idTokenExp: Date.now() - 1000 }), { mode: 0o600 });
  seen.length = 0;
  const rf = await run(['check'], env);
  const saved = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  chk(rf.code === 0 && seen[0].u.startsWith('/refresh') && /grant_type=refresh_token/.test(seen[0].body) && seen[1].auth === 'Bearer tok-new' && saved.idToken === 'tok-new' && saved.refreshToken === 'r2',
    '만료된 토큰 — todo.js session 이 새로 받아(refresh) 그 토큰으로 부르고 로그인 파일에 적는다');
  status = 403;
  const d = await run(['check'], env);
  chk(d.code === 1 && /관리자 계정만/.test(d.out), '403 → 관리자 계정 안내');
  const noAuth = await run(['check'], { ...env, TW_TODO_AUTH: path.join(dir, 'none.json') });
  chk(noAuth.code === 1 && /todo\.js setup/.test(noAuth.out), '로그인 파일 없음 → setup 안내');
  srv.close(); fs.rmSync(dir, { recursive: true, force: true });

  say('── 3. mutation test');
  const broken = SRC.replace("if(r.ready) lines.push(", "if(true) lines.push(");
  if(broken === SRC){ chk(false, 'ready 판정 줄을 못 찾음'); }
  else {
    const m = { exports: {} };
    new Function('require', 'module', 'exports', '__dirname', broken.replace(/^#!.*\n/, ''))((x) => require(x === './todo.js' ? path.resolve('scripts/todo.js') : x), m, m.exports, path.dirname(SCRIPT));
    chk(judgeReport(m.exports.report).some(([ok]) => !ok), 'mutation test — ready 를 안 보고 «올려도 돼요» → 빨강');
  }
  say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
