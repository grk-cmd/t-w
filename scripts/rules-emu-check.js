#!/usr/bin/env node
/* 🔐 규칙을 실제로 돌려 보는 확인 — Firebase 데이터베이스 에뮬레이터에 firebase-database-rules.json 을 올리고
   «되어야 하는 쓰기는 되고, 막혀야 하는 쓰기는 막히는지» 를 REST 로 하나씩 보낸다.
   checks/sim-rules-keys.js 는 규칙 글에서 형식을 꺼내 JS 로 돌려 볼 뿐이라, 서버가 실제로 그렇게 판정하는지는 여기서만 안다.
   필요: firebase CLI(firebase-tools) · Java 11+. CI 에는 없어서 손으로 돌린다 — 규칙을 바꾼 PR 은 결과를 본문에 붙인다.
   실행: node scripts/rules-emu-check.js   (종료 코드 0 = 전부 기대대로) */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawnSync } = require('child_process');

const PROJECT = 'demo-tw-rules';                 // demo- 로 시작하면 에뮬레이터가 진짜 프로젝트에 닿지 않는다
const NS = PROJECT + '-default-rtdb';
const PORT = Number(process.env.TW_EMU_PORT) || 0;   // 바깥에서 빈 포트를 골라 안쪽에 넘긴다
const ROOT = path.resolve(__dirname, '..');
const RULES = path.join(ROOT, 'firebase-database-rules.json');

const GOOD_U = 'umu00pdxvk6d9x8mx';
const GOOD_U2 = 'u0abcdefgh12';
const OWNED_U = 'ureporter0001';                 // 로그인에 묶인 사람(신고하는 사람) — 다른 시험의 id 와 나눈다
const ROOM = 'PLAY-AB12';
const MEMBER = 'mabc12345';
const KEY = 'ABCDEFGHJKLMNPQRSTUVWXYZ';      // mobileKeys 형식(24자)

/* 사람이 보낸 것처럼 서명 없는 토큰 — 에뮬레이터는 서명을 보지 않는다 */
function userToken(uid){
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return b({ alg: 'none', typ: 'JWT' }) + '.' + b({ sub: uid, user_id: uid, iat: now, exp: now + 3600, aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT, firebase: { sign_in_provider: 'google.com' } }) + '.';
}

