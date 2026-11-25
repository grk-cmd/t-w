/* sim-app-boot.js — 🚀 켜는 순서 한 곳(app-boot.js) — 계정 확인 뒤에만, 정해진 차례 · 때로, 한 번만
   실행:  node checks/run.js sim-app-boot
   ★ 왜 이 검사가 있는가 — 기능마다 «계정 확인 전 · 실패 · 나중에 확인» 을 버티는 장치가 서른 개 생겼고, 검토 때마다 다른 갈래로 같은 구멍이 나왔다.
     시작을 «들어간 뒤» 한 곳으로 모았으니 그 한 곳을 실제로 돌려 본다(가짜 세션 시계 위에서).
   ・1절: 만들기만 하면 아무것도 안 부른다 · 차례 표(이름 · 때) 그대로 · 내놓는 것 begin · open · getSession
   ・2절: 들어감 — 옮기기 → 계정 칸 → 등록 → FIRST(첫 화면 읽기) → 업데이트 확인 통과 → realtime → READY → 첫 화면 뒤 LATER(사이를 두고) · OPEN 은 열 때만
   ・3절: 업데이트 확인을 통과 못 하면(강제) FIRST 뒤 아무것도 · 등록 [취소] · 계정 칸 못 엶 · 빈 me
   ・4절: 두 번 부르면 무시 · 한 칸이 던져도 다음 칸 · 표와 starts 가 어긋나면 던짐
   ・5절: «접속 중…» — LATER 읽기가 2초 안에 안 끝나면 띄우고 끝나면 내림 · 빨리 끝나면 안 띄움 · 첫 화면이 3초 넘게 안 그려져도 LATER 는 시작
   ・6절: 연결 — app.js 의 starts 가 표와 같은 이름 · 각 시작은 app.js 에서 한 번만 · html 순서 · smoke PRELOAD
   ・7절: mutation test */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('launcher/app-boot.js'), HTML = read('desk-companion-prototype.html'), APP = read('app.js'), SMOKE = read('smoke.js');
if (!MOD || !HTML || !APP) { say('  ? 원본 못 찾음 — app-boot.js · desk-companion-prototype.html · app.js'); process.exit(2); }

/* 정본 차례 · 때 — app-boot.js STEPS 와 같아야 한다(바꾸려면 여기와 app-boot.js · app.js starts 를 같이) */
const FIRST = ['userLocal', 'catalog', 'closet'];
const READY = ['focusTotal', 'focusShare', 'pomodoro', 'gift', 'roomInvite', 'awayPic', 'desktopBg', 'licensePremium', 'adminMode'];
const LATER = ['focusLevel', 'weeklyChal', 'mhInit', 'bugBadge', 'scheduler', 'invites', 'appVersion', 'firstRun', 'licenseAutoRegister', 'catalogGlb'];
const OPEN = ['gacha', 'playlist', 'ddays'];
const ORDER = [...FIRST, ...READY, ...LATER, ...OPEN];
const TABLE = [...FIRST.map((n) => [n, 'first']), ...READY.map((n) => [n, 'ready']), ...LATER.map((n) => [n, 'later']), ...OPEN.map((n) => [n, 'open'])];

/* 가짜 시계 — 세션 타이머 · 기다림을 손으로 돌린다 */
function mkClock(){
  const c = { t: 0, q: [] };
  c.set = (fn, ms) => { c.q.push({ at: c.t + ms, fn }); return c.q.length; };
  c.run = async (ms) => { const end = c.t + ms; for(;;){ await flushAll(); c.q.sort((a, b) => a.at - b.at); const n = c.q[0]; if(!n || n.at > end) break; c.q.shift(); c.t = n.at; n.fn(); } c.t = end; await flushAll(); };
  return c;
}
const flushAll = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };

