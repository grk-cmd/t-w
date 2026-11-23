/* sim-login-diag.js — 🩺 켤 때 로그인 진단(account/login-diag.js · firebase-init.js 대기선 · login-flow.js confirm 배선)
   실행:  node checks/run.js login-diag
   ★ 왜 — «다시 켜면 자동 로그인이 풀린다» 를 진단 기록 한 장으로 A(대기선 시간 초과) · B(Firebase 가 지움) · C(저장된 로그인 없음) ·
     D(서버 401) 로 가르려면 줄이 맞는 때 맞는 글로 한 번씩 나와야 하고, 개인 값(uid · 이메일 · 토큰 · 친구코드)이 절대 섞이면 안 된다.
   ・1절: 순수 함수 — 저장된 로그인(있음 · 글자 수만) · localStorage 크기 · 수단(google · password · anonymous) · 오류 표(401 AUTH_REQUIRED · NO_TOKEN · network)
   ・2절: 흐름 — A · B · C · D 가짜 부팅에서 나오는 줄 · 한 번씩만 · 200자 이하 · 개인 값 없음 · 긴 작업 15초 줄 · 잴 수 없음
   ・3절: login-flow.js 진짜 confirm 이 onConfirmed 에 결과 · 사용자 있음 · 오류를 넘긴다 · 진단이 던져도 결과는 그대로
   ・4절: 배선 — html 차례(leave-flush 뒤 · firebase-init · app.js 앞) · firebase-init 대기선 세 곳 · app.js deps · smoke PRELOAD
   ・5절: mutation test — 갈래를 하나씩 바꾼 모듈로 1~2절을 다시 돌려 빨강이 나는지 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (names) => { for(const f of names) if(fs.existsSync(f)) return fs.readFileSync(f, 'utf8'); return null; };
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC = {
  LD: read(at('login-diag.js', 'account')),
  LF: read(at('login-flow.js', 'account')),
  AE: read(at('api-errors.js', 'shared')),
  FI: read(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  APP: read(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: read(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: read(['smoke.js', 'checks/smoke.js']),
};
for(const k of Object.keys(SRC)) if(!SRC[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
const tick = async () => { for(let i = 0; i < 10; i++) await Promise.resolve(); };

/* 개인 값 — 어떤 줄에도 나오면 안 된다 */
const SECRET = ['uid-SECRET-9', 'secret@mail.test', 'TOKEN-SECRET', 'MATE-ZZ99', 'u9876543210'];
const AUTH_VAL = JSON.stringify({ uid: SECRET[0], email: SECRET[1], stsTokenManager: { accessToken: SECRET[2] } });
function mem(init){
  const m = new Map(Object.entries(init || {}));
  return { m, get length(){ return m.size; }, key: (i) => Array.from(m.keys())[i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const AUTH_KEY = 'firebase:authUser:AIzaKEY:[DEFAULT]';
const G_USER = { uid: SECRET[0], email: SECRET[1], isAnonymous: false, providerData: [{ providerId: 'google.com', uid: SECRET[0], email: SECRET[1] }] };
const P_USER = { uid: SECRET[0], email: SECRET[3] + '@x', isAnonymous: false, providerData: [{ providerId: 'password', email: SECRET[3] + '@x' }] };

function mkDiag(M, o){
  const opt = o || {};
  const lines = [], timers = [];
  let t = opt.t0 || 1000, ltCb = null, stopped = 0;
  const storage = mem(opt.stored === false ? { 'tw.deviceId': 'dev-1' } : { 'tw.deviceId': 'dev-1', [AUTH_KEY]: AUTH_VAL, 'tw.me': JSON.stringify({ me: { friendCode: SECRET[3], userCode: SECRET[4] } }) });
  const d = M.createLoginDiag({
    note: (l) => lines.push(l), now: () => t, storage,
    idbNames: () => (opt.idb === 'fail' ? Promise.reject(new Error('x')) : Promise.resolve(opt.idb || ['firebaseLocalStorageDb', 'twChat'])),
    observeLongTasks: (cb) => { if(opt.noLongtask) return null; ltCb = cb; return () => { stopped++; }; },
    later: (fn, ms) => timers.push({ at: t + ms, fn }),
  });
  const advance = (ms) => { const end = t + ms; timers.sort((a, b) => a.at - b.at); while(timers.length && timers[0].at <= end){ const h = timers.shift(); t = h.at; h.fn(); } t = end; };
  return { d, lines, storage, advance, setT: (v) => { t = v; }, now: () => t, long: (v) => ltCb && ltCb(v), stopped: () => stopped };
}

async function behave(src){
  const M = load(src), r = {};
  /* 1절 순수 */
  const s1 = M.storageInfo(mem({ a: '12', [AUTH_KEY]: 'abcde' }));
  r.storage = s1.ok && s1.has && s1.len === 5 && s1.keys === 2 && s1.total === 1 + 2 + AUTH_KEY.length + 5;
  const s0 = M.storageInfo(mem({ a: '1' }));
  r.storageNone = s0.ok && !s0.has && s0.len === 0;
  r.storageFail = M.storageInfo({ get length(){ throw new Error('blocked'); } }).ok === false;
  r.kindG = M.userKind(G_USER).kind === 'google' && M.userKind(P_USER).kind === 'password';
  r.kindAnon = (() => { const k = M.userKind({ isAnonymous: true, providerData: [] }); return k.present && k.anonymous && k.kind === 'anonymous'; })();
  r.kindNone = !M.userKind(null).present;
  r.err401 = M.errTag({ kind: 'auth', status: 401, code: 'AUTH_REQUIRED' }) === '401 AUTH_REQUIRED';
  r.errNoTok = M.errTag({ kind: 'auth', status: 0, code: 'NO_TOKEN' }) === 'NO_TOKEN';
  r.errNet = M.errTag({ kind: 'unavailable', status: 0 }) === 'network' && M.errTag(new Error('x')) === 'network';
  r.errOdd = M.errTag({ status: 500, code: 'has space ' + SECRET[1] }) === '500';   // 모양이 다른 code 는 적지 않는다
  r.fbErr = M.fbErrTag({ code: 'auth/network-request-failed' }) === 'auth/network-request-failed' && M.fbErrTag({ code: SECRET[1] + ' X' }) === 'unknown';

  /* 2절 흐름 — A: 시간 초과 먼저 · 늦게 사용자 */
  { const e = mkDiag(M); e.long(300); e.long(1200);
    e.d.authStart(true); await tick();
    e.advance(8000); e.d.barrierTimeout();
    e.d.confirmed({ state: 'login' }, { hadUser: false, anonymous: false, err: null });
    e.advance(1500); e.d.authState(G_USER); e.d.authState(null);
    e.advance(6000);
    const L = e.lines;
    r.aStart = /^\[로그인\] 켤 때 · 저장된 로그인 있음\(\d+자\) · IndexedDB 저장소 y · localStorage 약 \d+자 · 키 3개 · 페이지 1000 ms · Auth 준비$/.test(L[0] || '');
    r.aTimeout = (L[1] || '') === '[로그인] 대기선: 8초 시간 초과 먼저 8000 ms · 긴 작업 합 1500 ms(최대 1200)';
    r.aConfirm = (L[2] || '') === '[로그인] 확인 → login · Firebase 사용자 없음 · 시작 뒤 8000 ms · 대기선 시간 초과 뒤';
    r.aLate = (L[3] || '') === '[로그인] 늦게 도착 9500 ms · 사용자 있음 y · 익명 n · 수단 google';
    r.aLong = (L[4] || '') === '[로그인] 켜고 15초 긴 작업 2번 · 합 1500 ms · 가장 긴 1200 ms' && e.stopped() === 1;
    r.aOnce = L.length === 5;
    r.aSafe = L.every((l) => l.length <= M.LINE_MAX && SECRET.every((s) => l.indexOf(s) < 0));
  }
  /* B: 저장된 로그인이 있었는데 첫 상태가 사용자 없음 · Firebase 가 키를 지움 */
  { const e = mkDiag(M); e.d.authStart(true); await tick();
    e.advance(700); e.storage.removeItem(AUTH_KEY); e.d.authState(null);
    e.d.confirmed({ state: 'login' }, { hadUser: false, anonymous: false, err: null });
    const L = e.lines;
    r.bFirst = (L[1] || '') === '[로그인] 대기선: 첫 상태 먼저 700 ms · 사용자 있음 n · 익명 n · 수단 - · 긴 작업 합 0 ms(최대 0)';
    r.bCleared = /^\[로그인\] 저장된 로그인\(\d+자\)이 있었는데 첫 상태가 «사용자 없음» — Firebase 가 복원 중 지움 · 지금 키 남음 n$/.test(L[2] || '');
    r.bConfirm = (L[3] || '') === '[로그인] 확인 → login · Firebase 사용자 없음 · 시작 뒤 700 ms · 대기선 첫 상태 뒤';
    e.advance(8000); e.d.barrierTimeout();
    r.bNoTimeout = e.lines.filter((l) => /시간 초과/.test(l)).length === 0;   // 첫 상태가 먼저 왔으면 시간 초과 줄은 없다
  }
  /* C: 저장된 로그인 없음 — «지움» 줄은 안 나온다 · IndexedDB 못 읽음 */
  { const e = mkDiag(M, { stored: false, idb: 'fail' }); e.d.authStart(true); await tick();
    e.advance(300); e.d.authState(null);
    r.cStart = /^\[로그인\] 켤 때 · 저장된 로그인 없음 · IndexedDB 저장소 모름 · /.test(e.lines[0] || '');
    r.cNoCleared = !e.lines.some((l) => /지움/.test(l));
  }
  /* D: 사용자 있음 · 서버 401 */
  { const e = mkDiag(M); e.d.authStart(true); await tick();
    e.advance(400); e.d.authState(P_USER);
    e.advance(600); e.d.confirmed({ state: 'login' }, { hadUser: true, anonymous: false, err: { kind: 'auth', status: 401, code: 'AUTH_REQUIRED', message: SECRET[2] } });
    e.d.confirmed({ state: 'in' }, { hadUser: true });
    const L = e.lines;
    r.dFirst = /수단 password/.test(L[1] || '');
    r.dConfirm = (L[2] || '') === '[로그인] 확인 → login · 401 AUTH_REQUIRED · 시작 뒤 1000 ms · 대기선 첫 상태 뒤';
    r.dOnce = L.length === 3 && L.every((l) => SECRET.every((s) => l.indexOf(s) < 0));
  }
  /* local 이면 다음 답 하나 더 · 그 뒤로는 안 적음 · 두 번 authStart 는 한 번 · Auth 초기화 실패 */
  { const e = mkDiag(M); e.d.authStart(true); e.d.authStart(true); await tick();
    e.d.confirmed({ state: 'local' }, { hadUser: true, err: { kind: 'unavailable' } });
    e.d.confirmed({ state: 'local' }, { hadUser: true, err: { kind: 'unavailable' } });
    e.d.confirmed({ state: 'in' }, { hadUser: true });
    r.localTwice = e.lines.filter((l) => /확인 → local · network/.test(l)).length === 2 && !e.lines.some((l) => /확인 → in/.test(l));
    r.startOnce = e.lines.filter((l) => /켤 때 ·/.test(l)).length === 1;
  }
  { const e = mkDiag(M); e.d.authStart(true); await tick();
    e.d.confirmed({ state: 'local' }, { hadUser: true, err: { kind: 'unavailable' } });
    e.d.confirmed({ state: 'in' }, { hadUser: true });
    r.localThenIn = /확인 → in · 시작 뒤/.test(e.lines[e.lines.length - 1] || '');
  }
  { const e = mkDiag(M); e.d.authStart(false); await tick();
    r.noAuth = e.lines.some((l) => l === '[로그인] 대기선: Auth 초기화 실패 — 바로 통과') && /Auth 초기화 실패$/.test(e.lines.find((l) => /켤 때/.test(l)) || '');
  }
  /* 상태 오류 먼저 · 긴 작업 잴 수 없음 */
  { const e = mkDiag(M, { noLongtask: true }); e.d.authStart(true); await tick();
    e.advance(200); e.d.authError({ code: 'auth/network-request-failed' });
    e.advance(15000);
    r.errFirst = e.lines.some((l) => l === '[로그인] 대기선: 상태 오류 먼저 200 ms · auth/network-request-failed · 긴 작업 잴 수 없음');
    r.longNone = e.lines.some((l) => l === '[로그인] 켜고 15초 긴 작업 잴 수 없음');
  }
  /* note 가 던져도 멈추지 않는다 · 길이 상한 */
  { const d = M.createLoginDiag({ note: () => { throw new Error('ipc'); }, now: () => 0, storage: mem({}), idbNames: () => Promise.resolve(null),
      observeLongTasks: () => null, later: () => {} });
    let ok = true, rejected = 0;
    const onRej = () => { rejected++; };
    process.on('unhandledRejection', onRej);
    try{ d.authStart(true); d.authState(G_USER); d.barrierTimeout(); d.confirmed({ state: 'in' }, {}); }catch(_){ ok = false; }
    await tick(); await new Promise((res) => setImmediate(res));
    process.removeListener('unhandledRejection', onRej);
    r.noThrow = ok && rejected === 0;   // 시작 줄은 IndexedDB 답 뒤(비동기)에 적는다 — 거기서 던지면 처리 안 된 거절이 된다
    r.clip = M.confirmLine({ state: 'x'.repeat(400) }, {}, 0, null).length === M.LINE_MAX;
  }
  return r;
}
const MSG = {
  storage: '저장된 로그인 키 — 있음 · 값 글자 수 · 키 수 · 전체 글자 수(키 + 값)', storageNone: '키가 없으면 없음 · 0자', storageFail: 'localStorage 를 못 읽으면 ok:false(«모름»)',
  kindG: '수단 — google.com → google · password → password', kindAnon: '익명 사용자 → 있음 · 익명 y · anonymous', kindNone: '사용자 없음 → 있음 n',
  err401: '서버 401 AUTH_REQUIRED → «401 AUTH_REQUIRED»', errNoTok: '토큰 없음 → NO_TOKEN', errNet: '닿지 못함(unavailable · kind 없음) → network',
  errOdd: '모양이 다른 code(공백 · 이메일)는 적지 않는다', fbErr: 'Firebase 오류 code 는 모양이 맞을 때만',
  aStart: 'A 시작 줄 — 저장된 로그인 있음(글자 수) · IndexedDB · 크기 · 키 수 · 페이지 시각 · Auth', aTimeout: 'A 8초 시간 초과 먼저 + 그때까지 긴 작업 합 · 최대',
  aConfirm: 'A 확인 — login · Firebase 사용자 없음 · 시간 초과 뒤', aLate: 'A 시간 초과 뒤 첫 상태 → «늦게 도착» 줄(사용자 있음 · 수단)', aLong: '켜고 15초 긴 작업 줄 · 관찰 끊음',
  aOnce: 'A 줄은 다섯 개뿐(두 번째 상태 바뀜은 안 적음)', aSafe: '모든 줄 200자 이하 · uid · 이메일 · 토큰 · 친구코드 · 유저코드 없음',
  bFirst: 'B 첫 상태 먼저 — 사용자 없음', bCleared: 'B 저장된 로그인이 있었는데 사용자 없음 → «Firebase 가 복원 중 지움» · 지금 키 남음 n', bConfirm: 'B 확인 — 첫 상태 뒤',
  bNoTimeout: '첫 상태가 먼저면 시간 초과 줄 없음', cStart: 'C 저장된 로그인 없음 · IndexedDB 못 읽음 → 모름', cNoCleared: 'C 에는 «지움» 줄 없음',
  dFirst: 'D 첫 상태 — 수단 password', dConfirm: 'D 확인 — login · 401 AUTH_REQUIRED(서버 message 는 안 적음)', dOnce: 'D 확인 줄은 한 번 · 개인 값 없음',
  localTwice: '첫 답이 local 이면 다음 답 하나까지(합 둘) · 그 뒤는 안 적음', startOnce: 'authStart 두 번(감시견) → 시작 줄 하나', localThenIn: 'local 다음 in 이면 in 도 적음',
  noAuth: 'Auth 초기화 실패 → «바로 통과» 줄 · 시작 줄 끝', errFirst: '상태 오류 먼저 → Firebase code', longNone: '긴 작업을 잴 수 없으면 그렇게 적음',
  noThrow: '진단 기록(note)이 던져도 던지지 않고 · 처리 안 된 거절도 없다', clip: '줄은 200자에서 자른다',
};

(async () => {
  say('── 1~2절. 순수 함수 · A · B · C · D 흐름');
  const R = await behave(SRC.LD);
  for(const k of Object.keys(MSG)) chk(R[k] === true, MSG[k]);

  say('── 3절. login-flow.js confirm → onConfirmed');
  {
    const LF = load(SRC.LF), AE = load(SRC.AE);
    const seen = [];
    let user = null, meAns = null, throwDiag = false;
    const flow = LF.createLoginFlow({
      userApi: { me: async () => { if(meAns instanceof Error) throw meAns; return meAns; } },
      translate: AE.translate, reasonOf: () => '까닭',
      auth: { ready: async () => {}, user: () => user, signOut: async () => {} },
      storage: mem({}), now: () => 1, rt: { onState: () => () => {} },
      onConfirmed: (r, info) => { if(throwDiag) throw new Error('diag'); seen.push([r.state, info.hadUser, info.anonymous, info.err && info.err.code]); },
    });
    await flow.confirm();
    chk(JSON.stringify(seen[0]) === JSON.stringify(['login', false, false, null]), '로그인 없음 → login · hadUser false · err 없음');
    user = { uid: 'a', anonymous: true }; await flow.confirm();
    chk(JSON.stringify(seen[1]) === JSON.stringify(['login', true, true, null]), '익명 → login · anonymous true');
    user = { uid: 'a', anonymous: false }; meAns = Object.assign(new Error('x'), { kind: 'auth', status: 401, code: 'AUTH_REQUIRED' }); await flow.confirm();
    chk(JSON.stringify(seen[2]) === JSON.stringify(['login', true, false, 'AUTH_REQUIRED']), '401 AUTH_REQUIRED → login · 오류를 넘김');
    meAns = Object.assign(new Error('x'), { kind: 'auth', status: 401, code: 'USER_CODE_NOT_BOUND' }); await flow.confirm();
    chk(seen[3] && seen[3][0] === 'signup' && seen[3][3] === 'USER_CODE_NOT_BOUND', '가입 전 → signup · 오류를 넘김');
    meAns = Object.assign(new Error('x'), { kind: 'unavailable', status: 0 }); await flow.confirm();
    chk(seen[4] && seen[4][0] === 'local', '닿지 못함 → local');
    meAns = { userCode: 'u1', version: 1 }; throwDiag = true;
    const r = await flow.confirm();
    chk(r.state === 'in' && r.me && r.me.userCode === 'u1', '진단이 던져도 confirm 결과는 그대로(in · me)');
  }

  say('── 4절. 배선');
  {
    const H = SRC.HTML;
    const iD = H.indexOf('<script src="parts/account/login-diag.js"></script>');
    const iLeave = H.indexOf('<script src="parts/shared/leave-flush.js"></script>');
    const iFb = H.indexOf('<script type="module" src="parts/firebase-init.js"></script>');
    const iApp = H.indexOf('<script src="parts/app.js"></script>');
    chk(iD > iLeave && iLeave >= 0 && iD < iFb && (iApp < 0 || iD < iApp), 'html — leave-flush.js 뒤 · firebase-init.js · app.js 앞에 싣는다');
    const firstScripts = H.slice(0, iD).split('<script src=').length - 1;
    chk(firstScripts <= 3, 'html — 맨 앞쪽(앞에 스크립트 둘뿐 — 긴 작업을 처음부터 잰다)');
    const F = SRC.FI;
    chk(/const _loginDiag = window\.TwLoginDiag\.store;\s*\n\s*_loginDiag\.authStart\(!!auth\);/.test(F) && F.indexOf('_loginDiag.authStart(') > F.indexOf('auth = getAuth(fbApp)'), 'firebase-init — getAuth 뒤에 authStart');
    chk(/onAuthStateChanged\(auth, \(u\)=>\{ _loginDiag\.authState\(u\); done\(\); \}, \(e\)=>\{ _loginDiag\.authError\(e\); done\(\); \}\)/.test(F), 'firebase-init — 첫 상태 · 오류를 알리고 그대로 done');
    chk(/if\(!_authSettled\)\{ console\.warn\([^)]*\); _loginDiag\.barrierTimeout\(\); \} done\(\); \}, AUTH_READY_TIMEOUT_MS\)/.test(F), 'firebase-init — 8초 시간 초과(아직 안 풀렸을 때만)를 알림');
    chk(/onConfirmed: \(r, info\)=>TwLoginDiag\.store\.confirmed\(r, info\)/.test(SRC.APP), 'app.js — 로그인 흐름 deps onConfirmed');
    chk(/PRELOAD\.push\('login-diag\.js'\)/.test(SRC.SMOKE), 'smoke PRELOAD 에 login-diag.js');
    chk(!/typeof\s+(?!window\b|module\b)[\w.]+\s*[!=]==?\s*'(function|undefined)'/.test(SRC.LD), 'login-diag.js — typeof «있으면 부르기» 가드 없음');
  }

  say('── 5절. mutation test');
  const MUT = [
    ['저장된 로그인 값 길이 대신 0', (s) => s.replace('r.has = true; r.len = vl;', 'r.has = true; r.len = 0;'), 'storage'],
    ['키 머리를 안 봄', (s) => s.replace("indexOf(AUTH_KEY_PREFIX) === 0", "indexOf(AUTH_KEY_PREFIX) === 1"), 'storage'],
    ['google 을 password 보다 늦게', (s) => s.replace("ids.indexOf('google.com') >= 0 ? 'google'", "false ? 'google'"), 'kindG'],
    ['NO_TOKEN 을 따로 안 봄', (s) => s.replace("if(code === 'NO_TOKEN') return 'NO_TOKEN';", ''), 'errNoTok'],
    ['code 모양 검사를 뺌', (s) => s.replace("API_CODE.test(String(e.code || '')) ? String(e.code) : ''", "String(e.code || '')"), 'errOdd'],
    ['시간 초과 뒤에도 «먼저» 줄', (s) => s.replace("if(barrier === 'timeout') note(lateLine(k, t));", 'if(false) note(lateLine(k, t));'), 'aLate'],
    ['첫 상태만 보지 않음', (s) => s.replace('if(firstSeen) return;\n    firstSeen = true;\n    try{\n      const k', 'firstSeen = true;\n    try{\n      const k'), 'aOnce'],
    ['«지움» 줄을 안 적음', (s) => s.replace('if(stored && stored.has && !k.present)', 'if(false)'), 'bCleared'],
    ['첫 상태 뒤에도 시간 초과 줄', (s) => s.replace('if(barrier) return;\n    barrier = \'timeout\';', "barrier = 'timeout';"), 'bNoTimeout'],
    ['확인을 한 번만 보지 않음', (s) => s.replace('if(confirmDone) return;', ''), 'dOnce'],
    ['local 다음 답을 안 적음', (s) => s.replace("confirmDone = !(r && r.state === 'local') || confirmCount >= CONFIRM_MAX;", 'confirmDone = true;'), 'localThenIn'],
    ['긴 작업 최대를 안 셈', (s) => s.replace('if(v > lt.max) lt.max = v;', ''), 'aTimeout'],
    ['15초 뒤 관찰을 안 끊음', (s) => s.replace('try{ if(stop) stop(); }catch(_){}', ''), 'aLong'],
    ['note 실패를 삼키지 않음', (s) => s.replace('const note = (line) => { try{ deps.note(line); }catch(_){} };', 'const note = (line) => deps.note(line);'), 'noThrow'],
    ['줄 길이를 안 자름', (s) => s.replace(".slice(0, LINE_MAX);", ';'), 'clip'],
    ['authStart 를 두 번 받음', (s) => s.replace('if(t0 != null) return;', ''), 'startOnce'],
  ];
  for(const [name, mut, key] of MUT){
    const m = mut(SRC.LD);
    if(m === SRC.LD){ chk(false, '  (바꿀 글을 못 찾음) ' + name); continue; }
    quiet = true; let R2 = null;
    try{ R2 = await behave(m); }catch(_){ R2 = null; }
    quiet = false;
    chk(!R2 || R2[key] !== true, '빨강이 난다 — ' + name);
  }

  say('');
  say(`  ${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
