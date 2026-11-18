/* ═══ 🔐 sim-account-password.js — 비밀번호 만들기(C3) · 바꾸기(C2) 뒤에도 이 PC 의 로그인이 이어지는가 ═══════════════
   [왜] 서버가 비밀번호를 붙이거나 바꾸면 Firebase Auth 가 그 계정의 로그인(refresh token)을 모두 끊는다.
     구글만 있던 계정이 비밀번호를 만든 뒤 이 PC 세션도 끊겨, 다시 읽기 · 토큰 새로 받기(getIdToken(true))가 TOKEN_EXPIRED 로 실패하고
     계정 탭이 «만들기» 에 머물렀다(BUG-ACCT-1). 고친 뒤에는 방금 정한 비밀번호로 곧바로 다시 로그인해 세션을 잇는다.
   ・1절: 만들기 — 끊긴 세션을 새 비밀번호로 다시 로그인 · 같은 authUid · 토큰이 다시 나온다 · 탭이 C2 로
   ・2절: 다시 로그인이 안 될 때 — 실패 · 다른 authUid · 서버가 거절(다시 로그인 시도 없음)
   ・3절: 바꾸기 — 같은 다시 로그인 한 벌
   ・4절: mutation test — 옛 코드(다시 읽기만)로 되돌리면 빨강
   [실행] account.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const MOD = ['account.js', 'parts/account/account.js', 'app/parts/account/account.js', 'apps/desktop/app/parts/account/account.js'].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — account.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const AUTH_UID = 'authG1', CODE = 'MATE-PW11';

/* 가짜 Firebase Auth — 서버가 로그인 수단을 바꾸면 그 앞에 받은 세션은 끊긴다(tokensValidAfter). 세션은 받은 때(iat)로 가린다. */
function fakeWorld(o = {}){
  const w = { now: 1, validAfter: 0, password: o.hasPassword ? o.oldPw || 'old-pw' : null, cur: null, signins: [], log: [] };
  w.cur = { uid: AUTH_UID, iat: w.now };
  const alive = () => !!w.cur && w.cur.iat >= w.validAfter;
  const providers = () => ({ authUid: w.cur.uid, anonymous: false, google: true, googleEmail: 'a@gmail.com',
    password: !!w.password, passwordEmail: w.password ? CODE.toLowerCase() + '@tw.local' : null });
  w.getIdToken = (force) => { if(!w.cur) return null; if(force && !alive()) throw Object.assign(new Error('TOKEN_EXPIRED'), { code: 'auth/user-token-expired' }); return 'tok-' + w.cur.iat; };
  /* 세션 사본 — 끊긴 뒤 다시 읽기 전까지는 예전 제공자 목록을 쥐고 있다(SDK 와 같다) */
  let snap = providers();
  w.firebaseAPI = {
    authProviders: () => (w.cur ? snap : null),
    async authReload(){ if(!alive()){ w.cur = null; throw Object.assign(new Error('x'), { code: 'auth/user-token-expired' }); } snap = providers(); },
    async authSignInWithFriendCode(code, pw){
      w.signins.push(String(code).toLowerCase() + '@tw.local|' + pw);
      if(o.signInThrows) throw new Error('network');
      if(!w.password || pw !== w.password || String(code).toUpperCase() !== CODE) return { ok: false, reason: '친구 코드나 비밀번호가 맞지 않아요' };
      w.cur = { uid: o.otherUid || AUTH_UID, iat: ++w.now }; snap = providers();
      return { ok: true, uid: w.cur.uid, email: CODE.toLowerCase() + '@tw.local' };
    },
    authReauthGoogle: async () => ({ ok: true }),
    authReauthPassword: async () => ({ ok: true }),
  };
  w.userApiMod = {
    async attachPasswordLogin(pw){ w.log.push('attach'); if(o.serverFail) throw Object.assign(new Error('x'), { code: o.serverFail }); w.password = pw; w.validAfter = ++w.now; return { friendCode: CODE }; },
    async changePassword(pw){ w.log.push('change'); w.password = pw; w.validAfter = ++w.now; return true; },
    reasonOf: (e) => '문구:' + (e && e.code),
  };
  return w;
}

const A0 = strip(MOD);
function take(src, head){ const i = src.indexOf(head); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0; for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; }
/* 다시 확인 상수 · 비밀번호 · 구글 갈래 · 판단 함수 한 벌 + 다시 로그인 · 만들기 · 바꾸기 · 모드 · 아이디 */
function load(src, w){
  const re0 = take(src, 'async function _withRecentLogin(');
  const re = src.slice(src.indexOf('const REAUTH_NO_METHOD'), src.indexOf(re0) + re0.length);
  const parts = [re, take(src, 'async function _reloginWithPassword('), take(src, 'function _acctMethodsMode('), take(src, 'function _acctPwCode('),
    take(src, 'async function _acctCreatePassword('), take(src, 'async function _acctChangePassword(')];
  if(!re0 || parts.some((p, i) => !p && i !== 1)) return null;   // _reloginWithPassword 는 옛 코드에 없다(mutation test 가 옛 코드를 싣는다)
  const f = new Function('env', `const { firebaseAPI, userApiMod } = env;
    const companion = { signInWithGoogle: async () => ({ ok: true, idToken: 'g' }) };
    const asyncPrompt = async () => null; const notifyError = () => {};
    const loginFlowMod = { meCache: () => ({ me: { friendCode: ${JSON.stringify(CODE)} } }) };
    const localStorage = { getItem: () => null };
    const MY_FRIEND_CODE_KEY = 'k'; const FRIEND_CODE_LOGIN_RE = /^[A-Z]{4}-[A-Z0-9]{4}$/;
    ${parts.join('\n')}
    return { create: _acctCreatePassword, change: _acctChangePassword, mode: _acctMethodsMode };`);
  return f(w);
}