function build(src, o) {
  o = o || {};
  const win = {};
  new Function('window', src)(win);
  const ev = [];
  const made = [];
  const navFns = {};
  const twNav = { NAV: { ACCOUNT_ENTERED: 'accountEntered' }, on: (name, fn) => { navFns[name] = fn; } };
  const clock = mkClock();
  const starts = {};
  const names = o.names || ORDER;
  const given = [];
  names.forEach((n) => { starts[n] = (code, me, session) => { given.push(session); ev.push('start:' + n + ':' + code + ':' + (me && me.userCode)); if (o.throwAt === n) throw new Error('깨짐 ' + n); if (o.rejectAt === n) return Promise.reject(new Error('비동기 깨짐 ' + n)); }; });
  if (o.extra) starts[o.extra] = () => {};
  if (o.omit) delete starts[o.omit];
  let paint, idleR, gateR;
  const painted = new Promise((r) => { paint = r; });
  const deps = {
    migrateLegacy: (code) => { ev.push('migrate:' + code); },
    twNav,
    newSession: (me) => { const s = { me, disposed: 0, live: true, resets: [], openStore: () => { ev.push('open:' + me.userCode); if (o.openThrow) throw new Error('깨짐 open'); return o.openFail ? false : true; },
      dispose: () => { s.disposed++; s.live = false; s.resets.splice(0).forEach((f) => f()); ev.push('dispose'); return true; }, alive: () => s.live,
      setTimeout: (fn, ms) => (s.live ? clock.set(fn, ms) : null), onReset: (fn) => { s.resets.push(fn); } }; made.push(s); return s; },
    registerDevice: () => { ev.push('register'); if (o.regThrow) return Promise.reject(new Error('깨짐 등록')); return Promise.resolve(o.reg || 'ok'); },
    toLogin: () => { ev.push('toLogin'); },
    updateGate: () => { ev.push('gate'); return o.gateHold ? new Promise((r) => { gateR = r; }) : Promise.resolve(o.gate === undefined ? true : o.gate); },
    goOnline: () => { ev.push('online'); },
    whenPainted: () => painted,
    idle: () => { ev.push('idle?'); return new Promise((r) => { idleR = r; }); },
    holdToast: (msg) => { ev.push('toast:' + msg); return () => { ev.push('toast-off'); }; },
    starts,
  };
  const warns = [];
  const w0 = console.warn; console.warn = (...a) => { warns.push(a.join(' ')); };
  let boot = null, err = null;
  try { boot = win.TwAppBoot.createAppBoot(deps); } catch (e) { err = e; }
  console.warn = w0;
  const notify = (me) => navFns.accountEntered && navFns.accountEntered(me);
  return { win, boot, err, ev, warns, deps, navFns, notify, made, given, clock, paint: () => paint(), idle: () => idleR && idleR(), gate: (v) => gateR && gateR(v) };
}
const ME = { userCode: 'u1', friendCode: 'MATE-AAAA' };
const flush = () => new Promise((r) => setTimeout(r, 0));
const quiet = async (fn) => { const w0 = console.warn; const w = []; console.warn = (...a) => w.push(a.join(' ')); try { return [await fn(), w]; } finally { console.warn = w0; } };
const startsOf = (ev) => ev.filter((e) => e.startsWith('start:')).map((e) => e.split(':')[1]);

