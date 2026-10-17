/*
 * 비밀번호 초기화 — 웹 관리자가 부르는 adminResetPassword(호출형)의 로직.
 *   비밀번호를 잊은 사용자가 🐞 버그 제보로 연락하면, 관리자가 사용자 상세에서 임시 비밀번호를 받아 비공개로 알려 준다.
 *   사용자는 친구 코드 + 임시 비밀번호로 로그인한 뒤 [내 정보 › 계정] 에서 바꾼다(changePassword).
 * [왜 함수인가] 비밀번호는 DB 가 아니라 Firebase Authentication 에 있다. 친구 코드 계정은 이메일이 `{코드}@tw.local`(가짜)이라
 *   재설정 메일이 안 가고, 콘솔에도 새 비밀번호를 넣는 칸이 없다 — 남의 비밀번호는 관리자 권한(Admin SDK)으로만 바꿀 수 있다.
 * 입력 { code, memo } — code 는 사용자 코드(u…) 또는 친구 코드(MATE-XXXX · 뒤 4자리), memo 는 왜 · 어디로 연락받았나(제보 번호 · «오픈채팅 10/17» 등 · 형식 자유).
 * 지키는 것:
 *   · 관리자(admins/{uid} === true)만 · 익명 거절 · 메모가 비면 거절(«요청이 있어서 했다» 근거 — 연락 경로는 제보 · 메신저 무엇이든).
 *   · 관리자 계정은 초기화하지 않는다(관리자 권한을 다른 관리자가 가로채지 못하게).
 *   · 로그인 계정이 없으면(옛 계정) «친구 코드 + 비밀번호» 로그인 계정을 만들어 준다 — 친구 코드가 이 사람 것으로
 *     확인될 때만(friendCodes/{코드}.userId) · 같은 이메일 계정이 다른 사용자에 묶여 있으면 멈춘다.
 *   · 구글로만 로그인하는 계정은 건드리지 않는다(구글로 들어가면 된다 — 덧붙이면 로그인 계정의 이메일 칸이 바뀌는 부작용이 있어 뺐다 · 10-18 사용자 결정).
 *   · 임시 비밀번호는 매번 무작위(헷갈리는 0 O 1 l I 없음) · 돌려주기만 하고 어디에도 적지 않는다(로그 · 작업 기록 포함).
 *   · 바꾼 뒤 그 계정의 모든 PC 로그인을 끊는다(revokeRefreshTokens) — 남이 쓰던 세션도 끊기고, 본인은 다음 로그인 때 알게 된다.
 *   · 작업 기록 adminLog 에 누가 · 언제 · 누구를 · 어느 제보로 남긴다.
 * firebase-admin 은 쓸 때 처음 읽는다(index.js 맨 위 ⚠️) — 검사(checks/sim-password-reset.js)는 deps 를 가짜로 넣는다.
 */
'use strict';
const { resolveTarget, FRIEND_CODE_RE } = require('./account-delete');

const ADMIN_LOG = 'adminLog';
const LOG_ACTION = 'account.resetPassword';
const LOG_TARGET_MAX = 60;
const LOG_DETAIL_MAX = 120;
// 임시 비밀번호 — 8자 · 대소문자 · 숫자에서 헷갈리는 글자를 뺐다(전화 · 메신저로 옮겨 적기 쉽게)
const TEMP_PW_LEN = 8;
const TEMP_PW_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
// 메모 — 작업 기록 detail(LOG_DETAIL_MAX) 안에 들어가게 자른다
const MEMO_MAX = 60;

function fail(code, message){
  return Object.assign(new Error(message), { httpsCode: code });
}

/* 무작위 임시 비밀번호. randomBytes(n) → Uint8Array/Buffer. 글자 수(55)로 나눈 나머지가 치우치지 않게 넘치는 바이트는 버린다. */
function tempPassword(randomBytes){
  const n = TEMP_PW_CHARS.length, limit = 256 - (256 % n);
  let out = '';
  while (out.length < TEMP_PW_LEN){
    for (const b of randomBytes(TEMP_PW_LEN * 2)){
      if (b >= limit) continue;
      out += TEMP_PW_CHARS[b % n];
      if (out.length === TEMP_PW_LEN) break;
    }
  }
  return out;
}

