#!/usr/bin/env node
/* ═══ scripts/cutover-logout.js — 컷오버 직전(런북 T-5) 모든 방 비우기 · 모든 사용자 로그아웃 ═══
   0.12.3 운영 데이터는 Realtime Database 에 있다. 앱에 실리지 않는 관리용 도구다(firebase-admin · 규칙을 거치지 않는다).

   --rooms  : 0.12.3 앱이 «이 사람이 방에 있다» 로 쓰는 두 자리만 지운다.
                rooms/{방}/{멤버id}       — joinRoom 이 set · leaveRoom 이 remove · onDisconnect remove(자리 · 말풍선 · 찌르기가 이 안에 있다)
                roomAlive/{방}/{멤버id}   — 하트비트 도장(값은 숫자 하나 · leaveRoom 이 remove)
              멤버id 는 규칙의 $memberId 형식(/^m[0-9a-z]{6,40}$/)만 지운다. _meta · chatLog · _chatTab · _photo,
              secretRooms · roomIndex · roomDir · users/{코드}/presence 는 건드리지 않는다.
              ⚠️ 켜져 있는 0.12.3 앱은 자기 멤버 노드가 사라지면 다시 쓴다(room-ghost-heal · 재접속 재등록).
                 규칙을 잠근(T+2) 뒤 한 번 더 돌려야 남는 것이 없다.
   --logout : Firebase Auth 의 모든 사용자에게 revokeRefreshTokens. 이미 받은 ID 토큰은 만료(최대 1시간)까지 산다.
              운영자 자신의 웹 관리자 로그인도 풀린다(다시 로그인하면 된다).

   실행(저장소 루트 · 자격 증명은 Application Default Credentials 또는 GOOGLE_APPLICATION_CREDENTIALS):
     node firebase/scripts/cutover-logout.js --project <프로젝트> --rooms --logout            ← 미리 보기(세기만 · 쓰기 없음)
     node firebase/scripts/cutover-logout.js --project <프로젝트> --rooms --logout --apply    ← 실제로 지우고 로그아웃
   --project 는 기본값이 없다. --rooms · --logout 중 하나 이상을 적는다. --instance <RTDB 이름> · --rate <초당 로그아웃 수>(기본 20)
   FIREBASE_DATABASE_EMULATOR_HOST · FIREBASE_AUTH_EMULATOR_HOST 가 있으면 에뮬레이터로 간다.
   다시 돌려도 된다 — 없는 자리를 지우면 아무 일도 없고, 로그아웃은 모두를 다시 풀 뿐이다(그새 로그인한 사람도 풀린다).
   firebase-admin 은 firebase/functions 의 것을 쓴다(먼저 `npm --prefix firebase/functions ci`). */
'use strict';
const path = require('path');

const MEMBER_RE = /^m[0-9a-z]{6,40}$/;
const PRESENCE_ROOTS = ['rooms', 'roomAlive'];
const REGION = 'asia-southeast1';
const CHUNK = 500;
const PAGE = 1000;
const READ_CONCURRENCY = 16;
const RETRIES = 6;
const SAMPLE = 10;
const DEFAULT_RATE = 20;
const MAX_RATE = 200;

function parseArgs(argv) {
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const project = opt('--project');
  if (!project || project.startsWith('--')) return { error: '--project <프로젝트 ID> 를 적어 주세요 — 기본값이 없어요.' };
  const rooms = argv.includes('--rooms');
  const logout = argv.includes('--logout');
  if (!rooms && !logout) return { error: '--rooms · --logout 중 하나 이상을 적어 주세요.' };
  const rate = opt('--rate') === null ? DEFAULT_RATE : Number(opt('--rate'));
  if (!(rate >= 1 && rate <= MAX_RATE)) return { error: `--rate 는 1~${MAX_RATE} 사이 숫자예요.` };
  return { project, instance: opt('--instance'), apply: argv.includes('--apply'), rooms, logout, rate };
}

async function pool(items, n, fn) {
  let i = 0;
  const work = async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, work));
}

/* store: { keys(path) → 바로 아래 키 배열, update({경로: null}) } */
async function planRooms(store) {
  const paths = [];
  const roomSet = new Set();
  for (const top of PRESENCE_ROOTS) {
    const rooms = await store.keys(top);
    await pool(rooms, READ_CONCURRENCY, async (room) => {
      for (const k of await store.keys(`${top}/${room}`)) {
        if (!MEMBER_RE.test(k)) continue;
        paths.push(`${top}/${room}/${k}`);
        roomSet.add(room);
      }
    });
  }
  paths.sort();
  return { paths, rooms: roomSet.size };
}

function isRetryable(e) {
  const code = String((e && (e.code || (e.errorInfo && e.errorInfo.code))) || '');
  const msg = String((e && e.message) || '');
  return /quota-exceeded|too-many-requests|internal-error|network-error|network-timeout|unavailable/.test(code)
    || /QUOTA_EXCEEDED|RESOURCE_EXHAUSTED|TOO_MANY|429|503|ECONNRESET|ETIMEDOUT/.test(msg);
}

async function withRetry(fn, sleep, onRetry) {
  for (let n = 1; ; n++) {
    try { return await fn(); }
    catch (e) {
      if (n >= RETRIES || !isRetryable(e)) throw e;
      const wait = 1000 * 2 ** (n - 1);
      if (onRetry) onRetry(e, n, wait);
      await sleep(wait);
    }
  }
}

