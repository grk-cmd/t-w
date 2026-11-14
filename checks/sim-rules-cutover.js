/* sim-rules-cutover.js — 🔐 컷오버용 작은 규칙(firebase-database-rules-cutover.json) 한 벌
   실행: node checks/run.js rules-cutover
   [왜] 컷오버 T+2 에 큰 규칙을 이 작은 규칙으로 바꿔 올린다(런북 8장 ②). 0.12.1 앱이 켜질 때 읽는 세 칸(점검 · 최소 앱 버전 · 최소 방 버전)은
     로그인 없이 읽혀야 하고(안 읽히면 옛 앱이 업데이트 창 · 점검 창 없이 켜진다), 그 밖의 모든 맨 위 칸은 읽기 · 쓰기가 막혀야 하며(옮기는 동안 데이터가 바뀌면 안 된다),
     점검 칸은 관리자(admins)만 쓸 수 있어야 한다.
   [무엇을 본다] 1절: 규칙 글 — 큰 규칙의 맨 위 칸 이름을 하나씩 대어 «작은 규칙이 그 칸을 열지 않는다» · 열린 곳은 셋뿐 · 설정 파일이 그 규칙을 가리킨다.
     2절: 실제 판정 — Firebase 데이터베이스 에뮬레이터(firebase CLI + Java)가 있으면 규칙을 올려 REST 로 하나씩 보낸다. 없으면 건너뛴다(CI 에는 없다 — 규칙을 바꾼 PR 은 손으로 돌려 본문에 붙인다). */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawnSync } = require('child_process');

const read = (f) => { for (const c of [f, path.join(__dirname, f), path.join(__dirname, '..', 'firebase', f)]) { try { return fs.readFileSync(c, 'utf8'); } catch (_) {} } return null; };
const SMALL_SRC = read('firebase-database-rules-cutover.json');
const BIG_SRC = read('firebase-database-rules.json');
const CFG_SRC = read('firebase.cutover.json');
if (!SMALL_SRC || !BIG_SRC || !CFG_SRC) { console.log('  ? 원본 못 찾음 — firebase-database-rules-cutover.json · firebase-database-rules.json · firebase.cutover.json'); process.exit(2); }

const PROJECT = 'demo-tw-rules-cutover';
const NS = PROJECT + '-default-rtdb';
const ADMIN = 'adminA', USER = 'userB';
const OWNER = '!owner';
const OPEN = ['config/minAppVer', 'config/minRoomVer', 'config/maintenance'];

function userToken(uid) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return b({ alg: 'none', typ: 'JWT' }) + '.' + b({ sub: uid, user_id: uid, iat: now, exp: now + 3600, aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT, firebase: { sign_in_provider: 'google.com' } }) + '.';
}

