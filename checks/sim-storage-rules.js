/* sim-storage-rules.js — Storage 규칙 두 벌: 0.13 규칙(storage.rules)과 점검 동안의 쓰기 잠금(storage-lock.rules)
   실행: node checks/run.js storage-rules
   [왜] 컷오버 T+2 에 잠금을, 점검 끝 무렵에 0.13 규칙을 올린다(tw-docs 06-cutover.md 8장 ② · ⑧).
     기본 설정(firebase.json)의 storage 항목(키)이 잠금이나 다른 파일을 가리키면 평소 배포가 잠금을 풀거나 걸고, 잠금 설정에 database · hosting 항목이 끼면
     잠금을 올리는 명령이 RTDB 규칙 · 사이트까지 바꾼다. 두 파일의 경로가 어긋나면 잠금이 어떤 경로를 열어 두거나 0.13 에서 읽기가 끊긴다.
   [무엇을 본다] 1절: 설정 — firebase.json 은 storage.rules · 컷오버 RTDB 규칙 그대로 · 잠금 설정은 storage 항목 하나(일부러 깬 설정이 빨강인지도).
     2절: 두 파일의 경로 · 봇 uid 가 같다.
     3절: 실제 판정 — Storage 에뮬레이터(firebase CLI + Java)가 있으면 두 규칙을 올려 REST 로 하나씩 보낸다. 봇 상한(마이홈 8MB · assets PNG · WebP 512KB · GLB 1MB)은 0.13 서버와 같다.
     mutation test: 지우기 항을 뺀 규칙 · 봇 검사를 뺀 규칙 · 봇 마이홈 상한을 뺀 규칙이 각각 다르게 판정되는지 본다.
     없으면 건너뛴다(CI 에는 없다 — 규칙을 바꾼 PR 은 손으로 돌려 본문에 붙인다). */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawnSync } = require('child_process');

const read = (f) => { for (const c of [f, path.join(__dirname, f), path.join(__dirname, '..', 'firebase', f)]) { try { return fs.readFileSync(c, 'utf8'); } catch (_) {} } return null; };
const MAIN_FILE = 'storage.rules';
const LOCK_FILE = 'storage-lock.rules';
const LOCK_CFG = 'firebase.storage-lock.json';
const CUTOVER_DB = 'firebase-database-rules-cutover.json';
const MAIN_SRC = read(MAIN_FILE);
const LOCK_SRC = read(LOCK_FILE);
const CFG_SRC = read('firebase.json');
const LOCK_CFG_SRC = read(LOCK_CFG);
if (!MAIN_SRC || !LOCK_SRC || !CFG_SRC || !LOCK_CFG_SRC) { console.log('  ? 원본 못 찾음 — ' + [MAIN_FILE, LOCK_FILE, 'firebase.json', LOCK_CFG].join(' · ')); process.exit(2); }

const PROJECT = 'demo-tw-storage-rules';
const BUCKET = PROJECT + '.appspot.com';
const OWNER = '!owner';          // 규칙을 건너뛰는 준비용(에뮬레이터 관리자)
const USER = 'userA';            // 0.12 · 0.13 앱 사용자(로그인함)
const ANON = null;               // 로그인 없음(0.12 마이홈은 Firebase Auth 를 안 쓴다)
const KB = 1024, MB = 1024 * 1024;

