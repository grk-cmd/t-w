/* user-api.js — 🪪 계정 provider — 서버 user · invite · 탈퇴 미리보기 · 방문 기록 길(/v1) 한 벌 (검사 sim-user-api.js)
   [왜] 로그인 · 가입 · 이름 · 비밀번호 · 탈퇴 · 초대가 서버(API)로 옮겼다. 화면 · 흐름(login-flow.js · account.js · license-gate.js)은
     경로 · 본문 모양 · 오류 code 를 모르고 이 파일의 함수만 부른다 — 서버 계약이 바뀌면 여기 한 곳만 고친다.
   [모양] 모두 Promise. 성공은 서버 data(모양을 맞춘 값), 실패는 api-client.js 의 ApiError 그대로 던진다(«실패 ≠ 없음» — 부르는 쪽이 가른다).
     화면에 쓸 한 줄은 reasonOf(err) — 서버 code → 사용자 문구 표(REASONS) · 표에 없으면 kind 로(닿지 못함 · 그 밖).
   [길] 신원은 토큰뿐 — 경로에 내 코드를 싣지 않는다(/v1/me). 토큰 없이 여는 길은 셋: 초대 코드 확인 · 비밀번호 가입 · 방문 기록.
   classic script — api-client.js · request-id.js 다음 · login-flow.js · app.js 보다 먼저 싣는다(window.TwUserApi). Firebase 를 모른다. */