/* [이름, 방법, 경로(인코딩 전), 본문, 기대(true = 통과), 사용자 토큰?] — 경로 조각은 그대로 넣는다(공백 · null 도) */
const TS = { '.sv': 'timestamp' };
const CASES = [
  ['준비: 폰 연결 키', 'PUT', `mobileKeys/${GOOD_U}`, KEY, true],
  ['준비: 신고하는 사람을 로그인에 묶기', 'PUT', `userAuth/${OWNED_U}`, 'authA', true, 'authA'],

  ['사용자 프로필 — 정상 id', 'PUT', `users/${GOOD_U}/profile`, { name: 'a' }, true],
  ['사용자 프로필 — 대문자 섞인 id(앱 _setMyUserId 와 같게 받음)', 'PUT', `users/U0ABCDEFGH/profile`, { name: 'a' }, true],
  ['사용자 프로필 — null', 'PUT', 'users/null/profile', { name: 'a' }, false],
  ['사용자 프로필 — undefined', 'PUT', 'users/undefined/profile', { name: 'a' }, false],
  ['사용자 프로필 — 앞 공백', 'PUT', ` ${GOOD_U}`.replace(/^/, 'users/') + '/profile', { name: 'a' }, false],
  ['사용자 프로필 — 너무 짧은 id', 'PUT', 'users/u1234/profile', { name: 'a' }, false],
  ['사용자 아래 깊은 칸 — null id', 'PUT', 'users/null/schedule/2026-10/17/x1', { text: 'a', ts: 1 }, false],
  ['일정 — 정상', 'PUT', `users/${GOOD_U}/schedule/2026-10/17/x1`, { text: 'a', ts: 1 }, true],
  ['일정 — 달 칸이 undefined', 'PUT', `users/${GOOD_U}/schedule/undefined/17/x1`, { text: 'a', ts: 1 }, false],
  ['일정 — 날 칸이 NaN', 'PUT', `users/${GOOD_U}/schedule/2026-10/NaN/x1`, { text: 'a', ts: 1 }, false],
  ['디데이 — 끝 공백', 'PUT', `users/${GOOD_U}/ddays/x1 `, { text: 'a', date: '2026-10-17', ts: 1 }, false],
  ['친구 — 정상', 'PUT', `users/${GOOD_U}/friends/${GOOD_U2}`, { addedAt: 1 }, true],
  ['친구 — 친구 id 가 null', 'PUT', `users/${GOOD_U}/friends/null`, { addedAt: 1 }, false],
  ['친구 신청 — 정상', 'PUT', `friendRequests/${GOOD_U2}/${GOOD_U}`, { name: 'a', ts: 1 }, true],
  ['친구 신청 — 받는 사람 null', 'PUT', `friendRequests/null/${GOOD_U}`, { name: 'a', ts: 1 }, false],
  ['친구 신청 — 보낸 사람 undefined', 'PUT', `friendRequests/${GOOD_U2}/undefined`, { name: 'a', ts: 1 }, false],
  ['보낸 친구 신청 — 정상', 'PUT', `sentFriendRequests/${GOOD_U}/${GOOD_U2}`, { ts: 1 }, true],
  ['방 초대 — 받는 사람 null', 'PUT', `roomInvites/null/${GOOD_U}`, { roomCode: ROOM, ts: 1 }, false],
  ['우편함 — 정상', 'PUT', `inbox/${GOOD_U}/m1`, { tag: 'notice', title: 'a', ts: 1 }, true],
  ['우편함 — 받는 사람 null', 'PUT', 'inbox/null/m1', { tag: 'notice', title: 'a', ts: 1 }, false],
  ['랭킹 — null', 'PUT', 'leaderboard/null', { sec: 1, ts: 1 }, false],
  ['플레이리스트 목록 — 정상', 'PUT', `playlistIndex/${GOOD_U}`, { ts: 1 }, true],
  ['플레이리스트 목록 — NaN', 'PUT', 'playlistIndex/NaN', { ts: 1 }, false],
  ['폰 연결 live — 정상', 'PUT', `mobileLink/${GOOD_U}/live`, { at: TS }, true],
  ['폰 연결 state — 정상(키 맞음)', 'PUT', `mobileLink/${GOOD_U}/state`, { on: true, ts: TS, key: KEY }, true],
  ['폰 연결 state — null', 'PUT', 'mobileLink/null/state', { on: true, ts: TS, key: KEY }, false],
  ['폰 연결 state — 앞 공백 · 연결 키 맞음(받고 서버 함수가 정상 칸으로 옮긴다)', 'PUT', `mobileLink/ ${GOOD_U}/state`, { on: true, ts: TS, key: KEY }, true],
  ['폰 연결 state — 뒤 공백 · 연결 키 맞음', 'PUT', `mobileLink/${GOOD_U} /state`, { on: true, ts: TS, key: KEY }, true],
  ['폰 연결 state — 공백 두 칸 · 연결 키 맞음', 'PUT', `mobileLink/  ${GOOD_U}/state`, { on: true, ts: TS, key: KEY }, true],
  ['폰 연결 state — 앞 공백 · 연결 키 틀림', 'PUT', `mobileLink/ ${GOOD_U}/state`, { on: true, ts: TS, key: 'ZZZZZZZZZZZZZZZZZZZZZZZZ' }, false],
  ['폰 연결 state — 앞 공백 · 연결 키 없음', 'PUT', `mobileLink/ ${GOOD_U}/state`, { on: true, ts: TS }, false],
  ['폰 연결 state — 연결 키가 없는 사람 코드에 공백', 'PUT', `mobileLink/ ${GOOD_U2}/state`, { on: true, ts: TS, key: KEY }, false],
  ['폰 연결 live — 앞 공백(PC 는 공백 칸에 쓰지 않는다)', 'PUT', `mobileLink/ ${GOOD_U}/live`, { at: TS }, false],
  ['폰 연결 — 공백 + undefined', 'PUT', 'mobileLink/ undefined/state', { on: true, ts: TS, key: KEY }, false],
  ['방 멤버 — 정상', 'PUT', `rooms/${ROOM}/${MEMBER}`, { name: 'a', state: 'idle' }, true],
  ['방 멤버 — 방 코드 null', 'PUT', `rooms/null/${MEMBER}`, { name: 'a', state: 'idle' }, false],
  ['방 멤버 — 멤버 id undefined', 'PUT', `rooms/${ROOM}/undefined`, { name: 'a', state: 'idle' }, false],
  ['방 채팅 — 정상', 'PUT', `rooms/${ROOM}/chatLog/-Nabc`, { name: 'a', text: 'b', ts: 1 }, true],
  ['방 채팅 — 글 id null', 'PUT', `rooms/${ROOM}/chatLog/null`, { name: 'a', text: 'b', ts: 1 }, false],
  ['방 목록 — 정상', 'PUT', `roomIndex/${ROOM}`, { lastSeen: 1 }, true],
  ['방 목록 — 소문자 코드', 'PUT', 'roomIndex/play-ab12', { lastSeen: 1 }, false],
  ['방 살아 있음 — 방 코드 null', 'PUT', `roomAlive/null/${MEMBER}`, TS, false],
  ['친구 코드 — 정상', 'PUT', 'friendCodes/MATE-AB12', { userId: GOOD_U }, true],
  ['친구 코드 — null', 'PUT', 'friendCodes/null', { userId: GOOD_U }, false],
  ['초대 코드 — 정상', 'PUT', 'invites/ABCD-EF12-GH34', { issuedBy: GOOD_U, createdAt: 1 }, true],
  ['초대 코드 — 형식 틀림', 'PUT', 'invites/INVT-123', { issuedBy: GOOD_U, createdAt: 1 }, false],
  ['라이선스 신청 — 정상', 'PUT', 'licenseRequests/-Nabc', { name: 'a', status: 'pending' }, true],
  ['라이선스 신청 — undefined', 'PUT', 'licenseRequests/undefined', { name: 'a', status: 'pending' }, false],
  ['신고 — 정상', 'PUT', `reports/${GOOD_U2}/${OWNED_U}`, { kind: 'etc', nick: 'a', code4: 'AB12', ts: 1 }, true, 'authA'],
  ['신고 — 로그인 없이(형식과 별개로 원래 막힘)', 'PUT', `reports/${GOOD_U2}/${OWNED_U}`, { kind: 'etc', nick: 'a', code4: 'AB12', ts: 1 }, false],
  ['로그인에 묶인 사람 데이터 — 로그인 없이(원래 막힘 · 시험 도구 확인)', 'PUT', `users/${OWNED_U}/profile`, { name: 'a' }, false],
  ['신고 — 대상 null', 'PUT', `reports/null/${OWNED_U}`, { kind: 'etc', nick: 'a', code4: 'AB12', ts: 1 }, false, 'authA'],
  ['여러 칸 한 번에 — 하나가 null 이면 통째로 거절', 'PATCH', '', { [`users/${GOOD_U}/focus`]: { totalSec: 1 }, 'users/null/focus': { totalSec: 1 } }, false],
  ['여러 칸 한 번에 — 전부 정상', 'PATCH', '', { [`users/${GOOD_U}/focus`]: { totalSec: 1 }, [`users/${GOOD_U2}/focus`]: { totalSec: 1 } }, true],
  ['지우기는 형식과 상관없음(잘못 들어간 것을 치울 수 있게)', 'DELETE', 'users/null/profile', null, true],
];

