/* sim-auth-barrier.js — 🚧 로그인 복원 대기선(account/auth-barrier.js) 검사 — 가짜 onAuthStateChanged · 가짜 시계로 그대로 돌린다
   실행:  node checks/run.js auth-barrier
   ★ 왜 — 쓰기용 ready() 는 8초 안에 반드시 풀려야 하고(쓰기가 영영 걸리지 않게), 켤 때 판정용 answered() 는 8초로 «답함» 이 되면 안 된다
     (렌더러가 바쁜 PC 가 켤 때마다 로그인 화면으로 떨어졌다). 두 기다림이 섞이지 않는지 본다.
   ・1절: 첫 답이 빨리 옴 — ready · answered 둘 다 · restoring 꺼짐 · 진단 첫 상태 한 번(그 뒤 상태 바뀜도 진단에 넘김 — 진단이 거른다)
   ・2절: 첫 답이 늦음(저장된 로그인 있음) — 8초에 ready 만 풀림 · 진단 시간 초과 · restoring 그대로 · answered(60초) 는 늦게 온 첫 답에 true · 상한이면 false
   ・3절: 저장된 로그인 없음 · Auth 초기화 실패 · 구독이 던짐 · 오류 콜백 · 진단이 던짐
   ・4절: 배선 — html 차례(login-diag 뒤 · firebase-init 앞) · firebase-init deps · smoke PRELOAD
   ・5절: mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (names) => { for(const f of names) if(fs.existsSync(f)) return fs.readFileSync(f, 'utf8'); return null; };
const SRC = {
  AB: read(['auth-barrier.js', 'parts/account/auth-barrier.js', 'app/parts/account/auth-barrier.js']),
  FI: read(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  HTML: read(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: read(['smoke.js', 'checks/smoke.js']),
};
for(const k of Object.keys(SRC)) if(!SRC[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
const tick = async () => { for(let i = 0; i < 10; i++) await Promise.resolve(); };

function mk(M, o){
  const opt = o || {};
  const diag = [], warns = [], q = [];
  let t = 0, onUser = null, onError = null;
  const subscribe = opt.noAuth ? null : (u, e) => { if(opt.subThrows) throw new Error('sub'); onUser = u; onError = e; };
  const b = M.createAuthBarrier({
    subscribe, storedLogin: opt.stored !== false,
    later: (fn, ms) => q.push({ at: t + ms, fn }),
    diag: opt.diagThrows ? { authState(){ throw new Error('d'); }, authError(){ throw new Error('d'); }, barrierTimeout(){ throw new Error('d'); } }
      : { authState: (u) => diag.push('state:' + (u ? 'user' : 'none')), authError: () => diag.push('error'), barrierTimeout: () => diag.push('timeout') },
    warn: (m) => warns.push(m),
  });
  const advance = async (ms) => { const end = t + ms; for(;;){ await tick(); q.sort((a, c) => a.at - c.at); const h = q[0]; if(!h || h.at > end) break; t = h.at; q.shift(); h.fn(); } t = end; await tick(); };
  const watch = (p) => { const w = { v: undefined, done: false }; p.then((v) => { w.v = v; w.done = true; }); return w; };
  return { b, diag, warns, advance, watch, user: (u) => onUser && onUser(u), error: (e) => onError && onError(e) };
}

async function behave(src){
  const M = load(src), r = {};
  /* 1절 — 첫 답이 빨리 옴 */
  { const e = mk(M);
    const rd = e.watch(e.b.ready()), an = e.watch(e.b.answered(60000));
    r.fastRestoring = e.b.restoring() === true;
    await e.advance(700); e.user({ uid: 'a' }); await tick();
    r.fast = rd.done && an.done && an.v === true && e.b.restoring() === false && e.diag.join() === 'state:user';
    e.user(null); await tick();
    r.fastLater = e.diag.join() === 'state:user,state:none';   // 그 뒤 상태 바뀜도 진단에 넘긴다(진단이 첫 번만 적는다)
    await e.advance(10000);
    r.fastNoTimeout = !e.diag.includes('timeout') && e.warns.length === 0;
    r.fastAnswerNow = await e.b.answered(1) === true;
  }
  /* 2절 — 첫 답이 늦음 */
  { const e = mk(M);
    const rd = e.watch(e.b.ready()), an = e.watch(e.b.answered(60000));
    await e.advance(7999);
    r.slowBefore = !rd.done && !an.done;
    await e.advance(1);
    r.slowReady = rd.done && e.diag.join() === 'timeout' && e.warns.length === 1;
    r.slowStill = !an.done && e.b.restoring() === true;
    const rd2 = e.watch(e.b.ready()); await tick();
    r.slowReadyAgain = rd2.done;
    await e.advance(12000); e.user({ uid: 'a' }); await tick();
    r.slowAnswer = an.done && an.v === true && e.b.restoring() === false;
  }
  { const e = mk(M);
    const an = e.watch(e.b.answered(60000)), inf = e.watch(e.b.answered());
    await e.advance(60000);
    r.capFalse = an.done && an.v === false && e.b.restoring() === true;
    r.infWaits = !inf.done;
    e.user(null); await tick();
    r.infLate = inf.done && inf.v === true && e.b.restoring() === false;
  }
  /* 3절 */
  { const e = mk(M, { stored: false });
    r.noStored = e.b.restoring() === false;
    const rd = e.watch(e.b.ready()); await e.advance(8000);
    r.noStoredReady = rd.done;
  }
  { const e = mk(M, { noAuth: true });
    const rd = e.watch(e.b.ready()); await tick();
    r.noAuth = rd.done && e.b.restoring() === false && (await e.b.answered(5)) === true;
  }
  { const e = mk(M, { subThrows: true });
    const rd = e.watch(e.b.ready()); await tick();
    r.subThrows = rd.done && e.b.restoring() === false;
  }
  { const e = mk(M);
    const an = e.watch(e.b.answered(60000));
    await e.advance(300); e.error({ code: 'auth/x' }); await tick();
    r.errAnswers = an.v === true && e.diag.join() === 'error';
  }
  { const e = mk(M, { diagThrows: true });
    const rd = e.watch(e.b.ready());
    let ok = true; try{ e.user({ uid: 'a' }); }catch(_){ ok = false; }
    await tick();
    r.diagThrows = ok && rd.done && e.b.restoring() === false;
  }
  return r;
}
const MSG = {
  fastRestoring: '켤 때 저장된 로그인 있음 + 첫 답 전 → restoring', fast: '빨리 온 첫 답 → ready · answered(true) · restoring 꺼짐 · 진단 첫 상태',
  fastLater: '그 뒤 상태 바뀜도 진단에 넘긴다', fastNoTimeout: '첫 답이 먼저면 8초 시간 초과 · 경고 없음', fastAnswerNow: '이미 답했으면 answered 는 바로 true',
  slowBefore: '7.999초까지는 둘 다 안 풀림', slowReady: '★ 8초 → ready(쓰기용)만 풀림 · 진단 시간 초과 · 경고 한 번',
  slowStill: '★ 8초가 지나도 answered 는 안 풀리고 restoring 그대로(«로그인 없음» 으로 안 봄)', slowReadyAgain: '시간 초과 뒤 ready() 는 바로 풀린다',
  slowAnswer: '20초에 온 첫 답 → answered(true) · restoring 꺼짐', capFalse: '★ 60초 상한 → answered(false) · restoring 그대로(답을 지어내지 않음)',
  infWaits: '상한 없는 answered() 는 계속 기다린다', infLate: '  ↳ 늦게 온 첫 답(사용자 없음)에도 풀린다',
  noStored: '저장된 로그인 없음 → restoring 아님(예전과 같음)', noStoredReady: '  ↳ ready 는 8초 상한 그대로',
  noAuth: 'Auth 초기화 실패 → 바로 답한 것으로(ready · answered · restoring 아님)', subThrows: '구독이 던져도 바로 풀린다',
  errAnswers: '상태 오류 콜백도 첫 답 — 진단 오류', diagThrows: '진단이 던져도 대기선은 그대로 풀린다',
};

