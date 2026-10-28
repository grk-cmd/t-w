/* sim-login-flow.js — 🔑 로그인 흐름(account/login-flow.js) 검사 — 가짜 서버(user-api 자리) · 가짜 Auth · 가짜 realtime · 가짜 시계로 그대로 돌린다
   진짜로 쓰는 것: api-errors.js(오류 → 할 일) · request-id.js(같은 일 다시 보내기 번호) · user-api.js(문구 표)
   ・1절: 판정 — 로그인 없음 · 익명은 login · 계정 있으면 in(사본은 로그인과 묶어 적음) · 가입 전은 signup(사본 지움) ·
          닿지 못함은 local(같은 로그인의 마지막 사본 · 남의 사본은 안 읽음) · 토큰 끝남은 login · 모양이 틀린 답은 local
   ・2절: realtime — goOnline 은 claim 으로 한 번 · 밀려나면 onSessionLost · «여기서 계속» 은 다시 claim
   ・3절: 로컬 모드 — 15 · 30초 … 다시 묻고 · 서버가 답하면 realtime 켜고 알림 · 그 전엔 안 켬
   ・4절: 로그인 — 구글 창 닫음은 조용히 · Auth 실패 문구 · 계정 있음 · 가입 전 · 친구코드 로그인에서 계정이 없으면 로그인을 놓음
   ・5절: 가입 — 비밀번호: 닿지 못해 다시 누르면 같은 요청 번호 · 서버가 거절하면 새 번호 · 비밀번호를 바꾸면 새 번호 · 받은 친구코드로 로그인 ·
          로그인을 못 하면 joined(번호 유지) · 구글: 이미 계정 · 가입 전이면 초대 코드로 가입 · 이미 가입(USER_ALREADY_JOINED)은 그 계정
   ・6절: 내 계정 고치기 — 사본 version · 다른 곳이 먼저 바꿨으면 다시 받아 한 번 더 · 그 밖 실패는 ok:false
   ・7절: 로그아웃 · 프리미엄 유예 — realtime 끔 · API 로그인 읽기 뗌 · 로그인 놓음 · 사본 지움 · 유예 안 · 밖
   ・8절: 배선 — html 차례(user-api · api-errors · rt-hub 다음 · app.js 앞)
   ・9절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  LF: pick(at('login-flow.js', 'account')),
  UA: pick(at('user-api.js', 'account')),
  AE: pick(at('api-errors.js', 'shared')),
  RI: pick(at('request-id.js', 'shared')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
const tick = async () => { for(let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };

const ME = (v, extra) => Object.assign({ userCode: 'u1234567890', friendCode: 'MATE-AB12', displayName: '나', presencePref: { locked: false, online: true },
  hasPasswordLogin: true, admin: false, premium: true, premiumGraceSec: 3600, version: v || 1 }, extra || {});
const apiErr = (kind, code) => Object.assign(new Error(code), { kind, code });

function mkEnv(S, o){
  const LF = load(S.LF), UA = load(S.UA), AE = load(S.AE), RI = load(S.RI);
  const opt = o || {};
  const log = [];
  const clock = { t: 1_800_000_000_000, q: [] };
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  let user = ('user' in opt) ? opt.user : { uid: 'auth1', anonymous: false };
  const srv = { me: opt.me || (() => ME(1)), joinPw: [], joinG: [], updates: [] };
  const userApi = {
    me: async () => { log.push('me'); return srv.me(); },
    joinWithPassword: async (b) => { srv.joinPw.push(b); return srv.joinPwAns ? srv.joinPwAns(b) : ME(1, { friendCode: 'MATE-NEW1' }); },
    joinWithGoogle: async (b) => { srv.joinG.push(b); return srv.joinGAns ? srv.joinGAns(b) : ME(1); },
    updateMe: async (b) => { srv.updates.push(b); return srv.update ? srv.update(b) : ME(b.version + 1, { displayName: b.displayName || '나' }); },
  };
  const authLog = [];
  const auth = {
    ready: async () => {},
    user: () => user,
    signInGoogle: async (tok) => { authLog.push('g:' + tok); if(opt.gFail) return { ok: false, reason: '구글 실패' }; user = { uid: opt.gUid || 'authG', anonymous: false }; return { ok: true, email: 'a@b.c' }; },
    signInPassword: async (code, pw) => { authLog.push('p:' + code + ':' + pw); if(opt.pFail && opt.pFail()) return { ok: false, reason: '비번 틀림' }; user = { uid: opt.pUid || 'auth1', anonymous: false }; return { ok: true }; },
    signOut: async () => { authLog.push('out'); user = null; },
  };
  const rtLog = []; let stateFn = null;
  const rt = { start: (x) => rtLog.push('start:' + JSON.stringify(x)), stop: () => rtLog.push('stop'), onState: (fn) => { stateFn = fn; return () => {}; } };
  let lost = 0;
  const ids = RI.createPending();
  const flow = LF.createLoginFlow({
    userApi, translate: AE.translate, reasonOf: UA.reasonOf, auth,
    googleWindow: async () => (opt.gWin ? opt.gWin() : { ok: true, idToken: 'gtok' }),
    rt, pending: ids, storage, onSessionLost: () => { lost++; }, forgetSession: () => { rtLog.push('forget'); },
    now: () => clock.t,
    setTimer: (fn, ms) => { const h = { at: clock.t + ms, fn }; clock.q.push(h); return h; },
    clearTimer: (h) => { const i = clock.q.indexOf(h); if(i >= 0) clock.q.splice(i, 1); },
  });
  const advance = async (ms) => {
    const end = clock.t + ms;
    for(;;){ await tick(); clock.q.sort((a, b) => a.at - b.at); const h = clock.q[0]; if(!h || h.at > end) break; clock.t = h.at; clock.q.shift(); h.fn(); }
    clock.t = end; await tick();
  };
  return { LF, flow, srv, store, storage, authLog, rtLog, log, clock, advance, lost: () => lost, fireState: (s) => stateFn && stateFn(s),
    setUser: (u) => { user = u; } };
}

async function judge(S){
  say('── 1. 판정');
  {
    const e = mkEnv(S, { user: null });
    chk((await e.flow.confirm()).state === 'login' && e.log.length === 0, '로그인 없음 → login(서버에 묻지 않음)');
    e.setUser({ uid: 'anon1', anonymous: true });
    chk((await e.flow.confirm()).state === 'login', '익명 세션(옛 가입 도중) → login');
    const e2 = mkEnv(S);
    const r = await e2.flow.confirm();
    const c = JSON.parse(e2.store.get('tw.me') || 'null');
    chk(r.state === 'in' && r.me.userCode === 'u1234567890' && c && c.authUid === 'auth1' && c.me.version === 1 && c.at === e2.clock.t,
      '계정 있음 → in · 사본을 로그인(authUid)과 묶어 적음');
    e2.srv.me = () => { throw apiErr('auth', 'USER_CODE_NOT_BOUND'); };
    const r2 = await e2.flow.confirm();
    chk(r2.state === 'signup' && !e2.store.has('tw.me'), '가입 전 · 탈퇴(401 USER_CODE_NOT_BOUND) → signup · 사본 지움');
    const e3 = mkEnv(S);
    await e3.flow.confirm();
    e3.srv.me = () => { throw apiErr('unavailable', 'NETWORK'); };
    const r3 = await e3.flow.confirm();
    chk(r3.state === 'local' && r3.me && r3.me.userCode === 'u1234567890' && /연결/.test(r3.reason), '닿지 못함 → local · 같은 로그인의 마지막 사본');
    e3.setUser({ uid: 'auth2', anonymous: false });
    const r4 = await e3.flow.confirm();
    chk(r4.state === 'local' && r4.me === null, '  ↳ 다른 로그인의 사본은 읽지 않는다');
    e3.srv.me = () => { throw apiErr('unavailable', 'SERVER_ADMIN_ONLY'); };
    chk((await e3.flow.confirm()).state === 'local', '  ↳ 점검(503 SERVER_ADMIN_ONLY)도 로컬 모드');
    e3.srv.me = () => { throw apiErr('auth', 'AUTH_REQUIRED'); };
    chk((await e3.flow.confirm()).state === 'login', '토큰이 끝남(AUTH_REQUIRED) → login');
    e3.srv.me = () => null;
    chk((await e3.flow.confirm()).state === 'local', '모양이 틀린 답 → local(믿지 않음)');
  }

  say('── 2. realtime');
  {
    const e = mkEnv(S);
    e.flow.goOnline(); e.flow.goOnline();
    chk(e.rtLog.join() === 'start:{"claim":true}', 'goOnline — claim 으로 한 번만');
    e.fireState('ready');
    chk(e.lost() === 0, '  ↳ 다른 상태는 밀려남이 아님');
    e.fireState('sessionLost');
    chk(e.lost() === 1, '밀려나면(4004) onSessionLost');
    e.flow.continueHere();
    chk(e.rtLog.length === 2 && e.rtLog[1] === 'start:{"claim":true}', '«여기서 계속» — 다시 claim');
  }

  say('── 3. 로컬 모드');
  {
    const e = mkEnv(S);
    e.srv.me = () => { throw apiErr('unavailable', 'NETWORK'); };
    const back = [];
    e.flow.enterLocal((r) => back.push(r.state));
    chk(e.flow.mode() === 'local', 'mode local');
    await e.advance(14999);
    chk(e.log.length === 0, '15초 전엔 묻지 않음');
    await e.advance(1);
    chk(e.log.length === 1 && e.rtLog.length === 0, '15초에 한 번 · 아직 닿지 않으면 realtime 안 켬');
    await e.advance(29999);
    chk(e.log.length === 1, '  ↳ 다음은 30초 뒤');
    e.srv.me = () => ME(2);
    await e.advance(1);
    chk(e.log.length === 2 && back.join() === 'in' && e.rtLog.join() === 'start:{"claim":true}' && e.flow.mode() === 'in', '서버가 답하면 realtime 켜고 알림');
    await e.advance(600000);
    chk(e.log.length === 2, '  ↳ 그 뒤로는 묻지 않음');
  }

  say('── 4. 로그인');
  {
    const e = mkEnv(S, { gWin: () => ({ ok: false, reason: '로그인이 취소됐어요' }) });
    const r = await e.flow.loginGoogle();
    chk(!r.ok && r.canceled === true && e.authLog.length === 0, '구글 창 닫음 — 조용히(canceled)');
    const e1 = mkEnv(S, { gWin: () => ({ ok: false, reason: '구글이 막음' }) });
    const r1 = await e1.flow.loginGoogle();
    chk(!r1.ok && !r1.canceled && r1.reason === '구글이 막음', '  ↳ 구글이 막은 까닭은 숨기지 않음');
    const e2 = mkEnv(S, { gFail: true });
    chk(!(await e2.flow.loginGoogle()).ok, 'Auth 실패 → 실패');
    const e3 = mkEnv(S, { user: null });
    const r3 = await e3.flow.loginGoogle();
    chk(r3.ok && r3.state === 'in' && e3.authLog.join() === 'g:gtok' && r3.email === 'a@b.c', '구글 로그인 → 계정 있음 → in');
    const e4 = mkEnv(S, { user: null, me: () => { throw apiErr('auth', 'USER_CODE_NOT_BOUND'); } });
    const r4 = await e4.flow.loginGoogle();
    chk(!r4.ok && r4.state === 'signup' && e4.authLog.indexOf('out') < 0, '  ↳ 가입 전 → signup(구글 로그인은 둠 — 초대 코드로 이어서 가입)');
    const e5 = mkEnv(S, { user: null });
    const r5 = await e5.flow.loginPassword('MATE-AB12', 'pw1234');
    chk(r5.ok && e5.authLog[0] === 'p:MATE-AB12:pw1234', '친구코드 로그인 → in');
    const e6 = mkEnv(S, { user: null, me: () => { throw apiErr('auth', 'USER_CODE_NOT_BOUND'); } });
    const r6 = await e6.flow.loginPassword('MATE-AB12', 'pw1234');
    chk(!r6.ok && e6.authLog.indexOf('out') >= 0, '  ↳ 그 로그인의 계정이 없으면 로그인을 놓는다');
  }

  say('── 5. 가입');
  {
    let down = true;
    const e = mkEnv(S, { user: null });
    e.srv.joinPwAns = () => { if(down) throw apiErr('unavailable', 'NETWORK'); return ME(1, { friendCode: 'MATE-NEW1' }); };
    const a = await e.flow.joinPassword({ inviteCode: 'INVT-A', password: 'pw1234' });
    const b = await e.flow.joinPassword({ inviteCode: 'INVT-A', password: 'pw1234' });
    chk(!a.ok && !b.ok && e.srv.joinPw[0].requestId === e.srv.joinPw[1].requestId, '닿지 못해 다시 누르면 같은 요청 번호(두 계정이 생기지 않게)');
    const c = await e.flow.joinPassword({ inviteCode: 'INVT-A', password: 'pw5678' });
    chk(!c.ok && e.srv.joinPw[2].requestId !== e.srv.joinPw[0].requestId, '  ↳ 비밀번호를 바꿔 누르면 새 요청');
    e.srv.joinPwAns = () => { throw apiErr('request', 'INVITE_NOT_USABLE'); };
    const d = await e.flow.joinPassword({ inviteCode: 'INVT-A', password: 'pw1234' });
    e.srv.joinPwAns = () => ME(1, { friendCode: 'MATE-NEW1' });
    await e.flow.joinPassword({ inviteCode: 'INVT-A', password: 'pw1234' });
    chk(!d.ok && /초대/.test(d.reason) && e.srv.joinPw[4].requestId !== e.srv.joinPw[3].requestId, '서버가 거절하면 문구 · 다음은 새 요청');
    chk(e.authLog[e.authLog.length - 1] === 'p:MATE-NEW1:pw1234', '받은 친구코드 + 비밀번호로 로그인');
    let pf = true;
    const e2 = mkEnv(S, { user: null, pFail: () => pf });
    const f1 = await e2.flow.joinPassword({ inviteCode: null, password: 'pw1234' });
    pf = false;
    const f2 = await e2.flow.joinPassword({ inviteCode: null, password: 'pw1234' });
    chk(!f1.ok && f1.joined === true && f2.ok && e2.srv.joinPw[0].requestId === e2.srv.joinPw[1].requestId && !('inviteCode' in e2.srv.joinPw[0] && e2.srv.joinPw[0].inviteCode),
      '로그인을 못 하면 joined · 다시 누르면 같은 요청(같은 계정) · 초대 코드 없이도');
    const g1 = mkEnv(S, { user: null });
    const x1 = await g1.flow.joinGoogle({ inviteCode: 'INVT-G' });
    chk(x1.ok && x1.existing === true && g1.srv.joinG.length === 0, '구글 가입 — 이미 계정이면 그 계정(새로 안 만듦)');
    let bound = false;
    const g2 = mkEnv(S, { user: null, me: () => { if(!bound) throw apiErr('auth', 'USER_CODE_NOT_BOUND'); return ME(1); } });
    g2.srv.joinGAns = (b) => { bound = true; return ME(1); };
    const x2 = await g2.flow.joinGoogle({ inviteCode: 'INVT-G' });
    chk(x2.ok && !x2.existing && g2.srv.joinG[0].inviteCode === 'INVT-G' && g2.store.has('tw.me'), '  ↳ 가입 전이면 초대 코드로 가입 · 사본');
    const g3 = mkEnv(S, { user: null, me: () => { if(!bound2) throw apiErr('auth', 'USER_CODE_NOT_BOUND'); return ME(1); } });
    let bound2 = false;
    g3.srv.joinGAns = () => { bound2 = true; throw apiErr('request', 'USER_ALREADY_JOINED'); };
    const x3 = await g3.flow.joinGoogle({ inviteCode: 'INVT-G' });
    chk(x3.ok && x3.existing === true, '  ↳ 이미 가입(USER_ALREADY_JOINED)이면 그 계정');
    const g4 = mkEnv(S, { user: null, me: () => { throw apiErr('auth', 'USER_CODE_NOT_BOUND'); } });
    g4.srv.joinGAns = () => { throw apiErr('request', 'USER_INVITE_REQUIRED'); };
    const x4 = await g4.flow.joinGoogle({});
    chk(!x4.ok && /초대/.test(x4.reason), '  ↳ 초대 코드가 필요하면 문구');
  }

  say('── 6. 내 계정 고치기');
  {
    const e = mkEnv(S);
    await e.flow.confirm();
    const r = await e.flow.patchMe({ displayName: '새이름' });
    chk(r.ok && e.srv.updates[0].version === 1 && e.srv.updates[0].displayName === '새이름' && JSON.parse(e.store.get('tw.me')).me.version === 2, '사본 version 으로 보냄 · 답으로 사본 갱신');
    let first = true;
    e.srv.update = (b) => { if(first){ first = false; throw apiErr('request', 'CONCURRENT_UPDATE'); } return ME(b.version + 1); };
    e.srv.me = () => ME(7);
    const r2 = await e.flow.patchMe({ presencePref: { locked: true, online: false } });
    chk(r2.ok && e.srv.updates[2].version === 7 && e.srv.updates[2].presencePref.locked === true, '다른 곳이 먼저 바꿨으면 다시 받아 그 version 으로 한 번 더');
    e.srv.update = () => { throw apiErr('request', 'USER_RESERVED_NAME'); };
    const r3 = await e.flow.patchMe({ displayName: '관리자' });
    chk(!r3.ok && r3.err.code === 'USER_RESERVED_NAME' && e.srv.updates.length === 4, '그 밖 실패 → ok:false(다시 안 보냄)');
  }

  say('── 7. 로그아웃 · 프리미엄 유예');
  {
    const e = mkEnv(S);
    await e.flow.confirm();
    chk(e.flow.premiumNow() === true, '방금 받은 프리미엄 — 유예 안');
    e.clock.t += 3600 * 1000 + 1;
    chk(e.flow.premiumNow() === false, '유예(premiumGraceSec)가 지나면 아님');
    chk(e.LF.premiumNow({ me: ME(1, { premium: false }), at: 0 }, 0) === false, '프리미엄이 아니면 아님');
    e.flow.goOnline();
    await e.flow.logout();
    chk(e.rtLog.join() === 'start:{"claim":true},stop,forget' && e.authLog.join() === 'out' && !e.store.has('tw.me') && e.flow.mode() === 'off', '로그아웃 — realtime 끔(안 끄면 토큰 없이 끝없이 다시 붙음) · API 로그인 읽기 뗌 · 로그인 놓음 · 사본 지움');
  }

  say('── 8. 배선');
  {
    const H = S.HTML;
    const i = (f) => H.indexOf('<script src="parts/' + f + '"></script>');
    const iLF = i('account/login-flow.js');
    chk(iLF > i('account/user-api.js') && iLF > i('shared/api-errors.js') && iLF > i('realtime/rt-hub.js') && i('account/user-api.js') > 0 && H.indexOf('<script src="parts/app.js"') > iLF,
      'html — user-api · api-errors · rt-hub 다음 · app.js 앞');
  }
}

(async () => {
await judge(SRC0);

say('── 9. 일부러 깨 보기');
const BREAKS = [
  ['LF', "    if(!u || u.anonymous) return { state: STATE.LOGIN, me: null };", "    if(!u) return { state: STATE.LOGIN, me: null };", '익명 세션을 로그인으로 봄'],
  ['LF', "    if(!o || !o.me || typeof o.at !== 'number' || !u || o.authUid !== u.uid) return null;", "    if(!o || !o.me) return null;", '남의 로그인 사본을 읽음'],
  ['LF', "      if(t.action === 'signup'){ clearCache(); return { state: STATE.SIGNUP, me: null }; }", "      if(t.action === 'signup'){ return { state: STATE.SIGNUP, me: null }; }", '탈퇴한 계정 사본을 남김'],
  ['LF', "      if(t.action === 'login') return { state: STATE.LOGIN, me: null, reason: deps.reasonOf(e) };", "", '끝난 토큰을 로컬 모드로'],
  ['LF', "    if(online) return;\n    online = true;", "", 'realtime 을 두 번 켬'],
  ['LF', "      deps.rt.onState((s) => { if(s === 'sessionLost') deps.onSessionLost(); });", "", '밀려남을 화면에 안 알림'],
  ['LF', "        if(r.state === STATE.LOCAL){ next(); return; }", "        if(r.state === STATE.LOCAL) return;", '로컬 모드에서 한 번만 묻고 끝'],
  ['LF', "        if(r.state === STATE.IN) goOnline();", "", '돌아와도 realtime 안 켬'],
  ['LF', "      if(e && e.kind !== 'unavailable') deps.pending.settle(key);", "      deps.pending.settle(key);", '닿지 못한 가입을 새 요청으로(두 계정)'],
  ['LF', "      if(e && e.kind !== 'unavailable') deps.pending.settle(key);", "", '거절된 가입을 같은 요청으로'],
  ['LF', "    const a = await auth.signInPassword(me.friendCode, o.password);", "    const a = await auth.signInPassword('MATE-0000', o.password);", '받은 친구코드로 로그인 안 함'],
  ['LF', "    if(c.state === STATE.SIGNUP){ try{ await auth.signOut(); }catch(_){} return", "    if(c.state === STATE.SIGNUP){ return", '계정 없는 로그인을 남김'],
  ['LF', "        if(!(e && e.code === 'CONCURRENT_UPDATE')) throw e;", "        throw e;", '먼저 바뀌면 그냥 실패'],
  ['LF', "    try{ deps.rt.stop(); }catch(_){}   // 안 끄면 토큰 없이 끝없이 다시 붙는다\n", "", '로그아웃에 realtime 안 끔'],
  ['LF', "    try{ deps.forgetSession(); }catch(_){}", "", '로그아웃에 API 로그인 읽기를 안 뗌'],
  ['LF', "  return (now - cache.at) <= cache.me.premiumGraceSec * 1000;", "  return true;", '유예가 끝없음'],
  ['LF', "  return 'join:' + String(inviteCode || '') + ':' + h.toString(36);", "  return 'join:' + String(inviteCode || '');", '비밀번호를 바꿔도 같은 요청'],
  ['HTML', '<script src="parts/account/login-flow.js"></script>', '', 'html 에 안 실음'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ await judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
