/*
 * 계정 삭제(adminDeleteAccount) 검사. functions/account-delete.js 를 그대로 불러 가짜 DB · 가짜 Storage · 가짜 로그인으로 돌린다.
 * 1. 입력 모양  2. 겹치는 경로  3. 미리 보기(지울 것 · 남길 것)  4. 로그인 계정 안전장치  5. 호출 권한  6. 실행 순서 · 작업 기록
 * 7. 다시 실행(이어서 지우기)  8. index.js 연결 · 규칙 · CSP
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

function world(){
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
    secretRooms: { 'SCRT-AAAA': { k: 'x', pub: { owner: ME, ts: 1 } }, 'SCRT-BBBB': { k: 'x', pub: { owner: BOB, ts: 1 } } },
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
      'roomInvites/' + ME, 'roomInvites/' + AMY + '/' + ME, 'secretRooms/SCRT-AAAA', 'invites/INVT-AAAA-AAAA',
      'metrics/daily/2026-10-06/u/' + ME, 'licenseRequests/r1', 'licenseRequests/r2',
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
    const keptKeys = ['reports', 'licenses', 'licenseRequests/r3', 'licenseRequests/r4', 'adminLog', 'metrics/summary', 'rooms', 'stats', 'users/' + BOB + '/guestbook', 'invites/INVT-BBBB-BBBB'];
    chk(keptKeys.every((k) => !paths.some((p) => p === k || p.startsWith(k + '/') || k.startsWith(p + '/'))), '남기는 것(신고 · 라이선스 키 · 남의 신청 · 작업 기록 · 합계 · 방 채팅 · 남의 방명록 · 쓰인 초대)은 목록에 없다');
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
    chk(!W.at('licenseRequests/r1') && !W.at('licenseRequests/r2') && !!W.at('licenseRequests/r3') && !!W.at('licenseRequests/r4'), '이 사람 신청 기록만 사라지고 남의 신청 · 사람을 알 수 없는 신청은 그대로');
    chk(!!W.at('metrics/daily/2026-10-06/u/' + BOB) && W.at('metrics/daily/2026-10-06/visits') === 3 && !!W.at('metrics/summary/2026-10-06'), '접속 명단에서 이 사람만 빠지고 숫자 · 합계는 그대로');
    chk(!!W.at('invites/INVT-BBBB-BBBB') && !W.at('invites/INVT-AAAA-AAAA') && !!W.at('secretRooms/SCRT-BBBB'), '쓰인 초대 · 남의 시크릿룸은 남는다');
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
    try{ csp = (JSON.parse(FB).hosting.headers.find((h) => h.source === '/admin/**').headers.find((h) => h.key === 'Content-Security-Policy') || {}).value || ''; }catch(_){}
    chk(/connect-src[^;]*https:\/\/\*\.cloudfunctions\.net/.test(csp), '웹 관리자 CSP connect-src 에 호출형 함수 주소(*.cloudfunctions.net)');
  }

  say(`\n${pass} · ${fail}`);
  say(fail ? `실패 ${fail}건` : `전부 통과 (${pass})`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); say('실패 1건'); process.exit(1); });
