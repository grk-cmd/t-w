/* sim-login-flow.js — 🔑 로그인 흐름(account/login-flow.js) 검사 — 가짜 서버(user-api 자리) · 가짜 Auth · 가짜 realtime · 가짜 시계로 그대로 돌린다
   진짜로 쓰는 것: api-errors.js(오류 → 할 일) · request-id.js(같은 일 다시 보내기 번호) · user-api.js(문구 표)
   ・1절: 판정 — 로그인 없음 · 익명은 login · 계정 있으면 in(사본은 로그인과 묶어 적음) · 가입 전은 signup(사본 지움) ·
          닿지 못함은 local(me 는 늘 null — 로컬 모드 없음) · 토큰 끝남은 login · 모양이 틀린 답은 local
   ・2절: realtime — goOnline 은 늘 rt.start(켜져 있으면 허브가 아무 일도 안 함 · 끊겼으면 다시) · 끊기면 onSessionLost(까닭)
   ・3절: 서버에 닿지 못한 화면 — waitForServer(claim 으로 realtime) · ready 신호 / retryNow 가 한 번 묻고 · 닿으면 알림 한 번(같은 연결 유지) · 타이머 없음 · 429 는 limited
   ・4절: 로그인 — 구글 창 닫음은 조용히 · Auth 실패 문구 · 계정 있음 · 가입 전 · 친구코드 로그인에서 계정이 없으면 로그인을 놓음
   ・5절: 가입 — 비밀번호: 닿지 못해 다시 누르면 같은 요청 번호 · 서버가 거절하면 새 번호 · 비밀번호를 바꾸면 새 번호 · 받은 친구코드로 로그인 ·
          로그인을 못 하면 joined(번호 유지) · 구글: 이미 계정 · 가입 전이면 초대 코드로 가입 · 이미 가입(USER_ALREADY_JOINED)은 그 계정
   ・6절: 내 계정 고치기 — 사본 version · 다른 곳이 먼저 바꿨으면 다시 받아 한 번 더 · 그 밖 실패는 ok:false
   ・7절: 로그아웃 · 프리미엄 유예 — realtime 끔 · API 로그인 읽기 뗌 · 로그인 놓음 · 사본 지움 · 유예 안 · 밖
   ・8절: 배선 — html 차례(user-api · api-errors · rt-hub 다음 · app.js 앞)
   ・8-2절: 저장된 로그인 복원 기다림 — 첫 답이 8초를 넘겨도 login 이 아님 · 60초 넘기면 local(restoring) · 로그인 둠 ·
            다시 시도는 다시 기다림 · 늦게 온 첫 답에 혼자 이어 감 · Firebase 가 «사용자 없음» 이면 login · 저장된 로그인 없으면 그대로
   ・9절: mutation test */
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
const load = (src, later) => { const m = { exports: {} }; new Function('module', 'window', 'setTimeout', src)(m, undefined, later || setTimeout); return m.exports; };
const tick = async () => { for(let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };

const ME = (v, extra) => Object.assign({ userCode: 'u1234567890', friendCode: 'MATE-AB12', displayName: '나', presencePref: { locked: false, online: true },
  hasPasswordLogin: true, admin: false, premium: true, version: v || 1 }, extra || {});
const apiErr = (kind, code) => Object.assign(new Error(code), { kind, code });

function mkEnv(S, o){
  const clock = { t: 1_800_000_000_000, q: [] };
  /* 모듈의 setTimeout(방 나가기 기다림 상한)도 가짜 시계로 — 진짜로 기다리면 mutation test 마다 1.5초씩 든다 */
  const LF = load(S.LF, (fn, ms) => { clock.q.push({ at: clock.t + ms, fn }); return 0; }), UA = load(S.UA), AE = load(S.AE), RI = load(S.RI);
  const opt = o || {};
  const log = [];
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
  /* 복원 대기선 흉내 — opt.restoring 이면 켤 때 저장된 로그인이 있고 첫 답은 answer() 가 온다(시계 clock.q 위의 상한) */
  const bar = { restoring: !!opt.restoring, onAns: [], answers: 0, waits: [] };
  const answer = (u) => { if(!bar.restoring) return; user = u; bar.restoring = false; bar.answers++; const l = bar.onAns.splice(0); l.forEach((f) => f()); };
  const auth = {
    ready: async () => {},
    user: () => user,
    restoring: () => bar.restoring,
    answered: (ms) => {
      if(!bar.restoring) return Promise.resolve(true);
      bar.waits.push(ms == null ? 'inf' : ms);
      return new Promise((res) => { bar.onAns.push(() => res(true)); if(ms != null) clock.q.push({ at: clock.t + ms, fn: () => res(false) }); });
    },
    signInGoogle: async (tok) => { authLog.push('g:' + tok); if(opt.gFail) return { ok: false, reason: '구글 실패' }; user = { uid: opt.gUid || 'authG', anonymous: false }; return { ok: true, uid: user.uid, fresh: !!opt.gFresh, email: 'a@b.c' }; },
    deleteNewLogin: async (uid) => { authLog.push('del:' + uid); if(opt.delFail || !user || user.uid !== uid) return { ok: false }; user = null; return { ok: true }; },
    signInPassword: async (code, pw) => { authLog.push('p:' + code + ':' + pw); if(opt.pFail && opt.pFail()) return { ok: false, reason: '비번 틀림' }; user = { uid: opt.pUid || 'auth1', anonymous: false }; return { ok: true }; },
    signOut: async () => { authLog.push('out'); user = null; },
  };
  const rtLog = []; let stateFn = null;
  /* 서버 흉내 — otherSession 이면 등록 전 세션이라 claim 과 상관없이 4004(sessionLost)로 끊는다(자리는 등록이 정하고 realtime 은 claim 을 보지 않는다) */
  const rt = { start: (x) => { rtLog.push('start:' + JSON.stringify(x)); if(opt.otherSession && stateFn) stateFn('sessionLost'); }, stop: () => rtLog.push('stop'), isDeviceOff: (s) => s === 'sessionLost' || s === 'deviceRemoved',
    bye: async (why) => { rtLog.push('bye:' + why); await tick(); rtLog.push('closed'); }, onState: (fn) => { stateFn = fn; return () => {}; } };
  /* 방 나가기 흉내 — leave 를 보내고 left 를 기다렸다 풀린다(방 밖이면 바로) */
  const leaveRoom = opt.leaveHang ? () => { rtLog.push('leave'); return new Promise(() => {}); }   // 오프라인 — 방 나가기 쓰기가 끝나지 않음
    : async () => { rtLog.push('leave'); await tick(); rtLog.push('left'); };
  let lost = 0; const lostKinds = []; const confirmed = [];
  const ids = RI.createPending();
  const flow = LF.createLoginFlow({
    userApi, translate: AE.translate, reasonOf: UA.reasonOf, auth,
    googleWindow: async () => (opt.gWin ? opt.gWin() : { ok: true, idToken: 'gtok' }),
    rt, leaveRoom, pending: ids, storage, onSessionLost: (k) => { lost++; lostKinds.push(k); }, forgetSession: () => { rtLog.push('forget'); },
    now: () => clock.t,
    onConfirmed: (r, info) => { confirmed.push([r.state, info.restore]); },
  });
  const advance = async (ms) => {
    const end = clock.t + ms;
    for(;;){ await tick(); clock.q.sort((a, b) => a.at - b.at); const h = clock.q[0]; if(!h || h.at > end) break; clock.t = h.at; clock.q.shift(); h.fn(); }
    clock.t = end; await tick();
  };
  return { LF, flow, srv, store, storage, authLog, rtLog, log, clock, advance, lost: () => lost, lostKinds, fireState: (s) => stateFn && stateFn(s),
    setUser: (u) => { user = u; }, answer, bar, user: () => user, confirmed };
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
    chk(r3.state === 'local' && r3.me === null && /연결/.test(r3.reason) && r3.limited === false, '닿지 못함 → local · me 없음(마지막 사본을 주지 않는다)');
    e3.setUser({ uid: 'auth2', anonymous: false });
    const r4 = await e3.flow.confirm();
    chk(r4.state === 'local' && r4.me === null, '  ↳ 로그인이 바뀌어도 사본을 주지 않는다');
    e3.srv.me = () => { throw apiErr('unavailable', 'SERVER_ADMIN_ONLY'); };
    chk((await e3.flow.confirm()).state === 'local', '  ↳ 점검(503 SERVER_ADMIN_ONLY)도 local');
    e3.srv.me = () => { throw apiErr('auth', 'AUTH_REQUIRED'); };
    chk((await e3.flow.confirm()).state === 'login', '토큰이 끝남(AUTH_REQUIRED) → login');
    e3.srv.me = () => { throw Object.assign(apiErr('request', 'TOO_MANY_REQUESTS'), { status: 429 }); };
    const r429 = await e3.flow.confirm();
    chk(r429.state === 'local' && r429.limited === true, '  ↳ 429 는 local · limited(화면이 문구로 알린다)');
    e3.srv.me = () => null;
    chk((await e3.flow.confirm()).state === 'local', '모양이 틀린 답 → local(믿지 않음)');
  }

  say('── 1-2. 첫 confirm 의 약속(firstConfirm)은 없다 — 확인의 me 는 «들어감» 알림(app-boot)으로 전해진다');
  {
    const e = mkEnv(S);
    chk(!('firstConfirm' in e.flow), '★ 내놓는 것에 firstConfirm 이 없다(접속 고정은 확인의 me 를 그대로 받는다 — 지난 사본 · 따로 기다림 없음)');
  }

  say('── 2. realtime');
  {
    const e = mkEnv(S);
    e.flow.goOnline(); e.flow.goOnline();
    chk(e.rtLog.join() === 'start:{"claim":true},start:{"claim":true}' && e.flow.mode() === 'in', 'goOnline — 부를 때마다 rt.start(켜져 있으면 허브가 무시 · 기다리는 동안 켠 연결이 끊겼으면 다시 켠다)');
    e.fireState('ready');
    chk(e.lost() === 0, '  ↳ 다른 상태는 밀려남이 아님');
    e.fireState('sessionLost');
    chk(e.lost() === 1 && e.lostKinds[0] === 'sessionLost', '이 PC 의 새 세션에 밀리면(4004) onSessionLost(sessionLost)');
    e.fireState('deviceRemoved');
    chk(e.lost() === 2 && e.lostKinds[1] === 'deviceRemoved', '★ 다른 PC 가 이 기기를 지우면(4004 deviceRemoved) onSessionLost(deviceRemoved) — 안내 화면이 까닭을 가른다');
  }

  say('── 3. 서버에 닿지 못한 화면 (waitForServer · retryNow)');
  {
    const e = mkEnv(S);
    e.srv.me = () => { throw apiErr('unavailable', 'NETWORK'); };
    const back = [];
    e.flow.waitForServer((r) => back.push(r.state));
    chk(e.rtLog.join() === 'start:{"claim":true}' && e.log.length === 0, 'realtime 을 claim 으로 켜 둔다(앱을 켠 것 — 다시 붙는 신호를 받으려고) · 요청 0');
    await e.advance(3600000);
    chk(e.log.length === 0 && back.length === 0, '★ 시간이 아무리 지나도 혼자 묻지 않는다(타이머 없음)');
    e.fireState('retrying'); e.fireState('connecting'); await tick(); await tick();
    chk(e.log.length === 0, '  ↳ ready 가 아닌 상태 신호로는 묻지 않는다');
    e.fireState('ready'); await tick(); await tick();
    chk(e.log.length === 1 && back.length === 0 && e.rtLog.length === 1, '★ ready 신호 → 한 번 묻는다 · 아직 닿지 않으면 그대로(알림 없음 · 연결 그대로)');
    let release; e.srv.me = () => new Promise((r) => { release = r; });
    const p1 = e.flow.retryNow(); const p2 = e.flow.retryNow(); e.fireState('ready'); await tick();
    chk((await p2) === null && e.log.length === 2, '  ↳ 묻는 중에 또 눌러도 · ready 가 와도 한 번');
    release(ME(2)); const r1 = await p1; await tick();
    chk(r1.state === 'in' && back.join() === 'in' && e.rtLog.join() === 'start:{"claim":true},stop' && e.flow.mode() === 'in', '★ 닿으면 알림 한 번 · 기다리며 켠 연결은 끈다(등록 뒤 app-boot 의 goOnline 이 새로 켠다)');
    e.fireState('ready'); await tick();
    chk(e.log.length === 2, '  ↳ 그 뒤 ready 로는 묻지 않는다(기다리는 화면이 아님)');
    const f = mkEnv(S);
    f.srv.me = () => { throw apiErr('unavailable', 'NETWORK'); };
    const bf = []; f.flow.waitForServer((r) => bf.push(r.state));
    const rf = await f.flow.retryNow();
    chk(rf.state === 'local' && bf.length === 0 && f.log.length === 1, '★ 「다시 시도」 가 또 닿지 못하면 결과(local)를 돌려준다 — 화면이 오류 번호를 한 번 띄운다 · 기다림은 그대로');
    f.srv.me = () => { throw Object.assign(apiErr('request', 'TOO_MANY_REQUESTS'), { status: 429 }); };
    chk((await f.flow.retryNow()).limited === true, '  ↳ 429 면 limited(문구로)');
    const s1 = mkEnv(S, { otherSession: true });
    s1.srv.me = () => { throw apiErr('unavailable', 'NETWORK'); };
    s1.flow.waitForServer(() => {}); await tick();
    chk(s1.lost() === 0 && s1.log.length === 1, '★ 기다리는 동안 켠 연결이 등록 전이라 4004 로 끊겨도 «서버가 답함» 으로 보고 계정을 묻는다 · 안내 화면은 안 띄운다');
    const g = mkEnv(S);
    g.srv.me = () => { throw apiErr('auth', 'USER_CODE_NOT_BOUND'); };
    const bg = []; g.flow.waitForServer((r) => bg.push(r.state));
    g.fireState('ready'); await tick(); await tick();
    chk(bg.join() === 'signup' && g.rtLog.join() === 'start:{"claim":true},stop', '  ↳ 돌아와 보니 계정이 없으면(signup) 알리고 켜 둔 연결을 끈다');
    const h = mkEnv(S);
    h.srv.me = () => { throw apiErr('unavailable', 'NETWORK'); };
    h.flow.waitForServer(() => {}); h.fireState('deviceRemoved'); await tick(); await tick();
    chk(h.lost() === 0 && h.log.length === 1, '  ↳ 기다리는 화면 동안의 4004(deviceRemoved 도)는 안내 화면이 아니라 계정 다시 묻기');
    const k = mkEnv(S);
    k.srv.me = () => { throw apiErr('unavailable', 'NETWORK'); };
    let backK = null; k.flow.waitForServer((r) => { backK = r.state; });
    k.srv.me = () => ME(2);
    k.fireState('ready'); await tick(); await tick(); await tick();
    chk(backK === 'in' && k.rtLog.join() === 'start:{"claim":true},stop', '★ 닿으면(in) 기다리며 켠 연결을 끈다 — 등록 전 세션으로 다시 붙지 않게(등록 뒤 app-boot 의 goOnline 이 켠다)');
    k.fireState('sessionLost'); k.fireState('deviceRemoved');
    chk(k.lost() === 0, '★ IN 뒤 · goOnline 전 4004 → 안내 화면 0번(등록 전 세션의 끊김은 안내할 일이 아니다)');
    k.flow.goOnline();
    chk(k.rtLog.join() === 'start:{"claim":true},stop,start:{"claim":true}', '  ↳ 등록 뒤 goOnline 이 realtime 을 새로 켠다');
    k.fireState('deviceRemoved');
    chk(k.lost() === 1, '  ↳ goOnline 뒤의 4004 는 안내 화면');
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
    chk(!r4.ok && r4.state === 'signup' && e4.authLog.join() === 'g:gtok,out', '★ 가입 전 → signup · 구글 로그인은 놓는다(껐다 켜도 켤 때 signup 으로 이 PC 몫이 지워지지 않게)');
    const e4b = mkEnv(S, { user: null, me: () => { throw apiErr('auth', 'USER_CODE_NOT_BOUND'); } });
    const rj = await e4b.flow.joinGoogle({ inviteCode: 'ABC' });
    chk(rj.ok && e4b.srv.joinG.length === 1 && e4b.authLog.join() === 'g:gtok', '  ↳ 가입으로 이어 가는 joinGoogle 은 그 로그인을 쓴다(구글 창을 다시 거쳐 POST /v2/users)');
    const e4c = mkEnv(S, { user: null, me: () => { throw apiErr('auth', 'USER_CODE_NOT_BOUND'); } }); e4c.srv.joinGAns = () => { throw Object.assign(new Error('x'), { kind: 'request', code: 'INVITE_INVALID' }); };
    const rj2 = await e4c.flow.joinGoogle({ inviteCode: 'BAD' });
    chk(!rj2.ok && e4c.authLog.join() === 'g:gtok,out', '  ↳ 가입이 거절되면 계정 없는 로그인을 남기지 않는다')
    /* 가입 안 된 구글을 눌러 보기만 해도 Auth 에 그 구글만 붙은 사용자가 남으면, 나중에 친구 코드 계정에 «구글 연결» 이 막힌다 */
    const NB = () => { throw apiErr('auth', 'USER_CODE_NOT_BOUND'); };
    const f1 = mkEnv(S, { user: null, gFresh: true, me: NB });
    const q1 = await f1.flow.loginGoogle();
    chk(!q1.ok && q1.state === 'signup' && f1.authLog.join() === 'g:gtok,del:authG' && f1.user() === null, '★ 방금 생긴 구글 로그인(fresh) · 계정 없음 → Auth 사용자를 지운다(그 구글을 다시 연결할 수 있게)');
    const f2 = mkEnv(S, { user: null, gFresh: false, me: NB });
    await f2.flow.loginGoogle();
    chk(f2.authLog.join() === 'g:gtok,out', '  ↳ 원래 있던 Auth 사용자는 지우지 않고 로그아웃만(서버가 아직 모르는 주인일 수 있다)');
    const f3 = mkEnv(S, { user: null, gFresh: true, delFail: true, me: NB });
    await f3.flow.loginGoogle();
    chk(f3.authLog.join() === 'g:gtok,del:authG,out' && f3.user() === null, '  ↳ 지우기가 실패하면 로그아웃은 한다');
    const f4 = mkEnv(S, { user: null, gFresh: true });
    const q4 = await f4.flow.loginGoogle();
    chk(q4.ok && f4.authLog.join() === 'g:gtok', '  ↳ 계정이 있으면(in) 지우지 않는다');
    const f5 = mkEnv(S, { user: null, gFresh: true, me: NB });
    const q5 = await f5.flow.joinGoogle({ inviteCode: 'ABC' });
    chk(q5.ok && f5.authLog.join() === 'g:gtok', '  ↳ 가입으로 이어 가면(joinGoogle) 그 로그인을 지우지 않는다');
    const f6 = mkEnv(S, { user: null, gFresh: true, me: NB }); f6.srv.joinGAns = () => { throw Object.assign(new Error('x'), { kind: 'request', code: 'INVITE_INVALID' }); };
    await f6.flow.joinGoogle({ inviteCode: 'BAD' });
    chk(f6.authLog.join() === 'g:gtok,del:authG', '  ↳ 구글 가입이 거절되면 방금 생긴 로그인을 지운다');
    /* 서버가 가입을 받았을 수 있는 갈래 — 지우면 그 uid 의 서버 계정에 다시 못 들어간다. 로그아웃만(다시 누르면 같은 uid → USER_ALREADY_JOINED) */
    const f7 = mkEnv(S, { user: null, gFresh: true, me: NB }); f7.srv.joinGAns = () => { throw apiErr('unavailable', 'NETWORK'); };
    await f7.flow.joinGoogle({ inviteCode: 'ABC' });
    chk(f7.authLog.join() === 'g:gtok,out', '★ 구글 가입 답을 못 받음(unavailable) → 지우지 않고 로그아웃만');
    const f8 = mkEnv(S, { user: null, gFresh: true, me: NB }); f8.srv.joinGAns = () => { throw apiErr('request', 'USER_ALREADY_JOINED'); };
    await f8.flow.joinGoogle({ inviteCode: 'ABC' });
    chk(f8.authLog.join() === 'g:gtok,out', '  ↳ 이미 가입(USER_ALREADY_JOINED)인데 확인이 안 됨 → 지우지 않음');
    const f9 = mkEnv(S, { user: null, gFresh: true, me: NB }); f9.srv.joinGAns = () => null;
    await f9.flow.joinGoogle({ inviteCode: 'ABC' });
    chk(f9.authLog.join() === 'g:gtok,out', '  ↳ 답 모양이 다름 → 지우지 않음');
    const f10 = mkEnv(S, { user: null, gFresh: true, me: NB }); f10.srv.joinGAns = () => { throw new Error('모르는 오류'); };
    await f10.flow.joinGoogle({ inviteCode: 'ABC' });
    chk(f10.authLog.join() === 'g:gtok,out', '  ↳ 서버가 거절했는지 모르는 오류(kind 없음) → 지우지 않음');
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

  say('── 7. 로그아웃 · 프리미엄 유예 없음');
  {
    const e = mkEnv(S);
    await e.flow.confirm();
    chk(!('premiumNow' in e.flow) && !('premiumNow' in e.LF), '프리미엄은 이 사본에서 읽지 않는다 — 24시간 유예를 걷었다(서버 확인 license-premium.js 만 따른다)');
    chk(!!e.flow.meCache() && e.flow.meCache().me.userCode === ME(1).userCode, '내 로그인의 사본은 읽는다(patchMe 가 version 을 읽는다)');
    e.setUser({ uid: 'authOther', anonymous: false });
    chk(e.flow.meCache() === null, '★ 다른 로그인의 사본은 읽지 않는다 — 남의 version 으로 내 계정을 고치지 않게');
    e.setUser(null);
    chk(e.flow.meCache() === null, '  로그인이 없으면 사본도 없다');
    e.setUser({ uid: 'auth1', anonymous: false });
    e.flow.goOnline();
    let outAt = null; const au = e.authLog; const push0 = au.push.bind(au);
    au.push = (x) => { if(x === 'out') outAt = e.rtLog.join(); return push0(x); };
    await e.flow.logout();
    chk(e.rtLog.join() === 'start:{"claim":true},leave,left,bye:logout,closed,forget' && e.authLog.join() === 'out' && !e.store.has('tw.me') && e.flow.mode() === 'off',
      '★ 로그아웃 차례 — 방 leave → left 기다림 → bye{logout} → 닫힘 기다림 → API 로그인 읽기 뗌 · 로그인 놓음 · 사본 지움 — ' + e.rtLog.join());
    chk(outAt && outAt.endsWith('forget'), '  ↳ 로그인은 작별 · 닫힘 뒤에 놓는다');
    e.rtLog.length = 0;
    await e.flow.logout({ why: 'withdraw' });
    chk(e.rtLog.join() === 'leave,left,bye:withdraw,closed,forget', '  ↳ 탈퇴는 bye{withdraw}');
    e.rtLog.length = 0; e.authLog.length = 0; e.setUser({ uid: 'auth1', anonymous: false });
    await e.flow.release('switch');
    chk(e.rtLog.join() === 'leave,left,bye:switch,closed' && e.authLog.length === 0 && e.flow.mode() === 'off', 'release(switch) — 계정 바꾸기: 방 leave → bye{switch} · 로그인은 그대로(새 계정)');
  }
  {
    const e = mkEnv(S, { leaveHang: true });
    e.flow.goOnline(); e.rtLog.length = 0;
    let done = false; e.flow.logout().then(() => { done = true; });
    await e.advance(1499);
    const early = done;
    await e.advance(1); await tick();
    chk(!early && done && e.rtLog.join() === 'leave,bye:logout,closed,forget' && e.authLog.join() === 'out',
      '★ 방 나가기가 끝나지 않아도(오프라인) 상한 뒤 작별 · 로그인 놓기까지 간다 — ' + e.rtLog.join());
  }

  say('── 8-2. 저장된 로그인 복원 기다림');
  {
    const U = { uid: 'auth1', anonymous: false };
    /* 8초 대기선(ready)이 풀린 뒤에도 첫 답이 없다 — user() 는 아직 null */
    const a = mkEnv(S, { user: null, restoring: true });
    const waits = [];
    let pa = a.flow.confirm({ onRestoreWait: () => waits.push(a.clock.t) }), ra = null; pa.then((r) => { ra = r; });
    await a.advance(20000);
    chk(ra === null && waits.length === 1 && a.log.length === 0, '★ 저장된 로그인 + 첫 답이 8초를 넘김 → login 으로 끝내지 않고 기다린다(기다림 알림 한 번 · 요청 0)');
    a.answer(U); await tick();
    chk(ra && ra.state === 'in' && a.log.length === 1, '  ↳ 20초에 첫 답(사용자 있음) → 서버에 묻고 in');
    chk(a.confirmed[0] && a.confirmed[0][1] && a.confirmed[0][1].ok === true && a.confirmed[0][1].ms === 20000, '  ↳ 진단에 복원 기다림 { ok, ms } 를 넘긴다');
    chk(JSON.stringify(a.bar.waits) === JSON.stringify([a.LF.RESTORE_WAIT_MS]) && a.LF.RESTORE_WAIT_MS === 60000, '  ↳ 기다림 상한은 60초');

    const b = mkEnv(S, { user: null, restoring: true });
    let rb = null; b.flow.confirm().then((r) => { rb = r; });
    await b.advance(59999);
    chk(rb === null, '  ↳ 59.999초까지는 답하지 않는다');
    await b.advance(1);
    chk(rb && rb.state === 'local' && rb.restoring === true && rb.me === null && b.log.length === 0 && b.authLog.length === 0,
      '★ 60초 답 없음 → local(restoring) — 로그인 화면이 아니라 기다리는 화면 · 로그인을 놓지 않음(signOut 0) · 요청 0');
    chk(b.confirmed[0] && b.confirmed[0][1] && b.confirmed[0][1].ok === false, '  ↳ 진단에 «답 없음» 을 넘긴다');
    const backB = []; b.flow.waitForServer((r) => backB.push(r.state));
    let rr = null; b.flow.retryNow().then((r) => { rr = r; });
    await b.advance(30000);
    chk(rr === null && b.bar.waits.filter((w) => w === 60000).length === 2, '★ [다시 시도] 는 첫 답을 다시 기다린다(상한 60초)');
    b.answer(U); await tick(); await tick();
    chk(rr && rr.state === 'in' && backB.join() === 'in' && b.log.length === 1, '  ↳ 기다리던 중 첫 답이 오면 in · 화면에 한 번 알림');

    const c = mkEnv(S, { user: null, restoring: true });
    let rc = null; c.flow.confirm().then((r) => { rc = r; });
    await c.advance(60000);
    const backC = []; c.flow.waitForServer((r) => backC.push(r.state));
    chk(c.bar.waits.includes('inf'), '★ 시간 초과 뒤 기다리는 화면은 첫 답을 상한 없이 듣는다');
    c.answer(U); await tick(); await tick(); await tick();
    chk(rc.state === 'local' && backC.join() === 'in' && c.log.length === 1, '  ↳ 누르지 않아도 늦게 온 첫 답에 한 번 묻고 이어 간다');

    const d = mkEnv(S, { user: null, restoring: true });
    let rd = null; d.flow.confirm().then((r) => { rd = r; });
    await d.advance(15000);
    d.answer(null); await tick();
    chk(rd && rd.state === 'login' && d.log.length === 0, '★ Firebase 가 «사용자 없음» 으로 답함(저장된 로그인을 지움) → login(진짜 로그아웃)');

    const e = mkEnv(S, { user: null });
    const we = [];
    chk((await e.flow.confirm({ onRestoreWait: () => we.push(1) })).state === 'login' && we.length === 0 && e.bar.waits.length === 0,
      '★ 저장된 로그인이 없으면 그대로 — 바로 login · 기다림 없음');
    const f = mkEnv(S);
    f.srv.me = () => { throw apiErr('unavailable', 'NETWORK'); };
    f.flow.waitForServer(() => {}); await tick();
    chk(f.bar.waits.length === 0 && f.log.length === 0, '  ↳ 보통의 «닿지 못함» 화면은 첫 답을 듣지 않는다(요청이 늘지 않음)');
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

say('── 9. mutation test');
const BREAKS = [
  ['LF', "    if(!u || u.anonymous) return { state: STATE.LOGIN, me: null };", "    if(!u) return { state: STATE.LOGIN, me: null };", '익명 세션을 로그인으로 봄'],
  ['LF', "    if(!o || !o.me || typeof o.at !== 'number' || !u || o.authUid !== u.uid) return null;", "    if(!o || !o.me) return null;", '남의 로그인 사본을 읽음'],
  ['LF', "      if(t.action === 'signup'){ clearCache(); return { state: STATE.SIGNUP, me: null }; }", "      if(t.action === 'signup'){ return { state: STATE.SIGNUP, me: null }; }", '탈퇴한 계정 사본을 남김'],
  ['LF', "      if(t.action === 'login') return { state: STATE.LOGIN, me: null, reason: deps.reasonOf(e) };", "", '끝난 토큰을 로컬 모드로'],
  ['LF', "    online = true;\n    deps.rt.start({ claim: true });\n  }", "    if(online) return;\n    online = true;\n    deps.rt.start({ claim: true });\n  }", '켜 둔 연결이 끊긴 뒤 goOnline 이 다시 안 켬'],
  ['LF', "      else if(off && armed) deps.onSessionLost(s);", "      else if(false){ }", '밀려남을 화면에 안 알림'],
  ['LF', "      else if(off && armed) deps.onSessionLost(s);", "      else if(off && armed) deps.onSessionLost('sessionLost');", '지워짐 · 새 세션을 안 가름'],
  ['LF', "      if(off && waitBack) retryNow();\n", "", '기다리는 화면에서 등록 전 4004 를 안내 화면으로'],
  ['LF', "      else if(s === RT_READY && waitBack) retryNow();", "      else if(waitBack) retryNow();", 'ready 아닌 신호에도 묻음'],
  ['LF', "      else if(s === RT_READY && waitBack) retryNow();", "", 'realtime ready 신호가 와도 안 물음'],
  ['LF', "    if(checking) return null;\n", "", '묻는 중에 또 물음'],
  ['LF', "    if(r.state === STATE.IN){ mode = 'in'; if(rtWait){ rtWait = false; online = false; try{ deps.rt.stop(); }catch(_){} } }", "    if(r.state === STATE.IN){ goOnline(); }", '닿자마자 등록 전 세션으로 realtime 을 켬'],
  ['LF', "    if(r.state === STATE.IN){ mode = 'in'; if(rtWait){ rtWait = false; online = false; try{ deps.rt.stop(); }catch(_){} } }", "    if(r.state === STATE.IN){ mode = 'in'; rtWait = false; }", '들어간 뒤에도 기다리며 켠 연결을 그대로 둠(등록 전에 붙어 4004)'],
  ['LF', "      else if(off && armed) deps.onSessionLost(s);", "      else if(off) deps.onSessionLost(s);", 'goOnline 전 4004 도 안내 화면으로'],
  ['LF', "    if(!online){ online = true; rtWait = true; deps.rt.start({ claim: true }); }", "", '기다리는 동안 realtime 을 안 켬(신호가 안 옴)'],
  ['LF', "    else if(rtWait){ rtWait = false; online = false; try{ deps.rt.stop(); }catch(_){} }", "", '계정이 없는데 켜 둔 연결을 안 끔'],
  ['LF', "limited: !!(e && e.status === 429)", "limited: false", '429 를 못 알림'],
  ['LF', "    if(c.state === STATE.SIGNUP && !keepOnSignup) await dropGoogleLogin(a, true);", "", '가입 전 구글 로그인을 남김'],
  ['LF', "      await dropLogin(!!e && e.kind === 'request' && e.code !== 'USER_ALREADY_JOINED');   // 서버가 확실히 거절했을 때만 지운다 — 구글 가입은 요청 번호가 없어 시간 초과여도 계정이 생겼을 수 있다\n", "", '거절된 구글 가입의 로그인을 남김'],
  ['LF', "    if(canDelete && a && a.fresh && a.uid){", "    if(false){", '방금 생긴 구글 로그인을 안 지움(그 구글을 다시 연결 못 함)'],
  ['LF', "    if(canDelete && a && a.fresh && a.uid){", "    if(canDelete && a && a.uid){", '원래 있던 Auth 사용자까지 지움'],
  ['LF', "    if(canDelete && a && a.fresh && a.uid){", "    if(a && a.fresh && a.uid){", '서버가 가입을 받았을 수 있어도 지움'],
  ['LF', "e.kind === 'request' && e.code !== 'USER_ALREADY_JOINED'", "e.code !== 'USER_ALREADY_JOINED'", '답을 못 받은 구글 가입의 로그인을 지움'],
  ['LF', "e.kind === 'request' && e.code !== 'USER_ALREADY_JOINED'", "e.kind === 'request'", '이미 가입된 uid 의 로그인을 지움'],
  ['LF', "e.kind === 'request' && e.code !== 'USER_ALREADY_JOINED'", "e.kind !== 'unavailable' && e.code !== 'USER_ALREADY_JOINED'", '모르는 오류(kind 없음)에도 지움'],
  ['LF', "    if(!me){ await dropLogin(false); return", "    if(!me){ await dropLogin(true); return", '답 모양이 다른 가입의 로그인을 지움'],
  ['LF', "      if(r && r.ok) return;\n", "      return;\n", '지우기가 실패해도 로그아웃 안 함'],
  ['LF', "    if(c.state === STATE.SIGNUP && !keepOnSignup) await dropGoogleLogin(a, true);", "    if(c.state !== STATE.IN && !keepOnSignup) await dropGoogleLogin(a, true);\n    else if(c.state === STATE.IN) await dropGoogleLogin(a, true);", '계정이 있어도 지움'],
  ['LF', "    const dropLogin = (canDelete) => dropGoogleLogin(l.login, canDelete);", "    const dropLogin = async () => { try{ await auth.signOut(); }catch(_){} };", '거절된 구글 가입의 새 로그인을 안 지움'],
  ['LF', "      if(e && e.kind !== 'unavailable') deps.pending.settle(key);", "      deps.pending.settle(key);", '닿지 못한 가입을 새 요청으로(두 계정)'],
  ['LF', "      if(e && e.kind !== 'unavailable') deps.pending.settle(key);", "", '거절된 가입을 같은 요청으로'],
  ['LF', "    const a = await auth.signInPassword(me.friendCode, o.password);", "    const a = await auth.signInPassword('MATE-0000', o.password);", '받은 친구코드로 로그인 안 함'],
  ['LF', "    if(c.state === STATE.SIGNUP){ try{ await auth.signOut(); }catch(_){} return", "    if(c.state === STATE.SIGNUP){ return", '계정 없는 로그인을 남김'],
  ['LF', "        if(!(e && e.code === 'CONCURRENT_UPDATE')) throw e;", "        throw e;", '먼저 바뀌면 그냥 실패'],
  ['LF', "    try{ await deps.rt.bye(why); }catch(_){}", "", '로그아웃에 realtime 작별 안 함'],
  ['LF', "    try{ await Promise.race([deps.leaveRoom(), new Promise((r) => setTimeout(r, LEAVE_WAIT_MS))]); }catch(_){}\n    try{ await deps.rt.bye(why); }catch(_){}", "    try{ await deps.rt.bye(why); }catch(_){}\n    try{ await deps.leaveRoom(); }catch(_){}", '작별 뒤 방 leave(연결이 먼저 닫힘 — 방 사람은 20초 뒤에야 봄)'],
  ['LF', "    try{ await Promise.race([deps.leaveRoom(), new Promise((r) => setTimeout(r, LEAVE_WAIT_MS))]); }catch(_){}\n", "", '로그아웃에 방 안 나감'],
  ['LF', "    try{ await Promise.race([deps.leaveRoom(), new Promise((r) => setTimeout(r, LEAVE_WAIT_MS))]); }catch(_){}", "    try{ await deps.leaveRoom(); }catch(_){}", '방 나가기 기다림에 상한 없음(오프라인이면 로그아웃이 멈춤)'],
  ['LF', "    await release((o && o.why) || BYE_LOGOUT);", "    await release(BYE_LOGOUT);", '탈퇴도 logout 으로 작별'],
  ['LF', "    await release((o && o.why) || BYE_LOGOUT);", "    release((o && o.why) || BYE_LOGOUT);", '작별을 안 기다리고 로그인을 놓음'],
  ['LF', "    try{ deps.forgetSession(); }catch(_){}", "", '로그아웃에 API 로그인 읽기를 안 뗌'],
  ['LF', "const api = { ME_CACHE_KEY, STATE, RESTORE_WAIT_MS, RESTORING_TEXT, joinKey, createLoginFlow };", "function premiumNow(){ return true; }\nconst api = { ME_CACHE_KEY, STATE, RESTORE_WAIT_MS, RESTORING_TEXT, joinKey, premiumNow, createLoginFlow };", 'premiumNow(24시간 유예)를 되살림'],
  ['LF', "    if(auth.restoring()){\n", "    if(false){\n", '★ 저장된 로그인이 있어도 8초 뒤 «로그인 없음» 으로 봄(예전)'],
  ['LF', "      if(!ok) return { state: STATE.LOCAL, me: null, restoring: true, reason: RESTORING_TEXT };", "      if(!ok) return { state: STATE.LOGIN, me: null };", '60초 답 없음을 로그인 화면으로'],
  ['LF', "      try{ ok = await auth.answered(RESTORE_WAIT_MS); }catch(_){ ok = false; }", "      try{ ok = await auth.answered(); }catch(_){ ok = false; }", '복원 기다림에 상한 없음(영영 멈춤)'],
  ['LF', "const RESTORE_WAIT_MS = 60000;", "const RESTORE_WAIT_MS = 8000;", '상한을 8초로'],
  ['LF', "    if(auth.restoring()) auth.answered().then(() => { if(waitBack) retryNow(); }, () => {});", "", '늦게 온 첫 답에 이어 가지 않음'],
  ['LF', "    if(auth.restoring()) auth.answered().then(", "    auth.answered().then(", '보통의 닿지 못함 화면도 첫 답에 다시 물음(요청 늘어남)'],
  ['LF', "      if(onRestoreWait){ try{ onRestoreWait(); }catch(_){} }", "", '기다리는 화면을 안 알림'],
  ['LF', "  return 'join:' + String(inviteCode || '') + ':' + h.toString(36);", "  return 'join:' + String(inviteCode || '');", '비밀번호를 바꿔도 같은 요청'],
  ['HTML', '<script src="parts/account/login-flow.js"></script>', '', 'html 에 안 실음'],
];
let finished = false;
process.on('exit', () => { if(!finished){ console.log('  ✗ 끝까지 돌지 못하고 멈췄다(mutation test ' + ran + '/' + BREAKS.length + ')'); process.exitCode = 1; } });   // 약속이 안 끝나 node 가 조용히 0 으로 끝나는 것을 막는다
const BREAK_MS = 5000;
let ran = 0;
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); ran++; continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  /* 망가뜨린 글이 끝나지 않는 약속을 기다리면(멈춤) 그것도 «잡음» 이다 — 안 그러면 node 가 조용히 종료코드 0 으로 끝나 뒤 mutation test 가 검사되지 않는다 */
  let timer;
  try{ await Promise.race([judge(S), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('멈춤')), BREAK_MS); })]); }catch(_){ qfail++; }
  clearTimeout(timer);
  quiet = false;
  ran++;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, 'mutation test ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

chk(ran === BREAKS.length, 'mutation test ' + BREAKS.length + '가지를 끝까지 돌았다(' + ran + ')');
console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
finished = true;
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
