/*
 * 계정 삭제 — 웹 관리자가 부르는 adminDeleteAccount(호출형)의 로직. 개인정보 처리방침 8항(요청 시 서버 데이터 · 로그인 계정 삭제).
 *   입력 { code, dryRun } — code 는 사용자 코드(u…) 또는 친구 코드(MATE-XXXX · COZY-XXXX · 뒤 4자리).
 *   dryRun 이면 지울 것을 세어 돌려주기만 하고, 아니면 Storage → 로그인 계정 → DB(+ 작업 기록) 순서로 지운다.
 * 순서가 이런 이유: DB 를 먼저 지우면 userAuth/{코드}(로그인 계정 uid)가 사라져 중간에 실패했을 때 다시 찾을 수 없다.
 *   파일 · 로그인 계정은 지워도 DB 의 연결 줄이 남아 있으니, 어디서 멈췄든 다시 부르면 남은 것부터 이어서 지운다.
 * 읽기는 필요한 하위 경로만 한다 — 큰 노드(users/{코드} · inbox 등)는 shallow(키만)로 있는지만 본다.
 * 남기는 것(신고 · 라이선스 · 작업 기록 · 날짜별 합계 등)은 KEPT 에 적어 화면에 그대로 보여 준다.
 * firebase-admin 은 쓸 때 처음 읽는다(index.js 맨 위 ⚠️) — 검사(checks/sim-account-delete.js)는 deps 를 가짜로 넣는다.
 */
'use strict';
const { USER_CODE_RE, METRICS_DAILY } = require('./daily-active');