function logId(nowMs, rand){
  return 'a' + Number(nowMs).toString(36) + (rand || Math.random)().toString(36).slice(2, 8);
}

/* 친구 코드 → 로그인 이메일(앱 firebase-init.js authSignInWithFriendCode 와 같은 규칙: `{코드 소문자}@tw.local`). */
const loginEmailOf = (fc) => String(fc).toLowerCase() + '@tw.local';

/* 이 사용자의 친구 코드 — 사용자 노드 · 계정 요약 · 찾을 때 쓴 코드 중 friendCodes/{코드}.userId 가 이 사람을 가리키는 것만. 없으면 null. */
async function verifiedFriendCode(val, code, via){
  const cands = [via, await val('users/' + code + '/friendCode'), await val('accountSnap/' + code + '/friendCode')];
  for (const fc of cands){
    if (typeof fc !== 'string' || !FRIEND_CODE_RE.test(fc)) continue;
    if ((await val('friendCodes/' + fc + '/userId')) === code) return fc;
  }
  return null;
}

/* 두 경우를 한 버튼으로:
     reset       — 로그인 계정이 있고 비밀번호도 있다 → 비밀번호만 바꾼다
     createLogin — 로그인 계정이 아예 없다(가입 기능 전부터 쓰던 옛 계정) → `{친구 코드}@tw.local` 계정을 만들고 앱 가입과 같은 모양으로 묶는다
                   (userAuth/{코드} = 계정 uid · authUsers/{uid} = { userCode, ts } — firebase-init.js authSignupBind 와 같다)
   deps: getAuthUser(uid) → { provider, hasPassword } | null · getUserByEmail(email) → { uid } | null · createUser(email, pw) → uid ·
         setPassword(uid, pw) · deleteAuthUser(uid) · revokeTokens(uid) · randomBytes(n) · serverNow() */
