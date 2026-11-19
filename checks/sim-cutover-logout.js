/* sim-cutover-logout.js — 컷오버 T-5 방 비우기 · 로그아웃 도구(scripts/cutover-logout.js)
   실행: node checks/run.js cutover-logout
   가짜 DB · 가짜 Auth 로 도구를 그대로 돌린다(firebase-admin 은 쓰지 않는다 — 에뮬레이터 확인은 scripts/cutover-logout-emu-check.js).
   1. 멤버 형식이 규칙의 $memberId 와 같다  2. 방: 미리 보기는 안 씀 · 실제는 멤버 자리만 지움 · 다시 돌려도 같음
   3. 로그아웃: 쪽마다 전부 · 한도 오류 다시 시도 · 실패 보고 · 초당 수  4. 인자 · 에뮬레이터 섞임  5. 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');

const find = (f) => [f, path.join(__dirname, '..', 'firebase', f)].map((p) => path.resolve(p)).find((p) => fs.existsSync(p));
const SCRIPT = find('scripts/cutover-logout.js');
const RULES = find('firebase-database-rules.json');
if (!SCRIPT || !RULES) { console.log('  ? 원본 못 찾음 — scripts/cutover-logout.js · firebase-database-rules.json'); process.exit(2); }
const SRC = fs.readFileSync(SCRIPT, 'utf8');

function load(src) {
  const m = new Module(SCRIPT, module);
  m.filename = SCRIPT;
  m.paths = Module._nodeModulePaths(path.dirname(SCRIPT));
  m._compile(src, SCRIPT);
  return m.exports;
}

const clone = (o) => JSON.parse(JSON.stringify(o));
const M1 = 'mlx0abc12de3f4', M2 = 'mlx0abd99zz8y7', M3 = 'mlx1000aaaaaaa';
function fixture() {
  return {
    rooms: {
      'COZY-AB12': {
        _meta: { channel: 'togetherroom', host: M1, ts: 1 },
        chatLog: { c1: { name: 'a', text: 'hi', ts: 1, uid: 'u1' } },
        _chatTab: { s1: { c2: { name: 'a', text: 'x', ts: 2 } } },
        _photo: { slots: { 0: { uid: M1, at: 1 } }, meta: { host: M1, state: 'lobby' } },
        [M1]: { name: 'a', state: 'idle', userId: 'u1', lastSeen: 1, seatedOn: { host: M2, slot: 0 }, poke: { type: 'x', from: M2, ts: 1 } },
        [M2]: { name: 'b', state: 'idle', lastSeen: 1, hb: 2 },
        mobileNote: 'admin-written',
      },
      'SCRT-ZZ99': {
        _meta: { channel: 'workingroom', host: M3 },
        chatLog: { c3: { name: 'c', text: 'secret', ts: 3 } },
        [M3]: { name: 'c', state: 'away' },
      },
      'PLAY-EMPT': { _meta: { channel: 'workingroom' }, chatLog: { c4: { name: 'd', text: 'old', ts: 4 } } },
    },
    roomAlive: { 'COZY-AB12': { [M2]: 123 }, 'GONE-0000': { [M1]: 5 } },
    roomIndex: { 'COZY-AB12': { lastSeen: 9, channel: 'togetherroom' } },
    roomDir: { 'COZY-AB12': { srv: 'a' } },
    secretRooms: { 'SCRT-ZZ99': { k: 'x', pub: { owner: 'u3', ts: 1 } } },
    users: { u1: { presence: { online: true, room: 'COZY-AB12', inRoom: true, ver: '0.12.3' }, session: { id: 's', at: 1 }, friends: {} } },
  };
}
const MEMBER_PATHS = [`rooms/COZY-AB12/${M1}`, `rooms/COZY-AB12/${M2}`, `rooms/SCRT-ZZ99/${M3}`, `roomAlive/COZY-AB12/${M2}`, `roomAlive/GONE-0000/${M1}`].sort();

function fakeStore(tree) {
  const at = (p) => p.split('/').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
  const s = {
    writes: 0, failOnce: false,
    async keys(p) { const v = at(p); return v && typeof v === 'object' ? Object.keys(v) : []; },
    async update(map) {
      if (s.failOnce) { s.failOnce = false; const e = new Error('ECONNRESET'); throw e; }
      s.writes++;
      for (const [p, v] of Object.entries(map)) {
        const ks = p.split('/'); const last = ks.pop();
        const parent = ks.reduce((o, k) => (o && o[k]), tree);
        if (!parent) continue;
        if (v === null) delete parent[last]; else parent[last] = v;
      }
    },
  };
  return s;
}
function without(tree, paths) {
  const t = clone(tree);
  for (const p of paths) { const ks = p.split('/'); const last = ks.pop(); const o = ks.reduce((a, k) => a && a[k], t); if (o) delete o[last]; }
  return t;
}

function fakeAuth(n, opt = {}) {
  const uids = Array.from({ length: n }, (_, i) => 'uid' + String(i).padStart(5, '0'));
  const a = {
    calls: [], revoked: new Map(), listCalls: 0,
    async listUsers(max, token) {
      a.listCalls++;
      if (opt.listQuotaOnce && a.listCalls === 1) { const e = new Error('quota'); e.code = 'auth/quota-exceeded'; throw e; }
      const start = token ? Number(token) : 0;
      const users = uids.slice(start, start + max).map((uid) => ({ uid }));
      return { users, pageToken: start + max < uids.length ? String(start + max) : undefined };
    },
    async revokeRefreshTokens(uid) {
      a.calls.push(Date.now());
      if (opt.quota && opt.quota.has(uid) && !a.revoked.has(uid + '#q')) { a.revoked.set(uid + '#q', 1); const e = new Error('QUOTA_EXCEEDED'); e.code = 'auth/quota-exceeded'; throw e; }
      if (opt.broken === uid) { const e = new Error('bad'); e.code = 'auth/invalid-uid'; throw e; }
      if (opt.gone === uid) { const e = new Error('gone'); e.code = 'auth/user-not-found'; throw e; }
      a.revoked.set(uid, (a.revoked.get(uid) || 0) + 1);
    },
  };
  a.sleeps = [];
  a.sleep = async (ms) => { a.sleeps.push(ms); };
  return { a, uids };
}

async function suite(mod, quiet) {
  let pass = 0, fail = 0;
  const chk = (ok, msg) => { ok ? pass++ : fail++; if (!quiet) console.log('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
  const say = (s) => { if (!quiet) console.log(s); };
  const log = () => {};
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const run = async (name, fn) => { try { await fn(); } catch (e) { chk(false, name + ' — 던짐: ' + (e && e.message)); } };

  say('\n── 1. 멤버 형식');
  await run('형식', async () => {
    const rules = JSON.parse(fs.readFileSync(RULES, 'utf8')).rules;
    const v = rules.rooms.$room.$memberId['.validate'];
    chk(v.includes("$memberId.matches(/" + mod.MEMBER_RE.source + "/)"), '도구의 멤버 형식이 규칙 rooms/$room/$memberId 와 같다: ' + mod.MEMBER_RE.source);
    chk(rules.roomAlive.$room.$memberId['.validate'].includes(mod.MEMBER_RE.source), 'roomAlive/$room/$memberId 도 같은 형식');
    chk(eq(mod.PRESENCE_ROOTS, ['rooms', 'roomAlive']), '지우는 맨 위 칸은 rooms · roomAlive 둘뿐');
  });

  say('\n── 2. 방 비우기');
  await run('방', async () => {
    const tree = fixture();
    const before = clone(tree);
    const st = fakeStore(tree);
    const plan = await mod.planRooms(st);
    chk(eq(plan.paths, MEMBER_PATHS), '지울 자리 = 멤버 노드 3 + 도장 2: ' + plan.paths.join(' · '));
    chk(plan.rooms === 3, '방 수(COZY · SCRT · GONE) = ' + plan.rooms);
    const lines = [];
    const dry = await mod.runRooms(st, { apply: false, log: (s) => lines.push(s) });
    chk(dry.planned === 5 && dry.removed === 0 && st.writes === 0 && eq(tree, before), '미리 보기: 세기만 하고 쓰지 않는다');
    chk(lines.some((l) => l.includes('rooms/COZY-AB12/' + M1)), '미리 보기에 예시 경로가 찍힌다');
    st.failOnce = true;
    const sleeps = [];
    const r = await mod.runRooms(st, { apply: true, log, sleep: async (ms) => { sleeps.push(ms); } });
    chk(r.removed === 5 && sleeps.length === 1, '실제: 5자리 지움 · 끊긴 쓰기는 한 번 다시 시도');
    chk(eq(tree, without(before, MEMBER_PATHS)), '멤버 자리 말고는 한 글자도 안 바뀐다(_meta · chatLog · _chatTab · _photo · mobileNote · roomIndex · roomDir · secretRooms · users/*/presence)');
    chk(!!tree.rooms['SCRT-ZZ99'].chatLog.c3 && !!tree.rooms['COZY-AB12']._meta, '시크릿룸 대화 · 방 설정이 남아 있다(옮기기가 읽는 것)');
    chk(tree.users.u1.presence.inRoom === true, 'users/*/presence 는 그대로');
    const w = st.writes;
    const again = await mod.runRooms(st, { apply: true, log });
    chk(again.planned === 0 && st.writes === w && eq(tree, without(before, MEMBER_PATHS)), '다시 돌리면 지울 것 0 · 쓰기 없음');
    const big = { rooms: {} };
    for (let i = 0; i < 1203; i++) big.rooms['BIGR-' + String(i % 3).padStart(4, '0')] = Object.assign(big.rooms['BIGR-' + String(i % 3).padStart(4, '0')] || {}, { ['mbig' + String(i).padStart(6, '0')]: { name: 'x', state: 'y' } });
    const bs = fakeStore(big);
    const br = await mod.runRooms(bs, { apply: true, log });
    chk(br.removed === 1203 && bs.writes === 3 && Object.values(big.rooms).every((x) => !Object.keys(x).length), '1203자리는 500개씩 3번에 나눠 쓴다');
  });

  say('\n── 3. 로그아웃');
  await run('로그아웃', async () => {
    const { a, uids } = fakeAuth(2350, { quota: new Set(['uid00007', 'uid01500']), broken: 'uid02000', gone: 'uid02001', listQuotaOnce: true });
    const dry = await mod.runLogout(a, { apply: false, rate: 20, log, sleep: a.sleep });
    chk(dry.users === 2350 && a.calls.length === 0, '미리 보기: 2350명 셈 · 로그아웃 0 (한 쪽 1000명 · 3쪽)');
    a.listCalls = 0;
    const lines = [];
    const r = await mod.runLogout(a, { apply: true, rate: 20, log: (s) => lines.push(s), sleep: a.sleep });
    const ok = uids.filter((u) => a.revoked.get(u) === 1).length;
    chk(r.users === 2350 && r.revoked === 2348 && ok === 2348, '실제: 2348명 로그아웃 · 한 사람에 한 번씩');
    chk(a.revoked.get('uid00007') === 1 && a.revoked.get('uid01500') === 1, '한도 오류(quota-exceeded)는 기다렸다 다시 해서 끝낸다');
    chk(a.listCalls === 4, '목록 읽기의 한도 오류도 다시 시도한다(3쪽 + 1)');
    chk(r.failed.length === 1 && r.failed[0].uid === 'uid02000' && r.failed[0].code === 'auth/invalid-uid', '다시 해도 안 될 오류는 실패로 모아 보고: ' + JSON.stringify(r.failed));
    chk(r.gone === 1, '그새 지워진 사람(user-not-found)은 실패로 세지 않는다');
    chk(lines.some((l) => /실패 1/.test(l) && /uid02000/.test(lines.join('\n'))), '끝에 실패 수 · uid 를 찍는다');
    chk(a.sleeps.includes(1000), '다시 시도 전에 기다린다(1초부터 두 배씩)');
    chk(mod.isRetryable({ code: 'auth/quota-exceeded' }) && mod.isRetryable({ message: 'RESOURCE_EXHAUSTED' }) && !mod.isRetryable({ code: 'auth/user-not-found' }) && !mod.isRetryable({ code: 'auth/invalid-credential' }), '다시 시도할 오류 가르기');
  });

  say('\n── 3-2. 초당 수(실제 시계)');
  await run('초당 수', async () => {
    const { a } = fakeAuth(250);
    const t0 = Date.now();
    await mod.runLogout(a, { apply: true, rate: 100, log });
    const took = Date.now() - t0;
    let worst = 0;
    for (let i = 0, j = 0; i < a.calls.length; i++) { while (a.calls[i] - a.calls[j] >= 1000) j++; worst = Math.max(worst, i - j + 1); }
    chk(a.calls.length === 250 && worst <= 101, '초당 100 이면 어느 1초에도 100번 남짓을 넘지 않는다(최대 ' + worst + ')');
    chk(took >= 2000, '250명에 2.5초 가까이 걸린다(' + took + 'ms)');
  });

  say('\n── 4. 인자');
  await run('인자', async () => {
    chk(!!mod.parseArgs(['--rooms']).error, '--project 없으면 거절(기본값 없음)');
    chk(!!mod.parseArgs(['--project', '--rooms']).error, '--project 값이 빠지면 거절');
    chk(!!mod.parseArgs(['--project', 'p']).error, '단계를 안 고르면 거절');
    const d = mod.parseArgs(['--project', 'p', '--rooms']);
    chk(d.apply === false && d.rooms && !d.logout && d.rate === 20, '기본은 미리 보기 · 고른 단계만 · 초당 20');
    chk(mod.parseArgs(['--project', 'p', '--logout', '--apply']).apply === true, '--apply 로만 실제로 바꾼다');
    chk(!!mod.parseArgs(['--project', 'p', '--logout', '--rate', '0']).error && !!mod.parseArgs(['--project', 'p', '--logout', '--rate', '999']).error, '--rate 범위 밖 거절');
    const keep = [process.env.FIREBASE_DATABASE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST];
    const err = console.error; console.error = () => {};
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:1'; delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
    const code = await mod.main(['--project', 'demo-x', '--rooms', '--logout']);
    console.error = err;
    if (keep[0] === undefined) delete process.env.FIREBASE_DATABASE_EMULATOR_HOST; else process.env.FIREBASE_DATABASE_EMULATOR_HOST = keep[0];
    if (keep[1] === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST; else process.env.FIREBASE_AUTH_EMULATOR_HOST = keep[1];
    chk(code === 2, 'Auth 만 에뮬레이터인데 방까지 고르면 멈춘다(진짜 DB 로 새지 않게)');
  });
  return { pass, fail };
}