(function(){
'use strict';

const WITHDRAW_CONFIRM = '탈퇴';   // 서버 UserRequest.Withdrawal — 확인 글자(같아야 한다)
const ME_TIMEOUT_MS = 8000;        // 켤 때 «이 로그인의 계정» 묻기 — 읽기 기본(2.5초)보다 넉넉히(로컬 모드로 떨어지는 문턱)
const INVITE_RE = /^[A-Za-z0-9-]{4,32}$/;   // 입력칸 모양만 거른다(진짜 판정은 서버) — 경로에 실을 수 있는 글자만

/* 서버 code → 화면 한 줄. 서버 message 로 가르지 않는다(code 가 계약). */
const REASONS = Object.freeze({
  USER_CODE_NOT_BOUND: '이 로그인으로 가입한 계정이 없어요',
  USER_ALREADY_JOINED: '이미 가입한 로그인이에요',
  USER_WITHDRAWAL_PENDING: '탈퇴 정리가 아직 끝나지 않았어요 — 잠시 뒤 다시 해 주세요',
  USER_INVITE_REQUIRED: '초대 코드가 필요해요',
  USER_WEAK_PASSWORD: '비밀번호는 6자 이상으로 정해 주세요',
  USER_ANONYMOUS_TOKEN: '가입을 마친 로그인으로만 할 수 있어요',
  USER_SIGNUP_CLOSED_TODAY: '오늘 가입 자리가 다 찼어요 — 내일 다시 해 주세요',
  USER_RESERVED_NAME: '운영진과 헷갈리는 이름은 쓸 수 없어요',
  USER_PASSWORD_LOGIN_EXISTS: '이미 비밀번호가 있는 계정이에요',
  USER_NO_PASSWORD_LOGIN: '비밀번호가 없는 계정이에요 — 먼저 비밀번호를 만들어 주세요',
  USER_REAUTH_REQUIRED: '한 번 더 로그인한 뒤 해 주세요',
  USER_CONFIRM_MISMATCH: '확인 글자 «' + WITHDRAW_CONFIRM + '» 를 그대로 입력해 주세요',
  USER_ADMIN_CANNOT_WITHDRAW: '관리자 계정은 탈퇴할 수 없어요',
  USER_AUTH_UNAVAILABLE: '로그인 서버에 지금 닿지 못했어요 — 잠시 뒤 다시 해 주세요',
  INVITE_NOT_FOUND: '없는 초대 코드예요',
  INVITE_NOT_USABLE: '쓸 수 없는 초대 코드예요',
  INVITE_NO_QUOTA: '남은 초대장이 없어요',
  AUTH_REQUIRED: '로그인이 풀렸어요 — 다시 로그인해 주세요',
  NO_TOKEN: '로그인이 풀렸어요 — 다시 로그인해 주세요',
  TOO_MANY_REQUESTS: '시도가 너무 잦아요 — 잠시 뒤 다시 해 주세요',
  SERVER_ADMIN_ONLY: '지금은 서버 점검 중이에요 — 점검이 끝나면 다시 해 주세요',
});
const OFFLINE_REASON = '서버에 닿지 못했어요 — 인터넷 연결을 확인하고 다시 해 주세요';
const UNKNOWN_REASON = '서버에서 처리하지 못했어요 — 잠시 뒤 다시 해 주세요';

function reasonOf(err){
  const code = String((err && err.code) || '');
  if(code && Object.prototype.hasOwnProperty.call(REASONS, code)) return REASONS[code];
  const kind = String((err && err.kind) || '');
  if(kind === 'unavailable' || kind === 'notReady' || !kind) return OFFLINE_REASON;
  return UNKNOWN_REASON;
}

/* 초대 확인 까닭(서버 InviteUsability — USABLE 이 아닐 때만 실려 온다) → 한 줄 */
const INVITE_UNUSABLE = Object.freeze({
  FULL: '이미 다 쓴 초대 코드예요',
  EXPIRED: '기한이 지난 초대 코드예요',
  PAUSED: '지금은 쓸 수 없는 초대 코드예요',
  NOT_FOUND: '없는 초대 코드예요',
});
const inviteReasonOf = (r) => INVITE_UNUSABLE[String(r || '')] || '쓸 수 없는 초대 코드예요';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

/* 서버 Me → 앱이 쓰는 모양. 꼭 있어야 할 칸(userCode · friendCode · version)이 없으면 null(받은 값을 믿지 않는다). */
function meFrom(d){
  if(!isObj(d)) return null;
  const userCode = str(d.userCode), friendCode = str(d.friendCode);
  if(!/^u[0-9a-z]{8,40}$/i.test(userCode) || !friendCode || typeof d.version !== 'number') return null;
  const pp = isObj(d.presencePref) ? d.presencePref : {};
  const away = isObj(d.awayImage) && str(d.awayImage.url) ? { url: d.awayImage.url, size: num(d.awayImage.size, 0) } : null;
  return {
    userCode, friendCode,
    displayName: str(d.displayName),
    awayImage: away,
    presencePref: { locked: pp.locked === true, online: pp.online !== false },
    hasPasswordLogin: d.hasPasswordLogin === true,
    admin: d.admin === true,
    premium: d.premium === true,
    premiumGraceSec: Math.max(0, num(d.premiumGraceSec, 0)),
    version: d.version,
  };
}

/** @param {{ api: () => { get: Function, post: Function, patch: Function }, newId: () => string }} deps
 *   api 는 로그인 통로(TwApi.authed — 쉬기 없음 · 토큰 · 기기 머리). 토큰 없는 길은 opts.auth:false 로 같은 통로를 쓴다. */
function createUserApi(deps){
  const api = deps.api;
  const newId = deps.newId;

  async function me(){ return meFrom(await api().get('/v1/me', { auth: true, timeoutMs: ME_TIMEOUT_MS })); }

  /* 가입 — 비밀번호 길(토큰 없음 · requestId 필수) 또는 구글 길(지금 로그인 토큰). inviteCode 는 있을 때만 싣는다. */
  async function joinWithPassword(o){
    const body = { password: String(o.password || ''), requestId: o.requestId || newId() };
    if(o.inviteCode) body.inviteCode = o.inviteCode;
    return meFrom(await api().post('/v1/users', body, { auth: false }));
  }
  async function joinWithGoogle(o){
    const body = {};
    if(o && o.inviteCode) body.inviteCode = o.inviteCode;
    return meFrom(await api().post('/v1/users', body));
  }

  /* 내 계정 고치기 — { version, displayName?, presencePref?:{ locked, online } }. 칸을 안 실으면 그대로. */
  async function updateMe(patch){ return meFrom(await api().patch('/v1/me', patch)); }

  async function attachPasswordLogin(password){ return meFrom(await api().post('/v1/me/password-login', { password: String(password || '') })); }
  async function changePassword(newPassword){ await api().post('/v1/me/password', { newPassword: String(newPassword || '') }); return true; }

  /* 탈퇴 미리보기 → { items, files(null = 셀 수 없음), byContext } · 탈퇴(202) */
  async function withdrawalPreview(){
    const d = await api().get('/v1/me/withdrawal-preview', { auth: true });
    if(!isObj(d)) return null;
    return { items: Math.max(0, num(d.items, 0)), files: (typeof d.files === 'number' && d.files >= 0) ? d.files : null,
      byContext: Array.isArray(d.byContext) ? d.byContext.filter(isObj).map((c) => ({ context: str(c.context), count: num(c.count, 0) })) : [] };
  }
  async function withdraw(){ await api().post('/v1/me/withdrawal', { confirm: WITHDRAW_CONFIRM }); return true; }

  /* 초대 코드 확인(토큰 없음) → { usable, reason }. 모양이 틀린 입력은 서버에 묻지 않는다. */
  async function checkInvite(code){
    const c = String(code || '').trim().toUpperCase();
    if(!INVITE_RE.test(c)) return { usable: false, reason: 'NOT_FOUND', code: c };
    const d = await api().get('/v1/invites/' + encodeURIComponent(c), { auth: false });
    return { usable: !!(isObj(d) && d.usable === true), reason: isObj(d) ? str(d.reason) || null : null, code: c };
  }
  /* 내 초대 → { invitesLeft(null = 무제한), invites:[{code, used, createdAt}] } · 새 초대장 → { code } */
  async function myInvites(){
    const d = await api().get('/v1/me/invites', { auth: true });
    if(!isObj(d)) return null;
    return { invitesLeft: (typeof d.invitesLeft === 'number') ? d.invitesLeft : null, invites: Array.isArray(d.invites) ? d.invites.filter(isObj) : [] };
  }
  async function createInvite(requestId){
    const d = await api().post('/v1/me/invites', { requestId: requestId || newId() });
    return { code: isObj(d) ? str(d.code) : '' };
  }

  /* 친구코드로 찾기 → [{ userCode, displayName }](0 또는 1명) */
  async function findByFriendCode(code){
    const d = await api().get('/v1/users?friendCode=' + encodeURIComponent(String(code || '').trim().toUpperCase()), { auth: true });
    return Array.isArray(d) ? d.filter((x) => isObj(x) && str(x.userCode)).map((x) => ({ userCode: x.userCode, displayName: str(x.displayName) })) : [];
  }

  /* 방문 기록(204) — 로그인돼 있으면 토큰을 싣고, 토큰이 없거나 거절되면 토큰 없이 한 번 더(익명 방문으로 센다). */
  async function visit(){
    try{ await api().post('/v1/metrics/visits', undefined); }
    catch(e){
      if(!(e && e.kind === 'auth')) throw e;
      await api().post('/v1/metrics/visits', undefined, { auth: false });
    }
    return true;
  }

  return { me, joinWithPassword, joinWithGoogle, updateMe, attachPasswordLogin, changePassword,
    withdrawalPreview, withdraw, checkInvite, myInvites, createInvite, findByFriendCode, visit,
    reasonOf, inviteReasonOf };   // 화면 문구 표도 같이 — 부르는 쪽이 통로 하나만 받게
}

const out = { WITHDRAW_CONFIRM, ME_TIMEOUT_MS, INVITE_RE, REASONS, OFFLINE_REASON, UNKNOWN_REASON, INVITE_UNUSABLE,
  reasonOf, inviteReasonOf, meFrom, createUserApi };
if(typeof window !== 'undefined'){
  /* 앱 한 벌 — 통로 · 요청 번호는 부를 때 찾는다(싣는 차례가 바뀌어도 만들 때 던지지 않게) */
  out.store = createUserApi({ api: () => window.TwApi.authed, newId: () => window.TwRequestId.newId() });
  window.TwUserApi = out;
}
if(typeof module !== 'undefined' && module.exports) module.exports = out;
})();
