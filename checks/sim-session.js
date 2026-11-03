/* sim-session.js — 🔐 로그인 세션(shared/session.js) 검사
   실행:  node sim-session.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 로그아웃 때 앱을 껐다 켜는 대신 «세션 하나를 버리는 한 번» 으로 바꾼다. 타이머 하나 · 구독 하나 · 값 하나라도 남으면 앞 사람 것이 다음 사람에게 섞인다.
     그래서 세션을 실제로 불러서 «등록한 것이 dispose 한 번에 전부 멈추고 비는가» 를 본다.
   ・1절: 만들기 — 계정(userCode) 없으면 던진다 · 세션마다 번호가 다르다 · 처음엔 살아 있고 등록 0
   ・2절: dispose — 타이머 · 구독 · 비우기 훅이 다 불린다 · 나중에 등록한 것부터 · 계정 칸 닫기 · 등록 0
   ・3절: 타이머 — 한 번짜리는 돌고 나면 빠진다 · 끝난 뒤엔 (clear 가 안 먹어도) 콜백이 안 돈다 · 남의 손잡이 clear 는 무시
   ・4절: 두 번 dispose · 끝난 뒤 등록(바로 풀고 경고) · 하나가 던져도 나머지는 돈다 · dispose 도중 등록
   ・5절: 세션 A 를 버리고 새 세션 B — B 는 A 의 것에 영향 없음 · A 의 늦은 답은 막힘(alive · ifAlive)
   ・6절: 계정 칸 열기 — 한 번만 · 못 열면 false · 열었을 때만 닫음 · 끝난 세션은 안 염
   ・7절: 연결 — html · smoke PRELOAD · typeof 가드 없음
   ・8절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('shared/session.js'), HTML = read('desk-companion-prototype.html'), APP = read('app.js'), SMOKE = read('smoke.js');
if (!MOD || !HTML || !APP) { say('  ? 원본 못 찾음 — session.js · desk-companion-prototype.html · app.js'); process.exit(2); }

/* 가짜 타이머 — 시계를 직접 돌린다. ignoreClear 면 clear 가 안 먹는 고장난 타이머(콜백이 끝난 세션에 새는지 보려고) */
function fakeTimers(o) {
  o = o || {};
  let n = 0;
  const live = new Map();   // 손잡이 → { fn, kind }
  return {
    live,
    setInterval: (fn) => { const h = ++n; live.set(h, { fn, kind: 'i' }); return h; },
    setTimeout: (fn) => { const h = ++n; live.set(h, { fn, kind: 't' }); return h; },
    clearInterval: (h) => { if (!o.ignoreClear) live.delete(h); },
    clearTimeout: (h) => { if (!o.ignoreClear) live.delete(h); },
    /* 살아 있는 모든 타이머를 한 번씩 울린다(한 번짜리는 울리고 빠진다) */
    tick: () => { for (const [h, t] of Array.from(live)) { if (t.kind === 't') live.delete(h); t.fn(); } },
  };
}
function build(src, o) {
  o = o || {};
  const win = {};
  new Function('window', src)(win);
  const timers = o.timers || fakeTimers();
  const ev = [];
  const mk = (userCode) => win.TwSession.createSession({
    me: userCode === undefined ? { userCode: 'u1' } : (userCode === null ? null : { userCode }),
    openAccountStore: (code) => { ev.push('open:' + code); return o.openFail ? false : true; },
    closeAccountStore: () => { ev.push('close'); },
    timers,
  });
  return { win, timers, ev, mk };
}
const quiet = (fn) => { const w0 = console.warn; const w = []; console.warn = (...a) => w.push(a.join(' ')); try { return [fn(), w]; } finally { console.warn = w0; } };

