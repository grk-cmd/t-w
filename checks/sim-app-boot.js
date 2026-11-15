/* sim-app-boot.js — 🚀 켜는 순서 한 곳(app-boot.js) — 계정 확인 뒤에만, 정해진 차례로, 세션마다 한 번만 · 끄기 end 의 차례
   실행:  node sim-app-boot.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 기능마다 «계정 확인 전 · 실패 · 나중에 확인» 을 버티는 장치가 서른 개 생겼고, 검토 때마다 다른 갈래로 같은 구멍이 나왔다
     (접속 고정이 지난 사본을 읽음 · 가입 필요인데 마이홈이 이미 씀 · 옛 값 옮기기가 확인 전에 엉뚱한 칸으로). 시작을 «들어간 뒤» 한 곳으로 모았으니 그 한 곳을 실제로 돌려 본다.
   ・1절: 만들기만 하면 아무것도 안 부른다 · 차례 표(열여섯 — 공지는 계정과 무관해 표에 없다 · 맨 앞 userLocal 은 이 계정이 고른 것을 계정 칸에서 읽는 칸) 그대로 · «계정에 들어감» 알림(nav)에 begin 을 건다
   ・2절: 들어감 알림 — 옛 값 옮기기(그 코드) → 계정 칸 열기 → realtime → 표 순서대로 한 번씩(코드 · me 를 받음)
   ・3절: 알림이 없으면(로그인 필요 · 가입 필요 · 서버 안 됨 · 바뀐 계정) 시작 0번 · 계정 없음(빈 me)도 0번
   ・4절: 두 번 부르면 두 번째는 무시(시작 한 번뿐) · 한 칸이 던져도(동기 · 비동기) 다음 칸은 돈다 · 표와 starts 가 어긋나면 만들 때 던진다
   ・5절: 같은 알림이 또 와도 시작은 한 번(살아 있는 세션이 있을 때) · 끄기 end — 올리기 → 연결 → 창 → dispose → 신원 → 화면 · ①이 막으면 뒤 0 · force · ending
   ・6절: 연결 — app.js 의 starts 가 표와 같은 이름 · 각 시작은 app.js 에서 한 번만 · html 순서 · smoke PRELOAD
   ・7절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('launcher/app-boot.js'), HTML = read('desk-companion-prototype.html'), APP = read('app.js'), SMOKE = read('smoke.js');
if (!MOD || !HTML || !APP) { say('  ? 원본 못 찾음 — app-boot.js · desk-companion-prototype.html · app.js'); process.exit(2); }

/* 정본 차례 — app-boot.js STEPS 와 같아야 한다(바꾸려면 여기와 app-boot.js · app.js starts 를 같이) */
const ORDER = ['userLocal', 'focusTotal', 'focusShare', 'focusLevel', 'weeklyChal', 'pomodoro', 'gacha', 'closet', 'mhInit', 'gift', 'bugBadge', 'scheduler', 'roomInvite', 'desktopBg', 'playlist', 'licensePremium', 'firstRun'];