/* 에뮬레이터에 보낼 경우: [이름, 방법, 경로, 본문, 통과 기대, 사람] */
function cases(topKeys) {
  const M = { on: true, endsAt: Date.now() + 3600e3, message: '점검 중' };
  return [
    ['준비: 관리자 한 명(admins/adminA)', 'PUT', `admins/${ADMIN}`, true, true, OWNER],
    ['준비: 점검 칸 값', 'PUT', 'config/maintenance', M, true, OWNER],
    ['준비: 최소 앱 버전 값', 'PUT', 'config/minAppVer', '0.12.1', true, OWNER],
    ['준비: 최소 방 버전 값', 'PUT', 'config/minRoomVer', '0.12.1', true, OWNER],
    ...OPEN.map((p) => [`로그인 없이 ${p} 읽기`, 'GET', p, null, true]),
    ...OPEN.map((p) => [`일반 사용자가 ${p} 읽기`, 'GET', p, null, true, USER]),
    ['config 통째 읽기는 막힘(세 칸만 열림)', 'GET', 'config', null, false],
    ['admins 읽기는 막힘', 'GET', 'admins', null, false],
    ['admins 읽기는 관리자도 막힘', 'GET', 'admins', null, false, ADMIN],
    ['점검 칸 쓰기 — 로그인 없이', 'PUT', 'config/maintenance', M, false],
    ['점검 칸 쓰기 — 일반 사용자', 'PUT', 'config/maintenance', M, false, USER],
    ['점검 칸 쓰기 — 관리자', 'PUT', 'config/maintenance', { ...M, message: '늘림' }, true, ADMIN],
    ['점검 칸 모양 틀림 — 관리자라도 거절(on 이 불리언 아님)', 'PUT', 'config/maintenance', { on: 'yes' }, false, ADMIN],
    ['점검 칸 모르는 칸 — 관리자라도 거절', 'PUT', 'config/maintenance', { on: false, x: 1 }, false, ADMIN],
    ['최소 앱 버전 쓰기 — 관리자도 거절(운영자는 CLI 로 쓴다)', 'PUT', 'config/minAppVer', '9.9.9', false, ADMIN],
    ['최소 방 버전 쓰기 — 관리자도 거절', 'PUT', 'config/minRoomVer', '9.9.9', false, ADMIN],
    ['admins 쓰기 — 관리자도 거절(스스로 더하지 못함)', 'PUT', `admins/${USER}`, true, false, ADMIN],
    ...topKeys.flatMap((k) => [
      [`${k} 읽기 — 로그인 없이 거절`, 'GET', k, null, false],
      [`${k} 읽기 — 관리자도 거절`, 'GET', k, null, false, ADMIN],
      [`${k} 쓰기 — 일반 사용자 거절`, 'PUT', `${k}/x`, { a: 1 }, false, USER],
      [`${k} 쓰기 — 관리자도 거절`, 'PUT', `${k}/x`, { a: 1 }, false, ADMIN],
    ]),
    ['맨 위 통째 쓰기 — 관리자도 거절', 'PUT', '', { z: 1 }, false, ADMIN],
  ];
}

async function inner() {
  const PORT = Number(process.env.TW_EMU_PORT);
  const keys = JSON.parse(process.env.TW_TOP_KEYS);
  let fail = 0;
  for (const [name, method, p, body, want, uid] of cases(keys)) {
    const owner = uid === OWNER;
    const enc = p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const url = `http://127.0.0.1:${PORT}/${enc}.json?ns=${NS}` + (uid && !owner ? '&auth=' + userToken(uid) : '');
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(owner ? { Authorization: 'Bearer owner' } : {}) }, body: body === null ? undefined : JSON.stringify(body) });
    const ok = r.status === 200;
    if (ok !== want) fail++;
    console.log(`  ${ok === want ? '✓' : '✗'} ${name} — ${ok ? '통과' : '거절'}${ok === want ? '' : ' (기대: ' + (want ? '통과' : '거절') + ')'}`);
  }
  console.log(fail ? `\n✗ ${fail}건이 기대와 다름` : '\n✓ 에뮬레이터 판정 모두 기대대로');
  process.exit(fail ? 1 : 0);
}

function freePort() { return new Promise((ok, no) => { const s = net.createServer(); s.on('error', no); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); }); }

