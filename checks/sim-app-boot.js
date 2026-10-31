/* sim-app-boot.js — 🚀 켜는 순서 한 곳(app-boot.js) — 계정 확인 뒤에만, 정해진 차례로, 한 번만
   실행:  node sim-app-boot.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 기능마다 «계정 확인 전 · 실패 · 나중에 확인» 을 버티는 장치가 서른 개 생겼고, 검토 때마다 다른 갈래로 같은 구멍이 나왔다
     (접속 고정이 지난 사본을 읽음 · 가입 필요인데 마이홈이 이미 씀 · 옛 값 옮기기가 확인 전에 엉뚱한 칸으로). 시작을 «들어간 뒤» 한 곳으로 모았으니 그 한 곳을 실제로 돌려 본다.
   ・1절: 만들기만 하면 아무것도 안 부른다 · 차례 표(열넷 — 공지는 계정과 무관해 표에 없다) 그대로 · «계정에 들어감» 알림(nav)에 begin 을 건다
   ・2절: 들어감 알림 — 옛 값 옮기기(그 코드) → realtime → 표 순서대로 한 번씩(코드 · me 를 받음)
   ・3절: 알림이 없으면(로그인 필요 · 가입 필요 · 서버 안 됨 · 바뀐 계정) 시작 0번 · 계정 없음(빈 me)도 0번
   ・4절: 두 번 부르면 두 번째는 무시(시작 한 번뿐) · 한 칸이 던져도(동기 · 비동기) 다음 칸은 돈다 · 표와 starts 가 어긋나면 만들 때 던진다
   ・5절: 같은 알림이 또 와도 시작은 한 번 · 로그아웃 차례는 account.js 한 곳(이 모듈은 건드리지 않음)
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
const ORDER = ['focusTotal', 'focusLevel', 'weeklyChal', 'gacha', 'slotSync', 'chars', 'mhInit', 'scheduler', 'roomInvite', 'desktopBg', 'playlist', 'licenseVerify', 'licenseRequest', 'firstRun'];

function build(src, o) {
  o = o || {};
  const win = {};
  new Function('window', src)(win);
  const ev = [];
  const navFns = {};
  const twNav = { NAV: { ACCOUNT_ENTERED: 'accountEntered' }, on: (name, fn) => { navFns[name] = fn; ev.length === 0 && 0; } };
  const starts = {};
  const names = o.names || ORDER;
  names.forEach((n) => { starts[n] = (code, me) => { ev.push('start:' + n + ':' + code + ':' + (me && me.userCode)); if (o.throwAt === n) throw new Error('깨짐 ' + n); if (o.rejectAt === n) return Promise.reject(new Error('비동기 깨짐 ' + n)); }; });
  if (o.extra) starts[o.extra] = () => {};
  if (o.omit) delete starts[o.omit];
  const deps = {
    migrateLegacy: (code) => { ev.push('migrate:' + code); },
    twNav,
    goOnline: () => { ev.push('online'); },
    starts,
  };
  const warns = [];
  const w0 = console.warn; console.warn = (...a) => { warns.push(a.join(' ')); };
  let boot = null, err = null;
  try { boot = win.TwAppBoot.createAppBoot(deps); } catch (e) { err = e; }
  console.warn = w0;
  const notify = (me) => navFns.accountEntered && navFns.accountEntered(me);   // 게이트가 nav.go(ACCOUNT_ENTERED, me) 하는 것
  return { win, boot, err, ev, warns, deps, navFns, notify };
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
  t(b.boot && Object.keys(b.boot).join() === 'begin' && Object.keys(b.navFns).join() === 'accountEntered', '내놓는 것은 begin 하나 · «계정에 들어감» 알림에 건다');
  /* 2 */
  b = build(src);
  const r1 = await quiet(async () => b.notify(ME));
  t(r1[0] === true && b.ev.join() === ['migrate:u1', 'online'].concat(ORDER.map((n) => 'start:' + n + ':u1:u1')).join(), '들어감 알림 — 옛 값 옮기기(그 코드) → realtime → 표 순서대로 한 번씩(코드 · me 를 받음)');
  const iMig = b.ev.indexOf('migrate:u1'), iOn = b.ev.indexOf('online'), iFirst = b.ev.findIndex((e) => e.startsWith('start:'));
  t(iMig === 0 && iMig < iOn && iOn < iFirst, '  옛 값 옮기기가 realtime 보다, realtime 이 모든 기능 시작보다 먼저');
  t(ORDER.every((n) => b.ev.filter((e) => e.startsWith('start:' + n + ':')).length === 1), '  각 기능은 정확히 한 번');
  /* 3 */
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
  b = build(src, { throwAt: 'gacha', rejectAt: 'chars' });
  const th = await quiet(async () => { const v = b.notify(ME); await flush(); return v; });
  t(th[0] === true && ORDER.every((n) => b.ev.some((e) => e.startsWith('start:' + n + ':'))) && th[1].some((w) => /gacha 실패/.test(w)) && th[1].some((w) => /chars 실패/.test(w)),
    '한 칸이 던져도(동기 gacha · 비동기 chars) 다음 칸은 돈다 · 어느 칸이 깨졌는지 경고');
  const miss = build(src, { omit: 'chars' });
  t(miss.err && /chars/.test(miss.err.message), '표에 있는 시작이 빠지면 만들 때 던진다(한 기능을 빼먹을 수 없다)');
  const extra = build(src, { extra: '없는기능' });
  t(extra.err && /없는기능/.test(extra.err.message), '표에 없는 시작이 남으면 만들 때 던진다');
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
    const starters = ['startFocusTotal', 'startFocusSync', 'startChalSync', 'startGachaSync', 'startSlotsSync', 'startCharsSync', 'startSchedule', 'startReceive', 'startBgSync', 'startLicenseVerify', 'startWatch'];
    chk(starters.every((n) => body.split(n + '(').length === 2) && starters.every((n) => !new RegExp('\\.' + n + '\\(').test(rest)), '  기능 시작은 app.js 에서 이 표 한 곳에서만 부른다(만든 자리에서 바로 부르지 않음)');
    /* 공지는 모두에게 같은 공용 데이터 — 계정 확인을 기다리지 않고 켤 때 받는다(로그인 화면 위에도 업데이트 공지 · 런처 배너) */
    const noticeAtBoot = (ap, bodyTxt) => /^TwNetReady\.whenNetReady\(\(\)=>noticeFeed\.start\(\)\);$/m.test(ap) && !/noticeFeed\.start\(\)/.test(bodyTxt);
    chk(noticeAtBoot(APP, body), '공지 받기는 계정 확인을 기다리지 않는다 — 켤 때(firebase-ready) 시작하고 차례 표에는 없다');
    chk(!noticeAtBoot(APP.replace('TwNetReady.whenNetReady(()=>noticeFeed.start());', ''), body) && !noticeAtBoot(APP, body + '\n notice: ()=>noticeFeed.start(),'), '  깨 보기 — 로그인 전에 공지 받기가 안 돌거나 다시 차례 표에 넣으면 빨강');
    chk(!/accountStoreMod\.migrateLegacy\(getMyUserId\(\)\)/.test(APP) && !/mhInitMod\.initMyHome\(\);/.test(rest) && !/plMod\.pull\(\)/.test(rest.replace(/plPull[^\n]*\n/g, '')), '  확인 전에 돌던 자리(옮기기 줄 · initMyHome · 플레이리스트 받기)가 app.js 에 남지 않았다');
    const order = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((x) => x[1]);
    chk(order.indexOf('launcher/app-boot.js') > 0 && order.indexOf('launcher/app-boot.js') < order.indexOf('app.js'), 'html — app-boot.js 를 app.js 보다 먼저 싣는다');
    chk(!SMOKE || /PRELOAD\.push\('app-boot\.js'\)/.test(SMOKE), 'smoke PRELOAD 에 app-boot.js');
  }

  say('── 7. 일부러 깨 보기 — 빨강이 나야 한다');
  const breaks = [
    ['차례를 바꿈(가챠 ↔ 달성표)', (m) => m.replace("  'weeklyChal',", "  'TMP',").replace("  'gacha', ", "  'weeklyChal', ").replace("  'TMP',", "  'gacha',")],
    ['옛 값 옮기기를 시작 뒤로', (m) => m.replace("    guard('옛 값 옮기기', () => migrateLegacy(code));\n    guard('realtime 연결', () => goOnline());\n    for(const name of STEPS) guard(name, () => starts[name](code, me));", "    guard('realtime 연결', () => goOnline());\n    for(const name of STEPS) guard(name, () => starts[name](code, me));\n    guard('옛 값 옮기기', () => migrateLegacy(code));")],
    ['realtime 을 시작 뒤로', (m) => m.replace("    guard('realtime 연결', () => goOnline());\n    for(const name of STEPS) guard(name, () => starts[name](code, me));", "    for(const name of STEPS) guard(name, () => starts[name](code, me));\n    guard('realtime 연결', () => goOnline());")],
    ['알림에 begin 을 안 검', (m) => m.replace('twNav.on(twNav.NAV.ACCOUNT_ENTERED, begin);', '')],
    ['두 번 불러도 또 시작', (m) => m.replace("if(began){ console.warn('[app-boot] 이미 시작했어요 — 두 번째 시작은 무시해요'); return false; }", '')],
    ['한 칸이 던지면 다음 칸이 멈춤', (m) => m.replace("catch(e){ console.warn('[app-boot] ' + label + ' 실패', e); }", 'catch(e){ throw e; }')],
    ['비동기로 깨져도 경고가 없음', (m) => m.replace(".catch((e)=>console.warn('[app-boot] ' + label + ' 실패', e))", '.catch(()=>{})')],
    ['공지를 다시 차례 표에 넣음', (m) => m.replace("  'scheduler',", "  'notice',\n  'scheduler',")],
    ['표에서 한 기능을 뺌(chars)', (m) => m.replace("  'chars',           // 🧬 캐릭터 보관함 동기\n", '')],
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