function build(src, o) {
  o = o || {};
  const win = {};
  new Function('window', src)(win);
  const ev = [];
  const made = [];   // 만들어진 세션들
  const navFns = {};
  const twNav = { NAV: { ACCOUNT_ENTERED: 'accountEntered', ACCOUNT_LEAVE: 'accountLeave' }, on: (name, fn) => { navFns[name] = fn; ev.length === 0 && 0; } };
  const starts = {};
  const names = o.names || ORDER;
  const given = [];   // 각 시작이 세 번째 인자로 받은 세션
  names.forEach((n) => { starts[n] = (code, me, session) => { given.push(session); ev.push('start:' + n + ':' + code + ':' + (me && me.userCode)); if (o.throwAt === n) throw new Error('깨짐 ' + n); if (o.rejectAt === n) return Promise.reject(new Error('비동기 깨짐 ' + n)); }; });
  if (o.extra) starts[o.extra] = () => {};
  if (o.omit) delete starts[o.omit];
  const deps = {
    migrateLegacy: (code) => { ev.push('migrate:' + code); },
    twNav,
    newSession: (me) => { const s = { me, code: me.userCode, disposed: 0, openStore: () => { ev.push('open:' + me.userCode); if (o.openThrow) throw new Error('깨짐 open'); return o.openFail ? false : true; }, dispose: () => { s.disposed++; ev.push('dispose'); return true; } }; made.push(s); return s; },
    goOnline: () => { ev.push('online'); },
    flushCheck: async () => { ev.push('flush'); return o.flushFail || { ok: true }; },
    releaseConnection: async (why) => { ev.push('release:' + why); if (o.releaseThrow) throw new Error('깨짐 release'); },
    closeWindows: () => { ev.push('closeAll'); return []; },
    releaseIdentity: async (why, code) => { ev.push('identity:' + why + ':' + code); },
    afterEnd: (why) => { ev.push('after:' + why); },
    notifyError: (c) => { ev.push('err:' + c); },
    starts,
  };
  const warns = [];
  const w0 = console.warn; console.warn = (...a) => { warns.push(a.join(' ')); };
  let boot = null, err = null;
  try { boot = win.TwAppBoot.createAppBoot(deps); } catch (e) { err = e; }
  console.warn = w0;
  const notify = (me) => navFns.accountEntered && navFns.accountEntered(me);
  const leave = (a) => navFns.accountLeave(a);   // 계정 탭 · 끊김 화면이 nav.go(ACCOUNT_LEAVE, { why, force }) 하는 것   // 게이트가 nav.go(ACCOUNT_ENTERED, me) 하는 것
  return { win, boot, err, ev, warns, deps, navFns, notify, leave, made, given };
}
const ME = { userCode: 'u1', friendCode: 'MATE-AAAA' };
const flush = () => new Promise((r) => setTimeout(r, 0));
const quiet = async (fn) => { const w0 = console.warn; const w = []; console.warn = (...a) => w.push(a.join(' ')); try { return [await fn(), w]; } finally { console.warn = w0; } };

