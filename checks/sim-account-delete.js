/*
 * 계정 삭제(adminDeleteAccount) 검사. functions/account-delete.js 를 그대로 불러 가짜 DB · 가짜 Storage · 가짜 로그인으로 돌린다.
 * 1. 입력 모양  2. 겹치는 경로  3. 미리 보기(지울 것 · 남길 것)  4. 로그인 계정 안전장치  5. 호출 권한  6. 실행 순서 · 작업 기록
 * 7. 다시 실행(이어서 지우기)  8. index.js 연결 · 규칙 · CSP
 * 9. 본인 탈퇴(deleteMyAccount) 서버  10. 앱 모듈(account-delete-net.js)  11. 앱 연결 · 화면(고지 · 확인)
 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const RULES = need('firebase-database-rules.json');
const FX = need('functions/index.js');
const FB = need('firebase.json');
need('functions/account-delete.js');
// 러너는 app/ 을 한 층 펼쳐 돌린다 — 저장소 자리 · 펼친 자리 둘 다 본다. web-admin/ 은 러너가 빼므로 있을 때만 본다.
const needAny = (...fs_) => { for (const f of fs_){ const s = read(f); if (s != null) return s; } return need(fs_[fs_.length - 1]); };
const inApp = (rel) => needAny('app/' + rel, rel);
const ADN = inApp('parts/account/account-delete-net.js');
const FI = inApp('parts/firebase-init.js');
const HTML = inApp('desk-companion-prototype.html');
const ACC = inApp('parts/account/account.js');
const MI = inApp('parts/account/my-info.js');
const APPJS = inApp('parts/app.js');
const WA_AUDIT = read('web-admin/src/shared/api/audit.ts');
const WA_LOG = read('web-admin/src/entities/admin-log/model/adminLog.ts');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const clone = (v) => JSON.parse(JSON.stringify(v));

// ── 가짜 RTDB — 트리 하나. get · orderByChild/equalTo · 루트 다중 경로 update.
function fakeDb(tree){
  const reads = [];
  const at = (p) => p.split('/').filter(Boolean).reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), tree);
  const setAt = (p, v) => {
    const ks = p.split('/').filter(Boolean); let n = tree;
    for (const k of ks.slice(0, -1)){ if (!n[k] || typeof n[k] !== 'object') n[k] = {}; n = n[k]; }
    if (v === null) delete n[ks[ks.length - 1]]; else n[ks[ks.length - 1]] = v;
  };
  const snap = (v) => ({ val: () => (v === undefined ? null : clone(v)) });
  const updates = [];
  const db = {
    ref: (p = '') => ({
      get: async () => { reads.push(p); return snap(at(p)); },
      orderByChild: (c) => ({ equalTo: (x) => ({ get: async () => {
        reads.push(p + '?' + c + '=' + x);
        const all = at(p) || {}; const out = {};
        for (const k in all) if (all[k] && all[k][c] === x) out[k] = all[k];
        return snap(Object.keys(out).length ? out : null);
      } }) }),
      update: async (patch) => {
        if (p) throw new Error('루트 update 만 쓴다');
        const ks = Object.keys(patch);
        if (ks.some((a) => ks.some((b) => a !== b && b.startsWith(a + '/')))) throw new Error('겹치는 경로');
        updates.push(patch);
        for (const k of ks) setAt(k, patch[k]);
      },
      toString: () => 'https://fake',
    }),
  };
  const shallow = async (p) => {
    reads.push('shallow:' + p);
    const v = at(p);
    if (v === undefined || v === null) return null;
    if (typeof v !== 'object') return v;
    return Object.fromEntries(Object.keys(v).map((k) => [k, true]));
  };
  return { db, tree, reads, updates, shallow, at };
}

function fakeWorld(tree, files, authUsers){
  const F = fakeDb(tree);
  const order = [];
  const deps = {
    shallow: F.shallow,
    listFiles: async ({ prefix, glob }) => {
      const re = glob ? new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]+').replace(/§/g, '.*') + '$') : null;
      return files.filter((n) => n.startsWith(prefix) && (!re || re.test(n)));
    },
    deleteFile: async (n) => { order.push('file'); const i = files.indexOf(n); if (i >= 0) files.splice(i, 1); },
    getAuthUser: async (uid) => (authUsers[uid] ? { provider: authUsers[uid] } : null),
    deleteAuthUser: async (uid) => { order.push('auth'); delete authUsers[uid]; },
    serverNow: () => ({ '.sv': 'timestamp' }),
  };
  const origUpdate = F.db.ref;
  F.db.ref = (p) => { const r = origUpdate(p); const u = r.update; r.update = async (x) => { order.push('db'); return u(x); }; return r; };
  return { ...F, deps, files, authUsers, order };
}

const ME = 'udelete000001';
const BOB = 'ubob00000002';
const AMY = 'uamy00000003';
const ADMIN = 'adminAuthUid';
const T0 = Date.UTC(2026, 9, 7);

/* srExp — 이 사람 시크릿룸(SCRT-AAAA)의 pub.exp. 없으면 영구 방 */
function world(srExp){
  const tree = {
    admins: { [ADMIN]: true },
    users: {
      [ME]: { friendCode: 'MATE-DEL1', secretRoom: 'SCRT-AAAA', profile: { name: '지울이' }, presence: { online: false },
        friends: { [BOB]: { addedAt: 1 }, [AMY]: { addedAt: 2 } }, guestbook: { g1: { text: 'hi' } }, chars: { c1: { x: 1 } } },
      [BOB]: { profile: { name: '밥' }, friends: { [ME]: { addedAt: 1 } }, guestbook: { g9: { from: ME, text: '놀러옴' } } },
      [AMY]: { profile: { name: '에이미' }, friends: { [ME]: { addedAt: 2 }, [BOB]: { addedAt: 3 } } },
    },
    accountSnap: { [ME]: { name: '지울이', friendCode: 'MATE-DEL1', license: 'KEEP-AAAA-BBBB-CCCC', ts: 1 }, [BOB]: { name: '밥', ts: 1 } },
    userAuth: { [ME]: 'authMe', [BOB]: 'authBob' },
    authUsers: { authMe: { userCode: ME }, authBob: { userCode: BOB } },
    friendCodes: { 'MATE-DEL1': { userId: ME }, 'MATE-BOB2': { userId: BOB } },
    inbox: { [ME]: { m1: { tag: 'notice', title: 't', ts: 1 } }, [BOB]: { m2: { tag: 'notice', title: 't', ts: 1 } } },
    leaderboard: { [ME]: { sec: 10, ts: 1 }, [BOB]: { sec: 20, ts: 1 } },
    playlistIndex: { [ME]: { ts: 1, n: 3 } },
    bookmarks: { [ME]: { ts: 1, items: { a: 1 } } },
    bookmarksPub: { [ME]: { ts: 1 } },
    mobileKeys: { [ME]: 'ABCDEFGHJKLMNPQRSTUVWXYZ' },
    mobileLink: { [ME]: { state: { on: true, ts: 1 } } },
    friendRequests: { [ME]: { ucarl0000004: { name: '칼', ts: 1 } }, udan00000005: { [ME]: { name: '지울이', ts: 1 } } },
    sentFriendRequests: { [ME]: { udan00000005: { ts: 1 } }, ucarl0000004: { [ME]: { ts: 1 } } },
    roomInvites: { [ME]: { [BOB]: { roomCode: 'R1', ts: 1 } }, [AMY]: { [ME]: { roomCode: 'R2', ts: 1 } }, [BOB]: { [AMY]: { roomCode: 'R3', ts: 1 } } },
    secretRooms: { 'SCRT-AAAA': { k: 'x', pub: { owner: ME, ts: 1, name: '지울이방', ...(srExp !== undefined ? { exp: srExp } : {}) } }, 'SCRT-BBBB': { k: 'x', pub: { owner: BOB, ts: 1 } } },
    invites: {
      'INVT-AAAA-AAAA': { issuedBy: ME, createdAt: 1, usedBy: null },
      'INVT-BBBB-BBBB': { issuedBy: ME, createdAt: 1, usedBy: AMY, usedAt: 2 },
      'INVT-CCCC-CCCC': { issuedBy: BOB, createdAt: 1 },
    },
    metrics: {
      daily: { '2026-10-06': { u: { [ME]: true, [BOB]: true }, visits: 3 }, '2026-10-07': { u: { [BOB]: true }, visits: 1 } },
      summary: { '2026-10-06': { dau: 2 } },
    },
    reports: { [ME]: { [BOB]: { kind: 'nick', nick: 'x', code4: 'DEL1', ts: 1 } }, [BOB]: { [ME]: { kind: 'away', nick: 'y', code4: 'BOB2', ts: 1 } } },
    licenses: { 'KEEP-AAAA-BBBB-CCCC': { valid: true, createdAt: 1, redeemedAt: 2 } },
    licenseRequests: {
      r1: { name: '지울이', status: 'approved', friendCode: 'MATE-DEL1' },
      r2: { name: '지울이', status: 'approved', issuedKey: 'KEEP-AAAA-BBBB-CCCC' },
      r3: { name: '밥', status: 'pending', friendCode: 'MATE-BOB2' },
      r4: { name: '누군가', status: 'pending' },
    },
    adminLog: { a1: { at: 1, by: ADMIN, action: 'license.issue', target: 'x' } },
    // 버그 제보 — b1 · b2 는 이 사람(같은 로그인 · 같은 코드), b3 는 남, b4 는 같은 로그인이 다른 코드로 쓴 글(두고 간다)
    bugBoard: {
      list: {
        b1: { authUid: 'authMe', code: ME, vis: 'pub', status: 'fixed', ts: 1, no: 'B-1001-1' },
        b2: { authUid: 'authMe', code: ME, vis: 'prv', status: 'new', ts: 2, openTs: 2 },
        b3: { authUid: 'authBob', code: BOB, vis: 'pub', status: 'new', ts: 3, openTs: 3 },
        b4: { authUid: 'authMe', code: 'uother000009', vis: 'pub', status: 'new', ts: 4, openTs: 4 },
      },
      pub: { b1: { title: '공개', body: '내용' }, b3: { title: '남', body: '내용' }, b4: { title: '딴 코드', body: '내용' } },
      prv: { authMe: { b2: { title: '비공개', body: '내용' } } },
      ans: { pub: { b1: { r1: { text: '고쳤어요', ts: 5 } } } },
      rep: { prv: { b2: { x1: { text: '고마워요', ts: 6 } } } },
      likes: { b1: { authBob: true }, b3: { authMe: true } },
      seq: { '2026-10-01': 1 },
    },
    rooms: { R1: { chatLog: { c1: { userId: ME, text: '안녕' } } } },
    stats: { userCount: 3 },
  };
  const files = [
    'users/' + ME + '/avatar.jpg', 'users/' + ME + '/emojis/1.png', 'away/' + ME + '/away_1.webp', 'bookmarks/' + ME + '/b_1.webp',
    'purikura/ROOM1/' + ME + '/0.webp', 'purikura/ROOM1/' + BOB + '/0.webp', 'users/' + BOB + '/avatar.jpg', 'users/' + ME + 'x/avatar.jpg',
  ];
  return fakeWorld(tree, files, { authMe: 'password', authBob: 'google', [ADMIN]: 'google' });
}
const adminReq = (data) => ({ auth: { uid: ADMIN, token: { firebase: { sign_in_provider: 'google.com' } } }, data });