function judge(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 1 */
  let b = build(src);
  const bad = [null, undefined].map((x) => { try { b.win.TwSession.createSession({ me: x }); return false; } catch (e) { return /계정/.test(e.message); } });
  const bad2 = ['', 5].map((x) => { try { b.mk(x); return false; } catch (e) { return /계정/.test(e.message); } });
  t(bad.every(Boolean) && bad2.every(Boolean), '계정(me.userCode)이 없거나 글자가 아니면 만들 때 던진다');
  const a = b.mk('u1'), a2 = b.mk('u1');
  t(a.alive() && a.code === 'u1' && a.me.userCode === 'u1' && a.id !== a2.id, '처음엔 살아 있고 계정 코드를 쥔다 · 세션마다 번호가 다르다');
  t(JSON.stringify(a.counts()) === '{"timers":0,"subs":0,"resets":0,"storeOpened":false}' && b.ev.length === 0, '처음엔 등록 0 · 만들기만으로 계정 칸을 열지 않는다');
  /* 2 */
  b = build(src);
  const s = b.mk('u1');
  const called = [];
  s.openStore();
  s.setInterval(() => called.push('iv'), 1000);
  s.setTimeout(() => called.push('to'), 1000);
  s.on(() => called.push('unsub1')); s.on(() => called.push('unsub2'));
  s.onReset(() => called.push('reset1')); s.onReset(() => called.push('reset2'));
  t(JSON.stringify(s.counts()) === '{"timers":2,"subs":2,"resets":2,"storeOpened":true}' && b.timers.live.size === 2, '등록한 만큼 센다(타이머 2 · 구독 2 · 비우기 2)');
  t(s.dispose() === true, 'dispose 는 처음엔 true');
  t(b.timers.live.size === 0 && JSON.stringify(s.counts()) === '{"timers":0,"subs":0,"resets":0,"storeOpened":false}', '  타이머가 전부 멈췄고 등록이 0 이다');
  t(called.join() === 'unsub2,unsub1,reset2,reset1', '  구독 해제 → 비우기 훅 순서 · 각각 나중에 등록한 것부터 한 번씩');
  t(b.ev.join() === 'open:u1,close' && !s.alive(), '  계정 칸을 닫았고 세션은 끝났다');
  b.timers.tick();
  t(called.join() === 'unsub2,unsub1,reset2,reset1', '  dispose 뒤 시계를 돌려도 타이머 콜백이 안 돈다');
  /* 3 */
  b = build(src);
  const s3 = b.mk('u1'); const c3 = [];
  s3.setTimeout(() => c3.push('to'), 10); s3.setInterval(() => c3.push('iv'), 10);
  b.timers.tick();
  t(c3.join() === 'to,iv' && s3.counts().timers === 1, '한 번짜리 타이머는 한 번 돌고 목록에서 빠진다 · 반복은 남는다');
  const h = s3.setInterval(() => c3.push('iv2'), 10);
  s3.clearInterval(h); s3.clearInterval(h); s3.clearInterval(99999);
  t(s3.counts().timers === 1 && !b.timers.live.has(h), '세션 타이머를 clear 하면 빠진다 · 두 번 · 모르는 손잡이 clear 는 조용히 무시');
  const foreign = b.timers.setInterval(() => c3.push('foreign'));
  s3.clearInterval(foreign);
  t(b.timers.live.has(foreign), '세션이 만들지 않은 손잡이는 clear 하지 않는다');
  const bt = build(src, { timers: fakeTimers({ ignoreClear: true }) });
  const s3b = bt.mk('u1'); const c3b = [];
  s3b.setInterval(() => c3b.push('iv'), 10); s3b.setTimeout(() => c3b.push('to'), 10);
  s3b.dispose(); bt.timers.tick();
  t(c3b.length === 0, 'clear 가 안 먹는 타이머여도 끝난 세션의 콜백은 돌지 않는다(alive 확인)');
  /* 4 */
  b = build(src);
  const s4 = b.mk('u1'); let n4 = 0;
  s4.on(() => n4++); s4.onReset(() => n4++);
  const first = s4.dispose(); const second = quiet(() => s4.dispose());
  t(first === true && second[0] === false && n4 === 2, '두 번 dispose 해도 두 번째는 false · 아무것도 다시 안 부른다');
  const late = quiet(() => {
    const ev0 = []; let un = 0, rs = 0;
    const iv = s4.setInterval(() => ev0.push('iv'), 5), to = s4.setTimeout(() => ev0.push('to'), 5);
    const off = s4.on(() => un++); s4.onReset(() => rs++);
    b.timers.tick();
    return { iv, to, un, rs, live: b.timers.live.size, ev0, off };
  });
  t(late[0].iv === null && late[0].to === null && late[0].live === 0 && late[0].ev0.length === 0, '끝난 뒤 타이머 등록은 거절(null) — 시계에 안 올라간다');
  t(late[0].un === 1 && late[0].rs === 1, '끝난 뒤 구독 · 비우기 훅 등록은 바로 한 번 풀린다');
  t(late[1].length === 4 && late[1].every((m) => /끝난 세션/.test(m)), '  등록할 때마다 경고 한 줄(4번)');
  late[0].off();
  b = build(src);
  const s4b = b.mk('u1'); const order = [];
  s4b.on(() => { order.push('a'); throw new Error('깨짐'); }); s4b.on(() => order.push('b'));
  s4b.onReset(() => { order.push('r'); throw new Error('깨짐'); }); s4b.onReset(() => order.push('r2'));
  s4b.openStore();
  const th = quiet(() => s4b.dispose());
  t(th[0] === true && order.join() === 'b,a,r2,r' && b.ev.join() === 'open:u1,close' && th[1].length === 2, '하나가 던져도 나머지는 다 돈다 · 계정 칸도 닫는다 · 던진 만큼 경고');
  b = build(src);
  const s4c = b.mk('u1'); let inner = 0; let innerWarn = null;
  s4c.onReset(() => { innerWarn = quiet(() => s4c.onReset(() => { inner++; })); });
  s4c.dispose();
  t(inner === 1 && innerWarn && innerWarn[1].length === 1, 'dispose 도중에 새로 등록해도 새지 않는다(바로 풀리고 경고)');
  const s4d = build(src).mk('u1'); let once = 0;
  const off = s4d.on(() => once++); off(); off(); s4d.dispose();
  t(once === 1, '구독을 손으로 먼저 풀면 한 번만 풀리고 dispose 가 다시 안 부른다');
  /* 5 */
  b = build(src);
  const A = b.mk('ua1'); const logA = [];
  A.openStore(); A.setInterval(() => logA.push('A:iv'), 1); A.on(() => logA.push('A:unsub')); A.onReset(() => logA.push('A:reset'));
  const lateA = A.ifAlive((x) => { logA.push('A:late:' + x); return x; });
  A.dispose();
  const B = b.mk('ub2'); const logB = [];
  B.openStore(); B.setInterval(() => logB.push('B:iv'), 1); B.on(() => logB.push('B:unsub')); B.onReset(() => logB.push('B:reset'));
  const lateB = B.ifAlive((x) => x);
  t(JSON.stringify(A.counts()) === '{"timers":0,"subs":0,"resets":0,"storeOpened":false}' && JSON.stringify(B.counts()) === '{"timers":1,"subs":1,"resets":1,"storeOpened":true}', 'A 를 버려도 새 세션 B 는 깨끗하게 자기 것만 가진다(A 0 · B 1/1/1)');
  b.timers.tick();
  t(logA.join() === 'A:unsub,A:reset' && logB.join() === 'B:iv', 'A 가 끝난 뒤 시계를 돌리면 B 의 타이머만 돈다 — A 의 것은 하나도 안 돈다');
  t(lateA('x') === undefined && !logA.some((l) => /late/.test(l)) && lateB('y') === 'y', '늦게 도착한 답 — A 것은 ifAlive 로 버려지고 B 것은 통과한다');
  t(!A.alive() && B.alive() && A.id !== B.id && A.code === 'ua1' && B.code === 'ub2', 'alive() · 세션 번호 · 계정 코드가 세션마다 따로다');
  B.dispose();
  t(logB.join() === 'B:iv,B:unsub,B:reset' && b.ev.join() === 'open:ua1,close,open:ub2,close', 'B 를 버리면 B 것만 풀리고 A 는 다시 안 풀린다 · 칸은 열고 닫기를 세션마다 한 번씩');
  /* 6 */
  b = build(src);
  const s6 = b.mk('u1');
  t(s6.openStore() === true && s6.openStore() === true && b.ev.join() === 'open:u1', '계정 칸은 한 번만 연다(두 번째는 열린 채 true)');
  b = build(src, { openFail: true });
  const s6b = b.mk('u1');
  t(s6b.openStore() === false && s6b.counts().storeOpened === false, '못 열면 false · 열린 것으로 치지 않는다');
  s6b.dispose();
  t(b.ev.join() === 'open:u1', '  못 열었으면 dispose 가 닫기를 부르지 않는다');
  b = build(src);
  const s6c = b.mk('u1'); s6c.dispose();
  const lateOpen = quiet(() => s6c.openStore());
  t(lateOpen[0] === false && b.ev.length === 0 && lateOpen[1].length === 1, '끝난 세션은 계정 칸을 열지 않는다(경고)');
  b = build(src);
  const s6d = b.mk('u1'); s6d.dispose();
  t(b.ev.length === 0, '열지 않은 세션을 버려도 계정 칸 닫기는 안 부른다');
  return r;
}