async function judge(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 1 */
  let b = build(src);
  t(!b.err && b.boot && b.ev.length === 0, '만들기만 하면 아무것도 안 부른다(옛 값 옮기기 · realtime · 시작 0)' + (b.err ? ' — ' + b.err.message : ''));
  t(b.win.TwAppBoot && JSON.stringify(b.win.TwAppBoot.STEPS) === JSON.stringify(ORDER), '차례 표 — ' + ORDER.length + '칸: ' + ORDER.join(' → '));
  t(b.boot && Object.keys(b.boot).join() === 'begin,end,getSession' && Object.keys(b.navFns).join() === 'accountEntered,accountLeave', '내놓는 것은 begin · end · getSession · «계정에 들어감» · «계정에서 나감» 알림에 건다');
  t(b.boot && b.boot.getSession() === null && b.made.length === 0, '  들어가기 전에는 세션이 없다(만들기만 하면 세션 0)');
  /* 2 */
  b = build(src);
  const r1 = await quiet(async () => b.notify(ME));
  t(r1[0] === true && b.ev.join() === ['migrate:u1', 'open:u1', 'online'].concat(ORDER.map((n) => 'start:' + n + ':u1:u1')).join(), '들어감 알림 — 옛 값 옮기기(그 코드) → 계정 칸 열기 → realtime → 표 순서대로 한 번씩(코드 · me 를 받음)');
  const iMig = b.ev.indexOf('migrate:u1'), iOn = b.ev.indexOf('online'), iFirst = b.ev.findIndex((e) => e.startsWith('start:'));
  const iOpen = b.ev.indexOf('open:u1');
  t(iMig === 0 && iOpen === 1 && iOpen < iOn && iOn < iFirst, '  옛 값 옮기기 → 계정 칸 열기(옮긴 뒤에야 연다) → realtime → 모든 기능 시작');
  t(ORDER.every((n) => b.ev.filter((e) => e.startsWith('start:' + n + ':')).length === 1), '  각 기능은 정확히 한 번');
  t(b.made.length === 1 && b.boot.getSession() === b.made[0] && b.made[0].me === ME && b.made[0].disposed === 0, '  들어가면 세션을 하나 만들어 들고 있다(getSession) — 아직 끝내지 않음');
  t(b.given.length === ORDER.length && b.given.every((g) => g === b.made[0]), '  모든 시작이 같은 세션을 세 번째 인자로 받는다');
  /* 3 */
  b = build(src, { openFail: true });
  const of = await quiet(async () => b.notify(ME));
  t(of[0] === false && b.ev.join() === 'migrate:u1,open:u1,dispose,err:E-ACC-05' && of[1].some((w) => /열지 못해/.test(w)), '계정 칸을 못 열면(false) realtime · 기능 시작 0번 + 경고 + 오류 번호 E-ACC-05 한 번 + 만든 세션은 바로 끝낸다');
  t(b.boot.getSession() === null && b.made[0].disposed === 1, '  못 열면 들고 있는 세션도 없다');
  b = build(src, { openThrow: true });
  const ot = await quiet(async () => b.notify(ME));
  t(ot[0] === false && b.ev.join() === 'migrate:u1,open:u1,dispose,err:E-ACC-05' && b.boot.getSession() === null, '계정 칸 열기가 던져도 시작 0번 · 세션 끝냄');
  b = build(src);
  t(b.ev.length === 0, '알림이 없으면(로그인 필요 · 가입 필요 · 서버 안 됨 · 바뀐 계정 → 게이트가 알리지 않음) 시작 0번');
  const e0 = await quiet(async () => [b.notify(null), b.notify({}), b.notify({ userCode: '' })]);
  t(e0[0].join() === 'false,false,false' && b.ev.length === 0, '계정이 없는 me(빈 값 · 코드 없음)로는 시작 0번');
  /* 4 */
  b = build(src);
  const dbl = await quiet(async () => [b.notify(ME), b.notify(ME), b.boot.begin(ME)]);
  t(dbl[0][0] === true && dbl[0][1] === false && dbl[0][2] === false && b.ev.filter((e) => e.startsWith('start:')).length === ORDER.length && b.ev.filter((e) => e === 'migrate:u1').length === 1 && b.ev.filter((e) => e === 'online').length === 1,
    '두 번 부르면 두 번째부터 무시 — 옮기기 · realtime · 시작이 한 번씩뿐');
  t(dbl[1].some((w) => /이미 시작했어요/.test(w)), '  무시할 때 콘솔에 경고 한 줄');
  b = build(src, { throwAt: 'gacha', rejectAt: 'closet' });
  const th = await quiet(async () => { const v = b.notify(ME); await flush(); return v; });
  t(th[0] === true && ORDER.every((n) => b.ev.some((e) => e.startsWith('start:' + n + ':'))) && th[1].some((w) => /gacha 실패/.test(w)) && th[1].some((w) => /closet 실패/.test(w)),
    '한 칸이 던져도(동기 gacha · 비동기 closet) 다음 칸은 돈다 · 어느 칸이 깨졌는지 경고');
  const miss = build(src, { omit: 'closet' });
  t(miss.err && /closet/.test(miss.err.message), '표에 있는 시작이 빠지면 만들 때 던진다(한 기능을 빼먹을 수 없다)');
  const extra = build(src, { extra: '없는기능' });
  t(extra.err && /없는기능/.test(extra.err.message), '표에 없는 시작이 남으면 만들 때 던진다');

  /* 5 — 끄기 end(why) */
  const after = (b2) => b2.ev.slice(b2.ev.indexOf('start:' + ORDER[ORDER.length - 1] + ':u1:u1') + 1);
  b = build(src); await quiet(async () => b.notify(ME));
  const e1 = await b.leave({ why: 'logout' });
  t(e1.ok === true && after(b).join() === 'flush,release:logout,closeAll,dispose,identity:logout:u1,after:logout', '★ 로그아웃 차례 — 올리기 · 검문 → 연결 놓기 → 창 모두 닫기 → 세션 끝내기(dispose) → 신원 놓기 → 끝난 뒤 화면  [' + after(b).join(' → ') + ']');
  t(b.boot.getSession() === null && b.made[0].disposed === 1, '  끝나면 들고 있는 세션이 없다 · dispose 한 번');
  const nf = { ok: false, kind: 'denied', reason: '못 올림', items: [{ label: '캐릭터 1개' }] };
  b = build(src, { flushFail: nf }); await quiet(async () => b.notify(ME));
  const e2 = await b.leave({ why: 'logout' });
  t(e2 === nf && after(b).join() === 'flush' && b.boot.getSession() === b.made[0] && b.made[0].disposed === 0, '★ ① 이 막으면 검문 결과를 돌려주고 아래는 하나도 안 돈다(연결 · 창 · 세션 · 신원 그대로 — dispose 0)');
  const e2b = await b.leave({ why: 'logout' });
  t(e2b === nf && after(b).filter((x) => x === 'flush').length === 2, '  사용자가 다시 누르면(막힌 뒤 ending 이 풀려) 다시 시도한다');
  b = build(src, { flushFail: nf }); await quiet(async () => b.notify(ME));
  const e3 = (await quiet(async () => b.leave({ why: 'logout', force: true })));
  t(e3[0].ok === true && after(b).join() === 'flush,release:logout,closeAll,dispose,identity:logout:u1,after:logout' && e3[1].some((w) => /강제로 나가요/.test(w)), '★ 두 번째 누름(force) — 막혀도 경고만 남기고 끝까지 나간다(S-Q1 나)');
  for(const why of ['withdraw', 'gone', 'auth']){
    b = build(src); await quiet(async () => b.notify(ME));
    const e4 = await b.leave({ why });
    t(e4.ok === true && after(b).join() === 'release:' + why + ',closeAll,dispose,identity:' + why + ':u1,after:' + why, why + ' — 올리기 · 검문 없이(올릴 까닭 없음) 연결 놓기 → 창 → dispose → 신원 → 끝난 뒤 화면');
  }
  b = build(src); await quiet(async () => b.notify(ME));
  const e5 = await b.leave({ why: 'logout', force: true }).catch((x) => x);
  b = build(src); await quiet(async () => b.notify(ME));
  const pend = b.leave({ why: 'logout' }); const second = await quiet(async () => b.leave({ why: 'gone' })); await pend;
  t(second[0].busy === true && second[1].some((w) => /끝내는 중/.test(w)) && b.ev.filter((x) => x === 'dispose').length === 1, '끝내는 중에 두 번째 end 는 거절(busy) + 경고 — dispose 한 번뿐');
  b = build(src); const e6 = await b.leave({ why: 'gone' });
  t(e6.ok === true && b.ev.join() === 'identity:gone:null,after:gone', '세션이 없으면(계정 칸 열기 전) 연결 · 창 · dispose 를 건너뛰고 신원 놓기부터');
  b = build(src, { releaseThrow: true }); await quiet(async () => b.notify(ME));
  let thrown = null; try{ await b.leave({ why: 'logout' }); }catch(x){ thrown = x; }
  t(thrown && /깨짐 release/.test(thrown.message) && !b.ev.includes('dispose'), '한 칸이 던지면 숨기지 않고 던진다(뒤 칸은 안 돈다) · ending 은 풀린다');
  let bad = null; try{ await build(src).leave({ why: '몰라' }); }catch(x){ bad = x; }
  t(bad && /까닭/.test(bad.message), '모르는 까닭은 던진다');
  b = build(src); await quiet(async () => b.notify(ME)); await b.leave({ why: 'gone' });
  b.ev.length = 0;
  const again = await quiet(async () => b.notify(ME));
  t(again[0] === true && b.made.length === 2 && b.made[1].disposed === 0 && ORDER.every((n) => b.ev.some((x) => x.startsWith('start:' + n + ':'))), '★ end 뒤 다시 들어가면 새 세션(번호 다름)으로 시작 함수가 다시 불린다(살아 있는 세션이 있을 때만 거절)');
  b = build(src); b.made.length = 0;
  const pe = b.leave({ why: 'gone' }); const dur = await quiet(async () => b.notify(ME)); await pe;
  t(dur[0] === false && dur[1].some((w) => /나가는 중/.test(w)), '나가는 중에 들어가기(begin)는 거절 + 경고');
  void e5;
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
    const starters = ['startFocusTotal', 'startFocus', 'startChallenge', 'startGacha', 'startCloset', 'startSchedule', 'startReceive', 'startBgSync'];
    chk(starters.every((n) => body.split(n + '(').length === 2) && starters.every((n) => !new RegExp('\\.' + n + '\\(').test(rest)), '  기능 시작은 app.js 에서 이 표 한 곳에서만 부른다(만든 자리에서 바로 부르지 않음)');
    chk(body.split('licensePremiumMod.start(').length === 2 && !/licensePremiumMod\.start\(/.test(rest), '  프리미엄 판정 시작(license-premium.js start — 받아 둔 확인을 반영하고 알림을 건다)도 이 표 한 곳에서만 부른다');
    /* 공지는 모두에게 같은 공용 데이터 — 계정 확인을 기다리지 않고 켤 때 받는다(로그인 화면 위에도 업데이트 공지 · 런처 배너) */
    const noticeAtBoot = (ap, bodyTxt) => /^TwNetReady\.whenNetReady\(\(\)=>noticeFeed\.start\(\)\);$/m.test(ap) && !/noticeFeed\.start\(\)/.test(bodyTxt);
    chk(noticeAtBoot(APP, body), '공지 받기는 계정 확인을 기다리지 않는다 — 켤 때(firebase-ready) 시작하고 차례 표에는 없다');
    chk(!noticeAtBoot(APP.replace('TwNetReady.whenNetReady(()=>noticeFeed.start());', ''), body) && !noticeAtBoot(APP, body + '\n notice: ()=>noticeFeed.start(),'), '  깨 보기 — 로그인 전에 공지 받기가 안 돌거나 다시 차례 표에 넣으면 빨강');
    chk(!/accountStoreMod\.migrateLegacy\(getMyUserId\(\)\)/.test(APP) && !/mhInitMod\.initMyHome\(\);/.test(rest) && !/plMod\.pull\(\)/.test(rest.replace(/plPull[^\n]*\n/g, '')), '  확인 전에 돌던 자리(옮기기 줄 · initMyHome · 플레이리스트 받기)가 app.js 에 남지 않았다');
    chk(/^ {4}openAccountStore: \(code\)=>accountStoreMod\.open\(code\),$/m.test(APP) && APP.split('accountStoreMod.open(').length === 2, '  계정 칸 열기는 app-boot 연결 한 곳뿐(다른 길에서 열지 않는다)');
    const order = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((x) => x[1]);
    chk(order.indexOf('launcher/app-boot.js') > 0 && order.indexOf('launcher/app-boot.js') < order.indexOf('app.js'), 'html — app-boot.js 를 app.js 보다 먼저 싣는다');
    chk(!SMOKE || /PRELOAD\.push\('app-boot\.js'\)/.test(SMOKE), 'smoke PRELOAD 에 app-boot.js');
    chk(order.indexOf('launcher/user-local.js') > 0 && order.indexOf('launcher/user-local.js') < order.indexOf('app.js') && (!SMOKE || /PRELOAD\.push\('user-local\.js'\)/.test(SMOKE)), 'html — user-local.js(맨 앞 userLocal 칸이 부르는 조각 목록)를 app.js 보다 먼저 싣는다 · smoke PRELOAD 에도');
  }

  say('── 7. 일부러 깨 보기 — 빨강이 나야 한다');
  const breaks = [
    ['차례를 바꿈(가챠 ↔ 달성표)', (m) => m.replace("  'weeklyChal',", "  'TMP',").replace("  'gacha', ", "  'weeklyChal', ").replace("  'TMP',", "  'gacha',")],
    ['옛 값 옮기기를 시작 뒤로', (m) => m.replace("    guard('옛 값 옮기기', () => migrateLegacy(code));\n", '').replace("    for(const name of STEPS) guard(name, () => starts[name](code, me, session));", "    for(const name of STEPS) guard(name, () => starts[name](code, me, session));\n    guard('옛 값 옮기기', () => migrateLegacy(code));")],
    ['realtime 을 시작 뒤로', (m) => m.replace("    guard('realtime 연결', () => goOnline());\n    for(const name of STEPS) guard(name, () => starts[name](code, me, session));", "    for(const name of STEPS) guard(name, () => starts[name](code, me, session));\n    guard('realtime 연결', () => goOnline());")],
    ['못 열어도 기능을 시작', (m) => m.replace("      return false;\n    }\n    guard('realtime", "    }\n    guard('realtime")],
    ['계정 칸을 안 엶', (m) => m.replace('session = newSession(me); opened = session.openStore() === true;', 'session = newSession(me); opened = true;')],
    ['못 열었는데 세션을 안 끝냄', (m) => m.replace('      if(session){ session.dispose(); session = null; }\n', '')],
    ['시작에 세션을 안 넘김', (m) => m.replace('starts[name](code, me, session)', 'starts[name](code, me)')],
    ['계정 칸을 옮기기 전에 엶', (m) => m.replace("    guard('옛 값 옮기기', () => migrateLegacy(code));\n", '').replace("    guard('realtime", "    guard('옛 값 옮기기', () => migrateLegacy(code));\n    guard('realtime")],
    ['알림에 begin 을 안 검', (m) => m.replace('twNav.on(twNav.NAV.ACCOUNT_ENTERED, begin);', '')],
    ['두 번 불러도 또 시작', (m) => m.replace("if(session){ console.warn('[app-boot] 이미 시작했어요 — 두 번째 시작은 무시해요'); return false; }", '')],
    ['끝낸 뒤에도 세션이 남아 다시 못 들어감', (m) => m.replace('        session = null;\n        s.dispose();', '        s.dispose();')],
    ['신원을 세션 끝내기보다 먼저 놓음', (m) => m.replace("        closeWindows();\n        session = null;\n        s.dispose();\n      }\n      await releaseIdentity(why, s ? s.code : null);", "        closeWindows();\n        session = null;\n      }\n      await releaseIdentity(why, s ? s.code : null);\n      if(s) s.dispose();")],
    ['연결 놓기를 세션 끝낸 뒤로', (m) => m.replace("        await releaseConnection(why);\n        closeWindows();\n        session = null;\n        s.dispose();", "        closeWindows();\n        session = null;\n        s.dispose();\n        await releaseConnection(why);")],
    ['창을 안 닫음', (m) => m.replace('        closeWindows();\n', '')],
    ['올리기 · 검문이 막아도 계속', (m) => m.replace('if(!(opt && opt.force)) return chk;', '')],
    ['force 가 없음', (m) => m.replace('if(!(opt && opt.force)) return chk;', 'return chk;')],
    ['탈퇴 · 내보냄에도 올리기 · 검문', (m) => m.replace("if(why === 'logout'){\n          const chk", "if(true){\n          const chk")],
    ['끝내는 중 두 번째 end 를 받음', (m) => m.replace("    if(ending){ console.warn('[app-boot] 이미 끝내는 중이에요(' + ending + ') — ' + why + ' 은(는) 무시해요'); return { ok:false, busy:true }; }\n", '')],
    ['나가는 중에도 시작', (m) => m.replace("    if(ending){ console.warn('[app-boot] 계정에서 나가는 중이라 시작하지 않아요(' + ending + ')'); return false; }\n", '')],
    ['끝난 뒤 화면을 안 부름', (m) => m.replace('    afterEnd(why);\n', '')],
    ['던져도 ending 이 안 풀림', (m) => m.replace('    }finally{\n      ending = null;\n    }', '    }finally{\n    }')],
    ['나가기를 nav 에 안 검', (m) => m.replace('twNav.on(twNav.NAV.ACCOUNT_LEAVE, (a) => end(a.why, a));', '')],
    ['계정 칸을 못 열어도 번호 없음', (m) => m.replace("      notifyError('E-ACC-05');\n", '')],
    ['한 칸이 던지면 다음 칸이 멈춤', (m) => m.replace("catch(e){ console.warn('[app-boot] ' + label + ' 실패', e); }", 'catch(e){ throw e; }')],
    ['비동기로 깨져도 경고가 없음', (m) => m.replace(".catch((e)=>console.warn('[app-boot] ' + label + ' 실패', e))", '.catch(()=>{})')],
    ['공지를 다시 차례 표에 넣음', (m) => m.replace("  'scheduler',", "  'notice',\n  'scheduler',")],
    ['표에서 한 기능을 뺌(closet)', (m) => m.replace("  'closet',          // 🧬 옷장(슬롯 5칸 · 보관함 · 휴지통) 서버에서 받기\n", '')],
    ['표에 있는 시작이 빠져도 통과', (m) => m.replace("    if(typeof starts[name] !== 'function') throw new Error('[app-boot] 시작 함수가 없어요: ' + name);", '')],
    ['계정이 없는 me 로도 시작', (m) => m.replace('if(!me || !me.userCode) return false;', '')],
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