async function judge(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 1 */
  let b = build(src);
  t(!b.err && b.boot && b.ev.length === 0, '만들기만 하면 아무것도 안 부른다(옛 값 옮기기 · realtime · 시작 0)' + (b.err ? ' — ' + b.err.message : ''));
  t(b.win.TwAppBoot && JSON.stringify(b.win.TwAppBoot.STEPS) === JSON.stringify(TABLE), '차례 표 — ' + ORDER.length + '칸 · 첫 화면 ' + FIRST.length + ' · 바로 ' + READY.length + ' · 첫 화면 뒤 ' + LATER.length + ' · 열 때 ' + OPEN.length);
  t(b.boot && Object.keys(b.boot).join() === 'begin,open,getSession' && Object.keys(b.navFns).join() === 'accountEntered', '내놓는 것은 begin · open · getSession · «계정에 들어감» 알림에 건다');
  t(b.boot && b.boot.getSession() === null && b.made.length === 0, '  들어가기 전에는 세션이 없다');
  /* 2 */
  b = build(src);
  const r1 = await quiet(async () => b.notify(ME));
  const pre = ['migrate:u1', 'open:u1', 'register', ...FIRST.map((n) => 'start:' + n + ':u1:u1'), 'gate', 'online', ...READY.map((n) => 'start:' + n + ':u1:u1')];
  t(r1[0] === true && b.ev.join() === pre.join(), '들어감 — 옮기기 → 계정 칸 → 등록 → 첫 화면 읽기(FIRST) → 업데이트 확인 → realtime → 바로(READY) · 첫 화면 전엔 LATER 0');
  await b.clock.run(100);
  t(!startsOf(b.ev).some((n) => LATER.includes(n)), '  첫 화면을 그리기 전(0.1초)에는 안 보이는 읽기(LATER)를 시작하지 않는다');
  b.paint(); await b.clock.run(1);
  t(startsOf(b.ev).filter((n) => LATER.includes(n)).join() === LATER[0], '  첫 화면을 그리면 LATER 첫 칸을 바로 시작한다');
  await b.clock.run(110);
  t(startsOf(b.ev).filter((n) => LATER.includes(n)).length === 1, '  다음 칸은 사이(' + b.win.TwAppBoot.LATER_GAP_MS + 'ms)를 둔다 — 한꺼번에 몰리지 않게');
  await b.clock.run(b.win.TwAppBoot.LATER_GAP_MS * LATER.length);
  t(startsOf(b.ev).filter((n) => LATER.includes(n)).join() === LATER.join(), '  LATER 를 표 순서대로 다 시작한다');
  t(!startsOf(b.ev).some((n) => OPEN.includes(n)), '  창을 열기 전에는 OPEN 칸(가챠 · 플레이리스트 · 디데이)을 시작하지 않는다');
  b.boot.open('playlist'); b.boot.open('playlist'); await flushAll();
  t(startsOf(b.ev).filter((n) => n === 'playlist').length === 1 && !startsOf(b.ev).includes('gacha'), '  open(이름) — 그 칸만 한 번(두 번째는 무시)');
  let threw = null; try { b.boot.open('mhInit'); } catch (e) { threw = e; }
  t(threw && /열 때 시작하는 칸이 아니에요/.test(threw.message), '  OPEN 칸이 아닌 이름은 던진다(오타 · 엉뚱한 칸을 두 번 시작하지 않게)');
  t(ORDER.filter((n) => n !== 'gacha' && n !== 'ddays').every((n) => startsOf(b.ev).filter((x) => x === n).length === 1) && b.given.every((g) => g === b.made[0]), '  각 기능은 정확히 한 번 · 모두 같은 세션을 받는다');
  b = build(src, { gateHold: true });
  await quiet(async () => { const p = b.notify(ME); await flushAll(); b.boot.open('gacha'); await flushAll(); const before = startsOf(b.ev).includes('gacha'); b.gate(true); await p; await flushAll(); b.ev.push('before:' + before); });
  t(b.ev.includes('before:false') && startsOf(b.ev).includes('gacha'), '  업데이트 확인 전에 연 창(OPEN)은 통과한 뒤 시작한다');
  /* 3 */
  b = build(src, { gate: false });
  const rg = await quiet(async () => b.notify(ME));
  await b.clock.run(5000); b.paint(); await b.clock.run(5000);
  t(rg[0] === false && startsOf(b.ev).join() === FIRST.join() && !b.ev.includes('online') && rg[1].some((w) => /업데이트 확인을 통과하지 못해/.test(w)), '★ 업데이트 확인을 통과 못 하면(강제) 첫 화면 읽기 뒤 realtime · 기능 0');
  b.boot.open('playlist'); await flushAll();
  t(!startsOf(b.ev).includes('playlist'), '  그때 창을 열어도 시작하지 않는다');
  b = build(src, { reg: 'canceled' });
  const rc = await quiet(async () => b.notify(ME));
  t(rc[0] === false && b.ev.join() === 'migrate:u1,open:u1,register,dispose,toLogin' && b.boot.getSession() === null, '★ 등록 [취소] — 세션을 끝내고 로그인 화면 · 첫 화면 읽기도 0');
  for (const [lab, opt] of [['실패', { reg: 'failed' }], ['던짐', { regThrow: true }]]) {
    b = build(src, opt);
    const rf = await quiet(async () => b.notify(ME));
    t(rf[0] === true && b.ev.includes('online') && !b.ev.includes('toLogin'), '  등록 ' + lab + ' — 그대로 이어 간다');
  }
  b = build(src, { openFail: true });
  const of = await quiet(async () => b.notify(ME));
  t(of[0] === false && b.ev.join() === 'migrate:u1,open:u1,dispose' && b.boot.getSession() === null, '계정 칸을 못 열면 시작 0번 · 세션 끝냄');
  b = build(src);
  const e0 = await quiet(async () => [await b.notify(null), await b.notify({}), await b.notify({ userCode: '' })]);
  t(e0[0].join() === 'false,false,false' && b.ev.length === 0, '계정이 없는 me 로는 시작 0번');
  /* 4 */
  b = build(src);
  const dbl = await quiet(async () => Promise.all([b.notify(ME), b.notify(ME), b.boot.begin(ME)]));
  t(dbl[0].join() === 'true,false,false' && b.ev.filter((e) => e === 'migrate:u1').length === 1 && b.ev.filter((e) => e === 'online').length === 1 && dbl[1].some((w) => /이미 시작했어요/.test(w)), '두 번 부르면 두 번째부터 무시 + 경고');
  b = build(src, { throwAt: 'catalog', rejectAt: 'gift' });
  const th = await quiet(async () => { const v = await b.notify(ME); await flushAll(); return v; });
  t(th[0] === true && startsOf(b.ev).includes('closet') && startsOf(b.ev).includes('adminMode') && th[1].some((w) => /catalog 실패/.test(w)) && th[1].some((w) => /gift 실패/.test(w)), '한 칸이 던져도(동기 · 비동기) 다음 칸은 돈다 · 경고');
  const miss = build(src, { omit: 'closet' });
  t(miss.err && /closet/.test(miss.err.message), '표에 있는 시작이 빠지면 만들 때 던진다');
  const extra = build(src, { extra: '없는기능' });
  t(extra.err && /없는기능/.test(extra.err.message), '표에 없는 시작이 남으면 만들 때 던진다');
  /* 5 */
  b = build(src);
  await quiet(async () => b.notify(ME)); b.paint();
  await b.clock.run(1999);
  t(!b.ev.some((e) => e.startsWith('toast:')), '«접속 중…» — 2초 전에는 안 띄운다');
  await b.clock.run(b.win.TwAppBoot.LATER_GAP_MS * LATER.length);
  t(b.ev.includes('toast:접속 중…'), '  LATER 읽기가 2초 안에 안 끝나면 띄운다');
  b.idle(); await flushAll();
  t(b.ev[b.ev.length - 1] === 'toast-off', '  읽기가 다 끝나면 내린다');
  b = build(src);
  await quiet(async () => b.notify(ME)); b.paint();
  await b.clock.run(b.win.TwAppBoot.LATER_GAP_MS * LATER.length); b.idle(); await b.clock.run(3000);
  t(!b.ev.some((e) => e.startsWith('toast')), '  2초 안에 끝나면 띄우지 않는다');
  b = build(src);
  await quiet(async () => b.notify(ME)); await b.clock.run(2999);
  const noYet = !startsOf(b.ev).some((n) => LATER.includes(n));
  await b.clock.run(2);
  t(noYet && startsOf(b.ev).includes(LATER[0]), '첫 화면이 3초 넘게 안 그려지면(캐릭터 그림이 느림) LATER 를 그냥 시작한다');
  b = build(src);
  await quiet(async () => b.notify(ME)); b.paint(); await b.clock.run(1); b.made[0].dispose(); await b.clock.run(5000);
  t(startsOf(b.ev).filter((n) => LATER.includes(n)).length === 1, '  세션이 끝나면 남은 LATER 는 시작하지 않는다');
  return r;
}