(async () => {
  const m = require(path.resolve('functions/account-delete.js'));

  say('── 1. 입력 모양 (parseTarget)');
  {
    chk(JSON.stringify(m.parseTarget('  ' + ME + ' ')) === JSON.stringify({ userCode: ME }), '사용자 코드 — 앞뒤 공백만 뗀다');
    chk(JSON.stringify(m.parseTarget('mate-del1')) === JSON.stringify({ friendCodes: ['MATE-DEL1'] }), '친구 코드 — 소문자도 대문자로');
    chk(JSON.stringify(m.parseTarget('del1')) === JSON.stringify({ friendCodes: ['MATE-DEL1', 'COZY-DEL1'] }), '뒤 4자리 — MATE · COZY 둘 다 본다');
    const bads = ['', null, 42, 'u12', 'abcde', 'U' + ME.slice(1), ME + '/x', 'MATE-DE', 'ABCD-1234', '../users'];
    chk(bads.every((b) => m.parseTarget(b) === null), '틀린 모양(짧음 · 대문자 u · 경로 문자 · 다른 접두어 · 없음)은 거절');
  }

  say('── 2. 겹치는 경로 (pruneNested)');
  {
    const r = m.pruneNested(['users/a', 'users/a/friends/b', 'users/ab', 'inbox/a', 'inbox/a']);
    chk(JSON.stringify(r) === JSON.stringify(['inbox/a', 'users/a', 'users/ab']), '조상이 있으면 자손을 뺀다 · 같은 줄은 하나로 · «users/a» 가 «users/ab» 를 먹지 않는다');
  }

  say('── 2-1. 탈퇴한 주인의 시크릿룸이 끝나는 시각 (secretExpireAt)');
  {
    const B = m.SECRET_EXPIRE_BACK_MS, DAY = 86400000, past = T0 - 5 * DAY;
    chk(B === 1000, '끝낼 때 지금보다 1초 앞 — 입장 검사 Date.now() > exp 와 expireSecretRoom 과 같은 값');
    chk(m.secretExpireAt(T0 + 30 * DAY, T0) === T0 - B, '기간이 남은 방 → 지금 1초 앞으로 당긴다(남은 기간 동안 들어오지 못하게)');
    chk(m.secretExpireAt(past, T0) === past, '이미 끝난 방 → 끝난 날짜 그대로(발급 기록)');
    chk(m.secretExpireAt(T0, T0) === T0, '  ↳ 경계: 바로 지금 끝난 방도 그대로');
    chk(m.secretExpireAt(T0 + 1, T0) === T0 - B, '  ↳ 경계: 1ms 남은 방은 당긴다');
    chk([undefined, null, 0, -5, '123', NaN].every((v) => m.secretExpireAt(v, T0) === T0 - B), '영구(없음 · 0 · 음수 · 숫자 아님) → 지금 1초 앞 — 앱 입장 검사가 영구로 보는 값과 같다');
  }

  say('── 3. 미리 보기 — 지울 것 · 남길 것');
  let W = world();
  {
    const out = await m.handleAdminDeleteAccount(W.db, adminReq({ code: ME, dryRun: true }), W.deps, T0);
    const paths = out.groups.flatMap((g) => g.paths);
    const expect = [
      'users/' + ME, 'accountSnap/' + ME, 'userAuth/' + ME, 'authUsers/(로그인 계정)', 'friendCodes/MATE-DEL1', 'inbox/' + ME,
      'leaderboard/' + ME, 'playlistIndex/' + ME, 'bookmarksPub/' + ME, 'bookmarks/' + ME, 'mobileKeys/' + ME, 'mobileLink/' + ME,
      'users/' + BOB + '/friends/' + ME, 'users/' + AMY + '/friends/' + ME,
      'friendRequests/' + ME, 'sentFriendRequests/' + ME, 'sentFriendRequests/ucarl0000004/' + ME, 'friendRequests/udan00000005/' + ME,
      'roomInvites/' + ME, 'roomInvites/' + AMY + '/' + ME, 'secretRooms/SCRT-AAAA/pub/name', 'invites/INVT-AAAA-AAAA',
      'metrics/daily/2026-10-06/u/' + ME, 'licenseRequests/r1', 'licenseRequests/r2',
      'bugBoard/list/b1', 'bugBoard/pub/b1', 'bugBoard/ans/pub/b1', 'bugBoard/likes/b1',
      'bugBoard/list/b2', 'bugBoard/prv/(로그인 계정)/b2', 'bugBoard/rep/prv/b2',
    ];
    const missing = expect.filter((p) => !paths.includes(p));
    const extra = paths.filter((p) => !expect.includes(p));
    chk(!missing.length, '지울 경로를 다 찾는다 (본인 노드 · 로그인 연결 · 친구 코드 · 공개 목록 · 친구 양쪽 · 요청 양쪽 · 보낸 방 초대 · 시크릿룸 · 안 쓴 초대 · 접속 명단)' + (missing.length ? ' — 빠짐: ' + missing.join(', ') : ''));
    chk(!extra.length, '그 밖은 건드리지 않는다' + (extra.length ? ' — 더 있음: ' + extra.join(', ') : ''));
    chk(out.dbCount === expect.length && out.dryRun === true, '  ↳ dbCount = ' + out.dbCount);
    chk(out.storage.count === 5, 'Storage 파일 5개 — users · away · bookmarks · 스티커사진 프레임(다른 사람 것 · 이름이 비슷한 코드 제외)');
    chk(out.auth.exists && out.auth.willDelete && out.auth.provider === 'password', '로그인 계정 있음 · 지울 예정');
    chk(out.friendCode === 'MATE-DEL1' && out.name === '지울이', '확인용 친구 코드 · 이름');
    chk(!JSON.stringify(out).includes('authMe') && paths.includes('authUsers/(로그인 계정)'), '돌려주는 값에 로그인 계정 uid 를 싣지 않는다(경로도 가린다)');
    chk(W.updates.length === 0 && W.order.length === 0, '미리 보기는 아무것도 쓰지 · 지우지 않는다');
    const keptKeys = ['bugBoard/list/b3', 'bugBoard/pub/b3', 'bugBoard/likes/b3', 'bugBoard/list/b4', 'bugBoard/pub/b4', 'bugBoard/seq', 'reports', 'licenses', 'licenseRequests/r3', 'licenseRequests/r4', 'adminLog', 'metrics/summary', 'rooms', 'stats', 'users/' + BOB + '/guestbook', 'invites/INVT-BBBB-BBBB'];
    chk(keptKeys.every((k) => !paths.some((p) => p === k || p.startsWith(k + '/') || k.startsWith(p + '/'))), '남기는 것(신고 · 라이선스 키 · 남의 신청 · 작업 기록 · 합계 · 방 채팅 · 남의 방명록 · 쓰인 초대)은 목록에 없다');
    const br = out.groups.find((g) => g.key === 'bugReport');
    chk(!!br && br.count === 7 && /버그 제보/.test(br.label), '버그 제보 — 이 사람 글 둘(공개 · 비공개)과 그 답변 · 답글 · 공감을 «버그 제보» 묶음에 · 없는 칸은 세지 않는다');
    chk(W.reads.includes('bugBoard/list?authUid=authMe') && !W.reads.includes('bugBoard/list'), '  ↳ 제보 목록은 통째로 읽지 않고 로그인 계정 색인 조회만');
    chk(!br.paths.some((p) => /authMe/.test(p)), '  ↳ 비공개 글 경로의 로그인 uid 는 가린다');
    const lr = out.groups.find((g) => g.key === 'licenseRequest');
    chk(!!lr && lr.count === 2 && /라이선스 신청 기록/.test(lr.label), '라이선스 신청 기록 — 친구 코드로 · 등록한 키(issuedKey)로 찾은 둘을 «라이선스 신청 기록» 묶음에');
    chk(W.reads.includes('licenseRequests?friendCode=MATE-DEL1') && W.reads.includes('licenseRequests?issuedKey=KEEP-AAAA-BBBB-CCCC') && !W.reads.includes('licenseRequests'),
        '  ↳ 신청 목록은 통째로 읽지 않고 색인 조회만');
    chk(out.kept.some((k) => k.label === '라이선스 키') && !out.kept.some((k) => /신청/.test(k.label)), '남기는 것 목록: 라이선스 키는 남김 · 신청 기록 줄은 없음');
    chk(out.kept.length >= 5 && out.kept.every((k) => k.label && k.why), '남기는 것 목록을 이유와 함께 돌려준다');
    const bigWhole = W.reads.filter((r) => !r.startsWith('shallow:') && /^(users\/[^/]+|inbox\/[^/]+|bookmarks\/[^/]+|metrics\/daily|friendCodes|invites|users)$/.test(r));
    chk(!bigWhole.length, '큰 노드는 통째로 읽지 않는다(키만 · 한 칸만 · 색인 조회)' + (bigWhole.length ? ' — ' + bigWhole.join(', ') : ''));
    const viaFc = await m.handleAdminDeleteAccount(W.db, adminReq({ code: 'del1' }), W.deps, T0);
    chk(viaFc.code === ME && viaFc.dryRun === true, '친구 코드 뒤 4자리로도 찾는다 · dryRun 을 빠뜨리면 미리 보기');
  }

  say('── 4. 로그인 계정 안전장치');
  {
    let w = world();
    w.tree.authUsers.authMe.userCode = BOB;
    const out = await m.handleAdminDeleteAccount(w.db, adminReq({ code: ME, dryRun: true }), w.deps, T0);
    const paths = out.groups.flatMap((g) => g.paths);
    chk(!out.auth.willDelete && paths.includes('userAuth/' + ME) && !paths.includes('authUsers/(로그인 계정)'), '로그인 계정이 다른 코드를 대표하면 — 계정 · authUsers 는 두고 이 코드의 연결 줄만');
    chk(out.warnings.some((s) => /다른 사용자 코드/.test(s)), '  ↳ 경고로 알린다');
    w = world();
    w.tree.admins.authMe = true;
    let err = null; try{ await m.handleAdminDeleteAccount(w.db, adminReq({ code: ME, dryRun: true }), w.deps, T0); }catch(e){ err = e; }
    chk(err && err.httpsCode === 'failed-precondition', '관리자 계정에 묶인 코드는 거절');
    w = world();
    w.tree.friendCodes['COZY-DEL1'] = { userId: BOB };
    err = null; try{ await m.handleAdminDeleteAccount(w.db, adminReq({ code: 'DEL1' }), w.deps, T0); }catch(e){ err = e; }
    chk(err && err.httpsCode === 'failed-precondition', '뒤 4자리가 두 사람에게 걸리면 거절(앞까지 넣게)');
    err = null; try{ await m.handleAdminDeleteAccount(w.db, adminReq({ code: 'MATE-ZZZZ' }), w.deps, T0); }catch(e){ err = e; }
    chk(err && err.httpsCode === 'not-found', '없는 친구 코드는 not-found');
    const nb = world();
    nb.deps.listFiles = async () => null;
    const o = await m.handleAdminDeleteAccount(nb.db, adminReq({ code: ME, dryRun: true }), nb.deps, T0);
    chk(o.storage.count === 0 && o.warnings.some((s) => /버킷이 없는/.test(s)), 'Storage 버킷이 없는 프로젝트(dev)면 파일은 0개 · 경고로 알린다');
    const lf = world();
    lf.deps.listFiles = async () => { throw new Error('net'); };
    err = null; try{ await m.handleAdminDeleteAccount(lf.db, adminReq({ code: ME, dryRun: false }), lf.deps, T0); }catch(e){ err = e; }
    chk(!!err && lf.order.length === 0, '파일 목록을 못 받으면(버킷은 있음) 아무것도 지우지 않고 멈춘다');
  }

  say('── 5. 호출 권한');
  {
    const w = world();
    const tryCall = async (req) => { try{ await m.handleAdminDeleteAccount(w.db, req, w.deps, T0); return null; }catch(e){ return e.httpsCode; } };
    chk(await tryCall({ data: { code: ME } }) === 'unauthenticated', '로그인 안 함 → unauthenticated');
    chk(await tryCall({ auth: { uid: ADMIN, token: { firebase: { sign_in_provider: 'anonymous' } } }, data: { code: ME } }) === 'permission-denied', '익명 → 거절(관리자 uid 라도)');
    chk(await tryCall({ auth: { uid: 'authBob', token: { firebase: { sign_in_provider: 'google.com' } } }, data: { code: ME, dryRun: false } }) === 'permission-denied', '관리자가 아님 → 거절');
    chk(await tryCall(adminReq({ code: 'no!' })) === 'invalid-argument', '틀린 코드 → invalid-argument');
    chk(w.updates.length === 0 && w.order.length === 0, '  ↳ 거절된 호출은 아무것도 지우지 않는다');
  }

  say('── 6. 실행 — 순서 · 한 번의 update · 작업 기록');
  W = world();
  {
    const out = await m.handleAdminDeleteAccount(W.db, adminReq({ code: ME, dryRun: false }), W.deps, T0);
    chk(out.dryRun === false && out.done && out.done.db === out.dbCount && out.done.files === 5 && out.done.auth === true, '결과 요약 — DB · 파일 · 로그인 계정');
    const firstAuth = W.order.indexOf('auth'), lastFile = W.order.lastIndexOf('file'), db = W.order.indexOf('db');
    chk(lastFile < firstAuth && firstAuth < db && W.order.filter((x) => x === 'db').length === 1, '순서: 파일 → 로그인 계정 → DB(한 번의 update)');
    const patch = W.updates[0];
    const logKeys = Object.keys(patch).filter((k) => k.startsWith('adminLog/'));
    chk(logKeys.length === 1, '작업 기록 한 줄을 같은 update 에 싣는다 — 지웠는데 기록이 없는 일이 없다');
    const log = patch[logKeys[0]] || {};
    let rules = null; try{ rules = JSON.parse(RULES).rules; }catch(_){}
    const al = rules && rules.adminLog && rules.adminLog.$logId;
    const actRe = al && new RegExp(al.action['.validate'].match(/matches\(\/(.+?)\/\)/)[1]);
    const idRe = al && new RegExp(al['.validate'].match(/matches\(\/(.+?)\/\)/)[1]);
    chk(!!actRe && actRe.test(log.action) && log.action === 'account.delete', '기록 action «account.delete» — 규칙의 «종류.동작» 모양');
    chk(!!idRe && idRe.test(logKeys[0].split('/')[1]), '기록 id 가 규칙 모양');
    chk(log.by === ADMIN && log.target === ME && JSON.stringify(log.at) === '{".sv":"timestamp"}', '누가(by = 관리자 uid) · 언제(서버 시각) · 어떤 코드(target)');
    chk(typeof log.detail === 'string' && log.detail.length <= 120 && !/지울이|MATE-DEL1|authMe/.test(log.detail), '설명은 숫자만 — 이름 · 친구 코드 · 로그인 uid 를 남기지 않는다');
    chk(Object.keys(log).sort().join() === 'action,at,by,detail,target', '기록 칸은 규칙이 받는 다섯 개뿐');
    chk(!W.at('users/' + ME) && !W.at('accountSnap/' + ME) && !W.at('userAuth/' + ME) && !W.at('authUsers/authMe') && !W.at('friendCodes/MATE-DEL1'), '본인 노드 · 로그인 연결 · 친구 코드가 사라졌다');
    chk(!W.at('users/' + BOB + '/friends/' + ME) && !!W.at('users/' + AMY + '/friends/' + BOB), '친구 목록에서 이 사람만 빠지고 다른 친구 관계는 그대로');
    chk(!!W.at('roomInvites/' + BOB + '/' + AMY) && !W.at('roomInvites/' + AMY + '/' + ME), '남이 보낸 방 초대는 그대로 · 이 사람이 보낸 것만 사라짐');
    chk(!!W.at('reports/' + ME) && !!W.at('reports/' + BOB + '/' + ME) && !!W.at('licenses/KEEP-AAAA-BBBB-CCCC'), '신고 · 라이선스 키는 남는다');
    chk(!W.at('bugBoard/list/b1') && !W.at('bugBoard/prv/authMe/b2') && !W.at('bugBoard/ans/pub/b1') && !W.at('bugBoard/likes/b1')
        && !!W.at('bugBoard/list/b3') && !!W.at('bugBoard/likes/b3/authMe') && !!W.at('bugBoard/list/b4') && W.at('bugBoard/seq/2026-10-01') === 1,
        '버그 제보는 이 사람(같은 코드) 글만 통째로 사라지고 남의 글 · 다른 코드 글 · 번호 카운터는 남는다');
    chk(!W.at('licenseRequests/r1') && !W.at('licenseRequests/r2') && !!W.at('licenseRequests/r3') && !!W.at('licenseRequests/r4'), '이 사람 신청 기록만 사라지고 남의 신청 · 사람을 알 수 없는 신청은 그대로');
    chk(!!W.at('metrics/daily/2026-10-06/u/' + BOB) && W.at('metrics/daily/2026-10-06/visits') === 3 && !!W.at('metrics/summary/2026-10-06'), '접속 명단에서 이 사람만 빠지고 숫자 · 합계는 그대로');
    chk(!!W.at('invites/INVT-BBBB-BBBB') && !W.at('invites/INVT-AAAA-AAAA') && !!W.at('secretRooms/SCRT-BBBB'), '쓰인 초대 · 남의 시크릿룸은 남는다');
    {
      const sr = W.at('secretRooms/SCRT-AAAA');
      chk(!!sr && sr.k === 'x' && sr.pub.owner === ME && sr.pub.ts === 1 && sr.pub.name === undefined,
          '이 사람 시크릿룸은 발급 기록(열쇠 · 주인 · 발급 시각)이 남고 이름만 사라진다 — 코드가 다시 나가지 않게');
      chk(typeof sr.pub.exp === 'number' && sr.pub.exp < T0 && T0 - sr.pub.exp <= 1000, '  ↳ 영구였던 방은 지금(1초 앞)으로 끝난다 — 다음 입장부터 막힌다');
    }
    // 실제 실행 길 — 계획이 지금 exp 를 읽어 넘겨야 «이미 끝난 방은 그대로» 가 지켜진다
    for (const [what, srExp, want] of [['이미 끝난 방(5일 전) → 끝난 날짜 그대로', T0 - 5 * 86400000, T0 - 5 * 86400000], ['기간 남은 방(30일) → 지금 1초 앞', T0 + 30 * 86400000, T0 - 1000]]){
      const W2 = world(srExp);
      await m.handleAdminDeleteAccount(W2.db, adminReq({ code: ME, dryRun: false }), W2.deps, T0);
      chk(W2.at('secretRooms/SCRT-AAAA/pub/exp') === want && W2.at('secretRooms/SCRT-AAAA/pub/owner') === ME, '  ↳ 실제 탈퇴: ' + what);
    }
    chk(W.files.join() === ['purikura/ROOM1/' + BOB + '/0.webp', 'users/' + BOB + '/avatar.jpg', 'users/' + ME + 'x/avatar.jpg'].join(), 'Storage 는 이 사람 파일만 사라졌다');
    chk(!W.authUsers.authMe && W.authUsers.authBob === 'google', '로그인 계정은 이 사람 것만 사라졌다');
  }

  say('── 7. 다시 실행 · 중간 실패');
  {
    const again = await m.handleAdminDeleteAccount(W.db, adminReq({ code: ME, dryRun: false }), W.deps, T0);
    chk(again.empty === true && !again.done && W.updates.length === 1, '다 지운 뒤 다시 부르면 «지울 것 없음» — 기록도 더 남기지 않는다');
    const w = world();
    w.deps.deleteFile = async (n) => { w.order.push('file'); if (n.startsWith('away/')) throw new Error('boom'); };
    let err = null; try{ await m.handleAdminDeleteAccount(w.db, adminReq({ code: ME, dryRun: false }), w.deps, T0); }catch(e){ err = e; }
    chk(err && err.httpsCode === 'aborted' && !w.order.includes('auth') && !w.order.includes('db'), '파일 삭제가 실패하면 로그인 계정 · DB 를 건드리지 않고 멈춘다(다시 부르면 이어서)');
    const w2 = world();
    w2.deps.deleteAuthUser = async () => { w2.order.push('auth'); delete w2.authUsers.authMe; throw new Error('net'); };
    err = null; try{ await m.handleAdminDeleteAccount(w2.db, adminReq({ code: ME, dryRun: false }), w2.deps, T0); }catch(e){ err = e; }
    chk(!!err && !w2.order.includes('db') && !!w2.at('userAuth/' + ME), '로그인 계정 단계에서 실패해도 연결 줄이 남아 있다');
    const r2 = await m.handleAdminDeleteAccount(w2.db, adminReq({ code: ME, dryRun: false }), w2.deps, T0);
    chk(r2.done && r2.done.auth === false && !w2.at('userAuth/' + ME) && !w2.at('authUsers/authMe'), '  ↳ 다시 부르면 이미 없는 계정은 건너뛰고 DB 를 마저 지운다');
  }

  say('── 8. index.js 연결 · 규칙 · CSP');
  {
    const CODE = strip(FX);
    const mm = CODE.match(/exports\.adminDeleteAccount = onCall\([\s\S]*?\n  \}\);/);
    chk(!!mm, 'adminDeleteAccount = onCall (호출형)');
    chk(!!mm && /require\('\.\/account-delete'\)/.test(mm[0]) && /handleAdminDeleteAccount\(db, request, mod\.adminDeps\(db\)/.test(mm[0]), '  ↳ 처리는 account-delete.js 에 맡긴다');
    chk(!!mm && /new HttpsError\(e\.httpsCode, e\.message\)/.test(mm[0]), '  ↳ 모듈이 정한 오류 코드 · 문구를 그대로 화면에 보낸다');
    chk(!!mm && /require\('firebase-admin\/database'\)/.test(mm[0]), '  ↳ firebase-admin/database 는 실행할 때 읽는다 (배포 때 10초 로딩 제한)');
    chk(/setGlobalOptions\(\{ region: 'asia-southeast1'/.test(CODE), '  ↳ 지역 asia-southeast1 (웹 관리자 호출 지역과 같다)');
    chk(/adminDeleteAccount — 계정 삭제/.test(FX), '  ↳ 머리 주석의 함수 목록에도 적었다');
    const AD = strip(need('functions/account-delete.js'));
    chk(!/require\('firebase-(admin|functions)[^']*'\)/.test(AD.split('function adminDeps')[0]), 'account-delete.js 는 firebase 모듈을 adminDeps 안에서만 읽는다(검사는 가짜를 넣는다)');
    let rr = null; try{ rr = JSON.parse(RULES).rules.licenseRequests; }catch(_){}
    const idx = rr && [].concat(rr['.indexOn'] || []);
    chk(!!idx && idx.includes('friendCode') && idx.includes('issuedKey'), '규칙: licenseRequests 에 friendCode · issuedKey 색인 — 없으면 Admin SDK 가 신청 목록을 통째로 받아 거른다');
    let csp = '';
    try{ const hs = [].concat(JSON.parse(FB).hosting); csp = ((hs.find((x) => x.target === 'main') || hs[0]).headers.find((h) => h.source === '/admin/**').headers.find((h) => h.key === 'Content-Security-Policy') || {}).value || ''; }catch(_){}
    chk(/connect-src[^;]*https:\/\/\*\.cloudfunctions\.net/.test(csp), '웹 관리자 CSP connect-src 에 호출형 함수 주소(*.cloudfunctions.net)');
    /* 관리자 API(읽기 DB) — 웹 관리자가 부르는 주소(shared/api PROD_API_BASE_URL)가 CSP 에 없으면 브라우저가 막아 늘 RTDB 통째 읽기로 폴백한다(2026-10-13 실제로 그랬다). */
    const apiBase = 'https://api.together-working.com';   // web-admin/src/shared/api/api.ts PROD_API_BASE_URL 와 같아야 한다
    chk(!!apiBase && new RegExp('connect-src[^;]*' + apiBase.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(\\s|;|$)').test(csp),
        '웹 관리자 CSP connect-src 에 관리자 API 주소(' + (apiBase || '?') + ') — 없으면 API 대신 늘 폴백');
  }

  say('── 9. 본인 탈퇴(deleteMyAccount) — 서버');
  {
    const selfReq = (uid, data, prov) => ({ auth: { uid, token: { firebase: { sign_in_provider: prov || 'password' } } }, data });
    let w = world();
    const tryCall = async (req) => { try{ await m.handleSelfDeleteAccount(w.db, req, w.deps, T0); return null; }catch(e){ return e.httpsCode; } };
    chk(await tryCall({ data: {} }) === 'unauthenticated', '로그인 안 함 → unauthenticated');
    chk(await tryCall(selfReq('authMe', { dryRun: false, confirm: '탈퇴' }, 'anonymous')) === 'failed-precondition', '익명(가입 전) → 거절');
    chk(await tryCall(selfReq('authMe', { dryRun: false })) === 'invalid-argument', '확인 글자 없이 dryRun:false → 거절');
    chk(await tryCall(selfReq('authMe', { dryRun: false, confirm: '탈 퇴' })) === 'invalid-argument', '  ↳ 글자가 조금이라도 다르면 거절');
    chk(await tryCall(selfReq('nobody', { dryRun: true })) === 'failed-precondition', '로그인에 묶인 코드가 없으면 거절');
    w.tree.userAuth[ME] = 'authBob';
    chk(await tryCall(selfReq('authMe', { dryRun: false, confirm: '탈퇴' })) === 'permission-denied', '★ authUsers 는 내 코드를 가리켜도 userAuth 가 다른 로그인이면 거절(남의 코드)');
    chk(w.updates.length === 0 && w.order.length === 0, '  ↳ 거절된 호출은 아무것도 지우지 않는다');

    w = world();
    w.tree.admins.authMe = true;
    chk(await tryCall(selfReq('authMe', { dryRun: false, confirm: '탈퇴' })) === 'failed-precondition' && w.order.length === 0, '관리자 계정은 스스로 탈퇴할 수 없다(관리자 삭제와 같은 안전장치)');

    w = world();
    w.tree.users[ME].presence.online = true;
    const pv = await m.handleSelfDeleteAccount(w.db, selfReq('authMe', { code: BOB }), w.deps, T0);
    chk(pv.dryRun === true && pv.code === ME && w.updates.length === 0 && w.order.length === 0, 'dryRun 을 빠뜨리면 미리 보기 · 대상은 입력(code)이 아니라 로그인이 정한다');
    chk(!pv.warnings.some((x) => /접속 중/.test(x)), '«지금 접속 중» 경고는 본인에게 보이지 않는다(앱이 연결을 끊고 부른다)');
    const adm = await m.handleAdminDeleteAccount(w.db, adminReq({ code: ME, dryRun: true }), w.deps, T0);
    chk(JSON.stringify(adm.groups) === JSON.stringify(pv.groups) && adm.dbCount === pv.dbCount && adm.storage.count === pv.storage.count, '★ 지우는 범위는 관리자 삭제와 똑같다');
    chk(adm.warnings.some((x) => /접속 중/.test(x)), '  ↳ 관리자 화면에는 «접속 중» 경고가 그대로');

    const out = await m.handleSelfDeleteAccount(w.db, selfReq('authMe', { dryRun: false, confirm: '탈퇴' }), w.deps, T0);
    chk(out.done && out.done.auth === true && out.done.files === 5 && out.done.db === out.dbCount, '탈퇴 — DB · 파일 · 로그인 계정을 지운다');
    chk(!w.at('users/' + ME) && !w.at('userAuth/' + ME) && !w.authUsers.authMe && !w.at('users/' + BOB + '/friends/' + ME), '  ↳ 본인 노드 · 로그인 · 친구들 목록 속 이 사람이 사라졌다');
    chk(!!w.at('reports/' + ME) && !!w.at('licenses/KEEP-AAAA-BBBB-CCCC') && !!w.at('users/' + BOB + '/guestbook/g9'), '  ↳ 남기는 것(신고 · 라이선스 키 · 남의 방명록)은 그대로');
    const patch = w.updates[0] || {};
    const lk = Object.keys(patch).filter((k) => k.startsWith('adminLog/'));
    const log = patch[lk[0]] || {};
    let rules = null; try{ rules = JSON.parse(RULES).rules; }catch(_){}
    const al = rules && rules.adminLog && rules.adminLog.$logId;
    const actRe = al && new RegExp(al.action['.validate'].match(/matches\(\/(.+?)\/\)/)[1]);
    chk(lk.length === 1 && log.action === 'account.selfDelete' && !!actRe && actRe.test(log.action), '작업 기록 action «account.selfDelete» — 규칙 모양 · 관리자 삭제와 갈린다');
    chk(log.by === 'authMe' && log.target === ME && Object.keys(log).sort().join() === 'action,at,by,detail,target', '  ↳ by = 본인 로그인 · target = 코드 · 칸 다섯');
    chk(await tryCall(selfReq('authMe', { dryRun: false, confirm: '탈퇴' })) === 'failed-precondition' && w.updates.length === 1, '다 지운 뒤 다시 부르면 묶인 코드가 없어 거절 — 더 지우거나 기록하지 않는다');
  }
  {
    const w = world();
    w.deps.deleteAuthUser = async () => { throw new Error('net'); };
    let err = null; try{ await m.handleSelfDeleteAccount(w.db, { auth: { uid: 'authMe', token: { firebase: { sign_in_provider: 'google.com' } } }, data: { dryRun: false, confirm: '탈퇴' } }, w.deps, T0); }catch(e){ err = e; }
    chk(!!err && !!w.at('userAuth/' + ME) && !!w.at('authUsers/authMe'), '로그인 계정 단계에서 멈추면 연결 줄이 남아 — 다시 누르면 본인 확인이 되어 이어서 지운다');
  }

  say('── 10. 앱 모듈 (account-delete-net.js)');
  {
    const mod = new Function(ADN.replace(/^export (function|const) /mg, '$1 ') + '\nreturn { createAccountDelete, DELETE_FN, DELETE_CONFIRM_WORD, deleteErrorReason };')();
    chk(mod.DELETE_FN === 'deleteMyAccount' && mod.DELETE_CONFIRM_WORD === m.SELF_CONFIRM_WORD, '함수 이름 · 확인 글자가 서버와 같다');
    const mk = (opt) => {
      const log = [];
      const d = {
        callFn: async (name, data) => { log.push('call:' + name + ':' + JSON.stringify(data)); if (opt && opt.fail) throw Object.assign(new Error('x'), { code: opt.fail, message: '서버 문구' }); return { data: { ok: true, dbCount: 3, done: { db: 3 } } }; },
        signedIn: () => (opt && opt.signed) || 'ok',
        cancelPresence: () => { log.push('cancel'); return (opt && opt.hang) ? new Promise(() => {}) : Promise.resolve(); },
        goOffline: () => log.push('offline'), goOnline: () => log.push('online'),
        signOut: async () => log.push('signout'),
      };
      return { api: mod.createAccountDelete(d), log };
    };
    let t = mk();
    let r = await t.api.preview();
    chk(r.ok && r.dbCount === 3 && t.log.join('|') === 'call:deleteMyAccount:{"dryRun":true}', '미리 보기 — dryRun:true 로 부르기만 · 연결을 끊지 않는다');
    t = mk();
    r = await t.api.run('  탈퇴 ');
    chk(r.ok && r.done && r.done.db === 3, '탈퇴 — 성공');
    chk(t.log.join('|') === 'cancel|offline|call:deleteMyAccount:{"dryRun":false,"confirm":"탈퇴"}|signout', '★ 순서: 접속 표시 예약 거두기 → DB 연결 끊기 → 호출 → 로그아웃');
    t = mk();
    r = await t.api.run('탈되');
    chk(!r.ok && t.log.length === 0, '확인 글자가 틀리면 아무것도 안 한다');
    t = mk({ signed: 'anonymous' });
    r = await t.api.run('탈퇴');
    chk(!r.ok && /가입/.test(r.reason) && t.log.length === 0, '익명 세션 — 부르지 않고 안내');
    t = mk({ signed: 'none' });
    r = await t.api.preview();
    chk(!r.ok && /로그인/.test(r.reason) && t.log.length === 0, '세션 없음 — 부르지 않고 안내');
    t = mk({ fail: 'functions/unavailable' });
    r = await t.api.run('탈퇴');
    chk(!r.ok && t.log.join('|').endsWith('|online') && !t.log.includes('signout'), '★ 호출이 실패하면 연결을 다시 잇고 로그아웃하지 않는다');
    t = mk({ fail: 'functions/failed-precondition' });
    r = await t.api.run('탈퇴');
    chk(r.reason === '서버 문구', '서버가 정한 문구(본인 확인 · 관리자 등)는 그대로 보여 준다');
    chk(/배포 전/.test(mod.deleteErrorReason({ code: 'functions/not-found' })), '함수 배포 전(not-found) 안내');
    t = mk({ hang: true });
    const t0 = Date.now();
    const realST = global.setTimeout;
    global.setTimeout = (fn, ms) => realST(fn, Math.min(ms, 5));
    r = await t.api.run('탈퇴');
    global.setTimeout = realST;
    chk(r.ok && t.log.includes('offline') && Date.now() - t0 < 2000, '예약 거두기가 서버에 안 닿아도 기다림 한도 뒤 이어 간다');
    chk(!/from\s+["']https:/.test(strip(ADN)), 'Firebase 를 직접 불러오지 않는다 — deps 로 받는다');
  }

  say('── 11. 앱 연결 · 화면');
  {
    const F = strip(FI);
    chk(/import \{ createAccountDelete \} from "\.\/account\/account-delete-net\.js";/.test(F), 'firebase-init 이 account-delete-net.js 를 불러온다');
    const w = F.match(/accountDelete: createAccountDelete\(\{([\s\S]*?)\}\),/);
    chk(!!w && /await import\(FUNCTIONS_SDK_URL\)/.test(w[1]) && /getFunctions\(fbApp, FUNCTIONS_REGION\)/.test(w[1]), '  ↳ 함수 SDK 는 부를 때 들여온다 · 같은 리전');
    chk(!!w && /onDisconnect\(_myPresenceRef\)\.cancel\(\)/.test(w[1]) && /goOffline\(db\)/.test(w[1]) && /goOnline\(db\)/.test(w[1]), '  ↳ 접속 표시 예약 거두기 · 연결 끊기 · 다시 잇기를 넘긴다');
    chk(/goOffline, goOnline\s*\}\s*from "https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-database\.js"/.test(FI), '  ↳ goOffline · goOnline 은 database SDK 에서');
    const A = strip(ACC);
    const fn = A.match(/async function _loginDoDeleteAccount\(word\)\{([\s\S]*?)\n\}/);
    chk(!!fn && /accountDelete\.run|api\.run\(word\)/.test(fn[1]) && fn[1].indexOf('run(') < fn[1].indexOf('_wipeAccountLocal()'), 'account.js — 서버가 지운 뒤에만 이 PC 기록을 지운다');
    chk(!!fn && !/_acctFlushToServer|_acctPreflight|releaseDeviceSession/.test(fn[1]), '  ↳ 올리기 · 검문 · 기기 세션 놓기를 하지 않는다(지울 계정에 쓰지 않는다)');
    chk(/_loginDoDeleteAccount: \(\.\.\.a\)=>accountMod\._loginDoDeleteAccount\(\.\.\.a\)/.test(APPJS) && /const _loginDoDeleteAccount = deps\._loginDoDeleteAccount;/.test(MI), 'app.js 가 my-info.js 로 넘긴다');
    const box = (HTML.match(/<div id="acctDeleteConfirm"[\s\S]*?<div id="acctDeleteDone"/) || [''])[0];
    const inLoggedIn = HTML.indexOf('id="acctDeleteBtn"') > HTML.indexOf('id="acctLoggedIn"') && HTML.indexOf('id="acctDeleteBtn"') < HTML.indexOf('id="acctNoLogin"');
    chk(inLoggedIn, '버튼은 [내 정보 › 계정]의 로그인 얼굴 안');
    chk(/되돌릴 수 없어요/.test(box) && /지워지는 것/.test(box) && /남는 것/.test(box) && /꼭 알아 두세요/.test(box), '고지 — 되돌릴 수 없음 · 지워지는 것 · 남는 것 · 알아 둘 것');
    const keptWords = ['신고 기록', '라이선스 키', '시크릿룸의 발급 기록', '방 채팅', '방명록', '작업 기록'];
    chk(keptWords.every((k) => box.includes(k)) && m.KEPT.length === 8, '  ↳ 남는 것은 서버 KEPT 여덟과 같은 내용(KEPT 를 바꾸면 여기도)');
    chk(!/<li>[^<]*내가 방장인 시크릿룸 ·/.test(box), '  ↳ 시크릿룸은 «지워지는 것» 에 없다(발급 기록은 남는다)');
    chk(/친구들의 목록에서도/.test(box) && /로그인 계정/.test(box) && /다시 돌려받을 수 없어요/.test(box), '  ↳ 친구 쪽에서도 빠짐 · 로그인 계정 삭제 · 혜택 못 돌려받음');
    chk(/id="acctDeleteAgree" type="checkbox"/.test(box) && /id="acctDeleteWord"/.test(box) && /id="acctDeleteYes"[^>]*disabled/.test(box), '확인 — 체크 + «탈퇴» 입력 · [탈퇴하기]는 처음에 꺼져 있다');
    const M = strip(MI);
    chk(/dAgree\.checked && dWord && dWord\.value\.trim\(\) === '탈퇴'/.test(M), '  ↳ 체크와 글자가 다 맞아야 켜진다');
    chk(/cancelBtn\.focus\(\)/.test(M), '  ↳ 열면 포커스는 [취소](디자인 시스템 확인창)');
    // 탈퇴 안내는 계정 탭(로그인 수단 ~ 로그아웃) 자리를 바꿔 보인다 — 아래에 덧붙이면 화면이 너무 길었다
    chk(/#acctLoggedIn\.acct-deleting > :not\(#acctDeleteZone\)\{display:none !important;\}/.test(HTML) && /<div id="acctDeleteZone"/.test(HTML), '★ 탈퇴 안내를 여는 동안 계정 탭의 다른 칸(로그인 수단 ~ 로그아웃)은 숨는다');
    chk(/#acctLoggedIn\.acct-deleting \.acct-del-notice\{max-height:none/.test(HTML) && /class="acct-del-notice"/.test(HTML), '  ↳ 그때 고지 상자는 안쪽 스크롤 없이 다 펼친다');
    chk(/delMode\(true\)/.test(M) && /delMode\(false\)/.test(M) && /classList\.toggle\('acct-deleting'/.test(M), '  ↳ [회원 탈퇴]가 켜고 [취소]가 끈다');
    chk(/classList\.contains\('acct-deleting'\)[^\n]*dc\.click\(\)/.test(strip(MI)), '  ↳ 탭을 옮기면 열린 안내를 접는다(돌아왔을 때 계정 탭이 사라진 채로 남지 않게)');
    chk(/_loginDoDeleteAccount\(dWord\.value\)/.test(M) && /_acctRelaunchAfterDetach\(null\)/.test(M.split('_loginDoDeleteAccount(dWord.value)')[1] || ''), '성공하면 완료 안내 → 앱 다시 켜기');
    if (WA_AUDIT != null && WA_LOG != null) chk(/'account\.selfDelete'/.test(WA_AUDIT) && /'account\.selfDelete': '/.test(WA_LOG), '웹 관리자 작업 기록이 «account.selfDelete» 를 안다');
    else say('  · 웹 관리자 폴더가 없는 자리(러너) — 작업 기록 이름 검사는 저장소에서 돈다');
    const CODE = strip(FX);
    const mm = CODE.match(/exports\.deleteMyAccount = onCall\([\s\S]*?\n  \}\);/);
    chk(!!mm && /handleSelfDeleteAccount\(db, request, mod\.adminDeps\(db\)/.test(mm[0]) && /new HttpsError\(e\.httpsCode, e\.message\)/.test(mm[0]) && /require\('firebase-admin\/database'\)/.test(mm[0]), 'index.js deleteMyAccount = onCall — 처리는 account-delete.js · 오류 문구 그대로 · 실행 때 database 읽기');
    chk(/deleteMyAccount — 회원 탈퇴/.test(FX), '  ↳ 머리 주석의 함수 목록에도 적었다');
  }

  say(`\n${pass} · ${fail}`);
  say(fail ? `실패 ${fail}건` : `전부 통과 (${pass})`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); say('실패 1건'); process.exit(1); });