const botUid = (src) => { const m = src.match(/function isBot\(\)\s*\{\s*return request\.auth != null && request\.auth\.uid == '([^']+)';/); return m && m[1]; };
const BOT = botUid(MAIN_SRC);
const matchPaths = (src) => [...src.matchAll(/^\s*match (\/[^\s{]*(?:\{[^}]*\}[^\s{]*)*) \{/gm)].map((m) => m[1]).filter((p) => p !== '/b/{bucket}/o').sort();

/* 기본 설정의 잘못 목록 — 비면 통과 */
function mainCfgProblems(cfg) {
  const out = [];
  const st = cfg && cfg.storage;
  if (!st || Array.isArray(st) || typeof st !== 'object') out.push('storage 가 규칙 한 벌을 가리키는 항목이 아니다');
  else if (st.rules !== MAIN_FILE) out.push('storage.rules 가 ' + MAIN_FILE + ' 이 아니다: ' + st.rules);
  if (!cfg || !cfg.database || cfg.database.rules !== CUTOVER_DB) out.push('database.rules 가 ' + CUTOVER_DB + ' 이 아니다');
  return out;
}
/* 잠금 설정의 잘못 목록 — storage 말고 다른 항목이 있으면 --config 로 올릴 때 그것까지 바뀐다 */
function lockCfgProblems(cfg) {
  const out = [];
  const keys = Object.keys(cfg || {});
  if (keys.join() !== 'storage') out.push('storage 말고 다른 항목이 있다: ' + keys.join(' · '));
  const st = cfg && cfg.storage;
  if (!st || Array.isArray(st) || st.rules !== LOCK_FILE) out.push('storage.rules 가 ' + LOCK_FILE + ' 이 아니다');
  return out;
}

function token(uid) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return b({ alg: 'none', typ: 'JWT' }) + '.' + b({ sub: uid, user_id: uid, iat: now, exp: now + 3600, aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT, firebase: { sign_in_provider: 'password' } }) + '.';
}

/* 경우: [이름, 동작(up · del · get · list), 경로, 크기, contentType, 통과 기대, 사람]. 준비(OWNER)는 기대를 보지 않고 성공만 본다. */
const seed = (p) => [`준비: ${p}`, 'up', p, 10, 'image/png', true, OWNER];
const zeroTwelve = [   // 0.12 앱이 올리는 자리
  ['catalog/parts/p1.glb', 100 * KB, 'model/gltf-binary'],
  ['users/u1/mh_1.png', 100 * KB, 'image/png'],
  ['users/u1/giftimg/g1.png', 100 * KB, 'image/png'],
  ['away/u1/away_1.webp', 100 * KB, 'image/webp'],
  ['bookmarks/u1/b_1.webp', 100 * KB, 'image/webp'],
  ['purikura/ROOM/u1/1.webp', 100 * KB, 'image/webp'],
];
function mainCases() {
  return [
    ...['users/u1/del.png', 'users/u1/giftimg/del.png', 'catalog/del.glb', 'away/u1/del.webp', 'bookmarks/u1/del.webp', 'purikura/R/u1/del.webp', 'assets/del.png', 'assets/read.png'].map(seed),
    ['users — 로그인 없이 2MB 아래 올리기', 'up', 'users/u1/a.png', 2 * MB - 1, 'image/png', true, ANON],
    ['users — 2MB 는 거절', 'up', 'users/u1/b.png', 2 * MB, 'image/png', false, ANON],
    ['users — 로그인한 사용자도 2MB 는 거절', 'up', 'users/u1/b.png', 2 * MB, 'image/png', false, USER],
    ['users — 서버 봇은 마이홈 그림 8MB(PNG)', 'up', 'users/u1/mh_a.png', 8 * MB, 'image/png', true, BOT],
    ['users — 서버 봇 WebP 3MB', 'up', 'users/u1/mh_b.webp', 3 * MB, 'image/webp', true, BOT],
    ['users — 서버 봇 JPEG 3MB', 'up', 'users/u1/mh_c.jpg', 3 * MB, 'image/jpeg', true, BOT],
    ['users — 서버 봇도 8MB 넘으면 거절', 'up', 'users/u1/mh_d.png', 8 * MB + 1, 'image/png', false, BOT],
    ['users — 서버 봇도 2MB 이상은 마이홈 그림 형식만(GIF 거절)', 'up', 'users/u1/mh_e.gif', 3 * MB, 'image/gif', false, BOT],
    ['users — 지우기', 'del', 'users/u1/del.png', 0, '', true, ANON],
    ['users — 읽기 · 목록은 로그인 없이', 'list', 'users/u1/', 0, '', true, ANON],
    ['giftimg — 로그인 없이 올리기 거절', 'up', 'users/u1/giftimg/x.png', 10, 'image/png', false, ANON],
    ['giftimg — 남(로그인한 사용자)이 올리기 거절', 'up', 'users/u1/giftimg/x.png', 10, 'image/png', false, USER],
    ['giftimg — 앱이 지우기 거절', 'del', 'users/u1/giftimg/del.png', 0, '', false, USER],
    ['giftimg — 서버 봇이 사본 만들기', 'up', 'users/u1/giftimg/y.png', 100 * KB, 'image/png', true, BOT],
    ['giftimg — 서버 봇도 2MB 는 거절', 'up', 'users/u1/giftimg/z.png', 2 * MB, 'image/png', false, BOT],
    ['giftimg — 읽기는 로그인 없이', 'get', 'users/u1/giftimg/y.png', 0, '', true, ANON],
    ['giftimg — 서버 봇이 지우기', 'del', 'users/u1/giftimg/del.png', 0, '', true, BOT],
    ['catalog — 5MB 아래 올리기', 'up', 'catalog/a.glb', 5 * MB - 1, 'model/gltf-binary', true, ANON],
    ['catalog — 5MB 는 거절', 'up', 'catalog/b.glb', 5 * MB, 'model/gltf-binary', false, ANON],
    ['catalog — 지우기', 'del', 'catalog/del.glb', 0, '', true, ANON],
    ['away — 300KB 아래 그림', 'up', 'away/u1/a.webp', 300 * KB - 1, 'image/webp', true, ANON],
    ['away — 300KB 는 거절', 'up', 'away/u1/b.webp', 300 * KB, 'image/webp', false, ANON],
    ['away — 그림 아닌 파일 거절', 'up', 'away/u1/c.txt', 10, 'text/plain', false, ANON],
    ['away — 지우기', 'del', 'away/u1/del.webp', 0, '', true, ANON],
    ['bookmarks — 200KB 아래 그림', 'up', 'bookmarks/u1/a.webp', 200 * KB - 1, 'image/webp', true, ANON],
    ['bookmarks — 200KB 는 거절', 'up', 'bookmarks/u1/b.webp', 200 * KB, 'image/webp', false, ANON],
    ['bookmarks — 그림 아닌 파일 거절', 'up', 'bookmarks/u1/c.txt', 10, 'text/plain', false, ANON],
    ['bookmarks — 지우기', 'del', 'bookmarks/u1/del.webp', 0, '', true, ANON],
    ['purikura — 2MB 아래', 'up', 'purikura/R/u1/a.webp', 2 * MB - 1, 'image/webp', true, ANON],
    ['purikura — 2MB 는 거절', 'up', 'purikura/R/u1/b.webp', 2 * MB, 'image/webp', false, ANON],
    ['purikura — 지우기', 'del', 'purikura/R/u1/del.webp', 0, '', true, ANON],
    ['assets — 로그인 없이 읽기 거절', 'get', 'assets/read.png', 0, '', false, ANON],
    ['assets — 사용자 읽기 거절', 'get', 'assets/read.png', 0, '', false, USER],
    ['assets — 서버 봇 읽기', 'get', 'assets/read.png', 0, '', true, BOT],
    ['assets — 사용자 올리기 거절', 'up', 'assets/u.png', 10, 'image/png', false, USER],
    ['assets — 서버 봇 PNG 512KB', 'up', 'assets/a.png', 512 * KB, 'image/png', true, BOT],
    ['assets — 서버 봇도 512KB 넘으면 거절', 'up', 'assets/b.png', 512 * KB + 1, 'image/png', false, BOT],
    ['assets — 서버 봇 WebP 512KB', 'up', 'assets/c.webp', 512 * KB, 'image/webp', true, BOT],
    ['assets — 서버 봇도 WebP 512KB 넘으면 거절', 'up', 'assets/d.webp', 512 * KB + 1, 'image/webp', false, BOT],
    ['assets — 서버 봇 GLB 1MB', 'up', 'assets/e.glb', MB, 'model/gltf-binary', true, BOT],
    ['assets — 서버 봇도 GLB 1MB 넘으면 거절', 'up', 'assets/f.glb', MB + 1, 'model/gltf-binary', false, BOT],
    ['assets — 서버 봇도 PNG 가 1MB 면 거절(GLB 상한을 빌리지 못함)', 'up', 'assets/g.png', MB, 'image/png', false, BOT],
    ['assets — 서버 봇도 받는 형식(PNG · WebP · GLB)이 아니면 거절', 'up', 'assets/h.jpg', 10, 'image/jpeg', false, BOT],
    ['assets — 사용자 지우기 거절', 'del', 'assets/del.png', 0, '', false, USER],
    ['assets — 서버 봇 지우기', 'del', 'assets/del.png', 0, '', true, BOT],
    ['규칙 없는 경로 — 올리기 거절', 'up', 'other/a.png', 10, 'image/png', false, USER],
    ['규칙 없는 경로 — 읽기 거절', 'list', 'other/', 0, '', false, USER],
  ];
}
function lockCases() {
  return [
    ...zeroTwelve.map(([p]) => seed(p.replace(/(\.\w+)$/, '_old$1'))),
    seed('assets/read.png'),
    ...zeroTwelve.flatMap(([p, size, ct]) => [
      [`${p} — 로그인 없이 올리기 거절`, 'up', p, size, ct, false, ANON],
      [`${p} — 로그인한 사용자 올리기 거절`, 'up', p, size, ct, false, USER],
      [`${p} — 앱이 지우기 거절`, 'del', p.replace(/(\.\w+)$/, '_old$1'), 0, '', false, USER],
      [`${p} — 읽기는 그대로`, 'get', p.replace(/(\.\w+)$/, '_old$1'), 0, '', true, ANON],
      [`${p} — 서버 봇은 올리기`, 'up', p, size, ct, true, BOT],
      [`${p} — 서버 봇은 지우기`, 'del', p, 0, '', true, BOT],
    ]),
    ['users — 서버 봇은 마이홈 그림 8MB', 'up', 'users/u1/mh_big.png', 8 * MB, 'image/png', true, BOT],
    ['users — 서버 봇도 8MB 넘으면 거절', 'up', 'users/u1/mh_big2.png', 8 * MB + 1, 'image/png', false, BOT],
    ['users — 로그인한 사용자 1KB 도 거절', 'up', 'users/u1/small.png', KB, 'image/png', false, USER],
    ['giftimg — 잠금 중에도 서버 봇은 2MB 미만', 'up', 'users/u1/giftimg/lock_a.png', 2 * MB - 1, 'image/png', true, BOT],
    ['giftimg — 잠금 중 서버 봇이 2MB 올리면 거절(마이홈 8MB 를 빌리지 못함)', 'up', 'users/u1/giftimg/lock_b.png', 2 * MB, 'image/png', false, BOT],
    ['away — 서버 봇도 그림 아니면 거절', 'up', 'away/u1/c.txt', 10, 'text/plain', false, BOT],
    ['assets — 로그인 없이 읽기 거절', 'get', 'assets/read.png', 0, '', false, ANON],
    ['assets — 서버 봇 PNG 올리기', 'up', 'assets/a.png', 10, 'image/png', true, BOT],
    ['assets — 서버 봇 WebP 512KB', 'up', 'assets/b.webp', 512 * KB, 'image/webp', true, BOT],
    ['assets — 서버 봇 GLB 1MB', 'up', 'assets/c.glb', MB, 'model/gltf-binary', true, BOT],
    ['assets — 서버 봇도 GLB 1MB 넘으면 거절', 'up', 'assets/d.glb', MB + 1, 'model/gltf-binary', false, BOT],
    ['assets — 서버 봇 읽기', 'get', 'assets/read.png', 0, '', true, BOT],
  ];
}
/* 지우기 항을 뺀 규칙 — 지우기가 거절돼야 한다(콘솔 규칙에서 실제로 났던 함정) */
function noDeleteCases() {
  return [seed('users/u1/del.png'), seed('catalog/del.glb'),
    ['지우기 항 없음 — users 지우기가 거절된다', 'del', 'users/u1/del.png', 0, '', false, ANON],
    ['지우기 항 없음 — catalog 지우기가 거절된다', 'del', 'catalog/del.glb', 0, '', false, ANON]];
}
/* 봇 상한을 사람에게도 연 규칙(isBot 을 뺌) — 앱이 2MB 이상 · assets 를 올리면 거절돼야 하므로 빨강이 나야 한다 */
function openBotCases() {
  return [['봇 검사 없음 — 사용자가 users 에 3MB 를 올리면 통과해 버린다', 'up', 'users/u1/x.png', 3 * MB, 'image/png', true, USER],
    ['봇 검사 없음 — 사용자가 assets 에 GLB 를 올리면 통과해 버린다', 'up', 'assets/x.glb', MB, 'model/gltf-binary', true, USER]];
}
/* 봇 마이홈 상한을 뺀 규칙 — 봇의 8MB 가 거절돼야 한다 */
function noBotCapCases() {
  return [['봇 마이홈 상한 없음 — 봇 3MB 가 거절된다', 'up', 'users/u1/x.png', 3 * MB, 'image/png', false, BOT]];
}
const SETS = { main: mainCases, lock: lockCases, nodelete: noDeleteCases, openbot: openBotCases, nobotcap: noBotCapCases };

async function inner() {
  const H = `http://127.0.0.1:${Number(process.env.TW_EMU_PORT)}`;
  let fail = 0;
  for (const [name, op, p, size, ct, want, uid] of SETS[process.env.TW_SET]()) {
    const auth = uid === OWNER ? { Authorization: 'Bearer owner' } : uid ? { Authorization: 'Firebase ' + token(uid) } : {};
    const obj = `${H}/v0/b/${BUCKET}/o/${encodeURIComponent(p)}`;
    const r = op === 'up' ? await fetch(`${H}/v0/b/${BUCKET}/o?name=${encodeURIComponent(p)}`, { method: 'POST', headers: { 'Content-Type': ct, ...auth }, body: Buffer.alloc(size) })
      : op === 'del' ? await fetch(obj, { method: 'DELETE', headers: auth })
      : op === 'get' ? await fetch(obj + '?alt=media', { headers: auth })
      : await fetch(`${H}/v0/b/${BUCKET}/o?prefix=${encodeURIComponent(p)}&delimiter=/`, { headers: auth });
    const ok = r.status >= 200 && r.status < 300;
    if (ok !== want) fail++;
    console.log(`  ${ok === want ? '✓' : '✗'} ${name} — ${ok ? '통과' : '거절 ' + r.status}${ok === want ? '' : ' (기대: ' + (want ? '통과' : '거절') + ')'}`);
  }
  process.exit(fail ? 1 : 0);
}

function freePort() { return new Promise((ok, no) => { const s = net.createServer(); s.on('error', no); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); }); }

async function emulate(set, rulesSrc) {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-storage-rules-'));
  fs.writeFileSync(path.join(dir, 'storage.rules'), rulesSrc);
  fs.writeFileSync(path.join(dir, 'firebase.json'), JSON.stringify({ storage: { rules: 'storage.rules' }, emulators: { storage: { port }, ui: { enabled: false }, singleProjectMode: true } }));
  const r = spawnSync('firebase', ['emulators:exec', '--only', 'storage', '--project', PROJECT, `node "${__filename}" --inner`],
    { cwd: dir, env: { ...process.env, TW_EMU_PORT: String(port), TW_SET: set }, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  const out = (r.stdout || '') + (r.stderr || '');
  return { lines: out.split('\n').filter((l) => /^\s+[✓✗] /.test(l)), status: r.status, out };
}

async function main() {
  let pass = 0, fail = 0;
  const chk = (ok, msg) => { ok ? pass++ : fail++; console.log('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
  const finish = () => { console.log(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`); process.exit(fail ? 1 : 0); };

  console.log('\n── 1. 설정');
  const cfg = JSON.parse(CFG_SRC), lockCfg = JSON.parse(LOCK_CFG_SRC);
  const mp = mainCfgProblems(cfg), lp = lockCfgProblems(lockCfg);
  chk(mp.length === 0, 'firebase.json 의 storage 는 ' + MAIN_FILE + ' · database 는 컷오버 규칙 그대로' + (mp.length ? ': ' + mp.join(' · ') : ''));
  chk(!('functions' in cfg) && Array.isArray(cfg.hosting) && cfg.hosting.length === 3, 'functions 항목 없음 · Hosting 세 사이트 그대로');
  chk(lp.length === 0, LOCK_CFG + ' 는 storage 항목 하나 · ' + LOCK_FILE + (lp.length ? ': ' + lp.join(' · ') : ''));
  for (const [name, c] of [['storage 가 잠금 규칙', { ...cfg, storage: { rules: LOCK_FILE } }], ['storage 항목 없음', { database: cfg.database, hosting: cfg.hosting }], ['storage 를 대상 여럿(배열)으로', { ...cfg, storage: [{ bucket: 'a', rules: MAIN_FILE }] }]])
    chk(mainCfgProblems(c).length > 0, '일부러 깸(firebase.json) «' + name + '» → 빨강');
  for (const [name, c] of [['database 항목이 낌', { ...lockCfg, database: { rules: CUTOVER_DB } }], ['hosting 항목이 낌', { ...lockCfg, hosting: [] }], ['0.13 규칙을 가리킴', { storage: { rules: MAIN_FILE } }]])
    chk(lockCfgProblems(c).length > 0, '일부러 깸(잠금 설정) «' + name + '» → 빨강');

  console.log('\n── 2. 두 파일의 짝');
  const mPaths = matchPaths(MAIN_SRC), lPaths = matchPaths(LOCK_SRC);
  const lockMissing = mPaths.filter((p) => !lPaths.includes(p));
  chk(lockMissing.length === 0 && lPaths.every((p) => mPaths.includes(p)), '경로가 같다: ' + lPaths.join(' · ') + (lockMissing.length ? ' / 잠금에 없음: ' + lockMissing.join(' · ') : ''));
  chk(!!BOT && botUid(LOCK_SRC) === BOT, '서버 봇 uid 가 두 파일에서 같다');
  chk(/rules_version = '2';/.test(MAIN_SRC) && /rules_version = '2';/.test(LOCK_SRC), "두 파일 모두 rules_version = '2'(** 가 0단계 이상 경로)");

  console.log('\n── 3. 실제 판정(에뮬레이터)');
  const have = spawnSync('firebase', ['--version'], { encoding: 'utf8' }).status === 0 && spawnSync('java', ['-version'], { encoding: 'utf8' }).status === 0;
  if (!have) { console.log('  - firebase CLI 또는 Java 가 없어 건너뜀(CI · 규칙을 바꾼 PR 은 손으로 돌려 결과를 본문에 붙인다)'); return finish(); }
  const noDelete = MAIN_SRC.replace(/request\.resource == null\s*\|\|\s*/g, '');
  const openBot = MAIN_SRC.replace(/return request\.auth != null && request\.auth\.uid == '[^']+';/, 'return true;');
  const noBotCap = MAIN_SRC.replace(/\s*\|\|\s*isBotMyHomeImage\(\)/, '');
  chk(noDelete !== MAIN_SRC && openBot !== MAIN_SRC && noBotCap !== MAIN_SRC, 'mutation test 용 규칙 셋(지우기 항 · 봇 검사 · 봇 마이홈 상한을 뺌)을 만들었다');
  for (const [set, src, title] of [['main', MAIN_SRC, MAIN_FILE], ['lock', LOCK_SRC, LOCK_FILE], ['nodelete', noDelete, 'mutation test — 지우기 항 없는 ' + MAIN_FILE],
    ['openbot', openBot, 'mutation test — 봇 검사 없는 ' + MAIN_FILE], ['nobotcap', noBotCap, 'mutation test — 봇 마이홈 상한 없는 ' + MAIN_FILE]]) {
    console.log('  [' + title + ']');
    const r = await emulate(set, src);
    if (!r.lines.length) { chk(false, '에뮬레이터 출력을 못 읽음: ' + r.out.slice(-300)); continue; }
    console.log(r.lines.join('\n'));
    chk(r.status === 0, title + ' — ' + r.lines.length + '건 모두 기대대로');
  }
  finish();
}

if (process.argv.includes('--inner')) inner(); else main();