async function runRooms(store, o) {
  const log = o.log || console.log;
  const sleep = o.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const { paths, rooms } = await planRooms(store);
  const by = (top) => paths.filter((p) => p.startsWith(top + '/')).length;
  log(`방: 지울 자리 ${paths.length}개 · 방 ${rooms}개 (rooms 멤버 ${by('rooms')} · roomAlive 도장 ${by('roomAlive')})`);
  paths.slice(0, SAMPLE).forEach((p) => log('  예: ' + p));
  if (!o.apply || !paths.length) return { planned: paths.length, removed: 0 };
  let removed = 0;
  for (let i = 0; i < paths.length; i += CHUNK) {
    const part = {};
    paths.slice(i, i + CHUNK).forEach((p) => { part[p] = null; });
    await withRetry(() => store.update(part), sleep, (e, n, w) => log(`  다시 시도 ${n} (${w}ms 뒤): ${e.message}`));
    removed += Object.keys(part).length;
    log(`  지움 ${removed}/${paths.length}`);
  }
  return { planned: paths.length, removed };
}

/* auth: { listUsers(max, pageToken), revokeRefreshTokens(uid) } — firebase-admin Auth 와 같은 모양 */
async function runLogout(auth, o) {
  const log = o.log || console.log;
  const sleep = o.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = o.now || Date.now;
  const interval = 1000 / (o.rate || DEFAULT_RATE);
  let next = 0;
  const gate = async () => {
    const t = now();
    const at = Math.max(t, next);
    next = at + interval;
    if (at > t) await sleep(at - t);
  };
  const retryLog = (e, n, w) => log(`  다시 시도 ${n} (${w}ms 뒤): ${e.code || e.message}`);
  let users = 0, revoked = 0, gone = 0;
  const failed = [];
  let token;
  do {
    const page = await withRetry(() => auth.listUsers(PAGE, token), sleep, retryLog);
    const uids = page.users.map((u) => u.uid);
    users += uids.length;
    if (o.apply) {
      await pool(uids, Math.min(8, Math.ceil(o.rate || DEFAULT_RATE)), async (uid) => {
        try {
          await withRetry(async () => { await gate(); await auth.revokeRefreshTokens(uid); }, sleep, retryLog);
          revoked++;
        } catch (e) {
          if (/user-not-found/.test(String(e && e.code))) gone++;
          else failed.push({ uid, code: String((e && (e.code || e.message)) || e) });
        }
      });
      log(`로그아웃: ${users}명째 · 끝 ${revoked} · 이미 없음 ${gone} · 실패 ${failed.length}`);
    }
    token = page.pageToken;
  } while (token);
  log(`로그아웃: 사용자 ${users}명` + (o.apply ? ` · 끝 ${revoked} · 이미 없음 ${gone} · 실패 ${failed.length}` : ' (미리 보기 — 로그아웃하지 않았어요)'));
  failed.slice(0, 20).forEach((f) => log(`  ✗ ${f.uid} ${f.code}`));
  if (failed.length > 20) log(`  … 그 밖에 ${failed.length - 20}명`);
  return { users, revoked, gone, failed };
}

function adminStore(db, base, token) {
  return {
    async keys(p) {
      const url = `${base.url}/${p.split('/').map(encodeURIComponent).join('/')}.json?shallow=true${base.ns ? '&ns=' + base.ns : ''}`;
      const r = await withRetry(async () => {
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + await token() } });
        if (!res.ok) throw new Error(`GET ${p} ${res.status}`);
        return res.json();
      }, (ms) => new Promise((ok) => setTimeout(ok, ms)));
      return r && typeof r === 'object' ? Object.keys(r) : [];
    },
    update: (map) => db.ref().update(map),
  };
}

async function main(argv) {
  const o = parseArgs(argv);
  if (o.error) { console.error('✗ ' + o.error); return 2; }
  const dbEmu = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  const authEmu = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if ((dbEmu || authEmu) && ((o.rooms && !dbEmu) || (o.logout && !authEmu))) {
    console.error('✗ 에뮬레이터 주소가 한쪽만 있어요 — 고른 단계가 진짜 프로젝트로 갈 수 있어 멈춰요.');
    return 2;
  }
  const { createRequire } = require('module');
  const req = createRequire(path.join(__dirname, '..', 'functions', 'package.json'));
  const { initializeApp, applicationDefault } = req('firebase-admin/app');
  const ns = o.instance || `${o.project}-default-rtdb`;
  const credential = applicationDefault();
  const app = initializeApp({ credential, projectId: o.project, databaseURL: `https://${ns}.${REGION}.firebasedatabase.app` }, 'cutover-logout');
  console.log(`대상: ${o.project}` + (dbEmu || authEmu ? ' (에뮬레이터)' : '') + ` · ${o.apply ? '실제로 바꿈(--apply)' : '미리 보기'} · 단계 ${[o.rooms && '방', o.logout && '로그아웃'].filter(Boolean).join(' · ')}`);
  let bad = 0;
  if (o.rooms) {
    const { getDatabase } = req('firebase-admin/database');
    const base = dbEmu ? { url: `http://${dbEmu}`, ns } : { url: `https://${ns}.${REGION}.firebasedatabase.app` };
    const token = dbEmu ? async () => 'owner' : async () => (await credential.getAccessToken()).access_token;
    await runRooms(adminStore(getDatabase(app), base, token), { apply: o.apply });
  }
  if (o.logout) {
    const { getAuth } = req('firebase-admin/auth');
    const r = await runLogout(getAuth(app), { apply: o.apply, rate: o.rate });
    bad += r.failed.length;
  }
  if (!o.apply) console.log('미리 보기만 했어요 — 실제로 하려면 --apply 를 붙여 다시 실행하세요.');
  return bad ? 1 : 0;
}

module.exports = { MEMBER_RE, PRESENCE_ROOTS, parseArgs, planRooms, runRooms, runLogout, isRetryable, main };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error('✗ ' + (e && e.stack || e)); process.exit(1); });
}