(async () => {
  say('── 1~3절. 진짜 auth-barrier.js 를 가짜 시계로');
  const R = await behave(SRC.AB);
  for(const k of Object.keys(MSG)) chk(R[k] === true, MSG[k]);

  say('── 4절. 배선');
  {
    const H = SRC.HTML;
    const iB = H.indexOf('<script src="parts/account/auth-barrier.js"></script>');
    const iD = H.indexOf('<script src="parts/account/login-diag.js"></script>');
    const iFb = H.indexOf('<script type="module" src="parts/firebase-init.js"></script>');
    chk(iB > iD && iD >= 0 && iB < iFb, 'html — login-diag.js 뒤 · firebase-init.js 앞');
    const F = SRC.FI;
    chk(/const _authBarrier = window\.TwAuthBarrier\.createAuthBarrier\(\{/.test(F) && /subscribe: auth \? \(onUser, onError\)=>onAuthStateChanged\(auth, onUser, onError\) : null,/.test(F),
      'firebase-init — onAuthStateChanged 를 넘김(Auth 초기화 실패면 null)');
    chk(/const _whenAuthReady = \(\)=> _authBarrier\.ready\(\);/.test(F) && /authRestoring\(\)\{ return _authBarrier\.restoring\(\); \}/.test(F) && /authAnswered\(maxMs\)\{ return _authBarrier\.answered\(maxMs\); \}/.test(F),
      'firebase-init — 쓰기 대기선은 ready · authRestoring · authAnswered 를 내놓음');
    chk(!/AUTH_READY_TIMEOUT_MS|_authSettled/.test(F), 'firebase-init — 옛 대기선(8초 상수 · 정착 깃발)이 남지 않음');
    chk(/PRELOAD\.push\('auth-barrier\.js'\)/.test(SRC.SMOKE), 'smoke PRELOAD 에 auth-barrier.js');
    chk(!/typeof\s+(?!window\b|module\b)[\w.]+\s*[!=]==?\s*'(function|undefined)'/.test(SRC.AB), 'auth-barrier.js — typeof «있으면 부르기» 가드 없음');
  }

  say('── 5절. mutation test');
  const MUT = [
    ['8초에 answered 도 풀림(예전)', (s) => s.replace("tell(() => diag.barrierTimeout()); pass(); }", "tell(() => diag.barrierTimeout()); answer(); }"), 'slowStill'],
    ['restoring 이 저장된 로그인을 안 봄', (s) => s.replace('restoring: () => storedLogin && !answered,', 'restoring: () => !answered,'), 'noStored'],
    ['상한에 true 를 지어냄', (s) => s.replace('later(() => resolve(false), maxMs);', 'later(() => resolve(true), maxMs);'), 'capFalse'],
    ['ready 에 상한 없음', (s) => s.replace('    if(!answered) later(', '    if(false) later('), 'slowReady'],
    ['첫 답이 와도 ready 를 안 풂', (s) => s.replace('answered = true; onAnswer(); pass();', 'answered = true; onAnswer();'), 'fast'],
    ['Auth 초기화 실패에 안 풂', (s) => s.replace('if(!deps.subscribe) answer();', 'if(!deps.subscribe){}'), 'noAuth'],
    ['구독이 던지면 안 풂', (s) => s.replace('    catch(_){ answer(); }', '    catch(_){}'), 'subThrows'],
    ['오류 콜백을 첫 답으로 안 봄', (s) => s.replace('(e) => { tell(() => diag.authError(e)); answer(); }', '(e) => { tell(() => diag.authError(e)); }'), 'errAnswers'],
    ['진단 실패를 안 삼킴', (s) => s.replace('const tell = (fn) => { try{ fn(); }catch(_){} };', 'const tell = (fn) => fn();'), 'diagThrows'],
    ['첫 답 뒤에도 시간 초과를 알림', (s) => s.replace('later(() => { if(settled) return;', 'later(() => {'), 'fastNoTimeout'],
    ['상한 없는 answered 가 바로 true', (s) => s.replace('if(maxMs == null) return answerP.then(() => true);', 'if(maxMs == null) return Promise.resolve(true);'), 'infWaits'],
  ];
  for(const [name, mut, key] of MUT){
    const m = mut(SRC.AB);
    if(m === SRC.AB){ chk(false, '  (바꿀 글을 못 찾음) ' + name); continue; }
    quiet = true; let R2 = null;
    try{ R2 = await behave(m); }catch(_){ R2 = null; }
    quiet = false;
    chk(!R2 || R2[key] !== true, '빨강이 난다 — ' + name);
  }

  say('');
  say(`  ${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