/* 판정 한 벌 — 원본은 0 · 깨 본 글은 1 이상이어야 한다 */
async function judge(src, report){
  const r = [];
  const t = (ok, msg) => { r.push(!!ok); if(report) chk(ok, msg); };
  let w = fakeWorld(), m = load(src, w);
  if(!m){ t(false, '함수들을 떼어 오지 못함'); return r.filter((x) => !x).length; }

  if(report) say('── 1. 만들기(C3) — 끊긴 세션을 새 비밀번호로 잇는다');
  t(m.mode(w.firebaseAPI.authProviders()).mode === 'c3', '처음은 구글만 — 계정 탭 «만들기»(C3)');
  let res = await m.create('new-pw-1');
  let tok = null; try{ tok = w.getIdToken(true); }catch(_){ tok = null; }
  t(res.ok && res.code === CODE && w.log.join() === 'attach', '서버가 붙이고 성공을 돌려준다(아이디 = 친구 코드)');
  t(!!tok, '★ 비밀번호를 만든 뒤에도 getIdToken(true) 가 토큰을 준다(TOKEN_EXPIRED 아님)');
  t(res.relogged === true && w.cur && w.cur.uid === AUTH_UID, '  ↳ 같은 authUid 로 다시 로그인했다(relogged:true)');
  t(w.signins.length === 1 && w.signins[0] === CODE.toLowerCase() + '@tw.local|new-pw-1', '  ↳ 다시 로그인은 {친구 코드}@tw.local + 방금 정한 비밀번호 한 번');
  t(m.mode(w.firebaseAPI.authProviders()).mode === 'c2', '  ↳ 계정 탭이 «바꾸기»(C2)로 바뀐다');

  if(report) say('── 2. 다시 로그인이 안 될 때');
  w = fakeWorld({ signInThrows: true }); m = load(src, w);
  res = await m.create('new-pw-1');
  t(res.ok && res.relogged === false, '다시 로그인이 던져도 만들기는 성공 · relogged:false(화면이 «다시 시작» 안내)');
  w = fakeWorld({ otherUid: 'authOther' }); m = load(src, w);
  res = await m.create('new-pw-1');
  t(res.ok && res.relogged === false, '다른 authUid 로 들어오면 이었다고 보지 않는다');
  w = fakeWorld({ serverFail: 'USER_PASSWORD_LOGIN_EXISTS' }); m = load(src, w);
  res = await m.create('new-pw-1');
  t(!res.ok && res.reason === '문구:USER_PASSWORD_LOGIN_EXISTS' && w.signins.length === 0 && w.cur.iat >= w.validAfter, '서버가 거절하면 다시 로그인하지 않는다 · 세션 그대로');

  if(report) say('── 3. 바꾸기(C2) — 같은 다시 로그인');
  w = fakeWorld({ hasPassword: true }); m = load(src, w);
  res = await m.change('new-pw-2');
  tok = null; try{ tok = w.getIdToken(true); }catch(_){ tok = null; }
  t(res.ok && res.relogged === true && !!tok && w.signins[0] === CODE.toLowerCase() + '@tw.local|new-pw-2', '바꾼 뒤 새 비밀번호로 다시 로그인 · 토큰이 나온다');
  return r.filter((x) => !x).length;
}

(async () => {
  await judge(A0, true);
  say('── 4. mutation test — 하나라도 못 잡으면 빨강');
  const createFn = take(A0, 'async function _acctCreatePassword(');
  const BREAKS = [
    ['옛 코드(다시 읽기만 · 다시 로그인 없음)', (s) => s.replace(createFn, `async function _acctCreatePassword(pw){
      const c = _acctPwCode();
      if(!c.ok) return c;
      const r = await _withRecentLogin(() => userApiMod.attachPasswordLogin(pw));
      if(!r.ok) return r;
      try{ await firebaseAPI.authReload(); }catch(_){}
      return { ok:true, code:c.code };
    }`)],
    ['authUid 를 안 견줌', (s) => s.replace('return !!(authUid && l && l.ok && l.uid === authUid);', 'return !!(l && l.ok);')],
    ['서버가 거절해도 다시 로그인', (s) => s.replace("const r = await _withRecentLogin(() => userApiMod.attachPasswordLogin(pw));\n  if(!r.ok) return r;", "const r = await _withRecentLogin(() => userApiMod.attachPasswordLogin(pw));\n  await _reloginWithPassword(c.code, pw, pv && pv.authUid);\n  if(!r.ok) return r;")],
  ];
  const missed = [];
  for(const [what, brk] of BREAKS){
    const s = brk(A0);
    if(s === A0){ missed.push('글 못 찾음: ' + what); continue; }
    if((await judge(s, false)) === 0) missed.push(what);
  }
  chk(!missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));
  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 예외: ' + (e && e.stack || e)); process.exit(1); });