async function handleAdminResetPassword(db, request, deps, nowMs){
  const auth = request && request.auth;
  if (!auth || !auth.uid) throw fail('unauthenticated', '로그인이 필요해요');
  const provider = auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
  if (provider === 'anonymous') throw fail('permission-denied', '관리자만 쓸 수 있어요');
  const val = async (p) => (await db.ref(p).get()).val();
  if ((await val('admins/' + auth.uid)) !== true) throw fail('permission-denied', '관리자만 쓸 수 있어요');

  const data = (request && request.data) || {};
  const memo = typeof data.memo === 'string' ? data.memo.replace(/\s+/g, ' ').trim().slice(0, MEMO_MAX) : '';
  if (!memo) throw fail('invalid-argument', '메모(제보 번호 · 연락 경로)를 넣어 주세요');
  const target = await resolveTarget(db, data.code);
  const code = target.code;
  const fc = await verifiedFriendCode(val, code, target.via);
  const pw = tempPassword(deps.randomBytes);
  let kind, authUid = await val('userAuth/' + code);

  /* 다른 사람 · 관리자에 묶인 이메일 계정이면 손대지 않는다 */
  const emailOwner = async () => {
    if (!fc) throw fail('failed-precondition', '이 사용자의 친구 코드를 찾지 못했어요 — 친구 코드가 있어야 로그인 계정을 만들 수 있어요');
    const u = await deps.getUserByEmail(loginEmailOf(fc));
    if (!u) return null;
    const boundTo = await val('authUsers/' + u.uid + '/userCode');
    if (boundTo && boundTo !== code) throw fail('failed-precondition', '그 친구 코드의 로그인 계정이 다른 사용자에 묶여 있어요 — 확인이 필요해요');
    if ((await val('admins/' + u.uid)) === true) throw fail('failed-precondition', '관리자 계정은 여기서 바꿀 수 없어요');
    return u;
  };

  if (typeof authUid === 'string' && authUid){
    if ((await val('admins/' + authUid)) === true) throw fail('failed-precondition', '관리자 계정은 여기서 초기화할 수 없어요');
    const user = await deps.getAuthUser(authUid);
    if (!user) throw fail('failed-precondition', '연결된 로그인 계정을 찾지 못했어요 — 확인이 필요해요');
    if (!user.hasPassword) throw fail('failed-precondition', '구글로 로그인하는 계정이에요 — 구글로 로그인하면 돼요');
    kind = 'reset';
    await deps.setPassword(authUid, pw);
  } else {
    const u = await emailOwner();
    let created = false;
    if (u){ authUid = u.uid; await deps.setPassword(authUid, pw); }
    else { authUid = await deps.createUser(loginEmailOf(fc), pw); created = true; }
    /* 앱 가입과 같은 선점 — 비었거나 이미 이 계정이면 묶고, 그 사이 다른 계정이 묶였으면 만든 계정을 지우고 멈춘다 */
    const tr = await db.ref('userAuth/' + code).transaction((cur) => (cur == null || cur === authUid ? authUid : undefined));
    if (!tr || !tr.committed || (tr.snapshot && tr.snapshot.val()) !== authUid){
      if (created) { try { await deps.deleteAuthUser(authUid); } catch (_) { /* 남아도 묶이지 않은 빈 계정 — 다음 실행이 다시 쓴다 */ } }
      throw fail('aborted', '방금 다른 로그인 계정이 이 사용자에 연결됐어요 — 다시 확인해 주세요');
    }
    await db.ref('authUsers/' + authUid).set({ userCode: code, ts: nowMs });
    kind = 'createLogin';
  }
  await deps.revokeTokens(authUid);

  const name = await val('users/' + code + '/profile/name');
  const id = logId(nowMs);
  await db.ref(ADMIN_LOG + '/' + id).set({
    at: deps.serverNow(),
    by: auth.uid,
    action: LOG_ACTION,
    target: code.slice(0, LOG_TARGET_MAX),
    detail: ('메모: ' + memo + ' · ' + KIND_LABEL[kind]).slice(0, LOG_DETAIL_MAX),
  });
  console.log('[adminResetPassword]', JSON.stringify({ by: auth.uid, code, kind, memo }));   // 비밀번호는 절대 남기지 않는다
  return {
    ok: true,
    kind,
    code,
    friendCode: fc,
    name: typeof name === 'string' ? name : null,
    tempPassword: pw,
    logId: id,
  };
}

const KIND_LABEL = {
  reset: '비밀번호 바꿈 · 다른 PC 로그인 끊음',
  createLogin: '로그인 계정 새로 만듦',
};

function adminDeps(){
  const getAuth = () => require('firebase-admin/auth').getAuth();
  const notFound = (e) => e && e.code === 'auth/user-not-found';
  return {
    getAuthUser: async (uid) => {
      try {
        const u = await getAuth().getUser(uid);
        const ids = (u.providerData || []).map((p) => p && p.providerId);
        return { provider: ids[0] || null, hasPassword: ids.includes('password') };
      } catch (e) {
        if (notFound(e)) return null;
        throw e;
      }
    },
    getUserByEmail: async (email) => {
      try { const u = await getAuth().getUserByEmail(email); return { uid: u.uid }; }
      catch (e) { if (notFound(e)) return null; throw e; }
    },
    createUser: async (email, pw) => (await getAuth().createUser({ email, password: pw })).uid,
    setPassword: (uid, pw) => getAuth().updateUser(uid, { password: pw }),
    deleteAuthUser: (uid) => getAuth().deleteUser(uid),
    revokeTokens: (uid) => getAuth().revokeRefreshTokens(uid),
    randomBytes: (n) => require('crypto').randomBytes(n),
    serverNow: () => require('firebase-admin/database').ServerValue.TIMESTAMP,
  };
}

module.exports = {
  handleAdminResetPassword, tempPassword, adminDeps,
  LOG_ACTION, MEMO_MAX, TEMP_PW_LEN, TEMP_PW_CHARS, KIND_LABEL, loginEmailOf,
};