(async () => {
  say('── 1~5. app-boot 를 실제로 돌려 본다');
  const rows = await judge(MOD);
  rows.forEach(([ok, msg]) => chk(ok, msg));

  say('── 6. 연결 — app.js · html · smoke');
  {
    const m = APP.match(/const appBoot = TwAppBoot\.createAppBoot\(\{[\s\S]*?\n {2}starts: \{\n([\s\S]*?)\n {2}\},\n\}\);/);
    const keys = m ? [...m[1].matchAll(/^ {4}(\w+): /gm)].map((x) => x[1]) : [];
    chk(!!m && JSON.stringify(keys) === JSON.stringify(ORDER), 'app.js 의 starts 가 표와 같은 이름 · 같은 차례(' + keys.length + '칸)');
    const body = m ? m[1] : '';
    const rest = APP.replace(body, '');
    const starters = ['startFocusTotal', 'startFocus', 'startChallenge', 'startGacha', 'startCloset', 'startSchedule', 'startReceive', 'startBgSync', 'refreshInviteBtn', 'loadBoard'];
    const restOk = (n) => !new RegExp('\\.' + n + '\\(').test(rest) || n === 'refreshInviteBtn';   // 초대장 버튼은 발급 · 관리자 모드 뒤에도 그 자리에서 다시 그린다
    chk(starters.every((n) => body.split(n + '(').length === 2) && starters.every(restOk) && !/licenseGateMod\.refreshInviteBtn\(\)/.test(rest), '  기능 시작은 app.js 에서 이 표 한 곳에서만 부른다(만든 자리에서 바로 부르지 않음)');
    chk(body.split('licensePremiumMod.start(').length === 2 && !/licensePremiumMod\.start\(/.test(rest), '  프리미엄 판정 시작(license-premium.js start — 받아 둔 확인을 반영하고 알림을 건다)도 이 표 한 곳에서만 부른다');
    chk(/^ {4}licenseAutoRegister: \(\)=>licensePremiumMod\.autoRegisterAfter\(firstRunMod\.licenseDone\(\)\),/m.test(body) && !/autoRegisterAfter\(/.test(rest) && ORDER.indexOf('licenseAutoRegister') > ORDER.indexOf('firstRun'),
      '  자동 등록은 첫 실행 뒤 칸(licenseAutoRegister) 한 곳 — 첫 실행의 라이선스 키 단계 결과(licenseDone)를 받아 주인을 하나로');
    /* 공지는 모두에게 같은 공용 데이터 — 계정 확인을 기다리지 않고 켤 때 받는다(로그인 화면 위에도 업데이트 공지 · 런처 배너) */
    const noticeAtBoot = (ap, bodyTxt) => /^TwNetReady\.whenNetReady\(\(\)=>noticeFeed\.start\(\)\);$/m.test(ap) && !/noticeFeed\.start\(\)/.test(bodyTxt);
    chk(noticeAtBoot(APP, body), '공지 받기는 계정 확인을 기다리지 않는다 — 켤 때(firebase-ready) 시작하고 차례 표에는 없다');
    chk(!noticeAtBoot(APP.replace('TwNetReady.whenNetReady(()=>noticeFeed.start());', ''), body) && !noticeAtBoot(APP, body + '\n notice: ()=>noticeFeed.start(),'), '  mutation test — 로그인 전에 공지 받기가 안 돌거나 다시 차례 표에 넣으면 빨강');
    chk(!/accountStoreMod\.migrateLegacy\(getMyUserId\(\)\)/.test(APP) && !/mhInitMod\.initMyHome\(\);/.test(rest) && !/plMod\.pull\(\)/.test(rest.replace(/plPull[^\n]*\n/g, '')), '  확인 전에 돌던 자리(옮기기 줄 · initMyHome · 플레이리스트 받기)가 app.js 에 남지 않았다');
    chk(/^ {4}openAccountStore: \(code\)=>accountStoreMod\.open\(code\),$/m.test(APP) && APP.split('accountStoreMod.open(').length === 2, '  계정 칸 열기는 app-boot 연결 한 곳뿐(다른 길에서 열지 않는다)');
    const order = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((x) => x[1]);
    chk(order.indexOf('launcher/app-boot.js') > 0 && order.indexOf('launcher/app-boot.js') < order.indexOf('app.js'), 'html — app-boot.js 를 app.js 보다 먼저 싣는다');
    chk(!SMOKE || /PRELOAD\.push\('app-boot\.js'\)/.test(SMOKE), 'smoke PRELOAD 에 app-boot.js');
    chk(order.indexOf('launcher/user-local.js') > 0 && order.indexOf('launcher/user-local.js') < order.indexOf('app.js') && (!SMOKE || /PRELOAD\.push\('user-local\.js'\)/.test(SMOKE)), 'html — user-local.js(맨 앞 userLocal 칸이 부르는 조각 목록)를 app.js 보다 먼저 싣는다 · smoke PRELOAD 에도');
    const oos = read('launcher/open-on-show.js');
    chk(!!oos && order.indexOf('launcher/open-on-show.js') > 0 && order.indexOf('launcher/open-on-show.js') < order.indexOf('app.js') && (!SMOKE || /PRELOAD\.push\('open-on-show\.js'\)/.test(SMOKE)), 'html — open-on-show.js 를 app.js 보다 먼저 · smoke PRELOAD 에도');
    const oc = (APP.match(/TwOpenOnShow\.createOpenOnShow\(\{[\s\S]*?\n\}\)\.start\(\);/) || [''])[0];
    const named = [...oc.matchAll(/name: '(\w+)'/g)].map((x) => x[1]);
    chk(/open: \(name\)=>appBoot\.open\(name\)/.test(oc) && OPEN.every((n) => named.includes(n)) && named.every((n) => OPEN.includes(n)), '  창 지켜보기가 OPEN 칸 셋(' + OPEN.join(' · ') + ')을 다 걸고 app-boot open 으로 부탁한다');
  }

  say('── 7. mutation test — 빨강이 나야 한다');
  const breaks = [
    ['차례를 바꿈(catalog ↔ closet)', (m) => m.replace("  ['catalog', PHASE.FIRST],", "  ['TMP', PHASE.FIRST],").replace("  ['closet', PHASE.FIRST],", "  ['catalog', PHASE.FIRST],").replace("  ['TMP', PHASE.FIRST],", "  ['closet', PHASE.FIRST],")],
    ['친구(mhInit)를 첫 화면 전에', (m) => m.replace("  ['mhInit', PHASE.LATER],", "  ['mhInit', PHASE.READY],")],
    ['플레이리스트를 켤 때 받음', (m) => m.replace("  ['playlist', PHASE.OPEN],", "  ['playlist', PHASE.LATER],")],
    ['업데이트 확인을 안 기다림', (m) => m.replace("    try{ go = (await updateGate()) === true; }", "    try{ go = true; updateGate(); }")],
    ['업데이트 확인 전에 realtime', (m) => m.replace("    const s = session;\n", "    const s = session;\n    guard('realtime 연결', () => goOnline());\n")],
    ['첫 화면을 안 기다림', (m) => m.replace("    await Promise.race([Promise.resolve(whenPainted()).catch(() => {}), nap(s, PAINT_WAIT_MAX_MS)]);", "")],
    ['첫 화면을 끝없이 기다림', (m) => m.replace("    await Promise.race([Promise.resolve(whenPainted()).catch(() => {}), nap(s, PAINT_WAIT_MAX_MS)]);", "    await Promise.resolve(whenPainted()).catch(() => {});")],
    ['LATER 를 한꺼번에', (m) => m.replace("      await nap(s, LATER_GAP_MS);\n", "")],
    ['세션이 끝나도 LATER 계속', (m) => m.replace("      if(!s.alive()) return;\n", "")],
    ['토스트를 바로 띄움', (m) => m.replace("}, CONNECTING_TOAST_MS);", "}, 0);")],
    ['토스트를 안 내림', (m) => m.replace("    done.then(end, end);", "")],
    ['열기를 두 번 시작', (m) => m.replace("    if(ran.has(name)) return Promise.resolve();\n", "")],
    ['확인 전 연 창을 잊음', (m) => m.replace("    for(const name of asked) run(name);\n", "")],
    ['옛 값 옮기기를 빼먹음', (m) => m.replace("    guard('옛 값 옮기기', () => migrateLegacy(code));\n", '')],
    ['못 열어도 기능을 시작', (m) => m.replace("      return false;\n    }\n    let reg", "    }\n    let reg")],
    ['시작에 세션을 안 넘김', (m) => m.replace('starts[name](code, myMe, session)', 'starts[name](code, myMe)')],
    ['알림에 begin 을 안 검', (m) => m.replace('twNav.on(twNav.NAV.ACCOUNT_ENTERED, begin);', '')],
    ['두 번 불러도 또 시작', (m) => m.replace("if(began){ console.warn('[app-boot] 이미 시작했어요 — 두 번째 시작은 무시해요'); return false; }", '')],
    ['한 칸이 던지면 다음 칸이 멈춤', (m) => m.replace("catch(e){ console.warn('[app-boot] ' + label + ' 실패', e); return Promise.resolve(); }", 'catch(e){ throw e; }')],
    ['표에 있는 시작이 빠져도 통과', (m) => m.replace("    if(typeof starts[name] !== 'function') throw new Error('[app-boot] 시작 함수가 없어요: ' + name);", '')],
    ['계정이 없는 me 로도 시작', (m) => m.replace('if(!me || !me.userCode) return false;', '')],
    ['취소해도 그대로 시작', (m) => m.replace("    if(reg === 'canceled'){", "    if(reg === 'never'){")],
    ['실패면 로그인 화면으로 보냄', (m) => m.replace("    if(reg === 'canceled'){", "    if(reg !== 'ok'){")],
  ];
  for (const [name, fm] of breaks) {
    const m2 = fm(MOD);
    if (m2 === MOD) { chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    let red = false;
    try { red = (await judge(m2)).some(([ok]) => !ok); } catch (_) { red = true; }
    chk(red, name);
  }
  const htmlBad = HTML.replace('<script src="parts/launcher/app-boot.js"></script>', '');
  const ob = [...htmlBad.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((x) => x[1]);
  chk(!(ob.indexOf('launcher/app-boot.js') > 0), 'html 에 안 실으면 빨강');

  say(pass + ' · ' + fail);
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