(async () => {
  say('── 1~6. 세션을 실제로 돌려 본다');
  judge(MOD).forEach(([ok, msg]) => chk(ok, msg));

  say('── 7. 연결 — html · smoke · app.js');
  {
    const order = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((x) => x[1]);
    const iS = order.indexOf('shared/session.js');
    chk(iS > 0 && iS < order.indexOf('launcher/app-boot.js') && iS < order.indexOf('app.js'), 'html — session.js 를 app-boot.js · app.js 보다 먼저 싣는다');
    chk(!SMOKE || /PRELOAD\.push\('session\.js'\)/.test(SMOKE), 'smoke PRELOAD 에 session.js');
    chk(!/typeof [\w.]+ *[!=]==? *'function'/.test(MOD), 'session.js — 새 typeof 함수 가드가 없다');
    chk(!/\b(?:window\.)?(?:getMyUserId|localStorage|firebaseAPI)\b/.test(MOD.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'session.js — 도메인 · 저장소를 모른다(deps 로만 받는다)');
  }

  say('── 8. 일부러 깨 보기 — 빨강이 나야 한다');
  const breaks = [
    ['dispose 가 타이머를 안 끔', (m) => m.replace("      try{ timers.clearInterval(h); timers.clearTimeout(h); }catch(e){ console.warn('[session ' + id + '] 타이머 끄기 실패', e); }", '')],
    ['dispose 가 구독을 안 풂', (m) => m.replace("    for(const u of subs) runOnce(u, '구독 해제');", '')],
    ['dispose 가 비우기 훅을 안 부름', (m) => m.replace("    for(const r of hooks) runOnce(r, '비우기');", '')],
    ['dispose 가 계정 칸을 안 닫음', (m) => m.replace("      try{ closeAccountStore(); }catch(e){ console.warn('[session ' + id + '] 계정 칸 닫기 실패', e); }", '')],
    ['두 번째 dispose 가 또 돎', (m) => m.replace('    if(!alive) return false;\n    alive = false;', '    alive = false;')],
    ['dispose 가 alive 를 안 내림', (m) => m.replace('    alive = false;   // 먼저', '    // 먼저')],
    ['구독 해제 순서가 등록 순', (m) => m.replace('Array.from(unsubs).reverse()', 'Array.from(unsubs)')],
    ['끝난 뒤 타이머를 받아 줌', (m) => m.replace("    if(!alive){ late('타이머'); return null; }\n    const h = timers.setInterval", '    const h = timers.setInterval')],
    ['끝난 뒤 구독을 안 풀고 쌓음', (m) => m.replace("    if(!alive){ late('구독'); runOnce(unsub, '구독 해제'); return () => {}; }\n", '')],
    ['끝난 뒤 비우기 훅을 안 부름', (m) => m.replace("    if(!alive){ late('비우기 훅'); runOnce(fn, '비우기'); return; }\n", '')],
    ['타이머 콜백이 alive 를 안 봄(반복)', (m) => m.replace('timers.setInterval(() => { if(alive) fn(); }, ms)', 'timers.setInterval(fn, ms)')],
    ['타이머 콜백이 alive 를 안 봄(한 번)', (m) => m.replace('if(alive) fn(); }, ms);\n    timerHandles.add(h);\n    return h;\n  }\n  function clearIntervalIn', 'fn(); }, ms);\n    timerHandles.add(h);\n    return h;\n  }\n  function clearIntervalIn')],
    ['한 번짜리 타이머가 목록에 남음', (m) => m.replace('timerHandles.delete(h); if(alive) fn();', 'if(alive) fn();')],
    ['던지면 나머지가 멈춤', (m) => m.replace("    try{ fn(); }catch(e){ console.warn('[session ' + id + '] ' + label + ' 실패', e); }", '    fn();')],
    ['ifAlive 가 끝난 세션에도 부름', (m) => m.replace('(alive ? fn(...args) : undefined)', 'fn(...args)')],
    ['세션 번호가 늘 같음', (m) => m.replace('const id = ++seq;', 'const id = 1;')],
    ['세션끼리 등록을 공유', (m) => m.replace('  const unsubs = new Set();', '  const unsubs = SHARED_UNSUBS;').replace("let seq = 0;", "let seq = 0;\nconst SHARED_UNSUBS = new Set();")],
    ['계정 칸을 두 번 엶', (m) => m.replace('    if(storeOpened) return true;\n', '')],
    ['못 열어도 열린 것으로 침', (m) => m.replace('storeOpened = openAccountStore(code) === true;', 'openAccountStore(code); storeOpened = true;')],
    ['끝난 세션이 계정 칸을 엶', (m) => m.replace("    if(!alive){ console.warn('[session ' + id + '] 끝난 세션이라 계정 칸을 열지 않아요'); return false; }\n", '')],
    ['계정 없이도 만들어짐', (m) => m.replace("if(!me || typeof me.userCode !== 'string' || !me.userCode) throw new Error('[session] 계정(me.userCode)이 없어요');", '')],
    ['남의 손잡이도 clear', (m) => m.replace('function clearIntervalIn(h){ if(timerHandles.delete(h)) timers.clearInterval(h); }', 'function clearIntervalIn(h){ timerHandles.delete(h); timers.clearInterval(h); }')],
  ];
  for (const [name, fm] of breaks) {
    const m2 = fm(MOD);
    if (m2 === MOD) { chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    let red = false;
    try { red = judge(m2).some(([ok]) => !ok); } catch (_) { red = true; }
    chk(red, name);
  }
  const htmlBad = HTML.replace('<script src="parts/shared/session.js"></script>', '');
  const ob = [...htmlBad.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((x) => x[1]);
  chk(!(ob.indexOf('shared/session.js') > 0), 'html 에 안 실으면 빨강');
  const tg = MOD.replace('  const id = ++seq;', "  const id = ++seq; if(typeof timers.setInterval === 'function') timers.setInterval;");
  chk(/typeof [\w.]+ *[!=]==? *'function'/.test(tg), 'typeof 가드를 넣으면 7절 판정이 빨강');

  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