const FRIEND_CODE_RE = /^(MATE|COZY)-[A-Z0-9]{4}$/;
const FRIEND_CODE_PREFIXES = ['MATE', 'COZY'];
const SAFE_KEY_RE = /^[^.#$\[\]\/]{1,128}$/;
const ADMIN_LOG = 'adminLog';
const LOG_ACTION = 'account.delete';
const LOG_TARGET_MAX = 60;
const LOG_DETAIL_MAX = 120;
// 친구 · 요청이 비정상적으로 많아도 함수 한 번에 끝나게 자른다(잘리면 경고로 알린다).
const FAN_MAX = 500;
const PARALLEL = 20;

// 사람이 쓴 파일이 있는 Storage 위치 — firebase-init.js 의 업로드 경로(users/{코드}/… · away · bookmarks)와
// app.js 스티커사진 프레임(purikura/{방}/{코드}/…). 바꾸면 앱의 업로드 경로와 같이 본다.
function storageTargets(code){
  return [
    { prefix: 'users/' + code + '/' },
    { prefix: 'away/' + code + '/' },
    { prefix: 'bookmarks/' + code + '/' },
    { prefix: 'purikura/', glob: 'purikura/*/' + code + '/**' },
  ];
}

const GROUPS = [
  ['user', '사용자 데이터 (캐릭터 · 마이홈 · 친구 목록 · 일정 · 방명록 등 전부)'],
  ['account', '계정 요약'],
  ['login', '로그인 연결'],
  ['friendCode', '친구 코드'],
  ['inbox', '받은 편지함'],
  ['public', '공개 목록 (순위표 · 플레이리스트 · 공개 책장)'],
  ['bookmarks', '책갈피'],
  ['mobile', '폰 연결'],
  ['friendOf', '다른 사람 친구 목록 속 이 사람'],
  ['friendReq', '친구 요청 (받은 것 · 보낸 것)'],
  ['roomInvite', '방 초대 (받은 것 · 보낸 것)'],
  ['secretRoom', '시크릿룸'],
  ['invite', '이 사람이 만든 안 쓴 초대 코드'],
  ['licenseRequest', '라이선스 신청 기록 (이름 · 친구 코드)'],
  ['metrics', '날짜별 접속자 명단 속 이 사람'],
];

// 지우지 않는 것 — 화면에 그대로 보여 준다. 처리방침 5항의 보관 기간을 따른다.
const KEPT = [
  { label: '신고 기록 (받은 신고 · 한 신고)', why: '처리방침: 처리 완료 후 1년 보관' },
  { label: '라이선스 키', why: '라이선스 기록은 키가 유효한 동안 보관 — 키에는 사람 정보가 없고, 계정 요약이 지워져 사람과의 연결은 끊긴다' },
  { label: '관리자 작업 기록', why: '누가 언제 무엇을 했는지 — 이 삭제도 남는다(내용 없이 코드만)' },
  { label: '날짜별 합계 숫자 (접속자 수 · 방문 수)', why: '개인을 알아볼 수 없는 합계' },
  { label: '방 채팅 기록 속 지난 메시지', why: '방 기록이라 이번 범위 밖 — 요청이 있으면 방 단위로 따로 정리' },
  { label: '다른 사람 마이홈의 방명록 글 · 보낸 선물', why: '받은 사람의 기록 — 찾으려면 모든 사용자를 훑어야 한다' },
  { label: '이미 쓰인 초대 코드', why: '초대받은 사람의 가입 기록' },
];

function fail(code, message){
  return Object.assign(new Error(message), { httpsCode: code });
}

/* 입력 → 사용자 코드 하나 또는 친구 코드 후보. 틀린 모양이면 null. 사용자 코드는 대소문자를 바꾸지 않는다. */
function parseTarget(raw){
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (USER_CODE_RE.test(s)) return { userCode: s };
  const up = s.toUpperCase();
  if (FRIEND_CODE_RE.test(up)) return { friendCodes: [up] };
  if (/^[A-Z0-9]{4}$/.test(up)) return { friendCodes: FRIEND_CODE_PREFIXES.map((p) => p + '-' + up) };
  return null;
}

/* 겹치는 경로를 뺀다 — 다중 경로 update 는 «a» 와 «a/b» 를 같이 받지 않는다. */
function pruneNested(paths){
  const uniq = Array.from(new Set(paths)).sort();
  return uniq.filter((p) => !uniq.some((q) => q !== p && p.startsWith(q + '/')));
}

const keysOf = (v) => (v && typeof v === 'object' ? Object.keys(v) : []);
const safeKeys = (v) => keysOf(v).filter((k) => SAFE_KEY_RE.test(k));

async function inChunks(items, fn){
  const out = [];
  for (let i = 0; i < items.length; i += PARALLEL){
    out.push(...await Promise.all(items.slice(i, i + PARALLEL).map(fn)));
  }
  return out;
}

async function resolveTarget(db, raw){
  const t = parseTarget(raw);
  if (!t) throw fail('invalid-argument', '사용자 코드(u…) 또는 친구 코드(MATE-XXXX)를 넣어 주세요');
  if (t.userCode) return { code: t.userCode, via: null };
  const hits = [];
  for (const fc of t.friendCodes){
    const uid = (await db.ref('friendCodes/' + fc + '/userId').get()).val();
    if (typeof uid === 'string' && USER_CODE_RE.test(uid)) hits.push({ code: uid, via: fc });
  }
  if (!hits.length) throw fail('not-found', '그 친구 코드를 가진 사용자를 찾지 못했어요');
  if (hits.length > 1) throw fail('failed-precondition', '뒤 4자리가 같은 친구 코드가 둘이에요 — MATE-XXXX 처럼 앞까지 넣어 주세요');
  return hits[0];
}

/* 지울 것을 센다 — 아무것도 쓰지 않는다. deps: shallow(path) · listFiles({prefix, glob}) · getAuthUser(uid).
   viaFc = 친구 코드로 찾았을 때 그 코드(사용자 노드에 적힌 코드와 다를 수 있다). */
async function planAccountDelete(db, code, deps, viaFc){
  const val = async (p) => (await db.ref(p).get()).val();
  const has = async (p) => (await deps.shallow(p)) != null;
  const groups = Object.fromEntries(GROUPS.map(([k]) => [k, []]));
  const add = (k, p) => groups[k].push(p);
  const warnings = [];

  const [userKeys, snap, myFc, mySr, name, online, authUid, myKey] = await Promise.all([
    deps.shallow('users/' + code),
    val('accountSnap/' + code + '/friendCode'),
    val('users/' + code + '/friendCode'),
    val('users/' + code + '/secretRoom'),
    val('users/' + code + '/profile/name'),
    val('users/' + code + '/presence/online'),
    val('userAuth/' + code),
    val('accountSnap/' + code + '/license'),
  ]);
  const snapExists = await has('accountSnap/' + code);
  if (userKeys != null) add('user', 'users/' + code);
  if (snapExists) add('account', 'accountSnap/' + code);

  // 로그인 계정 — 그 계정이 다른 코드를 가리키거나 관리자면 계정은 두고 연결 줄(userAuth)만 지운다.
  const auth = { exists: false, provider: null, willDelete: false };
  let authToDelete = null;
  if (typeof authUid === 'string' && SAFE_KEY_RE.test(authUid)){
    add('login', 'userAuth/' + code);
    const [boundCode, isAdmin, user] = await Promise.all([
      val('authUsers/' + authUid + '/userCode'),
      val('admins/' + authUid),
      deps.getAuthUser(authUid),
    ]);
    if (isAdmin === true) throw fail('failed-precondition', '관리자 계정에 묶인 코드는 여기서 지울 수 없어요');
    const mine = boundCode == null || boundCode === code;
    if (mine && boundCode != null) add('login', 'authUsers/' + authUid);
    if (user){
      auth.exists = true;
      auth.provider = user.provider;
      auth.willDelete = mine;
      if (mine) authToDelete = authUid;
    }
    if (!mine) warnings.push('로그인 계정이 다른 사용자 코드(' + String(boundCode).slice(0, 40) + ')에 묶여 있어 로그인 계정은 지우지 않아요');
  } else if (authUid != null){
    add('login', 'userAuth/' + code);
  }

  // 친구 코드 — 그 코드가 이 사람을 가리킬 때만.
  const fcs = Array.from(new Set([myFc, snap, viaFc].filter((v) => typeof v === 'string' && FRIEND_CODE_RE.test(v))));
  for (const fc of fcs){
    if ((await val('friendCodes/' + fc + '/userId')) === code) add('friendCode', 'friendCodes/' + fc);
  }

  // 이 사람 이름의 한 칸짜리 노드들.
  const single = [
    ['inbox', 'inbox/' + code], ['public', 'leaderboard/' + code], ['public', 'playlistIndex/' + code],
    ['public', 'bookmarksPub/' + code], ['bookmarks', 'bookmarks/' + code], ['mobile', 'mobileKeys/' + code],
    ['mobile', 'mobileLink/' + code],
  ];
  const singleHas = await Promise.all(single.map(([, p]) => has(p)));
  single.forEach(([k, p], i) => singleHas[i] && add(k, p));

  // 친구 — 친구 관계는 양쪽에 적혀 있다. 보낸 방 초대는 받는 사람 노드 밑에 있어 친구마다 본다.
  const [friendsRaw, gotReqRaw, sentReqRaw, gotInvRaw] = await Promise.all([
    deps.shallow('users/' + code + '/friends'),
    deps.shallow('friendRequests/' + code),
    deps.shallow('sentFriendRequests/' + code),
    deps.shallow('roomInvites/' + code),
  ]);
  const friends = safeKeys(friendsRaw).filter((k) => k !== code);
  const gotReq = safeKeys(gotReqRaw).filter((k) => k !== code);
  const sentReq = safeKeys(sentReqRaw).filter((k) => k !== code);
  if ([friends, gotReq, sentReq].some((l) => l.length > FAN_MAX)) warnings.push('친구 · 요청이 ' + FAN_MAX + '명이 넘어 앞의 ' + FAN_MAX + '명만 정리해요');
  await inChunks(friends.slice(0, FAN_MAX), async (fid) => {
    const [f, inv] = await Promise.all([has('users/' + fid + '/friends/' + code), has('roomInvites/' + fid + '/' + code)]);
    if (f) add('friendOf', 'users/' + fid + '/friends/' + code);
    if (inv) add('roomInvite', 'roomInvites/' + fid + '/' + code);
  });
  if (gotReqRaw != null) add('friendReq', 'friendRequests/' + code);
  if (sentReqRaw != null) add('friendReq', 'sentFriendRequests/' + code);
  await inChunks(gotReq.slice(0, FAN_MAX), async (from) => {
    if (await has('sentFriendRequests/' + from + '/' + code)) add('friendReq', 'sentFriendRequests/' + from + '/' + code);
  });
  await inChunks(sentReq.slice(0, FAN_MAX), async (to) => {
    if (await has('friendRequests/' + to + '/' + code)) add('friendReq', 'friendRequests/' + to + '/' + code);
  });
  if (gotInvRaw != null) add('roomInvite', 'roomInvites/' + code);

  // 시크릿룸 — 주인이 이 사람일 때만(다른 사람에게 넘어간 방은 그대로).
  if (typeof mySr === 'string' && SAFE_KEY_RE.test(mySr) && (await val('secretRooms/' + mySr + '/pub/owner')) === code){
    add('secretRoom', 'secretRooms/' + mySr);
  }

  // 라이선스 신청 기록 — 친구 코드가 적힌 신청 · 이 사람이 등록한 키로 발급된 신청. 둘 다 규칙 licenseRequests 색인으로 그것만 받는다.
  // 앱은 신청에 사람 코드를 남기지 않아(신청 id 는 그 PC 에만) 둘 다 없는 대기 신청은 찾을 수 없다.
  const reqQueries = fcs.map((fc) => ['friendCode', fc]);
  if (typeof myKey === 'string' && myKey) reqQueries.push(['issuedKey', myKey]);
  for (const [field, value] of reqQueries){
    const hits = (await db.ref('licenseRequests').orderByChild(field).equalTo(value).get()).val();
    for (const id of safeKeys(hits)) add('licenseRequest', 'licenseRequests/' + id);
  }

  // 이 사람이 만든 초대 코드 — 안 쓴 것만(쓴 것은 초대받은 사람의 가입 기록). invites 에 issuedBy 색인이 있다.
  const invites = (await db.ref('invites').orderByChild('issuedBy').equalTo(code).get()).val();
  for (const ic of safeKeys(invites)) if (!invites[ic].usedBy) add('invite', 'invites/' + ic);

  // 접속 지표 — 날짜 목록은 키만 받고, 날마다 이 사람 한 칸만 본다.
  const days = safeKeys(await deps.shallow(METRICS_DAILY));
  await inChunks(days, async (d) => {
    const p = METRICS_DAILY + '/' + d + '/u/' + code;
    if ((await val(p)) != null) add('metrics', p);
  });

  // Storage
  const storage = [];
  let noBucket = false;
  for (const t of storageTargets(code)){
    const files = await deps.listFiles(t);
    if (files === null) noBucket = true;
    storage.push({ ...t, files: files || [] });
  }
  if (noBucket) warnings.push('Storage 버킷이 없는 프로젝트라 파일은 건너뛰었어요');

  const dbPaths = pruneNested(GROUPS.flatMap(([k]) => groups[k]));
  if (online === true) warnings.push('지금 접속 중이에요 — 앱이 켜져 있으면 지운 뒤 일부를 다시 쓸 수 있어요');
  return {
    code,
    friendCode: fcs[0] || null,
    name: typeof name === 'string' ? name.slice(0, 40) : null,
    online: online === true,
    auth,
    authToDelete,
    groups: GROUPS.map(([key, label]) => ({ key, label, paths: Array.from(new Set(groups[key])).sort() })).filter((g) => g.paths.length),
    dbPaths,
    storage,
    warnings,
  };
}

const hideAuthUid = (p) => (p.startsWith('authUsers/') ? 'authUsers/(로그인 계정)' : p);

/* 화면으로 돌려줄 모양 — 로그인 계정 uid · 파일 이름은 싣지 않는다. */
function summarize(plan, dryRun){
  const files = plan.storage.reduce((n, s) => n + s.files.length, 0);
  return {
    ok: true,
    dryRun,
    code: plan.code,
    friendCode: plan.friendCode,
    name: plan.name,
    online: plan.online,
    auth: plan.auth,
    groups: plan.groups.map((g) => ({ key: g.key, label: g.label, count: g.paths.length, paths: g.paths.map(hideAuthUid) })),
    dbCount: plan.dbPaths.length,
    storage: { count: files, places: plan.storage.filter((s) => s.files.length).map((s) => ({ place: s.glob || s.prefix, count: s.files.length })) },
    kept: KEPT,
    warnings: plan.warnings,
    empty: !plan.dbPaths.length && !files && !plan.authToDelete,
  };
}

function logDetail(dbCount, files, authDeleted){
  return ('DB ' + dbCount + '곳 · 파일 ' + files + '개 · 로그인 계정 ' + (authDeleted ? '삭제' : '없음')).slice(0, LOG_DETAIL_MAX);
}

function logId(nowMs, rand){
  return 'a' + Number(nowMs).toString(36) + (rand || Math.random)().toString(36).slice(2, 8);
}

/* 지운다. deps: deleteFile(name) · deleteAuthUser(uid) · serverNow(). 작업 기록은 DB 삭제와 같은 update 에 싣는다. */
async function executeAccountDelete(db, plan, deps, by, nowMs){
  const names = plan.storage.flatMap((s) => s.files);
  const failed = [];
  await inChunks(names, async (n) => { try { await deps.deleteFile(n); } catch (e) { failed.push(n); } });
  if (failed.length) throw fail('aborted', '파일 ' + failed.length + '개를 지우지 못해 멈췄어요 — 다시 실행하면 남은 것부터 이어서 지워요');

  let authDeleted = false;
  if (plan.authToDelete){
    await deps.deleteAuthUser(plan.authToDelete);
    authDeleted = true;
  }

  const patch = {};
  for (const p of plan.dbPaths) patch[p] = null;
  const id = logId(nowMs);
  patch[ADMIN_LOG + '/' + id] = {
    at: deps.serverNow(),
    by,
    action: LOG_ACTION,
    target: plan.code.slice(0, LOG_TARGET_MAX),
    detail: logDetail(plan.dbPaths.length, names.length, authDeleted),
  };
  await db.ref().update(patch);
  return { db: plan.dbPaths.length, files: names.length, auth: authDeleted, logId: id };
}

/* 호출 하나 — 관리자 확인 → 대상 찾기 → 세기 → (dryRun 이 아니면) 지우기. 실패는 httpsCode 를 단 Error 로 던진다(index.js 가 HttpsError 로 바꾼다). */
async function handleAdminDeleteAccount(db, request, deps, nowMs){
  const auth = request && request.auth;
  if (!auth || !auth.uid) throw fail('unauthenticated', '로그인이 필요해요');
  const provider = auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
  if (provider === 'anonymous') throw fail('permission-denied', '관리자만 쓸 수 있어요');
  if ((await db.ref('admins/' + auth.uid).get()).val() !== true) throw fail('permission-denied', '관리자만 쓸 수 있어요');

  const data = (request && request.data) || {};
  const dryRun = data.dryRun !== false;   // 빠뜨리면 미리 보기 — 지우기는 false 를 분명히 보낼 때만
  const target = await resolveTarget(db, data.code);
  const plan = await planAccountDelete(db, target.code, deps, target.via);
  const out = summarize(plan, dryRun);
  if (dryRun || out.empty) return out;
  out.done = await executeAccountDelete(db, plan, deps, auth.uid, nowMs);
  console.log('[adminDeleteAccount]', JSON.stringify({ by: auth.uid, code: plan.code, ...out.done }));
  return out;
}

/* 실제 deps — Admin SDK 를 그때 읽는다. shallow 는 RTDB REST(키만 · 본문 없음) — Admin SDK 에는 shallow 가 없다. */
function adminDeps(db){
  let tokenP = null;
  const token = () => tokenP || (tokenP = require('firebase-admin/app').getApp().options.credential.getAccessToken());
  const base = String(db.ref().toString()).replace(/\/$/, '');
  const bucket = () => require('firebase-admin/storage').getStorage().bucket();
  return {
    shallow: async (path) => {
      const tok = await token();
      const url = base + '/' + path.split('/').map(encodeURIComponent).join('/') + '.json?shallow=true';
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + tok.access_token } });
      if (!res.ok) throw new Error('shallow ' + res.status);
      return res.json();
    },
    // 버킷 자체가 없으면(Storage 를 켜지 않은 dev 프로젝트) null — 그 밖의 실패는 던진다(파일을 모른 채 지우지 않게).
    listFiles: async ({ prefix, glob }) => {
      try {
        const [files] = await bucket().getFiles(glob ? { prefix, matchGlob: glob } : { prefix });
        return files.map((f) => f.name);
      } catch (e) {
        if (e && e.code === 404) return null;
        throw e;
      }
    },
    deleteFile: (name) => bucket().file(name).delete({ ignoreNotFound: true }),
    getAuthUser: async (uid) => {
      try {
        const u = await require('firebase-admin/auth').getAuth().getUser(uid);
        const ids = (u.providerData || []).map((p) => p && p.providerId);
        const provider = ids.includes('google.com') ? 'google' : ids.includes('password') ? 'password' : ids.length ? ids[0] : 'anonymous';
        return { provider };
      } catch (e) {
        if (e && e.code === 'auth/user-not-found') return null;
        throw e;
      }
    },
    deleteAuthUser: async (uid) => {
      try { await require('firebase-admin/auth').getAuth().deleteUser(uid); }
      catch (e) { if (!(e && e.code === 'auth/user-not-found')) throw e; }
    },
    serverNow: () => require('firebase-admin/database').ServerValue.TIMESTAMP,
  };
}

module.exports = {
  parseTarget, resolveTarget, pruneNested, planAccountDelete, summarize, executeAccountDelete,
  handleAdminDeleteAccount, adminDeps, storageTargets, logDetail,
  GROUPS, KEPT, LOG_ACTION, FRIEND_CODE_RE,
};