async function emulate(topKeys, rulesSrc) {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-rules-cutover-'));
  fs.writeFileSync(path.join(dir, 'database.rules.json'), rulesSrc);
  fs.writeFileSync(path.join(dir, 'firebase.json'), JSON.stringify({ database: { rules: 'database.rules.json' }, emulators: { database: { port }, ui: { enabled: false }, singleProjectMode: true } }));
  const r = spawnSync('firebase', ['emulators:exec', '--only', 'database', '--project', PROJECT, `node "${__filename}" --inner`],
    { cwd: dir, env: { ...process.env, TW_EMU_PORT: String(port), TW_TOP_KEYS: JSON.stringify(topKeys) }, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split('\n').filter((l) => /^\s+[✓✗] |^[✓✗] /.test(l));
  return { lines, status: r.status, error: r.error, out };
}

function main() {
  let pass = 0, fail = 0;
  const chk = (ok, msg) => { ok ? pass++ : fail++; console.log('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
  const small = JSON.parse(SMALL_SRC).rules;
  const big = JSON.parse(BIG_SRC).rules;
  const topKeys = Object.keys(big).filter((k) => !k.startsWith('.') && k !== 'config' && k !== 'admins');

  console.log('\n── 1. 규칙 글');
  chk(small['.read'] === false && small['.write'] === false, '맨 위 읽기 · 쓰기가 닫혀 있다');
  chk(Object.keys(small).filter((k) => !k.startsWith('.')).sort().join() === 'admins,config', '맨 위 칸은 config · admins 둘뿐(큰 규칙의 나머지 ' + topKeys.length + '칸은 규칙 자체가 없다)');
  chk(topKeys.length >= 50, '큰 규칙의 맨 위 칸을 읽었다(' + topKeys.length + '칸 + config · admins)');
  chk(topKeys.every((k) => !(k in small)), '큰 규칙의 다른 맨 위 칸을 하나도 열지 않았다');
  const opened = [];
  (function walk(n, p) { for (const k of Object.keys(n)) { if (k === '.read' && n[k] !== false) opened.push(p || '(맨 위)'); else if (!k.startsWith('.') && typeof n[k] === 'object') walk(n[k], p ? p + '/' + k : k); } })(small, '');
  chk(opened.sort().join() === [...OPEN].sort().join(), '읽기가 열린 곳은 세 칸뿐: ' + opened.join(' · '));
  chk(OPEN.every((p) => p.split('/').reduce((o, k) => o && o[k], small)['.read'] === true), '세 칸은 로그인 없이 읽힌다(.read: true)');
  const writes = [];
  (function walk(n, p) { for (const k of Object.keys(n)) { if (k === '.write' && n[k] !== false) writes.push(p); else if (!k.startsWith('.') && typeof n[k] === 'object') walk(n[k], p ? p + '/' + k : k); } })(small, '');
  chk(writes.join() === 'config/maintenance', '쓰기가 열린 곳은 점검 칸 하나뿐: ' + writes.join(' · '));
  chk(/auth != null/.test(small.config.maintenance['.write']) && /root\.child\('admins'\)\.child\(auth\.uid\)\.val\(\) === true/.test(small.config.maintenance['.write']), '점검 칸 쓰기는 로그인 + admins 에 있는 사람만');
  chk(small.admins['.read'] === false && small.admins.$uid['.write'] === false, 'admins 는 읽기 · 쓰기 모두 막힘(규칙이 admins 를 읽는 것은 읽기 규칙과 상관없다)');
  chk(small.config.maintenance['.validate'] === big.config.maintenance['.validate'] && JSON.stringify(small.config.maintenance.$other) === JSON.stringify(big.config.maintenance.$other), '점검 칸 모양 검사가 큰 규칙과 같다(0.12.1 앱 · 웹 관리자가 쓰던 모양)');
  chk(JSON.parse(CFG_SRC).database.rules === 'firebase-database-rules-cutover.json', '설정 파일(firebase.cutover.json)이 작은 규칙을 가리킨다');

  console.log('\n── 2. 실제 판정(에뮬레이터)');
  const have = spawnSync('firebase', ['--version'], { encoding: 'utf8' }).status === 0 && spawnSync('java', ['-version'], { encoding: 'utf8' }).status === 0;
  const finish = () => { console.log(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`); process.exit(fail ? 1 : 0); };
  if (!have) { console.log('  - firebase CLI 또는 Java 가 없어 건너뜀(CI · 규칙을 바꾼 PR 은 손으로 돌려 결과를 본문에 붙인다)'); return finish(); }
  return emulate(topKeys, SMALL_SRC).then((r) => {
    if (!r.lines.length) { chk(false, '에뮬레이터 출력을 못 읽음: ' + r.out.slice(-300)); return finish(); }
    console.log(r.lines.join('\n'));
    chk(r.status === 0, '에뮬레이터 판정 ' + r.lines.filter((l) => /✓/.test(l)).length + '건 모두 기대대로');
    finish();
  });
}

if (process.argv.includes('--inner')) inner(); else main();