async function inner(){
  let fail = 0;
  const only = process.env.TW_EMU_ONLY;
  for(const [name, method, p, body, want, uid] of CASES){
    if(only && !name.includes(only) && !name.startsWith('준비')) continue;
    const enc = p.split('/').map(encodeURIComponent).join('/');
    /* 토큰은 ?auth= 로 — Authorization 머리에 실으면 에뮬레이터가 관리자(규칙 건너뜀)로 본다 */
    const url = `http://127.0.0.1:${PORT}/${enc}.json?ns=${NS}` + (uid ? '&auth=' + userToken(uid) : '');
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === null ? undefined : JSON.stringify(body) });
    const ok = r.status === 200;
    const pass = ok === want;
    if(!pass) fail++;
    console.log(`  ${pass ? '✓' : '✗'} ${name} — ${ok ? '통과' : '거절'}${pass ? '' : ' (기대: ' + (want ? '통과' : '거절') + ')'}`);
  }
  console.log(fail ? `\n✗ ${fail}건이 기대와 다름` : `\n✓ ${CASES.length}건 모두 기대대로`);
  process.exit(fail ? 1 : 0);
}

function freePort(){
  return new Promise((ok, no) => { const s = net.createServer(); s.on('error', no); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
}

async function outer(){
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-rules-emu-'));
  fs.writeFileSync(path.join(dir, 'firebase.json'), JSON.stringify({
    database: { rules: RULES },
    emulators: { database: { port }, ui: { enabled: false }, singleProjectMode: true },
  }));
  const r = spawnSync('firebase', ['emulators:exec', '--only', 'database', '--project', PROJECT,
    `node "${__filename}" --inner`], { cwd: dir, env: { ...process.env, TW_EMU_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  if(r.error){ console.error('firebase CLI 를 못 찾음 — npm i -g firebase-tools', r.error.message); process.exit(2); }
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split('\n').filter(l => /^\s+[✓✗] |^[✓✗] /.test(l));
  if(!lines.length){ console.error(out); process.exit(2); }
  console.log(lines.join('\n'));
  process.exit(r.status === 0 ? 0 : 1);
}

if(process.argv.includes('--inner')) inner(); else outer();