const MUTANTS = [
  ['멤버 형식 대신 _meta 만 거름(chatLog · _photo 까지 지움)', 'if (!MEMBER_RE.test(k)) continue;', "if (k === '_meta') continue;"],
  ['멤버 형식을 m 으로 시작만 보게(mobileNote 지움)', 'const MEMBER_RE = /^m[0-9a-z]{6,40}$/;', 'const MEMBER_RE = /^m/;'],
  ['미리 보기에서도 씀', 'if (!o.apply || !paths.length)', 'if (!paths.length)'],
  ['한도 오류를 다시 시도하지 않음', 'if (n >= RETRIES || !isRetryable(e)) throw e;', 'throw e;'],
  ['초당 수 제한 없음', 'await gate(); ', ''],
  ['roomAlive 를 안 봄', "const PRESENCE_ROOTS = ['rooms', 'roomAlive'];", "const PRESENCE_ROOTS = ['rooms'];"],
];

(async () => {
  const real = await suite(load(SRC), false);
  console.log('\n── 5. 깨 보기');
  let mpass = 0, mfail = 0;
  for (const [name, from, to] of MUTANTS) {
    const ok = SRC.includes(from);
    let red = false;
    if (ok) { try { red = (await suite(load(SRC.replace(from, to)), true)).fail > 0; } catch (_) { red = true; } }
    const good = ok && red;
    good ? mpass++ : mfail++;
    console.log('  ' + (good ? '✓' : '✗') + ' ' + name + (ok ? (red ? ' → 빨강' : ' → 초록(검사가 못 잡음)') : ' → 바꿀 글을 못 찾음'));
  }
  const pass = real.pass + mpass, fail = real.fail + mfail;
  console.log(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
