#!/usr/bin/env node
/* scripts/cutover-logout.js 를 Firebase 에뮬레이터(데이터베이스 · Auth)에 실제로 돌려 본다.
   checks/sim-cutover-logout.js 는 가짜 DB · Auth 로 도는 것이라, firebase-admin · REST 연결이 맞는지는 여기서만 안다.
   필요: firebase CLI · Java 11+ · `npm --prefix firebase/functions ci`. CI 에는 없어서 손으로 돌린다.
   실행: node firebase/scripts/cutover-logout-emu-check.js   (종료 코드 0 = 전부 기대대로)
   demo- 프로젝트라 에뮬레이터가 진짜 프로젝트에 닿지 않는다. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawnSync } = require('child_process');
const { createRequire } = require('module');

const PROJECT = 'demo-tw-cutover';
const NS = PROJECT + '-default-rtdb';
const SCRIPT = path.join(__dirname, 'cutover-logout.js');
const M1 = 'mlx0abc12de3f4', M2 = 'mlx0abd99zz8y7';
const USERS = 30;

const TREE = {
  rooms: {
    'COZY-AB12': {
      _meta: { channel: 'togetherroom', host: M1 },
      chatLog: { c1: { name: 'a', text: 'hi', ts: 1 } },
      _photo: { slots: { 0: { uid: M1, at: 1 } } },
      [M1]: { name: 'a', state: 'idle', seatedOn: { host: M2, slot: 0 } },
      [M2]: { name: 'b', state: 'idle', hb: 2 },
    },
    'SCRT-ZZ99': { _meta: { host: M2 }, chatLog: { c2: { name: 'b', text: 'secret', ts: 2 } }, [M2]: { name: 'b', state: 'away' } },
  },
  roomAlive: { 'COZY-AB12': { [M2]: 123 } },
  roomIndex: { 'COZY-AB12': { lastSeen: 9 } },
  users: { u1: { presence: { online: true, inRoom: true, room: 'COZY-AB12' } } },
};
const GONE = [`rooms/COZY-AB12/${M1}`, `rooms/COZY-AB12/${M2}`, `rooms/SCRT-ZZ99/${M2}`, `roomAlive/COZY-AB12/${M2}`];

const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((y) => [y, x[y]])) : x));
const same = (a, b) => canon(a) === canon(b);
const validAfter = async (auth) => Object.fromEntries((await auth.listUsers(1000)).users.map((u) => [u.uid, Date.parse(u.tokensValidAfterTime)]));

function expected(seeded) {
  const t = JSON.parse(JSON.stringify(seeded));
  for (const p of GONE) { const ks = p.split('/'); const last = ks.pop(); delete ks.reduce((o, k) => o[k], t)[last]; }
  delete t.roomAlive;
  return t;
}

async function inner() {
  const dbHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  const req = createRequire(path.join(__dirname, '..', 'functions', 'package.json'));
  const { initializeApp } = req('firebase-admin/app');
  const { getAuth } = req('firebase-admin/auth');
  const auth = getAuth(initializeApp({ projectId: PROJECT }));
  const rest = async (method, body) => {
    const r = await fetch(`http://${dbHost}/.json?ns=${NS}`, { method, headers: { Authorization: 'Bearer owner' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return r.json();
  };
  let fail = 0;
  const chk = (ok, msg) => { if (!ok) fail++; console.log(`  ${ok ? '✓' : '✗'} ${msg}`); };
  const cli = (...a) => spawnSync(process.execPath, [SCRIPT, '--project', PROJECT, ...a], { encoding: 'utf8', env: process.env });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await rest('PUT', TREE);
  const seeded = await rest('GET');
  for (let i = 0; i < USERS; i++) await auth.createUser({ uid: 'emu' + i });
  const before = await validAfter(auth);
  await sleep(1100);

  const dry = cli('--rooms', '--logout');
  console.log(dry.stdout.trim().split('\n').map((l) => '    | ' + l).join('\n'));
  chk(dry.status === 0 && /지울 자리 4개 · 방 2개/.test(dry.stdout) && /사용자 30명/.test(dry.stdout), '미리 보기: 지울 자리 4 · 사용자 30');
  chk(same(await rest('GET'), seeded), '미리 보기 뒤 DB 그대로');
  chk(same(await validAfter(auth), before), '미리 보기 뒤 로그아웃 없음');

  const run = cli('--rooms', '--logout', '--apply', '--rate', '50');
  console.log(run.stdout.trim().split('\n').map((l) => '    | ' + l).join('\n'));
  chk(run.status === 0 && /끝 30 · 이미 없음 0 · 실패 0/.test(run.stdout), '실제: 30명 로그아웃 · 실패 0');
  chk(same(await rest('GET'), expected(seeded)), '멤버 자리 4개만 사라지고 나머지(_meta · chatLog · _photo · roomIndex · presence)는 그대로');
  const after = await validAfter(auth);
  chk(Object.keys(after).length === USERS && Object.keys(after).every((u) => after[u] > (before[u] || 0)), '모든 사용자의 tokensValidAfterTime 이 앞으로 갔다');

  const again = cli('--rooms', '--apply');
  chk(again.status === 0 && /지울 자리 0개/.test(again.stdout) && same(await rest('GET'), expected(seeded)), '다시 돌리면 지울 것 0 · DB 그대로');

  console.log(fail ? `\n✗ ${fail}건이 기대와 다름` : '\n✓ 에뮬레이터에서 모두 기대대로');
  process.exit(fail ? 1 : 0);
}

function freePort() { return new Promise((ok, no) => { const s = net.createServer(); s.on('error', no); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); }); }

async function outer() {
  const [db, au] = [await freePort(), await freePort()];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-cutover-emu-'));
  fs.writeFileSync(path.join(dir, 'database.rules.json'), JSON.stringify({ rules: { '.read': false, '.write': false } }));
  fs.writeFileSync(path.join(dir, 'firebase.json'), JSON.stringify({ database: { rules: 'database.rules.json' }, emulators: { database: { port: db }, auth: { port: au }, ui: { enabled: false }, singleProjectMode: true } }));
  const r = spawnSync('firebase', ['emulators:exec', '--only', 'database,auth', '--project', PROJECT, `node "${__filename}" --inner`], { cwd: dir, stdio: 'inherit' });
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(r.status === null ? 1 : r.status);
}

if (process.argv.includes('--inner')) inner().catch((e) => { console.error(e); process.exit(1); }); else outer();
