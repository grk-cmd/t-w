/* sim-session-baseline.js — 🔐 계정 기능이 타이머 · 구독을 세션 밖에서 쥐지 않는가 (설계 s-login-session 12절 · 공통 Q2 (가))
   실행:  node sim-session-baseline.js   (러너 스테이징 또는 저장소 루트에서)
   [기준선 다시 쓰기] 저장소 루트에서 `node checks/sim-session-baseline.js --write-baseline` → checks/session-baseline.json
   ★ 왜 이 검사가 있는가 — 로그아웃을 «앱을 껐다 켜기» 에서 «세션 dispose 한 번» 으로 바꾸면(S-4d), 세션이 모르는 타이머 · 구독은 앞 계정 것이
     다음 계정에 남는다. 기능 모듈이 세션을 거치지 않고 계정 몫 타이머(setInterval · setTimeout)를 걸거나 구독(rtOn)의 해제 함수를 버리면 빨강이다.
     지금 남은 것은 기준선(파일별 개수)으로 두고 **새로 생기는 것만** 막는다. 세션으로 옮겨 줄었으면 같은 PR 에서 --write-baseline 으로 내린다(S-4d 에서 «계정 몫» 은 0).
   ・세는 것(app/parts 의 계정 기능 모듈 — 켜는 차례 STEPS 가 부르는 파일, 주석 안 뺀 본문):
       ① 창의 setInterval · setTimeout 을 바로 부른 곳(앞에 `.` 이 없는 호출 — `session.setTimeout` · `sess.setTimeout` 은 세션이 쥐니 센 것이 아니다) · friends-sub 의 setTimer
       ② 구독을 받는 함수(rtOn · rt.on · store.on)를 부르고 반환값(해제 함수)을 버린 곳 — 줄 머리에서 바로 부른 것
     남은 ① 중에는 화면 연출 · 창 위치 같은 계정 무관 타이머가 섞여 있다 — 하나씩 «계정 몫 / 무관» 가르는 일은 S-4d 앞에 한다(기준선은 늘지 않게 잡아 두기만 한다).
   ・1절: 파일을 읽었다 · 세는 법이 가짜 글에서 맞다 · 2절: 파일마다 기준선 이하 · 줄었으면 내린다
   ・3절: 실제로 돌려 본다 — 로그인 A 가 걸고 → 로그아웃(dispose) → 로그인 B: A 의 타이머 · 구독이 0 · B 는 처음부터 한 번씩 · A 의 늦은 답이 B 를 안 건드림
   ・4절: app.js 켜는 차례(starts) 가 세션을 넘긴다 · 5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

const BASE = ['.', 'app', path.join('apps', 'desktop', 'app')].map(d => path.resolve(d)).find(d => fs.existsSync(path.join(d, 'desk-companion-prototype.html')) && fs.existsSync(path.join(d, 'parts')));
if (!BASE) { say('  ? 원본 못 찾음 — desk-companion-prototype.html 과 parts/ 폴더'); process.exit(2); }
const PARTS = path.join(BASE, 'parts');
const BASE_FILE = path.join(__dirname, 'session-baseline.json');

/* 계정 기능 모듈 — 켜는 차례(app-boot STEPS)가 부르는 것과 그것이 쓰는 한 벌. 새 계정 기능 파일은 여기에 더한다 */
const MODULES = [
  'focus/focus-total.js', 'focus/focus-share.js', 'focus/focus-level.js', 'focus/focus-progress.js', 'focus/chal-store.js', 'focus/pomodoro.js',
  'character/gacha.js', 'character/closet.js',
  'myhome/myhome-init.js', 'myhome/gift-box.js', 'myhome/mallang-store.js', 'myhome/scheduler.js', 'myhome/mail-feed.js', 'myhome/friends-sub.js',
  'friends/presence-self.js', 'room/room-invite-ui.js', 'account/license-premium.js', 'status/playlist.js',
];

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
/* ① 창 타이머를 바로 부른 곳 — 앞이 `.` · 식별자 문자면 세션 · 다른 객체의 것이다 */
const RE_TIMER = /(?<![\w$.])(?:setInterval|setTimeout)\s*\(/g;
const RE_SETTER = /(?<![\w$.])setTimer\s*\(/g;   // friends-sub 가 deps 로 받은 타이머(app.js 에서는 창 setTimeout)
/* ② 구독 함수를 줄 머리에서 바로 부르고 돌려받는 것을 버린 곳 */
const RE_DROPPED = /(^|[;{}]\s*|\n\s*)(?:deps\.)?(?:rtOn|rt\.on|store\.on|TwRtHub\.store\.on)\s*\(/g;
function count(src){
  const s = strip(src);
  return { timers: (s.match(RE_TIMER) || []).length + (s.match(RE_SETTER) || []).length, dropped: (s.match(RE_DROPPED) || []).length };
}
const read = (rel) => { try{ return fs.readFileSync(path.join(PARTS, rel), 'utf8'); }catch(_){ return null; } };

const current = {};
for (const rel of MODULES) { const src = read(rel); if (src != null) current[rel] = count(src); }

if (process.argv.includes('--write-baseline')) {
  const prev = (() => { try{ return JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')); }catch(_){ return null; } })();
  const sum = (o, k) => Object.values(o).reduce((a, v) => a + v[k], 0);
  if (prev && (sum(current, 'timers') > sum(prev.counts, 'timers') || sum(current, 'dropped') > sum(prev.counts, 'dropped'))) {
    say('  ✗ 늘어난 것을 기준선에 넣지 않는다 — 세션으로 걸어 줄이거나(session.setTimeout · session.on) 이유를 PR 에 적고 손으로 고친다'); process.exit(1);
  }
  const out = { note: 'sim-session-baseline.js 기준선 — 계정 기능 모듈별 «세션을 안 거친 창 타이머 수(timers)» · «해제 함수를 버린 구독 수(dropped)». 줄기만 한다: 세션으로 옮겼으면 같은 PR 에서 --write-baseline 으로 내리고, 새로 걸지 말 것. S-4d 에서 계정 몫은 0.', counts: current };
  fs.writeFileSync(BASE_FILE, JSON.stringify(out, null, 1) + '\n');
  say('  기준선을 썼다 — ' + Object.keys(current).length + '개 파일'); process.exit(0);
}

const baseline = (() => { try{ return JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')).counts; }catch(_){ return null; } })();

say('── 1. 읽기 · 세는 법');
chk(Object.keys(current).length === MODULES.length, '계정 기능 모듈 ' + MODULES.length + '개를 다 읽었다' + (Object.keys(current).length === MODULES.length ? '' : ' — 없는 파일: ' + MODULES.filter(m => !(m in current)).join(' · ')));
chk(!!baseline, '기준선 파일(session-baseline.json)이 있다');
{
  const c = count("function a(){ setInterval(()=>{}, 5); window.setTimeout(f, 1); session.setTimeout(f, 2); sess.setInterval(f, 3); x = setTimeout(f, 9); }\n  // setInterval(f)\n  /* setTimeout(g) */");
  chk(c.timers === 2, '세는 법 — 창 타이머 바로 부름은 센다(window. 앞 호출은 점이 있어 안 센다 · session. 도 안 센다 · 주석은 뺀다)  (' + c.timers + ')');
  const d = count("rtOn('a', f);\n  const u = rtOn('b', f);\n  session.on(rtOn('c', f));\n  deps.rt.on('d', f);\n  x = deps.rt.on('e', f);");
  chk(d.dropped === 2, '세는 법 — 줄 머리에서 부르고 해제 함수를 버린 구독만 센다(받았거나 session.on 안에 넣었으면 안 센다)  (' + d.dropped + ')');
}

say('── 2. 기준선 이하 · 줄었으면 내린다');
if (baseline) {
  const over = [], less = [];
  for (const rel of MODULES) {
    const cur = current[rel]; const base = baseline[rel] || { timers: 0, dropped: 0 };
    if (!cur) continue;
    if (cur.timers > base.timers || cur.dropped > base.dropped) over.push(rel + ' (타이머 ' + cur.timers + '/' + base.timers + ' · 버린 구독 ' + cur.dropped + '/' + base.dropped + ')');
    else if (cur.timers < base.timers || cur.dropped < base.dropped) less.push(rel);
  }
  chk(!over.length, '세션을 안 거친 타이머 · 버린 구독이 기준선보다 늘지 않았다' + (over.length ? ' — ' + over.join(' · ') + ' → session.setTimeout / session.on 으로 거세요' : ''));
  chk(!less.length, '줄었으면 기준선을 같은 PR 에서 내렸다' + (less.length ? ' — ' + less.join(' · ') + ' → node checks/sim-session-baseline.js --write-baseline' : ''));
  const stale = Object.keys(baseline).filter(k => !MODULES.includes(k));
  chk(!stale.length, '기준선에 목록에 없는 파일이 없다' + (stale.length ? ' — ' + stale.join(' · ') : ''));
}

/* ── 3. 실제로 돌려 본다 ── */
const load = (rel, name) => { const w = {}; const m = { exports: {} }; new Function('window', 'module', fs.readFileSync(path.join(PARTS, rel), 'utf8'))(w, m); return w[name] || m.exports; };
const tick = () => new Promise((r) => setImmediate(r));

/* 가짜 시계 · 가짜 realtime — 살아 있는 타이머 · 구독을 세어 보려고 */
function fakeTimers(){
  let n = 0; const live = new Map();
  return { live,
    setInterval: (fn) => { const h = ++n; live.set(h, fn); return h; }, setTimeout: (fn) => { const h = ++n; live.set(h, fn); return h; },
    clearInterval: (h) => { live.delete(h); }, clearTimeout: (h) => { live.delete(h); } };
}
function fakeHub(){
  const subs = new Set(); const stateFns = new Set(); const sent = [];
  return { subs, stateFns, sent,
    on: (kind, fn) => { const h = { kind, fn }; subs.add(h); return () => { subs.delete(h); }; },
    onState: (fn) => { stateFns.add(fn); return () => { stateFns.delete(fn); }; },
    send: (m) => { sent.push(m); return true; }, isReady: () => true,
    fire: (kind, n) => { for (const h of Array.from(subs)) if (h.kind === kind) h.fn(n); } };
}

/* app.js 켜는 차례가 계정 기능 몇 개를 거는 모양 그대로 — 우편(mhInit 안) · 접속 표시 비우기(mhInit) · 라이선스(licensePremium) */
function bootAccount(S, hub, timers, userCode, held){
  const session = S.createSession({ me: { userCode }, openAccountStore: () => true, closeAccountStore: () => {}, timers });
  const err = [];
  /* 우편 */
  const mailApi = { fetchMail: async (uid) => { if(held && held[uid]) await held[uid].promise; return { items: { [uid + '-m']: { tag: 'reward', title: uid, body: '', ts: 1, read: false } }, unread: 1, complete: true }; }, markRead: async () => 'ok', markAllRead: async () => 'ok', removeRead: async () => ({ status: 'ok', deleted: 0 }), remove: async () => 'ok' };
  const feed = MAIL.createMailFeed({ api: mailApi, rt: hub, notifyError: (c) => err.push(c) });
  /* 접속 표시 */
  const presence = PRES.createPresenceSelf({ rt: hub, onUnload: () => {} });
  /* 라이선스 */
  let premium = false;
  const lp = LIC.createLicensePremium({ userApi: { me: async () => ({ premium: false }) }, licenseApi: {}, deviceId: () => 'd', deviceName: () => 'n', setPremium: (v) => { premium = v; }, isPremium: () => premium,
    rtOn: (k, f) => hub.on(k, f), resetKnown: () => { premium = false; }, notifyError: () => {}, reasonOf: () => '', resetCustomStatus: () => {},
    storage: { getItem: () => null, setItem(){}, removeItem(){} }, toast: () => {}, toastFull: () => {}, legacyKeyName: 'tw.licenseKey' });
  /* 켜는 차례 — app.js starts 와 같은 걸기(mhInit · licensePremium) */
  session.onReset(() => { presence.reset(); });
  feed.start(userCode, session);
  presence.start(true);
  session.onReset(() => lp.reset());
  lp.start({ premium: false });
  return { session, feed, presence, lp, err };
}
let MAIL, PRES, LIC, SESS;
async function runAB(){
  const timers = fakeTimers(), hub = fakeHub();
  const held = { A: (() => { let res; const promise = new Promise(r => { res = r; }); return { promise, release: res }; })() };
  const a = bootAccount(SESS, hub, timers, 'A', held);
  await tick();
  const live1 = { subs: hub.subs.size, states: hub.stateFns.size, timers: timers.live.size, counts: a.session.counts() };
  a.session.dispose();   // 로그아웃 — 세션이 한 번에 푼다
  const after = { subs: hub.subs.size, states: hub.stateFns.size, timers: timers.live.size, counts: a.session.counts(), items: Object.keys(a.feed.items()).length, status: a.feed.status() };
  const b = bootAccount(SESS, hub, timers, 'B');
  await tick(); await tick();
  const liveB = { subs: hub.subs.size, states: hub.stateFns.size, items: Object.keys(b.feed.items()).join() };
  held.A.release(); await tick(); await tick();   // A 의 붙잡아 둔 받기 답이 이제 도착
  const lateB = { items: Object.keys(b.feed.items()).join(), changed: a.feed.items() === b.feed.items() };
  b.session.dispose();
  return { live1, after, liveB, lateB, end: { subs: hub.subs.size, states: hub.stateFns.size, timers: timers.live.size } };
}

(async () => {
  say('── 3. 로그인 A → 로그아웃 → 로그인 B (실제로 돌림)');
  SESS = load('shared/session.js', 'TwSession'); MAIL = load('myhome/mail-feed.js', 'TwMailFeed'); PRES = load('friends/presence-self.js', 'TwPresenceSelf'); LIC = load('account/license-premium.js', 'TwLicensePremium');
  const r = await runAB();
  chk(r.live1.subs === 2 && r.live1.states === 1 && r.live1.counts.subs >= 1, 'A 로그인 — 서버 신호 구독 2(우편 · 라이선스) · 접속 표시 연결 구독 1이 걸린다 (' + r.live1.subs + ' · ' + r.live1.states + ')');
  chk(r.after.subs === 0 && r.after.states === 0 && r.after.timers === 0 && r.after.counts.subs === 0 && r.after.counts.resets === 0, '★ A 로그아웃(dispose) 뒤 — 살아 있는 구독 0 · 연결 구독 0 · 타이머 0 · 세션에 남은 것 0');
  chk(r.after.items === 0 && r.after.status === 'idle', '  A 의 우편은 비었다(받은 값이 남지 않는다)');
  chk(r.liveB.subs === 2 && r.liveB.states === 1 && r.liveB.items === 'B-m', '★ B 로그인 — 구독은 A 와 같은 수(쌓이지 않는다) · 우편은 B 것뿐');
  chk(r.lateB.items === 'B-m', '★ A 의 붙잡아 둔 받기 답이 뒤늦게 와도 B 우편을 안 바꾼다');
  chk(r.end.subs === 0 && r.end.states === 0 && r.end.timers === 0, '  B 도 로그아웃하면 전부 0');

  say('── 4. app.js 켜는 차례 — 세션을 넘긴다');
  const APP = (() => { try{ return strip(fs.readFileSync(path.join(PARTS, 'app.js'), 'utf8')); }catch(_){ return ''; } })();
  const want = [
    ['gacha', /gacha: \(code, me, session\)=>gachaMod\.startGacha\(session\)/],
    ['closet', /closet: \(code, me, session\)=>closetMod\.startCloset\(session\)/],
    ['mhInit', /mhInit: \(code, me, session\)=>\{ session\.onReset\(\(\)=>\{ friendsSubMod\.stop\(\); presenceSelfMod\.reset\(\); myhomeStoreMod\.reset\(\); bookshelfStoreMod\.reset\(\); \}\); return mhInitMod\.initMyHome\(code, me, session\); \}/],
    ['focusTotal', /focusTotal: \(code, me, session\)=>\{ session\.onReset\(\(\)=>focusTotalMod\.setFocusTodaySec\(0\)\); focusTotalMod\.startFocusTotal\(\); \}/],
    ['bugBadge', /bugBadge: \(code, me, session\)=>\{ session\.onReset\(\(\)=>bugBoardUi\.reset\(\)\); return bugBoardUi\.start\(\); \}/],
    ['scheduler', /scheduler: \(code, me, session\)=>mhScheduler\.startSchedule\(session\)/],
    ['playlist', /playlist: \(code, me, session\)=>plMod\.start\(session\)/],
    ['licensePremium', /licensePremium: \(code, me, session\)=>\{ session\.onReset\(\(\)=>licensePremiumMod\.reset\(\)\); return licensePremiumMod\.start\(me\); \}/],
  ];
  for (const [name, re] of want) chk(re.test(APP), name + ' — 시작 함수가 세션을 받아 모듈에 넘긴다');

  say('── 5. 일부러 깨 보기');
  /* 우편 구독을 세션에 안 맡기면 dispose 뒤에도 구독이 남는다 */
  { const orig = MAIL; const src = fs.readFileSync(path.join(PARTS, 'myhome/mail-feed.js'), 'utf8').replace("session.on(deps.rt.on('notification', onNotification));", "deps.rt.on('notification', onNotification);");
    const w = {}; new Function('window', 'module', src)(w, { exports: {} }); MAIL = w.TwMailFeed;
    const br = await runAB(); MAIL = orig;
    chk(br.after.subs > 0, '우편 구독을 세션에 안 맡기면 로그아웃 뒤에도 구독이 남아 빨강(3절)'); }
  /* 접속 표시 비우기를 세션에 안 걸면 연결 구독이 남는다 */
  { const orig = bootAccount; const src = bootAccount.toString();
    const bad = new Function('S', 'hub', 'timers', 'userCode', 'held', 'MAIL', 'PRES', 'LIC', 'return (' + src.replace('session.onReset(() => { presence.reset(); });', '') + ')(S, hub, timers, userCode, held);');
    const tm = fakeTimers(), hub = fakeHub(); const a = bad(SESS, hub, tm, 'A', null, MAIL, PRES, LIC); await tick(); a.session.dispose();
    chk(hub.stateFns.size > 0, '접속 표시 비우기를 세션에 안 걸면 연결 구독이 남아 빨강(3절)'); void orig; }
  /* 세는 법 — 창 타이머를 세션 밖에서 걸면 기준선 판정이 늘었다고 본다 */
  { const base = current['myhome/mail-feed.js'] || { timers: 0, dropped: 0 };
    const bad = count(fs.readFileSync(path.join(PARTS, 'myhome/mail-feed.js'), 'utf8') + '\nsetInterval(function(){}, 1000);\nrtOn("x", f);');
    chk(bad.timers > base.timers && bad.dropped > base.dropped, '세션 밖 타이머 · 버린 구독을 끼워 넣으면 센 값이 늘어 2절이 빨강이 된다'); }

  say('\n' + (fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
